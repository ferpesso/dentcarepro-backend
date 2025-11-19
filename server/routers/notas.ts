import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { notasUtente } from "../../drizzle/schema-ficha-utente";
import { eq, and, desc } from "drizzle-orm";

/**
 * Router para gestão de notas clínicas de utentes
 */

export const notasRouter = router({
  /**
   * Listar notas de um utente
   */
  listar: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        tipo: z.string().optional(), // filtrar por tipo
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const conditions = [
        eq(notasUtente.utenteId, input.utenteId),
        eq(notasUtente.clinicaId, ctx.user.clinicaId!),
      ];

      if (input.tipo) {
        conditions.push(eq(notasUtente.tipo, input.tipo));
      }

      const notas = await database
        .select()
        .from(notasUtente)
        .where(and(...conditions))
        .orderBy(desc(notasUtente.createdAt))
        .limit(input.limit);

      return notas;
    }),

  /**
   * Obter detalhes de uma nota
   */
  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [nota] = await database
        .select()
        .from(notasUtente)
        .where(
          and(
            eq(notasUtente.id, input.id),
            eq(notasUtente.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!nota) {
        throw new Error("Nota não encontrada");
      }

      return nota;
    }),

  /**
   * Criar nova nota
   */
  criar: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        consultaId: z.number().optional(),
        tipo: z.string(), // clinica, administrativa, lembrete, etc
        titulo: z.string().optional(),
        conteudo: z.string(),
        importante: z.boolean().optional().default(false),
        privada: z.boolean().optional().default(false),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [nota] = await database
        .insert(notasUtente)
        .values({
          utenteId: input.utenteId,
          clinicaId: ctx.user.clinicaId!,
          consultaId: input.consultaId,
          tipo: input.tipo,
          titulo: input.titulo,
          conteudo: input.conteudo,
          importante: input.importante,
          privada: input.privada,
          tags: input.tags || [],
          criadoPor: ctx.user.dentistaId || null,
        })
        .returning();

      return nota;
    }),

  /**
   * Atualizar nota existente
   */
  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        titulo: z.string().optional(),
        conteudo: z.string().optional(),
        importante: z.boolean().optional(),
        privada: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const { id, ...dados } = input;

      const [nota] = await database
        .update(notasUtente)
        .set({
          ...dados,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notasUtente.id, id),
            eq(notasUtente.clinicaId, ctx.user.clinicaId!)
          )
        )
        .returning();

      if (!nota) {
        throw new Error("Nota não encontrada");
      }

      return nota;
    }),

  /**
   * Excluir nota
   */
  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .delete(notasUtente)
        .where(
          and(
            eq(notasUtente.id, input.id),
            eq(notasUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Marcar nota como importante
   */
  marcarImportante: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        importante: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .update(notasUtente)
        .set({
          importante: input.importante,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notasUtente.id, input.id),
            eq(notasUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Estatísticas de notas
   */
  estatisticas: protectedProcedure
    .input(z.object({ utenteId: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const todasNotas = await database
        .select()
        .from(notasUtente)
        .where(
          and(
            eq(notasUtente.utenteId, input.utenteId),
            eq(notasUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      const porTipo: Record<string, number> = {};
      let importantes = 0;
      let privadas = 0;

      todasNotas.forEach((nota) => {
        porTipo[nota.tipo] = (porTipo[nota.tipo] || 0) + 1;
        if (nota.importante) importantes++;
        if (nota.privada) privadas++;
      });

      return {
        total: todasNotas.length,
        importantes,
        privadas,
        porTipo,
      };
    }),
});

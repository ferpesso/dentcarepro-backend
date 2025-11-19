import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { prescricoes } from "../../drizzle/schema-ficha-utente";
import { eq, and, desc } from "drizzle-orm";

/**
 * Router para gestão de prescrições médicas
 */

// Schema para medicamento
const medicamentoSchema = z.object({
  nome: z.string(),
  principioAtivo: z.string().optional(),
  dosagem: z.string(),
  via: z.string(), // oral, tópico, injetável, etc
  frequencia: z.string(), // 8/8h, 12/12h, etc
  duracao: z.string(), // 7 dias, 14 dias, etc
  quantidade: z.number(),
  instrucoes: z.string(),
});

export const prescricoesRouter = router({
  /**
   * Listar prescrições de um utente
   */
  listar: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const listaPrescricoes = await database
        .select()
        .from(prescricoes)
        .where(
          and(
            eq(prescricoes.utenteId, input.utenteId),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        )
        .orderBy(desc(prescricoes.dataPrescricao))
        .limit(input.limit);

      return listaPrescricoes;
    }),

  /**
   * Obter detalhes de uma prescrição
   */
  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [prescricao] = await database
        .select()
        .from(prescricoes)
        .where(
          and(
            eq(prescricoes.id, input.id),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!prescricao) {
        throw new Error("Prescrição não encontrada");
      }

      return prescricao;
    }),

  /**
   * Criar nova prescrição
   */
  criar: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        consultaId: z.number().optional(),
        dataPrescricao: z.date().optional(),
        medicamentos: z.array(medicamentoSchema),
        diagnostico: z.string().optional(),
        indicacao: z.string().optional(),
        observacoes: z.string().optional(),
        contraindicacoes: z.string().optional(),
        validadeDias: z.number().optional().default(30),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      if (!input.medicamentos || input.medicamentos.length === 0) {
        throw new Error("Prescrição deve conter pelo menos um medicamento");
      }

      const dataPrescricao = input.dataPrescricao || new Date();
      const dataValidade = new Date(dataPrescricao);
      dataValidade.setDate(dataValidade.getDate() + (input.validadeDias || 30));

      const [prescricao] = await database
        .insert(prescricoes)
        .values({
          utenteId: input.utenteId,
          clinicaId: ctx.user.clinicaId!,
          consultaId: input.consultaId,
          dataPrescricao,
          medicamentos: input.medicamentos,
          diagnostico: input.diagnostico,
          indicacao: input.indicacao,
          observacoes: input.observacoes,
          contraindicacoes: input.contraindicacoes,
          validadeDias: input.validadeDias,
          dataValidade,
          prescritoPor: ctx.user.dentistaId!,
        })
        .returning();

      return prescricao;
    }),

  /**
   * Atualizar prescrição existente
   */
  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        medicamentos: z.array(medicamentoSchema).optional(),
        diagnostico: z.string().optional(),
        indicacao: z.string().optional(),
        observacoes: z.string().optional(),
        contraindicacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const { id, ...dados } = input;

      const [prescricao] = await database
        .update(prescricoes)
        .set(dados)
        .where(
          and(
            eq(prescricoes.id, id),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        )
        .returning();

      if (!prescricao) {
        throw new Error("Prescrição não encontrada");
      }

      return prescricao;
    }),

  /**
   * Marcar prescrição como dispensada
   */
  marcarDispensada: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        dispensada: z.boolean(),
        dataDispensacao: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .update(prescricoes)
        .set({
          dispensada: input.dispensada,
          dataDispensacao: input.dataDispensacao || (input.dispensada ? new Date() : null),
        })
        .where(
          and(
            eq(prescricoes.id, input.id),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Excluir prescrição
   */
  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .delete(prescricoes)
        .where(
          and(
            eq(prescricoes.id, input.id),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Estatísticas de prescrições
   */
  estatisticas: protectedProcedure
    .input(z.object({ utenteId: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const todasPrescricoes = await database
        .select()
        .from(prescricoes)
        .where(
          and(
            eq(prescricoes.utenteId, input.utenteId),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        );

      let dispensadas = 0;
      let ativas = 0;
      let expiradas = 0;
      const hoje = new Date();

      todasPrescricoes.forEach((prescricao) => {
        if (prescricao.dispensada) {
          dispensadas++;
        }
        
        if (prescricao.dataValidade) {
          const validade = new Date(prescricao.dataValidade);
          if (validade < hoje) {
            expiradas++;
          } else if (!prescricao.dispensada) {
            ativas++;
          }
        }
      });

      return {
        total: todasPrescricoes.length,
        dispensadas,
        ativas,
        expiradas,
      };
    }),

  /**
   * Gerar PDF da prescrição
   * (Placeholder - implementação futura)
   */
  gerarPDF: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Buscar prescrição
      const [prescricao] = await database
        .select()
        .from(prescricoes)
        .where(
          and(
            eq(prescricoes.id, input.id),
            eq(prescricoes.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!prescricao) {
        throw new Error("Prescrição não encontrada");
      }

      // TODO: Implementar geração de PDF
      // Por enquanto, retorna apenas a URL placeholder
      return {
        sucesso: true,
        url: `/api/prescricoes/${input.id}/pdf`,
        mensagem: "Geração de PDF será implementada em breve",
      };
    }),
});

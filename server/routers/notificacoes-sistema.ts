import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { db } from "../../drizzle/db";
import { notificacoes, preferenciasNotificacoes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const notificacoesSistemaRouter = router({
  /**
   * Listar notificações do usuário
   */
  listar: protectedProcedure
    .input(z.object({
      clinicaId: z.number(),
      limite: z.number().optional().default(50),
      apenasNaoLidas: z.boolean().optional().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(notificacoes.userId, ctx.user.id),
        eq(notificacoes.clinicaId, input.clinicaId),
      ];

      if (input.apenasNaoLidas) {
        conditions.push(eq(notificacoes.lida, false));
      }

      const resultado = await db
        .select()
        .from(notificacoes)
        .where(and(...conditions))
        .orderBy(desc(notificacoes.createdAt))
        .limit(input.limite);

      return resultado;
    }),

  /**
   * Contar notificações não lidas
   */
  contarNaoLidas: protectedProcedure
    .input(z.object({
      clinicaId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const resultado = await db
        .select()
        .from(notificacoes)
        .where(
          and(
            eq(notificacoes.userId, ctx.user.id),
            eq(notificacoes.clinicaId, input.clinicaId),
            eq(notificacoes.lida, false)
          )
        );

      return { total: resultado.length };
    }),

  /**
   * Marcar notificação como lida
   */
  marcarComoLida: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(notificacoes)
        .set({
          lida: true,
          lidaEm: new Date(),
        })
        .where(
          and(
            eq(notificacoes.id, input.id),
            eq(notificacoes.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * Marcar todas como lidas
   */
  marcarTodasComoLidas: protectedProcedure
    .input(z.object({
      clinicaId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(notificacoes)
        .set({
          lida: true,
          lidaEm: new Date(),
        })
        .where(
          and(
            eq(notificacoes.userId, ctx.user.id),
            eq(notificacoes.clinicaId, input.clinicaId),
            eq(notificacoes.lida, false)
          )
        );

      return { success: true };
    }),

  /**
   * Criar nova notificação
   */
  criar: protectedProcedure
    .input(z.object({
      clinicaId: z.number(),
      tipo: z.string(),
      titulo: z.string(),
      mensagem: z.string(),
      link: z.string().optional(),
      icone: z.string().optional(),
      cor: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [notificacao] = await db
        .insert(notificacoes)
        .values({
          userId: ctx.user.id,
          clinicaId: input.clinicaId,
          tipo: input.tipo,
          titulo: input.titulo,
          mensagem: input.mensagem,
          link: input.link,
          icone: input.icone,
          cor: input.cor,
        })
        .returning();

      return notificacao;
    }),

  /**
   * Obter preferências de notificações
   */
  obterPreferencias: protectedProcedure
    .query(async ({ ctx }) => {
      const [prefs] = await db
        .select()
        .from(preferenciasNotificacoes)
        .where(eq(preferenciasNotificacoes.userId, ctx.user.id));

      // Se não existir, criar com valores padrão
      if (!prefs) {
        const [novasPrefs] = await db
          .insert(preferenciasNotificacoes)
          .values({
            userId: ctx.user.id,
          })
          .returning();

        return novasPrefs;
      }

      return prefs;
    }),

  /**
   * Atualizar preferências de notificações
   */
  atualizarPreferencias: protectedProcedure
    .input(z.object({
      avaliacoesNegativas: z.boolean().optional(),
      custosAltos: z.boolean().optional(),
      pagamentosPendentes: z.boolean().optional(),
      novasAvaliacoes: z.boolean().optional(),
      limiteAvaliacaoNegativa: z.number().optional(),
      limiteCustoAlto: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [prefs] = await db
        .update(preferenciasNotificacoes)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(preferenciasNotificacoes.userId, ctx.user.id))
        .returning();

      return prefs;
    }),

  /**
   * Deletar notificação
   */
  deletar: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(notificacoes)
        .where(
          and(
            eq(notificacoes.id, input.id),
            eq(notificacoes.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { aiAssistant } from "../ai-assistant-service";

/**
 * Router tRPC para o Assistente IA
 * Fornece recomendações inteligentes para todas as páginas
 */
export const aiAssistantRouter = router({
  /**
   * Obter recomendações para o Dashboard
   */
  getDashboardRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = await aiAssistant.getDashboardRecommendations(input.clinicaId);
      const alerts = await aiAssistant.getAlerts(input.clinicaId);
      const quickTips = aiAssistant.getQuickTips("dashboard");

      return {
        recommendations,
        alerts,
        quickTips,
      };
    }),

  /**
   * Obter recomendações para a página de Utentes
   */
  getUtentesRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        totalUtentes: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = await aiAssistant.getUtentesRecommendations(
        input.clinicaId,
        input.totalUtentes
      );
      const quickTips = aiAssistant.getQuickTips("utentes");

      return {
        recommendations,
        alerts: [],
        quickTips,
      };
    }),

  /**
   * Obter recomendações para a Agenda
   */
  getAgendaRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = await aiAssistant.getAgendaRecommendations(input.clinicaId);
      const quickTips = aiAssistant.getQuickTips("agenda");

      return {
        recommendations,
        alerts: [],
        quickTips,
      };
    }),

  /**
   * Obter recomendações para Faturas
   */
  getFaturasRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = await aiAssistant.getFaturasRecommendations(input.clinicaId);
      const quickTips = aiAssistant.getQuickTips("faturas");

      return {
        recommendations,
        alerts: [],
        quickTips,
      };
    }),

  /**
   * Obter recomendações para Procedimentos
   */
  getProcedimentosRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = aiAssistant.getProcedimentosRecommendations();
      const quickTips = aiAssistant.getQuickTips("procedimentos");

      return {
        recommendations,
        alerts: [],
        quickTips,
      };
    }),

  /**
   * Obter recomendações para Relatórios
   */
  getRelatoriosRecommendations: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const recommendations = aiAssistant.getRelatoriosRecommendations();
      const quickTips = aiAssistant.getQuickTips("relatorios");

      return {
        recommendations,
        alerts: [],
        quickTips,
      };
    }),

  /**
   * Obter insights avançados usando IA (GPT-4)
   */
  getAIInsights: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        userId: z.number(),
        pagina: z.string(),
        dados: z.any().optional(),
      })
    )
    .query(async ({ input }) => {
      const insights = await aiAssistant.getAIInsights({
        clinicaId: input.clinicaId,
        userId: input.userId,
        pagina: input.pagina,
        dados: input.dados,
      });

      return {
        insights,
      };
    }),

  /**
   * Obter estatísticas para insights
   */
  getInsightStats: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const stats = await aiAssistant.getInsightStats(input.clinicaId);
      return stats;
    }),

  /**
   * Obter alertas importantes
   */
  getAlerts: publicProcedure
    .input(
      z.object({
        clinicaId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const alerts = await aiAssistant.getAlerts(input.clinicaId);
      return { alerts };
    }),
});

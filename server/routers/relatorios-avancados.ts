import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import RelatoriosAvancadosService from "../relatorios-avancados-service";

/**
 * Router tRPC para Relatorios Avancados
 */

export const relatoriosAvancadosRouter = router({
  /**
   * Obter KPIs gerais
   */
  getKPIs: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      dataInicio: z.string(),
      dataFim: z.string(),
      compararComPeriodoAnterior: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const periodo = {
        dataInicio: new Date(input.dataInicio),
        dataFim: new Date(input.dataFim),
      };

      let periodoAnterior;
      if (input.compararComPeriodoAnterior) {
        const diasDiferenca = Math.ceil(
          (periodo.dataFim.getTime() - periodo.dataInicio.getTime()) / (1000 * 60 * 60 * 24)
        );
        periodoAnterior = {
          dataInicio: new Date(periodo.dataInicio.getTime() - diasDiferenca * 24 * 60 * 60 * 1000),
          dataFim: new Date(periodo.dataInicio.getTime() - 1),
        };
      }

      return await RelatoriosAvancadosService.getKPIsGerais(
        input.clinicaId,
        periodo,
        periodoAnterior
      );
    }),

  /**
   * Analise de rentabilidade
   */
  getAnaliseRentabilidade: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const periodo = {
        dataInicio: new Date(input.dataInicio),
        dataFim: new Date(input.dataFim),
      };

      return await RelatoriosAvancadosService.getAnaliseRentabilidade(
        input.clinicaId,
        periodo
      );
    }),

  /**
   * Analise de dentistas
   */
  getAnaliseDentistas: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      dataInicio: z.string(),
      dataFim: z.string(),
    }))
    .query(async ({ input }) => {
      const periodo = {
        dataInicio: new Date(input.dataInicio),
        dataFim: new Date(input.dataFim),
      };

      return await RelatoriosAvancadosService.getAnaliseDentistas(
        input.clinicaId,
        periodo
      );
    }),

  /**
   * Previsao financeira
   */
  getPrevisaoFinanceira: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      mesesFuturos: z.number().min(1).max(12).default(3),
    }))
    .query(async ({ input }) => {
      return await RelatoriosAvancadosService.getPrevisaoFinanceira(
        input.clinicaId,
        input.mesesFuturos
      );
    }),

  /**
   * Comparar periodos
   */
  compararPeriodos: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      periodo1Inicio: z.string(),
      periodo1Fim: z.string(),
      periodo2Inicio: z.string(),
      periodo2Fim: z.string(),
    }))
    .query(async ({ input }) => {
      const periodo1 = {
        dataInicio: new Date(input.periodo1Inicio),
        dataFim: new Date(input.periodo1Fim),
      };

      const periodo2 = {
        dataInicio: new Date(input.periodo2Inicio),
        dataFim: new Date(input.periodo2Fim),
      };

      return await RelatoriosAvancadosService.compararPeriodos(
        input.clinicaId,
        periodo1,
        periodo2
      );
    }),
});

export default relatoriosAvancadosRouter;

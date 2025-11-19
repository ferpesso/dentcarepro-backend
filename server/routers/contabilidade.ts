import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import SAFTExportService from "../saft-export-service";

/**
 * Router tRPC para Contabilidade
 * Funcionalidades para contabilistas
 */
export const contabilidadeRouter = router({
  /**
   * Exportar SAF-T PT (XML)
   */
  exportarSAFT: protectedProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
        tipoDocumento: z.enum(["FT", "FS", "FR", "NC", "ND"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const xml = await SAFTExportService.exportarSAFT(input);
      
      // Retornar como base64 para download
      const base64 = Buffer.from(xml).toString('base64');
      
      return {
        success: true,
        xml,
        base64,
        filename: `SAFT-PT_${input.clinicaId}_${input.dataInicio.toISOString().split('T')[0]}_${input.dataFim.toISOString().split('T')[0]}.xml`,
      };
    }),

  /**
   * Exportar para Excel
   */
  exportarExcel: protectedProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      })
    )
    .query(async ({ input }) => {
      const dados = await SAFTExportService.exportarExcel(input);
      
      return {
        success: true,
        dados,
        filename: `Faturas_${input.clinicaId}_${input.dataInicio.toISOString().split('T')[0]}_${input.dataFim.toISOString().split('T')[0]}.xlsx`,
      };
    }),

  /**
   * Relatorio de IVA
   */
  relatorioIVA: protectedProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        ano: z.number(),
        trimestre: z.number().min(1).max(4),
      })
    )
    .query(async ({ input }) => {
      const relatorio = await SAFTExportService.relatorioIVA(
        input.clinicaId,
        input.ano,
        input.trimestre
      );
      
      return {
        success: true,
        relatorio,
      };
    }),

  /**
   * Resumo anual para contabilista
   */
  resumoAnual: protectedProcedure
    .input(
      z.object({
        clinicaId: z.number(),
        ano: z.number(),
      })
    )
    .query(async ({ input }) => {
      // Gerar resumo de todos os trimestres
      const trimestres = [];
      
      for (let t = 1; t <= 4; t++) {
        const relatorio = await SAFTExportService.relatorioIVA(
          input.clinicaId,
          input.ano,
          t
        );
        trimestres.push(relatorio);
      }

      // Calcular totais anuais
      const totalAnual = trimestres.reduce((sum, t) => sum + t.totalFaturado, 0);
      const totalPagoAnual = trimestres.reduce((sum, t) => sum + t.totalPago, 0);
      const numeroFaturasAnual = trimestres.reduce((sum, t) => sum + t.numeroFaturas, 0);

      return {
        success: true,
        ano: input.ano,
        trimestres,
        totais: {
          totalFaturado: totalAnual,
          totalPago: totalPagoAnual,
          numeroFaturas: numeroFaturasAnual,
          ivaIsento: totalAnual,
          ivaCobrado: 0,
        },
      };
    }),
});

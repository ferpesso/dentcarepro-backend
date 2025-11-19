import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { faturas, pagamentosFatura } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Endpoints adicionais para faturas
 * Adicionar ao router principal em routers.ts
 */

export const faturasAdicionais = {
  // Registrar pagamento de fatura
  registrarPagamento: protectedProcedure
    .input(z.object({
      faturaId: z.number(),
      clinicaId: z.number(),
      valor: z.string(),
      metodoPagamento: z.enum(["dinheiro", "cartao", "transferencia", "mbway", "multibanco", "outro"]),
      dataPagamento: z.date(),
      referencia: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Verificar se a fatura pertence à clínica
      const fatura = await database
        .select()
        .from(faturas)
        .where(and(
          eq(faturas.id, input.faturaId),
          eq(faturas.clinicaId, input.clinicaId)
        ))
        .limit(1);

      if (fatura.length === 0) {
        throw new Error("Fatura não encontrada");
      }

      // Registrar pagamento
      const [pagamento] = await database.insert(pagamentosFatura).values({
        faturaId: input.faturaId,
        valor: input.valor,
        metodoPagamento: input.metodoPagamento,
        dataPagamento: input.dataPagamento,
        referencia: input.referencia,
        observacoes: input.observacoes,
      });

      // Atualizar valor pago da fatura
      const valorPagoAtual = parseFloat(fatura[0].valorPago || "0");
      const novoValorPago = valorPagoAtual + parseFloat(input.valor);
      const valorTotal = parseFloat(fatura[0].valorTotal);

      // Determinar novo estado
      let novoEstado = fatura[0].estado;
      if (novoValorPago >= valorTotal) {
        novoEstado = "paga";
      } else if (novoValorPago > 0) {
        novoEstado = "parcialmente_paga";
      }

      await database
        .update(faturas)
        .set({
          valorPago: novoValorPago.toFixed(2),
          estado: novoEstado,
          updatedAt: new Date(),
        })
        .where(eq(faturas.id, input.faturaId));

      return { 
        success: true, 
        pagamentoId: pagamento.insertId,
        novoEstado,
        valorPago: novoValorPago.toFixed(2),
      };
    }),
};

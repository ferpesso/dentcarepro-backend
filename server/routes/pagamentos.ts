import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { faturas, utentes } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { 
  criarSessaoCheckout, 
  criarPaymentIntent,
  obterPagamento,
  obterSessaoCheckout,
  criarReembolso
} from "../integrations/stripe/payments";
import { getStripePublishableKey } from "../integrations/stripe/client";

/**
 * Router de Pagamentos
 */
export const pagamentosRouter = router({
  /**
   * Obter chave pública do Stripe
   */
  obterChavePublica: publicProcedure
    .query(async () => {
      return {
        publishableKey: getStripePublishableKey(),
      };
    }),

  /**
   * Criar sessão de checkout para pagamento de fatura
   */
  criarCheckout: protectedProcedure
    .input(z.object({
      faturaId: z.number(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar fatura
      const [fatura] = await db
        .select({
          fatura: faturas,
          utente: utentes,
        })
        .from(faturas)
        .innerJoin(utentes, eq(faturas.utenteId, utentes.id))
        .where(and(
          eq(faturas.id, input.faturaId),
          eq(faturas.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!fatura) {
        throw new Error("Fatura não encontrada");
      }

      if (fatura.fatura.estado === 'paga') {
        throw new Error("Fatura já está paga");
      }

      // Criar sessão de checkout
      const session = await criarSessaoCheckout({
        faturaId: input.faturaId,
        valor: parseFloat(fatura.fatura.valorTotal),
        descricao: `Fatura #${fatura.fatura.numeroFatura}`,
        clienteEmail: fatura.utente.email || '',
        clienteNome: fatura.utente.nome,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: {
          clinicaId: ctx.user.clinicaId!.toString(),
          utenteId: fatura.utente.id.toString(),
        },
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  /**
   * Criar Payment Intent
   */
  criarPaymentIntent: protectedProcedure
    .input(z.object({
      faturaId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar fatura
      const [fatura] = await db
        .select()
        .from(faturas)
        .where(and(
          eq(faturas.id, input.faturaId),
          eq(faturas.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!fatura) {
        throw new Error("Fatura não encontrada");
      }

      if (fatura.estado === 'paga') {
        throw new Error("Fatura já está paga");
      }

      // Criar Payment Intent
      const paymentIntent = await criarPaymentIntent({
        valor: parseFloat(fatura.valorTotal),
        descricao: `Fatura #${fatura.numeroFatura}`,
        faturaId: input.faturaId,
        metadata: {
          clinicaId: ctx.user.clinicaId!.toString(),
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    }),

  /**
   * Verificar status de pagamento
   */
  verificarPagamento: protectedProcedure
    .input(z.object({
      paymentIntentId: z.string(),
    }))
    .query(async ({ input }) => {
      const paymentIntent = await obterPagamento(input.paymentIntentId);

      return {
        status: paymentIntent.status,
        pago: paymentIntent.status === 'succeeded',
        valor: paymentIntent.amount / 100,
        moeda: paymentIntent.currency,
      };
    }),

  /**
   * Verificar sessão de checkout
   */
  verificarCheckout: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      const session = await obterSessaoCheckout(input.sessionId);

      return {
        status: session.status,
        paymentStatus: session.payment_status,
        pago: session.payment_status === 'paid',
        valor: (session.amount_total || 0) / 100,
        faturaId: session.metadata?.faturaId,
      };
    }),

  /**
   * Criar reembolso
   */
  criarReembolso: protectedProcedure
    .input(z.object({
      paymentIntentId: z.string(),
      valor: z.number().optional(),
      motivo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const refund = await criarReembolso({
        paymentIntentId: input.paymentIntentId,
        valor: input.valor,
        motivo: input.motivo,
      });

      return {
        refundId: refund.id,
        status: refund.status,
        valor: refund.amount / 100,
      };
    }),
});

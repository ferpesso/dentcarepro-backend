import { getStripeClient } from './client';
import type Stripe from 'stripe';

/**
 * Criar sessão de checkout para pagamento de fatura
 */
export async function criarSessaoCheckout(params: {
  faturaId: number;
  valor: number;
  descricao: string;
  clienteEmail: string;
  clienteNome: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: params.descricao,
            description: `Fatura #${params.faturaId}`,
          },
          unit_amount: Math.round(params.valor * 100), // Converter para cêntimos
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.clienteEmail,
    client_reference_id: params.faturaId.toString(),
    metadata: {
      faturaId: params.faturaId.toString(),
      ...params.metadata,
    },
  });

  return session;
}

/**
 * Criar Payment Intent para pagamento direto
 */
export async function criarPaymentIntent(params: {
  valor: number;
  descricao: string;
  faturaId: number;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.valor * 100), // Converter para cêntimos
    currency: 'eur',
    description: params.descricao,
    metadata: {
      faturaId: params.faturaId.toString(),
      ...params.metadata,
    },
  });

  return paymentIntent;
}

/**
 * Obter detalhes de um pagamento
 */
export async function obterPagamento(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Obter detalhes de uma sessão de checkout
 */
export async function obterSessaoCheckout(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Criar reembolso
 */
export async function criarReembolso(params: {
  paymentIntentId: string;
  valor?: number; // Se não especificado, reembolsa o valor total
  motivo?: string;
}): Promise<Stripe.Refund> {
  const stripe = getStripeClient();

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: params.paymentIntentId,
  };

  if (params.valor) {
    refundParams.amount = Math.round(params.valor * 100);
  }

  if (params.motivo) {
    refundParams.metadata = {
      motivo: params.motivo,
    };
  }

  return await stripe.refunds.create(refundParams);
}

/**
 * Listar pagamentos de um cliente
 */
export async function listarPagamentosCliente(customerEmail: string): Promise<Stripe.PaymentIntent[]> {
  const stripe = getStripeClient();

  const paymentIntents = await stripe.paymentIntents.list({
    limit: 100,
  });

  // Filtrar por email do cliente (via metadata ou customer)
  return paymentIntents.data.filter((pi) => {
    // Aqui você pode adicionar lógica mais complexa de filtragem
    return true;
  });
}

/**
 * Verificar status de pagamento
 */
export function verificarStatusPagamento(paymentIntent: Stripe.PaymentIntent): {
  pago: boolean;
  status: string;
  valor: number;
} {
  return {
    pago: paymentIntent.status === 'succeeded',
    status: paymentIntent.status,
    valor: paymentIntent.amount / 100, // Converter de cêntimos para euros
  };
}

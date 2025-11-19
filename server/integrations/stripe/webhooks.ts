import { getStripeClient } from './client';
import type Stripe from 'stripe';
import { getDb } from '../../db';
import { faturas, pagamentosFatura } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Processar webhook do Stripe
 */
export async function processarWebhookStripe(
  payload: string | Buffer,
  signature: string
): Promise<{ received: boolean; event?: Stripe.Event }> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET não está configurada');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error('Erro ao verificar webhook:', err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  // Processar evento
  await processarEvento(event);

  return { received: true, event };
}

/**
 * Processar evento do Stripe
 */
async function processarEvento(event: Stripe.Event): Promise<void> {
  console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed':
      await processarCheckoutCompleto(event.data.object as Stripe.Checkout.Session);
      break;

    case 'payment_intent.succeeded':
      await processarPagamentoSucesso(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await processarPagamentoFalhou(event.data.object as Stripe.PaymentIntent);
      break;

    case 'charge.refunded':
      await processarReembolso(event.data.object as Stripe.Charge);
      break;

    default:
      console.log(`[Stripe Webhook] Evento não tratado: ${event.type}`);
  }
}

/**
 * Processar checkout completo
 */
async function processarCheckoutCompleto(session: Stripe.Checkout.Session): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Stripe Webhook] Database não disponível');
    return;
  }

  const faturaId = session.metadata?.faturaId;
  if (!faturaId) {
    console.error('[Stripe Webhook] faturaId não encontrado nos metadata');
    return;
  }

  console.log(`[Stripe Webhook] Checkout completo para fatura #${faturaId}`);

  // Atualizar status da fatura
  await db
    .update(faturas)
    .set({
      estado: 'paga',
      dataPagamento: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(faturas.id, parseInt(faturaId)));

  // Registrar pagamento
  await db.insert(pagamentosFatura).values({
    faturaId: parseInt(faturaId),
    valor: ((session.amount_total || 0) / 100).toString(),
    metodoPagamento: 'stripe',
    referencia: session.id,
    estado: 'confirmado',
    dataPagamento: new Date(),
  });

  console.log(`[Stripe Webhook] Fatura #${faturaId} marcada como paga`);
}

/**
 * Processar pagamento bem-sucedido
 */
async function processarPagamentoSucesso(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Stripe Webhook] Database não disponível');
    return;
  }

  const faturaId = paymentIntent.metadata?.faturaId;
  if (!faturaId) {
    console.log('[Stripe Webhook] PaymentIntent sem faturaId nos metadata');
    return;
  }

  console.log(`[Stripe Webhook] Pagamento bem-sucedido para fatura #${faturaId}`);

  // Atualizar status da fatura
  await db
    .update(faturas)
    .set({
      estado: 'paga',
      dataPagamento: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(faturas.id, parseInt(faturaId)));

  console.log(`[Stripe Webhook] Fatura #${faturaId} marcada como paga`);
}

/**
 * Processar falha de pagamento
 */
async function processarPagamentoFalhou(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const faturaId = paymentIntent.metadata?.faturaId;
  if (!faturaId) {
    return;
  }

  console.log(`[Stripe Webhook] Pagamento falhou para fatura #${faturaId}`);
  console.log(`[Stripe Webhook] Motivo: ${paymentIntent.last_payment_error?.message}`);

  // Aqui você pode adicionar lógica para notificar o cliente sobre a falha
}

/**
 * Processar reembolso
 */
async function processarReembolso(charge: Stripe.Charge): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Stripe Webhook] Database não disponível');
    return;
  }

  console.log(`[Stripe Webhook] Reembolso processado: ${charge.id}`);

  // Aqui você pode adicionar lógica para atualizar o status da fatura
  // ou registrar o reembolso no histórico de pagamentos
}

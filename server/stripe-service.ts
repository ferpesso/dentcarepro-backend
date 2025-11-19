import Stripe from "stripe";
import { getDb } from "./db";
import {
  assinaturasClinica,
  planosAssinatura,
  clinicas,
  pagamentos,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Serviço de Integração com Stripe
 * Gestão de assinaturas, pagamentos e webhooks
 */

// Inicializar Stripe (apenas se a chave estiver configurada)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-11-20" as any }) : null;

/**
 * Verificar se Stripe está configurado
 */
export function isStripeConfigured(): boolean {
  return !!stripe;
}

/**
 * Criar cliente Stripe
 */
export async function criarClienteStripe(dados: {
  email: string;
  nome: string;
  clinicaId: number;
}) {
  if (!stripe) throw new Error("Stripe não configurado");

  const cliente = await stripe.customers.create({
    email: dados.email,
    name: dados.nome,
    metadata: {
      clinicaId: dados.clinicaId.toString(),
    },
  });

  return cliente;
}

/**
 * Criar sessão de checkout para assinatura
 */
export async function criarSessaoCheckout(dados: {
  clinicaId: number;
  planoId: number;
  cicloFaturacao: "mensal" | "anual";
  successUrl: string;
  cancelUrl: string;
}) {
  if (!stripe) throw new Error("Stripe não configurado");

  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  // Obter plano
  const [plano] = await db
    .select()
    .from(planosAssinatura)
    .where(eq(planosAssinatura.id, dados.planoId));

  if (!plano) throw new Error("Plano não encontrado");

  // Obter clínica
  const [clinica] = await db
    .select()
    .from(clinicas)
    .where(eq(clinicas.id, dados.clinicaId));

  if (!clinica) throw new Error("Clínica não encontrada");

  // Determinar price ID
  const priceId =
    dados.cicloFaturacao === "mensal"
      ? plano.stripePriceIdMensal
      : plano.stripePriceIdAnual;

  if (!priceId) {
    throw new Error("Price ID do Stripe não configurado para este plano");
  }

  // Criar ou obter cliente Stripe
  let customerId: string;

  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.clinicaId, dados.clinicaId));

  if (assinatura?.stripeCustomerId) {
    customerId = assinatura.stripeCustomerId;
  } else {
    const cliente = await criarClienteStripe({
      email: clinica.email || "",
      nome: clinica.nome,
      clinicaId: dados.clinicaId,
    });
    customerId = cliente.id;
  }

  // Criar sessão de checkout
  const sessao = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: dados.successUrl,
    cancel_url: dados.cancelUrl,
    metadata: {
      clinicaId: dados.clinicaId.toString(),
      planoId: dados.planoId.toString(),
      cicloFaturacao: dados.cicloFaturacao,
    },
  });

  return sessao;
}

/**
 * Criar portal de gestão de assinatura
 */
export async function criarPortalAssinatura(dados: {
  clinicaId: number;
  returnUrl: string;
}) {
  if (!stripe) throw new Error("Stripe não configurado");

  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  // Obter assinatura
  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.clinicaId, dados.clinicaId));

  if (!assinatura?.stripeCustomerId) {
    throw new Error("Cliente Stripe não encontrado");
  }

  // Criar sessão do portal
  const sessao = await stripe.billingPortal.sessions.create({
    customer: assinatura.stripeCustomerId,
    return_url: dados.returnUrl,
  });

  return sessao;
}

/**
 * Processar webhook do Stripe
 */
export async function processarWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ received: boolean; error?: string }> {
  if (!stripe) return { received: false, error: "Stripe não configurado" };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { received: false, error: "Webhook secret não configurado" };
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    const db = await getDb();
    if (!db) return { received: false, error: "Base de dados não disponível" };

    // Processar diferentes tipos de eventos
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, db);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice, db);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice, db);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, db);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, db);
        break;
      }
    }

    return { received: true };
  } catch (error: any) {
    return { received: false, error: error.message };
  }
}

/**
 * Handlers de eventos do Stripe
 */

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, db: any) {
  const clinicaId = parseInt(session.metadata?.clinicaId || "0");
  const planoId = parseInt(session.metadata?.planoId || "0");

  if (!clinicaId || !planoId) return;

  const agora = new Date();
  const fimPeriodo = new Date();
  fimPeriodo.setMonth(fimPeriodo.getMonth() + 1);

  // Atualizar ou criar assinatura
  await db
    .insert(assinaturasClinica)
    .values({
      clinicaId,
      planoId,
      estado: "ativo",
      cicloFaturacao: session.metadata?.cicloFaturacao || "mensal",
      inicioPeriodoAtual: agora,
      fimPeriodoAtual: fimPeriodo,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    })
    .onDuplicateKeyUpdate({
      set: {
        estado: "ativo",
        stripeSubscriptionId: session.subscription as string,
        updatedAt: new Date(),
      },
    });
}

async function handleInvoicePaid(invoice: Stripe.Invoice, db: any) {
  const customerId = invoice.customer as string;

  // Encontrar assinatura
  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.stripeCustomerId, customerId));

  if (!assinatura) return;

  // Registar pagamento
  await db.insert(pagamentos).values({
    clinicaId: assinatura.clinicaId,
    assinaturaId: assinatura.id,
    valor: (invoice.amount_paid / 100).toString(),
    moeda: invoice.currency.toUpperCase(),
    estado: "sucesso",
    descricao: `Pagamento de assinatura - ${invoice.lines.data[0]?.description || ""}`,
    stripePaymentIntentId: typeof (invoice as any).payment_intent === 'string' ? (invoice as any).payment_intent : (invoice as any).payment_intent?.id || null,
    stripeInvoiceId: invoice.id,
    pagoEm: new Date(invoice.status_transitions.paid_at! * 1000),
  });

  // Atualizar estado da assinatura
  await db
    .update(assinaturasClinica)
    .set({ estado: "ativo", updatedAt: new Date() })
    .where(eq(assinaturasClinica.id, assinatura.id));
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, db: any) {
  const customerId = invoice.customer as string;

  // Encontrar assinatura
  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.stripeCustomerId, customerId));

  if (!assinatura) return;

  // Atualizar estado
  await db
    .update(assinaturasClinica)
    .set({ estado: "em_atraso", updatedAt: new Date() })
    .where(eq(assinaturasClinica.id, assinatura.id));

  // Registar pagamento falhado
  await db.insert(pagamentos).values({
    clinicaId: assinatura.clinicaId,
    assinaturaId: assinatura.id,
    valor: (invoice.amount_due / 100).toString(),
    moeda: invoice.currency.toUpperCase(),
    estado: "falhado",
    descricao: `Pagamento falhado - ${invoice.lines.data[0]?.description || ""}`,
    stripeInvoiceId: invoice.id,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, db: any) {
  // Encontrar assinatura
  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.stripeSubscriptionId, subscription.id));

  if (!assinatura) return;

  // Atualizar períodos
  await db
    .update(assinaturasClinica)
    .set({
      inicioPeriodoAtual: new Date((subscription as any).current_period_start * 1000),
      fimPeriodoAtual: new Date((subscription as any).current_period_end * 1000),
      cancelarNoFimPeriodo: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(assinaturasClinica.id, assinatura.id));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, db: any) {
  // Encontrar assinatura
  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.stripeSubscriptionId, subscription.id));

  if (!assinatura) return;

  // Atualizar estado
  await db
    .update(assinaturasClinica)
    .set({
      estado: "cancelado",
      canceladoEm: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(assinaturasClinica.id, assinatura.id));
}

/**
 * Cancelar assinatura
 */
export async function cancelarAssinatura(clinicaId: number, imediato: boolean = false) {
  if (!stripe) throw new Error("Stripe não configurado");

  const db = await getDb();
  if (!db) throw new Error("Base de dados não disponível");

  const [assinatura] = await db
    .select()
    .from(assinaturasClinica)
    .where(eq(assinaturasClinica.clinicaId, clinicaId));

  if (!assinatura?.stripeSubscriptionId) {
    throw new Error("Assinatura não encontrada");
  }

  if (imediato) {
    await stripe.subscriptions.cancel(assinatura.stripeSubscriptionId);
  } else {
    await stripe.subscriptions.update(assinatura.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  return { success: true };
}

/**
 * Obter informações da assinatura do Stripe
 */
export async function getInfoAssinaturaStripe(subscriptionId: string) {
  if (!stripe) throw new Error("Stripe não configurado");

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription;
}

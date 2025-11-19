import Stripe from 'stripe';

/**
 * Cliente Stripe configurado
 */
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY não está configurada');
    }

    stripeClient = new Stripe(apiKey, {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    });
  }

  return stripeClient;
}

/**
 * Chave pública do Stripe para o frontend
 */
export function getStripePublishableKey(): string {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (!key) {
    throw new Error('STRIPE_PUBLISHABLE_KEY não está configurada');
  }

  return key;
}

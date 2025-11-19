/**
 * Produtos e preços do DentCarePro SaaS no Stripe
 * 
 * Estes produtos devem ser criados no Stripe Dashboard ou via API
 */

export const STRIPE_PRODUCTS = {
  BASICO: {
    name: "Plano Básico",
    description: "Ideal para clínicas pequenas com até 100 utentes",
    features: [
      "Até 100 utentes ativos",
      "1 dentista",
      "Agenda básica",
      "Gestão de consultas",
      "Faturação simples",
      "Suporte por email",
    ],
    priceMonthly: 29, // EUR
    priceId: process.env.STRIPE_PRICE_BASICO_MONTHLY || "price_basico_monthly",
  },
  PRO: {
    name: "Plano Pro",
    description: "Para clínicas em crescimento com até 500 utentes",
    features: [
      "Até 500 utentes ativos",
      "Até 5 dentistas",
      "Agenda avançada",
      "Gestão completa de consultas",
      "Faturação e pagamentos",
      "Relatórios básicos",
      "Lembretes automáticos",
      "Suporte prioritário",
    ],
    priceMonthly: 79, // EUR
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
  },
  ENTERPRISE: {
    name: "Plano Enterprise",
    description: "Solução completa para clínicas grandes",
    features: [
      "Utentes ilimitados",
      "Dentistas ilimitados",
      "Agenda com múltiplas visualizações",
      "Gestão completa",
      "Faturação avançada",
      "Relatórios e estatísticas completas",
      "Notificações SMS e Email",
      "API de integração",
      "Suporte dedicado 24/7",
      "Treinamento personalizado",
    ],
    priceMonthly: 199, // EUR
    priceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "price_enterprise_monthly",
  },
} as const;

export type PlanType = keyof typeof STRIPE_PRODUCTS;

/**
 * Obter informações do plano pelo ID do preço Stripe
 */
export function getPlanByPriceId(priceId: string): { plan: PlanType; product: typeof STRIPE_PRODUCTS[PlanType] } | null {
  for (const [planKey, product] of Object.entries(STRIPE_PRODUCTS)) {
    if (product.priceId === priceId) {
      return {
        plan: planKey as PlanType,
        product,
      };
    }
  }
  return null;
}

/**
 * Limites por plano
 */
export const PLAN_LIMITS = {
  BASICO: {
    maxUtentes: 100,
    maxDentistas: 1,
    maxConsultasMes: 200,
  },
  PRO: {
    maxUtentes: 500,
    maxDentistas: 5,
    maxConsultasMes: 1000,
  },
  ENTERPRISE: {
    maxUtentes: -1, // ilimitado
    maxDentistas: -1, // ilimitado
    maxConsultasMes: -1, // ilimitado
  },
} as const;

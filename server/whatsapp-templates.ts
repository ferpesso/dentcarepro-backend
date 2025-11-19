/**
 * Templates WhatsApp pré-definidos para clínicas dentárias em Portugal
 * 
 * NOTA: Para usar templates com Meta WhatsApp Business API,
 * é necessário submeter e aprovar cada template no Facebook Business Manager.
 * 
 * Este ficheiro serve como referência para os templates que devem ser criados.
 */

export interface WhatsAppTemplate {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: {
    type: string;
    text?: string;
    parameters?: Array<{ type: string; text: string }>;
  }[];
  description: string;
  example?: string[];
}

/**
 * Templates para lembrete de consulta
 */
export const TEMPLATE_LEMBRETE_CONSULTA: WhatsAppTemplate = {
  name: 'lembrete_consulta',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Lembrete de consulta agendada',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Lembramos que tem uma consulta marcada para {{2}} às {{3}}. Por favor confirme a sua presença.',
    },
  ],
  example: ['João Silva', '20/11/2025', '14:30'],
};

/**
 * Template para confirmação de consulta
 */
export const TEMPLATE_CONFIRMACAO_CONSULTA: WhatsAppTemplate = {
  name: 'confirmacao_consulta',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Confirmação de consulta agendada',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! A sua consulta foi agendada com sucesso para {{2}} às {{3}}. Aguardamos por si!',
    },
  ],
  example: ['Maria Santos', '25/11/2025', '10:00'],
};

/**
 * Template para cancelamento de consulta
 */
export const TEMPLATE_CANCELAMENTO_CONSULTA: WhatsAppTemplate = {
  name: 'cancelamento_consulta',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Notificação de cancelamento de consulta',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Informamos que a sua consulta de {{2}} às {{3}} foi cancelada. Por favor contacte-nos para reagendar.',
    },
  ],
  example: ['Pedro Costa', '22/11/2025', '16:00'],
};

/**
 * Template para lembrete de pagamento
 */
export const TEMPLATE_LEMBRETE_PAGAMENTO: WhatsAppTemplate = {
  name: 'lembrete_pagamento',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Lembrete de fatura pendente',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Lembramos que tem uma fatura no valor de {{2}}€ com vencimento em {{3}}. Por favor efetue o pagamento.',
    },
  ],
  example: ['Ana Oliveira', '150.00', '30/11/2025'],
};

/**
 * Template para confirmação de pagamento
 */
export const TEMPLATE_CONFIRMACAO_PAGAMENTO: WhatsAppTemplate = {
  name: 'confirmacao_pagamento',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Confirmação de pagamento recebido',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Confirmamos o recebimento do pagamento de {{2}}€. Obrigado!',
    },
  ],
  example: ['Carlos Ferreira', '200.00'],
};

/**
 * Template para seguimento pós-consulta
 */
export const TEMPLATE_SEGUIMENTO_POS_CONSULTA: WhatsAppTemplate = {
  name: 'seguimento_pos_consulta',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Mensagem de seguimento após consulta',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Como se sente após o tratamento de {{2}}? Se tiver alguma dúvida ou desconforto, não hesite em contactar-nos.',
    },
  ],
  example: ['Sofia Rodrigues', 'implante dentário'],
};

/**
 * Template para aniversário
 */
export const TEMPLATE_ANIVERSARIO: WhatsAppTemplate = {
  name: 'feliz_aniversario',
  category: 'MARKETING',
  language: 'pt_PT',
  description: 'Mensagem de aniversário',
  components: [
    {
      type: 'BODY',
      text: 'Parabéns {{1}}! 🎉 Toda a equipa da {{2}} deseja-lhe um feliz aniversário! Temos um desconto especial de {{3}}% para si este mês.',
    },
  ],
  example: ['Ricardo Alves', 'Clínica Dental Sorriso', '10'],
};

/**
 * Template para nova promoção
 */
export const TEMPLATE_PROMOCAO: WhatsAppTemplate = {
  name: 'nova_promocao',
  category: 'MARKETING',
  language: 'pt_PT',
  description: 'Notificação de promoção',
  components: [
    {
      type: 'BODY',
      text: 'Olá! Temos uma promoção especial: {{1}} com {{2}}% de desconto até {{3}}. Marque já a sua consulta!',
    },
  ],
  example: ['Branqueamento dentário', '20', '31/12/2025'],
};

/**
 * Template para check-up anual
 */
export const TEMPLATE_CHECKUP_ANUAL: WhatsAppTemplate = {
  name: 'checkup_anual',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Lembrete de check-up anual',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Já passou um ano desde a sua última consulta. Recomendamos agendar um check-up dentário. Contacte-nos!',
    },
  ],
  example: ['Luís Martins'],
};

/**
 * Template para resultados de exames
 */
export const TEMPLATE_RESULTADOS_EXAMES: WhatsAppTemplate = {
  name: 'resultados_exames',
  category: 'UTILITY',
  language: 'pt_PT',
  description: 'Notificação de resultados disponíveis',
  components: [
    {
      type: 'BODY',
      text: 'Olá {{1}}! Os resultados do seu exame de {{2}} já estão disponíveis. Por favor contacte-nos para agendar uma consulta de avaliação.',
    },
  ],
  example: ['Teresa Silva', 'radiografia panorâmica'],
};

/**
 * Lista de todos os templates disponíveis
 */
export const ALL_TEMPLATES = [
  TEMPLATE_LEMBRETE_CONSULTA,
  TEMPLATE_CONFIRMACAO_CONSULTA,
  TEMPLATE_CANCELAMENTO_CONSULTA,
  TEMPLATE_LEMBRETE_PAGAMENTO,
  TEMPLATE_CONFIRMACAO_PAGAMENTO,
  TEMPLATE_SEGUIMENTO_POS_CONSULTA,
  TEMPLATE_ANIVERSARIO,
  TEMPLATE_PROMOCAO,
  TEMPLATE_CHECKUP_ANUAL,
  TEMPLATE_RESULTADOS_EXAMES,
];

/**
 * Função auxiliar para formatar template com parâmetros
 */
export function formatTemplate(template: WhatsAppTemplate, params: string[]): string {
  let text = template.components[0].text || '';
  
  params.forEach((param, index) => {
    text = text.replace(`{{${index + 1}}}`, param);
  });
  
  return text;
}

/**
 * Obter template por nome
 */
export function getTemplateByName(name: string): WhatsAppTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.name === name);
}

/**
 * Validar parâmetros de template
 */
export function validateTemplateParams(template: WhatsAppTemplate, params: string[]): boolean {
  const text = template.components[0].text || '';
  const paramCount = (text.match(/\{\{\d+\}\}/g) || []).length;
  
  return params.length === paramCount;
}

/**
 * Gerar preview de template
 */
export function previewTemplate(templateName: string, params: string[]): string | null {
  const template = getTemplateByName(templateName);
  
  if (!template) {
    return null;
  }
  
  if (!validateTemplateParams(template, params)) {
    return null;
  }
  
  return formatTemplate(template, params);
}

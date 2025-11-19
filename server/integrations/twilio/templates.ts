/**
 * Templates de mensagens SMS
 */

export interface TemplateLembreteConsulta {
  nomeUtente: string;
  nomeDentista: string;
  dataConsulta: string;
  horaConsulta: string;
  nomeClinica: string;
}

export interface TemplateFaturaVencida {
  nomeUtente: string;
  numeroFatura: string;
  valor: string;
  dataVencimento: string;
  linkPagamento?: string;
}

export interface TemplateConfirmacaoAgendamento {
  nomeUtente: string;
  dataConsulta: string;
  horaConsulta: string;
  nomeDentista: string;
  nomeClinica: string;
}

/**
 * Gerar mensagem de lembrete de consulta
 */
export function gerarMensagemLembreteConsulta(dados: TemplateLembreteConsulta): string {
  return `Olá ${dados.nomeUtente}! 

Lembrete da sua consulta:
📅 ${dados.dataConsulta} às ${dados.horaConsulta}
👨‍⚕️ Dr(a). ${dados.nomeDentista}
🏥 ${dados.nomeClinica}

Por favor, confirme a sua presença ou reagende se necessário.`;
}

/**
 * Gerar mensagem de fatura vencida
 */
export function gerarMensagemFaturaVencida(dados: TemplateFaturaVencida): string {
  let mensagem = `Olá ${dados.nomeUtente}!

A fatura #${dados.numeroFatura} no valor de ${dados.valor} venceu em ${dados.dataVencimento}.`;

  if (dados.linkPagamento) {
    mensagem += `\n\nPague agora: ${dados.linkPagamento}`;
  }

  mensagem += `\n\nEm caso de dúvidas, entre em contacto connosco.`;

  return mensagem;
}

/**
 * Gerar mensagem de confirmação de agendamento
 */
export function gerarMensagemConfirmacaoAgendamento(dados: TemplateConfirmacaoAgendamento): string {
  return `Olá ${dados.nomeUtente}!

A sua consulta foi agendada com sucesso! ✅

📅 ${dados.dataConsulta} às ${dados.horaConsulta}
👨‍⚕️ Dr(a). ${dados.nomeDentista}
🏥 ${dados.nomeClinica}

Até breve!`;
}

/**
 * Gerar mensagem de cancelamento de consulta
 */
export function gerarMensagemCancelamentoConsulta(dados: {
  nomeUtente: string;
  dataConsulta: string;
  horaConsulta: string;
}): string {
  return `Olá ${dados.nomeUtente}!

A sua consulta de ${dados.dataConsulta} às ${dados.horaConsulta} foi cancelada.

Para reagendar, entre em contacto connosco.`;
}

/**
 * Gerar mensagem personalizada
 */
export function gerarMensagemPersonalizada(mensagem: string): string {
  return mensagem;
}

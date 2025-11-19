import { getDb } from "./db";
import { consultas, utentes, dentistas, clinicas, mensagensUtente, faturas } from "../drizzle/schema";
import { eq, and, gte, lte, lt } from "drizzle-orm";

/**
 * Servico de Lembretes Automaticos - MULTI-TENANT
 * 
 * IMPORTANTE: Sistema multi-tenant - cada clinica tem seus proprios dados
 * Todas as mensagens sao personalizadas com:
 * - Nome da clinica
 * - Contactos da clinica (email, telemovel)
 * - Morada da clinica
 * - Logo da clinica (futuro)
 * 
 * Funcionalidades:
 * - Lembretes de consultas (24h antes)
 * - Lembretes de confirmacao (48h antes)
 * - Lembretes de pagamento (faturas vencidas)
 * - Integracao com SMS, Email e WhatsApp
 */

export interface ReminderConfig {
  tipo: "email" | "sms" | "whatsapp" | "todos";
  antecedenciaHoras: number;
  clinicaId?: number; // Opcional - se nao especificado, processa todas as clinicas
}

export interface ReminderResult {
  total: number;
  enviados: number;
  falhados: number;
  detalhes: Array<{
    tipo: string;
    destinatario: string;
    clinica: string;
    sucesso: boolean;
    erro?: string;
  }>;
}

/**
 * LEMBRETES DE CONSULTAS
 */
export class ConsultaReminderService {
  /**
   * Processar lembretes de consultas
   * Envia 24h antes da consulta
   * 
   * MULTI-TENANT: Processa todas as clinicas ou uma especifica
   */
  static async processarLembretesConsultas(config: ReminderConfig): Promise<ReminderResult> {
    const db = await getDb();
    if (!db) {
      return { total: 0, enviados: 0, falhados: 0, detalhes: [] };
    }

    // Obter consultas nas proximas X horas
    const agora = new Date();
    const dataInicio = new Date(agora.getTime() + config.antecedenciaHoras * 60 * 60 * 1000);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000); // Janela de 1 hora

    const consultasParaLembrar = await db
      .select({
        consultaId: consultas.id,
        consultaHora: consultas.horaInicio,
        consultaTitulo: consultas.titulo,
        // Dados do utente
        utenteId: utentes.id,
        utenteNome: utentes.nome,
        utenteEmail: utentes.email,
        utenteTelemovel: utentes.telemovel,
        // Dados do dentista
        dentistaNome: dentistas.nome,
        // Dados da clinica (DINAMICOS!)
        clinicaId: clinicas.id,
        clinicaNome: clinicas.nome,
        clinicaEmail: clinicas.email,
        clinicaTelemovel: clinicas.telemovel,
        clinicaMorada: clinicas.morada,
        clinicaCidade: clinicas.cidade,
        clinicaCodigoPostal: clinicas.codigoPostal,
        clinicaPais: clinicas.pais,
        clinicaLogoUrl: clinicas.logoUrl,
      })
      .from(consultas)
      .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
      .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
      .innerJoin(clinicas, eq(consultas.clinicaId, clinicas.id))
      .where(
        and(
          gte(consultas.horaInicio, dataInicio),
          lte(consultas.horaInicio, dataFim),
          eq(consultas.estado, "agendada"),
          eq(clinicas.ativo, true), // Apenas clinicas ativas
          config.clinicaId ? eq(consultas.clinicaId, config.clinicaId) : undefined
        )
      );

    const resultado: ReminderResult = {
      total: consultasParaLembrar.length,
      enviados: 0,
      falhados: 0,
      detalhes: [],
    };

    for (const consulta of consultasParaLembrar) {
      // Formatar mensagens com dados DINAMICOS da clinica
      const mensagens = this.formatarMensagemConsulta(consulta);

      // Enviar por email
      if ((config.tipo === "email" || config.tipo === "todos") && consulta.utenteEmail) {
        const sucesso = await this.enviarEmail(
          consulta.utenteEmail,
          `Lembrete de Consulta - ${consulta.clinicaNome}`,
          mensagens.email
        );

        if (sucesso) {
          await this.registarMensagem(
            consulta.clinicaId,
            consulta.utenteId,
            "email",
            `Lembrete de Consulta - ${consulta.clinicaNome}`,
            mensagens.email
          );
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          tipo: "email",
          destinatario: consulta.utenteEmail,
          clinica: consulta.clinicaNome,
          sucesso,
        });
      }

      // Enviar por SMS
      if ((config.tipo === "sms" || config.tipo === "todos") && consulta.utenteTelemovel) {
        const sucesso = await this.enviarSMS(consulta.utenteTelemovel, mensagens.sms);

        if (sucesso) {
          await this.registarMensagem(
            consulta.clinicaId,
            consulta.utenteId,
            "sms",
            `Lembrete de Consulta - ${consulta.clinicaNome}`,
            mensagens.sms
          );
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          tipo: "sms",
          destinatario: consulta.utenteTelemovel,
          clinica: consulta.clinicaNome,
          sucesso,
        });
      }

      // Enviar por WhatsApp
      if ((config.tipo === "whatsapp" || config.tipo === "todos") && consulta.utenteTelemovel) {
        const sucesso = await this.enviarWhatsApp(consulta.utenteTelemovel, mensagens.whatsapp);

        if (sucesso) {
          await this.registarMensagem(
            consulta.clinicaId,
            consulta.utenteId,
            "whatsapp",
            `Lembrete de Consulta - ${consulta.clinicaNome}`,
            mensagens.whatsapp
          );
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          tipo: "whatsapp",
          destinatario: consulta.utenteTelemovel,
          clinica: consulta.clinicaNome,
          sucesso,
        });
      }
    }

    return resultado;
  }

  /**
   * Formatar mensagem de lembrete de consulta
   * USA DADOS DINAMICOS DA CLINICA
   */
  private static formatarMensagemConsulta(dados: any) {
    const dataFormatada = new Date(dados.consultaHora).toLocaleDateString("pt-PT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const horaFormatada = new Date(dados.consultaHora).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Montar morada completa da clinica
    const moradaCompleta = [
      dados.clinicaMorada,
      dados.clinicaCodigoPostal ? `${dados.clinicaCodigoPostal} ${dados.clinicaCidade}` : dados.clinicaCidade,
    ].filter(Boolean).join(", ");

    // EMAIL - Completo e profissional
    const email = `
Ola ${dados.utenteNome},

Este e um lembrete da sua consulta marcada na ${dados.clinicaNome}.

📅 Data: ${dataFormatada}
🕐 Hora: ${horaFormatada}
👨‍⚕️ Dentista: ${dados.dentistaNome}
🏥 Clinica: ${dados.clinicaNome}
${moradaCompleta ? `📍 Morada: ${moradaCompleta}` : ""}

Por favor, chegue com 10 minutos de antecedencia.

Se precisar de remarcar ou cancelar, contacte-nos:
${dados.clinicaTelemovel ? `📞 ${dados.clinicaTelemovel}` : ""}
${dados.clinicaEmail ? `📧 ${dados.clinicaEmail}` : ""}

Obrigado,
Equipa ${dados.clinicaNome}
    `.trim();

    // SMS - Curto e direto (custo por caractere)
    const sms = `Lembrete ${dados.clinicaNome}: Consulta ${dataFormatada} as ${horaFormatada} com ${dados.dentistaNome}. ${dados.clinicaTelemovel || ""}`;

    // WHATSAPP - Formatado e com emojis
    const whatsapp = `*Lembrete de Consulta* 📅

Ola ${dados.utenteNome}!

Tem consulta marcada na *${dados.clinicaNome}*:

📅 *${dataFormatada}*
🕐 *${horaFormatada}*
👨‍⚕️ ${dados.dentistaNome}
${moradaCompleta ? `📍 ${moradaCompleta}` : ""}

Por favor, chegue com 10 minutos de antecedencia.

Para remarcar: ${dados.clinicaTelemovel || dados.clinicaEmail || ""}`;

    return { email, sms, whatsapp };
  }

  /**
   * Enviar email (integrado com SendGrid/AWS SES)
   */
  private static async enviarEmail(
    destinatario: string,
    assunto: string,
    corpo: string
  ): Promise<boolean> {
    try {
      // TODO: Integrar com SendGrid, AWS SES, ou outro provedor
      // Por agora, apenas simular envio
      console.log(`[EMAIL] Para: ${destinatario}, Assunto: ${assunto}`);
      
      return true;
    } catch (error) {
      console.error(`[EMAIL] Erro ao enviar para ${destinatario}:`, error);
      return false;
    }
  }

  /**
   * Enviar SMS (integrado com Twilio/Vonage)
   */
  private static async enviarSMS(destinatario: string, mensagem: string): Promise<boolean> {
    try {
      // TODO: Integrar com Twilio, Vonage, ou outro provedor
      console.log(`[SMS] Para: ${destinatario}, Mensagem: ${mensagem.substring(0, 50)}...`);
      
      return true;
    } catch (error) {
      console.error(`[SMS] Erro ao enviar para ${destinatario}:`, error);
      return false;
    }
  }

  /**
   * Enviar WhatsApp (integrado com WhatsApp Business API)
   */
  private static async enviarWhatsApp(destinatario: string, mensagem: string): Promise<boolean> {
    try {
      // TODO: Integrar com WhatsApp Business API
      console.log(`[WHATSAPP] Para: ${destinatario}, Mensagem: ${mensagem.substring(0, 50)}...`);
      
      return true;
    } catch (error) {
      console.error(`[WHATSAPP] Erro ao enviar para ${destinatario}:`, error);
      return false;
    }
  }

  /**
   * Registar mensagem no banco de dados
   */
  private static async registarMensagem(
    clinicaId: number,
    utenteId: number,
    canal: string,
    assunto: string,
    corpo: string
  ) {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(mensagensUtente).values({
        clinicaId,
        utenteId,
        canal,
        assunto,
        corpo,
        estado: "enviada",
        enviadaEm: new Date(),
      });
    } catch (error) {
      console.error("Erro ao registar mensagem:", error);
    }
  }
}

/**
 * LEMBRETES DE PAGAMENTO
 */
export class PaymentReminderService {
  /**
   * Processar lembretes de faturas vencidas
   * USA DADOS DINAMICOS DA CLINICA
   */
  static async processarLembretesPagamento(clinicaId?: number): Promise<ReminderResult> {
    const db = await getDb();
    if (!db) {
      return { total: 0, enviados: 0, falhados: 0, detalhes: [] };
    }

    // Obter faturas vencidas
    const hoje = new Date();
    
    const faturasVencidas = await db
      .select({
        faturaId: faturas.id,
        numeroFatura: faturas.numeroFatura,
        valorTotal: faturas.valorTotal,
        valorPago: faturas.valorPago,
        dataVencimento: faturas.dataVencimento,
        // Dados do utente
        utenteId: utentes.id,
        utenteNome: utentes.nome,
        utenteEmail: utentes.email,
        utenteTelemovel: utentes.telemovel,
        // Dados da clinica (DINAMICOS!)
        clinicaId: clinicas.id,
        clinicaNome: clinicas.nome,
        clinicaEmail: clinicas.email,
        clinicaTelemovel: clinicas.telemovel,
        clinicaMorada: clinicas.morada,
      })
      .from(faturas)
      .innerJoin(utentes, eq(faturas.utenteId, utentes.id))
      .innerJoin(clinicas, eq(faturas.clinicaId, clinicas.id))
      .where(
        and(
          lt(faturas.dataVencimento, hoje),
          eq(faturas.estado, "enviada"),
          eq(clinicas.ativo, true),
          clinicaId ? eq(faturas.clinicaId, clinicaId) : undefined
        )
      );

    const resultado: ReminderResult = {
      total: faturasVencidas.length,
      enviados: 0,
      falhados: 0,
      detalhes: [],
    };

    for (const fatura of faturasVencidas) {
      const valorPendente = parseFloat(fatura.valorTotal) - parseFloat(fatura.valorPago);
      const diasVencido = Math.floor(
        (hoje.getTime() - new Date(fatura.dataVencimento!).getTime()) / (1000 * 60 * 60 * 24)
      );

      const mensagens = this.formatarMensagemPagamento({
        ...fatura,
        valorPendente,
        diasVencido,
      });

      // Enviar por email
      if (fatura.utenteEmail) {
        const sucesso = await ConsultaReminderService["enviarEmail"](
          fatura.utenteEmail,
          `Lembrete de Pagamento - ${fatura.clinicaNome}`,
          mensagens.email
        );

        if (sucesso) {
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          tipo: "email",
          destinatario: fatura.utenteEmail,
          clinica: fatura.clinicaNome,
          sucesso,
        });
      }
    }

    return resultado;
  }

  /**
   * Formatar mensagem de lembrete de pagamento
   * USA DADOS DINAMICOS DA CLINICA
   */
  private static formatarMensagemPagamento(dados: any) {
    const email = `
Ola ${dados.utenteNome},

Este e um lembrete de pagamento da ${dados.clinicaNome}.

Fatura: ${dados.numeroFatura}
💰 Valor Pendente: €${dados.valorPendente.toFixed(2)}
📅 Vencimento: ${new Date(dados.dataVencimento).toLocaleDateString("pt-PT")}
⚠️ Vencida ha ${dados.diasVencido} dia(s)

Por favor, regularize o pagamento o mais breve possivel.

Metodos de pagamento disponiveis:
• Multibanco
• MB WAY
• Transferencia bancaria

Para mais informacoes, contacte-nos:
${dados.clinicaTelemovel ? `📞 ${dados.clinicaTelemovel}` : ""}
${dados.clinicaEmail ? `📧 ${dados.clinicaEmail}` : ""}

Obrigado,
${dados.clinicaNome}
    `.trim();

    return { email };
  }
}

export default {
  ConsultaReminderService,
  PaymentReminderService,
};

/**
 * Serviço de Integração com WhatsApp Business API
 * 
 * Suporta duas implementações:
 * 1. Meta WhatsApp Business API (Cloud API)
 * 2. Twilio WhatsApp API
 * 
 * Funcionalidades:
 * - Envio de mensagens de texto
 * - Envio de mensagens com templates
 * - Webhook para receber mensagens
 * - Histórico de conversas
 * - Gestão de templates
 */

import axios from 'axios';
import { getDb } from './db';
import { mensagensUtente } from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Configuração do WhatsApp
 */
interface WhatsAppConfig {
  provider: 'meta' | 'twilio';
  // Meta WhatsApp Business API
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaBusinessAccountId?: string;
  // Twilio
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioWhatsAppNumber?: string;
}

/**
 * Resultado de envio
 */
interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Mensagem recebida (webhook)
 */
export interface WhatsAppWebhookMessage {
  from: string;
  to: string;
  text: string;
  timestamp: number;
  messageId: string;
  name?: string;
}

/**
 * Serviço principal do WhatsApp
 */
export class WhatsAppService {
  private config: WhatsAppConfig;

  constructor(config?: WhatsAppConfig) {
    // Carregar configuração das variáveis de ambiente
    this.config = config || {
      provider: (process.env.WHATSAPP_PROVIDER as 'meta' | 'twilio') || 'meta',
      metaAccessToken: process.env.META_WHATSAPP_ACCESS_TOKEN,
      metaPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
      metaBusinessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioWhatsAppNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    };
  }

  /**
   * Verificar se o WhatsApp está configurado
   */
  isConfigured(): boolean {
    if (this.config.provider === 'meta') {
      return !!(this.config.metaAccessToken && this.config.metaPhoneNumberId);
    } else {
      return !!(
        this.config.twilioAccountSid &&
        this.config.twilioAuthToken &&
        this.config.twilioWhatsAppNumber
      );
    }
  }

  /**
   * Enviar mensagem de texto simples
   */
  async sendTextMessage(
    to: string,
    message: string,
    clinicaId: number,
    utenteId?: number
  ): Promise<SendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp não configurado',
        timestamp: new Date(),
      };
    }

    try {
      // Formatar número (remover espaços, adicionar código do país se necessário)
      const formattedNumber = this.formatPhoneNumber(to);

      let messageId: string | undefined;

      if (this.config.provider === 'meta') {
        messageId = await this.sendMetaMessage(formattedNumber, message);
      } else {
        messageId = await this.sendTwilioMessage(formattedNumber, message);
      }

      // Registar mensagem no banco de dados
      if (utenteId) {
        await this.saveMessage(clinicaId, utenteId, 'whatsapp', message, 'enviada');
      }

      return {
        success: true,
        messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);

      // Registar falha
      if (utenteId) {
        await this.saveMessage(clinicaId, utenteId, 'whatsapp', message, 'falhada');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Enviar mensagem usando template aprovado (Meta apenas)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    parameters: string[],
    clinicaId: number,
    utenteId?: number
  ): Promise<SendResult> {
    if (this.config.provider !== 'meta') {
      return {
        success: false,
        error: 'Templates só suportados com Meta WhatsApp Business API',
        timestamp: new Date(),
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WhatsApp não configurado',
        timestamp: new Date(),
      };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);

      const url = `https://graph.facebook.com/v18.0/${this.config.metaPhoneNumberId}/messages`;

      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: [
              {
                type: 'body',
                parameters: parameters.map((param) => ({
                  type: 'text',
                  text: param,
                })),
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.metaAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data.messages[0].id;

      // Registar mensagem
      if (utenteId) {
        await this.saveMessage(
          clinicaId,
          utenteId,
          'whatsapp',
          `Template: ${templateName}`,
          'enviada'
        );
      }

      return {
        success: true,
        messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Erro ao enviar template WhatsApp:', error);

      if (utenteId) {
        await this.saveMessage(
          clinicaId,
          utenteId,
          'whatsapp',
          `Template: ${templateName}`,
          'falhada'
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Enviar mensagem via Meta WhatsApp Business API
   */
  private async sendMetaMessage(to: string, message: string): Promise<string> {
    const url = `https://graph.facebook.com/v18.0/${this.config.metaPhoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.metaAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.messages[0].id;
  }

  /**
   * Enviar mensagem via Twilio
   */
  private async sendTwilioMessage(to: string, message: string): Promise<string> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Messages.json`;

    const response = await axios.post(
      url,
      new URLSearchParams({
        From: `whatsapp:${this.config.twilioWhatsAppNumber}`,
        To: `whatsapp:${to}`,
        Body: message,
      }),
      {
        auth: {
          username: this.config.twilioAccountSid!,
          password: this.config.twilioAuthToken!,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.sid;
  }

  /**
   * Processar webhook de mensagem recebida (Meta)
   */
  async processMetaWebhook(webhookData: any): Promise<WhatsAppWebhookMessage | null> {
    try {
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        return null;
      }

      const message = messages[0];

      return {
        from: message.from,
        to: value.metadata.phone_number_id,
        text: message.text?.body || '',
        timestamp: message.timestamp,
        messageId: message.id,
        name: value.contacts?.[0]?.profile?.name,
      };
    } catch (error) {
      console.error('Erro ao processar webhook Meta:', error);
      return null;
    }
  }

  /**
   * Processar webhook de mensagem recebida (Twilio)
   */
  async processTwilioWebhook(webhookData: any): Promise<WhatsAppWebhookMessage | null> {
    try {
      return {
        from: webhookData.From?.replace('whatsapp:', ''),
        to: webhookData.To?.replace('whatsapp:', ''),
        text: webhookData.Body || '',
        timestamp: Date.now(),
        messageId: webhookData.MessageSid,
        name: webhookData.ProfileName,
      };
    } catch (error) {
      console.error('Erro ao processar webhook Twilio:', error);
      return null;
    }
  }

  /**
   * Formatar número de telefone
   */
  private formatPhoneNumber(phone: string): string {
    // Remover espaços, hífens, parênteses
    let formatted = phone.replace(/[\s\-\(\)]/g, '');

    // Se não começar com +, adicionar código de Portugal (+351)
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('00')) {
        formatted = '+' + formatted.substring(2);
      } else if (formatted.startsWith('351')) {
        formatted = '+' + formatted;
      } else {
        formatted = '+351' + formatted;
      }
    }

    return formatted;
  }

  /**
   * Salvar mensagem no banco de dados
   */
  private async saveMessage(
    clinicaId: number,
    utenteId: number,
    canal: string,
    conteudo: string,
    estado: string
  ): Promise<void> {
    try {
      const db = await getDb();
      await db.insert(mensagensUtente).values({
        clinicaId,
        utenteId,
        canal,
        tipo: 'lembrete',
        assunto: 'Mensagem WhatsApp',
        conteudo,
        estado,
        dataEnvio: new Date(),
      });
    } catch (error) {
      console.error('Erro ao salvar mensagem no banco:', error);
    }
  }

  /**
   * Obter histórico de mensagens de um utente
   */
  async getMessageHistory(
    clinicaId: number,
    utenteId: number,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const db = await getDb();
      return await db
        .select()
        .from(mensagensUtente)
        .where(
          and(
            eq(mensagensUtente.clinicaId, clinicaId),
            eq(mensagensUtente.utenteId, utenteId),
            eq(mensagensUtente.canal, 'whatsapp')
          )
        )
        .orderBy(desc(mensagensUtente.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Erro ao obter histórico de mensagens:', error);
      return [];
    }
  }

  /**
   * Listar templates disponíveis (Meta apenas)
   */
  async listTemplates(): Promise<any[]> {
    if (this.config.provider !== 'meta' || !this.config.metaBusinessAccountId) {
      return [];
    }

    try {
      const url = `https://graph.facebook.com/v18.0/${this.config.metaBusinessAccountId}/message_templates`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.config.metaAccessToken}`,
        },
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      return [];
    }
  }
}

// Exportar instância singleton
export const whatsappService = new WhatsAppService();

// Exportar classe para testes
export default WhatsAppService;

/**
 * Router tRPC para WhatsApp Business API
 */

import { router, protectedProcedure, publicProcedure } from '../trpc';
import { z } from 'zod';
import { whatsappService } from '../whatsapp-service';
import { getDb } from '../db';
import { utentes, mensagensUtente } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export const whatsappRouter = router({
  /**
   * Verificar se WhatsApp está configurado
   */
  checkConfig: protectedProcedure.query(async () => {
    return {
      configured: whatsappService.isConfigured(),
      provider: process.env.WHATSAPP_PROVIDER || 'meta',
    };
  }),

  /**
   * Testar envio de mensagem (sem utente específico)
   */
  testMessage: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId;
      
      if (!clinicaId) {
        throw new Error("Clínica não encontrada");
      }

      // Enviar mensagem de teste
      const resultado = await whatsappService.sendTextMessage(
        input.phoneNumber,
        input.message,
        clinicaId,
        null // sem utente específico para teste
      );

      return resultado;
    }),

  /**
   * Enviar mensagem de texto para um utente
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        message: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId!;

      // Obter telefone do utente
      const db = await getDb();
      const utente = await db
        .select()
        .from(utentes)
        .where(eq(utentes.id, input.utenteId))
        .limit(1);

      if (!utente || utente.length === 0) {
        throw new Error('Utente não encontrado');
      }

      if (!utente[0].telemovel) {
        throw new Error('Utente não tem número de telemóvel cadastrado');
      }

      // Enviar mensagem
      const result = await whatsappService.sendTextMessage(
        utente[0].telemovel,
        input.message,
        clinicaId,
        input.utenteId
      );

      return result;
    }),

  /**
   * Enviar mensagem usando template
   */
  sendTemplate: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        templateName: z.string(),
        languageCode: z.string().default('pt_BR'),
        parameters: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId!;

      // Obter telefone do utente
      const db = await getDb();
      const utente = await db
        .select()
        .from(utentes)
        .where(eq(utentes.id, input.utenteId))
        .limit(1);

      if (!utente || utente.length === 0) {
        throw new Error('Utente não encontrado');
      }

      if (!utente[0].telemovel) {
        throw new Error('Utente não tem número de telemóvel cadastrado');
      }

      // Enviar template
      const result = await whatsappService.sendTemplateMessage(
        utente[0].telemovel,
        input.templateName,
        input.languageCode,
        input.parameters,
        clinicaId,
        input.utenteId
      );

      return result;
    }),

  /**
   * Obter histórico de mensagens de um utente
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId!;

      const messages = await whatsappService.getMessageHistory(
        clinicaId,
        input.utenteId,
        input.limit
      );

      return messages;
    }),

  /**
   * Listar templates disponíveis
   */
  listTemplates: protectedProcedure.query(async () => {
    const templates = await whatsappService.listTemplates();
    return templates;
  }),

  /**
   * Webhook para receber mensagens (Meta)
   */
  webhookMeta: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const message = await whatsappService.processMetaWebhook(input);

      if (message) {
        console.log('Mensagem recebida via WhatsApp:', message);

        // Salvar mensagem recebida no banco de dados
        try {
          const db = await getDb();
          
          // Procurar utente pelo número de telefone
          const [utente] = await db
            .select()
            .from(utentes)
            .where(eq(utentes.telemovel, message.from))
            .limit(1);

          if (utente) {
            // Salvar mensagem recebida
            await db.insert(mensagensUtente).values({
              clinicaId: utente.clinicaId,
              utenteId: utente.id,
              canal: 'whatsapp',
              tipo: 'recebida',
              assunto: 'Mensagem WhatsApp Recebida',
              conteudo: message.text,
              estado: 'recebida',
              dataEnvio: new Date(message.timestamp),
            });

            // Resposta automática (fora de horário)
            const agora = new Date();
            const hora = agora.getHours();
            const diaSemana = agora.getDay();
            
            // Se for fora do horário (antes das 8h ou depois das 20h, ou fim de semana)
            if (hora < 8 || hora >= 20 || diaSemana === 0 || diaSemana === 6) {
              await whatsappService.sendTextMessage(
                message.from,
                'Obrigado pela sua mensagem! Estamos fora do horário de atendimento. Responderemos assim que possível durante o horário comercial (Segunda a Sexta, 8h-20h).',
                utente.clinicaId,
                utente.id
              );
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem recebida:', error);
        }
      }

      return { success: true };
    }),

  /**
   * Webhook para receber mensagens (Twilio)
   */
  webhookTwilio: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const message = await whatsappService.processTwilioWebhook(input);

      if (message) {
        console.log('Mensagem recebida via WhatsApp (Twilio):', message);

        // Salvar mensagem recebida no banco de dados
        try {
          const db = await getDb();
          
          // Procurar utente pelo número de telefone
          const [utente] = await db
            .select()
            .from(utentes)
            .where(eq(utentes.telemovel, message.from))
            .limit(1);

          if (utente) {
            // Salvar mensagem recebida
            await db.insert(mensagensUtente).values({
              clinicaId: utente.clinicaId,
              utenteId: utente.id,
              canal: 'whatsapp',
              tipo: 'recebida',
              assunto: 'Mensagem WhatsApp Recebida',
              conteudo: message.text,
              estado: 'recebida',
              dataEnvio: new Date(message.timestamp),
            });

            // Resposta automática (fora de horário)
            const agora = new Date();
            const hora = agora.getHours();
            const diaSemana = agora.getDay();
            
            // Se for fora do horário (antes das 8h ou depois das 20h, ou fim de semana)
            if (hora < 8 || hora >= 20 || diaSemana === 0 || diaSemana === 6) {
              await whatsappService.sendTextMessage(
                message.from,
                'Obrigado pela sua mensagem! Estamos fora do horário de atendimento. Responderemos assim que possível durante o horário comercial (Segunda a Sexta, 8h-20h).',
                utente.clinicaId,
                utente.id
              );
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem recebida:', error);
        }
      }

      return { success: true };
    }),


});

export default whatsappRouter;

/**
 * Router tRPC para Google Calendar API
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { googleCalendarService } from '../integrations/google-calendar';

export const googleCalendarRouter = router({
  /**
   * Verificar se Google Calendar está configurado
   */
  checkConfig: protectedProcedure.query(async () => {
    return {
      configured: googleCalendarService.isConfigured(),
    };
  }),

  /**
   * Obter URL de autenticação OAuth
   */
  getAuthUrl: protectedProcedure.query(async () => {
    if (!googleCalendarService.isConfigured()) {
      throw new Error('Google Calendar não configurado');
    }

    const authUrl = googleCalendarService.getAuthUrl();
    return { authUrl };
  }),

  /**
   * Trocar código de autorização por tokens
   */
  exchangeCode: protectedProcedure
    .input(
      z.object({
        code: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const credentials = await googleCalendarService.getTokensFromCode(input.code);
      
      // TODO: Armazenar credenciais na base de dados associadas ao dentista/clínica
      
      return { success: true, credentials };
    }),

  /**
   * Listar calendários disponíveis
   */
  listCalendars: protectedProcedure.query(async () => {
    // TODO: Carregar credenciais armazenadas
    // googleCalendarService.setCredentials(storedCredentials);
    
    const calendars = await googleCalendarService.listCalendars();
    return calendars;
  }),

  /**
   * Sincronizar consulta para Google Calendar
   */
  syncConsultaToGoogle: protectedProcedure
    .input(
      z.object({
        consultaId: z.number(),
        calendarId: z.string().default('primary'),
        googleEventId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Carregar credenciais armazenadas
      
      const eventId = await googleCalendarService.syncConsultaToGoogle(
        input.consultaId,
        input.calendarId,
        input.googleEventId
      );

      // TODO: Armazenar googleEventId na consulta
      
      return { success: true, eventId };
    }),

  /**
   * Sincronização bidirecional completa
   */
  fullSync: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default('primary'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId!;
      const dentistaId = ctx.user.dentistaId!;

      if (!dentistaId) {
        throw new Error('Apenas dentistas podem sincronizar calendários');
      }

      // TODO: Carregar credenciais armazenadas
      
      const result = await googleCalendarService.fullSync(
        clinicaId,
        dentistaId,
        input.calendarId,
        input.startDate,
        input.endDate
      );

      return result;
    }),

  /**
   * Listar eventos do Google Calendar
   */
  listEvents: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default('primary'),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      })
    )
    .query(async ({ input }) => {
      // TODO: Carregar credenciais armazenadas
      
      const events = await googleCalendarService.listEvents(
        input.calendarId,
        input.startDate,
        input.endDate
      );

      return events;
    }),

  /**
   * Criar evento no Google Calendar
   */
  createEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default('primary'),
        summary: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.coerce.date(),
        endDateTime: z.coerce.date(),
        attendees: z.array(
          z.object({
            email: z.string().email(),
            displayName: z.string().optional(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Carregar credenciais armazenadas
      
      const event = {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: {
          dateTime: input.startDateTime.toISOString(),
          timeZone: 'Europe/Lisbon',
        },
        end: {
          dateTime: input.endDateTime.toISOString(),
          timeZone: 'Europe/Lisbon',
        },
        attendees: input.attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email' as const, minutes: 24 * 60 },
            { method: 'popup' as const, minutes: 60 },
          ],
        },
      };

      const eventId = await googleCalendarService.createEvent(
        input.calendarId,
        event
      );

      return { success: true, eventId };
    }),

  /**
   * Excluir evento do Google Calendar
   */
  deleteEvent: protectedProcedure
    .input(
      z.object({
        calendarId: z.string().default('primary'),
        eventId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Carregar credenciais armazenadas
      
      await googleCalendarService.deleteEvent(input.calendarId, input.eventId);

      return { success: true };
    }),
});

export default googleCalendarRouter;

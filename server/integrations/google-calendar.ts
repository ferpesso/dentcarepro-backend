/**
 * Serviço de Integração com Google Calendar API
 * 
 * Funcionalidades:
 * - Autenticação OAuth 2.0
 * - Sincronização de consultas
 * - Criação de eventos
 * - Atualização de eventos
 * - Exclusão de eventos
 * - Sincronização bidirecional
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from '../db';
import { consultas, dentistas, utentes } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Configuração do Google Calendar
 */
interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Credenciais OAuth armazenadas
 */
interface StoredCredentials {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Evento do Google Calendar
 */
interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

/**
 * Serviço principal do Google Calendar
 */
export class GoogleCalendarService {
  private config: GoogleCalendarConfig;
  private oauth2Client: OAuth2Client;

  constructor(config?: GoogleCalendarConfig) {
    // Carregar configuração das variáveis de ambiente
    this.config = config || {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback',
    };

    // Inicializar cliente OAuth2
    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
  }

  /**
   * Verificar se o Google Calendar está configurado
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Gerar URL de autenticação OAuth
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Força a obtenção de refresh token
    });
  }

  /**
   * Trocar código de autorização por tokens
   */
  async getTokensFromCode(code: string): Promise<StoredCredentials> {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      scope: tokens.scope!,
      token_type: tokens.token_type!,
      expiry_date: tokens.expiry_date!,
    };
  }

  /**
   * Definir credenciais do cliente
   */
  setCredentials(credentials: StoredCredentials): void {
    this.oauth2Client.setCredentials(credentials);
  }

  /**
   * Atualizar access token usando refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials.access_token!;
  }

  /**
   * Criar evento no Google Calendar
   */
  async createEvent(
    calendarId: string,
    event: CalendarEvent
  ): Promise<string> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.insert({
      calendarId: calendarId || 'primary',
      requestBody: event,
      sendUpdates: 'all', // Enviar notificações para participantes
    });

    return response.data.id!;
  }

  /**
   * Atualizar evento no Google Calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: CalendarEvent
  ): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.events.update({
      calendarId: calendarId || 'primary',
      eventId: eventId,
      requestBody: event,
      sendUpdates: 'all',
    });
  }

  /**
   * Excluir evento do Google Calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.events.delete({
      calendarId: calendarId || 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
  }

  /**
   * Listar eventos do Google Calendar
   */
  async listEvents(
    calendarId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<any[]> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.list({
      calendarId: calendarId || 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  }

  /**
   * Sincronizar consulta do DentCarePro para Google Calendar
   */
  async syncConsultaToGoogle(
    consultaId: number,
    calendarId: string,
    googleEventId?: string
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Buscar dados da consulta
    const [consulta] = await db
      .select({
        consulta: consultas,
        dentista: dentistas,
        utente: utentes,
      })
      .from(consultas)
      .leftJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
      .leftJoin(utentes, eq(consultas.utenteId, utentes.id))
      .where(eq(consultas.id, consultaId))
      .limit(1);

    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    // Preparar evento
    const event: CalendarEvent = {
      summary: `Consulta - ${consulta.utente?.nome || 'Paciente'}`,
      description: consulta.consulta.observacoes || 'Consulta dentária',
      location: 'Clínica Dentária', // TODO: Obter endereço da clínica
      start: {
        dateTime: new Date(consulta.consulta.horaInicio).toISOString(),
        timeZone: 'Europe/Lisbon',
      },
      end: {
        dateTime: new Date(consulta.consulta.horaFim).toISOString(),
        timeZone: 'Europe/Lisbon',
      },
      attendees: [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 dia antes
          { method: 'popup', minutes: 60 }, // 1 hora antes
        ],
      },
    };

    // Adicionar email do utente se disponível
    if (consulta.utente?.email) {
      event.attendees!.push({
        email: consulta.utente.email,
        displayName: consulta.utente.nome,
      });
    }

    // Adicionar email do dentista se disponível
    if (consulta.dentista?.email) {
      event.attendees!.push({
        email: consulta.dentista.email,
        displayName: consulta.dentista.nome,
      });
    }

    // Criar ou atualizar evento
    if (googleEventId) {
      await this.updateEvent(calendarId, googleEventId, event);
      return googleEventId;
    } else {
      return await this.createEvent(calendarId, event);
    }
  }

  /**
   * Sincronizar evento do Google Calendar para DentCarePro
   */
  async syncGoogleEventToConsulta(
    googleEvent: any,
    clinicaId: number,
    dentistaId: number
  ): Promise<number | null> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Extrair informações do evento
    const summary = googleEvent.summary || '';
    const description = googleEvent.description || '';
    const start = new Date(googleEvent.start.dateTime || googleEvent.start.date);
    const end = new Date(googleEvent.end.dateTime || googleEvent.end.date);

    // Procurar utente pelo email (se disponível)
    let utenteId: number | null = null;
    if (googleEvent.attendees && googleEvent.attendees.length > 0) {
      const email = googleEvent.attendees[0].email;
      const [utente] = await db
        .select()
        .from(utentes)
        .where(and(
          eq(utentes.email, email),
          eq(utentes.clinicaId, clinicaId)
        ))
        .limit(1);

      if (utente) {
        utenteId = utente.id;
      }
    }

    // Se não encontrou utente, não criar consulta
    if (!utenteId) {
      console.log('Evento do Google Calendar sem utente correspondente:', summary);
      return null;
    }

    // Criar consulta
    const [novaConsulta] = await db
      .insert(consultas)
      .values({
        clinicaId,
        utenteId,
        dentistaId,
        horaInicio: start,
        horaFim: end,
        estado: 'agendada',
        observacoes: description,
        titulo: summary,
      })
      .returning();

    return novaConsulta.id;
  }

  /**
   * Sincronização bidirecional completa
   */
  async fullSync(
    clinicaId: number,
    dentistaId: number,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    consultasSyncedToGoogle: number;
    eventsSyncedToDentCare: number;
  }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // 1. Sincronizar consultas do DentCarePro para Google
    const consultasParaSync = await db
      .select()
      .from(consultas)
      .where(
        and(
          eq(consultas.clinicaId, clinicaId),
          eq(consultas.dentistaId, dentistaId)
        )
      );

    let consultasSyncedToGoogle = 0;
    for (const consulta of consultasParaSync) {
      try {
        // TODO: Verificar se já tem googleEventId armazenado
        await this.syncConsultaToGoogle(consulta.id, calendarId);
        consultasSyncedToGoogle++;
      } catch (error) {
        console.error(`Erro ao sincronizar consulta ${consulta.id}:`, error);
      }
    }

    // 2. Sincronizar eventos do Google para DentCarePro
    const googleEvents = await this.listEvents(calendarId, startDate, endDate);

    let eventsSyncedToDentCare = 0;
    for (const event of googleEvents) {
      try {
        // TODO: Verificar se evento já existe no DentCarePro
        const consultaId = await this.syncGoogleEventToConsulta(
          event,
          clinicaId,
          dentistaId
        );
        if (consultaId) {
          eventsSyncedToDentCare++;
        }
      } catch (error) {
        console.error(`Erro ao sincronizar evento ${event.id}:`, error);
      }
    }

    return {
      consultasSyncedToGoogle,
      eventsSyncedToDentCare,
    };
  }

  /**
   * Listar calendários disponíveis
   */
  async listCalendars(): Promise<any[]> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.calendarList.list();

    return response.data.items || [];
  }
}

// Exportar instância singleton
export const googleCalendarService = new GoogleCalendarService();

// Exportar classe para testes
export default GoogleCalendarService;

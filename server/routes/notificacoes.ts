import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { utentes, consultas, dentistas, faturas } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { enviarSMS, enviarSMSLote } from "../integrations/twilio/sms";
import {
  gerarMensagemLembreteConsulta,
  gerarMensagemFaturaVencida,
  gerarMensagemConfirmacaoAgendamento,
  gerarMensagemCancelamentoConsulta,
  gerarMensagemPersonalizada,
} from "../integrations/twilio/templates";

/**
 * Router de Notificações
 */
export const notificacoesRouter = router({
  /**
   * Enviar lembrete de consulta
   */
  enviarLembreteConsulta: protectedProcedure
    .input(z.object({
      consultaId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar consulta com utente e dentista
      const [consulta] = await db
        .select({
          consulta: consultas,
          utente: utentes,
          dentista: dentistas,
        })
        .from(consultas)
        .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
        .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
        .where(and(
          eq(consultas.id, input.consultaId),
          eq(consultas.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!consulta) {
        throw new Error("Consulta não encontrada");
      }

      if (!consulta.utente.telemovel) {
        throw new Error("Utente não possui telemóvel cadastrado");
      }

      // Gerar mensagem
      const mensagem = gerarMensagemLembreteConsulta({
        nomeUtente: consulta.utente.nome,
        nomeDentista: consulta.dentista.nome,
        dataConsulta: new Date(consulta.consulta.horaInicio).toLocaleDateString('pt-PT'),
        horaConsulta: new Date(consulta.consulta.horaInicio).toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        nomeClinica: 'DentCarePro', // TODO: Buscar nome da clínica
      });

      // Enviar SMS
      const resultado = await enviarSMS({
        para: consulta.utente.telemovel,
        mensagem,
        utenteId: consulta.utente.id,
        clinicaId: ctx.user.clinicaId!,
        tipo: 'lembrete_consulta',
      });

      return resultado;
    }),

  /**
   * Enviar lembrete de fatura vencida
   */
  enviarLembreteFatura: protectedProcedure
    .input(z.object({
      faturaId: z.number(),
      linkPagamento: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar fatura com utente
      const [fatura] = await db
        .select({
          fatura: faturas,
          utente: utentes,
        })
        .from(faturas)
        .innerJoin(utentes, eq(faturas.utenteId, utentes.id))
        .where(and(
          eq(faturas.id, input.faturaId),
          eq(faturas.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!fatura) {
        throw new Error("Fatura não encontrada");
      }

      if (!fatura.utente.telemovel) {
        throw new Error("Utente não possui telemóvel cadastrado");
      }

      // Gerar mensagem
      const mensagem = gerarMensagemFaturaVencida({
        nomeUtente: fatura.utente.nome,
        numeroFatura: fatura.fatura.numeroFatura,
        valor: `€${parseFloat(fatura.fatura.valorTotal).toFixed(2)}`,
        dataVencimento: fatura.fatura.dataVencimento 
          ? new Date(fatura.fatura.dataVencimento).toLocaleDateString('pt-PT')
          : 'N/A',
        linkPagamento: input.linkPagamento,
      });

      // Enviar SMS
      const resultado = await enviarSMS({
        para: fatura.utente.telemovel,
        mensagem,
        utenteId: fatura.utente.id,
        clinicaId: ctx.user.clinicaId!,
        tipo: 'lembrete_fatura',
      });

      return resultado;
    }),

  /**
   * Enviar confirmação de agendamento
   */
  enviarConfirmacaoAgendamento: protectedProcedure
    .input(z.object({
      consultaId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar consulta
      const [consulta] = await db
        .select({
          consulta: consultas,
          utente: utentes,
          dentista: dentistas,
        })
        .from(consultas)
        .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
        .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
        .where(and(
          eq(consultas.id, input.consultaId),
          eq(consultas.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!consulta) {
        throw new Error("Consulta não encontrada");
      }

      if (!consulta.utente.telemovel) {
        throw new Error("Utente não possui telemóvel cadastrado");
      }

      // Gerar mensagem
      const mensagem = gerarMensagemConfirmacaoAgendamento({
        nomeUtente: consulta.utente.nome,
        dataConsulta: new Date(consulta.consulta.horaInicio).toLocaleDateString('pt-PT'),
        horaConsulta: new Date(consulta.consulta.horaInicio).toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        nomeDentista: consulta.dentista.nome,
        nomeClinica: 'DentCarePro',
      });

      // Enviar SMS
      const resultado = await enviarSMS({
        para: consulta.utente.telemovel,
        mensagem,
        utenteId: consulta.utente.id,
        clinicaId: ctx.user.clinicaId!,
        tipo: 'confirmacao_agendamento',
      });

      return resultado;
    }),

  /**
   * Enviar mensagem personalizada
   */
  enviarMensagemPersonalizada: protectedProcedure
    .input(z.object({
      utenteId: z.number(),
      mensagem: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar utente
      const [utente] = await db
        .select()
        .from(utentes)
        .where(and(
          eq(utentes.id, input.utenteId),
          eq(utentes.clinicaId, ctx.user.clinicaId!)
        ))
        .limit(1);

      if (!utente) {
        throw new Error("Utente não encontrado");
      }

      if (!utente.telemovel) {
        throw new Error("Utente não possui telemóvel cadastrado");
      }

      // Enviar SMS
      const resultado = await enviarSMS({
        para: utente.telemovel,
        mensagem: gerarMensagemPersonalizada(input.mensagem),
        utenteId: utente.id,
        clinicaId: ctx.user.clinicaId!,
        tipo: 'personalizada',
      });

      return resultado;
    }),

  /**
   * Enviar mensagem em lote
   */
  enviarMensagemLote: protectedProcedure
    .input(z.object({
      utentesIds: z.array(z.number()),
      mensagem: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar utentes
      const utentesComTelemovel = await db
        .select()
        .from(utentes)
        .where(and(
          eq(utentes.clinicaId, ctx.user.clinicaId!)
        ));

      const destinatarios = utentesComTelemovel
        .filter(u => input.utentesIds.includes(u.id) && u.telemovel)
        .map(u => ({
          para: u.telemovel!,
          mensagem: gerarMensagemPersonalizada(input.mensagem),
          utenteId: u.id,
        }));

      if (destinatarios.length === 0) {
        throw new Error("Nenhum utente com telemóvel encontrado");
      }

      // Enviar SMS em lote
      const resultado = await enviarSMSLote({
        destinatarios,
        clinicaId: ctx.user.clinicaId!,
        tipo: 'lote',
      });

      return resultado;
    }),
});

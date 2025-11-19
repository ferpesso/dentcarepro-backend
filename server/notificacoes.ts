import { getDb } from "./db";
import { consultas, utentes, dentistas, clinicas, templatesMensagem, mensagensUtente } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Sistema de Notificações Automáticas
 * Envia lembretes de consultas por email/SMS
 */

interface NotificacaoConfig {
  tipo: "email" | "sms" | "ambos";
  antecedenciaHoras: number;
}

/**
 * Obter consultas que precisam de lembrete
 */
export async function getConsultasParaLembrete(antecedenciaHoras: number = 24) {
  const db = await getDb();
  if (!db) return [];

  const agora = new Date();
  const dataInicio = new Date(agora.getTime() + antecedenciaHoras * 60 * 60 * 1000);
  const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000); // Janela de 1 hora

  const resultado = await db
    .select({
      consultaId: consultas.id,
      clinicaId: consultas.clinicaId,
      consultaHora: consultas.horaInicio,
      consultaTitulo: consultas.titulo,
      utenteId: utentes.id,
      utenteNome: utentes.nome,
      utenteEmail: utentes.email,
      utenteTelemovel: utentes.telemovel,
      dentistaNome: dentistas.nome,
      clinicaNome: clinicas.nome,
      clinicaTelemovel: clinicas.telemovel,
      clinicaEmail: clinicas.email,
    })
    .from(consultas)
    .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
    .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
    .innerJoin(clinicas, eq(consultas.clinicaId, clinicas.id))
    .where(
      and(
        gte(consultas.horaInicio, dataInicio),
        lte(consultas.horaInicio, dataFim),
        eq(consultas.estado, "agendada")
      )
    );

  return resultado;
}

/**
 * Criar mensagem de lembrete
 */
export async function criarMensagemLembrete(
  clinicaId: number,
  consultaId: number,
  utenteId: number,
  canal: "email" | "sms",
  corpo: string
) {
  const db = await getDb();
  if (!db) return null;

  const [mensagem] = await db.insert(mensagensUtente).values({
    clinicaId,
    utenteId,
    canal,
    assunto: "Lembrete de Consulta",
    corpo,
    estado: "pendente",
  });

  return mensagem;
}

/**
 * Formatar mensagem de lembrete
 */
export function formatarMensagemLembrete(dados: {
  utenteNome: string;
  dentistaNome: string;
  clinicaNome: string;
  consultaHora: Date;
  clinicaTelemovel: string | null;
}): { email: string; sms: string } {
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

  const email = `
Olá ${dados.utenteNome},

Este é um lembrete da sua consulta marcada para:

📅 Data: ${dataFormatada}
🕐 Hora: ${horaFormatada}
👨‍⚕️ Dentista: ${dados.dentistaNome}
🏥 Clínica: ${dados.clinicaNome}

Por favor, chegue com 10 minutos de antecedência.

Se precisar de remarcar ou cancelar, contacte-nos:
${dados.clinicaTelemovel ? `📞 ${dados.clinicaTelemovel}` : ""}

Obrigado,
Equipa ${dados.clinicaNome}
  `.trim();

  const sms = `Lembrete: Consulta ${dataFormatada} às ${horaFormatada} com ${dados.dentistaNome} na ${dados.clinicaNome}. ${dados.clinicaTelemovel || ""}`;

  return { email, sms };
}

/**
 * Processar lembretes automáticos
 */
export async function processarLembretesAutomaticos(config: NotificacaoConfig) {
  const consultas = await getConsultasParaLembrete(config.antecedenciaHoras);
  const resultados = [];

  for (const consulta of consultas) {
    const mensagens = formatarMensagemLembrete({
      utenteNome: consulta.utenteNome,
      dentistaNome: consulta.dentistaNome,
      clinicaNome: consulta.clinicaNome,
      consultaHora: consulta.consultaHora,
      clinicaTelemovel: consulta.clinicaTelemovel,
    });

    // Enviar email
    if ((config.tipo === "email" || config.tipo === "ambos") && consulta.utenteEmail) {
      const mensagemEmail = await criarMensagemLembrete(
        consulta.clinicaId,
        consulta.consultaId,
        consulta.utenteId,
        "email",
        mensagens.email
      );
      resultados.push({ tipo: "email", consultaId: consulta.consultaId, sucesso: !!mensagemEmail });
    }

    // Enviar SMS
    if ((config.tipo === "sms" || config.tipo === "ambos") && consulta.utenteTelemovel) {
      const mensagemSMS = await criarMensagemLembrete(
        consulta.clinicaId,
        consulta.consultaId,
        consulta.utenteId,
        "sms",
        mensagens.sms
      );
      resultados.push({ tipo: "sms", consultaId: consulta.consultaId, sucesso: !!mensagemSMS });
    }
  }

  return {
    total: consultas.length,
    processados: resultados.length,
    resultados,
  };
}

/**
 * Marcar mensagem como enviada
 */
export async function marcarMensagemEnviada(mensagemId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(mensagensUtente)
    .set({ estado: "enviada", enviadaEm: new Date() })
    .where(eq(mensagensUtente.id, mensagemId));

  return true;
}

/**
 * Marcar mensagem como falhada
 */
export async function marcarMensagemFalhada(mensagemId: number, mensagemErro: string) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(mensagensUtente)
    .set({ estado: "falhada", mensagemErro })
    .where(eq(mensagensUtente.id, mensagemId));

  return true;
}

/**
 * Obter mensagens pendentes
 */
export async function getMensagensPendentes(limite: number = 100) {
  const db = await getDb();
  if (!db) return [];

  const mensagens = await db
    .select()
    .from(mensagensUtente)
    .where(eq(mensagensUtente.estado, "pendente"))
    .limit(limite);

  return mensagens;
}

/**
 * Obter estatísticas de notificações
 */
export async function getEstatisticasNotificacoes(clinicaId: number, periodo: number = 30) {
  const db = await getDb();
  if (!db) return null;

  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - periodo);

  const resultado = await db
    .select({
      total: sql<number>`COUNT(*)`,
      enviadas: sql<number>`SUM(CASE WHEN ${mensagensUtente.estado} = 'enviada' THEN 1 ELSE 0 END)`,
      falhadas: sql<number>`SUM(CASE WHEN ${mensagensUtente.estado} = 'falhada' THEN 1 ELSE 0 END)`,
      pendentes: sql<number>`SUM(CASE WHEN ${mensagensUtente.estado} = 'pendente' THEN 1 ELSE 0 END)`,
    })
    .from(mensagensUtente)
    .innerJoin(utentes, eq(mensagensUtente.utenteId, utentes.id))
    .where(
      and(
        eq(utentes.clinicaId, clinicaId),
        gte(mensagensUtente.createdAt, dataInicio)
      )
    );

  return resultado[0] || { total: 0, enviadas: 0, falhadas: 0, pendentes: 0 };
}

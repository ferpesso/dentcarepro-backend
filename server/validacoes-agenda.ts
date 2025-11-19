import { getDb } from "./db";
import { consultas } from "../drizzle/schema";
import { and, eq, or, gte, lte, ne } from "drizzle-orm";

/**
 * Serviço de Validações de Agenda
 * Validar conflitos de horário, disponibilidade e regras de negócio
 */

export interface ValidacaoResultado {
  valido: boolean;
  erro?: string;
  conflitos?: any[];
  sugestoes?: Date[];
}

/**
 * Verificar se há conflito de horário para um dentista
 */
export async function verificarConflitoHorario(dados: {
  dentistaId: number;
  horaInicio: Date;
  horaFim: Date;
  consultaIdExcluir?: number; // Para edição, excluir a própria consulta
}): Promise<ValidacaoResultado> {
  const db = await getDb();
  if (!db) {
    return { valido: false, erro: "Base de dados não disponível" };
  }

  try {
    // Buscar consultas que possam ter conflito
    const consultasConflitantes = await db
      .select()
      .from(consultas)
      .where(
        and(
          eq(consultas.dentistaId, dados.dentistaId),
          // Excluir a própria consulta se for edição
          dados.consultaIdExcluir ? ne(consultas.id, dados.consultaIdExcluir) : undefined,
          // Não considerar consultas canceladas
          ne(consultas.estado, "cancelada"),
          // Verificar sobreposição de horários
          or(
            // Nova consulta começa durante consulta existente
            and(
              gte(consultas.horaInicio, dados.horaInicio),
              lte(consultas.horaInicio, dados.horaFim)
            ),
            // Nova consulta termina durante consulta existente
            and(
              gte(consultas.horaFim, dados.horaInicio),
              lte(consultas.horaFim, dados.horaFim)
            ),
            // Nova consulta engloba consulta existente
            and(
              lte(consultas.horaInicio, dados.horaInicio),
              gte(consultas.horaFim, dados.horaFim)
            )
          )
        )
      );

    if (consultasConflitantes.length > 0) {
      return {
        valido: false,
        erro: "Já existe uma consulta agendada neste horário para este dentista",
        conflitos: consultasConflitantes,
      };
    }

    return { valido: true };
  } catch (error: any) {
    return { valido: false, erro: `Erro ao verificar conflito: ${error.message}` };
  }
}

/**
 * Verificar se há conflito de horário para um utente
 */
export async function verificarConflitoUtenteHorario(dados: {
  utenteId: number;
  horaInicio: Date;
  horaFim: Date;
  consultaIdExcluir?: number;
}): Promise<ValidacaoResultado> {
  const db = await getDb();
  if (!db) {
    return { valido: false, erro: "Base de dados não disponível" };
  }

  try {
    const consultasConflitantes = await db
      .select()
      .from(consultas)
      .where(
        and(
          eq(consultas.utenteId, dados.utenteId),
          dados.consultaIdExcluir ? ne(consultas.id, dados.consultaIdExcluir) : undefined,
          ne(consultas.estado, "cancelada"),
          or(
            and(
              gte(consultas.horaInicio, dados.horaInicio),
              lte(consultas.horaInicio, dados.horaFim)
            ),
            and(
              gte(consultas.horaFim, dados.horaInicio),
              lte(consultas.horaFim, dados.horaFim)
            ),
            and(
              lte(consultas.horaInicio, dados.horaInicio),
              gte(consultas.horaFim, dados.horaFim)
            )
          )
        )
      );

    if (consultasConflitantes.length > 0) {
      return {
        valido: false,
        erro: "O utente já tem uma consulta agendada neste horário",
        conflitos: consultasConflitantes,
      };
    }

    return { valido: true };
  } catch (error: any) {
    return { valido: false, erro: `Erro ao verificar conflito: ${error.message}` };
  }
}

/**
 * Validar horário de funcionamento da clínica
 */
export function validarHorarioFuncionamento(
  horaInicio: Date,
  horaFim: Date,
  config?: {
    horaAbertura?: number; // hora em formato 24h (ex: 8)
    horaFechamento?: number; // hora em formato 24h (ex: 20)
    diasFuncionamento?: number[]; // 0=domingo, 1=segunda, etc
  }
): ValidacaoResultado {
  const configuracao = {
    horaAbertura: config?.horaAbertura || 7,
    horaFechamento: config?.horaFechamento || 20,
    diasFuncionamento: config?.diasFuncionamento || [1, 2, 3, 4, 5, 6], // Seg a Sáb
  };

  // Verificar dia da semana
  const diaSemana = horaInicio.getDay();
  if (!configuracao.diasFuncionamento.includes(diaSemana)) {
    const diasNomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return {
      valido: false,
      erro: `A clínica não funciona aos ${diasNomes[diaSemana]}s`,
    };
  }

  // Verificar horário de abertura
  const horaInicioNum = horaInicio.getHours();
  const horaFimNum = horaFim.getHours();

  if (horaInicioNum < configuracao.horaAbertura) {
    return {
      valido: false,
      erro: `A clínica abre às ${configuracao.horaAbertura}:00`,
    };
  }

  if (horaFimNum > configuracao.horaFechamento) {
    return {
      valido: false,
      erro: `A clínica fecha às ${configuracao.horaFechamento}:00`,
    };
  }

  // Verificar se hora fim é depois de hora início
  if (horaFim <= horaInicio) {
    return {
      valido: false,
      erro: "A hora de término deve ser posterior à hora de início",
    };
  }

  return { valido: true };
}

/**
 * Validar duração mínima e máxima da consulta
 */
export function validarDuracaoConsulta(
  horaInicio: Date,
  horaFim: Date,
  config?: {
    duracaoMinima?: number; // em minutos
    duracaoMaxima?: number; // em minutos
  }
): ValidacaoResultado {
  const configuracao = {
    duracaoMinima: config?.duracaoMinima || 15,
    duracaoMaxima: config?.duracaoMaxima || 240, // 4 horas
  };

  const duracaoMs = horaFim.getTime() - horaInicio.getTime();
  const duracaoMinutos = duracaoMs / (1000 * 60);

  if (duracaoMinutos < configuracao.duracaoMinima) {
    return {
      valido: false,
      erro: `A duração mínima da consulta é ${configuracao.duracaoMinima} minutos`,
    };
  }

  if (duracaoMinutos > configuracao.duracaoMaxima) {
    return {
      valido: false,
      erro: `A duração máxima da consulta é ${configuracao.duracaoMaxima} minutos`,
    };
  }

  return { valido: true };
}

/**
 * Validar antecedência mínima para agendamento
 */
export function validarAntecedenciaMinima(
  horaInicio: Date,
  config?: {
    antecedenciaMinutos?: number;
  }
): ValidacaoResultado {
  const configuracao = {
    antecedenciaMinutos: config?.antecedenciaMinutos || 30,
  };

  const agora = new Date();
  const diferencaMs = horaInicio.getTime() - agora.getTime();
  const diferencaMinutos = diferencaMs / (1000 * 60);

  if (diferencaMinutos < configuracao.antecedenciaMinutos) {
    return {
      valido: false,
      erro: `É necessário agendar com pelo menos ${configuracao.antecedenciaMinutos} minutos de antecedência`,
    };
  }

  return { valido: true };
}

/**
 * Validação completa de agendamento
 */
export async function validarAgendamentoCompleto(dados: {
  clinicaId: number;
  dentistaId: number;
  utenteId: number;
  horaInicio: Date;
  horaFim: Date;
  consultaIdExcluir?: number;
  config?: {
    verificarAntecedencia?: boolean;
    verificarHorarioFuncionamento?: boolean;
    verificarDuracao?: boolean;
    verificarConflitoDentista?: boolean;
    verificarConflitoUtente?: boolean;
  };
}): Promise<ValidacaoResultado> {
  const config = {
    verificarAntecedencia: dados.config?.verificarAntecedencia ?? true,
    verificarHorarioFuncionamento: dados.config?.verificarHorarioFuncionamento ?? true,
    verificarDuracao: dados.config?.verificarDuracao ?? true,
    verificarConflitoDentista: dados.config?.verificarConflitoDentista ?? true,
    verificarConflitoUtente: dados.config?.verificarConflitoUtente ?? true,
  };

  // Validar antecedência mínima
  if (config.verificarAntecedencia) {
    const validacaoAntecedencia = validarAntecedenciaMinima(dados.horaInicio);
    if (!validacaoAntecedencia.valido) {
      return validacaoAntecedencia;
    }
  }

  // Validar horário de funcionamento
  if (config.verificarHorarioFuncionamento) {
    const validacaoHorario = validarHorarioFuncionamento(dados.horaInicio, dados.horaFim);
    if (!validacaoHorario.valido) {
      return validacaoHorario;
    }
  }

  // Validar duração
  if (config.verificarDuracao) {
    const validacaoDuracao = validarDuracaoConsulta(dados.horaInicio, dados.horaFim);
    if (!validacaoDuracao.valido) {
      return validacaoDuracao;
    }
  }

  // Verificar conflito de horário do dentista
  if (config.verificarConflitoDentista) {
    const validacaoConflitoDentista = await verificarConflitoHorario({
      dentistaId: dados.dentistaId,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      consultaIdExcluir: dados.consultaIdExcluir,
    });
    if (!validacaoConflitoDentista.valido) {
      return validacaoConflitoDentista;
    }
  }

  // Verificar conflito de horário do utente
  if (config.verificarConflitoUtente) {
    const validacaoConflitoUtente = await verificarConflitoUtenteHorario({
      utenteId: dados.utenteId,
      horaInicio: dados.horaInicio,
      horaFim: dados.horaFim,
      consultaIdExcluir: dados.consultaIdExcluir,
    });
    if (!validacaoConflitoUtente.valido) {
      return validacaoConflitoUtente;
    }
  }

  return { valido: true };
}

/**
 * Sugerir horários alternativos quando há conflito
 */
export async function sugerirHorariosAlternativos(dados: {
  dentistaId: number;
  dataDesejada: Date;
  duracao: number; // em minutos
  quantidade?: number;
}): Promise<Date[]> {
  const db = await getDb();
  if (!db) return [];

  const quantidade = dados.quantidade || 5;
  const sugestoes: Date[] = [];

  // Buscar consultas do dentista no dia
  const inicioDia = new Date(dados.dataDesejada);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(dados.dataDesejada);
  fimDia.setHours(23, 59, 59, 999);

  const consultasDia = await db
    .select()
    .from(consultas)
    .where(
      and(
        eq(consultas.dentistaId, dados.dentistaId),
        gte(consultas.horaInicio, inicioDia),
        lte(consultas.horaInicio, fimDia),
        ne(consultas.estado, "cancelada")
      )
    )
    .orderBy(consultas.horaInicio);

  // Horários de funcionamento (7h às 20h)
  const horaAbertura = 7;
  const horaFechamento = 20;

  // Gerar slots de 30 minutos
  const slots: Date[] = [];
  for (let hora = horaAbertura; hora < horaFechamento; hora++) {
    for (let minuto = 0; minuto < 60; minuto += 30) {
      const slot = new Date(dados.dataDesejada);
      slot.setHours(hora, minuto, 0, 0);
      slots.push(slot);
    }
  }

  // Verificar quais slots estão livres
  for (const slot of slots) {
    if (sugestoes.length >= quantidade) break;

    const slotFim = new Date(slot.getTime() + dados.duracao * 60 * 1000);

    // Verificar se slot está no futuro
    if (slot < new Date()) continue;

    // Verificar se não conflita com consultas existentes
    let temConflito = false;
    for (const consulta of consultasDia) {
      const consultaInicio = new Date(consulta.horaInicio);
      const consultaFim = new Date(consulta.horaFim);

      if (
        (slot >= consultaInicio && slot < consultaFim) ||
        (slotFim > consultaInicio && slotFim <= consultaFim) ||
        (slot <= consultaInicio && slotFim >= consultaFim)
      ) {
        temConflito = true;
        break;
      }
    }

    if (!temConflito) {
      sugestoes.push(slot);
    }
  }

  return sugestoes;
}

/**
 * Verificar disponibilidade de um dentista em um período
 */
export async function verificarDisponibilidadeDentista(dados: {
  dentistaId: number;
  dataInicio: Date;
  dataFim: Date;
}): Promise<{
  disponivel: boolean;
  horasOcupadas: number;
  horasLivres: number;
  taxaOcupacao: number;
}> {
  const db = await getDb();
  if (!db) {
    return { disponivel: false, horasOcupadas: 0, horasLivres: 0, taxaOcupacao: 0 };
  }

  const consultasPeriodo = await db
    .select()
    .from(consultas)
    .where(
      and(
        eq(consultas.dentistaId, dados.dentistaId),
        gte(consultas.horaInicio, dados.dataInicio),
        lte(consultas.horaInicio, dados.dataFim),
        ne(consultas.estado, "cancelada")
      )
    );

  // Calcular horas ocupadas
  let minutosOcupados = 0;
  for (const consulta of consultasPeriodo) {
    const inicio = new Date(consulta.horaInicio);
    const fim = new Date(consulta.horaFim);
    minutosOcupados += (fim.getTime() - inicio.getTime()) / (1000 * 60);
  }

  const horasOcupadas = minutosOcupados / 60;

  // Calcular horas de trabalho no período (assumindo 9h por dia útil)
  const dias = Math.ceil(
    (dados.dataFim.getTime() - dados.dataInicio.getTime()) / (1000 * 60 * 60 * 24)
  );
  const horasTrabalho = dias * 9; // 9 horas por dia
  const horasLivres = horasTrabalho - horasOcupadas;
  const taxaOcupacao = (horasOcupadas / horasTrabalho) * 100;

  return {
    disponivel: horasLivres > 0,
    horasOcupadas: Math.round(horasOcupadas * 10) / 10,
    horasLivres: Math.round(horasLivres * 10) / 10,
    taxaOcupacao: Math.round(taxaOcupacao * 10) / 10,
  };
}

import { getDb } from "./db";
import {
  faturas,
  consultas,
  utentes,
  dentistas,
  procedimentos,
  pagamentosFatura,
  itensFatura,
} from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Sistema de Relatórios Avançados
 * Análises financeiras, estatísticas e relatórios personalizados
 */

interface PeriodoRelatorio {
  dataInicio: Date;
  dataFim: Date;
}

/**
 * Relatório Financeiro Completo
 */
export async function getRelatorioFinanceiro(clinicaId: number, periodo: PeriodoRelatorio) {
  const db = await getDb();
  if (!db) return null;

  // Receita total
  const receitaTotal = await db
    .select({
      total: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
      pago: sql<number>`COALESCE(SUM(${faturas.valorPago}), 0)`,
      pendente: sql<number>`COALESCE(SUM(${faturas.valorTotal} - ${faturas.valorPago}), 0)`,
    })
    .from(faturas)
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(faturas.dataFatura, periodo.dataInicio),
        lte(faturas.dataFatura, periodo.dataFim)
      )
    );

  // Receita por método de pagamento
  const receitaPorMetodo = await db
    .select({
      metodo: pagamentosFatura.metodoPagamento,
      total: sql<number>`COALESCE(SUM(${pagamentosFatura.valor}), 0)`,
      quantidade: sql<number>`COUNT(*)`,
    })
    .from(pagamentosFatura)
    .innerJoin(faturas, eq(pagamentosFatura.faturaId, faturas.id))
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(pagamentosFatura.dataPagamento, periodo.dataInicio),
        lte(pagamentosFatura.dataPagamento, periodo.dataFim)
      )
    )
    .groupBy(pagamentosFatura.metodoPagamento);

  // Receita por procedimento
  const receitaPorProcedimento = await db
    .select({
      procedimentoId: procedimentos.id,
      procedimentoNome: procedimentos.nome,
      quantidade: sql<number>`COUNT(${itensFatura.id})`,
      total: sql<number>`COALESCE(SUM(${itensFatura.precoTotal}), 0)`,
    })
    .from(itensFatura)
    .innerJoin(faturas, eq(itensFatura.faturaId, faturas.id))
    .leftJoin(procedimentos, eq(itensFatura.procedimentoId, procedimentos.id))
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(faturas.dataFatura, periodo.dataInicio),
        lte(faturas.dataFatura, periodo.dataFim)
      )
    )
    .groupBy(procedimentos.id, procedimentos.nome)
    .orderBy(desc(sql`SUM(${itensFatura.precoTotal})`))
    .limit(10);

  // Receita por dentista
  const receitaPorDentista = await db
    .select({
      dentistaId: dentistas.id,
      dentistaNome: dentistas.nome,
      totalConsultas: sql<number>`COUNT(DISTINCT ${consultas.id})`,
      totalFaturas: sql<number>`COUNT(DISTINCT ${faturas.id})`,
      receita: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
    })
    .from(consultas)
    .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
    .leftJoin(faturas, eq(consultas.id, faturas.consultaId))
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        gte(consultas.horaInicio, periodo.dataInicio),
        lte(consultas.horaInicio, periodo.dataFim)
      )
    )
    .groupBy(dentistas.id, dentistas.nome)
    .orderBy(desc(sql`SUM(${faturas.valorTotal})`));

  // Faturas por estado
  const faturasPorEstado = await db
    .select({
      estado: faturas.estado,
      quantidade: sql<number>`COUNT(*)`,
      valor: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
    })
    .from(faturas)
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(faturas.dataFatura, periodo.dataInicio),
        lte(faturas.dataFatura, periodo.dataFim)
      )
    )
    .groupBy(faturas.estado);

  return {
    periodo,
    resumo: receitaTotal[0],
    receitaPorMetodo,
    receitaPorProcedimento,
    receitaPorDentista,
    faturasPorEstado,
  };
}

/**
 * Relatório de Produtividade
 */
export async function getRelatorioProdutividade(clinicaId: number, periodo: PeriodoRelatorio) {
  const db = await getDb();
  if (!db) return null;

  // Consultas por dentista
  const consultasPorDentista = await db
    .select({
      dentistaId: dentistas.id,
      dentistaNome: dentistas.nome,
      totalConsultas: sql<number>`COUNT(*)`,
      consultasAgendadas: sql<number>`SUM(CASE WHEN ${consultas.estado} = 'agendada' THEN 1 ELSE 0 END)`,
      consultasConcluidas: sql<number>`SUM(CASE WHEN ${consultas.estado} = 'concluida' THEN 1 ELSE 0 END)`,
      consultasCanceladas: sql<number>`SUM(CASE WHEN ${consultas.estado} = 'cancelada' THEN 1 ELSE 0 END)`,
      consultasFaltou: sql<number>`SUM(CASE WHEN ${consultas.estado} = 'faltou' THEN 1 ELSE 0 END)`,
    })
    .from(consultas)
    .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        gte(consultas.horaInicio, periodo.dataInicio),
        lte(consultas.horaInicio, periodo.dataFim)
      )
    )
    .groupBy(dentistas.id, dentistas.nome);

  // Taxa de ocupação por dia da semana
  const ocupacaoPorDia = await db
    .select({
      diaSemana: sql<number>`DAYOFWEEK(${consultas.horaInicio})`,
      totalConsultas: sql<number>`COUNT(*)`,
    })
    .from(consultas)
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        gte(consultas.horaInicio, periodo.dataInicio),
        lte(consultas.horaInicio, periodo.dataFim)
      )
    )
    .groupBy(sql`DAYOFWEEK(${consultas.horaInicio})`);

  // Taxa de ocupação por hora do dia
  const ocupacaoPorHora = await db
    .select({
      hora: sql<number>`HOUR(${consultas.horaInicio})`,
      totalConsultas: sql<number>`COUNT(*)`,
    })
    .from(consultas)
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        gte(consultas.horaInicio, periodo.dataInicio),
        lte(consultas.horaInicio, periodo.dataFim)
      )
    )
    .groupBy(sql`HOUR(${consultas.horaInicio})`);

  return {
    periodo,
    consultasPorDentista,
    ocupacaoPorDia,
    ocupacaoPorHora,
  };
}

/**
 * Relatório de Utentes
 */
export async function getRelatorioUtentes(clinicaId: number, periodo: PeriodoRelatorio) {
  const db = await getDb();
  if (!db) return null;

  // Novos utentes no período
  const novosUtentes = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(utentes)
    .where(
      and(
        eq(utentes.clinicaId, clinicaId),
        gte(utentes.createdAt, periodo.dataInicio),
        lte(utentes.createdAt, periodo.dataFim)
      )
    );

  // Utentes mais ativos (mais consultas)
  const utentesMaisAtivos = await db
    .select({
      utenteId: utentes.id,
      utenteNome: utentes.nome,
      totalConsultas: sql<number>`COUNT(${consultas.id})`,
      ultimaConsulta: sql<Date>`MAX(${consultas.horaInicio})`,
    })
    .from(utentes)
    .leftJoin(consultas, eq(utentes.id, consultas.utenteId))
    .where(
      and(
        eq(utentes.clinicaId, clinicaId),
        gte(consultas.horaInicio, periodo.dataInicio),
        lte(consultas.horaInicio, periodo.dataFim)
      )
    )
    .groupBy(utentes.id, utentes.nome)
    .orderBy(desc(sql`COUNT(${consultas.id})`))
    .limit(10);

  // Utentes com maior valor de faturas
  const utentesMaiorValor = await db
    .select({
      utenteId: utentes.id,
      utenteNome: utentes.nome,
      totalFaturas: sql<number>`COUNT(${faturas.id})`,
      valorTotal: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
    })
    .from(utentes)
    .leftJoin(faturas, eq(utentes.id, faturas.utenteId))
    .where(
      and(
        eq(utentes.clinicaId, clinicaId),
        gte(faturas.dataFatura, periodo.dataInicio),
        lte(faturas.dataFatura, periodo.dataFim)
      )
    )
    .groupBy(utentes.id, utentes.nome)
    .orderBy(desc(sql`SUM(${faturas.valorTotal})`))
    .limit(10);

  // Distribuição por género
  const distribuicaoPorGenero = await db
    .select({
      genero: utentes.genero,
      total: sql<number>`COUNT(*)`,
    })
    .from(utentes)
    .where(eq(utentes.clinicaId, clinicaId))
    .groupBy(utentes.genero);

  return {
    periodo,
    novosUtentes: novosUtentes[0]?.total || 0,
    utentesMaisAtivos,
    utentesMaiorValor,
    distribuicaoPorGenero,
  };
}

/**
 * Relatório de Comparação de Períodos
 */
export async function getRelatorioComparacao(
  clinicaId: number,
  periodo1: PeriodoRelatorio,
  periodo2: PeriodoRelatorio
) {
  const db = await getDb();
  if (!db) return null;

  const getMetricasPeriodo = async (periodo: PeriodoRelatorio) => {
    const receita = await db
      .select({
        total: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
      })
      .from(faturas)
      .where(
        and(
          eq(faturas.clinicaId, clinicaId),
          gte(faturas.dataFatura, periodo.dataInicio),
          lte(faturas.dataFatura, periodo.dataFim)
        )
      );

    const consultas_count = await db
      .select({
        total: sql<number>`COUNT(*)`,
      })
      .from(consultas)
      .where(
        and(
          eq(consultas.clinicaId, clinicaId),
          gte(consultas.horaInicio, periodo.dataInicio),
          lte(consultas.horaInicio, periodo.dataFim)
        )
      );

    const utentes_count = await db
      .select({
        total: sql<number>`COUNT(*)`,
      })
      .from(utentes)
      .where(
        and(
          eq(utentes.clinicaId, clinicaId),
          gte(utentes.createdAt, periodo.dataInicio),
          lte(utentes.createdAt, periodo.dataFim)
        )
      );

    return {
      receita: parseFloat(receita[0]?.total?.toString() || "0"),
      consultas: parseInt(consultas_count[0]?.total?.toString() || "0"),
      novosUtentes: parseInt(utentes_count[0]?.total?.toString() || "0"),
    };
  };

  const metricas1 = await getMetricasPeriodo(periodo1);
  const metricas2 = await getMetricasPeriodo(periodo2);

  const calcularVariacao = (valor1: number, valor2: number) => {
    if (valor2 === 0) return 0;
    return ((valor1 - valor2) / valor2) * 100;
  };

  return {
    periodo1,
    periodo2,
    metricas1,
    metricas2,
    variacoes: {
      receita: calcularVariacao(metricas1.receita, metricas2.receita),
      consultas: calcularVariacao(metricas1.consultas, metricas2.consultas),
      novosUtentes: calcularVariacao(metricas1.novosUtentes, metricas2.novosUtentes),
    },
  };
}

/**
 * Exportar relatório para CSV
 */
export function exportarParaCSV(dados: any[], colunas: string[]): string {
  const header = colunas.join(",");
  const rows = dados.map((row) => colunas.map((col) => row[col] || "").join(","));
  return [header, ...rows].join("\n");
}

/**
 * Obter top 10 procedimentos mais lucrativos
 */
export async function getTopProcedimentosLucrativos(
  clinicaId: number,
  periodo: PeriodoRelatorio
) {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db
    .select({
      procedimentoId: procedimentos.id,
      procedimentoNome: procedimentos.nome,
      quantidade: sql<number>`COUNT(${itensFatura.id})`,
      receitaTotal: sql<number>`COALESCE(SUM(${itensFatura.precoTotal}), 0)`,
      receitaMedia: sql<number>`COALESCE(AVG(${itensFatura.precoTotal}), 0)`,
    })
    .from(itensFatura)
    .innerJoin(faturas, eq(itensFatura.faturaId, faturas.id))
    .leftJoin(procedimentos, eq(itensFatura.procedimentoId, procedimentos.id))
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(faturas.dataFatura, periodo.dataInicio),
        lte(faturas.dataFatura, periodo.dataFim)
      )
    )
    .groupBy(procedimentos.id, procedimentos.nome)
    .orderBy(desc(sql`SUM(${itensFatura.precoTotal})`))
    .limit(10);

  return resultado.map((r) => ({
    procedimentoId: r.procedimentoId,
    procedimentoNome: r.procedimentoNome || "Sem procedimento",
    quantidade: parseInt(r.quantidade?.toString() || "0"),
    receitaTotal: parseFloat(r.receitaTotal?.toString() || "0"),
    receitaMedia: parseFloat(r.receitaMedia?.toString() || "0"),
  }));
}

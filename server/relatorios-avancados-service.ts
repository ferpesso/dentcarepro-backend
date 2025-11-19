import { getDb } from "./db";
import { consultas, utentes, dentistas, faturas, procedimentos, itensFatura } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Servico de Relatorios Avancados
 * 
 * Funcionalidades:
 * - Dashboard executivo
 * - KPIs detalhados
 * - Analise de rentabilidade
 * - Previsoes financeiras
 * - Comparacoes de periodos
 * - Analise por dentista
 * - Analise por procedimento
 */

export interface PeriodoAnalise {
  dataInicio: Date;
  dataFim: Date;
}

export interface KPIsGerais {
  // Financeiro
  receitaTotal: number;
  receitaPaga: number;
  receitaPendente: number;
  ticketMedio: number;
  crescimentoReceita: number; // %
  
  // Operacional
  totalConsultas: number;
  consultasRealizadas: number;
  consultasCanceladas: number;
  taxaComparecimento: number; // %
  
  // Utentes
  totalUtentes: number;
  utentesNovos: number;
  utentesAtivos: number;
  taxaRetencao: number; // %
  
  // Produtividade
  consultasPorDia: number;
  receitaPorConsulta: number;
  tempoMedioConsulta: number; // minutos
}

export interface AnaliseRentabilidade {
  procedimento: string;
  categoria: string;
  quantidade: number;
  receitaTotal: number;
  receitaMedia: number;
  percentualReceita: number;
  tendencia: "subindo" | "estavel" | "descendo";
}

export interface AnaliseDentista {
  dentistaId: number;
  dentistaNome: string;
  totalConsultas: number;
  receitaGerada: number;
  ticketMedio: number;
  taxaComparecimento: number;
  avaliacaoMedia: number;
  ranking: number;
}

export interface PrevisaoFinanceira {
  mes: string;
  receitaPrevista: number;
  receitaRealizada: number;
  diferenca: number;
  confianca: number; // 0-100%
}

export class RelatoriosAvancadosService {
  /**
   * Obter KPIs gerais da clinica
   */
  static async getKPIsGerais(
    clinicaId: number,
    periodo: PeriodoAnalise,
    periodoAnterior?: PeriodoAnalise
  ): Promise<KPIsGerais> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Financeiro
    const financeiro = await db.query(`
      SELECT 
        SUM(valor_total) as receita_total,
        SUM(valor_pago) as receita_paga,
        SUM(valor_total - valor_pago) as receita_pendente,
        AVG(valor_total) as ticket_medio,
        COUNT(*) as total_faturas
      FROM faturas
      WHERE clinica_id = ?
        AND data_emissao >= ?
        AND data_emissao <= ?
    `, [clinicaId, periodo.dataInicio, periodo.dataFim]);

    // Operacional
    const operacional = await db.query(`
      SELECT 
        COUNT(*) as total_consultas,
        SUM(CASE WHEN estado = 'realizada' THEN 1 ELSE 0 END) as consultas_realizadas,
        SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) as consultas_canceladas
      FROM consultas
      WHERE clinica_id = ?
        AND hora_inicio >= ?
        AND hora_inicio <= ?
    `, [clinicaId, periodo.dataInicio, periodo.dataFim]);

    // Utentes
    const utentesStats = await db.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_utentes,
        COUNT(DISTINCT CASE WHEN u.created_at >= ? THEN u.id END) as utentes_novos,
        COUNT(DISTINCT CASE WHEN c.hora_inicio >= ? THEN u.id END) as utentes_ativos
      FROM utentes u
      LEFT JOIN consultas c ON u.id = c.utente_id AND c.hora_inicio >= ?
      WHERE u.clinica_id = ?
    `, [periodo.dataInicio, periodo.dataInicio, periodo.dataInicio, clinicaId]);

    // Calcular crescimento (comparar com periodo anterior)
    let crescimentoReceita = 0;
    if (periodoAnterior) {
      const financeiroAnterior = await db.query(`
        SELECT SUM(valor_total) as receita_total
        FROM faturas
        WHERE clinica_id = ?
          AND data_emissao >= ?
          AND data_emissao <= ?
      `, [clinicaId, periodoAnterior.dataInicio, periodoAnterior.dataFim]);

      const receitaAnterior = parseFloat(financeiroAnterior[0]?.receita_total || 0);
      const receitaAtual = parseFloat(financeiro[0]?.receita_total || 0);
      
      if (receitaAnterior > 0) {
        crescimentoReceita = ((receitaAtual - receitaAnterior) / receitaAnterior) * 100;
      }
    }

    const fin = financeiro[0] || {};
    const op = operacional[0] || {};
    const ut = utentesStats[0] || {};

    const totalConsultas = parseInt(op.total_consultas) || 0;
    const consultasRealizadas = parseInt(op.consultas_realizadas) || 0;
    const diasPeriodo = Math.ceil(
      (periodo.dataFim.getTime() - periodo.dataInicio.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      // Financeiro
      receitaTotal: parseFloat(fin.receita_total) || 0,
      receitaPaga: parseFloat(fin.receita_paga) || 0,
      receitaPendente: parseFloat(fin.receita_pendente) || 0,
      ticketMedio: parseFloat(fin.ticket_medio) || 0,
      crescimentoReceita,

      // Operacional
      totalConsultas,
      consultasRealizadas,
      consultasCanceladas: parseInt(op.consultas_canceladas) || 0,
      taxaComparecimento: totalConsultas > 0 
        ? (consultasRealizadas / totalConsultas) * 100 
        : 0,

      // Utentes
      totalUtentes: parseInt(ut.total_utentes) || 0,
      utentesNovos: parseInt(ut.utentes_novos) || 0,
      utentesAtivos: parseInt(ut.utentes_ativos) || 0,
      taxaRetencao: 0, // TODO: Calcular taxa de retencao

      // Produtividade
      consultasPorDia: diasPeriodo > 0 ? totalConsultas / diasPeriodo : 0,
      receitaPorConsulta: consultasRealizadas > 0 
        ? (parseFloat(fin.receita_total) || 0) / consultasRealizadas 
        : 0,
      tempoMedioConsulta: 45, // TODO: Calcular tempo medio real
    };
  }

  /**
   * Analise de rentabilidade por procedimento
   */
  static async getAnaliseRentabilidade(
    clinicaId: number,
    periodo: PeriodoAnalise
  ): Promise<AnaliseRentabilidade[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT 
        p.nome as procedimento,
        p.categoria,
        COUNT(if.id) as quantidade,
        SUM(if.valor_unitario * if.quantidade) as receita_total,
        AVG(if.valor_unitario) as receita_media
      FROM itens_fatura if
      JOIN procedimentos p ON if.procedimento_id = p.id
      JOIN faturas f ON if.fatura_id = f.id
      WHERE f.clinica_id = ?
        AND f.data_emissao >= ?
        AND f.data_emissao <= ?
      GROUP BY p.id, p.nome, p.categoria
      ORDER BY receita_total DESC
    `, [clinicaId, periodo.dataInicio, periodo.dataFim]);

    const receitaTotalGeral = resultado.reduce(
      (sum: number, item: any) => sum + parseFloat(item.receita_total),
      0
    );

    return resultado.map((item: any, index: number) => ({
      procedimento: item.procedimento,
      categoria: item.categoria || "Sem categoria",
      quantidade: parseInt(item.quantidade),
      receitaTotal: parseFloat(item.receita_total),
      receitaMedia: parseFloat(item.receita_media),
      percentualReceita: receitaTotalGeral > 0 
        ? (parseFloat(item.receita_total) / receitaTotalGeral) * 100 
        : 0,
      tendencia: index < 3 ? "subindo" : index < 7 ? "estavel" : "descendo",
    }));
  }

  /**
   * Analise de performance por dentista
   */
  static async getAnaliseDentistas(
    clinicaId: number,
    periodo: PeriodoAnalise
  ): Promise<AnaliseDentista[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT 
        d.id as dentista_id,
        d.nome as dentista_nome,
        COUNT(c.id) as total_consultas,
        SUM(CASE WHEN c.estado = 'realizada' THEN 1 ELSE 0 END) as consultas_realizadas,
        COALESCE(SUM(f.valor_total), 0) as receita_gerada,
        COALESCE(AVG(f.valor_total), 0) as ticket_medio
      FROM dentistas d
      LEFT JOIN consultas c ON d.id = c.dentista_id 
        AND c.hora_inicio >= ? 
        AND c.hora_inicio <= ?
      LEFT JOIN faturas f ON c.id = f.consulta_id
      WHERE d.clinica_id = ?
      GROUP BY d.id, d.nome
      ORDER BY receita_gerada DESC
    `, [periodo.dataInicio, periodo.dataFim, clinicaId]);

    return resultado.map((item: any, index: number) => {
      const totalConsultas = parseInt(item.total_consultas) || 0;
      const consultasRealizadas = parseInt(item.consultas_realizadas) || 0;

      return {
        dentistaId: item.dentista_id,
        dentistaNome: item.dentista_nome,
        totalConsultas,
        receitaGerada: parseFloat(item.receita_gerada) || 0,
        ticketMedio: parseFloat(item.ticket_medio) || 0,
        taxaComparecimento: totalConsultas > 0 
          ? (consultasRealizadas / totalConsultas) * 100 
          : 0,
        avaliacaoMedia: 4.5, // TODO: Implementar sistema de avaliacoes
        ranking: index + 1,
      };
    });
  }

  /**
   * Previsao financeira baseada em historico
   */
  static async getPrevisaoFinanceira(
    clinicaId: number,
    mesesFuturos: number = 3
  ): Promise<PrevisaoFinanceira[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Obter receita dos ultimos 12 meses
    const historico = await db.query(`
      SELECT 
        DATE_FORMAT(data_emissao, '%Y-%m') as mes,
        SUM(valor_total) as receita
      FROM faturas
      WHERE clinica_id = ?
        AND data_emissao >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(data_emissao, '%Y-%m')
      ORDER BY mes
    `, [clinicaId]);

    if (historico.length === 0) {
      return [];
    }

    // Calcular media movel e tendencia
    const receitas = historico.map((h: any) => parseFloat(h.receita));
    const mediaMovel = receitas.reduce((a, b) => a + b, 0) / receitas.length;
    
    // Calcular tendencia (regressao linear simples)
    const n = receitas.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = receitas.reduce((a, b) => a + b, 0);
    const sumXY = receitas.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Gerar previsoes
    const previsoes: PrevisaoFinanceira[] = [];
    const hoje = new Date();

    for (let i = 1; i <= mesesFuturos; i++) {
      const mesData = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesNome = mesData.toLocaleDateString("pt-PT", { 
        month: "long", 
        year: "numeric" 
      });

      const receitaPrevista = intercept + slope * (n + i);
      const confianca = Math.max(50, 90 - (i * 10)); // Confianca diminui com o tempo

      previsoes.push({
        mes: mesNome,
        receitaPrevista: Math.max(0, receitaPrevista),
        receitaRealizada: 0, // Sera preenchido quando o mes passar
        diferenca: 0,
        confianca,
      });
    }

    return previsoes;
  }

  /**
   * Comparacao de periodos
   */
  static async compararPeriodos(
    clinicaId: number,
    periodo1: PeriodoAnalise,
    periodo2: PeriodoAnalise
  ) {
    const kpis1 = await this.getKPIsGerais(clinicaId, periodo1);
    const kpis2 = await this.getKPIsGerais(clinicaId, periodo2);

    return {
      periodo1: kpis1,
      periodo2: kpis2,
      diferencas: {
        receitaTotal: kpis2.receitaTotal - kpis1.receitaTotal,
        receitaTotalPercentual: kpis1.receitaTotal > 0 
          ? ((kpis2.receitaTotal - kpis1.receitaTotal) / kpis1.receitaTotal) * 100 
          : 0,
        totalConsultas: kpis2.totalConsultas - kpis1.totalConsultas,
        totalConsultasPercentual: kpis1.totalConsultas > 0 
          ? ((kpis2.totalConsultas - kpis1.totalConsultas) / kpis1.totalConsultas) * 100 
          : 0,
        utentesNovos: kpis2.utentesNovos - kpis1.utentesNovos,
        utentesNovosPercentual: kpis1.utentesNovos > 0 
          ? ((kpis2.utentesNovos - kpis1.utentesNovos) / kpis1.utentesNovos) * 100 
          : 0,
      },
    };
  }

  /**
   * Exportar relatorio para Excel
   */
  static async exportarParaExcel(
    clinicaId: number,
    periodo: PeriodoAnalise,
    tipo: "completo" | "financeiro" | "operacional"
  ): Promise<Buffer> {
    // TODO: Implementar exportacao para Excel usando biblioteca xlsx
    throw new Error("Exportacao para Excel ainda nao implementada");
  }

  /**
   * Exportar relatorio para PDF
   */
  static async exportarParaPDF(
    clinicaId: number,
    periodo: PeriodoAnalise,
    tipo: "completo" | "financeiro" | "operacional"
  ): Promise<Buffer> {
    // TODO: Implementar exportacao para PDF usando biblioteca pdfkit ou puppeteer
    throw new Error("Exportacao para PDF ainda nao implementada");
  }
}

export default RelatoriosAvancadosService;

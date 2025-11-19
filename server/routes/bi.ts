import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { 
  consultas, 
  utentes, 
  procedimentos, 
  faturas,
  dentistas,
  clinicas
} from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Router de Business Intelligence
 * 
 * Fornece dados analíticos e insights para o Dashboard Executivo
 */
export const biRouter = router({
  /**
   * Obter KPIs estratégicos principais
   */
  kpis: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      periodo: z.enum(["mes", "trimestre", "ano"]).default("mes"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { clinicaId, periodo } = input;

      // Calcular datas de início e fim baseado no período
      const hoje = new Date();
      const inicioAtual = new Date();
      const inicioAnterior = new Date();

      if (periodo === "mes") {
        inicioAtual.setDate(1); // Primeiro dia do mês atual
        inicioAnterior.setMonth(inicioAnterior.getMonth() - 1);
        inicioAnterior.setDate(1);
      } else if (periodo === "trimestre") {
        const mesAtual = hoje.getMonth();
        const inicioTrimestre = Math.floor(mesAtual / 3) * 3;
        inicioAtual.setMonth(inicioTrimestre, 1);
        inicioAnterior.setMonth(inicioTrimestre - 3, 1);
      } else {
        inicioAtual.setMonth(0, 1); // 1º de janeiro
        inicioAnterior.setFullYear(inicioAnterior.getFullYear() - 1, 0, 1);
      }

      // Receita Total
      const receitaAtual = await db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${faturas.valorTotal} AS DECIMAL)), 0)`,
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            gte(faturas.dataFatura, inicioAtual),
            lte(faturas.dataFatura, hoje)
          )
        );

      const receitaAnterior = await db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${faturas.valorTotal} AS DECIMAL)), 0)`,
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            gte(faturas.dataFatura, inicioAnterior),
            lte(faturas.dataFatura, inicioAtual)
          )
        );

      const receitaTotal = Number(receitaAtual[0]?.total || 0);
      const receitaTotalAnterior = Number(receitaAnterior[0]?.total || 0);
      const variacaoReceita = receitaTotalAnterior > 0 
        ? ((receitaTotal - receitaTotalAnterior) / receitaTotalAnterior) * 100 
        : 0;

      // Consultas Realizadas
      const consultasAtual = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAtual),
            lte(consultas.horaInicio, hoje)
          )
        );

      const consultasAnterior = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAnterior),
            lte(consultas.horaInicio, inicioAtual)
          )
        );

      const totalConsultas = Number(consultasAtual[0]?.count || 0);
      const totalConsultasAnterior = Number(consultasAnterior[0]?.count || 0);
      const variacaoConsultas = totalConsultasAnterior > 0
        ? ((totalConsultas - totalConsultasAnterior) / totalConsultasAnterior) * 100
        : 0;

      // Novos Clientes
      const novosClientesAtual = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(utentes)
        .where(
          and(
            eq(utentes.clinicaId, clinicaId),
            gte(utentes.createdAt, inicioAtual),
            lte(utentes.createdAt, hoje)
          )
        );

      const novosClientesAnterior = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(utentes)
        .where(
          and(
            eq(utentes.clinicaId, clinicaId),
            gte(utentes.createdAt, inicioAnterior),
            lte(utentes.createdAt, inicioAtual)
          )
        );

      const novosClientes = Number(novosClientesAtual[0]?.count || 0);
      const novosClientesAnteriores = Number(novosClientesAnterior[0]?.count || 0);
      const variacaoNovosClientes = novosClientesAnteriores > 0
        ? ((novosClientes - novosClientesAnteriores) / novosClientesAnteriores) * 100
        : 0;

      // Ticket Médio
      const ticketMedio = totalConsultas > 0 ? receitaTotal / totalConsultas : 0;
      const ticketMedioAnterior = totalConsultasAnterior > 0 
        ? receitaTotalAnterior / totalConsultasAnterior 
        : 0;
      const variacaoTicketMedio = ticketMedioAnterior > 0
        ? ((ticketMedio - ticketMedioAnterior) / ticketMedioAnterior) * 100
        : 0;

      // Faturas Pendentes
      const faturasPendentes = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            eq(faturas.estado, "pendente")
          )
        );

      // Taxa de Retenção (clientes que voltaram vs novos clientes)
      const clientesComMultiplasConsultas = await db
        .select({ 
          count: sql<number>`COUNT(DISTINCT ${consultas.utenteId})` 
        })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAtual),
            lte(consultas.horaInicio, hoje)
          )
        )
        .groupBy(consultas.utenteId)
        .having(sql`COUNT(*) > 1`);

      const totalClientesAtivos = await db
        .select({ 
          count: sql<number>`COUNT(DISTINCT ${consultas.utenteId})` 
        })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAtual),
            lte(consultas.horaInicio, hoje)
          )
        );

      const taxaRetencaoAtual = Number(totalClientesAtivos[0]?.count || 0) > 0
        ? (clientesComMultiplasConsultas.length / Number(totalClientesAtivos[0]?.count)) * 100
        : 0;

      // Taxa de No-Show (consultas marcadas mas não realizadas)
      const consultasMarcadas = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAtual),
            lte(consultas.horaInicio, hoje)
          )
        );

      const consultasCanceladas = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            eq(consultas.estado, "cancelada"),
            gte(consultas.horaInicio, inicioAtual),
            lte(consultas.horaInicio, hoje)
          )
        );

      const totalMarcadas = Number(consultasMarcadas[0]?.count || 0);
      const totalCanceladas = Number(consultasCanceladas[0]?.count || 0);
      const taxaNoShowAtual = totalMarcadas > 0 ? (totalCanceladas / totalMarcadas) * 100 : 0;

      // Calcular variações dos períodos anteriores
      const consultasMarcardasAnterior = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioAnterior),
            lte(consultas.horaInicio, inicioAtual)
          )
        );

      const consultasCanceladasAnterior = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            eq(consultas.estado, "cancelada"),
            gte(consultas.horaInicio, inicioAnterior),
            lte(consultas.horaInicio, inicioAtual)
          )
        );

      const totalMarcadasAnterior = Number(consultasMarcardasAnterior[0]?.count || 0);
      const totalCanceladasAnterior = Number(consultasCanceladasAnterior[0]?.count || 0);
      const taxaNoShowAnterior = totalMarcadasAnterior > 0 
        ? (totalCanceladasAnterior / totalMarcadasAnterior) * 100 
        : 0;
      
      const variacaoNoShow = taxaNoShowAnterior > 0
        ? ((taxaNoShowAtual - taxaNoShowAnterior) / taxaNoShowAnterior) * 100
        : 0;

      return {
        receitaTotal: {
          valor: receitaTotal,
          variacao: variacaoReceita,
          meta: 50000,
        },
        consultasRealizadas: {
          valor: totalConsultas,
          variacao: variacaoConsultas,
          meta: 250,
        },
        novosClientes: {
          valor: novosClientes,
          variacao: variacaoNovosClientes,
          meta: 50,
        },
        ticketMedio: {
          valor: ticketMedio,
          variacao: variacaoTicketMedio,
          meta: 180,
        },
        taxaRetencao: {
          valor: Number(taxaRetencaoAtual.toFixed(1)),
          variacao: 0, // Variação requer histórico de múltiplos períodos
          meta: 85,
        },
        taxaNoShow: {
          valor: Number(taxaNoShowAtual.toFixed(1)),
          variacao: Number(variacaoNoShow.toFixed(1)),
          meta: 5,
        },
        satisfacaoCliente: {
          valor: 0, // Requer sistema de avaliações (não implementado na BD)
          variacao: 0,
          meta: 4.5,
          nota: "Sistema de avaliações pendente de implementação",
        },
        margemLucro: {
          valor: 0, // Requer tabela de custos operacionais (não implementada na BD)
          variacao: 0,
          meta: 30,
          nota: "Sistema de controlo de custos pendente de implementação",
        },
        faturasPendentes: {
          valor: Number(faturasPendentes[0]?.count || 0),
        },
      };
    }),

  /**
   * Obter evolução da receita (mensal, semanal, diária)
   */
  evolucaoReceita: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      granularidade: z.enum(["diaria", "semanal", "mensal"]).default("mensal"),
      meses: z.number().default(6),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { clinicaId, granularidade, meses } = input;

      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - meses);

      const resultado = await db
        .select({
          periodo: sql<string>`DATE_FORMAT(${faturas.dataFatura}, '%Y-%m')`,
          receita: sql<number>`COALESCE(SUM(CAST(${faturas.valorTotal} AS DECIMAL)), 0)`,
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            gte(faturas.dataFatura, dataInicio)
          )
        )
        .groupBy(sql`DATE_FORMAT(${faturas.dataFatura}, '%Y-%m')`)
        .orderBy(sql`DATE_FORMAT(${faturas.dataFatura}, '%Y-%m')`);

      return resultado.map(r => ({
        periodo: r.periodo,
        receita: Number(r.receita),
        meta: 50000, // Mock - implementar metas configuráveis
      }));
    }),

  /**
   * Obter procedimentos mais rentáveis
   */
  procedimentosRentaveis: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      limite: z.number().default(5),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { clinicaId, limite } = input;

      // Buscar procedimentos com receita total
      const resultado = await db
        .select({
          id: procedimentos.id,
          nome: procedimentos.nome,
          precoBase: procedimentos.precoBase,
          quantidade: sql<number>`COUNT(*)`,
          receitaTotal: sql<number>`COALESCE(SUM(CAST(${procedimentos.precoBase} AS DECIMAL)), 0)`,
        })
        .from(procedimentos)
        .where(eq(procedimentos.clinicaId, clinicaId))
        .groupBy(procedimentos.id, procedimentos.nome, procedimentos.precoBase)
        .orderBy(desc(sql`COALESCE(SUM(CAST(${procedimentos.precoBase} AS DECIMAL)), 0)`))
        .limit(limite);

      return resultado.map(proc => ({
        id: proc.id,
        nome: proc.nome,
        quantidade: Number(proc.quantidade),
        receita: Number(proc.receitaTotal),
        custo: Number(proc.receitaTotal) * 0.5, // Mock - 50% de custo
        lucro: Number(proc.receitaTotal) * 0.5,
        margem: 50, // Mock - implementar cálculo real
        euroPorHora: Number(proc.precoBase) / 1, // Mock - assumindo 1h por procedimento
      }));
    }),

  /**
   * Obter insights inteligentes gerados por IA
   */
  insights: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Mock de insights - implementar integração com IA real
      return [
        {
          id: 1,
          prioridade: "alto",
          tipo: "oportunidade",
          titulo: "Horário de Pico Subutilizado",
          descricao: "O horário das 14:00 tem alta demanda mas baixa ocupação. Considere adicionar mais dentistas.",
          acaoSugerida: "Otimizar agenda",
          link: "/agenda",
        },
        {
          id: 2,
          prioridade: "medio",
          tipo: "alerta",
          titulo: "Taxa de No-Show Aumentando",
          descricao: "Taxa de faltas subiu 15% nas últimas 2 semanas. Implementar lembretes automáticos.",
          acaoSugerida: "Configurar lembretes",
          link: "/configuracoes",
        },
        {
          id: 3,
          prioridade: "positivo",
          tipo: "sucesso",
          titulo: "Meta de Satisfação Atingida",
          descricao: "Satisfação do cliente atingiu 4.7/5, superando a meta de 4.5.",
          acaoSugerida: "Manter qualidade",
          link: "/dashboard",
        },
      ];
    }),
});

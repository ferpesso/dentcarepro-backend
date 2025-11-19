import { getDb } from "./db";
import { faturas, consultas, procedimentos } from "../drizzle/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";

/**
 * Obter dados para gráfico de receita mensal
 */
export async function getReceitaMensal(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db
    .select({
      mes: sql<string>`DATE_FORMAT(${faturas.dataVencimento}, '%Y-%m')`,
      valor: sql<number>`SUM(${faturas.valorTotal})`,
    })
    .from(faturas)
    .where(
      and(
        eq(faturas.clinicaId, clinicaId),
        gte(faturas.dataVencimento, sql`DATE_SUB(NOW(), INTERVAL 6 MONTH)`)
      )
    )
    .groupBy(sql`DATE_FORMAT(${faturas.dataVencimento}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${faturas.dataVencimento}, '%Y-%m')`);

  return resultado.map((r) => ({
    mes: r.mes,
    valor: parseFloat(r.valor?.toString() || "0"),
  }));
}

/**
 * Obter dados para gráfico de consultas por mês
 */
export async function getConsultasPorMes(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db
    .select({
      mes: sql<string>`DATE_FORMAT(${consultas.horaInicio}, '%Y-%m')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(consultas)
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        gte(consultas.horaInicio, sql`DATE_SUB(NOW(), INTERVAL 6 MONTH)`)
      )
    )
    .groupBy(sql`DATE_FORMAT(${consultas.horaInicio}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${consultas.horaInicio}, '%Y-%m')`);

  return resultado.map((c) => ({
    mes: c.mes,
    total: parseInt(c.total?.toString() || "0"),
  }));
}

/**
 * Obter procedimentos mais realizados
 */
export async function getProcedimentosMaisRealizados(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db
    .select({
      nome: procedimentos.nome,
      quantidade: sql<number>`COUNT(${consultas.id})`,
    })
    .from(consultas)
    .leftJoin(procedimentos, eq(consultas.procedimentoId, procedimentos.id))
    .where(
      and(
        eq(consultas.clinicaId, clinicaId),
        isNotNull(consultas.procedimentoId)
      )
    )
    .groupBy(procedimentos.nome)
    .orderBy(sql`COUNT(${consultas.id}) DESC`)
    .limit(5);

  return resultado.map((p) => ({
    nome: p.nome || "Sem procedimento",
    quantidade: parseInt(p.quantidade?.toString() || "0"),
  }));
}

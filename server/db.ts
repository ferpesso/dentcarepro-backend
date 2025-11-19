import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { 
  InsertUser, 
  users,
  clinicas,
  utentes,
  dentistas,
  consultas,
  procedimentos,
  categoriasProcedimento,
  faturas,
  itensFatura,
  pagamentosFatura,
  planosAssinatura,
  assinaturasClinica,
  historicoMedico,
  configuracoesFinanceiras,
  templatesMensagem,
  mensagensUtente,
  utilizadoresClinica,
  registosClinica,
  pagamentos,
  metricasUso
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// AUTENTICAÇÃO
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["nome", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// CLÍNICAS
// ============================================

export async function getClinicasByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      clinica: clinicas,
      role: utilizadoresClinica.role,
    })
    .from(utilizadoresClinica)
    .innerJoin(clinicas, eq(utilizadoresClinica.clinicaId, clinicas.id))
    .where(and(
      eq(utilizadoresClinica.userId, userId),
      eq(utilizadoresClinica.ativo, true)
    ));
}

export async function getClinicaById(clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(clinicas).where(eq(clinicas.id, clinicaId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================
// UTENTES (PACIENTES)
// ============================================

export async function getUtentesByClinica(clinicaId: number, searchTerm?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(utentes.clinicaId, clinicaId)];

  if (searchTerm) {
    conditions.push(
      or(
        like(utentes.nome, `%${searchTerm}%`),
        like(utentes.email, `%${searchTerm}%`),
        like(utentes.telemovel, `%${searchTerm}%`),
        like(utentes.numeroUtente, `%${searchTerm}%`)
      )!
    );
  }

  return await db
    .select()
    .from(utentes)
    .where(and(...conditions))
    .orderBy(desc(utentes.createdAt));
}

export async function getUtenteById(utenteId: number, clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(utentes)
    .where(and(
      eq(utentes.id, utenteId),
      eq(utentes.clinicaId, clinicaId)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getHistoricoMedicoByUtente(utenteId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(historicoMedico)
    .where(eq(historicoMedico.utenteId, utenteId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ============================================
// DENTISTAS
// ============================================

export async function getDentistasByClinica(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(dentistas)
    .where(eq(dentistas.clinicaId, clinicaId))
    .orderBy(dentistas.nome);
}

export async function getDentistaById(dentistaId: number, clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(dentistas)
    .where(and(
      eq(dentistas.id, dentistaId),
      eq(dentistas.clinicaId, clinicaId)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ============================================
// PROCEDIMENTOS
// ============================================

export async function getProcedimentosByClinica(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      procedimento: procedimentos,
      categoria: categoriasProcedimento,
    })
    .from(procedimentos)
    .leftJoin(categoriasProcedimento, eq(procedimentos.categoriaId, categoriasProcedimento.id))
    .where(eq(procedimentos.clinicaId, clinicaId))
    .orderBy(procedimentos.nome);
}

export async function getCategoriasProcedimentoByClinica(clinicaId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(categoriasProcedimento)
    .where(eq(categoriasProcedimento.clinicaId, clinicaId))
    .orderBy(categoriasProcedimento.nome);
}

// ============================================
// CONSULTAS
// ============================================

export async function getConsultasByPeriod(
  clinicaId: number,
  startDate: Date,
  endDate: Date,
  dentistaId?: number
) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [
    eq(consultas.clinicaId, clinicaId),
    gte(consultas.horaInicio, startDate),
    lte(consultas.horaInicio, endDate)
  ];

  if (dentistaId) {
    conditions.push(eq(consultas.dentistaId, dentistaId));
  }

  return await db
    .select({
      consulta: consultas,
      utente: utentes,
      dentista: dentistas,
      procedimento: procedimentos,
    })
    .from(consultas)
    .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
    .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
    .leftJoin(procedimentos, eq(consultas.procedimentoId, procedimentos.id))
    .where(and(...conditions))
    .orderBy(consultas.horaInicio);
}

export async function getConsultaById(consultaId: number, clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      consulta: consultas,
      utente: utentes,
      dentista: dentistas,
      procedimento: procedimentos,
    })
    .from(consultas)
    .innerJoin(utentes, eq(consultas.utenteId, utentes.id))
    .innerJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
    .leftJoin(procedimentos, eq(consultas.procedimentoId, procedimentos.id))
    .where(and(
      eq(consultas.id, consultaId),
      eq(consultas.clinicaId, clinicaId)
    ))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ============================================
// FATURAS
// ============================================

export async function getFaturasByClinica(clinicaId: number, utenteId?: number) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(faturas.clinicaId, clinicaId)];
  
  if (utenteId) {
    conditions.push(eq(faturas.utenteId, utenteId));
  }

  return await db
    .select({
      fatura: faturas,
      utente: utentes,
    })
    .from(faturas)
    .innerJoin(utentes, eq(faturas.utenteId, utentes.id))
    .where(and(...conditions))
    .orderBy(desc(faturas.dataFatura));
}

export async function getFaturaById(faturaId: number, clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      fatura: faturas,
      utente: utentes,
    })
    .from(faturas)
    .innerJoin(utentes, eq(faturas.utenteId, utentes.id))
    .where(and(
      eq(faturas.id, faturaId),
      eq(faturas.clinicaId, clinicaId)
    ))
    .limit(1);

  if (result.length === 0) return null;

  // Buscar itens da fatura
  const itens = await db
    .select()
    .from(itensFatura)
    .where(eq(itensFatura.faturaId, faturaId));

  // Buscar pagamentos da fatura
  const pagamentosResult = await db
    .select()
    .from(pagamentosFatura)
    .where(eq(pagamentosFatura.faturaId, faturaId))
    .orderBy(desc(pagamentosFatura.dataPagamento));

  return {
    ...result[0],
    itens,
    pagamentos: pagamentosResult,
  };
}

// ============================================
// PLANOS E ASSINATURAS (SAAS)
// ============================================

export async function getPlanosAssinatura() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(planosAssinatura)
    .where(eq(planosAssinatura.ativo, true))
    .orderBy(planosAssinatura.precoMensal);
}

export async function getAssinaturaByClinica(clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      assinatura: assinaturasClinica,
      plano: planosAssinatura,
    })
    .from(assinaturasClinica)
    .innerJoin(planosAssinatura, eq(assinaturasClinica.planoId, planosAssinatura.id))
    .where(eq(assinaturasClinica.clinicaId, clinicaId))
    .orderBy(desc(assinaturasClinica.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getMetricasUsoByClinica(clinicaId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(metricasUso)
    .where(and(
      eq(metricasUso.clinicaId, clinicaId),
      gte(metricasUso.inicioPeriodo, startDate),
      lte(metricasUso.fimPeriodo, endDate)
    ))
    .orderBy(desc(metricasUso.inicioPeriodo))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ============================================
// ESTATÍSTICAS E DASHBOARD
// ============================================

export async function getDashboardStats(clinicaId: number) {
  const db = await getDb();
  if (!db) return null;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  // Total de utentes ativos
  const totalUtentes = await db
    .select({ count: sql<number>`count(*)` })
    .from(utentes)
    .where(and(
      eq(utentes.clinicaId, clinicaId),
      eq(utentes.ativo, true)
    ));

  // Consultas do mês
  const consultasMes = await db
    .select({ count: sql<number>`count(*)` })
    .from(consultas)
    .where(and(
      eq(consultas.clinicaId, clinicaId),
      gte(consultas.horaInicio, inicioMes),
      lte(consultas.horaInicio, fimMes)
    ));

  // Receita do mês
  const receitaMes = await db
    .select({ total: sql<string>`COALESCE(SUM(${faturas.valorTotal}), 0)` })
    .from(faturas)
    .where(and(
      eq(faturas.clinicaId, clinicaId),
      gte(faturas.dataFatura, inicioMes),
      lte(faturas.dataFatura, fimMes),
      eq(faturas.estado, 'paga')
    ));

  // Faturas pendentes
  const faturasPendentes = await db
    .select({ count: sql<number>`count(*)` })
    .from(faturas)
    .where(and(
      eq(faturas.clinicaId, clinicaId),
      or(
        eq(faturas.estado, 'enviada'),
        eq(faturas.estado, 'parcialmente_paga'),
        eq(faturas.estado, 'vencida')
      )
    ));

  return {
    totalUtentes: totalUtentes[0]?.count || 0,
    consultasMes: consultasMes[0]?.count || 0,
    receitaMes: parseFloat(receitaMes[0]?.total || '0'),
    faturasPendentes: faturasPendentes[0]?.count || 0,
  };
}

import { getDb } from "./db";
import {
  auditLogs,
  dataAccessLogs,
  consentimentos,
  pedidosDireitosRGPD,
  violacoesDados,
  exportacoesDados,
} from "../drizzle/schema-audit";
import { eq, and, gte, lte, desc } from "drizzle-orm";

/**
 * Serviço de Auditoria RGPD
 * Conformidade com Regulamento Geral de Proteção de Dados (UE)
 */

interface AuditContext {
  userId: number;
  userName?: string;
  userRole?: string;
  clinicaId?: number;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Registar ação geral no sistema
   */
  static async logAction(params: {
    context: AuditContext;
    action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "PRINT" | "LOGIN" | "LOGOUT";
    entity: string;
    entityId?: number;
    description?: string;
    changes?: any;
    metadata?: any;
    dataCategory?: "personal" | "medical" | "financial" | "system";
    legalBasis?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      await db.insert(auditLogs).values({
        userId: params.context.userId,
        userName: params.context.userName,
        userRole: params.context.userRole,
        clinicaId: params.context.clinicaId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        description: params.description,
        changes: params.changes,
        metadata: params.metadata,
        ipAddress: params.context.ipAddress,
        userAgent: params.context.userAgent,
        dataCategory: params.dataCategory,
        legalBasis: params.legalBasis,
      });
    } catch (error) {
      // Não falhar a operação principal se auditoria falhar
      console.error("[Audit] Erro ao registar ação:", error);
    }
  }

  /**
   * Registar acesso a dados sensíveis
   * RGPD: demonstrar quem acedeu a dados pessoais/médicos
   */
  static async logDataAccess(params: {
    context: AuditContext;
    dataType: "utente_data" | "medical_history" | "financial_data" | "consultation_notes";
    dataOwnerId: number;
    dataOwnerName?: string;
    accessReason?: string;
    accessType: "view" | "edit" | "export" | "print";
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      await db.insert(dataAccessLogs).values({
        userId: params.context.userId,
        userName: params.context.userName,
        userRole: params.context.userRole,
        dataType: params.dataType,
        dataOwnerId: params.dataOwnerId,
        dataOwnerName: params.dataOwnerName,
        accessReason: params.accessReason,
        accessType: params.accessType,
        ipAddress: params.context.ipAddress,
      });
    } catch (error) {
      console.error("[Audit] Erro ao registar acesso a dados:", error);
    }
  }

  /**
   * Registar consentimento do utente
   */
  static async registarConsentimento(params: {
    utenteId: number;
    clinicaId: number;
    tipo: string;
    finalidade: string;
    consentido: boolean;
    formaConsentimento?: string;
    evidencia?: any;
    dataExpiracao?: Date;
    versaoTermos?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [result] = await db.insert(consentimentos).values({
      utenteId: params.utenteId,
      clinicaId: params.clinicaId,
      tipo: params.tipo,
      finalidade: params.finalidade,
      consentido: params.consentido,
      dataConsentimento: new Date(),
      formaConsentimento: params.formaConsentimento,
      evidencia: params.evidencia,
      dataExpiracao: params.dataExpiracao,
      versaoTermos: params.versaoTermos,
    });

    return result;
  }

  /**
   * Revogar consentimento
   */
  static async revogarConsentimento(consentimentoId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(consentimentos)
      .set({
        revogado: true,
        dataRevogacao: new Date(),
      })
      .where(eq(consentimentos.id, consentimentoId));
  }

  /**
   * Verificar se utente tem consentimento ativo
   */
  static async verificarConsentimento(
    utenteId: number,
    tipo: string
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db
      .select()
      .from(consentimentos)
      .where(
        and(
          eq(consentimentos.utenteId, utenteId),
          eq(consentimentos.tipo, tipo),
          eq(consentimentos.consentido, true),
          eq(consentimentos.revogado, false)
        )
      )
      .limit(1);

    if (!resultado.length) return false;

    const consentimento = resultado[0];

    // Verificar se expirou
    if (
      consentimento.dataExpiracao &&
      new Date(consentimento.dataExpiracao) < new Date()
    ) {
      return false;
    }

    return true;
  }

  /**
   * Criar pedido de direito RGPD
   * Prazo: 30 dias para responder
   */
  static async criarPedidoDireito(params: {
    utenteId: number;
    utenteNome: string;
    utenteEmail: string;
    clinicaId: number;
    tipoDireito:
      | "access"
      | "rectification"
      | "erasure"
      | "portability"
      | "restriction"
      | "objection";
    descricao?: string;
    dadosEspecificos?: any;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Calcular prazo (30 dias)
    const dataPrazo = new Date();
    dataPrazo.setDate(dataPrazo.getDate() + 30);

    const [result] = await db.insert(pedidosDireitosRGPD).values({
      utenteId: params.utenteId,
      utenteNome: params.utenteNome,
      utenteEmail: params.utenteEmail,
      clinicaId: params.clinicaId,
      tipoDireito: params.tipoDireito,
      descricao: params.descricao,
      dadosEspecificos: params.dadosEspecificos,
      status: "pendente",
      dataPrazo,
    });

    return result;
  }

  /**
   * Processar pedido de direito RGPD
   */
  static async processarPedidoDireito(params: {
    pedidoId: number;
    processadoPor: number;
    processadoPorNome: string;
    status: "em_analise" | "aprovado" | "rejeitado" | "concluido";
    resposta?: string;
    acaoTomada?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const updates: any = {
      status: params.status,
      dataProcessamento: new Date(),
      processadoPor: params.processadoPor,
      processadoPorNome: params.processadoPorNome,
      resposta: params.resposta,
      acaoTomada: params.acaoTomada,
    };

    if (params.status === "concluido") {
      updates.dataConclusao = new Date();
    }

    await db
      .update(pedidosDireitosRGPD)
      .set(updates)
      .where(eq(pedidosDireitosRGPD.id, params.pedidoId));
  }

  /**
   * Listar pedidos pendentes (próximos do prazo)
   */
  static async listarPedidosPendentes(clinicaId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db
      .select()
      .from(pedidosDireitosRGPD)
      .where(
        and(
          eq(pedidosDireitosRGPD.clinicaId, clinicaId),
          eq(pedidosDireitosRGPD.status, "pendente")
        )
      )
      .orderBy(pedidosDireitosRGPD.dataPrazo);
  }

  /**
   * Registar violação de dados (Data Breach)
   * RGPD: notificar autoridade em 72h se risco alto
   */
  static async registarViolacao(params: {
    clinicaId: number;
    tipo: string;
    descricao: string;
    dataOcorrencia: Date;
    dataDetecao: Date;
    dadosAfetados?: any;
    numeroUtentesAfetados?: number;
    utenteIds?: number[];
    gravidade: "baixa" | "media" | "alta" | "critica";
    riscoTitulares?: string;
    medidasImediatas?: string;
    reportadoPor: number;
    reportadoPorNome: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Gerar referência única
    const referencia = `BREACH-${Date.now()}-${params.clinicaId}`;

    const [result] = await db.insert(violacoesDados).values({
      referencia,
      clinicaId: params.clinicaId,
      tipo: params.tipo,
      descricao: params.descricao,
      dataOcorrencia: params.dataOcorrencia,
      dataDetecao: params.dataDetecao,
      dadosAfetados: params.dadosAfetados,
      numeroUtentesAfetados: params.numeroUtentesAfetados,
      utenteIds: params.utenteIds,
      gravidade: params.gravidade,
      riscoTitulares: params.riscoTitulares,
      medidasImediatas: params.medidasImediatas,
      reportadoPor: params.reportadoPor,
      reportadoPorNome: params.reportadoPorNome,
      status: "aberto",
    });

    // Se gravidade alta/crítica, alertar para notificar autoridade em 72h
    if (params.gravidade === "alta" || params.gravidade === "critica") {
      console.warn(
        `[RGPD] VIOLAÇÃO CRÍTICA: ${referencia} - Notificar CNPD em 72 horas!`
      );
    }

    return result;
  }

  /**
   * Registar exportação de dados
   */
  static async registarExportacao(params: {
    context: AuditContext;
    tipoExportacao: string;
    utenteId?: number;
    clinicaId?: number;
    formato?: string;
    filtros?: any;
    numeroRegistos?: number;
    tamanhoArquivo?: number;
    finalidade?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      await db.insert(exportacoesDados).values({
        userId: params.context.userId,
        userName: params.context.userName,
        tipoExportacao: params.tipoExportacao,
        utenteId: params.utenteId,
        clinicaId: params.clinicaId,
        formato: params.formato,
        filtros: params.filtros,
        numeroRegistos: params.numeroRegistos,
        tamanhoArquivo: params.tamanhoArquivo,
        finalidade: params.finalidade,
        ipAddress: params.context.ipAddress,
      });
    } catch (error) {
      console.error("[Audit] Erro ao registar exportação:", error);
    }
  }

  /**
   * Obter histórico de auditoria
   */
  static async obterHistorico(params: {
    clinicaId?: number;
    userId?: number;
    entity?: string;
    entityId?: number;
    dataInicio?: Date;
    dataFim?: Date;
    limite?: number;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = db.select().from(auditLogs);

    const conditions = [];

    if (params.clinicaId) {
      conditions.push(eq(auditLogs.clinicaId, params.clinicaId));
    }

    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId));
    }

    if (params.entity) {
      conditions.push(eq(auditLogs.entity, params.entity));
    }

    if (params.entityId) {
      conditions.push(eq(auditLogs.entityId, params.entityId));
    }

    if (params.dataInicio) {
      conditions.push(gte(auditLogs.timestamp, params.dataInicio));
    }

    if (params.dataFim) {
      conditions.push(lte(auditLogs.timestamp, params.dataFim));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditLogs.timestamp)) as any;

    if (params.limite) {
      query = query.limit(params.limite) as any;
    }

    return await query;
  }

  /**
   * Obter acessos a dados de um utente específico
   * Útil para responder a pedidos de acesso RGPD
   */
  static async obterAcessosUtente(utenteId: number, limite: number = 100) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return await db
      .select()
      .from(dataAccessLogs)
      .where(eq(dataAccessLogs.dataOwnerId, utenteId))
      .orderBy(desc(dataAccessLogs.timestamp))
      .limit(limite);
  }

  /**
   * Gerar relatório de conformidade RGPD
   */
  static async gerarRelatorioConformidade(clinicaId: number, periodo: {
    inicio: Date;
    fim: Date;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Contar ações por tipo
    const acoes = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.clinicaId, clinicaId),
          gte(auditLogs.timestamp, periodo.inicio),
          lte(auditLogs.timestamp, periodo.fim)
        )
      );

    // Contar acessos a dados sensíveis
    const acessos = await db
      .select()
      .from(dataAccessLogs)
      .where(
        and(
          gte(dataAccessLogs.timestamp, periodo.inicio),
          lte(dataAccessLogs.timestamp, periodo.fim)
        )
      );

    // Pedidos de direitos RGPD
    const pedidos = await db
      .select()
      .from(pedidosDireitosRGPD)
      .where(
        and(
          eq(pedidosDireitosRGPD.clinicaId, clinicaId),
          gte(pedidosDireitosRGPD.dataPedido, periodo.inicio),
          lte(pedidosDireitosRGPD.dataPedido, periodo.fim)
        )
      );

    // Violações
    const violacoes = await db
      .select()
      .from(violacoesDados)
      .where(
        and(
          eq(violacoesDados.clinicaId, clinicaId),
          gte(violacoesDados.dataDetecao, periodo.inicio),
          lte(violacoesDados.dataDetecao, periodo.fim)
        )
      );

    return {
      periodo,
      totalAcoes: acoes.length,
      acoesPorTipo: this.contarPorCampo(acoes, "action"),
      totalAcessosDadosSensiveis: acessos.length,
      acessosPorTipo: this.contarPorCampo(acessos, "dataType"),
      pedidosDireitos: {
        total: pedidos.length,
        porTipo: this.contarPorCampo(pedidos, "tipoDireito"),
        porStatus: this.contarPorCampo(pedidos, "status"),
        dentroPrazo: pedidos.filter(p => !p.dataConclusao || p.dataConclusao <= p.dataPrazo).length,
      },
      violacoes: {
        total: violacoes.length,
        porGravidade: this.contarPorCampo(violacoes, "gravidade"),
        notificadasAutoridade: violacoes.filter(v => v.notificadoAutoridade).length,
      },
    };
  }

  /**
   * Helper para contar registos por campo
   */
  private static contarPorCampo(dados: any[], campo: string): Record<string, number> {
    return dados.reduce((acc, item) => {
      const valor = item[campo] || "indefinido";
      acc[valor] = (acc[valor] || 0) + 1;
      return acc;
    }, {});
  }
}

export default AuditService;

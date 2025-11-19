import { pgTable, serial, integer, varchar, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

/**
 * SISTEMA DE AUDITORIA RGPD
 * Conformidade com Regulamento Geral de Proteção de Dados (UE)
 * 
 * Requisitos RGPD:
 * - Registar todos os acessos a dados pessoais
 * - Registar todas as modificações de dados
 * - Registar exercício de direitos dos titulares
 * - Manter logs por pelo menos 2 anos
 * - Permitir auditoria completa
 */

/**
 * Tabela principal de auditoria
 * Regista todas as ações no sistema
 */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  
  // Quem fez a ação
  userId: integer("user_id").notNull(), // ID do utilizador que executou
  userName: varchar("user_name", { length: 255 }), // Nome para referência
  userRole: varchar("user_role", { length: 50 }), // Função do utilizador
  
  // Contexto da ação
  clinicaId: integer("clinica_id"), // Clínica relacionada
  
  // O que foi feito
  action: varchar("action", { length: 50 }).notNull(), // CREATE, READ, UPDATE, DELETE, EXPORT, etc.
  entity: varchar("entity", { length: 50 }).notNull(), // utentes, consultas, faturas, etc.
  entityId: integer("entity_id"), // ID do registo afetado
  
  // Detalhes da ação
  description: text("description"), // Descrição legível
  changes: jsonb("changes"), // Dados antes/depois (para UPDATE)
  metadata: jsonb("metadata"), // Informações adicionais
  
  // Dados técnicos
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 ou IPv6
  userAgent: text("user_agent"), // Browser/dispositivo
  
  // Conformidade RGPD
  dataCategory: varchar("data_category", { length: 50 }), // personal, medical, financial
  legalBasis: varchar("legal_basis", { length: 100 }), // consent, contract, legal_obligation, etc.
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

/**
 * Tabela de acessos a dados sensíveis
 * Regista especificamente acessos a dados pessoais/médicos
 * Requisito RGPD: demonstrar quem acedeu a que dados e quando
 */
export const dataAccessLogs = pgTable("data_access_logs", {
  id: serial("id").primaryKey(),
  
  // Quem acedeu
  userId: integer("user_id").notNull(),
  userName: varchar("user_name", { length: 255 }),
  userRole: varchar("user_role", { length: 50 }),
  
  // O que foi acedido
  dataType: varchar("data_type", { length: 50 }).notNull(), // utente_data, medical_history, financial_data
  dataOwnerId: integer("data_owner_id").notNull(), // ID do utente dono dos dados
  dataOwnerName: varchar("data_owner_name", { length: 255 }), // Nome do utente
  
  // Contexto
  accessReason: text("access_reason"), // Motivo do acesso
  accessType: varchar("access_type", { length: 20 }).notNull(), // view, edit, export, print
  
  // Dados técnicos
  ipAddress: varchar("ip_address", { length: 45 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

/**
 * Tabela de consentimentos RGPD
 * Regista consentimentos dados pelos utentes
 */
export const consentimentos = pgTable("consentimentos", {
  id: serial("id").primaryKey(),
  
  // Utente
  utenteId: integer("utente_id").notNull(),
  clinicaId: integer("clinica_id").notNull(),
  
  // Tipo de consentimento
  tipo: varchar("tipo", { length: 100 }).notNull(), // tratamento_dados, comunicacoes_marketing, partilha_seguradoras, etc.
  finalidade: text("finalidade").notNull(), // Descrição da finalidade
  
  // Status
  consentido: boolean("consentido").notNull(), // true = consentiu, false = recusou
  dataConsentimento: timestamp("data_consentimento").notNull(),
  
  // Revogação
  revogado: boolean("revogado").default(false),
  dataRevogacao: timestamp("data_revogacao"),
  
  // Evidência
  formaConsentimento: varchar("forma_consentimento", { length: 50 }), // digital, escrito, verbal
  evidencia: jsonb("evidencia"), // Dados da evidência (assinatura digital, etc.)
  
  // Validade
  dataExpiracao: timestamp("data_expiracao"), // Alguns consentimentos expiram
  
  // Metadata
  versaoTermos: varchar("versao_termos", { length: 20 }), // Versão dos termos aceites
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Tabela de pedidos de direitos RGPD
 * Regista pedidos dos titulares de dados (utentes)
 * 
 * Direitos RGPD:
 * - Direito de acesso (ver seus dados)
 * - Direito de retificação (corrigir dados)
 * - Direito ao esquecimento (eliminar dados)
 * - Direito à portabilidade (exportar dados)
 * - Direito de oposição (opor-se ao tratamento)
 */
export const pedidosDireitosRGPD = pgTable("pedidos_direitos_rgpd", {
  id: serial("id").primaryKey(),
  
  // Utente solicitante
  utenteId: integer("utente_id").notNull(),
  utenteNome: varchar("utente_nome", { length: 255 }),
  utenteEmail: varchar("utente_email", { length: 255 }),
  
  // Clínica
  clinicaId: integer("clinica_id").notNull(),
  
  // Tipo de pedido
  tipoDireito: varchar("tipo_direito", { length: 50 }).notNull(), 
  // access, rectification, erasure, portability, restriction, objection
  
  // Detalhes
  descricao: text("descricao"), // Descrição do pedido
  dadosEspecificos: jsonb("dados_especificos"), // Dados específicos solicitados
  
  // Status
  status: varchar("status", { length: 30 }).notNull().default("pendente"), 
  // pendente, em_analise, aprovado, rejeitado, concluido
  
  // Processamento
  dataProcessamento: timestamp("data_processamento"),
  processadoPor: integer("processado_por"), // User ID
  processadoPorNome: varchar("processado_por_nome", { length: 255 }),
  
  // Resposta
  resposta: text("resposta"), // Resposta ao pedido
  acaoTomada: text("acao_tomada"), // Ação realizada
  
  // Prazos RGPD: responder em 30 dias
  dataPedido: timestamp("data_pedido").defaultNow().notNull(),
  dataPrazo: timestamp("data_prazo").notNull(), // 30 dias após pedido
  dataConclusao: timestamp("data_conclusao"),
  
  // Evidências
  documentos: jsonb("documentos"), // URLs de documentos anexados
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Tabela de violações de dados (Data Breaches)
 * RGPD exige notificar autoridade em 72h
 */
export const violacoesDados = pgTable("violacoes_dados", {
  id: serial("id").primaryKey(),
  
  // Identificação
  referencia: varchar("referencia", { length: 50 }).notNull().unique(), // Referência única
  
  // Clínica afetada
  clinicaId: integer("clinica_id").notNull(),
  
  // Detalhes da violação
  tipo: varchar("tipo", { length: 50 }).notNull(), // breach, loss, unauthorized_access, etc.
  descricao: text("descricao").notNull(),
  dataOcorrencia: timestamp("data_ocorrencia").notNull(),
  dataDetecao: timestamp("data_detecao").notNull(),
  
  // Dados afetados
  dadosAfetados: jsonb("dados_afetados"), // Tipos de dados comprometidos
  numeroUtentesAfetados: integer("numero_utentes_afetados"),
  utenteIds: jsonb("utente_ids"), // IDs dos utentes afetados
  
  // Gravidade
  gravidade: varchar("gravidade", { length: 20 }).notNull(), // baixa, media, alta, critica
  riscoTitulares: text("risco_titulares"), // Avaliação de risco para os titulares
  
  // Medidas tomadas
  medidasImediatas: text("medidas_imediatas"),
  medidasPreventivas: text("medidas_preventivas"),
  
  // Notificações RGPD
  notificadoAutoridade: boolean("notificado_autoridade").default(false),
  dataNotificacaoAutoridade: timestamp("data_notificacao_autoridade"),
  
  notificadosTitulares: boolean("notificados_titulares").default(false),
  dataNotificacaoTitulares: timestamp("data_notificacao_titulares"),
  
  // Responsável
  reportadoPor: integer("reportado_por"),
  reportadoPorNome: varchar("reportado_por_nome", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 30 }).notNull().default("aberto"),
  // aberto, em_investigacao, resolvido, notificado
  
  dataResolucao: timestamp("data_resolucao"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Tabela de políticas de retenção de dados
 * RGPD: dados devem ser mantidos apenas pelo tempo necessário
 */
export const politicasRetencao = pgTable("politicas_retencao", {
  id: serial("id").primaryKey(),
  
  // Tipo de dados
  tipoEntidade: varchar("tipo_entidade", { length: 50 }).notNull(), // utentes, consultas, faturas
  categoria: varchar("categoria", { length: 50 }), // personal, medical, financial
  
  // Política
  periodoRetencao: integer("periodo_retencao").notNull(), // Em dias
  motivoRetencao: text("motivo_retencao"), // Obrigação legal, interesse legítimo, etc.
  
  // Ação após expiração
  acaoAposExpiracao: varchar("acao_apos_expiracao", { length: 30 }).notNull(), 
  // anonimizar, arquivar, eliminar
  
  // Status
  ativo: boolean("ativo").default(true),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Tabela de exportações de dados
 * Regista quando dados são exportados (portabilidade RGPD)
 */
export const exportacoesDados = pgTable("exportacoes_dados", {
  id: serial("id").primaryKey(),
  
  // Quem exportou
  userId: integer("user_id").notNull(),
  userName: varchar("user_name", { length: 255 }),
  
  // O que foi exportado
  tipoExportacao: varchar("tipo_exportacao", { length: 50 }).notNull(), 
  // utente_completo, relatorio_consultas, dados_financeiros, etc.
  
  utenteId: integer("utente_id"), // Se for exportação de dados de utente específico
  clinicaId: integer("clinica_id"),
  
  // Detalhes
  formato: varchar("formato", { length: 20 }), // pdf, excel, json, xml
  filtros: jsonb("filtros"), // Filtros aplicados
  
  // Resultado
  numeroRegistos: integer("numero_registos"),
  tamanhoArquivo: integer("tamanho_arquivo"), // Em bytes
  
  // Finalidade
  finalidade: varchar("finalidade", { length: 100 }), // rgpd_portability, backup, auditoria, etc.
  
  // Metadata
  ipAddress: varchar("ip_address", { length: 45 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

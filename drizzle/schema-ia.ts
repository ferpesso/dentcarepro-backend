import { pgTable, serial, integer, varchar, text, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { clinicas, utentes } from "./schema";

/**
 * Schema para Sistema de IA
 * Configurações, análises e insights
 */

// ============================================
// CONFIGURAÇÕES DE IA
// ============================================

export const configuracoesIA = pgTable("configuracoes_ia", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  // Provedor de IA
  provedor: varchar("provedor", { length: 50 }).notNull().default("openai"),
  
  // Chaves API (criptografadas)
  apiKey: text("apiKey").notNull(),
  apiKeySecundaria: text("apiKeySecundaria"), // Backup/fallback
  
  // Modelos
  modeloTexto: varchar("modeloTexto", { length: 100 }).default("gpt-4"),
  modeloVisao: varchar("modeloVisao", { length: 100 }).default("gpt-4-vision-preview"),
  modeloChat: varchar("modeloChat", { length: 100 }).default("gpt-4"),
  
  // Configurações
  temperaturaTexto: integer("temperaturaTexto").default(70), // 0-100 (será dividido por 100)
  temperaturaAnalise: integer("temperaturaAnalise").default(30), // Mais conservador para análises
  maxTokens: integer("maxTokens").default(2000),
  
  // Funcionalidades ativadas
  analiseImagens: boolean("analiseImagens").default(true),
  chatAssistente: boolean("chatAssistente").default(true),
  insightsAutomaticos: boolean("insightsAutomaticos").default(true),
  analisePreditiva: boolean("analisePreditiva").default(true),
  autoPreenchimento: boolean("autoPreenchimento").default(false),
  
  // Limites e controle
  limiteDiario: integer("limiteDiario").default(100), // Requisições por dia
  usoDiario: integer("usoDiario").default(0),
  dataResetUso: timestamp("dataResetUso").defaultNow(),
  
  // Idioma
  idiomaIA: varchar("idiomaIA", { length: 10 }).default("pt"),
  
  // Prompts personalizados
  promptsPersonalizados: jsonb("promptsPersonalizados").$type<{
    analiseImagem?: string;
    diagnostico?: string;
    planoTratamento?: string;
    prescricao?: string;
  }>(),
  
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// ANÁLISES DE IA
// ============================================

export const analisesIA = pgTable("analises_ia", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  utenteId: integer("utenteId").references(() => utentes.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  // Input
  prompt: text("prompt").notNull(),
  imagemUrl: varchar("imagemUrl", { length: 500 }),
  contexto: jsonb("contexto").$type<{
    historicoMedico?: any;
    consultasAnteriores?: any;
    odontograma?: any;
    outros?: any;
  }>(),
  
  // Output
  resposta: text("resposta").notNull(),
  confianca: integer("confianca"), // 0-100
  
  // Dados estruturados
  dadosEstruturados: jsonb("dadosEstruturados").$type<{
    deteccoes?: Array<{
      tipo: string;
      localizacao?: any;
      confianca: number;
      descricao: string;
    }>;
    recomendacoes?: Array<{
      titulo: string;
      descricao: string;
      prioridade: string;
    }>;
    metricas?: any;
  }>(),
  
  // Metadados
  modelo: varchar("modelo", { length: 100 }),
  tokens: integer("tokens"),
  custoEstimado: integer("custoEstimado"), // em centavos
  tempoProcessamento: integer("tempoProcessamento"), // em ms
  
  // Status
  aprovado: boolean("aprovado").default(false),
  revisadoPor: integer("revisadoPor"),
  dataRevisao: timestamp("dataRevisao"),
  observacoesRevisao: text("observacoesRevisao"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// CHAT ASSISTENTE
// ============================================

export const conversasIA = pgTable("conversas_ia", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  usuarioId: integer("usuarioId").notNull(),
  
  titulo: varchar("titulo", { length: 255 }),
  contexto: varchar("contexto", { length: 50 }).default("geral"),
  
  // Contexto da conversa
  utenteRelacionado: integer("utenteRelacionado").references(() => utentes.id),
  dadosContexto: jsonb("dadosContexto").$type<any>(),
  
  ativa: boolean("ativa").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const mensagensIA = pgTable("mensagens_ia", {
  id: serial("id").primaryKey(),
  conversaId: integer("conversaId").notNull().references(() => conversasIA.id),
  
  papel: varchar("papel", { length: 50 }).notNull(),
  conteudo: text("conteudo").notNull(),
  
  // Anexos
  anexos: jsonb("anexos").$type<Array<{
    tipo: string;
    url: string;
    nome?: string;
  }>>(),
  
  // Metadados
  tokens: integer("tokens"),
  modelo: varchar("modelo", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// SUGESTÕES AUTOMÁTICAS
// ============================================

export const sugestoesIA = pgTable("sugestoes_ia", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  utenteId: integer("utenteId").references(() => utentes.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao").notNull(),
  
  prioridade: varchar("prioridade", { length: 50 }).default("media"),
  confianca: integer("confianca"), // 0-100
  
  // Ação sugerida
  acaoSugerida: jsonb("acaoSugerida").$type<{
    tipo: string;
    parametros?: any;
    linkRapido?: string;
  }>(),
  
  // Impacto estimado
  impactoEstimado: jsonb("impactoEstimado").$type<{
    financeiro?: number;
    tempo?: number;
    satisfacao?: number;
    saude?: number;
  }>(),
  
  // Status
  visualizada: boolean("visualizada").default(false),
  dataVisualizacao: timestamp("dataVisualizacao"),
  aceita: boolean("aceita"),
  dataAcao: timestamp("dataAcao"),
  feedback: text("feedback"),
  
  expiradaEm: timestamp("expiradaEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// LOGS DE USO
// ============================================

export const logsUsoIA = pgTable("logs_uso_ia", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  funcionalidade: varchar("funcionalidade", { length: 100 }).notNull(),
  modelo: varchar("modelo", { length: 100 }),
  tokens: integer("tokens"),
  custoEstimado: integer("custoEstimado"), // em centavos
  tempoProcessamento: integer("tempoProcessamento"), // em ms
  
  sucesso: boolean("sucesso").default(true),
  erro: text("erro"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConfiguracaoIA = typeof configuracoesIA.$inferSelect;
export type AnaliseIA = typeof analisesIA.$inferSelect;
export type ConversaIA = typeof conversasIA.$inferSelect;
export type MensagemIA = typeof mensagensIA.$inferSelect;
export type SugestaoIA = typeof sugestoesIA.$inferSelect;
export type LogUsoIA = typeof logsUsoIA.$inferSelect;

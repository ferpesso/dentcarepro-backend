import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * Tabela de Notificações
 * Armazena todas as notificações do sistema
 */
export const notificacoes = pgTable("notificacoes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clinicaId: integer("clinica_id").notNull(),
  
  // Conteúdo da notificação
  tipo: text("tipo").notNull(), // 'avaliacao_negativa', 'custo_alto', 'pagamento_pendente', 'nova_avaliacao', etc.
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  
  // Metadata
  link: text("link"), // URL para onde a notificação leva
  icone: text("icone"), // Nome do ícone Lucide
  cor: text("cor"), // Cor da notificação (red, yellow, green, blue)
  
  // Estado
  lida: boolean("lida").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lidaEm: timestamp("lida_em"),
});

/**
 * Tabela de Preferências de Notificações
 * Configurações do usuário para receber notificações
 */
export const preferenciasNotificacoes = pgTable("preferencias_notificacoes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Tipos de notificações habilitadas
  avaliacoesNegativas: boolean("avaliacoes_negativas").default(true).notNull(),
  custosAltos: boolean("custos_altos").default(true).notNull(),
  pagamentosPendentes: boolean("pagamentos_pendentes").default(true).notNull(),
  novasAvaliacoes: boolean("novas_avaliacoes").default(true).notNull(),
  
  // Limites para alertas
  limiteAvaliacaoNegativa: integer("limite_avaliacao_negativa").default(3).notNull(), // Estrelas <= 3
  limiteCustoAlto: integer("limite_custo_alto").default(5000).notNull(), // Valor em euros
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Notificacao = typeof notificacoes.$inferSelect;
export type NovaNotificacao = typeof notificacoes.$inferInsert;
export type PreferenciasNotificacoes = typeof preferenciasNotificacoes.$inferSelect;
export type NovasPreferenciasNotificacoes = typeof preferenciasNotificacoes.$inferInsert;

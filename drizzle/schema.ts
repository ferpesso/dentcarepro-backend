import { pgTable, serial, integer, varchar, text, timestamp, boolean, numeric, jsonb, date, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";


// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "dentista", "rececionista"]);
export const registoEstadoEnum = pgEnum("registo_estado", ["pendente", "completo", "cancelado"]);
export const assinaturaEstadoEnum = pgEnum("assinatura_estado", ["trial", "ativo", "em_atraso", "cancelado", "expirado"]);
export const cicloFaturacaoEnum = pgEnum("cicloFaturacao", ["mensal", "anual"]);
export const pagamentoEstadoEnum = pgEnum("pagamento_estado", ["pendente", "sucesso", "falhado", "reembolsado"]);
export const utilizadorRoleEnum = pgEnum("utilizador_role", ["proprietario", "admin", "dentista", "rececionista"]);
export const generoEnum = pgEnum("genero", ["masculino", "feminino", "outro"]);
export const estadoTabagismoEnum = pgEnum("estadoTabagismo", ["nunca", "ex_fumador", "fumador"]);
export const consumoAlcoolEnum = pgEnum("consumoAlcool", ["nunca", "ocasional", "regular"]);
export const consultaEstadoEnum = pgEnum("consulta_estado", ["agendada", "confirmada", "em_curso", "concluida", "cancelada", "faltou"]);
export const faturaEstadoEnum = pgEnum("fatura_estado", ["rascunho", "enviada", "paga", "parcialmente_paga", "vencida", "cancelada"]);
export const metodoPagamentoEnum = pgEnum("metodoPagamento", ["dinheiro", "cartao", "transferencia", "mbway", "multibanco", "outro"]);
export const tipoDistribuicaoEnum = pgEnum("tipoDistribuicao", ["percentagem", "fixo", "hibrido"]);
export const categoriaEnum = pgEnum("categoria", ["lembrete_consulta", "confirmacao_consulta", "seguimento", "pos_tratamento", "marketing", "outro"]);
export const notificacaoCanalEnum = pgEnum("notificacao_canal", ["email", "sms", "whatsapp"]);
export const mensagemEstadoEnum = pgEnum("mensagem_estado", ["pendente", "enviada", "entregue", "lida", "falhada"]);

/**
 * DentCarePro SaaS - Schema Completo de Base de Dados
 * 
 * Sistema de gestão para clínicas dentárias com:
 * - Multi-tenancy (isolamento por clínica)
 * - Sistema SaaS com planos e assinaturas
 * - Gestão completa de utentes, consultas e faturação
 * - Terminologia em Português de Portugal
 */

// ============================================
// AUTENTICAÇÃO E UTILIZADORES
// ============================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  nome: text("nome"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("user_role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// SISTEMA SAAS - PLANOS E ASSINATURAS
// ============================================

export const planosAssinatura = pgTable("planos_assinatura", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  descricao: text("descricao"),
  precoMensal: numeric("precoMensal", { precision: 10, scale: 2 }).notNull(),
  precoAnual: numeric("precoAnual", { precision: 10, scale: 2 }),
  maxDentistas: integer("maxDentistas").notNull().default(1),
  maxUtentes: integer("maxUtentes").notNull().default(100),
  maxClinicas: integer("maxClinicas").notNull().default(1),
  maxArmazenamentoGB: integer("maxArmazenamentoGB").notNull().default(1),
  funcionalidades: jsonb("funcionalidades").$type<{
    multiClinica: boolean;
    mensagensIA: boolean;
    relatoriosAvancados: boolean;
    acessoAPI: boolean;
    suportePrioritario: boolean;
    marcaPersonalizada: boolean;
    integracaoWhatsapp: boolean;
    notificacoesSMS: boolean;
  }>(),
  ativo: boolean("ativo").notNull().default(true),
  popular: boolean("popular").notNull().default(false),
  stripePriceIdMensal: varchar("stripePriceIdMensal", { length: 255 }),
  stripePriceIdAnual: varchar("stripePriceIdAnual", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const registosClinica = pgTable("registos_clinica", {
  id: serial("id").primaryKey(),
  nomeClinica: varchar("nomeClinica", { length: 255 }).notNull(),
  nomeProprietario: varchar("nomeProprietario", { length: 255 }).notNull(),
  emailProprietario: varchar("emailProprietario", { length: 320 }).notNull().unique(),
  telemovel: varchar("telemovel", { length: 50 }),
  morada: text("morada"),
  cidade: varchar("cidade", { length: 100 }),
  codigoPostal: varchar("codigoPostal", { length: 20 }),
  pais: varchar("pais", { length: 2 }).notNull().default("PT"),
  planoSelecionadoId: integer("planoSelecionadoId").references(() => planosAssinatura.id),
  estado: registoEstadoEnum("registo_estado").notNull().default("pendente"),
  tokenVerificacao: varchar("tokenVerificacao", { length: 255 }),
  verificadoEm: timestamp("verificadoEm"),
  clinicaId: integer("clinicaId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completadoEm: timestamp("completadoEm"),
});

// ============================================
// CLÍNICAS
// ============================================

export const clinicas = pgTable("clinicas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telemovel: varchar("telemovel", { length: 50 }),
  morada: text("morada"),
  cidade: varchar("cidade", { length: 100 }),
  codigoPostal: varchar("codigoPostal", { length: 20 }),
  pais: varchar("pais", { length: 2 }).notNull().default("PT"),
  nif: varchar("nif", { length: 50 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  ativo: boolean("ativo").notNull().default(true),
  proprietarioId: integer("proprietarioId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const assinaturasClinica = pgTable("assinaturas_clinica", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  planoId: integer("planoId").notNull().references(() => planosAssinatura.id),
  estado: assinaturaEstadoEnum("assinatura_estado").notNull().default("trial"),
  cicloFaturacao: cicloFaturacaoEnum("cicloFaturacao").notNull().default("mensal"),
  inicioPeriodoAtual: timestamp("inicioPeriodoAtual").notNull(),
  fimPeriodoAtual: timestamp("fimPeriodoAtual").notNull(),
  inicioTrial: timestamp("inicioTrial"),
  fimTrial: timestamp("fimTrial"),
  cancelarNoFimPeriodo: boolean("cancelarNoFimPeriodo").notNull().default(false),
  canceladoEm: timestamp("canceladoEm"),
  motivoCancelamento: text("motivoCancelamento"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePaymentMethodId: varchar("stripePaymentMethodId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const pagamentos = pgTable("pagamentos", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  assinaturaId: integer("assinaturaId").references(() => assinaturasClinica.id),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  moeda: varchar("moeda", { length: 3 }).notNull().default("EUR"),
  estado: pagamentoEstadoEnum("pagamento_estado").notNull(),
  descricao: text("descricao"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  metadata: jsonb("metadata"),
  pagoEm: timestamp("pagoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const metricasUso = pgTable("metricas_uso", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  inicioPeriodo: timestamp("inicioPeriodo").notNull(),
  fimPeriodo: timestamp("fimPeriodo").notNull(),
  totalUtentes: integer("totalUtentes").notNull().default(0),
  totalConsultas: integer("totalConsultas").notNull().default(0),
  totalFaturas: integer("totalFaturas").notNull().default(0),
  receitaTotal: numeric("receitaTotal", { precision: 12, scale: 2 }).notNull().default("0"),
  dentistasAtivos: integer("dentistasAtivos").notNull().default(0),
  clinicasAtivas: integer("clinicasAtivas").notNull().default(0),
  armazenamentoUsadoMB: integer("armazenamentoUsadoMB").notNull().default(0),
  chamadasAPI: integer("chamadasAPI").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// UTILIZADORES E PERMISSÕES
// ============================================

export const utilizadoresClinica = pgTable("utilizadores_clinica", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  userId: integer("userId").notNull().references(() => users.id),
  role: utilizadorRoleEnum("role").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  convidadoPor: integer("convidadoPor").references(() => users.id),
  convidadoEm: timestamp("convidadoEm").defaultNow().notNull(),
  aceiteEm: timestamp("aceiteEm"),
});

export const dentistas = pgTable("dentistas", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telemovel: varchar("telemovel", { length: 50 }),
  especializacao: varchar("especializacao", { length: 255 }),
  numeroCedula: varchar("numeroCedula", { length: 100 }),
  percentagemComissao: numeric("percentagemComissao", { precision: 5, scale: 2 }).default("0"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// UTENTES (PACIENTES)
// ============================================

export const utentes = pgTable("utentes", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  numeroUtente: varchar("numeroUtente", { length: 50 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  telemovel: varchar("telemovel", { length: 50 }).notNull(),
  dataNascimento: date("dataNascimento"),
  genero: generoEnum("genero"),
  morada: text("morada"),
  cidade: varchar("cidade", { length: 100 }),
  codigoPostal: varchar("codigoPostal", { length: 20 }),
  pais: varchar("pais", { length: 2 }).default("PT"),
  nif: varchar("nif", { length: 50 }),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const historicoMedico = pgTable("historico_medico", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  alergias: text("alergias"),
  medicamentos: text("medicamentos"),
  condicoesMedicas: text("condicoesMedicas"),
  cirurgiasPrevias: text("cirurgiasPrevias"),
  historicoFamiliar: text("historicoFamiliar"),
  estadoTabagismo: estadoTabagismoEnum("estadoTabagismo"),
  consumoAlcool: consumoAlcoolEnum("consumoAlcool"),
  tipoSanguineo: varchar("tipoSanguineo", { length: 10 }),
  contatoEmergenciaNome: varchar("contatoEmergenciaNome", { length: 255 }),
  contatoEmergenciaTelemovel: varchar("contatoEmergenciaTelemovel", { length: 50 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// PROCEDIMENTOS E TRATAMENTOS
// ============================================

export const categoriasProcedimento = pgTable("categorias_procedimento", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  cor: varchar("cor", { length: 7 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const procedimentos = pgTable("procedimentos", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  categoriaId: integer("categoriaId").references(() => categoriasProcedimento.id),
  codigo: varchar("codigo", { length: 50 }),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  precoBase: numeric("precoBase", { precision: 10, scale: 2 }).notNull().default("0"),
  duracaoMinutos: integer("duracaoMinutos").default(30),
  cor: varchar("cor", { length: 7 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// AGENDA E CONSULTAS
// ============================================

export const consultas = pgTable("consultas", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  dentistaId: integer("dentistaId").notNull().references(() => dentistas.id),
  procedimentoId: integer("procedimentoId").references(() => procedimentos.id),
  horaInicio: timestamp("horaInicio").notNull(),
  horaFim: timestamp("horaFim").notNull(),
  estado: consultaEstadoEnum("estado").notNull().default("agendada"),
  titulo: varchar("titulo", { length: 255 }),
  observacoes: text("observacoes"),
  motivoCancelamento: text("motivoCancelamento"),
  confirmadaEm: timestamp("confirmadaEm"),
  concluidaEm: timestamp("concluidaEm"),
  canceladaEm: timestamp("canceladaEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// FATURAÇÃO
// ============================================

export const faturas = pgTable("faturas", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  consultaId: integer("consultaId").references(() => consultas.id),
  numeroFatura: varchar("numeroFatura", { length: 50 }).notNull(),
  dataFatura: timestamp("dataFatura").notNull(),
  dataVencimento: timestamp("dataVencimento"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  valorIVA: numeric("valorIVA", { precision: 10, scale: 2 }).notNull().default("0"),
  percentagemIVA: numeric("percentagemIVA", { precision: 5, scale: 2 }).notNull().default("0"),
  valorDesconto: numeric("valorDesconto", { precision: 10, scale: 2 }).notNull().default("0"),
  valorTotal: numeric("valorTotal", { precision: 10, scale: 2 }).notNull().default("0"),
  valorPago: numeric("valorPago", { precision: 10, scale: 2 }).notNull().default("0"),
  estado: faturaEstadoEnum("estado").notNull().default("rascunho"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const itensFatura = pgTable("itens_fatura", {
  id: serial("id").primaryKey(),
  faturaId: integer("faturaId").notNull().references(() => faturas.id),
  procedimentoId: integer("procedimentoId").references(() => procedimentos.id),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  quantidade: integer("quantidade").notNull().default(1),
  precoUnitario: numeric("precoUnitario", { precision: 10, scale: 2 }).notNull(),
  precoTotal: numeric("precoTotal", { precision: 10, scale: 2 }).notNull(),
  comissaoDentista: numeric("comissaoDentista", { precision: 10, scale: 2 }).default("0"),
  valorClinica: numeric("valorClinica", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pagamentosFatura = pgTable("pagamentos_fatura", {
  id: serial("id").primaryKey(),
  faturaId: integer("faturaId").notNull().references(() => faturas.id),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  metodoPagamento: metodoPagamentoEnum("metodoPagamento").notNull(),
  dataPagamento: timestamp("dataPagamento").notNull(),
  referencia: varchar("referencia", { length: 255 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// CONFIGURAÇÕES FINANCEIRAS
// ============================================

export const configuracoesFinanceiras = pgTable("configuracoes_financeiras", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  procedimentoId: integer("procedimentoId").references(() => procedimentos.id),
  dentistaId: integer("dentistaId").references(() => dentistas.id),
  tipoDistribuicao: tipoDistribuicaoEnum("tipoDistribuicao").notNull().default("percentagem"),
  percentagemDentista: numeric("percentagemDentista", { precision: 5, scale: 2 }),
  valorFixoDentista: numeric("valorFixoDentista", { precision: 10, scale: 2 }),
  percentagemClinica: numeric("percentagemClinica", { precision: 5, scale: 2 }),
  valorFixoClinica: numeric("valorFixoClinica", { precision: 10, scale: 2 }),
  custoLaboratorio: numeric("custoLaboratorio", { precision: 10, scale: 2 }).default("0"),
  custoMateriais: numeric("custoMateriais", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// MENSAGENS E NOTIFICAÇÕES
// ============================================

export const templatesMensagem = pgTable("templates_mensagem", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  nome: varchar("nome", { length: 255 }).notNull(),
  categoria: categoriaEnum("categoria").notNull(),
  assunto: varchar("assunto", { length: 500 }),
  corpo: text("corpo").notNull(),
  canal: notificacaoCanalEnum("notificacao_canal").notNull().default("email"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const mensagensUtente = pgTable("mensagens_utente", {
  id: serial("id").primaryKey(),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  templateId: integer("templateId").references(() => templatesMensagem.id),
  canal: notificacaoCanalEnum("notificacao_canal").notNull(),
  assunto: varchar("assunto", { length: 500 }),
  corpo: text("corpo").notNull(),
  estado: mensagemEstadoEnum("mensagem_estado").notNull().default("pendente"),
  enviadaEm: timestamp("enviadaEm"),
  entregueEm: timestamp("entregueEm"),
  lidaEm: timestamp("lidaEm"),
  mensagemErro: text("mensagemErro"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// RELAÇÕES
// ============================================

export const clinicasRelations = relations(clinicas, ({ one, many }) => ({
  proprietario: one(users, {
    fields: [clinicas.proprietarioId],
    references: [users.id],
  }),
  assinatura: one(assinaturasClinica),
  utentes: many(utentes),
  dentistas: many(dentistas),
  consultas: many(consultas),
  faturas: many(faturas),
}));

export const utentesRelations = relations(utentes, ({ one, many }) => ({
  clinica: one(clinicas, {
    fields: [utentes.clinicaId],
    references: [clinicas.id],
  }),
  historicoMedico: one(historicoMedico),
  consultas: many(consultas),
  faturas: many(faturas),
}));

export const consultasRelations = relations(consultas, ({ one }) => ({
  clinica: one(clinicas, {
    fields: [consultas.clinicaId],
    references: [clinicas.id],
  }),
  utente: one(utentes, {
    fields: [consultas.utenteId],
    references: [utentes.id],
  }),
  dentista: one(dentistas, {
    fields: [consultas.dentistaId],
    references: [dentistas.id],
  }),
  procedimento: one(procedimentos, {
    fields: [consultas.procedimentoId],
    references: [procedimentos.id],
  }),
}));

export const faturasRelations = relations(faturas, ({ one, many }) => ({
  clinica: one(clinicas, {
    fields: [faturas.clinicaId],
    references: [clinicas.id],
  }),
  utente: one(utentes, {
    fields: [faturas.utenteId],
    references: [utentes.id],
  }),
  consulta: one(consultas, {
    fields: [faturas.consultaId],
    references: [consultas.id],
  }),
  itens: many(itensFatura),
  pagamentos: many(pagamentosFatura),
}));

// Schema de Notificações
export * from "./schema-notificacoes";

import { pgTable, serial, integer, varchar, text, timestamp, boolean, date, numeric, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { utentes, dentistas, clinicas } from "./schema";

/**
 * Schema Completo para Ficha de Utente
 * Sistema profissional de gestão clínica dentária
 */

// ============================================
// ODONTOGRAMA - Mapa Dentário
// ============================================

export const odontograma = pgTable("odontograma", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  numeroDente: integer("numeroDente").notNull(), // Notação FDI: 11-18, 21-28, 31-38, 41-48
  estado: varchar("estado", { length: 50 }).notNull().default("sadio"),
  faces: jsonb("faces").$type<{
    oclusal?: string; // Estado da face oclusal
    mesial?: string;
    distal?: string;
    vestibular?: string;
    lingual?: string;
  }>(),
  observacoes: text("observacoes"),
  cor: varchar("cor", { length: 7 }), // Cor para visualização
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  dataRegisto: timestamp("dataRegisto").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const historicoOdontograma = pgTable("historico_odontograma", {
  id: serial("id").primaryKey(),
  odontogramaId: integer("odontogramaId").notNull().references(() => odontograma.id),
  estadoAnterior: varchar("estadoAnterior", { length: 50 }),
  estadoNovo: varchar("estadoNovo", { length: 50 }).notNull(),
  procedimentoRealizado: text("procedimentoRealizado"),
  observacoes: text("observacoes"),
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  dataAlteracao: timestamp("dataAlteracao").defaultNow().notNull(),
});

// ============================================
// PERIODONTOGRAMA - Avaliação Periodontal
// ============================================

export const periodontograma = pgTable("periodontograma", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  dataAvaliacao: date("dataAvaliacao").notNull(),
  
  // Dados por dente (JSON com medições)
  medicoes: jsonb("medicoes").$type<{
    [dente: string]: {
      profundidadeSondagem: {
        mesial: number;
        central: number;
        distal: number;
      };
      nivelInsercao: {
        mesial: number;
        central: number;
        distal: number;
      };
      sangramento: boolean;
      supuracao: boolean;
      mobilidade: number; // 0-3
      furca: number; // 0-3
      placa: boolean;
    };
  }>(),
  
  // Índices gerais
  indicePlaca: numeric("indicePlaca", { precision: 5, scale: 2 }), // 0-100%
  indiceSangramento: numeric("indiceSangramento", { precision: 5, scale: 2 }),
  indiceProfundidade: numeric("indiceProfundidade", { precision: 5, scale: 2 }),
  
  diagnostico: text("diagnostico"),
  planoTratamento: text("planoTratamento"),
  observacoes: text("observacoes"),
  
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// ENDODONTIA - Tratamentos de Canal
// ============================================

export const endodontia = pgTable("endodontia", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  numeroDente: integer("numeroDente").notNull(),
  
  // Diagnóstico
  diagnostico: varchar("diagnostico", { length: 50 }).notNull(),
  
  // Dados do tratamento
  numeroCanais: integer("numeroCanais").notNull(),
  canais: jsonb("canais").$type<{
    [canal: string]: {
      comprimentoTrabalho: number; // em mm
      instrumentacao: string;
      medicacao: string;
      obturacao: string;
      dataObturacao?: Date;
    };
  }>(),
  
  // Sessões
  numeroSessoes: integer("numeroSessoes").default(1),
  dataInicio: date("dataInicio").notNull(),
  dataConclusao: date("dataConclusao"),
  
  estado: varchar("estado", { length: 50 }).notNull().default("em_andamento"),
  
  // Materiais utilizados
  materiaisUtilizados: text("materiaisUtilizados"),
  tecnicaObturacao: varchar("tecnicaObturacao", { length: 100 }),
  
  observacoes: text("observacoes"),
  complicacoes: text("complicacoes"),
  
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// IMPLANTES
// ============================================

export const implantes = pgTable("implantes", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  posicao: integer("posicao").notNull(), // Posição do dente
  
  // Dados do implante
  fabricante: varchar("fabricante", { length: 100 }),
  modelo: varchar("modelo", { length: 100 }),
  lote: varchar("lote", { length: 100 }),
  diametro: numeric("diametro", { precision: 4, scale: 2 }), // em mm
  comprimento: numeric("comprimento", { precision: 4, scale: 2 }), // em mm
  
  // Cirurgia
  dataColocacao: date("dataColocacao").notNull(),
  tipoCirurgia: varchar("tipoCirurgia", { length: 50 }),
  enxertoOsseo: boolean("enxertoOsseo").default(false),
  tipoEnxerto: varchar("tipoEnxerto", { length: 100 }),
  
  // Prótese
  dataPilar: date("dataPilar"),
  dataProtese: date("dataProtese"),
  tipoProtese: varchar("tipoProtese", { length: 100 }),
  
  // Acompanhamento
  estado: varchar("estado", { length: 50 }).notNull().default("planejado"),
  
  torqueInsercao: integer("torqueInsercao"), // em Ncm
  estabilidadePrimaria: varchar("estabilidadePrimaria", { length: 50 }),
  
  observacoes: text("observacoes"),
  complicacoes: text("complicacoes"),
  
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// ORTODONTIA
// ============================================

export const ortodontia = pgTable("ortodontia", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  // Diagnóstico
  classificacaoAngle: varchar("classificacaoAngle", { length: 50 }),
  tipoMordida: jsonb("tipoMordida").$type<{
    sobremordida?: boolean;
    mordidaAberta?: boolean;
    mordidaCruzada?: boolean;
    mordidaTopo?: boolean;
  }>(),
  apinhamento: varchar("apinhamento", { length: 50 }),
  diastemas: boolean("diastemas").default(false),
  
  // Tratamento
  tipoAparelho: varchar("tipoAparelho", { length: 50 }).notNull(),
  
  dataInicio: date("dataInicio").notNull(),
  dataPrevisaoConclusao: date("dataPrevisaoConclusao"),
  dataConclusao: date("dataConclusao"),
  
  // Planejamento
  extracoesNecessarias: jsonb("extracoesNecessarias").$type<number[]>(),
  usoBandas: boolean("usoBandas").default(false),
  usoElasticos: boolean("usoElasticos").default(false),
  usoMiniImplantes: boolean("usoMiniImplantes").default(false),
  
  // Evolução
  estado: varchar("estado", { length: 50 }).notNull().default("planejamento"),
  
  duracaoEstimadaMeses: integer("duracaoEstimadaMeses"),
  
  observacoes: text("observacoes"),
  planoTratamento: text("planoTratamento"),
  
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const consultasOrtodontia = pgTable("consultas_ortodontia", {
  id: serial("id").primaryKey(),
  ortodontiaId: integer("ortodontiaId").notNull().references(() => ortodontia.id),
  dataConsulta: date("dataConsulta").notNull(),
  
  // Ativações realizadas
  arcoSuperior: varchar("arcoSuperior", { length: 100 }),
  arcoInferior: varchar("arcoInferior", { length: 100 }),
  trocaBrackets: jsonb("trocaBrackets").$type<number[]>(),
  elasticos: varchar("elasticos", { length: 255 }),
  
  // Medições
  medicoes: jsonb("medicoes").$type<{
    overjet?: number;
    overbite?: number;
    linhaMedia?: number;
  }>(),
  
  observacoes: text("observacoes"),
  proximaConsulta: date("proximaConsulta"),
  
  registadoPor: integer("registadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// IMAGENS E DOCUMENTAÇÃO
// ============================================

export const imagensUtente = pgTable("imagens_utente", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }),
  descricao: text("descricao"),
  
  urlImagem: varchar("urlImagem", { length: 500 }).notNull(),
  urlThumbnail: varchar("urlThumbnail", { length: 500 }),
  
  // Metadados
  tamanhoBytes: integer("tamanhoBytes"),
  formato: varchar("formato", { length: 20 }), // jpg, png, dicom
  largura: integer("largura"),
  altura: integer("altura"),
  
  // Associações
  denteRelacionado: integer("denteRelacionado"),
  consultaRelacionada: integer("consultaRelacionada"),
  tratamentoRelacionado: varchar("tratamentoRelacionado", { length: 100 }),
  
  // Análise IA
  analisadoPorIA: boolean("analisadoPorIA").default(false),
  resultadoIA: jsonb("resultadoIA").$type<{
    deteccoes?: Array<{
      tipo: string;
      confianca: number;
      localizacao?: any;
    }>;
    sugestoes?: string[];
  }>(),
  
  tags: jsonb("tags").$type<string[]>(),
  
  uploadPor: integer("uploadPor").references(() => dentistas.id),
  dataUpload: timestamp("dataUpload").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// LABORATÓRIO
// ============================================

export const trabalhosLaboratorio = pgTable("trabalhos_laboratorio", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  descricao: text("descricao").notNull(),
  dentes: jsonb("dentes").$type<number[]>(), // Dentes envolvidos
  
  // Laboratório
  laboratorio: varchar("laboratorio", { length: 255 }),
  protesicoResponsavel: varchar("protesicoResponsavel", { length: 255 }),
  
  // Material
  material: varchar("material", { length: 100 }), // Zircônia, metal-cerâmica, etc
  cor: varchar("cor", { length: 50 }),
  
  // Datas
  dataEnvio: date("dataEnvio").notNull(),
  dataPrevisaoEntrega: date("dataPrevisaoEntrega"),
  dataEntrega: date("dataEntrega"),
  dataInstalacao: date("dataInstalacao"),
  
  // Status
  estado: varchar("estado", { length: 50 }).notNull().default("planejado"),
  
  // Financeiro
  custoLaboratorio: numeric("custoLaboratorio", { precision: 10, scale: 2 }),
  valorCobrado: numeric("valorCobrado", { precision: 10, scale: 2 }),
  
  // Garantia
  garantiaMeses: integer("garantiaMeses"),
  dataGarantiaFim: date("dataGarantiaFim"),
  
  observacoes: text("observacoes"),
  ajustesNecessarios: text("ajustesNecessarios"),
  
  solicitadoPor: integer("solicitadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// PRESCRIÇÕES
// ============================================

export const prescricoes = pgTable("prescricoes", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  consultaId: integer("consultaId"), // Consulta relacionada
  
  dataPrescricao: date("dataPrescricao").notNull(),
  
  // Medicamentos
  medicamentos: jsonb("medicamentos").$type<Array<{
    nome: string;
    principioAtivo?: string;
    dosagem: string;
    via: string; // oral, tópico, etc
    frequencia: string;
    duracao: string;
    quantidade: number;
    instrucoes: string;
  }>>().notNull(),
  
  // Diagnóstico
  diagnostico: text("diagnostico"),
  indicacao: text("indicacao"),
  
  // Observações
  observacoes: text("observacoes"),
  contraindicacoes: text("contraindicacoes"),
  
  // Validade
  validadeDias: integer("validadeDias").default(30),
  dataValidade: date("dataValidade"),
  
  // Status
  dispensada: boolean("dispensada").default(false),
  dataDispensacao: date("dataDispensacao"),
  
  prescritoPor: integer("prescritoPor").notNull().references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================
// IA INSIGHTS E ANÁLISES
// ============================================

export const iaInsights = pgTable("ia_insights", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao").notNull(),
  
  // Dados da análise
  confianca: numeric("confianca", { precision: 5, scale: 2 }), // 0-100%
  prioridade: varchar("prioridade", { length: 50 }),
  
  dados: jsonb("dados").$type<{
    metricas?: any;
    graficos?: any;
    comparacoes?: any;
    tendencias?: any;
  }>(),
  
  // Recomendações
  recomendacoes: jsonb("recomendacoes").$type<Array<{
    titulo: string;
    descricao: string;
    prioridade: string;
    custoEstimado?: number;
  }>>(),
  
  // Fontes
  baseadoEm: jsonb("baseadoEm").$type<{
    imagens?: number[];
    consultas?: number[];
    exames?: number[];
    historico?: boolean;
  }>(),
  
  // Status
  visualizado: boolean("visualizado").default(false),
  dataVisualizacao: timestamp("dataVisualizacao"),
  acao_tomada: text("acao_tomada"),
  
  geradoEm: timestamp("geradoEm").defaultNow().notNull(),
  expiradoEm: timestamp("expiradoEm"),
});

// ============================================
// NOTAS E OBSERVAÇÕES
// ============================================

export const notasUtente = pgTable("notas_utente", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }),
  conteudo: text("conteudo").notNull(),
  
  importante: boolean("importante").default(false),
  privada: boolean("privada").default(false), // Visível apenas para quem criou
  
  tags: jsonb("tags").$type<string[]>(),
  
  criadoPor: integer("criadoPor").notNull().references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ============================================
// CONSENTIMENTOS
// ============================================

export const consentimentos = pgTable("consentimentos", {
  id: serial("id").primaryKey(),
  utenteId: integer("utenteId").notNull().references(() => utentes.id),
  clinicaId: integer("clinicaId").notNull().references(() => clinicas.id),
  
  tipo: varchar("tipo", { length: 50 }).notNull(),
  
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  
  // Documento
  urlDocumento: varchar("urlDocumento", { length: 500 }),
  conteudoTexto: text("conteudoTexto"),
  
  // Assinatura
  assinado: boolean("assinado").default(false),
  dataAssinatura: timestamp("dataAssinatura"),
  assinaturaDigital: text("assinaturaDigital"), // Base64 da assinatura
  ipAssinatura: varchar("ipAssinatura", { length: 50 }),
  
  // Testemunhas
  testemunha1Nome: varchar("testemunha1Nome", { length: 255 }),
  testemunha1Assinatura: text("testemunha1Assinatura"),
  
  // Validade
  dataValidade: date("dataValidade"),
  
  criadoPor: integer("criadoPor").references(() => dentistas.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Odontograma = typeof odontograma.$inferSelect;
export type Periodontograma = typeof periodontograma.$inferSelect;
export type Endodontia = typeof endodontia.$inferSelect;
export type Implante = typeof implantes.$inferSelect;
export type Ortodontia = typeof ortodontia.$inferSelect;
export type ImagemUtente = typeof imagensUtente.$inferSelect;
export type TrabalhoLaboratorio = typeof trabalhosLaboratorio.$inferSelect;
export type Prescricao = typeof prescricoes.$inferSelect;
export type IAInsight = typeof iaInsights.$inferSelect;
export type NotaUtente = typeof notasUtente.$inferSelect;
export type Consentimento = typeof consentimentos.$inferSelect;

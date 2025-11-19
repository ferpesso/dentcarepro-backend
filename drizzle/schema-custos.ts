/**
 * Schema para Sistema de Controlo de Custos Operacionais
 * 
 * Permite rastrear e analisar:
 * - Custos fixos (renda, salários, etc.)
 * - Custos variáveis (materiais, equipamentos, etc.)
 * - Custos por procedimento
 * - Margem de lucro real
 * - ROI de investimentos
 */

import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  pgEnum,
  numeric,
  date,
} from 'drizzle-orm/pg-core';

/**
 * Enum para categoria de custo
 */
export const categoriaCustoEnum = pgEnum('categoria_custo', [
  'fixo',           // Custos fixos (renda, salários)
  'variavel',       // Custos variáveis (materiais)
  'material',       // Materiais dentários
  'equipamento',    // Equipamentos e manutenção
  'pessoal',        // Salários e encargos
  'marketing',      // Marketing e publicidade
  'administrativo', // Despesas administrativas
  'infraestrutura', // Renda, água, luz, etc.
  'formacao',       // Formação e desenvolvimento
  'outro',          // Outros custos
]);

/**
 * Enum para tipo de pagamento
 */
export const tipoPagamentoCustoEnum = pgEnum('tipo_pagamento_custo', [
  'unico',          // Pagamento único
  'mensal',         // Pagamento mensal recorrente
  'trimestral',     // Pagamento trimestral
  'semestral',      // Pagamento semestral
  'anual',          // Pagamento anual
]);

/**
 * Tabela de Custos Operacionais
 */
export const custosOperacionais = pgTable('custos_operacionais', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  procedimentoId: integer('procedimentoId'), // Opcional: custo associado a procedimento
  
  // Informações básicas
  descricao: text('descricao').notNull(),
  categoria: categoriaCustoEnum('categoria').notNull(),
  subcategoria: text('subcategoria'), // Ex: "Anestésicos", "Brocas", etc.
  
  // Valores
  valor: numeric('valor', { precision: 10, scale: 2 }).notNull(),
  quantidade: numeric('quantidade', { precision: 10, scale: 2 }).default('1'),
  valorTotal: numeric('valorTotal', { precision: 10, scale: 2 }).notNull(),
  
  // Tipo de custo
  tipoPagamento: tipoPagamentoCustoEnum('tipoPagamento').notNull().default('unico'),
  recorrente: boolean('recorrente').default(false),
  
  // Datas
  dataCompra: date('dataCompra').notNull(),
  dataVencimento: date('dataVencimento'), // Para custos recorrentes
  
  // Fornecedor
  fornecedor: text('fornecedor'),
  numeroFatura: text('numeroFatura'),
  
  // Controlo de estoque (para materiais)
  quantidadeEstoque: numeric('quantidadeEstoque', { precision: 10, scale: 2 }),
  quantidadeMinima: numeric('quantidadeMinima', { precision: 10, scale: 2 }),
  unidadeMedida: text('unidadeMedida'), // Ex: "unidade", "ml", "g"
  
  // Amortização (para equipamentos)
  vidaUtil: integer('vidaUtil'), // Meses de vida útil
  valorResidual: numeric('valorResidual', { precision: 10, scale: 2 }),
  amortizacaoMensal: numeric('amortizacaoMensal', { precision: 10, scale: 2 }),
  
  // Status
  pago: boolean('pago').default(false),
  dataPagamento: date('dataPagamento'),
  
  // Observações
  observacoes: text('observacoes'),
  
  // Anexos
  comprovativos: text('comprovativos').array(), // URLs de ficheiros
  
  // Metadados
  criadoPor: integer('criadoPor'), // ID do utilizador
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Custos por Procedimento
 * 
 * Rastreia custos específicos de cada procedimento realizado
 */
export const custosProcedimento = pgTable('custos_procedimento', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  procedimentoId: integer('procedimentoId').notNull(),
  consultaId: integer('consultaId'), // Opcional: consulta específica
  
  // Custos
  custoMateriais: numeric('custoMateriais', { precision: 10, scale: 2 }).default('0'),
  custoMaoObra: numeric('custoMaoObra', { precision: 10, scale: 2 }).default('0'),
  custoEquipamento: numeric('custoEquipamento', { precision: 10, scale: 2 }).default('0'),
  custoOutros: numeric('custoOutros', { precision: 10, scale: 2 }).default('0'),
  custoTotal: numeric('custoTotal', { precision: 10, scale: 2 }).notNull(),
  
  // Receita
  precoVenda: numeric('precoVenda', { precision: 10, scale: 2 }).notNull(),
  
  // Margem
  margemLucro: numeric('margemLucro', { precision: 10, scale: 2 }), // Valor absoluto
  percentagemMargem: numeric('percentagemMargem', { precision: 5, scale: 2 }), // Percentagem
  
  // Detalhamento de materiais
  materiaisUtilizados: text('materiaisUtilizados').array(), // JSON com lista de materiais
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Orçamentos e Previsões
 */
export const orcamentos = pgTable('orcamentos', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  
  // Período
  mes: integer('mes').notNull(), // 1-12
  ano: integer('ano').notNull(),
  
  // Orçamento por categoria
  orcamentoFixo: numeric('orcamentoFixo', { precision: 10, scale: 2 }).default('0'),
  orcamentoVariavel: numeric('orcamentoVariavel', { precision: 10, scale: 2 }).default('0'),
  orcamentoMaterial: numeric('orcamentoMaterial', { precision: 10, scale: 2 }).default('0'),
  orcamentoEquipamento: numeric('orcamentoEquipamento', { precision: 10, scale: 2 }).default('0'),
  orcamentoPessoal: numeric('orcamentoPessoal', { precision: 10, scale: 2 }).default('0'),
  orcamentoMarketing: numeric('orcamentoMarketing', { precision: 10, scale: 2 }).default('0'),
  orcamentoAdministrativo: numeric('orcamentoAdministrativo', { precision: 10, scale: 2 }).default('0'),
  orcamentoInfraestrutura: numeric('orcamentoInfraestrutura', { precision: 10, scale: 2 }).default('0'),
  orcamentoFormacao: numeric('orcamentoFormacao', { precision: 10, scale: 2 }).default('0'),
  orcamentoOutros: numeric('orcamentoOutros', { precision: 10, scale: 2 }).default('0'),
  
  // Total
  orcamentoTotal: numeric('orcamentoTotal', { precision: 10, scale: 2 }).notNull(),
  
  // Receita prevista
  receitaPrevista: numeric('receitaPrevista', { precision: 10, scale: 2 }),
  
  // Lucro previsto
  lucroPrevisto: numeric('lucroPrevisto', { precision: 10, scale: 2 }),
  
  // Observações
  observacoes: text('observacoes'),
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Relatórios Financeiros
 * 
 * Cache de relatórios mensais para performance
 */
export const relatoriosFinanceiros = pgTable('relatorios_financeiros', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  
  // Período
  mes: integer('mes').notNull(),
  ano: integer('ano').notNull(),
  
  // Receitas
  receitaTotal: numeric('receitaTotal', { precision: 10, scale: 2 }).default('0'),
  receitaConsultas: numeric('receitaConsultas', { precision: 10, scale: 2 }).default('0'),
  receitaProcedimentos: numeric('receitaProcedimentos', { precision: 10, scale: 2 }).default('0'),
  
  // Custos
  custoTotal: numeric('custoTotal', { precision: 10, scale: 2 }).default('0'),
  custoFixo: numeric('custoFixo', { precision: 10, scale: 2 }).default('0'),
  custoVariavel: numeric('custoVariavel', { precision: 10, scale: 2 }).default('0'),
  custoMateriais: numeric('custoMateriais', { precision: 10, scale: 2 }).default('0'),
  custoEquipamentos: numeric('custoEquipamentos', { precision: 10, scale: 2 }).default('0'),
  custoPessoal: numeric('custoPessoal', { precision: 10, scale: 2 }).default('0'),
  
  // Lucro
  lucroLiquido: numeric('lucroLiquido', { precision: 10, scale: 2 }).default('0'),
  margemLucro: numeric('margemLucro', { precision: 5, scale: 2 }).default('0'), // Percentagem
  
  // Comparação com orçamento
  variacaoOrcamento: numeric('variacaoOrcamento', { precision: 10, scale: 2 }), // Diferença
  percentagemVariacao: numeric('percentagemVariacao', { precision: 5, scale: 2 }), // %
  
  // Indicadores
  pontoEquilibrio: numeric('pontoEquilibrio', { precision: 10, scale: 2 }),
  roi: numeric('roi', { precision: 5, scale: 2 }), // Return on Investment
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Alertas de Custos
 */
export const alertasCustos = pgTable('alertas_custos', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  custoId: integer('custoId'), // Opcional: custo específico
  
  // Tipo de alerta
  tipo: text('tipo').notNull(), // 'estoque_baixo', 'orcamento_excedido', 'pagamento_vencido'
  severidade: text('severidade').notNull(), // 'info', 'warning', 'critical'
  
  // Mensagem
  titulo: text('titulo').notNull(),
  mensagem: text('mensagem').notNull(),
  
  // Status
  lido: boolean('lido').default(false),
  resolvido: boolean('resolvido').default(false),
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export default {
  custosOperacionais,
  custosProcedimento,
  orcamentos,
  relatoriosFinanceiros,
  alertasCustos,
};

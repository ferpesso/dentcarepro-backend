/**
 * Schema para Sistema de Avaliações de Clientes
 * 
 * Permite que utentes avaliem:
 * - Consultas individuais
 * - Dentistas
 * - Clínica em geral
 * - Procedimentos específicos
 */

import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Enum para tipo de avaliação
 */
export const tipoAvaliacaoEnum = pgEnum('tipo_avaliacao', [
  'consulta',
  'dentista',
  'clinica',
  'procedimento',
]);

/**
 * Tabela de Avaliações de Utentes
 */
export const avaliacoesUtentes = pgTable('avaliacoes_utentes', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  utenteId: integer('utenteId').notNull(),
  consultaId: integer('consultaId'), // Opcional: avaliação de consulta específica
  dentistaId: integer('dentistaId'), // Opcional: avaliação de dentista específico
  procedimentoId: integer('procedimentoId'), // Opcional: avaliação de procedimento
  
  // Tipo de avaliação
  tipo: tipoAvaliacaoEnum('tipo').notNull(),
  
  // Avaliação (1-5 estrelas)
  classificacao: integer('classificacao').notNull(), // 1-5
  
  // Avaliações detalhadas (1-5 cada)
  atendimento: integer('atendimento'), // Qualidade do atendimento
  pontualidade: integer('pontualidade'), // Pontualidade da consulta
  limpeza: integer('limpeza'), // Limpeza das instalações
  profissionalismo: integer('profissionalismo'), // Profissionalismo da equipa
  resultados: integer('resultados'), // Satisfação com resultados
  
  // Comentários
  titulo: text('titulo'), // Título da avaliação
  comentario: text('comentario'), // Comentário detalhado
  
  // Recomendação
  recomendaria: boolean('recomendaria').default(true), // Recomendaria a clínica/dentista?
  
  // Resposta da clínica
  resposta: text('resposta'), // Resposta da clínica ao comentário
  respondidoPor: integer('respondidoPor'), // ID do utilizador que respondeu
  dataResposta: timestamp('dataResposta'),
  
  // Visibilidade
  publica: boolean('publica').default(true), // Visível publicamente
  aprovada: boolean('aprovada').default(false), // Aprovada pela clínica
  
  // Metadados
  verificada: boolean('verificada').default(false), // Utente verificado
  util: integer('util').default(0), // Quantas pessoas acharam útil
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Pedidos de Avaliação
 * 
 * Rastreia pedidos de avaliação enviados aos utentes
 */
export const pedidosAvaliacao = pgTable('pedidos_avaliacao', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  utenteId: integer('utenteId').notNull(),
  consultaId: integer('consultaId').notNull(),
  
  // Status
  enviado: boolean('enviado').default(false),
  dataEnvio: timestamp('dataEnvio'),
  
  // Resposta
  respondido: boolean('respondido').default(false),
  dataResposta: timestamp('dataResposta'),
  avaliacaoId: integer('avaliacaoId'), // ID da avaliação criada
  
  // Canal de envio
  canal: text('canal'), // 'email', 'sms', 'whatsapp'
  
  // Token único para link de avaliação
  token: text('token').notNull().unique(),
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Estatísticas de Avaliações
 * 
 * Cache de estatísticas agregadas para performance
 */
export const estatisticasAvaliacoes = pgTable('estatisticas_avaliacoes', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  clinicaId: integer('clinicaId').notNull(),
  dentistaId: integer('dentistaId'), // Null = estatísticas da clínica
  
  // Período
  mes: integer('mes').notNull(), // 1-12
  ano: integer('ano').notNull(),
  
  // Estatísticas
  totalAvaliacoes: integer('totalAvaliacoes').default(0),
  mediaGeral: integer('mediaGeral').default(0), // Média * 100 (para precisão)
  mediaAtendimento: integer('mediaAtendimento').default(0),
  mediaPontualidade: integer('mediaPontualidade').default(0),
  mediaLimpeza: integer('mediaLimpeza').default(0),
  mediaProfissionalismo: integer('mediaProfissionalismo').default(0),
  mediaResultados: integer('mediaResultados').default(0),
  
  // Distribuição de classificações
  estrelas5: integer('estrelas5').default(0),
  estrelas4: integer('estrelas4').default(0),
  estrelas3: integer('estrelas3').default(0),
  estrelas2: integer('estrelas2').default(0),
  estrelas1: integer('estrelas1').default(0),
  
  // Taxa de recomendação
  totalRecomendacoes: integer('totalRecomendacoes').default(0),
  percentagemRecomendacao: integer('percentagemRecomendacao').default(0), // * 100
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

/**
 * Tabela de Respostas a Avaliações
 * 
 * Histórico de respostas e interações
 */
export const respostasAvaliacoes = pgTable('respostas_avaliacoes', {
  id: serial('id').primaryKey(),
  
  // Relacionamentos
  avaliacaoId: integer('avaliacaoId').notNull(),
  respondidoPor: integer('respondidoPor').notNull(), // ID do utilizador
  
  // Conteúdo
  resposta: text('resposta').notNull(),
  
  // Visibilidade
  publica: boolean('publica').default(true),
  
  // Timestamps
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export default {
  avaliacoesUtentes,
  pedidosAvaliacao,
  estatisticasAvaliacoes,
  respostasAvaliacoes,
};

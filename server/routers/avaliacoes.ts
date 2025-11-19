/**
 * Router tRPC para Sistema de Avaliações de Clientes
 */

import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getDb } from '../db';
import {
  avaliacoesUtentes,
  pedidosAvaliacao,
  estatisticasAvaliacoes,
} from '../../drizzle/schema-avaliacoes';
import { utentes, consultas, dentistas } from '../../drizzle/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const avaliacoesRouter = router({
  /**
   * Criar nova avaliação
   */
  criar: protectedProcedure
    .input(
      z.object({
        tipo: z.enum(['consulta', 'dentista', 'clinica', 'procedimento']),
        consultaId: z.number().optional(),
        dentistaId: z.number().optional(),
        procedimentoId: z.number().optional(),
        classificacao: z.number().min(1).max(5),
        atendimento: z.number().min(1).max(5).optional(),
        pontualidade: z.number().min(1).max(5).optional(),
        limpeza: z.number().min(1).max(5).optional(),
        profissionalismo: z.number().min(1).max(5).optional(),
        resultados: z.number().min(1).max(5).optional(),
        titulo: z.string().max(200).optional(),
        comentario: z.string().max(2000).optional(),
        recomendaria: z.boolean().default(true),
        publica: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const clinicaId = ctx.user.clinicaId!;
      
      // Verificar se é um utente
      if (!ctx.user.utenteId) {
        throw new Error('Apenas utentes podem criar avaliações');
      }

      const [avaliacao] = await db
        .insert(avaliacoesUtentes)
        .values({
          clinicaId,
          utenteId: ctx.user.utenteId,
          tipo: input.tipo,
          consultaId: input.consultaId,
          dentistaId: input.dentistaId,
          procedimentoId: input.procedimentoId,
          classificacao: input.classificacao,
          atendimento: input.atendimento,
          pontualidade: input.pontualidade,
          limpeza: input.limpeza,
          profissionalismo: input.profissionalismo,
          resultados: input.resultados,
          titulo: input.titulo,
          comentario: input.comentario,
          recomendaria: input.recomendaria,
          publica: input.publica,
          verificada: true, // Utente autenticado
          aprovada: false, // Requer aprovação da clínica
        })
        .returning();

      // Atualizar estatísticas
      await this.atualizarEstatisticas(db, clinicaId, input.dentistaId);

      return avaliacao;
    }),

  /**
   * Listar avaliações da clínica
   */
  listar: protectedProcedure
    .input(
      z.object({
        tipo: z.enum(['consulta', 'dentista', 'clinica', 'procedimento']).optional(),
        dentistaId: z.number().optional(),
        aprovadas: z.boolean().optional(),
        publicas: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const clinicaId = ctx.user.clinicaId!;

      const conditions = [eq(avaliacoesUtentes.clinicaId, clinicaId)];

      if (input.tipo) {
        conditions.push(eq(avaliacoesUtentes.tipo, input.tipo));
      }

      if (input.dentistaId) {
        conditions.push(eq(avaliacoesUtentes.dentistaId, input.dentistaId));
      }

      if (input.aprovadas !== undefined) {
        conditions.push(eq(avaliacoesUtentes.aprovada, input.aprovadas));
      }

      if (input.publicas !== undefined) {
        conditions.push(eq(avaliacoesUtentes.publica, input.publicas));
      }

      const avaliacoes = await db
        .select({
          avaliacao: avaliacoesUtentes,
          utente: {
            id: utentes.id,
            nome: utentes.nome,
          },
          dentista: {
            id: dentistas.id,
            nome: dentistas.nome,
          },
        })
        .from(avaliacoesUtentes)
        .leftJoin(utentes, eq(avaliacoesUtentes.utenteId, utentes.id))
        .leftJoin(dentistas, eq(avaliacoesUtentes.dentistaId, dentistas.id))
        .where(and(...conditions))
        .orderBy(desc(avaliacoesUtentes.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return avaliacoes;
    }),

  /**
   * Obter detalhes de uma avaliação
   */
  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [avaliacao] = await db
        .select({
          avaliacao: avaliacoesUtentes,
          utente: utentes,
          dentista: dentistas,
          consulta: consultas,
        })
        .from(avaliacoesUtentes)
        .leftJoin(utentes, eq(avaliacoesUtentes.utenteId, utentes.id))
        .leftJoin(dentistas, eq(avaliacoesUtentes.dentistaId, dentistas.id))
        .leftJoin(consultas, eq(avaliacoesUtentes.consultaId, consultas.id))
        .where(
          and(
            eq(avaliacoesUtentes.id, input.id),
            eq(avaliacoesUtentes.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!avaliacao) {
        throw new Error('Avaliação não encontrada');
      }

      return avaliacao;
    }),

  /**
   * Aprovar avaliação
   */
  aprovar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(avaliacoesUtentes)
        .set({
          aprovada: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(avaliacoesUtentes.id, input.id),
            eq(avaliacoesUtentes.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { success: true };
    }),

  /**
   * Responder a avaliação
   */
  responder: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        resposta: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(avaliacoesUtentes)
        .set({
          resposta: input.resposta,
          respondidoPor: ctx.user.id,
          dataResposta: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(avaliacoesUtentes.id, input.id),
            eq(avaliacoesUtentes.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { success: true };
    }),

  /**
   * Enviar pedido de avaliação
   */
  enviarPedido: protectedProcedure
    .input(
      z.object({
        consultaId: z.number(),
        canal: z.enum(['email', 'sms', 'whatsapp']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const clinicaId = ctx.user.clinicaId!;

      // Buscar dados da consulta
      const [consulta] = await db
        .select({
          consulta: consultas,
          utente: utentes,
        })
        .from(consultas)
        .leftJoin(utentes, eq(consultas.utenteId, utentes.id))
        .where(eq(consultas.id, input.consultaId))
        .limit(1);

      if (!consulta || !consulta.utente) {
        throw new Error('Consulta ou utente não encontrado');
      }

      // Gerar token único
      const token = randomBytes(32).toString('hex');

      // Criar pedido de avaliação
      const [pedido] = await db
        .insert(pedidosAvaliacao)
        .values({
          clinicaId,
          utenteId: consulta.utente.id,
          consultaId: input.consultaId,
          canal: input.canal,
          token,
          enviado: false,
        })
        .returning();

      // TODO: Enviar mensagem via canal escolhido
      // const link = `${process.env.APP_URL}/avaliar/${token}`;
      
      return { success: true, pedidoId: pedido.id, token };
    }),

  /**
   * Obter estatísticas de avaliações
   */
  estatisticas: protectedProcedure
    .input(
      z.object({
        dentistaId: z.number().optional(),
        mes: z.number().min(1).max(12).optional(),
        ano: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const clinicaId = ctx.user.clinicaId!;

      // Se não especificou período, calcular em tempo real
      if (!input.mes || !input.ano) {
        const conditions = [eq(avaliacoesUtentes.clinicaId, clinicaId)];

        if (input.dentistaId) {
          conditions.push(eq(avaliacoesUtentes.dentistaId, input.dentistaId));
        }

        const avaliacoes = await db
          .select()
          .from(avaliacoesUtentes)
          .where(and(...conditions));

        // Calcular estatísticas
        const total = avaliacoes.length;
        
        if (total === 0) {
          return {
            totalAvaliacoes: 0,
            mediaGeral: 0,
            distribuicao: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            percentagemRecomendacao: 0,
          };
        }

        const somaClassificacoes = avaliacoes.reduce((sum, a) => sum + a.classificacao, 0);
        const mediaGeral = somaClassificacoes / total;

        const distribuicao = {
          5: avaliacoes.filter(a => a.classificacao === 5).length,
          4: avaliacoes.filter(a => a.classificacao === 4).length,
          3: avaliacoes.filter(a => a.classificacao === 3).length,
          2: avaliacoes.filter(a => a.classificacao === 2).length,
          1: avaliacoes.filter(a => a.classificacao === 1).length,
        };

        const recomendacoes = avaliacoes.filter(a => a.recomendaria).length;
        const percentagemRecomendacao = (recomendacoes / total) * 100;

        return {
          totalAvaliacoes: total,
          mediaGeral: Math.round(mediaGeral * 100) / 100,
          distribuicao,
          percentagemRecomendacao: Math.round(percentagemRecomendacao),
        };
      }

      // Buscar estatísticas pré-calculadas
      const conditions = [
        eq(estatisticasAvaliacoes.clinicaId, clinicaId),
        eq(estatisticasAvaliacoes.mes, input.mes),
        eq(estatisticasAvaliacoes.ano, input.ano),
      ];

      if (input.dentistaId) {
        conditions.push(eq(estatisticasAvaliacoes.dentistaId, input.dentistaId));
      } else {
        conditions.push(sql`${estatisticasAvaliacoes.dentistaId} IS NULL`);
      }

      const [stats] = await db
        .select()
        .from(estatisticasAvaliacoes)
        .where(and(...conditions))
        .limit(1);

      if (!stats) {
        return {
          totalAvaliacoes: 0,
          mediaGeral: 0,
          distribuicao: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          percentagemRecomendacao: 0,
        };
      }

      return {
        totalAvaliacoes: stats.totalAvaliacoes,
        mediaGeral: stats.mediaGeral / 100,
        distribuicao: {
          5: stats.estrelas5,
          4: stats.estrelas4,
          3: stats.estrelas3,
          2: stats.estrelas2,
          1: stats.estrelas1,
        },
        percentagemRecomendacao: stats.percentagemRecomendacao / 100,
      };
    }),

  /**
   * Avaliar via link público (sem autenticação)
   */
  avaliarViaLink: publicProcedure
    .input(
      z.object({
        token: z.string(),
        classificacao: z.number().min(1).max(5),
        atendimento: z.number().min(1).max(5).optional(),
        pontualidade: z.number().min(1).max(5).optional(),
        limpeza: z.number().min(1).max(5).optional(),
        profissionalismo: z.number().min(1).max(5).optional(),
        resultados: z.number().min(1).max(5).optional(),
        titulo: z.string().max(200).optional(),
        comentario: z.string().max(2000).optional(),
        recomendaria: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Buscar pedido de avaliação
      const [pedido] = await db
        .select()
        .from(pedidosAvaliacao)
        .where(eq(pedidosAvaliacao.token, input.token))
        .limit(1);

      if (!pedido) {
        throw new Error('Link de avaliação inválido');
      }

      if (pedido.respondido) {
        throw new Error('Este link já foi utilizado');
      }

      // Criar avaliação
      const [avaliacao] = await db
        .insert(avaliacoesUtentes)
        .values({
          clinicaId: pedido.clinicaId,
          utenteId: pedido.utenteId,
          consultaId: pedido.consultaId,
          tipo: 'consulta',
          classificacao: input.classificacao,
          atendimento: input.atendimento,
          pontualidade: input.pontualidade,
          limpeza: input.limpeza,
          profissionalismo: input.profissionalismo,
          resultados: input.resultados,
          titulo: input.titulo,
          comentario: input.comentario,
          recomendaria: input.recomendaria,
          publica: true,
          verificada: true,
          aprovada: false,
        })
        .returning();

      // Marcar pedido como respondido
      await db
        .update(pedidosAvaliacao)
        .set({
          respondido: true,
          dataResposta: new Date(),
          avaliacaoId: avaliacao.id,
        })
        .where(eq(pedidosAvaliacao.id, pedido.id));

      return { success: true, avaliacaoId: avaliacao.id };
    }),
});

/**
 * Função auxiliar para atualizar estatísticas
 */
async function atualizarEstatisticas(
  db: any,
  clinicaId: number,
  dentistaId?: number
): Promise<void> {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();

  // TODO: Implementar cálculo e atualização de estatísticas
  // Esta função deve ser chamada periodicamente (cron job)
}

export default avaliacoesRouter;

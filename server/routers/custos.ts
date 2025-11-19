/**
 * Router tRPC para Sistema de Controlo de Custos
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getDb } from '../db';
import {
  custosOperacionais,
  custosProcedimento,
  orcamentos,
  relatoriosFinanceiros,
  alertasCustos,
} from '../../drizzle/schema-custos';
import { faturas, itensFatura, procedimentos } from '../../drizzle/schema';
import { eq, and, desc, sql, gte, lte, sum } from 'drizzle-orm';

export const custosRouter = router({
  /**
   * Criar novo custo operacional
   */
  criar: protectedProcedure
    .input(
      z.object({
        descricao: z.string().min(1).max(500),
        categoria: z.enum([
          'fixo',
          'variavel',
          'material',
          'equipamento',
          'pessoal',
          'marketing',
          'administrativo',
          'infraestrutura',
          'formacao',
          'outro',
        ]),
        subcategoria: z.string().max(200).optional(),
        valor: z.number().positive(),
        quantidade: z.number().positive().default(1),
        tipoPagamento: z.enum(['unico', 'mensal', 'trimestral', 'semestral', 'anual']).default('unico'),
        recorrente: z.boolean().default(false),
        dataCompra: z.coerce.date(),
        dataVencimento: z.coerce.date().optional(),
        fornecedor: z.string().max(200).optional(),
        numeroFatura: z.string().max(100).optional(),
        procedimentoId: z.number().optional(),
        observacoes: z.string().max(2000).optional(),
        // Campos específicos para materiais
        quantidadeEstoque: z.number().optional(),
        quantidadeMinima: z.number().optional(),
        unidadeMedida: z.string().max(50).optional(),
        // Campos específicos para equipamentos
        vidaUtil: z.number().optional(),
        valorResidual: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      const valorTotal = input.valor * input.quantidade;
      
      // Calcular amortização mensal para equipamentos
      let amortizacaoMensal = null;
      if (input.categoria === 'equipamento' && input.vidaUtil) {
        const valorAmortizavel = valorTotal - (input.valorResidual || 0);
        amortizacaoMensal = valorAmortizavel / input.vidaUtil;
      }

      const [custo] = await db
        .insert(custosOperacionais)
        .values({
          clinicaId,
          descricao: input.descricao,
          categoria: input.categoria,
          subcategoria: input.subcategoria,
          valor: input.valor.toString(),
          quantidade: input.quantidade.toString(),
          valorTotal: valorTotal.toString(),
          tipoPagamento: input.tipoPagamento,
          recorrente: input.recorrente,
          dataCompra: input.dataCompra,
          dataVencimento: input.dataVencimento,
          fornecedor: input.fornecedor,
          numeroFatura: input.numeroFatura,
          procedimentoId: input.procedimentoId,
          observacoes: input.observacoes,
          quantidadeEstoque: input.quantidadeEstoque?.toString(),
          quantidadeMinima: input.quantidadeMinima?.toString(),
          unidadeMedida: input.unidadeMedida,
          vidaUtil: input.vidaUtil,
          valorResidual: input.valorResidual?.toString(),
          amortizacaoMensal: amortizacaoMensal?.toString(),
          pago: false,
          criadoPor: ctx.user.id,
        })
        .returning();

      // Verificar alertas de estoque
      if (input.quantidadeEstoque && input.quantidadeMinima) {
        if (input.quantidadeEstoque <= input.quantidadeMinima) {
          await db.insert(alertasCustos).values({
            clinicaId,
            custoId: custo.id,
            tipo: 'estoque_baixo',
            severidade: 'warning',
            titulo: 'Estoque Baixo',
            mensagem: `O material "${input.descricao}" está com estoque baixo (${input.quantidadeEstoque} ${input.unidadeMedida || 'unidades'}).`,
          });
        }
      }

      return custo;
    }),

  /**
   * Listar custos operacionais
   */
  listar: protectedProcedure
    .input(
      z.object({
        categoria: z.enum([
          'fixo',
          'variavel',
          'material',
          'equipamento',
          'pessoal',
          'marketing',
          'administrativo',
          'infraestrutura',
          'formacao',
          'outro',
        ]).optional(),
        dataInicio: z.coerce.date().optional(),
        dataFim: z.coerce.date().optional(),
        pago: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      const conditions = [eq(custosOperacionais.clinicaId, clinicaId)];

      if (input.categoria) {
        conditions.push(eq(custosOperacionais.categoria, input.categoria));
      }

      if (input.dataInicio) {
        conditions.push(gte(custosOperacionais.dataCompra, input.dataInicio));
      }

      if (input.dataFim) {
        conditions.push(lte(custosOperacionais.dataCompra, input.dataFim));
      }

      if (input.pago !== undefined) {
        conditions.push(eq(custosOperacionais.pago, input.pago));
      }

      const custos = await db
        .select()
        .from(custosOperacionais)
        .where(and(...conditions))
        .orderBy(desc(custosOperacionais.dataCompra))
        .limit(input.limit)
        .offset(input.offset);

      return custos;
    }),

  /**
   * Marcar custo como pago
   */
  marcarPago: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        dataPagamento: z.coerce.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      await db
        .update(custosOperacionais)
        .set({
          pago: true,
          dataPagamento: input.dataPagamento,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(custosOperacionais.id, input.id),
            eq(custosOperacionais.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { success: true };
    }),

  /**
   * Atualizar estoque de material
   */
  atualizarEstoque: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        quantidade: z.number(),
        operacao: z.enum(['adicionar', 'remover', 'definir']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Buscar custo atual
      const [custo] = await db
        .select()
        .from(custosOperacionais)
        .where(
          and(
            eq(custosOperacionais.id, input.id),
            eq(custosOperacionais.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!custo) {
        throw new Error('Custo não encontrado');
      }

      const estoqueAtual = parseFloat(custo.quantidadeEstoque || '0');
      let novoEstoque = estoqueAtual;

      if (input.operacao === 'adicionar') {
        novoEstoque = estoqueAtual + input.quantidade;
      } else if (input.operacao === 'remover') {
        novoEstoque = Math.max(0, estoqueAtual - input.quantidade);
      } else {
        novoEstoque = input.quantidade;
      }

      await db
        .update(custosOperacionais)
        .set({
          quantidadeEstoque: novoEstoque.toString(),
          updatedAt: new Date(),
        })
        .where(eq(custosOperacionais.id, input.id));

      // Verificar alerta de estoque baixo
      const quantidadeMinima = parseFloat(custo.quantidadeMinima || '0');
      if (novoEstoque <= quantidadeMinima && quantidadeMinima > 0) {
        await db.insert(alertasCustos).values({
          clinicaId: ctx.user.clinicaId!,
          custoId: custo.id,
          tipo: 'estoque_baixo',
          severidade: 'warning',
          titulo: 'Estoque Baixo',
          mensagem: `O material "${custo.descricao}" está com estoque baixo (${novoEstoque} ${custo.unidadeMedida || 'unidades'}).`,
        });
      }

      return { success: true, novoEstoque };
    }),

  /**
   * Calcular margem de lucro de procedimento
   */
  calcularMargemProcedimento: protectedProcedure
    .input(
      z.object({
        procedimentoId: z.number(),
        custoMateriais: z.number().default(0),
        custoMaoObra: z.number().default(0),
        custoEquipamento: z.number().default(0),
        custoOutros: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      // Buscar preço do procedimento
      const [procedimento] = await db
        .select()
        .from(procedimentos)
        .where(eq(procedimentos.id, input.procedimentoId))
        .limit(1);

      if (!procedimento) {
        throw new Error('Procedimento não encontrado');
      }

      const precoVenda = parseFloat(procedimento.precoBase);
      const custoTotal = input.custoMateriais + input.custoMaoObra + input.custoEquipamento + input.custoOutros;
      const margemLucro = precoVenda - custoTotal;
      const percentagemMargem = (margemLucro / precoVenda) * 100;

      // Salvar custo do procedimento
      const [custoProcedimento] = await db
        .insert(custosProcedimento)
        .values({
          clinicaId,
          procedimentoId: input.procedimentoId,
          custoMateriais: input.custoMateriais.toString(),
          custoMaoObra: input.custoMaoObra.toString(),
          custoEquipamento: input.custoEquipamento.toString(),
          custoOutros: input.custoOutros.toString(),
          custoTotal: custoTotal.toString(),
          precoVenda: precoVenda.toString(),
          margemLucro: margemLucro.toString(),
          percentagemMargem: percentagemMargem.toString(),
        })
        .returning();

      return {
        custoTotal,
        precoVenda,
        margemLucro,
        percentagemMargem: Math.round(percentagemMargem * 100) / 100,
      };
    }),

  /**
   * Gerar relatório financeiro mensal
   */
  relatorioMensal: protectedProcedure
    .input(
      z.object({
        mes: z.number().min(1).max(12),
        ano: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      // Calcular datas do período
      const dataInicio = new Date(input.ano, input.mes - 1, 1);
      const dataFim = new Date(input.ano, input.mes, 0);

      // Buscar receitas (faturas pagas)
      const faturasResult = await db
        .select({
          total: sum(faturas.valorTotal),
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            eq(faturas.estado, 'paga'),
            gte(faturas.dataFatura, dataInicio),
            lte(faturas.dataFatura, dataFim)
          )
        );

      const receitaTotal = parseFloat(faturasResult[0]?.total || '0');

      // Buscar custos
      const custosResult = await db
        .select({
          total: sum(custosOperacionais.valorTotal),
        })
        .from(custosOperacionais)
        .where(
          and(
            eq(custosOperacionais.clinicaId, clinicaId),
            gte(custosOperacionais.dataCompra, dataInicio),
            lte(custosOperacionais.dataCompra, dataFim)
          )
        );

      const custoTotal = parseFloat(custosResult[0]?.total || '0');

      // Calcular lucro e margem
      const lucroLiquido = receitaTotal - custoTotal;
      const margemLucro = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;

      // Buscar orçamento
      const [orcamento] = await db
        .select()
        .from(orcamentos)
        .where(
          and(
            eq(orcamentos.clinicaId, clinicaId),
            eq(orcamentos.mes, input.mes),
            eq(orcamentos.ano, input.ano)
          )
        )
        .limit(1);

      let variacaoOrcamento = null;
      let percentagemVariacao = null;

      if (orcamento) {
        const orcamentoTotal = parseFloat(orcamento.orcamentoTotal);
        variacaoOrcamento = custoTotal - orcamentoTotal;
        percentagemVariacao = (variacaoOrcamento / orcamentoTotal) * 100;
      }

      return {
        mes: input.mes,
        ano: input.ano,
        receitaTotal,
        custoTotal,
        lucroLiquido,
        margemLucro: Math.round(margemLucro * 100) / 100,
        orcamentoTotal: orcamento ? parseFloat(orcamento.orcamentoTotal) : null,
        variacaoOrcamento,
        percentagemVariacao: percentagemVariacao ? Math.round(percentagemVariacao * 100) / 100 : null,
      };
    }),

  /**
   * Criar orçamento
   */
  criarOrcamento: protectedProcedure
    .input(
      z.object({
        mes: z.number().min(1).max(12),
        ano: z.number(),
        orcamentoFixo: z.number().default(0),
        orcamentoVariavel: z.number().default(0),
        orcamentoMaterial: z.number().default(0),
        orcamentoEquipamento: z.number().default(0),
        orcamentoPessoal: z.number().default(0),
        orcamentoMarketing: z.number().default(0),
        orcamentoAdministrativo: z.number().default(0),
        orcamentoInfraestrutura: z.number().default(0),
        orcamentoFormacao: z.number().default(0),
        orcamentoOutros: z.number().default(0),
        receitaPrevista: z.number().optional(),
        observacoes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      const orcamentoTotal =
        input.orcamentoFixo +
        input.orcamentoVariavel +
        input.orcamentoMaterial +
        input.orcamentoEquipamento +
        input.orcamentoPessoal +
        input.orcamentoMarketing +
        input.orcamentoAdministrativo +
        input.orcamentoInfraestrutura +
        input.orcamentoFormacao +
        input.orcamentoOutros;

      const lucroPrevisto = input.receitaPrevista ? input.receitaPrevista - orcamentoTotal : null;

      const [orcamento] = await db
        .insert(orcamentos)
        .values({
          clinicaId,
          mes: input.mes,
          ano: input.ano,
          orcamentoFixo: input.orcamentoFixo.toString(),
          orcamentoVariavel: input.orcamentoVariavel.toString(),
          orcamentoMaterial: input.orcamentoMaterial.toString(),
          orcamentoEquipamento: input.orcamentoEquipamento.toString(),
          orcamentoPessoal: input.orcamentoPessoal.toString(),
          orcamentoMarketing: input.orcamentoMarketing.toString(),
          orcamentoAdministrativo: input.orcamentoAdministrativo.toString(),
          orcamentoInfraestrutura: input.orcamentoInfraestrutura.toString(),
          orcamentoFormacao: input.orcamentoFormacao.toString(),
          orcamentoOutros: input.orcamentoOutros.toString(),
          orcamentoTotal: orcamentoTotal.toString(),
          receitaPrevista: input.receitaPrevista?.toString(),
          lucroPrevisto: lucroPrevisto?.toString(),
          observacoes: input.observacoes,
        })
        .returning();

      return orcamento;
    }),

  /**
   * Listar alertas de custos
   */
  listarAlertas: protectedProcedure
    .input(
      z.object({
        lido: z.boolean().optional(),
        resolvido: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const clinicaId = ctx.user.clinicaId!;

      const conditions = [eq(alertasCustos.clinicaId, clinicaId)];

      if (input.lido !== undefined) {
        conditions.push(eq(alertasCustos.lido, input.lido));
      }

      if (input.resolvido !== undefined) {
        conditions.push(eq(alertasCustos.resolvido, input.resolvido));
      }

      const alertas = await db
        .select()
        .from(alertasCustos)
        .where(and(...conditions))
        .orderBy(desc(alertasCustos.createdAt))
        .limit(input.limit);

      return alertas;
    }),

  /**
   * Marcar alerta como lido
   */
  marcarAlertaLido: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      await db
        .update(alertasCustos)
        .set({ lido: true, updatedAt: new Date() })
        .where(
          and(
            eq(alertasCustos.id, input.id),
            eq(alertasCustos.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { success: true };
    }),
});

export default custosRouter;

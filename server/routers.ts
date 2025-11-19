import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as dbGraficos from "./db-graficos";
import * as notificacoes from "./notificacoes";
import * as relatorios from "./relatorios";
import * as stripeService from "./stripe-service";
import * as validacoesAgenda from "./validacoes-agenda";
import { aiAssistantRouter } from "./routers/ai-assistant";
import { contabilidadeRouter } from "./routers/contabilidade";
import { lembretesConfigRouter } from "./routers/lembretes-config";
import { relatoriosAvancadosRouter } from "./routers/relatorios-avancados";
import { imagensRouter } from "./routers/imagens";
import { notasRouter } from "./routers/notas";
import { prescricoesRouter } from "./routers/prescricoes";
import { whatsappRouter } from "./routers/whatsapp";
import { notificacoesSistemaRouter } from "./routers/notificacoes-sistema";
import { biRouter } from "./routes/bi";
import { pagamentosRouter } from "./routes/pagamentos";
import { notificacoesRouter } from "./routes/notificacoes";
import { getDb } from "./db";
import { 
  clinicas, 
  utentes, 
  dentistas, 
  consultas, 
  procedimentos, 
  categoriasProcedimento,
  faturas,
  itensFatura,
  pagamentosFatura,
  historicoMedico,
  planosAssinatura,
  assinaturasClinica,
  registosClinica,
  templatesMensagem,
  mensagensUtente,
  configuracoesFinanceiras
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * DentCarePro SaaS - Complete tRPC API
 * 
 * Routers organizados por funcionalidade:
 * - auth: Autenticação
 * - clinicas: Gestão de clínicas
 * - utentes: Gestão de utentes (pacientes)
 * - dentistas: Gestão de dentistas
 * - consultas: Agendamento e consultas
 * - procedimentos: Procedimentos e categorias
 * - faturas: Faturação e pagamentos
 * - saas: Planos, assinaturas e métricas
 * - dashboard: Estatísticas e relatórios
 */

export const appRouter = router({
  system: systemRouter,
  
  // ============================================
  // AUTENTICAÇÃO
  // ============================================
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // CLÍNICAS
  // ============================================
  clinicas: router({
    // Listar clínicas do utilizador
    minhas: protectedProcedure.query(async ({ ctx }) => {
      return await db.getClinicasByUserId(ctx.user.id);
    }),

    // Obter detalhes de uma clínica
    porId: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getClinicaById(input.clinicaId);
      }),

    // Criar nova clínica
    criar: protectedProcedure
      .input(z.object({
        nome: z.string().min(2),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        morada: z.string().optional(),
        cidade: z.string().optional(),
        codigoPostal: z.string().optional(),
        pais: z.string().default("PT"),
        nif: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const [result] = await database.insert(clinicas).values({
          ...input,
          proprietarioId: ctx.user.id,
        }).returning();

        return { id: result.id, success: true };
      }),

    // Atualizar clínica
    atualizar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        nome: z.string().min(2).optional(),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        morada: z.string().optional(),
        cidade: z.string().optional(),
        codigoPostal: z.string().optional(),
        nif: z.string().optional(),
        logoUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { clinicaId, ...data } = input;
        await database
          .update(clinicas)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(clinicas.id, clinicaId));

        return { success: true };
      }),
  }),

  // ============================================
  // UTENTES (PACIENTES)
  // ============================================
  utentes: router({
    // Listar utentes
    listar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        pesquisa: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getUtentesByClinica(input.clinicaId, input.pesquisa);
      }),

    // Obter utente por ID
    porId: protectedProcedure
      .input(z.object({
        utenteId: z.number(),
        clinicaId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getUtenteById(input.utenteId, input.clinicaId);
      }),

    // Criar utente
    criar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        nome: z.string().min(2),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        dataNascimento: z.date().optional(),
        genero: z.enum(["masculino", "feminino", "outro"]).optional(),
        morada: z.string().optional(),
        cidade: z.string().optional(),
        codigoPostal: z.string().optional(),
        pais: z.string().default("PT"),
        nif: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        // Gerar número de utente automático
        const ultimoUtente = await database
          .select()
          .from(utentes)
          .where(eq(utentes.clinicaId, input.clinicaId))
          .orderBy(desc(utentes.id))
          .limit(1);

        const proximoNumero = ultimoUtente.length > 0 
          ? parseInt(ultimoUtente[0].numeroUtente.replace(/\D/g, '')) + 1 
          : 1;
        
        const numeroUtente = `UT${proximoNumero.toString().padStart(6, '0')}`;

        const [result] = await database.insert(utentes).values({
          clinicaId: input.clinicaId,
          numeroUtente,
          nome: input.nome,
          email: input.email || null,
          telemovel: input.telemovel || "",
          dataNascimento: input.dataNascimento || null,
          genero: input.genero || null,
          morada: input.morada || null,
          cidade: input.cidade || null,
          codigoPostal: input.codigoPostal || null,
          pais: input.pais,
          nif: input.nif || null,
          observacoes: input.observacoes || null,
        }).returning();

        return { id: result.id, numeroUtente, success: true };
      }),

    // Atualizar utente
    atualizar: protectedProcedure
      .input(z.object({
        utenteId: z.number(),
        clinicaId: z.number(),
        nome: z.string().min(2).optional(),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        dataNascimento: z.date().optional(),
        genero: z.enum(["masculino", "feminino", "outro"]).optional(),
        morada: z.string().optional(),
        cidade: z.string().optional(),
        codigoPostal: z.string().optional(),
        nif: z.string().optional(),
        observacoes: z.string().optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { utenteId, clinicaId, ...data } = input;
        await database
          .update(utentes)
          .set({ ...data, updatedAt: new Date() })
          .where(and(
            eq(utentes.id, utenteId),
            eq(utentes.clinicaId, clinicaId)
          ));

        return { success: true };
      }),

    // Obter histórico médico
    historicoMedico: protectedProcedure
      .input(z.object({ utenteId: z.number() }))
      .query(async ({ input }) => {
        return await db.getHistoricoMedicoByUtente(input.utenteId);
      }),

    // Atualizar histórico médico
    atualizarHistorico: protectedProcedure
      .input(z.object({
        utenteId: z.number(),
        alergias: z.string().optional(),
        medicamentos: z.string().optional(),
        condicoesMedicas: z.string().optional(),
        cirurgiasPrevias: z.string().optional(),
        historicoFamiliar: z.string().optional(),
        estadoTabagismo: z.enum(["nunca", "ex_fumador", "fumador"]).optional(),
        consumoAlcool: z.enum(["nunca", "ocasional", "regular"]).optional(),
        tipoSanguineo: z.string().optional(),
        contatoEmergenciaNome: z.string().optional(),
        contatoEmergenciaTelemovel: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { utenteId, ...data } = input;

        // Verificar se já existe histórico
        const existente = await db.getHistoricoMedicoByUtente(utenteId);

        if (existente) {
          await database
            .update(historicoMedico)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(historicoMedico.utenteId, utenteId));
        } else {
          await database.insert(historicoMedico).values({
            utenteId,
            ...data,
          });
        }

        return { success: true };
      }),
  }),

  // ============================================
  // DENTISTAS
  // ============================================
  dentistas: router({
    // Listar dentistas
    listar: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDentistasByClinica(input.clinicaId);
      }),

    // Obter dentista por ID
    porId: protectedProcedure
      .input(z.object({
        dentistaId: z.number(),
        clinicaId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getDentistaById(input.dentistaId, input.clinicaId);
      }),

    // Criar dentista
    criar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        nome: z.string().min(2),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        especializacao: z.string().optional(),
        numeroCedula: z.string().optional(),
        percentagemComissao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const [result] = await database.insert(dentistas).values(input).returning();

        return { id: result.id, success: true };
      }),

    // Atualizar dentista
    atualizar: protectedProcedure
      .input(z.object({
        id: z.number(),
        clinicaId: z.number(),
        nome: z.string().min(2).optional(),
        email: z.string().email().optional(),
        telemovel: z.string().optional(),
        especializacao: z.string().optional(),
        numeroCedula: z.string().optional(),
        percentagemComissao: z.string().optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { id, clinicaId, ...data } = input;
        await database
          .update(dentistas)
          .set({ ...data, updatedAt: new Date() })
          .where(and(
            eq(dentistas.id, id),
            eq(dentistas.clinicaId, clinicaId)
          ));

        return { success: true };
      }),

    // Eliminar dentista (soft delete)
    eliminar: protectedProcedure
      .input(z.object({
        id: z.number(),
        clinicaId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        await database
          .update(dentistas)
          .set({ ativo: false, updatedAt: new Date() })
          .where(and(
            eq(dentistas.id, input.id),
            eq(dentistas.clinicaId, input.clinicaId)
          ));

        return { success: true };
      }),
  }),

  // ============================================
  // PROCEDIMENTOS
  // ============================================
  procedimentos: router({
    // Listar procedimentos
    listar: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProcedimentosByClinica(input.clinicaId);
      }),

    // Listar categorias
    categorias: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCategoriasProcedimentoByClinica(input.clinicaId);
      }),

    // Criar procedimento
    criar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        categoriaId: z.number().optional(),
        codigo: z.string().optional(),
        nome: z.string().min(2),
        descricao: z.string().optional(),
        precoBase: z.string(),
        duracaoMinutos: z.number().default(30),
        cor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const [result] = await database.insert(procedimentos).values(input).returning();

        return { id: result.id, success: true };
      }),

    // Criar categoria
    criarCategoria: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        nome: z.string().min(2),
        descricao: z.string().optional(),
        cor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const [result] = await database.insert(categoriasProcedimento).values(input).returning();

        return { id: result.id, success: true };
      }),

    // Atualizar procedimento
    atualizar: protectedProcedure
      .input(z.object({
        id: z.number(),
        clinicaId: z.number(),
        categoriaId: z.number().optional(),
        codigo: z.string().optional(),
        nome: z.string().min(2).optional(),
        descricao: z.string().optional(),
        precoBase: z.string().optional(),
        duracaoMinutos: z.number().optional(),
        cor: z.string().optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { id, clinicaId, ...data } = input;
        await database
          .update(procedimentos)
          .set({ ...data, updatedAt: new Date() })
          .where(and(
            eq(procedimentos.id, id),
            eq(procedimentos.clinicaId, clinicaId)
          ));

        return { success: true };
      }),

    // Eliminar procedimento (soft delete)
    eliminar: protectedProcedure
      .input(z.object({
        id: z.number(),
        clinicaId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        await database
          .update(procedimentos)
          .set({ ativo: false, updatedAt: new Date() })
          .where(and(
            eq(procedimentos.id, input.id),
            eq(procedimentos.clinicaId, input.clinicaId)
          ));

        return { success: true };
      }),
  }),

  // ============================================
  // CONSULTAS
  // ============================================
  consultas: router({
    // Listar consultas de um utente
    porUtente: protectedProcedure
      .input(z.object({
        utenteId: z.number(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const resultado = await database
          .select({
            id: consultas.id,
            dataHora: consultas.horaInicio,
            tipo: consultas.tipo,
            estado: consultas.estado,
            observacoes: consultas.observacoes,
            dentista: {
              id: dentistas.id,
              nome: dentistas.nome,
            },
          })
          .from(consultas)
          .leftJoin(dentistas, eq(consultas.dentistaId, dentistas.id))
          .where(
            and(
              eq(consultas.utenteId, input.utenteId),
              eq(consultas.clinicaId, ctx.user.clinicaId!)
            )
          )
          .orderBy(desc(consultas.horaInicio))
          .limit(input.limit);

        return resultado;
      }),

    // Listar consultas por período
    listarPorPeriodo: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
        dentistaId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getConsultasByPeriod(
          input.clinicaId,
          input.dataInicio,
          input.dataFim,
          input.dentistaId
        );
      }),

    // Obter consulta por ID
    porId: protectedProcedure
      .input(z.object({
        consultaId: z.number(),
        clinicaId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getConsultaById(input.consultaId, input.clinicaId);
      }),

    // Criar consulta
    criar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        utenteId: z.number(),
        dentistaId: z.number(),
        procedimentoId: z.number().optional(),
        horaInicio: z.date(),
        horaFim: z.date(),
        titulo: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const [result] = await database.insert(consultas).values({
          clinicaId: input.clinicaId,
          utenteId: input.utenteId,
          dentistaId: input.dentistaId,
          procedimentoId: input.procedimentoId || null,
          horaInicio: input.horaInicio,
          horaFim: input.horaFim,
          estado: "agendada",
          titulo: input.titulo || null,
          observacoes: input.observacoes || null,
        }).returning();

        return { id: result.id, success: true };
      }),

    // Atualizar consulta
    atualizar: protectedProcedure
      .input(z.object({
        consultaId: z.number(),
        clinicaId: z.number(),
        utenteId: z.number().optional(),
        dentistaId: z.number().optional(),
        procedimentoId: z.number().optional(),
        horaInicio: z.date().optional(),
        horaFim: z.date().optional(),
        estado: z.enum(["agendada", "confirmada", "em_curso", "concluida", "cancelada", "faltou"]).optional(),
        titulo: z.string().optional(),
        observacoes: z.string().optional(),
        motivoCancelamento: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { consultaId, clinicaId, ...data } = input;

        // Atualizar timestamps baseado no estado
        const updates: any = { ...data, updatedAt: new Date() };
        
        if (data.estado === "confirmada") {
          updates.confirmadaEm = new Date();
        } else if (data.estado === "concluida") {
          updates.concluidaEm = new Date();
        } else if (data.estado === "cancelada") {
          updates.canceladaEm = new Date();
        }

        await database
          .update(consultas)
          .set(updates)
          .where(and(
            eq(consultas.id, consultaId),
            eq(consultas.clinicaId, clinicaId)
          ));

        return { success: true };
      }),

    // Cancelar consulta
    cancelar: protectedProcedure
      .input(z.object({
        consultaId: z.number(),
        clinicaId: z.number(),
        motivo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        await database
          .update(consultas)
          .set({
            estado: "cancelada",
            motivoCancelamento: input.motivo,
            canceladaEm: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(consultas.id, input.consultaId),
            eq(consultas.clinicaId, input.clinicaId)
          ));

        return { success: true };
      }),

    // Validar agendamento
    validarAgendamento: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dentistaId: z.number(),
        utenteId: z.number(),
        horaInicio: z.date(),
        horaFim: z.date(),
        consultaIdExcluir: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await validacoesAgenda.validarAgendamentoCompleto(input);
      }),

    // Sugerir horários alternativos
    sugerirHorarios: protectedProcedure
      .input(z.object({
        dentistaId: z.number(),
        dataDesejada: z.date(),
        duracao: z.number(),
        quantidade: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await validacoesAgenda.sugerirHorariosAlternativos(input);
      }),

    // Verificar disponibilidade do dentista
    verificarDisponibilidade: protectedProcedure
      .input(z.object({
        dentistaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await validacoesAgenda.verificarDisponibilidadeDentista(input);
      }),
  }),

  // ============================================
  // FATURAS
  // ============================================
  faturas: router({
    // Listar pagamentos de um utente
    pagamentosUtente: protectedProcedure
      .input(z.object({
        utenteId: z.number(),
        clinicaId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        // Usar clinicaId do input ou do contexto
        const clinicaId = input.clinicaId || ctx.user.clinicaId;
        if (!clinicaId) throw new Error("Clínica não especificada");

        const resultado = await database
          .select({
            id: pagamentosFatura.id,
            faturaId: pagamentosFatura.faturaId,
            valor: pagamentosFatura.valor,
            metodoPagamento: pagamentosFatura.metodoPagamento,
            dataPagamento: pagamentosFatura.dataPagamento,
            referencia: pagamentosFatura.referencia,
            observacoes: pagamentosFatura.observacoes,
            fatura: {
              numero: faturas.numeroFatura,
            },
          })
          .from(pagamentosFatura)
          .innerJoin(faturas, eq(pagamentosFatura.faturaId, faturas.id))
          .where(
            and(
              eq(faturas.utenteId, input.utenteId),
              eq(faturas.clinicaId, clinicaId)
            )
          )
          .orderBy(desc(pagamentosFatura.dataPagamento));

        return resultado;
      }),

    // Listar faturas
    listar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        utenteId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getFaturasByClinica(input.clinicaId, input.utenteId);
      }),

    // Obter fatura por ID
    porId: protectedProcedure
      .input(z.object({
        faturaId: z.number(),
        clinicaId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getFaturaById(input.faturaId, input.clinicaId);
      }),

    // Criar fatura
    criar: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        utenteId: z.number(),
        consultaId: z.number().optional(),
        dataFatura: z.date(),
        dataVencimento: z.date().optional(),
        percentagemIVA: z.string().default("0"),
        valorDesconto: z.string().default("0"),
        observacoes: z.string().optional(),
        itens: z.array(z.object({
          procedimentoId: z.number().optional(),
          descricao: z.string(),
          quantidade: z.number().default(1),
          precoUnitario: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        // Gerar número de fatura
        const ultimaFatura = await database
          .select()
          .from(faturas)
          .where(eq(faturas.clinicaId, input.clinicaId))
          .orderBy(desc(faturas.id))
          .limit(1);

        const proximoNumero = ultimaFatura.length > 0 
          ? parseInt(ultimaFatura[0].numeroFatura.replace(/\D/g, '')) + 1 
          : 1;
        
        const ano = new Date().getFullYear();
        const numeroFatura = `FT${ano}/${proximoNumero.toString().padStart(5, '0')}`;

        // Calcular totais
        let subtotal = 0;
        input.itens.forEach(item => {
          subtotal += parseFloat(item.precoUnitario) * item.quantidade;
        });

        const valorIVA = subtotal * (parseFloat(input.percentagemIVA) / 100);
        const valorTotal = subtotal + valorIVA - parseFloat(input.valorDesconto);

        // Criar fatura
        const [faturaResult] = await database.insert(faturas).values({
          clinicaId: input.clinicaId,
          utenteId: input.utenteId,
          consultaId: input.consultaId,
          numeroFatura,
          dataFatura: input.dataFatura,
          dataVencimento: input.dataVencimento,
          subtotal: subtotal.toFixed(2),
          valorIVA: valorIVA.toFixed(2),
          percentagemIVA: input.percentagemIVA,
          valorDesconto: input.valorDesconto,
          valorTotal: valorTotal.toFixed(2),
          valorPago: "0",
          estado: "rascunho",
          observacoes: input.observacoes,
        });

        // Criar itens da fatura
        for (const item of input.itens) {
          const precoTotal = parseFloat(item.precoUnitario) * item.quantidade;
          
          await database.insert(itensFatura).values({
            faturaId: faturaResult.insertId,
            procedimentoId: item.procedimentoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            precoTotal: precoTotal.toFixed(2),
          });
        }

        return { id: faturaResult.insertId, numeroFatura, success: true };
      }),

    // Registrar pagamento
    registrarPagamento: protectedProcedure
      .input(z.object({
        faturaId: z.number(),
        clinicaId: z.number(),
        valor: z.string(),
        metodoPagamento: z.enum(["dinheiro", "cartao", "transferencia", "mbway", "multibanco", "outro"]),
        dataPagamento: z.date(),
        referencia: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new Error("Database not available");

        const { faturaId, clinicaId, ...pagamentoData } = input;

        // Registrar pagamento
        await database.insert(pagamentosFatura).values({
          faturaId,
          ...pagamentoData,
        });

        // Atualizar valor pago da fatura
        const fatura = await db.getFaturaById(faturaId, clinicaId);
        if (!fatura) throw new Error("Fatura não encontrada");

        const novoValorPago = parseFloat(fatura.fatura.valorPago) + parseFloat(input.valor);
        const valorTotal = parseFloat(fatura.fatura.valorTotal);

        let novoEstado: "paga" | "parcialmente_paga" | "enviada" = "enviada";
        if (novoValorPago >= valorTotal) {
          novoEstado = "paga";
        } else if (novoValorPago > 0) {
          novoEstado = "parcialmente_paga";
        }

        await database
          .update(faturas)
          .set({
            valorPago: novoValorPago.toFixed(2),
            estado: novoEstado,
            updatedAt: new Date(),
          })
          .where(eq(faturas.id, faturaId));

        // TODO: Integracoes adicionais
        // 1. Registar no historico do utente
        // 2. Criar registo de auditoria RGPD
        // 3. Enviar notificacao ao utente (email/SMS)
        // 4. Atualizar cache

        return { 
          success: true, 
          novoEstado,
          valorPago: novoValorPago.toFixed(2),
          valorTotal: valorTotal.toFixed(2),
          faturaId
        };
      }),
  }),

  // ============================================
  // SAAS - PLANOS E ASSINATURAS
  // ============================================
  saas: router({
    // Listar planos disponíveis
    planos: publicProcedure.query(async () => {
      return await db.getPlanosAssinatura();
    }),

    // Obter assinatura da clínica
    minhaAssinatura: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAssinaturaByClinica(input.clinicaId);
      }),

    // Obter métricas de uso
    metricas: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getMetricasUsoByClinica(
          input.clinicaId,
          input.dataInicio,
          input.dataFim
        );
      }),
  }),

  // ============================================
  // DASHBOARD
  // ============================================
  dashboard: router({
    // Estatísticas gerais
    stats: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDashboardStats(input.clinicaId);
      }),

    // Dados para gráficos
    graficos: protectedProcedure
      .input(z.object({ clinicaId: z.number() }))
      .query(async ({ input }) => {
        const [receitaMensal, consultasPorMes, procedimentosMaisRealizados] = await Promise.all([
          dbGraficos.getReceitaMensal(input.clinicaId),
          dbGraficos.getConsultasPorMes(input.clinicaId),
          dbGraficos.getProcedimentosMaisRealizados(input.clinicaId),
        ]);

        return {
          receitaMensal,
          consultasPorMes,
          procedimentosMaisRealizados,
        };
      }),
  }),

  // ============================================
  // NOTIFICAÇÕES
  // ============================================
  notificacoes: router({
    // Processar lembretes automáticos
    processarLembretes: protectedProcedure
      .input(z.object({
        antecedenciaHoras: z.number().default(24),
        tipo: z.enum(["email", "sms", "ambos"]).default("email"),
      }))
      .mutation(async ({ input }) => {
        return await notificacoes.processarLembretesAutomaticos({
          antecedenciaHoras: input.antecedenciaHoras,
          tipo: input.tipo,
        });
      }),

    // Obter mensagens pendentes
    mensagensPendentes: protectedProcedure
      .input(z.object({ limite: z.number().default(100) }))
      .query(async ({ input }) => {
        return await notificacoes.getMensagensPendentes(input.limite);
      }),

    // Marcar mensagem como enviada
    marcarEnviada: protectedProcedure
      .input(z.object({ mensagemId: z.number() }))
      .mutation(async ({ input }) => {
        return await notificacoes.marcarMensagemEnviada(input.mensagemId);
      }),

    // Marcar mensagem como falhada
    marcarFalhada: protectedProcedure
      .input(z.object({
        mensagemId: z.number(),
        erro: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await notificacoes.marcarMensagemFalhada(input.mensagemId, input.erro);
      }),

    // Obter estatísticas de notificações
    estatisticas: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        periodo: z.number().default(30),
      }))
      .query(async ({ input }) => {
        return await notificacoes.getEstatisticasNotificacoes(input.clinicaId, input.periodo);
      }),
  }),

  // ============================================
  // RELATÓRIOS
  // ============================================
  relatorios: router({
    // Relatório financeiro
    financeiro: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await relatorios.getRelatorioFinanceiro(input.clinicaId, {
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
      }),

    // Relatório de produtividade
    produtividade: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await relatorios.getRelatorioProdutividade(input.clinicaId, {
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
      }),

    // Relatório de utentes
    utentes: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await relatorios.getRelatorioUtentes(input.clinicaId, {
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
      }),

    // Relatório de comparação
    comparacao: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        periodo1Inicio: z.date(),
        periodo1Fim: z.date(),
        periodo2Inicio: z.date(),
        periodo2Fim: z.date(),
      }))
      .query(async ({ input }) => {
        return await relatorios.getRelatorioComparacao(
          input.clinicaId,
          { dataInicio: input.periodo1Inicio, dataFim: input.periodo1Fim },
          { dataInicio: input.periodo2Inicio, dataFim: input.periodo2Fim }
        );
      }),

    // Top procedimentos lucrativos
    topProcedimentos: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return await relatorios.getTopProcedimentosLucrativos(input.clinicaId, {
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
      }),
  }),

  // ============================================
  // PAGAMENTOS STRIPE
  // ============================================
  stripe: router({
    // Verificar se Stripe está configurado
    isConfigured: publicProcedure
      .query(() => {
        return { configured: stripeService.isStripeConfigured() };
      }),

    // Criar sessão de checkout
    criarCheckout: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        planoId: z.number(),
        cicloFaturacao: z.enum(["mensal", "anual"]),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await stripeService.criarSessaoCheckout(input);
      }),

    // Criar portal de assinatura
    criarPortal: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        returnUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await stripeService.criarPortalAssinatura(input);
      }),

    // Cancelar assinatura
    cancelarAssinatura: protectedProcedure
      .input(z.object({
        clinicaId: z.number(),
        imediato: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return await stripeService.cancelarAssinatura(input.clinicaId, input.imediato);
      }),
  }),

  // ============================================
  // ASSISTENTE IA
  // ============================================
  aiAssistant: aiAssistantRouter,

  // ============================================
  // CONTABILIDADE
  // ============================================
  contabilidade: contabilidadeRouter,

  // ============================================
  // CONFIGURACAO DE LEMBRETES
  // ============================================
  lembretesConfig: lembretesConfigRouter,

  // ============================================
  // RELATORIOS AVANCADOS
  // ============================================
  relatoriosAvancados: relatoriosAvancadosRouter,
  // ============================================
  // IMAGENS E RADIOGRAFIAS
  // ============================================
  imagens: imagensRouter,
  
  // ============================================
  // NOTAS CLÍNICAS
  // ============================================
  notas: notasRouter,
  
  // ============================================
  // PRESCRIÇÕES MÉDICAS
  // ============================================
  prescricoes: prescricoesRouter,
  
  // ============================================
  // WHATSAPP BUSINESS API
  // ============================================
  whatsapp: whatsappRouter,
  
  // ============================================
  // BUSINESS INTELLIGENCE
  // ============================================
  bi: biRouter,

  // ============================================
  // PAGAMENTOS (STRIPE)
  // ============================================
  pagamentos: pagamentosRouter,

  // ============================================
  // NOTIFICAÇÕES (TWILIO SMS)
  // ============================================
  notificacoes: notificacoesRouter,

  // ============================================
  // NOTIFICAÇÕES DO SISTEMA
  // ============================================
  notificacoesSistema: notificacoesSistemaRouter,
});

export type AppRouter = typeof appRouter;

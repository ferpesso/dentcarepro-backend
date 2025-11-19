import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { getDb } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Router tRPC para Configuracoes de Lembretes
 * Permite cada clinica configurar seus lembretes
 */

export const lembretesConfigRouter = router({
  /**
   * Obter configuracoes da clinica
   */
  getConfig: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.query(`
        SELECT * FROM configuracoes_mensagens
        WHERE clinica_id = ?
      `, [input.clinicaId]);

      // Se nao existe, criar com valores padrao
      if (!result || result.length === 0) {
        await db.query(`
          INSERT INTO configuracoes_mensagens (
            clinica_id,
            lembretes_ativos,
            lembrete_consulta_horas,
            lembrete_confirmacao_horas,
            canal_email_ativo,
            canal_sms_ativo,
            canal_whatsapp_ativo
          ) VALUES (?, TRUE, 24, 48, TRUE, FALSE, FALSE)
        `, [input.clinicaId]);

        return {
          clinicaId: input.clinicaId,
          lembretesAtivos: true,
          lembreteConsultaHoras: 24,
          lembreteConfirmacaoHoras: 48,
          canalEmailAtivo: true,
          canalSmsAtivo: false,
          canalWhatsappAtivo: false,
          horarioEnvioInicio: "09:00:00",
          horarioEnvioFim: "20:00:00",
          enviarFinsSemana: false,
        };
      }

      const config = result[0];
      return {
        clinicaId: config.clinica_id,
        lembretesAtivos: config.lembretes_ativos,
        lembreteConsultaHoras: config.lembrete_consulta_horas,
        lembreteConfirmacaoHoras: config.lembrete_confirmacao_horas,
        lembretePagamentoAtivo: config.lembrete_pagamento_ativo,
        canalEmailAtivo: config.canal_email_ativo,
        canalSmsAtivo: config.canal_sms_ativo,
        canalWhatsappAtivo: config.canal_whatsapp_ativo,
        horarioEnvioInicio: config.horario_envio_inicio,
        horarioEnvioFim: config.horario_envio_fim,
        enviarFinsSemana: config.enviar_fins_semana,
        templateEmailConsulta: config.template_email_consulta,
        templateSmsConsulta: config.template_sms_consulta,
        templateWhatsappConsulta: config.template_whatsapp_consulta,
        templateEmailPagamento: config.template_email_pagamento,
        assinaturaMensagens: config.assinatura_mensagens,
      };
    }),

  /**
   * Atualizar configuracoes da clinica
   */
  updateConfig: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      lembretesAtivos: z.boolean().optional(),
      lembreteConsultaHoras: z.number().min(1).max(168).optional(),
      lembreteConfirmacaoHoras: z.number().min(1).max(168).optional(),
      lembretePagamentoAtivo: z.boolean().optional(),
      canalEmailAtivo: z.boolean().optional(),
      canalSmsAtivo: z.boolean().optional(),
      canalWhatsappAtivo: z.boolean().optional(),
      horarioEnvioInicio: z.string().optional(),
      horarioEnvioFim: z.string().optional(),
      enviarFinsSemana: z.boolean().optional(),
      templateEmailConsulta: z.string().optional(),
      templateSmsConsulta: z.string().optional(),
      templateWhatsappConsulta: z.string().optional(),
      templateEmailPagamento: z.string().optional(),
      assinaturaMensagens: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: string[] = [];
      const values: any[] = [];

      if (input.lembretesAtivos !== undefined) {
        updates.push("lembretes_ativos = ?");
        values.push(input.lembretesAtivos);
      }
      if (input.lembreteConsultaHoras !== undefined) {
        updates.push("lembrete_consulta_horas = ?");
        values.push(input.lembreteConsultaHoras);
      }
      if (input.lembreteConfirmacaoHoras !== undefined) {
        updates.push("lembrete_confirmacao_horas = ?");
        values.push(input.lembreteConfirmacaoHoras);
      }
      if (input.lembretePagamentoAtivo !== undefined) {
        updates.push("lembrete_pagamento_ativo = ?");
        values.push(input.lembretePagamentoAtivo);
      }
      if (input.canalEmailAtivo !== undefined) {
        updates.push("canal_email_ativo = ?");
        values.push(input.canalEmailAtivo);
      }
      if (input.canalSmsAtivo !== undefined) {
        updates.push("canal_sms_ativo = ?");
        values.push(input.canalSmsAtivo);
      }
      if (input.canalWhatsappAtivo !== undefined) {
        updates.push("canal_whatsapp_ativo = ?");
        values.push(input.canalWhatsappAtivo);
      }
      if (input.horarioEnvioInicio !== undefined) {
        updates.push("horario_envio_inicio = ?");
        values.push(input.horarioEnvioInicio);
      }
      if (input.horarioEnvioFim !== undefined) {
        updates.push("horario_envio_fim = ?");
        values.push(input.horarioEnvioFim);
      }
      if (input.enviarFinsSemana !== undefined) {
        updates.push("enviar_fins_semana = ?");
        values.push(input.enviarFinsSemana);
      }
      if (input.templateEmailConsulta !== undefined) {
        updates.push("template_email_consulta = ?");
        values.push(input.templateEmailConsulta);
      }
      if (input.templateSmsConsulta !== undefined) {
        updates.push("template_sms_consulta = ?");
        values.push(input.templateSmsConsulta);
      }
      if (input.templateWhatsappConsulta !== undefined) {
        updates.push("template_whatsapp_consulta = ?");
        values.push(input.templateWhatsappConsulta);
      }
      if (input.templateEmailPagamento !== undefined) {
        updates.push("template_email_pagamento = ?");
        values.push(input.templateEmailPagamento);
      }
      if (input.assinaturaMensagens !== undefined) {
        updates.push("assinatura_mensagens = ?");
        values.push(input.assinaturaMensagens);
      }

      updates.push("updated_at = NOW()");
      values.push(input.clinicaId);

      await db.query(`
        UPDATE configuracoes_mensagens
        SET ${updates.join(", ")}
        WHERE clinica_id = ?
      `, values);

      return { success: true };
    }),

  /**
   * Obter estatisticas de mensagens
   */
  getEstatisticas: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      periodoInicio: z.string(),
      periodoFim: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN canal = 'email' THEN 1 ELSE 0 END) as total_email,
          SUM(CASE WHEN canal = 'sms' THEN 1 ELSE 0 END) as total_sms,
          SUM(CASE WHEN canal = 'whatsapp' THEN 1 ELSE 0 END) as total_whatsapp,
          SUM(CASE WHEN estado = 'enviada' THEN 1 ELSE 0 END) as total_enviadas,
          SUM(CASE WHEN estado = 'falhada' THEN 1 ELSE 0 END) as total_falhadas,
          SUM(CASE WHEN estado = 'pendente' THEN 1 ELSE 0 END) as total_pendentes,
          SUM(COALESCE(custo, 0)) as custo_total
        FROM mensagens_utente
        WHERE clinica_id = ?
          AND created_at >= ?
          AND created_at <= ?
      `, [input.clinicaId, input.periodoInicio, input.periodoFim]);

      const stats = result[0] || {};

      return {
        total: parseInt(stats.total) || 0,
        totalEmail: parseInt(stats.total_email) || 0,
        totalSms: parseInt(stats.total_sms) || 0,
        totalWhatsapp: parseInt(stats.total_whatsapp) || 0,
        totalEnviadas: parseInt(stats.total_enviadas) || 0,
        totalFalhadas: parseInt(stats.total_falhadas) || 0,
        totalPendentes: parseInt(stats.total_pendentes) || 0,
        custoTotal: parseFloat(stats.custo_total) || 0,
        taxaSucesso: stats.total > 0 
          ? ((parseInt(stats.total_enviadas) / parseInt(stats.total)) * 100).toFixed(1)
          : "0.0",
      };
    }),

  /**
   * Obter historico de mensagens
   */
  getHistorico: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      limite: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.query(`
        SELECT 
          mu.id,
          mu.canal,
          mu.assunto,
          mu.estado,
          mu.custo,
          mu.provedor,
          mu.created_at,
          mu.enviada_em,
          u.nome as utente_nome,
          u.email as utente_email,
          u.telemovel as utente_telemovel
        FROM mensagens_utente mu
        JOIN utentes u ON mu.utente_id = u.id
        WHERE mu.clinica_id = ?
        ORDER BY mu.created_at DESC
        LIMIT ? OFFSET ?
      `, [input.clinicaId, input.limite, input.offset]);

      return result.map((msg: any) => ({
        id: msg.id,
        canal: msg.canal,
        assunto: msg.assunto,
        estado: msg.estado,
        custo: parseFloat(msg.custo) || 0,
        provedor: msg.provedor,
        criadoEm: msg.created_at,
        enviadaEm: msg.enviada_em,
        utenteNome: msg.utente_nome,
        utenteEmail: msg.utente_email,
        utenteTelemovel: msg.utente_telemovel,
      }));
    }),

  /**
   * Testar envio de lembrete (preview)
   */
  previewMensagem: publicProcedure
    .input(z.object({
      clinicaId: z.number(),
      tipo: z.enum(["consulta", "pagamento"]),
      canal: z.enum(["email", "sms", "whatsapp"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Obter dados da clinica
      const clinica = await db.query(`
        SELECT * FROM clinicas WHERE id = ?
      `, [input.clinicaId]);

      if (!clinica || clinica.length === 0) {
        throw new Error("Clinica nao encontrada");
      }

      const c = clinica[0];

      // Dados de exemplo para preview
      const dadosExemplo = {
        utenteNome: "João Silva",
        dentistaNome: "Dr. Pedro Santos",
        consultaHora: new Date(Date.now() + 24 * 60 * 60 * 1000), // amanha
        clinicaNome: c.nome,
        clinicaEmail: c.email,
        clinicaTelemovel: c.telemovel,
        clinicaMorada: c.morada,
        clinicaCidade: c.cidade,
        clinicaCodigoPostal: c.codigo_postal,
        numeroFatura: "FT2025/00123",
        valorPendente: 50.00,
        diasVencido: 7,
        dataVencimento: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      };

      let mensagem = "";

      if (input.tipo === "consulta") {
        const dataFormatada = dadosExemplo.consultaHora.toLocaleDateString("pt-PT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const horaFormatada = dadosExemplo.consultaHora.toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (input.canal === "email") {
          mensagem = `Ola ${dadosExemplo.utenteNome},

Este e um lembrete da sua consulta marcada na ${dadosExemplo.clinicaNome}.

📅 Data: ${dataFormatada}
🕐 Hora: ${horaFormatada}
👨‍⚕️ Dentista: ${dadosExemplo.dentistaNome}
🏥 Clinica: ${dadosExemplo.clinicaNome}
📍 Morada: ${dadosExemplo.clinicaMorada}, ${dadosExemplo.clinicaCodigoPostal} ${dadosExemplo.clinicaCidade}

Por favor, chegue com 10 minutos de antecedencia.

Se precisar de remarcar ou cancelar, contacte-nos:
📞 ${dadosExemplo.clinicaTelemovel}
📧 ${dadosExemplo.clinicaEmail}

Obrigado,
Equipa ${dadosExemplo.clinicaNome}`;
        } else if (input.canal === "sms") {
          mensagem = `Lembrete ${dadosExemplo.clinicaNome}: Consulta ${dataFormatada} as ${horaFormatada} com ${dadosExemplo.dentistaNome}. ${dadosExemplo.clinicaTelemovel}`;
        } else if (input.canal === "whatsapp") {
          mensagem = `*Lembrete de Consulta* 📅

Ola ${dadosExemplo.utenteNome}!

Tem consulta marcada na *${dadosExemplo.clinicaNome}*:

📅 *${dataFormatada}*
🕐 *${horaFormatada}*
👨‍⚕️ ${dadosExemplo.dentistaNome}
📍 ${dadosExemplo.clinicaMorada}

Por favor, chegue com 10 minutos de antecedencia.

Para remarcar: ${dadosExemplo.clinicaTelemovel}`;
        }
      } else if (input.tipo === "pagamento") {
        mensagem = `Ola ${dadosExemplo.utenteNome},

Este e um lembrete de pagamento da ${dadosExemplo.clinicaNome}.

Fatura: ${dadosExemplo.numeroFatura}
💰 Valor Pendente: €${dadosExemplo.valorPendente.toFixed(2)}
📅 Vencimento: ${dadosExemplo.dataVencimento.toLocaleDateString("pt-PT")}
⚠️ Vencida ha ${dadosExemplo.diasVencido} dia(s)

Por favor, regularize o pagamento o mais breve possivel.

Para mais informacoes, contacte-nos:
📞 ${dadosExemplo.clinicaTelemovel}
📧 ${dadosExemplo.clinicaEmail}

Obrigado,
${dadosExemplo.clinicaNome}`;
      }

      return {
        mensagem,
        caracteres: mensagem.length,
        custoEstimado: input.canal === "sms" 
          ? (Math.ceil(mensagem.length / 160) * 0.06).toFixed(2)
          : input.canal === "whatsapp"
          ? "0.01"
          : "0.00",
      };
    }),
});

export default lembretesConfigRouter;

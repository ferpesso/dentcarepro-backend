import { OpenAI } from "openai";
import { getDb } from "./db";
import { utentes, consultas, faturas, procedimentos } from "../drizzle/schema";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";

/**
 * Servico de IA Assistente
 * Fornece recomendacoes inteligentes, dicas e insights contextuais
 * Integrado em todas as paginas do sistema
 */

interface AssistantContext {
  clinicaId: number;
  userId: number;
  pagina: string;
  dados?: any;
}

export class AIAssistantService {
  private client: OpenAI;

  constructor() {
    // Usar API key do ambiente (ja configurada)
    this.client = new OpenAI();
  }

  /**
   * Obter recomendacoes para o Dashboard
   */
  async getDashboardRecommendations(clinicaId: number): Promise<string[]> {
    const db = await getDb();
    if (!db) return this.getFallbackRecommendations("dashboard");

    try {
      // Obter estatisticas da clinica
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      
      const [stats] = await db
        .select({
          totalUtentes: count(utentes.id),
          consultasHoje: count(consultas.id),
          faturasAbertas: count(faturas.id),
        })
        .from(utentes)
        .leftJoin(consultas, and(
          eq(consultas.clinicaId, clinicaId),
          gte(consultas.horaInicio, hoje)
        ))
        .leftJoin(faturas, and(
          eq(faturas.clinicaId, clinicaId),
          eq(faturas.estado, "enviada")
        ))
        .where(eq(utentes.clinicaId, clinicaId));

      // Gerar recomendacoes baseadas nos dados
      const recommendations = [];

      if (stats.consultasHoje === 0) {
        recommendations.push("[DICA] Nao ha consultas agendadas para hoje. Considere contactar utentes para marcar consultas.");
      }

      if (stats.faturasAbertas > 5) {
        recommendations.push(`[DICA] Tem ${stats.faturasAbertas} faturas pendentes. Considere fazer follow-up de pagamentos.`);
      }

      if (stats.totalUtentes < 50) {
        recommendations.push("[DICA] Estrategia de crescimento: Considere campanhas de marketing para atrair novos utentes.");
      }

      // Adicionar dicas gerais
      recommendations.push("[DICA] Dica: Use o calendario para visualizar a agenda semanal e otimizar horarios.");
      recommendations.push("[DICA] Verifique os relatorios mensais para identificar procedimentos mais lucrativos.");

      return recommendations;
    } catch (error) {
      console.error("[AI Assistant] Erro ao gerar recomendacoes dashboard:", error);
      return this.getFallbackRecommendations("dashboard");
    }
  }

  /**
   * Obter recomendacoes para pagina de Utentes
   */
  async getUtentesRecommendations(clinicaId: number, totalUtentes: number): Promise<string[]> {
    const recommendations = [];

    if (totalUtentes === 0) {
      recommendations.push("[DICA] Comece por cadastrar os seus primeiros utentes. Use o botao 'Novo Utente' acima.");
      recommendations.push("[DICA] Dica: Preencha todos os campos para ter um registo completo.");
    } else if (totalUtentes < 10) {
      recommendations.push("[DICA] Otimo comeco! Continue cadastrando utentes para construir a sua base de dados.");
    } else {
      recommendations.push("[DICA] Base de utentes estabelecida. Use os filtros para encontrar utentes rapidamente.");
      recommendations.push("[DICA] Considere enviar lembretes automaticos para utentes inativos ha mais de 6 meses.");
    }

    recommendations.push("[DICA] Dica: Mantenha os dados de contacto atualizados para melhor comunicacao.");
    recommendations.push("[DICA] Use a pesquisa para encontrar utentes por nome, email ou telemovel.");
    recommendations.push("[DICA] Utentes com historico medico completo facilitam diagnosticos mais precisos.");

    return recommendations;
  }

  /**
   * Obter recomendacoes para pagina de Consultas/Agenda
   */
  async getAgendaRecommendations(clinicaId: number): Promise<string[]> {
    const db = await getDb();
    if (!db) return this.getFallbackRecommendations("agenda");

    try {
      const hoje = new Date();
      const proximaSemana = new Date(hoje);
      proximaSemana.setDate(proximaSemana.getDate() + 7);

      const [stats] = await db
        .select({
          consultasProximaSemana: count(consultas.id),
        })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, hoje),
            lte(consultas.horaInicio, proximaSemana)
          )
        );

      const recommendations = [];

      if (stats.consultasProximaSemana < 5) {
        recommendations.push("[DICA] Agenda com disponibilidade na proxima semana. Contacte utentes para preencher horarios.");
      } else if (stats.consultasProximaSemana > 20) {
        recommendations.push("[DICA] Agenda cheia! Considere ajustar horarios ou adicionar mais slots.");
      }

      recommendations.push("[DICA] Dica: Use drag & drop para reorganizar consultas rapidamente.");
      recommendations.push("[DICA] Configure lembretes automaticos 24h antes para reduzir faltas.");
      recommendations.push("[DICA] Envie confirmacoes por SMS/WhatsApp para melhor taxa de comparencia.");
      recommendations.push("[DICA] Use cores diferentes para cada dentista para melhor visualizacao.");

      return recommendations;
    } catch (error) {
      return this.getFallbackRecommendations("agenda");
    }
  }

  /**
   * Obter recomendacoes para pagina de Faturas
   */
  async getFaturasRecommendations(clinicaId: number): Promise<string[]> {
    const db = await getDb();
    if (!db) return this.getFallbackRecommendations("faturas");

    try {
      const [stats] = await db
        .select({
          faturasAbertas: count(faturas.id),
        })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            eq(faturas.estado, "enviada")
          )
        );

      const recommendations = [];

      if (stats.faturasAbertas > 10) {
        recommendations.push(`[DICA] ${stats.faturasAbertas} faturas pendentes. Priorize o follow-up de pagamentos.`);
        recommendations.push("[DICA] Envie lembretes automaticos de pagamento para reduzir inadimplencia.");
      } else if (stats.faturasAbertas > 0) {
        recommendations.push(`[DICA] ${stats.faturasAbertas} faturas pendentes. Acompanhe regularmente.`);
      } else {
        recommendations.push("[DICA] Excelente! Todas as faturas estao pagas.");
      }

      recommendations.push("[DICA] Dica: Configure pagamentos automaticos via Multibanco ou SEPA.");
      recommendations.push("[DICA] Faturas com QR Code AT-CUDE sao obrigatorias em Portugal.");
      recommendations.push("[DICA] Automatize a criacao de faturas apos cada consulta.");
      recommendations.push("[DICA] Envie faturas por email/WhatsApp para facilitar pagamento.");

      return recommendations;
    } catch (error) {
      return this.getFallbackRecommendations("faturas");
    }
  }

  /**
   * Obter recomendacoes para pagina de Procedimentos
   */
  getProcedimentosRecommendations(): string[] {
    return [
      "[DICA] Dica: Organize procedimentos por categorias para facilitar a busca.",
      "[DICA] Mantenha os precos atualizados conforme tabela da Ordem dos Medicos Dentistas.",
      "[DICA] Analise quais procedimentos sao mais realizados para otimizar stock.",
      "[DICA] Configure duracoes medias para melhor gestao da agenda.",
      "[DICA] Procedimentos com margens maiores devem ser promovidos.",
      "[DICA] Inclua descricoes detalhadas para facilitar orcamentos.",
    ];
  }

  /**
   * Obter recomendacoes para pagina de Relatorios
   */
  getRelatoriosRecommendations(): string[] {
    return [
      "[DICA] Analise relatorios mensalmente para identificar tendencias.",
      "[DICA] Compare receita mes a mes para avaliar crescimento.",
      "[DICA] Identifique utentes inativos e crie campanhas de reativacao.",
      "[DICA] Procedimentos mais lucrativos devem ter prioridade na agenda.",
      "[DICA] Use graficos para apresentar resultados a equipa.",
      "[DICA] Exporte relatorios para Excel para analises mais profundas.",
      "[DICA] Defina metas mensais baseadas no historico de performance.",
    ];
  }

  /**
   * Obter insights inteligentes usando IA (GPT)
   */
  async getAIInsights(context: AssistantContext): Promise<string[]> {
    try {
      const promptText = "You are an intelligent assistant for a dental clinic in Portugal. Context: " + context.pagina + ". Data: " + JSON.stringify(context.dados || {}) + ". Provide 3-5 practical recommendations to improve clinic management. Be specific and use relevant emojis. Focus on: efficiency, revenue, patient satisfaction, legal compliance. Format: JSON array of strings. Example: ['Tip 1', 'Tip 2', 'Tip 3']";
      const prompt = promptText;

      const response = await this.client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "Voce e um consultor especializado em gestao de clinicas dentarias em Portugal.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      return result.recommendations || result.dicas || [];
    } catch (error) {
      console.error("[AI Assistant] Erro ao gerar insights IA:", error);
      return [];
    }
  }

  /**
   * Obter alertas e avisos importantes
   */
  async getAlerts(clinicaId: number): Promise<Array<{
    type: "warning" | "info" | "success" | "error";
    message: string;
  }>> {
    const db = await getDb();
    if (!db) return [];

    const alerts: Array<{
      type: "warning" | "info" | "success" | "error";
      message: string;
    }> = [];

    try {
      // Verificar faturas vencidas
      const hoje = new Date();
      const [faturasVencidas] = await db
        .select({ count: count(faturas.id) })
        .from(faturas)
        .where(
          and(
            eq(faturas.clinicaId, clinicaId),
            eq(faturas.estado, "enviada"),
            lte(faturas.dataVencimento, hoje)
          )
        );

      if (faturasVencidas.count > 0) {
        alerts.push({
          type: "warning",
          message: `[DICA] ${faturasVencidas.count} fatura(s) vencida(s). Contacte os utentes.`,
        });
      }

      // Verificar consultas sem confirmacao (proximas 24h)
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      const [consultasSemConfirmacao] = await db
        .select({ count: count(consultas.id) })
        .from(consultas)
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            eq(consultas.estado, "agendada"),
            gte(consultas.horaInicio, hoje),
            lte(consultas.horaInicio, amanha)
          )
        );

      if (consultasSemConfirmacao.count > 0) {
        alerts.push({
          type: "info",
          message: `[DICA] ${consultasSemConfirmacao.count} consulta(s) amanha. Envie lembretes!`,
        });
      }

      // Adicionar alerta de conformidade RGPD
      alerts.push({
        type: "info",
        message: "[DICA] Sistema conforme RGPD. Todos os acessos sao auditados.",
      });

    } catch (error) {
      console.error("[AI Assistant] Erro ao gerar alertas:", error);
    }

    return alerts;
  }

  /**
   * Obter dicas rapidas (quick tips)
   */
  getQuickTips(pagina: string): string[] {
    const tips: Record<string, string[]> = {
      dashboard: [
        "[DICA] Atalho: Ctrl+K para pesquisa rapida",
        "[DICA] Clique nos graficos para ver detalhes",
        "[DICA] Dados atualizados em tempo real",
      ],
      utentes: [
        "[DICA] Atalho: Ctrl+N para novo utente",
        "[DICA] Use filtros para pesquisa avancada",
        "[DICA] Clique no telemovel para ligar diretamente",
      ],
      agenda: [
        "[DICA] Arraste consultas para reorganizar",
        "[DICA] Atalho: Ctrl+M para marcacao rapida",
        "[DICA] Clique com botao direito para mais opcoes",
      ],
      faturas: [
        "[DICA] Atalho: Ctrl+F para nova fatura",
        "[DICA] Clique no email para enviar fatura",
        "[DICA] Registe pagamentos parciais",
      ],
      procedimentos: [
        "[DICA] Atalho: Ctrl+P para novo procedimento",
        "[DICA] Duplique procedimentos similares",
        "[DICA] Atualize precos em lote",
      ],
      relatorios: [
        "[DICA] Exporte para Excel para analise",
        "[DICA] Compare periodos diferentes",
        "[DICA] Imprima relatorios formatados",
      ],
    };

    return tips[pagina] || tips.dashboard;
  }

  /**
   * Recomendacoes de fallback (quando nao ha dados ou erro)
   */
  private getFallbackRecommendations(pagina: string): string[] {
    const fallbacks: Record<string, string[]> = {
      dashboard: [
        "[DICA] Bem-vindo ao DentCarePro! Explore as funcionalidades do sistema.",
        "[DICA] Configure a sua clinica nas Configuracoes para comecar.",
        "[DICA] Cadastre utentes e dentistas para usar o sistema completo.",
      ],
      agenda: [
        "[DICA] Organize a sua agenda para melhor gestao do tempo.",
        "[DICA] Configure lembretes automaticos para reduzir faltas.",
        "[DICA] Otimize horarios para maximizar atendimentos.",
      ],
      faturas: [
        "[DICA] Mantenha a faturacao em dia para melhor fluxo de caixa.",
        "[DICA] Automatize envio de faturas para agilizar pagamentos.",
        "[DICA] Configure pagamentos recorrentes quando aplicavel.",
      ],
    };

    return fallbacks[pagina] || fallbacks.dashboard;
  }

  /**
   * Obter estatisticas para insights
   */
  async getInsightStats(clinicaId: number) {
    const db = await getDb();
    if (!db) return null;

    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

      // Estatisticas do mes atual
      const [statsAtual] = await db
        .select({
          consultas: count(consultas.id),
          receita: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
        })
        .from(consultas)
        .leftJoin(faturas, eq(faturas.clinicaId, clinicaId))
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, inicioMes)
          )
        );

      // Estatisticas do mes passado
      const [statsPassado] = await db
        .select({
          consultas: count(consultas.id),
          receita: sql<number>`COALESCE(SUM(${faturas.valorTotal}), 0)`,
        })
        .from(consultas)
        .leftJoin(faturas, eq(faturas.clinicaId, clinicaId))
        .where(
          and(
            eq(consultas.clinicaId, clinicaId),
            gte(consultas.horaInicio, mesPassado),
            lte(consultas.horaInicio, fimMesPassado)
          )
        );

      return {
        atual: statsAtual,
        passado: statsPassado,
        crescimentoConsultas: this.calcularCrescimento(
          statsPassado.consultas,
          statsAtual.consultas
        ),
        crescimentoReceita: this.calcularCrescimento(
          statsPassado.receita,
          statsAtual.receita
        ),
      };
    } catch (error) {
      console.error("[AI Assistant] Erro ao obter estatisticas:", error);
      return null;
    }
  }

  /**
   * Calcular crescimento percentual
   */
  private calcularCrescimento(anterior: number, atual: number): number {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return ((atual - anterior) / anterior) * 100;
  }
}

export const aiAssistant = new AIAssistantService();

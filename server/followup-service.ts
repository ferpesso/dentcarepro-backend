/**
 * Serviço de Follow-up Inteligente
 * 
 * Funcionalidades:
 * - Identificação automática de utentes inativos
 * - Scoring de propensão a retorno
 * - Sequências de follow-up personalizadas
 * - Follow-up pós-tratamento
 * - Campanhas de reativação
 * - Análise preditiva com IA
 */

import { getDb } from './db';
import { utentes, consultas, faturas, mensagensUtente } from '../drizzle/schema';
import { eq, and, lt, gt, desc, sql } from 'drizzle-orm';
import { whatsappService } from './whatsapp-service';
import { IAService } from './ia-service';

/**
 * Status do utente
 */
export type UtenteStatus = 
  | 'ativo'           // Última consulta < 3 meses
  | 'em_risco'        // Última consulta 3-6 meses
  | 'inativo'         // Última consulta 6-12 meses
  | 'dormante'        // Última consulta > 12 meses
  | 'perdido';        // Última consulta > 24 meses

/**
 * Tipo de follow-up
 */
export type TipoFollowUp =
  | 'pos_tratamento'      // Após tratamento concluído
  | 'reativacao'          // Utente inativo
  | 'preventivo'          // Lembrete de check-up
  | 'fidelizacao'         // Manter utente ativo
  | 'recuperacao';        // Utente perdido

/**
 * Utente inativo
 */
export interface UtenteInativo {
  id: number;
  nome: string;
  email: string | null;
  telemovel: string;
  clinicaId: number;
  ultimaConsulta: Date | null;
  diasDesdeUltimaConsulta: number;
  status: UtenteStatus;
  propensaoRetorno: number; // 0-100
  valorVitalicio: number;
  totalConsultas: number;
  faturasAbertas: number;
  motivoInatividade?: string;
  recomendacaoFollowUp: string;
}

/**
 * Sequência de follow-up
 */
export interface SequenciaFollowUp {
  id: number;
  tipo: TipoFollowUp;
  nome: string;
  descricao: string;
  etapas: EtapaFollowUp[];
}

/**
 * Etapa de follow-up
 */
export interface EtapaFollowUp {
  ordem: number;
  diasAposInicio: number;
  canal: 'email' | 'sms' | 'whatsapp';
  assunto: string;
  mensagem: string;
  condicao?: string; // Condição para enviar (ex: "se não respondeu")
}

/**
 * Resultado de follow-up
 */
export interface ResultadoFollowUp {
  total: number;
  enviados: number;
  falhados: number;
  detalhes: {
    utenteId: number;
    utenteNome: string;
    canal: string;
    sucesso: boolean;
    erro?: string;
  }[];
}

/**
 * Serviço de Follow-up Inteligente
 */
export class FollowUpService {
  private iaService: IAService;

  constructor() {
    this.iaService = new IAService();
  }

  /**
   * Identificar utentes inativos
   */
  async identificarUtentesInativos(
    clinicaId: number,
    statusFiltro?: UtenteStatus[]
  ): Promise<UtenteInativo[]> {
    const db = await getDb();
    
    // Query complexa para obter utentes com estatísticas
    const query = sql`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.telemovel,
        u.clinica_id as clinicaId,
        MAX(c.hora_inicio) as ultimaConsulta,
        DATEDIFF(NOW(), MAX(c.hora_inicio)) as diasDesdeUltimaConsulta,
        COUNT(DISTINCT c.id) as totalConsultas,
        COALESCE(SUM(DISTINCT f.valor_total), 0) as valorVitalicio,
        COUNT(DISTINCT CASE WHEN f.estado = 'pendente' THEN f.id END) as faturasAbertas
      FROM utentes u
      LEFT JOIN consultas c ON u.id = c.utente_id AND c.estado != 'cancelada'
      LEFT JOIN faturas f ON u.id = f.utente_id
      WHERE u.clinica_id = ${clinicaId}
        AND u.ativo = 1
      GROUP BY u.id
      HAVING ultimaConsulta IS NOT NULL
      ORDER BY diasDesdeUltimaConsulta DESC
    `;

    const resultados: any[] = await db.execute(query);

    // Processar resultados e calcular scores
    const utentesInativos: UtenteInativo[] = [];

    for (const row of resultados) {
      const dias = parseInt(row.diasDesdeUltimaConsulta) || 0;
      const status = this.calcularStatus(dias);

      // Filtrar por status se especificado
      if (statusFiltro && !statusFiltro.includes(status)) {
        continue;
      }

      // Calcular propensão a retorno (0-100)
      const propensaoRetorno = await this.calcularPropensaoRetorno({
        diasDesdeUltimaConsulta: dias,
        totalConsultas: parseInt(row.totalConsultas) || 0,
        valorVitalicio: parseFloat(row.valorVitalicio) || 0,
        faturasAbertas: parseInt(row.faturasAbertas) || 0,
      });

      // Gerar recomendação de follow-up
      const recomendacao = await this.gerarRecomendacaoFollowUp({
        status,
        propensaoRetorno,
        totalConsultas: parseInt(row.totalConsultas) || 0,
        faturasAbertas: parseInt(row.faturasAbertas) || 0,
      });

      utentesInativos.push({
        id: row.id,
        nome: row.nome,
        email: row.email,
        telemovel: row.telemovel,
        clinicaId: row.clinicaId,
        ultimaConsulta: row.ultimaConsulta ? new Date(row.ultimaConsulta) : null,
        diasDesdeUltimaConsulta: dias,
        status,
        propensaoRetorno,
        valorVitalicio: parseFloat(row.valorVitalicio) || 0,
        totalConsultas: parseInt(row.totalConsultas) || 0,
        faturasAbertas: parseInt(row.faturasAbertas) || 0,
        recomendacaoFollowUp: recomendacao,
      });
    }

    return utentesInativos;
  }

  /**
   * Calcular status do utente baseado em dias desde última consulta
   */
  private calcularStatus(dias: number): UtenteStatus {
    if (dias < 90) return 'ativo';
    if (dias < 180) return 'em_risco';
    if (dias < 365) return 'inativo';
    if (dias < 730) return 'dormante';
    return 'perdido';
  }

  /**
   * Calcular propensão a retorno (score 0-100)
   * Usa múltiplos fatores ponderados
   */
  private async calcularPropensaoRetorno(params: {
    diasDesdeUltimaConsulta: number;
    totalConsultas: number;
    valorVitalicio: number;
    faturasAbertas: number;
  }): Promise<number> {
    let score = 100;

    // Fator 1: Tempo desde última consulta (peso: 40%)
    const diasScore = Math.max(0, 100 - (params.diasDesdeUltimaConsulta / 365) * 100);
    score -= (100 - diasScore) * 0.4;

    // Fator 2: Frequência histórica (peso: 30%)
    const frequenciaScore = Math.min(100, params.totalConsultas * 10);
    score -= (100 - frequenciaScore) * 0.3;

    // Fator 3: Valor vitalício (peso: 20%)
    const valorScore = Math.min(100, (params.valorVitalicio / 1000) * 20);
    score -= (100 - valorScore) * 0.2;

    // Fator 4: Faturas abertas (peso: 10%)
    // Faturas abertas reduzem propensão
    const faturasScore = params.faturasAbertas > 0 ? 50 : 100;
    score -= (100 - faturasScore) * 0.1;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Gerar recomendação de follow-up usando IA
   */
  private async gerarRecomendacaoFollowUp(params: {
    status: UtenteStatus;
    propensaoRetorno: number;
    totalConsultas: number;
    faturasAbertas: number;
  }): Promise<string> {
    const recomendacoes: string[] = [];

    if (params.status === 'ativo') {
      recomendacoes.push('Manter engajamento com lembretes preventivos');
    } else if (params.status === 'em_risco') {
      recomendacoes.push('Enviar lembrete de check-up preventivo');
      if (params.propensaoRetorno > 70) {
        recomendacoes.push('Alta propensão - priorizar contato');
      }
    } else if (params.status === 'inativo') {
      recomendacoes.push('Iniciar sequência de reativação');
      if (params.faturasAbertas > 0) {
        recomendacoes.push('Oferecer facilidades de pagamento');
      }
    } else if (params.status === 'dormante') {
      recomendacoes.push('Campanha de recuperação com oferta especial');
      recomendacoes.push('Contato personalizado por telefone');
    } else {
      recomendacoes.push('Última tentativa de recuperação');
      recomendacoes.push('Considerar remover da lista ativa');
    }

    return recomendacoes.join('; ');
  }

  /**
   * Executar sequência de follow-up
   */
  async executarSequenciaFollowUp(
    clinicaId: number,
    utenteId: number,
    tipoSequencia: TipoFollowUp
  ): Promise<ResultadoFollowUp> {
    const sequencia = await this.obterSequencia(tipoSequencia);
    
    if (!sequencia) {
      throw new Error(`Sequência ${tipoSequencia} não encontrada`);
    }

    const resultado: ResultadoFollowUp = {
      total: sequencia.etapas.length,
      enviados: 0,
      falhados: 0,
      detalhes: [],
    };

    // Obter dados do utente
    const db = await getDb();
    const utente = await db
      .select()
      .from(utentes)
      .where(eq(utentes.id, utenteId))
      .limit(1);

    if (!utente || utente.length === 0) {
      throw new Error('Utente não encontrado');
    }

    const dadosUtente = utente[0];

    // Executar cada etapa
    for (const etapa of sequencia.etapas) {
      // Por agora, executar apenas a primeira etapa
      // As próximas serão agendadas para execução futura
      if (etapa.ordem > 1) {
        // TODO: Agendar etapas futuras
        continue;
      }

      const mensagemPersonalizada = this.personalizarMensagem(etapa.mensagem, {
        nome: dadosUtente.nome,
        clinicaNome: 'Clínica', // TODO: Obter nome da clínica
      });

      let sucesso = false;
      let erro: string | undefined;

      try {
        if (etapa.canal === 'whatsapp' && dadosUtente.telemovel) {
          const resultadoEnvio = await whatsappService.sendTextMessage(
            dadosUtente.telemovel,
            mensagemPersonalizada,
            clinicaId,
            utenteId
          );
          sucesso = resultadoEnvio.success;
          erro = resultadoEnvio.error;
        } else if (etapa.canal === 'email' && dadosUtente.email) {
          // TODO: Implementar envio de email
          sucesso = false;
          erro = 'Envio de email não implementado';
        } else if (etapa.canal === 'sms' && dadosUtente.telemovel) {
          // TODO: Implementar envio de SMS
          sucesso = false;
          erro = 'Envio de SMS não implementado';
        } else {
          sucesso = false;
          erro = 'Canal não disponível ou dados de contato faltando';
        }

        if (sucesso) {
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          utenteId,
          utenteNome: dadosUtente.nome,
          canal: etapa.canal,
          sucesso,
          erro,
        });
      } catch (error) {
        resultado.falhados++;
        resultado.detalhes.push({
          utenteId,
          utenteNome: dadosUtente.nome,
          canal: etapa.canal,
          sucesso: false,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return resultado;
  }

  /**
   * Executar campanha de reativação em massa
   */
  async executarCampanhaReativacao(
    clinicaId: number,
    statusAlvo: UtenteStatus[],
    canal: 'email' | 'sms' | 'whatsapp'
  ): Promise<ResultadoFollowUp> {
    // Identificar utentes inativos
    const utentesInativos = await this.identificarUtentesInativos(clinicaId, statusAlvo);

    // Filtrar apenas os com alta propensão a retorno
    const utentesAlvos = utentesInativos.filter((u) => u.propensaoRetorno >= 50);

    const resultado: ResultadoFollowUp = {
      total: utentesAlvos.length,
      enviados: 0,
      falhados: 0,
      detalhes: [],
    };

    // Enviar mensagem para cada utente
    for (const utente of utentesAlvos) {
      const mensagem = await this.gerarMensagemReativacao(utente);

      let sucesso = false;
      let erro: string | undefined;

      try {
        if (canal === 'whatsapp' && utente.telemovel) {
          const resultadoEnvio = await whatsappService.sendTextMessage(
            utente.telemovel,
            mensagem,
            clinicaId,
            utente.id
          );
          sucesso = resultadoEnvio.success;
          erro = resultadoEnvio.error;
        }
        // TODO: Implementar outros canais

        if (sucesso) {
          resultado.enviados++;
        } else {
          resultado.falhados++;
        }

        resultado.detalhes.push({
          utenteId: utente.id,
          utenteNome: utente.nome,
          canal,
          sucesso,
          erro,
        });
      } catch (error) {
        resultado.falhados++;
        resultado.detalhes.push({
          utenteId: utente.id,
          utenteNome: utente.nome,
          canal,
          sucesso: false,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return resultado;
  }

  /**
   * Gerar mensagem de reativação personalizada
   */
  private async gerarMensagemReativacao(utente: UtenteInativo): Promise<string> {
    const mesesInativo = Math.floor(utente.diasDesdeUltimaConsulta / 30);

    let mensagem = `Olá ${utente.nome}! 👋\n\n`;

    if (utente.status === 'em_risco') {
      mensagem += `Notamos que faz ${mesesInativo} meses desde a sua última consulta. `;
      mensagem += `Que tal agendar um check-up preventivo?\n\n`;
      mensagem += `Cuidar da sua saúde oral regularmente previne problemas futuros! 🦷`;
    } else if (utente.status === 'inativo') {
      mensagem += `Sentimos a sua falta! Faz ${mesesInativo} meses que não nos visita. `;
      mensagem += `Gostaríamos de agendar uma consulta de revisão.\n\n`;
      mensagem += `**Oferta especial:** 20% de desconto na próxima consulta! 🎁`;
    } else if (utente.status === 'dormante') {
      mensagem += `Há quanto tempo! Faz mais de um ano que não nos visita. `;
      mensagem += `Gostaríamos muito de revê-lo(a)!\n\n`;
      mensagem += `**Promoção exclusiva:** Check-up completo com 30% de desconto! 🌟`;
    } else {
      mensagem += `Esperamos que esteja bem! `;
      mensagem += `Estamos com saudades e gostaríamos de ajudá-lo(a) a cuidar do seu sorriso novamente.\n\n`;
      mensagem += `Entre em contato connosco para agendar! 📞`;
    }

    return mensagem;
  }

  /**
   * Personalizar mensagem com dados do utente
   */
  private personalizarMensagem(
    template: string,
    dados: { nome: string; clinicaNome: string }
  ): string {
    return template
      .replace(/\{nome\}/g, dados.nome)
      .replace(/\{clinica\}/g, dados.clinicaNome);
  }

  /**
   * Obter sequência de follow-up predefinida
   */
  private async obterSequencia(tipo: TipoFollowUp): Promise<SequenciaFollowUp | null> {
    // Sequências predefinidas
    const sequencias: Record<TipoFollowUp, SequenciaFollowUp> = {
      pos_tratamento: {
        id: 1,
        tipo: 'pos_tratamento',
        nome: 'Follow-up Pós-Tratamento',
        descricao: 'Acompanhamento após tratamento concluído',
        etapas: [
          {
            ordem: 1,
            diasAposInicio: 3,
            canal: 'whatsapp',
            assunto: 'Como está a recuperar?',
            mensagem: 'Olá {nome}! Como está a sentir-se após o tratamento? Alguma dúvida ou desconforto?',
          },
          {
            ordem: 2,
            diasAposInicio: 7,
            canal: 'whatsapp',
            assunto: 'Lembrete de cuidados',
            mensagem: 'Olá {nome}! Lembre-se de seguir as recomendações pós-tratamento. Qualquer dúvida, estamos aqui!',
            condicao: 'se não respondeu',
          },
        ],
      },
      reativacao: {
        id: 2,
        tipo: 'reativacao',
        nome: 'Reativação de Utente Inativo',
        descricao: 'Sequência para reativar utentes inativos',
        etapas: [
          {
            ordem: 1,
            diasAposInicio: 0,
            canal: 'whatsapp',
            assunto: 'Sentimos a sua falta!',
            mensagem: 'Olá {nome}! Sentimos a sua falta na {clinica}. Que tal agendar um check-up?',
          },
          {
            ordem: 2,
            diasAposInicio: 7,
            canal: 'email',
            assunto: 'Oferta especial para você',
            mensagem: 'Olá {nome}! Temos uma oferta especial: 20% de desconto na próxima consulta!',
            condicao: 'se não agendou',
          },
        ],
      },
      preventivo: {
        id: 3,
        tipo: 'preventivo',
        nome: 'Lembrete Preventivo',
        descricao: 'Lembrete de check-up preventivo',
        etapas: [
          {
            ordem: 1,
            diasAposInicio: 0,
            canal: 'whatsapp',
            assunto: 'Hora do check-up!',
            mensagem: 'Olá {nome}! Está na hora do seu check-up semestral. Agende já!',
          },
        ],
      },
      fidelizacao: {
        id: 4,
        tipo: 'fidelizacao',
        nome: 'Fidelização',
        descricao: 'Manter utente ativo engajado',
        etapas: [
          {
            ordem: 1,
            diasAposInicio: 0,
            canal: 'email',
            assunto: 'Obrigado pela confiança!',
            mensagem: 'Olá {nome}! Obrigado por confiar na {clinica}. Estamos sempre aqui para cuidar do seu sorriso!',
          },
        ],
      },
      recuperacao: {
        id: 5,
        tipo: 'recuperacao',
        nome: 'Recuperação de Utente Perdido',
        descricao: 'Última tentativa de recuperar utente',
        etapas: [
          {
            ordem: 1,
            diasAposInicio: 0,
            canal: 'whatsapp',
            assunto: 'Última chamada!',
            mensagem: 'Olá {nome}! Gostaríamos muito de revê-lo(a). Oferta especial: 30% de desconto!',
          },
        ],
      },
    };

    return sequencias[tipo] || null;
  }

  /**
   * Obter estatísticas de follow-up
   */
  async obterEstatisticas(clinicaId: number): Promise<any> {
    const utentesInativos = await this.identificarUtentesInativos(clinicaId);

    const stats = {
      total: utentesInativos.length,
      porStatus: {
        ativo: utentesInativos.filter((u) => u.status === 'ativo').length,
        emRisco: utentesInativos.filter((u) => u.status === 'em_risco').length,
        inativo: utentesInativos.filter((u) => u.status === 'inativo').length,
        dormante: utentesInativos.filter((u) => u.status === 'dormante').length,
        perdido: utentesInativos.filter((u) => u.status === 'perdido').length,
      },
      altaPropensao: utentesInativos.filter((u) => u.propensaoRetorno >= 70).length,
      mediaPropensao: utentesInativos.filter(
        (u) => u.propensaoRetorno >= 40 && u.propensaoRetorno < 70
      ).length,
      baixaPropensao: utentesInativos.filter((u) => u.propensaoRetorno < 40).length,
      valorEmRisco: utentesInativos
        .filter((u) => u.status !== 'ativo')
        .reduce((sum, u) => sum + u.valorVitalicio, 0),
    };

    return stats;
  }
}

// Exportar instância singleton
export const followUpService = new FollowUpService();

// Exportar classe para testes
export default FollowUpService;

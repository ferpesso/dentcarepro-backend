/**
 * Serviço de Email Marketing Automatizado
 * 
 * Funcionalidades:
 * - Campanhas de email
 * - Segmentação de utentes
 * - Automações (drip campaigns)
 * - A/B testing
 * - Analytics (abertura, cliques)
 * - Templates personalizáveis
 * - Integração com Resend/SendGrid
 */

import { getDb } from './db';
import { utentes, consultas, faturas, mensagensUtente } from '../drizzle/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import axios from 'axios';

/**
 * Configuração do provedor de email
 */
interface EmailProviderConfig {
  provider: 'resend' | 'sendgrid';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Segmento de utentes
 */
export interface Segmento {
  id: string;
  nome: string;
  descricao: string;
  filtros: FiltroSegmento[];
  totalUtentes?: number;
}

/**
 * Filtro de segmentação
 */
export interface FiltroSegmento {
  campo: 'idade' | 'genero' | 'ultimaConsulta' | 'totalConsultas' | 'valorGasto' | 'status';
  operador: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contem' | 'nao_contem';
  valor: string | number;
}

/**
 * Campanha de email
 */
export interface Campanha {
  id: number;
  clinicaId: number;
  nome: string;
  assunto: string;
  remetente: string;
  conteudoHtml: string;
  conteudoTexto: string;
  segmentoId?: string;
  agendadaPara?: Date;
  estado: 'rascunho' | 'agendada' | 'enviando' | 'enviada' | 'cancelada';
  totalDestinatarios?: number;
  totalEnviados?: number;
  totalAberturas?: number;
  totalCliques?: number;
  criadaEm: Date;
  enviadaEm?: Date;
}

/**
 * Automação (drip campaign)
 */
export interface Automacao {
  id: number;
  clinicaId: number;
  nome: string;
  descricao: string;
  gatilho: 'nova_consulta' | 'consulta_concluida' | 'aniversario' | 'inatividade' | 'manual';
  ativa: boolean;
  emails: EmailAutomacao[];
}

/**
 * Email de automação
 */
export interface EmailAutomacao {
  ordem: number;
  diasAposGatilho: number;
  assunto: string;
  conteudoHtml: string;
  conteudoTexto: string;
  condicao?: string;
}

/**
 * Resultado de envio
 */
export interface ResultadoEnvio {
  total: number;
  enviados: number;
  falhados: number;
  detalhes: {
    destinatario: string;
    sucesso: boolean;
    messageId?: string;
    erro?: string;
  }[];
}

/**
 * Analytics de email
 */
export interface EmailAnalytics {
  campanhaId: number;
  totalEnviados: number;
  totalAberturas: number;
  totalCliques: number;
  taxaAbertura: number; // %
  taxaClique: number; // %
  taxaBounce: number; // %
  topLinks: { url: string; cliques: number }[];
}

/**
 * Serviço de Email Marketing
 */
export class EmailMarketingService {
  private config: EmailProviderConfig;

  constructor(config?: EmailProviderConfig) {
    this.config = config || {
      provider: (process.env.EMAIL_PROVIDER as 'resend' | 'sendgrid') || 'resend',
      apiKey: process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || '',
      fromEmail: process.env.EMAIL_FROM || 'noreply@dentcarepro.com',
      fromName: process.env.EMAIL_FROM_NAME || 'DentCarePro',
    };
  }

  /**
   * Verificar se está configurado
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail);
  }

  /**
   * Criar segmento de utentes
   */
  async criarSegmento(
    clinicaId: number,
    segmento: Omit<Segmento, 'id' | 'totalUtentes'>
  ): Promise<Segmento> {
    const id = `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const totalUtentes = await this.contarUtentesSegmento(clinicaId, segmento.filtros);

    return {
      id,
      ...segmento,
      totalUtentes,
    };
  }

  /**
   * Contar utentes em um segmento
   */
  private async contarUtentesSegmento(
    clinicaId: number,
    filtros: FiltroSegmento[]
  ): Promise<number> {
    const db = await getDb();
    
    // Construir query dinâmica baseada nos filtros
    let query = sql`
      SELECT COUNT(DISTINCT u.id) as total
      FROM utentes u
      LEFT JOIN consultas c ON u.id = c.utente_id
      LEFT JOIN faturas f ON u.id = f.utente_id
      WHERE u.clinica_id = ${clinicaId} AND u.ativo = 1
    `;

    // Adicionar filtros
    for (const filtro of filtros) {
      if (filtro.campo === 'idade') {
        query = sql`${query} AND TIMESTAMPDIFF(YEAR, u.data_nascimento, CURDATE()) ${sql.raw(filtro.operador)} ${filtro.valor}`;
      } else if (filtro.campo === 'genero') {
        query = sql`${query} AND u.genero ${sql.raw(filtro.operador)} ${filtro.valor}`;
      } else if (filtro.campo === 'ultimaConsulta') {
        query = sql`${query} AND DATEDIFF(NOW(), MAX(c.hora_inicio)) ${sql.raw(filtro.operador)} ${filtro.valor}`;
      }
      // Adicionar mais filtros conforme necessário
    }

    const resultado: any[] = await db.execute(query);
    return parseInt(resultado[0]?.total) || 0;
  }

  /**
   * Obter utentes de um segmento
   */
  async obterUtentesSegmento(
    clinicaId: number,
    filtros: FiltroSegmento[]
  ): Promise<any[]> {
    const db = await getDb();
    
    // Por simplicidade, retornar todos os utentes ativos
    // Em produção, aplicar filtros complexos
    const resultado = await db
      .select({
        id: utentes.id,
        nome: utentes.nome,
        email: utentes.email,
        telemovel: utentes.telemovel,
      })
      .from(utentes)
      .where(and(eq(utentes.clinicaId, clinicaId), eq(utentes.ativo, true)));

    return resultado.filter((u) => u.email); // Apenas com email
  }

  /**
   * Criar campanha
   */
  async criarCampanha(campanha: Omit<Campanha, 'id' | 'criadaEm'>): Promise<Campanha> {
    const db = await getDb();
    
    // TODO: Salvar campanha no banco de dados
    // Por agora, retornar objeto mock
    
    return {
      id: Date.now(),
      ...campanha,
      criadaEm: new Date(),
    };
  }

  /**
   * Enviar campanha
   */
  async enviarCampanha(campanhaId: number): Promise<ResultadoEnvio> {
    // TODO: Obter campanha do banco de dados
    // Por agora, usar dados mock
    
    const campanha: Campanha = {
      id: campanhaId,
      clinicaId: 1,
      nome: 'Campanha Teste',
      assunto: 'Teste',
      remetente: this.config.fromEmail,
      conteudoHtml: '<p>Teste</p>',
      conteudoTexto: 'Teste',
      estado: 'enviando',
      criadaEm: new Date(),
    };

    // Obter destinatários
    const destinatarios = campanha.segmentoId
      ? await this.obterUtentesSegmento(campanha.clinicaId, [])
      : [];

    const resultado: ResultadoEnvio = {
      total: destinatarios.length,
      enviados: 0,
      falhados: 0,
      detalhes: [],
    };

    // Enviar para cada destinatário
    for (const destinatario of destinatarios) {
      if (!destinatario.email) continue;

      try {
        const messageId = await this.enviarEmail({
          to: destinatario.email,
          subject: campanha.assunto,
          html: this.personalizarConteudo(campanha.conteudoHtml, destinatario),
          text: this.personalizarConteudo(campanha.conteudoTexto, destinatario),
        });

        resultado.enviados++;
        resultado.detalhes.push({
          destinatario: destinatario.email,
          sucesso: true,
          messageId,
        });

        // Registrar envio
        await this.registrarEnvio(
          campanha.clinicaId,
          destinatario.id,
          campanhaId,
          'email',
          campanha.assunto,
          'enviada'
        );
      } catch (error) {
        resultado.falhados++;
        resultado.detalhes.push({
          destinatario: destinatario.email,
          sucesso: false,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });

        await this.registrarEnvio(
          campanha.clinicaId,
          destinatario.id,
          campanhaId,
          'email',
          campanha.assunto,
          'falhada'
        );
      }
    }

    return resultado;
  }

  /**
   * Enviar email individual
   */
  private async enviarEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<string> {
    if (this.config.provider === 'resend') {
      return await this.enviarResend(params);
    } else {
      return await this.enviarSendGrid(params);
    }
  }

  /**
   * Enviar via Resend
   */
  private async enviarResend(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<string> {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id;
  }

  /**
   * Enviar via SendGrid
   */
  private async enviarSendGrid(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<string> {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: [{ email: params.to }],
            subject: params.subject,
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        content: [
          {
            type: 'text/plain',
            value: params.text,
          },
          {
            type: 'text/html',
            value: params.html,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.headers['x-message-id'] || 'unknown';
  }

  /**
   * Personalizar conteúdo com dados do destinatário
   */
  private personalizarConteudo(template: string, dados: any): string {
    let conteudo = template;
    
    // Substituir variáveis
    conteudo = conteudo.replace(/\{\{nome\}\}/g, dados.nome || '');
    conteudo = conteudo.replace(/\{\{email\}\}/g, dados.email || '');
    conteudo = conteudo.replace(/\{\{telemovel\}\}/g, dados.telemovel || '');
    
    // Adicionar link de descadastro
    conteudo += `\n\n<p style="font-size: 12px; color: #999;">Para deixar de receber estes emails, <a href="{{unsubscribe_url}}">clique aqui</a>.</p>`;
    
    return conteudo;
  }

  /**
   * Registrar envio no banco de dados
   */
  private async registrarEnvio(
    clinicaId: number,
    utenteId: number,
    campanhaId: number,
    canal: string,
    assunto: string,
    estado: string
  ): Promise<void> {
    try {
      const db = await getDb();
      await db.insert(mensagensUtente).values({
        clinicaId,
        utenteId,
        canal,
        tipo: 'marketing',
        assunto,
        conteudo: `Campanha ID: ${campanhaId}`,
        estado,
        dataEnvio: new Date(),
      });
    } catch (error) {
      console.error('Erro ao registrar envio:', error);
    }
  }

  /**
   * Criar automação (drip campaign)
   */
  async criarAutomacao(automacao: Omit<Automacao, 'id'>): Promise<Automacao> {
    // TODO: Salvar no banco de dados
    return {
      id: Date.now(),
      ...automacao,
    };
  }

  /**
   * Executar automação para um utente
   */
  async executarAutomacao(
    automacaoId: number,
    utenteId: number,
    clinicaId: number
  ): Promise<void> {
    // TODO: Implementar lógica de execução de automação
    // Agendar emails conforme os dias após gatilho
  }

  /**
   * Obter analytics de campanha
   */
  async obterAnalytics(campanhaId: number): Promise<EmailAnalytics> {
    const db = await getDb();
    
    // Query para obter estatísticas
    const query = sql`
      SELECT 
        COUNT(*) as totalEnviados,
        SUM(CASE WHEN aberto = 1 THEN 1 ELSE 0 END) as totalAberturas,
        SUM(CASE WHEN clicou = 1 THEN 1 ELSE 0 END) as totalCliques,
        SUM(CASE WHEN bounce = 1 THEN 1 ELSE 0 END) as totalBounces
      FROM mensagens_utente
      WHERE tipo = 'marketing'
        AND conteudo LIKE ${`%Campanha ID: ${campanhaId}%`}
    `;

    const resultado: any[] = await db.execute(query);
    const stats = resultado[0] || {};

    const totalEnviados = parseInt(stats.totalEnviados) || 0;
    const totalAberturas = parseInt(stats.totalAberturas) || 0;
    const totalCliques = parseInt(stats.totalCliques) || 0;
    const totalBounces = parseInt(stats.totalBounces) || 0;

    return {
      campanhaId,
      totalEnviados,
      totalAberturas,
      totalCliques,
      taxaAbertura: totalEnviados > 0 ? (totalAberturas / totalEnviados) * 100 : 0,
      taxaClique: totalEnviados > 0 ? (totalCliques / totalEnviados) * 100 : 0,
      taxaBounce: totalEnviados > 0 ? (totalBounces / totalEnviados) * 100 : 0,
      topLinks: [], // TODO: Implementar tracking de links
    };
  }

  /**
   * Registrar abertura de email
   */
  async registrarAbertura(campanhaId: number, utenteId: number): Promise<void> {
    const db = await getDb();
    
    // TODO: Atualizar registro de mensagem
    // await db.update(mensagensUtente)
    //   .set({ aberto: true, dataAbertura: new Date() })
    //   .where(...)
  }

  /**
   * Registrar clique em link
   */
  async registrarClique(
    campanhaId: number,
    utenteId: number,
    url: string
  ): Promise<void> {
    const db = await getDb();
    
    // TODO: Atualizar registro de mensagem e salvar URL clicada
    // await db.update(mensagensUtente)
    //   .set({ clicou: true })
    //   .where(...)
  }

  /**
   * Obter templates de email predefinidos
   */
  getTemplates(): any[] {
    return [
      {
        id: 'boas-vindas',
        nome: 'Boas-vindas',
        assunto: 'Bem-vindo(a) à {{clinica}}!',
        html: `
          <h1>Bem-vindo(a), {{nome}}!</h1>
          <p>Estamos muito felizes em tê-lo(a) como nosso utente.</p>
          <p>Na {{clinica}}, cuidamos do seu sorriso com dedicação e profissionalismo.</p>
        `,
      },
      {
        id: 'aniversario',
        nome: 'Aniversário',
        assunto: 'Feliz Aniversário, {{nome}}! 🎉',
        html: `
          <h1>Feliz Aniversário! 🎂</h1>
          <p>A equipa da {{clinica}} deseja-lhe um dia maravilhoso!</p>
          <p><strong>Presente especial:</strong> 20% de desconto na próxima consulta!</p>
        `,
      },
      {
        id: 'checkup',
        nome: 'Lembrete de Check-up',
        assunto: 'Hora do seu check-up semestral',
        html: `
          <h1>Olá, {{nome}}!</h1>
          <p>Está na hora do seu check-up semestral.</p>
          <p>Cuidar da sua saúde oral regularmente previne problemas futuros.</p>
          <p><a href="{{link_agendamento}}">Agende já a sua consulta!</a></p>
        `,
      },
      {
        id: 'promocao',
        nome: 'Promoção',
        assunto: 'Oferta especial para você!',
        html: `
          <h1>Oferta Exclusiva! 🌟</h1>
          <p>Olá, {{nome}}!</p>
          <p>Temos uma promoção especial para si:</p>
          <h2>30% de desconto em tratamentos selecionados</h2>
          <p>Válido até {{data_validade}}</p>
          <p><a href="{{link_agendamento}}">Aproveite agora!</a></p>
        `,
      },
    ];
  }
}

// Exportar instância singleton
export const emailMarketingService = new EmailMarketingService();

// Exportar classe para testes
export default EmailMarketingService;

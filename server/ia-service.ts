import { OpenAI } from "openai";
import { getDb } from "./db";
import { configuracoesIA, analisesIA, logsUsoIA } from "../drizzle/schema-ia";
import { eq } from "drizzle-orm";

/**
 * Serviço de IA para DentCare Pro
 * Análise de imagens, chat assistente, insights automáticos
 */

interface ConfigIA {
  provedor: string;
  apiKey: string;
  modeloTexto: string;
  modeloVisao: string;
  temperaturaTexto: number;
  temperaturaAnalise: number;
  maxTokens: number;
}

export class IAService {
  private config: ConfigIA | null = null;
  private client: OpenAI | null = null;

  /**
   * Inicializar serviço com configurações da clínica
   */
  async inicializar(clinicaId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const configs = await db
      .select()
      .from(configuracoesIA)
      .where(eq(configuracoesIA.clinicaId, clinicaId))
      .limit(1);

    if (!configs.length || !configs[0].ativo) {
      throw new Error("IA não configurada para esta clínica");
    }

    const config = configs[0];

    this.config = {
      provedor: config.provedor,
      apiKey: config.apiKey,
      modeloTexto: config.modeloTexto || "gpt-4",
      modeloVisao: config.modeloVisao || "gpt-4-vision-preview",
      temperaturaTexto: (config.temperaturaTexto || 70) / 100,
      temperaturaAnalise: (config.temperaturaAnalise || 30) / 100,
      maxTokens: config.maxTokens || 2000,
    };

    // Inicializar cliente OpenAI
    if (config.provedor === "openai") {
      this.client = new OpenAI({
        apiKey: config.apiKey,
      });
    }

    return this;
  }

  /**
   * Analisar imagem dentária
   */
  async analisarImagem(params: {
    clinicaId: number;
    utenteId?: number;
    imagemUrl: string;
    tipoImagem: string;
    contexto?: any;
  }) {
    if (!this.client || !this.config) {
      throw new Error("Serviço de IA não inicializado");
    }

    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const startTime = Date.now();

    try {
      // Prompt especializado baseado no tipo de imagem
      const prompt = this.gerarPromptAnaliseImagem(params.tipoImagem, params.contexto);

      const response = await this.client.chat.completions.create({
        model: this.config.modeloVisao,
        messages: [
          {
            role: "system",
            content: `Você é um assistente de IA especializado em odontologia. 
Analise imagens dentárias com precisão profissional, identificando problemas, 
condições e fornecendo recomendações baseadas em evidências científicas.
Sempre indique o nível de confiança das suas análises.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: params.imagemUrl,
                },
              },
            ],
          },
        ],
        temperature: this.config.temperaturaAnalise,
        max_tokens: this.config.maxTokens,
      });

      const resposta = response.choices[0]?.message?.content || "";
      const tokens = response.usage?.total_tokens || 0;

      // Extrair dados estruturados da resposta
      const dadosEstruturados = this.extrairDadosEstruturados(resposta, params.tipoImagem);

      // Salvar análise
      const [analise] = await database.insert(analisesIA).values({
        clinicaId: params.clinicaId,
        utenteId: params.utenteId,
        tipo: "analise_imagem",
        prompt,
        imagemUrl: params.imagemUrl,
        contexto: params.contexto,
        resposta,
        confianca: dadosEstruturados.confiancaMedia,
        dadosEstruturados,
        modelo: this.config.modeloVisao,
        tokens,
        custoEstimado: this.calcularCusto(tokens, this.config.modeloVisao),
        tempoProcessamento: Date.now() - startTime,
      });

      // Log de uso
      await this.registrarUso({
        clinicaId: params.clinicaId,
        funcionalidade: "analise_imagem",
        modelo: this.config.modeloVisao,
        tokens,
        tempoProcessamento: Date.now() - startTime,
        sucesso: true,
      });

      return {
        analiseId: analise.insertId,
        resposta,
        dadosEstruturados,
        tokens,
        tempoProcessamento: Date.now() - startTime,
      };
    } catch (error: any) {
      // Log de erro
      await this.registrarUso({
        clinicaId: params.clinicaId,
        funcionalidade: "analise_imagem",
        modelo: this.config.modeloVisao,
        tokens: 0,
        tempoProcessamento: Date.now() - startTime,
        sucesso: false,
        erro: error.message,
      });

      throw error;
    }
  }

  /**
   * Gerar diagnóstico baseado em dados do utente
   */
  async gerarDiagnostico(params: {
    clinicaId: number;
    utenteId: number;
    sintomas: string;
    historicoMedico?: any;
    odontograma?: any;
    imagens?: string[];
  }) {
    if (!this.client || !this.config) {
      throw new Error("Serviço de IA não inicializado");
    }

    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const startTime = Date.now();

    try {
      const prompt = `
Paciente apresenta os seguintes sintomas:
${params.sintomas}

${params.historicoMedico ? `Histórico Médico:\n${JSON.stringify(params.historicoMedico, null, 2)}` : ""}

${params.odontograma ? `Estado do Odontograma:\n${JSON.stringify(params.odontograma, null, 2)}` : ""}

Por favor, forneça:
1. Possíveis diagnósticos (do mais provável ao menos provável)
2. Exames complementares recomendados
3. Diagnóstico diferencial
4. Nível de urgência
5. Recomendações iniciais

Formato da resposta em JSON:
{
  "diagnosticosPossiveis": [
    {"nome": "...", "probabilidade": 0-100, "justificativa": "..."}
  ],
  "examesRecomendados": ["..."],
  "diagnosticoDiferencial": ["..."],
  "urgencia": "baixa|media|alta|urgente",
  "recomendacoes": ["..."]
}
`;

      const response = await this.client.chat.completions.create({
        model: this.config.modeloTexto,
        messages: [
          {
            role: "system",
            content: `Você é um dentista experiente. Analise os dados do paciente e forneça 
diagnósticos possíveis com base em evidências científicas. Seja preciso e conservador.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: this.config.temperaturaAnalise,
        max_tokens: this.config.maxTokens,
        response_format: { type: "json_object" },
      });

      const resposta = response.choices[0]?.message?.content || "{}";
      const tokens = response.usage?.total_tokens || 0;
      const dadosEstruturados = JSON.parse(resposta);

      // Salvar análise
      await database.insert(analisesIA).values({
        clinicaId: params.clinicaId,
        utenteId: params.utenteId,
        tipo: "diagnostico",
        prompt,
        resposta,
        dadosEstruturados,
        modelo: this.config.modeloTexto,
        tokens,
        custoEstimado: this.calcularCusto(tokens, this.config.modeloTexto),
        tempoProcessamento: Date.now() - startTime,
      });

      await this.registrarUso({
        clinicaId: params.clinicaId,
        funcionalidade: "diagnostico",
        modelo: this.config.modeloTexto,
        tokens,
        tempoProcessamento: Date.now() - startTime,
        sucesso: true,
      });

      return dadosEstruturados;
    } catch (error: any) {
      await this.registrarUso({
        clinicaId: params.clinicaId,
        funcionalidade: "diagnostico",
        modelo: this.config.modeloTexto,
        tokens: 0,
        tempoProcessamento: Date.now() - startTime,
        sucesso: false,
        erro: error.message,
      });

      throw error;
    }
  }

  /**
   * Gerar plano de tratamento
   */
  async gerarPlanoTratamento(params: {
    clinicaId: number;
    utenteId: number;
    diagnostico: string;
    condicoes?: any;
    orcamento?: number;
  }) {
    if (!this.client || !this.config) {
      throw new Error("Serviço de IA não inicializado");
    }

    const prompt = `
Diagnóstico: ${params.diagnostico}

${params.condicoes ? `Condições do paciente:\n${JSON.stringify(params.condicoes, null, 2)}` : ""}

${params.orcamento ? `Orçamento disponível: €${params.orcamento}` : ""}

Crie um plano de tratamento detalhado incluindo:
1. Objetivos do tratamento
2. Fases do tratamento (ordem de prioridade)
3. Procedimentos necessários
4. Duração estimada
5. Custo estimado por fase
6. Alternativas de tratamento
7. Prognóstico

Formato JSON:
{
  "objetivos": ["..."],
  "fases": [
    {
      "numero": 1,
      "titulo": "...",
      "procedimentos": ["..."],
      "duracaoEstimada": "...",
      "custoEstimado": 0,
      "prioridade": "urgente|alta|media|baixa"
    }
  ],
  "alternativas": ["..."],
  "prognostico": "...",
  "custoTotal": 0,
  "duracaoTotal": "..."
}
`;

    const response = await this.client.chat.completions.create({
      model: this.config.modeloTexto,
      messages: [
        {
          role: "system",
          content: `Você é um dentista especializado em planejamento de tratamentos. 
Crie planos detalhados, realistas e baseados em evidências científicas.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: this.config.temperaturaTexto,
      max_tokens: this.config.maxTokens,
      response_format: { type: "json_object" },
    });

    const resposta = response.choices[0]?.message?.content || "{}";
    const dadosEstruturados = JSON.parse(resposta);

    const db = await getDb(); if (!db) throw new Error("Database not available"); await db.insert(analisesIA).values({
      clinicaId: params.clinicaId,
      utenteId: params.utenteId,
      tipo: "plano_tratamento",
      prompt,
      resposta,
      dadosEstruturados,
      modelo: this.config.modeloTexto,
      tokens: response.usage?.total_tokens || 0,
      custoEstimado: this.calcularCusto(
        response.usage?.total_tokens || 0,
        this.config.modeloTexto
      ),
    });

    return dadosEstruturados;
  }

  /**
   * Analisar risco de cárie
   */
  async analisarRiscoCarie(params: {
    clinicaId: number;
    utenteId: number;
    odontograma: any;
    historicoMedico: any;
    habitos?: any;
  }) {
    if (!this.client || !this.config) {
      throw new Error("Serviço de IA não inicializado");
    }

    const prompt = `
Analise o risco de cárie deste paciente baseado em:

Odontograma: ${JSON.stringify(params.odontograma, null, 2)}
Histórico Médico: ${JSON.stringify(params.historicoMedico, null, 2)}
${params.habitos ? `Hábitos: ${JSON.stringify(params.habitos, null, 2)}` : ""}

Forneça:
1. Nível de risco (baixo, moderado, alto)
2. Fatores de risco identificados
3. Recomendações preventivas
4. Frequência de consultas recomendada

JSON:
{
  "nivelRisco": "baixo|moderado|alto",
  "pontuacaoRisco": 0-100,
  "fatoresRisco": [{"fator": "...", "impacto": "..."}],
  "recomendacoes": ["..."],
  "frequenciaConsultas": "..."
}
`;

    const response = await this.client.chat.completions.create({
      model: this.config.modeloTexto,
      messages: [
        {
          role: "system",
          content: "Você é um especialista em cariologia. Avalie riscos de cárie com precisão.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: this.config.temperaturaAnalise,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const dadosEstruturados = JSON.parse(response.choices[0]?.message?.content || "{}");

    const db = await getDb(); if (!db) throw new Error("Database not available"); await db.insert(analisesIA).values({
      clinicaId: params.clinicaId,
      utenteId: params.utenteId,
      tipo: "risco_carie",
      prompt,
      resposta: JSON.stringify(dadosEstruturados),
      confianca: dadosEstruturados.pontuacaoRisco,
      dadosEstruturados,
      modelo: this.config.modeloTexto,
      tokens: response.usage?.total_tokens || 0,
    });

    return dadosEstruturados;
  }

  /**
   * Gerar prompts especializados por tipo de imagem
   */
  private gerarPromptAnaliseImagem(tipoImagem: string, contexto?: any): string {
    const prompts: Record<string, string> = {
      raio_x_panoramico: `
Analise este raio-X panorâmico e identifique:
1. Cáries visíveis (localização e extensão)
2. Perda óssea (localização e severidade)
3. Dentes ausentes ou impactados
4. Lesões periapicais
5. Qualidade de restaurações existentes
6. Anomalias ou patologias
7. Recomendações de tratamento

Forneça a resposta em formato estruturado com nível de confiança para cada detecção.`,

      raio_x_periapical: `
Analise este raio-X periapical e avalie:
1. Presença de cáries
2. Qualidade de tratamentos endodônticos
3. Lesões periapicais
4. Perda óssea
5. Anatomia radicular
6. Qualidade de restaurações

Indique o nível de confiança de cada observação.`,

      foto_intraoral: `
Analise esta foto intraoral e identifique:
1. Condição da gengiva (cor, textura, inflamação)
2. Presença de placa ou cálculo
3. Condição dos dentes visíveis
4. Lesões de tecidos moles
5. Qualidade de restaurações visíveis
6. Higiene oral geral

Forneça avaliação detalhada com nível de confiança.`,

      tc_cone_beam: `
Analise esta TC Cone Beam e avalie:
1. Densidade óssea
2. Anatomia das estruturas
3. Patologias ou lesões
4. Viabilidade para implantes
5. Relação com estruturas anatômicas importantes

Forneça análise tridimensional detalhada.`,
    };

    return prompts[tipoImagem] || prompts.foto_intraoral;
  }

  /**
   * Extrair dados estruturados da resposta de análise
   */
  private extrairDadosEstruturados(resposta: string, tipoImagem: string) {
    // Tentar extrair JSON se existir
    const jsonMatch = resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Continuar com extração manual
      }
    }

    // Extração básica
    return {
      resumo: resposta.substring(0, 200),
      confiancaMedia: 75,
      deteccoes: [],
      recomendacoes: [],
    };
  }

  /**
   * Calcular custo estimado baseado em tokens
   */
  private calcularCusto(tokens: number, modelo: string): number {
    // Custos aproximados por 1K tokens (em centavos)
    const custos: Record<string, number> = {
      "gpt-4": 3,
      "gpt-4-vision-preview": 4,
      "gpt-3.5-turbo": 0.2,
    };

    const custoPor1K = custos[modelo] || 1;
    return Math.ceil((tokens / 1000) * custoPor1K);
  }

  /**
   * Registrar uso para logs e limites
   */
  private async registrarUso(params: {
    clinicaId: number;
    funcionalidade: string;
    modelo: string;
    tokens: number;
    tempoProcessamento: number;
    sucesso: boolean;
    erro?: string;
  }) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    const db = await getDb(); if (!db) throw new Error("Database not available"); await db.insert(logsUsoIA).values({
      clinicaId: params.clinicaId,
      funcionalidade: params.funcionalidade,
      modelo: params.modelo,
      tokens: params.tokens,
      custoEstimado: this.calcularCusto(params.tokens, params.modelo),
      tempoProcessamento: params.tempoProcessamento,
      sucesso: params.sucesso,
      erro: params.erro,
    });
  }
}

// Instância singleton
export const iaService = new IAService();

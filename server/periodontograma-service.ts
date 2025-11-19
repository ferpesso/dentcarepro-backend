import { getDb } from "./db";
import { periodontograma } from "../drizzle/schema-ficha-utente";
import { eq, and, desc } from "drizzle-orm";

/**
 * Serviço de Periodontograma
 * Gestão completa de avaliações periodontais
 */

interface MedicaoDente {
  profundidadeSondagem: {
    mesial: number;
    central: number;
    distal: number;
  };
  nivelInsercao: {
    mesial: number;
    central: number;
    distal: number;
  };
  sangramento: boolean;
  supuracao: boolean;
  mobilidade: number; // 0-3
  furca: number; // 0-3
  placa: boolean;
}

interface MedicoesCompletas {
  [dente: string]: MedicaoDente;
}

export class PeriodontogramaService {
  /**
   * Criar nova avaliação periodontal
   */
  async criar(params: {
    utenteId: number;
    clinicaId: number;
    dataAvaliacao: Date;
    medicoes: MedicoesCompletas;
    diagnostico?: string;
    planoTratamento?: string;
    observacoes?: string;
    registadoPor: number;
  }) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    // Calcular índices automaticamente
    const indices = this.calcularIndices(params.medicoes);

    const [resultado] = await database.insert(periodontograma).values({
      utenteId: params.utenteId,
      clinicaId: params.clinicaId,
      dataAvaliacao: params.dataAvaliacao,
      medicoes: params.medicoes,
      indicePlaca: indices.indicePlaca.toString(),
      indiceSangramento: indices.indiceSangramento.toString(),
      indiceProfundidade: indices.indiceProfundidade.toString(),
      diagnostico: params.diagnostico,
      planoTratamento: params.planoTratamento,
      observacoes: params.observacoes,
      registadoPor: params.registadoPor,
    });

    return {
      id: resultado.insertId,
      indices,
    };
  }

  /**
   * Atualizar avaliação periodontal
   */
  async atualizar(params: {
    id: number;
    medicoes?: MedicoesCompletas;
    diagnostico?: string;
    planoTratamento?: string;
    observacoes?: string;
  }) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    const updates: any = {};

    if (params.medicoes) {
      const indices = this.calcularIndices(params.medicoes);
      updates.medicoes = params.medicoes;
      updates.indicePlaca = indices.indicePlaca.toString();
      updates.indiceSangramento = indices.indiceSangramento.toString();
      updates.indiceProfundidade = indices.indiceProfundidade.toString();
    }

    if (params.diagnostico !== undefined) updates.diagnostico = params.diagnostico;
    if (params.planoTratamento !== undefined) updates.planoTratamento = params.planoTratamento;
    if (params.observacoes !== undefined) updates.observacoes = params.observacoes;

    await database.update(periodontograma).set(updates).where(eq(periodontograma.id, params.id));

    return { success: true };
  }

  /**
   * Buscar avaliações de um utente
   */
  async buscarPorUtente(utenteId: number, limite: number = 10) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    return await database
      .select()
      .from(periodontograma)
      .where(eq(periodontograma.utenteId, utenteId))
      .orderBy(desc(periodontograma.dataAvaliacao))
      .limit(limite);
  }

  /**
   * Buscar avaliação específica
   */
  async buscarPorId(id: number) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    const resultado = await database
      .select()
      .from(periodontograma)
      .where(eq(periodontograma.id, id))
      .limit(1);

    return resultado[0] || null;
  }

  /**
   * Buscar última avaliação
   */
  async buscarUltima(utenteId: number) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    const resultado = await database
      .select()
      .from(periodontograma)
      .where(eq(periodontograma.utenteId, utenteId))
      .orderBy(desc(periodontograma.dataAvaliacao))
      .limit(1);

    return resultado[0] || null;
  }

  /**
   * Comparar duas avaliações
   */
  async comparar(id1: number, id2: number) {
    const [avaliacao1, avaliacao2] = await Promise.all([
      this.buscarPorId(id1),
      this.buscarPorId(id2),
    ]);

    if (!avaliacao1 || !avaliacao2) {
      throw new Error("Avaliações não encontradas");
    }

    const comparacao = this.compararMedicoes(
      avaliacao1.medicoes as MedicoesCompletas,
      avaliacao2.medicoes as MedicoesCompletas
    );

    return {
      avaliacao1,
      avaliacao2,
      comparacao,
    };
  }

  /**
   * Calcular índices periodontais
   */
  private calcularIndices(medicoes: MedicoesCompletas) {
    const dentes = Object.keys(medicoes);
    const totalDentes = dentes.length;

    if (totalDentes === 0) {
      return {
        indicePlaca: 0,
        indiceSangramento: 0,
        indiceProfundidade: 0,
      };
    }

    let dentesComPlaca = 0;
    let sitiosComSangramento = 0;
    let totalSitios = 0;
    let somaProfundidades = 0;

    dentes.forEach((dente) => {
      const medicao = medicoes[dente];

      // Índice de placa
      if (medicao.placa) {
        dentesComPlaca++;
      }

      // Índice de sangramento (3 sítios por dente)
      totalSitios += 3;
      if (medicao.sangramento) {
        sitiosComSangramento += 3; // Considera todos os 3 sítios
      }

      // Profundidade média
      somaProfundidades +=
        medicao.profundidadeSondagem.mesial +
        medicao.profundidadeSondagem.central +
        medicao.profundidadeSondagem.distal;
    });

    const indicePlaca = (dentesComPlaca / totalDentes) * 100;
    const indiceSangramento = (sitiosComSangramento / totalSitios) * 100;
    const indiceProfundidade = somaProfundidades / totalSitios;

    return {
      indicePlaca: Math.round(indicePlaca * 10) / 10,
      indiceSangramento: Math.round(indiceSangramento * 10) / 10,
      indiceProfundidade: Math.round(indiceProfundidade * 10) / 10,
    };
  }

  /**
   * Comparar medições entre duas avaliações
   */
  private compararMedicoes(medicoes1: MedicoesCompletas, medicoes2: MedicoesCompletas) {
    const dentes = new Set([...Object.keys(medicoes1), ...Object.keys(medicoes2)]);
    const melhorias: string[] = [];
    const pioras: string[] = [];
    const estavel: string[] = [];

    dentes.forEach((dente) => {
      const med1 = medicoes1[dente];
      const med2 = medicoes2[dente];

      if (!med1 || !med2) return;

      // Comparar profundidade média
      const prof1 =
        (med1.profundidadeSondagem.mesial +
          med1.profundidadeSondagem.central +
          med1.profundidadeSondagem.distal) /
        3;
      const prof2 =
        (med2.profundidadeSondagem.mesial +
          med2.profundidadeSondagem.central +
          med2.profundidadeSondagem.distal) /
        3;

      const diferenca = prof2 - prof1;

      if (diferenca < -0.5) {
        melhorias.push(`Dente ${dente}: Redução de ${Math.abs(diferenca).toFixed(1)}mm`);
      } else if (diferenca > 0.5) {
        pioras.push(`Dente ${dente}: Aumento de ${diferenca.toFixed(1)}mm`);
      } else {
        estavel.push(`Dente ${dente}`);
      }
    });

    return {
      melhorias,
      pioras,
      estavel,
      resumo: {
        totalMelhorias: melhorias.length,
        totalPioras: pioras.length,
        totalEstavel: estavel.length,
      },
    };
  }

  /**
   * Gerar diagnóstico sugerido baseado nos índices
   */
  gerarDiagnosticoSugerido(indices: {
    indicePlaca: number;
    indiceSangramento: number;
    indiceProfundidade: number;
  }) {
    const diagnosticos: string[] = [];
    const recomendacoes: string[] = [];

    // Análise de placa
    if (indices.indicePlaca > 50) {
      diagnosticos.push("Controle de placa inadequado");
      recomendacoes.push("Intensificar higiene oral e controle de placa");
    } else if (indices.indicePlaca > 20) {
      diagnosticos.push("Controle de placa moderado");
      recomendacoes.push("Reforçar técnicas de higiene oral");
    }

    // Análise de sangramento
    if (indices.indiceSangramento > 30) {
      diagnosticos.push("Gengivite/Periodontite ativa");
      recomendacoes.push("Tratamento periodontal indicado");
    } else if (indices.indiceSangramento > 10) {
      diagnosticos.push("Inflamação gengival leve a moderada");
      recomendacoes.push("Profilaxia e orientação de higiene");
    }

    // Análise de profundidade
    if (indices.indiceProfundidade > 5) {
      diagnosticos.push("Periodontite moderada a severa");
      recomendacoes.push("Raspagem e alisamento radicular");
      recomendacoes.push("Considerar terapia periodontal avançada");
    } else if (indices.indiceProfundidade > 3) {
      diagnosticos.push("Periodontite leve");
      recomendacoes.push("Raspagem e alisamento radicular");
    } else if (indices.indiceProfundidade > 2) {
      diagnosticos.push("Gengivite");
      recomendacoes.push("Profilaxia e controle");
    } else {
      diagnosticos.push("Saúde periodontal");
      recomendacoes.push("Manutenção preventiva");
    }

    return {
      diagnostico: diagnosticos.join(" - "),
      recomendacoes,
    };
  }

  /**
   * Identificar dentes com problemas
   */
  identificarProblemas(medicoes: MedicoesCompletas) {
    const problemas: Array<{
      dente: string;
      tipo: string;
      severidade: "leve" | "moderado" | "severo";
      descricao: string;
    }> = [];

    Object.entries(medicoes).forEach(([dente, medicao]) => {
      // Profundidade de sondagem
      const profMax = Math.max(
        medicao.profundidadeSondagem.mesial,
        medicao.profundidadeSondagem.central,
        medicao.profundidadeSondagem.distal
      );

      if (profMax >= 6) {
        problemas.push({
          dente,
          tipo: "Bolsa Periodontal Profunda",
          severidade: "severo",
          descricao: `Profundidade máxima: ${profMax}mm`,
        });
      } else if (profMax >= 4) {
        problemas.push({
          dente,
          tipo: "Bolsa Periodontal",
          severidade: "moderado",
          descricao: `Profundidade máxima: ${profMax}mm`,
        });
      }

      // Mobilidade
      if (medicao.mobilidade >= 2) {
        problemas.push({
          dente,
          tipo: "Mobilidade Dentária",
          severidade: medicao.mobilidade === 3 ? "severo" : "moderado",
          descricao: `Grau ${medicao.mobilidade}`,
        });
      }

      // Furca
      if (medicao.furca >= 2) {
        problemas.push({
          dente,
          tipo: "Lesão de Furca",
          severidade: medicao.furca === 3 ? "severo" : "moderado",
          descricao: `Grau ${medicao.furca}`,
        });
      }

      // Supuração
      if (medicao.supuracao) {
        problemas.push({
          dente,
          tipo: "Supuração",
          severidade: "severo",
          descricao: "Presença de pus",
        });
      }
    });

    return problemas.sort((a, b) => {
      const severidadeOrdem = { severo: 3, moderado: 2, leve: 1 };
      return severidadeOrdem[b.severidade] - severidadeOrdem[a.severidade];
    });
  }

  /**
   * Deletar avaliação
   */
  async deletar(id: number) {
    const database = await getDb();
    if (!database) throw new Error("Database not available");
    
    const db = await getDb(); if (!db) throw new Error("Database not available"); await db.delete(periodontograma).where(eq(periodontograma.id, id));
    return { success: true };
  }
}

export const periodontogramaService = new PeriodontogramaService();

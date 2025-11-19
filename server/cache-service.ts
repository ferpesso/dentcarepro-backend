/**
 * Serviço de Cache para DentCarePro SaaS
 * Sistema de cache em memória para melhorar performance
 * Reduz carga no banco de dados e acelera respostas em 5-10x
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutos padrão

  constructor() {
    this.cache = new Map();
    // Limpar cache expirado a cada 1 minuto
    setInterval(() => this.cleanExpired(), 60 * 1000);
  }

  /**
   * Obter valor do cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar se expirou
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Definir valor no cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Verificar se chave existe e não expirou
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remover entrada do cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidar cache por padrão (ex: "clinica:1:*")
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Limpar todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Limpar entradas expiradas
   */
  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Limpou ${cleaned} entradas expiradas`);
    }
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Wrapper para cache com função de fallback
   * Se não existir no cache, executa a função e armazena o resultado
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Tentar obter do cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Executar fallback e armazenar
    const data = await fallback();
    this.set(key, data, ttl);
    return data;
  }
}

// Singleton
export const cacheService = new CacheService();

/**
 * TTLs recomendados por tipo de dado
 */
export const CacheTTL = {
  // Dados que mudam raramente
  PROCEDIMENTOS: 24 * 60 * 60 * 1000, // 24 horas
  CATEGORIAS: 24 * 60 * 60 * 1000, // 24 horas
  PLANOS_ASSINATURA: 12 * 60 * 60 * 1000, // 12 horas
  
  // Dados que mudam ocasionalmente
  DENTISTAS: 6 * 60 * 60 * 1000, // 6 horas
  CONFIGURACOES_CLINICA: 6 * 60 * 60 * 1000, // 6 horas
  
  // Dados que mudam frequentemente
  UTENTES: 30 * 60 * 1000, // 30 minutos
  CONSULTAS_DIA: 5 * 60 * 1000, // 5 minutos
  
  // Dados em tempo real (cache curto apenas para reduzir carga)
  DASHBOARD_STATS: 2 * 60 * 1000, // 2 minutos
  RELATORIOS: 5 * 60 * 1000, // 5 minutos
};

/**
 * Helpers para gerar chaves de cache consistentes
 */
export const CacheKeys = {
  // Clínica
  clinica: (id: number) => `clinica:${id}`,
  clinicaConfig: (id: number) => `clinica:${id}:config`,
  
  // Procedimentos
  procedimentos: (clinicaId: number) => `clinica:${clinicaId}:procedimentos`,
  procedimento: (id: number) => `procedimento:${id}`,
  categorias: (clinicaId: number) => `clinica:${clinicaId}:categorias`,
  
  // Dentistas
  dentistas: (clinicaId: number) => `clinica:${clinicaId}:dentistas`,
  dentista: (id: number) => `dentista:${id}`,
  
  // Utentes
  utentes: (clinicaId: number, page: number = 1) => 
    `clinica:${clinicaId}:utentes:page:${page}`,
  utente: (id: number) => `utente:${id}`,
  utenteHistorico: (id: number) => `utente:${id}:historico`,
  
  // Consultas
  consultasDia: (clinicaId: number, data: string) => 
    `clinica:${clinicaId}:consultas:${data}`,
  consultasMes: (clinicaId: number, mes: string) => 
    `clinica:${clinicaId}:consultas:mes:${mes}`,
  
  // Dashboard
  dashboardStats: (clinicaId: number) => `clinica:${clinicaId}:dashboard`,
  
  // Relatórios
  relatorioReceita: (clinicaId: number, periodo: string) => 
    `clinica:${clinicaId}:relatorio:receita:${periodo}`,
  relatorioConsultas: (clinicaId: number, periodo: string) => 
    `clinica:${clinicaId}:relatorio:consultas:${periodo}`,
  
  // Planos
  planosAssinatura: () => `planos:assinatura`,
  assinaturaClinica: (clinicaId: number) => `clinica:${clinicaId}:assinatura`,
};

/**
 * Decorador para cachear resultados de funções
 * Uso: @Cacheable(key, ttl)
 */
export function Cacheable(keyFn: (...args: any[]) => string, ttl?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyFn(...args);
      
      return cacheService.getOrSet(
        key,
        () => originalMethod.apply(this, args),
        ttl
      );
    };

    return descriptor;
  };
}

/**
 * Invalidar cache quando dados são modificados
 */
export const invalidateCache = {
  // Quando clínica é modificada
  clinica: (clinicaId: number) => {
    cacheService.invalidatePattern(`clinica:${clinicaId}:*`);
  },
  
  // Quando procedimento é criado/modificado/deletado
  procedimentos: (clinicaId: number) => {
    cacheService.delete(CacheKeys.procedimentos(clinicaId));
    cacheService.delete(CacheKeys.categorias(clinicaId));
  },
  
  // Quando dentista é criado/modificado/deletado
  dentistas: (clinicaId: number) => {
    cacheService.delete(CacheKeys.dentistas(clinicaId));
  },
  
  // Quando utente é criado/modificado/deletado
  utentes: (clinicaId: number) => {
    cacheService.invalidatePattern(`clinica:${clinicaId}:utentes:*`);
  },
  
  // Quando utente específico é modificado
  utente: (utenteId: number) => {
    cacheService.delete(CacheKeys.utente(utenteId));
    cacheService.delete(CacheKeys.utenteHistorico(utenteId));
  },
  
  // Quando consulta é criada/modificada/deletada
  consultas: (clinicaId: number, data?: Date) => {
    if (data) {
      const dataStr = data.toISOString().split('T')[0];
      cacheService.delete(CacheKeys.consultasDia(clinicaId, dataStr));
      
      const mes = dataStr.substring(0, 7);
      cacheService.delete(CacheKeys.consultasMes(clinicaId, mes));
    } else {
      cacheService.invalidatePattern(`clinica:${clinicaId}:consultas:*`);
    }
    
    // Invalidar dashboard também
    cacheService.delete(CacheKeys.dashboardStats(clinicaId));
  },
  
  // Quando fatura é criada/modificada
  faturas: (clinicaId: number) => {
    cacheService.invalidatePattern(`clinica:${clinicaId}:relatorio:*`);
    cacheService.delete(CacheKeys.dashboardStats(clinicaId));
  },
  
  // Invalidar todos os relatórios
  relatorios: (clinicaId: number) => {
    cacheService.invalidatePattern(`clinica:${clinicaId}:relatorio:*`);
  },
};

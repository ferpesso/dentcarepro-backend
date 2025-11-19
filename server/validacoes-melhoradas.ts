import { z } from "zod";

/**
 * Validações Melhoradas para DentCare Pro SaaS
 * 
 * Este ficheiro contém schemas de validação robustos usando Zod
 * para garantir a integridade dos dados em toda a aplicação.
 */

// ============================================
// VALIDAÇÕES DE DADOS PESSOAIS
// ============================================

/**
 * Validação de NIF Português
 * Formato: 9 dígitos
 */
export const nifPortuguesSchema = z.string()
  .regex(/^\d{9}$/, "NIF deve ter 9 dígitos")
  .refine((nif) => {
    // Algoritmo de validação do NIF português
    const nifDigits = nif.split('').map(Number);
    const checkDigit = nifDigits[8];
    
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += nifDigits[i] * (9 - i);
    }
    
    const remainder = sum % 11;
    const calculatedCheckDigit = remainder < 2 ? 0 : 11 - remainder;
    
    return checkDigit === calculatedCheckDigit;
  }, "NIF inválido");

/**
 * Validação de Telemóvel Português
 * Formatos aceites: +351912345678, 912345678, 351912345678
 */
export const telemovelPortuguesSchema = z.string()
  .transform((val) => val.replace(/\s+/g, '')) // Remove espaços
  .pipe(
    z.string()
      .regex(/^(\+351|351|00351)?9[1236]\d{7}$/, "Número de telemóvel inválido")
      .transform((val) => {
        // Normalizar para formato +351XXXXXXXXX
        if (val.startsWith('+351')) return val;
        if (val.startsWith('351')) return '+' + val;
        if (val.startsWith('00351')) return '+' + val.substring(2);
        return '+351' + val;
      })
  );

/**
 * Validação de Email
 */
export const emailSchema = z.string()
  .email("Email inválido")
  .toLowerCase()
  .trim();

/**
 * Validação de Código Postal Português
 * Formato: XXXX-XXX
 */
export const codigoPostalPortuguesSchema = z.string()
  .regex(/^\d{4}-\d{3}$/, "Código postal deve estar no formato XXXX-XXX");

/**
 * Validação de Data de Nascimento
 * Deve ser no passado e pessoa deve ter menos de 150 anos
 */
export const dataNascimentoSchema = z.coerce.date()
  .refine((date) => date < new Date(), "Data de nascimento deve ser no passado")
  .refine((date) => {
    const idade = new Date().getFullYear() - date.getFullYear();
    return idade <= 150;
  }, "Data de nascimento inválida");

// ============================================
// VALIDAÇÕES DE VALORES MONETÁRIOS
// ============================================

/**
 * Validação de Valor Monetário
 * Deve ser positivo e ter no máximo 2 casas decimais
 */
export const valorMonetarioSchema = z.number()
  .positive("Valor deve ser positivo")
  .multipleOf(0.01, "Valor deve ter no máximo 2 casas decimais")
  .max(999999.99, "Valor máximo excedido");

/**
 * Validação de Percentagem
 * Deve estar entre 0 e 100
 */
export const percentagemSchema = z.number()
  .min(0, "Percentagem não pode ser negativa")
  .max(100, "Percentagem não pode exceder 100%");

/**
 * Validação de Desconto
 * Pode ser valor fixo ou percentagem
 */
export const descontoSchema = z.object({
  tipo: z.enum(["fixo", "percentagem"]),
  valor: z.number().positive(),
}).refine((data) => {
  if (data.tipo === "percentagem") {
    return data.valor <= 100;
  }
  return true;
}, "Desconto em percentagem não pode exceder 100%");

// ============================================
// VALIDAÇÕES DE DATAS E HORÁRIOS
// ============================================

/**
 * Validação de Intervalo de Datas
 * Data de início deve ser antes da data de fim
 */
export const intervaloDatasSchema = z.object({
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
}).refine((data) => data.inicio < data.fim, {
  message: "Data de início deve ser anterior à data de fim",
  path: ["fim"],
});

/**
 * Validação de Horário de Consulta
 * Deve ser em horário comercial (8h-20h) e em dias úteis
 */
export const horarioConsultaSchema = z.coerce.date()
  .refine((date) => {
    const hora = date.getHours();
    return hora >= 8 && hora < 20;
  }, "Consultas devem ser agendadas entre 8h e 20h")
  .refine((date) => {
    const diaSemana = date.getDay();
    return diaSemana >= 1 && diaSemana <= 5;
  }, "Consultas devem ser agendadas em dias úteis");

/**
 * Validação de Duração de Consulta
 * Deve ser múltiplo de 15 minutos e entre 15 e 240 minutos
 */
export const duracaoConsultaSchema = z.number()
  .int("Duração deve ser um número inteiro")
  .min(15, "Duração mínima: 15 minutos")
  .max(240, "Duração máxima: 4 horas")
  .multipleOf(15, "Duração deve ser múltiplo de 15 minutos");

// ============================================
// VALIDAÇÕES DE SEGURANÇA
// ============================================

/**
 * Validação de Password
 * Mínimo 8 caracteres, pelo menos 1 maiúscula, 1 minúscula, 1 número
 */
export const passwordSchema = z.string()
  .min(8, "Password deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Password deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Password deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Password deve conter pelo menos um número")
  .regex(/[^A-Za-z0-9]/, "Password deve conter pelo menos um carácter especial");

/**
 * Validação de Token
 * Deve ter formato hexadecimal de 32 ou 64 caracteres
 */
export const tokenSchema = z.string()
  .regex(/^[a-f0-9]{32,64}$/, "Token inválido");

// ============================================
// VALIDAÇÕES DE FICHEIROS
// ============================================

/**
 * Validação de Tamanho de Ficheiro
 * Máximo 10MB
 */
export const tamanhoFicheiroSchema = z.number()
  .max(10 * 1024 * 1024, "Ficheiro não pode exceder 10MB");

/**
 * Validação de Tipo de Ficheiro de Imagem
 */
export const tipoImagemSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
], {
  errorMap: () => ({ message: "Tipo de ficheiro não suportado. Use JPEG, PNG, WebP ou GIF" })
});

/**
 * Validação de Tipo de Ficheiro de Documento
 */
export const tipoDocumentoSchema = z.enum([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
], {
  errorMap: () => ({ message: "Tipo de documento não suportado. Use PDF, DOC, DOCX ou TXT" })
});

// ============================================
// SCHEMAS COMPOSTOS PARA ENTIDADES
// ============================================

/**
 * Schema de Validação para Criação de Utente
 */
export const criarUtenteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  email: emailSchema.optional(),
  telemovel: telemovelPortuguesSchema,
  dataNascimento: dataNascimentoSchema.optional(),
  genero: z.enum(["masculino", "feminino", "outro"]).optional(),
  morada: z.string().max(500).optional(),
  cidade: z.string().max(100).optional(),
  codigoPostal: codigoPostalPortuguesSchema.optional(),
  pais: z.string().length(2).default("PT"),
  nif: nifPortuguesSchema.optional(),
  observacoes: z.string().max(2000).optional(),
});

/**
 * Schema de Validação para Criação de Consulta
 */
export const criarConsultaSchema = z.object({
  utenteId: z.number().int().positive(),
  dentistaId: z.number().int().positive(),
  procedimentoId: z.number().int().positive().optional(),
  horaInicio: horarioConsultaSchema,
  horaFim: z.coerce.date(),
  titulo: z.string().max(255).optional(),
  observacoes: z.string().max(2000).optional(),
}).refine((data) => data.horaFim > data.horaInicio, {
  message: "Hora de fim deve ser posterior à hora de início",
  path: ["horaFim"],
});

/**
 * Schema de Validação para Criação de Fatura
 */
export const criarFaturaSchema = z.object({
  utenteId: z.number().int().positive(),
  consultaId: z.number().int().positive().optional(),
  dataFatura: z.coerce.date(),
  dataVencimento: z.coerce.date().optional(),
  subtotal: valorMonetarioSchema,
  valorIVA: valorMonetarioSchema,
  percentagemIVA: percentagemSchema,
  valorDesconto: valorMonetarioSchema.default(0),
  observacoes: z.string().max(2000).optional(),
  itens: z.array(z.object({
    procedimentoId: z.number().int().positive().optional(),
    descricao: z.string().min(1).max(500),
    quantidade: z.number().int().positive(),
    precoUnitario: valorMonetarioSchema,
  })).min(1, "Fatura deve ter pelo menos um item"),
});

/**
 * Schema de Validação para Criação de Procedimento
 */
export const criarProcedimentoSchema = z.object({
  codigo: z.string().max(50).optional(),
  nome: z.string().min(2).max(255),
  descricao: z.string().max(2000).optional(),
  precoBase: valorMonetarioSchema,
  duracaoMinutos: duracaoConsultaSchema.default(30),
  categoriaId: z.number().int().positive().optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato hexadecimal (#RRGGBB)").optional(),
});

// ============================================
// FUNÇÕES AUXILIARES DE VALIDAÇÃO
// ============================================

/**
 * Validar NIF Português (função auxiliar)
 */
export function validarNIF(nif: string): boolean {
  try {
    nifPortuguesSchema.parse(nif);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validar Email (função auxiliar)
 */
export function validarEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validar Telemóvel Português (função auxiliar)
 */
export function validarTelemovel(telemovel: string): boolean {
  try {
    telemovelPortuguesSchema.parse(telemovel);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizar String (remover caracteres perigosos)
 */
export function sanitizarString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validar e Normalizar Telemóvel
 */
export function normalizarTelemovel(telemovel: string): string {
  try {
    return telemovelPortuguesSchema.parse(telemovel);
  } catch {
    throw new Error("Número de telemóvel inválido");
  }
}

/**
 * Calcular Idade a partir de Data de Nascimento
 */
export function calcularIdade(dataNascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const mes = hoje.getMonth() - dataNascimento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoje.getDate() < dataNascimento.getDate())) {
    idade--;
  }
  
  return idade;
}

/**
 * Validar se data está no futuro
 */
export function eDataFutura(data: Date): boolean {
  return data > new Date();
}

/**
 * Validar se data está no passado
 */
export function eDataPassada(data: Date): boolean {
  return data < new Date();
}

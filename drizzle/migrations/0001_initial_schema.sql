-- ============================================
-- DENTCAREPRO SAAS - SCHEMA INICIAL
-- PostgreSQL Version
-- ============================================

-- AUTENTICAÇÃO E UTILIZADORES
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  nome TEXT,
  email VARCHAR(320),
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin', 'dentista', 'rececionista')),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- SISTEMA SAAS - PLANOS E ASSINATURAS
CREATE TABLE IF NOT EXISTS planos_assinatura (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  "precoMensal" DECIMAL(10, 2) NOT NULL,
  "precoAnual" DECIMAL(10, 2),
  "maxDentistas" INTEGER NOT NULL DEFAULT 1,
  "maxUtentes" INTEGER NOT NULL DEFAULT 100,
  "maxClinicas" INTEGER NOT NULL DEFAULT 1,
  "maxArmazenamentoGB" INTEGER NOT NULL DEFAULT 1,
  funcionalidades JSONB,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  "stripePriceIdMensal" VARCHAR(255),
  "stripePriceIdAnual" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS registos_clinica (
  id SERIAL PRIMARY KEY,
  "nomeClinica" VARCHAR(255) NOT NULL,
  "nomeProprietario" VARCHAR(255) NOT NULL,
  "emailProprietario" VARCHAR(320) NOT NULL UNIQUE,
  telemovel VARCHAR(50),
  morada TEXT,
  cidade VARCHAR(100),
  "codigoPostal" VARCHAR(20),
  pais VARCHAR(2) NOT NULL DEFAULT 'PT',
  "planoSelecionadoId" INTEGER REFERENCES planos_assinatura(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'completo', 'cancelado')),
  "tokenVerificacao" VARCHAR(255),
  "verificadoEm" TIMESTAMP,
  "clinicaId" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "completadoEm" TIMESTAMP
);

-- CLÍNICAS
CREATE TABLE IF NOT EXISTS clinicas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  telemovel VARCHAR(50),
  morada TEXT,
  cidade VARCHAR(100),
  "codigoPostal" VARCHAR(20),
  pais VARCHAR(2) NOT NULL DEFAULT 'PT',
  nif VARCHAR(50),
  "logoUrl" VARCHAR(500),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  "planoAssinaturaId" INTEGER REFERENCES planos_assinatura(id),
  "stripeCustomerId" VARCHAR(255),
  "stripeSubscriptionId" VARCHAR(255),
  "statusAssinatura" VARCHAR(20) DEFAULT 'trial' CHECK ("statusAssinatura" IN ('trial', 'active', 'past_due', 'canceled', 'unpaid')),
  "dataInicioAssinatura" TIMESTAMP,
  "dataFimTrial" TIMESTAMP,
  "proximaCobranca" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- DENTISTAS
CREATE TABLE IF NOT EXISTS dentistas (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  telemovel VARCHAR(50),
  "numeroOrdem" VARCHAR(50),
  especialidade VARCHAR(100),
  cor VARCHAR(7) DEFAULT '#3b82f6',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- UTENTES (PACIENTES)
CREATE TABLE IF NOT EXISTS utentes (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  telemovel VARCHAR(50),
  "dataNascimento" DATE,
  nif VARCHAR(50),
  "numeroUtente" VARCHAR(50),
  morada TEXT,
  cidade VARCHAR(100),
  "codigoPostal" VARCHAR(20),
  pais VARCHAR(2) DEFAULT 'PT',
  "contatoEmergencia" VARCHAR(255),
  "telemovelEmergencia" VARCHAR(50),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- PROCEDIMENTOS
CREATE TABLE IF NOT EXISTS procedimentos (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50),
  descricao TEXT,
  categoria VARCHAR(100),
  preco DECIMAL(10, 2) NOT NULL,
  duracao INTEGER DEFAULT 30,
  cor VARCHAR(7),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- CONSULTAS
CREATE TABLE IF NOT EXISTS consultas (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  "utenteId" INTEGER NOT NULL REFERENCES utentes(id) ON DELETE CASCADE,
  "dentistaId" INTEGER NOT NULL REFERENCES dentistas(id) ON DELETE CASCADE,
  "dataHora" TIMESTAMP NOT NULL,
  duracao INTEGER NOT NULL DEFAULT 30,
  tipo VARCHAR(100),
  estado VARCHAR(20) DEFAULT 'agendada' CHECK (estado IN ('agendada', 'confirmada', 'realizada', 'cancelada', 'faltou')),
  observacoes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- PROCEDIMENTOS REALIZADOS
CREATE TABLE IF NOT EXISTS procedimentos_realizados (
  id SERIAL PRIMARY KEY,
  "consultaId" INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  "procedimentoId" INTEGER NOT NULL REFERENCES procedimentos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  "precoUnitario" DECIMAL(10, 2) NOT NULL,
  desconto DECIMAL(10, 2) DEFAULT 0,
  observacoes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- FATURAS
CREATE TABLE IF NOT EXISTS faturas (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  "utenteId" INTEGER NOT NULL REFERENCES utentes(id) ON DELETE CASCADE,
  "consultaId" INTEGER REFERENCES consultas(id),
  numero VARCHAR(50) NOT NULL,
  data DATE NOT NULL,
  "dataVencimento" DATE,
  "valorTotal" DECIMAL(10, 2) NOT NULL,
  "valorPago" DECIMAL(10, 2) DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'pendente' CHECK (estado IN ('pendente', 'paga', 'parcialmente_paga', 'vencida', 'cancelada')),
  observacoes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("clinicaId", numero)
);

-- ITENS DE FATURA
CREATE TABLE IF NOT EXISTS itens_fatura (
  id SERIAL PRIMARY KEY,
  "faturaId" INTEGER NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  descricao VARCHAR(255) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  "precoUnitario" DECIMAL(10, 2) NOT NULL,
  desconto DECIMAL(10, 2) DEFAULT 0,
  "valorTotal" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- PAGAMENTOS
CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,
  "faturaId" INTEGER NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  valor DECIMAL(10, 2) NOT NULL,
  data DATE NOT NULL,
  "metodoPagamento" VARCHAR(50) NOT NULL,
  referencia VARCHAR(255),
  observacoes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- HISTÓRICO MÉDICO
CREATE TABLE IF NOT EXISTS historico_medico (
  id SERIAL PRIMARY KEY,
  "utenteId" INTEGER NOT NULL UNIQUE REFERENCES utentes(id) ON DELETE CASCADE,
  alergias TEXT,
  "medicamentosAtuais" TEXT,
  "condicoesPreexistentes" TEXT,
  "historicoFamiliar" TEXT,
  "habitosTabagismo" BOOLEAN DEFAULT FALSE,
  "habitosAlcool" BOOLEAN DEFAULT FALSE,
  "outrasInformacoes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- MENSAGENS UTENTE
CREATE TABLE IF NOT EXISTS mensagens_utente (
  id SERIAL PRIMARY KEY,
  "clinicaId" INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  "utenteId" INTEGER NOT NULL REFERENCES utentes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('email', 'sms', 'whatsapp')),
  assunto VARCHAR(255),
  mensagem TEXT NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendente' CHECK (estado IN ('pendente', 'enviada', 'falhada', 'entregue')),
  "dataEnvio" TIMESTAMP,
  "erroMensagem" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_clinicas_ativo ON clinicas(ativo);
CREATE INDEX idx_dentistas_clinica ON dentistas("clinicaId");
CREATE INDEX idx_utentes_clinica ON utentes("clinicaId");
CREATE INDEX idx_utentes_nome ON utentes(nome);
CREATE INDEX idx_consultas_clinica ON consultas("clinicaId");
CREATE INDEX idx_consultas_data ON consultas("dataHora");
CREATE INDEX idx_consultas_dentista ON consultas("dentistaId");
CREATE INDEX idx_consultas_utente ON consultas("utenteId");
CREATE INDEX idx_faturas_clinica ON faturas("clinicaId");
CREATE INDEX idx_faturas_utente ON faturas("utenteId");
CREATE INDEX idx_faturas_estado ON faturas(estado);
CREATE INDEX idx_procedimentos_clinica ON procedimentos("clinicaId");

-- Inserir plano básico padrão
INSERT INTO planos_assinatura (nome, slug, descricao, "precoMensal", "precoAnual", "maxDentistas", "maxUtentes", funcionalidades)
VALUES (
  'Básico',
  'basico',
  'Plano básico para clínicas pequenas',
  29.90,
  299.00,
  2,
  200,
  '{"multiClinica": false, "mensagensIA": false, "relatoriosAvancados": false, "acessoAPI": false, "suportePrioritario": false, "marcaPersonalizada": false, "integracaoWhatsapp": false, "notificacoesSMS": false}'::jsonb
);

-- Inserir clínica de demonstração
INSERT INTO clinicas (nome, email, telemovel, morada, cidade, "codigoPostal", nif, "planoAssinaturaId")
VALUES (
  'Clínica Demo',
  'demo@dentcarepro.pt',
  '+351 21 123 4567',
  'Rua Demo, 123',
  'Lisboa',
  '1000-001',
  '123456789',
  1
);

COMMENT ON DATABASE dentcarepro IS 'DentCarePro SaaS - Sistema de Gestão para Clínicas Dentárias';

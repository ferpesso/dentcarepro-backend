-- ============================================
-- ADICIONAR CAMPOS FISCAIS AS FATURAS
-- Para melhor suporte aos contabilistas
-- ============================================

-- Adicionar campos fiscais a tabela faturas
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS nif_emitente VARCHAR(20) COMMENT 'NIF da clinica emitente';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS nif_cliente VARCHAR(20) COMMENT 'NIF do cliente/utente';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS morada_fiscal_emitente TEXT COMMENT 'Morada fiscal da clinica';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS morada_fiscal_cliente TEXT COMMENT 'Morada fiscal do cliente';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS serie_fatura VARCHAR(10) DEFAULT 'FT' COMMENT 'Serie da fatura (FT, FS, FR, NC, ND)';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS motivo_isencao_iva TEXT COMMENT 'Motivo de isencao de IVA (Art. 9 CIVA)';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS hash_validacao VARCHAR(255) COMMENT 'Hash de validacao AT (se aplicavel)';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS qrcode_at TEXT COMMENT 'QR Code AT-CUDE (se aplicavel)';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS comunicada_at BOOLEAN DEFAULT FALSE COMMENT 'Se foi comunicada a AT';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS data_comunicacao_at TIMESTAMP NULL COMMENT 'Data de comunicacao a AT';
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS atcud VARCHAR(100) COMMENT 'ATCUD - Codigo unico do documento';

-- Adicionar campos fiscais aos itens de fatura
ALTER TABLE itens_fatura ADD COLUMN IF NOT EXISTS taxa_iva DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Taxa de IVA aplicada (%)';
ALTER TABLE itens_fatura ADD COLUMN IF NOT EXISTS valor_iva DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Valor de IVA';
ALTER TABLE itens_fatura ADD COLUMN IF NOT EXISTS motivo_isencao_iva TEXT COMMENT 'Motivo de isencao de IVA';
ALTER TABLE itens_fatura ADD COLUMN IF NOT EXISTS codigo_iva VARCHAR(10) DEFAULT 'ISE' COMMENT 'Codigo IVA (NOR, RED, INT, ISE)';

-- Criar tabela de series de faturacao
CREATE TABLE IF NOT EXISTS series_faturacao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  tipo_documento VARCHAR(10) NOT NULL COMMENT 'FT, FS, FR, NC, ND',
  serie VARCHAR(10) NOT NULL DEFAULT 'A',
  descricao VARCHAR(200),
  prefixo VARCHAR(20) COMMENT 'Prefixo da numeracao (ex: 2025/)',
  proximo_numero INT NOT NULL DEFAULT 1,
  ano_serie INT COMMENT 'Ano da serie (para reiniciar anualmente)',
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_serie_clinica (clinica_id, tipo_documento, serie, ano_serie)
) COMMENT 'Series de faturacao para numeracao sequencial';

-- Criar indice para busca rapida
CREATE INDEX IF NOT EXISTS idx_faturas_nif_cliente ON faturas(nif_cliente);
CREATE INDEX IF NOT EXISTS idx_faturas_serie ON faturas(serie_fatura);
CREATE INDEX IF NOT EXISTS idx_faturas_comunicada_at ON faturas(comunicada_at);

-- Criar tabela de configuracoes fiscais da clinica
CREATE TABLE IF NOT EXISTS configuracoes_fiscais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  nif VARCHAR(20) NOT NULL,
  nome_fiscal VARCHAR(200) NOT NULL,
  morada_fiscal TEXT NOT NULL,
  codigo_postal VARCHAR(20),
  cidade VARCHAR(100),
  pais VARCHAR(2) DEFAULT 'PT',
  regime_iva VARCHAR(50) DEFAULT 'Normal' COMMENT 'Normal, Isento, Regime Especial',
  certificado_software VARCHAR(100) COMMENT 'Numero de certificacao do software AT',
  chave_privada_at TEXT COMMENT 'Chave privada para assinatura AT',
  iban VARCHAR(34) COMMENT 'IBAN para pagamentos',
  swift VARCHAR(11) COMMENT 'SWIFT/BIC',
  email_faturacao VARCHAR(320),
  telefone_faturacao VARCHAR(20),
  observacoes_fatura TEXT COMMENT 'Observacoes padrao nas faturas',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_clinica_fiscal (clinica_id)
) COMMENT 'Configuracoes fiscais da clinica para faturacao';

-- Inserir configuracoes fiscais padrao para clinicas existentes
INSERT IGNORE INTO configuracoes_fiscais (clinica_id, nif, nome_fiscal, morada_fiscal, regime_iva)
SELECT 
  id,
  COALESCE(nif, '999999990'),
  nome,
  COALESCE(morada, 'Morada nao definida'),
  'Isento'
FROM clinicas
WHERE NOT EXISTS (
  SELECT 1 FROM configuracoes_fiscais WHERE clinica_id = clinicas.id
);

-- Inserir series de faturacao padrao para clinicas existentes
INSERT IGNORE INTO series_faturacao (clinica_id, tipo_documento, serie, descricao, prefixo, ano_serie)
SELECT 
  id,
  'FT',
  'A',
  'Serie principal de faturas',
  CONCAT(YEAR(CURDATE()), '/'),
  YEAR(CURDATE())
FROM clinicas
WHERE NOT EXISTS (
  SELECT 1 FROM series_faturacao WHERE clinica_id = clinicas.id AND tipo_documento = 'FT'
);

-- Atualizar faturas existentes com motivo de isencao IVA
UPDATE faturas 
SET motivo_isencao_iva = 'Isento nos termos do artigo 9 do CIVA (servicos medicos)'
WHERE motivo_isencao_iva IS NULL;

-- Atualizar serie padrao para faturas existentes
UPDATE faturas 
SET serie_fatura = 'FT'
WHERE serie_fatura IS NULL;

COMMIT;

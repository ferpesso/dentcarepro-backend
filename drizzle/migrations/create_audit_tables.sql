-- ============================================
-- SISTEMA DE AUDITORIA RGPD
-- DentCarePro SaaS - Conformidade Europeia
-- ============================================

-- Tabela principal de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  clinica_id INTEGER,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  description TEXT,
  changes JSONB,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  data_category VARCHAR(50),
  legal_basis VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela de acessos a dados sensíveis
CREATE TABLE IF NOT EXISTS data_access_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  data_type VARCHAR(50) NOT NULL,
  data_owner_id INTEGER NOT NULL,
  data_owner_name VARCHAR(255),
  access_reason TEXT,
  access_type VARCHAR(20) NOT NULL,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela de consentimentos RGPD
CREATE TABLE IF NOT EXISTS consentimentos (
  id SERIAL PRIMARY KEY,
  utente_id INTEGER NOT NULL,
  clinica_id INTEGER NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  finalidade TEXT NOT NULL,
  consentido BOOLEAN NOT NULL,
  data_consentimento TIMESTAMP NOT NULL,
  revogado BOOLEAN DEFAULT FALSE,
  data_revogacao TIMESTAMP,
  forma_consentimento VARCHAR(50),
  evidencia JSONB,
  data_expiracao TIMESTAMP,
  versao_termos VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de pedidos de direitos RGPD
CREATE TABLE IF NOT EXISTS pedidos_direitos_rgpd (
  id SERIAL PRIMARY KEY,
  utente_id INTEGER NOT NULL,
  utente_nome VARCHAR(255),
  utente_email VARCHAR(255),
  clinica_id INTEGER NOT NULL,
  tipo_direito VARCHAR(50) NOT NULL,
  descricao TEXT,
  dados_especificos JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  data_processamento TIMESTAMP,
  processado_por INTEGER,
  processado_por_nome VARCHAR(255),
  resposta TEXT,
  acao_tomada TEXT,
  data_pedido TIMESTAMP DEFAULT NOW() NOT NULL,
  data_prazo TIMESTAMP NOT NULL,
  data_conclusao TIMESTAMP,
  documentos JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de violações de dados (Data Breaches)
CREATE TABLE IF NOT EXISTS violacoes_dados (
  id SERIAL PRIMARY KEY,
  referencia VARCHAR(50) NOT NULL UNIQUE,
  clinica_id INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  data_ocorrencia TIMESTAMP NOT NULL,
  data_detecao TIMESTAMP NOT NULL,
  dados_afetados JSONB,
  numero_utentes_afetados INTEGER,
  utente_ids JSONB,
  gravidade VARCHAR(20) NOT NULL,
  risco_titulares TEXT,
  medidas_imediatas TEXT,
  medidas_preventivas TEXT,
  notificado_autoridade BOOLEAN DEFAULT FALSE,
  data_notificacao_autoridade TIMESTAMP,
  notificados_titulares BOOLEAN DEFAULT FALSE,
  data_notificacao_titulares TIMESTAMP,
  reportado_por INTEGER,
  reportado_por_nome VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'aberto',
  data_resolucao TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de políticas de retenção de dados
CREATE TABLE IF NOT EXISTS politicas_retencao (
  id SERIAL PRIMARY KEY,
  tipo_entidade VARCHAR(50) NOT NULL,
  categoria VARCHAR(50),
  periodo_retencao INTEGER NOT NULL,
  motivo_retencao TEXT,
  acao_apos_expiracao VARCHAR(30) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de exportações de dados
CREATE TABLE IF NOT EXISTS exportacoes_dados (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_name VARCHAR(255),
  tipo_exportacao VARCHAR(50) NOT NULL,
  utente_id INTEGER,
  clinica_id INTEGER,
  formato VARCHAR(20),
  filtros JSONB,
  numero_registos INTEGER,
  tamanho_arquivo INTEGER,
  finalidade VARCHAR(100),
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinica_id ON audit_logs(clinica_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Índices para data_access_logs
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_id ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_data_owner_id ON data_access_logs(data_owner_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_timestamp ON data_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_data_type ON data_access_logs(data_type);

-- Índices para consentimentos
CREATE INDEX IF NOT EXISTS idx_consentimentos_utente_id ON consentimentos(utente_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_clinica_id ON consentimentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_tipo ON consentimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_consentimentos_consentido ON consentimentos(consentido, revogado);

-- Índices para pedidos_direitos_rgpd
CREATE INDEX IF NOT EXISTS idx_pedidos_direitos_utente_id ON pedidos_direitos_rgpd(utente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_direitos_clinica_id ON pedidos_direitos_rgpd(clinica_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_direitos_status ON pedidos_direitos_rgpd(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_direitos_data_prazo ON pedidos_direitos_rgpd(data_prazo);

-- Índices para violacoes_dados
CREATE INDEX IF NOT EXISTS idx_violacoes_dados_clinica_id ON violacoes_dados(clinica_id);
CREATE INDEX IF NOT EXISTS idx_violacoes_dados_status ON violacoes_dados(status);
CREATE INDEX IF NOT EXISTS idx_violacoes_dados_gravidade ON violacoes_dados(gravidade);

-- Índices para exportacoes_dados
CREATE INDEX IF NOT EXISTS idx_exportacoes_dados_user_id ON exportacoes_dados(user_id);
CREATE INDEX IF NOT EXISTS idx_exportacoes_dados_utente_id ON exportacoes_dados(utente_id);
CREATE INDEX IF NOT EXISTS idx_exportacoes_dados_clinica_id ON exportacoes_dados(clinica_id);
CREATE INDEX IF NOT EXISTS idx_exportacoes_dados_timestamp ON exportacoes_dados(timestamp);

-- ============================================
-- POLÍTICAS DE RETENÇÃO PADRÃO (RGPD)
-- ============================================

-- Inserir políticas padrão conforme legislação portuguesa/europeia
INSERT INTO politicas_retencao (tipo_entidade, categoria, periodo_retencao, motivo_retencao, acao_apos_expiracao) VALUES
  ('utentes', 'personal', 3650, 'Obrigação legal - dados fiscais (10 anos)', 'arquivar'),
  ('consultas', 'medical', 1825, 'Obrigação legal - registos médicos (5 anos)', 'arquivar'),
  ('faturas', 'financial', 3650, 'Obrigação legal - documentos fiscais (10 anos)', 'arquivar'),
  ('historico_medico', 'medical', 1825, 'Obrigação legal - registos médicos (5 anos)', 'arquivar'),
  ('audit_logs', 'system', 730, 'Conformidade RGPD - logs de auditoria (2 anos)', 'arquivar'),
  ('data_access_logs', 'system', 730, 'Conformidade RGPD - logs de acesso (2 anos)', 'arquivar')
ON CONFLICT DO NOTHING;

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE audit_logs IS 'Registo completo de todas as ações no sistema (RGPD)';
COMMENT ON TABLE data_access_logs IS 'Registo de acessos a dados pessoais/sensíveis (RGPD Art. 30)';
COMMENT ON TABLE consentimentos IS 'Gestão de consentimentos dos titulares de dados (RGPD Art. 7)';
COMMENT ON TABLE pedidos_direitos_rgpd IS 'Pedidos de exercício de direitos dos titulares (RGPD Arts. 15-22)';
COMMENT ON TABLE violacoes_dados IS 'Registo de violações de dados pessoais (RGPD Art. 33-34)';
COMMENT ON TABLE politicas_retencao IS 'Políticas de retenção de dados (RGPD Art. 5)';
COMMENT ON TABLE exportacoes_dados IS 'Registo de exportações de dados (portabilidade RGPD Art. 20)';

-- ============================================
-- ANÁLISE FINAL
-- ============================================

ANALYZE audit_logs;
ANALYZE data_access_logs;
ANALYZE consentimentos;
ANALYZE pedidos_direitos_rgpd;
ANALYZE violacoes_dados;
ANALYZE exportacoes_dados;

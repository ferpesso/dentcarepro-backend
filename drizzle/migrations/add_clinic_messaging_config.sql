-- ============================================
-- CONFIGURACOES DE MENSAGENS POR CLINICA
-- Sistema multi-tenant: cada clinica tem suas configuracoes
-- ============================================

CREATE TABLE IF NOT EXISTS configuracoes_mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  
  -- Configuracoes de lembretes
  lembretes_ativos BOOLEAN DEFAULT TRUE COMMENT 'Se lembretes automaticos estao ativos',
  lembrete_consulta_horas INT DEFAULT 24 COMMENT 'Horas de antecedencia para lembrete de consulta',
  lembrete_confirmacao_horas INT DEFAULT 48 COMMENT 'Horas de antecedencia para confirmacao',
  lembrete_pagamento_ativo BOOLEAN DEFAULT TRUE COMMENT 'Se envia lembretes de pagamento',
  
  -- Canais de comunicacao
  canal_email_ativo BOOLEAN DEFAULT TRUE,
  canal_sms_ativo BOOLEAN DEFAULT FALSE,
  canal_whatsapp_ativo BOOLEAN DEFAULT FALSE,
  
  -- Preferencias de envio
  horario_envio_inicio TIME DEFAULT '09:00:00' COMMENT 'Horario minimo para envio',
  horario_envio_fim TIME DEFAULT '20:00:00' COMMENT 'Horario maximo para envio',
  enviar_fins_semana BOOLEAN DEFAULT FALSE COMMENT 'Se envia lembretes aos fins de semana',
  
  -- Templates de mensagens personalizados (opcional)
  template_email_consulta TEXT COMMENT 'Template personalizado para email de consulta',
  template_sms_consulta TEXT COMMENT 'Template personalizado para SMS de consulta',
  template_whatsapp_consulta TEXT COMMENT 'Template personalizado para WhatsApp de consulta',
  template_email_pagamento TEXT COMMENT 'Template personalizado para email de pagamento',
  
  -- Assinatura das mensagens
  assinatura_mensagens TEXT COMMENT 'Assinatura personalizada para mensagens',
  
  -- Metadados
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_clinica_config (clinica_id)
) COMMENT 'Configuracoes de mensagens e lembretes por clinica';

-- Criar indices
CREATE INDEX IF NOT EXISTS idx_config_mensagens_clinica ON configuracoes_mensagens(clinica_id);
CREATE INDEX IF NOT EXISTS idx_config_mensagens_ativo ON configuracoes_mensagens(lembretes_ativos);

-- Inserir configuracoes padrao para clinicas existentes
INSERT IGNORE INTO configuracoes_mensagens (
  clinica_id,
  lembretes_ativos,
  lembrete_consulta_horas,
  lembrete_confirmacao_horas,
  canal_email_ativo,
  canal_sms_ativo,
  canal_whatsapp_ativo
)
SELECT 
  id,
  TRUE,
  24,
  48,
  TRUE,
  FALSE,
  FALSE
FROM clinicas
WHERE NOT EXISTS (
  SELECT 1 FROM configuracoes_mensagens WHERE clinica_id = clinicas.id
);

-- Adicionar campos opcionais a tabela clinicas para personalizacao
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS website VARCHAR(255) COMMENT 'Website da clinica';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS facebook VARCHAR(255) COMMENT 'Facebook da clinica';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS instagram VARCHAR(255) COMMENT 'Instagram da clinica';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS descricao TEXT COMMENT 'Descricao da clinica';
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS horario_funcionamento TEXT COMMENT 'Horario de funcionamento';

-- Adicionar campo para rastreamento de mensagens enviadas
ALTER TABLE mensagens_utente ADD COLUMN IF NOT EXISTS custo DECIMAL(10,4) DEFAULT 0.0000 COMMENT 'Custo do envio (para SMS/WhatsApp)';
ALTER TABLE mensagens_utente ADD COLUMN IF NOT EXISTS provedor VARCHAR(50) COMMENT 'Provedor usado (SendGrid, Twilio, etc)';
ALTER TABLE mensagens_utente ADD COLUMN IF NOT EXISTS provedor_message_id VARCHAR(255) COMMENT 'ID da mensagem no provedor';

-- Criar tabela de estatisticas de mensagens por clinica
CREATE TABLE IF NOT EXISTS estatisticas_mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  
  -- Contadores por canal
  total_email INT DEFAULT 0,
  total_sms INT DEFAULT 0,
  total_whatsapp INT DEFAULT 0,
  
  -- Contadores por status
  total_enviadas INT DEFAULT 0,
  total_falhadas INT DEFAULT 0,
  total_pendentes INT DEFAULT 0,
  
  -- Custos
  custo_total DECIMAL(10,2) DEFAULT 0.00,
  custo_sms DECIMAL(10,2) DEFAULT 0.00,
  custo_whatsapp DECIMAL(10,2) DEFAULT 0.00,
  
  -- Metadados
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_clinica_periodo (clinica_id, periodo_inicio, periodo_fim)
) COMMENT 'Estatisticas de mensagens por clinica e periodo';

CREATE INDEX IF NOT EXISTS idx_stats_mensagens_clinica ON estatisticas_mensagens(clinica_id);
CREATE INDEX IF NOT EXISTS idx_stats_mensagens_periodo ON estatisticas_mensagens(periodo_inicio, periodo_fim);

COMMIT;

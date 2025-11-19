-- ============================================
-- SISTEMA DE GESTAO DE EQUIPA E RBAC
-- Role-Based Access Control
-- ============================================

-- Tabela de Funcoes (Roles)
CREATE TABLE IF NOT EXISTS funcoes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  nivel_acesso INTEGER NOT NULL DEFAULT 1, -- 1=Basico, 2=Medio, 3=Admin
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Funcoes padrao
INSERT INTO funcoes (nome, descricao, nivel_acesso) VALUES
('admin', 'Administrador - Acesso total ao sistema', 3),
('dentista', 'Dentista - Acesso a consultas e prontuarios', 2),
('rececionista', 'Rececionista - Agendamento e atendimento', 1),
('gestor', 'Gestor - Relatorios e financeiro', 2),
('auxiliar', 'Auxiliar - Apoio clinico', 1);

-- Tabela de Permissoes
CREATE TABLE IF NOT EXISTS permissoes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  modulo VARCHAR(50) NOT NULL, -- utentes, consultas, faturas, etc
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permissoes por modulo
INSERT INTO permissoes (codigo, nome, descricao, modulo) VALUES
-- Utentes
('utentes.ver', 'Ver Utentes', 'Visualizar lista e detalhes de utentes', 'utentes'),
('utentes.criar', 'Criar Utentes', 'Cadastrar novos utentes', 'utentes'),
('utentes.editar', 'Editar Utentes', 'Modificar dados de utentes', 'utentes'),
('utentes.eliminar', 'Eliminar Utentes', 'Remover utentes do sistema', 'utentes'),

-- Consultas
('consultas.ver', 'Ver Consultas', 'Visualizar agenda e consultas', 'consultas'),
('consultas.criar', 'Criar Consultas', 'Agendar novas consultas', 'consultas'),
('consultas.editar', 'Editar Consultas', 'Modificar consultas agendadas', 'consultas'),
('consultas.cancelar', 'Cancelar Consultas', 'Cancelar consultas', 'consultas'),
('consultas.realizar', 'Realizar Consultas', 'Marcar consulta como realizada', 'consultas'),

-- Prontuarios
('prontuarios.ver', 'Ver Prontuarios', 'Visualizar historico medico', 'prontuarios'),
('prontuarios.criar', 'Criar Prontuarios', 'Adicionar registos medicos', 'prontuarios'),
('prontuarios.editar', 'Editar Prontuarios', 'Modificar registos medicos', 'prontuarios'),

-- Faturas
('faturas.ver', 'Ver Faturas', 'Visualizar faturas', 'faturas'),
('faturas.criar', 'Criar Faturas', 'Emitir novas faturas', 'faturas'),
('faturas.editar', 'Editar Faturas', 'Modificar faturas', 'faturas'),
('faturas.eliminar', 'Eliminar Faturas', 'Remover faturas', 'faturas'),
('faturas.pagamentos', 'Gerir Pagamentos', 'Registar e gerir pagamentos', 'faturas'),

-- Procedimentos
('procedimentos.ver', 'Ver Procedimentos', 'Visualizar lista de procedimentos', 'procedimentos'),
('procedimentos.criar', 'Criar Procedimentos', 'Adicionar novos procedimentos', 'procedimentos'),
('procedimentos.editar', 'Editar Procedimentos', 'Modificar procedimentos', 'procedimentos'),
('procedimentos.eliminar', 'Eliminar Procedimentos', 'Remover procedimentos', 'procedimentos'),

-- Relatorios
('relatorios.financeiro', 'Relatorios Financeiros', 'Acesso a relatorios financeiros', 'relatorios'),
('relatorios.operacional', 'Relatorios Operacionais', 'Acesso a relatorios operacionais', 'relatorios'),
('relatorios.executivo', 'Dashboard Executivo', 'Acesso ao dashboard executivo', 'relatorios'),

-- Configuracoes
('config.clinica', 'Configurar Clinica', 'Modificar configuracoes da clinica', 'configuracoes'),
('config.utilizadores', 'Gerir Utilizadores', 'Adicionar e remover utilizadores', 'configuracoes'),
('config.permissoes', 'Gerir Permissoes', 'Atribuir permissoes a utilizadores', 'configuracoes'),
('config.lembretes', 'Configurar Lembretes', 'Configurar lembretes automaticos', 'configuracoes'),

-- Auditoria
('auditoria.ver', 'Ver Auditoria', 'Visualizar logs de auditoria', 'auditoria'),
('auditoria.exportar', 'Exportar Auditoria', 'Exportar logs de auditoria', 'auditoria');

-- Tabela de Permissoes por Funcao
CREATE TABLE IF NOT EXISTS funcoes_permissoes (
  id SERIAL PRIMARY KEY,
  funcao_id INTEGER NOT NULL REFERENCES funcoes(id) ON DELETE CASCADE,
  permissao_id INTEGER NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(funcao_id, permissao_id)
);

-- Atribuir permissoes ao ADMIN (todas)
INSERT INTO funcoes_permissoes (funcao_id, permissao_id)
SELECT 1, id FROM permissoes;

-- Atribuir permissoes ao DENTISTA
INSERT INTO funcoes_permissoes (funcao_id, permissao_id)
SELECT 2, id FROM permissoes WHERE codigo IN (
  'utentes.ver', 'utentes.criar', 'utentes.editar',
  'consultas.ver', 'consultas.criar', 'consultas.editar', 'consultas.realizar',
  'prontuarios.ver', 'prontuarios.criar', 'prontuarios.editar',
  'faturas.ver', 'faturas.criar',
  'procedimentos.ver',
  'relatorios.operacional'
);

-- Atribuir permissoes ao RECECIONISTA
INSERT INTO funcoes_permissoes (funcao_id, permissao_id)
SELECT 3, id FROM permissoes WHERE codigo IN (
  'utentes.ver', 'utentes.criar', 'utentes.editar',
  'consultas.ver', 'consultas.criar', 'consultas.editar', 'consultas.cancelar',
  'faturas.ver', 'faturas.criar', 'faturas.pagamentos',
  'procedimentos.ver'
);

-- Atribuir permissoes ao GESTOR
INSERT INTO funcoes_permissoes (funcao_id, permissao_id)
SELECT 4, id FROM permissoes WHERE codigo IN (
  'utentes.ver',
  'consultas.ver',
  'faturas.ver', 'faturas.criar', 'faturas.pagamentos',
  'procedimentos.ver', 'procedimentos.criar', 'procedimentos.editar',
  'relatorios.financeiro', 'relatorios.operacional', 'relatorios.executivo',
  'config.clinica', 'config.lembretes',
  'auditoria.ver', 'auditoria.exportar'
);

-- Atribuir permissoes ao AUXILIAR
INSERT INTO funcoes_permissoes (funcao_id, permissao_id)
SELECT 5, id FROM permissoes WHERE codigo IN (
  'utentes.ver',
  'consultas.ver',
  'prontuarios.ver',
  'procedimentos.ver'
);

-- Tabela de Utilizadores (estender dentistas)
CREATE TABLE IF NOT EXISTS utilizadores (
  id SERIAL PRIMARY KEY,
  clinica_id INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  dentista_id INTEGER REFERENCES dentistas(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  funcao_id INTEGER NOT NULL REFERENCES funcoes(id),
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_acesso TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(clinica_id, email)
);

-- Indices para performance
CREATE INDEX idx_utilizadores_clinica ON utilizadores(clinica_id);
CREATE INDEX idx_utilizadores_email ON utilizadores(email);
CREATE INDEX idx_utilizadores_funcao ON utilizadores(funcao_id);
CREATE INDEX idx_funcoes_permissoes_funcao ON funcoes_permissoes(funcao_id);
CREATE INDEX idx_funcoes_permissoes_permissao ON funcoes_permissoes(permissao_id);

-- Tabela de Sessoes (para controle de acesso)
CREATE TABLE IF NOT EXISTS sessoes_utilizador (
  id SERIAL PRIMARY KEY,
  utilizador_id INTEGER NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expira_em TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessoes_token ON sessoes_utilizador(token);
CREATE INDEX idx_sessoes_utilizador ON sessoes_utilizador(utilizador_id);

-- Tabela de Logs de Acesso (auditoria)
CREATE TABLE IF NOT EXISTS logs_acesso (
  id SERIAL PRIMARY KEY,
  utilizador_id INTEGER REFERENCES utilizadores(id) ON DELETE SET NULL,
  clinica_id INTEGER NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  acao VARCHAR(100) NOT NULL,
  modulo VARCHAR(50),
  detalhes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  sucesso BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_acesso_utilizador ON logs_acesso(utilizador_id);
CREATE INDEX idx_logs_acesso_clinica ON logs_acesso(clinica_id);
CREATE INDEX idx_logs_acesso_data ON logs_acesso(created_at);

COMMENT ON TABLE funcoes IS 'Funcoes/Roles do sistema (Admin, Dentista, Rececionista, etc)';
COMMENT ON TABLE permissoes IS 'Permissoes granulares do sistema';
COMMENT ON TABLE funcoes_permissoes IS 'Mapeamento de permissoes por funcao';
COMMENT ON TABLE utilizadores IS 'Utilizadores do sistema com autenticacao';
COMMENT ON TABLE sessoes_utilizador IS 'Sessoes ativas de utilizadores';
COMMENT ON TABLE logs_acesso IS 'Logs de auditoria de acesso e acoes';

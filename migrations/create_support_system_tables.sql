-- ============================================
-- MIGRATION: Sistema de Suporte e Templates
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- para criar as tabelas necessárias para o sistema de suporte

-- ============================================
-- 1. Tabela de Mensagens de Suporte
-- ============================================
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL, -- 'bug', 'sugestao', 'duvida', 'outro'
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'aberto', -- 'aberto', 'em_andamento', 'resolvido', 'fechado'
  admin_response TEXT,
  admin_id VARCHAR REFERENCES users(id), -- ID do admin que respondeu
  responded_at TIMESTAMP,
  is_public BOOLEAN DEFAULT false, -- Se a pergunta/resposta está disponível publicamente na FAQ
  user_read_at TIMESTAMP, -- Quando o usuário leu a resposta
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_category ON support_messages(category);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_is_public ON support_messages(is_public) WHERE is_public = true;

-- Comentários
COMMENT ON TABLE support_messages IS 'Armazena mensagens de suporte enviadas pelos tenants';
COMMENT ON COLUMN support_messages.category IS 'Categoria da mensagem: bug, sugestao, duvida, outro';
COMMENT ON COLUMN support_messages.status IS 'Status da mensagem: aberto, em_andamento, resolvido, fechado';

-- ============================================
-- 2. Tabela de Templates de Respostas
-- ============================================
CREATE TABLE IF NOT EXISTS support_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- 'bug', 'sugestao', 'duvida', 'outro', 'geral'
  title VARCHAR(255) NOT NULL, -- Título do template
  content TEXT NOT NULL, -- Conteúdo do template
  is_active BOOLEAN DEFAULT true, -- Se o template está ativo
  created_by VARCHAR REFERENCES users(id), -- Admin que criou o template
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_support_templates_category ON support_message_templates(category);
CREATE INDEX IF NOT EXISTS idx_support_templates_active ON support_message_templates(is_active);

-- Comentários
COMMENT ON TABLE support_message_templates IS 'Templates de respostas padrão para mensagens de suporte';
COMMENT ON COLUMN support_message_templates.category IS 'Categoria do template: bug, sugestao, duvida, outro, geral';
COMMENT ON COLUMN support_message_templates.is_active IS 'Se o template está ativo e disponível para uso';

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute estas queries para verificar se as tabelas foram criadas:
-- SELECT * FROM support_messages LIMIT 1;
-- SELECT * FROM support_message_templates LIMIT 1;


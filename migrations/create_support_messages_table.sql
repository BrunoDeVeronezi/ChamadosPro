-- Tabela para armazenar mensagens de suporte dos tenants
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'bug', 'sugestao', 'duvida', 'outro'
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'aberto', -- 'aberto', 'em_andamento', 'resolvido', 'fechado'
  admin_response TEXT,
  admin_id VARCHAR REFERENCES users(id), -- ID do admin que respondeu
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_category ON support_messages(category);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

-- Comentários
COMMENT ON TABLE support_messages IS 'Armazena mensagens de suporte enviadas pelos tenants';
COMMENT ON COLUMN support_messages.category IS 'Categoria da mensagem: bug, sugestao, duvida, outro';
COMMENT ON COLUMN support_messages.status IS 'Status da mensagem: aberto, em_andamento, resolvido, fechado';


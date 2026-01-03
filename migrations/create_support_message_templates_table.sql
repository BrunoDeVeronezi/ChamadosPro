-- Tabela para armazenar templates de respostas padrão
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


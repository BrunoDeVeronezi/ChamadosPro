-- Adicionar campos is_public e user_read_at na tabela support_messages
ALTER TABLE support_messages
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE support_messages
ADD COLUMN IF NOT EXISTS user_read_at TIMESTAMP;

-- Índice para melhorar busca de FAQ pública
CREATE INDEX IF NOT EXISTS idx_support_messages_is_public ON support_messages(is_public) WHERE is_public = true;

-- Comentários
COMMENT ON COLUMN support_messages.is_public IS 'Se a pergunta/resposta está disponível publicamente na FAQ';
COMMENT ON COLUMN support_messages.user_read_at IS 'Quando o usuário leu a resposta';


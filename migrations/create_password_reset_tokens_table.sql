-- Criar tabela password_reset_tokens para recuperação de senha
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Desativar RLS (Row Level Security) se necessário
ALTER TABLE IF EXISTS public.password_reset_tokens DISABLE ROW LEVEL SECURITY;

-- Comentários para documentação
COMMENT ON TABLE public.password_reset_tokens IS 'Armazena tokens para recuperação de senha';
COMMENT ON COLUMN public.password_reset_tokens.token IS 'Token único e seguro para recuperação de senha';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Data e hora de expiração do token (geralmente 1 hora após criação)';
COMMENT ON COLUMN public.password_reset_tokens.used IS 'Indica se o token já foi utilizado para redefinir a senha';

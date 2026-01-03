-- Criar tabela user_credentials para autenticação por email/senha
CREATE TABLE IF NOT EXISTS public.user_credentials (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    password_hash TEXT,
    provider TEXT NOT NULL DEFAULT 'email',
    provider_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_provider ON public.user_credentials(provider);

-- Desativar RLS (Row Level Security) se necessário
ALTER TABLE IF EXISTS public.user_credentials DISABLE ROW LEVEL SECURITY;

-- Comentários para documentação
COMMENT ON TABLE public.user_credentials IS 'Armazena credenciais de autenticação (email/senha e OAuth)';
COMMENT ON COLUMN public.user_credentials.password_hash IS 'Hash da senha usando PBKDF2 (formato: salt:hash)';
COMMENT ON COLUMN public.user_credentials.provider IS 'Provedor de autenticação: email, google, facebook, instagram';




















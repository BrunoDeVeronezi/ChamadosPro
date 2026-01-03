-- Migração para remover todas as colunas relacionadas ao Asaas
-- Execute esta migração antes de implementar o Stripe

-- Remover colunas da tabela users
ALTER TABLE users
  DROP COLUMN IF EXISTS asaas_customer_id,
  DROP COLUMN IF EXISTS asaas_api_key,
  DROP COLUMN IF EXISTS asaas_wallet_id;

-- Remover colunas da tabela financial_records e renomear para Stripe
ALTER TABLE financial_records
  DROP COLUMN IF EXISTS asaas_payment_id,
  DROP COLUMN IF EXISTS asaas_payment_link;

-- Adicionar colunas do Stripe (se ainda não existirem)
ALTER TABLE financial_records
  ADD COLUMN IF NOT EXISTS stripe_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;

-- Atualizar payment_gateway na tabela subscriptions (remover referências ao Asaas)
UPDATE subscriptions
SET payment_gateway = NULL
WHERE payment_gateway = 'asaas';

-- Comentários
COMMENT ON COLUMN financial_records.stripe_payment_id IS 'ID do pagamento no Stripe';
COMMENT ON COLUMN financial_records.stripe_payment_link IS 'Link de pagamento do Stripe';


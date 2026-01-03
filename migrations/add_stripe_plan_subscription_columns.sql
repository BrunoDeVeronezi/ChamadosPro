ALTER TABLE plan_types
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

ALTER TABLE plan_types
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_gateway_customer_id TEXT;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_gateway_subscription_id TEXT;

# Deployment Checklist (Production)

This checklist keeps all OAuth, webhooks, and email integrations working after
you go live. Replace the example domains with your real production domain.

## 1) Decide the production base URL
- Example: `https://app.clicksync.com.br`
- If API and frontend share the same host, use the same base.
- If API is separate, set `VITE_API_BASE_URL` to the API host.

## 2) Environment variables (server)
- `BASE_URL=https://app.clicksync.com.br`
- `DATABASE_URL=...`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SESSION_SECRET=...`
- `PAYMENT_LINK_SECRET=...`
- `NODE_ENV=production`
- `PORT=5180` (or your target port)

Mercado Pago OAuth:
- `MERCADOPAGO_CLIENT_ID=...`
- `MERCADOPAGO_CLIENT_SECRET=...`
- `MERCADOPAGO_REDIRECT_URI=https://app.clicksync.com.br/api/mercadopago/oauth/callback`
- `MERCADOPAGO_AUTH_URL=https://auth.mercadopago.com.br/authorization`
- `MERCADOPAGO_OAUTH_SCOPE=read write offline_access`

Mercado Pago platform (plans):
- `MERCADOPAGO_PLATFORM_PUBLIC_KEY=...`
- `MERCADOPAGO_PLATFORM_ACCESS_TOKEN=...`

Google OAuth:
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URI=https://app.clicksync.com.br/api/callback`

Meta WhatsApp Embedded Signup:
- `META_APP_ID=...`
- `META_APP_SECRET=...`
- `META_EMBEDDED_SIGNUP_CONFIG_ID=...`
- `META_GRAPH_VERSION=v21.0`
- `META_OAUTH_SCOPE=business_management,whatsapp_business_management,whatsapp_business_messaging`
- `META_REDIRECT_URI=https://app.clicksync.com.br/api/whatsapp/oauth/callback`

Resend (emails):
- `RESEND_API_KEY=...`
- Ensure your sending domain is verified in DNS (SPF/DKIM).

Client (frontend):
- `VITE_API_BASE_URL=https://app.clicksync.com.br` (only if API is separate)

## 3) Provider callbacks (set once for prod)
Google Cloud Console:
- Authorized JS origins: `https://app.clicksync.com.br`
- Authorized redirect URIs: `https://app.clicksync.com.br/api/callback`

Mercado Pago:
- Redirect URI: `https://app.clicksync.com.br/api/mercadopago/oauth/callback`
- Webhook URL (if needed): `https://app.clicksync.com.br/api/mercadopago/webhook`

Meta (WhatsApp):
- App Domains: `app.clicksync.com.br`
- Valid OAuth Redirect URIs: `https://app.clicksync.com.br/api/whatsapp/oauth/callback`

Supabase Auth (only if you use it):
- Site URL: `https://app.clicksync.com.br`
- Redirect URLs: `https://app.clicksync.com.br/*`

## 4) Avoid changing settings every time
- Use a fixed dev domain (Cloudflare Tunnel subdomain).
- Register both dev and prod redirect URIs in each provider.
- Keep one `.env` per environment (dev/staging/prod).

## 5) Database migrations
- Apply new migrations before starting the server:
  - `migrations/add_whatsapp_integration_settings_columns.sql`
  - Any new migrations added since last deploy.

## 6) Smoke tests after deploy
- Login, open `/dashboard-financeiro`.
- Mercado Pago connect -> should return `mp=connected`.
- WhatsApp connect -> should show `Conectado`.
- Send a test payment link and confirm webhook updates status.


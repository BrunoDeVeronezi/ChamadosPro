import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import {
  setupAuth,
  isAuthenticated,
  isSuperAdmin,
  getOAuthClient,
  getRedirectUriFromRequest,
  generateCodeVerifier,
  generateCodeChallenge,
  base64Url,
  oauthStateCache,
} from './googleAuth';
import crypto from 'crypto';
import { registerReportRoutes } from './routes-reports';
import {
  insertClientSchema,
  insertServiceSchema,
  insertTicketSchema,
  insertFinancialRecordSchema,
  insertLocalEventSchema,
  insertServiceOrderTemplateSchema,
  insertServiceOrderSchema,
} from '@shared/schema';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkCalendarConnection,
  createLocalEventInGoogleCalendar,
  listCalendarBusySlots,
} from './googleCalendar';
import { getAvailableSlots } from './bookingHelper';
import {
  buildScheduleByDay,
  normalizeWorkingHoursConfig,
  SLOT_INTERVAL_MINUTES,
} from './workingHours';
import { generateICS } from './icsGenerator';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import QRCode from 'qrcode';
import { db, pool } from './db';
import { users } from '@shared/schema';
import { buildPixPayload } from '@shared/pix';
import { eq } from 'drizzle-orm';
import { supabase } from './supabase-client';
import { getNgrokUrl } from './ngrok-utils';
// Asaas removido - será implementado Stripe
import {
  generateConfirmationToken,
  getTokenExpirationDate,
  isTokenExpired,
  sendConfirmationEmail,
} from './emailConfirmation';
import {
  sendEmail,
  generateConfirmationCodeEmailHtml,
  generateConfirmationCodeEmailText,
  generatePasswordResetEmailHtml,
  generatePasswordResetEmailText,
} from './emailService';
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';
import { google } from 'googleapis';
import Stripe from 'stripe';
import { registerExtraRoutes } from './routes-extra';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  ip: string,
  maxRequests: number = 100,
  windowMs: number = 900000
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of Array.from(rateLimitStore.entries())) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000);

const STRIPE_API_VERSION = '2024-04-10';
let stripeClient: Stripe | null | undefined;

function getStripeClient(): Stripe | null {
  if (stripeClient !== undefined) {
    return stripeClient;
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  stripeClient = secretKey
    ? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
    : null;
  return stripeClient;
}

function getRequestBaseUrl(req: any): string {
  const origin = req.headers?.origin;
  if (origin && typeof origin === 'string' && origin.startsWith('http')) {
    return origin;
  }
  const forwardedProto = req.headers?.['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]
      : req.protocol || 'http';
  const forwardedHost = req.headers?.['x-forwarded-host'];
  const host =
    typeof forwardedHost === 'string'
      ? forwardedHost.split(',')[0]
      : req.headers?.host;
  if (host) {
    return `${proto}://${host}`;
  }
  return 'http://localhost:5180';
}

function normalizeEmailAddress(email: string | null | undefined): string {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  const plusIndex = localPart.indexOf('+');
  if (plusIndex < 0) return email;
  return `${localPart.slice(0, plusIndex)}@${domain}`;
}

function normalizeSubscriptionRole(
  role: string | null | undefined
): 'technician' | 'company' | null {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === 'technician' || normalized === 'tech') return 'technician';
  if (normalized === 'company' || normalized === 'empresa') return 'company';
  return null;
}

function getRoleVariants(role: 'technician' | 'company'): string[] {
  return role === 'technician'
    ? ['technician', 'tech']
    : ['company', 'empresa'];
}

const TRIAL_DAYS = 30;
const TRIAL_GRACE_DAYS = 5;
const TRIAL_DEVICE_COOKIE = 'chamadospro_device_id';
const PAYMENT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeDocumentValue(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

type PaymentLinkPayload = {
  userId: string;
  referenceId: string;
  exp: number;
};

function decodeBase64Url(input: string): Buffer {
  const padding = input.length % 4;
  const padded = padding ? input + '='.repeat(4 - padding) : input;
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

function safeTimingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getPaymentLinkSecret(): string {
  return (
    process.env.PAYMENT_LINK_SECRET ||
    process.env.SESSION_SECRET ||
    'change-me'
  );
}

function createPaymentLinkToken(payload: PaymentLinkPayload): string {
  const encoded = base64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = base64Url(
    crypto.createHmac('sha256', getPaymentLinkSecret()).update(encoded).digest()
  );
  return `${encoded}.${signature}`;
}

function parsePaymentLinkToken(token: string): PaymentLinkPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = base64Url(
    crypto.createHmac('sha256', getPaymentLinkSecret()).update(encoded).digest()
  );
  if (!safeTimingEqual(signature, expected)) return null;

  let payload: PaymentLinkPayload | null = null;
  try {
    payload = JSON.parse(
      decodeBase64Url(encoded).toString('utf8')
    ) as PaymentLinkPayload;
  } catch {
    payload = null;
  }
  if (!payload?.userId || !payload?.referenceId || !payload?.exp) {
    return null;
  }
  if (Date.now() > payload.exp) return null;
  return payload;
}

function buildPaymentLinkUrl(req: any, token: string): string {
  const baseUrl = (process.env.BASE_URL || getRequestBaseUrl(req)).replace(
    /\/+$/,
    ''
  );
  return `${baseUrl}/pagamento/${token}`;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    if (!key) return acc;
    const value = rest.join('=').trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {} as Record<string, string>);
}

function getCookieValue(req: any, name: string): string | null {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[name] || null;
}

function getRequestIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0]?.trim() || '';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() || '';
  }
  return req.ip || '';
}

function getTrialDeviceId(req: any): string | null {
  const fromBody =
    typeof req.body?.trialDeviceId === 'string'
      ? req.body.trialDeviceId.trim()
      : '';
  if (fromBody) return fromBody;
  const fromCookie = getCookieValue(req, TRIAL_DEVICE_COOKIE);
  return fromCookie ? fromCookie.trim() : null;
}

function getMercadoPagoRedirectUri(req: any): string {
  if (process.env.MERCADOPAGO_REDIRECT_URI) {
    return process.env.MERCADOPAGO_REDIRECT_URI;
  }

  const ngrokUrl = getNgrokUrl();
  if (ngrokUrl) {
    return `${ngrokUrl}/api/mercadopago/oauth/callback`;
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const protocol = forwardedProto || req.protocol || 'http';
  let host = forwardedHost || req.get('host') || 'localhost:5180';

  if (protocol === 'http' && host.endsWith(':80')) {
    host = host.replace(':80', '');
  } else if (protocol === 'https' && host.endsWith(':443')) {
    host = host.replace(':443', '');
  }

  return `${protocol}://${host}/api/mercadopago/oauth/callback`;
}

const META_GRAPH_VERSION_DEFAULT = 'v21.0';
const META_OAUTH_SCOPE_DEFAULT =
  'business_management,whatsapp_business_management,whatsapp_business_messaging';

function getWhatsAppRedirectUri(req: any): string {
  if (process.env.META_REDIRECT_URI) {
    return process.env.META_REDIRECT_URI;
  }

  const baseUrl = (process.env.BASE_URL || getRequestBaseUrl(req)).replace(
    /\/+$/,
    ''
  );
  return `${baseUrl}/api/whatsapp/oauth/callback`;
}

function getWhatsAppConfig(req: any) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
  const graphVersion =
    process.env.META_GRAPH_VERSION || META_GRAPH_VERSION_DEFAULT;
  const scope = process.env.META_OAUTH_SCOPE || META_OAUTH_SCOPE_DEFAULT;
  const redirectUri = getWhatsAppRedirectUri(req);
  const configured = Boolean(appId && appSecret && configId);

  return {
    configured,
    appId,
    configId,
    redirectUri,
    scope,
    graphVersion,
  };
}

function formatCpf(value: string): string | null {
  const digits = normalizeDocumentValue(value);
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
    6,
    9
  )}-${digits.slice(9)}`;
}

function formatCnpj(value: string): string | null {
  const digits = normalizeDocumentValue(value);
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(
    5,
    8
  )}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function buildDocumentCandidates(
  value: string,
  kind: 'cpf' | 'cnpj'
): string[] {
  const digits = normalizeDocumentValue(value);
  if (!digits) return [];
  const candidates = new Set<string>([digits]);
  const formatted = kind === 'cpf' ? formatCpf(digits) : formatCnpj(digits);
  if (formatted) {
    candidates.add(formatted);
  }
  return Array.from(candidates);
}

async function findUserByDocument(
  value: string,
  kind: 'cpf' | 'cnpj',
  excludeUserId?: string
): Promise<any | null> {
  const candidates = buildDocumentCandidates(value, kind);
  if (!candidates.length) return null;

  const conditions = candidates
    .flatMap((candidate) => [`cpf.eq.${candidate}`, `cnpj.eq.${candidate}`])
    .join(',');

  const { data, error } = await supabase
    .from('users')
    .select('id, email, cpf, cnpj')
    .or(conditions)
    .limit(5);

  if (error) {
    console.error('[TRIAL] Error checking document usage:', error);
    return null;
  }

  return (
    (data || []).find((user) => user.id !== excludeUserId) || null
  );
}

async function findUsersByNormalizedEmail(
  normalizedEmail: string
): Promise<any[]> {
  const email = (normalizedEmail || '').toLowerCase().trim();
  if (!email) return [];
  const emailParts = email.split('@');
  if (emailParts.length !== 2) return [];
  const emailPattern = `${emailParts[0]}+%@${emailParts[1]}`;

  const { data, error } = await supabase
    .from('users')
    .select('id, email, cpf, cnpj')
    .or(`email.eq.${email},email.ilike.${emailPattern}`);

  if (error) {
    console.error('[TRIAL] Error checking email documents:', error);
    return [];
  }

  return data || [];
}

async function findTrialUserByDeviceOrIp(
  trialDeviceId: string | null,
  trialIp: string | null
): Promise<any | null> {
  const device = trialDeviceId?.trim();
  const ip = trialIp?.trim();
  if (!device && !ip) return null;

  let query = supabase
    .from('users')
    .select('id, email, trial_device_id, trial_ip')
    .limit(1);

  if (device && ip) {
    query = query.or(`trial_device_id.eq.${device},trial_ip.eq.${ip}`);
  } else if (device) {
    query = query.eq('trial_device_id', device);
  } else if (ip) {
    query = query.eq('trial_ip', ip);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[TRIAL] Error checking device/ip usage:', error);
    return null;
  }

  return (data || [])[0] || null;
}

const isSubscriptionActive = (subscription: any, now: Date) => {
  if (!subscription || subscription.status !== 'active') return false;
  if (!subscription.endDate) return true;
  const endDate = new Date(subscription.endDate);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate > now;
};

async function resolvePlanStatusForUser(
  user: any,
  roleForSubscription?: string
): Promise<{
  planStatus: 'active' | 'trial' | 'expired';
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  trialDeleteAt: Date | null;
}> {
  const createdAtRaw =
    user?.createdAt || user?.created_at || user?.created || null;
  const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
  const trialEndsAt = createdAtDate
    ? new Date(createdAtDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const trialDeleteAt = trialEndsAt
    ? new Date(
        trialEndsAt.getTime() + TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000
      )
    : null;
  const now = new Date();
  const trialDaysLeft =
    trialEndsAt && trialEndsAt > now
      ? Math.max(
          0,
          Math.ceil(
            (trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          )
        )
      : 0;

  let planStatus: 'active' | 'trial' | 'expired' =
    trialEndsAt == null
      ? 'active'
      : trialEndsAt > now
      ? 'trial'
      : 'expired';

  if (user?.role === 'super_admin') {
    planStatus = 'active';
  }

  try {
    const normalizedEmail = normalizeEmailAddress(user?.email || '');
    if (normalizedEmail) {
      const subscriptions = await storage.getSubscriptionsByEmail(
        normalizedEmail
      );
      const now = new Date();
      const hasActive = (subscriptions || []).some((subscription) =>
        isSubscriptionActive(subscription, now)
      );
      const hasExpiredActive = (subscriptions || []).some((subscription) => {
        if (!subscription || subscription.status !== 'active') return false;
        if (!subscription.endDate) return false;
        const endDate = new Date(subscription.endDate);
        return !Number.isNaN(endDate.getTime()) && endDate <= now;
      });
      if (hasActive) {
        planStatus = 'active';
      } else if (hasExpiredActive) {
        planStatus = 'expired';
      }
    }
  } catch (subscriptionError) {
    console.error(
      '[resolvePlanStatusForUser] Erro ao buscar assinatura ativa:',
      subscriptionError
    );
  }

  return { planStatus, trialEndsAt, trialDaysLeft, trialDeleteAt };
}

// Função para inicializar o master admin padrão no banco de dados
async function initializeMasterAdmin() {
  try {
    const DEFAULT_MASTER_EMAIL = 'master@master.com';
    const DEFAULT_MASTER_PASSWORD = 'master@123';

    const emailParts = DEFAULT_MASTER_EMAIL.split('@');
    const uniqueEmail = `${emailParts[0]}+super_admin@${emailParts[1]}`;

    // Verificar se já existe um master admin (buscar todos os super_admin)
    // Primeiro tentar com email único
    let existingUser = await storage.getUserByEmail(uniqueEmail);

    // Se não encontrou com email único, tentar com email original
    if (!existingUser) {
      existingUser = await storage.getUserByEmail(DEFAULT_MASTER_EMAIL);
    }

    // Se ainda não encontrou, buscar qualquer super_admin existente
    if (!existingUser) {
      const allUsers = await storage.getAllUsers();
      existingUser = allUsers.find((u: any) => u.role === 'super_admin');
    }

    // Se encontrou qualquer super_admin, usar ele (evitar duplicação)
    if (existingUser && existingUser.role === 'super_admin') {
      // Se o email não corresponde, atualizar para o email correto
      if (
        existingUser.email !== uniqueEmail &&
        existingUser.email !== DEFAULT_MASTER_EMAIL
      ) {
        console.log(
          '[Master Admin] Email do master admin não corresponde, atualizando...'
        );
        await storage.upsertUser({
          id: existingUser.id,
          email: uniqueEmail,
          firstName: existingUser.firstName || 'Master',
          lastName: existingUser.lastName || 'Admin',
          role: 'super_admin',
        });
      }

      // Verificar se tem credenciais
      const { data: existingCreds } = await supabase
        .from('user_credentials')
        .select('id')
        .eq('user_id', existingUser.id)
        .single();

      if (existingCreds) {
        // Credenciais já existem
      } else {
        console.log(
          '[Master Admin] Usuário existe mas sem credenciais, criando...'
        );
        // Criar credenciais se não existirem
        const salt = randomBytes(16).toString('hex');
        const passwordHash = pbkdf2Sync(
          DEFAULT_MASTER_PASSWORD,
          salt,
          10000,
          64,
          'sha512'
        ).toString('hex');
        const fullHash = `${salt}:${passwordHash}`;

        const { error: credError } = await supabase
          .from('user_credentials')
          .insert({
            id: randomUUID(),
            user_id: existingUser.id,
            password_hash: fullHash,
            provider: 'email',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (credError) {
          console.error(
            '[Master Admin] Erro ao criar credenciais:',
            credError
          );
        }
      }
      return;
    }

    // Hash da senha
    const salt = randomBytes(16).toString('hex');
    const passwordHash = pbkdf2Sync(
      DEFAULT_MASTER_PASSWORD,
      salt,
      10000,
      64,
      'sha512'
    ).toString('hex');
    const fullHash = `${salt}:${passwordHash}`;

    // Criar usuário diretamente no banco usando Drizzle
    const userId = randomUUID();

    // Tentar criar usando storage primeiro
    let masterUser;
    try {
      masterUser = await storage.upsertUser({
        id: userId,
        email: uniqueEmail,
        firstName: 'Master',
        lastName: 'Admin',
        role: 'super_admin',
      });
    } catch (storageError: any) {
      console.error(
        '[Master Admin] Erro ao criar via storage, tentando diretamente no banco:',
        storageError
      );

      // Tentar criar diretamente no banco usando Supabase
      try {
        console.log(
          '[Master Admin] Tentando criar via Supabase diretamente...'
        );

        const { data: supabaseUser, error: supabaseError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: uniqueEmail,
            first_name: 'Master',
            last_name: 'Admin',
            role: 'super_admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (supabaseError) {
          console.error(
            '[Master Admin] Erro ao criar via Supabase:',
            supabaseError
          );
          throw supabaseError;
        }

        if (supabaseUser) {
          masterUser = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            firstName: supabaseUser.first_name,
            lastName: supabaseUser.last_name,
            role: supabaseUser.role,
          } as any;
        } else {
          throw new Error('Usuário não foi criado no banco');
        }
      } catch (supabaseError: any) {
        console.error(
          '[Master Admin] Erro ao criar via Supabase:',
          supabaseError
        );
        throw supabaseError;
      }
    }

    // Criar credenciais
    const credId = randomUUID();

    const { error: credError } = await supabase
      .from('user_credentials')
      .insert({
        id: credId,
        user_id: userId,
        password_hash: fullHash,
        provider: 'email',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (credError) {
      console.error('[Master Admin] Erro ao criar credenciais:', credError);
      console.error(
        '[Master Admin] Detalhes do erro:',
        JSON.stringify(credError, null, 2)
      );
      throw credError;
    }
  } catch (error: any) {
    console.error(
      '[Master Admin] Erro ao inicializar master admin:',
      error
    );
    console.error('[Master Admin] Stack:', error.stack);
    // Não bloquear o servidor se houver erro, mas logar detalhadamente
  }
}

// Configurar limpeza de logs de exclusão (rodar uma vez por dia)
setInterval(async () => {
  try {
    const { error } = await supabase.rpc('cleanup_old_ticket_deletion_logs');
    if (error) {
      // Se a função RPC não existir, tentar via SQL direto
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { error: deleteError } = await supabase
        .from('ticket_deletion_logs')
        .delete()
        .lt('deleted_at', threeMonthsAgo.toISOString());
        
      if (deleteError) throw deleteError;
    }
  } catch (err) {
    console.error('[Cleanup] Erro ao limpar logs:', err);
  }
}, 24 * 60 * 60 * 1000); // 24 horas

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Inicializar master admin no banco de dados
  try {
    await initializeMasterAdmin();
  } catch (error: any) {
    console.error(
      '[Routes] Erro ao inicializar master admin na inicialização:',
      error
    );
    // Continuar mesmo se houver erro
  }

  const paidOnlyMatchers: Array<{
    method: string;
    match: (path: string) => boolean;
  }> = [
    {
      method: 'POST',
      match: (path) => path === '/api/clients/import',
    },
    {
      method: 'GET',
      match: (path) => path === '/api/clients/export',
    },
    {
      method: 'GET',
      match: (path) => /^\/api\/clients\/[^/]+\/financial\/export/.test(path),
    },
    {
      method: 'POST',
      match: (path) => path === '/api/reports/export',
    },
    {
      method: 'POST',
      match: (path) => path === '/api/reports/export-pdf',
    },
    {
      method: 'POST',
      match: (path) => path === '/api/reports/send-whatsapp',
    },
    {
      method: 'GET',
      match: (path) => path.startsWith('/api/reports/advanced'),
    },
    {
      method: 'POST',
      match: (path) => path.startsWith('/api/reports/advanced'),
    },
    {
      method: 'GET',
      match: (path) => path.startsWith('/api/google-calendar'),
    },
    {
      method: 'POST',
      match: (path) => path.startsWith('/api/google-calendar'),
    },
    {
      method: 'PATCH',
      match: (path) => path.startsWith('/api/google-calendar'),
    },
    {
      method: 'DELETE',
      match: (path) => path.startsWith('/api/google-calendar'),
    },
    {
      method: 'GET',
      match: (path) => path.startsWith('/api/calendar'),
    },
    {
      method: 'POST',
      match: (path) => path.startsWith('/api/calendar'),
    },
  ];

  app.use(async (req: any, res, next) => {
    const { method } = req;
    const path = req.path || '';

    const isPaidOnly = paidOnlyMatchers.some(
      (matcher) => matcher.method === method && matcher.match(path)
    );

    if (!isPaidOnly) {
      return next();
    }

    const sessionUser = req.session?.user;
    if (!sessionUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await storage.getUser(sessionUser.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { planStatus } = await resolvePlanStatusForUser(user);
    if (planStatus !== 'active') {
      return res.status(402).json({
        message: 'Recurso disponível apenas na versão paga.',
        code: 'PAID_REQUIRED',
      });
    }

    return next();
  });

  app.use(async (req: any, res, next) => {
    if (req.method !== 'PATCH' || req.path !== '/api/integration-settings') {
      return next();
    }

    const sessionUser = req.session?.user;
    if (!sessionUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await storage.getUser(sessionUser.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { planStatus } = await resolvePlanStatusForUser(user);
    if (planStatus === 'active') {
      return next();
    }

    const bodyKeys = Object.keys(req.body || {});
    const blockedFragments = [
      'google',
      'calendar',
      'whatsapp',
      'reminder',
    ];
    const hasBlockedKey = bodyKeys.some((key) =>
      blockedFragments.some((fragment) =>
        key.toLowerCase().includes(fragment)
      )
    );

    if (!hasBlockedKey) {
      return next();
    }

    return res.status(402).json({
      message: 'Integrações e automações estão disponíveis apenas na versão paga.',
      code: 'PAID_REQUIRED',
    });
  });

  app.use(async (req: any, res, next) => {
    if (req.method !== 'POST' || req.path !== '/api/clients') {
      return next();
    }

    const sessionUser = req.session?.user;
    if (!sessionUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await storage.getUser(sessionUser.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { planStatus } = await resolvePlanStatusForUser(user);
    if (planStatus !== 'trial') {
      return next();
    }

    const clients = await storage.getClientsByUser(sessionUser.id);
    if (clients.length >= 10) {
      return res.status(402).json({
        message:
          'Limite de 10 clientes no trial. Assine um plano para continuar.',
        code: 'TRIAL_CLIENT_LIMIT',
      });
    }

    return next();
  });

  const normalizeStatus = (status: string | null | undefined) => {
    if (!status) return 'pending';
    const map: Record<string, string> = {
      ABERTO: 'pending',
      INICIADO: 'in-progress',
      CONCLUIDO: 'completed',
      CANCELADO: 'cancelled',
      NO_SHOW: 'no-show',
    };
    return map[status] || status;
  };

  const sanitizeWorkingDays = (raw: unknown): number[] | undefined => {
    const normalize = (value: unknown) =>
      (Array.isArray(value) ? value : [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

    if (Array.isArray(raw)) {
      const sanitized = normalize(raw);
      return sanitized.length > 0 ? sanitized : undefined;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        const sanitized = normalize(parsed);
        return sanitized.length > 0 ? sanitized : undefined;
      } catch {
        const sanitized = normalize(
          raw
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        );
        return sanitized.length > 0 ? sanitized : undefined;
      }
    }

    return undefined;
  };

  const normalizeBooleanFlag = (value: unknown): boolean | undefined => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return undefined;
  };

  const normalizeGoogleCalendarEnabled = (value: unknown): boolean => {
    const normalized = normalizeBooleanFlag(value);
    return normalized === undefined ? true : normalized;
  };

  const deriveWorkingDaysFromHours = (
    workingHoursRaw: unknown,
    workingDaysRaw?: unknown
  ): number[] => {
    const sanitizedWorkingDays = sanitizeWorkingDays(workingDaysRaw);
    const normalized = normalizeWorkingHoursConfig(
      workingHoursRaw,
      sanitizedWorkingDays
    );
    return Object.entries(normalized.days)
      .filter(([, config]) => config.enabled)
      .map(([day]) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
  };

  const trimToNull = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return String(value);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const parseOptionalInt = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  const parseDecimalString = (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value.toString();
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      return trimmed.replace(',', '.');
    }
    return null;
  };

  const parseNumberValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const cleaned = value.trim().replace(',', '.');
      if (!cleaned) return null;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const collectRegisteredRoutes = (
    layers: any[],
    routes: Array<{ method: string; path: string }>
  ) => {
    layers.forEach((layer) => {
      if (layer?.route?.path && layer?.route?.methods) {
        const methods = Object.keys(layer.route.methods || {});
        methods.forEach((method) => {
          routes.push({
            method: method.toUpperCase(),
            path: layer.route.path,
          });
        });
        return;
      }
      if (layer?.name === 'router' && Array.isArray(layer?.handle?.stack)) {
        collectRegisteredRoutes(layer.handle.stack, routes);
      }
    });
  };

  const assertCriticalRoutes = (appInstance: Express) => {
    const requiredRoutes = [
      { method: 'GET', path: '/api/tickets' },
      { method: 'POST', path: '/api/tickets' },
      { method: 'POST', path: '/api/tickets/bulk-delete' },
      { method: 'DELETE', path: '/api/tickets/:id' },
      { method: 'GET', path: '/api/tickets/next-number' },
      { method: 'GET', path: '/api/tickets/available-slots' },
      { method: 'POST', path: '/api/clients/bulk-delete' },
      { method: 'DELETE', path: '/api/clients/:id' },
    ];
    const registered: Array<{ method: string; path: string }> = [];
    const stack = (appInstance as any)?._router?.stack || [];
    collectRegisteredRoutes(stack, registered);

    const missing = requiredRoutes.filter(
      (required) =>
        !registered.some(
          (route) =>
            route.method === required.method && route.path === required.path
        )
    );

    if (missing.length > 0) {
      const message = `[Routes] Missing critical routes: ${missing
        .map((route) => `${route.method} ${route.path}`)
        .join(', ')}`;
      console.error(message);
      throw new Error(message);
    }
  };

  const normalizeUploadFileName = (
    fileName: unknown,
    fallbackBase: string,
    extension: string
  ) => {
    if (typeof fileName !== 'string') {
      return `${fallbackBase}.${extension}`;
    }
    const trimmed = fileName.trim();
    if (!trimmed) {
      return `${fallbackBase}.${extension}`;
    }
    const withoutPath = trimmed.replace(/[\\/]/g, '_');
    const sanitized = withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!sanitized) {
      return `${fallbackBase}.${extension}`;
    }
    if (!sanitized.includes('.')) {
      return `${sanitized}.${extension}`;
    }
    return sanitized;
  };

  const ensureServiceOrderBackgroundBucket = async () => {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      throw new Error(
        error.message || 'Failed to list storage buckets for backgrounds.'
      );
    }

    const bucketName = 'service-order-backgrounds';
    const exists = (buckets || []).some((bucket) => bucket.name === bucketName);
    if (exists) return bucketName;

    const { error: createError } = await supabase.storage.createBucket(
      bucketName,
      {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp',
        ],
      }
    );

    if (createError) {
      throw new Error(
        createError.message || 'Failed to create storage bucket for backgrounds.'
      );
    }

    return bucketName;
  };

  const ensureServiceOrderLogoBucket = async () => {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      throw new Error(
        error.message || 'Failed to list storage buckets for logos.'
      );
    }

    const bucketName = 'service-order-logos';
    const exists = (buckets || []).some((bucket) => bucket.name === bucketName);
    if (exists) return bucketName;

    const { error: createError } = await supabase.storage.createBucket(
      bucketName,
      {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp',
        ],
      }
    );

    if (createError) {
      throw new Error(
        createError.message || 'Failed to create storage bucket for logos.'
      );
    }

    return bucketName;
  };

  const isServiceOrderDraftTemplate = (template: any) => {
    if (!template || typeof template !== 'object') return false;
    const draftFlag =
      (template as any).__draft ??
      (template as any)._Draft ??
      (template as any)._draft ??
      (template as any).draft ??
      (template as any).isDraft;
    return Boolean(draftFlag);
  };

  const loadCompanyTechnicians = async (
    companyId: string
  ): Promise<string[]> => {
    const { data, error } = await supabase
      .from('company_technicians')
      .select('technician_id')
      .eq('company_id', companyId)
      .eq('status', 'accepted');

    if (error) {
      const message = error.message || '';
      if (
        error.code === 'PGRST116' ||
        error.code === '42P01' ||
        message.includes('does not exist') ||
        message.includes('nao existe')
      ) {
        return [];
      }
      throw error;
    }

    return data?.map((row: any) => row.technician_id) || [];
  };



  const pad2 = (value: number) => String(value).padStart(2, '0');

  const toDateValue = (value: string | Date | null | undefined) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date;
  };

  const formatLocalDate = (value: string | Date | null | undefined) => {
    const date = toDateValue(value);
    if (!date) return '';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}`;
  };

  const formatLocalTime = (value: string | Date | null | undefined) => {
    const date = toDateValue(value);
    if (!date) return '';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };

  const formatLocalDateTime = (value: string | Date | null | undefined) => {
    const date = toDateValue(value);
    if (!date) return '';
    return `${formatLocalDate(date)}T${formatLocalTime(date)}`;
  };

  const buildAddress = (parts: Array<string | null | undefined>) =>
    parts
      .filter((part) => typeof part === 'string' && part.trim() !== '')
      .join(', ');

  const buildServiceOrderBindings = ({
    ticket,
    client,
    company,
    service,
    arrivalTime,
    completedAt,
  }: {
    ticket: any;
    client: any;
    company: any;
    service: any;
    arrivalTime?: string;
    completedAt?: string;
  }) => {
    const scheduledDate = toDateValue(
      ticket?.scheduledDate || ticket?.scheduledFor
    );
    const scheduledDateValue = formatLocalDate(scheduledDate);
    const scheduledTimeValue =
      ticket?.scheduledTime || formatLocalTime(scheduledDate);
    const scheduledForValue =
      scheduledDateValue && scheduledTimeValue
        ? `${scheduledDateValue}T${scheduledTimeValue}`
        : '';

    const arrivalValue = arrivalTime || ticket?.startedAt || '';
    const completedValue =
      completedAt || ticket?.completedAt || ticket?.stoppedAt || '';

    const clientAddress =
      buildAddress([
        client?.streetAddress,
        client?.addressNumber,
        client?.neighborhood,
        client?.city,
        client?.state,
      ]) ||
      client?.address ||
      '';

    const companyAddress =
      buildAddress([
        company?.streetAddress,
        company?.addressNumber,
        company?.neighborhood,
        company?.city,
        company?.state,
      ]) || '';

    const ticketAddress =
      ticket?.serviceAddress || ticket?.address || clientAddress || '';

    const companyName =
      company?.companyName ||
      [company?.firstName, company?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

    const companyDocument = company?.cnpj || company?.cpf || '';

    return {
      'ticket.number': ticket?.ticketNumber || ticket?.id || '',
      'ticket.description': ticket?.description || '',
      'ticket.date': scheduledDateValue,
      'ticket.time': scheduledTimeValue,
      'ticket.scheduledFor': scheduledForValue,
      'ticket.arrivalAt': formatLocalDateTime(arrivalValue),
      'ticket.arrivalDate': formatLocalDate(arrivalValue),
      'ticket.arrivalTime': formatLocalTime(arrivalValue),
      'ticket.completedAt': formatLocalDateTime(completedValue),
      'ticket.completedDate': formatLocalDate(completedValue),
      'ticket.completedTime': formatLocalTime(completedValue),
      'ticket.address': ticketAddress,
      'ticket.city': ticket?.city || client?.city || '',
      'ticket.state': ticket?.state || client?.state || '',
      'ticket.warranty': ticket?.warranty || '',
      'client.name': client?.name || '',
      'client.document': client?.document || '',
      'client.email': client?.email || '',
      'client.phone': client?.phone || '',
      'client.address': clientAddress,
      'client.city': client?.city || '',
      'client.state': client?.state || '',
      'client.zipCode': client?.zipCode || '',
      'client.legalName': client?.legalName || '',
      'client.stateRegistration': client?.stateRegistration || '',
      'client.municipalRegistration': client?.municipalRegistration || '',
      'company.name': companyName || '',
      'company.document': companyDocument || '',
      'company.phone': company?.phone || '',
      'company.address': companyAddress,
      'company.city': company?.city || '',
      'company.state': company?.state || '',
      'service.name': service?.name || '',
      'service.description': service?.description || '',
    };
  };

  const buildServiceOrderFieldValues = (
    templateSnapshot: any,
    bindings: Record<string, any>
  ) => {
    const snapshot = templateSnapshot || {};
    const components = Array.isArray(snapshot)
      ? snapshot
      : snapshot.components || [];
    const fieldValues: Record<string, any> = {};
    for (const component of components) {
      if (!component || typeof component !== 'object') continue;
      const binding = (component as any).binding;
      const id = (component as any).id;
      if (!binding || !id) continue;
      if (Object.prototype.hasOwnProperty.call(bindings, binding)) {
        const value = bindings[binding];
        if (value !== undefined && value !== null && value !== '') {
          fieldValues[id] = value;
        }
      }
    }
    return fieldValues;
  };

  const loadTicketWithAccess = async (userId: string, ticketId: string) => {
    const user = await storage.getUser(userId);
    if (!user) {
      return { error: { status: 404, message: 'User not found' } };
    }
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return { error: { status: 404, message: 'Ticket not found' } };
    }
    let allowed = false;
    if (user.role === 'company') {
      if (ticket.userId === userId) {
        allowed = true;
      } else {
        const technicianIds = await loadCompanyTechnicians(userId);
        allowed = technicianIds.includes(ticket.userId);
      }
    } else {
      allowed = ticket.userId === userId;
    }
    if (!allowed) {
      return { error: { status: 403, message: 'Forbidden' } };
    }
    return { user, ticket };
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatDate = (value: any) => {
    if (!value) return '';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('pt-BR');
  };

  const normalizePhone = (value?: string) => {
    if (!value) return '';
    return value.replace(/\D/g, '');
  };

  const coerceNumber = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const resolveDateValue = (value: any) => {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  };

  const resolvePaymentContext = async (
    userId: string,
    ticketOrRecordId: string
  ) => {
    const user = await storage.getUser(userId);
    if (!user) {
      return { error: { status: 404, message: 'User not found' } };
    }

    const recordById = await storage.getFinancialRecord(ticketOrRecordId);
    if (recordById) {
      let allowed = recordById.userId === userId;
      if (!allowed && user.role === 'company') {
        const technicianIds = await loadCompanyTechnicians(userId);
        allowed = technicianIds.includes(recordById.userId);
      }
      if (!allowed) {
        return { error: { status: 403, message: 'Forbidden' } };
      }
      const ticket = recordById.ticketId
        ? await storage.getTicket(recordById.ticketId)
        : undefined;
      const client =
        (recordById.clientId
          ? await storage.getClient(recordById.clientId)
          : undefined) ||
        (ticket?.clientId ? await storage.getClient(ticket.clientId) : undefined);
      return { user, record: recordById, ticket, client };
    }

    const access = await loadTicketWithAccess(userId, ticketOrRecordId);
    if (access.error) {
      return { error: access.error };
    }

    const { ticket } = access;
    let records = await storage.getFinancialRecordsByUser(userId, {
      ticketId: ticket.id,
    });
    if (records.length === 0 && user.role === 'company') {
      records = await storage.getFinancialRecordsByUser(ticket.userId, {
        ticketId: ticket.id,
      });
    }

    let record = records[0];
    if (!record) {
      const amount = coerceNumber(
        (ticket as any)?.totalAmount ?? ticket.ticketValue ?? 0
      );
      const dueDateValue =
        resolveDateValue(
          ticket.paymentDate ||
            ticket.dueDate ||
            ticket.completedAt ||
            ticket.stoppedAt ||
            (ticket as any).scheduledDate ||
            ticket.createdAt
        ) || new Date().toISOString();
      if (!ticket.clientId) {
        return { error: { status: 404, message: 'Client not found for ticket' } };
      }
      record = await storage.createFinancialRecord({
        userId,
        ticketId: ticket.id,
        clientId: ticket.clientId,
        amount,
        type: 'receivable',
        status: 'pending',
        dueDate: dueDateValue,
        description: ticket.ticketNumber
          ? `Chamado #${ticket.ticketNumber}`
          : `Chamado ${ticket.id.slice(0, 8)}`,
      });
    }

    const client = ticket.clientId
      ? await storage.getClient(ticket.clientId)
      : undefined;

    return { user, record, ticket, client };
  };

  const markFinancialRecordPaid = async (
    userId: string,
    referenceId: string,
    paidAtIso: string
  ) => {
    const context = await resolvePaymentContext(userId, referenceId);
    if (context.error) {
      return null;
    }
    const record = context.record;
    if (!record) {
      return null;
    }
    if (record.status !== 'paid') {
      await storage.updateFinancialRecord(record.id, {
        status: 'paid',
        paidAt: paidAtIso,
      });
    }
    if (context.ticket?.id) {
      await storage.updateTicket(context.ticket.id, {
        paymentDate: paidAtIso,
      });
    }
    return record;
  };

  const buildPaymentMessage = (options: {
    clientName: string;
    ticketRef: string;
    amount: number;
    dueDate?: string;
    pixKey?: string;
    pixPayload?: string;
    paymentUrl?: string;
  }) => {
    const pixKey = options.pixKey ? options.pixKey.trim() : '';
    const pixPayload = options.pixPayload ? options.pixPayload.trim() : '';
    const lines = [
      `Ola ${options.clientName || 'cliente'},`,
      `Segue a cobranca do chamado ${options.ticketRef || 'sem-id'}.`,
      `Valor: ${formatCurrency(options.amount)}`,
    ];
    if (options.dueDate) {
      lines.push(`Vencimento: ${options.dueDate}`);
    }
    if (options.paymentUrl) {
      lines.push(`Pague online (PIX ou cartao): ${options.paymentUrl}`);
    }
    if (pixKey) {
      lines.push(`PIX: ${pixKey}`);
    }
    if (pixPayload) {
      lines.push(`Copia e cola: ${pixPayload}`);
    }
    return lines.join('\n');
  };

  const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

  const getPlatformMercadoPagoConfig = () => {
    const accessToken =
      process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN ||
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      '';
    const publicKey =
      process.env.MERCADOPAGO_PLATFORM_PUBLIC_KEY ||
      process.env.MERCADOPAGO_PUBLIC_KEY ||
      '';
    return {
      accessToken: accessToken || null,
      publicKey: publicKey || null,
      enabled: Boolean(accessToken && publicKey),
    };
  };

  const resolvePlanRoleForUser = (
    user: any,
    planType: any
  ): 'technician' | 'company' => {
    const normalizedPlanRole = normalizeSubscriptionRole(planType?.role);
    if (normalizedPlanRole === 'company') return 'company';
    if (normalizedPlanRole === 'technician') return 'technician';
    const rawRole = String(user?.role || '').toLowerCase();
    return rawRole === 'company' || rawRole === 'empresa'
      ? 'company'
      : 'technician';
  };

  const computePlanEndDate = (planType: any, startDate: Date) => {
    const endDate = new Date(startDate);
    const billingCycle = String(planType?.billingCycle || 'monthly').toLowerCase();
    if (billingCycle.includes('year')) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  };

  const computePlanEndDateFromMonths = (
    planType: any,
    startDate: Date,
    monthsToAdd: number
  ) => {
    const safeMonths = Math.max(1, Math.min(5, Math.round(monthsToAdd || 1)));
    const billingCycle = String(planType?.billingCycle || 'monthly').toLowerCase();
    const cycleMonths = billingCycle.includes('year') ? 12 : 1;
    const totalMonths = safeMonths * cycleMonths;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + totalMonths);
    return endDate;
  };

  const ensureMercadoPagoPlanSubscription = async (options: {
    paymentId: string | number;
    paymentStatus: string | null;
    paymentMethodId?: string | null;
    amount: number;
    user: any;
    planType: any;
    monthsToAdd?: number;
    discountPercent?: number;
    grossAmount?: number;
  }) => {
    const paymentId = String(options.paymentId || '');
    if (!paymentId) return null;

    const originalEmail = normalizeEmailAddress(options.user?.email || '');
    if (!originalEmail) return null;

    const now = new Date();
    const monthsToAdd = Math.max(1, Math.min(5, Math.round(options.monthsToAdd || 1)));
    const endDateBase = new Date(now);
    const role = resolvePlanRoleForUser(options.user, options.planType);

    const { data: existing, error: existingError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('payment_gateway', 'mercadopago')
      .eq('payment_gateway_subscription_id', paymentId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('[Subscriptions] Erro ao buscar pagamento MP:', existingError);
    }

    const subscriptions = await storage.getSubscriptionsByEmail(originalEmail);
    const activeSubscription = (subscriptions || []).find((subscription) =>
      isSubscriptionActive(subscription, now)
    );
    const activeEndDate = activeSubscription?.endDate
      ? new Date(activeSubscription.endDate)
      : null;
    const effectiveBaseDate =
      activeEndDate && !Number.isNaN(activeEndDate.getTime()) && activeEndDate > now
        ? activeEndDate
        : endDateBase;
    const endDate = computePlanEndDateFromMonths(
      options.planType,
      effectiveBaseDate,
      monthsToAdd
    );

    const metadata = {
      ...(existing?.metadata || {}),
      mp_payment_id: paymentId,
      mp_payment_status: options.paymentStatus || null,
      mp_payment_method: options.paymentMethodId || null,
      mp_amount: options.amount,
      mp_gross_amount: options.grossAmount ?? null,
      mp_discount_percent: options.discountPercent ?? null,
      mp_months: monthsToAdd,
      activated_at: now.toISOString(),
    };

    if (existing?.id) {
      const existingEndDate = existing.endDate
        ? new Date(existing.endDate)
        : endDate;
      const updated = await storage.updateSubscription(existing.id, {
        status: 'active',
        endDate: existingEndDate,
        paymentGateway: 'mercadopago',
        paymentGatewaySubscriptionId: paymentId,
        metadata,
      });
      return updated || existing;
    }

    if (activeSubscription?.id) {
      const updated = await storage.updateSubscription(activeSubscription.id, {
        status: 'active',
        endDate,
        paymentGateway: 'mercadopago',
        paymentGatewaySubscriptionId: paymentId,
        planTypeId: options.planType?.id || activeSubscription.planTypeId,
        metadata: {
          ...(activeSubscription.metadata || {}),
          ...metadata,
        },
      });
      return updated || activeSubscription;
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'expired',
        end_date: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('email', originalEmail)
      .eq('status', 'active');

    const subscription = await storage.createSubscription({
      email: originalEmail,
      role,
      planTypeId: options.planType?.id,
      status: 'active',
      paymentGateway: 'mercadopago',
      paymentGatewayCustomerId: null,
      paymentGatewaySubscriptionId: paymentId,
      startDate: now,
      endDate,
      metadata,
    });

    return subscription;
  };

  const getMercadoPagoAccessToken = async (userId: string) => {
    const integration = await storage.getPaymentIntegration(
      userId,
      'mercadopago'
    );

    if (!integration?.accessToken) {
      return null;
    }

    const expiresAt = integration.tokenExpiresAt
      ? new Date(integration.tokenExpiresAt).getTime()
      : null;
    const isExpired = expiresAt ? expiresAt <= Date.now() + 60_000 : false;

    if (!isExpired) {
      return { accessToken: integration.accessToken, integration };
    }

    if (!integration.refreshToken) {
      return { accessToken: integration.accessToken, integration };
    }

    const clientId = process.env.MERCADOPAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return { accessToken: integration.accessToken, integration };
    }

    const refreshResponse = await fetch(
      `${MERCADOPAGO_API_BASE}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refreshToken,
        }),
      }
    );
    const refreshData = await refreshResponse.json();

    if (!refreshResponse.ok) {
      console.error('[MercadoPago] Falha ao renovar token:', refreshData);
      return { accessToken: integration.accessToken, integration };
    }

    const refreshedExpiresAt = refreshData.expires_in
      ? new Date(Date.now() + Number(refreshData.expires_in) * 1000)
      : null;

    await storage.upsertPaymentIntegration({
      userId,
      provider: 'mercadopago',
      status: 'connected',
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token || integration.refreshToken,
      tokenExpiresAt: refreshedExpiresAt || undefined,
      scope: refreshData.scope || integration.scope,
      providerUserId: refreshData.user_id
        ? String(refreshData.user_id)
        : integration.providerUserId,
      publicKey: refreshData.public_key || integration.publicKey,
      metadata: {
        ...(integration.metadata || {}),
        live_mode: refreshData.live_mode ?? integration.metadata?.live_mode ?? null,
        token_type:
          refreshData.token_type ?? integration.metadata?.token_type ?? null,
      },
    });

    return { accessToken: refreshData.access_token, integration };
  };

  const createMercadoPagoPixCharge = async (options: {
    userId: string;
    ticketRef: string;
    amount: number;
    description: string;
    client: any;
    user: any;
    externalReference?: string;
    metadata?: Record<string, any>;
    notificationUrl?: string;
  }) => {
    const tokenInfo = await getMercadoPagoAccessToken(options.userId);
    if (!tokenInfo?.accessToken) {
      return null;
    }

    const clientDocument = normalizeDocumentValue(options.client?.document);
    const documentType =
      clientDocument.length === 11
        ? 'CPF'
        : clientDocument.length === 14
          ? 'CNPJ'
          : null;

    if (!documentType) {
      const error: any = new Error(
        'CPF ou CNPJ do cliente obrigatorio para gerar cobranca.'
      );
      error.code = 'MISSING_CLIENT_DOCUMENT';
      throw error;
    }

    const clientName =
      options.client?.name ||
      options.user?.companyName ||
      [options.user?.firstName, options.user?.lastName].filter(Boolean).join(' ') ||
      'Cliente';
    const nameParts = clientName.trim().split(/\s+/);
    const firstName = nameParts.shift() || 'Cliente';
    const lastName = nameParts.join(' ') || 'Cliente';
    const payerEmail =
      options.client?.email || options.user?.email || 'contato@cliente.com';

    const paymentPayload: Record<string, any> = {
      transaction_amount: Number(options.amount),
      description: options.description,
      payment_method_id: 'pix',
      external_reference: options.externalReference || options.ticketRef,
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: documentType,
          number: clientDocument,
        },
      },
    };

    if (options.metadata) {
      paymentPayload.metadata = options.metadata;
    }
    if (options.notificationUrl) {
      paymentPayload.notification_url = options.notificationUrl;
    }

    const paymentResponse = await fetch(
      `${MERCADOPAGO_API_BASE}/v1/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify(paymentPayload),
      }
    );

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('[MercadoPago] Erro ao criar pagamento:', paymentData);
      const error: any = new Error(
        paymentData?.message || 'Erro ao criar cobranca no Mercado Pago.'
      );
      error.code = paymentData?.error || 'MERCADOPAGO_PAYMENT_ERROR';
      throw error;
    }

    const transactionData =
      paymentData?.point_of_interaction?.transaction_data || {};
    const pixPayload = transactionData.qr_code || '';
    const qrCodeBase64 = transactionData.qr_code_base64 || '';
    const qrCodeDataUrl = qrCodeBase64
      ? `data:image/png;base64,${qrCodeBase64}`
      : '';

    if (!pixPayload) {
      const error: any = new Error(
        'Nao foi possivel gerar o PIX pelo Mercado Pago.'
      );
      error.code = 'MERCADOPAGO_PIX_MISSING';
      throw error;
    }

    return {
      paymentId: paymentData?.id || null,
      status: paymentData?.status || null,
      pixPayload,
      qrCodeDataUrl,
    };
  };

  const createMercadoPagoPayment = async (
    accessToken: string,
    payload: Record<string, any>
  ) => {
    const paymentResponse = await fetch(
      `${MERCADOPAGO_API_BASE}/v1/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify(payload),
      }
    );

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('[MercadoPago] Erro ao criar pagamento:', paymentData);
      const error: any = new Error(
        paymentData?.message || 'Erro ao criar pagamento no Mercado Pago.'
      );
      error.code = paymentData?.error || 'MERCADOPAGO_PAYMENT_ERROR';
      error.details = paymentData;
      throw error;
    }

    return paymentData;
  };

  const fetchMercadoPagoPayment = async (
    accessToken: string,
    paymentId: string | number
  ) => {
    const paymentResponse = await fetch(
      `${MERCADOPAGO_API_BASE}/v1/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('[MercadoPago] Erro ao consultar pagamento:', paymentData);
      const error: any = new Error(
        paymentData?.message || 'Erro ao consultar pagamento no Mercado Pago.'
      );
      error.code = paymentData?.error || 'MERCADOPAGO_PAYMENT_FETCH_ERROR';
      error.details = paymentData;
      throw error;
    }

    return paymentData;
  };

  const loadClientsForUser = async (
    userId: string,
    role?: string | null
  ) => {
    if (role !== 'company') {
      return storage.getClientsByUser(userId);
    }

    try {
      const technicianIds = await loadCompanyTechnicians(userId);
      if (technicianIds.length === 0) return [];
      const allClients = await Promise.all(
        technicianIds.map((techId) =>
          storage.getClientsByUser(techId).catch((err) => {
            console.error(
              `[GET /api/clients] Failed to load clients for ${techId}:`,
              err
            );
            return [];
          })
        )
      );
      const clientsMap = new Map<string, any>();
      allClients.flat().forEach((client) => {
        if (!clientsMap.has(client.id)) {
          clientsMap.set(client.id, client);
        }
      });
      return Array.from(clientsMap.values());
    } catch (error) {
      console.error('[GET /api/clients] Unexpected error:', error);
      return [];
    }
  };

  app.get('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let clients = await loadClientsForUser(userId, user.role);

      const search =
        typeof req.query.search === 'string'
          ? req.query.search.trim().toLowerCase()
          : '';
      const type =
        typeof req.query.type === 'string' ? req.query.type : undefined;

      if (search) {
        clients = clients.filter((client: any) => {
          const name = (client.name || '').toString().toLowerCase();
          const document = (client.document || '').toString().toLowerCase();
          return name.includes(search) || document.includes(search);
        });
      }

      if (type && type !== 'all') {
        clients = clients.filter((client: any) => client.type === type);
      }

      res.json(clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });

  app.get('/api/clients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      if (user?.role === 'company') {
        const { data: link, error: linkError } = await supabase
          .from('company_technicians')
          .select('*')
          .eq('company_id', userId)
          .eq('technician_id', client.userId)
          .eq('status', 'accepted')
          .maybeSingle();
        if (linkError || !link) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      } else if (client.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ message: 'Failed to fetch client' });
    }
  });

  app.get(
    '/api/clients/search/document',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        const document = req.query.document;
        if (!document || typeof document !== 'string') {
          return res.status(400).json({ message: 'Document is required' });
        }

        const cleanDocument = document.replace(/\D/g, '');
        const clients = await loadClientsForUser(userId, user?.role || null);
        const client = clients.find((c: any) => {
          if (!c.document) return false;
          const cleanClientDoc = c.document.replace(/\D/g, '');
          return cleanClientDoc === cleanDocument;
        });

        if (!client) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.json(client);
      } catch (error) {
        console.error('[GET /api/clients/search/document] Error:', error);
        res.status(500).json({ message: 'Failed to fetch client' });
      }
    }
  );

  app.delete('/api/clients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const clientId =
        typeof req.params?.id === 'string' ? req.params.id.trim() : '';
      if (!clientId) {
        return res.status(400).json({ message: 'Client id is required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      let allowed = false;
      if (user.role === 'company') {
        if (client.userId === userId) {
          allowed = true;
        } else {
          const technicianIds = await loadCompanyTechnicians(userId);
          allowed = technicianIds.includes(client.userId);
        }
      } else {
        allowed = client.userId === userId;
      }

      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const deleted = await storage.deleteClient(clientId);
      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete client' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ message: 'Failed to delete client' });
    }
  });

  app.post(
    '/api/clients/bulk-delete',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawIds = Array.isArray(req.body?.clientIds)
          ? req.body.clientIds
          : [];
        const clientIds = rawIds
          .filter((id: unknown) => typeof id === 'string')
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0);

        if (clientIds.length === 0) {
          return res.status(400).json({ message: 'clientIds is required' });
        }

        const reason =
          typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!reason) {
          return res.status(400).json({ message: 'reason is required' });
        }

        const email =
          typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!email) {
          return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedProvided = normalizeEmailAddress(email).toLowerCase();
        const normalizedUser = normalizeEmailAddress(user.email).toLowerCase();
        if (!normalizedUser || normalizedProvided !== normalizedUser) {
          return res.status(401).json({ message: 'Invalid email' });
        }

        const uniqueIds = Array.from(new Set(clientIds));
        const errors: Array<{ clientId: string; message: string }> = [];
        let deletedCount = 0;
        const bulkId = randomUUID();

        let technicianIds: string[] = [];
        if (user.role === 'company') {
          try {
            technicianIds = await loadCompanyTechnicians(userId);
          } catch (error) {
            console.error(
              '[POST /api/clients/bulk-delete] Error loading technicians:',
              error
            );
            return res
              .status(500)
              .json({ message: 'Failed to validate client access' });
          }
        }

        for (const clientId of uniqueIds) {
          const client = await storage.getClient(clientId);
          if (!client) {
            errors.push({ clientId, message: 'Client not found' });
            continue;
          }

          let allowed = false;
          if (user.role === 'company') {
            allowed =
              client.userId === userId || technicianIds.includes(client.userId);
          } else {
            allowed = client.userId === userId;
          }

          if (!allowed) {
            errors.push({ clientId, message: 'Forbidden' });
            continue;
          }

          const deleted = await storage.deleteClient(clientId);
          if (!deleted) {
            errors.push({ clientId, message: 'Failed to delete client' });
            continue;
          }

          deletedCount += 1;
        }

        const message =
          deletedCount > 0
            ? `${deletedCount} cliente(s) excluido(s) com sucesso.`
            : 'Nenhum cliente foi excluido.';

        res.json({ deletedCount, errors, message, bulkId });
      } catch (error: any) {
        console.error('[POST /api/clients/bulk-delete] Error:', error);
        res.status(500).json({
          message: 'Failed to delete clients',
          error: error?.message || String(error),
        });
      }
    }
  );

  app.post('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let targetUserId = userId;
      if (user.role === 'company') {
        const technicianId = req.body?.technicianId;
        if (!technicianId) {
          return res.status(400).json({
            message: 'technicianId is required for company users',
          });
        }
        const { data: link, error: linkError } = await supabase
          .from('company_technicians')
          .select('*')
          .eq('company_id', userId)
          .eq('technician_id', technicianId)
          .eq('status', 'accepted')
          .maybeSingle();
        if (linkError || !link) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        targetUserId = technicianId;
      }

      if (!req.body?.type || typeof req.body.type !== 'string') {
        return res
          .status(400)
          .json({ message: 'Client type is required', field: 'type' });
      }

      const trimmedName = req.body?.name?.trim();
      if (!trimmedName) {
        return res
          .status(400)
          .json({ message: 'Name is required', field: 'name' });
      }

      const trimmedPhone = req.body?.phone?.trim();
      if (!trimmedPhone) {
        return res
          .status(400)
          .json({ message: 'Phone is required', field: 'phone' });
      }

      const cleanedData = {
        ...req.body,
        userId: targetUserId,
        name: trimmedName,
        type: req.body.type,
        phone: trimmedPhone,
        city: req.body?.city?.trim() || '',
        state: req.body?.state?.trim() || '',
        document: trimToNull(req.body?.document),
        email: trimToNull(req.body?.email),
        // logoUrl: trimToNull(req.body?.logoUrl),
        address: trimToNull(req.body?.address),
        legalName: trimToNull(req.body?.legalName),
        municipalRegistration: trimToNull(req.body?.municipalRegistration),
        stateRegistration: trimToNull(req.body?.stateRegistration),
        zipCode: trimToNull(req.body?.zipCode),
        streetAddress: trimToNull(req.body?.streetAddress),
        addressNumber: trimToNull(req.body?.addressNumber),
        addressComplement: trimToNull(req.body?.addressComplement),
        neighborhood: trimToNull(req.body?.neighborhood),
        paymentCycleStartDay: parseOptionalInt(req.body?.paymentCycleStartDay),
        paymentCycleEndDay: parseOptionalInt(req.body?.paymentCycleEndDay),
        paymentDueDay: parseOptionalInt(req.body?.paymentDueDay),
        defaultHoursIncluded: parseOptionalInt(req.body?.defaultHoursIncluded),
        spreadsheetDay: parseOptionalInt(req.body?.spreadsheetDay),
        monthlySpreadsheet: req.body?.monthlySpreadsheet || false,
        spreadsheetEmail: trimToNull(req.body?.spreadsheetEmail),
        defaultTicketValue: parseDecimalString(req.body?.defaultTicketValue),
        defaultKmRate: parseDecimalString(req.body?.defaultKmRate),
        defaultAdditionalHourRate: parseDecimalString(
          req.body?.defaultAdditionalHourRate
        ),
      };

      const validatedData = insertClientSchema.parse(cleanedData);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const zodMessage = fromZodError(error).message;
        return res.status(400).json({
          message: 'Validation error',
          details: zodMessage,
          errors: error.errors,
        });
      }
      console.error('[POST /api/clients] Error:', error);
      res.status(500).json({
        message: 'Failed to create client',
        error: error?.message || String(error),
      });
    }
  });

  app.get('/api/integration-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let settings = await storage.getIntegrationSettings(userId);
      if (!settings) {
        settings = await storage.createIntegrationSettings({ userId });
      }
      const normalizedSettings = {
        ...settings,
        googleCalendarEnabled: normalizeGoogleCalendarEnabled(
          (settings as any)?.googleCalendarEnabled
        ),
      };
      const derivedWorkingDays = deriveWorkingDaysFromHours(
        normalizedSettings?.workingHours,
        normalizedSettings?.workingDays
      );
      res.json({ ...normalizedSettings, workingDays: derivedWorkingDays });
    } catch (error) {
      console.error('Error fetching integration settings:', error);
      res.status(500).json({ message: 'Failed to fetch integration settings' });
    }
  });

  app.patch(
    '/api/integration-settings',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const updates = { ...(req.body || {}) };
        if (updates.workingHours !== undefined) {
          delete updates.workingDays;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'googleCalendarEnabled')) {
          const normalized = normalizeBooleanFlag(
            (updates as any).googleCalendarEnabled
          );
          if (normalized === undefined) {
            delete (updates as any).googleCalendarEnabled;
          } else {
            (updates as any).googleCalendarEnabled = normalized;
          }
        }
        let settings = await storage.updateIntegrationSettings(userId, updates);
        if (!settings) {
          settings = await storage.createIntegrationSettings({
            userId,
            ...updates,
          });
        }
        const normalizedSettings = {
          ...settings,
          googleCalendarEnabled: normalizeGoogleCalendarEnabled(
            (settings as any)?.googleCalendarEnabled
          ),
        };
        const derivedWorkingDays = deriveWorkingDaysFromHours(
          normalizedSettings?.workingHours,
          normalizedSettings?.workingDays
        );
        res.json({ ...normalizedSettings, workingDays: derivedWorkingDays });
      } catch (error: any) {
        console.error('Error updating integration settings:', error);
        res.status(500).json({
          message:
            error?.message || 'Failed to update integration settings',
        });
      }
    }
  );

  app.get('/api/mercadopago/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const configured = Boolean(
        process.env.MERCADOPAGO_CLIENT_ID &&
          process.env.MERCADOPAGO_CLIENT_SECRET
      );

      if (!configured) {
        return res.json({
          configured: false,
          connected: false,
          status: 'not_configured',
        });
      }

      const integration = await storage.getPaymentIntegration(
        userId,
        'mercadopago'
      );

      if (!integration) {
        return res.json({
          configured: true,
          connected: false,
          status: 'not_connected',
        });
      }

      const rawExpiresAt = integration.tokenExpiresAt
        ? new Date(integration.tokenExpiresAt)
        : null;
      const isExpired = rawExpiresAt
        ? rawExpiresAt.getTime() <= Date.now()
        : false;
      const status = isExpired ? 'expired' : integration.status || 'connected';

      res.json({
        configured: true,
        connected: status === 'connected' || status === 'active',
        status,
        providerUserId: integration.providerUserId,
        publicKey: integration.publicKey,
        scope: integration.scope,
        tokenExpiresAt: rawExpiresAt ? rawExpiresAt.toISOString() : null,
      });
    } catch (error: any) {
      console.error('[MercadoPago] Erro ao buscar status:', error);
      res.status(500).json({ message: 'Failed to fetch Mercado Pago status' });
    }
  });

  app.get('/api/whatsapp/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const config = getWhatsAppConfig(req);
      const settings = await storage.getIntegrationSettings(userId);
      const status = settings?.whatsappStatus || 'not_connected';
      const rawExpiresAt = settings?.whatsappTokenExpiresAt
        ? new Date(settings.whatsappTokenExpiresAt)
        : null;

      res.json({
        configured: config.configured,
        connected: status === 'connected',
        status,
        phoneNumberId: settings?.whatsappPhoneNumberId || null,
        phoneNumber: settings?.whatsappPhoneNumber || null,
        businessAccountId: settings?.whatsappBusinessAccountId || null,
        tokenExpiresAt: rawExpiresAt ? rawExpiresAt.toISOString() : null,
      });
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao buscar status:', error);
      res.status(500).json({ message: 'Failed to fetch WhatsApp status' });
    }
  });

  app.get('/api/whatsapp/config', isAuthenticated, async (req: any, res) => {
    const config = getWhatsAppConfig(req);
    if (!config.configured) {
      return res.json({ configured: false });
    }

    res.json({
      configured: true,
      appId: config.appId,
      configId: config.configId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      graphVersion: config.graphVersion,
    });
  });

  app.post(
    '/api/whatsapp/embedded/exchange',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const code =
          typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        if (!code) {
          return res.status(400).json({ message: 'Codigo ausente.' });
        }

        const config = getWhatsAppConfig(req);
        if (!config.configured || !config.appId || !process.env.META_APP_SECRET) {
          return res.status(500).json({
            message: 'Credenciais do Meta nao configuradas.',
          });
        }

        const graphBaseUrl = `https://graph.facebook.com/${config.graphVersion}`;
        const tokenParams = new URLSearchParams({
          client_id: config.appId,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: config.redirectUri,
          code,
        });
        const tokenResponse = await fetch(
          `${graphBaseUrl}/oauth/access_token?${tokenParams.toString()}`
        );
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          console.error('[WhatsApp] Erro ao trocar token:', tokenData);
          return res.status(400).json({
            message: 'Falha ao trocar token com o Meta.',
            details: tokenData,
          });
        }

        const accessToken = tokenData.access_token;
        if (!accessToken) {
          return res.status(400).json({
            message: 'Token nao recebido do Meta.',
          });
        }

        const wabaResponse = await fetch(
          `${graphBaseUrl}/me/whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const wabaData = await wabaResponse.json();
        if (!wabaResponse.ok) {
          console.error('[WhatsApp] Erro ao buscar WABA:', wabaData);
          return res.status(400).json({
            message: 'Falha ao buscar conta WhatsApp Business.',
            details: wabaData,
          });
        }

        const wabaId = wabaData?.data?.[0]?.id;
        if (!wabaId) {
          return res.status(400).json({
            message: 'Conta WhatsApp Business nao encontrada.',
          });
        }

        const phoneResponse = await fetch(
          `${graphBaseUrl}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const phoneData = await phoneResponse.json();
        if (!phoneResponse.ok) {
          console.error('[WhatsApp] Erro ao buscar telefone:', phoneData);
          return res.status(400).json({
            message: 'Falha ao buscar numero do WhatsApp Business.',
            details: phoneData,
          });
        }

        const phoneNumberId = phoneData?.data?.[0]?.id || null;
        const phoneNumber = phoneData?.data?.[0]?.display_phone_number || null;
        if (!phoneNumberId) {
          return res.status(400).json({
            message: 'Numero do WhatsApp Business nao encontrado.',
          });
        }
        const expiresAt = tokenData.expires_in
          ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
          : null;

        await storage.createOrUpdateIntegrationSettings({
          userId: req.user.id,
          whatsappStatus: 'connected',
          whatsappAccessToken: accessToken,
          whatsappTokenExpiresAt: expiresAt || undefined,
          whatsappBusinessAccountId: wabaId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappPhoneNumber: phoneNumber,
        });

        res.json({
          connected: true,
          status: 'connected',
          businessAccountId: wabaId,
          phoneNumberId,
          phoneNumber,
        });
      } catch (error: any) {
        console.error('[WhatsApp] Erro ao finalizar conexao:', error);
        res.status(500).json({ message: 'Failed to connect WhatsApp' });
      }
    }
  );

  app.get('/api/whatsapp/oauth/callback', (_req: any, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp conectado</title></head><body><p>Conexao concluida. Voce pode fechar esta janela.</p></body></html>'
    );
  });

  app.get(
    '/api/mercadopago/oauth/start',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const clientId = process.env.MERCADOPAGO_CLIENT_ID;
        const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          return res.status(500).json({
            message: 'Mercado Pago nao configurado.',
          });
        }

        const redirectUri = getMercadoPagoRedirectUri(req);
        const state = randomUUID();
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const rawReturnTo =
          typeof req.query?.returnTo === 'string'
            ? req.query.returnTo
            : '/dashboard-financeiro';
        const returnTo = rawReturnTo.startsWith('/')
          ? rawReturnTo
          : '/dashboard-financeiro';

        if (req.session) {
          req.session.mercadopagoOAuth = {
            state,
            userId: req.user.id,
            returnTo,
            codeVerifier,
          };
        }

        const scope =
          process.env.MERCADOPAGO_OAUTH_SCOPE || 'read write offline_access';
        const authBase =
          process.env.MERCADOPAGO_AUTH_URL ||
          'https://auth.mercadopago.com.br/authorization';
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          platform_id: 'mp',
          scope,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });
        const authUrl = `${authBase}?${params.toString()}`;

        if (req.session?.save) {
          req.session.save(() => {
            res.json({ url: authUrl });
          });
        } else {
          res.json({ url: authUrl });
        }
      } catch (error: any) {
        console.error('[MercadoPago] Erro ao iniciar OAuth:', error);
        res.status(500).json({ message: 'Failed to start Mercado Pago OAuth' });
      }
    }
  );

  app.get('/api/mercadopago/oauth/callback', async (req: any, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      const sessionData = req.session?.mercadopagoOAuth;

      const returnTo = sessionData?.returnTo || '/dashboard-financeiro';
      const safeReturnTo = returnTo.startsWith('/')
        ? returnTo
        : '/dashboard-financeiro';
      const redirectWithStatus = (status: string) => {
        if (safeReturnTo.includes('mp=')) {
          return res.redirect(safeReturnTo);
        }
        const separator = safeReturnTo.includes('?') ? '&' : '?';
        return res.redirect(`${safeReturnTo}${separator}mp=${status}`);
      };

      if (error) {
        console.error('[MercadoPago] OAuth error:', {
          error,
          error_description,
        });
        return redirectWithStatus('error');
      }

      if (!code || !state || !sessionData || sessionData.state !== state) {
        console.error('[MercadoPago] Estado invalido ou sessao perdida.');
        return redirectWithStatus('error');
      }

      if (!sessionData.codeVerifier) {
        console.error('[MercadoPago] code_verifier ausente na sessao.');
        return redirectWithStatus('error');
      }

      const clientId = process.env.MERCADOPAGO_CLIENT_ID;
      const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('[MercadoPago] Credenciais ausentes.');
        return redirectWithStatus('error');
      }

      const redirectUri = getMercadoPagoRedirectUri(req);
      const tokenResponse = await fetch(
        'https://api.mercadopago.com/oauth/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: String(code),
            redirect_uri: redirectUri,
            code_verifier: sessionData.codeVerifier,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('[MercadoPago] Erro ao trocar token:', tokenData);
        return redirectWithStatus('error');
      }

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
        : null;

      await storage.upsertPaymentIntegration({
        userId: sessionData.userId,
        provider: 'mercadopago',
        status: 'connected',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt || undefined,
        scope: tokenData.scope || null,
        providerUserId: tokenData.user_id ? String(tokenData.user_id) : null,
        publicKey: tokenData.public_key || null,
        metadata: {
          live_mode: tokenData.live_mode ?? null,
          token_type: tokenData.token_type ?? null,
        },
      });

      if (req.session) {
        delete req.session.mercadopagoOAuth;
      }

      return redirectWithStatus('connected');
    } catch (error: any) {
      console.error('[MercadoPago] Erro no callback:', error);
      return res.redirect('/dashboard-financeiro?mp=error');
    }
  });

  app.get('/api/local-events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      const events = await storage.getLocalEventsByUser(userId, start, end);
      res.json(events);
    } catch (error) {
      console.error('Error fetching local events:', error);
      res.status(500).json({ message: 'Failed to fetch local events' });
    }
  });

  app.post('/api/local-events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = insertLocalEventSchema.parse({
        ...req.body,
        userId,
      });
      const event = await storage.createLocalEvent(validated);
      try {
        const settings = await storage.getIntegrationSettings(userId);
        const googleCalendarEnabled = settings?.googleCalendarEnabled !== false;
        const hasCalendarTokens = (settings?.googleCalendarTokens as any)
          ? true
          : false;
        const isCalendarConnected =
          settings?.googleCalendarStatus === 'connected' || hasCalendarTokens;

        if (googleCalendarEnabled && isCalendarConnected) {
          const calendarId = settings?.googleCalendarId || 'primary';
          const timezone = settings?.timezone || 'America/Sao_Paulo';
          const startDate = new Date(event.startDate);
          let endDate = new Date(event.endDate);
          const allDay = Boolean(event.allDay);

          if (
            !Number.isNaN(startDate.getTime()) &&
            !Number.isNaN(endDate.getTime())
          ) {
            if (allDay) {
              const endCopy = new Date(endDate);
              endCopy.setDate(endCopy.getDate() + 1);
              endDate = endCopy;
            }

            await createLocalEventInGoogleCalendar(
              userId,
              event.title,
              startDate,
              endDate,
              event.description || undefined,
              event.location || undefined,
              allDay,
              calendarId,
              timezone
            );
          } else {
            console.warn(
              '[POST /api/local-events] Invalid dates for Google Calendar sync',
              {
                startDate: event.startDate,
                endDate: event.endDate,
              }
            );
          }
        }
      } catch (calendarError) {
        console.error(
          '[POST /api/local-events] Failed to sync Google Calendar:',
          calendarError
        );
      }
      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating local event:', error);
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: 'Failed to create local event' });
    }
  });

  app.patch('/api/local-events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const existing = await storage.getLocalEvent(id);
      if (!existing) {
        return res.status(404).json({ message: 'Event not found' });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const updates: any = {};
      const allowedFields = [
        'title',
        'description',
        'startDate',
        'endDate',
        'location',
        'color',
        'allDay',
        'ticketId',
      ];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const updated = await storage.updateLocalEvent(id, updates);
      res.json(updated);
    } catch (error) {
      console.error('Error updating local event:', error);
      res.status(500).json({ message: 'Failed to update local event' });
    }
  });

  app.delete(
    '/api/local-events/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const existing = await storage.getLocalEvent(id);
        if (!existing) {
          return res.status(404).json({ message: 'Event not found' });
        }
        if (existing.userId !== userId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        await storage.deleteLocalEvent(id);
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting local event:', error);
        res.status(500).json({ message: 'Failed to delete local event' });
      }
    }
  );

  app.get('/api/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { status, technicianId, startDate, endDate } = req.query;
      let tickets: any[] = [];

      if (user.role === 'company') {
        try {
          const technicianIds = await loadCompanyTechnicians(userId);
          if (technicianIds.length === 0) {
            return res.json([]);
          }
          const allTickets = await Promise.all(
            technicianIds.map((techId) =>
              storage.getTicketsByUser(techId).catch((err) => {
                console.error(
                  `[GET /api/tickets] Failed to load tickets for ${techId}:`,
                  err
                );
                return [];
              })
            )
          );
          tickets = allTickets.flat();
        } catch (error) {
          console.error('[GET /api/tickets] Unexpected error:', error);
          return res.json([]);
        }

        if (status) {
          const statuses = Array.isArray(status) ? status : [status];
          tickets = tickets.filter((t) =>
            statuses.includes((t.status || '').toUpperCase())
          );
        }
        if (technicianId) {
          tickets = tickets.filter((t) => t.technicianId === technicianId);
        }
        if (startDate && endDate) {
          const start = new Date(startDate as string);
          const end = new Date(endDate as string);
          tickets = tickets.filter((t) => {
            const ticketDate = new Date(t.scheduledDate);
            return ticketDate >= start && ticketDate <= end;
          });
        }
      } else {
        if (status) {
          const statuses = Array.isArray(status) ? status : [status];
          tickets = await storage.getTicketsByStatuses(userId, statuses as any);
        } else if (startDate && endDate) {
          tickets = await storage.getTicketsByDateRange(
            userId,
            new Date(startDate as string),
            new Date(endDate as string)
          );
        } else if (technicianId) {
          const allTickets = await storage.getTicketsByTechnician(
            technicianId as string
          );
          tickets = allTickets.filter((t) => t.userId === userId);
        } else {
          tickets = await storage.getTicketsByUser(userId);
        }
      }

      const ticketsWithRelations = await Promise.all(
        tickets.map(async (ticket) => {
          const [client, service] = await Promise.all([
            storage.getClient(ticket.clientId),
            ticket.serviceId
              ? storage.getService(ticket.serviceId)
              : Promise.resolve(null),
          ]);
          const scheduledDateObj = new Date(ticket.scheduledDate);
          const scheduledDateIso = isNaN(scheduledDateObj.getTime())
            ? ''
            : scheduledDateObj.toISOString().split('T')[0];
          return {
            ...ticket,
            scheduledFor: `${scheduledDateIso}T${ticket.scheduledTime}`,
            client,
            service,
          };
        })
      );

      res.json(ticketsWithRelations);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ message: 'Failed to fetch tickets' });
    }
  });

  app.post('/api/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const body = req.body || {};
      const rawTechnicianId =
        typeof body.technicianId === 'string'
          ? body.technicianId.trim()
          : '';
      let targetUserId = userId;
      let technicianId: string | undefined;

      if (user.role === 'company') {
        if (!rawTechnicianId) {
          return res.status(400).json({
            message: 'technicianId is required for company users',
          });
        }
        const technicianIds = await loadCompanyTechnicians(userId);
        if (!technicianIds.includes(rawTechnicianId)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        targetUserId = rawTechnicianId;
        technicianId = rawTechnicianId;
      }

      const clientId =
        typeof body.clientId === 'string' ? body.clientId.trim() : '';
      if (!clientId) {
        return res.status(400).json({ message: 'clientId is required' });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      if (user.role === 'company') {
        const technicianIds = await loadCompanyTechnicians(userId);
        if (!technicianIds.includes(client.userId)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        if (technicianId && client.userId !== technicianId) {
          return res.status(400).json({
            message: 'Client does not belong to selected technician',
          });
        }
      } else if (client.userId !== targetUserId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      let service: any | null = null;
      const serviceId =
        typeof body.serviceId === 'string' && body.serviceId.trim() !== ''
          ? body.serviceId.trim()
          : undefined;
      if (serviceId) {
        service = await storage.getService(serviceId);
        if (!service) {
          return res.status(404).json({ message: 'Service not found' });
        }
        if (service.userId !== targetUserId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
      } else if (client.type !== 'EMPRESA_PARCEIRA') {
        return res.status(400).json({
          message: 'serviceId is required for this client type',
        });
      }

      let scheduledDate = body.scheduledDate;
      let scheduledTime = body.scheduledTime;

      if ((!scheduledDate || !scheduledTime) && body.scheduledFor) {
        const scheduledForDate = toDateValue(body.scheduledFor);
        if (scheduledForDate) {
          scheduledDate = formatLocalDate(scheduledForDate);
          scheduledTime = formatLocalTime(scheduledForDate);
        }
      }

      if (scheduledDate && !scheduledTime) {
        const scheduledDateTime = toDateValue(scheduledDate);
        if (scheduledDateTime) {
          scheduledDate = formatLocalDate(scheduledDateTime);
          scheduledTime = formatLocalTime(scheduledDateTime);
        }
      }

      if (!scheduledDate || !scheduledTime) {
        return res.status(400).json({
          message: 'scheduledDate and scheduledTime are required',
        });
      }

      const cleanedData = {
        ...body,
        userId: targetUserId,
        technicianId,
        clientId,
        serviceId,
        scheduledDate,
        scheduledTime,
        duration: parseOptionalInt(body.duration) ?? body.duration,
        travelTimeMinutes: parseOptionalInt(body.travelTimeMinutes),
        bufferTimeMinutes: parseOptionalInt(body.bufferTimeMinutes),
        calculationsEnabled: normalizeBooleanFlag(body.calculationsEnabled),
        dueDate: toDateValue(body.dueDate) || undefined,
        paymentDate: toDateValue(body.paymentDate) || undefined,
        status: body.status || 'ABERTO',
      };

      const validatedData = insertTicketSchema.parse(cleanedData);
      let ticket = await storage.createTicket(validatedData);

      try {
        const hasCalendarTokens = (settings: any) => {
          const tokens = settings?.googleCalendarTokens as any;
          return Boolean(tokens?.refresh_token || tokens?.access_token);
        };
        const isCalendarConnected = (settings: any) =>
          settings?.googleCalendarStatus === 'connected' ||
          hasCalendarTokens(settings);
        const isCalendarEnabled = (settings: any) =>
          settings?.googleCalendarEnabled !== false;

        let calendarSyncUserId = targetUserId;
        let calendarSettings = await storage.getIntegrationSettings(
          targetUserId
        );

        if (user.role === 'company' && targetUserId !== userId) {
          const companySettings = await storage.getIntegrationSettings(userId);
          const companyEnabled = isCalendarEnabled(companySettings);
          const companyConnected = isCalendarConnected(companySettings);
          const technicianReady =
            isCalendarEnabled(calendarSettings) &&
            isCalendarConnected(calendarSettings);

          if (!companyEnabled || companyConnected || !technicianReady) {
            calendarSyncUserId = userId;
            calendarSettings = companySettings;
          }
        }

        const calendarId = calendarSettings?.googleCalendarId || 'primary';
        const timezone = calendarSettings?.timezone || 'America/Sao_Paulo';
        const clientName =
          client.name || client.legalName || client.email || 'Cliente';
        const serviceName = service?.name || 'Chamado';

        const eventId = await createCalendarEvent(
          calendarSyncUserId,
          ticket,
          clientName,
          serviceName,
          timezone,
          calendarId
        );

        if (eventId) {
          const updated = await storage.updateTicket(ticket.id, {
            googleCalendarEventId: eventId,
          });
          if (updated) {
            ticket = updated;
          } else {
            (ticket as any).googleCalendarEventId = eventId;
          }
        }
      } catch (calendarError) {
        console.error(
          '[POST /api/tickets] Failed to sync Google Calendar:',
          calendarError
        );
      }

      res.status(201).json(ticket);
    } catch (error: any) {
      console.error('[POST /api/tickets] Error:', error);
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      res.status(500).json({
        message: 'Failed to create ticket',
        error: error?.message || String(error),
      });
    }
  });

  app.post(
    '/api/tickets/bulk-delete',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const rawIds = Array.isArray(req.body?.ticketIds)
          ? req.body.ticketIds
          : [];
        const ticketIds = rawIds
          .filter((id: unknown) => typeof id === 'string')
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0);

        if (ticketIds.length === 0) {
          return res.status(400).json({ message: 'ticketIds is required' });
        }

        const reason =
          typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!reason) {
          return res.status(400).json({ message: 'reason is required' });
        }

        const { data: credRows, error: credError } = await supabase
          .from('user_credentials')
          .select('password_hash')
          .eq('user_id', userId)
          .eq('provider', 'email')
          .limit(1);

        if (credError) {
          console.error(
            '[POST /api/tickets/bulk-delete] Error checking credentials:',
            credError
          );
          return res
            .status(500)
            .json({ message: 'Failed to validate credentials' });
        }

        const passwordHash = credRows?.[0]?.password_hash;
        const hasPassword =
          typeof passwordHash === 'string' && passwordHash.trim() !== '';

        if (hasPassword) {
          const password =
            typeof req.body?.password === 'string' ? req.body.password : '';
          if (!password) {
            return res.status(400).json({ message: 'Password is required' });
          }
          const [salt, storedHash] = passwordHash.split(':');
          if (!salt || !storedHash) {
            return res.status(401).json({ message: 'Invalid password' });
          }
          const computedHash = pbkdf2Sync(
            password,
            salt,
            10000,
            64,
            'sha512'
          ).toString('hex');

          if (computedHash !== storedHash) {
            return res.status(401).json({ message: 'Invalid password' });
          }
        } else {
          const email =
            typeof req.body?.email === 'string' ? req.body.email.trim() : '';
          if (!email) {
            return res.status(400).json({ message: 'Email is required' });
          }
          const normalizedProvided = normalizeEmailAddress(email).toLowerCase();
          const normalizedUser = normalizeEmailAddress(user.email).toLowerCase();
          if (!normalizedUser || normalizedProvided !== normalizedUser) {
            return res.status(401).json({ message: 'Invalid email' });
          }
        }

        const uniqueIds = Array.from(new Set(ticketIds));
        const deletedByEmail =
          normalizeEmailAddress(user.email || '') || 'unknown';
        const bulkId = randomUUID();
        const errors: Array<{ ticketId: string; message: string }> = [];
        let deletedCount = 0;

        let technicianIds: string[] = [];
        if (user.role === 'company') {
          try {
            technicianIds = await loadCompanyTechnicians(userId);
          } catch (error) {
            console.error(
              '[POST /api/tickets/bulk-delete] Error loading technicians:',
              error
            );
            return res
              .status(500)
              .json({ message: 'Failed to validate ticket access' });
          }
        }

        for (const ticketId of uniqueIds) {
          const ticket = await storage.getTicket(ticketId);
          if (!ticket) {
            errors.push({ ticketId, message: 'Ticket not found' });
            continue;
          }

          let allowed = false;
          if (user.role === 'company') {
            allowed =
              ticket.userId === userId ||
              technicianIds.includes(ticket.userId);
          } else {
            allowed = ticket.userId === userId;
          }

          if (!allowed) {
            errors.push({ ticketId, message: 'Forbidden' });
            continue;
          }

          const deleted = await storage.deleteTicket(ticketId);
          if (!deleted) {
            errors.push({ ticketId, message: 'Failed to delete ticket' });
            continue;
          }

          deletedCount += 1;

          const { error: logError } = await supabase
            .from('ticket_deletion_logs')
            .insert({
              ticket_id: ticket.id,
              deleted_by: userId,
              deleted_by_email: deletedByEmail,
              reason,
              deleted_at: new Date().toISOString(),
              ticket_data: ticket,
              bulk_id: bulkId,
              bulk_count: uniqueIds.length,
            });

          if (logError) {
            console.error(
              '[POST /api/tickets/bulk-delete] Failed to log deletion:',
              // logError
            );
          }
        }

        const message =
          deletedCount > 0
            ? `${deletedCount} ticket(s) excluido(s) com sucesso.`
            : 'Nenhum ticket foi excluido.';

        res.json({ deletedCount, errors, message, bulkId });
      } catch (error: any) {
        console.error('[POST /api/tickets/bulk-delete] Error:', error);
        res.status(500).json({
          message: 'Failed to delete tickets',
          error: error?.message || String(error),
        });
      }
    }
  );

  app.delete('/api/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const ticketId =
        typeof req.params?.id === 'string' ? req.params.id.trim() : '';
      if (!ticketId) {
        return res.status(400).json({ message: 'Ticket id is required' });
      }

      const access = await loadTicketWithAccess(userId, ticketId);
      if (access.error) {
        return res
          .status(access.error.status)
          .json({ message: access.error.message });
      }

      const deleted = await storage.deleteTicket(ticketId);
      if (!deleted) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const reason =
        typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const deletedByEmail =
        normalizeEmailAddress(access.user?.email || '') || 'unknown';

      const { error: logError } = await supabase
        .from('ticket_deletion_logs')
        .insert({
          ticket_id: access.ticket.id,
          deleted_by: userId,
          deleted_by_email: deletedByEmail,
          reason: reason || 'Exclusao individual',
          deleted_at: new Date().toISOString(),
          ticket_data: access.ticket,
          bulk_count: 1,
        });

      if (logError) {
        console.error(
          '[DELETE /api/tickets/:id] Failed to log deletion:',
          // logError
        );
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('[DELETE /api/tickets/:id] Error:', error);
      res.status(500).json({
        message: 'Failed to delete ticket',
        error: error?.message || String(error),
      });
    }
  });

  const handleTicketCheckIn = async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const ticketId =
        typeof req.params?.id === 'string' ? req.params.id.trim() : '';
      if (!ticketId) {
        return res.status(400).json({ message: 'Ticket id is required' });
      }

      const access = await loadTicketWithAccess(userId, ticketId);
      if (access.error) {
        return res
          .status(access.error.status)
          .json({ message: access.error.message });
      }

      const updated = await storage.ticketCheckIn(ticketId);
      if (!updated) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[POST /api/tickets/:id/check-in] Error:', error);
      res.status(500).json({
        message: 'Failed to check-in ticket',
        error: error?.message || String(error),
      });
    }
  };

  app.post('/api/tickets/:id/check-in', isAuthenticated, handleTicketCheckIn);
  app.post('/api/tickets/:id/checkin', isAuthenticated, handleTicketCheckIn);

  app.post('/api/tickets/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const ticketId =
        typeof req.params?.id === 'string' ? req.params.id.trim() : '';
      if (!ticketId) {
        return res.status(400).json({ message: 'Ticket id is required' });
      }

      const access = await loadTicketWithAccess(userId, ticketId);
      if (access.error) {
        return res
          .status(access.error.status)
          .json({ message: access.error.message });
      }

      const body = req.body || {};

      const kmTotal = parseNumberValue(body.kmTotal) ?? 0;
      const extraExpenses = parseNumberValue(body.extraExpenses) ?? 0;
      const expenseDetails =
        typeof body.expenseDetails === 'string' ? body.expenseDetails : '';
      const kmRate = parseNumberValue(body.kmRate) ?? undefined;
      const additionalHourRate =
        parseNumberValue(body.additionalHourRate) ?? undefined;
      const elapsedSeconds =
        parseNumberValue(body.elapsedSeconds) ?? undefined;
      const paymentDate =
        typeof body.paymentDate === 'string' && body.paymentDate.trim() !== ''
          ? body.paymentDate
          : undefined;
      const dueDate =
        typeof body.dueDate === 'string' && body.dueDate.trim() !== ''
          ? body.dueDate
          : undefined;
      const warrantyRaw =
        typeof body.warranty === 'string' ? body.warranty.trim() : '';
      const warranty = warrantyRaw ? warrantyRaw : undefined;
      const arrivalTime =
        typeof body.arrivalTime === 'string' ? body.arrivalTime : undefined;

      const rawServiceItems = Array.isArray(body.serviceItems)
        ? body.serviceItems
        : undefined;
      const serviceItems = rawServiceItems
        ? rawServiceItems
            .map((item: any) => ({
              name:
                typeof item?.name === 'string' ? item.name.trim() : '',
              amount: parseNumberValue(item?.amount) ?? 0,
            }))
            .filter((item: any) => item.name || item.amount > 0)
        : undefined;

      const ticket = access.ticket;

      let baseAmount = parseNumberValue(body.baseAmount);
      if (baseAmount === null) {
        if (serviceItems && serviceItems.length > 0) {
          baseAmount = serviceItems.reduce(
            (sum: number, item: any) => sum + (item.amount || 0),
            0
          );
        } else if (ticket.ticketValue) {
          baseAmount = parseNumberValue(ticket.ticketValue);
        } else if (ticket.serviceId) {
          const service = await storage.getService(ticket.serviceId);
          if (service?.price !== undefined && service?.price !== null) {
            baseAmount = Number(service.price);
          }
        }
      }
      if (baseAmount === null) baseAmount = 0;

      const resolvedKmRate =
        kmRate ?? parseNumberValue(ticket.kmRate) ?? 0;

      const resolvedAdditionalHourRate =
        additionalHourRate ?? parseNumberValue(ticket.additionalHourRate) ?? 0;

      let extraHoursValue = 0;
      if (resolvedAdditionalHourRate > 0 && elapsedSeconds !== undefined) {
        let includedHours = Number(ticket.duration) || 0;
        try {
          const client = await storage.getClient(ticket.clientId);
          if (
            client?.type === 'EMPRESA_PARCEIRA' &&
            client.defaultHoursIncluded !== undefined &&
            client.defaultHoursIncluded !== null
          ) {
            const parsedIncluded = Number(client.defaultHoursIncluded);
            if (!Number.isNaN(parsedIncluded) && parsedIncluded > 0) {
              includedHours = parsedIncluded;
            }
          }
        } catch (error) {
          console.warn(
            '[POST /api/tickets/:id/complete] Failed to load client:',
            error
          );
        }

        const extraHours = Math.max(0, elapsedSeconds / 3600 - includedHours);
        extraHoursValue = extraHours * resolvedAdditionalHourRate;
      }

      const totalAmountRaw = parseNumberValue(body.totalAmount);
      const totalAmount =
        totalAmountRaw !== null
          ? totalAmountRaw
          : baseAmount + kmTotal * resolvedKmRate + extraExpenses + extraHoursValue;

      const updated = await storage.ticketComplete(ticketId, {
        kmTotal,
        extraExpenses,
        expenseDetails,
        totalAmount,
        kmRate,
        additionalHourRate,
        serviceItems,
        paymentDate,
        dueDate,
        elapsedSeconds,
        warranty,
        arrivalTime,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      try {
        if (ticket.clientId) {
          const existingRecords = await storage.getFinancialRecordsByUser(
            userId,
            { ticketId }
          );
          const existingRecord = existingRecords?.[0];
          const description = ticket.ticketNumber
            ? `Chamado #${ticket.ticketNumber}`
            : `Chamado ${ticket.id.slice(0, 8)}`;
          const candidateDueDate =
            paymentDate ||
            dueDate ||
            (updated as any).paymentDate ||
            (updated as any).dueDate ||
            (updated as any).completedAt ||
            (updated as any).stoppedAt;
          let resolvedDueDate = new Date().toISOString();
          if (candidateDueDate) {
            const parsedDate = new Date(candidateDueDate as any);
            if (!Number.isNaN(parsedDate.getTime())) {
              resolvedDueDate = parsedDate.toISOString();
            }
          }

          if (existingRecord) {
            await storage.updateFinancialRecord(existingRecord.id, {
              amount: totalAmount,
              dueDate: resolvedDueDate,
              status: existingRecord.status || 'pending',
              type: existingRecord.type || 'receivable',
              description: description,
              ticketId,
              clientId: ticket.clientId,
            });
          } else {
            await storage.createFinancialRecord({
              userId,
              ticketId,
              clientId: ticket.clientId,
              amount: totalAmount,
              type: 'receivable',
              status: 'pending',
              dueDate: resolvedDueDate,
              description: description,
            });
          }
        }
      } catch (error) {
        console.warn(
          '[POST /api/tickets/:id/complete] Failed to sync financial record:',
          error
        );
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[POST /api/tickets/:id/complete] Error:', error);
      res.status(500).json({
        message: error?.message || 'Failed to complete ticket',
      });
    }
  });

  app.post(
    '/api/tickets/:id/send-payment-link',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const ticketOrRecordId =
          typeof req.params?.id === 'string' ? req.params.id.trim() : '';
        if (!ticketOrRecordId) {
          return res.status(400).json({ message: 'Ticket id is required' });
        }

        const context = await resolvePaymentContext(userId, ticketOrRecordId);
        if (context.error) {
          return res
            .status(context.error.status)
            .json({ message: context.error.message });
        }

        const ticket = context.ticket as any;
        const record = context.record as any;
        const client = context.client as any;
        const amount = coerceNumber(
          record?.amount ?? ticket?.totalAmount ?? ticket?.ticketValue ?? 0
        );
        const dueDateValue =
          record?.dueDate ?? ticket?.paymentDate ?? ticket?.dueDate ?? null;
        const dueDate = dueDateValue ? formatDate(dueDateValue) : '';
        const ticketRef =
          ticket?.ticketNumber ||
          ticket?.id?.slice(0, 8) ||
          record?.id?.slice(0, 8) ||
          '';
        const clientName =
          client?.name ||
          ticket?.client?.name ||
          ticket?.clientName ||
          'cliente';
        const referenceId = record?.id || ticket?.id || ticketOrRecordId;
        const webhookBaseUrl = (
          process.env.BASE_URL || getRequestBaseUrl(req)
        ).replace(/\/+$/, '');
        const notificationUrl = webhookBaseUrl
          ? `${webhookBaseUrl}/api/mercadopago/webhook?source=ticket&user_id=${encodeURIComponent(
              userId
            )}&record_id=${encodeURIComponent(
              record?.id || ''
            )}&ticket_id=${encodeURIComponent(ticket?.id || '')}`
          : '';
        const mpMetadata = {
          purpose: 'ticket',
          user_id: userId,
          record_id: record?.id || null,
          ticket_id: ticket?.id || null,
          ticket_ref: ticketRef || null,
        };

        const settings = await storage.getIntegrationSettings(userId);
        const preferredProvider =
          typeof req.body?.provider === 'string'
            ? req.body.provider.trim().toLowerCase()
            : 'auto';
        const wantsMercadoPago =
          preferredProvider === 'mercadopago' || preferredProvider === 'auto';
        const integration = wantsMercadoPago
          ? await storage.getPaymentIntegration(userId, 'mercadopago')
          : null;
        const mpConnected = Boolean(
          integration?.accessToken &&
            (integration?.status === 'connected' ||
              integration?.status === 'active')
        );

        let pixPayload = '';
        let qrCodeDataUrl = '';
        let pixKeyLabel = settings?.pixKey ? settings.pixKey.trim() : '';
        let provider = 'pix';
        let paymentId: string | null = null;

        if (wantsMercadoPago && mpConnected) {
          provider = 'mercadopago';
          pixKeyLabel = '';
        } else if (preferredProvider === 'mercadopago') {
          return res.status(400).json({
            message: 'Mercado Pago nao conectado.',
          });
        }

        if (provider === 'mercadopago') {
          try {
            const mpCharge = await createMercadoPagoPixCharge({
              userId,
              ticketRef: ticketRef || 'sem-id',
              externalReference: referenceId || ticketRef || 'sem-id',
              notificationUrl: notificationUrl || undefined,
              metadata: mpMetadata,
              amount,
              description: `Chamado ${ticketRef || 'sem-id'}`,
              client,
              user: context.user,
            });
            if (mpCharge?.pixPayload) {
              pixPayload = mpCharge.pixPayload;
              qrCodeDataUrl = mpCharge.qrCodeDataUrl;
              paymentId = mpCharge.paymentId || null;
            }
          } catch (error: any) {
            if (error?.code !== 'MISSING_CLIENT_DOCUMENT') {
              console.error('[MercadoPago] Falha ao gerar PIX:', error);
            }
          }
        }

        if (!pixPayload && provider === 'pix') {
          const pixKey = settings?.pixKey ? settings.pixKey.trim() : '';
          if (!pixKey) {
            return res.status(400).json({ message: 'PIX key not configured' });
          }

          const merchantName =
            settings?.pixAccountHolder?.trim() ||
            context.user?.companyName ||
            [context.user?.firstName, context.user?.lastName]
              .filter(Boolean)
              .join(' ') ||
            'RECEBEDOR';
          const merchantCity = context.user?.city || 'BRASIL';
          const txidBase = `TICKET${ticketRef}`.replace(/[^A-Za-z0-9]/g, '');
          pixPayload = buildPixPayload({
            pixKey,
            amount: amount > 0 ? amount : undefined,
            merchantName,
            merchantCity,
            txid: txidBase.slice(0, 25),
            description: `Chamado ${ticketRef || 'sem-id'}`,
          });
          qrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
            width: 240,
            margin: 1,
          });
          pixKeyLabel = pixKey;
        }

        const paymentUrl =
          provider === 'mercadopago' && referenceId
            ? buildPaymentLinkUrl(
                req,
                createPaymentLinkToken({
                  userId,
                  referenceId,
                  exp: Date.now() + PAYMENT_LINK_TTL_MS,
                })
              )
            : '';

        const baseMessage = buildPaymentMessage({
          clientName,
          ticketRef: ticketRef || 'sem-id',
          amount,
          dueDate,
          pixKey: pixKeyLabel,
          pixPayload,
          paymentUrl,
        });

        const customMessage =
          typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        let finalMessage = customMessage || baseMessage;
        if (pixPayload && !finalMessage.includes(pixPayload)) {
          finalMessage = `${finalMessage}\nCopia e cola: ${pixPayload}`;
        }

        const phone = normalizePhone(req.body?.phone);
        const whatsappUrl = phone
          ? `https://wa.me/55${phone}?text=${encodeURIComponent(finalMessage)}`
          : `https://wa.me/?text=${encodeURIComponent(finalMessage)}`;

        res.json({
          whatsappUrl,
          message: finalMessage,
          pixPayload,
          pixKey: pixKeyLabel || null,
          pixAccountHolder: settings?.pixAccountHolder?.trim() || null,
          qrCodeDataUrl,
          amount,
          dueDate,
          paymentUrl: paymentUrl || null,
          provider,
          paymentId,
        });
      } catch (error: any) {
        console.error('[POST /api/tickets/:id/send-payment-link] Error:', error);
        res.status(500).json({
          message: error?.message || 'Failed to generate payment link',
        });
      }
    }
  );

  app.post(
    '/api/tickets/:id/send-payment-link-email',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const ticketOrRecordId =
          typeof req.params?.id === 'string' ? req.params.id.trim() : '';
        if (!ticketOrRecordId) {
          return res.status(400).json({ message: 'Ticket id is required' });
        }

        const email =
          typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        if (!email) {
          return res.status(400).json({ message: 'Email is required' });
        }

        const context = await resolvePaymentContext(userId, ticketOrRecordId);
        if (context.error) {
          return res
            .status(context.error.status)
            .json({ message: context.error.message });
        }

        const ticket = context.ticket as any;
        const record = context.record as any;
        const client = context.client as any;
        const amount = coerceNumber(
          record?.amount ?? ticket?.totalAmount ?? ticket?.ticketValue ?? 0
        );
        const dueDateValue =
          record?.dueDate ?? ticket?.paymentDate ?? ticket?.dueDate ?? null;
        const dueDate = dueDateValue ? formatDate(dueDateValue) : '';
        const ticketRef =
          ticket?.ticketNumber ||
          ticket?.id?.slice(0, 8) ||
          record?.id?.slice(0, 8) ||
          '';
        const clientName =
          client?.name ||
          ticket?.client?.name ||
          ticket?.clientName ||
          'cliente';
        const referenceId = record?.id || ticket?.id || ticketOrRecordId;
        const webhookBaseUrl = (
          process.env.BASE_URL || getRequestBaseUrl(req)
        ).replace(/\/+$/, '');
        const notificationUrl = webhookBaseUrl
          ? `${webhookBaseUrl}/api/mercadopago/webhook?source=ticket&user_id=${encodeURIComponent(
              userId
            )}&record_id=${encodeURIComponent(
              record?.id || ''
            )}&ticket_id=${encodeURIComponent(ticket?.id || '')}`
          : '';
        const mpMetadata = {
          purpose: 'ticket',
          user_id: userId,
          record_id: record?.id || null,
          ticket_id: ticket?.id || null,
          ticket_ref: ticketRef || null,
        };

        const settings = await storage.getIntegrationSettings(userId);
        const preferredProvider =
          typeof req.body?.provider === 'string'
            ? req.body.provider.trim().toLowerCase()
            : 'auto';
        const wantsMercadoPago =
          preferredProvider === 'mercadopago' || preferredProvider === 'auto';
        const integration = wantsMercadoPago
          ? await storage.getPaymentIntegration(userId, 'mercadopago')
          : null;
        const mpConnected = Boolean(
          integration?.accessToken &&
            (integration?.status === 'connected' ||
              integration?.status === 'active')
        );

        let pixPayload = '';
        let qrCodeDataUrl = '';
        let pixKeyLabel = settings?.pixKey ? settings.pixKey.trim() : '';
        let provider = 'pix';
        let paymentId: string | null = null;

        if (wantsMercadoPago && mpConnected) {
          provider = 'mercadopago';
          pixKeyLabel = '';
        } else if (preferredProvider === 'mercadopago') {
          return res.status(400).json({
            message: 'Mercado Pago nao conectado.',
          });
        }

        if (provider === 'mercadopago') {
          try {
            const mpCharge = await createMercadoPagoPixCharge({
              userId,
              ticketRef: ticketRef || 'sem-id',
              externalReference: referenceId || ticketRef || 'sem-id',
              notificationUrl: notificationUrl || undefined,
              metadata: mpMetadata,
              amount,
              description: `Chamado ${ticketRef || 'sem-id'}`,
              client,
              user: context.user,
            });
            if (mpCharge?.pixPayload) {
              pixPayload = mpCharge.pixPayload;
              qrCodeDataUrl = mpCharge.qrCodeDataUrl;
              paymentId = mpCharge.paymentId || null;
            }
          } catch (error: any) {
            if (error?.code !== 'MISSING_CLIENT_DOCUMENT') {
              console.error('[MercadoPago] Falha ao gerar PIX:', error);
            }
          }
        }

        if (!pixPayload && provider === 'pix') {
          const pixKey = settings?.pixKey ? settings.pixKey.trim() : '';
          if (!pixKey) {
            return res.status(400).json({ message: 'PIX key not configured' });
          }

          const merchantName =
            settings?.pixAccountHolder?.trim() ||
            context.user?.companyName ||
            [context.user?.firstName, context.user?.lastName]
              .filter(Boolean)
              .join(' ') ||
            'RECEBEDOR';
          const merchantCity = context.user?.city || 'BRASIL';
          const txidBase = `TICKET${ticketRef}`.replace(/[^A-Za-z0-9]/g, '');
          pixPayload = buildPixPayload({
            pixKey,
            amount: amount > 0 ? amount : undefined,
            merchantName,
            merchantCity,
            txid: txidBase.slice(0, 25),
            description: `Chamado ${ticketRef || 'sem-id'}`,
          });
          qrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
            width: 240,
            margin: 1,
          });
          pixKeyLabel = pixKey;
        }

        const paymentUrl =
          provider === 'mercadopago' && referenceId
            ? buildPaymentLinkUrl(
                req,
                createPaymentLinkToken({
                  userId,
                  referenceId,
                  exp: Date.now() + PAYMENT_LINK_TTL_MS,
                })
              )
            : '';

        const baseMessage = buildPaymentMessage({
          clientName,
          ticketRef: ticketRef || 'sem-id',
          amount,
          dueDate,
          pixKey: pixKeyLabel,
          pixPayload,
          paymentUrl,
        });

        const customMessage =
          typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        const messageBody = customMessage || baseMessage;
        const messageHtml = messageBody
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p>${line}</p>`)
          .join('');

        const html = `
          <div style="font-family: Arial, sans-serif; color: #111827;">
            ${messageHtml}
            ${
              paymentUrl
                ? `<p><strong>Pagar online:</strong> <a href="${paymentUrl}">${paymentUrl}</a></p>`
                : ''
            }
            ${
              pixKeyLabel
                ? `<p><strong>Chave PIX:</strong> ${pixKeyLabel}</p>`
                : ''
            }
            ${
              pixPayload
                ? `<p><strong>Copia e cola:</strong></p>
            <p style="font-family: monospace; font-size: 12px; word-break: break-all;">${pixPayload}</p>`
                : ''
            }
            ${
              qrCodeDataUrl
                ? `<p><strong>QR Code PIX:</strong></p>
            <img src="${qrCodeDataUrl}" alt="QR Code PIX" style="width: 220px; height: 220px;" />`
                : ''
            }
          </div>
        `;

        const emailSubject = `Cobranca - Chamado ${ticketRef || 'sem-id'}`;
        const sendResult = await sendEmail({
          to: email,
          subject: emailSubject,
          html,
        });
        if (!sendResult.success) {
          return res.status(500).json({
            message: sendResult.error || 'Failed to send email',
          });
        }

        res.json({ success: true, provider, paymentId });
      } catch (error: any) {
        console.error(
          '[POST /api/tickets/:id/send-payment-link-email] Error:',
          error
        );
        res.status(500).json({
          message: error?.message || 'Failed to send payment email',
        });
      }
    }
  );

  app.get('/api/public/payment-links/:token', async (req: any, res) => {
    try {
      const token =
        typeof req.params?.token === 'string' ? req.params.token.trim() : '';
      if (!token) {
        return res.status(400).json({ message: 'Token invalido.' });
      }

      const payload = parsePaymentLinkToken(token);
      if (!payload) {
        return res
          .status(400)
          .json({ message: 'Link de pagamento invalido ou expirado.' });
      }

      const context = await resolvePaymentContext(
        payload.userId,
        payload.referenceId
      );
      if (context.error) {
        return res
          .status(context.error.status)
          .json({ message: context.error.message });
      }

      const ticket = context.ticket as any;
      const record = context.record as any;
      const client = context.client as any;
      const amount = coerceNumber(
        record?.amount ?? ticket?.totalAmount ?? ticket?.ticketValue ?? 0
      );
      const dueDateValue =
        record?.dueDate ?? ticket?.paymentDate ?? ticket?.dueDate ?? null;
      const dueDate = dueDateValue ? formatDate(dueDateValue) : null;
      const ticketRef =
        ticket?.ticketNumber ||
        ticket?.id?.slice(0, 8) ||
        record?.id?.slice(0, 8) ||
        '';
      const description =
        record?.description ||
        ticket?.description ||
        `Chamado ${ticketRef || 'sem-id'}`;

      const integration = await storage.getPaymentIntegration(
        payload.userId,
        'mercadopago'
      );
      const rawExpiresAt = integration?.tokenExpiresAt
        ? new Date(integration.tokenExpiresAt)
        : null;
      const isExpired = rawExpiresAt
        ? rawExpiresAt.getTime() <= Date.now() + 60_000
        : false;
      const mpConnected =
        !!integration?.accessToken &&
        !isExpired &&
        (integration?.status === 'connected' || integration?.status === 'active');

      res.json({
        tokenExpiresAt: new Date(payload.exp).toISOString(),
        ticketRef,
        amount,
        dueDate,
        description,
        recordStatus: record?.status || null,
        client: {
          name: client?.name || null,
          email: client?.email || null,
          document: client?.document || null,
          phone: client?.phone || null,
        },
        company: {
          name: context.user?.companyName || null,
          logoUrl: context.user?.companyLogoUrl || null,
        },
        mercadoPago: {
          connected: mpConnected,
          status: integration?.status || null,
          publicKey: integration?.publicKey || null,
        },
      });
    } catch (error) {
      console.error('[GET /api/public/payment-links/:token] Error:', error);
      res.status(500).json({
        message: 'Falha ao carregar o link de pagamento.',
      });
    }
  });

  app.post(
    '/api/public/payment-links/:token/mercadopago',
    async (req: any, res) => {
      try {
        const token =
          typeof req.params?.token === 'string' ? req.params.token.trim() : '';
        if (!token) {
          return res.status(400).json({ message: 'Token invalido.' });
        }

        const payload = parsePaymentLinkToken(token);
        if (!payload) {
          return res
            .status(400)
            .json({ message: 'Link de pagamento invalido ou expirado.' });
        }

        const context = await resolvePaymentContext(
          payload.userId,
          payload.referenceId
        );
        if (context.error) {
          return res
            .status(context.error.status)
            .json({ message: context.error.message });
        }

        const tokenInfo = await getMercadoPagoAccessToken(payload.userId);
        if (!tokenInfo?.accessToken) {
          return res
            .status(400)
            .json({ message: 'Mercado Pago nao conectado.' });
        }

        const ticket = context.ticket as any;
        const record = context.record as any;
        const client = context.client as any;

        const formData = req.body?.formData || req.body || {};
        const paymentMethodId =
          formData.payment_method_id ||
          formData.paymentMethodId ||
          formData.paymentMethod ||
          '';

        if (!paymentMethodId) {
          return res.status(400).json({
            message: 'Metodo de pagamento nao informado.',
          });
        }

        const amount = coerceNumber(
          formData.transaction_amount ??
            formData.transactionAmount ??
            record?.amount ??
            ticket?.totalAmount ??
            ticket?.ticketValue ??
            0
        );
        if (!amount || amount <= 0) {
          return res.status(400).json({
            message: 'Valor invalido para pagamento.',
          });
        }

        const ticketRef =
          ticket?.ticketNumber ||
          ticket?.id?.slice(0, 8) ||
          record?.id?.slice(0, 8) ||
          '';
        const description =
          record?.description ||
          ticket?.description ||
          `Chamado ${ticketRef || 'sem-id'}`;
        const referenceId =
          record?.id || ticket?.id || payload.referenceId || ticketRef || '';
        const webhookBaseUrl = (
          process.env.BASE_URL || getRequestBaseUrl(req)
        ).replace(/\/+$/, '');

        const payerFromForm = formData.payer || {};
        const payerEmail =
          payerFromForm.email ||
          formData.payer_email ||
          formData.email ||
          client?.email ||
          context.user?.email ||
          '';
        if (!payerEmail) {
          return res.status(400).json({
            message: 'Email do pagador obrigatorio.',
          });
        }

        const identificationFromForm =
          payerFromForm.identification || formData.identification || {};
        const documentNumber = normalizeDocumentValue(
          identificationFromForm.number ||
            identificationFromForm.value ||
            formData.document ||
            client?.document ||
            ''
        );
        const documentType =
          identificationFromForm.type ||
          (documentNumber.length === 11
            ? 'CPF'
            : documentNumber.length === 14
              ? 'CNPJ'
              : null);
        if (!documentType) {
          return res.status(400).json({
            message: 'CPF ou CNPJ do pagador obrigatorio.',
          });
        }

        const paymentPayload: Record<string, any> = {
          transaction_amount: amount,
          description,
          payment_method_id: paymentMethodId,
          external_reference: referenceId,
          payer: {
            email: payerEmail,
            identification: {
              type: documentType,
              number: documentNumber,
            },
          },
          metadata: {
            purpose: 'ticket',
            user_id: payload.userId,
            record_id: record?.id || null,
            ticket_id: ticket?.id || null,
            ticket_ref: ticketRef || null,
          },
        };

        const payerFullName =
          payerFromForm.first_name ||
          payerFromForm.firstName ||
          payerFromForm.name ||
          client?.name ||
          [context.user?.firstName, context.user?.lastName]
            .filter(Boolean)
            .join(' ') ||
          'Cliente';
        const nameParts = payerFullName.trim().split(/\s+/);
        paymentPayload.payer.first_name = nameParts.shift() || 'Cliente';
        paymentPayload.payer.last_name = nameParts.join(' ') || 'Cliente';

        if (formData.token) {
          paymentPayload.token = formData.token;
        }
        if (formData.issuer_id) {
          paymentPayload.issuer_id = formData.issuer_id;
        }
        if (formData.installments) {
          paymentPayload.installments = Number(formData.installments);
        }
        if (webhookBaseUrl) {
          paymentPayload.notification_url = `${webhookBaseUrl}/api/mercadopago/webhook?source=ticket&user_id=${encodeURIComponent(
            payload.userId
          )}&record_id=${encodeURIComponent(
            record?.id || ''
          )}&ticket_id=${encodeURIComponent(ticket?.id || '')}`;
        }

        const paymentData = await createMercadoPagoPayment(
          tokenInfo.accessToken,
          paymentPayload
        );

        const normalizedStatus = String(paymentData?.status || '');
        if (
          record &&
          (normalizedStatus === 'approved' || normalizedStatus === 'accredited')
        ) {
          const paidAt = new Date().toISOString();
          await storage.updateFinancialRecord(record.id, {
            status: 'paid',
            paidAt,
          });
          if (record.ticketId) {
            await storage.updateTicket(record.ticketId, {
              paymentDate: paidAt,
            });
          }
        }

        const transactionData =
          paymentData?.point_of_interaction?.transaction_data || {};
        const pixPayload = transactionData.qr_code || null;
        const qrCodeBase64 = transactionData.qr_code_base64 || '';
        const qrCodeDataUrl = qrCodeBase64
          ? `data:image/png;base64,${qrCodeBase64}`
          : null;

        res.json({
          status: paymentData?.status || null,
          statusDetail: paymentData?.status_detail || null,
          paymentId: paymentData?.id || null,
          pixPayload,
          qrCodeDataUrl,
        });
      } catch (error: any) {
        console.error(
          '[POST /api/public/payment-links/:token/mercadopago] Error:',
          error
        );
        res.status(500).json({
          message: error?.message || 'Falha ao processar pagamento.',
        });
      }
    }
  );

  app.post(
    '/api/tickets/:id/receive-payment',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const ticketOrRecordId =
          typeof req.params?.id === 'string' ? req.params.id.trim() : '';
        if (!ticketOrRecordId) {
          return res
            .status(400)
            .json({ message: 'Ticket id is required' });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const paidAtInput = req.body?.paidAt;
        let paidAtDate = new Date();
        if (typeof paidAtInput === 'string' && paidAtInput.trim() !== '') {
          const parsed = new Date(paidAtInput);
          if (!Number.isNaN(parsed.getTime())) {
            paidAtDate = parsed;
          }
        }
        const paidAt = paidAtDate.toISOString();

        const recordById = await storage.getFinancialRecord(ticketOrRecordId);
        if (recordById) {
          let allowed = recordById.userId === userId;
          if (!allowed && user.role === 'company') {
            const technicianIds = await loadCompanyTechnicians(userId);
            allowed = technicianIds.includes(recordById.userId);
          }
          if (!allowed) {
            return res.status(403).json({ message: 'Forbidden' });
          }

          const updatedRecord = await storage.updateFinancialRecord(
            recordById.id,
            { status: 'paid', paidAt }
          );
          if (!updatedRecord) {
            return res
              .status(500)
              .json({ message: 'Failed to receive payment' });
          }
          if (recordById.ticketId) {
            await storage.updateTicket(recordById.ticketId, {
              paymentDate: paidAt,
            });
          }
          return res.json(updatedRecord);
        }

        const access = await loadTicketWithAccess(userId, ticketOrRecordId);
        if (access.error) {
          return res
            .status(access.error.status)
            .json({ message: access.error.message });
        }

        const { ticket } = access;
        let records = await storage.getFinancialRecordsByUser(userId, {
          ticketId: ticket.id,
        });
        if (records.length === 0 && user.role === 'company') {
          records = await storage.getFinancialRecordsByUser(ticket.userId, {
            ticketId: ticket.id,
          });
        }

        let recordToUpdate = records[0];
        if (!recordToUpdate) {
          const toNumber = (value: any) => {
            if (value === null || value === undefined || value === '') return 0;
            if (typeof value === 'number') {
              return Number.isFinite(value) ? value : 0;
            }
            if (typeof value === 'string') {
              const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
              const parsed = Number.parseFloat(cleaned);
              return Number.isFinite(parsed) ? parsed : 0;
            }
            return 0;
          };
          const resolveDate = (value: any) => {
            if (!value) return undefined;
            const parsed = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(parsed.getTime())) return undefined;
            return parsed.toISOString();
          };
          const amount = toNumber(
            (ticket as any)?.totalAmount ?? ticket.ticketValue ?? 0
          );
          const dueDateValue =
            resolveDate(
              ticket.paymentDate ||
                ticket.dueDate ||
                ticket.completedAt ||
                ticket.stoppedAt ||
                ticket.scheduledDate ||
                ticket.createdAt
            ) || paidAt;
          if (!ticket.clientId) {
            return res
              .status(404)
              .json({ message: 'Client not found for ticket' });
          }
          recordToUpdate = await storage.createFinancialRecord({
            userId,
            ticketId: ticket.id,
            clientId: ticket.clientId,
            amount,
            type: 'receivable',
            status: 'pending',
            dueDate: dueDateValue,
            description: ticket.ticketNumber
              ? `Chamado #${ticket.ticketNumber}`
              : `Chamado ${ticket.id.slice(0, 8)}`,
          });
        }

        const updatedRecord = await storage.updateFinancialRecord(
          recordToUpdate.id,
          { status: 'paid', paidAt }
        );
        if (!updatedRecord) {
          return res
            .status(500)
            .json({ message: 'Failed to receive payment' });
        }
        await storage.updateTicket(ticket.id, { paymentDate: paidAt });
        res.json(updatedRecord);
      } catch (error) {
        console.error('[POST /api/tickets/:id/receive-payment] Error:', error);
        res
          .status(500)
          .json({ message: 'Failed to receive payment' });
      }
    }
  );

  app.get('/api/tickets/next-number', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const nextNumber = await storage.getNextTicketNumber(userId);
      res.json(nextNumber);
    } catch (error) {
      console.error('[GET /api/tickets/next-number] Error:', error);
      res.status(500).json({ message: 'Failed to get next ticket number' });
    }
  });

  app.get(
    '/api/tickets/available-slots',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { serviceId, startDate, endDate } = req.query;

        if (!startDate || !endDate) {
          return res.status(400).json({
            message: 'startDate and endDate are required',
          });
        }

        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            message: 'Invalid startDate or endDate',
          });
        }

        const resolvedServiceId =
          typeof serviceId === 'string' && serviceId.trim() !== ''
            ? serviceId
            : undefined;
        const slots = await getAvailableSlots(
          userId,
          resolvedServiceId,
          start,
          end,
          userId
        );
        res.json({ slots, count: slots.length });
      } catch (error) {
        console.error(
          '[GET /api/tickets/available-slots] Error fetching slots:',
          error
        );
        res.status(500).json({ message: 'Failed to fetch available slots' });
      }
    }
  );

  app.get('/api/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ticketId = req.params?.id;
      if (!ticketId) {
        return res.status(400).json({ message: 'Ticket id is required' });
      }

      const access = await loadTicketWithAccess(userId, ticketId);
      if (access.error) {
        return res.status(access.error.status).json({
          message: access.error.message,
        });
      }

      const { ticket } = access;
      const [client, service] = await Promise.all([
        storage.getClient(ticket.clientId),
        ticket.serviceId
          ? storage.getService(ticket.serviceId)
          : Promise.resolve(null),
      ]);
      const scheduledDateObj = new Date(ticket.scheduledDate);
      const scheduledDateIso = isNaN(scheduledDateObj.getTime())
        ? ''
        : scheduledDateObj.toISOString().split('T')[0];

      res.json({
        ...ticket,
        scheduledFor: scheduledDateIso
          ? `${scheduledDateIso}T${ticket.scheduledTime}`
          : '',
        client,
        service,
      });
    } catch (error) {
      console.error('[GET /api/tickets/:id] Error:', error);
      res.status(500).json({ message: 'Failed to fetch ticket' });
    }
  });

  app.get('/api/technicians', isAuthenticated, async (_req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const technicians = allUsers.filter(
        (u) => !u.role || u.role === 'technician'
      );
      res.json(technicians);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      res.status(500).json({ message: 'Failed to fetch technicians' });
    }
  });

  app.get(
    '/api/technicians/:technicianId/services',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { technicianId } = req.params;
        const services = await storage.getServicesByUser(technicianId);
        res.json(services);
      } catch (error) {
        console.error('Error fetching technician services:', error);
        res.status(500).json({ message: 'Failed to fetch services' });
      }
    }
  );

  app.get(
    '/api/technicians/:technicianId/available-slots',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { technicianId } = req.params;
        const { serviceId, startDate, endDate } = req.query;
        if (!serviceId || !startDate || !endDate) {
          return res.status(400).json({
            message: 'serviceId, startDate e endDate sao obrigatorios',
          });
        }
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const slots = await getAvailableSlots(
          technicianId,
          serviceId as string,
          start,
          end,
          technicianId
        );
        res.json({ slots });
      } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({ message: 'Failed to fetch available slots' });
      }
    }
  );

  app.get('/api/clients/current', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const clients = await storage.getClientsByUser(userId);
      const empresaClient = clients.find((c) => c.type === 'EMPRESA_PARCEIRA');
      if (!empresaClient) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(empresaClient);
    } catch (error) {
      console.error('Error fetching current client:', error);
      res.status(500).json({ message: 'Failed to fetch current client' });
    }
  });

  app.get('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.ensureDefaultService(userId);
      const activeOnly = req.query.active === 'true';
      const services = activeOnly
        ? await storage.getActiveServicesByUser(userId)
        : await storage.getServicesByUser(userId);
      res.json(services);
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({ message: 'Failed to fetch services' });
    }
  });

  app.get('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      if (service.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      res.json(service);
    } catch (error) {
      console.error('Error fetching service:', error);
      res.status(500).json({ message: 'Failed to fetch service' });
    }
  });

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cleanedData = {
        ...req.body,
        userId,
        price: req.body.price === '' ? undefined : req.body.price,
        duration: req.body.duration === '' ? undefined : req.body.duration,
      };
      const validatedData = insertServiceSchema.parse(cleanedData);
      const service = await storage.createService(validatedData);
      res.status(201).json(service);
    } catch (error) {
      console.error('Error creating service:', error);
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: 'Failed to create service' });
    }
  });

  app.put('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      if (service.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const cleanedData = {
        ...req.body,
        price: req.body.price === '' ? undefined : req.body.price,
        duration: req.body.duration === '' ? undefined : req.body.duration,
      };
      const validatedData = insertServiceSchema
        .omit({ userId: true })
        .partial()
        .parse(cleanedData);
      const updatedService = await storage.updateService(
        req.params.id,
        // validatedData
      );
      res.json(updatedService);
    } catch (error) {
      console.error('Error updating service:', error);
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: 'Failed to update service' });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
      if (service.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting service:', error);
      res.status(500).json({ message: 'Failed to delete service' });
    }
  });

  // Service Order Templates (RAT/OS)
  app.post(
    '/api/service-order-templates/backgrounds',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const dataUrl =
          typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
        if (!dataUrl) {
          return res.status(400).json({ message: 'dataUrl is required' });
        }

        const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
          return res
            .status(400)
            .json({ message: 'Invalid data URL for background.' });
        }

        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1] || 'png';
        const timestamp = Date.now();
        const safeFileName = normalizeUploadFileName(
          req.body?.fileName,
          `background-${timestamp}`,
          extension
        );

        const bucketName = await ensureServiceOrderBackgroundBucket();
        const filePath = `${userId}/${timestamp}-${safeFileName}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage.from(bucketName).upload(filePath, buffer, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          console.error(
            '[POST /api/service-order-templates/backgrounds] Upload error:',
            uploadError
          );
          return res
            .status(500)
            .json({ message: 'Failed to upload background image' });
        }

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        res.json({
          url: urlData.publicUrl,
          path: uploadData?.path || filePath,
        });
      } catch (error: any) {
        console.error(
          '[POST /api/service-order-templates/backgrounds] Error:',
          error
        );
        res.status(500).json({
          message: 'Failed to upload background image',
          error: error?.message || String(error),
        });
      }
    }
  );

  app.post(
    '/api/service-order-templates/logos',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const dataUrl =
          typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
        const componentId =
          typeof req.body?.componentId === 'string'
            ? req.body.componentId.trim()
            : '';
        const templateId =
          typeof req.body?.templateId === 'string'
            ? req.body.templateId.trim()
            : '';

        if (!dataUrl) {
          return res.status(400).json({ message: 'dataUrl is required' });
        }

        const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
          return res
            .status(400)
            .json({ message: 'Invalid data URL for logo.' });
        }

        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1] || 'png';
        const timestamp = Date.now();
        const safeFileName = normalizeUploadFileName(
          req.body?.fileName,
          `logo-${timestamp}`,
          extension
        );

        const bucketName = await ensureServiceOrderLogoBucket();
        const filePath = `${userId}/${timestamp}-${safeFileName}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage.from(bucketName).upload(filePath, buffer, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          console.error(
            '[POST /api/service-order-templates/logos] Upload error:',
            uploadError
          );
          return res
            .status(500)
            .json({ message: 'Failed to upload logo image' });
        }

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        let assetId: string | null = null;
        if (componentId) {
          const { data: assetData, error: assetError } = await supabase
            .from('service_order_template_assets')
            .insert({
              company_id: userId,
              template_id: templateId || null,
              component_id: componentId,
              asset_type: 'logo',
              file_name: safeFileName,
              storage_path: uploadData?.path || filePath,
              public_url: urlData.publicUrl,
            })
            .select('id')
            .single();

          if (assetError) {
            console.error(
              '[POST /api/service-order-templates/logos] Asset insert error:',
              assetError
            );
          } else {
            assetId = assetData?.id || null;
          }
        }

        res.json({
          url: urlData.publicUrl,
          path: uploadData?.path || filePath,
          assetId,
        });
      } catch (error: any) {
        console.error(
          '[POST /api/service-order-templates/logos] Error:',
          error
        );
        res.status(500).json({
          message: 'Failed to upload logo image',
          error: error?.message || String(error),
        });
      }
    }
  );

  app.get('/api/service-order-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const clientId =
        typeof req.query?.clientId === 'string' ? req.query.clientId : '';
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const templates = await storage.getServiceOrderTemplatesByCompany(userId);
      const publishedTemplates = templates.filter(
        (template) => !isServiceOrderDraftTemplate(template.template)
      );
      const filteredTemplates = clientId
        ? publishedTemplates.filter((template) => template.clientId === clientId)
        : publishedTemplates;
      res.json(filteredTemplates);
    } catch (error) {
      console.error(
        '[GET /api/service-order-templates] Error fetching templates:',
        error
      );
      res
        .status(500)
        .json({ message: 'Failed to fetch service order templates' });
    }
  });

  app.post('/api/service-order-templates/draft', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rawName =
        typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const clientId =
        typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
      const templateName = rawName;
      if (!templateName) {
        return res.status(400).json({ message: 'Name is required' });
      }
      if (clientId) {
        const client = await storage.getClient(clientId);
        if (!client || client.userId !== userId) {
          return res.status(404).json({ message: 'Client not found' });
        }
        if (client.type !== 'EMPRESA_PARCEIRA') {
          return res.status(400).json({
            message: 'Templates so podem ser criados para empresa parceira.',
          });
        }
      }
      const templatePayload = req.body?.template;
      if (
        !templatePayload ||
        typeof templatePayload !== 'object' ||
        Array.isArray(templatePayload)
      ) {
        return res.status(400).json({ message: 'Template payload is required' });
      }

      const draftTimestamp = new Date().toISOString();
      const draftTemplate = {
        ...(templatePayload as Record<string, unknown>),
        __draft: true,
        __draftUpdatedAt: draftTimestamp,
        draft: true,
        draftUpdatedAt: draftTimestamp,
      };

      const existingTemplates =
        await storage.getServiceOrderTemplatesByCompany(userId);
      const existingDraft = existingTemplates.find(
        (template) =>
          isServiceOrderDraftTemplate(template.template) &&
          (clientId
            ? template.clientId === clientId
            : !template.clientId && template.name === templateName)
      );

      if (existingDraft) {
        const updated = await storage.updateServiceOrderTemplate(
          existingDraft.id,
          {
            name: templateName,
            clientId: clientId || null,
            template: draftTemplate,
            isDefault: false,
          }
        );
        return res.json(updated || existingDraft);
      }

      const validatedData = insertServiceOrderTemplateSchema.parse({
        companyId: userId,
        clientId: clientId || null,
        name: templateName,
        template: draftTemplate,
        isDefault: false,
      });
      const created = await storage.createServiceOrderTemplate(validatedData);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      console.error(
        '[POST /api/service-order-templates/draft] Error:',
        error
      );
      res.status(500).json({
        message: 'Failed to save service order template draft',
        error: error?.message || String(error),
      });
    }
  });

  app.post('/api/service-order-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rawName =
        typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const clientId =
        typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
      const templateId =
        typeof req.body?.templateId === 'string'
          ? req.body.templateId.trim()
          : '';
      if (!rawName) {
        return res.status(400).json({ message: 'Name is required' });
      }
      const templateName = rawName;
      if (clientId) {
        const client = await storage.getClient(clientId);
        if (!client || client.userId !== userId) {
          return res.status(404).json({ message: 'Client not found' });
        }
        if (client.type !== 'EMPRESA_PARCEIRA') {
          return res.status(400).json({
            message: 'Templates so podem ser criados para empresa parceira.',
          });
        }
      }
      const templatePayload = req.body?.template;
      if (
        !templatePayload ||
        typeof templatePayload !== 'object' ||
        Array.isArray(templatePayload)
      ) {
        return res.status(400).json({ message: 'Template payload is required' });
      }

      const normalizedTemplate = { ...(templatePayload as Record<string, unknown>) };
      delete (normalizedTemplate as any).__draft;
      delete (normalizedTemplate as any).__draftUpdatedAt;
      delete (normalizedTemplate as any)._Draft;
      delete (normalizedTemplate as any)._DraftUpdatedAt;
      delete (normalizedTemplate as any).draft;
      delete (normalizedTemplate as any).draftUpdatedAt;

      if (templateId) {
        const existing = await storage.getServiceOrderTemplate(templateId);
        if (!existing || existing.companyId !== userId) {
          return res.status(404).json({ message: 'Template not found' });
        }
        const previousClientId = existing.clientId || null;
        const updated = await storage.updateServiceOrderTemplate(existing.id, {
          name: templateName,
          clientId: clientId || null,
          template: normalizedTemplate,
          isDefault: false,
        });
        if (updated) {
          if (previousClientId && previousClientId !== clientId) {
            const previousClient = await storage.getClient(previousClientId);
            if (previousClient && previousClient.userId === userId) {
              if (previousClient.ratTemplateId === existing.id) {
                await storage.updateClient(previousClientId, {
                  ratTemplateId: null,
                });
              }
            }
          }
          if (clientId) {
            await storage.updateClient(clientId, {
              ratTemplateId: updated.id,
            });
          }
          return res.json(updated);
        }
      }

      const existingTemplates =
        await storage.getServiceOrderTemplatesByCompany(userId);
      const existingForClient = clientId
        ? existingTemplates.find(
            (template) =>
              !isServiceOrderDraftTemplate(template.template) &&
              template.clientId === clientId
          )
        : undefined;
      if (existingForClient) {
        const updated = await storage.updateServiceOrderTemplate(
          existingForClient.id,
          {
            name: templateName,
            clientId,
            template: normalizedTemplate,
            isDefault: false,
          }
        );
        if (updated) {
          if (clientId) {
            await storage.updateClient(clientId, {
              ratTemplateId: updated.id,
            });
          }
          return res.json(updated);
        }
      }

      const existingForName = !clientId
        ? existingTemplates.find(
            (template) =>
              !isServiceOrderDraftTemplate(template.template) &&
              !template.clientId &&
              template.name === templateName
          )
        : undefined;
      if (existingForName) {
        const updated = await storage.updateServiceOrderTemplate(
          existingForName.id,
          {
            name: templateName,
            clientId: null,
            template: normalizedTemplate,
            isDefault: false,
          }
        );
        if (updated) {
          return res.json(updated);
        }
      }

      const existingDraft = existingTemplates.find(
        (template) =>
          isServiceOrderDraftTemplate(template.template) &&
          (clientId ? template.clientId === clientId : !template.clientId) &&
          (clientId ? true : template.name === templateName)
      );

      if (existingDraft) {
        const updated = await storage.updateServiceOrderTemplate(
          existingDraft.id,
          {
            name: templateName,
            clientId: clientId || null,
            template: normalizedTemplate,
            isDefault: false,
          }
        );
        if (updated) {
          if (clientId) {
            await storage.updateClient(clientId, {
              ratTemplateId: updated.id,
            });
          }
          return res.json(updated);
        }
      }

      const validatedData = insertServiceOrderTemplateSchema.parse({
        companyId: userId,
        clientId: clientId || null,
        name: templateName,
        template: normalizedTemplate,
        isDefault: false,
      });
      const created = await storage.createServiceOrderTemplate(validatedData);
      if (clientId) {
        await storage.updateClient(clientId, {
          ratTemplateId: created.id,
        });
      }
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      console.error(
        '[POST /api/service-order-templates] Error:',
        error
      );
      res.status(500).json({
        message: 'Failed to create service order template',
        error: error?.message || String(error),
      });
    }
  });

  app.delete(
    '/api/service-order-templates/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const templateId =
          typeof req.params?.id === 'string' ? req.params.id.trim() : '';
        if (!templateId) {
          return res.status(400).json({ message: 'Template id is required' });
        }

        const existing = await storage.getServiceOrderTemplate(templateId);
        if (!existing || existing.companyId !== userId) {
          return res.status(404).json({ message: 'Template not found' });
        }

        const deleted = await storage.deleteServiceOrderTemplate(templateId);
        if (!deleted) {
          return res.status(500).json({ message: 'Failed to delete template' });
        }

        if (existing.clientId) {
          const client = await storage.getClient(existing.clientId);
          if (client && client.userId === userId) {
            if (client.ratTemplateId === existing.id) {
              await storage.updateClient(existing.clientId, {
                ratTemplateId: null,
              });
            }
          }
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error(
          '[DELETE /api/service-order-templates/:id] Error:',
          error
        );
        res.status(500).json({
          message: 'Failed to delete service order template',
          error: error?.message || String(error),
        });
      }
    }
  );



  app.get(
    '/api/service-orders/by-ticket/:ticketId',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const ticketId =
          typeof req.params?.ticketId === 'string'
            ? req.params.ticketId.trim()
            : '';
        if (!ticketId) {
          return res.status(400).json({ message: 'Ticket id is required' });
        }

        const access = await loadTicketWithAccess(userId, ticketId);
        if (access.error) {
          return res
            .status(access.error.status)
            .json({ message: access.error.message });
        }

        const order = await storage.getServiceOrderByTicket(ticketId);
        if (!order) {
          return res
            .status(404)
            .json({ message: 'Service order not found' });
        }

        res.json(order);
      } catch (error) {
        console.error('[GET /api/service-orders/by-ticket] Error:', error);
        res.status(500).json({ message: 'Failed to fetch service order' });
      }
    }
  );

  app.post(
    '/api/service-orders/by-ticket/:ticketId',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const ticketId =
          typeof req.params?.ticketId === 'string'
            ? req.params.ticketId.trim()
            : '';
        if (!ticketId) {
          return res.status(400).json({ message: 'Ticket id is required' });
        }

        const access = await loadTicketWithAccess(userId, ticketId);
        if (access.error) {
          return res
            .status(access.error.status)
            .json({ message: access.error.message });
        }

        const ticket = access.ticket;
        const [client, service, companyUser] = await Promise.all([
          storage.getClient(ticket.clientId),
          ticket.serviceId
            ? storage.getService(ticket.serviceId)
            : Promise.resolve(null),
          storage.getUser(ticket.userId),
        ]);

        if (!client) {
          return res.status(404).json({ message: 'Client not found' });
        }
        if (!companyUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        const templateId = ticket.serviceOrderTemplateId || client.ratTemplateId;
        if (!templateId) {
          return res.status(400).json({
            message: 'Nenhum template de RAT vinculado a este chamado.',
          });
        }

        const template = await storage.getServiceOrderTemplate(templateId);
        if (!template) {
          return res
            .status(404)
            .json({ message: 'Template de RAT nao encontrado.' });
        }

        const arrivalTime =
          typeof req.body?.arrivalTime === 'string'
            ? req.body.arrivalTime
            : undefined;
        const completedAt =
          typeof req.body?.completedAt === 'string'
            ? req.body.completedAt
            : undefined;

        const bindings = buildServiceOrderBindings({
          ticket,
          client,
          company: companyUser,
          service,
          arrivalTime,
          completedAt,
        });
        const initialFieldValues = buildServiceOrderFieldValues(
          template.template,
          bindings
        );

        const existing = await storage.getServiceOrderByTicket(ticketId);
        if (existing) {
          const merged = { ...(existing.fieldValues || {}) } as Record<
            string,
            any
          >;
          Object.entries(initialFieldValues).forEach(([key, value]) => {
            if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
              merged[key] = value;
            }
          });

          const updatePayload: any = {
            fieldValues: merged,
          };

          if (!existing.templateSnapshot) {
            updatePayload.templateSnapshot = template.template;
            updatePayload.templateId = templateId;
          }

          const updated = await storage.updateServiceOrder(
            existing.id,
            updatePayload
          );
          return res.json(updated || { ...existing, fieldValues: merged });
        }

        const validatedData = insertServiceOrderSchema.parse({
          companyId: ticket.userId,
          clientId: ticket.clientId,
          ticketId: ticket.id,
          templateId,
          templateSnapshot: template.template,
          fieldValues: initialFieldValues,
          status: 'draft',
        });
        const created = await storage.createServiceOrder(validatedData);
        return res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof ZodError) {
          const message = fromZodError(error).message;
          return res.status(400).json({ message });
        }
        console.error('[POST /api/service-orders/by-ticket] Error:', error);
        res.status(500).json({
          message: 'Failed to create service order',
          error: error?.message || String(error),
        });
      }
    }
  );

  app.get('/api/service-orders/public/:token', async (req: any, res) => {
    try {
      const token =
        typeof req.params?.token === 'string' ? req.params.token.trim() : '';
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const order = await storage.getServiceOrderByPublicToken(token);
      if (!order) {
        return res
          .status(404)
          .json({ message: 'Service order not found' });
      }

      const [companyUser, client] = await Promise.all([
        storage.getUser(order.companyId),
        storage.getClient(order.clientId),
      ]);

      const companyAddress = companyUser
        ? buildAddress([
            companyUser.streetAddress,
            companyUser.addressNumber,
            companyUser.neighborhood,
            companyUser.city,
            companyUser.state,
          ]) || ''
        : '';

      res.json({
        order,
        company: companyUser
          ? {
              companyName:
                companyUser.companyName ||
                [companyUser.firstName, companyUser.lastName]
                  .filter(Boolean)
                  .join(' '),
              companyLogoUrl: companyUser.companyLogoUrl,
              phone: companyUser.phone,
              address: companyAddress,
              city: companyUser.city,
              state: companyUser.state,
            }
          : null,
        client: client
          ? {
              name: client.name,
              document: client.document,
              email: client.email,
              phone: client.phone,
            }
          : null,
      });
    } catch (error) {
      console.error('[GET /api/service-orders/public] Error:', error);
      res.status(500).json({ message: 'Failed to fetch service order' });
    }
  });

  app.post('/api/service-orders/public/:token/sign', async (req: any, res) => {
    try {
      const token =
        typeof req.params?.token === 'string' ? req.params.token.trim() : '';
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const order = await storage.getServiceOrderByPublicToken(token);
      if (!order) {
        return res
          .status(404)
          .json({ message: 'Service order not found' });
      }

      const incomingFieldValues =
        req.body?.fieldValues && typeof req.body.fieldValues === 'object'
          ? req.body.fieldValues
          : {};

      const normalizeSignature = (value: any) =>
        typeof value === 'string' && value.trim() !== '' ? value : null;

      const signatureData = normalizeSignature(req.body?.signatureData);
      const signedBy =
        typeof req.body?.signedBy === 'string'
          ? req.body.signedBy.trim()
          : null;
      const technicianSignatureData = normalizeSignature(
        req.body?.technicianSignatureData
      );
      const technicianSignedBy =
        typeof req.body?.technicianSignedBy === 'string'
          ? req.body.technicianSignedBy.trim()
          : null;
      const clientSignatureData = normalizeSignature(
        req.body?.clientSignatureData
      );
      const clientSignedBy =
        typeof req.body?.clientSignedBy === 'string'
          ? req.body.clientSignedBy.trim()
          : null;

      const mergedFieldValues = {
        ...(order.fieldValues || {}),
        ...incomingFieldValues,
      };

      const updates: any = { fieldValues: mergedFieldValues };
      const now = new Date().toISOString();

      if (technicianSignatureData) {
        updates.technicianSignatureData = technicianSignatureData;
        updates.technicianSignedBy = technicianSignedBy || null;
        updates.technicianSignedAt = now;
      }
      if (clientSignatureData) {
        updates.clientSignatureData = clientSignatureData;
        updates.clientSignedBy = clientSignedBy || null;
        updates.clientSignedAt = now;
      }

      if (signatureData) {
        updates.signatureData = signatureData;
        updates.signedBy = signedBy || null;
        updates.signedAt = now;
      }

      if (!clientSignatureData && signatureData) {
        updates.clientSignatureData = updates.clientSignatureData || signatureData;
        updates.clientSignedBy = updates.clientSignedBy || signedBy || null;
        updates.clientSignedAt = updates.clientSignedAt || now;
      }

      if (!signatureData && clientSignatureData) {
        updates.signatureData = clientSignatureData;
        updates.signedBy = clientSignedBy || null;
        updates.signedAt = now;
      }

      const resolvedTech =
        technicianSignatureData || order.technicianSignatureData;
      const resolvedClient =
        clientSignatureData ||
        order.clientSignatureData ||
        signatureData ||
        order.signatureData;

      if (resolvedTech || resolvedClient) {
        updates.status =
          resolvedTech && resolvedClient ? 'signed' : 'partial';
      }

      const updated = await storage.updateServiceOrder(order.id, updates);
      res.json(updated || { ...order, ...updates });
    } catch (error) {
      console.error('[POST /api/service-orders/public/sign] Error:', error);
      res.status(500).json({ message: 'Failed to sign service order' });
    }
  });

  // Login Master Admin - Verifica no banco de dados e cria se não existir
  app.post('/api/auth/master-admin/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email e senha são obrigatórios' });
      }

      // Credenciais padrão do primeiro master admin
      const DEFAULT_MASTER_EMAIL = 'master@master.com';
      const DEFAULT_MASTER_PASSWORD = 'master@123';

      // Normalizar email para lowercase (case-insensitive)
      const normalizedEmail = email.toLowerCase().trim();

      // Buscar usuário no banco de dados
      // Tentar com email original e com email+super_admin
      let masterUser = await storage.getUserByEmail(normalizedEmail);

      // Se não encontrou, tentar com email+super_admin
      if (!masterUser) {
        const emailParts = normalizedEmail.split('@');
        const uniqueEmail = `${emailParts[0]}+super_admin@${emailParts[1]}`;
        masterUser = await storage.getUserByEmail(uniqueEmail);
      }

      // Se não existe, retornar erro (não criar automaticamente no login)
      // O master admin deve ser criado na inicialização do servidor

      // Verificar se o usuário existe e \u00e9 super_admin
      if (!masterUser || masterUser.role !== 'super_admin') {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Buscar credenciais do usuário
      const { data: credentials, error: credError } = await supabase
        .from('user_credentials')
        .select('password_hash')
        .eq('user_id', masterUser.id)
        .single();

      if (credError || !credentials || !credentials.password_hash) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Verificar senha
      const [salt, storedHash] = credentials.password_hash.split(':');
      const passwordHash = pbkdf2Sync(
        password,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');

      if (passwordHash !== storedHash) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Criar sessão
      req.session.user = {
        id: masterUser.id,
        email: masterUser.email,
        firstName: masterUser.firstName,
        lastName: masterUser.lastName,
        role: masterUser.role,
      };

      res.json({
        message: 'Login realizado com sucesso',
        user: masterUser,
      });
    } catch (error: any) {
      console.error('Error in master admin login:', error);
      res
        .status(500)
        .json({ message: 'Erro ao fazer login', error: error.message });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const sessionUser = req.session?.user;
      const isProfile = (sessionUser as any)?.isProfile === true;
      const profileRole = (sessionUser as any)?.role;
      const profileId = (sessionUser as any)?.profileId;

      let user = await storage.getUser(userId);

      if (!user) {
        console.error(
          '[GET /api/auth/user] Usuário não encontrado:',
          userId
        );
        return res.status(404).json({ message: 'User not found' });
      }

      const baseUserRole = (user as any)?.role;

      // Se for um perfil, usar o role do perfil em vez do role da empresa
      if (isProfile && profileRole) {
        user = {
          ...user,
          role: profileRole, // 'operational' ou 'financial'
        };
      }

      // Sincronizar companyName/publicSlug com company_data (migra\u00e7\u00e3o para nova página)
      try {
        const { data: companyData } = await supabase
          .from('company_data')
          .select('company_name')
          .eq('user_id', userId)
          .maybeSingle();

        const companyNameFromCompanyData = companyData?.company_name?.trim();
        const companyNameChanged =
          companyNameFromCompanyData &&
          companyNameFromCompanyData !== (user.companyName || '').trim();

        if (companyNameChanged) {
          const roleForSync = ((user.role as
            | 'technician'
            | 'company'
            | 'super_admin'
            | null) || 'technician') as
            | 'technician'
            | 'company'
            | 'super_admin';

          const updatedUser = await storage.upsertUser({
            id: userId,
            email: user.email,
            role: roleForSync,
            companyName: companyNameFromCompanyData,
            companyLogoUrl: user.companyLogoUrl,
            profileImageUrl: user.profileImageUrl,
            // profileCompleted e emailConfirmed não estão no schema, remover
            publicSlug: user.publicSlug,
          });

          user = updatedUser;

          // Atualizar sessão com dados sincronizados
          req.session.user = {
            ...req.session.user,
            companyName: updatedUser.companyName,
            publicSlug: updatedUser.publicSlug,
          };
        }
      } catch (syncError: any) {
        console.error(
          '[GET /api/auth/user] Erro ao sincronizar companyName/publicSlug com company_data:',
          syncError
        );
        // Não bloquear a resposta; apenas logar para investigação
      }

      // Retornar email original (sem sufixo +role) para o frontend
      const userEmail = user.email || '';
      const emailParts = userEmail.split('+');
      const originalEmail =
        emailParts.length > 1
          ? `${emailParts[0]}@${userEmail.split('@')[1]}`
          : userEmail;

      // Verificar se existe senha local (provider=email)
      let requirePassword = false;
      try {
        const { data: credRows, error: credError } = await supabase
          .from('user_credentials')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'email')
          .limit(1);

        if (credError) {
          console.error(
            '[GET /api/auth/user] Erro ao checar credenciais de email:',
            credError
          );
        }

        requirePassword = !(credRows && credRows.length > 0);
        (req.session as any).requirePassword = requirePassword;
      } catch (credCheckError) {
        console.error(
          '[GET /api/auth/user] Erro inesperado ao checar credenciais:',
          credCheckError
        );
      }

      const {
        planStatus,
        trialEndsAt,
        trialDaysLeft,
        trialDeleteAt,
      } = await resolvePlanStatusForUser(user, baseUserRole);

      const planType: 'tech' = 'tech';

      // Verificar emailConfirmed do usuário
      const emailConfirmed =
        (user as any)?.emailConfirmed ??
        (user as any)?.email_confirmed ??
        false;

      const responseData = {
        ...user,
        email: originalEmail,
        requirePassword,
        emailConfirmed, // Incluir status de confirmação de email
        // asaasCustomerId removido - será implementado Stripe Connect
        // Sempre incluir isProfile e profileId, mesmo que sejam false/undefined
        isProfile: isProfile === true ? true : undefined,
        profileId: profileId || undefined,
        // Dados de plano/trial
        planType,
        planStatus,
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : undefined,
        trialDeleteAt: trialDeleteAt ? trialDeleteAt.toISOString() : undefined,
        trialDaysLeft,
        // Dados de endereço
        zipCode: (user as any).zipCode,
        streetAddress: (user as any).streetAddress,
        addressNumber: (user as any).addressNumber,
        addressComplement: (user as any).addressComplement,
        neighborhood: (user as any).neighborhood,
        city: (user as any).city,
        state: (user as any).state,
        phone: (user as any).phone,
        birthDate: (user as any).birthDate,
        companyName: (user as any).companyName,
        sessionUser: {
          isProfile: (req.session?.user as any)?.isProfile,
          role: (req.session?.user as any)?.role,
          profileId: (req.session?.user as any)?.profileId,
        },
      };

      res.json(responseData);
    } catch (error) {
      console.error('[GET /api/auth/user] Erro ao buscar usuário:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Registro de usuário (email/senha)
  app.post('/api/auth/register', async (req: any, res) => {
    try {
      // Garantir que sempre retornamos JSON
      res.setHeader('Content-Type', 'application/json');

      const {
        email,
        password,
        userType,
        firstName,
        lastName,
        companyName,
        phone,
        cpf,
        cnpj,
      } = req.body;

      // Validação básica
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email e senha são obrigatórios' });
      }

      // Normalizar email para lowercase (case-insensitive)
      const normalizedEmail = email.toLowerCase().trim();

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Email inválido' });
      }

      // Validar senha (mínimo 6 caracteres)
      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: 'Senha deve ter no mínimo 6 caracteres' });
      }

      const trimmedCompanyName =
        typeof companyName === 'string' ? companyName.trim() : '';
      const normalizedPhone =
        typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
      const incomingCpf = cpf ? normalizeDocumentValue(cpf) : '';
      const incomingCnpj = cnpj ? normalizeDocumentValue(cnpj) : '';

      if (!trimmedCompanyName) {
        return res
          .status(400)
          .json({ message: 'Nome da empresa ? obrigat?rio' });
      }

      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res
          .status(400)
          .json({ message: 'Telefone com DDD ? obrigat?rio' });
      }

      if (!incomingCpf && !incomingCnpj) {
        return res
          .status(400)
          .json({ message: 'CPF ou CNPJ s?o obrigat?rios' });
      }

      if (incomingCpf && incomingCnpj) {
        return res.status(400).json({
          message: 'Informe apenas um documento (CPF ou CNPJ).',
        });
      }

      // Normalizar userType para determinar role
      const normalizedUserType = (userType || '').toLowerCase();
      const role =
        normalizedUserType === 'empresa' || normalizedUserType === 'company'
          ? 'empresa' // Usar novo formato (empresa ao invés de company)
          : 'tech'; // Usar novo formato (tech ao invés de technician)

      // Verificar se usuário já existe - buscar por email normalizado (sem +role)
      // CRÍTICO: Verificar se email já existe independente do provider (Google ou email/senha)
      let existingUser;
      let isGoogleAccount = false;
      try {
        if (incomingCpf) {
          const existingByCpf = await findUserByDocument(incomingCpf, 'cpf');
          if (existingByCpf) {
            return res.status(409).json({
              message: 'CPF ja cadastrado em outra conta.',
              code: 'CPF_ALREADY_USED',
            });
          }
        }

        if (incomingCnpj) {
          const existingByCnpj = await findUserByDocument(incomingCnpj, 'cnpj');
          if (existingByCnpj) {
            return res.status(409).json({
              message: 'CNPJ ja cadastrado em outra conta.',
              code: 'CNPJ_ALREADY_USED',
            });
          }
        }

        // Primeiro: buscar por email normalizado (sem considerar +role)
        // Isso pega contas Google que não têm o formato email+role@domain.com
        const userByEmail = await storage.getUserByEmail(normalizedEmail);
        if (userByEmail) {
          existingUser = userByEmail;
          // Verificar se \u00e9 conta Google (não tem credenciais de email)
          const { data: credRows } = await supabase
            .from('user_credentials')
            .select('id, provider')
            .eq('user_id', userByEmail.id)
            .eq('provider', 'email')
            .limit(1);

          // Se não tem credenciais de email, \u00e9 conta Google
          isGoogleAccount = !(credRows && credRows.length > 0);
        }

        // Se não encontrou pelo email normalizado, verificar com +role (contas email/senha antigas)
        if (!existingUser) {
          // Tentar buscar com role novo primeiro
          existingUser = await storage.getUserByEmailAndRole(
            normalizedEmail,
            role as any
          );

          // Se não encontrou, tentar com role antigo (compatibilidade)
          if (!existingUser) {
            const oldRole = role === 'empresa' ? 'company' : 'technician';
            existingUser = await storage.getUserByEmailAndRole(
              normalizedEmail,
              oldRole as any
            );
          }

          // Verificar também pelo email único que será criado
          if (!existingUser) {
            const emailWithRole = `${normalizedEmail.split('@')[0]}+${role}@${
              normalizedEmail.split('@')[1]
            }`;
            const userByUniqueEmail = await storage.getUserByEmail(
              emailWithRole
            );
            if (userByUniqueEmail) {
              existingUser = userByUniqueEmail;
            }
          }
        }

        if (existingUser) {
          // Se for conta Google, retornar erro específico com email para redirecionar
          if (isGoogleAccount) {
            return res.status(409).json({
              message:
                'Este email já está cadastrado via Google. Faça login com Google.',
              code: 'EMAIL_EXISTS_GOOGLE',
              provider: 'google',
              email: normalizedEmail, // Incluir email para redirecionar OAuth
            });
          }

          // Se for conta email/senha, retornar erro genérico com email para autocompletar
          return res.status(409).json({
            message: 'Este email já está cadastrado. Faça login.',
            code: 'EMAIL_EXISTS',
            provider: 'email',
            email: normalizedEmail, // Incluir email para autocompletar no login
          });
        }
      } catch (error: any) {
        console.error('[REGISTER] Erro ao verificar usuário existente:', {
          error: error,
          message: error?.message,
          stack: error?.stack,
        });
        // Continuar mesmo se houver erro na verificação
      }

      const trialDeviceId = getTrialDeviceId(req);
      const trialIp = getRequestIp(req);
      if (trialDeviceId || trialIp) {
        const existingTrialUser = await findTrialUserByDeviceOrIp(
          trialDeviceId,
          trialIp
        );
        if (existingTrialUser) {
          return res.status(403).json({
            message: 'Trial ja utilizado neste dispositivo ou rede.',
            code: 'TRIAL_ALREADY_USED',
          });
        }
      }

      // Hash da senha usando PBKDF2 (nativo do Node.js)
      const salt = randomBytes(16).toString('hex');
      const passwordHash = pbkdf2Sync(
        password,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const fullHash = `${salt}:${passwordHash}`;

      // Criar usuário
      const userId = randomUUID();

      // Como o email \u00e9 unique no banco, precisamos criar um email único para cada role
      // Usaremos um email "interno" que inclui o role, mas mantemos o email original para login
      // Formato: email+role@domain.com -> email+technician@domain.com
      // Sempre usar email normalizado (lowercase) para garantir consistência
      const emailParts = normalizedEmail.split('@');
      if (emailParts.length !== 2) {
        return res.status(400).json({ message: 'Email inválido' });
      }
      const uniqueEmail = `${emailParts[0]}+${role}@${emailParts[1]}`;

      // Preparar dados do usuário
      const userData = {
        id: userId,
        email: uniqueEmail, // Usar email único no banco
        firstName: firstName || emailParts[0] || 'Usuário',
        lastName: lastName || '',
        companyName: trimmedCompanyName,
        phone: normalizedPhone,
        cpf: incomingCpf || null,
        cnpj: incomingCnpj || null,
        role: role as any, // Usar role no novo formato (tech/empresa)
        trialDeviceId: trialDeviceId || null,
        trialIp: trialIp || null,
        trialClaimedAt: new Date().toISOString(),
      };

      // Validar com Zod antes de inserir (opcional - pode pular se schema não suportar novos roles)
      try {
        const { upsertUserSchema } = await import('@shared/schema');
        if (upsertUserSchema) {
          upsertUserSchema.parse(userData);
        }
      } catch (validationError: any) {
        // Tratar erro de validação de forma segura
        const errorMessage =
          validationError?.message || 'Erro de validacao desconhecido';
        const errorDetails =
          validationError?.errors || validationError?.issues || [];

        console.error('[REGISTER] Erro de validação Zod:', {
          message: errorMessage,
          details: errorDetails,
          errorType: validationError?.constructor?.name,
        });

        // Não bloquear o cadastro por erro de validação Zod se o schema não suportar novos roles
        // Apenas logar o erro e continuar
        console.warn(
          '[REGISTER] Continuando apesar do erro de validação (pode ser incompatibilidade de schema)'
        );
      }

      // Criar usuário no banco
      let newUser;
      try {
        // Definir expiração de confirmação de email (2 horas a partir de agora)
        const emailConfirmationExpiresAt = new Date();
        emailConfirmationExpiresAt.setHours(
          emailConfirmationExpiresAt.getHours() + 2
        );

        newUser = await storage.upsertUser({
          ...userData,
          emailConfirmed: false,
          emailConfirmationExpiresAt: emailConfirmationExpiresAt.toISOString(),
        });

        // A criação de subconta Asaas foi movida para o fluxo de completar cadastro
      } catch (storageError: any) {
        console.error(
          '[REGISTER] Erro ao criar usuário no storage:',
          storageError
        );
        console.error(
          '[REGISTER] Tipo do erro:',
          storageError?.constructor?.name
        );
        console.error('[REGISTER] Stack:', storageError.stack);
        console.error(
          '[REGISTER] Código do erro (se houver):',
          (storageError as any)?.code
        );
        console.error(
          '[REGISTER] Detalhes completos:',
          JSON.stringify(storageError, null, 2)
        );

        // Verificar se \u00e9 erro de constraint única
        if (
          (storageError as any)?.code === '23505' ||
          storageError?.message?.includes('unique constraint') ||
          storageError?.message?.includes('duplicate key')
        ) {
          return res.status(409).json({
            message: 'Usuário já cadastrado',
            error: 'Este email ou slug já está em uso',
          });
        }

        return res.status(500).json({
          message: 'Erro ao criar usuário',
          error: storageError.message || 'Erro desconhecido',
          code: (storageError as any)?.code,
          details:
            process.env.NODE_ENV === 'development'
              ? storageError.stack
              : undefined,
        });
      }

      // Criar credenciais (usar fullHash que inclui o salt)
      const credentialsId = randomUUID();
      const { error: credError } = await supabase
        .from('user_credentials')
        .insert({
          id: credentialsId,
          user_id: userId,
          password_hash: fullHash, // Usar fullHash (salt:hash) ao invés de apenas passwordHash
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (credError) {
        console.error('[REGISTER] Erro ao criar credenciais:', credError);
        console.error('[REGISTER] Detalhes do erro:', {
          code: credError.code,
          message: credError.message,
          details: credError.details,
          hint: credError.hint,
        });

        // Tentar remover o usuário criado se as credenciais falharem
        try {
          await supabase.from('users').delete().eq('id', userId);
          console.log(
            '[REGISTER] Usuário removido devido a erro nas credenciais'
          );
        } catch (deleteError) {
          console.error(
            '[REGISTER] Erro ao remover usuário após falha nas credenciais:',
            deleteError
          );
        }

        return res.status(500).json({
          message: 'Erro ao criar credenciais',
          error: credError.message,
          details: credError.details,
          hint: credError.hint,
        });
      }

      console.log(
        '[REGISTER] Credenciais criadas com sucesso para userId:',
        userId
      );

      // Criar sessão
      (req.session as any).userId = userId;
      (req.session as any).user = {
        id: userId,
        email: email, // Usar email original para a sessão
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      };

      // Garantir Content-Type JSON antes de enviar resposta
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'Usuário registrado com sucesso',
        user: {
          id: userId,
          email: email, // Retornar email original para o frontend
          role: newUser.role,
        },
      });
    } catch (error: any) {
      console.error('[REGISTER] Erro ao registrar usuário:', error);
      console.error('[REGISTER] Tipo do erro:', error?.constructor?.name);
      console.error('[REGISTER] Stack trace:', error?.stack);
      console.error('[REGISTER] Mensagem:', error?.message);

      // Garantir que sempre retornamos JSON, mesmo em caso de erro
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({
          message: 'Erro ao registrar usuário',
          error: error.message || 'Erro desconhecido',
          details:
            process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
    }
  });

  // Rota de cadastro completo de empresa
  app.post('/api/companies/register', async (req: any, res) => {
    try {
      const {
        email,
        password,
        responsibleEmail,
        responsibleName,
        companyName,
        cnpj,
        phone,
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        userRole,
      } = req.body;

      // Usar responsibleEmail como email principal (será o login)
      const loginEmail = responsibleEmail || email;

      // Normalizar email para lowercase (case-insensitive)
      const normalizedLoginEmail = loginEmail
        ? loginEmail.toLowerCase().trim()
        : null;

      if (
        !normalizedLoginEmail ||
        !password ||
        !responsibleName ||
        !companyName
      ) {
        return res.status(400).json({
          message:
            'Email do responsável, senha, nome do responsável e nome da empresa são obrigatórios',
        });
      }

      // Verificar se usuário já existe COM ROLE COMPANY
      // Permite que o mesmo email seja usado como técnico e empresa
      const existingUser = await (storage as any).getUserByEmailAndRole(
        normalizedLoginEmail,
        'company'
      );
      if (existingUser) {
        return res
          .status(400)
          .json({ message: 'Este email já está cadastrado como empresa' });
      }

      const trialDeviceId = getTrialDeviceId(req);
      const trialIp = getRequestIp(req);
      if (trialDeviceId || trialIp) {
        const existingTrialUser = await findTrialUserByDeviceOrIp(
          trialDeviceId,
          trialIp
        );
        if (existingTrialUser) {
          return res.status(403).json({
            message: 'Trial ja utilizado neste dispositivo ou rede.',
            code: 'TRIAL_ALREADY_USED',
          });
        }
      }

      const normalizedCnpj = cnpj ? normalizeDocumentValue(cnpj) : '';
      if (normalizedCnpj) {
        const existingByCnpj = await findUserByDocument(
          normalizedCnpj,
          'cnpj'
        );
        if (existingByCnpj) {
          return res.status(409).json({
            message: 'Este CNPJ ja esta cadastrado.',
            code: 'CNPJ_ALREADY_USED',
          });
        }

        if (normalizedLoginEmail) {
          const emailUsers = await findUsersByNormalizedEmail(
            normalizedLoginEmail
          );
          const emailCnpj = emailUsers
            .map((user) => normalizeDocumentValue(user?.cnpj))
            .find((value) => value);
          if (emailCnpj && emailCnpj !== normalizedCnpj) {
            return res.status(409).json({
              message: 'Este email ja possui um CNPJ cadastrado.',
              code: 'EMAIL_CNPJ_CONFLICT',
            });
          }
        }
      }

      // Hash da senha usando PBKDF2
      const salt = randomBytes(16).toString('hex');
      const passwordHash = pbkdf2Sync(
        password,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const fullHash = `${salt}:${passwordHash}`;

      // Criar usuário com role 'company'
      // Como o email \u00e9 unique no banco, precisamos criar um email único
      const userId = randomUUID();
      const [firstName, ...lastNameParts] = responsibleName.split(' ');
      const lastName = lastNameParts.join(' ') || '';

      // Criar email único baseado no email original + role (sempre usar email normalizado)
      const emailParts = normalizedLoginEmail.split('@');
      const uniqueEmail = `${emailParts[0]}+company@${emailParts[1]}`;


      const newUser = await storage.upsertUser({
        id: userId,
        email: uniqueEmail, // Usar email único no banco (sempre lowercase)
        firstName: firstName || normalizedLoginEmail.split('@')[0],
        lastName: lastName,
        role: 'company', // Sempre company para cadastro de empresa
        companyName: companyName,
        cnpj: normalizedCnpj || null,
        trialDeviceId: trialDeviceId || null,
        trialIp: trialIp || null,
        trialClaimedAt: new Date().toISOString(),
      });

      // A criação de subconta Asaas foi movida para o fluxo de completar cadastro

      // Criar credenciais
      const { error: credError } = await supabase
        .from('user_credentials')
        .insert({
          id: randomUUID(),
          user_id: userId,
          password_hash: fullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (credError) {
        console.error('Error creating credentials:', credError);
        return res.status(500).json({
          message: 'Erro ao criar credenciais',
          error: credError.message,
        });
      }

      // Criar sessão
      (req.session as any).userId = userId;
      (req.session as any).user = {
        id: userId,
        email: newUser.email,
        role: newUser.role,
      };

      res.json({
        message: 'Empresa registrada com sucesso',
        user: {
          id: userId,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error: any) {
      console.error('Error registering company:', error);
      res.status(500).json({
        message: 'Erro ao registrar empresa',
        error: error.message,
      });
    }
  });

  // Login unificado (tenant principal ou perfil operacional/financeiro)
  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email e senha são obrigatórios' });
      }

      // Normalizar email para lowercase (case-insensitive)
      const normalizedEmail = email.toLowerCase().trim();

      // ============================================
      // PASSO 1: Verificar se \u00e9 master admin
      // ============================================
      const emailParts = normalizedEmail.split('@');
      const superAdminEmail = `${emailParts[0]}+super_admin@${emailParts[1]}`;

      // Tentar primeiro com sufixo +super_admin, depois email direto
      let user =
        (await storage.getUserByEmail(superAdminEmail)) ||
        (await storage.getUserByEmail(normalizedEmail));

      if (user && user.role === 'super_admin') {
        // Verificar senha do master admin
        const { data: credentials } = await supabase
          .from('user_credentials')
          .select('password_hash')
          .eq('user_id', user.id)
          .single();

        if (!credentials?.password_hash) {
          return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        const [storedSalt, storedHash] = credentials.password_hash.split(':');
        const hashToVerify = pbkdf2Sync(
          password,
          storedSalt,
          10000,
          64,
          'sha512'
        ).toString('hex');

        if (hashToVerify !== storedHash) {
          return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        // Criar sessão master admin
        (req.session as any).userId = user.id;
        (req.session as any).user = {
          id: user.id,
          email: user.email,
          role: 'super_admin',
          isProfile: false,
        };

        return res.json({
          message: 'Login realizado com sucesso',
          user: {
            id: user.id,
            email: user.email,
            role: 'super_admin',
            isProfile: false,
          },
        });
      }

      // ============================================
      // PASSO 2: Buscar tenant principal (users)
      // ============================================
      const [localPart, domainPart] = normalizedEmail.split('@');
      const candidateEmails = [
        normalizedEmail,
        `${localPart}+tech@${domainPart}`,
        `${localPart}+empresa@${domainPart}`,
        `${localPart}+technician@${domainPart}`,
        `${localPart}+company@${domainPart}`,
      ];

      for (const candidate of candidateEmails) {
        user = await storage.getUserByEmail(candidate);
        if (user) {
          break;
        }
      }

      if (
        user &&
        (user.role === 'company' ||
          user.role === 'technician' ||
          user.role === 'tech' ||
          user.role === 'empresa')
      ) {
        // Verificar senha em user_credentials
        const { data: credentials, error: credError } = await supabase
          .from('user_credentials')
          .select('password_hash, provider')
          .eq('user_id', user.id)
          .single();

        if (credError || !credentials?.password_hash) {
          if (credentials?.provider === 'google') {
            return res.status(403).json({
              message:
                'Esta conta foi criada via Google. Entre com Google ou defina uma senha no Perfil.',
            });
          }
          return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        // Verificar senha
        const [storedSalt, storedHash] = credentials.password_hash.split(':');
        const hashToVerify = pbkdf2Sync(
          password,
          storedSalt,
          10000,
          64,
          'sha512'
        ).toString('hex');

        if (hashToVerify !== storedHash) {
          return res.status(401).json({ message: 'Email ou senha inválidos' });
        }

        // Verificar se a conta expirou (email não confirmado em 2 horas)
        if (
          !user.emailConfirmed &&
          user.emailConfirmationExpiresAt &&
          new Date(user.emailConfirmationExpiresAt) < new Date()
        ) {
          // Deletar conta expirada
          try {
            await supabase
              .from('user_credentials')
              .delete()
              .eq('user_id', user.id);
            await supabase.from('users').delete().eq('id', user.id);
          } catch (deleteError) {
            console.error(
              '[LOGIN] Erro ao deletar conta expirada:',
              deleteError
            );
          }

          return res.status(410).json({
            message:
              'Sua conta expirou por falta de confirmação de email. Por favor, cadastre-se novamente.',
            expired: true,
          });
        }

        // Criar sessão tenant principal
        (req.session as any).userId = user.id;
        (req.session as any).user = {
          id: user.id,
          email: user.email,
          role: user.role,
          isProfile: false,
          companyId: user.id, // Tenant principal \u00e9 sua pr\u00f3pria empresa
        };

        return res.json({
          message: 'Login realizado com sucesso',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            isProfile: false,
          },
        });
      }

      // ============================================
      // PASSO 3: Buscar perfil (company_profiles)
      // ============================================
      const { data: profile, error: profileError } = await supabase
        .from('company_profiles')
        .select('id, company_id, role, email, password_hash, active')
        .eq('email', normalizedEmail)
        .eq('active', true)
        .single();

      if (profileError || !profile) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      if (!profile.password_hash) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Verificar senha do perfil
      const [profileSalt, profileHash] = profile.password_hash.split(':');
      const profileHashToVerify = pbkdf2Sync(
        password,
        profileSalt,
        10000,
        64,
        'sha512'
      ).toString('hex');

      if (profileHashToVerify !== profileHash) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Buscar dados do tenant (empresa) para a sessão
      const companyUser = await storage.getUser(profile.company_id);
      if (!companyUser) {
        return res.status(500).json({
          message: 'Erro ao buscar dados da empresa',
        });
      }

      // Criar sessão do perfil
      (req.session as any).userId = profile.company_id; // ID da empresa
      (req.session as any).user = {
        id: profile.company_id,
        email: companyUser.email || '',
        firstName:
          companyUser.firstName || (companyUser.email || '').split('@')[0],
        lastName: companyUser.lastName || '',
        role: profile.role, // 'operational' ou 'financial'
        isProfile: true,
        profileId: profile.id,
        companyId: profile.company_id,
      };

      return res.json({
        message: 'Login realizado com sucesso',
        user: {
          id: profile.company_id,
          email: companyUser.email,
          role: profile.role,
          isProfile: true,
          profileId: profile.id,
        },
      });
    } catch (error: any) {
      console.error('[LOGIN] Erro:', error);
      res.status(500).json({
        message: 'Erro ao fazer login',
        error: error.message,
      });
    }
  });

  // Definir senha local para conta autenticada (inclusive logins Google)
  app.post('/api/auth/set-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({
          message: 'Senha \u00e9 obrigatória e deve ter ao menos 6 caracteres',
        });
      }

      const salt = randomBytes(16).toString('hex');
      const passwordHash = pbkdf2Sync(
        password,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const fullHash = `${salt}:${passwordHash}`;

      const { error: credError } = await supabase
        .from('user_credentials')
        .upsert(
          {
            id: randomUUID(),
            user_id: userId,
            password_hash: fullHash,
            provider: 'email',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (credError) {
        console.error('[SET-PASSWORD] Erro ao salvar credencial:', credError);
        return res.status(500).json({
          message: 'Erro ao salvar senha',
          error: credError.message,
        });
      }

      // Marcar que já não precisa mais pedir senha
      (req.session as any).requirePassword = false;

      // Garantir emailConfirmed = true no usuário
      try {
        const existingUser = await storage.getUser(userId);
        if (existingUser) {
          await storage.upsertUser({
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role as any,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            profileImageUrl: existingUser.profileImageUrl,
            companyName: existingUser.companyName,
            companyLogoUrl: existingUser.companyLogoUrl,
            // emailConfirmed não está no schema, remover
          });
        }
      } catch (userUpdateError) {
        console.error(
          '[SET-PASSWORD] Erro ao marcar emailConfirmed:',
          userUpdateError
        );
        // Não bloquear a resposta por isso, já que a senha foi salva
      }

      return res.json({ message: 'Senha definida com sucesso' });
    } catch (error: any) {
      console.error('[SET-PASSWORD] Erro inesperado:', error);
      return res.status(500).json({
        message: 'Erro ao definir senha',
        error: error.message,
      });
    }
  });

  // Alterar senha (requer senha atual)
  app.post(
    '/api/auth/change-password',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            message: 'Senha atual e nova senha são obrigatórias',
          });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({
            message: 'Nova senha deve ter ao menos 6 caracteres',
          });
        }

        // Buscar credenciais do usuário
        const { data: credentials, error: credError } = await supabase
          .from('user_credentials')
          .select('password_hash')
          .eq('user_id', userId)
          .eq('provider', 'email')
          .single();

        if (credError || !credentials) {
          return res.status(404).json({
            message: 'Senha não configurada. Use a opção de definir senha.',
          });
        }

        // Validar senha atual
        const [salt, hash] = credentials.password_hash.split(':');
        const currentHash = pbkdf2Sync(
          currentPassword,
          salt,
          10000,
          64,
          'sha512'
        ).toString('hex');

        if (currentHash !== hash) {
          return res.status(401).json({
            message: 'Senha atual incorreta',
          });
        }

        // Gerar novo hash para a nova senha
        const newSalt = randomBytes(16).toString('hex');
        const newPasswordHash = pbkdf2Sync(
          newPassword,
          newSalt,
          10000,
          64,
          'sha512'
        ).toString('hex');
        const newFullHash = `${newSalt}:${newPasswordHash}`;

        // Atualizar senha
        const { error: updateError } = await supabase
          .from('user_credentials')
          .update({
            password_hash: newFullHash,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('provider', 'email');

        if (updateError) {
          console.error(
            '[CHANGE-PASSWORD] Erro ao atualizar senha:',
            updateError
          );
          return res.status(500).json({
            message: 'Erro ao alterar senha',
            error: updateError.message,
          });
        }

        return res.json({ message: 'Senha alterada com sucesso' });
      } catch (error: any) {
        console.error('[CHANGE-PASSWORD] Erro inesperado:', error);
        return res.status(500).json({
          message: 'Erro ao alterar senha',
          error: error.message,
        });
      }
    }
  );

  // Solicitar recuperação de senha
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          message: 'Email \u00e9 obrigatório',
        });
      }

      // Normalizar email
      const emailParts = email.toLowerCase().trim().split('@');
      let normalizedEmail = email.toLowerCase().trim();
      if (emailParts.length === 2) {
        const localPart = emailParts[0];
        const domain = emailParts[1];
        const plusIndex = localPart.indexOf('+');
        if (plusIndex >= 0) {
          normalizedEmail = `${localPart.slice(0, plusIndex)}@${domain}`;
        }
      }

      // Buscar usuário pelo email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, firstName, lastName')
        .eq('email', normalizedEmail)
        .single();

      // Sempre retornar sucesso (por segurança, não revelar se o email existe)
      if (userError || !user) {
        console.log('[FORGOT-PASSWORD] Email não encontrado:', normalizedEmail);
        return res.json({
          message:
            'Se o email estiver cadastrado, você receberá um link de recuperação.',
        });
      }

      // Verificar se o usuário tem credenciais de email/senha
      const { data: credentials, error: credError } = await supabase
        .from('user_credentials')
        .select('provider')
        .eq('user_id', user.id)
        .eq('provider', 'email')
        .single();

      if (credError || !credentials) {
        console.log(
          '[FORGOT-PASSWORD] Usuário não tem credenciais de email/senha:',
          user.id
        );
        return res.json({
          message:
            'Se o email estiver cadastrado, você receberá um link de recuperação.',
        });
      }

      // Gerar token seguro
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Salvar token no banco
      const { error: tokenError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString(),
          used: false,
        });

      if (tokenError) {
        console.error('[FORGOT-PASSWORD] Erro ao salvar token:', tokenError);
        return res.status(500).json({
          message: 'Erro ao processar solicitação de recuperação',
        });
      }

      // Gerar URL de recuperação
      const baseUrl =
        process.env.BASE_URL || process.env.NGROK_URL || 'http://localhost:5180';
      const resetUrl = `${baseUrl}/redefinir-senha?token=${token}`;

      const userName =
        user.firstName || user.email?.split('@')[0] || 'Usuário';

      // Gerar templates de email
      const html = generatePasswordResetEmailHtml(userName, resetUrl);
      const text = generatePasswordResetEmailText(userName, resetUrl);

      // Enviar email
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: 'Recuperação de Senha - ChamadosPro',
        html,
        text,
      });

      if (!emailResult.success) {
        console.error('[FORGOT-PASSWORD] Erro ao enviar email:', {
          error: emailResult.error,
          email: normalizedEmail,
        });
        return res.status(500).json({
          message: 'Erro ao enviar email de recuperação',
        });
      }

      console.log('[FORGOT-PASSWORD] Email de recuperação enviado:', normalizedEmail);

      return res.json({
        message:
          'Se o email estiver cadastrado, você receberá um link de recuperação.',
      });
    } catch (error: any) {
      console.error('[FORGOT-PASSWORD] Erro inesperado:', error);
      return res.status(500).json({
        message: 'Erro ao processar solicitação de recuperação',
      });
    }
  });

  // Redefinir senha usando token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          message: 'Token e nova senha são obrigatórios',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: 'Nova senha deve ter ao menos 6 caracteres',
        });
      }

      // Buscar token no banco
      const { data: resetToken, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, used')
        .eq('token', token)
        .single();

      if (tokenError || !resetToken) {
        return res.status(400).json({
          message: 'Token inválido ou expirado',
        });
      }

      // Verificar se o token foi usado
      if (resetToken.used) {
        return res.status(400).json({
          message: 'Este token já foi utilizado',
        });
      }

      // Verificar se o token expirou
      const expiresAt = new Date(resetToken.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({
          message: 'Token expirado. Solicite uma nova recuperação de senha.',
        });
      }

      // Gerar novo hash para a nova senha
      const newSalt = randomBytes(16).toString('hex');
      const newPasswordHash = pbkdf2Sync(
        newPassword,
        newSalt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const newFullHash = `${newSalt}:${newPasswordHash}`;

      // Atualizar senha no user_credentials
      const { error: updateError } = await supabase
        .from('user_credentials')
        .update({
          password_hash: newFullHash,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', resetToken.user_id)
        .eq('provider', 'email');

      if (updateError) {
        console.error('[RESET-PASSWORD] Erro ao atualizar senha:', updateError);
        return res.status(500).json({
          message: 'Erro ao redefinir senha',
          error: updateError.message,
        });
      }

      // Marcar token como usado
      await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('id', resetToken.id);

      console.log('[RESET-PASSWORD] Senha redefinida com sucesso para usuário:', resetToken.user_id);

      return res.json({ message: 'Senha redefinida com sucesso' });
    } catch (error: any) {
      console.error('[RESET-PASSWORD] Erro inesperado:', error);
      return res.status(500).json({
        message: 'Erro ao redefinir senha',
        error: error.message,
      });
    }
  });

  // Validar token de recuperação (opcional, para verificar antes de mostrar o form)
  app.get('/api/auth/validate-reset-token', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          valid: false,
          message: 'Token não fornecido',
        });
      }

      // Buscar token no banco
      const { data: resetToken, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, expires_at, used')
        .eq('token', token)
        .single();

      if (tokenError || !resetToken) {
        return res.json({
          valid: false,
          message: 'Token inválido',
        });
      }

      // Verificar se o token foi usado
      if (resetToken.used) {
        return res.json({
          valid: false,
          message: 'Este token já foi utilizado',
        });
      }

      // Verificar se o token expirou
      const expiresAt = new Date(resetToken.expires_at);
      if (expiresAt < new Date()) {
        return res.json({
          valid: false,
          message: 'Token expirado',
        });
      }

      return res.json({
        valid: true,
        message: 'Token válido',
      });
    } catch (error: any) {
      console.error('[VALIDATE-RESET-TOKEN] Erro:', error);
      return res.status(500).json({
        valid: false,
        message: 'Erro ao validar token',
      });
    }
  });

  // Enviar código de confirmação de email
  app.post(
    '/api/auth/send-email-code',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || !user.email) {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Normalizar email (remover sufixo +role se existir)
        const userEmail = user.email || '';
        const emailParts = userEmail.split('@');
        let normalizedEmail = userEmail;

        if (emailParts.length === 2) {
          const localPart = emailParts[0];
          const domain = emailParts[1];
          const plusIndex = localPart.indexOf('+');
          if (plusIndex >= 0) {
            normalizedEmail = `${localPart.slice(0, plusIndex)}@${domain}`;
          }
        }

        // Gerar código de 6 dígitos e expiração
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 60 * 1000; // 10 minutos

        // Guardar na sessão para validação
        (req.session as any).emailVerification = {
          code,
          expiresAt,
        };

        const userName =
          user.firstName || normalizedEmail.split('@')[0] || 'Usuário';

        // Gerar templates de email
        let html, text;
        try {
          html = generateConfirmationCodeEmailHtml(userName, code);
          text = generateConfirmationCodeEmailText(userName, code);
        } catch (templateError: any) {
          console.error('[SEND-EMAIL-CODE] Erro ao gerar templates:', {
            error: templateError,
            message: templateError.message,
            stack: templateError.stack,
          });
          throw new Error(
            'Erro ao gerar templates de email: ' + templateError.message
          );
        }

        const emailResult = await sendEmail({
          to: normalizedEmail, // Usar email normalizado
          subject: 'Código de confirmação de email - ChamadosPro',
          html,
          text,
        });

        if (!emailResult.success) {
          console.error('[SEND-EMAIL-CODE] Falha ao enviar email:', {
            error: emailResult.error,
            email: normalizedEmail,
          });
          return res.status(500).json({
            message: 'Erro ao enviar código de confirmação',
            error: emailResult.error || 'Erro desconhecido',
          });
        }

        return res.json({ message: 'Código enviado para o email' });
      } catch (error: any) {
        console.error('[SEND-EMAIL-CODE] Erro completo:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          error: error,
        });
        return res.status(500).json({
          message: 'Erro ao enviar código de confirmação',
          error: error.message || 'Erro desconhecido',
          details:
            process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
    }
  );

  // Confirmar email com código
  app.post(
    '/api/auth/confirm-email-code',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { code } = req.body;

        const verification = (req.session as any).emailVerification;

        if (!verification || !verification.code || !verification.expiresAt) {
          return res.status(400).json({
            message: 'Nenhum código solicitado. Solicite um novo código.',
          });
        }

        if (Date.now() > verification.expiresAt) {
          return res.status(400).json({
            message: 'Código expirado. Solicite um novo código.',
          });
        }

        if (!code || code !== verification.code) {
          return res.status(400).json({
            message: 'Código inválido.',
          });
        }

        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Atualizar emailConfirmed no usuário e limpar expiração
        await storage.upsertUser({
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role as any,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          profileImageUrl: existingUser.profileImageUrl,
          companyName: existingUser.companyName,
          companyLogoUrl: existingUser.companyLogoUrl,
          emailConfirmed: true,
          emailConfirmationExpiresAt: null, // Limpar expiração após confirmação
        });

        // Atualizar sessão
        (req.session as any).user = {
          ...(req.session as any).user,
          emailConfirmed: true,
        };
        delete (req.session as any).emailVerification;

        return res.json({ message: 'Email confirmado com sucesso' });
      } catch (error: any) {
        console.error('[CONFIRM-EMAIL-CODE] Erro:', error);
        return res.status(500).json({
          message: 'Erro ao confirmar email',
          error: error.message,
        });
      }
    }
  );

  // Completar cadastro (dados mínimos + criação de subconta Asaas)
  app.post('/api/profile/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const {
        firstName,
        lastName,
        companyName,
        tenantSlug,
        phone,
        cpf,
        cnpj,
        birthDate,
        companyType,
        incomeValue,
        zipCode,
        streetAddress,
        addressNumber,
        addressComplement,
        neighborhood,
        city,
        state,
        kycRequired,
      } = req.body;

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Master admin não deve completar cadastro (não precisa de Asaas)
      if (existingUser.role === 'super_admin') {
        return res.status(403).json({
          message: 'Master admin não precisa completar cadastro',
        });
      }

      const incomingCpf =
        cpf !== undefined ? normalizeDocumentValue(cpf) : '';
      const incomingCnpj =
        cnpj !== undefined ? normalizeDocumentValue(cnpj) : '';
      const existingCpf = normalizeDocumentValue(existingUser.cpf);
      const existingCnpj = normalizeDocumentValue((existingUser as any).cnpj);

      if (cpf !== undefined && !incomingCpf && existingCpf) {
        return res.status(400).json({
          message: 'CPF nao pode ser removido ou alterado.',
          code: 'CPF_IMMUTABLE',
        });
      }

      if (cnpj !== undefined && !incomingCnpj && existingCnpj) {
        return res.status(400).json({
          message: 'CNPJ nao pode ser removido ou alterado.',
          code: 'CNPJ_IMMUTABLE',
        });
      }

      if (incomingCpf && existingCpf && incomingCpf !== existingCpf) {
        return res.status(409).json({
          message: 'CPF ja cadastrado para este usuario.',
          code: 'CPF_IMMUTABLE',
        });
      }

      if (incomingCnpj && existingCnpj && incomingCnpj !== existingCnpj) {
        return res.status(409).json({
          message: 'CNPJ ja cadastrado para este usuario.',
          code: 'CNPJ_IMMUTABLE',
        });
      }

      if (incomingCpf && existingCnpj) {
        return res.status(409).json({
          message: 'Este usuario ja possui CNPJ cadastrado.',
          code: 'DOCUMENT_CONFLICT',
        });
      }

      if (incomingCnpj && existingCpf) {
        return res.status(409).json({
          message: 'Este usuario ja possui CPF cadastrado.',
          code: 'DOCUMENT_CONFLICT',
        });
      }

      let emailUsers: any[] = [];
      if (incomingCpf || incomingCnpj) {
        const normalizedEmail = normalizeEmailAddress(
          existingUser.email || ''
        ).toLowerCase();
        emailUsers = await findUsersByNormalizedEmail(normalizedEmail);
      }

      if (incomingCpf) {
        const existingByCpf = await findUserByDocument(
          incomingCpf,
          'cpf',
          userId
        );
        if (existingByCpf) {
          return res.status(409).json({
            message: 'CPF ja cadastrado em outra conta.',
            code: 'CPF_ALREADY_USED',
          });
        }

        const emailCpf = emailUsers
          .filter((user) => user.id !== userId)
          .map((user) => normalizeDocumentValue(user?.cpf))
          .find((value) => value);
        if (emailCpf && emailCpf !== incomingCpf) {
          return res.status(409).json({
            message: 'Este email ja possui CPF cadastrado.',
            code: 'EMAIL_CPF_CONFLICT',
          });
        }
      }

      if (incomingCnpj) {
        const existingByCnpj = await findUserByDocument(
          incomingCnpj,
          'cnpj',
          userId
        );
        if (existingByCnpj) {
          return res.status(409).json({
            message: 'CNPJ ja cadastrado em outra conta.',
            code: 'CNPJ_ALREADY_USED',
          });
        }

        const emailCnpj = emailUsers
          .filter((user) => user.id !== userId)
          .map((user) => normalizeDocumentValue(user?.cnpj))
          .find((value) => value);
        if (emailCnpj && emailCnpj !== incomingCnpj) {
          return res.status(409).json({
            message: 'Este email ja possui CNPJ cadastrado.',
            code: 'EMAIL_CNPJ_CONFLICT',
          });
        }
      }

      if (kycRequired) {
        const resolveString = (value: any, fallback: any) => {
          if (value !== undefined) {
            return typeof value === 'string' ? value.trim() : value;
          }
          return typeof fallback === 'string' ? fallback.trim() : fallback;
        };

        const documentKind =
          incomingCpf || existingCpf
            ? 'cpf'
            : incomingCnpj || existingCnpj
              ? 'cnpj'
              : null;
        const resolvedDocument =
          documentKind === 'cpf'
            ? incomingCpf || existingCpf
            : documentKind === 'cnpj'
              ? incomingCnpj || existingCnpj
              : '';

        const resolvedFirstName = resolveString(firstName, existingUser.firstName);
        const resolvedLastName = resolveString(lastName, existingUser.lastName);
        const resolvedCompanyName = resolveString(companyName, existingUser.companyName);
        const resolvedPhone = resolveString(phone, existingUser.phone);
        const resolvedZipCode = resolveString(zipCode, (existingUser as any).zipCode);
        const resolvedStreet = resolveString(
          streetAddress,
          (existingUser as any).streetAddress
        );
        const resolvedNumber = resolveString(
          addressNumber,
          (existingUser as any).addressNumber
        );
        const resolvedNeighborhood = resolveString(
          neighborhood,
          (existingUser as any).neighborhood
        );
        const resolvedCity = resolveString(city, (existingUser as any).city);
        const resolvedState = resolveString(state, (existingUser as any).state);
        const resolvedBirthDate =
          birthDate !== undefined ? birthDate : (existingUser as any).birthDate;

        const missingFields: string[] = [];

        if (!resolvedFirstName) missingFields.push('firstName');
        if (!resolvedLastName) missingFields.push('lastName');
        if (!resolvedCompanyName) missingFields.push('companyName');
        if (!resolvedDocument) missingFields.push('document');

        const phoneDigits =
          typeof resolvedPhone === 'string'
            ? resolvedPhone.replace(/\D/g, '')
            : '';
        if (!phoneDigits || phoneDigits.length < 10) {
          missingFields.push('phone');
        }

        const zipDigits =
          typeof resolvedZipCode === 'string'
            ? resolvedZipCode.replace(/\D/g, '')
            : '';
        if (!zipDigits || zipDigits.length < 8) missingFields.push('zipCode');
        if (!resolvedStreet) missingFields.push('streetAddress');
        if (!resolvedNumber) missingFields.push('addressNumber');
        if (!resolvedNeighborhood) missingFields.push('neighborhood');
        if (!resolvedCity) missingFields.push('city');
        if (!resolvedState || resolvedState.length < 2) missingFields.push('state');

        if (documentKind === 'cpf' && !resolvedBirthDate) {
          missingFields.push('birthDate');
        }

        if (missingFields.length > 0) {
          return res.status(400).json({
            message: 'Dados obrigatorios incompletos para integracao.',
            missingFields,
          });
        }
      }

      // NÃO atualizar tenantSlug se já existe para o usuário atual
      // Preservar o tenantSlug existente para evitar conflitos
      let finalTenantSlug = existingUser.tenantSlug;
      // Só gerar novo slug se:
      // 1. Não existe tenantSlug ainda (primeira vez)
      // 2. OU foi explicitamente fornecido e \u00e9 diferente do existente
      if (!finalTenantSlug && companyName) {
        const { slugify } = await import('./utils/slugify');
        finalTenantSlug = slugify(companyName);
      } else if (tenantSlug && tenantSlug !== existingUser.tenantSlug) {
        // Se foi fornecido um slug diferente, usar ele
        finalTenantSlug = tenantSlug;
      }

      // Asaas removido - será implementado Stripe Connect no futuro

      // Função helper para converter string vazia para null
      const emptyToNull = (value: any): string | null | undefined => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return null;
        return value;
      };

      // Determinar qual documento salvar (CPF ou CNPJ)
      // Se cnpj foi fornecido, salvar em cnpj e limpar cpf
      // Se cpf foi fornecido, salvar em cpf e limpar cnpj
      // Se nenhum foi fornecido, manter os existentes
      let cpfToSave: string | null | undefined = existingUser.cpf;
      let cnpjToSave: string | null | undefined = (existingUser as any).cnpj;

      if (cnpj !== undefined) {
        // CNPJ fornecido: salvar em cnpj, limpar cpf
        cnpjToSave = emptyToNull(cnpj);
        cpfToSave = null;
      } else if (cpf !== undefined) {
        // CPF fornecido: salvar em cpf, limpar cnpj
        cpfToSave = emptyToNull(cpf);
        cnpjToSave = null;
      }

      // Preparar dados para salvar - converter strings vazias para null
      // Se o valor foi fornecido, usar ele (convertendo '' para null); senão manter o existente
      const updatedUser = await storage.upsertUser({
        id: userId,
        email: existingUser.email,
        firstName:
          firstName !== undefined
            ? firstName.trim() || existingUser.firstName
            : existingUser.firstName,
        lastName:
          lastName !== undefined
            ? lastName.trim() || existingUser.lastName
            : existingUser.lastName,
        companyName:
          companyName !== undefined
            ? companyName.trim() || existingUser.companyName
            : existingUser.companyName,
        tenantSlug: finalTenantSlug !== undefined ? finalTenantSlug : undefined,
        phone: phone !== undefined ? emptyToNull(phone) : existingUser.phone,
        cpf: cpfToSave,
        zipCode:
          zipCode !== undefined ? emptyToNull(zipCode) : existingUser.zipCode,
        streetAddress:
          streetAddress !== undefined
            ? emptyToNull(streetAddress)
            : existingUser.streetAddress,
        addressNumber:
          addressNumber !== undefined
            ? emptyToNull(addressNumber)
            : existingUser.addressNumber,
        addressComplement:
          addressComplement !== undefined
            ? emptyToNull(addressComplement)
            : existingUser.addressComplement,
        neighborhood:
          neighborhood !== undefined
            ? emptyToNull(neighborhood)
            : existingUser.neighborhood,
        city: city !== undefined ? emptyToNull(city) : existingUser.city,
        state: state !== undefined ? emptyToNull(state) : existingUser.state,
        cnpj: cnpjToSave,
        birthDate:
          birthDate !== undefined
            ? birthDate
              ? new Date(birthDate)
              : null
            : (existingUser as any).birthDate,
        companyType:
          companyType !== undefined
            ? emptyToNull(companyType)
            : (existingUser as any).companyType,
        incomeValue:
          incomeValue !== undefined
            ? incomeValue || 5000
            : (existingUser as any).incomeValue || 5000,
        role: existingUser.role as any,
        profileCompleted: true,
      });

      console.log('[PROFILE_COMPLETE] Dados salvos no banco:', {
        userId: updatedUser.id,
        zipCode: (updatedUser as any).zipCode,
        streetAddress: (updatedUser as any).streetAddress,
        addressNumber: (updatedUser as any).addressNumber,
        addressComplement: (updatedUser as any).addressComplement,
        neighborhood: (updatedUser as any).neighborhood,
        city: (updatedUser as any).city,
        state: (updatedUser as any).state,
        phone: (updatedUser as any).phone,
      });

      // Atualizar sessão
      req.session.user = {
        ...(req.session.user || {}),
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        companyName: updatedUser.companyName,
        tenantSlug: updatedUser.tenantSlug,
        // asaasCustomerId removido - será implementado Stripe Connect
        profileCompleted: updatedUser.profileCompleted,
      };

      // Retornar os dados salvos para confirmação
      res.json({
        message: 'Cadastro completo com sucesso',
        // asaasCustomerId removido - será implementado Stripe Connect
        profileCompleted: updatedUser.profileCompleted ?? false,
        tenantSlug: updatedUser.tenantSlug ?? null,
        // Retornar dados salvos para confirmação
        savedData: {
          zipCode: (updatedUser as any).zipCode,
          streetAddress: (updatedUser as any).streetAddress,
          addressNumber: (updatedUser as any).addressNumber,
          addressComplement: (updatedUser as any).addressComplement,
          neighborhood: (updatedUser as any).neighborhood,
          city: (updatedUser as any).city,
          state: (updatedUser as any).state,
          phone: (updatedUser as any).phone,
          cpf: (updatedUser as any).cpf,
          cnpj: (updatedUser as any).cnpj,
        },
      });
    } catch (error: any) {
      console.error('[PROFILE_COMPLETE] Erro:', error);
      res.status(500).json({
        message: 'Erro ao completar cadastro',
        error: error.message,
      });
    }
  });

  // Endpoint para verificar se os dados foram salvos no banco
  app.get('/api/profile/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Verificar quais campos estão preenchidos
      const savedData = {
        zipCode: (user as any).zipCode,
        streetAddress: (user as any).streetAddress,
        addressNumber: (user as any).addressNumber,
        addressComplement: (user as any).addressComplement,
        neighborhood: (user as any).neighborhood,
        city: (user as any).city,
        state: (user as any).state,
        phone: (user as any).phone,
        cpf: (user as any).cpf,
        cnpj: (user as any).cnpj,
      };

      // Verificar se os dados obrigatórios estão preenchidos
      const requiredFields = [
        'zipCode',
        'streetAddress',
        'addressNumber',
        'neighborhood',
        'city',
        'state',
        'phone',
      ];
      const missingFields = requiredFields.filter(
        (field) =>
          !savedData[field as keyof typeof savedData] ||
          savedData[field as keyof typeof savedData] === null
      );

      const isComplete = missingFields.length === 0;

      console.log('[PROFILE_VERIFY] Verificação de dados:', {
        userId,
        savedData,
        missingFields,
        isComplete,
      });

      res.json({
        isComplete,
        missingFields,
        savedData,
        message: isComplete
          ? 'Todos os dados obrigatórios estão salvos no banco de dados'
          : `Campos faltando: ${missingFields.join(', ')}`,
      });
    } catch (error: any) {
      console.error('[PROFILE_VERIFY] Erro:', error);
      res.status(500).json({
        message: 'Erro ao verificar dados',
        error: error.message,
      });
    }
  });

  // Listar técnicos parceiros da empresa
  app.get(
    '/api/company/technicians',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Buscar técnicos vinculados \u00e0 empresa
        const { data: companyTechnicians, error } = await supabase
          .from('company_technicians')
          .select('technician_id, status')
          .eq('company_id', userId)
          .eq('status', 'accepted');

        if (error) {
          console.error('[Company Technicians] Erro ao buscar:', error);
          // Se a tabela não existir, retornar lista vazia
          if (
            error.code === 'PGRST116' ||
            error.code === '42P01' ||
            error.message?.includes('does not exist') ||
            error.message?.includes('não existe')
          ) {
            console.warn(
              '[Company Technicians] Tabela company_technicians não encontrada, retornando lista vazia'
            );
            return res.json([]);
          }
          // Para outros erros, retornar lista vazia em vez de erro 500
          console.warn(
            '[Company Technicians] Erro ao buscar técnicos, retornando lista vazia:',
            error.message
          );
          return res.json([]);
        }

        // Buscar dados dos técnicos
        const technicianIds =
          companyTechnicians?.map((ct: any) => ct.technician_id) || [];
        const technicians = await Promise.all(
          technicianIds.map((id: string) => storage.getUser(id))
        );

        // Formatar resposta
        const formattedTechnicians = technicians
          .filter(Boolean)
          .map((tech) => ({
            id: tech!.id,
            firstName: tech!.firstName || '',
            lastName: tech!.lastName || '',
            email: tech!.email || '',
          }));

        res.json(formattedTechnicians);
      } catch (error: any) {
        console.error('Error fetching company technicians:', error);
        res.status(500).json({
          message: 'Failed to fetch technicians',
          error: error.message,
        });
      }
    }
  );

  // Listar técnicos parceiros com status e estatísticas
  app.get(
    '/api/company/technicians/with-stats',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Buscar técnicos vinculados \u00e0 empresa
        const { data: companyTechnicians, error } = await supabase
          .from('company_technicians')
          .select('technician_id, status')
          .eq('company_id', userId)
          .eq('status', 'accepted');

        if (error) {
          console.error('[Company Technicians Stats] Erro ao buscar:', error);
          return res.status(500).json({
            message: 'Erro ao buscar técnicos',
            error: error.message,
          });
        }

        // Buscar dados dos técnicos
        const technicianIds =
          companyTechnicians?.map((ct: any) => ct.technician_id) || [];
        const technicians = await Promise.all(
          technicianIds.map((id: string) => storage.getUser(id))
        );

        // Buscar tickets para calcular estatísticas
        const allTickets = await storage.getTicketsByUser(userId);

        // Mapear técnicos com estatísticas
        const techniciansWithStats = technicians.filter(Boolean).map((tech) => {
          // Contar chamados atribuídos a este técnico
          const ticketCount = allTickets.filter(
            (t: any) => t.technicianId === tech!.id
          ).length;

          // Determinar status baseado em chamados ativos
          const activeTickets = allTickets.filter(
            (t: any) =>
              t.technicianId === tech!.id &&
              (t.status === 'INICIADO' ||
                t.status === 'IN_PROGRESS' ||
                t.status === 'ABERTO' ||
                t.status === 'PENDENTE')
          ).length;

          let status: 'available' | 'busy' | 'unavailable' = 'available';
          if (activeTickets >= 5) {
            status = 'unavailable';
          } else if (activeTickets >= 2) {
            status = 'busy';
          }

          return {
            id: tech!.id,
            firstName: tech!.firstName || '',
            lastName: tech!.lastName || '',
            email: tech!.email,
            profileImageUrl: tech!.profileImageUrl,
            status,
            ticketCount,
            specialties: [], // TODO: Adicionar especialidades quando disponível
          };
        });

        res.json(techniciansWithStats);
      } catch (error: any) {
        console.error('Error fetching technicians with stats:', error);
        res.status(500).json({
          message: 'Failed to fetch technicians',
          error: error.message,
        });
      }
    }
  );

  // Listar técnicos disponíveis no sistema
  app.get(
    '/api/technicians/available',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        const { status, date, startTime, endTime } = req.query;

        // Buscar todos os técnicos do sistema (role = 'technician')
        const allUsers = await storage.getAllUsers();
        let technicians = allUsers.filter((u: any) => u.role === 'technician');

        // Buscar todos os tickets da empresa para calcular carga de trabalho
        const allCompanyTickets = await storage.getTicketsByUser(userId);

        // Buscar carga de trabalho de cada técnico
        const techniciansWithWorkload = await Promise.all(
          technicians.map(async (tech: any) => {
            // Filtrar tickets atribuídos a este técnico
            const allTickets = allCompanyTickets.filter(
              (t: any) => t.technicianId === tech.id
            );
            const inProgressTickets = allTickets.filter(
              (t: any) =>
                t.status === 'INICIADO' ||
                t.status === 'EXECUCAO' ||
                t.status === 'in-progress' ||
                t.status === 'ABERTO' ||
                t.status === 'PENDENTE'
            );

            // Buscar tickets agendados para esta semana
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // Domingo
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6); // Sábado
            weekEnd.setHours(23, 59, 59, 999);

            const thisWeekTickets = allTickets.filter((t: any) => {
              if (!t.scheduledDate) return false;
              const ticketDate = new Date(t.scheduledDate);
              return (
                ticketDate >= weekStart &&
                ticketDate <= weekEnd &&
                (t.status === 'ABERTO' ||
                  t.status === 'INICIADO' ||
                  t.status === 'EXECUCAO' ||
                  t.status === 'PENDENTE' ||
                  t.status === 'pending' ||
                  t.status === 'in-progress')
              );
            });

            // Determinar status de disponibilidade
            let availabilityStatus: 'available' | 'busy' | 'unavailable' =
              'available';
            let availabilityText = 'Disponível para novos chamados';
            let availabilityColor = 'text-green-600 dark:text-green-400';

            if (inProgressTickets.length >= 5) {
              availabilityStatus = 'unavailable';
              availabilityText = 'Agenda cheia essa semana';
              availabilityColor = 'text-red-600 dark:text-red-400';
            } else if (inProgressTickets.length > 0) {
              availabilityStatus = 'busy';
              availabilityText = `${inProgressTickets.length} chamado${
                inProgressTickets.length > 1 ? 's' : ''
              } em andamento`;
              availabilityColor = 'text-orange-600 dark:text-orange-400';
            }

            // Verificar disponibilidade por janela de tempo se fornecido
            let isAvailableInTimeWindow = true;
            if (date && startTime && endTime) {
              const targetDate = new Date(date);
              const [startHour, startMin] = startTime.split(':').map(Number);
              const [endHour, endMin] = endTime.split(':').map(Number);
              const windowStart = new Date(targetDate);
              windowStart.setHours(startHour, startMin, 0, 0);
              const windowEnd = new Date(targetDate);
              windowEnd.setHours(endHour, endMin, 0, 0);

              // Verificar se o técnico tem chamados conflitantes neste período
              const conflictingTickets = allTickets.filter((t: any) => {
                if (!t.scheduledDate) return false;
                const ticketDate = new Date(t.scheduledDate);
                const ticketEnd = new Date(ticketDate);
                ticketEnd.setHours(ticketEnd.getHours() + (t.duration || 3));

                return (
                  (ticketDate >= windowStart && ticketDate <= windowEnd) ||
                  (ticketEnd >= windowStart && ticketEnd <= windowEnd) ||
                  (ticketDate <= windowStart && ticketEnd >= windowEnd)
                );
              });

              isAvailableInTimeWindow = conflictingTickets.length === 0;
            }

            return {
              id: tech.id,
              firstName: tech.firstName || '',
              lastName: tech.lastName || '',
              email: tech.email,
              phone: tech.phone || '',
              profileImageUrl: tech.profileImageUrl,
              status: availabilityStatus,
              activeTickets: inProgressTickets.length,
              ticketCount: allTickets.length,
              location:
                `${tech.city || ''}, ${tech.state || ''}`.trim() || undefined,
              specialties: [], // TODO: Adicionar especialidades quando disponível
              workload: {
                inProgressCount: inProgressTickets.length,
                thisWeekCount: thisWeekTickets.length,
                availabilityStatus:
                  availabilityStatus === 'unavailable'
                    ? 'full'
                    : availabilityStatus,
                availabilityText,
                availabilityColor,
              },
              isAvailableInTimeWindow,
            };
          })
        );

        // Aplicar filtro de status
        let filtered = techniciansWithWorkload;
        if (status && status !== 'all') {
          filtered = filtered.filter((t: any) => t.status === status);
        }

        // Aplicar filtro de disponibilidade por janela de tempo
        if (date && startTime && endTime) {
          filtered = filtered.filter((t: any) => t.isAvailableInTimeWindow);
        }

        res.json(filtered);
      } catch (error: any) {
        console.error('Error fetching available technicians:', error);
        res.status(500).json({
          message: 'Failed to fetch available technicians',
          error: error.message,
        });
      }
    }
  );

  // Enviar convite para técnico
  app.post(
    '/api/company/technicians/invite',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { technicianId, message, conditions } = req.body;

        if (!technicianId) {
          return res
            .status(400)
            .json({ message: 'ID do técnico \u00e9 obrigatório' });
        }

        if (!message || !message.trim()) {
          return res
            .status(400)
            .json({ message: 'Mensagem do convite \u00e9 obrigatória' });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o técnico existe
        const technician = await storage.getUser(technicianId);
        if (!technician) {
          return res.status(404).json({ message: 'Técnico não encontrado' });
        }

        // Verificar se já existe um convite pendente ou aceito
        const { data: existingInvite, error: checkError } = await supabase
          .from('company_technicians')
          .select('id, status')
          .eq('company_id', userId)
          .eq('technician_id', technicianId)
          .in('status', ['pending', 'accepted'])
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 = nenhum resultado encontrado (\u00e9 esperado)
          console.error('Error checking existing invite:', checkError);
          return res.status(500).json({
            message: 'Erro ao verificar convites existentes',
            error: checkError.message,
          });
        }

        if (existingInvite) {
          if (existingInvite.status === 'accepted') {
            return res.status(400).json({
              message: 'Este técnico já está vinculado \u00e0 sua empresa',
            });
          }
          if (existingInvite.status === 'pending') {
            return res.status(400).json({
              message: 'Já existe um convite pendente para este técnico',
            });
          }
        }

        // Criar registro de convite na tabela company_technicians
        const invitationId = randomUUID();
        const inviteData: any = {
          id: invitationId,
          company_id: userId,
          technician_id: technicianId,
          status: 'pending',
          invited_by: userId,
          invited_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Armazenar mensagem e condições em campos JSONB (se a tabela suportar)
        // Ou podemos adicionar campos text separados depois
        // Por enquanto, vamos armazenar em um campo message_data JSONB
        inviteData.message_data = {
          message: message.trim(),
          ...(conditions && conditions.trim()
            ? { conditions: conditions.trim() }
            : {}),
        };

        const { data: newInvite, error: insertError } = await supabase
          .from('company_technicians')
          .insert(inviteData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating invitation:', insertError);
          // Se o erro for por campo inexistente, tentar sem message_data
          if (insertError.message.includes('message_data')) {
            delete inviteData.message_data;
            const { data: retryInvite, error: retryError } = await supabase
              .from('company_technicians')
              .insert(inviteData)
              .select()
              .single();

            if (retryError) {
              return res.status(500).json({
                message: 'Erro ao criar convite',
                error: retryError.message,
              });
            }

            // Se message_data não existe, podemos criar uma tabela separada ou campo text
            // Por enquanto, apenas retornamos sucesso
            return res.json({
              message: 'Convite enviado com sucesso',
              invitationId: retryInvite.id,
            });
          }

          return res.status(500).json({
            message: 'Erro ao criar convite',
            error: insertError.message,
          });
        }

        res.json({
          message: 'Convite enviado com sucesso',
          invitationId: newInvite.id,
        });
      } catch (error: any) {
        console.error('Error sending invitation:', error);
        res.status(500).json({
          message: 'Failed to send invitation',
          error: error.message,
        });
      }
    }
  );

  // Criar técnico parceiro diretamente (sem convite)
  app.post(
    '/api/company/technicians',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { firstName, lastName, email, phone } = req.body;

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        if (!email) {
          return res.status(400).json({ message: 'Email \u00e9 obrigatório' });
        }

        // Normalizar email para lowercase (case-insensitive)
        const normalizedEmail = email.toLowerCase().trim();

        // Verificar se o técnico existe
        const existingTechnician = await storage.getUserByEmail(
          normalizedEmail
        );
        if (!existingTechnician) {
          return res.status(404).json({
            message:
              'Técnico não encontrado. O técnico deve estar cadastrado no sistema.',
          });
        }

        // Verificar se o usu\u00e1rio \u00e9 realmente um t\u00e9cnico
        if (existingTechnician.role !== 'technician') {
          return res.status(400).json({
            message: 'Este email não pertence a um técnico',
          });
        }

        // Verificar se já existe vínculo
        const { data: existingLink, error: checkError } = await supabase
          .from('company_technicians')
          .select('id, status')
          .eq('company_id', userId)
          .eq('technician_id', existingTechnician.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing link:', checkError);
          return res.status(500).json({
            message: 'Erro ao verificar vínculo existente',
            error: checkError.message,
          });
        }

        if (existingLink) {
          if (existingLink.status === 'accepted') {
            return res.status(400).json({
              message: 'Este técnico já está vinculado \u00e0 sua empresa',
            });
          }
          // Se estiver pendente, atualizar para aceito
          const { data: updated, error: updateError } = await supabase
            .from('company_technicians')
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLink.id)
            .select()
            .single();

          if (updateError) {
            throw new Error('Erro ao atualizar vínculo');
          }

          return res.json({
            id: existingTechnician.id,
            firstName: existingTechnician.firstName || '',
            lastName: existingTechnician.lastName || '',
            email: existingTechnician.email || '',
          });
        }

        // Criar vínculo direto (aceito)
        const linkId = randomUUID();
        const { data: newLink, error: insertError } = await supabase
          .from('company_technicians')
          .insert({
            id: linkId,
            company_id: userId,
            technician_id: existingTechnician.id,
            status: 'accepted',
            invited_by: userId,
            invited_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating technician link:', insertError);
          return res.status(500).json({
            message: 'Erro ao vincular técnico',
            error: insertError.message,
          });
        }

        res.json({
          id: existingTechnician.id,
          firstName: existingTechnician.firstName || '',
          lastName: existingTechnician.lastName || '',
          email: existingTechnician.email || '',
        });
      } catch (error: any) {
        console.error('Error creating company technician:', error);
        res.status(500).json({
          message: 'Failed to create technician',
          error: error.message,
        });
      }
    }
  );

  // Atualizar técnico parceiro
  app.patch(
    '/api/company/technicians/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params; // ID do técnico (user_id)
        const updates = req.body;

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o vínculo existe
        const { data: link, error: linkError } = await supabase
          .from('company_technicians')
          .select('*')
          .eq('company_id', userId)
          .eq('technician_id', id)
          .maybeSingle();

        if (linkError || !link) {
          return res.status(404).json({
            message: 'Técnico não encontrado ou não vinculado \u00e0 empresa',
          });
        }

        // Atualizar dados do técnico se fornecidos
        if (updates.firstName || updates.lastName || updates.email) {
          const technician = await storage.getUser(id);
          if (technician) {
            await storage.upsertUser({
              id: technician.id,
              email: updates.email || technician.email,
              firstName: updates.firstName || technician.firstName,
              lastName: updates.lastName || technician.lastName,
            });
          }
        }

        // Atualizar status do vínculo se fornecido
        if (updates.status) {
          const updateData: any = {
            status: updates.status,
            updated_at: new Date().toISOString(),
          };

          if (updates.status === 'accepted' && link.status !== 'accepted') {
            updateData.accepted_at = new Date().toISOString();
          }

          const { error: updateError } = await supabase
            .from('company_technicians')
            .update(updateData)
            .eq('id', link.id);

          if (updateError) {
            throw new Error('Erro ao atualizar vínculo');
          }
        }

        // Buscar dados atualizados
        const updatedTechnician = await storage.getUser(id);
        if (!updatedTechnician) {
          throw new Error('Erro ao buscar dados do técnico');
        }

        res.json({
          id: updatedTechnician.id,
          firstName: updatedTechnician.firstName || '',
          lastName: updatedTechnician.lastName || '',
          email: updatedTechnician.email || '',
        });
      } catch (error: any) {
        console.error('Error updating company technician:', error);
        res.status(500).json({
          message: 'Failed to update technician',
          error: error.message,
        });
      }
    }
  );

  // Deletar técnico parceiro (remover vínculo)
  app.delete(
    '/api/company/technicians/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params; // ID do técnico (user_id)

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Buscar e deletar o vínculo
        const { error: deleteError } = await supabase
          .from('company_technicians')
          .delete()
          .eq('company_id', userId)
          .eq('technician_id', id);

        if (deleteError) {
          console.error('Error deleting company_technician:', deleteError);
          throw new Error('Erro ao remover vínculo');
        }

        // Nota: Não deletamos o usuário técnico, apenas removemos o vínculo com a empresa
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting company technician:', error);
        res.status(500).json({
          message: 'Failed to delete technician',
          error: error.message,
        });
      }
    }
  );

  // Dashboard da empresa
  app.get('/api/company/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'company') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { period = '30' } = req.query;

      // TODO: Calcular métricas reais
      // Por enquanto, retorna dados mockados
      res.json({
        partnerTechnicians: 0,
        partnerTechniciansChange: 0,
        managedClients: 0,
        managedClientsChange: 0,
        activeTickets: 0,
        activeTicketsChange: 0,
        consolidatedBilling: 0,
        consolidatedBillingChange: 0,
        invitationsSent: 0,
        invitationsReceived: 0,
        invitationsResponded: 0,
      });
    } catch (error: any) {
      console.error('Error fetching company dashboard:', error);
      res.status(500).json({
        message: 'Failed to fetch dashboard',
        error: error.message,
      });
    }
  });

  // Listar colaboradores da empresa
  app.get('/api/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'company') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      // Buscar colaboradores da empresa na tabela company_users
      const { data: companyUsers, error } = await supabase
        .from('company_users')
        .select('id, role, permissions, created_at, user_id')
        .eq('company_id', userId);

      if (error) {
        console.error('Error fetching company_users:', error);
        throw new Error('Erro ao buscar colaboradores');
      }

      // Buscar dados dos usuários relacionados
      const collaborators = await Promise.all(
        (companyUsers || []).map(async (cu: any) => {
          const user = await storage.getUser(cu.user_id);
          if (!user) return null;

          return {
            id: cu.id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: '', // TODO: Adicionar telefone \u00e0 tabela users ou company_users
            role: cu.role || 'analyst',
            status: 'active', // TODO: Adicionar campo de status
            profileImageUrl: user.profileImageUrl,
          };
        })
      );

      // Filtrar nulls
      const validCollaborators = collaborators.filter(
        (c) => c !== null
      ) as any[];

      res.json(validCollaborators);
    } catch (error: any) {
      console.error('Error fetching collaborators:', error);
      res.status(500).json({
        message: 'Failed to fetch collaborators',
        error: error.message,
      });
    }
  });

  // Criar colaborador (gera email baseado no email principal da empresa)
  app.post('/api/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, role, permissionProfile } = req.body;

      const companyUser = await storage.getUser(userId);
      if (!companyUser || companyUser.role !== 'company') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      if (!firstName || !lastName) {
        return res
          .status(400)
          .json({ message: 'Nome e sobrenome são obrigatórios' });
      }

      // Obter email base da empresa (remover sufixo +role, se houver)
      const baseEmailRaw = companyUser.email || '';
      const [localRaw, domain] = baseEmailRaw.split('@');
      if (!localRaw || !domain) {
        return res
          .status(400)
          .json({ message: 'Email base da empresa \u00e9 inv\u00e1lido' });
      }
      const plusIndexBase = localRaw.indexOf('+');
      const baseLocal =
        plusIndexBase >= 0 ? localRaw.slice(0, plusIndexBase) : localRaw;

      // Montar local-part a partir do nome do colaborador
      const clean = (text: string) =>
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s.]+/g, '')
          .replace(/\s+/g, '.')
          .replace(/\.+/g, '.')
          .replace(/^\.+|\.+$/g, '')
          .toLowerCase();

      const collaboratorLocalBase = clean(`${firstName}.${lastName}`);
      if (!collaboratorLocalBase) {
        return res.status(400).json({ message: 'Nome inválido para email' });
      }

      // Gerar email único
      let finalEmail =
        `${collaboratorLocalBase}.${baseLocal}@${domain}`.toLowerCase();
      let attempt = 1;
      while (true) {
        const existing = await storage.getUserByEmail(finalEmail);
        if (!existing) break;
        attempt += 1;
        finalEmail =
          `${collaboratorLocalBase}.${baseLocal}.${attempt}@${domain}`.toLowerCase();
        if (attempt > 50) {
          return res
            .status(400)
            .json({ message: 'Não foi possível gerar um email único' });
        }
      }

      // Criar usuário colaborador
      const newUserId = randomUUID();
      const newUser = await storage.upsertUser({
        id: newUserId,
        email: finalEmail,
        firstName,
        lastName,
        role: role || 'analyst',
      });

      // Gerar senha temporária e salvar credencial
      const tempPassword = randomBytes(6).toString('base64').slice(0, 10);
      const salt = randomBytes(16).toString('hex');
      const passwordHash = pbkdf2Sync(
        tempPassword,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const fullHash = `${salt}:${passwordHash}`;

      const { error: credError } = await supabase
        .from('user_credentials')
        .upsert(
          {
            id: randomUUID(),
            user_id: newUser.id,
            password_hash: fullHash,
            provider: 'email',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (credError) {
        console.error('[Collaborator] Erro ao salvar credencial:', credError);
        return res
          .status(500)
          .json({ message: 'Erro ao salvar credencial do colaborador' });
      }

      // Criar registro em company_users
      const { data, error } = await supabase
        .from('company_users')
        .insert({
          id: randomUUID(),
          company_id: userId,
          user_id: newUser.id,
          role: role || 'analyst',
          permissions: permissionProfile
            ? {
                profile: permissionProfile,
                ...(permissionProfile === 'analyst-basic' && {
                  tickets: { read: true, create: true },
                  clients: { read: true, create: true },
                }),
                ...(permissionProfile === 'analyst-full' && {
                  tickets: { read: true, create: true, update: true },
                  clients: { read: true, create: true, update: true },
                  reports: { read: true },
                }),
                ...(permissionProfile === 'financial-basic' && {
                  financial: { read: true },
                  payments: { read: true },
                }),
                ...(permissionProfile === 'financial-full' && {
                  financial: { read: true, create: true, update: true },
                  payments: { read: true, create: true, update: true },
                  reports: { read: true },
                }),
              }
            : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating company_user:', error);
        throw new Error('Erro ao criar colaborador');
      }

      res.json({
        id: data.id,
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        email: newUser.email,
        tempPassword,
        role: role || 'analyst',
        status: 'active',
        profileImageUrl: newUser.profileImageUrl,
      });
    } catch (error: any) {
      console.error('Error creating collaborator:', error);
      res.status(500).json({
        message: 'Failed to create collaborator',
        error: error.message,
      });
    }
  });

  // Atualizar colaborador
  app.patch(
    '/api/collaborators/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // TODO: Atualizar colaborador
        res.json({ id, ...updates });
      } catch (error: any) {
        console.error('Error updating collaborator:', error);
        res.status(500).json({
          message: 'Failed to update collaborator',
          error: error.message,
        });
      }
    }
  );

  // Deletar colaborador
  app.delete(
    '/api/collaborators/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // TODO: Deletar colaborador
        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting collaborator:', error);
        res.status(500).json({
          message: 'Failed to delete collaborator',
          error: error.message,
        });
      }
    }
  );

  // ========== Company Profiles (Perfis Fixos) ==========

  // Listar perfis da empresa
  app.get('/api/company/profiles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Permitir acesso para tenant principal (company) ou master admin
      if (!user || (user.role !== 'company' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      // Se for master admin, permitir ver perfis de qualquer empresa via query param
      const companyId =
        user.role === 'super_admin' ? req.query.companyId || userId : userId;

      const { data: profiles, error } = await supabase
        .from('company_profiles')
        .select('id, company_id, role, email, active, created_at, updated_at')
        .eq('company_id', companyId)
        .order('role', { ascending: true });

      if (error) {
        console.error('[PROFILES] Erro ao buscar perfis:', error);
        throw new Error('Erro ao buscar perfis');
      }

      // Não retornar password_hash por segurança
      const safeProfiles = (profiles || []).map((profile: any) => ({
        id: profile.id,
        companyId: profile.company_id,
        role: profile.role,
        email: profile.email,
        active: profile.active,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      }));

      res.json(safeProfiles);
    } catch (error: any) {
      console.error('[PROFILES] Erro ao listar perfis:', error);
      res.status(500).json({
        message: 'Erro ao listar perfis',
        error: error.message,
      });
    }
  });

  // Criar ou atualizar perfil (operational/financial)
  app.post('/api/company/profiles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { role, email, password } = req.body;

      const companyUser = await storage.getUser(userId);
      if (!companyUser || companyUser.role !== 'company') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      // Validar role
      if (role !== 'operational' && role !== 'financial') {
        return res.status(400).json({
          message: 'Role deve ser "operational" ou "financial"',
        });
      }

      // Verificar se já existe perfil com esse role
      const { data: existingProfile, error: checkError } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('company_id', userId)
        .eq('role', role)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = nenhum resultado encontrado (ok para criar novo)
        console.error(
          '[PROFILES] Erro ao verificar perfil existente:',
          checkError
        );
        throw new Error('Erro ao verificar perfil existente');
      }

      // Gerar email se não fornecido
      let finalEmail = email;
      if (!finalEmail) {
        const baseEmail = companyUser.email || '';
        const [localPart, domain] = baseEmail.split('@');
        if (!localPart || !domain) {
          return res.status(400).json({
            message: 'Email base da empresa \u00e9 inv\u00e1lido',
          });
        }
        // Remover sufixo +role se houver
        const cleanLocal = localPart.split('+')[0];
        finalEmail = `${role}@${domain}`.toLowerCase();
      }

      // Gerar senha se não fornecida
      let passwordHash: string | null = null;
      let generatedPassword: string | null = null;
      if (password) {
        const salt = randomBytes(16).toString('hex');
        const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString(
          'hex'
        );
        passwordHash = `${salt}:${hash}`;
      } else {
        // Gerar senha temporária
        generatedPassword = randomBytes(8).toString('base64').slice(0, 12);
        const salt = randomBytes(16).toString('hex');
        const hash = pbkdf2Sync(
          generatedPassword,
          salt,
          10000,
          64,
          'sha512'
        ).toString('hex');
        passwordHash = `${salt}:${hash}`;
      }

      if (existingProfile) {
        // Atualizar perfil existente
        const { data: updatedProfile, error: updateError } = await supabase
          .from('company_profiles')
          .update({
            email: finalEmail.toLowerCase(),
            password_hash: passwordHash,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id)
          .select('id, role, email, active')
          .single();

        if (updateError) {
          console.error('[PROFILES] Erro ao atualizar perfil:', updateError);
          throw new Error('Erro ao atualizar perfil');
        }

        res.json({
          id: updatedProfile.id,
          role: updatedProfile.role,
          email: updatedProfile.email,
          active: updatedProfile.active,
          tempPassword: generatedPassword,
          message: 'Perfil atualizado com sucesso',
        });
      } else {
        // Criar novo perfil
        const { data: newProfile, error: createError } = await supabase
          .from('company_profiles')
          .insert({
            id: randomUUID(),
            company_id: userId,
            role,
            email: finalEmail.toLowerCase(),
            password_hash: passwordHash,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, role, email, active')
          .single();

        if (createError) {
          console.error('[PROFILES] Erro ao criar perfil:', createError);
          throw new Error('Erro ao criar perfil');
        }

        res.status(201).json({
          id: newProfile.id,
          role: newProfile.role,
          email: newProfile.email,
          active: newProfile.active,
          tempPassword: generatedPassword,
          message: 'Perfil criado com sucesso',
        });
      }
    } catch (error: any) {
      console.error('[PROFILES] Erro ao criar/atualizar perfil:', error);
      res.status(500).json({
        message: 'Erro ao criar/atualizar perfil',
        error: error.message,
      });
    }
  });

  // Atualizar email/senha do perfil
  app.put(
    '/api/company/profiles/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const { email, password } = req.body;

        const companyUser = await storage.getUser(userId);
        if (!companyUser || companyUser.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o perfil pertence \u00e0 empresa
        const { data: profile, error: fetchError } = await supabase
          .from('company_profiles')
          .select('id, company_id, role, email')
          .eq('id', id)
          .eq('company_id', userId)
          .single();

        if (fetchError || !profile) {
          return res.status(404).json({ message: 'Perfil não encontrado' });
        }

        const updates: any = {
          updated_at: new Date().toISOString(),
        };

        if (email) {
          updates.email = email.toLowerCase();
        }

        if (password) {
          const salt = randomBytes(16).toString('hex');
          const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString(
            'hex'
          );
          updates.password_hash = `${salt}:${hash}`;
        }

        const { data: updatedProfile, error: updateError } = await supabase
          .from('company_profiles')
          .update(updates)
          .eq('id', id)
          .select('id, role, email, active')
          .single();

        if (updateError) {
          console.error('[PROFILES] Erro ao atualizar perfil:', updateError);
          throw new Error('Erro ao atualizar perfil');
        }

        res.json({
          id: updatedProfile.id,
          role: updatedProfile.role,
          email: updatedProfile.email,
          active: updatedProfile.active,
          message: 'Perfil atualizado com sucesso',
        });
      } catch (error: any) {
        console.error('[PROFILES] Erro ao atualizar perfil:', error);
        res.status(500).json({
          message: 'Erro ao atualizar perfil',
          error: error.message,
        });
      }
    }
  );

  // Desativar perfil (soft delete)
  app.delete(
    '/api/company/profiles/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const companyUser = await storage.getUser(userId);
        if (!companyUser || companyUser.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o perfil pertence \u00e0 empresa
        const { data: profile, error: fetchError } = await supabase
          .from('company_profiles')
          .select('id, company_id')
          .eq('id', id)
          .eq('company_id', userId)
          .single();

        if (fetchError || !profile) {
          return res.status(404).json({ message: 'Perfil não encontrado' });
        }

        // Soft delete: marcar como inativo
        const { error: updateError } = await supabase
          .from('company_profiles')
          .update({
            active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('[PROFILES] Erro ao desativar perfil:', updateError);
          throw new Error('Erro ao desativar perfil');
        }

        res.status(204).send();
      } catch (error: any) {
        console.error('[PROFILES] Erro ao desativar perfil:', error);
        res.status(500).json({
          message: 'Erro ao desativar perfil',
          error: error.message,
        });
      }
    }
  );

  // ========== Company Users (Colaboradores) ==========

  // Listar colaboradores da empresa
  app.get('/api/company/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'company') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { data: companyUsers, error } = await supabase
        .from('company_users')
        .select(
          `
          id,
          user_id,
          role,
          permissions,
          created_at,
          updated_at
        `
        )
        .eq('company_id', userId)
        .order('created_at', { ascending: false });

      // Buscar informações dos usuários separadamente
      if (companyUsers && companyUsers.length > 0) {
        const userIds = companyUsers.map((cu: any) => cu.user_id);
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, profile_image_url')
          .in('id', userIds);

        if (usersError) {
          throw usersError;
        }

        // Combinar dados
        const usersMap = new Map(users?.map((u: any) => [u.id, u]) || []);
        companyUsers.forEach((cu: any) => {
          const user = usersMap.get(cu.user_id);
          cu.user = user || null;
        });
      }

      if (error) {
        throw error;
      }

      const formattedUsers =
        companyUsers?.map((cu: any) => {
          const user = cu.user || {};
          return {
            id: cu.id,
            userId: cu.user_id,
            role: cu.role,
            permissions: cu.permissions,
            createdAt: cu.created_at,
            updatedAt: cu.updated_at,
            user: {
              id: user.id || cu.user_id,
              firstName: user.first_name || '',
              lastName: user.last_name || '',
              email: user.email || '',
              profileImageUrl: user.profile_image_url,
            },
          };
        }) || [];

      res.json(formattedUsers);
    } catch (error: any) {
      console.error('Error fetching company users:', error);
      res.status(500).json({
        message: 'Erro ao buscar colaboradores',
        error: error.message,
      });
    }
  });

  // Atualizar permissões de um colaborador
  app.put(
    '/api/company/users/:userId/permissions',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const companyUserId = req.user.id;
        const { userId } = req.params;
        const permissions = req.body;

        const companyUser = await storage.getUser(companyUserId);
        if (!companyUser || companyUser.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o colaborador pertence \u00e0 empresa
        const { data: companyUserRecord, error: checkError } = await supabase
          .from('company_users')
          .select('id')
          .eq('company_id', companyUserId)
          .eq('user_id', userId)
          .single();

        if (checkError || !companyUserRecord) {
          return res
            .status(404)
            .json({ message: 'Colaborador não encontrado' });
        }

        // Atualizar permissões
        const { error: updateError } = await supabase
          .from('company_users')
          .update({
            permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyUserRecord.id);

        if (updateError) {
          throw updateError;
        }

        res.json({ success: true, permissions });
      } catch (error: any) {
        console.error('Error updating permissions:', error);
        res.status(500).json({
          message: 'Erro ao atualizar permissões',
          error: error.message,
        });
      }
    }
  );

  // Deletar colaborador
  app.delete(
    '/api/company/users/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const companyUserId = req.user.id;
        const { id } = req.params;

        const companyUser = await storage.getUser(companyUserId);
        if (!companyUser || companyUser.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Verificar se o colaborador pertence \u00e0 empresa
        const { data: companyUserRecord, error: checkError } = await supabase
          .from('company_users')
          .select('id')
          .eq('company_id', companyUserId)
          .eq('id', id)
          .single();

        if (checkError || !companyUserRecord) {
          return res
            .status(404)
            .json({ message: 'Colaborador não encontrado' });
        }

        // Deletar colaborador
        const { error: deleteError } = await supabase
          .from('company_users')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        res.status(204).send();
      } catch (error: any) {
        console.error('Error deleting company user:', error);
        res.status(500).json({
          message: 'Erro ao remover colaborador',
          error: error.message,
        });
      }
    }
  );

  // Listar empresas disponíveis (para técnico)
  app.get(
    '/api/companies/available',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || user.role !== 'technician') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // Buscar todas as empresas do sistema (role = 'company')
        const allUsers = await storage.getAllUsers();
        const companies = allUsers
          .filter((u: any) => u.role === 'company')
          .map((u: any) => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            category: 'Serviços',
          }));

        res.json(companies);
      } catch (error: any) {
        console.error('Error fetching available companies:', error);
        res.status(500).json({
          message: 'Failed to fetch available companies',
          error: error.message,
        });
      }
    }
  );

  // Listar convites (recebidos ou enviados)
  app.get('/api/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type = 'received' } = req.query;

      // TODO: Buscar convites da tabela company_technicians ou company_partners
      // Por enquanto, retorna lista vazia
      res.json([]);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({
        message: 'Failed to fetch invitations',
        error: error.message,
      });
    }
  });

  // Enviar convite (técnico para empresa)
  app.post('/api/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ message: 'ID da empresa \u00e9 obrigatório' });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'technician') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      // TODO: Criar registro de convite na tabela company_partners
      res.json({
        message: 'Convite enviado com sucesso',
        invitationId: randomUUID(),
      });
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      res.status(500).json({
        message: 'Failed to send invitation',
        error: error.message,
      });
    }
  });

  // Responder convite
  app.put(
    '/api/invitations/:id/respond',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const { response } = req.body;

        if (!response || !['accept', 'reject'].includes(response)) {
          return res.status(400).json({ message: 'Resposta inválida' });
        }

        // TODO: Atualizar status do convite
        res.json({
          message: `Convite ${response === 'accept' ? 'aceito' : 'recusado'}`,
          status: response === 'accept' ? 'ACEITO' : 'RECUSADO',
        });
      } catch (error: any) {
        console.error('Error responding invitation:', error);
        res.status(500).json({
          message: 'Failed to respond invitation',
          error: error.message,
        });
      }
    }
  );

  // Listar convites pendentes da empresa
  app.get(
    '/api/company/invitations/pending',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user || user.role !== 'company') {
          return res.status(403).json({ message: 'Acesso negado' });
        }

        // TODO: Buscar convites pendentes
        res.json([]);
      } catch (error: any) {
        console.error('Error fetching pending invitations:', error);
        res.status(500).json({
          message: 'Failed to fetch pending invitations',
          error: error.message,
        });
      }
    }
  );

  // Atualizar perfil do usuario
  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const {
        firstName,
        lastName,
        companyName,
        email,
        publicSlug,
        phone,
        cpf,
        cnpj,
        birthDate,
        companyType,
        incomeValue,
        zipCode,
        streetAddress,
        addressNumber,
        addressComplement,
        neighborhood,
        city,
        state,
      } = req.body;

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        console.error(
          '[PATCH /api/user/profile] Usuario nao encontrado:',
          userId
        );
        return res.status(404).json({ message: 'User not found' });
      }

      const incomingCpf =
        cpf !== undefined ? normalizeDocumentValue(cpf) : '';
      const incomingCnpj =
        cnpj !== undefined ? normalizeDocumentValue(cnpj) : '';
      const existingCpf = normalizeDocumentValue((currentUser as any).cpf);
      const existingCnpj = normalizeDocumentValue((currentUser as any).cnpj);

      if (cpf !== undefined && !incomingCpf && existingCpf) {
        return res.status(400).json({
          message: 'CPF nao pode ser removido ou alterado.',
          code: 'CPF_IMMUTABLE',
        });
      }

      if (cnpj !== undefined && !incomingCnpj && existingCnpj) {
        return res.status(400).json({
          message: 'CNPJ nao pode ser removido ou alterado.',
          code: 'CNPJ_IMMUTABLE',
        });
      }

      if (incomingCpf && existingCpf && incomingCpf !== existingCpf) {
        return res.status(409).json({
          message: 'CPF ja cadastrado para este usuario.',
          code: 'CPF_IMMUTABLE',
        });
      }

      if (incomingCnpj && existingCnpj && incomingCnpj !== existingCnpj) {
        return res.status(409).json({
          message: 'CNPJ ja cadastrado para este usuario.',
          code: 'CNPJ_IMMUTABLE',
        });
      }

      if (incomingCpf && existingCnpj) {
        return res.status(409).json({
          message: 'Este usuario ja possui CNPJ cadastrado.',
          code: 'DOCUMENT_CONFLICT',
        });
      }

      if (incomingCnpj && existingCpf) {
        return res.status(409).json({
          message: 'Este usuario ja possui CPF cadastrado.',
          code: 'DOCUMENT_CONFLICT',
        });
      }

      if (incomingCpf || incomingCnpj) {
        const emailForChecks = normalizeEmailAddress(
          email || currentUser.email || ''
        ).toLowerCase();
        const emailUsers = await findUsersByNormalizedEmail(emailForChecks);

        if (incomingCpf) {
          const existingByCpf = await findUserByDocument(
            incomingCpf,
            'cpf',
            userId
          );
          if (existingByCpf) {
            return res.status(409).json({
              message: 'CPF ja cadastrado em outra conta.',
              code: 'CPF_ALREADY_USED',
            });
          }

          const emailCpf = emailUsers
            .filter((user) => user.id !== userId)
            .map((user) => normalizeDocumentValue(user?.cpf))
            .find((value) => value);
          if (emailCpf && emailCpf !== incomingCpf) {
            return res.status(409).json({
              message: 'Este email ja possui CPF cadastrado.',
              code: 'EMAIL_CPF_CONFLICT',
            });
          }
        }

        if (incomingCnpj) {
          const existingByCnpj = await findUserByDocument(
            incomingCnpj,
            'cnpj',
            userId
          );
          if (existingByCnpj) {
            return res.status(409).json({
              message: 'CNPJ ja cadastrado em outra conta.',
              code: 'CNPJ_ALREADY_USED',
            });
          }

          const emailCnpj = emailUsers
            .filter((user) => user.id !== userId)
            .map((user) => normalizeDocumentValue(user?.cnpj))
            .find((value) => value);
          if (emailCnpj && emailCnpj !== incomingCnpj) {
            return res.status(409).json({
              message: 'Este email ja possui CNPJ cadastrado.',
              code: 'EMAIL_CNPJ_CONFLICT',
            });
          }
        }
      }

      if (email !== undefined) {
        const currentUserEmail = currentUser.email || '';
        const currentEmailParts = currentUserEmail.split('+');
        const currentOriginalEmail =
          currentEmailParts.length > 1
            ? `${currentEmailParts[0]}@${currentUserEmail.split('@')[1]}`
            : currentUserEmail;

        if (email !== currentOriginalEmail) {
          const emailParts = email.split('@');
          const uniqueEmail = `${emailParts[0]}+${currentUser.role}@${emailParts[1]}`;
          const existingUser = await storage.getUserByEmail(uniqueEmail);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
              message: 'Este email ja esta em uso por outro usuario.',
            });
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Formato de email invalido.' });
          }
        }
      }

      if (publicSlug !== undefined) {
        if (!/^[a-z0-9-]+$/.test(publicSlug)) {
          return res.status(400).json({
            message: 'Public Slug deve conter apenas letras minusculas, numeros e hifens.',
          });
        }

        const existingUser = await storage.getUserBySlug(publicSlug);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({
            message: 'Este Public Slug ja esta em uso por outro usuario.',
          });
        }
      }

      const updateData: any = {};
      if (firstName !== undefined) {
        updateData.firstName = firstName === '' ? null : firstName;
      }
      if (lastName !== undefined) {
        updateData.lastName = lastName === '' ? null : lastName;
      }
      if (companyName !== undefined) {
        updateData.companyName = companyName === '' ? null : companyName;
        if (currentUser.companyName !== companyName) {
          updateData.publicSlug = undefined;
        }
      }
      if (email !== undefined) {
        const currentUserEmail = currentUser.email || '';
        const currentEmailParts = currentUserEmail.split('+');
        const currentOriginalEmail =
          currentEmailParts.length > 1
            ? `${currentEmailParts[0]}@${currentUserEmail.split('@')[1]}`
            : currentUserEmail;
        if (email !== currentOriginalEmail) {
          const emailParts = email.split('@');
          const uniqueEmail = `${emailParts[0]}+${currentUser.role}@${emailParts[1]}`;
          updateData.email = uniqueEmail;
        }
      }
      if (publicSlug !== undefined) {
        updateData.publicSlug = publicSlug;
      }

      if (Object.keys(updateData).length === 0) {
        const currentUserEmail = currentUser.email || '';
        const emailParts = currentUserEmail.split('+');
        const originalEmail =
          emailParts.length > 1
            ? `${emailParts[0]}@${currentUserEmail.split('@')[1]}`
            : currentUserEmail;
        return res.json({
          ...currentUser,
          email: originalEmail,
        });
      }

      const finalFirstName =
        updateData.firstName !== undefined
          ? updateData.firstName
          : currentUser.firstName;
      const finalCompanyName =
        updateData.companyName !== undefined
          ? updateData.companyName
          : currentUser.companyName;

      if (
        (finalFirstName && finalFirstName.trim() !== '') ||
        (finalCompanyName && finalCompanyName.trim() !== '')
      ) {
        updateData.profileCompleted = true;
      }

      const finalUpdateData = {
        ...updateData,
        companyLogoUrl:
          updateData.companyLogoUrl !== undefined
            ? updateData.companyLogoUrl
            : currentUser.companyLogoUrl,
        profileImageUrl:
          updateData.profileImageUrl !== undefined
            ? updateData.profileImageUrl
            : currentUser.profileImageUrl,
      };

      const updateDataWithExtras = {
        ...finalUpdateData,
        phone: phone !== undefined ? phone : undefined,
        cpf: cpf !== undefined ? cpf : undefined,
        cnpj: cnpj !== undefined ? cnpj : undefined,
        birthDate:
          birthDate !== undefined
            ? birthDate
              ? new Date(birthDate)
              : null
            : undefined,
        companyType: companyType !== undefined ? companyType : undefined,
        incomeValue: incomeValue !== undefined ? incomeValue : undefined,
        zipCode: zipCode !== undefined ? zipCode : undefined,
        streetAddress: streetAddress !== undefined ? streetAddress : undefined,
        addressNumber: addressNumber !== undefined ? addressNumber : undefined,
        addressComplement:
          addressComplement !== undefined ? addressComplement : undefined,
        neighborhood: neighborhood !== undefined ? neighborhood : undefined,
        city: city !== undefined ? city : undefined,
        state: state !== undefined ? state : undefined,
      };

      const updatedUser = await storage.upsertUser({
        id: userId,
        email: finalUpdateData.email || currentUser.email,
        role: currentUser.role,
        ...updateDataWithExtras,
      });

      if (email !== undefined && email !== currentUser.email) {
        const updatedUserEmail = updatedUser.email || '';
        const emailParts = updatedUserEmail.split('+');
        const originalEmail =
          emailParts.length > 1
            ? `${emailParts[0]}@${updatedUserEmail.split('@')[1]}`
            : updatedUserEmail;
        req.session.user = {
          ...req.session.user,
          email: originalEmail,
        };
      }

      const updatedUserEmail = updatedUser.email || '';
      const emailParts = updatedUserEmail.split('+');
      const originalEmail =
        emailParts.length > 1
          ? `${emailParts[0]}@${updatedUserEmail.split('@')[1]}`
          : updatedUserEmail;

      const responseData = {
        ...updatedUser,
        email: originalEmail,
      };

      res.json(responseData);
    } catch (error) {
      console.error('[PATCH /api/user/profile] Erro ao atualizar perfil:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Listar planos ativos
  app.get('/api/plans', isAuthenticated, async (req: any, res) => {
    try {
      const plans = await storage.getAllPlanTypes();
      const activePlans = plans.filter((plan) => plan.isActive !== false);
      const techOnlyPlans = activePlans.filter((plan) => {
        const role = typeof plan.role === 'string' ? plan.role.toLowerCase() : '';
        return role === 'technician' || role === 'tech';
      });
      const responsePlans =
        techOnlyPlans.length > 0 ? techOnlyPlans : activePlans;

      res.json(responsePlans);
    } catch (error: any) {
      console.error('[Plans] Erro ao listar planos:', error);
      res.status(500).json({
        message: 'Erro ao listar planos',
        error: error.message,
      });
    }
  });

  // Webhook do Stripe
  app.post('/api/stripe/webhook', async (req: any, res) => {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe nao configurado' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res
        .status(500)
        .json({ message: 'Stripe webhook secret nao configurado' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return res
        .status(400)
        .json({ message: 'Assinatura do webhook ausente' });
    }

    let event: Stripe.Event;
    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        return res.status(400).json({ message: 'Payload ausente' });
      }
      const bufferBody = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(rawBody);
      event = stripe.webhooks.constructEvent(
        bufferBody,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      console.error('[Stripe] Webhook invalido:', error);
      return res.status(400).json({ message: 'Webhook invalido' });
    }

    const mapStripeStatus = (
      status: Stripe.Subscription.Status
    ): 'active' | 'cancelled' | 'expired' | 'pending' => {
      if (status === 'active' || status === 'trialing') return 'active';
      if (status === 'canceled') return 'cancelled';
      if (status === 'unpaid' || status === 'incomplete_expired') {
        return 'expired';
      }
      return 'pending';
    };

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata || {};
          const normalizedEmail = normalizeEmailAddress(
            metadata.email ||
              session.customer_email ||
              session.customer_details?.email
          );
          const normalizedRole =
            normalizeSubscriptionRole(metadata.role) || 'technician';
          const planTypeId = metadata.planTypeId;
          const stripeCustomerId =
            typeof session.customer === 'string'
              ? session.customer
              : session.customer?.id;
          const stripeSubscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id;

          if (!normalizedEmail || !planTypeId) {
            console.error('[Stripe] Webhook checkout missing metadata:', {
              email: normalizedEmail,
              role: metadata.role,
              planTypeId,
            });
            break;
          }

          await supabase
            .from('subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Stripe upgrade',
            updated_at: new Date().toISOString(),
          })
          .eq('email', normalizedEmail)
          .eq('status', 'active');

          let existingId: string | null = null;
          if (stripeSubscriptionId) {
            const { data: existing } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('payment_gateway_subscription_id', stripeSubscriptionId)
              .maybeSingle();
            existingId = existing?.id || null;
          }

          const basePayload = {
            email: normalizedEmail,
            role: normalizedRole,
            planTypeId,
            status: 'active' as const,
            paymentGateway: 'stripe' as const,
            paymentGatewayCustomerId: stripeCustomerId || null,
            paymentGatewaySubscriptionId: stripeSubscriptionId || null,
            endDate: null,
            cancelledAt: null,
            cancellationReason: null,
            metadata: {
              sessionId: session.id,
              checkoutStatus: session.status,
            },
          };

          if (existingId) {
            await storage.updateSubscription(existingId, basePayload);
          } else {
            await storage.createSubscription({
              ...basePayload,
              startDate: new Date(),
            });
          }

          break;
        }
        case 'customer.subscription.updated': {
          const stripeSubscription =
            event.data.object as Stripe.Subscription;
          const stripeSubscriptionId = stripeSubscription.id;
          const stripeCustomerId =
            typeof stripeSubscription.customer === 'string'
              ? stripeSubscription.customer
              : stripeSubscription.customer?.id;
          const metadata = stripeSubscription.metadata || {};
          const normalizedRole =
            normalizeSubscriptionRole(metadata.role) || 'technician';
          const normalizedEmail = normalizeEmailAddress(metadata.email);
          let planTypeId = metadata.planTypeId;

          if (!planTypeId) {
            const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
            if (priceId) {
              const { data: plan } = await supabase
                .from('plan_types')
                .select('id')
                .eq('stripe_price_id', priceId)
                .maybeSingle();
              planTypeId = plan?.id;
            }
          }

          const status = mapStripeStatus(stripeSubscription.status);
          const endDate = stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000)
            : null;
          const cancelledAt = stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000)
            : null;

          const { data: existing } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('payment_gateway_subscription_id', stripeSubscriptionId)
            .maybeSingle();
          const existingId = existing?.id || null;

          const updatePayload = {
            status,
            paymentGateway: 'stripe' as const,
            paymentGatewayCustomerId: stripeCustomerId || null,
            paymentGatewaySubscriptionId: stripeSubscriptionId,
            endDate,
            cancelledAt,
            cancellationReason: cancelledAt ? 'Stripe cancel' : null,
          };

          if (existingId) {
            await storage.updateSubscription(existingId, {
              ...updatePayload,
              ...(planTypeId ? { planTypeId } : {}),
              ...(normalizedEmail ? { email: normalizedEmail } : {}),
              ...(normalizedRole ? { role: normalizedRole } : {}),
            });
          } else if (normalizedEmail && planTypeId) {
            await storage.createSubscription({
              email: normalizedEmail,
              role: normalizedRole,
              planTypeId,
              status,
              paymentGateway: 'stripe',
              paymentGatewayCustomerId: stripeCustomerId || null,
              paymentGatewaySubscriptionId: stripeSubscriptionId,
              startDate: new Date(),
              endDate,
              cancelledAt,
              cancellationReason: cancelledAt ? 'Stripe cancel' : null,
              metadata: {
                stripeStatus: stripeSubscription.status,
              },
            });
          }

          break;
        }
        case 'customer.subscription.deleted': {
          const stripeSubscription =
            event.data.object as Stripe.Subscription;
          const stripeSubscriptionId = stripeSubscription.id;

          const { data: existing } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('payment_gateway_subscription_id', stripeSubscriptionId)
            .maybeSingle();

          if (existing?.id) {
            const endDate = stripeSubscription.current_period_end
              ? new Date(stripeSubscription.current_period_end * 1000)
              : null;
            const cancelledAt = stripeSubscription.canceled_at
              ? new Date(stripeSubscription.canceled_at * 1000)
              : new Date();

            await storage.updateSubscription(existing.id, {
              status: 'cancelled',
              endDate,
              cancelledAt,
              cancellationReason: 'Stripe cancel',
              paymentGateway: 'stripe',
              paymentGatewaySubscriptionId: stripeSubscriptionId,
            });
          }

          break;
        }
        default:
          break;
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Stripe] Erro no webhook:', error);
      res.status(500).json({
        message: 'Erro no webhook',
        error: error.message,
      });
    }
  });

  const handleMercadoPagoWebhook = async (req: any, res: any) => {
    try {
      const topic = String(
        req.query?.topic || req.query?.type || req.body?.type || req.body?.topic || ''
      ).toLowerCase();
      const paymentIdRaw =
        req.query?.id || req.body?.data?.id || req.body?.id || '';
      const paymentId = String(paymentIdRaw || '').trim();
      const queryUserId = String(
        req.query?.user_id || req.query?.userId || ''
      ).trim();
      const queryRecordId = String(
        req.query?.record_id || req.query?.recordId || ''
      ).trim();
      const queryTicketId = String(
        req.query?.ticket_id || req.query?.ticketId || ''
      ).trim();

      if (!paymentId) {
        return res.json({ received: true });
      }

      if (topic && !topic.includes('payment')) {
        return res.json({ received: true });
      }

      let paymentData: any = null;
      if (queryUserId) {
        const tokenInfo = await getMercadoPagoAccessToken(queryUserId);
        if (!tokenInfo?.accessToken) {
          return res.json({ received: true });
        }
        paymentData = await fetchMercadoPagoPayment(
          tokenInfo.accessToken,
          paymentId
        );
      } else {
        const platformConfig = getPlatformMercadoPagoConfig();
        if (!platformConfig.accessToken) {
          return res.json({ received: true });
        }
        paymentData = await fetchMercadoPagoPayment(
          platformConfig.accessToken,
          paymentId
        );
      }

      const metadata = paymentData?.metadata || {};
      const purpose = String(metadata?.purpose || '').toLowerCase();
      const externalReference = String(paymentData?.external_reference || '');
      const referenceParts = externalReference.split(':');
      const fallbackUserId = referenceParts.length >= 3 ? referenceParts[1] : '';
      const fallbackPlanTypeId = referenceParts.length >= 3 ? referenceParts[2] : '';
      const status = String(paymentData?.status || '').toLowerCase();
      if (!['approved', 'accredited'].includes(status)) {
        return res.json({ received: true });
      }

      const userId = String(metadata?.user_id || fallbackUserId || '').trim();
      const planTypeId = String(
        metadata?.plan_type_id || fallbackPlanTypeId || ''
      ).trim();

      if (purpose === 'plan' || externalReference.startsWith('plan:')) {
        if (!userId || !planTypeId) {
          console.warn('[MercadoPago] Webhook sem user/plan:', {
            paymentId,
            externalReference,
            metadata,
          });
          return res.json({ received: true });
        }

        const user = await storage.getUser(userId);
        const planType = await storage.getPlanType(planTypeId);
        if (!user || !planType) {
          return res.json({ received: true });
        }

        await ensureMercadoPagoPlanSubscription({
          paymentId,
          paymentStatus: status,
          paymentMethodId: paymentData?.payment_method_id || null,
          amount: Number(paymentData?.transaction_amount || 0),
          monthsToAdd: Number(metadata?.months || metadata?.months_to_add || 1),
          discountPercent: Number(
            metadata?.discount_percent ?? metadata?.discountPercent ?? 0
          ),
          grossAmount: Number(
            metadata?.gross_amount ?? metadata?.grossAmount ?? 0
          ),
          user,
          planType,
        });

        return res.json({ received: true });
      }

      const ticketUserId = queryUserId || userId;
      if (!ticketUserId) {
        return res.json({ received: true });
      }

      let referenceId = String(
        queryRecordId ||
          metadata?.record_id ||
          metadata?.reference_id ||
          queryTicketId ||
          metadata?.ticket_id ||
          ''
      ).trim();
      if (!referenceId && externalReference && !externalReference.startsWith('plan:')) {
        referenceId = externalReference.trim();
      }

      if (!referenceId) {
        return res.json({ received: true });
      }

      const paidAt =
        paymentData?.date_approved || paymentData?.date_last_updated || null;
      const paidAtIso = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

      let updated = await markFinancialRecordPaid(
        ticketUserId,
        referenceId,
        paidAtIso
      );
      if (!updated && queryTicketId && referenceId !== queryTicketId) {
        updated = await markFinancialRecordPaid(
          ticketUserId,
          queryTicketId,
          paidAtIso
        );
      }

      if (!updated) {
        console.warn('[MercadoPago] Webhook sem registro financeiro:', {
          paymentId,
          referenceId,
          externalReference,
          metadata,
        });
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[MercadoPago] Erro no webhook:', error);
      res.status(500).json({
        message: 'Erro no webhook Mercado Pago',
        error: error.message,
      });
    }
  };

  app.post('/api/mercadopago/webhook', handleMercadoPagoWebhook);
  app.get('/api/mercadopago/webhook', handleMercadoPagoWebhook);

  // Obter assinatura atual do usuario (por email)
  app.get(
    '/api/subscriptions/mercadopago/config',
    isAuthenticated,
    async (req: any, res) => {
      const config = getPlatformMercadoPagoConfig();
      res.json({
        enabled: config.enabled,
        publicKey: config.publicKey,
      });
    }
  );

  app.post(
    '/api/subscriptions/mercadopago/charge',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const { planTypeId, formData } = req.body || {};
        if (!planTypeId) {
          return res.status(400).json({ message: 'ID do plano e obrigatorio' });
        }

        const planType = await storage.getPlanType(planTypeId);
        if (!planType) {
          return res.status(404).json({ message: 'Plano nao encontrado' });
        }

        const priceValue =
          typeof planType.price === 'string'
            ? parseFloat(planType.price)
            : Number(planType.price || 0);

        const rawMonths = Number(
          req.body?.months ?? req.body?.monthsToAdd ?? req.body?.renewalMonths ?? 1
        );
        const monthsToAdd = Number.isFinite(rawMonths)
          ? Math.max(1, Math.min(5, Math.round(rawMonths)))
          : 1;
        const discountPercent = Math.min(10, monthsToAdd * 2);
        const grossAmount = priceValue * monthsToAdd;
        const netAmount =
          Math.round((grossAmount * (1 - discountPercent / 100)) * 100) / 100;

        if (!priceValue || priceValue <= 0) {
          const subscription = await storage.createSubscription({
            email: normalizeEmailAddress(user.email),
            role: resolvePlanRoleForUser(user, planType),
            planTypeId,
            status: 'active',
            paymentGateway: 'manual',
            paymentGatewayCustomerId: null,
            paymentGatewaySubscriptionId: null,
            startDate: new Date(),
            endDate: computePlanEndDateFromMonths(
              planType,
              new Date(),
              monthsToAdd
            ),
            metadata: { source: 'manual' },
          });
          return res.json({ status: 'approved', subscription });
        }

        const platformConfig = getPlatformMercadoPagoConfig();
        if (!platformConfig.accessToken) {
          return res.status(500).json({
            message: 'Mercado Pago plataforma nao configurado',
          });
        }

        const paymentMethodId =
          formData?.payment_method_id ||
          formData?.paymentMethodId ||
          formData?.paymentMethod ||
          '';

        if (!paymentMethodId) {
          return res
            .status(400)
            .json({ message: 'Metodo de pagamento nao informado' });
        }

        const payerEmail =
          formData?.payer?.email ||
          formData?.payer_email ||
          formData?.email ||
          user.email ||
          '';
        if (!payerEmail) {
          return res
            .status(400)
            .json({ message: 'Email do pagador obrigatorio' });
        }

        const documentNumber = normalizeDocumentValue(
          formData?.payer?.identification?.number ||
            formData?.identification?.number ||
            formData?.document ||
            user?.cpf ||
            user?.cnpj ||
            ''
        );
        const documentType =
          documentNumber.length === 11
            ? 'CPF'
            : documentNumber.length === 14
              ? 'CNPJ'
              : null;
        if (!documentType) {
          return res
            .status(400)
            .json({ message: 'CPF ou CNPJ obrigatorio para pagamento' });
        }

        const subscriptionRole = resolvePlanRoleForUser(user, planType);
        const description = `Assinatura ${planType.name || 'Plano'} - ${
          monthsToAdd
        } mes${monthsToAdd > 1 ? 'es' : ''} (${
          discountPercent > 0 ? `${discountPercent}% off` : 'sem desconto'
        })`;

        const paymentPayload: Record<string, any> = {
          transaction_amount: netAmount,
          description,
          payment_method_id: paymentMethodId,
          external_reference: `plan:${userId}:${planTypeId}`,
          payer: {
            email: payerEmail,
            identification: {
              type: documentType,
              number: documentNumber,
            },
          },
          metadata: {
            purpose: 'plan',
            user_id: userId,
            email: normalizeEmailAddress(user.email),
            plan_type_id: planTypeId,
            role: subscriptionRole,
            billing_cycle: planType.billingCycle || 'monthly',
            months: monthsToAdd,
            discount_percent: discountPercent,
            gross_amount: grossAmount,
            net_amount: netAmount,
          },
        };

        const webhookBaseUrl = (
          process.env.BASE_URL || getRequestBaseUrl(req)
        ).replace(/\/+$/, '');
        if (webhookBaseUrl) {
          paymentPayload.notification_url = `${webhookBaseUrl}/api/mercadopago/webhook`;
        }

        if (formData?.token) {
          paymentPayload.token = formData.token;
        }
        if (formData?.issuer_id) {
          paymentPayload.issuer_id = formData.issuer_id;
        }
        if (formData?.installments) {
          paymentPayload.installments = Number(formData.installments);
        }

        const paymentData = await createMercadoPagoPayment(
          platformConfig.accessToken,
          paymentPayload
        );

        const normalizedStatus = String(paymentData?.status || '');
        let subscription: any = null;
        if (
          normalizedStatus === 'approved' ||
          normalizedStatus === 'accredited'
        ) {
          subscription = await ensureMercadoPagoPlanSubscription({
            paymentId: paymentData?.id,
            paymentStatus: normalizedStatus,
            paymentMethodId: paymentMethodId || null,
            amount: netAmount,
            monthsToAdd,
            discountPercent,
            grossAmount,
            user,
            planType,
          });
        }

        const transactionData =
          paymentData?.point_of_interaction?.transaction_data || {};
        const pixPayload = transactionData.qr_code || null;
        const qrCodeBase64 = transactionData.qr_code_base64 || '';
        const qrCodeDataUrl = qrCodeBase64
          ? `data:image/png;base64,${qrCodeBase64}`
          : null;

        res.json({
          status: paymentData?.status || null,
          statusDetail: paymentData?.status_detail || null,
          paymentId: paymentData?.id || null,
          pixPayload,
          qrCodeDataUrl,
          months: monthsToAdd,
          discountPercent,
          grossAmount,
          netAmount,
          subscription,
        });
      } catch (error: any) {
        console.error('[Subscriptions] Erro ao cobrar com MP:', error);
        res.status(500).json({
          message: error?.message || 'Falha ao processar pagamento',
        });
      }
    }
  );

  // Obter assinatura atual do usuario (por email)
  app.get('/api/subscriptions/current', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: 'Nao autenticado' });
      }

      const originalEmail = normalizeEmailAddress(user.email);
      if (!originalEmail) {
        return res.status(400).json({
          message: 'Email invalido',
          hasSubscription: false,
        });
      }

      const subscriptions = await storage.getSubscriptionsByEmail(originalEmail);
      const now = new Date();
      const activeSubscription = (subscriptions || [])
        .filter((sub) => isSubscriptionActive(sub, now))
        .sort((a, b) => {
          const aDate = new Date(a.startDate || a.createdAt || 0).getTime();
          const bDate = new Date(b.startDate || b.createdAt || 0).getTime();
          return bDate - aDate;
        })[0];

      if (!activeSubscription) {
        return res.json(null);
      }

      const planType = await storage.getPlanType(activeSubscription.planTypeId);
      res.json({
        ...activeSubscription,
        planType,
        hasSubscription: true,
      });
    } catch (error: any) {
      console.error('[Subscriptions] Erro ao obter assinatura:', error);
      res.status(500).json({
        message: 'Erro ao obter assinatura',
        error: error.message,
      });
    }
  });

  // Listar todas as assinaturas do usuario
  app.get('/api/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: 'Nao autenticado' });
      }

      const originalEmail = normalizeEmailAddress(user.email);
      if (!originalEmail) {
        return res.status(400).json({ message: 'Email invalido' });
      }

      const subscriptions = await storage.getSubscriptionsByEmail(
        originalEmail
      );

      // Enriquecer com informações dos planos
      const enriched = await Promise.all(
        subscriptions.map(async (sub) => {
          const planType = await storage.getPlanType(sub.planTypeId);
          return {
            ...sub,
            planType,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error('[Subscriptions] Erro ao listar assinaturas:', error);
      res.status(500).json({
        message: 'Erro ao listar assinaturas',
        error: error.message,
      });
    }
  });

  // Criar nova assinatura
  app.post('/api/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: 'Nao autenticado' });
      }

      const { planTypeId } = req.body;

      if (!planTypeId) {
        return res.status(400).json({ message: 'ID do plano e obrigatorio' });
      }

      const planType = await storage.getPlanType(planTypeId);
      if (!planType) {
        return res.status(404).json({ message: 'Plano nao encontrado' });
      }

      const normalizedPlanRole = normalizeSubscriptionRole(planType.role);
      const subscriptionRole = 'technician';
      if (normalizedPlanRole && normalizedPlanRole !== 'technician') {
        return res.status(400).json({
          message: 'Plano indisponivel no momento',
        });
      }

      const originalEmail = normalizeEmailAddress(user.email);
      if (!originalEmail) {
        return res.status(400).json({ message: 'Email invalido' });
      }

      const priceValue =
        typeof planType.price === 'string'
          ? parseFloat(planType.price)
          : Number(planType.price || 0);

      const stripe = getStripeClient();
      if (!stripe && priceValue > 0) {
        return res.status(500).json({ message: 'Stripe nao configurado' });
      }

      if (priceValue > 0 && !planType.stripePriceId) {
        return res.status(400).json({ message: 'Plano nao configurado no Stripe' });
      }

      if (priceValue <= 0 || !planType.stripePriceId) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Upgrade manual',
            updated_at: new Date().toISOString(),
          })
          .eq('email', originalEmail)
          .eq('status', 'active');

        const subscription = await storage.createSubscription({
          email: originalEmail,
          role: subscriptionRole,
          planTypeId,
          status: 'active',
          paymentGateway: priceValue > 0 ? 'stripe' : 'manual',
          paymentGatewayCustomerId: null,
          paymentGatewaySubscriptionId: null,
          startDate: new Date(),
          endDate: null,
          metadata: null,
        });

        return res.status(201).json({
          ...subscription,
          planType,
        });
      }

      const { data: lastSubscription } = await supabase
        .from('subscriptions')
        .select('payment_gateway_customer_id')
        .eq('email', originalEmail)
        .order('created_at', { ascending: false } as any)
        .limit(1)
        .maybeSingle();

      const customerId =
        lastSubscription?.payment_gateway_customer_id || undefined;

      const baseUrl = getRequestBaseUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: planType.stripePriceId, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : originalEmail,
        allow_promotion_codes: true,
        success_url: `${baseUrl}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/planos?checkout=cancel`,
        client_reference_id: user.id,
        metadata: {
          planTypeId,
          email: originalEmail,
          role: subscriptionRole,
        },
        subscription_data: {
          metadata: {
            planTypeId,
            email: originalEmail,
            role: subscriptionRole,
          },
        },
      });

      if (!session.url) {
        return res.status(500).json({ message: 'Falha ao iniciar checkout' });
      }

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Subscriptions] Erro ao criar assinatura:', error);
      res.status(500).json({
        message: 'Erro ao criar assinatura',
        error: error.message,
      });
    }
  });
  // Portal de cobranca Stripe
  app.post('/api/stripe/billing-portal', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: 'Nao autenticado' });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(500).json({ message: 'Stripe nao configurado' });
      }

      const originalEmail = normalizeEmailAddress(user.email);
      if (!originalEmail) {
        return res.status(400).json({ message: 'Email invalido' });
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('payment_gateway_customer_id')
        .eq('email', originalEmail)
        .eq('payment_gateway', 'stripe')
        .order('created_at', { ascending: false } as any)
        .limit(1)
        .maybeSingle();

      const customerId = subscription?.payment_gateway_customer_id;
      if (!customerId) {
        return res
          .status(404)
          .json({ message: 'Nenhuma assinatura Stripe encontrada' });
      }

      const baseUrl = getRequestBaseUrl(req);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/planos`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error('[Stripe] Erro ao abrir portal:', error);
      res.status(500).json({
        message: 'Erro ao abrir portal de cobranca',
        error: error.message,
      });
    }
  });

  // Cancelar assinatura
  app.post(
    '/api/subscriptions/:id/cancel',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = req.session.user;
        if (!user) {
          return res.status(401).json({ message: 'Nao autenticado' });
        }

        const { id } = req.params;
        const { reason } = req.body;

        const subscription = await storage.getSubscription(id);
        if (!subscription) {
          return res.status(404).json({ message: 'Assinatura nao encontrada' });
        }

        const originalEmail = normalizeEmailAddress(user.email);
        if (!originalEmail) {
          return res.status(400).json({
            message: 'Email invalido',
          });
        }

        if (
          subscription.email !== originalEmail
        ) {
          return res.status(403).json({
            message: 'Voce nao tem permissao para cancelar esta assinatura',
          });
        }

        if (
          subscription.paymentGateway === 'stripe' &&
          subscription.paymentGatewaySubscriptionId
        ) {
          const stripe = getStripeClient();
          if (!stripe) {
            return res.status(500).json({ message: 'Stripe nao configurado' });
          }

          const stripeSubscription = await stripe.subscriptions.update(
            subscription.paymentGatewaySubscriptionId,
            { cancel_at_period_end: true }
          );

          const endDate = stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000)
            : null;

          await storage.updateSubscription(id, {
            status: 'active',
            cancelledAt: new Date(),
            cancellationReason: reason || null,
            endDate,
            paymentGateway: 'stripe',
            paymentGatewaySubscriptionId: stripeSubscription.id,
          });

          return res.json(true);
        }

        const cancelled = await storage.cancelSubscription(id);
        if (!cancelled) {
          return res
            .status(500)
            .json({ message: 'Erro ao cancelar assinatura' });
        }

        if (reason) {
          await storage.updateSubscription(id, {
            cancellationReason: reason,
            cancelledAt: new Date(),
          });
        }

        res.json(cancelled);
      } catch (error: any) {
        console.error('[Subscriptions] Erro ao cancelar assinatura:', error);
        res.status(500).json({
          message: 'Erro ao cancelar assinatura',
          error: error.message,
        });
      }
    }
  );
// Atualizar assinatura (apenas super admin)
  app.patch('/api/subscriptions/:id', isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updated = await storage.updateSubscription(id, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Assinatura não encontrada' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[Subscriptions] Erro ao atualizar assinatura:', error);
      res.status(500).json({
        message: 'Erro ao atualizar assinatura',
        error: error.message,
      });
    }
  });

  // ==================== MASTER ADMIN ROUTES ====================

  // Estatísticas do sistema
  app.get('/api/master-admin/stats', isSuperAdmin, async (req: any, res) => {
    try {
      console.log('[Master Admin Stats] Iniciando busca de estatísticas...');

      // Buscar todos os usuários usando storage
      const allUsers = await storage.getAllUsers();
      console.log(
        '[Master Admin Stats] Total de usuários encontrados:',
        allUsers.length
      );

      const technicians = allUsers.filter((u) => u.role === 'technician');
      const companies = allUsers.filter((u) => u.role === 'company');
      const superAdmins = allUsers.filter((u) => u.role === 'super_admin');

      console.log('[Master Admin Stats] Técnicos:', technicians.length);
      console.log('[Master Admin Stats] Empresas:', companies.length);
      console.log('[Master Admin Stats] Super Admins:', superAdmins.length);

      // Buscar assinaturas ativas
      let activeSubscriptionsCount = 0;
      try {
        const { data: activeSubscriptions, error: subError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('status', 'active');

        if (subError) {
          console.warn(
            '[Master Admin Stats] Erro ao buscar assinaturas:',
            subError
          );
        } else {
          activeSubscriptionsCount = activeSubscriptions?.length || 0;
          console.log(
            '[Master Admin Stats] Assinaturas ativas:',
            activeSubscriptionsCount
          );
        }
      } catch (subError: any) {
        console.warn(
          '[Master Admin Stats] Erro ao buscar assinaturas:',
          subError
        );
      }

      // Informações do banco de dados
      // Calcular tamanho estimado baseado nos registros
      let databaseSize = 0;
      let databaseCapacity = 10737418240; // 10GB padrão

      try {
        // Estimar tamanho baseado em diferentes tipos de registros
        const estimatedSizePerUser = 10240; // ~10KB por usuário
        const estimatedSizePerTicket = 5120; // ~5KB por ticket
        const estimatedSizePerClient = 2048; // ~2KB por cliente
        const estimatedSizePerService = 1024; // ~1KB por serviço

        // Buscar contagens de outras tabelas para estimativa mais precisa
        const [ticketsResult, clientsResult, servicesResult] =
          await Promise.all([
            supabase
              .from('tickets')
              .select('*', { count: 'exact', head: true }),
            supabase
              .from('clients')
              .select('*', { count: 'exact', head: true }),
            supabase
              .from('services')
              .select('*', { count: 'exact', head: true }),
          ]);

        const tickets = (ticketsResult as any).count || 0;
        const clients = (clientsResult as any).count || 0;
        const services = (servicesResult as any).count || 0;

        databaseSize =
          allUsers.length * estimatedSizePerUser +
          tickets * estimatedSizePerTicket +
          clients * estimatedSizePerClient +
          services * estimatedSizePerService;

        console.log(
          '[Master Admin Stats] Tamanho estimado do banco:',
          databaseSize,
          'bytes'
        );
      } catch (error: any) {
        console.warn(
          '[Master Admin Stats] Não foi possível calcular tamanho do banco:',
          error
        );
        // Fallback: estimativa simples baseada apenas em usuários
        databaseSize = allUsers.length * 10240;
      }

      const stats = {
        totalTechnicians: technicians.length,
        totalCompanies: companies.length,
        totalUsers: allUsers.length,
        activeSubscriptions: activeSubscriptionsCount,
        databaseSize,
        databaseCapacity,
      };

      console.log('[Master Admin Stats] Estatísticas finais:', stats);

      res.json(stats);
    } catch (error: any) {
      console.error('[Master Admin Stats] Erro ao buscar estatísticas:', error);
      console.error('[Master Admin Stats] Stack:', error.stack);
      res.status(500).json({
        message: 'Erro ao buscar estatísticas',
        error: error.message,
      });
    }
  });

  // Chaves de API
  app.patch(
    '/api/master-admin/api-keys/:service',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { service } = req.params;
        const { action, apiKey } = req.body;

        if (!action || !['update', 'revoke'].includes(action)) {
          return res.status(400).json({
            message: 'Ação inválida. Use "update" ou "revoke"',
          });
        }

        if (action === 'update' && !apiKey) {
          return res.status(400).json({
            message: 'Chave de API \u00e9 obrigatória para atualização',
          });
        }

        // Importar o gerenciador de .env
        const {
          updateEnvVariable,
          revokeEnvVariable,
        } = require('./utils/env-manager');

        if (action === 'update') {
          updateEnvVariable(service, apiKey);
          res.json({
            message: `Chave de API ${service} atualizada com sucesso no arquivo .env`,
            success: true,
          });
        } else if (action === 'revoke') {
          revokeEnvVariable(service);
          res.json({
            message: `Chave de API ${service} revogada no arquivo .env`,
            success: true,
          });
        }
      } catch (error: any) {
        console.error('[Master Admin] Erro ao atualizar chave de API:', error);
        res.status(500).json({
          message: 'Erro ao atualizar chave de API',
          error: error.message,
        });
      }
    }
  );

  app.get('/api/master-admin/api-keys', isSuperAdmin, async (req: any, res) => {
    try {
      const apiKeys = [
        {
          id: '1',
          service: 'Asaas',
          key: process.env.ASAAS_API_KEY
            ? `${process.env.ASAAS_API_KEY.substring(0, 20)}...`
            : 'Não configurada',
          status: process.env.ASAAS_API_KEY ? 'active' : 'pending',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: '2',
          service: 'Google OAuth',
          key: process.env.GOOGLE_CLIENT_ID
            ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`
            : 'Não configurada',
          status: process.env.GOOGLE_CLIENT_ID ? 'active' : 'pending',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: '3',
          service: 'BrasilAPI',
          key: 'br_api_s6t7u8v9...wxy',
          status: 'revoked',
          lastUpdated: new Date().toISOString(),
        },
        {
          id: '4',
          service: 'Stripe',
          key: process.env.STRIPE_SECRET_KEY
            ? `${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...`
            : 'Não configurada',
          status: process.env.STRIPE_SECRET_KEY ? 'active' : 'pending',
          lastUpdated: new Date().toISOString(),
        },
      ];

      res.json(apiKeys);
    } catch (error: any) {
      console.error('[Master Admin] Erro ao buscar chaves de API:', error);
      res.status(500).json({
        message: 'Erro ao buscar chaves de API',
        error: error.message,
      });
    }
  });

  // Configurações do banco de dados
  app.get('/api/master-admin/database', isSuperAdmin, async (req: any, res) => {
    try {
      let currentSize = 0;
      let maxCapacity = 0;
      let tableStats: Array<{
        tableName: string;
        size: number;
        rowCount: number;
      }> = [];

      try {
        // Buscar tamanho real do banco usando SQL direto com pool
        const dbSizeResult = await pool.query(`
          SELECT 
            pg_database_size(current_database()) as size_bytes,
            pg_size_pretty(pg_database_size(current_database())) as size_pretty
        `);

        if (dbSizeResult.rows && dbSizeResult.rows.length > 0) {
          const sizeBytes = dbSizeResult.rows[0].size_bytes;
          if (typeof sizeBytes === 'number') {
            currentSize = sizeBytes;
          } else if (typeof sizeBytes === 'string') {
            currentSize = parseInt(sizeBytes, 10) || 0;
          }
        }

        // Buscar tamanho de cada tabela
        const tableSizeResult = await pool.query(`
          SELECT 
            schemaname || '.' || tablename as table_name,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `);

        // Buscar contagem de linhas para cada tabela
        if (tableSizeResult.rows && Array.isArray(tableSizeResult.rows)) {
          for (const row of tableSizeResult.rows) {
            const tableName = row.table_name?.replace('public.', '') || '';
            if (!tableName) continue;

            try {
              // Usar query simples (tableName já foi validado)
              const countResult = await pool.query(
                `SELECT COUNT(*)::bigint as count FROM "${tableName}"`
              );
              const rowCount = countResult.rows?.[0]?.count
                ? parseInt(String(countResult.rows[0].count), 10)
                : 0;

              const sizeBytes =
                typeof row.size_bytes === 'number'
                  ? row.size_bytes
                  : parseInt(String(row.size_bytes || '0'), 10);

              if (sizeBytes > 0) {
                tableStats.push({
                  tableName,
                  size: sizeBytes,
                  rowCount,
                });
              }
            } catch (countError: any) {
              // Ignorar erros ao contar linhas (pode ser view ou tabela sem permissão)
              console.warn(
                `[Master Admin] Erro ao contar linhas da tabela ${tableName}:`,
                countError.message
              );
            }
          }
        }

        // Capacidade máxima padrão (10GB - pode ser ajustado conforme o plano do Supabase)
        maxCapacity = 10737418240; // 10GB padrão
      } catch (error: any) {
        console.warn(
          '[Master Admin] Erro ao calcular tamanho do banco, usando estimativa:',
          error.message
        );

        // Fallback: estimativa baseada em contagens usando API REST
        try {
          const allUsers = await storage.getAllUsers();
          const estimatedSizePerUser = 10240; // ~10KB por usuário (estimativa)
          currentSize = allUsers.length * estimatedSizePerUser;
          maxCapacity = 10737418240; // 10GB padrão
        } catch (fallbackError) {
          console.error('[Master Admin] Erro no fallback:', fallbackError);
          currentSize = 0;
          maxCapacity = 10737418240;
        }
      }

      res.json({
        currentSize,
        maxCapacity,
        tableStats,
      });
    } catch (error: any) {
      console.error(
        '[Master Admin] Erro ao buscar configurações do banco:',
        error
      );
      res.status(500).json({
        message: 'Erro ao buscar configurações do banco',
        error: error.message,
      });
    }
  });

  // Listar todos os usuários (master admin)
  // Rotas de Gerenciamento de Planos (Master Admin)
  app.get('/api/master-admin/plans', isSuperAdmin, async (req: any, res) => {
    try {
      console.log('[Master Admin] Buscando todos os planos...');
      const allPlans = await storage.getAllPlanTypes();
      console.log('[Master Admin] Planos encontrados:', allPlans.length);
      res.json(allPlans);
    } catch (error: any) {
      console.error('[Master Admin] Erro ao buscar planos:', error);
      console.error('[Master Admin] Stack:', error.stack);
      res.status(500).json({
        message: 'Erro ao buscar planos',
        error: error.message,
      });
    }
  });

  app.post('/api/master-admin/plans', isSuperAdmin, async (req: any, res) => {
    try {
      console.log('[Master Admin] ========== INÍCIO DA REQUISIÇÃO ==========');
      console.log(
        '[Master Admin] Headers:',
        JSON.stringify(req.headers, null, 2)
      );
      console.log(
        '[Master Admin] Body completo:',
        JSON.stringify(req.body, null, 2)
      );
      console.log('[Master Admin] Content-Type:', req.headers['content-type']);
      console.log('[Master Admin] req.body existe?', !!req.body);
      console.log(
        '[Master Admin] req.body é objeto?',
        typeof req.body === 'object' && !Array.isArray(req.body)
      );
      console.log('[Master Admin] req.body é null?', req.body === null);
      console.log(
        '[Master Admin] req.body é undefined?',
        req.body === undefined
      );

      // Verificar se req.body está vazio ou inválido
      if (
        !req.body ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body)
      ) {
        console.error('[Master Admin] req.body INVÁLIDO');
        console.error('[Master Admin] req.body:', req.body);
        console.error('[Master Admin] Tipo:', typeof req.body);
        return res.status(400).json({
          message: 'Dados do plano não foram recebidos corretamente',
        });
      }

      const planData = req.body;

      // Validar campos obrigatórios com mensagens mais específicas
      console.log('[Master Admin] ========== VALIDAÇÃO ==========');
      console.log(
        '[Master Admin] req.body completo:',
        JSON.stringify(req.body, null, 2)
      );
      console.log(
        '[Master Admin] planData completo:',
        JSON.stringify(planData, null, 2)
      );
      console.log('[Master Admin] Tipo de req.body:', typeof req.body);
      console.log('[Master Admin] array?', Array.isArray(req.body));
      console.log(
        '[Master Admin] Chaves de planData:',
        Object.keys(planData || {})
      );
      console.log('[Master Admin] Validando dados recebidos:', {
        name: planData?.name,
        nameValue: JSON.stringify(planData?.name),
        nameType: typeof planData?.name,
        nameLength: planData?.name?.length,
        nameExists: !!planData?.name,
        price: planData?.price,
        priceValue: JSON.stringify(planData?.price),
        priceType: typeof planData?.price,
        priceExists: planData?.price !== undefined && planData?.price !== null,
        role: planData?.role,
        roleValue: JSON.stringify(planData?.role),
        roleType: typeof planData?.role,
        roleExists: !!planData?.role,
        bodyKeys: Object.keys(planData || {}),
      });

      // Verificar se name existe e \u00e9 v\u00e1lido
      const nameValue = planData.name;
      const nameTrimmed = typeof nameValue === 'string' ? nameValue.trim() : '';

      console.log('[Master Admin] Verificando name:', {
        exists: !!nameValue,
        type: typeof nameValue,
        value: nameValue,
        valueStringified: JSON.stringify(nameValue),
        trimmed: nameTrimmed,
        trimmedLength: nameTrimmed.length,
        isEmpty: nameTrimmed === '',
      });

      if (!nameValue || typeof nameValue !== 'string' || nameTrimmed === '') {
        console.error('[Master Admin] Nome inválido:', {
          value: nameValue,
          type: typeof nameValue,
          exists: !!nameValue,
          trimmed: nameTrimmed,
          trimmedLength: nameTrimmed.length,
        });
        return res.status(400).json({
          message: 'Nome do plano \u00e9 obrigatório',
        });
      }
      console.log('[Master Admin] Nome válido:', nameTrimmed);

      // Atualizar planData.name com o valor trimado
      planData.name = nameTrimmed;

      // Aceitar preço zero (0) como válido - verificar apenas undefined/null/string vazia
      const rawPriceValue = planData?.price;
      console.log('[Master Admin] ========== VALIDANDO PRICE ==========');
      console.log('[Master Admin] rawPriceValue:', rawPriceValue);
      console.log('[Master Admin] rawPriceValue type:', typeof rawPriceValue);
      console.log('[Master Admin] isUndefined:', rawPriceValue === undefined);
      console.log('[Master Admin] isNull:', rawPriceValue === null);
      console.log('[Master Admin] isEmptyString:', rawPriceValue === '');
      console.log('[Master Admin] isZero:', rawPriceValue === 0);
      console.log('[Master Admin] isNumber:', typeof rawPriceValue === 'number');

      if (
        rawPriceValue === undefined ||
        rawPriceValue === null ||
        rawPriceValue === ''
      ) {
        console.error('[Master Admin] PREÇO INVÁLIDO');
        console.error('[Master Admin] Detalhes:', {
          value: rawPriceValue,
          type: typeof rawPriceValue,
          isUndefined: rawPriceValue === undefined,
          isNull: rawPriceValue === null,
          isEmptyString: rawPriceValue === '',
        });
        return res.status(400).json({
          message: 'Preço \u00e9 obrigatório',
        });
      }
      console.log('[Master Admin] PREÇO VÁLIDO:', rawPriceValue);

      // Verificar role - normalizar para string e trim
      // Aceitar valores antigos e normalizar para tech (plano unico)
      let roleValue = planData.role;
      if (typeof roleValue === 'string') {
        roleValue = roleValue.trim().toLowerCase();
      }

      console.log('[Master Admin] Verificando role:', {
        originalValue: planData.role,
        normalizedValue: roleValue,
        type: typeof roleValue,
        exists: !!roleValue,
      });

      // Converter valores antigos para tech (plano unico)
      if (roleValue === 'technician' || roleValue === 'company') {
        roleValue = 'tech';
      }

      if (!roleValue || roleValue !== 'tech') {
        console.error('[Master Admin] Role inválido:', {
          originalValue: planData.role,
          normalizedValue: roleValue,
          type: typeof roleValue,
          exists: !!roleValue,
        });
        return res.status(400).json({
          message: 'Tipo de plano \u00e9 obrigatório e deve ser "tech"',
        });
      }
      console.log('[Master Admin] Role válido:', roleValue);

      // Atualizar planData.role com o valor normalizado (novo formato)
      planData.role = roleValue;

      // Se chegou até aqui, todos os campos obrigatórios estão válidos
      console.log(
        '[Master Admin] TODOS OS CAMPOS OBRIGATÓRIOS VÁLIDOS!'
      );

      // Converter price para número se for string
      if (typeof planData.price === 'string') {
        planData.price = parseFloat(planData.price);
      }

      // Validar se price \u00e9 um n\u00famero válido
      if (
        typeof planData.price !== 'number' ||
        isNaN(planData.price) ||
        planData.price < 0
      ) {
        console.error(
          '[Master Admin] Preço não \u00e9 um n\u00famero válido:',
          planData.price
        );
        return res.status(400).json({
          message: 'Preço deve ser um número válido maior ou igual a zero',
        });
      }

      // Converter limites para números ou null
      if (planData.maxClients === '' || planData.maxClients === null) {
        planData.maxClients = null;
      } else if (typeof planData.maxClients === 'string') {
        planData.maxClients = parseInt(planData.maxClients);
      }

      if (planData.maxTickets === '' || planData.maxTickets === null) {
        planData.maxTickets = null;
      } else if (typeof planData.maxTickets === 'string') {
        planData.maxTickets = parseInt(planData.maxTickets);
      }

      if (planData.maxUsers === '' || planData.maxUsers === null) {
        planData.maxUsers = null;
      } else if (typeof planData.maxUsers === 'string') {
        planData.maxUsers = parseInt(planData.maxUsers);
      }

      // Converter features para JSON se for array
      if (Array.isArray(planData.features) && planData.features.length === 0) {
        planData.features = null;
      }

      console.log(
        '[Master Admin] Dados processados:',
        JSON.stringify(planData, null, 2)
      );
      const stripe = getStripeClient();
      const priceValue =
        typeof planData.price === 'string'
          ? parseFloat(planData.price)
          : planData.price;
      const billingCycle =
        typeof planData.billingCycle === 'string' &&
        ['monthly', 'yearly'].includes(planData.billingCycle)
          ? planData.billingCycle
          : 'monthly';

      if (stripe && typeof priceValue === 'number' && priceValue > 0) {
        const product = await stripe.products.create({
          name: planData.name,
          description: planData.description || undefined,
          metadata: {
            role: planData.role,
            billingCycle,
          },
        });

        const stripeInterval = billingCycle === 'yearly' ? 'year' : 'month';
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(priceValue * 100),
          currency: 'brl',
          recurring: { interval: stripeInterval },
        });

        planData.stripeProductId = product.id;
        planData.stripePriceId = price.id;
      }

      // O price já foi convertido para número acima, não precisa converter novamente
      // O Supabase/PostgreSQL aceita número para campos DECIMAL

      const newPlan = await storage.createPlanType(planData);
      console.log('[Master Admin] Plano criado com sucesso:', newPlan);
      res.json(newPlan);
    } catch (error: any) {
      console.error('[Master Admin] Erro ao criar plano:', error);
      console.error('[Master Admin] Stack:', error.stack);
      res.status(500).json({
        message: 'Erro ao criar plano',
        error: error.message,
      });
    }
  });

  app.patch(
    '/api/master-admin/plans/:id',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const planData = req.body;

        // Normalizar role se fornecido (plano unico)
        if (planData.role) {
          let roleValue = planData.role;
          if (typeof roleValue === 'string') {
            roleValue = roleValue.trim().toLowerCase();
          }

          // Converter valores antigos para tech
          if (roleValue === 'technician' || roleValue === 'company') {
            roleValue = 'tech';
          }

          // Validar
          if (roleValue !== 'tech') {
            return res.status(400).json({
              message: 'Tipo de plano deve ser "tech"',
            });
          }

          planData.role = roleValue;
        }

        
        const existingPlan = await storage.getPlanType(id);
        if (!existingPlan) {
          return res.status(404).json({ message: 'Plano nao encontrado' });
        }

        const stripe = getStripeClient();
        const incomingPriceRaw =
          planData.price === undefined || planData.price === null
            ? undefined
            : typeof planData.price === 'string'
            ? parseFloat(planData.price)
            : planData.price;
        const incomingPrice =
          typeof incomingPriceRaw === 'number' && !isNaN(incomingPriceRaw)
            ? incomingPriceRaw
            : undefined;
        const incomingBillingCycle =
          typeof planData.billingCycle === 'string' &&
          ['monthly', 'yearly'].includes(planData.billingCycle)
            ? planData.billingCycle
            : existingPlan.billingCycle || 'monthly';
        const nameForStripe = planData.name || existingPlan.name;
        const descriptionForStripe =
          planData.description !== undefined
            ? planData.description
            : existingPlan.description || undefined;

        if (stripe) {
          let stripeProductId = existingPlan.stripeProductId || null;

          if (!stripeProductId && typeof incomingPrice === 'number' && incomingPrice > 0) {
            const product = await stripe.products.create({
              name: nameForStripe,
              description: descriptionForStripe || undefined,
              metadata: {
                role: planData.role || existingPlan.role,
                billingCycle: incomingBillingCycle,
              },
            });
            stripeProductId = product.id;
            planData.stripeProductId = stripeProductId;
          } else if (stripeProductId && (planData.name || planData.description !== undefined)) {
            await stripe.products.update(stripeProductId, {
              name: nameForStripe,
              description: descriptionForStripe || undefined,
            });
          }

          const priceChanged =
            typeof incomingPrice === 'number' &&
            Number(existingPlan.price) !== incomingPrice;
          const billingCycleChanged =
            !!planData.billingCycle &&
            planData.billingCycle !== existingPlan.billingCycle;
          const shouldCreatePrice =
            typeof incomingPrice === 'number' &&
            incomingPrice > 0 &&
            (priceChanged || billingCycleChanged || !existingPlan.stripePriceId);

          if (shouldCreatePrice && stripeProductId) {
            const stripeInterval =
              incomingBillingCycle === 'yearly' ? 'year' : 'month';
            const price = await stripe.prices.create({
              product: stripeProductId,
              unit_amount: Math.round(incomingPrice * 100),
              currency: 'brl',
              recurring: { interval: stripeInterval },
            });
            planData.stripePriceId = price.id;
          }

          if (typeof incomingPrice === 'number' && incomingPrice === 0) {
            planData.stripePriceId = null;
          }
        }

        const updatedPlan = await storage.updatePlanType(id, planData);
        if (!updatedPlan) {
          return res.status(404).json({ message: 'Plano nao encontrado' });
        }
        res.json(updatedPlan);
      } catch (error: any) {
        console.error('[Master Admin] Erro ao atualizar plano:', error);
        res.status(500).json({
          message: 'Erro ao atualizar plano',
          error: error.message,
        });
      }
    }
  );

  app.delete(
    '/api/master-admin/plans/:id',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const deleted = await storage.deletePlanType(id);
        if (!deleted) {
          return res.status(404).json({ message: 'Plano nao encontrado' });
        }
        res.status(204).send();
      } catch (error: any) {
        console.error('[Master Admin] Erro ao deletar plano:', error);
        res.status(500).json({
          message: 'Erro ao deletar plano',
          error: error.message,
        });
      }
    }
  );

  app.get('/api/master-admin/users', isSuperAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();

      // Normalizar email (remover sufixo +role) e fornecer fallback de nome
      const normalized = (allUsers || []).map((u: any) => {
        const emailStr = u?.email || '';
        const [localPart, domain] = emailStr.split('@');
        let originalEmail = emailStr;
        let localBase = localPart;

        if (localPart && domain) {
          const plusIndex = localPart.indexOf('+');
          if (plusIndex >= 0) {
            localBase = localPart.slice(0, plusIndex);
            originalEmail = `${localBase}@${domain}`;
          }
        }

        const firstNameFallback =
          (u?.firstName && u.firstName.trim()) ||
          (u?.companyName && u.companyName.trim()) ||
          localBase ||
          '';

        return {
          ...u,
          email: originalEmail,
          originalEmail,
          firstName: firstNameFallback,
        };
      });

      res.json(normalized);
    } catch (error: any) {
      console.error('[Master Admin] Erro ao buscar usuários:', error);
      res.status(500).json({
        message: 'Erro ao buscar usuários',
        error: error.message,
      });
    }
  });

  // Atualizar usuário (master admin)
  app.patch(
    '/api/master-admin/users/:id',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await storage.upsertUser({
          id,
          ...updateData,
        });

        res.json(updated);
      } catch (error: any) {
        console.error('[Master Admin] Erro ao atualizar usuário:', error);
        res.status(500).json({
          message: 'Erro ao atualizar usuário',
          error: error.message,
        });
      }
    }
  );

  // Atualizar plano do usuário (master admin)
  app.put(
    '/api/master-admin/users/:id/plan',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { planType, planStatus, grantAccess } = req.body;

        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Se grantAccess = true, liberar acesso no plano tecnico
        // Se grantAccess = false, usar plano vigente
        let finalPlanType = user.role; // Manter role atual como padrao
        let finalPlanStatus: 'trial' | 'active' | 'expired' = 'active';
        const normalizedPlanType =
          typeof planType === 'string' ? planType.toLowerCase() : '';
        const resolvedPlanType =
          normalizedPlanType === 'technician' || normalizedPlanType === 'tech'
            ? 'tech'
            : null;

        if (grantAccess === true) {
          // Liberar acesso: plano tecnico ativo (plano unico)
          finalPlanType = 'tech';
          finalPlanStatus = 'active';
        } else if (resolvedPlanType) {
          // Usar plano tecnico fornecido
          finalPlanType = resolvedPlanType;
          finalPlanStatus = planStatus || 'active';
        }

        // Atualizar role com o plano tecnico
        const updated = await storage.upsertUser({
          id,
          role: finalPlanType as any,
        });

        res.json({
          ...updated,
          planType: finalPlanType,
          planStatus: finalPlanStatus,
          grantAccess: grantAccess === true,
        });
      } catch (error: any) {
        console.error('[Master Admin] Erro ao atualizar plano:', error);
        res.status(500).json({
          message: 'Erro ao atualizar plano',
          error: error.message,
        });
      }
    }
  );

  // Deletar usuário (master admin)
  app.delete(
    '/api/master-admin/users/:id',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Verificar se o usuário existe
        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Não permitir deletar o próprio master admin
        // Verificar tanto email original quanto email com sufixo +super_admin
        const isMasterAdmin =
          user.role === 'super_admin' &&
          (user.email === 'master@master.com' ||
            user.email === 'master+super_admin@master.com' ||
            user.email?.startsWith('master+') ||
            user.email?.includes('master@master.com'));

        if (isMasterAdmin) {
          return res.status(403).json({
            message: 'Não \u00e9 poss\u00edvel deletar o usuário master admin',
          });
        }

        // Deletar tudo do tenant (dados + usuário)
        await storage.deleteTenant(id);

        res.json({ message: 'Usuário e dados deletados com sucesso' });
      } catch (error: any) {
        console.error('[Master Admin] Erro ao deletar usuário:', error);
        res.status(500).json({
          message: 'Erro ao deletar usuário e dados vinculados',
          error: error.message,
        });
      }
    }
  );

  // Listar todas as empresas (master admin)
  app.get(
    '/api/master-admin/companies',
    isSuperAdmin,
    async (req: any, res) => {
      try {
        const allUsers = await storage.getAllUsers();
        const companies = allUsers.filter((u) => u.role === 'company');
        res.json(companies);
      } catch (error: any) {
        console.error('[Master Admin] Erro ao buscar empresas:', error);
        res.status(500).json({
          message: 'Erro ao buscar empresas',
          error: error.message,
        });
      }
    }
  );

  // Cadastrar novo Master Admin
  app.post('/api/master-admin/create', isSuperAdmin, async (req: any, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: 'Email e senha são obrigatórios',
        });
      }

      // Verificar se já existe um usuário com este email (qualquer role)
      const emailParts = email.split('@');
      const uniqueEmail = `${emailParts[0]}+super_admin@${emailParts[1]}`;

      const existingUser = await storage.getUserByEmail(uniqueEmail);
      if (existingUser) {
        return res.status(400).json({
          message: 'Este email já está cadastrado',
        });
      }

      // Hash da senha usando PBKDF2
      const salt = randomBytes(16).toString('hex');
      const passwordHash = pbkdf2Sync(
        password,
        salt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const fullHash = `${salt}:${passwordHash}`;

      // Criar usuário master admin no banco de dados
      const userId = randomUUID();
      const newUser = await storage.upsertUser({
        id: userId,
        email: uniqueEmail,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        role: 'super_admin',
      });

      console.log('[Master Admin] Usuário criado no banco:', {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      // Criar credenciais no banco de dados
      const { error: credError } = await supabase
        .from('user_credentials')
        .insert({
          id: randomUUID(),
          user_id: userId,
          password_hash: fullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (credError) {
        console.error(
          '[Master Admin] Erro ao criar credenciais no banco:',
          credError
        );
        return res.status(500).json({
          message: 'Erro ao criar credenciais',
          error: credError.message,
        });
      }

      console.log(
        '[Master Admin] Credenciais criadas no banco para userId:',
        userId
      );

      res.json({
        message: 'Master Admin criado com sucesso no banco de dados',
        user: {
          id: newUser.id,
          email: email, // Retornar email original (sem +super_admin)
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
      });
    } catch (error: any) {
      console.error(
        '[Master Admin] Erro ao criar master admin no banco:',
        error
      );
      res.status(500).json({
        message: 'Erro ao criar master admin',
        error: error.message,
      });
    }
  });

  // ==================== ASAAS AUTHENTICATION ====================

  // Rota para verificar/conectar com Asaas
  // Nota: Asaas usa API Key, não OAuth. Esta rota verifica se a API Key está configurada e testa a conexão.
  // Endpoint Asaas removido - será implementado Stripe Connect
  app.get('/api/asaas/auth', isAuthenticated, async (req: any, res) => {
    return res.status(501).json({
      message: 'Endpoint Asaas removido. Será implementado Stripe Connect.',
      configured: false,
      status: 'not_connected',
    });
    /* Código Asaas removido
    try {
      if (!isAsaasConfigured()) {
        return res.status(400).json({
          message:
            'Integração com Asaas não configurada. Configure ASAAS_API_KEY no .env',
          configured: false,
          status: 'not_connected',
        });
      }

      // Testar a conexão fazendo uma chamada simples \u00e0 API do Asaas
      // Vamos tentar buscar informações da conta (endpoint /myAccount)
      const ASAAS_API_URL =
        process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
      const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

      try {
        // O endpoint correto \u00e9 /myAccount na API v3
        const testResponse = await fetch(`${ASAAS_API_URL}/myAccount`, {
          method: 'GET',
          headers: {
            access_token: ASAAS_API_KEY!,
            'Content-Type': 'application/json',
          },
        });

        if (!testResponse.ok) {
          const errorData = await testResponse.json();
          console.error('[Asaas] Erro ao testar conexão:', errorData);
          return res.status(400).json({
            message: 'Chave de API do Asaas inválida ou sem permissões',
            configured: true,
            status: 'error',
            error:
              errorData.errors?.[0]?.description ||
              'Erro ao conectar com Asaas',
          });
        }

        const accountData = await testResponse.json();

        res.json({
          message: 'Conexão com Asaas verificada com sucesso',
          configured: true,
          status: 'connected',
          accountName: accountData.name || 'chamadospro',
        });
      } catch (apiError: any) {
        console.error('[Asaas] Erro ao testar API:', apiError);
        return res.status(500).json({
          message: 'Erro ao testar conexão com a API do Asaas',
          configured: true,
          status: 'error',
          error: apiError.message,
        });
      }
    } catch (error: any) {
      console.error('[Asaas] Erro ao verificar conexão:', error);
      res.status(500).json({
        message: 'Erro ao verificar conexão com Asaas',
        error: error.message,
        status: 'error',
      });
    }
    */
  });

  // ==================== VEHICLE SETTINGS ====================

  // GET /api/vehicle-settings - Buscar configurações do veículo
  app.get('/api/vehicle-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
      }

      const settings = await storage.getVehicleSettings(userId);
      if (!settings) {
        // Retornar valores padrão se não existir
        return res.json({
          fuelType: 'GASOLINA',
          kmPerLiter: '10.00',
          fuelPricePerLiter: '6.00',
        });
      }

      res.json({
        fuelType: settings.fuelType || 'GASOLINA',
        kmPerLiter: settings.kmPerLiter.toString(),
        fuelPricePerLiter: settings.fuelPricePerLiter.toString(),
      });
    } catch (error: any) {
      console.error('[Vehicle Settings] Erro ao buscar configurações:', error);
      res.status(500).json({
        message: 'Erro ao buscar configurações do veículo',
        error: error.message,
      });
    }
  });

  // PUT /api/vehicle-settings - Salvar/atualizar configurações do veículo
  app.put('/api/vehicle-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
      }

      const { fuelType, kmPerLiter, fuelPricePerLiter } = req.body;

      if (!fuelType || !kmPerLiter || !fuelPricePerLiter) {
        return res.status(400).json({
          message: 'fuelType, kmPerLiter e fuelPricePerLiter são obrigatórios',
        });
      }

      // Validar tipo de combustível
      const validFuelTypes = ['GASOLINA', 'GNV', 'DIESEL', 'ELETRICO'];
      if (!validFuelTypes.includes(fuelType.toUpperCase())) {
        return res.status(400).json({
          message: 'fuelType deve ser GASOLINA, GNV, DIESEL ou ELETRICO',
        });
      }

      const kmValue = parseFloat(kmPerLiter);
      const fuelValue = parseFloat(fuelPricePerLiter);

      if (isNaN(kmValue) || kmValue <= 0) {
        return res.status(400).json({
          message: 'kmPerLiter deve ser um número positivo',
        });
      }

      if (isNaN(fuelValue) || fuelValue <= 0) {
        return res.status(400).json({
          message: 'fuelPricePerLiter deve ser um número positivo',
        });
      }

      const settings = await storage.upsertVehicleSettings(userId, {
        fuelType: fuelType.toUpperCase(),
        kmPerLiter: kmValue,
        fuelPricePerLiter: fuelValue,
      });

      res.json({
        fuelType: settings.fuelType,
        kmPerLiter: settings.kmPerLiter.toString(),
        fuelPricePerLiter: settings.fuelPricePerLiter.toString(),
      });
    } catch (error: any) {
      console.error('[Vehicle Settings] Erro ao salvar configurações:', error);
      res.status(500).json({
        message: 'Erro ao salvar configurações do veículo',
        error: error.message,
      });
    }
  });

  // ==================== EMAIL CONFIRMATION ====================

  // Endpoint para confirmar email do cliente
  app.get('/api/clients/confirm-email', async (req: any, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Erro na Confirmação</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Token inválido</h1>
            <p>O link de confirmação \u00e9 inv\u00e1lido ou está incompleto.</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `);
      }

      // Buscar cliente pelo token
      const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .eq('email_confirmation_token', token)
        .maybeSingle();

      if (error || !client) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Token não encontrado</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Link inválido ou expirado</h1>
            <p>O link de confirmação não foi encontrado ou já expirou.</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `);
      }

      // Verificar se o token está expirado
      if (isTokenExpired(client.email_confirmation_expires_at)) {
        // Deletar cliente não confirmado
        await supabase.from('clients').delete().eq('id', client.id);

        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Link Expirado</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Link de confirmação expirado</h1>
            <p>O link de confirmação expirou (válido por 24 horas).</p>
            <p>Seu cadastro foi removido. Por favor, faça um novo cadastro.</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `);
      }

      // Verificar se já foi confirmado
      if (client.email_confirmed) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Email já confirmado</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #2e7d32; }
            </style>
          </head>
          <body>
            <h1 class="success">Email já confirmado</h1>
            <p>Seu email já foi confirmado anteriormente.</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `);
      }

      // Confirmar email e remover token
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          email_confirmed: true,
          email_confirmation_token: null,
          email_confirmation_expires_at: null,
        })
        .eq('id', client.id);

      if (updateError) {
        console.error(
          '[EmailConfirmation] Erro ao confirmar email:',
          updateError
        );
        return res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Erro na Confirmação</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Erro ao confirmar email</h1>
            <p>Ocorreu um erro ao confirmar seu email. Por favor, tente novamente.</p>
            <p><a href="/">Voltar ao início</a></p>
          </body>
          </html>
        `);
      }

      // Redirecionar para página de sucesso
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Email Confirmado</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              max-width: 500px;
            }
            .success { 
              color: #2e7d32; 
              font-size: 2em;
              margin-bottom: 20px;
            }
            .check-icon {
              font-size: 4em;
              color: #4caf50;
              margin-bottom: 20px;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background: #3880f5;
              color: white;
              text-decoration: none;
              border-radius: 5px;
            }
            a:hover {
              background: #2968d4;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="check-icon">?</div>
            <h1 class="success">Email Confirmado com Sucesso!</h1>
            <p>Seu cadastro foi confirmado e está ativo.</p>
            <p>Voc? pode fechar esta página.</p>
            <a href="/">Voltar ao início</a>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error(
        '[EmailConfirmation] Erro ao processar confirmação:',
        error
      );
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Erro</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Erro ao processar confirmação</h1>
          <p>Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.</p>
          <p><a href="/">Voltar ao início</a></p>
        </body>
        </html>
      `);
    }
  });

  // Job para limpar clientes não confirmados após 1 dia
  // Executa a cada hora
  let clientEmailColumnsReady: boolean | null = null;
  let clientEmailColumnsWarned = false;

  async function hasClientEmailConfirmationColumns(): Promise<boolean> {
    if (clientEmailColumnsReady === true) {
      return true;
    }

    try {
      const { rows } = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clients'
          AND column_name IN ('email_confirmed', 'email_confirmation_expires_at')
        `
      );

      const columns = new Set(rows.map((row: any) => row.column_name));
      const hasEmailConfirmed = columns.has('email_confirmed');
      const hasExpiresAt = columns.has('email_confirmation_expires_at');
      const ok = hasEmailConfirmed && hasExpiresAt;

      clientEmailColumnsReady = ok;
      if (!ok && !clientEmailColumnsWarned) {
        console.warn(
          '[EmailConfirmation] Client email confirmation columns are missing. Run npm run fix:client-email-confirmation.'
        );
        clientEmailColumnsWarned = true;
      }
      return ok;
    } catch (error) {
      if (!clientEmailColumnsWarned) {
        console.warn(
          '[EmailConfirmation] Failed to check client email confirmation columns:',
          error
        );
        clientEmailColumnsWarned = true;
      }
      return false;
    }
  }

  setInterval(async () => {
    try {
      if (!(await hasClientEmailConfirmationColumns())) {
        return;
      }

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: expiredClients, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('email_confirmed', false)
        .lt('email_confirmation_expires_at', oneDayAgo.toISOString());

      if (error) {
        console.error(
          '[EmailConfirmation] Erro ao buscar clientes expirados:',
          error
        );
        return;
      }

      if (expiredClients && expiredClients.length > 0) {
        const { error: deleteError } = await supabase
          .from('clients')
          .delete()
          .eq('email_confirmed', false)
          .lt('email_confirmation_expires_at', oneDayAgo.toISOString());

        if (deleteError) {
          console.error(
            '[EmailConfirmation] Erro ao deletar clientes expirados:',
            deleteError
          );
        } else {
          console.log(
            `[EmailConfirmation] ${expiredClients.length} cliente(s) não confirmado(s) removido(s) após expiração`
          );
        }
      }
    } catch (error: any) {
      console.error('[EmailConfirmation] Erro no job de limpeza:', error);
    }
  }, 60 * 60 * 1000); // Executa a cada 1 hora

  // ============================================
  // ENDPOINTS DE SUPORTE/MENSAGENS
  // ============================================

  // Enviar mensagem de suporte
  app.post('/api/support/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { category, subject, message } = req.body;

      if (!category || !subject || !message) {
        return res.status(400).json({
          message: 'Categoria, assunto e mensagem são obrigatórios',
        });
      }

      const validCategories = ['bug', 'sugestao', 'duvida', 'outro'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          message: 'Categoria inválida',
        });
      }

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          user_id: userId,
          category,
          subject: subject.trim(),
          message: message.trim(),
          status: 'aberto',
        })
        .select()
        .single();

      if (error) {
        console.error('[SUPPORT] Erro ao criar mensagem:', error);
        return res.status(500).json({
          message: 'Erro ao enviar mensagem',
        });
      }

      console.log('[SUPPORT] Mensagem criada:', {
        id: data.id,
        userId,
        category,
        subject,
      });

      res.status(201).json({
        message: 'Mensagem enviada com sucesso',
        id: data.id,
      });
    } catch (error: any) {
      console.error('[SUPPORT] Erro ao processar mensagem:', error);
      res.status(500).json({
        message: 'Erro ao enviar mensagem',
      });
    }
  });

  // Listar mensagens de suporte (apenas para admin)
  app.get('/api/support/messages', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      if (user?.role !== 'super_admin') {
        return res.status(403).json({
          message: 'Acesso negado. Apenas administradores podem ver mensagens.',
        });
      }

      const { status, category } = req.query;

      let query = supabase
        .from('support_messages')
        .select(
          'id, category, subject, message, status, admin_response, responded_at, created_at, user_id, users!support_messages_user_id_fkey(email, first_name, last_name, company_name)'
        )
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SUPPORT] Erro ao buscar mensagens:', error);
        return res.status(500).json({
          message: 'Erro ao buscar mensagens',
        });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[SUPPORT] Erro ao processar requisição:', error);
      res.status(500).json({
        message: 'Erro ao buscar mensagens',
      });
    }
  });

  // Responder mensagem (apenas para admin)
  app.post(
    '/api/support/messages/:id/respond',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message: 'Acesso negado. Apenas administradores podem responder.',
          });
        }

        const { id } = req.params;
        const { response } = req.body;

        if (!response || !response.trim()) {
          return res.status(400).json({
            message: 'Resposta \u00e9 obrigatória',
          });
        }

        const { data: message, error: fetchError } = await supabase
          .from('support_messages')
          .select('user_id, users!support_messages_user_id_fkey(email)')
          .eq('id', id)
          .single();

        if (fetchError || !message) {
          return res.status(404).json({
            message: 'Mensagem não encontrada',
          });
        }

        const { data, error } = await supabase
          .from('support_messages')
          .update({
            admin_response: response.trim(),
            admin_id: req.user.id,
            responded_at: new Date().toISOString(),
            status: 'resolvido',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[SUPPORT] Erro ao responder mensagem:', error);
          return res.status(500).json({
            message: 'Erro ao responder mensagem',
          });
        }

        // Enviar email de resposta para o tenant
        try {
          const userEmail = (message.users as any)?.email;
          if (
            userEmail &&
            process.env.RESEND_API_KEY &&
            process.env.EMAIL_FROM
          ) {
            await sendEmail({
              to: userEmail,
              subject: `Resposta ao seu contato: ${data.subject}`,
              html: `
                <h2>Olá!</h2>
                <p>Recebemos sua mensagem e aqui está nossa resposta:</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="white-space: pre-wrap;">${response.trim()}</p>
                </div>
                <p>Seu assunto original: <strong>${data.subject}</strong></p>
                <p>Se precisar de mais ajuda, não hesite em nos contatar novamente.</p>
                <p>Atenciosamente,<br>Equipe ChamadosPro</p>
              `,
            });
            console.log('[SUPPORT] Email de resposta enviado para:', userEmail);
          }
        } catch (emailError: any) {
          console.error(
            '[SUPPORT] Erro ao enviar email de resposta:',
            emailError
          );
          // Não falhar a requisição se o email falhar
        }

        console.log('[SUPPORT] Mensagem respondida:', {
          messageId: id,
          adminId: req.user.id,
        });

        res.json({
          message: 'Resposta enviada com sucesso',
          data,
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar resposta:', error);
        res.status(500).json({
          message: 'Erro ao responder mensagem',
        });
      }
    }
  );

  // Atualizar status da mensagem (apenas para admin)
  app.patch(
    '/api/support/messages/:id/status',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem atualizar status.',
          });
        }

        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = [
          'aberto',
          'em_andamento',
          'resolvido',
          'fechado',
        ];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            message: 'Status inválido',
          });
        }

        const { data, error } = await supabase
          .from('support_messages')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[SUPPORT] Erro ao atualizar status:', error);
          return res.status(500).json({
            message: 'Erro ao atualizar status',
          });
        }

        res.json({
          message: 'Status atualizado com sucesso',
          data,
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar atualização:', error);
        res.status(500).json({
          message: 'Erro ao atualizar status',
        });
      }
    }
  );

  // Listar mensagens do próprio usuário
  app.get(
    '/api/support/my-messages',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;

        const { data, error } = await supabase
          .from('support_messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error(
            '[SUPPORT] Erro ao buscar mensagens do usuário:',
            error
          );
          return res.status(500).json({
            message: 'Erro ao buscar mensagens',
          });
        }

        res.json(data || []);
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar requisição:', error);
        res.status(500).json({
          message: 'Erro ao buscar mensagens',
        });
      }
    }
  );

  // Contar mensagens não lidas do usuário
  app.get(
    '/api/support/unread-count',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;

        const { count, error } = await supabase
          .from('support_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('admin_response', 'is', null)
          .is('user_read_at', null);

        if (error) {
          console.error('[SUPPORT] Erro ao contar mensagens não lidas:', error);
          return res.status(500).json({
            message: 'Erro ao contar mensagens',
            count: 0,
          });
        }

        res.json({ count: count || 0 });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar requisição:', error);
        res.status(500).json({
          message: 'Erro ao contar mensagens',
          count: 0,
        });
      }
    }
  );

  // Marcar mensagem como lida
  app.post(
    '/api/support/messages/:id/mark-read',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        // Verificar se a mensagem pertence ao usuário
        const { data: message, error: fetchError } = await supabase
          .from('support_messages')
          .select('user_id')
          .eq('id', id)
          .single();

        if (fetchError || !message) {
          return res.status(404).json({
            message: 'Mensagem não encontrada',
          });
        }

        if (message.user_id !== userId) {
          return res.status(403).json({
            message: 'Acesso negado',
          });
        }

        const { data, error } = await supabase
          .from('support_messages')
          .update({
            user_read_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[SUPPORT] Erro ao marcar como lida:', error);
          return res.status(500).json({
            message: 'Erro ao marcar como lida',
          });
        }

        res.json({
          message: 'Mensagem marcada como lida',
          data,
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar requisição:', error);
        res.status(500).json({
          message: 'Erro ao marcar como lida',
        });
      }
    }
  );

  // Publicar/despublicar mensagem na FAQ (apenas para admin)
  app.patch(
    '/api/support/messages/:id/publish',
    isAuthenticated,
    async (req: any, res) => {
      try {
        console.log(
          '[SUPPORT] PATCH /api/support/messages/:id/publish chamado',
          {
            id: req.params.id,
            isPublic: req.body.isPublic,
            userId: req.user?.id,
          }
        );

        const user = await storage.getUser(req.user.id);

        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem publicar mensagens.',
          });
        }

        const { id } = req.params;
        const { isPublic } = req.body;

        // Verificar se a mensagem tem resposta
        const { data: message, error: fetchError } = await supabase
          .from('support_messages')
          .select('admin_response')
          .eq('id', id)
          .single();

        if (fetchError || !message) {
          return res.status(404).json({
            message: 'Mensagem não encontrada',
          });
        }

        if (isPublic && !message.admin_response) {
          return res.status(400).json({
            message:
              'A mensagem precisa ter uma resposta antes de ser publicada',
          });
        }

        const { data, error } = await supabase
          .from('support_messages')
          .update({
            is_public: isPublic === true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[SUPPORT] Erro ao publicar mensagem:', error);
          console.error('[SUPPORT] Detalhes do erro:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });

          // Verificar se o erro \u00e9 sobre coluna não encontrada
          if (
            error.message?.includes('is_public') ||
            error.code === 'PGRST204'
          ) {
            return res.status(500).json({
              message:
                'Erro: A coluna is_public não existe na tabela. Execute a migration SQL no Supabase.',
              error: error.message,
              hint: 'Execute o arquivo migrations/VERIFICAR_E_ADICIONAR_CAMPOS.sql no SQL Editor do Supabase',
            });
          }

          return res.status(500).json({
            message: 'Erro ao publicar mensagem',
            error: error.message,
          });
        }

        res.json({
          message: isPublic
            ? 'Mensagem publicada na FAQ'
            : 'Mensagem removida da FAQ',
          data,
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar requisição:', error);
        res.status(500).json({
          message: 'Erro ao publicar mensagem',
        });
      }
    }
  );

  // Buscar FAQ pública (sem autenticação)
  app.get('/api/support/faq', async (req: any, res) => {
    try {
      const { search, category } = req.query;

      let query = supabase
        .from('support_messages')
        .select('id, category, subject, message, admin_response, created_at')
        .eq('is_public', true)
        .not('admin_response', 'is', null)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.or(
          `subject.ilike.%${search}%,message.ilike.%${search}%,admin_response.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SUPPORT] Erro ao buscar FAQ:', error);
        return res.status(500).json({
          message: 'Erro ao buscar FAQ',
        });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[SUPPORT] Erro ao processar requisição:', error);
      res.status(500).json({
        message: 'Erro ao buscar FAQ',
      });
    }
  });

  // ============================================
  // ENDPOINTS DE TEMPLATES DE RESPOSTAS
  // ============================================

  // Listar templates (apenas para admin)
  app.get('/api/support/templates', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      if (user?.role !== 'super_admin') {
        return res.status(403).json({
          message: 'Acesso negado. Apenas administradores podem ver templates.',
        });
      }

      const { category } = req.query;

      let query = supabase
        .from('support_message_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('title', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SUPPORT] Erro ao buscar templates:', error);
        return res.status(500).json({
          message: 'Erro ao buscar templates',
        });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[SUPPORT] Erro ao processar requisição:', error);
      res.status(500).json({
        message: 'Erro ao buscar templates',
      });
    }
  });

  // Criar template (apenas para admin)
  app.post('/api/support/templates', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      if (user?.role !== 'super_admin') {
        return res.status(403).json({
          message:
            'Acesso negado. Apenas administradores podem criar templates.',
        });
      }

      const { category, title, content, isActive } = req.body;

      if (!category || !title || !content) {
        return res.status(400).json({
          message: 'Categoria, título e conteúdo são obrigatórios',
        });
      }

      const validCategories = ['bug', 'sugestao', 'duvida', 'outro', 'geral'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          message: 'Categoria inválida',
        });
      }

      const { data, error } = await supabase
        .from('support_message_templates')
        .insert({
          category,
          title: title.trim(),
          content: content.trim(),
          is_active: isActive !== false,
          created_by: req.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('[SUPPORT] Erro ao criar template:', error);
        return res.status(500).json({
          message: 'Erro ao criar template',
        });
      }

      console.log('[SUPPORT] Template criado:', {
        id: data.id,
        category,
        title,
      });

      res.status(201).json({
        message: 'Template criado com sucesso',
        data,
      });
    } catch (error: any) {
      console.error('[SUPPORT] Erro ao processar criação:', error);
      res.status(500).json({
        message: 'Erro ao criar template',
      });
    }
  });

  // Atualizar template (apenas para admin)
  app.put(
    '/api/support/templates/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem atualizar templates.',
          });
        }

        const { id } = req.params;
        const { category, title, content, isActive } = req.body;

        if (!category || !title || !content) {
          return res.status(400).json({
            message: 'Categoria, título e conteúdo são obrigatórios',
          });
        }

        const validCategories = ['bug', 'sugestao', 'duvida', 'outro', 'geral'];
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            message: 'Categoria inválida',
          });
        }

        const { data, error } = await supabase
          .from('support_message_templates')
          .update({
            category,
            title: title.trim(),
            content: content.trim(),
            is_active: isActive !== false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[SUPPORT] Erro ao atualizar template:', error);
          return res.status(500).json({
            message: 'Erro ao atualizar template',
          });
        }

        res.json({
          message: 'Template atualizado com sucesso',
          data,
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar atualização:', error);
        res.status(500).json({
          message: 'Erro ao atualizar template',
        });
      }
    }
  );

  // Deletar template (apenas para admin)
  app.delete(
    '/api/support/templates/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem deletar templates.',
          });
        }

        const { id } = req.params;

        const { error } = await supabase
          .from('support_message_templates')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('[SUPPORT] Erro ao deletar template:', error);
          return res.status(500).json({
            message: 'Erro ao deletar template',
          });
        }

        res.json({
          message: 'Template deletado com sucesso',
        });
      } catch (error: any) {
        console.error('[SUPPORT] Erro ao processar exclusão:', error);
        res.status(500).json({
          message: 'Erro ao deletar template',
        });
      }
    }
  );

  // ==================== SINCRONIZAÇÃO DE SUBCONTAS ASAAS ====================
  // Endpoint para verificar e criar subcontas para tenants que não têm
  app.post(
    '/api/admin/sync-asaas-subaccounts',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        // Apenas super_admin pode executar esta operação
        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem sincronizar subcontas.',
          });
        }

        // Endpoint de sincronização Asaas removido - será implementado Stripe Connect
        return res.status(501).json({
          message:
            'Endpoint de sincronização será implementado com Stripe Connect',
        });
        /* Código Asaas removido - todo o bloco abaixo está comentado
        if (!isAsaasConfigured()) {
          return res.status(400).json({
            message:
              'Integração com Asaas não configurada. Configure ASAAS_API_KEY no .env',
          });
        }

        // Buscar todos os tenants (excluir super_admin)
        const allUsers = await storage.getAllUsers();
        const tenants = allUsers.filter(
          (u) => u.role !== 'super_admin' && u.email
        );

        console.log(
          `[SYNC_ASAAS] Total de tenants encontrados: ${tenants.length}`
        );

        const results = {
          total: tenants.length,
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [] as Array<{ userId: string; email: string; error: string }>,
        };

        // Processar cada tenant
        for (const tenant of tenants) {
          try {
            results.processed++;

            // Verificar se já tem subconta (tem asaasApiKey ou asaasWalletId)
            const hasSubAccount =
              (tenant as any).asaasApiKey || (tenant as any).asaasWalletId;

            if (hasSubAccount) {
              console.log(
                `[SYNC_ASAAS] Tenant ${tenant.id} já tem subconta, pulando...`
              );
              results.skipped++;
              continue;
            }

            console.log(
              `[SYNC_ASAAS] Sincronizando tenant ${tenant.id} (${tenant.email})...`
            );

            // Sincronizar com Asaas
            const asaasData = await syncUserWithAsaas({
              id: tenant.id,
              email: tenant.email || undefined,
              firstName: tenant.firstName || undefined,
              lastName: tenant.lastName || undefined,
              companyName: tenant.companyName || undefined,
              phone: tenant.phone || undefined,
              document: tenant.cpf || (tenant as any).cnpj || undefined,
              zipCode: (tenant as any).zipCode || undefined,
              streetAddress: (tenant as any).streetAddress || undefined,
              addressNumber: (tenant as any).addressNumber || undefined,
              addressComplement: (tenant as any).addressComplement || undefined,
              neighborhood: (tenant as any).neighborhood || undefined,
              city: (tenant as any).city || undefined,
              state: (tenant as any).state || undefined,
            });

            if (asaasData) {
              // Atualizar tenant com dados da subconta
              await storage.upsertUser({
                id: tenant.id,
                email: tenant.email,
                firstName: tenant.firstName,
                lastName: tenant.lastName,
                companyName: tenant.companyName,
                role: tenant.role as any,
                asaasCustomerId: asaasData.customerId,
                asaasApiKey: asaasData.apiKey,
                asaasWalletId: asaasData.walletId,
              });

              if ((tenant as any).asaasCustomerId) {
                results.updated++;
                console.log(
                  `[SYNC_ASAAS] Tenant ${tenant.id} atualizado com subconta`
                );
              } else {
                results.created++;
                console.log(
                  `[SYNC_ASAAS] Subconta criada para tenant ${tenant.id}`
                );
              }
            } else {
              results.skipped++;
              console.log(
                `[SYNC_ASAAS] Não foi possível criar subconta para tenant ${tenant.id}`
              );
            }
          } catch (error: any) {
            const errorMessage =
          validationError?.message || 'Erro de validacao desconhecido';
            console.error(
              `[SYNC_ASAAS] Erro ao sincronizar tenant ${tenant.id}:`,
              errorMessage
            );
            results.errors.push({
              userId: tenant.id,
              email: tenant.email || 'sem-email',
              error: errorMessage,
            });
          }
        }

        console.log('[SYNC_ASAAS] Resultado final:', results);

        res.json({
          success: true,
          message: 'Sincronização concluída',
          results,
        });
      } catch (error: any) {
        console.error('[SYNC_ASAAS] Erro geral:', error);
        res.status(500).json({
          message: 'Erro ao sincronizar subcontas',
          error: error.message,
        });
        */ // Fim do código Asaas removido
      } catch (error: any) {
        // Este catch \u00e9 necess\u00e1rio para a estrutura do código
        console.error('[SYNC] Erro:', error);
      }
    }
  );

  // Endpoint para verificar status das subcontas (sem criar)
  app.get(
    '/api/admin/check-asaas-subaccounts',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);

        // Apenas super_admin pode executar esta operação
        if (user?.role !== 'super_admin') {
          return res.status(403).json({
            message:
              'Acesso negado. Apenas administradores podem verificar subcontas.',
          });
        }

        // Buscar todos os tenants (excluir super_admin)
        const allUsers = await storage.getAllUsers();
        const tenants = allUsers.filter(
          (u) => u.role !== 'super_admin' && u.email
        );

        const status = {
          total: tenants.length,
          withSubAccount: 0,
          withoutSubAccount: 0,
          tenants: tenants.map((t) => ({
            id: t.id,
            email: t.email,
            name:
              t.companyName ||
              [t.firstName, t.lastName].filter(Boolean).join(' ') ||
              'Sem nome',
            hasSubAccount:
              !!(t as any).asaasApiKey || !!(t as any).asaasWalletId,
            hasApiKey: !!(t as any).asaasApiKey,
            hasWalletId: !!(t as any).asaasWalletId,
            // hasCustomerId removido - será implementado Stripe Connect
            hasCustomerId: false,
          })),
        };

        status.withSubAccount = status.tenants.filter(
          (t) => t.hasSubAccount
        ).length;
        status.withoutSubAccount = status.total - status.withSubAccount;

        res.json({
          success: true,
          status,
        });
      } catch (error: any) {
        console.error('[CHECK_ASAAS] Erro:', error);
        res.status(500).json({
          message: 'Erro ao verificar subcontas',
          error: error.message,
        });
      }
    }
  );

  registerExtraRoutes(app);
  registerReportRoutes(app);
  assertCriticalRoutes(app);

  // ==================== PLUGGY (OPEN FINANCE) INTEGRATION ====================
  const httpServer = createServer(app);

  return httpServer;
}





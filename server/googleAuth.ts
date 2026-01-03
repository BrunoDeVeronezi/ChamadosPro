import crypto from 'crypto';
import { google } from 'googleapis';
import session from 'express-session';
import type { Express, RequestHandler } from 'express';
import createMemoryStore from 'memorystore';
import {
  upsertUserRecord,
  getUserRecord,
  type StoredTokens,
  type StoredUserRecord,
} from './tokenStore';
import { storage } from './storage';
import { supabase } from './supabase-client';

type SessionUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
};

const TRIAL_DEVICE_COOKIE = 'chamadospro_device_id';

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
  const fromCookie = getCookieValue(req, TRIAL_DEVICE_COOKIE);
  return fromCookie ? fromCookie.trim() : null;
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
    console.error('[OAUTH-CALLBACK] Error checking device/ip:', error);
    return null;
  }

  return (data || [])[0] || null;
}

export function base64Url(input: Buffer) {
  return input
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function generateCodeVerifier() {
  return base64Url(crypto.randomBytes(32));
}

export function generateCodeChallenge(verifier: string) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64Url(hash);
}

// Cache temporário em memória para state e codeVerifier (fallback caso sessão não funcione)
// Limpa automaticamente após 10 minutos
export interface OAuthStateCache {
  codeVerifier: string;
  state: string;
  timestamp: number;
  userId?: string;
}

export const oauthStateCache = new Map<string, OAuthStateCache>();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutos

// Limpar cache expirado periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of oauthStateCache.entries()) {
    if (now - entry.timestamp > OAUTH_STATE_TTL) {
      oauthStateCache.delete(state);
    }
  }
}, 60 * 1000); // Verificar a cada minuto

function getSessionMiddleware() {
  const MemoryStore = createMemoryStore(session);
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionTtl = 1000 * 60 * 60 * 24 * 7;

  return session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: true, // Mudado para true para garantir que a sessão seja salva em mobile
    saveUninitialized: true, // Permitir criar sessão mesmo sem dados iniciais (necessário para OAuth)
    store: new MemoryStore({ checkPeriod: sessionTtl }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      // 'lax' funciona melhor em mobile e simuladores
      // 'none' só funciona com HTTPS e pode causar problemas em localhost
      sameSite: 'lax',
      maxAge: sessionTtl,
      // Não definir domain para funcionar em localhost e diferentes hosts
      path: '/', // Garantir que o cookie seja enviado para todas as rotas
    },
    name: 'sessionId', // Nome explícito para o cookie de sessão
    rolling: false, // Não renovar automaticamente o cookie
  });
}

function persistTokens(user: SessionUser, tokens: any) {
  const tokensToStore: StoredTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  };

  const existing = getUserRecord(user.id);
  const current: StoredUserRecord = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    picture: user.picture,
    folderId: existing?.folderId,
    spreadsheetId: existing?.spreadsheetId,
    calendarId: existing?.calendarId,
    tokens: tokensToStore,
    updatedAt: new Date().toISOString(),
  };

  upsertUserRecord(current);
}

export function getOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Se não foi fornecido um redirectUri, usar o padrão
  const finalRedirectUri =
    redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.NGROK_URL
      ? `${process.env.NGROK_URL}/api/callback`
      : 'http://localhost:5180/api/callback');

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }

  return new google.auth.OAuth2(clientId, clientSecret, finalRedirectUri);
}

export function getRedirectUriFromRequest(req: Express.Request): string {
  // Se há uma variável de ambiente definida, usar ela (prioridade)
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  // Se há NGROK_URL, usar ela
  if (process.env.NGROK_URL) {
    return `${process.env.NGROK_URL}/api/callback`;
  }

  // Construir dinamicamente baseado na requisição
  // Isso é importante para mobile onde o hostname pode ser diferente
  // Considerar headers de proxy (x-forwarded-proto, x-forwarded-host)
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const protocol = forwardedProto || req.protocol || 'http';

  // Usar forwarded-host se disponível (importante para proxies/load balancers)
  let host = forwardedHost || req.get('host') || 'localhost:5180';

  // Remover porta padrão se presente (http://example.com:80 -> http://example.com)
  if (protocol === 'http' && host.endsWith(':80')) {
    host = host.replace(':80', '');
  } else if (protocol === 'https' && host.endsWith(':443')) {
    host = host.replace(':443', '');
  }

  // Detectar se é mobile baseado no User-Agent
  const userAgent = req.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);

  // Para mobile/simuladores, garantir que o redirect URI seja exatamente como configurado no Google Console
  // O Google é muito estrito com redirect URIs - devem corresponder exatamente
  const redirectUri = `${protocol}://${host}/api/callback`;

  console.log('[OAUTH] Construindo redirect URI:', {
    protocol,
    host,
    forwardedProto,
    forwardedHost,
    originalHost: req.get('host'),
    userAgent: userAgent.substring(0, 50),
    isMobile,
    redirectUri,
    // Log adicional para debug mobile
    allHeaders: {
      'x-forwarded-proto': req.get('x-forwarded-proto'),
      'x-forwarded-host': req.get('x-forwarded-host'),
      'x-forwarded-for': req.get('x-forwarded-for'),
      origin: req.get('origin'),
      referer: req.get('referer'),
    },
  });

  return redirectUri;
}

export async function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  app.set('trust proxy', true);
  app.use(getSessionMiddleware());

  app.get('/api/login', async (req, res, next) => {
    try {
      // Garantir que não há usuário prévio na sessão (evita login fantasma ao voltar)
      if (req.session?.user) {
        delete (req.session as any).user;
        delete (req.session as any).userRole;
      }

      const redirectUri = getRedirectUriFromRequest(req);
      const oauth2Client = getOAuthClient(redirectUri);
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = base64Url(crypto.randomBytes(24));

      // Verificar se foi passado userType na query string
      const userType = (req.query.userType as string) || '';
      const normalizedUserType = userType.toLowerCase();
      const requestedRole =
        normalizedUserType === 'technician' ? 'technician' : 'company';

      // Verificar se foi passado login_hint (email sugerido) na query string
      const loginHint = (req.query.login_hint as string) || '';

      // Salvar na sessão
      req.session.codeVerifier = codeVerifier;
      req.session.state = state;

      // Também armazenar no cache em memória como fallback
      oauthStateCache.set(state, {
        codeVerifier,
        state,
        timestamp: Date.now(),
        requestedRole: requestedRole, // Salvar role solicitado
      });

      // Preparar parâmetros OAuth
      const authParams: any = {
        access_type: 'offline',
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ].join(' '),
        prompt: 'consent',
        include_granted_scopes: true,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256' as any,
      };

      // Adicionar login_hint se fornecido (sugere email na tela de seleção do Google)
      if (loginHint) {
        authParams.login_hint = loginHint;
      }

      const authUrl = oauth2Client.generateAuthUrl(authParams);

      // Salvar sessão explicitamente antes do redirect para garantir que os dados sejam persistidos
      req.session.save((err) => {
        if (err) {
          console.error('[OAUTH-LOGIN] Erro ao salvar sessão:', err);
          return res.status(500).send('Erro ao iniciar autenticação');
        }
        res.redirect(authUrl);
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/callback', async (req, res, next) => {
    try {
      const { state, code } = req.query;

      // Verificar state
      if (!state || typeof state !== 'string') {
        console.error(
          '[OAUTH-CALLBACK] ❌ ERRO: State não recebido ou inválido'
        );
        return res
          .status(400)
          .send('Invalid state. Please try logging in again.');
      }

      // Tentar obter codeVerifier do cache PRIMEIRO (mais confiável que sessão quando cookies não funcionam)
      let codeVerifier: string | undefined;
      let stateSource = 'nenhum';

      const cachedState = oauthStateCache.get(state);
      if (cachedState) {
        const now = Date.now();
        const age = now - cachedState.timestamp;

        if (age < OAUTH_STATE_TTL) {
          codeVerifier = cachedState.codeVerifier;
          stateSource = 'cache em memória';
        } else {
          oauthStateCache.delete(state);
        }
      }

      // Se não encontrou no cache, tentar da sessão
      if (!codeVerifier) {
        codeVerifier = req.session?.codeVerifier;
        if (codeVerifier) {
          stateSource = 'sessão';
        }
      }

      // Verificar se o state corresponde (cache ou sessão)
      const sessionState = req.session?.state;
      const cachedStateEntry = oauthStateCache.get(state);
      const stateMatches =
        cachedStateEntry?.state === state || sessionState === state;

      if (!stateMatches) {
        console.error(
          '[OAUTH-CALLBACK] ❌ ERRO: State inválido ou não corresponde'
        );
        console.error('[OAUTH-CALLBACK] Isso pode indicar:');
        console.error('  - Ataque CSRF');
        console.error('  - Sessão perdida entre login e callback');
        console.error('  - Cookies não funcionando em mobile');
        return res
          .status(400)
          .send('Invalid state. Please try logging in again.');
      }

      if (!codeVerifier) {
        console.error(
          '[OAUTH-CALLBACK] ❌ ERRO CRÍTICO: CodeVerifier não encontrado!'
        );
        console.error('[OAUTH-CALLBACK] Fonte tentada:', stateSource);
        console.error('[OAUTH-CALLBACK] Possíveis causas:');
        console.error(
          '  - Servidor foi reiniciado (cache em memória foi perdido)'
        );
        console.error('  - State expirou (mais de 10 minutos desde o login)');
        console.error('  - Cookies bloqueados e cache não disponível');
        console.error('  - Problema específico em mobile/simuladores');
        console.error('[OAUTH-CALLBACK] Estado do cache:', {
          size: oauthStateCache.size,
          keys: Array.from(oauthStateCache.keys()),
          stateBuscado: state,
        });
        console.error('[OAUTH-CALLBACK] Estado da sessão:', {
          sessionID: req.sessionID,
          hasState: !!req.session?.state,
          hasCodeVerifier: !!req.session?.codeVerifier,
        });
        return res
          .status(400)
          .send(
            'Missing code verifier. Your session may have expired or server was restarted. Please try logging in again.'
          );
      }

      // Limpar do cache após uso (one-time use) se veio do cache
      if (stateSource === 'cache em memória') {
        oauthStateCache.delete(state);
      }

      if (typeof code !== 'string') {
        console.error('[OAUTH-CALLBACK] ERRO: Code não recebido ou inválido');
        return res
          .status(400)
          .send('Missing authorization code. Please try logging in again.');
      }

      const redirectUri = getRedirectUriFromRequest(req);
      const oauth2Client = getOAuthClient(redirectUri);

      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier,
        redirect_uri: redirectUri,
      });

      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

      let userInfo;
      try {
        const userInfoResponse = await oauth2.userinfo.get();
        userInfo = userInfoResponse.data;
      } catch (userInfoError: any) {
        console.error(
          '[OAUTH-CALLBACK] ❌ ERRO ao obter informações do usuário:',
          userInfoError
        );
        throw userInfoError;
      }

      // Determinar role: verificar se foi solicitado no login ou se usuário já existe
      // PADRÃO: técnico (priorizar páginas de técnico que estão mais desenvolvidas)
      let role: 'company' | 'technician' = 'technician'; // Padrão: técnico

      // Tentar extrair role do cache (se foi passado no login)
      let requestedRoleFromCache: 'company' | 'technician' | null = null;
      // Reutilizar cachedStateEntry que já foi obtido anteriormente
      const cachedStateForRole = oauthStateCache.get(state);
      if (cachedStateForRole && (cachedStateForRole as any).requestedRole) {
        requestedRoleFromCache = (cachedStateForRole as any).requestedRole;
      }

      // Verificar se usuário já existe para manter o role existente
      const existingUserCheck = await storage.getUserByEmail(
        userInfo.email || ''
      );
      if (existingUserCheck) {
        // Se usuário já existe, manter o role existente (não mudar)
        role =
          existingUserCheck.role === 'technician' ? 'technician' : 'company';
      } else {
        // Se é novo usuário, usar role solicitado no login ou padrão (technician)
        role = requestedRoleFromCache || 'technician';
      }

      const sessionUser: SessionUser = {
        id: userInfo.id || (userInfo as any).sub || '',
        email: userInfo.email || '',
        firstName: userInfo.given_name || undefined,
        lastName: userInfo.family_name || undefined,
        picture: userInfo.picture || undefined,
      };

      req.session.user = sessionUser;
      // Adicionar role à sessão para uso posterior
      (req.session as any).userRole = role;

      // Verificar se usuário já existe
      const existingUser = await storage.getUserByEmail(sessionUser.email);
      let savedUser = existingUser;
      const trialDeviceId = getTrialDeviceId(req);
      const trialIp = getRequestIp(req);

      // Se usuário existe, verificar se o role corresponde
      if (existingUser) {
        // Usar o role existente do usuário (não o role detectado)
        role = existingUser.role === 'technician' ? 'technician' : 'company';

        // Atualizar usuário existente (pode atualizar nome/foto se mudou)
        try {

          savedUser = await storage.upsertUser({
            id: existingUser.id,
            email: existingUser.email,
            firstName: sessionUser.firstName || existingUser.firstName || '',
            lastName: sessionUser.lastName || existingUser.lastName || '',
            profileImageUrl:
              sessionUser.picture || existingUser.profileImageUrl,
            role: existingUser.role, // Manter role existente
            emailConfirmed: true,
          });
        } catch (storageError: any) {
          console.error(
            '[OAUTH-CALLBACK] ⚠️ Erro ao atualizar usuário no storage (não bloqueia login):',
            storageError?.message
          );
        }
      } else {
        // Criar novo usuário com o role correto
        try {
          if (trialDeviceId || trialIp) {
            const existingTrialUser = await findTrialUserByDeviceOrIp(
              trialDeviceId,
              trialIp
            );
            if (existingTrialUser) {
              req.session.destroy(() => {});
              return res
                .status(403)
                .send('Trial ja utilizado neste dispositivo ou rede.');
            }
          }

          savedUser = await storage.upsertUser({
            id: sessionUser.id,
            email: sessionUser.email,
            firstName: sessionUser.firstName || '',
            lastName: sessionUser.lastName || '',
            profileImageUrl: sessionUser.picture,
            role, // Usar role determinado
            emailConfirmed: true,
            trialDeviceId: trialDeviceId || null,
            trialIp: trialIp || null,
            trialClaimedAt: new Date().toISOString(),
          });
        } catch (storageError: any) {
          console.error(
            '[OAUTH-CALLBACK] ⚠️ Erro ao criar usuário no storage (não bloqueia login):',
            storageError?.message
          );
          // Não bloquear o login se houver erro ao salvar no storage
          // O usuário já está autenticado e os tokens foram salvos
        }
      }

      const legacyUserId = sessionUser.id;
      const resolvedUserId = savedUser?.id || sessionUser.id;
      const legacyTokenRecord =
        legacyUserId && resolvedUserId !== legacyUserId
          ? getUserRecord(legacyUserId)
          : null;

      if (resolvedUserId && legacyUserId !== resolvedUserId) {
        sessionUser.id = resolvedUserId;
        req.session.user = { ...sessionUser, id: resolvedUserId };
      }

      if (legacyTokenRecord && !getUserRecord(resolvedUserId)) {
        upsertUserRecord({
          userId: resolvedUserId,
          email: legacyTokenRecord.email,
          firstName: legacyTokenRecord.firstName,
          lastName: legacyTokenRecord.lastName,
          picture: legacyTokenRecord.picture,
          folderId: legacyTokenRecord.folderId,
          spreadsheetId: legacyTokenRecord.spreadsheetId,
          calendarId: legacyTokenRecord.calendarId,
          tokens: legacyTokenRecord.tokens,
        });
      }

      persistTokens({ ...sessionUser, id: resolvedUserId }, tokens);

      // Verificar se precisa completar cadastro
      // Master admin não precisa completar cadastro
      // IMPORTANTE: Usar apenas profileCompleted como condição principal
      // Se profileCompleted === true, o cadastro foi completado e não deve redirecionar
      const needsProfileCompletion =
        savedUser &&
        savedUser.role !== 'super_admin' &&
        !savedUser.profileCompleted;


      // Não exigir senha pós Google (fluxo antigo removido)
      (req.session as any).requirePassword = false;

      // Se precisa completar cadastro, redirecionar para página de completar
      if (needsProfileCompletion) {
        res.redirect('/completar-cadastro');
      } else {
        res.redirect('/');
      }
    } catch (error) {
      console.error('[OAUTH-CALLBACK] ERRO durante callback:', error);
      if (error instanceof Error) {
        console.error('[OAUTH-CALLBACK] Mensagem de erro:', error.message);
        console.error('[OAUTH-CALLBACK] Stack:', error.stack);
      }
      next(error);
    }
  });

  app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Verificar se há usuário na sessão
  const sessionUser = req.session?.user;

  if (!sessionUser || !sessionUser.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Preparar objeto do usuário para as rotas
  const isProfile = (sessionUser as any)?.isProfile || false;
  const profileRole = (sessionUser as any)?.role;
  const profileId = (sessionUser as any)?.profileId;

  (req as any).user = {
    ...sessionUser,
    // Preservar campos de perfil se existirem
    isProfile,
    profileId,
    role: profileRole || sessionUser.role, // Usar role do perfil se existir
    claims: {
      sub: sessionUser.id,
      email: sessionUser.email,
      given_name: sessionUser.firstName,
      family_name: sessionUser.lastName,
      picture: sessionUser.picture,
    },
  };

  next();
};

export const isSuperAdmin: RequestHandler = async (req, res, next) => {
  // Primeiro verificar autenticação
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Buscar o usuário completo do banco para verificar o role
  try {
    const fullUser = await storage.getUser(user.id);
    if (!fullUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verificar se é super admin
    if (fullUser.role !== 'super_admin') {
      return res
        .status(403)
        .json({ message: 'Forbidden: Super admin access required' });
    }

    // Adicionar user ao request
    (req as any).user = {
      ...user,
      claims: {
        sub: user.id,
        email: user.email,
        given_name: user.firstName,
        family_name: user.lastName,
        picture: user.picture,
      },
    };
    next();
  } catch (error) {
    console.error('Error checking super admin access:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Supabase Storage Implementation - API REST
 *
 * ImplementaÃ§Ã£o completa do IStorage usando API REST do Supabase (@supabase/supabase-js).
 * Evita problemas de DNS com conexÃ£o direta PostgreSQL.
 * Tenant Isolation Ã© feito na camada de aplicaÃ§Ã£o (filtro por userId).
 */

import { randomUUID } from 'crypto';
import { supabase } from './supabase-client';
import { pool } from './db';
import type {
  User,
  UpsertUser,
  Client,
  InsertClient,
  Service,
  InsertService,
  Ticket,
  InsertTicket,
  FinancialRecord,
  InsertFinancialRecord,
  IntegrationSettings,
  InsertIntegrationSettings,
  ReminderLog,
  InsertReminderLog,
  LocalEvent,
  InsertLocalEvent,
  PlanType,
  InsertPlanType,
  Subscription,
  InsertSubscription,
  TicketStatus,
  InsertTicketStatus,
  VehicleSettings,
  InsertVehicleSettings,
  ServiceOrderTemplate,
  InsertServiceOrderTemplate,
  ServiceOrder,
  InsertServiceOrder,
} from '@shared/schema';
import { slugify } from './utils/slugify';
import type { IStorage } from './storage';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { getUserRecord, upsertUserRecord } from './tokenStore';

const isMissingPixColumnError = (error: any) => {
  if (!error || error.code !== 'PGRST204') return false;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('pix_key') ||
    message.includes('pix_key_type') ||
    message.includes('pix_account_holder')
  );
};

const ensureIntegrationSettingsPixColumns = async () => {
  try {
    await pool.query(`
      alter table integration_settings
        add column if not exists pix_key text,
        add column if not exists pix_key_type text,
        add column if not exists pix_account_holder text;
    `);
    await pool.query("notify pgrst, 'reload schema'");
    return true;
  } catch (error: any) {
    console.warn(
      '[ensureIntegrationSettingsPixColumns] Failed to add pix columns:',
      error?.message || error
    );
    return false;
  }
};

// Helper para converter snake_case (banco) para camelCase (TypeScript)
function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );

    //   // CORREÃ‡ÃƒO: Preservar valores DECIMAL/NUMERIC como nÃºmeros
    // O Supabase retorna DECIMAL como string ou nÃºmero, mas precisamos garantir que seja nÃºmero
    if (value !== null && value !== undefined) {
      // Verificar se Ã© um campo decimal (baseado no nome da coluna em snake_case)
      // Campos DECIMAL no schema: ticket_value, km_rate, default_ticket_value,
      // default_km_rate, default_additional_hour_rate, price, amount, etc.
      const isDecimalField =
        /_(value|price|rate|amount)$|^km_|^hour_|total_amount|ticket_value|km_rate|default_ticket_value|default_km_rate|default_additional_hour_rate|extra_expenses|km_total|extra_hours|fuel_price|km_per_liter/i.test(
          key
        );

      if (isDecimalField) {
        // Converter para nÃºmero independentemente do tipo retornado pelo Supabase
        let numValue: number;

        if (typeof value === 'number') {
          numValue = value;
        } else if (typeof value === 'string') {
          // Remover espaÃ§os e converter vÃ­rgula para ponto
          const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
          numValue = parseFloat(cleaned);

          //   // LOG: Debug para valores decimais
          if (isNaN(numValue)) {
            console.warn(
              `[toCamelCase] âš ï¸ NÃ£o foi possÃ­vel converter valor decimal para nÃºmero:`,
              {
                key,
                camelKey,
                originalValue: value,
                cleaned,
              }
            );
          } else {
            console.log(`[toCamelCase]   Valor decimal convertido:`, {
              key,
              camelKey,
              originalValue: value,
              convertedValue: numValue,
            });
          }
        } else {
          // Tentar converter para nÃºmero
          numValue = Number(value);
        }

        if (!isNaN(numValue)) {
          result[camelKey] = numValue;
        } else {
          // Se nÃ£o conseguir converter, manter o valor original
          result[camelKey] = value;
        }
      } else if (
        value &&
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        // Converter strings ISO de data para objetos Date quando apropriado
        const dateValue = new Date(value);
        if (!isNaN(dateValue.getTime())) {
          result[camelKey] = dateValue;
        } else {
          result[camelKey] = value;
        }
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        // RecursÃ£o para objetos aninhados
        result[camelKey] = toCamelCase(value);
      } else {
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// Helper para converter camelCase (TypeScript) para snake_case (banco)
function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  // Tratar objetos Date - converter para ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );

    // Tratar valores Date individualmente
    if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // RecursÃ£o para objetos aninhados
      result[snakeKey] = toSnakeCase(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

export class SupabaseStorage implements IStorage {
  // Campos vÃ¡lidos da tabela users (sem company_logo_url que nÃ£o existe)
  private readonly USER_SELECT_FIELDS =
    'id, email, first_name, last_name, profile_image_url, role, public_slug, company_name, company_logo_url, tenant_slug, cpf, cnpj, phone, zip_code, street_address, address_number, address_complement, neighborhood, city, state, created_at, updated_at, email_confirmed, email_confirmation_expires_at, profile_completed, trial_device_id, trial_ip, trial_claimed_at';

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select(this.USER_SELECT_FIELDS)
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getUser] Erro:', error);
      return undefined;
    }

    if (data) {
      const converted = toCamelCase(data) as User;
      return converted;
    }

    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;

    // Normalizar email para lowercase para busca case-insensitive
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await supabase
      .from('users')
      .select(this.USER_SELECT_FIELDS)
      .ilike('email', normalizedEmail)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getUserByEmail] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as User) : undefined;
  }

  // Buscar usuÃ¡rio por email e role (permite mesmo email com roles diferentes)
  // Como o email no banco Ã© Ãºnico, usamos um formato email+role@domain.com
  async getUserByEmailAndRole(
    email: string,
    role: 'technician' | 'company' | 'super_admin' | 'tech' | 'empresa'
  ): Promise<User | undefined> {
    if (!email) return undefined;

    // Normalizar email para lowercase antes de criar email Ãºnico
    const normalizedEmail = email.toLowerCase().trim();
    const emailParts = normalizedEmail.split('@');
    if (emailParts.length !== 2) return undefined;

    // Converter role novo para antigo se necessÃ¡rio (compatibilidade)
    let roleToSearch = role;
    if (role === 'tech') {
      roleToSearch = 'technician';
    } else if (role === 'empresa') {
      roleToSearch = 'company';
    }

    // Criar email Ãºnico baseado no email original + role (sempre lowercase)
    const uniqueEmail = `${emailParts[0]}+${roleToSearch}@${emailParts[1]}`;

    // Buscar com role convertido
    const { data, error } = await supabase
      .from('users')
      .select(this.USER_SELECT_FIELDS)
      .eq('email', uniqueEmail)
      .eq('role', roleToSearch)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[getUserByEmailAndRole] Erro:', error);
      return undefined;
    }

    // Se nÃ£o encontrou com role antigo, tentar com role novo
    if (!data && (role === 'tech' || role === 'empresa')) {
      const uniqueEmailNew = `${emailParts[0]}+${role}@${emailParts[1]}`;
      const { data: dataNew, error: errorNew } = await supabase
        .from('users')
        .select(this.USER_SELECT_FIELDS)
        .eq('email', uniqueEmailNew)
        .eq('role', role)
        .limit(1)
        .maybeSingle();

      if (errorNew && errorNew.code !== 'PGRST116') {
        console.error(
          '[getUserByEmailAndRole] Erro na busca com role novo:',
          errorNew
        );
        return undefined;
      }

      return dataNew ? (toCamelCase(dataNew) as User) : undefined;
    }

    return data ? (toCamelCase(data) as User) : undefined;
  }

  async getUserBySlug(slug: string): Promise<User | undefined> {
    const normalized = slugify(slug);
    if (!normalized) return undefined;

    // Primeiro tentar buscar por tenant_slug (prioridade)
    let { data, error } = await supabase
      .from('users')
      .select(this.USER_SELECT_FIELDS)
      .eq('tenant_slug', normalized)
      .limit(1)
      .single();

    // Se nÃ£o encontrar por tenant_slug, buscar por public_slug (fallback)
    if ((error && error.code === 'PGRST116') || !data) {
      const result = await supabase
        .from('users')
        .select(this.USER_SELECT_FIELDS)
        .eq('public_slug', normalized)
        .limit(1)
        .single();

      data = result.data;
      error = result.error;
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[getUserBySlug] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as User) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select(this.USER_SELECT_FIELDS);

    if (error) {
      console.error('[getAllUsers] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as User[];
  }

  private async generateUniqueSlug(userData: UpsertUser): Promise<string> {
    try {
      const { id, publicSlug, firstName, lastName, email, companyName, role } =
        userData;

      // Buscar usuÃ¡rio existente para verificar se companyName mudou
      const existing = id ? await this.getUser(id) : null;
      const isCompany = role === 'company' || existing?.role === 'company';

      // Se companyName foi fornecido (para empresas ou tÃ©cnicos), usar para gerar slug
      // IMPORTANTE: Se companyName mudou, sempre regenerar o slug
      let baseSlugCandidate: string;
      const companyNameChanged =
        existing && companyName && existing.companyName !== companyName;

      if (companyName) {
        // Para empresas e tÃ©cnicos, usar o nome da empresa quando disponÃ­vel
        // Se o companyName mudou, forÃ§ar regeneraÃ§Ã£o do slug
        baseSlugCandidate = companyName;
      } else if (
        !isCompany &&
        publicSlug?.trim() &&
        existing?.publicSlug === publicSlug.trim() &&
        !companyNameChanged
      ) {
        // Para tÃ©cnicos sem companyName, manter slug existente apenas se nÃ£o mudou
        baseSlugCandidate = publicSlug.trim();
      } else if (isCompany) {
        // Para empresas sem companyName, usar fallback
        baseSlugCandidate = 'empresa';
      } else {
        // Para tÃ©cnicos sem companyName, usar firstName + lastName ou email
        baseSlugCandidate =
          [firstName, lastName].filter(Boolean).join(' ') ||
          email?.split('@')[0] ||
          'tecnico';
      }

      const baseSlug = slugify(baseSlugCandidate) || 'tecnico';

      // Garantir que o slug nÃ£o estÃ¡ vazio
      if (!baseSlug || baseSlug.trim() === '') {
        const fallbackSlug = email
          ? slugify(email.split('@')[0]) || `user-${Date.now()}`
          : `user-${Date.now()}`;
        console.warn(
          '[generateUniqueSlug] Slug vazio, usando fallback:',
          fallbackSlug
        );
        return fallbackSlug;
      }

      let candidate = baseSlug;
      let suffix = 1;
      let attempts = 0;
      const maxAttempts = 100; // Prevenir loop infinito

      while (attempts < maxAttempts) {
        attempts++;

        try {
          // Usar API REST - mais rÃ¡pido e confiÃ¡vel
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('public_slug', candidate)
            .limit(1)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error(
              '[generateUniqueSlug] Erro ao verificar slug:',
              error
            );
            // Em caso de erro na consulta, adicionar sufixo para evitar conflito
            if (attempts === 1) {
              candidate = `${baseSlug}-${Date.now()}`;
              continue;
            }
          }

          if (!data || data.id === id) {
            return candidate;
          }

          suffix += 1;
          candidate = `${baseSlug}-${suffix}`;
        } catch (queryError: any) {
          console.error('[generateUniqueSlug] Erro na consulta:', queryError);
          // Em caso de erro, usar timestamp para garantir unicidade
          candidate = `${baseSlug}-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 5)}`;
          return candidate;
        }
      }

      // Se chegou aqui, usar timestamp + random como Ãºltimo recurso
      console.warn(
        '[generateUniqueSlug] Max tentativas atingido, usando slug com timestamp'
      );
      return `${baseSlug}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 5)}`;
    } catch (error: any) {
      console.error('[generateUniqueSlug] Erro geral:', error);
      // Fallback seguro em caso de qualquer erro
      const emailPart = userData.email?.split('@')[0] || 'user';
      return `${slugify(emailPart)}-${Date.now()}`;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = await this.getUser(userData.id);
    const slug = await this.generateUniqueSlug(userData);

    const now = new Date().toISOString();

    // Usar role do userData se fornecido explicitamente, senÃ£o manter o role existente, senÃ£o default 'technician'
    // Se userData.role estÃ¡ definido (mesmo que seja null), usar ele; caso contrÃ¡rio, manter existente
    const role =
      userData.role !== undefined
        ? userData.role
        : existing?.role || 'technician';

    // Preparar dados para inserÃ§Ã£o
    // IMPORTANTE: Se companyName mudou, sempre usar o novo slug gerado (nÃ£o usar publicSlug antigo)
    const companyNameChanged =
      existing &&
      userData.companyName &&
      existing.companyName !== userData.companyName;


    // PRIORIDADE: Se hÃ¡ companyName, SEMPRE usar o slug gerado baseado nele
    // O slug gerado jÃ¡ foi criado baseado no companyName (se disponÃ­vel) na funÃ§Ã£o generateUniqueSlug
    // SÃ³ usar publicSlug explÃ­cito se NÃƒO houver companyName E nÃ£o tiver mudado
    const finalSlug =
      userData.companyName || companyNameChanged
        ? slug // Sempre usar slug gerado quando hÃ¡ companyName ou quando mudou
        : userData.publicSlug
        ? slugify(userData.publicSlug)
        : slug;

    const userDataToInsert: any = {
      id: userData.id,
      email: userData.email || null,
      role: role as 'technician' | 'company' | 'super_admin',
      public_slug: finalSlug,
      created_at: existing?.createdAt || now,
      updated_at: now,
    };

    // IMPORTANTE: Preservar first_name e last_name se nÃ£o forem fornecidos
    // SÃ³ atualizar se explicitamente fornecido (nÃ£o undefined)
    //   // CORREÃ‡ÃƒO: Tratar strings vazias como null (permitir limpar campos)
    if (userData.firstName !== undefined) {
      userDataToInsert.first_name =
        userData.firstName === '' ? null : userData.firstName || null;
    } else if (existing?.firstName !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.first_name = existing.firstName || null;
    } else {
      // Novo usuÃ¡rio sem firstName
      userDataToInsert.first_name = null;
    }

    if (userData.lastName !== undefined) {
      userDataToInsert.last_name =
        userData.lastName === '' ? null : userData.lastName || null;
    } else if (existing?.lastName !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.last_name = existing.lastName || null;
    } else {
      // Novo usuÃ¡rio sem lastName
      userDataToInsert.last_name = null;
    }

    // IMPORTANTE: Preservar profile_image_url e company_logo_url se nÃ£o forem fornecidos
    // SÃ³ atualizar se explicitamente fornecido (nÃ£o undefined)
    if (userData.profileImageUrl !== undefined) {
      userDataToInsert.profile_image_url = userData.profileImageUrl || null;
    } else if (existing?.profileImageUrl !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.profile_image_url = existing.profileImageUrl || null;
    }

    // Adicionar campos opcionais apenas se existirem no schema do banco
    // Verificar se company_name existe antes de adicionar
    //   // CORREÃ‡ÃƒO: Tratar strings vazias como null (permitir limpar campos)
    if (userData.companyName !== undefined) {
      userDataToInsert.company_name =
        userData.companyName === '' ? null : userData.companyName || null;
    } else if (existing?.companyName !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.company_name = existing.companyName || null;
    } else {
      // Novo usuÃ¡rio sem companyName
      userDataToInsert.company_name = null;
    }

    // IMPORTANTE: Preservar company_logo_url se nÃ£o for fornecido
    // SÃ³ atualizar se explicitamente fornecido (nÃ£o undefined)
    if (userData.companyLogoUrl !== undefined) {
      // Se foi fornecido explicitamente (mesmo que seja null), usar o valor fornecido
      userDataToInsert.company_logo_url = userData.companyLogoUrl || null;
    } else if (existing) {
      // Se nÃ£o foi fornecido, preservar valor existente (mesmo que seja null)
      userDataToInsert.company_logo_url = existing.companyLogoUrl ?? null;
    } else {
      // Novo usuÃ¡rio sem logo
      userDataToInsert.company_logo_url = null;
    }

    // Adicionar profile_completed se fornecido
    if (userData.profileCompleted !== undefined) {
      userDataToInsert.profile_completed = userData.profileCompleted;
      console.log(
        '[upsertUser] ðŸ“ profile_completed fornecido:',
        userData.profileCompleted
      );
    } else if (existing?.profileCompleted !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.profile_completed = existing.profileCompleted;
      console.log(
        '[upsertUser] ðŸ’¾ Preservando profile_completed existente:',
        existing.profileCompleted
      );
    }

    // Adicionar email_confirmed se fornecido
    if (userData.emailConfirmed !== undefined) {
      userDataToInsert.email_confirmed = userData.emailConfirmed;
      console.log(
        '[upsertUser] ðŸ“ email_confirmed fornecido:',
        userData.emailConfirmed
      );
    } else if (existing?.emailConfirmed !== undefined) {
      // Preservar valor existente se nÃ£o foi fornecido
      userDataToInsert.email_confirmed = existing.emailConfirmed;
      console.log(
        '[upsertUser] ðŸ’¾ Preservando email_confirmed existente:',
        existing.emailConfirmed
      );
    }

    // Adicionar email_confirmation_expires_at se fornecido
    if (userData.emailConfirmationExpiresAt !== undefined) {
      userDataToInsert.email_confirmation_expires_at =
        userData.emailConfirmationExpiresAt || null;
      console.log(
        '[upsertUser] ðŸ“ email_confirmation_expires_at fornecido:',
        userData.emailConfirmationExpiresAt
      );
    } else if (existing && 'emailConfirmationExpiresAt' in existing) {
      userDataToInsert.email_confirmation_expires_at =
        (existing as any).emailConfirmationExpiresAt ?? null;
      console.log(
        '[upsertUser] ðŸ’¾ Preservando email_confirmation_expires_at existente:',
        (existing as any).emailConfirmationExpiresAt ?? null
      );
    }

    if ((userData as any).trialDeviceId !== undefined) {
      userDataToInsert.trial_device_id =
        (userData as any).trialDeviceId || null;
    } else if (existing && 'trialDeviceId' in existing) {
      userDataToInsert.trial_device_id = (existing as any).trialDeviceId ?? null;
    }

    if ((userData as any).trialIp !== undefined) {
      userDataToInsert.trial_ip = (userData as any).trialIp || null;
    } else if (existing && 'trialIp' in existing) {
      userDataToInsert.trial_ip = (existing as any).trialIp ?? null;
    }

    if ((userData as any).trialClaimedAt !== undefined) {
      userDataToInsert.trial_claimed_at =
        (userData as any).trialClaimedAt || null;
    } else if (existing && 'trialClaimedAt' in existing) {
      userDataToInsert.trial_claimed_at =
        (existing as any).trialClaimedAt ?? null;
    }

    // Asaas removido - serÃ¡ implementado Stripe

    // Adicionar tenant_slug se fornecido
    if (userData.tenantSlug !== undefined) {
      userDataToInsert.tenant_slug = userData.tenantSlug || null;
    } else if (existing && 'tenantSlug' in existing) {
      userDataToInsert.tenant_slug = (existing as any).tenantSlug ?? null;
    }

    // Adicionar cpf se fornecido
    if (userData.cpf !== undefined) {
      userDataToInsert.cpf = userData.cpf || null;
    } else if (existing && 'cpf' in existing) {
      userDataToInsert.cpf = (existing as any).cpf ?? null;
    }

    // Adicionar cnpj se fornecido
    if ((userData as any).cnpj !== undefined) {
      userDataToInsert.cnpj = (userData as any).cnpj || null;
    } else if (existing && 'cnpj' in existing) {
      userDataToInsert.cnpj = (existing as any).cnpj ?? null;
    }

    // Adicionar birth_date se fornecido
    if ((userData as any).birthDate !== undefined) {
      userDataToInsert.birth_date = (userData as any).birthDate || null;
    } else if (existing && 'birthDate' in existing) {
      userDataToInsert.birth_date = (existing as any).birthDate ?? null;
    }

    // Adicionar company_type se fornecido
    if ((userData as any).companyType !== undefined) {
      userDataToInsert.company_type = (userData as any).companyType || null;
    } else if (existing && 'companyType' in existing) {
      userDataToInsert.company_type = (existing as any).companyType ?? null;
    }

    // Adicionar income_value se fornecido
    if ((userData as any).incomeValue !== undefined) {
      userDataToInsert.income_value = (userData as any).incomeValue || null;
    } else if (existing && 'incomeValue' in existing) {
      userDataToInsert.income_value = (existing as any).incomeValue ?? null;
    }

    // Adicionar phone se fornecido
    if (userData.phone !== undefined) {
      userDataToInsert.phone = userData.phone || null;
    } else if (existing && 'phone' in existing) {
      userDataToInsert.phone = (existing as any).phone ?? null;
    }

    // Adicionar campos de endereÃ§o se fornecidos
    if (userData.zipCode !== undefined) {
      userDataToInsert.zip_code = userData.zipCode || null;
    } else if (existing && 'zipCode' in existing) {
      userDataToInsert.zip_code = (existing as any).zipCode ?? null;
    }

    if (userData.streetAddress !== undefined) {
      userDataToInsert.street_address = userData.streetAddress || null;
    } else if (existing && 'streetAddress' in existing) {
      userDataToInsert.street_address = (existing as any).streetAddress ?? null;
    }

    if (userData.addressNumber !== undefined) {
      userDataToInsert.address_number = userData.addressNumber || null;
    } else if (existing && 'addressNumber' in existing) {
      userDataToInsert.address_number = (existing as any).addressNumber ?? null;
    }

    if (userData.addressComplement !== undefined) {
      userDataToInsert.address_complement = userData.addressComplement || null;
    } else if (existing && 'addressComplement' in existing) {
      userDataToInsert.address_complement =
        (existing as any).addressComplement ?? null;
    }

    if (userData.neighborhood !== undefined) {
      userDataToInsert.neighborhood = userData.neighborhood || null;
    } else if (existing && 'neighborhood' in existing) {
      userDataToInsert.neighborhood = (existing as any).neighborhood ?? null;
    }

    if (userData.city !== undefined) {
      userDataToInsert.city = userData.city || null;
    } else if (existing && 'city' in existing) {
      userDataToInsert.city = (existing as any).city ?? null;
    }

    if (userData.state !== undefined) {
      userDataToInsert.state = userData.state || null;
    } else if (existing && 'state' in existing) {
      userDataToInsert.state = (existing as any).state ?? null;
    }

    // Tentar inserir primeiro (para novos usuÃ¡rios)
    // Remover campos undefined/null e garantir que company_logo_url nÃ£o estÃ¡ presente
    const allowedColumns = [
      'id',
      'email',
      'first_name',
      'last_name',
      'profile_image_url',
      'role',
      'public_slug',
      'company_name',
      'company_logo_url',
      'tenant_slug',
      'cpf',
      'phone',
      'zip_code',
      'street_address',
      'address_number',
      'address_complement',
      'neighborhood',
      'city',
      'state',
      'created_at',
      'updated_at',
      'email_confirmed',
      'email_confirmation_expires_at',
      'profile_completed',
      'trial_device_id',
      'trial_ip',
      'trial_claimed_at',
    ];

    // Filtrar para incluir APENAS colunas permitidas
    const finalData: any = {};
    for (const key of allowedColumns) {
      if (key in userDataToInsert && userDataToInsert[key] !== undefined) {
        finalData[key] = userDataToInsert[key];
      }
    }


    // Usar Supabase Client API (REST) - mais rÃ¡pido e confiÃ¡vel que Drizzle direto
    // A API REST usa HTTPS e nÃ£o precisa de conexÃ£o TCP direta, evitando problemas IPv6
    console.log(
      '[upsertUser] ðŸš€ Usando Supabase Client API (REST) para inserir usuÃ¡rio...'
    );

    // Preparar dados para Supabase API (snake_case como no banco)
    // IMPORTANTE: Incluir TODOS os campos, mesmo que sejam null, para garantir que sejam atualizados
    const apiData: any = {
      id: finalData.id,
      email: finalData.email,
      first_name:
        finalData.first_name !== undefined ? finalData.first_name : null,
      last_name: finalData.last_name !== undefined ? finalData.last_name : null,
      profile_image_url:
        finalData.profile_image_url !== undefined
          ? finalData.profile_image_url
          : null,
      role: finalData.role,
      public_slug: finalData.public_slug,
      updated_at: now, // Sempre atualizar updated_at
    };

    // SÃ³ incluir created_at se for um novo usuÃ¡rio
    if (!existing) {
      apiData.created_at = finalData.created_at || now;
    }

    // Adicionar company_name (sempre incluir, mesmo que null)
    apiData.company_name =
      finalData.company_name !== undefined ? finalData.company_name : null;

    // Adicionar company_logo_url (sempre incluir, mesmo que null)
    apiData.company_logo_url =
      finalData.company_logo_url !== undefined
        ? finalData.company_logo_url
        : null;

    // Adicionar email_confirmed se existir
    if (finalData.email_confirmed !== undefined) {
      apiData.email_confirmed = finalData.email_confirmed;
    }

    // Adicionar email_confirmation_expires_at se existir
    if (finalData.email_confirmation_expires_at !== undefined) {
      apiData.email_confirmation_expires_at =
        finalData.email_confirmation_expires_at || null;
    }

    // Adicionar profile_completed se existir
    if (finalData.profile_completed !== undefined) {
      apiData.profile_completed = finalData.profile_completed;
    }

    if ('trial_device_id' in userDataToInsert) {
      apiData.trial_device_id = userDataToInsert.trial_device_id || null;
    } else if (existing) {
      apiData.trial_device_id = (existing as any).trialDeviceId || null;
    }

    if ('trial_ip' in userDataToInsert) {
      apiData.trial_ip = userDataToInsert.trial_ip || null;
    } else if (existing) {
      apiData.trial_ip = (existing as any).trialIp || null;
    }

    if ('trial_claimed_at' in userDataToInsert) {
      apiData.trial_claimed_at = userDataToInsert.trial_claimed_at || null;
    } else if (existing) {
      apiData.trial_claimed_at = (existing as any).trialClaimedAt || null;
    }

    //   // CORREÃ‡ÃƒO: Adicionar campos de endereÃ§o e telefone/CPF
    // Esses campos sÃ£o essenciais e devem ser sempre incluÃ­dos no apiData
    // Verificar se estÃ£o em userDataToInsert (foram fornecidos) ou usar valores existentes
    if ('phone' in userDataToInsert) {
      apiData.phone = userDataToInsert.phone || null;
    } else if (existing) {
      apiData.phone = (existing as any).phone || null;
    } else {
      apiData.phone = null;
    }

    if ('cpf' in userDataToInsert) {
      apiData.cpf = userDataToInsert.cpf || null;
    } else if (existing) {
      apiData.cpf = (existing as any).cpf || null;
    } else {
      apiData.cpf = null;
    }

    if ('zip_code' in userDataToInsert) {
      apiData.zip_code = userDataToInsert.zip_code || null;
    } else if (existing) {
      apiData.zip_code = (existing as any).zipCode || null;
    } else {
      apiData.zip_code = null;
    }

    if ('street_address' in userDataToInsert) {
      apiData.street_address = userDataToInsert.street_address || null;
    } else if (existing) {
      apiData.street_address = (existing as any).streetAddress || null;
    } else {
      apiData.street_address = null;
    }

    if ('address_number' in userDataToInsert) {
      apiData.address_number = userDataToInsert.address_number || null;
    } else if (existing) {
      apiData.address_number = (existing as any).addressNumber || null;
    } else {
      apiData.address_number = null;
    }

    if ('address_complement' in userDataToInsert) {
      apiData.address_complement = userDataToInsert.address_complement || null;
    } else if (existing) {
      apiData.address_complement = (existing as any).addressComplement || null;
    } else {
      apiData.address_complement = null;
    }

    if ('neighborhood' in userDataToInsert) {
      apiData.neighborhood = userDataToInsert.neighborhood || null;
    } else if (existing) {
      apiData.neighborhood = (existing as any).neighborhood || null;
    } else {
      apiData.neighborhood = null;
    }

    if ('city' in userDataToInsert) {
      apiData.city = userDataToInsert.city || null;
    } else if (existing) {
      apiData.city = (existing as any).city || null;
    } else {
      apiData.city = null;
    }

    if ('state' in userDataToInsert) {
      apiData.state = userDataToInsert.state || null;
    } else if (existing) {
      apiData.state = (existing as any).state || null;
    } else {
      apiData.state = null;
    }

    if ('tenant_slug' in userDataToInsert) {
      apiData.tenant_slug = userDataToInsert.tenant_slug || null;
    } else if (existing) {
      apiData.tenant_slug = existing.tenantSlug || null;
    } else {
      apiData.tenant_slug = null;
    }

    // Usar upsert do Supabase (insert ou update se jÃ¡ existir)
    // A API REST do Supabase Ã© muito mais rÃ¡pida que conexÃ£o direta PostgreSQL
    const startTime = Date.now();

    const { data: insertedData, error: insertError } = await supabase
      .from('users')
      .upsert(apiData, {
        onConflict: 'id', // Se id jÃ¡ existe, atualiza
        ignoreDuplicates: false,
      })
      .select(this.USER_SELECT_FIELDS)
      .single();

    const duration = Date.now() - startTime;

    let data = insertedData;
    let error = insertError;

    // Se erro de constraint Ãºnica (usuÃ¡rio jÃ¡ existe), fazer update
    if (
      error &&
      (error.code === '23505' || error.message?.includes('duplicate key'))
    ) {

      // Remover created_at do update (manter o original)
      const updateData = { ...apiData };
      delete updateData.created_at;
      delete updateData.id; // NÃ£o atualizar o id

      // IMPORTANTE: Sempre remover tenant_slug do update se nÃ£o mudou
      // Isso evita erro de constraint Ãºnica quando o slug jÃ¡ existe para este usuÃ¡rio
      const existingTenantSlug = (existing as any)?.tenantSlug || null;
      const newTenantSlug = updateData.tenant_slug || null;
      
      // Se o tenant_slug Ã© o mesmo do existente, remover do update (nÃ£o precisa atualizar)
      // OU se nÃ£o foi fornecido explicitamente (undefined), tambÃ©m remover
      if (
        existingTenantSlug === newTenantSlug ||
        userData.tenantSlug === undefined
      ) {
        delete updateData.tenant_slug;
        console.log(
          '[upsertUser] âš ï¸ tenant_slug removido do update (nÃ£o mudou ou nÃ£o foi fornecido)',
          {
          existingTenantSlug,
          newTenantSlug,
          userDataTenantSlug: userData.tenantSlug,
            willRemove: true,
          }
        );
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', finalData.id)
        .select(this.USER_SELECT_FIELDS)
        .single();

      if (!updateError) {
        data = updatedData;
        error = null;
      } else {
        error = updateError;
        console.error('[upsertUser] âŒ Erro ao atualizar:', updateError);
      }
    } else if (!error && data) {
    } else if (error) {
      console.error('='.repeat(80));
      console.error('[upsertUser] âŒ Erro ao inserir/atualizar via API REST');
      console.error('[upsertUser] CÃ³digo:', error.code);
      console.error('[upsertUser] Mensagem:', error.message);
      console.error('[upsertUser] Detalhes:', error.details);
      console.error('[upsertUser] Hint:', error.hint);

      // Se for erro relacionado a coluna nÃ£o encontrada
      if (
        error.code === 'PGRST204' ||
        error.message?.includes('column') ||
        error.message?.includes('does not exist')
      ) {
        console.error('[upsertUser] âš ï¸ ERRO: Coluna nÃ£o encontrada no schema');
        console.error(
          "[upsertUser] ðŸ’¡ Execute no Supabase: NOTIFY pgrst, 'reload schema';"
        );
      }

      console.error('='.repeat(80));
    }

    if (error) {
      console.error('='.repeat(80));
      console.error('[upsertUser] âŒ ERRO ao inserir/atualizar usuÃ¡rio');
      console.error('[upsertUser] CÃ³digo do erro:', error.code);
      console.error('[upsertUser] Mensagem:', error.message);
      console.error('[upsertUser] Detalhes:', error.details);
      console.error('[upsertUser] Hint:', error.hint);
      console.error('[upsertUser] Dados que tentaram ser inseridos:', {
        keys: Object.keys(apiData),
        email: apiData.email,
        role: apiData.role,
        hasCompanyLogoUrl: 'company_logo_url' in apiData,
      });

      // Se for erro relacionado a schema/cache
      if (
        error.code === 'PGRST204' ||
        error.message?.includes('column') ||
        error.message?.includes('does not exist')
      ) {
        console.error(
          '[upsertUser] âš ï¸ ERRO: Coluna nÃ£o encontrada no schema cache'
        );
        console.error(
          '[upsertUser] ðŸ’¡ SOLUÃ‡ÃƒO: Execute no Supabase SQL Editor:'
        );
        console.error("[upsertUser]    NOTIFY pgrst, 'reload schema';");
      }

      console.error('='.repeat(80));

      throw new Error(`Erro ao criar/atualizar usuÃ¡rio: ${error.message}`);
    }

    // Converter de snake_case para camelCase usando toCamelCase
    // A funÃ§Ã£o toCamelCase jÃ¡ converte automaticamente todos os campos
    const userResult: any = toCamelCase(data);

    return userResult as User;
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getClient] Erro:', error);
      return undefined;
    }

    if (data) {
      const converted = toCamelCase(data) as Client;

      return converted;
    }

    return undefined;
  }

  async getClientsByUser(userId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getClientsByUser] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Client[];
  }

  async createClient(clientData: InsertClient): Promise<Client> {
    // Remover campos undefined/null e campos de confirmaÃ§Ã£o de email
    // (essas colunas podem nÃ£o existir no banco de dados)
    const cleanedData: any = {};
    const fieldsToExclude = [
      'emailConfirmationToken',
      'emailConfirmationExpiresAt',
      'email_confirmation_token',
      'email_confirmation_expires_at',
    ];

    for (const [key, value] of Object.entries(clientData)) {
      // Pular campos undefined/null
      if (value === undefined || value === null) {
        continue;
      }
      // Pular campos de confirmaÃ§Ã£o de email (coluna nÃ£o existe no banco)
      if (fieldsToExclude.includes(key)) {
        continue;
      }
      cleanedData[key] = value;
    }

    const dataToInsert = toSnakeCase(cleanedData);

    const { data, error } = await supabase
      .from('clients')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createClient] Erro:', error);
      console.error(
        '[createClient] Dados tentados:',
        JSON.stringify(dataToInsert, null, 2)
      );
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }

    return toCamelCase(data) as Client;
  }

  async updateClient(
    id: string,
    clientData: Partial<Client>
  ): Promise<Client | undefined> {
    const dataToUpdate = toSnakeCase(clientData);

    const { data, error } = await supabase
      .from('clients')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateClient] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as Client) : undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const { error } = await supabase.from('clients').delete().eq('id', id);

    if (error) {
      console.error('[deleteClient] Erro:', error);
      return false;
    }

    return true;
  }

  async deleteAllClientsByUser(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('clients')
      .delete()
      .eq('user_id', userId)
      .select('id');

    if (error) {
      console.error('[deleteAllClientsByUser] Erro:', error);
      return 0;
    }

    return data?.length || 0;
  }

  // Services
  async getService(id: string): Promise<Service | undefined> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getService] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as Service) : undefined;
  }

  async getServicesByUser(userId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getServicesByUser] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Service[];
  }

  async getActiveServicesByUser(userId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getActiveServicesByUser] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Service[];
  }

  async ensureDefaultService(userId: string): Promise<void> {
    const existing = await this.getServicesByUser(userId);
    if (existing.length === 0) {
      await this.createService({
        userId,
        name: 'Visita tÃ©cnica',
        description: 'ServiÃ§o padrÃ£o',
        price: '0',
        duration: 1,
        active: true,
        publicBooking: true,
      });
    }
  }

  async createService(serviceData: InsertService): Promise<Service> {
    const dataToInsert = toSnakeCase(serviceData);

    const { data, error } = await supabase
      .from('services')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createService] Erro:', error);
      throw new Error(`Erro ao criar serviÃ§o: ${error.message}`);
    }

    return toCamelCase(data) as Service;
  }

  async updateService(
    id: string,
    serviceData: Partial<InsertService>
  ): Promise<Service | undefined> {
    const dataToUpdate = toSnakeCase(serviceData);

    const { data, error } = await supabase
      .from('services')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateService] Erro:', error);
      throw new Error(`Erro ao atualizar serviÃ§o: ${error.message}`);
    }

    if (!data) {
      throw new Error('Erro ao atualizar serviÃ§o: retorno vazio');
    }

    return toCamelCase(data) as Service;
  }

  async deleteService(id: string): Promise<boolean> {
    const { error } = await supabase.from('services').delete().eq('id', id);

    if (error) {
      console.error('[deleteService] Erro:', error);
      return false;
    }

    return true;
  }

  // Tickets
  async getTicket(id: string): Promise<Ticket | undefined> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getTicket] Erro:', error);
      return undefined;
    }

    if (data) {
      //   // CORREÃ‡ÃƒO: Log para debug de valores decimais

      const converted = toCamelCase(data) as Ticket;

      //   // CORREÃ‡ÃƒO: Log apÃ³s conversÃ£o

      return converted;
    }

    return undefined;
  }

  async getTicketsByUser(userId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('[getTicketsByUser] âŒ Erro ao buscar tickets:', error);
      return [];
    }

    const tickets = (data || []).map((row: any) => {
      const camelCaseRow = toCamelCase(row);
      // IMPORTANTE: Preservar o status original do banco antes da conversÃ£o
      // O Supabase pode retornar em snake_case, mas precisamos preservar o valor exato
      // O status pode vir como 'CANCELADO', 'CANCELLED', 'cancelled', etc.
      const rawStatus = row.status || row.STATUS || (row as any).Status;
      if (rawStatus) {
        // Preservar o status original exatamente como estÃ¡ no banco
        (camelCaseRow as any).originalStatus = rawStatus;
        // Manter status original tambÃ©m em status (nÃ£o converter para lowercase)
        (camelCaseRow as any).status = rawStatus;
      }
      return camelCaseRow;
    }) as Ticket[];

    return tickets;
  }

  async getTicketsByClient(clientId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('[getTicketsByClient] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Ticket[];
  }

  async getTicketsByTechnician(technicianId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('technician_id', technicianId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('[getTicketsByTechnician] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Ticket[];
  }

  async getTicketsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', startDate.toISOString())
      .lte('scheduled_date', endDate.toISOString())
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('[getTicketsByDateRange] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Ticket[];
  }

  async getTicketsByStatus(userId: string, status: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('[getTicketsByStatus] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Ticket[];
  }

  async getTicketsByStatuses(
    userId: string,
    statuses: string[]
  ): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .in('status', statuses)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('[getTicketsByStatuses] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as Ticket[];
  }

  async getNextTicketNumber(userId: string): Promise<string> {
    return this.generateTicketNumber(userId);
  }

  private async generateTicketNumber(userId: string): Promise<string> {
    try {
      const allTickets = await this.getTicketsByUser(userId);
      const currentYear = new Date().getFullYear();
      let maxNumber = 0;

      allTickets.forEach((ticket) => {
        const ticketNumber = ticket.ticketNumber;
        if (ticketNumber) {
          const match = ticketNumber.match(/^(\d{4})-(\d+)$/);
          if (match) {
            const year = parseInt(match[1], 10);
            const number = parseInt(match[2], 10);
            if (year === currentYear && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      });

      const nextNumber = maxNumber + 1;
      return `${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('[generateTicketNumber] Erro ao gerar nÃºmero:', error);
      const now = new Date();
      return `${now.getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  }

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    // Gerar nÃºmero de chamado se nÃ£o foi fornecido
    let ticketNumber = ticketData.ticketNumber;
    if (!ticketNumber) {
      ticketNumber = await this.generateTicketNumber(ticketData.userId);
    }

    const dataToInsert = toSnakeCase({
      ...ticketData,
      ticketNumber,
      status: ticketData.status || 'ABERTO',
    });

    const { data, error } = await supabase
      .from('tickets')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createTicket] Erro:', error);
      throw new Error(`Erro ao criar ticket: ${error.message}`);
    }

    return toCamelCase(data) as Ticket;
  }

  async updateTicket(
    id: string,
    ticketData: Partial<Ticket>
  ): Promise<Ticket | undefined> {
    const dataToUpdate = toSnakeCase(ticketData);

    const { data, error } = await supabase
      .from('tickets')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateTicket] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as Ticket) : undefined;
  }

  async deleteTicket(id: string): Promise<boolean> {
    console.log(`[deleteTicket] Tentando excluir ticket com id: ${id}`);
    
    // Primeiro, verificar se o ticket existe
    const { data: existingTicket, error: checkError } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingTicket) {
      console.warn(`[deleteTicket] Ticket ${id} nao encontrado:`, checkError);
      return false;
    }

    console.log(`[deleteTicket] Ticket ${id} encontrado, procedendo com exclusao...`);

    // Keep in sync with tables that reference tickets to avoid FK failures.
    const dependencies = [
      { table: 'reminder_logs', column: 'ticket_id' },
      { table: 'financial_records', column: 'ticket_id' },
      { table: 'local_events', column: 'ticket_id' },
      { table: 'service_orders', column: 'ticket_id' },
      { table: 'ticket_deletion_logs', column: 'ticket_id' },
    ];

    for (const dependency of dependencies) {
      try {
        await this.deleteFromTableOptional(
          dependency.table,
          { column: dependency.column, value: id },
          `Erro ao deletar ${dependency.table}`
        );
      } catch (cleanupError) {
        console.error(
          `[deleteTicket] Erro ao limpar ${dependency.table}:`,
          cleanupError
        );
        return false;
      }
    }

    const attemptDelete = () =>
      supabase.from('tickets').delete().eq('id', id).select();

    const confirmDeletion = async (result: {
      data: any[] | null;
      error: any;
    }) => {
      if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
        return true;
      }
      if (!result.error) {
        const { data: remaining, error: remainingError } = await supabase
          .from('tickets')
          .select('id')
          .eq('id', id)
          .maybeSingle();
        if (!remainingError && !remaining) {
          console.log(
            `[deleteTicket] Ticket ${id} excluido (sem retorno de dados).`
          );
          return true;
        }
      }
      return false;
    };

    const extractForeignKeyTable = (error: any): string | undefined => {
      const details = typeof error?.details === 'string' ? error.details : '';
      const message = typeof error?.message === 'string' ? error.message : '';
      const match =
        details.match(/table \"([^\"]+)\"/i) ||
        message.match(/table \"([^\"]+)\"/i);
      return match?.[1];
    };

    const initialResult = await attemptDelete();
    if (await confirmDeletion(initialResult)) {
      console.log(
        `[deleteTicket] Ticket ${id} excluido com sucesso. Dados excluidos:`,
        initialResult.data
      );
      return true;
    }

    const { error } = initialResult;
    if (error) {
      const errorMessage = error.message || '';
      console.error('[deleteTicket] Erro ao excluir:', error);
      console.error(
        '[deleteTicket] Detalhes do erro:',
        JSON.stringify(error, null, 2)
      );
      if (
        error.code === '23503' ||
        errorMessage.toLowerCase().includes('foreign key')
      ) {
        const fkTable =
          extractForeignKeyTable(error) ||
          (errorMessage.toLowerCase().includes('ticket_deletion_logs')
            ? 'ticket_deletion_logs'
            : undefined);
        if (fkTable) {
          console.warn(
            `[deleteTicket] FK em ${fkTable} bloqueou a exclusao. Tentando limpar dependencias.`
          );
          try {
            await this.deleteFromTableOptional(
              fkTable,
              { column: 'ticket_id', value: id },
              `Erro ao deletar ${fkTable}`
            );
            const retry = await attemptDelete();
            if (await confirmDeletion(retry)) {
              console.log(
                `[deleteTicket] Ticket ${id} excluido apos limpeza de dependencias (${fkTable}).`
              );
              return true;
            }
          } catch (fallbackError) {
            console.error(
              `[deleteTicket] Falha ao remover dependencias de ${fkTable}:`,
              fallbackError
            );
          }
        }
      }
      return false;
    }

    // Verificar se realmente excluiu algum registro
    if (!initialResult.data || initialResult.data.length === 0) {
      console.warn(`[deleteTicket] Nenhum ticket foi excluido com id: ${id}`);
      console.warn(`[deleteTicket] Resposta do Supabase:`, {
        data: initialResult.data,
        error: initialResult.error,
      });
      return false;
    }
  }

  async ticketCheckIn(id: string): Promise<Ticket | undefined> {
    const now = new Date();
    const startedAt = now.toISOString();

    //   // VALIDAÃ‡ÃƒO: Verificar se a data nÃ£o Ã© futura (com margem de 1 minuto para diferenÃ§as de clock)
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    if (now > oneMinuteFromNow) {
      console.error(
        '[ticketCheckIn] âš ï¸ Data do servidor parece estar incorreta!',
        {
          serverTime: now.toISOString(),
          serverTimestamp: now.getTime(),
        }
      );
    }

    console.log('[ticketCheckIn] Check-in realizado com sucesso:', {
      ticketId: id,
      startedAt,
      serverTime: now.toISOString(),
      serverTimestamp: now.getTime(),
      localTime: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('tickets')
      .update({
        status: 'INICIADO',
        started_at: startedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[ticketCheckIn] âŒ Erro ao fazer check-in:', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        ticketId: id,
        startedAt,
      });
      return undefined;
    }

    if (!data) {
      console.error('[ticketCheckIn] âŒ Update retornou sem dados:', {
        ticketId: id,
      });
      return undefined;
    }

    const converted = toCamelCase(data) as Ticket;

    //   // VALIDAÃ‡ÃƒO: Verificar se startedAt retornado nÃ£o Ã© uma data futura
    const returnedStartedAt = (converted as any).startedAt;
    if (returnedStartedAt) {
      const returnedDate = new Date(returnedStartedAt);
      const now = new Date();
      const diffMs = returnedDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 1000 / 60);

      if (diffMinutes > 1) {
        console.error(
          '[ticketCheckIn] âš ï¸ ATENÃ‡ÃƒO: startedAt retornado Ã© uma data futura!',
          {
            ticketId: id,
            startedAtEnviado: startedAt,
            startedAtRetornado: returnedStartedAt,
            started_atRaw: data.started_at,
            diferencaMinutos: diffMinutes,
            agora: now.toISOString(),
          }
        );
      }
    }

    console.log('[ticketCheckIn] Check-in realizado com sucesso:', {
      ticketId: id,
      status: converted.status,
      startedAt: (converted as any).startedAt,
      started_at: data.started_at,
      startedAtTimestamp: returnedStartedAt
        ? new Date(returnedStartedAt).getTime()
        : null,
      agoraTimestamp: Date.now(),
    });

    return converted;
  }

  async ticketComplete(
    id: string,
    data: {
      kmTotal: number;
      extraExpenses: number;
      expenseDetails: string;
      totalAmount?: number;
      kmRate?: number;
      additionalHourRate?: number; // Adicionar additionalHourRate opcional
      serviceItems?: Array<{ name: string; amount: number }>;
      paymentDate?: string;
      dueDate?: string;
      elapsedSeconds?: number; // Adicionar elapsedSeconds opcional
      warranty?: string;
      arrivalTime?: string;
    }
  ): Promise<Ticket | undefined> {
    const ticket = await this.getTicket(id);
    if (!ticket) return undefined;

    const now = new Date().toISOString();
    let startedAt = ticket.startedAt
      ? new Date(ticket.startedAt).toISOString()
      : now;
    if (!ticket.startedAt && data.arrivalTime) {
      const arrivalDate = new Date(data.arrivalTime);
      if (!Number.isNaN(arrivalDate.getTime())) {
        startedAt = arrivalDate.toISOString();
      }
    }

    // Usar kmRate do data se fornecido e vÃ¡lido, senÃ£o usar do ticket, senÃ£o null
    const kmRate = data.kmRate !== undefined && data.kmRate !== null && data.kmRate > 0
      ? data.kmRate 
      : (ticket.kmRate && Number(ticket.kmRate) > 0 ? Number(ticket.kmRate) : null);

    // Usar additionalHourRate do data se fornecido e vÃ¡lido, senÃ£o usar do ticket
    const additionalHourRate = data.additionalHourRate !== undefined && data.additionalHourRate !== null
      ? data.additionalHourRate
      : (ticket.additionalHourRate ? Number(ticket.additionalHourRate) : null);

    // Preparar objeto de update
    const updateData: any = {
      status: 'CONCLUÃDO',
      started_at: startedAt,
      km_total: data.kmTotal,
      extra_expenses: data.extraExpenses,
      expense_details: data.expenseDetails,
      total_amount: data.totalAmount, // Usar o valor calculado pelo frontend
      completed_at: now,
      stopped_at: now,
    };

    if (typeof data.warranty === 'string') {
      const trimmedWarranty = data.warranty.trim();
      updateData.warranty = trimmedWarranty ? trimmedWarranty : null;
    }

    if (Array.isArray(data.serviceItems)) {
      updateData.service_items = data.serviceItems;
    }

    // Salvar elapsedSeconds se fornecido
    if (data.elapsedSeconds !== undefined && data.elapsedSeconds !== null) {
      updateData.elapsed_seconds = Number(data.elapsedSeconds);
    } else {
      // Calcular elapsedSeconds se nÃ£o foi fornecido
      const startedAtDate = new Date(startedAt);
      const safeStartedAt = Number.isNaN(startedAtDate.getTime())
        ? new Date(now)
        : startedAtDate;
      const finishedAtDate = new Date(now);
      updateData.elapsed_seconds = Math.floor(
        (finishedAtDate.getTime() - safeStartedAt.getTime()) / 1000
      );
    }

    // Salvar taxas se fornecidas
    if (kmRate !== null && kmRate !== undefined && kmRate > 0) {
      updateData.km_rate = kmRate;
    }
    // Salvar additionalHourRate apenas se fornecido e vÃ¡lido
    // NOTA: Se a coluna nÃ£o existir no banco, isso causarÃ¡ erro - verifique se a migration foi executada
    if (additionalHourRate !== null && additionalHourRate !== undefined && additionalHourRate > 0) {
      updateData.additional_hour_rate = additionalHourRate;
    }

    // Salvar paymentDate se fornecido (converter string para timestamp se necessÃ¡rio)
    if (data.paymentDate) {
      // Se for string no formato YYYY-MM-DD, converter para timestamp
      if (typeof data.paymentDate === 'string' && data.paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Adicionar hora 00:00:00 se for apenas data
        updateData.payment_date = new Date(data.paymentDate + 'T00:00:00').toISOString();
      } else {
        updateData.payment_date = data.paymentDate;
      }
    }

    // Salvar dueDate se fornecido (converter string para timestamp se necessÃ¡rio)
    if (data.dueDate) {
      // Se for string no formato YYYY-MM-DD, converter para timestamp
      if (typeof data.dueDate === 'string' && data.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Adicionar hora 00:00:00 se for apenas data
        updateData.due_date = new Date(data.dueDate + 'T00:00:00').toISOString();
      } else {
        updateData.due_date = data.dueDate;
      }
    }

    // Garantir que valores numÃ©ricos nÃ£o sejam null ou undefined
    if (updateData.km_total === null || updateData.km_total === undefined) {
      updateData.km_total = 0;
    }
    if (updateData.extra_expenses === null || updateData.extra_expenses === undefined) {
      updateData.extra_expenses = 0;
    }
    // totalAmount deve ser fornecido pelo backend (routes.ts)
    if (updateData.total_amount === null || updateData.total_amount === undefined) {
      console.error('[ticketComplete] âŒ totalAmount Ã© obrigatÃ³rio e nÃ£o foi fornecido!');
      console.error('[ticketComplete] Dados recebidos:', JSON.stringify(data, null, 2));
      throw new Error('totalAmount Ã© obrigatÃ³rio para finalizar o ticket');
    }
    // elapsed_seconds pode ser 0 se nÃ£o foi calculado
    if (updateData.elapsed_seconds === null || updateData.elapsed_seconds === undefined) {
      updateData.elapsed_seconds = 0;
    }

    console.log('[ticketComplete] ðŸ“ Atualizando ticket com dados:', {
      id,
      updateData: JSON.stringify(updateData, null, 2),
    });

    let updateDataForRetry = { ...updateData };
    let { data: updated, error } = await supabase
      .from('tickets')
      .update(updateDataForRetry)
      .eq('id', id)
      .select()
      .single();

    // Se o erro for relacionado Ã  coluna warranty nÃ£o existir, tentar novamente sem esse campo
    if (error && error.message && error.message.includes('warranty')) {
      console.warn('[ticketComplete] âš ï¸ Coluna warranty nÃ£o encontrada, tentando sem esse campo...');
      const updateDataWithoutWarranty = { ...updateDataForRetry };
      delete updateDataWithoutWarranty.warranty;

      const retryResult = await supabase
        .from('tickets')
        .update(updateDataWithoutWarranty)
        .eq('id', id)
        .select()
        .single();

      updateDataForRetry = updateDataWithoutWarranty;
      if (retryResult.error) {
        error = retryResult.error;
      } else {
        updated = retryResult.data;
        error = null;
        console.log('[ticketComplete] Ticket atualizado sem warranty (coluna nao existe no banco)');
      }
    }

    // Se o erro for relacionado Ã  coluna additional_hour_rate nÃ£o existir, tentar novamente sem esse campo
    if (error && error.message && error.message.includes('additional_hour_rate')) {
      console.warn('[ticketComplete] âš ï¸ Coluna additional_hour_rate nÃ£o encontrada, tentando sem esse campo...');
      const updateDataWithoutAdditionalHourRate = { ...updateDataForRetry };
      delete updateDataWithoutAdditionalHourRate.additional_hour_rate;
      
      const retryResult = await supabase
        .from('tickets')
        .update(updateDataWithoutAdditionalHourRate)
        .eq('id', id)
        .select()
        .single();
      
      updateDataForRetry = updateDataWithoutAdditionalHourRate;
      if (retryResult.error) {
        error = retryResult.error;
      } else {
        updated = retryResult.data;
        error = null;
        console.log('[ticketComplete] Ticket atualizado sem additional_hour_rate (coluna nao existe no banco)');
      }
    }

    if (error && error.message && error.message.includes('service_items')) {
      console.warn('[ticketComplete] âš ï¸ Coluna service_items nÃ£o encontrada, tentando sem esse campo...');
      const updateDataWithoutServiceItems = { ...updateDataForRetry };
      delete updateDataWithoutServiceItems.service_items;

      const retryResult = await supabase
        .from('tickets')
        .update(updateDataWithoutServiceItems)
        .eq('id', id)
        .select()
        .single();

      updateDataForRetry = updateDataWithoutServiceItems;
      if (retryResult.error) {
        error = retryResult.error;
      } else {
        updated = retryResult.data;
        error = null;
        console.log('[ticketComplete] Ticket atualizado sem service_items (coluna nao existe no banco)');
      }
    }

    if (error) {
      console.error('[ticketComplete] âŒ Erro ao concluir ticket:', error);
      console.error('[ticketComplete] Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Erro ao atualizar ticket: ${error.message || 'Erro desconhecido'}`);
    }

    if (!updated) {
      console.error('[ticketComplete] âŒ Ticket nÃ£o foi atualizado (updated Ã© null/undefined)');
      throw new Error('Ticket nÃ£o foi atualizado');
    }

    console.log('[ticketComplete] Ticket atualizado com sucesso:', updated.id);
    return toCamelCase(updated) as Ticket;
  }

  async ticketCancel(
    id: string,
    reason?: string,
    source?: string
  ): Promise<Ticket | undefined> {
    try {
      const ticket = await this.getTicket(id);
      if (!ticket) {
        console.error('[ticketCancel] âŒ Ticket nÃ£o encontrado:', id);
        return undefined;
      }

      const now = new Date().toISOString();
      console.log('[ticketCancel] Cancelando ticket:', {
        id,
        reason,
        source,
        currentStatus: ticket.status,
      });

      // Usar apenas campos que existem no schema atual
      // O schema sÃ³ tem cancellation_reason, entÃ£o vamos usar apenas esse campo
      // Se source for fornecido, vamos incluÃ­-lo no reason
      const cancellationReasonFinal = reason
        ? source
          ? `${reason} [Fonte: ${source}]`
          : reason
        : ticket.cancellationReason || null;

      // Garantir que o reason nÃ£o seja muito longo (alguns bancos tÃªm limite)
      const maxReasonLength = 500;
      const truncatedReason = cancellationReasonFinal
        ? cancellationReasonFinal.substring(0, maxReasonLength)
        : null;

      const updateData: any = {
        status: 'CANCELADO',
        cancellation_reason: truncatedReason,
      };

      console.log('[ticketCancel] ðŸ“ Dados para atualizaÃ§Ã£o:', updateData);

      console.log('[ticketCancel] ðŸ” Executando update no Supabase:', {
        table: 'tickets',
        id,
        updateData,
        usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });

      const { data, error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[ticketCancel] âŒ Erro detalhado do Supabase:', {
          error,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          updateData,
          ticketId: id,
          ticketStatus: ticket.status,
          ticketUserId: ticket.userId,
          ticketExists: !!ticket,
          supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30) + '...',
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        });
        return undefined;
      }

      if (!data) {
        console.error('[ticketCancel] âŒ Update retornou sem dados:', {
          ticketId: id,
          updateData,
        });
        return undefined;
      }

      console.log('[ticketCancel] Ticket cancelado com sucesso:', {
        id,
        status: data?.status,
        cancelledAt: data?.cancelled_at,
      });

      // Preservar o status original do banco (CANCELADO) antes da conversÃ£o
      const converted = toCamelCase(data) as Ticket;
      if (data?.status) {
        (converted as any).originalStatus = data.status;
        // Garantir que o status tambÃ©m seja CANCELADO (nÃ£o 'cancelled')
        (converted as any).status = data.status;
      }

      console.log('[ticketCancel] ðŸ“¤ Ticket retornado apÃ³s cancelamento:', {
        id,
        status: (converted as any).status,
        originalStatus: (converted as any).originalStatus,
        statusRaw: data?.status,
      });

      return converted;
    } catch (error: any) {
      console.error('[ticketCancel] âŒ Erro inesperado:', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        ticketId: id,
      });
      return undefined;
    }
  }

  // Financial Records
  async getFinancialRecord(id: string): Promise<FinancialRecord | undefined> {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getFinancialRecord] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as FinancialRecord) : undefined;
  }

  async getFinancialRecordsByUser(
    userId: string,
    filters?: {
      clientId?: string;
      status?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      ticketId?: string;
    }
  ): Promise<FinancialRecord[]> {
    console.log('[getFinancialRecordsByUser] ðŸ” Buscando registros financeiros para userId:', userId);
    console.log('[getFinancialRecordsByUser] Filtros aplicados:', filters);

    let query = supabase
      .from('financial_records')
      .select('*')
      .eq('user_id', userId);

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.ticketId) {
      query = query.eq('ticket_id', filters.ticketId);
    }
    if (filters?.startDate && filters?.endDate) {
      const start = filters.startDate.toISOString();
      const end = filters.endDate.toISOString();
      // Prefer due_date; fall back to created_at when due_date is null.
      query = query.or(
        `and(due_date.not.is.null,due_date.gte.${start},due_date.lte.${end}),and(due_date.is.null,created_at.gte.${start},created_at.lte.${end})`
      );
    } else {
      if (filters?.startDate) {
        const start = filters.startDate.toISOString();
        query = query.or(
          `and(due_date.not.is.null,due_date.gte.${start}),and(due_date.is.null,created_at.gte.${start})`
        );
      }
      if (filters?.endDate) {
        const end = filters.endDate.toISOString();
        query = query.or(
          `and(due_date.not.is.null,due_date.lte.${end}),and(due_date.is.null,created_at.lte.${end})`
        );
      }
    }
    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) {
      console.error('[getFinancialRecordsByUser] âŒ Erro:', error);
      console.error('[getFinancialRecordsByUser] CÃ³digo do erro:', error.code);
      console.error('[getFinancialRecordsByUser] Mensagem:', error.message);
      return [];
    }

    console.log('[getFinancialRecordsByUser] Total de registros encontrados:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('[getFinancialRecordsByUser] Primeiro registro:', {
        id: data[0].id,
        user_id: data[0].user_id,
        ticket_id: data[0].ticket_id,
        amount: data[0].amount,
        status: data[0].status,
      });
    } else {
      // Verificar se hÃ¡ registros sem filtro de user_id para debug
      const { data: allData, error: allError } = await supabase
        .from('financial_records')
        .select('id, user_id, ticket_id, amount, status')
        .limit(5);
      
      if (!allError && allData) {
        console.log('[getFinancialRecordsByUser] ðŸ” DEBUG: Registros no banco (Ãºltimos 5):', allData);
        console.log('[getFinancialRecordsByUser] ðŸ” DEBUG: userId buscado:', userId);
      }
    }

    return (data || []).map(toCamelCase) as FinancialRecord[];
  }


  async createFinancialRecord(
    recordData: InsertFinancialRecord
  ): Promise<FinancialRecord> {
    console.log('[createFinancialRecord] Dados recebidos:', {
      userId: recordData.userId,
      ticketId: recordData.ticketId,
      clientId: recordData.clientId,
      type: recordData.type,
      amount: recordData.amount,
      status: recordData.status,
      dueDate: recordData.dueDate,
    });

    const dataToInsert = toSnakeCase(recordData);
    console.log('[createFinancialRecord] Dados convertidos para snake_case:', dataToInsert);

    const { data, error } = await supabase
      .from('financial_records')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createFinancialRecord] âŒ Erro:', error);
      console.error('[createFinancialRecord] CÃ³digo do erro:', error.code);
      console.error('[createFinancialRecord] Mensagem:', error.message);
      console.error('[createFinancialRecord] Detalhes:', JSON.stringify(error, null, 2));
      throw new Error(`Erro ao criar registro financeiro: ${error.message}`);
    }

    console.log('[createFinancialRecord] Registro financeiro criado:', data);
    return toCamelCase(data) as FinancialRecord;
  }

  async updateFinancialRecord(
    id: string,
    recordData: Partial<InsertFinancialRecord> & { paidAt?: string | Date }
  ): Promise<FinancialRecord | undefined> {
    const dataToUpdate = toSnakeCase(recordData);

    const { data, error } = await supabase
      .from('financial_records')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateFinancialRecord] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as FinancialRecord) : undefined;
  }

  async deleteFinancialRecord(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('financial_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteFinancialRecord] Erro:', error);
      return false;
    }

    return true;
  }

  async getCashFlowSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalReceivables: string;
    totalPaid: string;
    totalPending: string;
    totalOverdue: string;
  }> {
    const records = await this.getFinancialRecordsByUser(userId, {
      startDate,
      endDate,
    });

    let totalReceivables = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let totalPending = 0;
    const now = new Date();

    for (const record of records) {
      const amount = parseFloat(String(record.amount)) || 0;
      if (record.type === 'receivable') {
        totalReceivables += amount;
        if (record.status === 'paid') {
          totalPaid += amount;
        } else if (record.status === 'pending') {
          totalPending += amount;
          if (record.dueDate && new Date(record.dueDate) < now) {
            totalOverdue += amount;
          }
        } else if (record.status === 'overdue') {
          totalOverdue += amount;
        }
      }
    }

    return {
      totalReceivables: totalReceivables.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalPending: (totalPending - totalOverdue).toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
    };
  }

  async getReceivables(
    userId: string,
    overdue?: boolean
  ): Promise<FinancialRecord[]> {
    const records = await this.getFinancialRecordsByUser(userId);
    const now = new Date();

    return records.filter((record) => {
      if (record.type !== 'receivable') return false;
      if (!['pending', 'overdue'].includes(record.status)) return false;
      if (overdue) {
        return record.dueDate && new Date(record.dueDate) < now;
      }
      return true;
    });
  }

  // Integration Settings
  async getIntegrationSettings(
    userId: string
  ): Promise<IntegrationSettings | undefined> {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getIntegrationSettings] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as IntegrationSettings) : undefined;
  }

    async createIntegrationSettings(
    settingsData: InsertIntegrationSettings
  ): Promise<IntegrationSettings> {
    const dataToInsert = toSnakeCase(settingsData);

    let { data, error } = await supabase
      .from('integration_settings')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createIntegrationSettings] Erro:', error);
      if (isMissingPixColumnError(error)) {
        const ensured = await ensureIntegrationSettingsPixColumns();
        if (ensured) {
          const retry = await supabase
            .from('integration_settings')
            .insert(dataToInsert)
            .select()
            .single();
          if (!retry.error && retry.data) {
            return toCamelCase(retry.data) as IntegrationSettings;
          }
          if (retry.error) {
            console.error('[createIntegrationSettings] Retry Erro:', retry.error);
          }
        }
      }
      throw new Error(
        `Erro ao criar configuraÃ§Ãµes de integraÃ§Ã£o: ${error.message}`
      );
    }

    return toCamelCase(data) as IntegrationSettings;
  }
  async updateIntegrationSettings(
    userId: string,
    settingsData: Partial<InsertIntegrationSettings>
  ): Promise<IntegrationSettings | undefined> {
    const dataToUpdate = toSnakeCase(settingsData);

    let { data, error } = await supabase
      .from('integration_settings')
      .update(dataToUpdate)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[updateIntegrationSettings] Erro:', error);
      if (isMissingPixColumnError(error)) {
        const ensured = await ensureIntegrationSettingsPixColumns();
        if (ensured) {
          const retry = await supabase
            .from('integration_settings')
            .update(dataToUpdate)
            .eq('user_id', userId)
            .select()
            .single();
          if (!retry.error && retry.data) {
            return toCamelCase(retry.data) as IntegrationSettings;
          }
          if (retry.error) {
            console.error('[updateIntegrationSettings] Retry Erro:', retry.error);
          }
        }
      }
      return undefined;
    }

    return data ? (toCamelCase(data) as IntegrationSettings) : undefined;
  }
async createOrUpdateIntegrationSettings(
    settingsData: InsertIntegrationSettings
  ): Promise<IntegrationSettings> {
    const { userId, ...updateData } = settingsData;
    const existing = await this.getIntegrationSettings(userId);

    if (existing) {
      const updated = await this.updateIntegrationSettings(userId, updateData);

      if (!updated) {
        throw new Error(
          'Erro ao atualizar configuracoes de integracao: atualizacao retornou vazio'
        );
      }

      return updated;
    }

    return this.createIntegrationSettings(settingsData);
  }

  // Reminder Logs
  async getReminderLog(id: string): Promise<ReminderLog | undefined> {
    const { data, error } = await supabase
      .from('reminder_logs')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getReminderLog] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as ReminderLog) : undefined;
  }

  async getReminderLogsByTicket(ticketId: string): Promise<ReminderLog[]> {
    const { data, error } = await supabase
      .from('reminder_logs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('[getReminderLogsByTicket] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as ReminderLog[];
  }

  async createReminderLog(logData: InsertReminderLog): Promise<ReminderLog> {
    const dataToInsert = toSnakeCase(logData);

    const { data, error } = await supabase
      .from('reminder_logs')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createReminderLog] Erro:', error);
      throw new Error(`Erro ao criar log de lembrete: ${error.message}`);
    }

    return toCamelCase(data) as ReminderLog;
  }

  // Local Events
  async getLocalEvent(id: string): Promise<LocalEvent | undefined> {
    const { data, error } = await supabase
      .from('local_events')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getLocalEvent] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as LocalEvent) : undefined;
  }

  async getLocalEventsByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LocalEvent[]> {
    let query = supabase.from('local_events').select('*').eq('user_id', userId);

    if (startDate) {
      query = query.gte('end_date', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('start_date', endDate.toISOString());
    }

    const { data, error } = await query.order('start_date', {
      ascending: true,
    });

    if (error) {
      console.error('[getLocalEventsByUser] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as LocalEvent[];
  }

  async createLocalEvent(eventData: InsertLocalEvent): Promise<LocalEvent> {
    const dataToInsert = toSnakeCase(eventData);

    const { data, error } = await supabase
      .from('local_events')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createLocalEvent] Erro:', error);
      throw new Error(`Erro ao criar evento local: ${error.message}`);
    }

    return toCamelCase(data) as LocalEvent;
  }

  async updateLocalEvent(
    id: string,
    eventData: Partial<InsertLocalEvent>
  ): Promise<LocalEvent | undefined> {
    const dataToUpdate = toSnakeCase(eventData);

    const { data, error } = await supabase
      .from('local_events')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateLocalEvent] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as LocalEvent) : undefined;
  }

  async deleteLocalEvent(id: string): Promise<boolean> {
    const { error } = await supabase.from('local_events').delete().eq('id', id);

    if (error) {
      console.error('[deleteLocalEvent] Erro:', error);
      return false;
    }

    return true;
  }

  // Upload de imagem/logo de cliente - usa Google Drive (temporÃ¡rio)
  // TODO: Migrar para Supabase Storage se necessÃ¡rio
  private getRedirectUri() {
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      (process.env.NGROK_URL
        ? `${process.env.NGROK_URL}/api/callback`
        : 'http://localhost:5180/api/callback')
    );
  }

  private async getAuthClient(userId: string) {
    const record = getUserRecord(userId);
    if (!record?.tokens?.refresh_token) {
      throw new Error('Conta Google nÃ£o estÃ¡ conectada. FaÃ§a login novamente.');
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.getRedirectUri()
    );

    client.setCredentials({
      refresh_token: record.tokens.refresh_token,
      access_token: record.tokens.access_token,
      expiry_date: record.tokens.expiry_date,
    });

    client.on('tokens', (tokens) => {
      if (!tokens) return;
      upsertUserRecord({
        userId,
        email: record?.email || '',
        firstName: record?.firstName,
        lastName: record?.lastName,
        picture: record?.picture,
        spreadsheetId: record?.spreadsheetId,
        calendarId: record?.calendarId,
        folderId: record?.folderId,
        tokens: {
          ...record.tokens,
          access_token: tokens.access_token ?? record.tokens.access_token,
          refresh_token: tokens.refresh_token ?? record.tokens.refresh_token,
          expiry_date: tokens.expiry_date ?? record.tokens.expiry_date,
          scope: tokens.scope ?? record.tokens.scope,
          token_type: tokens.token_type ?? record.tokens.token_type,
        },
      });
    });

    return client;
  }

  private async getDriveClient(userId: string) {
    const auth = await this.getAuthClient(userId);
    return google.drive({ version: 'v3', auth });
  }

  private async ensureDriveFolder(
    userId: string,
    driveClient?: any
  ): Promise<string> {
    const record = getUserRecord(userId);
    const drive = driveClient || (await this.getDriveClient(userId));

    if (record?.folderId) {
      return record.folderId;
    }

    const folderName = 'Chamados Pro Lite';
    const found = await drive.files
      .list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        pageSize: 5,
      })
      .then((r: any) => r.data.files?.[0]);

    let folderId = found?.id;

    if (!folderId) {
      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      folderId = created.data.id;
    }

    if (folderId) {
      upsertUserRecord({
        userId,
        email: record?.email || '',
        firstName: record?.firstName,
        lastName: record?.lastName,
        picture: record?.picture,
        spreadsheetId: record?.spreadsheetId,
        calendarId: record?.calendarId,
        folderId,
        tokens: record?.tokens || {},
      });
    }

    return folderId || '';
  }

  private async ensureClientLogosFolder(
    userId: string,
    driveClient?: any
  ): Promise<string> {
    const drive = driveClient || (await this.getDriveClient(userId));
    const parentFolderId = await this.ensureDriveFolder(userId, drive);

    const folderName = 'Client Logos';

    const found = await drive.files
      .list({
        q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        pageSize: 5,
      })
      .then((r: any) => r.data.files?.[0]);

    if (found?.id) {
      return found.id;
    }

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });

    return created.data.id as string;
  }

  /**
   * Garante que o bucket de logos de clientes existe no Supabase Storage
   */
  private async ensureClientLogosBucket(): Promise<void> {
    // Verificar se o bucket existe
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      console.error(
        '[ensureClientLogosBucket] Erro ao listar buckets:',
        listError
      );
      throw new Error(`Erro ao verificar buckets: ${listError.message}`);
    }

    const bucketExists = buckets?.some(
      (bucket) => bucket.name === 'client-logos'
    );

    if (!bucketExists) {
      // Criar bucket se nÃ£o existir
      const { error: createError } = await supabase.storage.createBucket(
        'client-logos',
        {
          public: true, // Bucket pÃºblico para permitir acesso direto Ã s imagens
          fileSizeLimit: 10485760, // 10MB limite
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
        console.error(
          '[ensureClientLogosBucket] Erro ao criar bucket:',
          createError
        );
        throw new Error(`Erro ao criar bucket: ${createError.message}`);
      }

      console.log('[ensureClientLogosBucket] Bucket client-logos criado com sucesso');
    }
  }

  async uploadClientImage(
    userId: string,
    params: { dataUrl: string; fileName?: string }
  ): Promise<{
    fileId: string;
    webViewUrl: string;
    downloadUrl: string;
  }> {
    //   // NOVO: Usar Supabase Storage ao invÃ©s de Google Drive
    console.log(
      '[uploadClientImage] ðŸš€ Usando Supabase Storage para upload de logo...'
    );

    // Garantir que o bucket existe
    await this.ensureClientLogosBucket();

    const { dataUrl, fileName } = params;

    // Parsear data URL
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error('Formato de imagem invÃ¡lido. Esperado data URL base64.');
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Gerar nome Ãºnico do arquivo
    const timestamp = Date.now();
    const extension = mimeType.split('/')[1] || 'png';
    const effectiveFileName =
      fileName && fileName.trim().length > 0
        ? `${userId}/${timestamp}-${fileName}`
        : `${userId}/${timestamp}-cliente-logo.${extension}`;

    // Fazer upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(effectiveFileName, buffer, {
        contentType: mimeType,
        upsert: false, // NÃ£o sobrescrever arquivos existentes
      });

    if (uploadError) {
      console.error(
        '[uploadClientImage] âŒ Erro ao fazer upload:',
        uploadError
      );
      throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);
    }

    console.log('[uploadClientImage] Upload concluido:', uploadData);

    // Obter URL pÃºblica do arquivo
    const { data: urlData } = supabase.storage
      .from('client-logos')
      .getPublicUrl(effectiveFileName);

    const publicUrl = urlData.publicUrl;

    console.log('[uploadClientImage] URL publica gerada:', publicUrl);

    // Retornar formato compatÃ­vel com o cÃ³digo existente
    return {
      fileId: uploadData.path, // Path do arquivo no bucket
      webViewUrl: publicUrl, // URL pÃºblica para visualizaÃ§Ã£o
      downloadUrl: publicUrl, // URL pÃºblica para download
    };
  }

  // Plan Types
  async getAllPlanTypes(
    role?: 'technician' | 'company' | 'tech' | 'empresa'
  ): Promise<PlanType[]> {
    let query = supabase.from('plan_types').select('*');
    if (role) {
      const roleVariants = new Set<string>([role]);
      if (role === 'technician') roleVariants.add('tech');
      if (role === 'company') roleVariants.add('empresa');
      if (role === 'tech') roleVariants.add('technician');
      if (role === 'empresa') roleVariants.add('company');
      query = query.in('role', Array.from(roleVariants));
    }
    const { data, error } = await query.order('price');
    if (error) {
      console.error('[Storage] Erro ao buscar planos:', error);
      return [];
    }
    return (data || []).map(toCamelCase) as PlanType[];
  }

  async getPlanType(id: string): Promise<PlanType | undefined> {
    const { data, error } = await supabase
      .from('plan_types')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[Storage] Erro ao buscar plano:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as PlanType) : undefined;
  }

  async createPlanType(planType: InsertPlanType): Promise<PlanType> {
    // Converter para snake_case antes de inserir
    const planData = toSnakeCase(planType);

    // Gerar ID se nÃ£o fornecido
    if (!planData.id) {
      planData.id = randomUUID();
    }

    // Garantir que billing_cycle estÃ¡ presente (padrÃ£o: monthly)
    if (!planData.billing_cycle) {
      planData.billing_cycle = 'monthly';
    }

    // Converter price para nÃºmero (Supabase/PostgreSQL DECIMAL aceita nÃºmero, nÃ£o string)
    if (typeof planData.price === 'string') {
      planData.price = parseFloat(planData.price);
    }
    // Garantir que Ã© um nÃºmero vÃ¡lido
    if (isNaN(planData.price) || planData.price < 0) {
      throw new Error('PreÃ§o deve ser um nÃºmero vÃ¡lido maior ou igual a zero');
    }

    // Adicionar timestamps
    planData.created_at = new Date().toISOString();
    planData.updated_at = new Date().toISOString();

    // Remover campos undefined/null que podem causar problemas
    Object.keys(planData).forEach((key) => {
      if (planData[key] === undefined) {
        delete planData[key];
      }
    });

    console.log(
      '[Storage] Criando plano com dados:',
      JSON.stringify(planData, null, 2)
    );

    const { data, error } = await supabase
      .from('plan_types')
      .insert(planData)
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao criar plano:', error);
      console.error('[Storage] CÃ³digo do erro:', error.code);
      console.error('[Storage] Detalhes do erro:', error.details);
      console.error('[Storage] Hint do erro:', error.hint);
      console.error(
        '[Storage] Dados enviados:',
        JSON.stringify(planData, null, 2)
      );
      throw new Error(
        `Erro ao criar plano: ${error.message}${
          error.details ? ` - ${error.details}` : ''
        }${error.hint ? ` (${error.hint})` : ''}`
      );
    }
    return toCamelCase(data) as PlanType;
  }

  async updatePlanType(
    id: string,
    planType: Partial<InsertPlanType>
  ): Promise<PlanType | undefined> {
    // Converter para snake_case antes de atualizar
    const planData = toSnakeCase(planType);

    // Adicionar timestamp de atualizaÃ§Ã£o
    planData.updated_at = new Date().toISOString();

    console.log('[Storage] Atualizando plano:', id, 'com dados:', planData);

    const { data, error } = await supabase
      .from('plan_types')
      .update(planData)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao atualizar plano:', error);
      console.error(
        '[Storage] Dados enviados:',
        JSON.stringify(planData, null, 2)
      );
      return undefined;
    }
    return data ? (toCamelCase(data) as PlanType) : undefined;
  }

  async deletePlanType(id: string): Promise<boolean> {
    const { error } = await supabase.from('plan_types').delete().eq('id', id);
    if (error) {
      console.error('[Storage] Erro ao deletar plano:', error);
      return false;
    }
    return true;
  }

  // Subscriptions
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[Storage] Erro ao buscar assinatura:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as Subscription) : undefined;
  }

  async getSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false } as any);
    if (error) {
      console.error('[Storage] Erro ao buscar assinaturas:', error);
      return [];
    }
    return (data || []).map(toCamelCase) as Subscription[];
  }

  async getActiveSubscriptionByEmailAndRole(
    email: string,
    role: 'technician' | 'company' | 'tech' | 'empresa'
  ): Promise<Subscription | undefined> {
    const roleVariants = new Set<string>([role]);
    if (role === 'technician') roleVariants.add('tech');
    if (role === 'company') roleVariants.add('empresa');
    if (role === 'tech') roleVariants.add('technician');
    if (role === 'empresa') roleVariants.add('company');
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .in('role', Array.from(roleVariants))
      .eq('status', 'active')
      .order('created_at', { ascending: false } as any)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[Storage] Erro ao buscar assinatura ativa:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as Subscription) : undefined;
  }

  async createSubscription(
    subscription: InsertSubscription
  ): Promise<Subscription> {
    const dataToInsert = toSnakeCase(subscription);
    dataToInsert.created_at = new Date().toISOString();
    dataToInsert.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(dataToInsert)
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao criar assinatura:', error);
      throw new Error(`Erro ao criar assinatura: ${error.message}`);
    }
    return toCamelCase(data) as Subscription;
  }

  async updateSubscription(
    id: string,
    subscription: Partial<InsertSubscription>
  ): Promise<Subscription | undefined> {
    const dataToUpdate = toSnakeCase(subscription);
    dataToUpdate.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('subscriptions')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao atualizar assinatura:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as Subscription) : undefined;
  }

  async cancelSubscription(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) {
      console.error('[Storage] Erro ao cancelar assinatura:', error);
      return false;
    }
    return true;
  }

  // Ticket Statuses
  async getTicketStatuses(): Promise<TicketStatus[]> {
    const { data, error } = await supabase
      .from('ticket_statuses')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) {
      console.error('[Storage] Erro ao buscar status de chamados:', error);
      return [];
    }
    return (data || []).map(toCamelCase) as TicketStatus[];
  }

  async getTicketStatus(id: string): Promise<TicketStatus | undefined> {
    const { data, error } = await supabase
      .from('ticket_statuses')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error('[Storage] Erro ao buscar status de chamado:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as TicketStatus) : undefined;
  }

  async getTicketStatusByCode(code: string): Promise<TicketStatus | undefined> {
    const { data, error } = await supabase
      .from('ticket_statuses')
      .select('*')
      .eq('code', code)
      .single();
    if (error) {
      console.error('[Storage] Erro ao buscar status por cÃ³digo:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as TicketStatus) : undefined;
  }

  async createTicketStatus(status: InsertTicketStatus): Promise<TicketStatus> {
    const { data, error } = await supabase
      .from('ticket_statuses')
      .insert({
        code: status.code,
        name: status.name,
        description: status.description,
        color: status.color,
        variant: status.variant,
        is_active: status.isActive ?? true,
        display_order: status.displayOrder ?? 0,
      })
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao criar status de chamado:', error);
      throw new Error(`Erro ao criar status de chamado: ${error.message}`);
    }
    return toCamelCase(data) as TicketStatus;
  }

  async updateTicketStatus(
    id: string,
    status: Partial<InsertTicketStatus>
  ): Promise<TicketStatus | undefined> {
    const updateData: any = {};
    if (status.code !== undefined) updateData.code = status.code;
    if (status.name !== undefined) updateData.name = status.name;
    if (status.description !== undefined)
      updateData.description = status.description;
    if (status.color !== undefined) updateData.color = status.color;
    if (status.variant !== undefined) updateData.variant = status.variant;
    if (status.isActive !== undefined) updateData.is_active = status.isActive;
    if (status.displayOrder !== undefined)
      updateData.display_order = status.displayOrder;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ticket_statuses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[Storage] Erro ao atualizar status de chamado:', error);
      return undefined;
    }
    return data ? (toCamelCase(data) as TicketStatus) : undefined;
  }

  async deleteTicketStatus(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ticket_statuses')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[Storage] Erro ao deletar status de chamado:', error);
      return false;
    }
    return true;
  }

  // Vehicle Settings
  async getVehicleSettings(userId: string): Promise<
    | {
        fuelType: string;
        kmPerLiter: number;
        fuelPricePerLiter: number;
      }
    | undefined
  > {
    const { data, error } = await supabase
      .from('vehicle_settings')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[getVehicleSettings] Erro:', error);
      return undefined;
    }

    if (!data) {
      return undefined;
    }

    const converted = toCamelCase(data) as VehicleSettings;
    return {
      fuelType: (converted.fuelType as string) || 'GASOLINA',
      kmPerLiter: parseFloat(converted.kmPerLiter?.toString() || '10'),
      fuelPricePerLiter: parseFloat(
        converted.fuelPricePerLiter?.toString() || '6'
      ),
    };
  }

  async upsertVehicleSettings(
    userId: string,
    settings: {
      fuelType: string;
      kmPerLiter: number;
      fuelPricePerLiter: number;
    }
  ): Promise<{
    fuelType: string;
    kmPerLiter: number;
    fuelPricePerLiter: number;
  }> {
    const dataToUpsert = {
      user_id: userId,
      fuel_type: settings.fuelType || 'GASOLINA',
      km_per_liter: settings.kmPerLiter.toString(),
      fuel_price_per_liter: settings.fuelPricePerLiter.toString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('vehicle_settings')
      .upsert(dataToUpsert, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[upsertVehicleSettings] Erro:', error);
      throw new Error(
        `Erro ao salvar configuraÃ§Ãµes do veÃ­culo: ${error.message}`
      );
    }

    const converted = toCamelCase(data) as VehicleSettings;
    return {
      fuelType: (converted.fuelType as string) || 'GASOLINA',
      kmPerLiter: parseFloat(converted.kmPerLiter?.toString() || '10'),
      fuelPricePerLiter: parseFloat(
        converted.fuelPricePerLiter?.toString() || '6'
      ),
    };
  }

  async getServiceOrderTemplate(
    id: string
  ): Promise<ServiceOrderTemplate | undefined> {
    const { data, error } = await supabase
      .from('service_order_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[getServiceOrderTemplate] Erro:', error);
      return undefined;
    }

    return toCamelCase(data) as ServiceOrderTemplate;
  }

  async getServiceOrderTemplatesByCompany(
    companyId: string
  ): Promise<ServiceOrderTemplate[]> {
    const { data, error } = await supabase
      .from('service_order_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getServiceOrderTemplatesByCompany] Erro:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as ServiceOrderTemplate[];
  }

  async createServiceOrderTemplate(
    templateData: InsertServiceOrderTemplate
  ): Promise<ServiceOrderTemplate> {
    const dataToInsert = toSnakeCase(templateData);

    const { data, error } = await supabase
      .from('service_order_templates')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createServiceOrderTemplate] Erro:', error);
      throw new Error(`Erro ao criar template: ${error.message}`);
    }

    return toCamelCase(data) as ServiceOrderTemplate;
  }

  async updateServiceOrderTemplate(
    id: string,
    templateData: Partial<InsertServiceOrderTemplate>
  ): Promise<ServiceOrderTemplate | undefined> {
    const dataToUpdate = toSnakeCase(templateData);

    const { data, error } = await supabase
      .from('service_order_templates')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateServiceOrderTemplate] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as ServiceOrderTemplate) : undefined;
  }

  async deleteServiceOrderTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('service_order_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteServiceOrderTemplate] Erro:', error);
      return false;
    }

    return true;
  }

  async getServiceOrder(id: string): Promise<ServiceOrder | undefined> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[getServiceOrder] Erro:', error);
      return undefined;
    }

    return toCamelCase(data) as ServiceOrder;
  }

  async getServiceOrderByTicket(
    ticketId: string
  ): Promise<ServiceOrder | undefined> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('ticket_id', ticketId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[getServiceOrderByTicket] Erro:', error);
      }
      return undefined;
    }

    return data ? (toCamelCase(data) as ServiceOrder) : undefined;
  }

  async getServiceOrderByPublicToken(
    token: string
  ): Promise<ServiceOrder | undefined> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('public_token', token)
      .single();

    if (error) {
      console.error('[getServiceOrderByPublicToken] Erro:', error);
      return undefined;
    }

    return toCamelCase(data) as ServiceOrder;
  }

  async createServiceOrder(
    orderData: InsertServiceOrder
  ): Promise<ServiceOrder> {
    const publicToken = orderData.publicToken || randomUUID();
    const dataToInsert = toSnakeCase({
      ...orderData,
      publicToken,
      status: orderData.status || 'draft',
    });

    const { data, error } = await supabase
      .from('service_orders')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('[createServiceOrder] Erro:', error);
      throw new Error(`Erro ao criar ordem de servico: ${error.message}`);
    }

    return toCamelCase(data) as ServiceOrder;
  }

  async updateServiceOrder(
    id: string,
    orderData: Partial<InsertServiceOrder>
  ): Promise<ServiceOrder | undefined> {
    const dataToUpdate = toSnakeCase(orderData);

    const { data, error } = await supabase
      .from('service_orders')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateServiceOrder] Erro:', error);
      return undefined;
    }

    return data ? (toCamelCase(data) as ServiceOrder) : undefined;
  }

  /**
   * Deleta todos os dados vinculados a um tenant (userId) e o prÃ³prio usuÃ¡rio.
   * Ordem de exclusÃ£o para evitar FK:
   * 1) reminder_logs (pelos tickets do usuÃ¡rio)
   * 2) financial_records
   * 3) tickets - primeiro atualiza technician_id para null nos tickets de outros usuÃ¡rios, depois deleta tickets do usuÃ¡rio
   * 4) clients
   * 5) services
   * 6) integration_settings
   * 7) local_events
   * 8) vehicle_settings
   * 8.1) payment_schedules (por company_id e technician_id)
   * 8.2) service_orders (por company_id)
   * 8.3) service_order_templates (por company_id)
   * 8.4) technician_bank_accounts (por technician_id)
   * 8.5) company_users (por company_id e user_id)
   * 8.6) company_partners (por company_id e technician_id)
   * 8.7) company_technicians (por company_id e technician_id)
   * 8.8) company_data (por user_id)
   * 8.9) support_messages (por user_id e admin_id)
   * 9) user_credentials
   * 10) users
   */
  /**
   * FunÃ§Ã£o auxiliar para deletar de uma tabela opcionalmente (ignora se a tabela nÃ£o existir)
   */
  private async deleteFromTableOptional(
    tableName: string,
    condition: { column: string; value: string },
    errorMessage: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(condition.column, condition.value);

      if (error) {
        // Se a tabela nÃ£o existe, apenas logar e continuar
        const isTableNotFound =
          error.code === 'PGRST205' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache');

        if (isTableNotFound) {
          console.warn(
            `[deleteTenant] Tabela ${tableName} nÃ£o encontrada, ignorando:`,
            error.message
          );
          return; // Retornar sem lanÃ§ar erro
        } else {
          console.error(`[deleteTenant] Erro ao deletar ${tableName}:`, error);
          throw new Error(`${errorMessage}: ${error.message}`);
        }
      }
    } catch (err: any) {
      // Capturar qualquer erro inesperado e verificar se Ã© sobre tabela nÃ£o encontrada
      if (
        err?.code === 'PGRST205' ||
        err?.message?.includes('Could not find the table') ||
        err?.message?.includes('does not exist') ||
        err?.message?.includes('schema cache')
      ) {
        console.warn(
          `[deleteTenant] Tabela ${tableName} nÃ£o encontrada (catch), ignorando:`,
          err.message
        );
        return; // Retornar sem lanÃ§ar erro
      }
      // Se nÃ£o for erro de tabela nÃ£o encontrada, relanÃ§ar
      throw err;
    }
  }

  async deleteTenant(userId: string): Promise<void> {
    console.log(`[deleteTenant] Iniciando deleÃ§Ã£o do tenant: ${userId}`);

    // Coletar tickets do usuÃ¡rio (para remover reminder_logs)
    const { data: ticketRows, error: ticketsError } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', userId);

    if (ticketsError) {
      console.error(
        '[deleteTenant] Erro ao buscar tickets do usuÃ¡rio:',
        ticketsError
      );
      throw new Error(
        `Erro ao buscar tickets do usuÃ¡rio: ${ticketsError.message}`
      );
    }

    const ticketIds = (ticketRows || []).map((t: any) => t.id);

    // 1) reminder_logs -> pelos tickets
    if (ticketIds.length > 0) {
      const { error: reminderError } = await supabase
        .from('reminder_logs')
        .delete()
        .in('ticket_id', ticketIds);
      if (reminderError) {
        console.error(
          '[deleteTenant] Erro ao deletar reminder_logs:',
          reminderError
        );
        throw new Error(
          `Erro ao deletar logs de lembrete: ${reminderError.message}`
        );
      }
    }

    // 2) financial_records
    const { error: financialError } = await supabase
      .from('financial_records')
      .delete()
      .eq('user_id', userId);
    if (financialError) {
      console.error(
        '[deleteTenant] Erro ao deletar financial_records:',
        financialError
      );
      throw new Error(
        `Erro ao deletar registros financeiros: ${financialError.message}`
      );
    }

    // 3) tickets - primeiro atualizar technician_id para null em TODOS os tickets
    // (incluindo os de outros usuÃ¡rios onde este usuÃ¡rio Ã© o technician)
    const { error: ticketsTechUpdateError } = await supabase
      .from('tickets')
      .update({ technician_id: null })
      .eq('technician_id', userId);
    if (ticketsTechUpdateError) {
      console.error(
        '[deleteTenant] Erro ao atualizar technician_id nos tickets:',
        ticketsTechUpdateError
      );
      throw new Error(
        `Erro ao atualizar technician_id nos tickets: ${ticketsTechUpdateError.message}`
      );
    }

    // 3.1) Agora deletar tickets do usuÃ¡rio
    const { error: ticketsDeleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('user_id', userId);
    if (ticketsDeleteError) {
      console.error(
        '[deleteTenant] Erro ao deletar tickets:',
        ticketsDeleteError
      );
      throw new Error(`Erro ao deletar tickets: ${ticketsDeleteError.message}`);
    }

    // 4) clients
    const { error: clientsError } = await supabase
      .from('clients')
      .delete()
      .eq('user_id', userId);
    if (clientsError) {
      console.error('[deleteTenant] Erro ao deletar clients:', clientsError);
      throw new Error(`Erro ao deletar clientes: ${clientsError.message}`);
    }
    // Conferir se ainda restaram clientes (para evitar FK ao deletar user)
    const {
      data: remainingClientRows,
      count: remainingClients,
      error: clientsCheckError,
    } = await supabase
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    if (clientsCheckError) {
      console.error(
        '[deleteTenant] Erro ao verificar clients:',
        clientsCheckError
      );
      throw new Error(
        `Erro ao verificar clientes remanescentes: ${clientsCheckError.message}`
      );
    }

    const stillHasClients =
      (remainingClients || 0) > 0 || (remainingClientRows?.length || 0) > 0;

    // Tentativa extra: se restarem, tentar deletar explicitamente por IDs
    if (stillHasClients && remainingClientRows?.length) {
      const clientIds = remainingClientRows.map((c: any) => c.id);
      const { error: secondDeleteError } = await supabase
        .from('clients')
        .delete()
        .in('id', clientIds);
      if (secondDeleteError) {
        console.error(
          '[deleteTenant] Segunda tentativa falhou ao deletar clients:',
          secondDeleteError
        );
        throw new Error(
          `Erro ao deletar clientes remanescentes: ${secondDeleteError.message}`
        );
      }

      // Recontar
      const { count: remainingAfterSecond, data: rowsAfterSecond } =
        await supabase
          .from('clients')
          .select('id', { count: 'exact' })
          .eq('user_id', userId);

      const stillHasAfterSecond =
        (remainingAfterSecond || 0) > 0 || (rowsAfterSecond?.length || 0) > 0;
      if (stillHasAfterSecond) {
        console.error(
          '[deleteTenant] Clientes ainda presentes apÃ³s segunda tentativa:',
          rowsAfterSecond
        );
        throw new Error(
          'Ainda existem clientes vinculados ao usuÃ¡rio; exclusÃ£o interrompida para evitar inconsistÃªncia.'
        );
      }
    } else if (stillHasClients) {
      console.error(
        '[deleteTenant] Clientes remanescentes bloqueando exclusÃ£o (sem IDs retornados)'
      );
      throw new Error(
        'Ainda existem clientes vinculados ao usuÃ¡rio; exclusÃ£o interrompida para evitar inconsistÃªncia.'
      );
    }

    // VerificaÃ§Ã£o final antes de remover o usuÃ¡rio
    const {
      data: clientsBeforeUserDelete,
      count: clientsCountBeforeUserDelete,
      error: clientsBeforeUserDeleteError,
    } = await supabase
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    if (clientsBeforeUserDeleteError) {
      console.error(
        '[deleteTenant] Erro ao verificar clients antes de deletar user:',
        clientsBeforeUserDeleteError
      );
      throw new Error(
        `Erro ao verificar clientes antes de deletar usuÃ¡rio: ${clientsBeforeUserDeleteError.message}`
      );
    }

    if (
      (clientsCountBeforeUserDelete || 0) > 0 ||
      (clientsBeforeUserDelete?.length || 0) > 0
    ) {
      console.error(
        '[deleteTenant] Clientes ainda vinculados antes de excluir usuÃ¡rio:',
        clientsBeforeUserDelete
      );
      throw new Error(
        `Ainda existem clientes vinculados ao usuÃ¡rio (count=${clientsCountBeforeUserDelete}); exclusÃ£o interrompida para evitar inconsistÃªncia.`
      );
    }

    // 5) services
    const { error: servicesError } = await supabase
      .from('services')
      .delete()
      .eq('user_id', userId);
    if (servicesError) {
      console.error('[deleteTenant] Erro ao deletar services:', servicesError);
      throw new Error(`Erro ao deletar serviÃ§os: ${servicesError.message}`);
    }

    // 6) integration_settings
    const { error: integrationError } = await supabase
      .from('integration_settings')
      .delete()
      .eq('user_id', userId);
    if (integrationError) {
      console.error(
        '[deleteTenant] Erro ao deletar integration_settings:',
        integrationError
      );
      throw new Error(
        `Erro ao deletar configuraÃ§Ãµes de integraÃ§Ã£o: ${integrationError.message}`
      );
    }

    // 7) local_events
    const { error: eventsError } = await supabase
      .from('local_events')
      .delete()
      .eq('user_id', userId);
    if (eventsError) {
      console.error(
        '[deleteTenant] Erro ao deletar local_events:',
        eventsError
      );
      throw new Error(`Erro ao deletar eventos locais: ${eventsError.message}`);
    }

    // 8) vehicle_settings
    const { error: vehicleError } = await supabase
      .from('vehicle_settings')
      .delete()
      .eq('user_id', userId);
    if (vehicleError) {
      console.error(
        '[deleteTenant] Erro ao deletar vehicle_settings:',
        vehicleError
      );
      throw new Error(
        `Erro ao deletar configuraÃ§Ãµes de veÃ­culo: ${vehicleError.message}`
      );
    }

    // 8.1) payment_schedules (deletar por company_id e technician_id) - opcional
    await this.deleteFromTableOptional(
      'payment_schedules',
      { column: 'company_id', value: userId },
      'Erro ao deletar agendamentos de pagamento (company_id)'
    );
    await this.deleteFromTableOptional(
      'payment_schedules',
      { column: 'technician_id', value: userId },
      'Erro ao deletar agendamentos de pagamento (technician_id)'
    );

    // 8.2) service_orders (deletar por company_id) - opcional
    await this.deleteFromTableOptional(
      'service_orders',
      { column: 'company_id', value: userId },
      'Erro ao deletar ordens de servico'
    );

    // 8.3) service_order_templates (deletar por company_id) - opcional
    await this.deleteFromTableOptional(
      'service_order_templates',
      { column: 'company_id', value: userId },
      'Erro ao deletar templates de ordem de serviÃ§o'
    );

    // 8.3) technician_bank_accounts (deletar por technician_id) - opcional
    await this.deleteFromTableOptional(
      'technician_bank_accounts',
      { column: 'technician_id', value: userId },
      'Erro ao deletar contas bancÃ¡rias'
    );

    // 8.4) company_users (deletar por company_id e user_id) - opcional
    await this.deleteFromTableOptional(
      'company_users',
      { column: 'company_id', value: userId },
      'Erro ao deletar usuÃ¡rios da empresa (company_id)'
    );
    await this.deleteFromTableOptional(
      'company_users',
      { column: 'user_id', value: userId },
      'Erro ao deletar usuÃ¡rios da empresa (user_id)'
    );

    // 8.5) company_partners (deletar por company_id e technician_id) - opcional
    await this.deleteFromTableOptional(
      'company_partners',
      { column: 'company_id', value: userId },
      'Erro ao deletar empresas parceiras (company_id)'
    );
    await this.deleteFromTableOptional(
      'company_partners',
      { column: 'technician_id', value: userId },
      'Erro ao deletar empresas parceiras (technician_id)'
    );

    // 8.6) company_technicians (deletar por company_id e technician_id) - opcional
    await this.deleteFromTableOptional(
      'company_technicians',
      { column: 'company_id', value: userId },
      'Erro ao deletar tÃ©cnicos da empresa (company_id)'
    );
    await this.deleteFromTableOptional(
      'company_technicians',
      { column: 'technician_id', value: userId },
      'Erro ao deletar tÃ©cnicos da empresa (technician_id)'
    );

    // 8.7) company_data (deletar por user_id)
    const { error: companyDataError } = await supabase
      .from('company_data')
      .delete()
      .eq('user_id', userId);
    if (companyDataError) {
      console.error(
        '[deleteTenant] Erro ao deletar company_data:',
        companyDataError
      );
      throw new Error(
        `Erro ao deletar dados da empresa: ${companyDataError.message}`
      );
    }

    // 8.8) support_messages (deletar por user_id e admin_id)
    const { error: supportMessagesUserError } = await supabase
      .from('support_messages')
      .delete()
      .eq('user_id', userId);
    if (supportMessagesUserError) {
      console.error(
        '[deleteTenant] Erro ao deletar support_messages (user_id):',
        supportMessagesUserError
      );
      throw new Error(
        `Erro ao deletar mensagens de suporte: ${supportMessagesUserError.message}`
      );
    }
    const { error: supportMessagesAdminError } = await supabase
      .from('support_messages')
      .delete()
      .eq('admin_id', userId);
    if (supportMessagesAdminError) {
      console.error(
        '[deleteTenant] Erro ao deletar support_messages (admin_id):',
        supportMessagesAdminError
      );
      throw new Error(
        `Erro ao deletar mensagens de suporte: ${supportMessagesAdminError.message}`
      );
    }

    // 9) user_credentials
    const { error: credentialsError } = await supabase
      .from('user_credentials')
      .delete()
      .eq('user_id', userId);
    if (credentialsError) {
      console.error(
        '[deleteTenant] Erro ao deletar credenciais:',
        credentialsError
      );
      throw new Error(
        `Erro ao deletar credenciais do usuÃ¡rio: ${credentialsError.message}`
      );
    }

    // 10) users
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (userError) {
      console.error('[deleteTenant] Erro ao deletar usuÃ¡rio:', userError);
      throw new Error(`Erro ao deletar usuÃ¡rio: ${userError.message}`);
    }

    console.log(`[deleteTenant]   Tenant deletado com sucesso: ${userId}`);
  }
}

// Exportar instÃ¢ncia Ãºnica do storage
export const storage = new SupabaseStorage();




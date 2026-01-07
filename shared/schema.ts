import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid').primaryKey(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (table) => [index('IDX_session_expire').on(table.expire)]
);

// Users (Technicians/Staff) - Replit Auth compatible
export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: varchar('email').unique(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  profileImageUrl: varchar('profile_image_url'),
  role: text('role').default('technician'),
  publicSlug: varchar('public_slug').unique(),
  // Gov.br Credentials (NFSe)
  govBrCpf: varchar('gov_br_cpf'), // CPF/CNPJ do Gov.br
  govBrSenha: text('gov_br_senha'), // Senha criptografada (AES-256)
  govBrStatus: text('gov_br_status').default('DESCONECTADO'), // CONECTADO, DESCONECTADO, ERRO
  // Company Information (for SaaS multi-tenant)
  companyName: text('company_name'), // Nome da empresa do tenant
  companyLogoUrl: varchar('company_logo_url'), // Logo da empresa do tenant (armazenada no Google Drive)
  tenantSlug: varchar('tenant_slug').unique(), // Slug do tenant para URLs (ex: "Cyber-Tech")
  // Dados pessoais/empresariais
  cpf: varchar('cpf', { length: 14 }), // CPF formatado (XXX.XXX.XXX-XX) - para PF
  cnpj: varchar('cnpj', { length: 18 }), // CNPJ formatado (XX.XXX.XXX/XXXX-XX) - para PJ
  birthDate: timestamp('birth_date'), // Data de nascimento
  companyType: text('company_type'), // Tipo de empresa (MEI, EIRELI, LTDA, etc.)
  incomeValue: integer('income_value'), // Renda mensal/faturamento
  phone: varchar('phone', { length: 20 }), // Telefone com DDD
  // Endereço completo
  zipCode: text('zip_code'), // CEP
  streetAddress: text('street_address'), // Logradouro
  addressNumber: text('address_number'), // Número
  addressComplement: text('address_complement'), // Complemento
  neighborhood: text('neighborhood'), // Bairro/Distrito
  city: text('city'), // Cidade
  state: text('state'), // Estado (UF)
  // Confirmação de email do usuário (tenant)
  emailConfirmed: boolean('email_confirmed').default(false), // Se o email foi confirmado
  emailConfirmationExpiresAt: timestamp('email_confirmation_expires_at'), // Data de expiração (2 horas após cadastro)
  profileCompleted: boolean('profile_completed').default(false), // Se o perfil foi completado
  trialDeviceId: varchar('trial_device_id'),
  trialIp: varchar('trial_ip'),
  trialClaimedAt: timestamp('trial_claimed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Company Data (Dados da empresa do tenant)
export const companyData = pgTable('company_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),

  // Dados básicos da empresa
  companyName: text('company_name').notNull(),
  cnpj: varchar('cnpj', { length: 18 }), // CNPJ formatado (XX.XXX.XXX/XXXX-XX)
  cnpjClean: varchar('cnpj_clean', { length: 14 }), // CNPJ sem formatação
  cpf: varchar('cpf', { length: 14 }), // CPF formatado (XXX.XXX.XXX-XX) - para pessoa física com empresa
  phone: varchar('phone', { length: 20 }), // Telefone com DDD
  // Endereço completo
  zipCode: text('zip_code'), // CEP
  streetAddress: text('street_address'), // Logradouro
  addressNumber: text('address_number'), // Número
  addressComplement: text('address_complement'), // Complemento
  neighborhood: text('neighborhood'), // Bairro/Distrito
  city: text('city'), // Cidade
  state: text('state'), // Estado (UF)

  // Dados bancários
  bankName: text('bank_name'),
  bankCode: varchar('bank_code', { length: 10 }),
  accountType: text('account_type'), // CONTA_CORRENTE, CONTA_POUPANCA, CONTA_SALARIO
  agency: varchar('agency', { length: 10 }),
  agencyDigit: varchar('agency_digit', { length: 2 }),
  account: varchar('account', { length: 20 }),
  accountDigit: varchar('account_digit', { length: 2 }),

  // Dados de contato comercial
  commercialPhone: varchar('commercial_phone', { length: 20 }),
  commercialEmail: text('commercial_email'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Clients (PF, PJ, or EMPRESA_PARCEIRA)
export const clients = pgTable('clients', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  type: text('type').notNull(), // "PF", "PJ", or "EMPRESA_PARCEIRA"
  name: text('name').notNull(), // Nome for PF/PJ, Nome Fantasia for EMPRESA_PARCEIRA
  document: text('document'), // CPF or CNPJ
  email: text('email'),
  phone: text('phone').notNull(),
  // Imagem/logo do cliente (armazenada no Google Drive)
  // logoUrl: text('logo_url'),
  address: text('address').default(''), // Kept for backward compatibility
  city: text('city').default('').notNull(),
  state: text('state').default('').notNull(),
  ratTemplateId: varchar('rat_template_id'),
  // EMPRESA_PARCEIRA specific fields - Informações Fiscais
  legalName: text('legal_name'), // Razão Social
  municipalRegistration: text('municipal_registration'), // Inscrição Municipal
  stateRegistration: text('state_registration'), // Inscrição Estadual
  // EMPRESA_PARCEIRA specific fields - Endereço Completo
  zipCode: text('zip_code'), // CEP
  streetAddress: text('street_address'), // Endereço
  addressNumber: text('address_number'), // Número
  addressComplement: text('address_complement'), // Complemento
  neighborhood: text('neighborhood'), // Bairro/Distrito
  // EMPRESA_PARCEIRA specific fields - Ciclo de Pagamento
  paymentCycleStartDay: integer('payment_cycle_start_day'), // Início do ciclo (dia do mês)
  paymentCycleEndDay: integer('payment_cycle_end_day'), // Fim do ciclo (dia do mês)
  paymentDueDay: integer('payment_due_day'), // Dia de pagamento (mês seguinte)
  // EMPRESA_PARCEIRA specific fields - Valores Padrão
  defaultTicketValue: decimal('default_ticket_value', {
    precision: 10,
    scale: 2,
  }), // Valor padrão do chamado
  defaultHoursIncluded: integer('default_hours_included'), // Quantas horas estão incluídas no valor padrão
  defaultKmRate: decimal('default_km_rate', { precision: 6, scale: 2 }), // Valor padrão do KM
  defaultAdditionalHourRate: decimal('default_additional_hour_rate', {
    precision: 10,
    scale: 2,
  }), // Valor por hora adicional
  // Monthly spreadsheet (EMPRESA_PARCEIRA only)
  monthlySpreadsheet: boolean('monthly_spreadsheet').default(false),
  spreadsheetEmail: text('spreadsheet_email'),
  spreadsheetDay: integer('spreadsheet_day'),
  noShowCount: integer('no_show_count').default(0),
  // Confirmação de email
  emailConfirmed: boolean('email_confirmed').default(false), // Se o email foi confirmado
  emailConfirmationToken: text('email_confirmation_token'), // Token único para confirmação
  emailConfirmationExpiresAt: timestamp('email_confirmation_expires_at'), // Data de expiração do token (1 dia)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Services (Catalog)
export const services = pgTable('services', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration').notNull(), // in hours
  warranty: text('warranty'), // Prazo de garantia (ex: "90 dias")
  billingUnit: text('billing_unit'), // Unidade de cobrança (ex: "por hora")
  active: boolean('active').default(true),
  publicBooking: boolean('public_booking').default(true), // Appears in public booking page
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Ticket Statuses (Status dos Chamados)
export const ticketStatuses = pgTable('ticket_statuses', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: varchar('code').notNull().unique(), // Código único do status (ex: 'CONCLUIDO', 'CANCELADO')
  name: text('name').notNull(), // Nome do status (ex: 'Concluído', 'Cancelado')
  description: text('description'), // Descrição opcional
  color: text('color').default('#6b7280'), // Cor para exibição no frontend
  variant: text('variant').default('default'), // Variante do badge (default, secondary, destructive, outline)
  isActive: boolean('is_active').default(true), // Se o status está ativo
  displayOrder: integer('display_order').default(0), // Ordem de exibição
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tickets (Service Calls)
export const tickets = pgTable('tickets', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  technicianId: varchar('technician_id').references(() => users.id), // Assigned technician
  clientId: varchar('client_id')
    .references(() => clients.id)
    .notNull(),
  serviceId: varchar('service_id').references(() => services.id), // Optional for EMPRESA_PARCEIRA
  status: text('status').notNull().default('ABERTO'), // ABERTO (agendado), INICIADO (em andamento), CONCLUÍDO (finalizado), CANCELADO (cancelado)
  scheduledDate: timestamp('scheduled_date').notNull(),
  scheduledTime: text('scheduled_time').notNull(),
  duration: integer('duration').notNull(), // in hours
  warranty: text('warranty'), // Garantia específica para este chamado
  serviceOrderTemplateId: varchar('service_order_template_id'),
  // Location fields
  address: text('address'),
  city: text('city'),
  state: text('state'),
  // PJ-specific fields
  ticketNumber: varchar('ticket_number'), // Auto-generated, unique per tenant/year
  invoiceNumber: text('invoice_number'), // Número da NF (optional)
  finalClient: text('final_client'), // Cliente final/contato da empresa (optional for PJ)
  ticketValue: decimal('ticket_value', { precision: 10, scale: 2 }), // Valor do chamado (required for PJ)
  chargeType: text('charge_type'), // DIARIA or AVULSO (required for PJ)
  approvedBy: text('approved_by'), // Quem aprovou o valor (optional)
  kmRate: decimal('km_rate', { precision: 6, scale: 2 }), // R$/km (required if displacement)
  serviceAddress: text('service_address'), // Endereço do atendimento (required for PJ)
  scheduledEndDate: timestamp('scheduled_end_date'), // Fim previsto (optional)
  scheduledEndTime: text('scheduled_end_time'), // Hora fim prevista (optional)
  // Scheduling metadata per ticket
  travelTimeMinutes: integer('travel_time_minutes').default(30),
  bufferTimeMinutes: integer('buffer_time_minutes').default(15),
  description: text('description'),
  additionalHourRate: decimal('additional_hour_rate', {
    precision: 10,
    scale: 2,
  }),
  extraHours: decimal('extra_hours', { precision: 4, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  googleCalendarEventId: text('google_calendar_event_id'),
  cancellationReason: text('cancellation_reason'),
  noShow: boolean('no_show').default(false),
  // Workflow state tracking
  calculationsEnabled: boolean('calculations_enabled').default(true),
  startedAt: timestamp('started_at'), // When check-in happens (EXECUCAO)
  stoppedAt: timestamp('stopped_at'), // When completion happens (CONCLUIDO)
  elapsedSeconds: integer('elapsed_seconds'), // Calculated duration
  kmTotal: decimal('km_total', { precision: 8, scale: 2 }), // Total kilometers
  extraExpenses: decimal('extra_expenses', { precision: 10, scale: 2 }), // Additional expenses
  expenseDetails: text('expense_details'), // Description of extra expenses
  serviceItems: jsonb('service_items'), // Services performed (name/amount list)
  completedAt: timestamp('completed_at'),
  dueDate: timestamp('due_date'), // Data de vencimento
  paymentDate: timestamp('payment_date'), // Data de pagamento
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Financial Records
export const financialRecords = pgTable('financial_records', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  ticketId: varchar('ticket_id').references(() => tickets.id),
  clientId: varchar('client_id')
    .references(() => clients.id)
    .notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  type: text('type').notNull(), // "receivable", "paid"
  status: text('status').notNull().default('pending'), // pending, overdue, paid
  dueDate: timestamp('due_date').notNull(),
  paidAt: timestamp('paid_at'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Vehicle Settings (Configurações do veículo do técnico)
export const vehicleSettings = pgTable('vehicle_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  fuelType: text('fuel_type')
    .notNull()
    .default('GASOLINA'), // Tipo de combustível: GASOLINA, GNV, DIESEL, ELETRICO
  kmPerLiter: decimal('km_per_liter', { precision: 5, scale: 2 })
    .notNull()
    .default('10.00'), // Consumo do veículo em km por litro (ou km/m³ para GNV, km/kWh para elétrico)
  fuelPricePerLiter: decimal('fuel_price_per_liter', { precision: 6, scale: 2 })
    .notNull()
    .default('6.00'), // Preço do litro de combustível em R$ (ou m³ para GNV, kWh para elétrico)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Integration Settings
export const integrationSettings = pgTable('integration_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  googleCalendarStatus: text('google_calendar_status')
    .notNull()
    .default('not_connected'), // not_connected, connected, error, pending
  googleCalendarTokens: jsonb('google_calendar_tokens'),
  googleCalendarEmail: text('google_calendar_email'),
  googleCalendarId: text('google_calendar_id'),
  leadTimeMinutes: integer('lead_time_minutes').default(30),
  bufferMinutes: integer('buffer_minutes').default(15),
  travelMinutes: integer('travel_minutes').default(30),
  defaultDurationHours: integer('default_duration_hours').default(3),
  workingDays: jsonb('working_days').default([1, 2, 3, 4, 5, 6]),
  workingHours: jsonb('working_hours').default({
    days: {
      0: {
        enabled: false,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      1: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      2: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      3: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      4: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      5: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      6: {
        enabled: true,
        start: '08:00',
        end: '18:00',
        breakEnabled: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
    },
  }),
  timezone: text('timezone').default('America/Sao_Paulo'),
  reminder24hEnabled: boolean('reminder_24h_enabled').default(true),
  reminder1hEnabled: boolean('reminder_1h_enabled').default(true),
  googleSheetsStatus: text('google_sheets_status').default('not_connected'), // not_connected, connected, error
  whatsappRemindersEnabled: boolean('whatsapp_reminders_enabled').default(true),
  whatsappReminderHours: integer('whatsapp_reminder_hours').default(24),
  whatsappMessageTemplate: text('whatsapp_message_template'),
  // Email Reminders Configuration
  emailRemindersConfig: jsonb('email_reminders_config'), // JSON com configurações de lembretes por email
  // Google Calendar Sync Configuration
  googleCalendarEnabled: boolean('google_calendar_enabled').default(true),
  googleCalendarSyncSettings: jsonb('google_calendar_sync_settings'), // JSON com configurações de sincronização bidirecional
  stripePublicKey: text('stripe_public_key'),
  stripeSecretKey: text('stripe_secret_key'),
  pixKey: text('pix_key'),
  pixKeyType: text('pix_key_type'),
  pixAccountHolder: text('pix_account_holder'),
  whatsappStatus: text('whatsapp_status').default('not_connected'),
  whatsappAccessToken: text('whatsapp_access_token'),
  whatsappTokenExpiresAt: timestamp('whatsapp_token_expires_at'),
  whatsappBusinessAccountId: text('whatsapp_business_account_id'),
  whatsappPhoneNumberId: text('whatsapp_phone_number_id'),
  whatsappPhoneNumber: text('whatsapp_phone_number'),
  // Push Notifications Configuration
  pushNotificationsConfig: jsonb('push_notifications_config'), // JSON com configurações de notificações push
  // Ticket Calculations Configuration
  calculationsEnabled: boolean('calculations_enabled').default(true),
  calculationsPerTicket: boolean('calculations_per_ticket').default(false),
  calculationsClientTypes: jsonb('calculations_client_types').default(['PF', 'PJ', 'EMPRESA_PARCEIRA']),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Payment Integrations (OAuth / PSP connections per tenant)
export const paymentIntegrations = pgTable(
  'payment_integrations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .references(() => users.id)
      .notNull(),
    provider: text('provider').notNull(), // 'mercadopago', 'stripe', etc.
    status: text('status').notNull().default('pending'), // pending, active, error, disconnected
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    scope: text('scope'),
    providerUserId: text('provider_user_id'),
    publicKey: text('public_key'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payment_integrations_user_provider').on(
      table.userId,
      table.provider
    ),
    index('idx_payment_integrations_provider_user').on(
      table.providerUserId
    ),
    index('idx_payment_integrations_status').on(table.status),
  ]
);

// Reminder Logs
export const reminderLogs = pgTable('reminder_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar('ticket_id')
    .references(() => tickets.id)
    .notNull(),
  type: text('type').notNull(), // "24h", "1h"
  status: text('status').notNull(), // "sent", "failed"
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  error: text('error'),
});

// Ticket Deletion Logs
export const ticketDeletionLogs = pgTable('ticket_deletion_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar('ticket_id').notNull(), // No FK to allow ticket deletion
  deletedBy: varchar('deleted_by')
    .references(() => users.id)
    .notNull(),
  deletedByEmail: text('deleted_by_email').notNull(), // Email de quem excluiu
  reason: text('reason').notNull(), // Motivo da exclusão
  deletedAt: timestamp('deleted_at').defaultNow().notNull(),
  ticketData: jsonb('ticket_data'), // Dados do ticket antes da exclusão (backup)
  bulkId: varchar('bulk_id'), // ID para agrupar exclusões em massa
  bulkCount: integer('bulk_count').default(1), // Quantos foram excluídos no lote
});

// Local Events (Agenda Local - sem Google Calendar)
export const localEvents = pgTable('local_events', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  location: text('location'),
  color: text('color').default('#3b82f6'), // Cor do evento
  allDay: boolean('all_day').default(false),
  ticketId: varchar('ticket_id').references(() => tickets.id), // Opcional: vinculado a um ticket
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User Credentials (Autenticação Email/Senha e OAuth)
export const userCredentials = pgTable('user_credentials', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  passwordHash: text('password_hash'), // bcrypt hash (apenas para email/senha)
  provider: text('provider').notNull().default('email'), // 'email' | 'google' | 'facebook' | 'instagram'
  providerId: text('provider_id'), // ID do provider (se OAuth)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Company Technicians (Técnicos Vinculados a Empresas)
export const companyTechnicians = pgTable(
  'company_technicians',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    technicianId: varchar('technician_id')
      .references(() => users.id)
      .notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
    invitedBy: varchar('invited_by').references(() => users.id),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_company_technicians_company').on(table.companyId),
    index('idx_company_technicians_technician').on(table.technicianId),
  ]
);

// Company Partners (Empresas Parceiras Vinculadas a Técnicos)
export const companyPartners = pgTable(
  'company_partners',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    technicianId: varchar('technician_id')
      .references(() => users.id)
      .notNull(),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
    invitedBy: varchar('invited_by').references(() => users.id),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_company_partners_technician').on(table.technicianId),
    index('idx_company_partners_company').on(table.companyId),
  ]
);

// Company Users (Usuários da Empresa - Analistas e Financeiros)
export const companyUsers = pgTable(
  'company_users',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    userId: varchar('user_id')
      .references(() => users.id)
      .notNull(),
    role: text('role').notNull(), // 'analyst' | 'financial'
    permissions: jsonb('permissions'), // Permissões específicas
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_company_users_company').on(table.companyId),
    index('idx_company_users_user').on(table.userId),
  ]
);

// Service Order Templates (Templates de Ordem de Serviço)
export const serviceOrderTemplates = pgTable(
  'service_order_templates',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    clientId: varchar('client_id').references(() => clients.id),
    name: text('name').notNull(),
    template: jsonb('template').notNull(), // Estrutura do template (drag & drop)
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_service_order_templates_company').on(table.companyId),
    index('idx_service_order_templates_client').on(table.clientId),
  ]
);

// Service Order Template Assets (logos/imagens)
export const serviceOrderTemplateAssets = pgTable(
  'service_order_template_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: varchar('company_id').references(() => users.id),
    templateId: varchar('template_id').references(() => serviceOrderTemplates.id),
    componentId: varchar('component_id').notNull(),
    assetType: text('asset_type').notNull(),
    fileName: text('file_name'),
    storagePath: text('storage_path'),
    publicUrl: text('public_url').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_service_order_template_assets_company').on(table.companyId),
    index('idx_service_order_template_assets_template').on(table.templateId),
    index('idx_service_order_template_assets_component').on(table.componentId),
  ]
);

// Service Orders (Filled RAT/OS instances)
export const serviceOrders = pgTable(
  'service_orders',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    clientId: varchar('client_id')
      .references(() => clients.id)
      .notNull(),
    ticketId: varchar('ticket_id')
      .references(() => tickets.id)
      .notNull(),
    templateId: varchar('template_id').references(() => serviceOrderTemplates.id),
    templateSnapshot: jsonb('template_snapshot').notNull(),
    fieldValues: jsonb('field_values'),
    status: text('status').default('draft'),
    signatureData: text('signature_data'),
    signedBy: text('signed_by'),
    signedAt: timestamp('signed_at'),
    technicianSignatureData: text('technician_signature_data'),
    technicianSignedBy: text('technician_signed_by'),
    technicianSignedAt: timestamp('technician_signed_at'),
    clientSignatureData: text('client_signature_data'),
    clientSignedBy: text('client_signed_by'),
    clientSignedAt: timestamp('client_signed_at'),
    publicToken: varchar('public_token'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_service_orders_company').on(table.companyId),
    index('idx_service_orders_ticket').on(table.ticketId),
    index('idx_service_orders_public_token').on(table.publicToken),
  ]
);

// Technician Bank Accounts (Contas Bancárias dos Técnicos)
export const technicianBankAccounts = pgTable(
  'technician_bank_accounts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    technicianId: varchar('technician_id')
      .references(() => users.id)
      .notNull(),
    bankCode: varchar('bank_code'), // Código do banco
    bankName: text('bank_name'),
    agency: varchar('agency'),
    account: varchar('account'),
    accountType: text('account_type'), // 'checking' | 'savings'
    accountHolderName: text('account_holder_name'),
    accountHolderDocument: text('account_holder_document'), // CPF/CNPJ
    pixKey: text('pix_key'), // Chave PIX (opcional)
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_technician_bank_accounts_technician').on(table.technicianId),
  ]
);

// Payment Schedules (Agendamentos de Pagamento)
export const paymentSchedules = pgTable(
  'payment_schedules',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyId: varchar('company_id')
      .references(() => users.id)
      .notNull(),
    technicianId: varchar('technician_id')
      .references(() => users.id)
      .notNull(),
    financialRecordId: varchar('financial_record_id').references(
      () => financialRecords.id
    ),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    scheduledDate: timestamp('scheduled_date').notNull(),
    status: text('status').notNull().default('scheduled'), // 'scheduled' | 'processing' | 'completed' | 'failed'
    paymentMethod: text('payment_method'), // 'pix' | 'ted' | 'doc'
    bankAccountId: varchar('bank_account_id').references(
      () => technicianBankAccounts.id
    ),
    processedAt: timestamp('processed_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payment_schedules_company').on(table.companyId),
    index('idx_payment_schedules_technician').on(table.technicianId),
    index('idx_payment_schedules_status').on(table.status),
  ]
);

// Support Messages (Mensagens de suporte dos tenants)
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .references(() => users.id)
      .notNull(),
    category: varchar('category', { length: 50 }).notNull(), // 'bug', 'sugestao', 'duvida', 'outro'
    subject: varchar('subject', { length: 255 }).notNull(),
    message: text('message').notNull(),
    status: varchar('status', { length: 20 }).default('aberto'), // 'aberto', 'em_andamento', 'resolvido', 'fechado'
    adminResponse: text('admin_response'),
    adminId: varchar('admin_id').references(() => users.id),
    respondedAt: timestamp('responded_at'),
    isPublic: boolean('is_public').default(false), // Se a pergunta/resposta está disponível publicamente na FAQ
    userReadAt: timestamp('user_read_at'), // Quando o usuário leu a resposta
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_support_messages_user_id').on(table.userId),
    index('idx_support_messages_status').on(table.status),
    index('idx_support_messages_category').on(table.category),
    index('idx_support_messages_created_at').on(table.createdAt),
  ]
);

// Support Message Templates (Templates de respostas padrão)
export const supportMessageTemplates = pgTable(
  'support_message_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: varchar('category', { length: 50 }).notNull(), // 'bug', 'sugestao', 'duvida', 'outro', 'geral'
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_support_templates_category').on(table.category),
    index('idx_support_templates_active').on(table.isActive),
  ]
);

// Insert Schemas
export const upsertUserSchema = createInsertSchema(users)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    role: z.enum(['technician', 'company', 'super_admin']).optional(),
  });

export const insertClientSchema = createInsertSchema(clients)
  .omit({
    id: true,
    createdAt: true,
    noShowCount: true,
  })
  // Para gravação no banco (Sheets/Postgres), nenhum campo de contato é obrigatório.
  // A obrigatoriedade fica apenas na camada de formulário (frontend).
  .extend({
    email: z
      .union([
        z.string().email(),
        z.string().length(0), // String vazia
        z.null(),
        z.undefined(),
      ])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === '') return null;
        return val;
      }),
    phone: z.string().optional().or(z.literal('')).default(''),
    // Campos decimais: aceitar string ou number e converter para string (formato decimal do PostgreSQL)
    defaultTicketValue: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return val.toString();
        return val;
      }),
    defaultKmRate: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return val.toString();
        return val;
      }),
    defaultAdditionalHourRate: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return val.toString();
        return val;
      }),
  })
  .refine(
    (data) => {
      // If monthlySpreadsheet is enabled for PJ, require email and day
      if (data.type === 'PJ' && data.monthlySpreadsheet) {
        return !!data.spreadsheetEmail && !!data.spreadsheetDay;
      }
      return true;
    },
    {
      message:
        'Para clientes PJ com planilha mensal ativada, é obrigatório informar o email e o dia de envio',
      path: ['monthlySpreadsheet'],
    }
  )
  .refine(
    (data) => {
      // Validate spreadsheet day is between 1-31
      if (data.spreadsheetDay !== null && data.spreadsheetDay !== undefined) {
        return data.spreadsheetDay >= 1 && data.spreadsheetDay <= 31;
      }
      return true;
    },
    {
      message: 'O dia de envio da planilha deve estar entre 1 e 31',
      path: ['spreadsheetDay'],
    }
  )
  .refine(
    (data) => {
      // Validate spreadsheet email format
      if (data.spreadsheetEmail) {
        return z.string().email().safeParse(data.spreadsheetEmail).success;
      }
      return true;
    },
    {
      message: 'Email inválido para envio de planilha',
      path: ['spreadsheetEmail'],
    }
  )
  .refine(
    (data) => {
      // Type must be PF, PJ, or EMPRESA_PARCEIRA
      return (
        data.type === 'PF' ||
        data.type === 'PJ' ||
        data.type === 'EMPRESA_PARCEIRA'
      );
    },
    {
      message: 'Tipo de cliente deve ser PF, PJ ou EMPRESA_PARCEIRA',
      path: ['type'],
    }
  );

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets)
  .omit({
    id: true,
    createdAt: true,
    completedAt: true,
    googleCalendarEventId: true,
    cancellationReason: true,
    noShow: true,
    totalAmount: true,
    // Workflow fields - set during check-in/completion
    startedAt: true,
    stoppedAt: true,
    elapsedSeconds: true,
    kmTotal: true,
    extraExpenses: true,
    expenseDetails: true,
  })
  .extend({
    calculationsEnabled: z.boolean().optional().default(true),
    scheduledDate: z.coerce.date(),
    serviceId: z.string().optional(), // Optional for EMPRESA_PARCEIRA clients
    extraHours: z.coerce.number().optional(),
    travelTimeMinutes: z.coerce.number().optional(),
    bufferTimeMinutes: z.coerce.number().optional(),
    //   // CORREÇÃO: Garantir que ticketValue, kmRate e additionalHourRate sejam sempre strings (decimal no Drizzle espera string)
    ticketValue: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        // Converter número para string, normalizar vírgula para ponto
        const str = typeof val === 'number' ? val.toString() : String(val);
        return str.replace(',', '.');
      }),
    kmRate: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        // Converter número para string, normalizar vírgula para ponto
        const str = typeof val === 'number' ? val.toString() : String(val);
        return str.replace(',', '.');
      }),
    additionalHourRate: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        // Converter número para string, normalizar vírgula para ponto
        const str = typeof val === 'number' ? val.toString() : String(val);
        return str.replace(',', '.');
      }),
  });

export const insertFinancialRecordSchema = createInsertSchema(
  financialRecords
)
  .omit({
    id: true,
    createdAt: true,
    paidAt: true,
  });

export const insertIntegrationSettingsSchema = createInsertSchema(
  integrationSettings
).omit({
  id: true,
  updatedAt: true,
});

export const insertPaymentIntegrationSchema = createInsertSchema(
  paymentIntegrations
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReminderLogSchema = createInsertSchema(reminderLogs).omit({
  id: true,
  sentAt: true,
});

export const insertLocalEventSchema = createInsertSchema(localEvents)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  });

export const insertUserCredentialSchema = createInsertSchema(
  userCredentials
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyTechnicianSchema = createInsertSchema(
  companyTechnicians
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
});

export const insertCompanyPartnerSchema = createInsertSchema(
  companyPartners
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
});

export const insertCompanyUserSchema = createInsertSchema(companyUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderTemplateSchema = createInsertSchema(
  serviceOrderTemplates
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceOrderTemplateAssetSchema = createInsertSchema(
  serviceOrderTemplateAssets
).omit({
  id: true,
  createdAt: true,
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTechnicianBankAccountSchema = createInsertSchema(
  technicianBankAccounts
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    processedAt: true,
  })
  .extend({
    scheduledDate: z.coerce.date(),
  });

export const insertTicketStatusSchema = createInsertSchema(ticketStatuses)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    variant: z
      .enum(['default', 'secondary', 'destructive', 'outline'])
      .optional(),
  });

export const insertTicketDeletionLogSchema = createInsertSchema(ticketDeletionLogs).omit({
  id: true,
  deletedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export type InsertFinancialRecord = z.infer<typeof insertFinancialRecordSchema>;
export type FinancialRecord = typeof financialRecords.$inferSelect;

export type InsertIntegrationSettings = z.infer<
  typeof insertIntegrationSettingsSchema
>;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;

export type InsertPaymentIntegration = z.infer<
  typeof insertPaymentIntegrationSchema
>;
export type PaymentIntegration = typeof paymentIntegrations.$inferSelect;

export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogs.$inferSelect;

export type InsertLocalEvent = z.infer<typeof insertLocalEventSchema>;
export type LocalEvent = typeof localEvents.$inferSelect;

export type InsertUserCredential = z.infer<typeof insertUserCredentialSchema>;
export type UserCredential = typeof userCredentials.$inferSelect;

export type InsertCompanyTechnician = z.infer<
  typeof insertCompanyTechnicianSchema
>;
export type CompanyTechnician = typeof companyTechnicians.$inferSelect;

export type InsertCompanyPartner = z.infer<typeof insertCompanyPartnerSchema>;
export type CompanyPartner = typeof companyPartners.$inferSelect;

export type InsertCompanyUser = z.infer<typeof insertCompanyUserSchema>;
export type CompanyUser = typeof companyUsers.$inferSelect;

export type InsertServiceOrderTemplate = z.infer<
  typeof insertServiceOrderTemplateSchema
>;
export type ServiceOrderTemplate = typeof serviceOrderTemplates.$inferSelect;

export type InsertServiceOrderTemplateAsset = z.infer<
  typeof insertServiceOrderTemplateAssetSchema
>;
export type ServiceOrderTemplateAsset =
  typeof serviceOrderTemplateAssets.$inferSelect;

export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrder = typeof serviceOrders.$inferSelect;

export type InsertTechnicianBankAccount = z.infer<
  typeof insertTechnicianBankAccountSchema
>;
export type TechnicianBankAccount = typeof technicianBankAccounts.$inferSelect;

export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;

export type InsertTicketStatus = z.infer<typeof insertTicketStatusSchema>;
export type TicketStatus = typeof ticketStatuses.$inferSelect;

export type InsertTicketDeletionLog = z.infer<typeof insertTicketDeletionLogSchema>;
export type TicketDeletionLog = typeof ticketDeletionLogs.$inferSelect;

// Plan Types - Tipos de planos disponíveis
export const planTypes = pgTable('plan_types', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(), // Nome do plano (ex: "Básico", "Profissional", "Enterprise")
  description: text('description'), // Descrição do plano
  role: text('role').notNull(), // 'technician' ou 'company' - para qual tipo de usuário é o plano
  price: decimal('price', { precision: 10, scale: 2 }).notNull(), // Preço mensal
  billingCycle: text('billing_cycle').notNull().default('monthly'), // 'monthly' ou 'yearly'
  features: jsonb('features'), // Array de features em JSON
  maxClients: integer('max_clients'), // Limite de clientes (null = ilimitado)
  maxTickets: integer('max_tickets'), // Limite de chamados por mês (null = ilimitado)
  maxUsers: integer('max_users'), // Limite de usuários (para empresas) (null = ilimitado)
  isActive: boolean('is_active').default(true), // Se o plano está ativo
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Subscriptions - Assinaturas de planos vinculadas a email + role
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar('email').notNull(), // Email do usuário (email original, não o único do banco)
    role: text('role').notNull(), // 'technician' ou 'company'
    planTypeId: varchar('plan_type_id')
      .references(() => planTypes.id)
      .notNull(),
    status: text('status').notNull().default('active'), // 'active', 'cancelled', 'expired', 'pending'
    startDate: timestamp('start_date').notNull().defaultNow(),
    endDate: timestamp('end_date'), // null = assinatura recorrente
    cancelledAt: timestamp('cancelled_at'), // Data de cancelamento
    cancellationReason: text('cancellation_reason'), // Motivo do cancelamento
    paymentGateway: text('payment_gateway'), // 'stripe' | outros
    paymentGatewayCustomerId: text('payment_gateway_customer_id'),
    paymentGatewaySubscriptionId: text('payment_gateway_subscription_id'),
    // Metadados
    metadata: jsonb('metadata'), // Dados adicionais em JSON
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    // Índice único para email + role (um usuário pode ter apenas uma assinatura ativa por role)
    index('idx_subscriptions_email_role').on(table.email, table.role),
    // Índice para buscar assinaturas ativas
    index('idx_subscriptions_status').on(table.status),
  ]
);

// Schemas de validação
export const insertPlanTypeSchema = createInsertSchema(planTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullable().optional(),
    cancelledAt: z.coerce.date().nullable().optional(),
  });

// Types
export type InsertPlanType = z.infer<typeof insertPlanTypeSchema>;
export type PlanType = typeof planTypes.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type VehicleSettings = typeof vehicleSettings.$inferSelect;
export type InsertVehicleSettings = typeof vehicleSettings.$inferInsert;

// Company Data schemas
export const insertCompanyDataSchema = createInsertSchema(companyData);
export type InsertCompanyData = z.infer<typeof insertCompanyDataSchema>;
export type CompanyData = typeof companyData.$inferSelect;

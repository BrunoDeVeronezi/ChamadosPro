/**
 * Storage Interface
 *
 * Interface para abstração de storage.
 * A implementação atual usa Supabase PostgreSQL via Drizzle ORM.
 *
 * @see server/storage-supabase.ts para a implementação
 */

import {
  type User,
  type UpsertUser,
  type Client,
  type InsertClient,
  type Service,
  type InsertService,
  type Ticket,
  type InsertTicket,
  type FinancialRecord,
  type InsertFinancialRecord,
  type IntegrationSettings,
  type InsertIntegrationSettings,
  type ReminderLog,
  type InsertReminderLog,
  type LocalEvent,
  type InsertLocalEvent,
  type PlanType,
  type InsertPlanType,
  type Subscription,
  type InsertSubscription,
  type TicketStatus,
  type InsertTicketStatus,
  type VehicleSettings,
  type InsertVehicleSettings,
  type ServiceOrderTemplate,
  type InsertServiceOrderTemplate,
  type ServiceOrder,
  type InsertServiceOrder,
} from '@shared/schema';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmailAndRole(
    email: string,
    role: 'technician' | 'company' | 'super_admin'
  ): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserBySlug(slug: string): Promise<User | undefined>;

  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClientsByUser(userId: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(
    id: string,
    client: Partial<Client>
  ): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  deleteAllClientsByUser(userId: string): Promise<number>;

  // Services
  getService(id: string): Promise<Service | undefined>;
  getServicesByUser(userId: string): Promise<Service[]>;
  getActiveServicesByUser(userId: string): Promise<Service[]>;
  ensureDefaultService(userId: string): Promise<void>;
  createService(service: InsertService): Promise<Service>;
  updateService(
    id: string,
    service: Partial<InsertService>
  ): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;

  // Tickets
  getTicket(id: string): Promise<Ticket | undefined>;
  getTicketsByUser(userId: string): Promise<Ticket[]>;
  getTicketsByClient(clientId: string): Promise<Ticket[]>;
  getTicketsByTechnician(technicianId: string): Promise<Ticket[]>;
  getTicketsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Ticket[]>;
  getTicketsByStatus(userId: string, status: string): Promise<Ticket[]>;
  getTicketsByStatuses(userId: string, statuses: string[]): Promise<Ticket[]>;
  getNextTicketNumber(userId: string): Promise<string>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(
    id: string,
    ticket: Partial<Ticket>
  ): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<boolean>;
  ticketCheckIn(id: string): Promise<Ticket | undefined>;
  ticketComplete(
    id: string,
    data: {
      kmTotal: number;
      extraExpenses: number;
      expenseDetails: string;
      totalAmount?: number;
      kmRate?: number;
      additionalHourRate?: number;
      serviceItems?: Array<{ name: string; amount: number }>;
      paymentDate?: string;
      dueDate?: string;
      elapsedSeconds?: number;
      warranty?: string;
      arrivalTime?: string;
    }
  ): Promise<Ticket | undefined>;
  ticketCancel(
    id: string,
    reason?: string,
    source?: string
  ): Promise<Ticket | undefined>;

  // Financial
  getFinancialRecord(id: string): Promise<FinancialRecord | undefined>;
  getFinancialRecordsByUser(
    userId: string,
    filters?: {
      clientId?: string;
      status?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      ticketId?: string;
    }
  ): Promise<FinancialRecord[]>;
  createFinancialRecord(
    record: InsertFinancialRecord
  ): Promise<FinancialRecord>;
  updateFinancialRecord(
    id: string,
    record: Partial<InsertFinancialRecord> & { paidAt?: string | Date }
  ): Promise<FinancialRecord | undefined>;
  deleteFinancialRecord(id: string): Promise<boolean>;
  getCashFlowSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalReceivables: string;
    totalPaid: string;
    totalPending: string;
    totalOverdue: string;
  }>;
  getReceivables(userId: string, overdue?: boolean): Promise<FinancialRecord[]>;

  // Integration Settings
  getIntegrationSettings(
    userId: string
  ): Promise<IntegrationSettings | undefined>;
  createIntegrationSettings(
    settings: InsertIntegrationSettings
  ): Promise<IntegrationSettings>;
  updateIntegrationSettings(
    userId: string,
    settings: Partial<InsertIntegrationSettings>
  ): Promise<IntegrationSettings | undefined>;
  createOrUpdateIntegrationSettings(
    settings: InsertIntegrationSettings
  ): Promise<IntegrationSettings>;

  // Reminder Logs
  getReminderLog(id: string): Promise<ReminderLog | undefined>;
  getReminderLogsByTicket(ticketId: string): Promise<ReminderLog[]>;
  createReminderLog(log: InsertReminderLog): Promise<ReminderLog>;

  // Local Events (Agenda Local)
  getLocalEvent(id: string): Promise<LocalEvent | undefined>;
  getLocalEventsByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LocalEvent[]>;
  createLocalEvent(event: InsertLocalEvent): Promise<LocalEvent>;
  updateLocalEvent(
    id: string,
    event: Partial<InsertLocalEvent>
  ): Promise<LocalEvent | undefined>;
  deleteLocalEvent(id: string): Promise<boolean>;

  // Upload de imagem/logo de cliente (usa Google Drive temporariamente)
  uploadClientImage(
    userId: string,
    params: { dataUrl: string; fileName?: string }
  ): Promise<{
    fileId: string;
    webViewUrl: string;
    downloadUrl: string;
  }>;

  // Plan Types
  getAllPlanTypes(
    role?: 'technician' | 'company' | 'tech' | 'empresa'
  ): Promise<PlanType[]>;
  getPlanType(id: string): Promise<PlanType | undefined>;
  createPlanType(planType: InsertPlanType): Promise<PlanType>;
  updatePlanType(
    id: string,
    planType: Partial<InsertPlanType>
  ): Promise<PlanType | undefined>;
  deletePlanType(id: string): Promise<boolean>;

  // Subscriptions
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionsByEmail(email: string): Promise<Subscription[]>;
  getActiveSubscriptionByEmailAndRole(
    email: string,
    role: 'technician' | 'company' | 'tech' | 'empresa'
  ): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(
    id: string,
    subscription: Partial<InsertSubscription>
  ): Promise<Subscription | undefined>;
  cancelSubscription(id: string): Promise<boolean>;

  // Ticket Statuses
  getTicketStatuses(): Promise<TicketStatus[]>;
  getTicketStatus(id: string): Promise<TicketStatus | undefined>;
  getTicketStatusByCode(code: string): Promise<TicketStatus | undefined>;
  createTicketStatus(status: InsertTicketStatus): Promise<TicketStatus>;
  updateTicketStatus(
    id: string,
    status: Partial<InsertTicketStatus>
  ): Promise<TicketStatus | undefined>;
  deleteTicketStatus(id: string): Promise<boolean>;

  // Vehicle Settings
  getVehicleSettings(userId: string): Promise<
    | {
        kmPerLiter: number;
        fuelPricePerLiter: number;
      }
    | undefined
  >;
  upsertVehicleSettings(
    userId: string,
    settings: {
      kmPerLiter: number;
      fuelPricePerLiter: number;
    }
  ): Promise<{
    kmPerLiter: number;
    fuelPricePerLiter: number;
  }>;

  // Service Order Templates (RAT/OS)
  getServiceOrderTemplate(id: string): Promise<ServiceOrderTemplate | undefined>;
  getServiceOrderTemplatesByCompany(
    companyId: string
  ): Promise<ServiceOrderTemplate[]>;
  createServiceOrderTemplate(
    template: InsertServiceOrderTemplate
  ): Promise<ServiceOrderTemplate>;
  updateServiceOrderTemplate(
    id: string,
    template: Partial<InsertServiceOrderTemplate>
  ): Promise<ServiceOrderTemplate | undefined>;
  deleteServiceOrderTemplate(id: string): Promise<boolean>;

  // Service Orders (filled instances)
  getServiceOrder(id: string): Promise<ServiceOrder | undefined>;
  getServiceOrderByTicket(ticketId: string): Promise<ServiceOrder | undefined>;
  getServiceOrderByPublicToken(
    token: string
  ): Promise<ServiceOrder | undefined>;
  createServiceOrder(order: InsertServiceOrder): Promise<ServiceOrder>;
  updateServiceOrder(
    id: string,
    order: Partial<InsertServiceOrder>
  ): Promise<ServiceOrder | undefined>;

  // Tenant cleanup
  deleteTenant(userId: string): Promise<void>;
}

// Exportar implementação Supabase
export { SupabaseStorage } from './storage-supabase';
export { storage } from './storage-supabase';

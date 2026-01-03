import { storage } from "./storage";
import { generateICS } from "./icsGenerator";

interface ReminderContext {
  ticketId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  scheduledDate: Date;
  address: string;
  city: string;
  state: string;
  duration: number;
}

async function sendReminderNotification(
  context: ReminderContext,
  reminderType: '24h' | '1h',
  timezone: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ticket = await storage.getTicket(context.ticketId);
    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }
    
    const icsContent = generateICS(
      ticket,
      context.clientName,
      context.serviceName,
      timezone
    );
    
    const icsBase64 = Buffer.from(icsContent).toString('base64');
    
    const timeUntil = reminderType === '24h' ? '24 horas' : '1 hora';
    const formattedDate = context.scheduledDate.toLocaleDateString('pt-BR');
    const formattedTime = context.scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const message = `Lembrete: Seu atendimento de ${context.serviceName} está agendado para daqui a ${timeUntil}.\n\n` +
      `Data: ${formattedDate}\n` +
      `Horário: ${formattedTime}\n` +
      `Endereço: ${context.address}, ${context.city}, ${context.state}\n\n` +
      `Em anexo está o arquivo ICS para adicionar ao seu calendário.`;
    
    console.log(`[REMINDER ${reminderType}] Would send to ${context.clientPhone}:`, {
      message,
      icsAttachment: icsBase64.substring(0, 50) + '...',
      clientEmail: context.clientEmail,
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Error sending ${reminderType} reminder:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function processReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  let processed = 0;
  let sent = 0;
  let failed = 0;
  
  try {
    const allUsers = await storage.getAllUsers();
    
    for (const user of allUsers) {
      const upcomingTickets = await storage.getTicketsByDateRange(
        user.id,
        oneHourAgo,
        twentyFiveHoursFromNow
      ).catch(() => []);
    
    for (const ticket of upcomingTickets) {
      if (ticket.status === 'cancelled' || ticket.status === 'completed') {
        continue;
      }
      
      const scheduledDate = new Date(ticket.scheduledDate);
      const timeUntilTicket = scheduledDate.getTime() - now.getTime();
      const hoursUntil = timeUntilTicket / (60 * 60 * 1000);
      
      const integrationSettings = await storage.getIntegrationSettings(ticket.userId);
      const timezone = integrationSettings?.timezone || 'America/Sao_Paulo';
      const reminder24hEnabled = integrationSettings?.reminder24hEnabled !== false;
      const reminder1hEnabled = integrationSettings?.reminder1hEnabled !== false;
      
      const existingReminders = await storage.getReminderLogsByTicket(ticket.id);
      const has24hReminder = existingReminders.some(r => r.type === '24h' && r.status === 'sent');
      const has1hReminder = existingReminders.some(r => r.type === '1h' && r.status === 'sent');
      
      const client = await storage.getClient(ticket.clientId);
      if (!client) {
        continue;
      }
      
      // Service is optional for EMPRESA_PARCEIRA clients
      const service = ticket.serviceId ? await storage.getService(ticket.serviceId) : null;
      
      const context: ReminderContext = {
        ticketId: ticket.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        serviceName: service?.name || 'Atendimento',
        scheduledDate,
        address: ticket.address || client.address || '',
        city: ticket.city || client.city,
        state: ticket.state || client.state,
        duration: ticket.duration,
      };
      
      if (reminder24hEnabled && !has24hReminder && hoursUntil <= 25 && hoursUntil >= 22) {
        processed++;
        const result = await sendReminderNotification(context, '24h', timezone);
        
        await storage.createReminderLog({
          ticketId: ticket.id,
          type: '24h',
          status: result.success ? 'sent' : 'failed',
          error: result.error,
        });
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      }
      
      if (reminder1hEnabled && !has1hReminder && hoursUntil <= 1.5 && hoursUntil >= 0.5) {
        processed++;
        const result = await sendReminderNotification(context, '1h', timezone);
        
        await storage.createReminderLog({
          ticketId: ticket.id,
          type: '1h',
          status: result.success ? 'sent' : 'failed',
          error: result.error,
        });
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      }
    }
    }
  } catch (error) {
    console.error('Error processing reminders:', error);
  }
  
  return { processed, sent, failed };
}

export async function checkNoShows(): Promise<{ updated: number }> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  let updated = 0;
  
  try {
    const allUsers = await storage.getAllUsers();
    
    for (const user of allUsers) {
      const recentTickets = await storage.getTicketsByDateRange(
        user.id,
        twentyFourHoursAgo,
        now
      ).catch(() => []);
    
    for (const ticket of recentTickets) {
      if (ticket.status !== 'confirmed') {
        continue;
      }
      
      const scheduledDate = new Date(ticket.scheduledDate);
      const durationMs = ticket.duration * 60 * 60 * 1000;
      const expectedEndTime = new Date(scheduledDate.getTime() + durationMs);
      
      if (now > expectedEndTime) {
        await storage.updateTicket(ticket.id, {
          noShow: true,
          status: 'cancelled',
          cancellationReason: 'No-show - Cliente não compareceu',
        });
        
        const client = await storage.getClient(ticket.clientId);
        if (client) {
          const currentNoShowCount = client.noShowCount || 0;
          await storage.updateClient(client.id, {
            noShowCount: currentNoShowCount + 1,
          });
        }
        
        updated++;
      }
    }
    }
  } catch (error) {
    console.error('Error checking no-shows:', error);
  }
  
  return { updated };
}

let reminderInterval: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (reminderInterval) {
    return;
  }
  
  processReminders().then(() => {
    // Silently completed
  }).catch(error => {
    console.error('[Reminder Scheduler] Initial run error:', error);
  });
  
  reminderInterval = setInterval(async () => {
    try {
      await processReminders();
      await checkNoShows();
    } catch (error) {
      console.error('[Reminder Scheduler] Error:', error);
    }
  }, 5 * 60 * 1000);
}

export function stopReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

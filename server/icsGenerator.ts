import ical from 'ical-generator';
import type { Ticket } from '@shared/schema';

export function generateICS(
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  timezone: string = 'America/Sao_Paulo'
): string {
  const calendar = ical({ name: 'ChamadosPro Appointment' });
  
  const scheduledDate = new Date(ticket.scheduledDate);
  const endDate = new Date(scheduledDate.getTime() + (ticket.duration * 60 * 60 * 1000));
  
  calendar.createEvent({
    start: scheduledDate,
    end: endDate,
    summary: `${serviceName} - ${clientName}`,
    description: ticket.description || `Service appointment for ${clientName}`,
    location: ticket.address && ticket.city && ticket.state 
      ? `${ticket.address}, ${ticket.city}, ${ticket.state}`
      : undefined,
    timezone: timezone,
  });
  
  return calendar.toString();
}

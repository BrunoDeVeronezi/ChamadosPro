import { storage } from './storage';
import { listCalendarBusySlots } from './googleCalendar';
import { buildScheduleByDay, SLOT_INTERVAL_MINUTES } from './workingHours';

interface TimeSlot {
  start: Date;
  end: Date;
}

interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
}

export async function getAvailableSlots(
  userId: string,
  serviceId: string | undefined,
  startDate: Date,
  endDate: Date,
  technicianId?: string
): Promise<AvailableSlot[]> {
  const integrationSettings = await storage.getIntegrationSettings(userId);
  const defaultDurationHours = integrationSettings?.defaultDurationHours || 3;
  const defaultWorkingDays = [1, 2, 3, 4, 5, 6];
  const workingDaysRaw = integrationSettings?.workingDays;
  const workingDays = Array.isArray(workingDaysRaw)
    ? workingDaysRaw
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const workingDaysForSchedule =
    workingDays.length > 0 ? workingDays : defaultWorkingDays;

  let durationHours = defaultDurationHours;

  if (serviceId) {
    const service = await storage.getService(serviceId);
    if (!service || !service.active) {
      console.error('[getAvailableSlots] Service not found or inactive', {
        userId,
        serviceId,
      });
      return [];
    }
    durationHours = service.duration || defaultDurationHours;
  } else {
    console.warn('[getAvailableSlots] Missing serviceId, using default duration', {
      userId,
      defaultDurationHours,
    });
  }
  const leadTimeMinutes = integrationSettings?.leadTimeMinutes || 30;
  const bufferMinutes = integrationSettings?.bufferMinutes || 15;
  const travelMinutes = integrationSettings?.travelMinutes || 30;

  const durationMinutes = Math.ceil(durationHours * 60);
  const durationMs = durationMinutes * 60 * 1000;

  const existingTickets = await storage.getTicketsByDateRange(
    userId,
    new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
    new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000)
  );

  const filteredTickets = technicianId
    ? existingTickets.filter(
        (t) => t.technicianId === technicianId && t.status !== 'cancelled'
      )
    : existingTickets.filter((t) => t.status !== 'cancelled');

  const availableSlots: AvailableSlot[] = [];
  const now = new Date();
  const minStartTime = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);

  const slotIntervalMinutes = SLOT_INTERVAL_MINUTES;
  const scheduleByDay = buildScheduleByDay(
    integrationSettings?.workingHours,
    workingDaysForSchedule
  );

  const calendarId = integrationSettings?.googleCalendarId || 'primary';
  const calendarBusySlots =
    integrationSettings?.googleCalendarStatus === 'connected' &&
    integrationSettings?.googleCalendarEnabled !== false
      ? await listCalendarBusySlots(userId, startDate, endDate, calendarId)
      : [];

  console.log('[getAvailableSlots] 📅 Slots ocupados do Google Calendar:', {
    count: calendarBusySlots.length,
    slots: calendarBusySlots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });

  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const daySchedule = scheduleByDay[currentDate.getDay()];
    if (!daySchedule?.enabled) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    for (
      let startMinute = daySchedule.startMinutes;
      startMinute + durationMinutes <= daySchedule.endMinutes;
      startMinute += slotIntervalMinutes
    ) {
      const hour = Math.floor(startMinute / 60);
      const minute = startMinute % 60;
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour, minute, 0, 0);

      if (slotStart < minStartTime) {
        continue;
      }

      const slotEnd = new Date(slotStart.getTime() + durationMs);

      if (slotEnd.toDateString() !== slotStart.toDateString()) {
        continue;
      }

      if (
        daySchedule.breakStartMinutes !== undefined &&
        daySchedule.breakEndMinutes !== undefined
      ) {
        const slotEndMinutes = startMinute + durationMinutes;
        const breakStart = daySchedule.breakStartMinutes;
        const breakEnd = daySchedule.breakEndMinutes;
        if (startMinute < breakEnd && slotEndMinutes > breakStart) {
          continue;
        }
      }

        const hasConflict = filteredTickets.some((ticket) => {
          const ticketStart = new Date(ticket.scheduledDate);
          const ticketEnd = new Date(
            ticketStart.getTime() + ticket.duration * 60 * 60 * 1000
          );

          const ticketBuffer =
            (ticket.bufferTimeMinutes || bufferMinutes) * 60 * 1000;
          const ticketTravel =
            (ticket.travelTimeMinutes || travelMinutes) * 60 * 1000;

          const ticketProtectedStart = new Date(
            ticketStart.getTime() - ticketBuffer - ticketTravel
          );
          const ticketProtectedEnd = new Date(
            ticketEnd.getTime() + ticketBuffer + ticketTravel
          );

          const slotBuffer = bufferMinutes * 60 * 1000;
          const slotTravel = travelMinutes * 60 * 1000;
          const slotProtectedStart = new Date(
            slotStart.getTime() - slotBuffer - slotTravel
          );
          const slotProtectedEnd = new Date(
            slotEnd.getTime() + slotBuffer + slotTravel
          );

          return (
            slotProtectedStart < ticketProtectedEnd &&
            slotProtectedEnd > ticketProtectedStart
          );
        });

        const hasCalendarConflict = calendarBusySlots.some((event) => {
          // Verificar se o slot se sobrepõe com o evento ocupado
          // Um slot conflita se: slotStart < event.end && slotEnd > event.start
          const conflicts = slotStart < event.end && slotEnd > event.start;

          if (conflicts) {
            console.log('[getAvailableSlots] ⚠️ Conflito detectado:', {
              slotStart: slotStart.toISOString(),
              slotEnd: slotEnd.toISOString(),
              eventStart: event.start.toISOString(),
              eventEnd: event.end.toISOString(),
            });
          }

          return conflicts;
        });

      if (!hasConflict && !hasCalendarConflict) {
        availableSlots.push({
          date: slotStart.toISOString().split('T')[0],
          time: slotStart.toTimeString().slice(0, 5),
          datetime: slotStart.toISOString(),
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availableSlots;
}

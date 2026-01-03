import { google } from 'googleapis';
import type { Ticket } from '@shared/schema';
import { storage } from './storage';
import {
  getUserRecord,
  updateUserRecord,
  upsertUserRecord,
} from './tokenStore';

async function getAuthClient(userId: string) {
  let record = getUserRecord(userId);
  if (!record?.tokens?.refresh_token) {
    const settings = await storage.getIntegrationSettings(userId);
    const tokens = (settings as any)?.googleCalendarTokens as any;
    if (tokens?.refresh_token) {
      record = upsertUserRecord({
        userId,
        email: record?.email || settings?.googleCalendarEmail || '',
        firstName: record?.firstName,
        lastName: record?.lastName,
        picture: record?.picture,
        folderId: record?.folderId,
        spreadsheetId: record?.spreadsheetId,
        calendarId: record?.calendarId,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
          token_type: tokens.token_type,
        },
      });
    }
  }

  if (!record?.tokens?.refresh_token) {
    throw new Error('Conta Google nao esta conectada. Faca login novamente.');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      (process.env.NGROK_URL
        ? `${process.env.NGROK_URL}/api/callback`
        : 'http://localhost:5180/api/callback')
  );

  client.setCredentials({
    refresh_token: record.tokens.refresh_token,
    access_token: record.tokens.access_token,
    expiry_date: record.tokens.expiry_date,
  });

  client.on('tokens', (tokens) => {
    if (!tokens) return;
    updateUserRecord(userId, {
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

async function getCalendarClient(userId: string) {
  const auth = await getAuthClient(userId);
  return google.calendar({ version: 'v3', auth });
}

async function isGoogleCalendarSyncEnabled(userId: string): Promise<boolean> {
  const settings = await storage.getIntegrationSettings(userId);
  return settings?.googleCalendarEnabled !== false;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

function getDateParts(value: Date | string): {
  year: number;
  month: number;
  day: number;
} {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  if (typeof value === 'string') {
    const [datePart] = value.split('T');
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return { year, month, day };
    }
  }

  const fallback = new Date();
  return {
    year: fallback.getUTCFullYear(),
    month: fallback.getUTCMonth() + 1,
    day: fallback.getUTCDate(),
  };
}

function getTimeParts(value?: string): { hour: number; minute: number; second: number } {
  if (!value) return { hour: 0, minute: 0, second: 0 };
  const [hourStr, minuteStr, secondStr] = value.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    second: Number.isFinite(second) ? second : 0,
  };
}

function formatUtcDateTime(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
    value.getUTCDate()
  )}T${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}:${pad2(
    value.getUTCSeconds()
  )}`;
}

function buildTicketDateTimeRange(
  ticket: Ticket
): { start: string; end: string } {
  const { year, month, day } = getDateParts(ticket.scheduledDate);
  const { hour, minute, second } = getTimeParts(ticket.scheduledTime);
  const startMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const durationHours = Number(ticket.duration);
  const safeDurationHours =
    Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 1;
  const endMs = startMs + safeDurationHours * 60 * 60 * 1000;

  return {
    start: formatUtcDateTime(new Date(startMs)),
    end: formatUtcDateTime(new Date(endMs)),
  };
}

export async function getCalendarEmail(userId: string): Promise<string | null> {
  try {
    const auth = await getAuthClient(userId);
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch (error) {
    console.error('Error fetching Google Calendar email:', error);
    return null;
  }
}

export async function createCalendarEvent(
  userId: string,
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  timezone: string = 'America/Sao_Paulo',
  calendarId: string = 'primary'
): Promise<string | null> {
  try {
    if (!(await isGoogleCalendarSyncEnabled(userId))) {
      return null;
    }
    const calendar = await getCalendarClient(userId);
    const { start, end } = buildTicketDateTimeRange(ticket);

    const event = {
      summary: `${serviceName} - ${clientName}`,
      description: ticket.description || `Service ticket for ${clientName}`,
      location:
        ticket.address && ticket.city && ticket.state
          ? `${ticket.address}, ${ticket.city}, ${ticket.state}`
          : undefined,
      start: {
        dateTime: start,
        timeZone: timezone,
      },
      end: {
        dateTime: end,
        timeZone: timezone,
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  timezone: string = 'America/Sao_Paulo',
  calendarId: string = 'primary'
): Promise<boolean> {
  try {
    if (!(await isGoogleCalendarSyncEnabled(userId))) {
      return false;
    }
    const calendar = await getCalendarClient(userId);
    const { start, end } = buildTicketDateTimeRange(ticket);

    const event = {
      summary: `${serviceName} - ${clientName}`,
      description: ticket.description || `Service ticket for ${clientName}`,
      location:
        ticket.address && ticket.city && ticket.state
          ? `${ticket.address}, ${ticket.city}, ${ticket.state}`
          : undefined,
      start: {
        dateTime: start,
        timeZone: timezone,
      },
      end: {
        dateTime: end,
        timeZone: timezone,
      },
    };

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });

    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<boolean> {
  try {
    if (!(await isGoogleCalendarSyncEnabled(userId))) {
      return false;
    }
    const calendar = await getCalendarClient(userId);

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

export async function checkCalendarConnection(
  userId: string
): Promise<{ connected: boolean; email?: string }> {
  try {
    // Verificar se o usuário tem tokens do Google armazenados
    const record = getUserRecord(userId);
    if (!record?.tokens?.refresh_token) {
      console.log(
        '[checkCalendarConnection] ❌ Usuário não tem tokens do Google:',
        userId
      );
      return { connected: false };
    }

    // Tentar obter o email do Google Calendar
    const email = await getCalendarEmail(userId);
    if (email) {
      return { connected: true, email };
    }

    console.log(
      '[checkCalendarConnection] ❌ Não foi possível obter email do Google Calendar:',
      userId
    );
    return { connected: false };
  } catch (error) {
    console.error(
      '[checkCalendarConnection] ❌ Erro ao verificar conexão do Google Calendar:',
      error
    );
    return { connected: false };
  }
}

export interface CalendarBusySlot {
  start: Date;
  end: Date;
  isAllDay?: boolean;
  calendarId?: string;
}

export async function listCalendarBusySlots(
  userId: string,
  timeMin: Date,
  timeMax: Date,
  calendarId: string = 'primary'
): Promise<CalendarBusySlot[]> {
  try {
    if (!(await isGoogleCalendarSyncEnabled(userId))) {
      return [];
    }
    const calendar = await getCalendarClient(userId);
    const busySlots: CalendarBusySlot[] = [];

    // Buscar todos os calendários do usuário para buscar eventos de todos eles
    const calendars = await listGoogleCalendars(userId);
    const calendarIdsToQuery = calendarId === 'primary' 
      ? calendars.map(cal => cal.id) // Se não especificado, buscar de todos
      : [calendarId]; // Se especificado, buscar apenas do especificado

    // 1. Buscar slots ocupados usando Freebusy (eventos com horário específico)
    try {
      console.log(
        '[listCalendarBusySlots] 🔍 Buscando eventos ocupados via Freebusy:',
        {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          calendarIds: calendarIdsToQuery,
        }
      );

      const freebusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: calendarIdsToQuery.map(id => ({ id })),
        },
      });

      // Processar slots ocupados de todos os calendários
      for (const calId of calendarIdsToQuery) {
        const freebusySlots = freebusyResponse.data.calendars?.[calId]?.busy || [];
        const mappedSlots = freebusySlots.map((slot) => ({
          start: new Date(slot.start!),
          end: new Date(slot.end!),
          isAllDay: false,
          calendarId: calId,
        }));
        busySlots.push(...mappedSlots);
      }

      console.log('[listCalendarBusySlots] ✅ Eventos Freebusy encontrados:', {
        count: busySlots.length,
        slots: busySlots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          startLocal: s.start.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          }),
          endLocal: s.end.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          }),
        })),
      });
    } catch (freebusyError) {
      console.error(
        '[listCalendarBusySlots] ❌ Error fetching freebusy slots:',
        freebusyError
      );
    }

    // 2. Buscar TODOS os eventos (incluindo de dia inteiro) de todos os calendários
    // Isso é uma verificação adicional ao Freebusy
    try {
      console.log(
        '[listCalendarBusySlots] 🔍 Buscando todos os eventos via events.list:',
        {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          calendarIds: calendarIdsToQuery,
        }
      );

      // Buscar eventos de cada calendário
      for (const calId of calendarIdsToQuery) {
        const eventsResponse = await calendar.events.list({
          calendarId: calId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const allEvents = eventsResponse.data.items || [];
        console.log(
          `[listCalendarBusySlots] 📋 Total de eventos encontrados no calendário ${calId}:`,
          allEvents.length
        );

        // Separar eventos de dia inteiro e eventos com horário específico
        const allDayEvents = allEvents.filter((event) => {
          // Eventos de dia inteiro têm 'date' em vez de 'dateTime'
          return event.start?.date && !event.start?.dateTime;
        });

        const timedEvents = allEvents.filter((event) => {
          // Eventos com horário específico têm 'dateTime'
          return event.start?.dateTime;
        });

        console.log(`[listCalendarBusySlots] 📊 Eventos categorizados do calendário ${calId}:`, {
          allDay: allDayEvents.length,
          timed: timedEvents.length,
          total: allEvents.length,
        });

        // Adicionar eventos com horário específico que podem não ter sido capturados pelo Freebusy
        for (const event of timedEvents) {
          if (event.start?.dateTime && event.end?.dateTime) {
            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);

            // Verificar se já não está na lista de busySlots (para evitar duplicatas)
            const alreadyExists = busySlots.some(
              (slot) =>
                slot.start.getTime() === eventStart.getTime() &&
                slot.end.getTime() === eventEnd.getTime()
            );

            if (!alreadyExists) {
              console.log(
                '[listCalendarBusySlots] ⏰ Evento com horário adicionado:',
                {
                  summary: event.summary,
                  calendarId: calId,
                  start: eventStart.toISOString(),
                  end: eventEnd.toISOString(),
                  startLocal: eventStart.toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  }),
                  endLocal: eventEnd.toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  }),
                }
              );

              busySlots.push({
                start: eventStart,
                end: eventEnd,
                isAllDay: false,
                calendarId: calId,
              });
            }
          }
        }

        // Converter eventos de dia inteiro para o formato de busy slots
        for (const event of allDayEvents) {
          if (event.start?.date && event.end?.date) {
          // Para eventos de dia inteiro, o 'date' está no formato 'YYYY-MM-DD'
          // Eventos de dia inteiro são armazenados sem timezone, então tratamos como UTC
          // e depois convertemos para o timezone local para comparação
          const startDateStr = event.start.date; // Formato: 'YYYY-MM-DD'
          const endDateStr = event.end.date; // Formato: 'YYYY-MM-DD' (exclusivo)

          // Criar data de início e fim tratando como horário local (meia-noite)
          // para evitar que o fuso horário desloque o evento para o dia anterior
          const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
          const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);

          const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
          const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
          // O Google envia o endDate como o dia seguinte (exclusivo), então voltamos 1 dia
          endDate.setDate(endDate.getDate() - 1);

          console.log(
            '[listCalendarBusySlots] 📅 Evento de dia inteiro encontrado (Local):',
            {
              summary: event.summary,
              startDate: event.start.date,
              endDate: event.end.date,
              startDateParsed: startDate.toISOString(),
              endDateParsed: endDate.toISOString(),
              startDateLocal: startDate.toLocaleString('pt-BR'),
              endDateLocal: endDate.toLocaleString('pt-BR'),
            }
          );

          busySlots.push({
            start: startDate,
            end: endDate,
            isAllDay: true,
            calendarId: calId,
          });
        }
        }
      }

      console.log(
        '[listCalendarBusySlots] 📊 Resumo final de slots ocupados:',
        {
          total: busySlots.length,
          slots: busySlots.map((s) => ({
            start: s.start.toISOString(),
            end: s.end.toISOString(),
            startLocal: s.start.toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            }),
            endLocal: s.end.toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            }),
          })),
        }
      );
    } catch (eventsError) {
      console.error('Error fetching all-day events:', eventsError);
    }

    // Ordenar e mesclar slots sobrepostos (opcional, mas recomendado)
    busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    return busySlots;
  } catch (error) {
    console.error('Error fetching calendar busy slots:', error);
    return [];
  }
}

export async function listGoogleCalendars(
  userId: string
): Promise<
  Array<{
    id: string;
    summary: string;
    primary: boolean;
    backgroundColor?: string;
  }>
> {
  try {
    const calendar = await getCalendarClient(userId);
    const response = await calendar.calendarList.list();

    return (response.data.items || []).map((cal) => ({
      id: cal.id || '',
      summary: cal.summary || 'Sem nome',
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor || undefined,
    }));
  } catch (error) {
    console.error('Error listing Google calendars:', error);
    return [];
  }
}

export async function getAllCalendarEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<
  Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    calendarId: string;
    calendarName: string;
    backgroundColor?: string;
    allDay?: boolean;
  }>
> {
  try {
    if (!(await isGoogleCalendarSyncEnabled(userId))) {
      return [];
    }
    const calendar = await getCalendarClient(userId);
    const calendars = await listGoogleCalendars(userId);

    const allEvents: any[] = [];

    for (const cal of calendars) {
      try {
        const response = await calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = (response.data.items || []).map((event) => {
          // Verificar se é evento de dia inteiro (tem 'date' mas não 'dateTime')
          const isAllDay = !!(event.start?.date && !event.start?.dateTime);
          
          return {
            id: event.id || '',
            summary: event.summary || 'Sem titulo',
            start: event.start?.dateTime || event.start?.date || '',
            end: event.end?.dateTime || event.end?.date || '',
            description: event.description,
            location: event.location,
            calendarId: cal.id,
            calendarName: cal.summary,
            backgroundColor: cal.backgroundColor,
            allDay: isAllDay,
          };
        });

        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching events from calendar ${cal.id}:`, error);
      }
    }

    return allEvents;
  } catch (error) {
    console.error('Error getting all calendar events:', error);
    return [];
  }
}

export async function createGoogleCalendar(
  userId: string,
  summary: string,
  description?: string,
  timeZone: string = 'America/Sao_Paulo'
): Promise<{ id: string; summary: string } | null> {
  try {
    const calendar = await getCalendarClient(userId);

    const response = await calendar.calendars.insert({
      requestBody: {
        summary,
        description,
        timeZone,
      },
    });

    return {
      id: response.data.id || '',
      summary: response.data.summary || summary,
    };
  } catch (error) {
    console.error('Error creating Google calendar:', error);
    return null;
  }
}

export async function deleteGoogleCalendar(
  userId: string,
  calendarId: string
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient(userId);

    await calendar.calendars.delete({
      calendarId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting Google calendar:', error);
    return false;
  }
}

export async function createCalendarEventInCalendar(
  userId: string,
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  calendarId: string = 'primary',
  timezone: string = 'America/Sao_Paulo'
): Promise<string | null> {
  return createCalendarEvent(
    userId,
    ticket,
    clientName,
    serviceName,
    timezone,
    calendarId
  );
}

export async function createLocalEventInGoogleCalendar(
  userId: string,
  title: string,
  startDate: Date,
  endDate: Date,
  description?: string,
  location?: string,
  allDay: boolean = false,
  calendarId: string = 'primary',
  timezone: string = 'America/Sao_Paulo'
): Promise<string | null> {
  try {
    const calendar = await getCalendarClient(userId);

    const event: any = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
    };

    if (allDay) {
      // Evento de dia inteiro usa formato 'date' (YYYY-MM-DD)
      const startYear = startDate.getFullYear();
      const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
      const startDay = String(startDate.getDate()).padStart(2, '0');
      const startDateStr = `${startYear}-${startMonth}-${startDay}`;
      
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;
      
      event.start = { date: startDateStr };
      event.end = { date: endDateStr };
    } else {
      // Evento com horário específico usa formato 'dateTime'
      event.start = {
        dateTime: startDate.toISOString(),
        timeZone: timezone,
      };
      event.end = {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      };
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.error('Error creating local event in Google Calendar:', error);
    return null;
  }
}

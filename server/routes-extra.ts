import type { Express } from 'express';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import {
  base64Url,
  generateCodeChallenge,
  generateCodeVerifier,
  getOAuthClient,
  getRedirectUriFromRequest,
  isAuthenticated,
  oauthStateCache,
} from './googleAuth';
import { storage } from './storage';
import { insertFinancialRecordSchema } from '@shared/schema';
import {
  checkCalendarConnection,
  createGoogleCalendar,
  deleteGoogleCalendar,
  getAllCalendarEvents,
  listGoogleCalendars,
} from './googleCalendar';
import { getUserRecord, upsertUserRecord } from './tokenStore';

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

export function registerExtraRoutes(app: Express) {
  app.get('/api/calendar/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const connection = await checkCalendarConnection(userId);
      const status = connection.connected ? 'connected' : 'not_connected';
      const settings = await storage.getIntegrationSettings(userId);

      if (settings) {
        await storage.updateIntegrationSettings(userId, {
          googleCalendarStatus: status,
          googleCalendarEmail: connection.email,
        });
      } else {
        await storage.createIntegrationSettings({
          userId,
          googleCalendarStatus: status,
          googleCalendarEmail: connection.email,
        });
      }

      res.json({
        connected: connection.connected,
        email: connection.email,
        status,
      });
    } catch (error) {
      console.error('Error checking calendar status:', error);
      res.json({ connected: false, status: 'error' });
    }
  });

  app.get('/api/google-calendar/auth', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const redirectUri = getRedirectUriFromRequest(req);
      const oauth2Client = getOAuthClient(redirectUri);
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = base64Url(randomBytes(24));

      req.session.codeVerifier = codeVerifier;
      req.session.state = state;
      req.session.integrationType = 'google-calendar';
      req.session.userId = userId;

      oauthStateCache.set(state, {
        codeVerifier,
        state,
        timestamp: Date.now(),
        userId,
      });

      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'consent',
      });

      res.json({ authUrl });
    } catch (error: any) {
      console.error('Error initiating Google Calendar auth:', error);
      res.status(500).json({
        message: 'Erro ao iniciar autenticacao do Google Calendar',
        error: error.message,
      });
    }
  });

  app.get('/api/google-calendar/callback', async (req: any, res) => {
    try {
      const { state, code } = req.query;
      if (!state || !code) {
        return res.status(400).send('Missing state or code');
      }

      const cachedStateEntry = oauthStateCache.get(state);
      if (!cachedStateEntry) {
        return res
          .status(400)
          .send('Invalid or expired state. Please try again.');
      }

      const userId = cachedStateEntry?.userId || req.session?.user?.id;
      if (!userId) {
        return res.status(401).send('User session not found. Please try again.');
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).send('User not found');
      }

      const codeVerifier =
        cachedStateEntry.codeVerifier || req.session?.codeVerifier;
      if (!codeVerifier || cachedStateEntry.state !== state) {
        return res.status(400).send('Invalid state');
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
      const userInfo = await oauth2.userinfo.get();

      const existing = getUserRecord(userId);
      upsertUserRecord({
        userId,
        email: currentUser.email || userInfo.data.email || '',
        firstName: currentUser.firstName || userInfo.data.given_name || undefined,
        lastName: currentUser.lastName || userInfo.data.family_name || undefined,
        picture: currentUser.profileImageUrl || userInfo.data.picture || undefined,
        tokens: {
          access_token: tokens.access_token || '',
          refresh_token: tokens.refresh_token || '',
          scope: tokens.scope,
          token_type: tokens.token_type || 'Bearer',
          expiry_date: tokens.expiry_date || Date.now() + 60 * 60 * 1000,
        },
        folderId: existing?.folderId,
        spreadsheetId: existing?.spreadsheetId,
        calendarId: existing?.calendarId,
      });

      await storage.createOrUpdateIntegrationSettings({
        userId,
        googleCalendarStatus: 'connected',
        googleCalendarEmail: userInfo.data.email || null,
        googleCalendarTokens: tokens as any,
      });

      oauthStateCache.delete(state);
      if (req.session && currentUser) {
        req.session.user = {
          id: currentUser.id,
          email: currentUser.email || '',
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          picture: currentUser.profileImageUrl,
        };
        (req.session as any).userRole = currentUser.role;
      }

      res.redirect('/configuracoes?google-calendar=connected');
    } catch (error) {
      console.error('Error in Google Calendar callback:', error);
      res.redirect('/configuracoes?google-calendar=error');
    }
  });

  app.get(
    '/api/google-calendar/calendars',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const calendars = await listGoogleCalendars(userId);
        res.json(calendars);
      } catch (error) {
        console.error('Error listing Google calendars:', error);
        res.status(500).json({ message: 'Failed to fetch calendars' });
      }
    }
  );

  app.get(
    '/api/google-calendar/events',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { timeMin, timeMax } = req.query;
        if (!timeMin || !timeMax) {
          return res
            .status(400)
            .json({ message: 'timeMin and timeMax are required' });
        }

        const userId = req.user.id;
        const events = await getAllCalendarEvents(
          userId,
          new Date(timeMin as string),
          new Date(timeMax as string)
        );
        res.json(events);
      } catch (error) {
        console.error('Error fetching Google calendar events:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
      }
    }
  );

  app.post(
    '/api/google-calendar/calendars',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { summary, description } = req.body;
        if (!summary) {
          return res
            .status(400)
            .json({ message: 'Calendar name (summary) is required' });
        }

        const userId = req.user.id;
        const calendar = await createGoogleCalendar(
          userId,
          summary,
          description
        );
        if (!calendar) {
          return res.status(500).json({ message: 'Failed to create calendar' });
        }
        res.json(calendar);
      } catch (error) {
        console.error('Error creating Google calendar:', error);
        res.status(500).json({ message: 'Failed to create calendar' });
      }
    }
  );

  app.delete(
    '/api/google-calendar/calendars/:calendarId',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { calendarId } = req.params;
        if (!calendarId) {
          return res.status(400).json({ message: 'Calendar ID is required' });
        }

        const userId = req.user.id;
        const calendars = await listGoogleCalendars(userId);
        const calendar = calendars.find((cal) => cal.id === calendarId);
        if (calendar?.primary) {
          return res
            .status(403)
            .json({ message: 'Cannot delete the primary calendar' });
        }

        const success = await deleteGoogleCalendar(userId, calendarId);
        if (!success) {
          return res.status(500).json({ message: 'Failed to delete calendar' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting Google calendar:', error);
        res.status(500).json({ message: 'Failed to delete calendar' });
      }
    }
  );

  app.get(
    '/api/dashboard/stats/:period?',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const [clients, tickets, financialRecords] = await Promise.all([
          storage.getClientsByUser(userId),
          storage.getTicketsByUser(userId),
          storage.getFinancialRecordsByUser(userId),
        ]);

        const services = await storage.getServicesByUser(userId);
        const servicesMap = new Map(services.map((s) => [s.id, s]));
        const clientsMap = new Map(clients.map((c) => [c.id, c]));

        const parseMoney = (value: any) => {
          if (value === null || value === undefined || value === '') return 0;
          if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
          const str = String(value)
            .replace(/[^\d,.-]/g, '')
            .replace(',', '.');
          const parsed = parseFloat(str);
          return Number.isNaN(parsed) ? 0 : parsed;
        };

        const getTicketTotal = (ticket: any) => {
          const directTotal = parseMoney(ticket.totalAmount || ticket.total_amount);
          if (directTotal > 0) return directTotal;
          const service = ticket.serviceId ? servicesMap.get(ticket.serviceId) : null;
          const baseValue =
            parseMoney(ticket.ticketValue) || parseMoney(service?.price);
          const kmTotal = parseMoney(ticket.kmTotal || ticket.km_total);
          const kmRate = parseMoney(ticket.kmRate || ticket.km_rate);
          const extraExpenses = parseMoney(ticket.extraExpenses);
          return baseValue + kmTotal * kmRate + extraExpenses;
        };

        const getTicketHours = (ticket: any) => {
          if (ticket.elapsedSeconds) {
            return Math.max(0, Number(ticket.elapsedSeconds) / 3600);
          }
          const startedAt = ticket.startedAt || ticket.started_at;
          const stoppedAt = ticket.stoppedAt || ticket.stopped_at;
          if (startedAt && stoppedAt) {
            const start = new Date(startedAt).getTime();
            const end = new Date(stoppedAt).getTime();
            if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
              return (end - start) / (1000 * 60 * 60);
            }
          }
          if (ticket.duration) {
            const duration = Number(ticket.duration);
            return Number.isNaN(duration) ? 0 : duration;
          }
          return 0;
        };

        const getCompletionDate = (ticket: any) => {
          const candidates = [
            ticket.completedAt,
            ticket.completed_at,
            ticket.stoppedAt,
            ticket.stopped_at,
            ticket.scheduledDate,
            ticket.scheduled_date,
            ticket.createdAt,
            ticket.created_at,
          ];
          for (const value of candidates) {
            if (!value) continue;
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) return date;
          }
          return null;
        };

        const getCancellationDate = (ticket: any) => {
          const candidates = [
            ticket.cancelledAt,
            ticket.cancelled_at,
            ticket.cancellationDate,
            ticket.cancellation_date,
            ticket.stoppedAt,
            ticket.stopped_at,
            ticket.scheduledDate,
            ticket.scheduled_date,
            ticket.createdAt,
            ticket.created_at,
          ];
          for (const value of candidates) {
            if (!value) continue;
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) return date;
          }
          return null;
        };

        const normalizedTickets = tickets.map((ticket: any) => {
          const rawStatus = (ticket.originalStatus || ticket.status || '')
            .toString()
            .toUpperCase()
            .trim();
          const normalizedStatus = normalizeStatus(rawStatus);
          return {
            ...ticket,
            status: normalizedStatus,
            originalStatus: rawStatus || normalizedStatus,
            client: clientsMap.get(ticket.clientId) || null,
            service: ticket.serviceId
              ? servicesMap.get(ticket.serviceId) || null
              : null,
          };
        });

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        const lastDayOfMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        );
        lastDayOfMonth.setHours(23, 59, 59, 999);

        const isInProgress = (ticket: any) => {
          const original = (ticket.originalStatus || '')
            .toString()
            .toUpperCase();
          const normalized = (ticket.status || '').toString().toLowerCase();
          return (
            original === 'INICIADO' ||
            original === 'EXECUCAO' ||
            normalized === 'in-progress'
          );
        };

        const isPending = (ticket: any) => {
          const original = (ticket.originalStatus || '')
            .toString()
            .toUpperCase();
          const normalized = (ticket.status || '').toString().toLowerCase();
          return original === 'ABERTO' || normalized === 'pending';
        };

        const isCompleted = (ticket: any) => {
          const original = (ticket.originalStatus || '')
            .toString()
            .toUpperCase();
          const normalized = (ticket.status || '').toString().toLowerCase();
          return original.includes('CONCLU') || normalized === 'completed';
        };

        const isCancelled = (ticket: any) => {
          const original = (ticket.originalStatus || '')
            .toString()
            .toUpperCase();
          const normalized = (ticket.status || '').toString().toLowerCase();
          return original.includes('CANCEL') || normalized === 'cancelled';
        };

        const completedThisMonthTickets = normalizedTickets.filter((ticket) => {
          if (!isCompleted(ticket)) return false;
          const completionDate = getCompletionDate(ticket);
          return (
            completionDate &&
            completionDate >= firstDayOfMonth &&
            completionDate <= lastDayOfMonth
          );
        });

        const cancelledThisMonthTickets = normalizedTickets.filter((ticket) => {
          if (!isCancelled(ticket)) return false;
          const cancelDate = getCancellationDate(ticket);
          return (
            cancelDate &&
            cancelDate >= firstDayOfMonth &&
            cancelDate <= lastDayOfMonth
          );
        });

        const activeTickets = normalizedTickets.filter(isInProgress).length;
        const pendingTickets = normalizedTickets.filter(isPending).length;
        const chamadosEmAberto = normalizedTickets.filter(
          (ticket) => isPending(ticket) || isInProgress(ticket)
        ).length;

        let totalRevenue = 0;
        let totalHours = 0;
        let faturamentoEstimado = 0;

        const revenueByType: Record<
          'PF' | 'PJ' | 'EMPRESA_PARCEIRA',
          { revenue: number; hours: number; ticketCount: number }
        > = {
          PF: { revenue: 0, hours: 0, ticketCount: 0 },
          PJ: { revenue: 0, hours: 0, ticketCount: 0 },
          EMPRESA_PARCEIRA: { revenue: 0, hours: 0, ticketCount: 0 },
        };

        normalizedTickets.forEach((ticket) => {
          const scheduledDate = ticket.scheduledDate || ticket.scheduled_date;
          if (scheduledDate) {
            const scheduled = new Date(scheduledDate);
            if (
              !Number.isNaN(scheduled.getTime()) &&
              scheduled >= firstDayOfMonth &&
              scheduled <= lastDayOfMonth
            ) {
              faturamentoEstimado += getTicketTotal(ticket);
            }
          }
        });

        completedThisMonthTickets.forEach((ticket) => {
          const amount = getTicketTotal(ticket);
          const hours = getTicketHours(ticket);
          totalRevenue += amount;
          totalHours += hours;

          const clientType =
            ticket.client?.type === 'PJ' ||
            ticket.client?.type === 'EMPRESA_PARCEIRA'
              ? ticket.client.type
              : 'PF';
          const bucket = revenueByType[clientType];
          bucket.revenue += amount;
          bucket.hours += hours;
          bucket.ticketCount += 1;
        });

        const ticketMedio =
          completedThisMonthTickets.length > 0
            ? totalRevenue / completedThisMonthTickets.length
            : 0;

        const revenuePerHourAvg = totalHours > 0 ? totalRevenue / totalHours : 0;

        const revenuePerHourByType = {
          PF: revenueByType.PF.hours
            ? revenueByType.PF.revenue / revenueByType.PF.hours
            : 0,
          PJ: revenueByType.PJ.hours
            ? revenueByType.PJ.revenue / revenueByType.PJ.hours
            : 0,
          EMPRESA_PARCEIRA: revenueByType.EMPRESA_PARCEIRA.hours
            ? revenueByType.EMPRESA_PARCEIRA.revenue /
              revenueByType.EMPRESA_PARCEIRA.hours
            : 0,
        };

        const revenuePerHourRanking = (Object.keys(revenueByType) as Array<
          keyof typeof revenueByType
        >)
          .map((type) => ({
            type,
            revenue: revenueByType[type].revenue,
            hours: revenueByType[type].hours,
            avg: revenueByType[type].hours
              ? revenueByType[type].revenue / revenueByType[type].hours
              : 0,
            ticketCount: revenueByType[type].ticketCount,
          }))
          .sort((a, b) => b.avg - a.avg);

        let slaHoursAvg = 0;
        const slaDurations: number[] = [];
        completedThisMonthTickets.forEach((ticket) => {
          const completionDate = getCompletionDate(ticket);
          const startDate =
            ticket.scheduledDate ||
            ticket.scheduled_date ||
            ticket.createdAt ||
            ticket.created_at;
          if (!completionDate || !startDate) return;
          const start = new Date(startDate).getTime();
          const end = completionDate.getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end < start) return;
          const diffHours = (end - start) / (1000 * 60 * 60);
          if (diffHours >= 0 && diffHours <= 24 * 30) {
            slaDurations.push(diffHours);
          }
        });
        if (slaDurations.length > 0) {
          slaHoursAvg =
            slaDurations.reduce((sum, value) => sum + value, 0) /
            slaDurations.length;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        const clientesAtivosHoje = new Set(
          normalizedTickets
            .filter((ticket) => {
              const scheduledDate = ticket.scheduledDate || ticket.scheduled_date;
              if (!scheduledDate) return false;
              const date = new Date(scheduledDate);
              if (Number.isNaN(date.getTime())) return false;
              date.setHours(0, 0, 0, 0);
              return (
                date >= today &&
                date < tomorrow &&
                (isPending(ticket) || isInProgress(ticket))
              );
            })
            .map((ticket) => ticket.clientId)
            .filter(Boolean)
        ).size;

        const clientesAtivosSemana = new Set(
          normalizedTickets
            .filter((ticket) => {
              const scheduledDate = ticket.scheduledDate || ticket.scheduled_date;
              if (!scheduledDate) return false;
              const date = new Date(scheduledDate);
              if (Number.isNaN(date.getTime())) return false;
              date.setHours(0, 0, 0, 0);
              return (
                date >= today &&
                date < weekFromNow &&
                (isPending(ticket) || isInProgress(ticket))
              );
            })
            .map((ticket) => ticket.clientId)
            .filter(Boolean)
        ).size;

        const proximosAgendamentos = normalizedTickets.filter((ticket) => {
          const scheduledDate = ticket.scheduledDate || ticket.scheduled_date;
          if (!scheduledDate) return false;
          const date = new Date(scheduledDate);
          if (Number.isNaN(date.getTime())) return false;
          date.setHours(0, 0, 0, 0);
          return date >= today && (isPending(ticket) || isInProgress(ticket));
        }).length;

        const overdueRecords = financialRecords.filter((record: any) => {
          const status = (record.status || '').toString().toLowerCase();
          if (status !== 'pending') return false;
          const dueDate = record.dueDate || record.due_date;
          if (!dueDate) return false;
          const date = new Date(dueDate);
          if (Number.isNaN(date.getTime())) return false;
          date.setHours(0, 0, 0, 0);
          return date < today;
        });

        const pendenciasVencidas = overdueRecords.length;
        const aReceberVencido = overdueRecords.reduce(
          (sum: number, record: any) => sum + parseMoney(record.amount),
          0
        );

        res.json({
          activeTickets,
          pendingTickets,
          activeClients: clients.length,
          completedThisMonth: completedThisMonthTickets.length,
          cancelledThisMonth: cancelledThisMonthTickets.length,
          chamadosEmAberto,
          slaHoursAvg,
          faturamentoEstimado,
          ticketMedio,
          clientesAtivosHoje,
          clientesAtivosSemana,
          proximosAgendamentos,
          pendenciasVencidas,
          aReceberVencido,
          revenuePerHourAvg,
          revenuePerHourByType,
          revenuePerHourRanking,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard stats' });
      }
    }
  );

  app.get(
    '/api/dashboard/km-metrics',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const [tickets, vehicleSettings] = await Promise.all([
          storage.getTicketsByUser(userId),
          storage.getVehicleSettings(userId),
        ]);

        const parseDecimal = (value: any) => {
          if (value === null || value === undefined || value === '') return 0;
          if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
          const parsed = parseFloat(String(value).replace(',', '.'));
          return Number.isNaN(parsed) ? 0 : parsed;
        };

        const now = new Date();
        const daysParam = Number(req.query.days);
        const useRollingWindow =
          Number.isFinite(daysParam) && daysParam > 0;

        const periodStart = useRollingWindow
          ? new Date(now)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        if (useRollingWindow) {
          periodStart.setDate(periodStart.getDate() - daysParam);
        }
        periodStart.setHours(0, 0, 0, 0);

        const periodEnd = useRollingWindow
          ? new Date(now)
          : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);

        const vehicleConsumption = parseDecimal(
          vehicleSettings?.kmPerLiter || 10
        );
        const fuelPrice = parseDecimal(vehicleSettings?.fuelPricePerLiter || 6);

        const calculateFuelCost = (kmTotal: number) => {
          if (vehicleConsumption <= 0) return 0;
          const consumptionAmount = kmTotal / vehicleConsumption;
          return consumptionAmount * fuelPrice;
        };

        const getCompletionDate = (ticket: any) => {
          const candidates = [
            ticket.completedAt,
            ticket.completed_at,
            ticket.stoppedAt,
            ticket.stopped_at,
            ticket.scheduledDate,
            ticket.scheduled_date,
          ];
          for (const value of candidates) {
            if (!value) continue;
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) return date;
          }
          return null;
        };

        let totalKm = 0;
        let ganhosKm = 0;
        let gastosKm = 0;

        tickets.forEach((ticket: any) => {
          const status = (ticket.status || '').toString().toUpperCase();
          if (!status.includes('CONCLU') && status !== 'COMPLETED') {
            return;
          }
          const completionDate = getCompletionDate(ticket);
          if (
            !completionDate ||
            completionDate < periodStart ||
            completionDate > periodEnd
          ) {
            return;
          }

          const kmTotal = parseDecimal(ticket.kmTotal || ticket.km_total);
          const kmRate = parseDecimal(ticket.kmRate || ticket.km_rate);
          if (kmTotal <= 0 || kmRate <= 0) return;

          totalKm += kmTotal;
          ganhosKm += kmTotal * kmRate;
          gastosKm += calculateFuelCost(kmTotal);
        });

        const lucroKm = ganhosKm - gastosKm;

        res.json({
          totalKm: Math.round(totalKm * 100) / 100,
          ganhosKm: Math.round(ganhosKm * 100) / 100,
          gastosKm: Math.round(gastosKm * 100) / 100,
          lucroKm: Math.round(lucroKm * 100) / 100,
        });
      } catch (error) {
        console.error('Error fetching km metrics:', error);
        res.status(500).json({ message: 'Erro ao buscar metricas de KM' });
      }
    }
  );

  app.get('/api/financial/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { period = 'current-month' } = req.query;
      const now = new Date();
      let startDate: Date;
      let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      switch (period) {
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last-90-days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case 'this-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'current-month':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const allRecords = await storage.getFinancialRecordsByUser(userId, {
        startDate,
        endDate,
      });

      const nowDate = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthRecords = allRecords.filter((record: any) => {
        const recordDate = record.paidAt
          ? new Date(record.paidAt)
          : record.dueDate
          ? new Date(record.dueDate)
          : new Date(record.createdAt);
        return recordDate >= currentMonthStart && recordDate <= currentMonthEnd;
      });

      const receivedThisMonth = monthRecords
        .filter((record: any) =>
          ['paid', 'PAGO'].includes(String(record.status))
        )
        .reduce(
          (sum: number, record: any) =>
            sum + parseFloat(String(record.amount || 0)),
          0
        );

      const pendingThisMonth = monthRecords
        .filter(
          (record: any) =>
            ['pending', 'PENDENTE'].includes(String(record.status)) &&
            record.type === 'receivable'
        )
        .reduce(
          (sum: number, record: any) =>
            sum + parseFloat(String(record.amount || 0)),
          0
        );

      const billingThisMonth = receivedThisMonth + pendingThisMonth;
      const cashFlow = allRecords
        .filter((record: any) =>
          ['paid', 'PAGO'].includes(String(record.status))
        )
        .reduce(
          (sum: number, record: any) =>
            sum + parseFloat(String(record.amount || 0)),
          0
        );

      const receivables = allRecords.filter(
        (record: any) =>
          record.type === 'receivable' &&
          ['pending', 'PENDENTE', 'overdue', 'ATRASADO'].includes(
            String(record.status)
          )
      );

      const topPendencies = receivables
        .map((record: any) => {
          const dueDate = record.dueDate ? new Date(record.dueDate) : null;
          const daysOverdue = dueDate
            ? Math.floor((nowDate.getTime() - dueDate.getTime()) / oneDay)
            : undefined;
          return {
            id: record.id,
            ticketId: record.ticketId || undefined,
            clientId: record.clientId,
            clientName: '',
            amount: parseFloat(String(record.amount || 0)),
            dueDate: record.dueDate || record.createdAt,
            daysOverdue: daysOverdue && daysOverdue > 0 ? daysOverdue : undefined,
          };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const clients = await storage.getClientsByUser(userId);
      topPendencies.forEach((pendency) => {
        const client = clients.find((c) => c.id === pendency.clientId);
        if (client) pendency.clientName = client.name;
      });

      const cashFlowData = [] as Array<{ week: string; value: number }>;
      for (let i = 3; i >= 0; i -= 1) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekValue = allRecords
          .filter((record: any) => {
            const recordDate = record.paidAt
              ? new Date(record.paidAt)
              : record.dueDate
              ? new Date(record.dueDate)
              : new Date(record.createdAt);
            return (
              recordDate >= weekStart &&
              recordDate <= weekEnd &&
              ['paid', 'PAGO'].includes(String(record.status))
            );
          })
          .reduce(
            (sum: number, record: any) =>
              sum + parseFloat(String(record.amount || 0)),
            0
          );

        cashFlowData.push({
          week: `Sem ${4 - i}`,
          value: weekValue,
        });
      }

      const receivablesByDueDate = {
        toReceive: 0,
        overdue1to15: 0,
        overdue16to30: 0,
        overdue30Plus: 0,
      };

      receivables.forEach((record: any) => {
        const amount = parseFloat(String(record.amount || 0));
        const dueDate = record.dueDate ? new Date(record.dueDate) : null;
        if (!dueDate) {
          receivablesByDueDate.toReceive += amount;
          return;
        }
        const daysDiff = Math.floor(
          (dueDate.getTime() - nowDate.getTime()) / oneDay
        );
        if (daysDiff > 0) {
          receivablesByDueDate.toReceive += amount;
        } else if (daysDiff >= -15) {
          receivablesByDueDate.overdue1to15 += amount;
        } else if (daysDiff >= -30) {
          receivablesByDueDate.overdue16to30 += amount;
        } else {
          receivablesByDueDate.overdue30Plus += amount;
        }
      });

      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      const previousPeriodEnd = new Date(startDate);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
      const previousRecords = await storage.getFinancialRecordsByUser(userId, {
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
      });
      const previousCashFlow = previousRecords
        .filter((record: any) =>
          ['paid', 'PAGO'].includes(String(record.status))
        )
        .reduce(
          (sum: number, record: any) =>
            sum + parseFloat(String(record.amount || 0)),
          0
        );
      const cashFlowChange =
        previousCashFlow > 0
          ? ((cashFlow - previousCashFlow) / previousCashFlow) * 100
          : 0;

      res.json({
        receivedThisMonth,
        pendingThisMonth,
        billingThisMonth,
        cashFlow,
        cashFlowChange,
        topPendencies,
        cashFlowData,
        receivablesByDueDate,
      });
    } catch (error) {
      console.error('Error fetching financial dashboard:', error);
      res
        .status(500)
        .json({ message: 'Failed to fetch financial dashboard' });
    }
  });

  app.get(
    '/api/tickets/stats-by-status',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const tickets = await storage.getTicketsByUser(userId);
        const stats = {
          completed: tickets.filter((t) => t.status === 'completed').length,
          cancelled: tickets.filter((t) => t.status === 'cancelled').length,
          inProgress: tickets.filter((t) => t.status === 'in-progress').length,
          pending: tickets.filter((t) => t.status === 'pending').length,
          noShow: tickets.filter((t) => t.status === 'no-show').length,
          total: tickets.length,
        };
        res.json(stats);
      } catch (error) {
        console.error('Error fetching ticket stats by status:', error);
        res
          .status(500)
          .json({ message: 'Failed to fetch ticket stats by status' });
      }
    }
  );

  app.get(
    '/api/clients/stats-by-type',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const clients = await storage.getClientsByUser(userId);
        const stats = {
          pf: clients.filter((c) => c.type === 'PF').length,
          pj: clients.filter((c) => c.type === 'PJ').length,
          empresaParceira: clients.filter((c) => c.type === 'EMPRESA_PARCEIRA')
            .length,
          total: clients.length,
        };
        res.json(stats);
      } catch (error) {
        console.error('Error fetching client stats by type:', error);
        res
          .status(500)
          .json({ message: 'Failed to fetch client stats by type' });
      }
    }
  );

  app.get('/api/financial-records', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { clientId, status, type, startDate, endDate, search, dateFilter } = req.query;
      const dateFilterValue =
        dateFilter === 'completion'
          ? 'completion'
          : dateFilter === 'payment' || dateFilter === 'due'
          ? 'payment'
          : 'payment';
      const useCompletionDate = dateFilterValue === 'completion';
      const usePaymentDate = dateFilterValue === 'payment';
      const startDateValue = startDate ? new Date(startDate) : null;
      const endDateValue = endDate ? new Date(endDate) : null;
      const hasStartDate =
        startDateValue && !Number.isNaN(startDateValue.getTime());
      const hasEndDate =
        endDateValue && !Number.isNaN(endDateValue.getTime());
      const normalizeDateKey = (value: any) => {
        if (!value) return '';
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const trimmed = String(value).trim();
        if (!trimmed) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toISOString().slice(0, 10);
      };
      const filters: any = {};
      if (clientId) filters.clientId = clientId;
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (!useCompletionDate && !usePaymentDate) {
        if (hasStartDate) filters.startDate = startDateValue;
        if (hasEndDate) filters.endDate = endDateValue;
      }

      let records = await storage.getFinancialRecordsByUser(userId, filters);
      if (records.length === 0) {
        const hasAnyRecords = await storage.getFinancialRecordsByUser(userId, {
          clientId,
          status,
          type,
        });
        if (hasAnyRecords.length === 0) {
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
        const ticketsSource =
          filters.startDate && filters.endDate
            ? await storage.getTicketsByDateRange(
                userId,
                filters.startDate,
                filters.endDate
              )
            : await storage.getTicketsByUser(userId);
        const completedTickets = ticketsSource.filter((ticket: any) => {
          const statusValue = String(
            ticket?.status || ticket?.originalStatus || ''
          ).toUpperCase();
          if (statusValue.includes('CANCEL')) return false;
          if (ticket?.completedAt || ticket?.stoppedAt) return true;
          return statusValue.includes('CONCLU') || statusValue.includes('COMPLET');
        });
        if (completedTickets.length > 0) {
          const createdRecords = [];
          for (const ticket of completedTickets) {
            if (!ticket?.clientId) continue;
            const amount = toNumber(
              ticket?.totalAmount ?? ticket?.ticketValue ?? 0
            );
            const dueDateValue =
              resolveDate(
                ticket?.paymentDate ||
                  ticket?.dueDate ||
                  ticket?.completedAt ||
                  ticket?.stoppedAt ||
                  ticket?.scheduledDate ||
                  ticket?.createdAt
              ) || new Date().toISOString();
            try {
              const record = await storage.createFinancialRecord({
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
              createdRecords.push(record);
            } catch (error) {
              console.warn(
                '[GET /api/financial-records] Failed to backfill record:',
                error
              );
            }
          }
          if (createdRecords.length > 0) {
            records = createdRecords;
          }
        }
      }
      }
      const enrichedRecords = await Promise.all(
        records.map(async (record) => {
          let ticket = null;
          let client = null;
          if (record.ticketId) {
            ticket = await storage.getTicket(record.ticketId);
          }
          if (record.clientId) {
            client = await storage.getClient(record.clientId);
          }
          const completionDate =
            ticket?.completedAt ||
            ticket?.stoppedAt ||
            ticket?.scheduledDate ||
            ticket?.createdAt ||
            record.createdAt ||
            null;
          const statusValue = String(
            ticket?.status || ticket?.originalStatus || ''
          ).toUpperCase();
          const isCompletedStatus =
            statusValue.includes('CONCLU') || statusValue.includes('COMPLET');
          if (
            ticket?.id &&
            isCompletedStatus &&
            completionDate &&
            !ticket?.completedAt &&
            !ticket?.stoppedAt
          ) {
            await storage.updateTicket(ticket.id, {
              completedAt: completionDate,
              stoppedAt: completionDate,
            });
          }
          let resolvedDueDate = record.dueDate;
          const paymentDateSource = ticket?.paymentDate || null;
          const paymentKey = normalizeDateKey(paymentDateSource);
          const recordKey = normalizeDateKey(resolvedDueDate);
          if (paymentDateSource && paymentKey && paymentKey !== recordKey) {
            const parsedPayment = new Date(paymentDateSource);
            if (!Number.isNaN(parsedPayment.getTime())) {
              const nextDueDate = parsedPayment.toISOString();
              await storage.updateFinancialRecord(record.id, {
                dueDate: nextDueDate,
              });
              resolvedDueDate = nextDueDate;
            }
          }
          const paymentDate =
            paymentDateSource || resolvedDueDate || record.createdAt || null;
          return {
            ...record,
            dueDate: resolvedDueDate,
            ticketNumber: ticket?.ticketNumber || null,
            invoiceNumber: ticket?.invoiceNumber || null,
            clientName: client?.name || 'Cliente nao encontrado',
            completionDate,
            paymentDate,
          };
        })
      );

      let filteredRecords = enrichedRecords;
      if (useCompletionDate && (hasStartDate || hasEndDate)) {
        filteredRecords = filteredRecords.filter((record) => {
          if (!record.completionDate) return false;
          const completionValue = new Date(record.completionDate);
          if (Number.isNaN(completionValue.getTime())) return false;
          if (hasStartDate && startDateValue && completionValue < startDateValue) {
            return false;
          }
          if (hasEndDate && endDateValue && completionValue > endDateValue) {
            return false;
          }
          return true;
        });
      }
      if (usePaymentDate && (hasStartDate || hasEndDate)) {
        filteredRecords = filteredRecords.filter((record) => {
          const paymentValue = record.paymentDate || record.dueDate;
          if (!paymentValue) return false;
          const parsedPayment = new Date(paymentValue);
          if (Number.isNaN(parsedPayment.getTime())) return false;
          if (hasStartDate && startDateValue && parsedPayment < startDateValue) {
            return false;
          }
          if (hasEndDate && endDateValue && parsedPayment > endDateValue) {
            return false;
          }
          return true;
        });
      }
      if (search) {
        const searchLower = String(search).toLowerCase();
        filteredRecords = filteredRecords.filter((record) => {
          const ticketNumber = record.ticketNumber?.toLowerCase() || '';
          const clientName = record.clientName?.toLowerCase() || '';
          return (
            ticketNumber.includes(searchLower) ||
            clientName.includes(searchLower)
          );
        });
      }

      filteredRecords.sort((a, b) => {
        const aPrimary = useCompletionDate
          ? a.completionDate
          : usePaymentDate
          ? a.paymentDate || a.dueDate
          : a.dueDate;
        const bPrimary = useCompletionDate
          ? b.completionDate
          : usePaymentDate
          ? b.paymentDate || b.dueDate
          : b.dueDate;
        const aDate = aPrimary ? new Date(aPrimary).getTime() : 0;
        const bDate = bPrimary ? new Date(bPrimary).getTime() : 0;
        const now = Date.now();
        const aIsOverdue =
          !useCompletionDate &&
          aDate < now &&
          (a.status === 'pending' || a.status === 'PENDENTE');
        const bIsOverdue =
          !useCompletionDate &&
          bDate < now &&
          (b.status === 'pending' || b.status === 'PENDENTE');
        if (aIsOverdue && !bIsOverdue) return -1;
        if (!aIsOverdue && bIsOverdue) return 1;
        return aDate - bDate;
      });

      res.json(filteredRecords);
    } catch (error) {
      console.error('Error fetching financial records:', error);
      res
        .status(500)
        .json({ message: 'Failed to fetch financial records' });
    }
  });

  app.get(
    '/api/financial-records/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const record = await storage.getFinancialRecord(req.params.id);
        if (!record) {
          return res
            .status(404)
            .json({ message: 'Financial record not found' });
        }
        if (record.userId !== userId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        res.json(record);
      } catch (error) {
        console.error('Error fetching financial record:', error);
        res
          .status(500)
          .json({ message: 'Failed to fetch financial record' });
      }
    }
  );

  app.post('/api/financial-records', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertFinancialRecordSchema.parse({
        ...req.body,
        userId,
      });
      const record = await storage.createFinancialRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      console.error('Error creating financial record:', error);
      if (error instanceof ZodError) {
        const message = fromZodError(error).message;
        return res.status(400).json({ message });
      }
      res
        .status(500)
        .json({ message: 'Failed to create financial record' });
    }
  });

  app.patch(
    '/api/financial-records/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const record = await storage.getFinancialRecord(req.params.id);
        if (!record) {
          return res
            .status(404)
            .json({ message: 'Financial record not found' });
        }
        if (record.userId !== userId) {
          return res.status(403).json({ message: 'Forbidden' });
        }

        const validatedData = insertFinancialRecordSchema
          .omit({ userId: true, ticketId: true })
          .partial()
          .parse(req.body);
        const updatedRecord = await storage.updateFinancialRecord(
          req.params.id,
          validatedData
        );
        res.json(updatedRecord);
      } catch (error) {
        console.error('Error updating financial record:', error);
        if (error instanceof ZodError) {
          const message = fromZodError(error).message;
          return res.status(400).json({ message });
        }
        res
          .status(500)
          .json({ message: 'Failed to update financial record' });
      }
    }
  );

  app.delete(
    '/api/financial-records/:id',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const record = await storage.getFinancialRecord(req.params.id);
        if (!record) {
          return res
            .status(404)
            .json({ message: 'Financial record not found' });
        }
        if (record.userId !== userId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        await storage.deleteFinancialRecord(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting financial record:', error);
        res
          .status(500)
          .json({ message: 'Failed to delete financial record' });
      }
    }
  );
}


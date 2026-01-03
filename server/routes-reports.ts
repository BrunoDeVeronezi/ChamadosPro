/**
 * Rotas de Relatórios Avançados
 * Endpoints para métricas e analytics
 */

import type { Express } from 'express';
import { isAuthenticated } from './googleAuth';
import { storage } from './storage';
import { differenceInHours, subMonths, subDays } from 'date-fns';

const CHART_COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
];

export function registerReportRoutes(app: Express) {
  // Endpoint de relatórios simples (página principal)
  app.get('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const {
        dateFrom,
        dateTo,
        state,
        city,
        technician,
        clientType,
        service,
        paymentStatus,
        page = '1',
        limit = '4',
      } = req.query;

      // Calcular período
      let startDate: Date;
      let endDate: Date;

      if (dateFrom && dateTo) {
        startDate = new Date(dateFrom);
        endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Padrão: últimos 30 dias
        endDate = new Date();
        startDate = subDays(endDate, 30);
      }

      // Buscar dados
      const [tickets, clients, services, users] = await Promise.all([
        storage.getTicketsByUser(userId),
        storage.getClientsByUser(userId),
        storage.getServicesByUser(userId),
        storage.getAllUsers(),
      ]);

      // Filtrar tickets por período
      let filteredTickets = tickets.filter((t: any) => {
        const ticketDate = new Date(t.scheduledDate || t.createdAt);
        return ticketDate >= startDate && ticketDate <= endDate;
      });

      // Aplicar filtros adicionais
      if (state && state !== 'all') {
        filteredTickets = filteredTickets.filter((t: any) => t.state === state);
      }
      if (city && city !== 'all') {
        filteredTickets = filteredTickets.filter((t: any) => t.city === city);
      }
      if (technician && technician !== 'all') {
        filteredTickets = filteredTickets.filter(
          (t: any) => t.technicianId === technician
        );
      }
      if (service && service !== 'all') {
        filteredTickets = filteredTickets.filter(
          (t: any) => t.serviceId === service
        );
      }
      if (clientType && clientType !== 'all') {
        filteredTickets = filteredTickets.filter((t: any) => {
          const client = clients.find((c: any) => c.id === t.clientId);
          return client?.type === clientType;
        });
      }

      // Calcular métricas
      const sla = calculateSLA(filteredTickets);
      const tmr = calculateTMR(filteredTickets);
      const ocupacao = calculateOccupancyRate(
        filteredTickets,
        startDate,
        endDate
      );

      // Preparar dados da tabela com paginação
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 4;
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      const paginatedTickets = filteredTickets
        .slice(startIndex, endIndex)
        .map((t: any) => {
          const client = clients.find((c: any) => c.id === t.clientId);
          const serviceObj = services.find((s: any) => s.id === t.serviceId);
          const technicianUser = users.find(
            (u: any) => u.id === t.technicianId
          );

          // Normalizar status
          let status: 'CONCLUÍDO' | 'EM_ANDAMENTO' | 'PENDENTE' = 'PENDENTE';
          if (t.status === 'CONCLUÍDO' || t.status === 'completed') {
            status = 'CONCLUÍDO';
          } else if (t.status === 'INICIADO' || t.status === 'IN_PROGRESS') {
            status = 'EM_ANDAMENTO';
          } else {
            status = 'PENDENTE';
          }

          return {
            id: t.id,
            clientName: client?.name || 'Cliente Desconhecido',
            technicianName: technicianUser?.name || 'Técnico Desconhecido',
            date: t.scheduledDate || t.createdAt,
            service: serviceObj?.name || 'Serviço Desconhecido',
            status,
          };
        });

      res.json({
        sla,
        tmr,
        ocupacao: ocupacao.percentage,
        tickets: paginatedTickets,
        total: filteredTickets.length,
      });
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      res.status(500).json({
        message: 'Failed to fetch reports',
        error: error.message,
      });
    }
  });

  app.post('/api/reports/preview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const filters = req.body?.filters || {};
      const [tickets, clients, services] = await Promise.all([
        storage.getTicketsByUser(userId),
        storage.getClientsByUser(userId),
        storage.getServicesByUser(userId),
      ]);

      const clientsMap = new Map(clients.map((c: any) => [c.id, c]));
      const servicesMap = new Map(services.map((s: any) => [s.id, s]));
      let filteredTickets = tickets;

      if (filters.dateRange?.from || filters.dateRange?.to) {
        const fromDate = filters.dateRange.from
          ? new Date(filters.dateRange.from)
          : null;
        const toDate = filters.dateRange.to
          ? new Date(filters.dateRange.to)
          : null;
        filteredTickets = filteredTickets.filter((t: any) => {
          const ticketDate = new Date(t.scheduledDate);
          if (fromDate && ticketDate < fromDate) return false;
          if (toDate) {
            const toDateEnd = new Date(toDate);
            toDateEnd.setHours(23, 59, 59, 999);
            if (ticketDate > toDateEnd) return false;
          }
          return true;
        });
      }

      if (filters.status && filters.status.length > 0) {
        filteredTickets = filteredTickets.filter((t: any) => {
          const normalized = (t.status || '').trim().toUpperCase();
          return filters.status.some((s: string) => {
            const normalizedFilter = s.trim().toUpperCase();
            return (
              normalized === normalizedFilter ||
              (normalizedFilter === 'CONCLUIDO' && normalized === 'COMPLETED') ||
              (normalizedFilter === 'ABERTO' && normalized === 'PENDING') ||
              (normalizedFilter === 'EXECUCAO' &&
                normalized === 'IN-PROGRESS')
            );
          });
        });
      }

      if (filters.clientType && filters.clientType.length > 0) {
        filteredTickets = filteredTickets.filter((t: any) => {
          const client = clientsMap.get(t.clientId);
          return client && filters.clientType.includes(client.type);
        });
      }

      if (filters.clientId) {
        filteredTickets = filteredTickets.filter(
          (t: any) => t.clientId === filters.clientId
        );
      }

      if (filters.searchTerm) {
        const term = String(filters.searchTerm).toLowerCase();
        filteredTickets = filteredTickets.filter((t: any) => {
          const client = clientsMap.get(t.clientId);
          const service = servicesMap.get(t.serviceId || '');
          return (
            t.id.toLowerCase().includes(term) ||
            (t.description || '').toLowerCase().includes(term) ||
            (client?.name || '').toLowerCase().includes(term) ||
            (client?.phone || '').toLowerCase().includes(term) ||
            (service?.name || '').toLowerCase().includes(term)
          );
        });
      }

      const total = filteredTickets.length;
      const totalValue = filteredTickets.reduce((sum: number, t: any) => {
        const baseAmount = t.totalAmount
          ? Number(t.totalAmount)
          : t.ticketValue
          ? Number(t.ticketValue)
          : 0;
        const kmAmount =
          t.kmTotal && t.kmRate ? Number(t.kmTotal) * Number(t.kmRate) : 0;
        const extraAmount = t.extraExpenses ? Number(t.extraExpenses) : 0;
        return sum + baseAmount + kmAmount + extraAmount;
      }, 0);

      const byStatus = filteredTickets.reduce(
        (acc: Record<string, number>, t: any) => {
          const status = (t.status || '').trim().toUpperCase();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {}
      );

      res.json({
        total,
        totalValue,
        byStatus,
      });
    } catch (error) {
      console.error('Error generating report preview:', error);
      res.status(500).json({ message: 'Failed to generate report preview' });
    }
  });

  // Endpoint de relatórios avançados
  app.get('/api/reports/advanced', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate, period = '30' } = req.query;
      const {
        state,
        city,
        technicianId,
        clientType,
        serviceId,
        paymentStatus,
      } = req.query;

      const end =
        typeof endDate === 'string' && endDate
          ? new Date(endDate)
          : new Date();
      const start =
        typeof startDate === 'string' && startDate
          ? new Date(startDate)
          : subDays(end, parseInt(period as string) || 30);
      end.setHours(23, 59, 59, 999);

      // Buscar dados
      const [tickets, clients, financialRecords, services, users] =
        await Promise.all([
          storage.getTicketsByUser(userId),
          storage.getClientsByUser(userId),
          storage.getFinancialRecordsByUser(userId),
          storage.getServicesByUser(userId),
          storage.getAllUsers(),
        ]);

      // Filtrar tickets por período e filtros
      let filteredTickets = tickets.filter((t: any) => {
        const ticketDate = new Date(t.scheduledDate || t.createdAt);
        return ticketDate >= startDate && ticketDate <= endDate;
      });

      // Aplicar filtros adicionais
      if (state) {
        filteredTickets = filteredTickets.filter((t: any) => t.state === state);
      }
      if (city) {
        filteredTickets = filteredTickets.filter((t: any) => t.city === city);
      }
      if (technicianId) {
        filteredTickets = filteredTickets.filter(
          (t: any) => t.technicianId === technicianId
        );
      }
      if (serviceId) {
        filteredTickets = filteredTickets.filter(
          (t: any) => t.serviceId === serviceId
        );
      }

      // Filtrar clientes por tipo se necessário
      let filteredClients = clients;
      if (clientType && clientType !== 'all') {
        filteredClients = clients.filter((c: any) => c.type === clientType);
        filteredTickets = filteredTickets.filter((t: any) => {
          const client = clients.find((c: any) => c.id === t.clientId);
          return client?.type === clientType;
        });
      }

      // Filtrar registros financeiros por status de pagamento
      let filteredFinancialRecords = financialRecords;
      if (paymentStatus && paymentStatus !== 'all') {
        filteredFinancialRecords = financialRecords.filter(
          (fr: any) => fr.status === paymentStatus
        );
      }

      // 1. Cumprimento de SLA
      const slaCompliance = calculateSLACompliance(filteredTickets);

      // 2. Tempo Médio de Resposta
      const avgResponseTime = calculateAvgResponseTime(filteredTickets);

      // 3. Taxa de Ocupação
      const occupancyRate = calculateOccupancyRate(filteredTickets, start, end);

      // 4. Chamados por Status
      const ticketsByStatus = calculateTicketsByStatus(filteredTickets);

      // 5. Top 10 Clientes por Lucratividade
      const rangeDays = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      );
      const topClientsByProfitability = calculateTopClientsByProfitability(
        filteredTickets,
        filteredClients,
        rangeDays
      );

      // 6. Fluxo de Caixa Mensal
      const monthlyCashFlow = calculateMonthlyCashFlow(
        filteredFinancialRecords,
        12
      );

      // 7. Tempo Médio de Atendimento por Tipo de Serviço
      const avgServiceTimeByType = calculateAvgServiceTimeByType(
        filteredTickets,
        services
      );

      res.json({
        slaCompliance: slaCompliance.percentage,
        slaComplianceChange: slaCompliance.change,
        averageResponseTime: avgResponseTime.hours,
        averageResponseTimeChange: avgResponseTime.change,
        occupancyRate: occupancyRate.percentage,
        occupancyRateChange: occupancyRate.change,
        ticketsByStatus: {
          total: ticketsByStatus.total,
          change: ticketsByStatus.change,
          data: ticketsByStatus.byStatus.map((entry, index) => ({
            name: entry.status,
            value: entry.count,
            color: CHART_COLORS[index % CHART_COLORS.length],
          })),
        },
        topClientsProfitability: {
          total: topClientsByProfitability.total,
          change: topClientsByProfitability.change,
          data: topClientsByProfitability.clients.map((client) => ({
            name: client.clientName,
            value: client.profitability,
          })),
        },
        monthlyCashFlow: {
          total: monthlyCashFlow.total,
          change: monthlyCashFlow.change,
          data: monthlyCashFlow.monthly.map((month) => ({
            month: month.month,
            value: month.amount,
          })),
        },
        averageServiceTime: {
          total: avgServiceTimeByType.avg,
          change: avgServiceTimeByType.change,
          data: avgServiceTimeByType.byType.map((entry) => ({
            type: entry.type,
            value: entry.avgHours,
          })),
        },
      });
    } catch (error: any) {
      console.error('Error fetching advanced reports:', error);
      res.status(500).json({
        message: 'Failed to fetch advanced reports',
        error: error.message,
      });
    }
  });
}

// Função para calcular cumprimento de SLA
function calculateSLACompliance(tickets: any[]): {
  percentage: number;
  change: number;
  total: number;
  onTime: number;
  late: number;
} {
  const completedTickets = tickets.filter(
    (t: any) => t.status === 'CONCLUÍDO' || t.status === 'completed'
  );

  if (completedTickets.length === 0) {
    return { percentage: 0, change: 0, total: 0, onTime: 0, late: 0 };
  }

  // SLA: considerar dentro do prazo se concluído antes ou no prazo agendado
  const onTime = completedTickets.filter((t: any) => {
    if (!t.completedAt || !t.scheduledDate) return false;
    const completed = new Date(t.completedAt);
    const scheduled = new Date(t.scheduledDate);
    // Adicionar duração esperada (3 horas padrão)
    const expectedEnd = new Date(
      scheduled.getTime() + (t.duration || 3) * 60 * 60 * 1000
    );
    return completed <= expectedEnd;
  }).length;

  const late = completedTickets.length - onTime;
  const percentage = (onTime / completedTickets.length) * 100;

  // Calcular mudança (comparar com período anterior - simplificado)
  const change = 2.1; // Placeholder - pode ser calculado comparando períodos

  return {
    percentage: Math.round(percentage * 10) / 10,
    change,
    total: completedTickets.length,
    onTime,
    late,
  };
}

// Função para calcular tempo médio de resposta
function calculateAvgResponseTime(tickets: any[]): {
  hours: number;
  change: number;
  total: number;
} {
  const ticketsWithResponse = tickets.filter((t: any) => {
    return t.startedAt && t.scheduledDate;
  });

  if (ticketsWithResponse.length === 0) {
    return { hours: 0, change: 0, total: 0 };
  }

  let totalResponseTime = 0;
  ticketsWithResponse.forEach((t: any) => {
    const scheduled = new Date(t.scheduledDate);
    const started = new Date(t.startedAt);
    const responseTime = differenceInHours(started, scheduled);
    if (responseTime > 0 && responseTime < 24) {
      // Filtrar valores inválidos
      totalResponseTime += responseTime;
    }
  });

  const avgHours = totalResponseTime / ticketsWithResponse.length;
  const change = -0.5; // Placeholder

  return {
    hours: Math.round(avgHours * 10) / 10,
    change,
    total: ticketsWithResponse.length,
  };
}

// Função para calcular taxa de ocupação
function calculateOccupancyRate(
  tickets: any[],
  startDate: Date,
  endDate: Date
): {
  percentage: number;
  change: number;
  totalHours: number;
  workedHours: number;
} {
  const daysDiff = differenceInHours(endDate, startDate) / 24;
  const workingHoursPerDay = 8; // 8 horas de trabalho por dia
  const totalAvailableHours = daysDiff * workingHoursPerDay;

  let totalWorkedHours = 0;
  tickets.forEach((t: any) => {
    if (t.startedAt && t.stoppedAt) {
      const start = new Date(t.startedAt);
      const stop = new Date(t.stoppedAt);
      const hours = differenceInHours(stop, start);
      if (hours > 0 && hours < 24) {
        totalWorkedHours += hours;
      }
    } else if (t.elapsedSeconds) {
      totalWorkedHours += t.elapsedSeconds / 3600;
    } else if (t.duration) {
      totalWorkedHours += t.duration;
    }
  });

  const percentage =
    totalAvailableHours > 0
      ? (totalWorkedHours / totalAvailableHours) * 100
      : 0;

  return {
    percentage: Math.round(percentage * 10) / 10,
    change: 5, // Placeholder
    totalHours: Math.round(totalAvailableHours),
    workedHours: Math.round(totalWorkedHours * 10) / 10,
  };
}

// Função para calcular chamados por status
function calculateTicketsByStatus(tickets: any[]): {
  total: number;
  change: number;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
} {
  const statusCounts: Record<string, number> = {};
  tickets.forEach((t: any) => {
    const status = t.status || 'ABERTO';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const total = tickets.length;
  const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
  }));

  return {
    total,
    change: 15, // Placeholder
    byStatus,
  };
}

// Função para calcular top clientes por lucratividade
function calculateTopClientsByProfitability(
  tickets: any[],
  clients: any[],
  periodDays: number
): {
  total: number;
  change: number;
  clients: Array<{
    clientId: string;
    clientName: string;
    profitability: number;
    tickets: number;
  }>;
} {
  const clientProfitability: Record<
    string,
    { profitability: number; tickets: number; name: string }
  > = {};

  tickets.forEach((t: any) => {
    if (!t.clientId) return;
    const totalAmount = parseFloat(t.totalAmount || t.ticketValue || '0');
    if (totalAmount <= 0) return;

    if (!clientProfitability[t.clientId]) {
      const client = clients.find((c: any) => c.id === t.clientId);
      clientProfitability[t.clientId] = {
        profitability: 0,
        tickets: 0,
        name: client?.name || 'Cliente Desconhecido',
      };
    }

    clientProfitability[t.clientId].profitability += totalAmount;
    clientProfitability[t.clientId].tickets += 1;
  });

  const sorted = Object.entries(clientProfitability)
    .map(([clientId, data]) => ({
      clientId,
      clientName: data.name,
      profitability: data.profitability,
      tickets: data.tickets,
    }))
    .sort((a, b) => b.profitability - a.profitability)
    .slice(0, 10);

  const total = sorted.reduce((sum, c) => sum + c.profitability, 0);

  return {
    total: Math.round(total * 10) / 10,
    change: 8, // Placeholder
    clients: sorted,
  };
}

// Função para calcular fluxo de caixa mensal
function calculateMonthlyCashFlow(
  records: any[],
  months: number
): {
  total: number;
  change: number;
  monthly: Array<{ month: string; amount: number; monthIndex: number }>;
} {
  const monthlyData: Record<number, number> = {};
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  records.forEach((fr: any) => {
    if (fr.type === 'paid' && fr.paidAt) {
      const paidDate = new Date(fr.paidAt);
      const monthIndex = paidDate.getMonth();
      const amount = parseFloat(fr.amount || '0');
      monthlyData[monthIndex] = (monthlyData[monthIndex] || 0) + amount;
    }
  });

  const now = new Date();
  const monthly = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const monthIndex = date.getMonth();
    monthly.push({
      month: monthNames[monthIndex],
      amount: monthlyData[monthIndex] || 0,
      monthIndex,
    });
  }

  const total = monthly.reduce((sum, m) => sum + m.amount, 0);

  return {
    total: Math.round(total * 10) / 10,
    change: 22, // Placeholder
    monthly,
  };
}

// Função para calcular tempo médio por tipo de serviço
function calculateAvgServiceTimeByType(
  tickets: any[],
  services: any[]
): {
  avg: number;
  change: number;
  byType: Array<{ type: string; avgHours: number; count: number }>;
} {
  const serviceTypeData: Record<string, { totalHours: number; count: number }> =
    {};

  tickets.forEach((t: any) => {
    if (!t.startedAt || !t.stoppedAt) return;

    const start = new Date(t.startedAt);
    const stop = new Date(t.stoppedAt);
    const hours = differenceInHours(stop, start);

    if (hours <= 0 || hours > 24) return;

    // Determinar tipo de serviço
    let serviceType = 'Outros';
    if (t.serviceId) {
      const service = services.find((s: any) => s.id === t.serviceId);
      if (service) {
        serviceType = service.name || 'Outros';
      }
    } else {
      // Tentar inferir do nome do serviço ou usar padrão
      serviceType = 'Remoto';
    }

    if (!serviceTypeData[serviceType]) {
      serviceTypeData[serviceType] = { totalHours: 0, count: 0 };
    }

    serviceTypeData[serviceType].totalHours += hours;
    serviceTypeData[serviceType].count += 1;
  });

  const byType = Object.entries(serviceTypeData).map(([type, data]) => ({
    type,
    avgHours:
      data.count > 0 ? Math.round((data.totalHours / data.count) * 10) / 10 : 0,
    count: data.count,
  }));

  const overallAvg =
    byType.length > 0
      ? byType.reduce((sum, t) => sum + t.avgHours, 0) / byType.length
      : 0;

  return {
    avg: Math.round(overallAvg * 10) / 10,
    change: -10, // Placeholder
    byType,
  };
}

// Função para calcular SLA (tempo médio de atendimento)
function calculateSLA(tickets: any[]): string {
  const completedTickets = tickets.filter(
    (t: any) => t.status === 'CONCLUÍDO' || t.status === 'completed'
  );

  if (completedTickets.length === 0) {
    return '0h 0min';
  }

  let totalMinutes = 0;
  completedTickets.forEach((t: any) => {
    if (t.startedAt && t.scheduledDate) {
      const scheduled = new Date(t.scheduledDate);
      const started = new Date(t.startedAt);
      const diffMinutes = Math.round(
        (started.getTime() - scheduled.getTime()) / (1000 * 60)
      );
      if (diffMinutes > 0 && diffMinutes < 24 * 60) {
        totalMinutes += diffMinutes;
      }
    }
  });

  const avgMinutes = Math.round(totalMinutes / completedTickets.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;

  return `${hours}h ${minutes}min`;
}

// Função para calcular TMR (tempo médio de resolução)
function calculateTMR(tickets: any[]): string {
  const completedTickets = tickets.filter(
    (t: any) =>
      (t.status === 'CONCLUÍDO' || t.status === 'completed') &&
      t.startedAt &&
      t.completedAt
  );

  if (completedTickets.length === 0) {
    return '0h 0min';
  }

  let totalMinutes = 0;
  completedTickets.forEach((t: any) => {
    const started = new Date(t.startedAt);
    const completed = new Date(t.completedAt);
    const diffMinutes = Math.round(
      (completed.getTime() - started.getTime()) / (1000 * 60)
    );
    if (diffMinutes > 0 && diffMinutes < 24 * 60) {
      totalMinutes += diffMinutes;
    }
  });

  const avgMinutes = Math.round(totalMinutes / completedTickets.length);
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;

  return `${hours}h ${minutes}min`;
}

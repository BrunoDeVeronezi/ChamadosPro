import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  X,
  Copy,
  Navigation,
  DollarSign,
  CheckCircle2,
  XCircle,
  Circle,
  PlayCircle,
  AlertCircle,
  MessageCircle,
  Send,
  Phone,
  Loader2,
  Mail,
  MessageSquare,
  FileText,
  FileSpreadsheet,
  Download,
  Share2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest, invalidateTicketDependentQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { useAuth } from '@/hooks/use-auth';

type TicketStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'ABERTO'
  | 'EXECUCAO'
  | 'CONCLUIDO'
  | 'CANCELLED'
  | string;

interface Ticket {
  id: string;
  scheduledFor: string;
  status: TicketStatus;
  startedAt: string;
  stoppedAt: string;
  elapsedSeconds?: number;
  description?: string;
  client: {
    id: string;
    name: string;
    type: string;
    document?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    address?: string;
    neighborhood?: string;
    legalName?: string;
    municipalRegistration?: string;
    stateRegistration?: string;
    zipCode?: string;
    streetAddress?: string;
    addressNumber?: string;
    addressComplement?: string;
    defaultTicketValue: string;
    defaultHoursIncluded: number;
    defaultAdditionalHourRate: string;
    userId: string;
  };
  service: {
    id: string;
    name: string;
    price: string | number;
  };
  ticketNumber?: string;
  finalClient?: string;
  ticketValue: number | string;
  kmTotal: number | string;
  kmRate: number | string;
  extraExpenses: number | string;
  expenseDetails: string;
  totalAmount: number | string;
  paymentDate: string | Date;
  dueDate: string | Date;
  duration: number;
  userId: string;
  clientId: string;
  serviceId: string;
  calculationsEnabled?: boolean;
  chargeType?: string;
  approvedBy?: string;
  serviceAddress?: string;
  scheduledEndDate?: string;
  scheduledEndTime?: string;
  address?: string;
  city?: string;
  state?: string;
}

interface TicketListProps {
  tickets: Ticket[];
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticket: Ticket) => void;
  onReschedule?: (ticket: Ticket) => void;
  onCheckIn: (ticket: Ticket) => void;
  onFinish: (ticket: Ticket) => void;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
  }
> = {
  pending: { label: 'Pendente', variant: 'outline' },
  'in-progress': { label: 'Em andamento', variant: 'default' },
  completed: { label: 'Concluido', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  'no-show': { label: 'Nao compareceu', variant: 'destructive' },
  ABERTO: { label: 'Aberto', variant: 'outline' },
  INICIADO: { label: 'Iniciado', variant: 'default' },
  EXECUCAO: { label: 'Iniciado', variant: 'default' }, // Compatibilidade
  CONCLUIDO: { label: 'Concluido', variant: 'secondary' }, // Compatibilidade
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' }, // Compatibilidade com status antigo
};

export function TicketList({
  tickets,
  onEdit,
  onDelete,
  onCheckIn,
  onFinish,
  onReschedule,
}: TicketListProps) {
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const { isLoading: isAuthLoading, requirePassword } = useAuth();
  const queryClient = useQueryClient();
  const { data: integrationSettings } = useQuery<{
    googleCalendarStatus?: string;
    googleCalendarEmail?: string;
    calculationsEnabled?: boolean;
    calculationsClientTypes?: string[];
  }>({
    queryKey: ['/api/integration-settings'],
  });
  const [timers, setTimers] = useState<
    Record<string, { running: boolean; start: number; elapsed: number }>
  >({});
  const [cancelConfirmTicket, setCancelConfirmTicket] = useState<Ticket | null>(
    null
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationSource, setCancellationSource] = useState<
    'CLIENTE' | 'TECNICO'
  >('CLIENTE');
  const [cancellationDescription, setCancellationDescription] = useState('');
  const [showCancelCloseConfirm, setShowCancelCloseConfirm] = useState(false);
  
  // Estados para confirmações de ações
  const [confirmStartTicket, setConfirmStartTicket] = useState<Ticket | null>(null);
  const [confirmEditTicket, setConfirmEditTicket] = useState<Ticket | null>(null);
  const [confirmFinishTicket, setConfirmFinishTicket] = useState<Ticket | null>(null);
  const [confirmDeleteTicket, setConfirmDeleteTicket] = useState<Ticket | null>(null);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showBulkDetails, setShowBulkDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const isGoogleAccount = isAuthLoading ? null : requirePassword;

  // Mutation para excluir múltiplos tickets
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ticketIds, password, email, reason, isGoogleAccount }: { ticketIds: string[]; password?: string; email?: string; reason: string; isGoogleAccount: boolean }) => {
      const payload: any = {
        ticketIds,
        reason,
      };
      
      if (isGoogleAccount) {
        payload.email = email;
      } else {
        payload.password = password;
      }
      
      try {
        const response = await apiRequest('POST', '/api/tickets/bulk-delete', payload);
        return await response.json();
      } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : '';
        if (message.startsWith('404')) {
          const results = await Promise.all(
            ticketIds.map(async (ticketId) => {
              try {
                await apiRequest('DELETE', `/api/tickets/${ticketId}`, {
                  reason,
                });
                return { ticketId, ok: true };
              } catch (deleteError: any) {
                return {
                  ticketId,
                  ok: false,
                  message:
                    deleteError?.message || 'Failed to delete ticket',
                };
              }
            })
          );

          const errors = results
            .filter((result) => !result.ok)
            .map((result) => ({
              ticketId: result.ticketId,
              message: result.message || 'Failed to delete ticket',
            }));
          const deletedCount = results.length - errors.length;
          return {
            deletedCount,
            errors,
            message:
              deletedCount > 0
                ? `${deletedCount} ticket(s) excluido(s) com sucesso.`
                : 'Nenhum ticket foi excluido.',
            fallback: true,
          };
        }
        throw error;
      }
    },
    onSuccess: async (data: any, variables) => {
      console.log('[Bulk Delete] Resposta do servidor:', data);
      const resolvedIds = Array.isArray(variables?.ticketIds)
        ? variables.ticketIds
        : [];
      
      // Verificar se realmente houve exclusões
      if (data.errors && data.errors.length > 0) {
        console.warn('[Bulk Delete] Alguns tickets não foram excluídos:', data.errors);
        toast({
          variant: 'destructive',
          title: 'Atenção',
          description: `${data.deletedCount || 0} ticket(s) excluído(s), mas ${data.errors.length} falharam.`,
        });
      }
      
      // Invalidar e refetch as queries
      await invalidateTicketDependentQueries();
      await queryClient.refetchQueries({ queryKey: ['/api/tickets'] });
      
      //   // LIMPEZA ADICIONAL: Limpar tickets excluídos do localStorage para remover o banner
      try {
        const ACTIVE_TICKETS_STORAGE_KEY = 'active_tickets_startedAt';
        const storedJson = localStorage.getItem(ACTIVE_TICKETS_STORAGE_KEY);
        if (storedJson) {
          const stored = JSON.parse(storedJson);
          let changed = false;
          resolvedIds.forEach(id => {
            if (stored[id]) {
              delete stored[id];
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem(ACTIVE_TICKETS_STORAGE_KEY, JSON.stringify(stored));
            // Disparar evento de storage para que outros componentes (como o banner) saibam da mudança
            window.dispatchEvent(new Event('storage'));
          }
        }
      } catch (e) {
        console.warn('Erro ao limpar localStorage após exclusão:', e);
      }
      
      setSelectedTickets(new Set());
      setShowDeleteConfirm(false);
      setDeleteReason('');
      setDeletePassword('');
      setDeleteEmail('');
      
      if (data.deletedCount > 0) {
        toast({
          title: 'Tickets excluídos',
          description: data.message || `${data.deletedCount} ticket(s) excluído(s) com sucesso.`,
        });
      }
    },
    onError: (error: any) => {
      console.error('Erro ao excluir tickets:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir tickets',
        description: error.message || 'Não foi possível excluir os tickets.',
      });
    },
  });

  // Buscar clientes para preencher telefone automaticamente
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Função para gerar texto do chamado para compartilhamento
  const generateTicketText = (ticket: Ticket): string => {
    const clientName = ticket.client?.name || 'N/A';
    const serviceName = ticket.service?.name || 'N/A';
    const scheduledDate = ticket.scheduledFor
      ? format(parseISO(ticket.scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : 'N/A';
    const address = (() => {
      const isEmpresaParceira = ticket.client?.type === 'EMPRESA_PARCEIRA';
      if (isEmpresaParceira) {
        return (ticket as any).serviceAddress || 'Endereço não informado';
      } else {
        const addr = (ticket as any).address || '';
        const city = (ticket as any).city || '';
        const state = (ticket as any).state || '';
        if (addr && (city || state)) {
          return [addr, city, state].filter(Boolean).join(', ');
        }
        return addr || 'Endereço não informado';
      }
    })();
    const total = typeof ticket.totalAmount === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.totalAmount)
      : ticket.totalAmount || 'R$ 0,00';

    return `*Detalhes do Chamado #${(ticket as any).ticketNumber || ticket.id?.slice(0, 8)}*

*Cliente:* ${clientName}
*Serviço:* ${serviceName}
*Data/Hora:* ${scheduledDate}
*Endereço:* ${address}
*Total:* ${total}
*Status:* ${statusConfig[ticket.status]?.label || ticket.status}`;
  };

  // Função para exportar PDF
  const handleExportPDF = async () => {
    if (!viewTicket) return;
    
    try {
      // Criar conteúdo HTML do PDF
      const ticketText = generateTicketText(viewTicket);
      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              .info { margin: 10px 0; }
              .label { font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Chamado #${(viewTicket as any).ticketNumber || viewTicket.id?.slice(0, 8)}</h1>
            ${ticketText.split('\n').map(line => `<div class="info">${line.replace(/\*/g, '')}</div>`).join('')}
          </body>
        </html>
      `;
      
      // Abrir em nova janela para impressão
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
      
      toast({
        title: 'PDF gerado',
        description: 'Use a opção de salvar como PDF na janela de impressão.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o PDF.',
      });
    }
  };

  // Função para exportar Excel
  const handleExportExcel = () => {
    if (!viewTicket) return;
    
    try {
      const ticketText = generateTicketText(viewTicket);
      const csvContent = ticketText.replace(/\*/g, '').replace(/\n/g, '\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `chamado-${(viewTicket as any).ticketNumber || viewTicket.id?.slice(0, 8)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Excel exportado',
        description: 'O arquivo foi baixado com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao exportar Excel',
        description: 'Não foi possível exportar o arquivo.',
      });
    }
  };

  // Função para enviar por email
  const handleSendEmail = async () => {
    if (!viewTicket || !emailAddress.trim()) return;
    
    setIsSendingEmail(true);
    try {
      const ticketText = generateTicketText(viewTicket);
      // Aqui você pode chamar uma API para enviar o email
      // Por enquanto, vamos apenas mostrar uma mensagem
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular envio
      
      toast({
        title: 'Email enviado',
        description: `O chamado foi enviado para ${emailAddress}`,
      });
      
      setShowEmailDialog(false);
      setEmailAddress('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar email',
        description: 'Não foi possível enviar o email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Função para compartilhar via WhatsApp
  const handleShareWhatsApp = (number?: string) => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!viewTicket) return;
    
    const phoneNumber = number || whatsappNumber.replace(/\D/g, '');
    if (!phoneNumber) {
      toast({
        variant: 'destructive',
        title: 'Número inválido',
        description: 'Por favor, informe um número de WhatsApp válido.',
      });
      return;
    }
    
    const ticketText = generateTicketText(viewTicket);
    const encodedText = encodeURIComponent(ticketText);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
    
    if (number) {
      toast({
        title: 'WhatsApp aberto',
        description: 'O WhatsApp foi aberto com o contato selecionado.',
      });
    } else {
      setShowWhatsAppDialog(false);
      setWhatsappNumber('');
      toast({
        title: 'WhatsApp aberto',
        description: 'O WhatsApp foi aberto com o número informado.',
      });
    }
  };


  // Buscar registros financeiros relacionados aos tickets
  const { data: financialRecords = [] } = useQuery<any[]>({
    queryKey: ['/api/financial-records'],
  });

  // Verificar status de conexão do Google Calendar
  const isGoogleCalendarConnected =
    integrationSettings?.googleCalendarStatus === 'connected';

  // Criar mapa de registros financeiros por ticketId
  const financialRecordsByTicketId = useMemo(() => {
    const map = new Map<string, any>();
    financialRecords.forEach((record: any) => {
      if (record.ticketId) {
        map.set(record.ticketId, record);
      }
    });
    return map;
  }, [financialRecords]);


  const markStatus = (id: string, status: string) => {
    queryClient.setQueryData(['/api/tickets'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((t) => (t.id === id ? { ...t, status } : t));
    });
  };

  const markTicketInExecution = (id: string) => markStatus(id, 'INICIADO');
  const markTicketCancelled = (id: string) => markStatus(id, 'CANCELADO');

  const normalizeStatus = (status: string) => {
    const upper = status.trim().toUpperCase();
    if (!upper) return 'ABERTO';
    const map: Record<string, string> = {
      PENDING: 'ABERTO',
      PENDENTE: 'ABERTO',
      'IN-PROGRESS': 'INICIADO',
      IN_PROGRESS: 'INICIADO',
      EXECUCAO: 'INICIADO', // Compatibilidade com status antigo
  CONCLUIDO: { label: 'Concluido', variant: 'secondary' }, // Compatibilidade
      CANCELADO: 'CANCELADO',
      CANCELLED: 'CANCELADO', // Compatibilidade com status antigo
      'NO-SHOW': 'NO_SHOW',
      NO_SHOW: 'NO_SHOW',
    };
    return map[upper] || upper;
  };

  const ensureCheckIn = async (ticket: Ticket) => {
    // permite reusar o startedAt existente ou abrir novo
    const startedAt = (ticket as any).startedAt || new Date().toISOString();

    // Salvar no localStorage IMEDIATAMENTE para garantir que o banner aparece
    try {
      const stored = JSON.parse(
        localStorage.getItem('active_tickets_startedAt') || '{}'
      );
      stored[ticket.id] = startedAt;
      localStorage.setItem('active_tickets_startedAt', JSON.stringify(stored));
    } catch (err) {
      console.warn('Erro ao salvar startedAt no localStorage:', err);
    }

    try {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticket.id}/check-in`,
        {}
      );
      const updatedTicket = (await response.json()) as any;

      console.log('[ensureCheckIn]   Resposta do check-in:', {
        ticketId: ticket.id,
        updatedTicket,
        startedAt: updatedTicket.startedAt,
        started_at: updatedTicket.started_at,
        status: updatedTicket.status,
      });

      // Capturar startedAt da resposta ANTES de invalidar queries
      // Verificar ambos os formatos (camelCase e snake_case)
      const responseStartedAt =
        updatedTicket.startedAt || updatedTicket.started_at;
      console.log('[ensureCheckIn] 📝 startedAt capturado:', {
        ticketId: ticket.id,
        startedAt: responseStartedAt,
        updatedTicketKeys: Object.keys(updatedTicket),
        updatedTicket,
      });

      if (responseStartedAt) {
        // Atualizar localStorage com startedAt do backend
        try {
          const stored = JSON.parse(
            localStorage.getItem('active_tickets_startedAt') || '{}'
          );
          stored[ticket.id] = responseStartedAt;
          localStorage.setItem(
            'active_tickets_startedAt',
            JSON.stringify(stored)
          );
        } catch (err) {
          console.warn('Erro ao salvar startedAt no localStorage:', err);
        }

        // Atualizar cache imediatamente com startedAt antes de invalidar
        queryClient.setQueryData(['/api/tickets'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => {
            if (t.id === ticket.id) {
              return {
                ...t,
                status: 'INICIADO',
                startedAt: responseStartedAt,
              };
            }
            return t;
          });
        });

        // Atualizar o timer com o startedAt do backend
        const backendStartTime = new Date(responseStartedAt).getTime();
        setTimers((prev) => {
          const current = prev[ticket.id];
          if (current) {
            return {
              ...prev,
              [ticket.id]: {
                ...current,
                start: backendStartTime,
                elapsed: Date.now() - backendStartTime,
              },
            };
          }
          return prev;
        });
        console.log(
          '[ensureCheckIn] ⏱️ Timer atualizado com startedAt do backend:',
          {
            ticketId: ticket.id,
            startedAt: responseStartedAt,
            backendStartTime,
            elapsed: Date.now() - backendStartTime,
          }
        );
      }

      markTicketInExecution(ticket.id);
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      return true;
    } catch (err: any) {
      // Se erro 404, o ticket pode no existir mais no backend - manter no localStorage mesmo assim
      // para o banner aparecer (ser limpo quando detectar que foi finalizado)
      if (err.message.includes('404')) {
        console.warn(
          'Ticket no encontrado no backend (404), mas mantendo no localStorage para o banner:',
          ticket.id
        );

        // Atualizar cache local mesmo assim
        queryClient.setQueryData(['/api/tickets'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => {
            if (t.id === ticket.id) {
              return {
                ...t,
                status: 'INICIADO',
                startedAt: startedAt,
              };
            }
            return t;
          });
        });

        // Retornar true mesmo com erro 404 para no bloquear o timer
        return true;
      }

      // força status execução se o check-in não for permitido
      try {
        const response = await apiRequest('PUT', `/api/tickets/${ticket.id}`, {
          userId: (ticket as any).userId,
          status: 'EXECUCAO',
          startedAt,
        });
        const updatedTicket = (await response.json()) as any;
        const responseStartedAt = updatedTicket.startedAt || startedAt;

        // Atualizar localStorage com startedAt
        try {
          const stored = JSON.parse(
            localStorage.getItem('active_tickets_startedAt') || '{}'
          );
          stored[ticket.id] = responseStartedAt;
          localStorage.setItem(
            'active_tickets_startedAt',
            JSON.stringify(stored)
          );
        } catch (storageErr) {
          console.warn('Erro ao salvar startedAt no localStorage:', storageErr);
        }

        // Atualizar cache imediatamente com startedAt
        queryClient.setQueryData(['/api/tickets'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => {
            if (t.id === ticket.id) {
              return {
                ...t,
                status: 'INICIADO',
                startedAt: responseStartedAt,
              };
            }
            return t;
          });
        });

        markTicketInExecution(ticket.id);
        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        return true;
      } catch (putErr) {
        console.error('Falha ao forar check-in', putErr);
        // Mesmo com erro, retornar true para manter o timer rodando e o banner aparecendo
        return true;
      }
    }
  };

  // Sincroniza timers com tickets em execução
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    setTimers((prev) => {
      const next = { ...prev };

      // Verificar localStorage para tickets em execução
      let storedStartedAt: Record<string, string> = {};
      try {
        storedStartedAt = JSON.parse(
          localStorage.getItem('active_tickets_startedAt') || '{}'
        );
      } catch (err) {
        console.warn('Erro ao ler localStorage:', err);
      }

      tickets.forEach((ticket) => {
        const status = normalizeStatus((ticket.status || '').toString());
        const startedAt = (ticket as any).startedAt;
        const ticketId = ticket.id;

        //   // CORREÇÃO: Verificar se o ticket está finalizado ANTES de verificar se está em execução
        const isFinished =
          status === 'CONCLUIDO' ||
          status === 'COMPLETED' ||
          status === 'CANCELADO' ||
          status === 'CANCELLED';

        // Se o ticket está finalizado, remover o timer e não criar um novo
        if (isFinished) {
          delete next[ticketId];
          // Limpar do localStorage também
          if (storedStartedAt[ticketId]) {
            delete storedStartedAt[ticketId];
            try {
              localStorage.setItem(
                'active_tickets_startedAt',
                JSON.stringify(storedStartedAt)
              );
            } catch (err) {
              console.warn('Erro ao limpar startedAt do localStorage:', err);
            }
          }
          // Não processar mais este ticket - pular para o próximo
          return;
        }

        // Verificar se ticket está em execução (status INICIADO ou tem startedAt no localStorage)
        const hasStartedAtInStorage = !!storedStartedAt[ticketId];
        const hasStartedAtInBackend = !!startedAt;
        const isInExecution =
          status === 'INICIADO' ||
          status === 'EXECUCAO' || // Compatibilidade com status antigo
          hasStartedAtInStorage ||
          hasStartedAtInBackend;

        if (isInExecution) {
          // Priorizar startedAt do backend, senão usar do localStorage, senão usar do timer existente
          let startTime: number;
          if (startedAt) {
            // Converter startedAt para Date e depois para timestamp
            const startedAtDate =
              startedAt instanceof Date ? startedAt : new Date(startedAt);
            const backendStartTime = startedAtDate.getTime();
            if (!isNaN(backendStartTime) && backendStartTime > 0) {
              startTime = backendStartTime;
            } else if (storedStartedAt[ticketId]) {
              const storageStartTime = new Date(
                storedStartedAt[ticketId]
              ).getTime();
              startTime =
                !isNaN(storageStartTime) && storageStartTime > 0
                  ? storageStartTime
                  : prev[ticketId]?.start || Date.now();
            } else {
              startTime = prev[ticketId]?.start || Date.now();
            }
          } else if (storedStartedAt[ticketId]) {
            const storageStartTime = new Date(
              storedStartedAt[ticketId]
            ).getTime();
            startTime =
              !isNaN(storageStartTime) && storageStartTime > 0
                ? storageStartTime
                : prev[ticketId]?.start || Date.now();
          } else {
            // Se não tem startedAt mas está em execução, usar horário atual ou manter timer existente
            startTime = prev[ticketId]?.start || Date.now();
          }

          // Garantir que o timer está rodando e calcular elapsed corretamente
          const elapsed = Math.max(0, Date.now() - startTime);
          const newTimer = { running: true, start: startTime, elapsed };
          next[ticketId] = newTimer;
        }
        // Preservar timers existentes que não estão mais em execução (para não perder o estado visual)
        // Apenas remover se o ticket foi concluído ou cancelado
        else if (
          status === 'CONCLUIDO' ||
          status === 'CANCELADO' ||
          status === 'CANCELLED' ||
          status === 'COMPLETED'
        ) {
          // Remover timer de tickets concluídos/cancelados
          delete next[ticketId];
        }
        // Se o ticket não está em execução mas tinha um timer, preservar o timer (pode estar em transição)
        else if (prev[ticketId] && prev[ticketId].running) {
          // Manter o timer rodando até que seja explicitamente parado
          next[ticketId] = prev[ticketId];
        }
      });
      return next;
    });
  }, [tickets]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let hasUpdates = false;
        Object.entries(prev).forEach(([id, timer]) => {
          if (timer?.running) {
            //   // CORREÇÃO: Verificar se o ticket está finalizado antes de atualizar o timer
            const ticket = tickets.find((t) => t.id === id);
            if (ticket) {
              const status = normalizeStatus((ticket.status || '').toString());
              const isFinished =
                status === 'CONCLUIDO' ||
                status === 'COMPLETED' ||
                status === 'CANCELADO' ||
                status === 'CANCELLED';

              // Se o ticket está finalizado, parar o timer e removê-lo
              if (isFinished) {
                delete next[id];
                console.log(
                  '[TimerInterval] ⏱️ Timer removido (ticket finalizado):',
                  {
                    ticketId: id,
                    status,
                  }
                );
                return;
              }
            }

            // Apenas atualizar se não estiver finalizado
            const elapsed = now - timer.start;
            next[id] = { ...timer, elapsed };
            hasUpdates = true;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tickets]);

  const formatElapsed = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((total % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startTimer = async (ticket: Ticket) => {
    // Inicia o cronmetro imediatamente para feedback visual
    const now = Date.now();
    const startedAt = new Date().toISOString();

    // Salvar no localStorage IMEDIATAMENTE para garantir que o banner aparece
    try {
      const stored = JSON.parse(
        localStorage.getItem('active_tickets_startedAt') || '{}'
      );
      stored[ticket.id] = startedAt;
      localStorage.setItem('active_tickets_startedAt', JSON.stringify(stored));
    } catch (err) {
      console.warn('Erro ao salvar startedAt no localStorage:', err);
    }

    setTimers((prev) => {
      const newTimer = { running: true, start: now, elapsed: 0 };
      const updated = {
        ...prev,
        [ticket.id]: newTimer,
      };
      return updated;
    });
    markTicketInExecution(ticket.id);

    // Sincroniza com backend, mas no derruba o timer em caso de erro
    ensureCheckIn(ticket)
      .then((ok) => {
        if (ok) {
          queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        }
        // No mostrar erro se o check-in falhar - o timer j est rodando e o banner j apareceu
      })
      .catch((err) => {
        console.warn('[startTimer] ⚠️ Erro ao fazer check-in:', err);
        // No mostrar erro - o timer j est rodando localmente
      });
  };

  const ensureExecutionBeforeComplete = async (ticket: Ticket) => {
    let currentTicket = ticket;
    let status = normalizeStatus((currentTicket.status || '').toString());

    // Se já está em INICIADO, verificar se tem startedAt
    if (status === 'INICIADO' || status === 'EXECUCAO') {
      if (!(currentTicket as any).startedAt) {
        try {
          const response = await apiRequest(
            'POST',
            `/api/tickets/${currentTicket.id}/check-in`,
            {}
          );
          const updatedTicket = (await response.json()) as any;
          if (updatedTicket.startedAt) {
            queryClient.setQueryData(['/api/tickets'], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((t) => {
                if (t.id === currentTicket.id) {
                  return { ...t, startedAt: updatedTicket.startedAt };
                }
                return t;
              });
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          console.warn('Não foi possível fazer check-in:', err);
        }
      }
      return;
    }

    // Se est ABERTO, fazer check-in
    if (status === 'ABERTO') {
      try {
        const response = await apiRequest(
          'POST',
          `/api/tickets/${currentTicket.id}/check-in`,
          {}
        );
        const updatedTicket = (await response.json()) as any;

        if (updatedTicket) {
          // Salvar startedAt no localStorage
          if (updatedTicket.startedAt) {
            try {
              const stored = JSON.parse(
                localStorage.getItem('active_tickets_startedAt') || '{}'
              );
              stored[currentTicket.id] = updatedTicket.startedAt;
              localStorage.setItem(
                'active_tickets_startedAt',
                JSON.stringify(stored)
              );
            } catch (err) {
              console.warn('Erro ao salvar startedAt no localStorage:', err);
            }
          }

          // Atualizar cache local imediatamente
          queryClient.setQueryData(['/api/tickets'], (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((t) => {
              if (t.id === currentTicket.id) {
                return {
                  ...t,
                  status: updatedTicket.status || 'INICIADO',
                  startedAt:
                    updatedTicket.startedAt || new Date().toISOString(),
                };
              }
              return t;
            });
          });

          markTicketInExecution(currentTicket.id);
          queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

          // Aguardar e recarregar ticket do cache para verificar status
          await new Promise((resolve) => setTimeout(resolve, 400));

          const refreshedTickets = queryClient.getQueryData<Ticket[]>([
            '/api/tickets',
          ]);
          const refreshedTicket = refreshedTickets.find(
            (t) => t.id === currentTicket.id
          );
          if (refreshedTicket) {
            currentTicket = refreshedTicket;
            status = normalizeStatus((currentTicket.status || '').toString());

            // Se agora está em INICIADO, retornar
            if (status === 'INICIADO' || status === 'EXECUCAO') {
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao fazer check-in:', err);
        // Continuar para tentar forar status via PUT
      }
    }

    // Se ainda não está em INICIADO, forçar via PUT
    if (status !== 'INICIADO' && status !== 'EXECUCAO') {
      try {
        const startedAt =
          (currentTicket as any).startedAt || new Date().toISOString();
        const response = await apiRequest(
          'PUT',
          `/api/tickets/${currentTicket.id}`,
          {
            userId: (currentTicket as any).userId,
            status: 'INICIADO',
            startedAt: startedAt,
          }
        );
        const updatedTicket = (await response.json()) as any;

        // Salvar startedAt no localStorage
        if (updatedTicket.startedAt) {
          try {
            const stored = JSON.parse(
              localStorage.getItem('active_tickets_startedAt') || '{}'
            );
            stored[currentTicket.id] = updatedTicket.startedAt;
            localStorage.setItem(
              'active_tickets_startedAt',
              JSON.stringify(stored)
            );
          } catch (err) {
            console.warn('Erro ao salvar startedAt no localStorage:', err);
          }
        }

        // Atualizar cache local imediatamente
        queryClient.setQueryData(['/api/tickets'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => {
            if (t.id === currentTicket.id) {
              return {
                ...t,
                status: 'INICIADO',
                startedAt: updatedTicket.startedAt || startedAt,
              };
            }
            return t;
          });
        });

        markTicketInExecution(currentTicket.id);
        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

        // Aguardar para garantir que o status foi atualizado
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Verificar status final antes de retornar
        const finalTickets = queryClient.getQueryData<Ticket[]>([
          '/api/tickets',
        ]);
        const finalTicket = finalTickets.find((t) => t.id === currentTicket.id);
        if (finalTicket) {
          const finalStatus = normalizeStatus(
            (finalTicket.status || '').toString()
          );
          if (finalStatus !== 'INICIADO' && finalStatus !== 'EXECUCAO') {
            throw new Error(
              'Não foi possível iniciar o chamado. O status não foi atualizado para INICIADO.'
            );
          }
        }
      } catch (err: any) {
        console.warn(
          'Não foi possível forçar EXECUCAO antes de finalizar',
          err
        );
        throw new Error(
          err.message ||
            'Não foi possível iniciar o chamado para finalizar. Tente novamente.'
        );
      }
    }
  };

  const completeTicket = async (
    ticket: Ticket,
    extraExpenses: number,
    expenseDetails: string,
    elapsedMs: number
  ) => {
    try {
      // Não é mais obrigatório ter iniciado o cronômetro
      // Se não tiver startedAt, será definido como horário de chegada no backend

      // Verificar se tem clientId (necessrio para criar registro financeiro)
      if (!ticket.clientId) {
        throw new Error(
          'O chamado no possui cliente associado. Edite o chamado e associe um cliente antes de finalizar.'
        );
      }

      // Aguardar um pouco mais para garantir que o backend processou a atualizao
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Buscar ticket atualizado do cache antes de finalizar
      let ticketToComplete = ticket;
      const updatedTickets = queryClient.getQueryData<Ticket[]>([
        '/api/tickets',
      ]);
      if (updatedTickets) {
        const found = updatedTickets.find((t) => t.id === ticket.id);
        if (found) {
          ticketToComplete = found;
        }
      }

      // Verificar status final antes de finalizar - buscar do backend diretamente
      let finalTicketToComplete = ticketToComplete;
      try {
        // Buscar ticket diretamente do backend para garantir status atualizado
        const ticketResponse = await fetch(`/api/tickets/${ticket.id}`, {
          credentials: 'include',
        });
        if (ticketResponse.ok) {
          const backendTicket = (await ticketResponse.json()) as any;
          finalTicketToComplete = backendTicket as Ticket;
        }
      } catch (fetchErr) {
        console.warn('Não foi possível buscar ticket do backend:', fetchErr);
      }

      // Verificar status final
      const finalStatus = normalizeStatus(
        (finalTicketToComplete.status || '').toString()
      );
      if (finalStatus !== 'INICIADO' && finalStatus !== 'EXECUCAO') {
        // Se ainda não está em INICIADO, tentar fazer check-in novamente diretamente
        try {
          console.log(
            '[CompleteTicket] Status não é INICIADO, forçando check-in. Status atual:',
            finalStatus
          );
          const checkInResponse = await apiRequest(
            'POST',
            `/api/tickets/${ticket.id}/check-in`,
            {}
          );
          const checkInTicket = (await checkInResponse.json()) as any;

          console.log('[CompleteTicket] Resposta do check-in:', {
            status: checkInTicket.status,
            hasStartedAt: !!checkInTicket.startedAt,
          });

          if (
            checkInTicket &&
            (checkInTicket.status === 'INICIADO' ||
              checkInTicket.status === 'EXECUCAO')
          ) {
            finalTicketToComplete = checkInTicket as Ticket;
          } else {
            // Forar via PUT como ltimo recurso
            console.log('[CompleteTicket] Forando status via PUT');
            const putResponse = await apiRequest(
              'PUT',
              `/api/tickets/${ticket.id}`,
              {
                userId: (ticket as any).userId,
                status: 'INICIADO',
                startedAt:
                  (ticket as any).startedAt ||
                  checkInTicket.startedAt ||
                  new Date().toISOString(),
              }
            );
            const putTicket = (await putResponse.json()) as any;
            if (putTicket) {
              finalTicketToComplete = putTicket as Ticket;
            }
          }

          // Aguardar mais um pouco aps forar e verificar novamente
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Verificar novamente do backend
          try {
            const verifyResponse = await fetch(`/api/tickets/${ticket.id}`, {
              credentials: 'include',
            });
            if (verifyResponse.ok) {
              const verifiedTicket = (await verifyResponse.json()) as any;
              const verifiedStatus = normalizeStatus(
                (verifiedTicket.status || '').toString()
              );
              if (
                verifiedStatus === 'INICIADO' ||
                verifiedStatus === 'EXECUCAO'
              ) {
                finalTicketToComplete = verifiedTicket as Ticket;
              } else {
                console.error(
                  '[CompleteTicket] Status ainda não é INICIADO após forçar. Status:',
                  verifiedStatus
                );
                throw new Error(
                  'O chamado precisa estar em execução para ser finalizado. Tente iniciar o chamado primeiro.'
                );
              }
            }
          } catch (verifyErr) {
            console.warn(
              'Não foi possível verificar status do backend:',
              verifyErr
            );
          }
        } catch (forceErr: any) {
          console.error('Não foi possível forçar status EXECUCAO:', forceErr);
          throw new Error(
            forceErr.message ||
              'O chamado precisa estar em execução para ser finalizado. Tente iniciar o chamado primeiro.'
          );
        }
      }

      const elapsedSeconds = elapsedMs
        ? Math.round(elapsedMs / 1000)
        : undefined;

      // Se não tiver startedAt, usar horário atual como horário de chegada
      const arrivalTime = (ticket as any).startedAt || new Date().toISOString();

      await apiRequest('POST', `/api/tickets/${ticket.id}/complete`, {
        kmTotal: 0,
        extraExpenses,
        expenseDetails,
        elapsedSeconds,
        arrivalTime, // Horário de chegada (usado se não tiver startedAt)
      });

      // Limpar do localStorage se estiver l (para o banner desaparecer)
      try {
        const stored = JSON.parse(
          localStorage.getItem('active_tickets_startedAt') || '{}'
        );
        if (stored[ticket.id]) {
          delete stored[ticket.id];
          localStorage.setItem(
            'active_tickets_startedAt',
            JSON.stringify(stored)
          );
        }
      } catch (err) {
        console.warn('Erro ao limpar ticket do localStorage:', err);
      }

      // Atualizar cache local imediatamente para marcar como concludo
      queryClient.setQueryData(['/api/tickets'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) => {
          if (t.id === ticket.id) {
            return {
              ...t,
              stoppedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            };
          }
          return t;
        });
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      markTicketCompleted(ticket.id);
    } catch (error: any) {
      console.error('Erro ao finalizar ticket:', error);
      throw error;
    }
  };

  const confirmFinish = async () => {
    if (!finishModal) return;
    const ticket = finishModal.ticket;
    const extraExpenses = Number(extraCost) || 0;
    const totalAmount = finishModal.totalBase + extraExpenses;
    const elapsedMs = finishModal.elapsedMs;

    try {
      // Verificar se tem clientId antes de finalizar
      if (!ticket.clientId) {
        toast({
          variant: 'destructive',
          title: 'Erro ao finalizar',
          description:
            'O chamado no possui cliente associado. Edite o chamado e associe um cliente antes de finalizar.',
        });
        return;
      }

      await completeTicket(ticket, extraExpenses, extraDesc, elapsedMs);

      // Atualizar ticket com informaes extras (horas extras, valor total)
      try {
        await apiRequest('PUT', `/api/tickets/${ticket.id}`, {
          extraHours: finishModal.extraHours.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          stoppedAt: new Date().toISOString(),
          elapsedSeconds: Math.round(elapsedMs / 1000),
        });
      } catch (updateErr) {
        console.warn(
          'Não foi possível atualizar informações extras do ticket:',
          updateErr
        );
        // No bloquear a finalizao por causa disso
      }

      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setTimers((prev) => ({
        ...prev,
        [ticket.id]: { running: false, start: 0, elapsed: elapsedMs },
      }));
      markTicketCompleted(ticket.id);

      toast({
        title: 'Chamado finalizado',
        description: 'O chamado foi concludo com sucesso.',
      });
    } catch (error: any) {
      console.error('Falha ao finalizar chamado', error);

      // Extrair mensagem de erro
      let errorMessage =
        'Não foi possível finalizar o chamado. Tente novamente.';
      if (error.message) {
        if (error.message.includes('400:')) {
          try {
            const errorText = error.message.split('400:')[1];
            if (errorText) {
              const errorObj = JSON.parse(errorText);
              errorMessage = errorObj.message || errorMessage;
            }
          } catch {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar',
        description: errorMessage,
      });
    } finally {
      setFinishModal(null);
      setExtraCost('');
      setExtraDesc('');
    }
  };

  const cancelTicket = async (ticket: Ticket) => {
    try {
      setIsCancelling(true);
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticket.id}/cancel`,
        {
          cancellationSource: cancellationSource,
          cancellationReason:
            cancellationDescription ||
            `Cancelado pelo ${
              cancellationSource === 'CLIENTE' ? 'cliente' : 'técnico'
            }`,
        }
      );

      // Parar o timer se estiver rodando
      setTimers((prev) => ({
        ...prev,
        [ticket.id]: {
          running: false,
          start: 0,
          elapsed: prev[ticket.id]?.elapsed || 0,
        },
      }));

      // Invalidar queries para buscar dados atualizados do servidor
      await queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      await queryClient.invalidateQueries({
        queryKey: ['/api/dashboard/stats'],
      });

      // Atualizar o cache local com o ticket cancelado retornado pelo servidor
      if (response) {
        queryClient.setQueryData(['/api/tickets'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) =>
            t.id === ticket.id ? { ...t, ...response, status: 'CANCELADO' } : t
          );
        });
      }

      toast({
        title: 'Chamado cancelado',
        description: 'O chamado foi marcado como cancelado.',
      });

      // Limpar campos do formulário
      setCancellationSource('CLIENTE');
      setCancellationDescription('');
    } catch (error) {
      console.error('[TicketList] Erro ao cancelar ticket:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o chamado. Tente novamente.',
      });
    } finally {
      setIsCancelling(false);
      setCancelConfirmTicket(null);
    }
  };

  if (tickets.length === 0) {
    return (
      <Card className='p-12'>
        <div className='text-center'>
          <Calendar className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold mb-2'>
            Nenhum chamado encontrado
          </h3>
          <p className='text-sm text-muted-foreground'>
            Crie um novo chamado para comear
          </p>
        </div>
      </Card>
    );
  }

  const formatScheduledTime = (scheduledFor: string) => {
    if (!scheduledFor) return { date: 'Data no definida', time: '' };
    try {
      const date = parseISO(scheduledFor);
      return {
        date: format(date, 'PPP', { locale: ptBR }),
        time: format(date, 'HH:mm', { locale: ptBR }),
      };
    } catch {
      return { date: 'Data invlida', time: '' };
    }
  };

  // Ordenar tickets: concluídos e cancelados no final, outros por data/hora (mais próximo primeiro)
  const sortedTickets = [...tickets].sort((a, b) => {
    const aStatus = normalizeStatus((a.status || '').toString());
    const bStatus = normalizeStatus((b.status || '').toString());
    const aIsCompleted =
      aStatus === 'CONCLUIDO' ||
      aStatus === 'completed';
    const bIsCompleted =
      bStatus === 'CONCLUIDO' ||
      bStatus === 'completed';
    const aIsCancelled =
      aStatus === 'CANCELADO' ||
      aStatus === 'CANCELLED' ||
      aStatus === 'cancelled';
    const bIsCancelled =
      bStatus === 'CANCELADO' ||
      bStatus === 'CANCELLED' ||
      bStatus === 'cancelled';
    const aIsFinished = aIsCompleted || aIsCancelled;
    const bIsFinished = bIsCompleted || bIsCancelled;

    if (aIsFinished && bIsFinished) {
      // Priorizar completedAt/stoppedAt para concluídos, ou updatedAt para cancelados
      const aFinishedAt =
        (a as any).completedAt || (a as any).stoppedAt || (a as any).updatedAt;
      const bFinishedAt =
        (b as any).completedAt || (b as any).stoppedAt || (b as any).updatedAt;

      const aDate = aFinishedAt
        ? new Date(aFinishedAt).getTime()
        : a.scheduledFor
        ? new Date(a.scheduledFor).getTime()
        : 0;
      const bDate = bFinishedAt
        ? new Date(bFinishedAt).getTime()
        : b.scheduledFor
        ? new Date(b.scheduledFor).getTime()
        : 0;

      return bDate - aDate; // Mais recente primeiro (mais recente no topo)
    }

    // Se ambos não são finalizados, ordenar por data/hora agendada (mais próximo primeiro)
    if (!aIsFinished && !bIsFinished) {
      const aDate = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
      const bDate = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
      return aDate - bDate; // Mais próximo primeiro
    }

    // Finalizados (concluídos ou cancelados) sempre no final
    return aIsFinished ? 1 : -1;
  });

  // Funções para seleção
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === sortedTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(sortedTickets.map((t) => t.id)));
    }
  };

  const selectedTicketsList = useMemo(() => {
    return sortedTickets.filter((t) => selectedTickets.has(t.id));
  }, [sortedTickets, selectedTickets]);

  return (
    <>
      {/* Barra de seleção e ações em lote */}
      {sortedTickets.length > 0 && (
        <div className='flex items-center justify-between mb-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Checkbox
                checked={selectedTickets.size === sortedTickets.length && sortedTickets.length > 0}
                onCheckedChange={toggleSelectAll}
                id='select-all'
              />
              <Label htmlFor='select-all' className='cursor-pointer'>
                Selecionar todos ({selectedTickets.size} selecionados)
              </Label>
            </div>
          </div>
          {selectedTickets.size > 0 && (
            <div className='flex items-center gap-2'>
              <Button
                variant='destructive'
                onClick={() => {
                  setDeleteReason('');
                  setDeletePassword('');
                  setDeleteEmail('');
                  setShowDeleteConfirm(true);
                }}
                className='flex items-center gap-2'
              >
                <Trash2 className='h-4 w-4' />
                Excluir ({selectedTickets.size})
              </Button>
              <Button
                onClick={() => setShowBulkDetails(true)}
                className='flex items-center gap-2'
              >
                <FileText className='h-4 w-4' />
                Ver Detalhes ({selectedTickets.size})
              </Button>
            </div>
          )}
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-8'>
        {sortedTickets.map((ticket) => {
          const normalized = normalizeStatus((ticket.status || '').toString());
          const { date, time } = formatScheduledTime(ticket.scheduledFor);
          const timer = timers[ticket.id];
          const clientType =
            (ticket as any).client?.type?.toString().toUpperCase() || '';
          const isPartner = clientType.includes('EMPRESA_PARCEIRA');
          const typeBadge = clientType.includes('EMPRESA_PARCEIRA')
            ? { label: 'Empresa Parceira', color: 'bg-orange-500' }
            : clientType === 'PJ'
            ? { label: 'PJ', color: 'bg-blue-600' }
            : clientType === 'PF'
            ? { label: 'PF', color: 'bg-emerald-600' }
            : undefined;
          const hoursIncluded =
            Number((ticket as any).client?.defaultHoursIncluded) ||
            ticket.duration ||
            0;
          const extraRate =
            Number((ticket as any).client?.defaultAdditionalHourRate) || 0;
          const isCompleted =
            normalized === 'CONCLUÍDO' || normalized === 'CONCLUIDO';
          const isCancelled =
            normalized === 'CANCELADO' ||
            normalized === 'CANCELLED' ||
            normalized === 'cancelled';
          const isFinished = isCompleted || isCancelled;
          const financialRecord = financialRecordsByTicketId.get(ticket.id);
          const paymentStatus = String(
            financialRecord?.status || ''
          ).toUpperCase();
          const isPaid = paymentStatus === 'PAID' || paymentStatus === 'PAGO';
          const isPending =
            paymentStatus === 'PENDING' ||
            paymentStatus === 'PENDENTE' ||
            paymentStatus === 'OVERDUE' ||
            paymentStatus === 'ATRASADO';
          const showPaymentStatus =
            isFinished && (isPaid || isPending || financialRecord);
          const paymentLabel = isPaid ? 'Pago' : 'Pendente';
          // Verificar se está em execução: status INICIADO OU tem timer rodando OU tem startedAt
          const hasStartedAt = !!(ticket as any).startedAt;
          const hasTimerRunning = timer?.running || false;
          const isInExecution =
            normalized === 'INICIADO' ||
            normalized === 'EXECUCAO' || // Compatibilidade
            hasStartedAt ||
            hasTimerRunning;

          const isOpen = normalized === 'ABERTO';

          // Calcular endereço completo baseado no tipo de cliente
          const getFullAddress = (t: Ticket): string => {
            const isEmpresaParceira = clientType.includes('EMPRESA_PARCEIRA');

            if (isEmpresaParceira) {
              // Para EMPRESA_PARCEIRA, usar serviceAddress que foi definido no cadastro do chamado
              return (t as any).serviceAddress || 'Endereço não informado';
            } else {
              // Para PF e PJ Cliente Final, o address do ticket já contém o endereço completo
              const addressFromTicket = (t as any).address || '';
              const city = (t as any).city || '';
              const state = (t as any).state || '';
              const hasCityOrState =
                addressFromTicket &&
                (addressFromTicket.includes(city) ||
                  addressFromTicket.includes(state));

              if (hasCityOrState || !city) {
                return addressFromTicket || 'Endereço não informado';
              } else {
                return (
                  [addressFromTicket, city, state].filter(Boolean).join(', ') ||
                  'Endereço não informado'
                );
              }
            }
          };

          const fullAddress = getFullAddress(ticket);

          const handleCopyAddress = async (address: string) => {
            try {
              await navigator.clipboard.writeText(address);
              toast({
                title: 'Endereço copiado',
                description:
                  'O endereço foi copiado para a área de transferência.',
              });
            } catch (error) {
              console.error('Erro ao copiar endereço:', error);
              toast({
                variant: 'destructive',
                title: 'Erro ao copiar',
                description: 'Não foi possível copiar o endereço.',
              });
            }
          };

          const handleOpenInGPS = (address: string) => {
            if (!address || address.trim() === '') {
              toast({
                variant: 'destructive',
                title: 'Endereço não informado',
                description: 'Não é possível abrir o GPS sem um endereço.',
              });
              return;
            }

            // Codificar o endereço para URL
            const encodedAddress = encodeURIComponent(address);

            // Tentar abrir no Waze primeiro (se instalado), senão Google Maps
            // Waze URL: https://waze.com/ul?q= (funciona no navegador e tenta abrir app se instalado)
            // Google Maps: https://www.google.com/maps/search/?api=1&query= (sempre funciona)

            const wazeUrl = `https://waze.com/ul?q=${encodedAddress}`;
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

            // Tenta abrir Waze primeiro (se o app estiver instalado no dispositivo, abre direto)
            // Se não tiver Waze, o navegador vai abrir o Google Maps
            window.open(wazeUrl, '_blank');
          };

          // Cores e estilos melhorados para status com alta visibilidade
          const getStatusStyles = () => {
            if (normalized === 'ABERTO') {
              return {
                badgeClass:
                  'bg-blue-600 dark:bg-blue-600 text-white border-2 border-blue-800 dark:border-blue-500 font-bold shadow-lg px-3.5 py-1.5',
                icon: Circle,
                iconClass: 'h-4 w-4',
                borderClass:
                  'border-l-4 border-l-blue-600 dark:border-l-blue-500 shadow-blue-500/50',
                cardOpacity: 'opacity-100',
              };
            } else if (normalized === 'INICIADO' || normalized === 'EXECUCAO') {
              return {
                badgeClass:
                  'bg-orange-600 dark:bg-orange-600 text-white border-2 border-orange-800 dark:border-orange-500 font-bold shadow-lg px-3.5 py-1.5',
                icon: PlayCircle,
                iconClass: 'h-4 w-4',
                borderClass:
                  'border-l-4 border-l-orange-600 dark:border-l-orange-500 shadow-orange-500/50',
                cardOpacity: 'opacity-100',
              };
            } else if (
              normalized === 'CONCLUIDO'
            ) {
              return {
                badgeClass:
                  'bg-gradient-to-r from-green-600 to-green-700 dark:from-green-600 dark:to-green-700 text-white border-2 border-green-800 dark:border-green-500 font-extrabold shadow-xl px-4 py-2 ring-2 ring-green-400/40',
                icon: CheckCircle2,
                iconClass: 'h-4 w-4',
                borderClass:
                  'border-l-4 border-l-green-600 dark:border-l-green-500 shadow-green-500/50',
                cardOpacity: 'opacity-95',
              };
            } else {
              // CANCELADO
              return {
                badgeClass:
                  'bg-gradient-to-r from-red-600 to-red-700 dark:from-red-600 dark:to-red-700 text-white border-2 border-red-800 dark:border-red-500 font-extrabold shadow-xl px-4 py-2 ring-2 ring-red-400/40',
                icon: XCircle,
                iconClass: 'h-4 w-4',
                borderClass:
                  'border-l-4 border-l-red-600 dark:border-l-red-500 shadow-red-500/50',
                cardOpacity: 'opacity-80',
              };
            }
          };

          const statusStyles = getStatusStyles();
          const StatusIcon = statusStyles.icon;
          const statusInfo = statusConfig[normalized] || { label: normalized };

          // Verificar se cálculos estão ativos para este chamado
          const isCalculationsActive = (() => {
            // Se o ticket tem a propriedade explicitamente definida, usar ela
            if (
              (ticket as any).calculationsEnabled !== undefined &&
              (ticket as any).calculationsEnabled !== null
            ) {
              return (ticket as any).calculationsEnabled !== false;
            }

            // Senão, verificar configurações globais por tipo de cliente
            if (integrationSettings) {
              const isCalculationsEnabledGlobally =
                integrationSettings.calculationsEnabled ?? true;
              if (!isCalculationsEnabledGlobally) return false;

              const clientType = ticket.client?.type;
              if (clientType && integrationSettings.calculationsClientTypes) {
                return integrationSettings.calculationsClientTypes.includes(
                  clientType
                );
              }
            }

            // Padrão é true se nada estiver definido
            return true;
          })();

          return (
            <Card
              key={ticket.id}
              className={`flex flex-col items-stretch justify-start rounded-xl shadow-lg bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 overflow-hidden ${
                statusStyles.cardOpacity ||
                (isFinished ? 'opacity-90' : 'opacity-100')
              } ${statusStyles.borderClass} ${selectedTickets.has(ticket.id) ? 'ring-2 ring-blue-500' : ''}`}
              data-testid={`card-ticket-${ticket.id}`}
            >
              <div className='p-4 border-b border-gray-200 dark:border-gray-700'>
                <div className='flex justify-between items-start'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      checked={selectedTickets.has(ticket.id)}
                      onCheckedChange={() => toggleTicketSelection(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      id={`checkbox-${ticket.id}`}
                    />
                  </div>
                  <div className='flex items-center gap-2'>
                  <p className='text-gray-500 dark:text-gray-400 text-sm font-normal'>
                    {(ticket as any).ticketNumber
                      ? `#${(ticket as any).ticketNumber}`
                      : `#${ticket.id.slice(0, 8)}`}
                  </p>
                  <div className='flex items-center gap-2'>
                    {typeBadge && (
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          typeBadge.label === 'Empresa Parceira'
                            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                            : typeBadge.label === 'PJ'
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {typeBadge.label}
                      </span>
                    )}
                    {isInExecution && (ticket as any).startedAt && isCalculationsActive && (
                      <span className='inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest shadow-sm'>
                        <PlayCircle className='h-3 w-3 animate-pulse' />
                        {format(new Date((ticket as any).startedAt), 'HH:mm')}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg text-xs uppercase tracking-wide ${statusStyles.badgeClass}`}
                    >
                      <StatusIcon className={statusStyles.iconClass} />
                      {statusInfo.label}
                    </span>
                  </div>
                  </div>
                </div>
                <p
                  className='text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] mt-2'
                  data-testid='text-ticket-client'
                >
                  {ticket.client?.name || 'Cliente não informado'}
                </p>
              </div>
              <div className='flex flex-col gap-3 p-4'>
                <p
                  className='text-gray-600 dark:text-gray-300 text-sm font-normal'
                  data-testid='text-ticket-service'
                >
                  <strong className='text-gray-800 dark:text-gray-100'>
                    Serviço:
                  </strong>{' '}
                  {ticket.service?.name || 'Serviço não informado'}
                </p>
                <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
                  <Clock className='h-4 w-4' />
                  <span>
                    {date} - {time}
                  </span>
                </div>
                {fullAddress && (
                  <div className='flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400'>
                    <Navigation className='h-4 w-4 mt-0.5 flex-shrink-0' />
                    <div className='flex-1 flex items-center gap-2'>
                      <span className='flex-1'>{fullAddress}</span>
                      <div className='flex gap-1'>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          className='h-6 w-6 p-0'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopyAddress(fullAddress);
                          }}
                          title='Copiar endereço'
                        >
                          <Copy className='h-3 w-3' />
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          className='h-6 w-6 p-0'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenInGPS(fullAddress);
                          }}
                          title='Abrir no GPS'
                        >
                          <Navigation className='h-3 w-3' />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {isPartner && !isFinished && (
                  <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                    <span>
                      Incl.: {hoursIncluded}h | +R$
                      {extraRate.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {isFinished && (
                  <div
                    className={`flex flex-col gap-1 ${
                      isFinished ? 'mt-1.5 p-2' : 'mt-2 p-3'
                    } rounded-lg bg-muted/30 border border-border`}
                  >
                    <div
                      className={`flex flex-wrap items-center gap-2 ${
                        isFinished ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      {ticket.ticketValue && (
                        <div className='flex items-center gap-1.5'>
                          <span className='text-muted-foreground'>
                            Valor do chamado:
                          </span>
                          <span className='font-semibold text-foreground'>
                            R${' '}
                            {typeof ticket.ticketValue === 'number'
                              ? ticket.ticketValue.toFixed(2).replace('.', ',')
                              : parseFloat(String(ticket.ticketValue || 0))
                                  .toFixed(2)
                                  .replace('.', ',')}
                          </span>
                        </div>
                      )}
                      {ticket.kmTotal &&
                        ticket.kmRate &&
                        parseFloat(String(ticket.kmTotal)) > 0 && (
                          <div className='flex items-center gap-1.5'>
                            <span className='text-muted-foreground'>
                              KMs ({parseFloat(String(ticket.kmTotal))} km):
                            </span>
                            <span className='font-semibold text-foreground'>
                              R${' '}
                              {(
                                parseFloat(String(ticket.kmTotal)) *
                                parseFloat(String(ticket.kmRate || 0))
                              )
                                .toFixed(2)
                                .replace('.', ',')}
                            </span>
                          </div>
                        )}
                      {ticket.extraExpenses &&
                        parseFloat(String(ticket.extraExpenses)) > 0 && (
                          <div className='flex items-center gap-1.5'>
                            <span className='text-muted-foreground'>
                              Despesas extras:
                            </span>
                            <span className='font-semibold text-foreground'>
                              R${' '}
                              {typeof ticket.extraExpenses === 'number'
                                ? ticket.extraExpenses
                                    .toFixed(2)
                                    .replace('.', ',')
                                : parseFloat(String(ticket.extraExpenses || 0))
                                    .toFixed(2)
                                    .replace('.', ',')}
                            </span>
                          </div>
                        )}
                    </div>
                    <div
                      className={`flex flex-col gap-1.5 pt-1.5 border-t border-border/50`}
                    >
                      <div className='flex items-center gap-2'>
                        <span
                          className={`${
                            isFinished ? 'text-[10px]' : 'text-xs'
                          } font-semibold text-muted-foreground`}
                        >
                          Total:
                        </span>
                        <span
                          className={`${
                            isFinished ? 'text-sm' : 'text-base'
                          } font-bold text-primary`}
                        >
                          R${' '}
                          {(() => {
                            const valorChamado = ticket.ticketValue
                              ? parseFloat(String(ticket.ticketValue || 0))
                              : 0;
                            const kmValue =
                              ticket.kmTotal && ticket.kmRate
                                ? parseFloat(String(ticket.kmTotal)) *
                                  parseFloat(String(ticket.kmRate || 0))
                                : 0;
                            const extraExpenses = ticket.extraExpenses
                              ? parseFloat(String(ticket.extraExpenses || 0))
                              : 0;
                            const total = ticket.totalAmount
                              ? parseFloat(String(ticket.totalAmount || 0))
                              : valorChamado + kmValue + extraExpenses;
                            return total.toFixed(2).replace('.', ',');
                          })()}
                        </span>
                      </div>
                      {(ticket.paymentDate || ticket.dueDate) && (
                        <div className='flex items-center gap-2'>
                          <span className='text-xs text-muted-foreground'>
                            {ticket.paymentDate
                              ? 'Data de pagamento:'
                              : 'Data de vencimento:'}
                          </span>
                          <span className='text-xs font-semibold text-foreground'>
                            {ticket.paymentDate
                              ? (() => {
                                  try {
                                    const date =
                                      typeof ticket.paymentDate === 'string'
                                        ? parseISO(ticket.paymentDate)
                                        : new Date(ticket.paymentDate);
                                    return format(date, 'dd/MM/yyyy', {
                                      locale: ptBR,
                                    });
                                  } catch {
                                    return String(ticket.paymentDate);
                                  }
                                })()
                              : ticket.dueDate
                              ? (() => {
                                  try {
                                    const date =
                                      typeof ticket.dueDate === 'string'
                                        ? parseISO(ticket.dueDate)
                                        : new Date(ticket.dueDate);
                                    return format(date, 'dd/MM/yyyy', {
                                      locale: ptBR,
                                    });
                                  } catch {
                                    return String(ticket.dueDate);
                                  }
                                })()
                              : ''}
                          </span>
                        </div>
                      )}
                      {showPaymentStatus && (
                        <div className='flex items-center gap-2'>
                          <span className='text-xs text-muted-foreground'>
                            Pagamento:
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              isPaid
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}
                          >
                            {paymentLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className='p-4 mt-auto bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-end'>
                {!isFinished && (
                  <>
                    {!timer?.running && !isInExecution && isCalculationsActive && (
                      <Button
                        type='button'
                        size='sm'
                        variant='default'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmStartTicket(ticket);
                        }}
                        className='flex h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 gap-2'
                        data-testid='button-start-ticket'
                      >
                        <PlayCircle className='h-4 w-4' />
                        Iniciar
                      </Button>
                    )}
                    {isOpen && !isCompleted && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmEditTicket(ticket);
                        }}
                        className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600'
                        data-testid='button-edit-ticket'
                      >
                        <Edit className='h-4 w-4 mr-1' />
                        Editar
                      </Button>
                    )}
                    {isOpen && !isCompleted && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCancelConfirmTicket(ticket);
                        }}
                        disabled={isCancelling}
                        className='flex items-center justify-center rounded-md h-8 px-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/60'
                        data-testid='button-cancel-ticket'
                      >
                        <XCircle className='h-4 w-4 mr-1' />
                        Cancelar
                      </Button>
                    )}
                  </>
                )}
                {!isFinished && (isInExecution || isOpen) && (
                  <Button
                    type='button'
                    size='sm'
                    variant='default'
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmFinishTicket(ticket);
                    }}
                    className='flex items-center justify-center rounded-md h-8 px-3 bg-green-500 text-white text-xs font-medium hover:bg-green-600'
                    data-testid='button-finish-ticket'
                  >
                    <CheckCircle2 className='h-4 w-4 mr-1' />
                    Concluir
                  </Button>
                )}
                {isCompleted && (
                  <>
                    {(() => {
                      // Botões de cobrança e recebimento foram movidos para a página de financeiro
                      return null;
                    })()}
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setViewTicket(ticket);
                      }}
                      className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600'
                      data-testid='button-view-ticket'
                    >
                      <FileText className='h-4 w-4 mr-1' />
                      Ver Detalhes
                    </Button>
                  </>
                )}
                {isCancelled && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDeleteTicket(ticket);
                    }}
                    className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600'
                    data-testid='button-delete-ticket'
                  >
                    <Trash2 className='h-4 w-4 mr-1' />
                    Excluir
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>


      <Dialog
        open={!!cancelConfirmTicket}
        onOpenChange={(open) => {
          if (!open) {
            // Mostrar confirmação ao invés de fechar diretamente
            setShowCancelCloseConfirm(true);
          }
        }}
      >
        <DialogContent
          className='max-w-lg bg-white dark:bg-[#101722] border-gray-200 dark:border-slate-800 [&>button]:hidden'
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className='flex items-start justify-between'>
            <div className='flex flex-col gap-1'>
              <DialogTitle className='text-xl font-bold text-[#111418] dark:text-white'>
                Cancelar Chamado #
                {cancelConfirmTicket?.ticketNumber ||
                  cancelConfirmTicket?.id?.slice(0, 8)}
              </DialogTitle>
              <DialogDescription className='text-sm text-[#60708a] dark:text-slate-400'>
                Por favor, informe os detalhes do cancelamento.
              </DialogDescription>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => {
                setShowCancelCloseConfirm(true);
              }}
              className='flex h-8 w-8 items-center justify-center rounded-full text-[#60708a] transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
            >
              <X className='h-5 w-5' />
            </Button>
          </div>

          <div className='flex flex-col gap-5 pt-2'>
            <div className='flex flex-col gap-2'>
              <p className='text-sm font-medium text-[#111418] dark:text-slate-200'>
                Quem solicitou o cancelamento?
              </p>
              <div className='flex h-10 w-full items-center justify-center rounded-lg bg-[#f0f2f5] p-1 dark:bg-slate-800'>
                <label
                  className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${
                    cancellationSource === 'CLIENTE'
                      ? 'bg-white text-[#111418] shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-[#60708a] dark:text-slate-400'
                  }`}
                >
                  <span className='truncate'>Cliente</span>
                  <input
                    type='radio'
                    name='cancel-source'
                    value='CLIENTE'
                    checked={cancellationSource === 'CLIENTE'}
                    onChange={() => setCancellationSource('CLIENTE')}
                    className='invisible w-0'
                  />
                </label>
                <label
                  className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${
                    cancellationSource === 'TECNICO'
                      ? 'bg-white text-[#111418] shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-[#60708a] dark:text-slate-400'
                  }`}
                >
                  <span className='truncate'>Técnico</span>
                  <input
                    type='radio'
                    name='cancel-source'
                    value='TECNICO'
                    checked={cancellationSource === 'TECNICO'}
                    onChange={() => setCancellationSource('TECNICO')}
                    className='invisible w-0'
                  />
                </label>
              </div>
            </div>

            <label className='flex flex-col gap-2'>
              <p className='text-sm font-medium text-[#111418] dark:text-slate-200'>
                Motivo do Cancelamento
              </p>
              <Textarea
                id='cancellation-description'
                placeholder='Ex: Cliente solicitou o reagendamento para outra data / Peça necessária não está em estoque.'
                value={cancellationDescription}
                onChange={(e) => setCancellationDescription(e.target.value)}
                rows={6}
                className='flex min-h-32 w-full flex-1 resize-none overflow-hidden rounded-lg border border-[#dbdfe6] bg-white p-3 text-sm font-normal text-[#111418] placeholder:text-[#60708a] focus:border-primary focus:outline-0 focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-primary/80'
              />
            </label>

            {isGoogleCalendarConnected && (
              <div className='flex items-center gap-3 rounded-lg bg-blue-50 p-3 dark:bg-primary/10'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary dark:bg-primary/20 dark:text-primary/80'>
                  <span className='material-symbols-outlined text-base'>
                    info
                  </span>
                </div>
                <p className='flex-1 text-sm font-normal leading-normal text-blue-800 dark:text-blue-200'>
                  A ação removerá o evento do Google Calendar.
                </p>
              </div>
            )}
          </div>

          <div className='flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
            <Button
              variant='outline'
              onClick={() => {
                setShowCancelCloseConfirm(true);
              }}
              disabled={isCancelling}
              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[#f0f2f5] px-4 text-sm font-bold leading-normal tracking-[0.015em] text-[#111418] transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'
            >
              <span className='truncate'>Voltar</span>
            </Button>
            <Button
              onClick={() =>
                cancelConfirmTicket && cancelTicket(cancelConfirmTicket)
              }
              disabled={isCancelling || !cancellationDescription.trim()}
              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white transition-colors hover:bg-primary/90'
            >
              {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação para fechar modal de cancelamento */}
      <AlertDialog
        open={showCancelCloseConfirm}
        onOpenChange={setShowCancelCloseConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar operação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja fechar? Os dados preenchidos serão
              perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelCloseConfirm(false)}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCancelConfirmTicket(null);
                setCancellationSource('CLIENTE');
                setCancellationDescription('');
                setShowCancelCloseConfirm(false);
              }}
            >
              Sim, fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação para Iniciar */}
      <AlertDialog
        open={!!confirmStartTicket}
        onOpenChange={(open) => !open && setConfirmStartTicket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja iniciar o chamado{' '}
              <strong>
                #{confirmStartTicket?.ticketNumber ||
                  confirmStartTicket?.id?.slice(0, 8)}
              </strong>
              ? O cronômetro será iniciado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmStartTicket(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmStartTicket) {
                  startTimer(confirmStartTicket);
                  setConfirmStartTicket(null);
                }
              }}
            >
              Sim, iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação para Editar */}
      <AlertDialog
        open={!!confirmEditTicket}
        onOpenChange={(open) => !open && setConfirmEditTicket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja editar o chamado{' '}
              <strong>
                #{confirmEditTicket?.ticketNumber ||
                  confirmEditTicket?.id?.slice(0, 8)}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmEditTicket(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmEditTicket) {
                  onEdit(confirmEditTicket);
                  setConfirmEditTicket(null);
                }
              }}
            >
              Sim, editar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação para Concluir */}
      <AlertDialog
        open={!!confirmFinishTicket}
        onOpenChange={(open) => !open && setConfirmFinishTicket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja concluir o chamado{' '}
              <strong>
                #{confirmFinishTicket?.ticketNumber ||
                  confirmFinishTicket?.id?.slice(0, 8)}
              </strong>
              ? O chamado será finalizado e o modal de encerramento será aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmFinishTicket(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmFinishTicket) {
                  onFinish(confirmFinishTicket);
                  setConfirmFinishTicket(null);
                }
              }}
            >
              Sim, concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação para Excluir */}
      <AlertDialog
        open={!!confirmDeleteTicket}
        onOpenChange={(open) => !open && setConfirmDeleteTicket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o chamado{' '}
              <strong>
                #{confirmDeleteTicket?.ticketNumber ||
                  confirmDeleteTicket?.id?.slice(0, 8)}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteTicket(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteTicket) {
                  onDelete(confirmDeleteTicket);
                  setConfirmDeleteTicket(null);
                }
              }}
              className='bg-red-600 hover:bg-red-700'
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Visualização de Detalhes */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#101722] border-gray-200 dark:border-slate-800'>
          <DialogHeader>
            <DialogTitle className='text-2xl font-bold text-[#111418] dark:text-white'>
              Detalhes do Chamado #{viewTicket?.ticketNumber || viewTicket?.id?.slice(0, 8)}
            </DialogTitle>
            <DialogDescription className='text-sm text-[#60708a] dark:text-slate-400'>
              Informações completas do chamado
            </DialogDescription>
          </DialogHeader>

          {viewTicket && (
            <div className='space-y-6 py-4'>
              {/* Status e Botões de Ação */}
              <div className='flex items-center justify-between gap-4 flex-wrap'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium text-[#111418] dark:text-slate-200'>
                    Status:
                  </span>
                  <Badge
                    variant={
                      statusConfig[viewTicket.status]?.variant || 'default'
                    }
                    className='text-xs'
                  >
                    {statusConfig[viewTicket.status]?.label || viewTicket.status}
                  </Badge>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleExportPDF}
                    className='flex items-center gap-2'
                  >
                    <FileText className='h-4 w-4' />
                    PDF
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleExportExcel}
                    className='flex items-center gap-2'
                  >
                    <FileSpreadsheet className='h-4 w-4' />
                    Excel
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setEmailAddress(viewTicket?.client?.email || '');
                      setShowEmailDialog(true);
                    }}
                    className='flex items-center gap-2'
                  >
                    <Mail className='h-4 w-4' />
                    Email
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setWhatsappNumber((viewTicket?.client as any)?.phone || '');
                      setShowWhatsAppDialog(true);
                    }}
                    className='flex items-center gap-2'
                  >
                    <MessageCircle className='h-4 w-4' />
                    WhatsApp
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      if (
                        !requirePaid({
                          feature: 'Envio por WhatsApp',
                          description:
                            'Envios por WhatsApp estao disponiveis apenas na versao paga.',
                        })
                      ) {
                        return;
                      }
                      if (viewTicket) {
                        const ticketText = generateTicketText(viewTicket);
                        const encodedText = encodeURIComponent(ticketText);
                        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
                        window.open(whatsappUrl, '_blank');
                        toast({
                          title: 'WhatsApp aberto',
                          description: 'Escolha o contato no WhatsApp para compartilhar.',
                        });
                      }
                    }}
                    className='flex items-center gap-2'
                  >
                    <Share2 className='h-4 w-4' />
                    Compartilhar
                  </Button>
                </div>
              </div>

              {/* Informações do Cliente */}
              <div className='space-y-2'>
                <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                  Cliente
                </h3>
                <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                  <div>
                    <p className='text-sm text-[#60708a] dark:text-slate-400'>Nome</p>
                    <p className='text-base font-medium text-[#111418] dark:text-white'>
                      {viewTicket.client?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-[#60708a] dark:text-slate-400'>Tipo</p>
                    <p className='text-base font-medium text-[#111418] dark:text-white'>
                      {viewTicket.client?.type === 'PF'
                        ? 'Pessoa Física'
                        : viewTicket.client?.type === 'PJ'
                        ? 'Pessoa Jurídica'
                        : 'Empresa Parceira'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações do Serviço */}
              <div className='space-y-2'>
                <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                  Serviço
                </h3>
                <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                  <div>
                    <p className='text-sm text-[#60708a] dark:text-slate-400'>Nome do Serviço</p>
                    <p className='text-base font-medium text-[#111418] dark:text-white'>
                      {viewTicket.service?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm text-[#60708a] dark:text-slate-400'>Duração</p>
                    <p className='text-base font-medium text-[#111418] dark:text-white'>
                      {viewTicket.duration || 0} horas
                    </p>
                  </div>
                  {(viewTicket as any).finalClient && (
                    <div className='col-span-2'>
                      <p className='text-sm text-[#60708a] dark:text-slate-400'>Cliente Final</p>
                      <p className='text-base font-medium text-[#111418] dark:text-white'>
                        {(viewTicket as any).finalClient}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Descrição */}
              {(viewTicket as any).description && (
                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                    Descrição
                  </h3>
                  <div className='p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                    <p className='text-sm text-[#111418] dark:text-white whitespace-pre-wrap'>
                      {(viewTicket as any).description}
                    </p>
                  </div>
                </div>
              )}

              {/* Endereço */}
              {((viewTicket as any).address || (viewTicket as any).serviceAddress || (viewTicket as any).city) && (
                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                    Endereço
                  </h3>
                  <div className='p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                    <div className='flex items-start gap-2'>
                      <Navigation className='h-4 w-4 text-[#60708a] dark:text-slate-400 mt-1 flex-shrink-0' />
                      <p className='text-sm text-[#111418] dark:text-white'>
                        {(() => {
                          const isEmpresaParceira = viewTicket.client?.type === 'EMPRESA_PARCEIRA';
                          if (isEmpresaParceira) {
                            return (viewTicket as any).serviceAddress || 'Endereço não informado';
                          } else {
                            const address = (viewTicket as any).address || '';
                            const city = (viewTicket as any).city || '';
                            const state = (viewTicket as any).state || '';
                            if (address && (city || state)) {
                              return [address, city, state].filter(Boolean).join(', ');
                            }
                            return address || 'Endereço não informado';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Data e Hora */}
              <div className='space-y-2'>
                <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                  Agendamento
                </h3>
                <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                  <div className='flex items-center gap-2'>
                    <Calendar className='h-4 w-4 text-[#60708a] dark:text-slate-400' />
                    <div>
                      <p className='text-sm text-[#60708a] dark:text-slate-400'>Data</p>
                      <p className='text-base font-medium text-[#111418] dark:text-white'>
                        {viewTicket.scheduledFor
                          ? format(parseISO(viewTicket.scheduledFor), "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Clock className='h-4 w-4 text-[#60708a] dark:text-slate-400' />
                    <div>
                      <p className='text-sm text-[#60708a] dark:text-slate-400'>Horário</p>
                      <p className='text-base font-medium text-[#111418] dark:text-white'>
                        {viewTicket.scheduledFor
                          ? format(parseISO(viewTicket.scheduledFor), 'HH:mm', {
                              locale: ptBR,
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações Financeiras */}
              {(() => {
                const calculationsEnabled = viewTicket.calculationsEnabled;
                const isCalculationsActive = (() => {
                  if (
                    calculationsEnabled !== undefined &&
                    calculationsEnabled !== null
                  ) {
                    return calculationsEnabled !== false;
                  }
                  if (integrationSettings) {
                    const isCalculationsEnabledGlobally =
                      integrationSettings.calculationsEnabled ?? true;
                    if (!isCalculationsEnabledGlobally) return false;
                    const clientType = viewTicket.client?.type;
                    if (
                      clientType &&
                      integrationSettings.calculationsClientTypes
                    ) {
                      return integrationSettings.calculationsClientTypes.includes(
                        clientType
                      );
                    }
                  }
                  return true;
                })();
                return isCalculationsActive;
              })() && (
                <>
                  <div className='space-y-2'>
                    <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                      Informações Financeiras
                    </h3>
                    <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Valor do Chamado</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {typeof viewTicket.ticketValue === 'number'
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(viewTicket.ticketValue)
                            : viewTicket.ticketValue || 'R$ 0,00'}
                        </p>
                      </div>
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>KM Total</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {typeof viewTicket.kmTotal === 'number'
                            ? `${viewTicket.kmTotal} km`
                            : viewTicket.kmTotal || '0 km'}
                        </p>
                      </div>
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Taxa por KM</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {typeof viewTicket.kmRate === 'number'
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(viewTicket.kmRate)
                            : viewTicket.kmRate || 'R$ 0,00'}
                        </p>
                      </div>
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Despesas Extras</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {typeof viewTicket.extraExpenses === 'number'
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(viewTicket.extraExpenses)
                            : viewTicket.extraExpenses || 'R$ 0,00'}
                        </p>
                      </div>
                      <div className='col-span-2'>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Total</p>
                        <p className='text-xl font-bold text-green-600 dark:text-green-400'>
                          {typeof viewTicket.totalAmount === 'number'
                            ? new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(viewTicket.totalAmount)
                            : viewTicket.totalAmount || 'R$ 0,00'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes das Despesas */}
                  {viewTicket.expenseDetails && (
                    <div className='space-y-2'>
                      <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                        Detalhes das Despesas
                      </h3>
                      <div className='p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                        <p className='text-sm text-[#111418] dark:text-white whitespace-pre-wrap'>
                          {viewTicket.expenseDetails}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Datas de Início e Fim */}
              {(viewTicket.startedAt || viewTicket.stoppedAt) && (
                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                    Execução
                  </h3>
                  <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                    {viewTicket.startedAt && (
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Iniciado em</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {format(parseISO(viewTicket.startedAt), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    )}
                    {viewTicket.stoppedAt && (
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Finalizado em</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {format(parseISO(viewTicket.stoppedAt), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Datas de Pagamento e Vencimento */}
              {(viewTicket.paymentDate || viewTicket.dueDate) && (
                <div className='space-y-2'>
                  <h3 className='text-lg font-semibold text-[#111418] dark:text-white'>
                    Pagamento
                  </h3>
                  <div className='grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg'>
                    {viewTicket.dueDate && (
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Vencimento</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {viewTicket.dueDate instanceof Date
                            ? format(viewTicket.dueDate, 'dd/MM/yyyy', { locale: ptBR })
                            : typeof viewTicket.dueDate === 'string'
                            ? format(parseISO(viewTicket.dueDate), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    )}
                    {viewTicket.paymentDate && (
                      <div>
                        <p className='text-sm text-[#60708a] dark:text-slate-400'>Data de Pagamento</p>
                        <p className='text-base font-medium text-[#111418] dark:text-white'>
                          {viewTicket.paymentDate instanceof Date
                            ? format(viewTicket.paymentDate, 'dd/MM/yyyy', { locale: ptBR })
                            : typeof viewTicket.paymentDate === 'string'
                            ? format(parseISO(viewTicket.paymentDate), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setViewTicket(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Enviar Email */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Enviar por Email</DialogTitle>
            <DialogDescription>
              Digite o endereço de email para enviar os detalhes dos {selectedTicketsList.length} chamados selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                placeholder='exemplo@email.com'
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailAddress.trim()) {
                    handleSendEmail();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowEmailDialog(false);
                setEmailAddress('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={!emailAddress.trim() || isSendingEmail}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className='mr-2 h-4 w-4' />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Enviar WhatsApp (múltiplos chamados) */}
      <Dialog open={showWhatsAppDialog && showBulkDetails} onOpenChange={(open) => {
        if (!open) {
          setShowWhatsAppDialog(false);
          setWhatsappNumber('');
        }
      }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Enviar via WhatsApp</DialogTitle>
            <DialogDescription>
              Digite o número de WhatsApp ou escolha um contato para enviar os detalhes dos {selectedTicketsList.length} chamados selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='whatsapp'>Número de WhatsApp</Label>
              <Input
                id='whatsapp'
                type='tel'
                placeholder='5511999999999'
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && whatsappNumber.trim()) {
                    handleShareWhatsApp();
                  }
                }}
              />
              <p className='text-xs text-muted-foreground mt-1'>
                Digite o número com código do país (ex: 5511999999999)
              </p>
            </div>
            {clients.length > 0 && (
              <div>
                <Label>Ou escolha um contato:</Label>
                <div className='max-h-40 overflow-y-auto mt-2 space-y-1'>
                  {clients
                    .filter((client: any) => client.phone)
                    .map((client: any) => (
                      <Button
                        key={client.id}
                        variant='ghost'
                        className='w-full justify-start'
                        onClick={() => {
                          const phone = client.phone.replace(/\D/g, '');
                          handleShareWhatsApp(phone);
                        }}
                      >
                        <Phone className='mr-2 h-4 w-4' />
                        {client.name} - {client.phone}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowWhatsAppDialog(false);
                setWhatsappNumber('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => handleShareWhatsApp()}
              disabled={!whatsappNumber.trim()}
            >
              <MessageCircle className='mr-2 h-4 w-4' />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal estilo Excel com chamados selecionados */}
      <Dialog open={showBulkDetails} onOpenChange={setShowBulkDetails}>
        <DialogContent className='max-w-6xl max-h-[90vh] overflow-hidden flex flex-col'>
          <DialogHeader>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex-1'>
                <DialogTitle className='text-2xl font-bold flex items-center gap-2'>
                  <FileText className='h-6 w-6 text-primary' />
                  Detalhamento Completo de Chamados ({selectedTicketsList.length})
                </DialogTitle>
                <DialogDescription>
                  Visualize os detalhes dos chamados selecionados. Use os botões no rodapé para exportar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className='flex-1 overflow-auto border rounded-lg bg-white dark:bg-slate-900'>
            <div className='min-w-[3000px]'>
              <table className='w-full border-collapse text-sm table-fixed'>
                <thead className='bg-gray-100 dark:bg-slate-800 sticky top-0 z-10'>
                  <tr>
                    <th className='border p-2 text-left text-xs font-semibold w-[80px]'>ID</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Ticket #</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[200px]'>Cliente</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Telefone</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[200px]'>Email</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>CPF/CNPJ</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Tipo Cliente</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Serviço</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[100px]'>Duração</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[180px]'>Data/Hora</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[250px]'>Endereço</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[80px]'>Número</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Complemento</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Bairro</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Cidade</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[80px]'>Estado</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[100px]'>CEP</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[300px]'>Descrição</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Status</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Valor Chamado</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Tipo Cobrança</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[100px]'>KM Total</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Taxa por KM</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Valor KM</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Despesas Extras</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[200px]'>Detalhes Despesas</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Total</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[180px]'>Iniciado em</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[180px]'>Finalizado em</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Vencimento</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>Pagamento</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[120px]'>NF #</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Aprovado por</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[150px]'>Cliente Final</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[200px]'>Motivo Cancel.</th>
                    <th className='border p-2 text-left text-xs font-semibold w-[300px]'>Observações</th>
                  </tr>
                </thead>
                <tbody className='bg-white dark:bg-slate-900'>
                  {selectedTicketsList.map((ticket) => {
                    const normalized = normalizeStatus((ticket.status || '').toString());
                    const statusInfo = statusConfig[normalized] || statusConfig.pending;
                            const address = (() => {
                              const isEmpresaParceira = ticket.client?.type === 'EMPRESA_PARCEIRA';
                              if (isEmpresaParceira) {
                                return (ticket as any).serviceAddress || 'N/A';
                              } else {
                                // Lógica inteligente para evitar duplicação de cidade/estado
                                const addr = ((ticket as any).address || '').trim();
                                const city = ((ticket as any).city || '').trim();
                                const state = ((ticket as any).state || '').trim();
                                
                                let parts = [];
                                if (addr) parts.push(addr);
                                
                                // Só adiciona cidade se não estiver no endereço
                                if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
                                  parts.push(city);
                                }
                                
                                // Só adiciona estado se não estiver no endereço
                                if (state && !addr.toLowerCase().includes(state.toLowerCase())) {
                                  parts.push(state);
                                }
                                
                                return parts.length > 0 ? parts.join(', ') : 'N/A';
                              }
                            })();
                    const scheduledDate = ticket.scheduledFor
                      ? format(parseISO(ticket.scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const total = typeof ticket.totalAmount === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.totalAmount)
                      : ticket.totalAmount || 'R$ 0,00';
                    const ticketValue = typeof ticket.ticketValue === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.ticketValue)
                      : ticket.ticketValue || 'R$ 0,00';
                    const kmTotal = typeof ticket.kmTotal === 'number'
                      ? `${ticket.kmTotal} km`
                      : ticket.kmTotal || '0 km';
                    const kmRate = typeof ticket.kmRate === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.kmRate)
                      : ticket.kmRate || 'R$ 0,00';
                    const extraExpenses = typeof ticket.extraExpenses === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.extraExpenses)
                      : ticket.extraExpenses || 'R$ 0,00';
                    const clientType = ticket.client?.type === 'PF'
                      ? 'Pessoa Física'
                      : ticket.client?.type === 'PJ'
                      ? 'Pessoa Jurídica'
                      : ticket.client?.type === 'EMPRESA_PARCEIRA'
                      ? 'Empresa Parceira'
                      : 'N/A';
                    const duration = `${ticket.duration || 0} horas`;
                    const description = (ticket as any).description || 'N/A';
                    const startedAt = ticket.startedAt
                      ? format(parseISO(ticket.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const stoppedAt = ticket.stoppedAt
                      ? format(parseISO(ticket.stoppedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const dueDate = ticket.dueDate
                      ? (ticket.dueDate instanceof Date
                          ? format(ticket.dueDate, 'dd/MM/yyyy', { locale: ptBR })
                          : typeof ticket.dueDate === 'string'
                          ? format(parseISO(ticket.dueDate), 'dd/MM/yyyy', { locale: ptBR })
                          : 'N/A')
                      : 'N/A';
                    const paymentDate = ticket.paymentDate
                      ? (ticket.paymentDate instanceof Date
                          ? format(ticket.paymentDate, 'dd/MM/yyyy', { locale: ptBR })
                          : typeof ticket.paymentDate === 'string'
                          ? format(parseISO(ticket.paymentDate), 'dd/MM/yyyy', { locale: ptBR })
                          : 'N/A')
                      : 'N/A';
                    const finalClient = (ticket as any).finalClient || 'N/A';
                    const clientPhone = ticket.client?.phone || 'N/A';
                    const clientEmail = ticket.client?.email || 'N/A';
                    const clientDocument = ticket.client?.cpf || ticket.client?.cnpj || 'N/A';
                    const addressNumber =
                      (ticket as any).addressNumber ||
                      ticket.client?.addressNumber ||
                      'N/A';
                    const addressComplement =
                      (ticket as any).addressComplement ||
                      ticket.client?.addressComplement ||
                      'N/A';
                    const neighborhood =
                      (ticket as any).neighborhood ||
                      ticket.client?.neighborhood ||
                      'N/A';
                    const city =
                      (ticket as any).city || ticket.client?.city || 'N/A';
                    const state =
                      (ticket as any).state || ticket.client?.state || 'N/A';
                    const zipCode =
                      (ticket as any).zipCode || ticket.client?.zipCode || 'N/A';
                    const kmValue = ticket.kmTotal && ticket.kmRate
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          parseFloat(String(ticket.kmTotal)) * parseFloat(String(ticket.kmRate || 0))
                        )
                      : 'R$ 0,00';
                    const observations = (ticket as any).observations || (ticket as any).notes || 'N/A';
                    const invoiceNumber = (ticket as any).invoiceNumber || 'N/A';
                    const chargeType = (ticket as any).chargeType || 'N/A';
                    const approvedBy = (ticket as any).approvedBy || 'N/A';
                    const expenseDetails = (ticket as any).expenseDetails || 'N/A';
                    const cancellationReason = (ticket as any).cancellationReason || 'N/A';

                    return (
                      <tr key={ticket.id} className='hover:bg-gray-50 dark:hover:bg-slate-800'>
                        <td className='border p-2 text-xs w-[80px]'>{ticket.id?.slice(0, 8)}</td>
                        <td className='border p-2 text-xs w-[120px]'>#{(ticket as any).ticketNumber || 'N/A'}</td>
                        <td className='border p-2 text-xs w-[200px]'>{ticket.client?.name || 'N/A'}</td>
                        <td className='border p-2 text-xs w-[150px]'>{clientPhone}</td>
                        <td className='border p-2 text-xs w-[200px]'>{clientEmail}</td>
                        <td className='border p-2 text-xs w-[150px]'>{clientDocument}</td>
                        <td className='border p-2 text-xs w-[120px]'>{clientType}</td>
                        <td className='border p-2 text-xs w-[150px]'>{ticket.service?.name || 'N/A'}</td>
                        <td className='border p-2 text-xs w-[100px]'>{duration}</td>
                        <td className='border p-2 text-xs w-[180px]'>{scheduledDate}</td>
                        <td className='border p-2 text-xs w-[250px]' title={address}>{address}</td>
                        <td className='border p-2 text-xs w-[80px]'>{addressNumber}</td>
                        <td className='border p-2 text-xs w-[150px]' title={addressComplement}>{addressComplement}</td>
                        <td className='border p-2 text-xs w-[150px]'>{neighborhood}</td>
                        <td className='border p-2 text-xs w-[150px]'>{city}</td>
                        <td className='border p-2 text-xs w-[80px]'>{state}</td>
                        <td className='border p-2 text-xs w-[100px]'>{zipCode}</td>
                        <td className='border p-2 text-xs w-[300px]' title={description}>{description}</td>
                        <td className='border p-2 text-xs w-[120px]'>
                          <Badge variant={statusInfo.variant} className='text-xs'>{statusInfo.label}</Badge>
                        </td>
                        <td className='border p-2 text-xs w-[120px]'>{ticketValue}</td>
                        <td className='border p-2 text-xs w-[120px]'>{chargeType}</td>
                        <td className='border p-2 text-xs w-[100px]'>{kmTotal}</td>
                        <td className='border p-2 text-xs w-[120px]'>{kmRate}</td>
                        <td className='border p-2 text-xs w-[120px]'>{kmValue}</td>
                        <td className='border p-2 text-xs w-[120px]'>{extraExpenses}</td>
                        <td className='border p-2 text-xs w-[200px]' title={expenseDetails}>{expenseDetails}</td>
                        <td className='border p-2 text-xs font-semibold w-[120px]'>{total}</td>
                        <td className='border p-2 text-xs w-[180px]'>{startedAt}</td>
                        <td className='border p-2 text-xs w-[180px]'>{stoppedAt}</td>
                        <td className='border p-2 text-xs w-[120px]'>{dueDate}</td>
                        <td className='border p-2 text-xs w-[120px]'>{paymentDate}</td>
                        <td className='border p-2 text-xs w-[120px]'>{invoiceNumber}</td>
                        <td className='border p-2 text-xs w-[150px]'>{approvedBy}</td>
                        <td className='border p-2 text-xs w-[150px]'>{finalClient}</td>
                        <td className='border p-2 text-xs w-[200px]' title={cancellationReason}>{cancellationReason}</td>
                        <td className='border p-2 text-xs w-[300px]' title={observations}>{observations}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className='flex flex-wrap items-center justify-between gap-4 p-4 border-t dark:border-slate-800'>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  const htmlContent = `
                  <html><head><meta charset="UTF-8"><style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                  </style></head><body>
                    <h1>Chamados Selecionados (${selectedTicketsList.length})</h1>
                    <table>
                      <thead><tr>
                        <th>ID</th><th>Ticket #</th><th>Cliente</th><th>Telefone</th><th>Email</th><th>CPF/CNPJ</th><th>Tipo Cliente</th><th>Serviço</th><th>Duração</th>
                        <th>Data/Hora</th><th>Endereço</th><th>Número</th><th>Complemento</th><th>Bairro</th><th>Cidade</th><th>Estado</th><th>CEP</th>
                        <th>Descrição</th><th>Status</th>
                        <th>Valor Chamado</th><th>Tipo Cobrança</th><th>KM Total</th><th>Taxa por KM</th><th>Valor KM</th><th>Despesas Extras</th><th>Detalhes Despesas</th>
                        <th>Total</th><th>Iniciado em</th><th>Finalizado em</th><th>Vencimento</th>
                        <th>Pagamento</th><th>NF #</th><th>Aprovado por</th><th>Cliente Final</th><th>Motivo Cancel.</th><th>Observações</th>
                      </tr></thead><tbody>
                        ${selectedTicketsList.map((ticket) => {
                          const normalized = normalizeStatus((ticket.status || '').toString());
                          const statusInfo = statusConfig[normalized] || statusConfig.pending;
                            const address = (() => {
                              const isEmpresaParceira = ticket.client?.type === 'EMPRESA_PARCEIRA';
                              if (isEmpresaParceira) {
                                return (ticket as any).serviceAddress || 'N/A';
                              } else {
                                // Lógica inteligente para evitar duplicação de cidade/estado
                                const addr = ((ticket as any).address || '').trim();
                                const city = ((ticket as any).city || '').trim();
                                const state = ((ticket as any).state || '').trim();
                                
                                let parts = [];
                                if (addr) parts.push(addr);
                                
                                // Só adiciona cidade se não estiver no endereço
                                if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
                                  parts.push(city);
                                }
                                
                                // Só adiciona estado se não estiver no endereço
                                if (state && !addr.toLowerCase().includes(state.toLowerCase())) {
                                  parts.push(state);
                                }
                                
                                return parts.length > 0 ? parts.join(', ') : 'N/A';
                              }
                            })();
                          const scheduledDate = ticket.scheduledFor
                            ? format(parseISO(ticket.scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'N/A';
                          const total = typeof ticket.totalAmount === 'number'
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.totalAmount)
                            : ticket.totalAmount || 'R$ 0,00';
                          const ticketValue = typeof ticket.ticketValue === 'number'
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.ticketValue)
                            : ticket.ticketValue || 'R$ 0,00';
                          const kmTotal = typeof ticket.kmTotal === 'number'
                            ? `${ticket.kmTotal} km`
                            : ticket.kmTotal || '0 km';
                          const kmRate = typeof ticket.kmRate === 'number'
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.kmRate)
                            : ticket.kmRate || 'R$ 0,00';
                          const kmValue = ticket.kmTotal && ticket.kmRate
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                parseFloat(String(ticket.kmTotal)) * parseFloat(String(ticket.kmRate || 0))
                              )
                            : 'R$ 0,00';
                          const extraExpenses = typeof ticket.extraExpenses === 'number'
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.extraExpenses)
                            : ticket.extraExpenses || 'R$ 0,00';
                          const clientType = ticket.client?.type === 'PF'
                            ? 'Pessoa Física'
                            : ticket.client?.type === 'PJ'
                            ? 'Pessoa Jurídica'
                            : ticket.client?.type === 'EMPRESA_PARCEIRA'
                            ? 'Empresa Parceira'
                            : 'N/A';
                          const duration = `${ticket.duration || 0} horas`;
                          const description = (ticket as any).description || 'N/A';
                          const startedAt = ticket.startedAt
                            ? format(parseISO(ticket.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'N/A';
                          const stoppedAt = ticket.stoppedAt
                            ? format(parseISO(ticket.stoppedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'N/A';
                          const dueDate = ticket.dueDate
                            ? (ticket.dueDate instanceof Date
                                ? format(ticket.dueDate, 'dd/MM/yyyy', { locale: ptBR })
                                : typeof ticket.dueDate === 'string'
                                ? format(parseISO(ticket.dueDate), 'dd/MM/yyyy', { locale: ptBR })
                                : 'N/A')
                            : 'N/A';
                          const paymentDate = ticket.paymentDate
                            ? (ticket.paymentDate instanceof Date
                                ? format(ticket.paymentDate, 'dd/MM/yyyy', { locale: ptBR })
                                : typeof ticket.paymentDate === 'string'
                                ? format(parseISO(ticket.paymentDate), 'dd/MM/yyyy', { locale: ptBR })
                                : 'N/A')
                            : 'N/A';
                          const finalClient = (ticket as any).finalClient || 'N/A';
                          const clientPhone = ticket.client?.phone || 'N/A';
                          const clientEmail = ticket.client?.email || 'N/A';
                          const clientDocument = ticket.client?.cpf || ticket.client?.cnpj || 'N/A';
                          const addressNumber =
                            (ticket as any).addressNumber ||
                            ticket.client?.addressNumber ||
                            'N/A';
                          const addressComplement =
                            (ticket as any).addressComplement ||
                            ticket.client?.addressComplement ||
                            'N/A';
                          const neighborhood =
                            (ticket as any).neighborhood ||
                            ticket.client?.neighborhood ||
                            'N/A';
                          const city =
                            (ticket as any).city || ticket.client?.city || 'N/A';
                          const state =
                            (ticket as any).state || ticket.client?.state || 'N/A';
                          const zipCode =
                            (ticket as any).zipCode ||
                            ticket.client?.zipCode ||
                            'N/A';
                          const observations = (ticket as any).observations || (ticket as any).notes || 'N/A';
                          const invoiceNumber = (ticket as any).invoiceNumber || 'N/A';
                          const chargeType = (ticket as any).chargeType || 'N/A';
                          const approvedBy = (ticket as any).approvedBy || 'N/A';
                          const expenseDetails = (ticket as any).expenseDetails || 'N/A';
                          const cancellationReason = (ticket as any).cancellationReason || 'N/A';
                          
                          return `<tr>
                            <td>${ticket.id?.slice(0, 8)}</td>
                            <td>#${(ticket as any).ticketNumber || 'N/A'}</td>
                            <td>${ticket.client?.name || 'N/A'}</td>
                            <td>${clientPhone}</td>
                            <td>${clientEmail}</td>
                            <td>${clientDocument}</td>
                            <td>${clientType}</td>
                            <td>${ticket.service?.name || 'N/A'}</td>
                            <td>${duration}</td>
                            <td>${scheduledDate}</td>
                            <td>${address}</td>
                            <td>${addressNumber}</td>
                            <td>${addressComplement}</td>
                            <td>${neighborhood}</td>
                            <td>${city}</td>
                            <td>${state}</td>
                            <td>${zipCode}</td>
                            <td>${description}</td>
                            <td>${statusInfo.label}</td>
                            <td>${ticketValue}</td>
                            <td>${chargeType}</td>
                            <td>${kmTotal}</td>
                            <td>${kmRate}</td>
                            <td>${kmValue}</td>
                            <td>${extraExpenses}</td>
                            <td>${expenseDetails}</td>
                            <td>${total}</td>
                            <td>${startedAt}</td>
                            <td>${stoppedAt}</td>
                            <td>${dueDate}</td>
                            <td>${paymentDate}</td>
                            <td>${invoiceNumber}</td>
                            <td>${approvedBy}</td>
                            <td>${finalClient}</td>
                            <td>${cancellationReason}</td>
                            <td>${observations}</td>
                          </tr>`;
                        }).join('')}
                      </tbody></table></body></html>
                `;
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                    printWindow.print();
                  }
                  toast({ title: 'PDF gerado', description: 'Use a opção de salvar como PDF na janela de impressão.' });
                }}
                className='flex items-center gap-2'
              >
                <FileText className='h-4 w-4' /> PDF
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  const headers = [
                    'ID', 'Ticket #', 'Cliente', 'Telefone', 'Email', 'CPF/CNPJ', 'Tipo Cliente', 'Serviço', 'Duração', 'Data/Hora',
                    'Endereço', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado', 'CEP', 'Descrição', 'Status',
                    'Valor Chamado', 'Tipo Cobrança', 'KM Total', 'Taxa por KM', 'Valor KM', 'Despesas Extras', 'Detalhes Despesas', 'Total',
                    'Iniciado em', 'Finalizado em', 'Vencimento', 'Pagamento', 'NF #', 'Aprovado por', 'Cliente Final', 'Motivo Cancel.', 'Observações'
                  ];
                  const rows = selectedTicketsList.map((ticket) => {
                    const normalized = normalizeStatus((ticket.status || '').toString());
                    const statusInfo = statusConfig[normalized] || statusConfig.pending;
                            const address = (() => {
                              const isEmpresaParceira = ticket.client?.type === 'EMPRESA_PARCEIRA';
                              if (isEmpresaParceira) {
                                return (ticket as any).serviceAddress || 'N/A';
                              } else {
                                // Lógica inteligente para evitar duplicação de cidade/estado
                                const addr = ((ticket as any).address || '').trim();
                                const city = ((ticket as any).city || '').trim();
                                const state = ((ticket as any).state || '').trim();
                                
                                let parts = [];
                                if (addr) parts.push(addr);
                                
                                // Só adiciona cidade se não estiver no endereço
                                if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
                                  parts.push(city);
                                }
                                
                                // Só adiciona estado se não estiver no endereço
                                if (state && !addr.toLowerCase().includes(state.toLowerCase())) {
                                  parts.push(state);
                                }
                                
                                return parts.length > 0 ? parts.join(', ') : 'N/A';
                              }
                            })();
                    const scheduledDate = ticket.scheduledFor
                      ? format(parseISO(ticket.scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const total = typeof ticket.totalAmount === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.totalAmount)
                      : ticket.totalAmount || 'R$ 0,00';
                    const ticketValue = typeof ticket.ticketValue === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.ticketValue)
                      : ticket.ticketValue || 'R$ 0,00';
                    const kmTotal = typeof ticket.kmTotal === 'number'
                      ? `${ticket.kmTotal} km`
                      : ticket.kmTotal || '0 km';
                    const kmRate = typeof ticket.kmRate === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.kmRate)
                      : ticket.kmRate || 'R$ 0,00';
                    const kmValue = ticket.kmTotal && ticket.kmRate
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          parseFloat(String(ticket.kmTotal)) * parseFloat(String(ticket.kmRate || 0))
                        )
                      : 'R$ 0,00';
                    const extraExpenses = typeof ticket.extraExpenses === 'number'
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticket.extraExpenses)
                      : ticket.extraExpenses || 'R$ 0,00';
                    const clientType = ticket.client?.type === 'PF'
                      ? 'Pessoa Física'
                      : ticket.client?.type === 'PJ'
                      ? 'Pessoa Jurídica'
                      : ticket.client?.type === 'EMPRESA_PARCEIRA'
                      ? 'Empresa Parceira'
                      : 'N/A';
                    const duration = `${ticket.duration || 0} horas`;
                    const description = (ticket as any).description || 'N/A';
                    const startedAt = ticket.startedAt
                      ? format(parseISO(ticket.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const stoppedAt = ticket.stoppedAt
                      ? format(parseISO(ticket.stoppedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'N/A';
                    const dueDate = ticket.dueDate
                      ? (ticket.dueDate instanceof Date
                          ? format(ticket.dueDate, 'dd/MM/yyyy', { locale: ptBR })
                          : typeof ticket.dueDate === 'string'
                          ? format(parseISO(ticket.dueDate), 'dd/MM/yyyy', { locale: ptBR })
                          : 'N/A')
                      : 'N/A';
                    const paymentDate = ticket.paymentDate
                      ? (ticket.paymentDate instanceof Date
                          ? format(ticket.paymentDate, 'dd/MM/yyyy', { locale: ptBR })
                          : typeof ticket.paymentDate === 'string'
                          ? format(parseISO(ticket.paymentDate), 'dd/MM/yyyy', { locale: ptBR })
                          : 'N/A')
                      : 'N/A';
                    const finalClient = (ticket as any).finalClient || 'N/A';
                    const clientPhone = ticket.client?.phone || 'N/A';
                    const clientEmail = ticket.client?.email || 'N/A';
                    const clientDocument = ticket.client?.cpf || ticket.client?.cnpj || 'N/A';
                    const addressNumber =
                      (ticket as any).addressNumber ||
                      ticket.client?.addressNumber ||
                      'N/A';
                    const addressComplement =
                      (ticket as any).addressComplement ||
                      ticket.client?.addressComplement ||
                      'N/A';
                    const neighborhood =
                      (ticket as any).neighborhood ||
                      ticket.client?.neighborhood ||
                      'N/A';
                    const city =
                      (ticket as any).city || ticket.client?.city || 'N/A';
                    const state =
                      (ticket as any).state || ticket.client?.state || 'N/A';
                    const zipCode =
                      (ticket as any).zipCode || ticket.client?.zipCode || 'N/A';
                    const observations = (ticket as any).observations || (ticket as any).notes || 'N/A';
                    const invoiceNumber = (ticket as any).invoiceNumber || 'N/A';
                    const chargeType = (ticket as any).chargeType || 'N/A';
                    const approvedBy = (ticket as any).approvedBy || 'N/A';
                    const expenseDetails = (ticket as any).expenseDetails || 'N/A';
                    const cancellationReason = (ticket as any).cancellationReason || 'N/A';

                    return [
                      ticket.id?.slice(0, 8),
                      `#${(ticket as any).ticketNumber || 'N/A'}`,
                      ticket.client?.name || 'N/A',
                      clientPhone,
                      clientEmail,
                      clientDocument,
                      clientType,
                      ticket.service?.name || 'N/A',
                      duration,
                      scheduledDate,
                      address,
                      addressNumber,
                      addressComplement,
                      neighborhood,
                      city,
                      state,
                      zipCode,
                      description,
                      statusInfo.label,
                      ticketValue,
                      chargeType,
                      kmTotal,
                      kmRate,
                      kmValue,
                      extraExpenses,
                      expenseDetails,
                      total,
                      startedAt,
                      stoppedAt,
                      dueDate,
                      paymentDate,
                      invoiceNumber,
                      approvedBy,
                      finalClient,
                      cancellationReason,
                      // observations,
                    ];
                  });
                  const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
                  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `chamados-${new Date().toISOString().split('T')[0]}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast({ title: 'Excel exportado', description: 'O arquivo foi baixado com sucesso.' });
                }}
                className='flex items-center gap-2'
              >
                <FileSpreadsheet className='h-4 w-4' /> Excel
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setEmailAddress('');
                  setShowEmailDialog(true);
                }}
                className='flex items-center gap-2'
              >
                <Mail className='h-4 w-4' /> Email
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setWhatsappNumber('');
                  setShowWhatsAppDialog(true);
                }}
                className='flex items-center gap-2'
              >
                <MessageCircle className='h-4 w-4' /> WhatsApp
              </Button>
            </div>
            <Button variant='outline' onClick={() => setShowBulkDetails(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Você está prestes a excluir {selectedTickets.size} chamado(s). Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='delete-reason'>Motivo da Exclusão *</Label>
              <Textarea
                id='delete-reason'
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder='Digite o motivo da exclusão...'
                required
                rows={3}
              />
            </div>
            {isGoogleAccount ? (
              <div className='space-y-2'>
                <Label htmlFor='delete-email'>Email de Confirmação *</Label>
                <Input
                  id='delete-email'
                  type='email'
                  value={deleteEmail}
                  onChange={(e) => setDeleteEmail(e.target.value)}
                  placeholder='Digite seu email para confirmar'
                  required
                />
                <p className='text-xs text-muted-foreground'>
                  É necessário informar seu email para excluir chamados (conta Google).
                </p>
              </div>
            ) : (
              <div className='space-y-2'>
                <Label htmlFor='delete-password'>Senha de Confirmação *</Label>
                <Input
                  id='delete-password'
                  type='password'
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder='Digite sua senha para confirmar'
                  required
                />
                <p className='text-xs text-muted-foreground'>
                  É necessário informar sua senha para excluir chamados.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteReason('');
                setDeletePassword('');
                setDeleteEmail('');
              }}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (!deleteReason.trim()) {
                  toast({
                    variant: 'destructive',
                    title: 'Campos obrigatórios',
                    description: 'Preencha o motivo da exclusão para continuar.',
                  });
                  return;
                }

                if (isGoogleAccount) {
                  if (!deleteEmail.trim()) {
                    toast({
                      variant: 'destructive',
                      title: 'Campos obrigatórios',
                      description: 'Preencha o email para continuar.',
                    });
                    return;
                  }
                } else {
                  if (!deletePassword) {
                    toast({
                      variant: 'destructive',
                      title: 'Campos obrigatórios',
                      description: 'Preencha a senha para continuar.',
                    });
                    return;
                  }
                }

                bulkDeleteMutation.mutate({
                  ticketIds: Array.from(selectedTickets),
                  password: isGoogleAccount ? undefined : deletePassword,
                  email: isGoogleAccount ? deleteEmail.trim() : undefined,
                  reason: deleteReason.trim(),
                  isGoogleAccount: isGoogleAccount || false,
                });
              }}
              disabled={
                bulkDeleteMutation.isPending || 
                !deleteReason.trim() || 
                (isGoogleAccount ? !deleteEmail.trim() : !deletePassword) ||
                isGoogleAccount === null
              }
            >
              {bulkDeleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

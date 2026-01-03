import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, CheckCircle2, MessageCircle, Mail, Loader2, Search, Calendar, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { useAuth } from '@/hooks/use-auth';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { buildServiceSummary, coerceServiceItems } from '@/utils/service-items';
import QRCode from 'qrcode';
import { buildPixPayload } from '@shared/pix';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FinancialRecord {
  id: string;
  ticketId?: string;
  clientId: string;
  clientName: string;
  ticketNumber?: string;
  invoiceNumber?: string;
  amount: number;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  completionDate?: string | null;
  paidAt?: string;
  daysOverdue?: number;
}

interface IntegrationSettings {
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixAccountHolder?: string | null;
}

const parseDateInput = (
  value: string | null | undefined,
  endOfDay = false
) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const time = endOfDay ? 'T23:59:59.999' : 'T00:00:00';
  const parsed = new Date(`${trimmed}${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface PaymentActionButtonsProps {
  ticketId?: string;
  financialRecordId?: string;
  clientId?: string;
  clientName: string;
  amount: number;
  description?: string;
  pixKey?: string | null;
  pixAccountHolder?: string | null;
  layout?: 'row' | 'grid';
}

function PaymentActionButtons({
  ticketId,
  financialRecordId,
  clientId,
  clientName,
  amount,
  description,
  pixKey,
  pixAccountHolder,
  layout = 'row',
}: PaymentActionButtonsProps) {
  const effectiveTicketId = ticketId || financialRecordId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { requirePaid } = usePaidAccess();
  const { user } = useAuth();
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const containerClassName =
    layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2';
  const buttonLayoutClassName =
    layout === 'grid' ? 'w-full justify-center' : '';

  const copyQrCodeToClipboard = async (dataUrl: string) => {
    if (!navigator.clipboard || !('ClipboardItem' in window)) {
      return false;
    }

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || 'image/png']: blob }),
    ]);
    return true;
  };

  if (!effectiveTicketId) {
    return null;
  }

  const hasPixKey = Boolean(pixKey && pixKey.trim());

  const handleEmitReceipt = async () => {
    try {
      let ticketDetails = null;
      let clientDetails = null;

      // Buscar detalhes do chamado se houver
      if (ticketId) {
        const response = await apiRequest('GET', `/api/tickets/${ticketId}`);
        if (response.ok) {
          ticketDetails = await response.json();
        }
      }

      // Buscar detalhes do cliente se houver clientId
      if (clientId) {
        const response = await apiRequest('GET', `/api/clients/${clientId}`);
        if (response.ok) {
          clientDetails = await response.json();
        }
      }

      const serviceItems = coerceServiceItems(
        ticketDetails?.serviceItems
      );
      const serviceSummary = buildServiceSummary(
        serviceItems,
        ticketDetails?.service?.name || description || 'Servico Prestado'
      );

      let pixData:
        | {
            key: string;
            payload: string;
            qrCodeDataUrl?: string;
            accountHolder?: string;
          }
        | undefined;

      if (pixKey && pixKey.trim()) {
        try {
          const ticketRef =
            ticketDetails?.ticketNumber || ticketId || financialRecordId || '';
          const normalizedRef = String(ticketRef)
            .replace('#', '')
            .replace(/\s/g, '');
          const merchantName =
            pixAccountHolder?.trim() || user?.companyName || 'RECEBEDOR';
          const merchantCity = user?.city || 'BRASIL';
          const pixPayload = buildPixPayload({
            pixKey: pixKey.trim(),
            amount,
            merchantName,
            merchantCity,
            txid: `TICKET${normalizedRef}`.slice(0, 25),
            description: `Chamado ${normalizedRef || 'sem-id'}`,
          });
          const qrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
            width: 220,
            margin: 1,
          });
          pixData = {
            key: pixKey.trim(),
            payload: pixPayload,
            qrCodeDataUrl,
            accountHolder: merchantName,
          };
        } catch (error) {
          console.warn('Erro ao gerar QR Code PIX:', error);
        }
      }

      setReceiptData({
        company: {
          name: user?.companyName || 'Sua Empresa',
          // logoUrl: user?.companyLogoUrl,
          cnpj: user?.cnpj,
          phone: user?.phone,
          address: `${user?.streetAddress || ''}, ${user?.addressNumber || ''} ${user?.neighborhood || ''}`,
          city: user?.city,
        },
        client: {
          name: clientName,
          phone: ticketDetails?.clientPhone || clientDetails?.phone,
          email: ticketDetails?.clientEmail || clientDetails?.email,
        },
        ticket: {
          id: ticketId || financialRecordId || '',
          serviceName: serviceSummary,
          serviceItems: serviceItems,
          date: new Date().toISOString(),
          amount: amount,
          description: ticketDetails?.description || description || '',
          warranty: ticketDetails?.warranty,
        },
        pix: pixData,
      });
      setIsReceiptModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar dados para recibo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados para o recibo.',
      });
    }
  };

  const receivePaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/receive-payment`,
        undefined
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao receber pagamento');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Pagamento recebido',
        description: `Pagamento de ${new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(amount)} recebido com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao receber pagamento',
        description: error.message || 'Não foi possível receber o pagamento.',
      });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/send-payment-link`,
        { phone: '', message: '' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar por WhatsApp');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.qrCodeDataUrl) {
        try {
          const copied = await copyQrCodeToClipboard(data.qrCodeDataUrl);
          if (copied) {
            toast({
              title: 'QR Code copiado',
              description: 'Cole o QR Code no WhatsApp junto com a mensagem.',
            });
          } else {
            window.open(data.qrCodeDataUrl, '_blank');
            toast({
              title: 'QR Code aberto',
              description: 'Baixe o QR Code para enviar junto com a mensagem.',
            });
          }
        } catch (error) {
          console.warn('Falha ao preparar QR Code:', error);
        }
      }

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
        toast({
          title: 'WhatsApp aberto',
          description: 'O WhatsApp foi aberto com a mensagem pronta para envio.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Nao foi possivel gerar o link do WhatsApp.',
        });
      }
    },
    onError: (error: any) => {
      const errorMessage =
        error.message || 'Nao foi possivel enviar por WhatsApp.';
      if (errorMessage.toLowerCase().includes('pix')) {
        toast({
          variant: 'destructive',
          title: 'Chave PIX nao configurada',
          description: 'Cadastre a chave PIX acima antes de enviar a cobranca.',
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar por WhatsApp',
        description: errorMessage,
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/send-payment-link-email`,
        { email: '', message: '' }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar por email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Email enviado',
        description: 'A mensagem com PIX foi enviada por email com sucesso.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error.message || 'Nao foi possivel enviar por email.';
      if (errorMessage.toLowerCase().includes('pix')) {
        toast({
          variant: 'destructive',
          title: 'Chave PIX nao configurada',
          description: 'Cadastre a chave PIX acima antes de enviar a cobranca.',
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar por email',
        description: errorMessage,
      });
    },
  });

  return (
    <div className={containerClassName}>
      <Button
        size='sm'
        variant='outline'
        onClick={() => receivePaymentMutation.mutate()}
        disabled={receivePaymentMutation.isPending}
        className={`flex items-center gap-2${buttonLayoutClassName ? ` ${buttonLayoutClassName}` : ''}`}
      >
        {receivePaymentMutation.isPending ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <CheckCircle2 className='h-4 w-4' />
        )}
        Receber
      </Button>

      <Button
        size='sm'
        variant='outline'
        onClick={handleEmitReceipt}
        className={`flex items-center gap-2${buttonLayoutClassName ? ` ${buttonLayoutClassName}` : ''}`}
      >
        <FileText className='h-4 w-4' />
        Recibo
      </Button>

      <Button
        size='sm'
        variant='outline'
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
          if (!hasPixKey) {
            toast({
              variant: 'destructive',
              title: 'Chave PIX nao configurada',
              description: 'Cadastre a chave PIX acima antes de enviar.',
            });
            return;
          }
          sendWhatsAppMutation.mutate();
        }}
        disabled={sendWhatsAppMutation.isPending}
        className={`flex items-center gap-2${buttonLayoutClassName ? ` ${buttonLayoutClassName}` : ''}`}
      >
        {sendWhatsAppMutation.isPending ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <MessageCircle className='h-4 w-4' />
        )}
        WhatsApp
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          if (!hasPixKey) {
            toast({
              variant: 'destructive',
              title: 'Chave PIX nao configurada',
              description: 'Cadastre a chave PIX acima antes de enviar.',
            });
            return;
          }
          sendEmailMutation.mutate();
        }}
        disabled={sendEmailMutation.isPending}
        className={`flex items-center gap-2${buttonLayoutClassName ? ` ${buttonLayoutClassName}` : ''}`}
      >
        {sendEmailMutation.isPending ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <Mail className='h-4 w-4' />
        )}
        Email
      </Button>

      {receiptData && (
        <ReceiptPreviewDialog
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setReceiptData(null);
          }}
          data={receiptData}
        />
      )}
    </div>
  );
}

export default function DashboardFinanceiro() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [dateFilter, setDateFilter] = useState<'payment' | 'completion'>('payment');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date();
    return format(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
      'yyyy-MM-dd'
    );
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrationSettings } = useQuery<IntegrationSettings>({
    queryKey: ['/api/integration-settings'],
  });

  const [pixKeyInput, setPixKeyInput] = useState('');

  useEffect(() => {
    setPixKeyInput(integrationSettings?.pixKey || '');
  }, [integrationSettings?.pixKey]);

  const updatePixMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        pixKey: pixKeyInput.trim() || null,
      };
      const response = await apiRequest(
        'PATCH',
        '/api/integration-settings',
        payload
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar chave PIX');
      }
      return response.json();
    },
    onSuccess: (data: IntegrationSettings) => {
      const updatedPixKey = (data?.pixKey || '').toString();
      if (updatedPixKey) {
        setPixKeyInput(updatedPixKey);
      }
      queryClient.setQueryData(['/api/integration-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['/api/integration-settings'] });
      toast({
        title: 'PIX atualizado',
        description: 'Chave PIX salva com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar PIX',
        description: error?.message || 'Nao foi possivel salvar a chave PIX.',
      });
    },
  });

  const savedPixKey = (integrationSettings?.pixKey || '').trim();
  const pixAccountHolder = integrationSettings?.pixAccountHolder || null;
  const isPixDirty = pixKeyInput.trim() !== savedPixKey;

  // Calcular datas baseado no período
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (period) {
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        // Para custom, usar o mês atual por enquanto
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
    }

    if (period === 'custom') {
      const customStart = parseDateInput(customStartDate);
      const customEnd = parseDateInput(customEndDate, true);
      if (customStart) startDate = customStart;
      if (customEnd) endDate = customEnd;
    }

    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }, [period, customStartDate, customEndDate]);

  const { data: financialRecords, isLoading } = useQuery<FinancialRecord[]>({
    queryKey: [
      '/api/financial-records',
      dateRange.startDate,
      dateRange.endDate,
      search,
      dateFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        type: 'receivable',
      });
      params.append('dateFilter', dateFilter);
      if (search) {
        params.append('search', search);
      }
      
      const response = await apiRequest(
        'GET',
        `/api/financial-records?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar registros financeiros');
      const data = await response.json();
      // Filtrar registros cancelados
      return data.filter((r: any) => r.status !== 'cancelled' && r.status !== 'CANCELADO');
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatDate = (date: string) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const isOverdue = due < now && (status === 'pending' || status === 'PENDENTE');
    const isPaid = status === 'paid' || status === 'PAGO';

    if (isPaid) {
      return (
        <Badge className='bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
          Paga
        </Badge>
      );
    }

    if (isOverdue) {
      return (
        <Badge className='bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'>
          Vencida
        </Badge>
      );
    }

    return (
      <Badge className='bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'>
        Pendente
      </Badge>
    );
  };

  const getInvoiceId = (record: FinancialRecord) => {
    if (record.invoiceNumber) return record.invoiceNumber;
    if (record.ticketNumber) return `#${record.ticketNumber}`;
    return `#${record.id.slice(0, 8)}`;
  };

  return (
    <div className='max-w-7xl mx-auto'>
      <PageHeader>
        <div className='max-w-7xl mx-auto w-full'>
          <div className='flex flex-wrap justify-between items-center gap-4 mb-0'>
            <div className='flex flex-col gap-1'>
              <p className='text-gray-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]'>
                Financeiro
              </p>
              <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal'>
                Gerencie seus recebimentos e pendências financeiras.
              </p>
            </div>
          </div>
        </div>
      </PageHeader>

      {/* Barra de busca e filtros */}
      <div className='flex flex-col gap-3 mb-6'>
        <div className='relative w-full'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <Input
            placeholder='Buscar faturas...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-10'
          />
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant={period === 'month' ? 'default' : 'outline'}
              onClick={() => setPeriod('month')}
              className='flex items-center gap-2'
            >
              Mes
            </Button>
            <Button
              variant={period === 'quarter' ? 'default' : 'outline'}
              onClick={() => setPeriod('quarter')}
              className='flex items-center gap-2'
            >
              Trimestre
            </Button>
            <Button
              variant={period === 'year' ? 'default' : 'outline'}
              onClick={() => setPeriod('year')}
              className='flex items-center gap-2'
            >
              Ano
            </Button>
            <Button
              variant={period === 'custom' ? 'default' : 'outline'}
              onClick={() => setPeriod('custom')}
              className='flex items-center gap-2'
            >
              <Calendar className='h-4 w-4' />
              Personalizado
            </Button>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-xs font-semibold text-gray-500'>
              Filtrar por
            </span>
            <Button
              variant={dateFilter === 'payment' ? 'default' : 'outline'}
              onClick={() => setDateFilter('payment')}
              size='sm'
              className='flex items-center gap-2'
            >
              Pagamento
            </Button>
            <Button
              variant={dateFilter === 'completion' ? 'default' : 'outline'}
              onClick={() => setDateFilter('completion')}
              size='sm'
              className='flex items-center gap-2'
            >
              Conclusao
            </Button>
          </div>
        </div>
      </div>

      {period === 'custom' && (
        <div className='grid gap-3 mb-6 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='finance-custom-start' className='text-sm font-medium'>
              Data inicial
            </Label>
            <Input
              id='finance-custom-start'
              type='date'
              value={customStartDate}
              onChange={(event) => {
                setCustomStartDate(event.target.value);
                setPeriod('custom');
              }}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='finance-custom-end' className='text-sm font-medium'>
              Data final
            </Label>
            <Input
              id='finance-custom-end'
              type='date'
              value={customEndDate}
              onChange={(event) => {
                setCustomEndDate(event.target.value);
                setPeriod('custom');
              }}
            />
          </div>
        </div>
      )}

      <Card className='p-4 mb-6'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div className='flex-1 space-y-2'>
            <Label htmlFor='pix-key' className='text-sm font-semibold'>
              Chave PIX do recebimento
            </Label>
            <Input
              id='pix-key'
              value={pixKeyInput}
              onChange={(e) => setPixKeyInput(e.target.value)}
              placeholder='ex: email@empresa.com'
              className='max-w-xl'
            />
            <p className='text-xs text-muted-foreground'>
              Essa chave sera usada para gerar o QR Code nos recibos e mensagens
              de cobranca.
            </p>
          </div>
          <Button
            onClick={() => updatePixMutation.mutate()}
            disabled={updatePixMutation.isPending || !isPixDirty}
            className='md:self-end'
          >
            {updatePixMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </Card>

      {/* Tabela de registros financeiros */}
      {isLoading ? (
        <Card className='p-6'>
          <div className='space-y-4'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
            ))}
          </div>
        </Card>
      ) : financialRecords && financialRecords.length > 0 ? (
        <div className='space-y-4'>
          <div className='space-y-4 md:hidden'>
            {financialRecords.map((record) => (
              <Card key={record.id} className='p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Fatura</p>
                    <p className='font-mono text-sm'>{getInvoiceId(record)}</p>
                  </div>
                  {getStatusBadge(
                    record.status,
                    record.paymentDate || record.dueDate
                  )}
                </div>
                <div className='mt-3'>
                  <p className='text-xs text-muted-foreground'>Cliente</p>
                  <p className='text-base font-semibold'>
                    {record.clientName}
                  </p>
                </div>
                <div className='mt-3 grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Valor</p>
                    <p className='font-semibold'>
                      {formatCurrency(record.amount)}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Pagamento</p>
                    <p>{formatDate(record.paymentDate || record.dueDate)}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Conclusao</p>
                    <p>{formatDate(record.completionDate || '')}</p>
                  </div>
                </div>
                <div className='mt-4'>
                  <PaymentActionButtons
                    ticketId={record.ticketId}
                    financialRecordId={record.id}
                    clientId={record.clientId}
                    clientName={record.clientName}
                    amount={record.amount}
                    description={record.description}
                    pixKey={savedPixKey || null}
                    pixAccountHolder={pixAccountHolder}
                    layout='grid'
                  />
                </div>
              </Card>
            ))}
          </div>
          <div className='border rounded-lg overflow-hidden bg-white dark:bg-gray-900 hidden md:block'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FATURA ID</TableHead>
                <TableHead>CLIENTE</TableHead>
                <TableHead>VALOR</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>PAGAMENTO</TableHead>
                <TableHead>CONCLUSAO</TableHead>
                <TableHead>ACOES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className='font-mono text-sm'>
                    {getInvoiceId(record)}
                  </TableCell>
                  <TableCell className='font-medium'>
                    {record.clientName}
                  </TableCell>
                  <TableCell className='font-semibold'>
                    {formatCurrency(record.amount)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(
                      record.status,
                      record.paymentDate || record.dueDate
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(record.paymentDate || record.dueDate)}
                  </TableCell>
                  <TableCell>
                    {formatDate(record.completionDate || '')}
                  </TableCell>
                  <TableCell>
                    <PaymentActionButtons
                      ticketId={record.ticketId}
                      financialRecordId={record.id}
                      clientId={record.clientId}
                      clientName={record.clientName}
                      amount={record.amount}
                      description={record.description}
                      pixKey={savedPixKey || null}
                      pixAccountHolder={pixAccountHolder}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      ) : (
        <Card className='p-12'>
          <div className='text-center'>
            <DollarSign className='h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4' />
            <h3 className='text-lg font-semibold mb-2'>
              Nenhum registro financeiro encontrado
            </h3>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {search
                ? 'Nenhum resultado encontrado para sua busca.'
                : 'Os registros financeiros aparecerão aqui quando houver chamados finalizados.'}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}








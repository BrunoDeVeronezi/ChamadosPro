import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, CheckCircle2, MessageCircle, Mail, Loader2, Search, Calendar, FileText, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { useAuth } from '@/hooks/use-auth';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { buildServiceSummary, coerceServiceItems } from '@/utils/service-items';
import QRCode from 'qrcode';
import { buildPixPayload } from '@shared/pix';
import { fetchCepData } from '@/services/CepService';
import { maskCNPJ, maskCPF, maskCEP, maskPhone } from '@/lib/masks';
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

interface MercadoPagoStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  providerUserId?: string | null;
  publicKey?: string | null;
  scope?: string | null;
  tokenExpiresAt?: string | null;
}

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  phoneNumberId?: string | null;
  phoneNumber?: string | null;
  businessAccountId?: string | null;
  tokenExpiresAt?: string | null;
}

interface WhatsAppConfig {
  configured: boolean;
  appId?: string | null;
  configId?: string | null;
  redirectUri?: string | null;
  scope?: string | null;
  graphVersion?: string | null;
}

type KycFormState = {
  firstName: string;
  lastName: string;
  companyName: string;
  document: string;
  documentType: 'cpf' | 'cnpj' | null;
  birthDate: string;
  phone: string;
  zipCode: string;
  streetAddress: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type FacebookLoginResponse = {
  status?: string;
  authResponse?: {
    code?: string;
  };
};

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, any>) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, any>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<void> | null = null;

const loadFacebookSdk = (appId: string, version: string) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SDK nao disponivel.'));
  }
  if (window.FB) {
    return Promise.resolve();
  }
  if (facebookSdkPromise) {
    return facebookSdkPromise;
  }

  facebookSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error('SDK nao inicializado.'));
        return;
      }
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version,
      });
      resolve();
    };

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.onerror = () => reject(new Error('Falha ao carregar o SDK.'));
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
};

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
  const [receiptAutoShare, setReceiptAutoShare] = useState<
    'whatsapp' | null
  >(null);
  const [receiptShareMessage, setReceiptShareMessage] = useState('');
  const [receiptWhatsAppPhone, setReceiptWhatsAppPhone] = useState('');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [chargeChannel, setChargeChannel] = useState<'whatsapp' | 'email'>(
    'whatsapp'
  );
  const [chargeContact, setChargeContact] = useState('');
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

  const handleEmitReceipt = async (autoShare?: 'whatsapp') => {
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
      const ticketRef =
        ticketDetails?.ticketNumber ||
        ticketId ||
        financialRecordId ||
        'sem-id';
      const shareMessage = `Segue o recibo do chamado ${ticketRef}.`;

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

      setReceiptShareMessage(shareMessage);
      setReceiptWhatsAppPhone(
        ticketDetails?.clientPhone || clientDetails?.phone || ''
      );
      setReceiptAutoShare(autoShare || null);
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
      setReceiveDialogOpen(false);
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
    mutationFn: async ({
      phone,
      message,
      provider,
    }: {
      phone?: string;
      message?: string;
      provider?: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/send-payment-link`,
        {
          phone: phone || '',
          message: message || undefined,
          provider: provider || 'mercadopago',
        }
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
      setReceiveDialogOpen(false);
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
    mutationFn: async ({
      email,
      message,
      provider,
    }: {
      email: string;
      message?: string;
      provider?: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/send-payment-link-email`,
        {
          email,
          message: message || undefined,
          provider: provider || 'mercadopago',
        }
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
        description: 'A cobranca foi enviada por email com sucesso.',
      });
      setReceiveDialogOpen(false);
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

  const copyPaymentLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${effectiveTicketId}/send-payment-link`,
        {
          provider: 'mercadopago',
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar link de pagamento');
      }
      return response.json();
    },
    onSuccess: async (data: any) => {
      const paymentUrl = data?.paymentUrl || '';
      if (!paymentUrl) {
        toast({
          variant: 'destructive',
          title: 'Link indisponivel',
          description: 'Nao foi possivel gerar o link de pagamento.',
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(paymentUrl);
        toast({
          title: 'Link copiado',
          description: 'Cole o link onde desejar.',
        });
      } else {
        window.prompt('Copie o link de pagamento:', paymentUrl);
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao copiar link',
        description: error.message || 'Nao foi possivel gerar o link.',
      });
    },
  });

  const ensureWhatsAppAccess = (provider: 'mercadopago' | 'pix' = 'pix') => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description:
          'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return false;
    }
    if (provider === 'pix' && !hasPixKey) {
      toast({
        variant: 'destructive',
        title: 'Chave PIX nao configurada',
        description: 'Cadastre a chave PIX acima antes de enviar.',
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!receiveDialogOpen) {
      setChargeChannel('whatsapp');
      setChargeContact('');
    }
  }, [receiveDialogOpen]);

  const handleWhatsAppText = () => {
    if (!ensureWhatsAppAccess('mercadopago')) {
      return;
    }
    sendWhatsAppMutation.mutate({
      phone: '',
      message: undefined,
      provider: 'mercadopago',
    });
  };

  const handleWhatsAppImage = () => {
    if (!ensureWhatsAppAccess('pix')) {
      return;
    }
    handleEmitReceipt('whatsapp');
  };

  return (
    <div className={containerClassName}>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setReceiveDialogOpen(true)}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size='sm'
            variant='outline'
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={handleWhatsAppText}>
            Texto (link)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleWhatsAppImage}>
            Imagem (recibo)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size='sm'
        variant='outline'
        onClick={() => {
          setChargeChannel('email');
          setReceiveDialogOpen(true);
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

      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className='max-w-lg bg-white dark:bg-[#101722] border-gray-200 dark:border-slate-800'>
          <DialogHeader>
            <DialogTitle className='text-lg font-semibold'>
              Receber pagamento
            </DialogTitle>
            <DialogDescription className='text-sm text-[#60708a] dark:text-slate-400'>
              Escolha se deseja registrar o pagamento manualmente ou enviar a
              cobranca pelo Mercado Pago.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                    Pagamento manual
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    Registre como pago em dinheiro ou outro metodo.
                  </p>
                </div>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => receivePaymentMutation.mutate()}
                  disabled={receivePaymentMutation.isPending}
                >
                  {receivePaymentMutation.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    'Registrar pagamento'
                  )}
                </Button>
              </div>
            </div>

            <div className='rounded-xl border border-slate-200/70 bg-white p-4 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                    Enviar cobranca Mercado Pago
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    O cliente escolhe PIX ou cartao no link de pagamento.
                  </p>
                </div>
                <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'>
                  Pix/cartao
                </Badge>
              </div>

              <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant={chargeChannel === 'whatsapp' ? 'default' : 'outline'}
                  onClick={() => setChargeChannel('whatsapp')}
                >
                  WhatsApp
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant={chargeChannel === 'email' ? 'default' : 'outline'}
                  onClick={() => setChargeChannel('email')}
                >
                  Email
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => copyPaymentLinkMutation.mutate()}
                  disabled={copyPaymentLinkMutation.isPending}
                  className='gap-2'
                >
                  {copyPaymentLinkMutation.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                  Copiar link
                </Button>
              </div>

              <div className='mt-3 space-y-2'>
                <Label htmlFor='charge-contact'>
                  {chargeChannel === 'email'
                    ? 'Email do cliente'
                    : 'Telefone do cliente (opcional)'}
                </Label>
                <Input
                  id='charge-contact'
                  type={chargeChannel === 'email' ? 'email' : 'tel'}
                  value={chargeContact}
                  onChange={(event) => setChargeContact(event.target.value)}
                  placeholder={
                    chargeChannel === 'email'
                      ? 'cliente@empresa.com'
                      : '(00) 00000-0000'
                  }
                />
                <p className='text-xs text-slate-500 dark:text-slate-400'>
                  {chargeChannel === 'email'
                    ? 'Informe o email para envio automatico.'
                    : 'Se deixar em branco, voce escolhe o contato no WhatsApp.'}
                </p>
              </div>

              <div className='mt-4 flex justify-end'>
                <Button
                  type='button'
                  size='sm'
                  onClick={() => {
                    if (chargeChannel === 'email') {
                      if (!chargeContact || !chargeContact.includes('@')) {
                        toast({
                          variant: 'destructive',
                          title: 'Email invalido',
                          description: 'Informe um email valido para enviar.',
                        });
                        return;
                      }
                      sendEmailMutation.mutate({
                        email: chargeContact,
                        provider: 'mercadopago',
                      });
                    } else {
                      sendWhatsAppMutation.mutate({
                        phone: chargeContact.replace(/\D/g, ''),
                        provider: 'mercadopago',
                      });
                    }
                  }}
                  disabled={
                    sendWhatsAppMutation.isPending || sendEmailMutation.isPending
                  }
                  className='bg-blue-600 text-white hover:bg-blue-700'
                >
                  {sendWhatsAppMutation.isPending ||
                  sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Enviando...
                    </>
                  ) : (
                    'Enviar cobranca'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {receiptData && (
        <ReceiptPreviewDialog
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setReceiptData(null);
            setReceiptAutoShare(null);
            setReceiptShareMessage('');
            setReceiptWhatsAppPhone('');
          }}
          data={receiptData}
          autoShare={receiptAutoShare}
          shareMessage={receiptShareMessage}
          whatsappPhone={receiptWhatsAppPhone}
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
  const { user } = useAuth();

  const [isKycDialogOpen, setIsKycDialogOpen] = useState(false);
  const [pendingMpConnect, setPendingMpConnect] = useState(false);
  const [isConnectingMp, setIsConnectingMp] = useState(false);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [kycErrors, setKycErrors] = useState<Record<string, string>>({});
  const [kycForm, setKycForm] = useState<KycFormState>({
    firstName: '',
    lastName: '',
    companyName: '',
    document: '',
    documentType: null,
    birthDate: '',
    phone: '',
    zipCode: '',
    streetAddress: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  const { data: integrationSettings } = useQuery<IntegrationSettings>({
    queryKey: ['/api/integration-settings'],
  });

  const { data: mercadoPagoStatus, isLoading: isLoadingMpStatus } =
    useQuery<MercadoPagoStatus>({
      queryKey: ['/api/mercadopago/status'],
    });

  const { data: whatsappStatus, isLoading: isLoadingWhatsAppStatus } =
    useQuery<WhatsAppStatus>({
      queryKey: ['/api/whatsapp/status'],
    });

  const [pixKeyInput, setPixKeyInput] = useState('');

  useEffect(() => {
    setPixKeyInput(integrationSettings?.pixKey || '');
  }, [integrationSettings?.pixKey]);

  useEffect(() => {
    if (!isKycDialogOpen || !user) return;

    const rawDocument = String(user.cnpj || user.cpf || '');
    const documentDigits = rawDocument.replace(/\D/g, '');
    let documentType: 'cpf' | 'cnpj' | null = null;
    let documentMasked = '';

    if (documentDigits.length === 11) {
      documentType = 'cpf';
      documentMasked = maskCPF(documentDigits);
    } else if (documentDigits.length === 14) {
      documentType = 'cnpj';
      documentMasked = maskCNPJ(documentDigits);
    }

    const phoneValue = user.phone ? String(user.phone) : '';
    const normalizedPhone =
      phoneValue && (phoneValue.includes('(') || phoneValue.includes('-'))
        ? phoneValue
        : maskPhone(phoneValue);

    const zipValue = user.zipCode ? String(user.zipCode) : '';
    const normalizedZip = zipValue ? maskCEP(zipValue) : '';

    let birthDate = '';
    if (user.birthDate) {
      const parsedDate = new Date(user.birthDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        birthDate = format(parsedDate, 'yyyy-MM-dd');
      }
    }

    setKycErrors({});
    setKycForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      companyName: user.companyName || '',
      document: documentMasked,
      documentType,
      birthDate,
      phone: normalizedPhone,
      zipCode: normalizedZip,
      streetAddress: user.streetAddress || '',
      addressNumber: user.addressNumber || '',
      addressComplement: user.addressComplement || '',
      neighborhood: user.neighborhood || '',
      city: user.city || '',
      state: user.state || '',
    });
  }, [isKycDialogOpen, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpStatus = params.get('mp');

    if (!mpStatus) return;

    if (mpStatus === 'connected') {
      toast({
        title: 'Mercado Pago conectado',
        description: 'Recebimentos automaticos habilitados.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mercadopago/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }

    if (mpStatus === 'error') {
      toast({
        variant: 'destructive',
        title: 'Falha ao conectar Mercado Pago',
        description: 'Tente novamente.',
      });
    }

    params.delete('mp');
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
    );
  }, [toast, queryClient]);

  const missingKycLabels = useMemo(() => {
    if (!user) return [];
    const missing: string[] = [];
    const docDigits = String(user.cpf || user.cnpj || '')
      .replace(/\D/g, '')
      .trim();
    const docKind = user.cpf
      ? 'cpf'
      : user.cnpj
        ? 'cnpj'
        : null;
    const phoneDigits = String(user.phone || '').replace(/\D/g, '');
    const zipDigits = String(user.zipCode || '').replace(/\D/g, '');

    if (!user.firstName) missing.push('Nome');
    if (!user.lastName) missing.push('Sobrenome');
    if (!user.companyName) missing.push('Empresa');
    if (!docDigits) missing.push('CPF/CNPJ');
    if (docKind === 'cpf' && !user.birthDate) missing.push('Nascimento');
    if (!phoneDigits || phoneDigits.length < 10) missing.push('Telefone');
    if (!zipDigits || zipDigits.length < 8) missing.push('CEP');
    if (!user.streetAddress) missing.push('Endereco');
    if (!user.addressNumber) missing.push('Numero');
    if (!user.neighborhood) missing.push('Bairro');
    if (!user.city) missing.push('Cidade');
    if (!user.state) missing.push('UF');

    return missing;
  }, [user]);

  const isDocumentLocked = Boolean(user?.cpf || user?.cnpj);

  const updateKycField = (field: keyof KycFormState, value: string) => {
    setKycForm((prev) => ({ ...prev, [field]: value }));
    setKycErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleKycDocumentChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      setKycForm((prev) => ({
        ...prev,
        document: maskCPF(digits),
        documentType: 'cpf',
      }));
    } else {
      setKycForm((prev) => ({
        ...prev,
        document: maskCNPJ(digits),
        documentType: 'cnpj',
      }));
    }
    setKycErrors((prev) => {
      if (!prev.document) return prev;
      const next = { ...prev };
      delete next.document;
      return next;
    });
  };

  const handleKycPhoneChange = (value: string) => {
    updateKycField('phone', maskPhone(value));
  };

  const handleKycZipChange = (value: string) => {
    updateKycField('zipCode', maskCEP(value));
  };

  const handleKycZipBlur = async () => {
    const cleanCep = kycForm.zipCode.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const cepData = await fetchCepData(cleanCep);
      if (cepData) {
        setKycForm((prev) => ({
          ...prev,
          zipCode: maskCEP(cepData.cep || cleanCep),
          streetAddress: cepData.street || prev.streetAddress,
          neighborhood: cepData.neighborhood || prev.neighborhood,
          city: cepData.city || prev.city,
          state: cepData.state || prev.state,
          addressComplement:
            cepData.complement || prev.addressComplement,
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const validateKycForm = () => {
    const nextErrors: Record<string, string> = {};
    const docDigits = kycForm.document.replace(/\D/g, '');
    const phoneDigits = kycForm.phone.replace(/\D/g, '');
    const zipDigits = kycForm.zipCode.replace(/\D/g, '');

    if (!kycForm.firstName.trim()) nextErrors.firstName = 'Informe o nome.';
    if (!kycForm.lastName.trim()) nextErrors.lastName = 'Informe o sobrenome.';
    if (!kycForm.companyName.trim())
      nextErrors.companyName = 'Informe a empresa.';

    if (!docDigits) {
      nextErrors.document = 'Informe CPF ou CNPJ.';
    } else if (docDigits.length !== 11 && docDigits.length !== 14) {
      nextErrors.document = 'Documento invalido.';
    }

    if (!phoneDigits || phoneDigits.length < 10) {
      nextErrors.phone = 'Telefone com DDD obrigatorio.';
    }

    if (kycForm.documentType === 'cpf' && !kycForm.birthDate) {
      nextErrors.birthDate = 'Informe a data de nascimento.';
    }

    if (!zipDigits || zipDigits.length < 8) {
      nextErrors.zipCode = 'Informe o CEP.';
    }
    if (!kycForm.streetAddress.trim()) {
      nextErrors.streetAddress = 'Informe o endereco.';
    }
    if (!kycForm.addressNumber.trim()) {
      nextErrors.addressNumber = 'Informe o numero.';
    }
    if (!kycForm.neighborhood.trim()) {
      nextErrors.neighborhood = 'Informe o bairro.';
    }
    if (!kycForm.city.trim()) {
      nextErrors.city = 'Informe a cidade.';
    }
    if (!kycForm.state.trim() || kycForm.state.trim().length < 2) {
      nextErrors.state = 'Informe a UF.';
    }

    return nextErrors;
  };

  const startMercadoPagoOAuth = async () => {
    setIsConnectingMp(true);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const response = await apiRequest(
        'GET',
        `/api/mercadopago/oauth/start?returnTo=${encodeURIComponent(returnTo)}`,
        undefined
      );
      const data = await response.json();

      if (!data?.url) {
        throw new Error('URL de autorizacao nao recebida.');
      }

      window.location.href = data.url;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar Mercado Pago',
        description: error?.message || 'Nao foi possivel iniciar a conexao.',
      });
      setIsConnectingMp(false);
    }
  };

  const handleConnectMercadoPago = async () => {
    if (isConnectingMp) return;
    if (!mercadoPagoStatus?.configured) {
      toast({
        variant: 'destructive',
        title: 'Mercado Pago nao configurado',
        description: 'Configure as credenciais antes de conectar.',
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Usuario nao identificado',
        description: 'Recarregue a pagina e tente novamente.',
      });
      return;
    }

    if (missingKycLabels.length > 0) {
      setPendingMpConnect(true);
      setIsKycDialogOpen(true);
      return;
    }

    await startMercadoPagoOAuth();
  };

  const handleConnectWhatsApp = async () => {
    if (isConnectingWhatsApp) return;

    if (whatsappStatus?.configured === false) {
      toast({
        variant: 'destructive',
        title: 'WhatsApp nao configurado',
        description: 'Configure o app do Meta antes de conectar.',
      });
      return;
    }

    setIsConnectingWhatsApp(true);
    try {
      const configResponse = await apiRequest('GET', '/api/whatsapp/config');
      const configData = (await configResponse.json()) as WhatsAppConfig;

      if (!configResponse.ok || !configData?.configured) {
        throw new Error('Configuracao do WhatsApp nao encontrada.');
      }

      if (!configData.appId || !configData.configId) {
        throw new Error('App ID ou configuracao ausente.');
      }

      await loadFacebookSdk(
        configData.appId,
        configData.graphVersion || 'v21.0'
      );

      if (!window.FB) {
        throw new Error('SDK do Facebook nao carregado.');
      }

      const loginResponse = await new Promise<FacebookLoginResponse>(
        (resolve) => {
          window.FB?.login(
            (response) => resolve(response),
            {
              config_id: configData.configId,
              response_type: 'code',
              override_default_response_type: true,
              scope: configData.scope,
              redirect_uri: configData.redirectUri,
            }
          );
        }
      );

      const code = loginResponse?.authResponse?.code;
      if (!code) {
        throw new Error('Autorizacao cancelada ou codigo ausente.');
      }

      const exchangeResponse = await apiRequest(
        'POST',
        '/api/whatsapp/embedded/exchange',
        { code }
      );
      const exchangeData = await exchangeResponse.json();

      if (!exchangeResponse.ok) {
        throw new Error(
          exchangeData?.message || 'Falha ao conectar o WhatsApp.'
        );
      }

      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      toast({
        title: 'WhatsApp conectado',
        description: 'Conta WhatsApp Business vinculada com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao conectar WhatsApp',
        description: error?.message || 'Tente novamente.',
      });
    } finally {
      setIsConnectingWhatsApp(false);
    }
  };

  const handleKycSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateKycForm();
    setKycErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Preencha os campos obrigatorios para continuar.',
      });
      return;
    }

    setIsSubmittingKyc(true);
    try {
      const cleanDocument = kycForm.document.replace(/\D/g, '');
      const cleanPhone = kycForm.phone.replace(/\D/g, '');
      const cleanZip = kycForm.zipCode.replace(/\D/g, '');

      await apiRequest('POST', '/api/profile/complete', {
        kycRequired: true,
        firstName: kycForm.firstName.trim(),
        lastName: kycForm.lastName.trim(),
        companyName: kycForm.companyName.trim(),
        phone: cleanPhone,
        cpf: kycForm.documentType === 'cpf' ? cleanDocument : undefined,
        cnpj: kycForm.documentType === 'cnpj' ? cleanDocument : undefined,
        birthDate:
          kycForm.documentType === 'cpf' ? kycForm.birthDate : undefined,
        zipCode: cleanZip,
        streetAddress: kycForm.streetAddress.trim(),
        addressNumber: kycForm.addressNumber.trim(),
        addressComplement: kycForm.addressComplement.trim(),
        neighborhood: kycForm.neighborhood.trim(),
        city: kycForm.city.trim(),
        state: kycForm.state.trim().toUpperCase(),
      });

      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Dados atualizados',
        description: 'Agora voce pode conectar o Mercado Pago.',
      });
      setIsKycDialogOpen(false);

      if (pendingMpConnect) {
        setPendingMpConnect(false);
        await startMercadoPagoOAuth();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar dados',
        description: error?.message || 'Nao foi possivel salvar.',
      });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

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
  const mpStatusLabel = isLoadingMpStatus
    ? 'Verificando'
    : mercadoPagoStatus?.connected
      ? 'Conectado'
      : 'Desconectado';
  const mpStatusBadgeClass = mercadoPagoStatus?.connected
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300';
  const canConnectMp = mercadoPagoStatus?.configured !== false;
  const whatsappStatusLabel = isLoadingWhatsAppStatus
    ? 'Verificando'
    : whatsappStatus?.connected
      ? 'Conectado'
      : 'Desconectado';
  const whatsappStatusBadgeClass = whatsappStatus?.connected
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300';
  const canConnectWhatsApp = whatsappStatus?.configured !== false;

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
    <>
      <Dialog
        open={isKycDialogOpen}
        onOpenChange={(open) => {
          setIsKycDialogOpen(open);
          if (!open) {
            setPendingMpConnect(false);
          }
        }}
      >
        <DialogContent className='max-w-3xl max-h-[90vh] min-h-0 overflow-hidden !flex !flex-col'>
          <DialogHeader>
            <DialogTitle>Complete seus dados</DialogTitle>
            <DialogDescription>
              Preencha os campos obrigatorios para conectar o Mercado Pago.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleKycSubmit} className='flex min-h-0 flex-col gap-4'>
            <div className='flex-1 space-y-4 overflow-y-auto pr-2'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-first-name' className='text-sm font-medium'>
                    Nome *
                  </Label>
                  <Input
                    id='kyc-first-name'
                    value={kycForm.firstName}
                    onChange={(event) =>
                      updateKycField('firstName', event.target.value)
                    }
                    className={
                      kycErrors.firstName
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.firstName && (
                    <p className='text-xs text-red-500'>{kycErrors.firstName}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-last-name' className='text-sm font-medium'>
                    Sobrenome *
                  </Label>
                  <Input
                    id='kyc-last-name'
                    value={kycForm.lastName}
                    onChange={(event) =>
                      updateKycField('lastName', event.target.value)
                    }
                    className={
                      kycErrors.lastName
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.lastName && (
                    <p className='text-xs text-red-500'>{kycErrors.lastName}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-company' className='text-sm font-medium'>
                    Empresa *
                  </Label>
                  <Input
                    id='kyc-company'
                    value={kycForm.companyName}
                    onChange={(event) =>
                      updateKycField('companyName', event.target.value)
                    }
                    className={
                      kycErrors.companyName
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.companyName && (
                    <p className='text-xs text-red-500'>
                      {kycErrors.companyName}
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-email' className='text-sm font-medium'>
                    Email
                  </Label>
                  <Input id='kyc-email' value={user?.email || ''} disabled />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-document' className='text-sm font-medium'>
                    CPF ou CNPJ *
                  </Label>
                  <Input
                    id='kyc-document'
                    value={kycForm.document}
                    onChange={(event) =>
                      handleKycDocumentChange(event.target.value)
                    }
                    placeholder={
                      kycForm.documentType === 'cnpj'
                        ? '00.000.000/0000-00'
                        : '000.000.000-00'
                    }
                    disabled={isDocumentLocked}
                    className={
                      kycErrors.document
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {isDocumentLocked && (
                    <p className='text-xs text-muted-foreground'>
                      Documento ja cadastrado.
                    </p>
                  )}
                  {kycErrors.document && (
                    <p className='text-xs text-red-500'>{kycErrors.document}</p>
                  )}
                </div>
                {kycForm.documentType === 'cpf' && (
                  <div className='space-y-2'>
                    <Label htmlFor='kyc-birth' className='text-sm font-medium'>
                      Data de nascimento *
                    </Label>
                    <Input
                      id='kyc-birth'
                      type='date'
                      value={kycForm.birthDate}
                      onChange={(event) =>
                        updateKycField('birthDate', event.target.value)
                      }
                      className={
                        kycErrors.birthDate
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : ''
                      }
                      required
                    />
                    {kycErrors.birthDate && (
                      <p className='text-xs text-red-500'>
                        {kycErrors.birthDate}
                      </p>
                    )}
                  </div>
                )}
                <div className='space-y-2'>
                  <Label htmlFor='kyc-phone' className='text-sm font-medium'>
                    Telefone *
                  </Label>
                  <Input
                    id='kyc-phone'
                    value={kycForm.phone}
                    onChange={(event) =>
                      handleKycPhoneChange(event.target.value)
                    }
                    placeholder='(00) 00000-0000'
                    className={
                      kycErrors.phone
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.phone && (
                    <p className='text-xs text-red-500'>{kycErrors.phone}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-cep' className='text-sm font-medium'>
                    CEP *
                  </Label>
                  <Input
                    id='kyc-cep'
                    value={kycForm.zipCode}
                    onChange={(event) => handleKycZipChange(event.target.value)}
                    onBlur={handleKycZipBlur}
                    placeholder='00000-000'
                    className={
                      kycErrors.zipCode
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {isFetchingCep && (
                    <p className='text-xs text-muted-foreground'>
                      Buscando CEP...
                    </p>
                  )}
                  {kycErrors.zipCode && (
                    <p className='text-xs text-red-500'>{kycErrors.zipCode}</p>
                  )}
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='kyc-street' className='text-sm font-medium'>
                    Endereco *
                  </Label>
                  <Input
                    id='kyc-street'
                    value={kycForm.streetAddress}
                    onChange={(event) =>
                      updateKycField('streetAddress', event.target.value)
                    }
                    className={
                      kycErrors.streetAddress
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.streetAddress && (
                    <p className='text-xs text-red-500'>
                      {kycErrors.streetAddress}
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-number' className='text-sm font-medium'>
                    Numero *
                  </Label>
                  <Input
                    id='kyc-number'
                    value={kycForm.addressNumber}
                    onChange={(event) =>
                      updateKycField('addressNumber', event.target.value)
                    }
                    className={
                      kycErrors.addressNumber
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.addressNumber && (
                    <p className='text-xs text-red-500'>
                      {kycErrors.addressNumber}
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-complement' className='text-sm font-medium'>
                    Complemento
                  </Label>
                  <Input
                    id='kyc-complement'
                    value={kycForm.addressComplement}
                    onChange={(event) =>
                      updateKycField('addressComplement', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-neighborhood' className='text-sm font-medium'>
                    Bairro *
                  </Label>
                  <Input
                    id='kyc-neighborhood'
                    value={kycForm.neighborhood}
                    onChange={(event) =>
                      updateKycField('neighborhood', event.target.value)
                    }
                    className={
                      kycErrors.neighborhood
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.neighborhood && (
                    <p className='text-xs text-red-500'>
                      {kycErrors.neighborhood}
                    </p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-city' className='text-sm font-medium'>
                    Cidade *
                  </Label>
                  <Input
                    id='kyc-city'
                    value={kycForm.city}
                    onChange={(event) =>
                      updateKycField('city', event.target.value)
                    }
                    className={
                      kycErrors.city
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.city && (
                    <p className='text-xs text-red-500'>{kycErrors.city}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='kyc-state' className='text-sm font-medium'>
                    UF *
                  </Label>
                  <Input
                    id='kyc-state'
                    value={kycForm.state}
                    onChange={(event) =>
                      updateKycField('state', event.target.value.toUpperCase())
                    }
                    className={
                      kycErrors.state
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }
                    required
                  />
                  {kycErrors.state && (
                    <p className='text-xs text-red-500'>{kycErrors.state}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className='pt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsKycDialogOpen(false)}
                disabled={isSubmittingKyc}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={isSubmittingKyc}>
                {isSubmittingKyc ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  'Salvar e conectar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className='max-w-7xl mx-auto pb-20 sm:pb-0'>
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
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='flex items-start gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60'>
              <img
                src='/mercado-pago-mark.svg'
                alt='Mercado Pago'
                className='h-7 w-7'
              />
            </div>
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-base font-semibold'>Mercado Pago</p>
                <Badge className={mpStatusBadgeClass}>{mpStatusLabel}</Badge>
              </div>
              <p className='text-sm text-muted-foreground'>
                Conecte sua conta para receber pagamentos e enviar cobrancas
                pelo Mercado Pago.
              </p>
              {mercadoPagoStatus?.providerUserId && (
                <p className='text-xs text-muted-foreground'>
                  Conta vinculada: {mercadoPagoStatus.providerUserId}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleConnectMercadoPago}
            disabled={isConnectingMp || isLoadingMpStatus || !canConnectMp}
            className='md:self-end'
          >
            {isConnectingMp ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : mercadoPagoStatus?.connected ? (
              'Reconectar'
            ) : (
              'Conectar'
            )}
          </Button>
        </div>
        {!isLoadingMpStatus && !canConnectMp && (
          <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100'>
            Credenciais do Mercado Pago nao configuradas no servidor.
          </div>
        )}
      {canConnectMp &&
        !mercadoPagoStatus?.connected &&
        missingKycLabels.length > 0 && (
          <div className='mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200'>
            <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>Campos pendentes:</span>
                {missingKycLabels.map((label) => (
                  <span
                    key={label}
                    className='rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                  >
                    {label}
                  </span>
                ))}
            </div>
          </div>
        )}
    </Card>

    <Card className='p-4 mb-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex items-start gap-3'>
          <div className='flex h-11 w-11 items-center justify-center rounded-xl border bg-white text-emerald-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60'>
            <MessageCircle className='h-6 w-6' />
          </div>
          <div className='space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='text-base font-semibold'>WhatsApp Business</p>
              <Badge className={whatsappStatusBadgeClass}>
                {whatsappStatusLabel}
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground'>
              Conecte seu numero para enviar cobrancas e notificacoes pelo
              WhatsApp.
            </p>
            {whatsappStatus?.phoneNumber && (
              <p className='text-xs text-muted-foreground'>
                Numero conectado: {whatsappStatus.phoneNumber}
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={handleConnectWhatsApp}
          disabled={
            isConnectingWhatsApp ||
            isLoadingWhatsAppStatus ||
            !canConnectWhatsApp
          }
          className='md:self-end'
        >
          {isConnectingWhatsApp ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : whatsappStatus?.connected ? (
            'Reconectar'
          ) : (
            'Conectar'
          )}
        </Button>
      </div>
      {!isLoadingWhatsAppStatus && !canConnectWhatsApp && (
        <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100'>
          Credenciais do Meta nao configuradas no servidor.
        </div>
      )}
    </Card>

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
    </>
  );
}








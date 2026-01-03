import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import {
  MessageSquare,
  DollarSign,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialActionsProps {
  ticketId: string;
  disabled?: boolean;
  variant?: 'default' | 'icon' | 'text';
}

export function FinancialActions({
  ticketId,
  disabled = false,
  variant = 'default',
}: FinancialActionsProps) {
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const [sendPaymentLinkTicket, setSendPaymentLinkTicket] = useState<any>(null);
  const [sendPaymentMethod, setSendPaymentMethod] = useState<
    'whatsapp' | 'email' | null
  >(null);
  const [paymentLinkPhone, setPaymentLinkPhone] = useState('');
  const [paymentLinkEmail, setPaymentLinkEmail] = useState('');
  const [paymentLinkMessage, setPaymentLinkMessage] = useState('');
  const [confirmReceivePayment, setConfirmReceivePayment] = useState(false);
  const [showMissingDocumentAlert, setShowMissingDocumentAlert] =
    useState(false);
  const [missingDocumentClientId, setMissingDocumentClientId] = useState<
    string | null
  >(null);

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

  // Buscar ticket completo
  const { data: ticket } = useQuery<any>({
    queryKey: ['/api/tickets', ticketId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/tickets/${ticketId}`,
        undefined
      );
      return await response.json();
    },
    enabled: !!ticketId,
  });

  // Buscar clientes
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Função para gerar mensagem padrão
  const generateDefaultPaymentMessage = (
    ticket: any,
    client: any,
    service: any
  ): string => {
    const ticketNumber = ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`;
    const clientName = client?.name || 'Cliente';

    const ticketValue = parseFloat(String(ticket.ticketValue || 0));
    const kmTotal = parseFloat(String(ticket.kmTotal || 0));
    const kmRate = parseFloat(String(ticket.kmRate || 0));
    const extraExpenses = parseFloat(String(ticket.extraExpenses || 0));
    const totalAmount = ticket.totalAmount
      ? parseFloat(String(ticket.totalAmount))
      : ticketValue + kmTotal * kmRate + extraExpenses;

    const formatCurrency = (value: number): string => {
      return value.toFixed(2).replace('.', ',');
    };

    let formattedDate = '';
    if (ticket.scheduledDate) {
      try {
        const date =
          typeof ticket.scheduledDate === 'string'
            ? parseISO(ticket.scheduledDate)
            : new Date(ticket.scheduledDate);
        formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      } catch {
        formattedDate = String(ticket.scheduledDate);
      }
    }

    let message = `Olá ${clientName}! 👋\n\n`;
    message += `Segue o resumo do atendimento:\n\n`;
    message += `📋 *Chamado:* ${ticketNumber}\n`;

    if (service?.name) {
      message += `🔧 *Serviço:* ${service.name}\n`;
    }

    if (formattedDate) {
      message += `📅 *Data:* ${formattedDate}\n`;
    }

    message += `\n💰 *Valores:*\n`;

    if (ticketValue > 0) {
      message += `• Valor do chamado: R$ ${formatCurrency(ticketValue)}\n`;
    }

    if (kmTotal > 0 && kmRate > 0) {
      const kmValue = kmTotal * kmRate;
      message += `• KM (${kmTotal} km Î R$ ${formatCurrency(
        kmRate
      )}): R$ ${formatCurrency(kmValue)}\n`;
    }

    if (extraExpenses > 0) {
      message += `• Despesas extras: R$ ${formatCurrency(extraExpenses)}\n`;
      if (ticket.expenseDetails) {
        message += `  _${ticket.expenseDetails}_\n`;
      }
    }

    message += `\n💵 *Total:* R$ ${formatCurrency(totalAmount)}\n`;

    if (ticket.dueDate) {
      try {
        const dueDate =
          typeof ticket.dueDate === 'string'
            ? parseISO(ticket.dueDate)
            : new Date(ticket.dueDate);
        const formattedDueDate = format(dueDate, 'dd/MM/yyyy', {
          locale: ptBR,
        });
        message += `\n📆 *Vencimento:* ${formattedDueDate}\n`;
      } catch {
        // Ignorar erro
      }
    }

    message += `\n\nOs dados do PIX e o QR Code serao adicionados automaticamente.`;

    return message;
  };

  // Preencher dados automaticamente quando o modal abrir
  useEffect(() => {
    if (sendPaymentLinkTicket && clients.length > 0) {
      const ticketClient = clients.find(
        (c) => c.id === sendPaymentLinkTicket.clientId
      );

      if (ticketClient?.phone) {
        const cleanPhone = ticketClient.phone.replace(/\D/g, '');
        setPaymentLinkPhone(cleanPhone);
      }

      if (ticketClient?.email) {
        setPaymentLinkEmail(ticketClient.email);
      }

      const fetchTicketDetails = async () => {
        try {
          const response = await apiRequest(
            'GET',
            `/api/tickets/${sendPaymentLinkTicket.id}`,
            undefined
          );
          const fullTicket = await response.json();

          let service = null;
          if (fullTicket.serviceId) {
            const servicesResponse = await apiRequest(
              'GET',
              '/api/services',
              undefined
            );
            const services = await servicesResponse.json();
            service = services.find((s: any) => s.id === fullTicket.serviceId);
          }

          const defaultMessage = generateDefaultPaymentMessage(
            fullTicket,
            ticketClient,
            service
          );
          setPaymentLinkMessage(defaultMessage);
        } catch (error) {
          console.error('Erro ao buscar detalhes do ticket:', error);
          if (ticketClient) {
            const basicMessage = generateDefaultPaymentMessage(
              sendPaymentLinkTicket,
              ticketClient,
              null
            );
            setPaymentLinkMessage(basicMessage);
          }
        }
      };

      fetchTicketDetails();
    } else if (!sendPaymentLinkTicket) {
      setPaymentLinkPhone('');
      setPaymentLinkEmail('');
      setPaymentLinkMessage('');
      setSendPaymentMethod(null);
    }
  }, [sendPaymentLinkTicket, clients]);

  // Mutation para receber pagamento
  const receivePaymentByTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticketId}/receive-payment`,
        {}
      );
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: 'Pagamento recebido',
        description: 'O pagamento foi registrado com sucesso.',
      });
      setConfirmReceivePayment(false);
    },
    onError: (error: any) => {
      console.error('Erro ao receber pagamento:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao receber pagamento',
        description: error.message || 'Não foi possível registrar o pagamento.',
      });
    },
  });

  // Mutation para enviar link por WhatsApp
  const sendPaymentLinkMutation = useMutation({
    mutationFn: async ({
      ticketId,
      phone,
      message,
    }: {
      ticketId: string;
      phone: string;
      message?: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticketId}/send-payment-link`,
        { phone, message }
      );
      return await response.json();
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
          title: 'Mensagem pronta!',
          description:
            'O WhatsApp foi aberto com a mensagem pronta para envio.',
        });
      }
      setSendPaymentLinkTicket(null);
      setPaymentLinkPhone('');
      setPaymentLinkEmail('');
      setPaymentLinkMessage('');
      setSendPaymentMethod(null);
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] });
    },
    onError: (error: any) => {
      console.error('Erro ao enviar mensagem de pagamento:', error);

      let errorMessage = error.message || error.toString() || '';
      errorMessage = errorMessage.replace(/^\d+:\s*:?\s*/, '').trim();
      if (errorMessage.toLowerCase().includes('pix')) {
        toast({
          variant: 'destructive',
          title: 'Chave PIX nao configurada',
          description: 'Cadastre a chave PIX antes de enviar a cobranca.',
        });
        setSendPaymentLinkTicket(null);
        setPaymentLinkPhone('');
        setPaymentLinkEmail('');
        setPaymentLinkMessage('');
        setSendPaymentMethod(null);
        return;
      }


      if (errorMessage.toLowerCase().includes('pix')) {
        toast({
          variant: 'destructive',
          title: 'Chave PIX nao configurada',
          description: 'Cadastre a chave PIX antes de enviar a cobranca.',
        });
        setSendPaymentLinkTicket(null);
        setPaymentLinkPhone('');
        setPaymentLinkEmail('');
        setPaymentLinkMessage('');
        setSendPaymentMethod(null);
        return;
      }

      const isMissingDocument =
        errorMessage.includes('CPF') ||
        errorMessage.includes('CNPJ') ||
        errorMessage.includes('documento') ||
        errorMessage.includes('preencher') ||
        error.code === 'MISSING_CLIENT_DOCUMENT' ||
        error.code === 'INVALID_CLIENT_DOCUMENT';

      if (isMissingDocument && sendPaymentLinkTicket) {
        setMissingDocumentClientId(sendPaymentLinkTicket.clientId);
        setShowMissingDocumentAlert(true);
        setSendPaymentLinkTicket(null);
        setPaymentLinkPhone('');
        setPaymentLinkEmail('');
        setPaymentLinkMessage('');
        setSendPaymentMethod(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao enviar mensagem',
          description:
            errorMessage || 'Nao foi possivel enviar a mensagem de pagamento.',
        });
      }
    },
  });

  // Mutation para enviar link por Email
  const sendPaymentLinkEmailMutation = useMutation({
    mutationFn: async ({
      ticketId,
      email,
      message,
    }: {
      ticketId: string;
      email: string;
      message?: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticketId}/send-payment-link-email`,
        { email, message }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message:
            response.status === 404
              ? 'Endpoint não encontrado. Verifique se o servidor está rodando corretamente.'
              : `Erro ${response.status}: ${response.statusText}`,
        }));
        throw new Error(
          `${response.status}: ${errorData.message || response.statusText}`
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Email enviado!',
        description:
          'A mensagem com PIX foi enviada por email para o cliente.',
      });
      setSendPaymentLinkTicket(null);
      setPaymentLinkPhone('');
      setPaymentLinkEmail('');
      setPaymentLinkMessage('');
      setSendPaymentMethod(null);
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] });
    },
    onError: (error: any) => {
      console.error('Erro ao enviar mensagem de pagamento por email:', error);

      let errorMessage = error.message || error.toString() || '';
      errorMessage = errorMessage.replace(/^\d+:\s*:?\s*/, '').trim();
      if (errorMessage.toLowerCase().includes('pix')) {
        toast({
          variant: 'destructive',
          title: 'Chave PIX nao configurada',
          description: 'Cadastre a chave PIX antes de enviar a cobranca.',
        });
        setSendPaymentLinkTicket(null);
        setPaymentLinkPhone('');
        setPaymentLinkEmail('');
        setPaymentLinkMessage('');
        setSendPaymentMethod(null);
        return;
      }


      const isMissingDocument =
        errorMessage.includes('CPF') ||
        errorMessage.includes('CNPJ') ||
        errorMessage.includes('documento') ||
        errorMessage.includes('preencher') ||
        error.code === 'MISSING_CLIENT_DOCUMENT' ||
        error.code === 'INVALID_CLIENT_DOCUMENT';

      if (isMissingDocument && sendPaymentLinkTicket) {
        setMissingDocumentClientId(sendPaymentLinkTicket.clientId);
        setShowMissingDocumentAlert(true);
        setSendPaymentLinkTicket(null);
        setPaymentLinkPhone('');
        setPaymentLinkEmail('');
        setPaymentLinkMessage('');
        setSendPaymentMethod(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao enviar email',
          description:
            errorMessage ||
            'Nao foi possivel enviar a mensagem de pagamento por email.',
        });
      }
    },
  });

  if (!ticket) return null;

  const isCompleted =
    ticket.status === 'CONCLUÍDO' || ticket.status === 'COMPLETED';
  const isPending = ticket.status === 'PENDENTE' || ticket.status === 'PENDING';

  // Não mostrar ações se o ticket não estiver concluído
  if (!isCompleted) return null;

  return (
    <>
      <div className='flex gap-2'>
        {variant === 'default' ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  size='sm'
                  variant='default'
                  disabled={disabled || sendPaymentLinkMutation.isPending}
                  className='flex items-center justify-center rounded-md h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium'
                >
                  <MessageSquare className='h-3 w-3 mr-1' />
                  Enviar cobrança
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuItem
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
                    setSendPaymentMethod('whatsapp');
                    setSendPaymentLinkTicket(ticket);
                  }}
                >
                  <MessageCircle className='h-4 w-4 mr-2' />
                  Via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSendPaymentMethod('email');
                    setSendPaymentLinkTicket(ticket);
                  }}
                >
                  <Mail className='h-4 w-4 mr-2' />
                  Via Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type='button'
              size='sm'
              variant='default'
              onClick={() => setConfirmReceivePayment(true)}
              disabled={disabled || receivePaymentByTicketMutation.isPending}
              className='flex items-center justify-center rounded-md h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium'
            >
              <DollarSign className='h-3 w-3 mr-1' />
              Receber pagamento
            </Button>
          </>
        ) : variant === 'icon' ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  disabled={disabled}
                  className='h-8 w-8 hover:text-[#3880f5]'
                >
                  <Send className='w-5 h-5' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
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
                    setSendPaymentMethod('whatsapp');
                    setSendPaymentLinkTicket(ticket);
                  }}
                >
                  <MessageCircle className='h-4 w-4 mr-2' />
                  Via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSendPaymentMethod('email');
                    setSendPaymentLinkTicket(ticket);
                  }}
                >
                  <Mail className='h-4 w-4 mr-2' />
                  Via Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => setConfirmReceivePayment(true)}
              disabled={disabled}
              className='h-8 w-8 hover:text-[#3880f5]'
            >
              <DollarSign className='w-5 h-5' />
            </Button>
          </>
        ) : null}
      </div>

      {/* Modal de Envio de Cobrança */}
      <Dialog
        open={!!sendPaymentLinkTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSendPaymentLinkTicket(null);
            setPaymentLinkPhone('');
            setPaymentLinkEmail('');
            setPaymentLinkMessage('');
            setSendPaymentMethod(null);
          }
        }}
      >
        <DialogContent className='max-w-lg bg-white dark:bg-[#101722] border-gray-200 dark:border-slate-800'>
          <DialogHeader>
            <DialogTitle className='text-xl font-bold text-[#111418] dark:text-white'>
              {sendPaymentMethod === 'email'
                ? 'Enviar Cobrança por Email'
                : 'Enviar Cobrança por WhatsApp'}
            </DialogTitle>
            <DialogDescription className='text-sm text-[#60708a] dark:text-slate-400'>
              {sendPaymentMethod === 'email'
                ? 'Envie os dados do PIX para o cliente via email.'
                : 'Envie os dados do PIX para o cliente via WhatsApp.'}
              {sendPaymentLinkTicket && (
                <span className='block mt-1'>
                  Chamado: #
                  {sendPaymentLinkTicket.ticketNumber ||
                    sendPaymentLinkTicket.id?.slice(0, 8)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-4 pt-2'>
            {sendPaymentMethod === 'whatsapp' ? (
              <>
                <div className='space-y-2'>
                  <Label
                    htmlFor='payment-phone'
                    className='text-sm font-medium'
                  >
                    Telefone do Cliente *
                  </Label>
                  <div className='relative'>
                    <Phone className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                    <Input
                      id='payment-phone'
                      type='tel'
                      value={paymentLinkPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setPaymentLinkPhone(value);
                      }}
                      placeholder='(00) 00000-0000'
                      className='pl-10 h-12'
                      required
                    />
                  </div>
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    Digite apenas números. O código do país (55) será adicionado
                    automaticamente.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className='space-y-2'>
                  <Label
                    htmlFor='payment-email'
                    className='text-sm font-medium'
                  >
                    Email do Cliente *
                  </Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                    <Input
                      id='payment-email'
                      type='email'
                      value={paymentLinkEmail}
                      onChange={(e) => setPaymentLinkEmail(e.target.value)}
                      placeholder='cliente@exemplo.com'
                      className='pl-10 h-12'
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className='space-y-2'>
              <Label htmlFor='payment-message' className='text-sm font-medium'>
                Mensagem {sendPaymentMethod === 'email' ? '(opcional)' : ''}
              </Label>
              <Textarea
                id='payment-message'
                value={paymentLinkMessage}
                onChange={(e) => setPaymentLinkMessage(e.target.value)}
                placeholder='A mensagem será preenchida automaticamente com os dados do atendimento...'
                rows={10}
                className='min-h-40 resize-y font-mono text-sm'
              />
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                A mensagem já vem pré-preenchida com os dados do atendimento.
                Você pode editar, apagar tudo ou adicionar mais informações
                antes de enviar.
              </p>
            </div>

            <div className='p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
              <p className='text-sm text-blue-800 dark:text-blue-200'>
                <strong>Como funciona:</strong>
              </p>
              <ul className='text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1 list-disc list-inside'>
                <li>
                  Uma cobrança será criada automaticamente (se ainda não
                  existir)
                </li>
                <li>Os dados do PIX e o QR Code serao gerados automaticamente</li>
                {sendPaymentMethod === 'whatsapp' ? (
                  <>
                    <li>
                      O WhatsApp será aberto com a mensagem pronta para envio
                    </li>
                    <li>Você pode editar a mensagem antes de enviar</li>
                  </>
                ) : (
                  <>
                    <li>O email será enviado automaticamente para o cliente</li>
                    <li>O cliente recebera os dados do PIX e o QR Code no email</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter className='gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setSendPaymentLinkTicket(null);
                setPaymentLinkPhone('');
                setPaymentLinkEmail('');
                setPaymentLinkMessage('');
                setSendPaymentMethod(null);
              }}
              disabled={
                sendPaymentLinkMutation.isPending ||
                sendPaymentLinkEmailMutation.isPending
              }
            >
              Cancelar
            </Button>
            {sendPaymentMethod === 'whatsapp' ? (
              <Button
                type='button'
                onClick={() => {
                  if (sendPaymentLinkTicket && paymentLinkPhone) {
                    sendPaymentLinkMutation.mutate({
                      ticketId: sendPaymentLinkTicket.id,
                      phone: paymentLinkPhone,
                      message: paymentLinkMessage || undefined,
                    });
                  }
                }}
                disabled={
                  sendPaymentLinkMutation.isPending ||
                  !paymentLinkPhone ||
                  paymentLinkPhone.length < 10
                }
                className='bg-blue-600 hover:bg-blue-700 text-white'
              >
                {sendPaymentLinkMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className='w-4 h-4 mr-2' />
                    Enviar e Abrir WhatsApp
                  </>
                )}
              </Button>
            ) : (
              <Button
                type='button'
                onClick={() => {
                  if (sendPaymentLinkTicket && paymentLinkEmail) {
                    sendPaymentLinkEmailMutation.mutate({
                      ticketId: sendPaymentLinkTicket.id,
                      email: paymentLinkEmail,
                      message: paymentLinkMessage || undefined,
                    });
                  }
                }}
                disabled={
                  sendPaymentLinkEmailMutation.isPending ||
                  !paymentLinkEmail ||
                  !paymentLinkEmail.includes('@')
                }
                className='bg-blue-600 hover:bg-blue-700 text-white'
              >
                {sendPaymentLinkEmailMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className='w-4 h-4 mr-2' />
                    Enviar por Email
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação para Receber Pagamento */}
      <AlertDialog
        open={confirmReceivePayment}
        onOpenChange={setConfirmReceivePayment}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receber pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja registrar o recebimento do pagamento para
              este chamado? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmReceivePayment(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                receivePaymentByTicketMutation.mutate(ticketId);
              }}
            >
              Sim, receber pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para CPF/CNPJ faltando */}
      <AlertDialog
        open={showMissingDocumentAlert}
        onOpenChange={setShowMissingDocumentAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-destructive' />
              CPF/CNPJ do cliente necessário
            </AlertDialogTitle>
            <AlertDialogDescription className='space-y-2'>
              <p>
                Para enviar a cobrança, é necessário cadastrar o CPF ou CNPJ do
                cliente.
              </p>
              <p className='font-medium text-foreground'>Onde cadastrar:</p>
              <ol className='list-decimal list-inside space-y-1 ml-2'>
                <li>
                  Vá para a página <strong>"Clientes"</strong> no menu lateral
                </li>
                <li>Encontre o cliente na lista</li>
                <li>
                  Clique em <strong>"Editar"</strong> no cliente
                </li>
                <li>
                  Preencha o campo <strong>"CPF"</strong> ou{' '}
                  <strong>"CNPJ"</strong>
                </li>
                <li>Salve as alterações</li>
              </ol>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowMissingDocumentAlert(false)}
            >
              Entendi
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowMissingDocumentAlert(false);
                window.location.href = '/clientes';
              }}
              className='bg-primary'
            >
              Ir para Clientes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

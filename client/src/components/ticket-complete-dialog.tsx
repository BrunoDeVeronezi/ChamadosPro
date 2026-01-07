import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { maskCurrency, unmaskCurrency } from '@/lib/masks';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, AlertTriangle } from 'lucide-react';

interface TicketCompleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    kmTotal: number;
    kmRate?: number; // Taxa de KM (opcional)
    kmChargeExempt?: boolean; // Isentar KM da cobranca do cliente
    additionalHourRate?: number; // Valor da hora adicional (opcional)
    extraExpenses: number;
    expenseDetails: string;
    baseAmount: number;
    totalAmount: number; // Valor total calculado
    discount: number; // Desconto aplicado
    serviceItems: Array<{ name: string; amount: number }>;
    paymentDate?: string; // Data de pagamento (opcional)
    shouldIssueReceipt?: boolean; // Se deve emitir recibo ao finalizar
    warranty?: string; // Garantia do serviço
  }) => Promise<void>;
  isPending: boolean;
  ticket: {
    id: string;
    serviceId: string;
    ticketValue: string;
    service: { name: string; price: string };
    kmTotal: number | string;
    kmRate: number | string;
    calculationsEnabled?: boolean;
    serviceItems?: Array<{ name: string; amount: number }>;
  };
  fullTicketData: any; // Ticket completo do banner para ter acesso a todos os campos
  elapsedSeconds?: number; // Tempo decorrido em segundos (opcional)
}

type ServiceItemForm = {
  id: string;
  name: string;
  amount: string;
};

const createServiceItemId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;


// Função para calcular a data de pagamento baseada no ciclo do cliente
const calculatePaymentDate = (
  client: any,
  scheduledDate: string | Date
): string | null => {
  // Se não tiver dados do ciclo de pagamento, retornar null
  if (!client?.paymentDueDay) {
    return null;
  }

  const scheduled = new Date(scheduledDate);
  const scheduledDay = scheduled.getDate();
  const scheduledMonth = scheduled.getMonth();
  const scheduledYear = scheduled.getFullYear();

  const startDay = client.paymentCycleStartDay || 1;
  const endDay = client.paymentCycleEndDay || 30;
  const dueDay = client.paymentDueDay;

  // Verificar se o chamado está dentro do ciclo de pagamento
  const isInCurrentCycle = scheduledDay >= startDay && scheduledDay <= endDay;

  // Se estiver no ciclo atual, calcular data de vencimento para o mês seguinte
  // Se não estiver, calcular para o mês do vencimento correspondente ao ciclo
  let paymentYear = scheduledYear;
  let paymentMonth = scheduledMonth;

  if (isInCurrentCycle) {
    // Se está no ciclo atual, vencimento é no mês seguinte
    paymentMonth = scheduledMonth + 1;
    if (paymentMonth > 11) {
      paymentMonth = 0;
      paymentYear += 1;
    }
  } else {
    // Se não está no ciclo, vencimento pode ser no mês atual ou seguinte
    // dependendo se o dueDay já passou
    if (dueDay < scheduledDay) {
      paymentMonth = scheduledMonth + 1;
      if (paymentMonth > 11) {
        paymentMonth = 0;
        paymentYear += 1;
      }
    }
  }

  // Calcular a data de vencimento
  const paymentDate = new Date(paymentYear, paymentMonth, dueDay);

  // Formatar como YYYY-MM-DD para input type="date"
  const year = paymentDate.getFullYear();
  const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
  const day = String(paymentDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Função auxiliar para converter valores decimais do banco corretamente
const parseDecimalValue = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Se já for número, retornar direto
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  // Se for string, fazer parse
  if (typeof value === 'string') {
    // Remove espaços e tenta converter
    const cleaned = value.trim().replace(/\s/g, '');

    // Se já está no formato "120.00" ou "120,00"
    const parsed = parseFloat(cleaned.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

// Função auxiliar para converter número para formato de string que maskCurrency espera
// maskCurrency espera uma string sem formatação (ex: "12000" para R$ 120,00)
const numberToCurrencyString = (value: number): string => {
  if (value === 0 || isNaN(value)) return '0';
  // Multiplicar por 100 para converter reais em centavos (formato que maskCurrency espera)
  return Math.round(value * 100).toString();
};

const formatElapsed = (seconds: number) => {
  const total = Math.max(0, seconds);
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

export function TicketCompleteDialog({
  isOpen,
  onClose,
  onComplete,
  isPending,
  ticket,
  fullTicketData,
  elapsedSeconds = 0,
}: TicketCompleteDialogProps) {
  const { toast } = useToast();
  // Estado para armazenar ticket completo buscado do backend
  const [fullTicket, setFullTicket] = useState<any>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItemForm[]>([]);
  const [kmTotal, setKmTotal] = useState<string>('');
  const [kmRate, setKmRate] = useState<string>('');
  const [extraCost, setExtraCost] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [extraDesc, setExtraDesc] = useState<string>('');
  const [extraHourRate, setExtraHourRate] = useState<string>('');
  const [totalOverrideValue, setTotalOverrideValue] = useState<string>('');
  const [isTotalManuallyEdited, setIsTotalManuallyEdited] = useState(false);
  const [includedHours, setIncludedHours] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [shouldIssueReceipt, setShouldIssueReceipt] = useState<boolean>(false);
  const [isKmChargeExempt, setIsKmChargeExempt] = useState(false);
  const [warranty, setWarranty] = useState<string>('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPaymentDateAutoFilled, setIsPaymentDateAutoFilled] = useState(false);
  const [isOpeningServiceOrder, setIsOpeningServiceOrder] = useState(false);
  const isMountedRef = useRef(true);

  // Usar ticket completo se disponível, senão usar o ticket passado como prop
  const ticketToUse = fullTicket || fullTicketData || ticket;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Verificar se ticket existe antes de acessar propriedades
  if (!ticketToUse) {
    return null; // Não renderizar se não houver ticket
  }

  // Buscar ticket completo do backend quando o modal abrir
  useEffect(() => {
    if (isOpen && ticket?.id) {
      const fetchFullTicket = async () => {
        try {
          const response = await apiRequest(
            'GET',
            `/api/tickets/${ticket.id}`,
            undefined,
            { allowStatuses: [404] }
          );
          if (response.status === 404) {
            return;
          }
          const fetchedTicket = await response.json();
          if (fetchedTicket) {
            setFullTicket(fetchedTicket);
            
            // 1. Valor Base e Outros Campos dependendo do tipo de cliente
            let initialBaseAmount = 0;
            let initialKmRate = 0;
            let initialExtraHourRate = 0;
            let initialIncludedHours = 0;

            const clientType = fetchedTicket.client?.type;

            if (clientType === 'EMPRESA_PARCEIRA') {
              // Para Empresa Parceira, prioriza os valores do cadastro do cliente
              initialBaseAmount = parseDecimalValue(fetchedTicket.client?.defaultTicketValue);
              initialKmRate = parseDecimalValue(fetchedTicket.client?.defaultKmRate);
              initialExtraHourRate = parseDecimalValue(fetchedTicket.client?.defaultAdditionalHourRate);
              initialIncludedHours = Number(fetchedTicket.client?.defaultHoursIncluded) || fetchedTicket.duration || 0;
              
              // Se o cliente não tiver valores padrão, usa o que está no chamado
              if (initialBaseAmount === 0) initialBaseAmount = parseDecimalValue(fetchedTicket.ticketValue);
              if (initialKmRate === 0) initialKmRate = parseDecimalValue(fetchedTicket.kmRate);
              if (initialExtraHourRate === 0) initialExtraHourRate = parseDecimalValue(fetchedTicket.additionalHourRate);
            } else {
              // Para PF e PJ (Clientes Finais), puxa do serviço cadastrado na abertura
              initialBaseAmount = parseDecimalValue(fetchedTicket.service?.price);
              initialIncludedHours = fetchedTicket.duration || 0;
              
              // Se o serviço não tiver preço, usa o que está no chamado
              if (initialBaseAmount === 0) initialBaseAmount = parseDecimalValue(fetchedTicket.ticketValue);
              
              // KM e Hora Adicional para PF/PJ geralmente usam o que está no chamado ou zero
              initialKmRate = parseDecimalValue(fetchedTicket.kmRate);
              initialExtraHourRate = parseDecimalValue(fetchedTicket.additionalHourRate) || 
                                    parseDecimalValue(fetchedTicket.client?.defaultAdditionalHourRate);
            }

            const existingServiceItems = Array.isArray(fetchedTicket.serviceItems)
              ? fetchedTicket.serviceItems
              : Array.isArray(fetchedTicket.service_items)
                ? fetchedTicket.service_items
                : null;

            if (existingServiceItems && existingServiceItems.length > 0) {
              setServiceItems(
                existingServiceItems.map((item: any) => ({
                  id: createServiceItemId(),
                  name: typeof item?.name === 'string' ? item.name : '',
                  amount: maskCurrency(
                    numberToCurrencyString(parseDecimalValue(item?.amount))
                  ),
                }))
              );
            } else {
              setServiceItems([
                {
                  id: createServiceItemId(),
                  name: fetchedTicket.service?.name || 'Serviço Prestado',
                  amount: maskCurrency(
                    numberToCurrencyString(initialBaseAmount)
                  ),
                },
              ]);
            }

            setIsTotalManuallyEdited(false);
            setTotalOverrideValue('');
            setKmRate(maskCurrency(numberToCurrencyString(initialKmRate)));
            setExtraHourRate(maskCurrency(numberToCurrencyString(initialExtraHourRate)));
            setKmTotal(fetchedTicket.kmTotal?.toString() || '');
            setIncludedHours(initialIncludedHours);
            setWarranty(fetchedTicket.warranty || fetchedTicket.service?.warranty || '');

            // 4. Data Pagamento (se for Empresa Parceira, calcula baseada no ciclo)
            if (fetchedTicket.paymentDate) {
              const d = new Date(fetchedTicket.paymentDate);
              setPaymentDate(d.toISOString().split('T')[0]);
              setIsPaymentDateAutoFilled(false);
            } else if (clientType === 'EMPRESA_PARCEIRA' && fetchedTicket.client?.paymentDueDay) {
              // Auto-preencher data de pagamento para empresas parceiras
              const calculatedDate = calculatePaymentDate(fetchedTicket.client, fetchedTicket.scheduledDate);
              if (calculatedDate) {
                setPaymentDate(calculatedDate);
                setIsPaymentDateAutoFilled(true);
              } else {
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setIsPaymentDateAutoFilled(true);
              }
            } else {
              setPaymentDate(new Date().toISOString().split('T')[0]);
              setIsPaymentDateAutoFilled(true);
            }
          }
        } catch (err) {
          console.warn('[TicketCompleteDialog] Erro ao buscar ticket:', err);
        }
      };
      fetchFullTicket();
    } else if (!isOpen) {
      setFullTicket(null);
      setServiceItems([]);
      setKmTotal('');
      setKmRate('');
      setExtraHourRate('');
      setExtraCost('');
      setDiscount('');
      setExtraDesc('');
      setPaymentDate('');
      setTotalOverrideValue('');
      setIsTotalManuallyEdited(false);
      setIsPaymentDateAutoFilled(false);
      setIsKmChargeExempt(false);
    }
  }, [isOpen, ticket?.id]);

  useEffect(() => {
    if (!isOpen || serviceItems.length > 0) return;

    const fallbackTicket = fullTicketData || ticket;
    if (!fallbackTicket) return;

    const fallbackAmount = parseDecimalValue(
      fallbackTicket.ticketValue || fallbackTicket.service?.price
    );

    setServiceItems([
      {
        id: createServiceItemId(),
        name: fallbackTicket.service?.name || 'Servico Prestado',
        amount: maskCurrency(numberToCurrencyString(fallbackAmount)),
      },
    ]);
  }, [isOpen, fullTicketData, ticket, serviceItems.length]);

  // Calcular horas extras
  const elapsedMs = elapsedSeconds ? elapsedSeconds * 1000 : 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const hasIncludedHours = includedHours > 0;
  const extraHours = hasIncludedHours
    ? Math.max(0, elapsedHours - includedHours)
    : 0;
  const isInExtraHours = hasIncludedHours && extraHours >= 0.01;

  // Valores numéricos para cálculo
  const servicesSubtotal = serviceItems.reduce((sum, item) => {
    const amount = parseFloat(unmaskCurrency(item.amount)) || 0;
    return sum + amount;
  }, 0);
  const baseAmount = servicesSubtotal;
  const kmTotalNum = parseFloat(kmTotal) || 0;
  const kmRateNum = parseFloat(unmaskCurrency(kmRate)) || 0;
  const extraHourRateNum = parseFloat(unmaskCurrency(extraHourRate)) || 0;
  const extraExpensesNum = parseFloat(unmaskCurrency(extraCost)) || 0;
  const discountNum = Math.max(0, parseFloat(unmaskCurrency(discount)) || 0);

  const kmValueRaw = kmTotalNum * kmRateNum;
  const kmValue = isKmChargeExempt ? 0 : kmValueRaw;
  const extraHoursValue = extraHours * extraHourRateNum;
  const calculatedTotal =
    baseAmount + extraHoursValue + kmValue + extraExpensesNum;
  const totalWithDiscount = Math.max(0, calculatedTotal - discountNum);
  const totalOverrideNum = parseFloat(unmaskCurrency(totalOverrideValue));
  const totalOverrideDisplay = isTotalManuallyEdited
    ? totalOverrideValue
    : maskCurrency(numberToCurrencyString(totalWithDiscount));
  const totalAmount =
    isTotalManuallyEdited &&
    totalOverrideValue.trim() !== '' &&
    !isNaN(totalOverrideNum)
      ? totalOverrideNum
      : totalWithDiscount;
  const hasDiscount = discountNum > 0;

  useEffect(() => {
    if (!isTotalManuallyEdited) {
      setTotalOverrideValue(
        maskCurrency(numberToCurrencyString(totalWithDiscount))
      );
    }
  }, [totalWithDiscount, isTotalManuallyEdited]);

  const isPartnerClient = ticketToUse?.client?.type === 'EMPRESA_PARCEIRA';
  const ratTemplateId =
    ticketToUse?.serviceOrderTemplateId || ticketToUse?.client?.ratTemplateId;
  const canOpenServiceOrder = Boolean(isPartnerClient && ratTemplateId);

  const ensureServiceOrderAndOpen = async () => {
    if (!ticketToUse?.id) return;
    if (isMountedRef.current) {
      setIsOpeningServiceOrder(true);
    }
    try {
      const response = await apiRequest(
        'POST',
        `/api/service-orders/by-ticket/${ticketToUse.id}`,
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error?.message || 'Nao foi possivel abrir a ordem de servico.'
        );
      }
      const order = await response.json();
      if (order?.publicToken) {
        const link = `${window.location.origin}/rat/${order.publicToken}`;
        window.open(link, '_blank');
      } else {
        throw new Error('Link da ordem de servico nao encontrado.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir RAT',
        description: error.message || 'Nao foi possivel abrir a RAT.',
      });
    } finally {
      if (isMountedRef.current) {
        setIsOpeningServiceOrder(false);
      }
    }
  };

  const submitCompletion = async (openRatAfter = false) => {
    const normalizedServiceItems = serviceItems
      .map((item, index) => {
        const amount = parseFloat(unmaskCurrency(item.amount)) || 0;
        const trimmedName = item.name.trim();
        const name =
          trimmedName || (amount > 0 ? `Servico adicional ${index + 1}` : '');
        return { name, amount };
      })
      .filter((item) => item.name || item.amount > 0);

    if (normalizedServiceItems.length === 0) {
      normalizedServiceItems.push({
        name: ticketToUse.service?.name || 'Servico Prestado',
        amount: baseAmount,
      });
    }

    try {
      await onComplete({
        kmTotal: kmTotalNum,
        kmRate: kmRateNum,
        kmChargeExempt: isKmChargeExempt,
        additionalHourRate: extraHourRateNum,
        extraExpenses: extraExpensesNum,
        expenseDetails: extraDesc,
        baseAmount: baseAmount,
        totalAmount: totalAmount,
        discount: discountNum,
        serviceItems: normalizedServiceItems,
        paymentDate: paymentDate || undefined,
        shouldIssueReceipt: shouldIssueReceipt,
        warranty: warranty,
      });

      if (openRatAfter) {
        await ensureServiceOrderAndOpen();
      }
    } catch (error) {
      console.error('[TicketCompleteDialog] Erro ao finalizar:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCompletion(false);
  };



  const addServiceItem = () => {
    setServiceItems((prev) => [
      ...prev,
      { id: createServiceItemId(), name: '', amount: '' },
    ]);
  };

  const updateServiceItem = (
    id: string,
    updates: Partial<ServiceItemForm>
  ) => {
    setServiceItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeServiceItem = (id: string) => {
    setServiceItems((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev
    );
  };
  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) setShowCancelConfirm(true);
        }}
      >
        <DialogContent
          className={`max-w-xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col ${
            isInExtraHours
              ? '!border-orange-500 !bg-orange-50 dark:!bg-orange-950/30'
              : ''
          }`}
          onInteractOutside={(e) => e.preventDefault()}
          style={
            isInExtraHours
              ? {
                  borderColor: 'rgb(249 115 22 / 0.5)',
                  backgroundColor: 'rgb(255 247 237)',
                }
              : undefined
          }
        >
          <form onSubmit={handleSubmit} className='flex flex-col max-h-[90vh]'>
            <DialogHeader className='flex-shrink-0'>
              <DialogTitle
                className={
                  isInExtraHours && ticketToUse.calculationsEnabled !== false ? 'text-orange-600 dark:text-orange-400' : ''
                }
              >
                Finalizar atendimento
              </DialogTitle>
              <DialogDescription>
                {ticketToUse.calculationsEnabled === false 
                  ? 'Confirme a finalização do atendimento.' 
                  : 'Revise os valores calculados e adicione despesas extras, se houver.'}
              </DialogDescription>
            </DialogHeader>

            <div className='flex-1 overflow-y-auto pr-1 -mr-1'>
              {/* Alerta de horas adicionais */}
              {isInExtraHours && ticketToUse.calculationsEnabled !== false && (
                <div className='flex items-start gap-3 p-4 rounded-lg bg-orange-200 dark:bg-orange-900/50 border-2 border-orange-500 dark:border-orange-600 shadow-lg mb-4'>
                  <AlertTriangle className='h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5 animate-pulse' />
                  <div className='flex-1'>
                    <p className='font-bold text-orange-900 dark:text-orange-100 mb-2 text-base'>
                      Horas Adicionais Detectadas
                    </p>
                    <p className='text-sm text-orange-800 dark:text-orange-200 mb-2 leading-relaxed'>
                      O tempo de atendimento de{' '}
                      <strong className='text-orange-900 dark:text-orange-100'>
                        {elapsedHours.toFixed(2)}h
                      </strong>{' '}
                      ultrapassou o limite padrão de{' '}
                      <strong className='text-orange-900 dark:text-orange-100'>
                        {includedHours}h
                      </strong>
                      . As horas excedentes de{' '}
                      <strong className='text-orange-900 dark:text-orange-100'>
                        {extraHours.toFixed(2)}h
                      </strong>{' '}
                      estão sendo cobradas como horas adicionais no valor de{' '}
                      <strong className='text-orange-900 dark:text-orange-100'>
                        R$ {extraHourRateNum.toFixed(2)}/hora
                      </strong>
                      .
                    </p>
                    <div className='p-3 rounded bg-orange-300 dark:bg-orange-800/70 mt-2 border border-orange-400 dark:border-orange-600'>
                      <p className='text-base font-bold text-orange-900 dark:text-orange-100'>
                        Valor de horas adicionais: R${' '}
                        {extraHoursValue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}


              <div className='space-y-3 text-sm'>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='p-3 rounded-lg bg-muted/50'>
                    <p className='text-muted-foreground'>Cliente</p>
                    <p className='font-semibold'>
                      {ticketToUse.client?.name || 'Não informado'}
                    </p>
                  </div>
                  <div className='p-3 rounded-lg bg-muted/50'>
                    <p className='text-muted-foreground'>Serviço</p>
                    <p className='font-semibold'>
                      {ticketToUse.service?.name || 'Não informado'}
                    </p>
                  </div>
                </div>


                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <label className='text-sm font-medium'>
                      Servicos realizados
                    </label>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={addServiceItem}
                    >
                      Adicionar servico
                    </Button>
                  </div>
                  <div className='space-y-2'>
                    {serviceItems.map((item) => (
                      <div
                        key={item.id}
                        className='grid grid-cols-1 gap-2 md:grid-cols-[1fr,140px,auto]'
                      >
                        <Input
                          type='text'
                          value={item.name}
                          onChange={(e) =>
                            updateServiceItem(item.id, { name: e.target.value })
                          }
                          placeholder='Descricao do servico'
                        />
                        <Input
                          type='text'
                          value={item.amount}
                          onChange={(e) =>
                            updateServiceItem(item.id, {
                              amount: maskCurrency(e.target.value),
                            })
                          }
                          placeholder='0,00'
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => removeServiceItem(item.id)}
                          disabled={serviceItems.length <= 1}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className='flex items-center justify-between text-xs text-muted-foreground'>
                    <span>Subtotal dos servicos</span>
                    <span>R$ {servicesSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                {ticketToUse.calculationsEnabled !== false ? (
                  <>
                    <div className='grid md:grid-cols-2 gap-3'>
                      <div
                        className={`p-3 rounded-lg space-y-1 ${
                          isInExtraHours
                            ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700'
                            : 'bg-muted/30'
                        }`}
                      >
                        <p
                          className={
                            isInExtraHours
                              ? 'text-orange-700 dark:text-orange-300 font-medium'
                              : 'text-muted-foreground'
                          }
                        >
                          Tempo total
                        </p>
                        <p
                          className={`font-mono text-lg ${
                            isInExtraHours
                              ? 'text-orange-800 dark:text-orange-200 font-semibold'
                              : ''
                          }`}
                        >
                          {formatElapsed(elapsedSeconds)} ({includedHours}h
                          inclusas)
                        </p>
                      </div>
                      <div
                        className={`p-3 rounded-lg space-y-1 ${
                          isInExtraHours
                            ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700'
                            : 'bg-muted/30'
                        }`}
                      >
                        <p
                          className={
                            isInExtraHours
                              ? 'text-orange-700 dark:text-orange-300 font-medium'
                              : 'text-muted-foreground'
                          }
                        >
                          Horas extras x valor
                        </p>
                        <p
                          className={`font-mono text-lg ${
                            isInExtraHours
                              ? 'text-orange-800 dark:text-orange-200 font-semibold'
                              : ''
                          }`}
                        >
                          {extraHours.toFixed(2)}h x R${extraHourRateNum.toFixed(2)} =
                          R$
                          {extraHoursValue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}

                {ticketToUse.calculationsEnabled !== false ? (
                  <>
                    <div className='grid md:grid-cols-2 gap-3'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          Subtotal dos serviços (R$)
                        </label>
                        <Input
                          type='text'
                          value={maskCurrency(
                            numberToCurrencyString(servicesSubtotal)
                          )}
                          placeholder='0,00'
                          readOnly
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          Hora Adicional (R$)
                        </label>
                        <Input
                          type='text'
                          value={extraHourRate}
                          onChange={(e) =>
                            setExtraHourRate(maskCurrency(e.target.value))
                          }
                          placeholder='0,00'
                        />
                      </div>
                    </div>

                    <div className='grid md:grid-cols-2 gap-3'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>KM Rodados</label>
                        <Input
                          type='number'
                          min='0'
                          step='0.1'
                          value={kmTotal}
                          onChange={(e) => setKmTotal(e.target.value)}
                          placeholder='0'
                        />
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>
                          Taxa por KM (R$)
                        </label>
                        <Input
                          type='text'
                          value={kmRate}
                          onChange={(e) => setKmRate(maskCurrency(e.target.value))}
                          placeholder='0,00'
                        />
                      </div>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='km-charge-exempt'
                        checked={isKmChargeExempt}
                        onCheckedChange={(checked) =>
                          setIsKmChargeExempt(checked === true)
                        }
                      />
                      <label
                        htmlFor='km-charge-exempt'
                        className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
                      >
                        Isentar KM da cobranca do cliente
                      </label>
                    </div>
                  </>
                ) : null}

                {ticketToUse.calculationsEnabled !== false ? (
                  <>
                    {kmTotalNum > 0 && kmRateNum > 0 && (
                      <div className='p-3 rounded-lg bg-muted/40 space-y-1'>
                        <p className='text-muted-foreground'>Valor KM</p>
                        <p className='font-semibold text-lg'>
                          {isKmChargeExempt ? (
                            <>
                              <span className='line-through text-muted-foreground'>
                                R$ {kmValueRaw.toFixed(2)}
                              </span>
                              <span className='ml-2 text-xs text-muted-foreground'>
                                Isento
                              </span>
                            </>
                          ) : (
                            <>R$ {kmValueRaw.toFixed(2)}</>
                          )}
                        </p>
                      </div>
                    )}

                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>
                        Despesas adicionais (R$)
                      </label>
                      <Input
                        type='text'
                        value={extraCost}
                        onChange={(e) => setExtraCost(maskCurrency(e.target.value))}
                        placeholder='0,00'
                      />
                    </div>

                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>
                        Desconto (R$)
                      </label>
                      <Input
                        type='text'
                        value={discount}
                        onChange={(e) => setDiscount(maskCurrency(e.target.value))}
                        placeholder='0,00'
                      />
                    </div>

                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>
                        Descrição das despesas
                      </label>
                      <Textarea
                        value={extraDesc}
                        onChange={(e) => setExtraDesc(e.target.value)}
                    placeholder='Ex: estacionamento, pedágio, peças, etc.'
                    rows={3}
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Garantia do Serviço</label>
                  <Input
                    type='text'
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    placeholder='Ex: 90 dias, 6 meses, etc.'
                  />
                </div>
              </>
            ) : null}

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>
                    Data de pagamento
                    {ticketToUse.calculationsEnabled !== false &&
                      isPaymentDateAutoFilled && (
                        <span className='text-xs text-muted-foreground ml-2'>
                          (Preenchida automaticamente - pode alterar)
                        </span>
                      )}
                  </label>
                  <Input
                    type='date'
                    value={paymentDate}
                    onChange={(e) => {
                      setPaymentDate(e.target.value);
                      setIsPaymentDateAutoFilled(false); // Marcar como editado manualmente
                    }}
                    placeholder='Data de pagamento'
                  />
                </div>

                <div className='flex items-center space-x-2 pt-2'>
                  <Checkbox
                    id='issue-receipt'
                    checked={shouldIssueReceipt}
                    onCheckedChange={(checked) =>
                      setShouldIssueReceipt(checked === true)
                    }
                  />
                  <label
                    htmlFor='issue-receipt'
                    className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
                  >
                    Emitir recibo de pagamento ao finalizar
                  </label>
                </div>

                <div className='p-3 rounded-lg bg-primary/5 space-y-2'>
                  <div className='flex items-center justify-between text-sm text-muted-foreground'>
                    <span>Total calculado</span>
                    <span>R$ {calculatedTotal.toFixed(2)}</span>
                  </div>
                  {isKmChargeExempt && kmValueRaw > 0 && (
                    <div className='flex items-center justify-between text-sm text-muted-foreground'>
                      <span>KM isento</span>
                      <span>R$ {kmValueRaw.toFixed(2)}</span>
                    </div>
                  )}
                  {hasDiscount && (
                    <div className='flex items-center justify-between text-sm text-muted-foreground'>
                      <span>Desconto</span>
                      <span>-R$ {discountNum.toFixed(2)}</span>
                    </div>
                  )}
                  {hasDiscount && (
                    <div className='flex items-center justify-between text-sm font-semibold'>
                      <span>Total com desconto</span>
                      <span>R$ {totalWithDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className='flex items-end gap-2'>
                    <div className='flex-1 space-y-1'>
                      <label className='text-sm font-medium'>
                        Total final (editavel)
                      </label>
                      <Input
                        type='text'
                        value={totalOverrideDisplay}
                        onChange={(e) => {
                          setTotalOverrideValue(maskCurrency(e.target.value));
                          setIsTotalManuallyEdited(true);
                        }}
                        placeholder='0,00'
                      />
                    </div>
                    {isTotalManuallyEdited && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setIsTotalManuallyEdited(false);
                          setTotalOverrideValue(
                            maskCurrency(
                              numberToCurrencyString(totalWithDiscount)
                            )
                          );
                        }}
                      >
                        Usar calculado
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <DialogFooter className='flex-shrink-0 border-t pt-4 mt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowCancelConfirm(true)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              {canOpenServiceOrder && (
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => submitCompletion(true)}
                  disabled={isPending || isOpeningServiceOrder}
                >
                  {isPending || isOpeningServiceOrder ? (
                    <>
                      <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      Abrindo RAT...
                    </>
                  ) : (
                    'Salvar e abrir RAT'
                  )}
                </Button>
              )}
              <Button type='submit' disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Finalizando...
                  </>
                ) : (
                  'Salvar e finalizar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar finalização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar? Os dados informados serão
              perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setServiceItems([]);
                setKmTotal('');
                setKmRate('');
                setExtraCost('');
                setDiscount('');
                setExtraDesc('');
                setPaymentDate('');
                setTotalOverrideValue('');
                setIsTotalManuallyEdited(false);
                setIsPaymentDateAutoFilled(false);
                setShowCancelConfirm(false);
                onClose();
              }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface PlanType {
  id: string;
  name: string;
  description: string | null;
  role?: string | null;
  price: string;
  billingCycle: string;
  features: any;
  maxClients: number | null;
  maxTickets: number | null;
  maxUsers: number | null;
  isActive: boolean;
}

interface Subscription {
  id: string;
  email: string;
  role: string;
  planTypeId: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  paymentGateway?: string | null;
  planType?: PlanType;
  hasSubscription?: boolean;
}

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

const planHighlights = [
  'Usuarios ilimitados e plano completo',
  'Gestao de chamados e agenda integrada',
  'Financeiro com recibos e PDFs ilimitados',
  'Relatorios avancados e dashboards',
  'Integracao com Google Calendar',
  'Suporte prioritario e atualizacoes constantes',
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

const loadMercadoPagoSdk = () =>
  new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o Mercado Pago'));
    document.body.appendChild(script);
  });

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
};

const getDaysLeft = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const formatPrice = (price: string) => {
  const numPrice = Number(price);
  if (!Number.isFinite(numPrice)) return 'R$ 35,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numPrice);
};

export default function Planos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const mpSectionRef = useRef<HTMLDivElement | null>(null);
  const mpBrickRef = useRef<any>(null);
  const payerEmailRef = useRef('');
  const payerDocumentRef = useRef('');
  const [mpSdkReady, setMpSdkReady] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpSubmitting, setMpSubmitting] = useState(false);
  const [mpPaymentResult, setMpPaymentResult] = useState<any>(null);
  const [payerEmail, setPayerEmail] = useState('');
  const [payerDocument, setPayerDocument] = useState('');
  const [renewalMonths, setRenewalMonths] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    if (checkout === 'success') {
      queryClient.invalidateQueries({
        queryKey: ['/api/subscriptions/current'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Checkout concluido',
        description: 'Assinatura confirmada.',
      });
    } else if (checkout === 'cancel') {
      toast({
        title: 'Checkout cancelado',
        description: 'Nenhuma cobranca foi realizada.',
      });
    }

    params.delete('checkout');
    params.delete('session_id');
    const nextQuery = params.toString();
    const nextPath = nextQuery ? `/planos?${nextQuery}` : '/planos';
    navigate(nextPath, { replace: true });
  }, [location, navigate, toast]);

  useEffect(() => {
    if (!payerEmail && user?.email) {
      setPayerEmail(user.email);
    }
    if (!payerDocument) {
      const doc = user?.cpf || user?.cnpj || '';
      if (doc) setPayerDocument(doc);
    }
  }, [payerEmail, payerDocument, user?.email, user?.cpf, user?.cnpj]);

  useEffect(() => {
    payerEmailRef.current = payerEmail;
  }, [payerEmail]);

  useEffect(() => {
    payerDocumentRef.current = payerDocument;
  }, [payerDocument]);


  const { data: plans, isLoading: plansLoading } = useQuery<PlanType[]>({
    queryKey: ['/api/plans'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plans', undefined);
      if (!response.ok) throw new Error('Erro ao carregar planos');
      return response.json();
    },
  });

  const { data: currentSubscription, isLoading: subscriptionLoading } =
    useQuery<Subscription | null>({
      queryKey: ['/api/subscriptions/current'],
      queryFn: async () => {
        const response = await apiRequest(
          'GET',
          '/api/subscriptions/current',
          undefined
        );
        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error('Erro ao carregar assinatura');
        }
        return response.json();
      },
    });

  const { data: mercadoPagoConfig } = useQuery<{
    enabled: boolean;
    publicKey?: string | null;
  }>({
    queryKey: ['/api/subscriptions/mercadopago/config'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/subscriptions/mercadopago/config',
        undefined
      );
      if (!response.ok) {
        throw new Error('Erro ao carregar Mercado Pago');
      }
      return response.json();
    },
    retry: false,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planTypeId: string) => {
      const response = await apiRequest('POST', '/api/subscriptions', {
        planTypeId,
      });
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.redirected) {
        setSelectedPlan(null);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ['/api/subscriptions/current'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Assinatura realizada',
        description: 'Plano assinado com sucesso.',
      });
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao assinar plano',
        description: error.message,
      });
    },
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        '/api/stripe/billing-portal',
        undefined
      );
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast({
        title: 'Portal indisponivel',
        description: 'Nao foi possivel abrir o portal.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir portal',
        description: error.message,
      });
    },
  });

  const paidPlan = plans?.[0] ?? null;
  const isSubscriptionActive = currentSubscription?.status === 'active';
  const isUserPlanActive = user?.planStatus === 'active';
  const mpPaymentEnabled = Boolean(
    mercadoPagoConfig?.enabled && mercadoPagoConfig?.publicKey
  );
  const showMpPayment = mpPaymentEnabled && !!paidPlan;
  const normalizedMonths = Math.min(5, Math.max(1, Math.round(renewalMonths)));
  const unitPriceValue = paidPlan ? Number(paidPlan.price || 0) : 0;
  const grossAmount = unitPriceValue * normalizedMonths;
  const discountPercent = Math.min(10, normalizedMonths * 2);
  const discountAmount = grossAmount * (discountPercent / 100);
  const netAmount = Math.max(0, grossAmount - discountAmount);
  const netAmountRounded = Math.round(netAmount * 100) / 100;

  useEffect(() => {
    setMpPaymentResult(null);
    setMpError(null);
  }, [normalizedMonths]);

  useEffect(() => {
    if (!mpPaymentEnabled || !mercadoPagoConfig?.publicKey) return;
    loadMercadoPagoSdk()
      .then(() => setMpSdkReady(true))
      .catch((error) => {
        console.error(error);
        setMpError('Nao foi possivel carregar o Mercado Pago.');
      });
  }, [mercadoPagoConfig?.publicKey, mpPaymentEnabled]);

  useEffect(() => {
    if (!mpSdkReady || !showMpPayment || !paidPlan) return;
    const amount = netAmountRounded;
    if (!Number.isFinite(amount) || amount <= 0) return;

    let isCancelled = false;

    const initBrick = async () => {
      if (mpBrickRef.current?.unmount) {
        await mpBrickRef.current.unmount();
      }
      setMpError(null);
      const mp = new window.MercadoPago(mercadoPagoConfig?.publicKey, {
        locale: 'pt-BR',
      });
      const bricksBuilder = mp.bricks();
      try {
        const controller = await bricksBuilder.create(
          'payment',
          'mp_plan_payment_brick',
          {
            initialization: {
              amount,
              payer: payerEmailRef.current
                ? { email: payerEmailRef.current }
                : undefined,
            },
            customization: {
              visual: {
                style: {
                  theme: 'default',
                },
              },
              paymentMethods: {
                creditCard: 'all',
                debitCard: 'all',
                bankTransfer: ['pix'],
              },
            },
            callbacks: {
              onReady: () => {},
              onSubmit: ({ formData }: { formData: any }) => {
                const currentEmail = payerEmailRef.current.trim();
                const currentDocument = payerDocumentRef.current.trim();
                if (!currentEmail || !currentDocument) {
                  setMpError('Informe email e CPF/CNPJ para continuar.');
                  return Promise.reject();
                }
                setMpSubmitting(true);
                setMpError(null);
                const normalizedDocument = currentDocument.replace(/\D/g, '');
                const normalizedFormData = {
                  ...(formData || {}),
                  email: currentEmail,
                  document: normalizedDocument,
                };
                return apiRequest(
                  'POST',
                  '/api/subscriptions/mercadopago/charge',
                  {
                    planTypeId: paidPlan.id,
                    months: normalizedMonths,
                    formData: normalizedFormData,
                  }
                )
                  .then((response) => response.json())
                  .then((responseData) => {
                    if (isCancelled) return;
                    setMpPaymentResult(responseData);
                    if (
                      responseData?.status === 'approved' ||
                      responseData?.status === 'accredited'
                    ) {
                      toast({
                        title: 'Pagamento aprovado',
                        description: 'Assinatura confirmada.',
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['/api/subscriptions/current'],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['/api/subscriptions'],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['/api/auth/user'],
                      });
                    }
                    return responseData;
                  })
                  .catch((error: any) => {
                    if (isCancelled) return;
                    setMpError(
                      error?.message || 'Nao foi possivel processar o pagamento.'
                    );
                    return Promise.reject(error);
                  })
                  .finally(() => {
                    if (!isCancelled) setMpSubmitting(false);
                  });
              },
              onError: (error: any) => {
                console.error('[Payment Brick] Error:', error);
                setMpError(
                  'Nao foi possivel carregar o formulario de pagamento.'
                );
              },
            },
          }
        );

        if (isCancelled) {
          await controller.unmount();
          return;
        }
        mpBrickRef.current = controller;
      } catch (error) {
        console.error(error);
        setMpError('Nao foi possivel inicializar o pagamento. Tente novamente.');
      }
    };

    initBrick();

    return () => {
      isCancelled = true;
      if (mpBrickRef.current?.unmount) {
        mpBrickRef.current.unmount();
      }
    };
  }, [
    mpSdkReady,
    showMpPayment,
    paidPlan,
    normalizedMonths,
    netAmountRounded,
    mercadoPagoConfig?.publicKey,
    toast,
  ]);

  useEffect(() => {
    const status = String(mpPaymentResult?.status || '').toLowerCase();
    if (!mpPaymentResult?.paymentId) return;
    if (!['pending', 'in_process'].includes(status)) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ['/api/subscriptions/current'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }, 10000);
    return () => clearInterval(interval);
  }, [mpPaymentResult?.paymentId, mpPaymentResult?.status]);

  useEffect(() => {
    if (!mpPaymentResult?.paymentId) return;
    if (!isSubscriptionActive) return;
    toast({
      title: 'Pagamento confirmado',
      description: 'Acesso liberado para o sistema.',
    });
    setMpPaymentResult(null);
    setSelectedPlan(null);
  }, [isSubscriptionActive, mpPaymentResult?.paymentId, toast]);

  if (plansLoading || subscriptionLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0b1120]'>
        <Loader2 className='h-8 w-8 animate-spin text-blue-500' />
      </div>
    );
  }
  const planName = paidPlan?.name?.trim() || 'Plano Tecnico';

  const planStatus = user?.planStatus;
  const isTrial = planStatus === 'trial';
  const isExpired = planStatus === 'expired';
  const isActive = planStatus === 'active';
  const trialDaysLeft =
    typeof user?.trialDaysLeft === 'number' ? user.trialDaysLeft : null;
  const trialEndsLabel = formatDateLabel(user?.trialEndsAt);
  const computedTrialDaysLeft =
    typeof trialDaysLeft === 'number'
      ? trialDaysLeft
      : getDaysLeft(user?.trialEndsAt);
  const trialTotalDays = 30;
  const trialProgress =
    isTrial && computedTrialDaysLeft !== null
      ? Math.min(
          100,
          Math.max(
            0,
            ((trialTotalDays - computedTrialDaysLeft) / trialTotalDays) * 100
          )
        )
      : isSubscriptionActive || isActive
      ? 100
      : 0;
  const statusLabel = isExpired
    ? 'Expirado'
    : isTrial
    ? 'Ativo (Trial)'
    : isSubscriptionActive || isActive
    ? 'Ativo'
    : 'Inativo';
  const statusTone = isExpired
    ? 'text-red-500 bg-red-500/10 dark:bg-red-500/20'
    : isTrial
    ? 'text-amber-500 bg-amber-500/10 dark:bg-amber-500/20'
    : 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20';
  const nextBillingLabel =
    (isTrial ? trialEndsLabel : formatDateLabel(currentSubscription?.endDate)) ||
    'A definir';
  const monthlyPriceLabel = formatPrice(
    String(paidPlan?.price ?? unitPriceValue ?? 0)
  );
  const billingCycleValue = paidPlan?.billingCycle?.toLowerCase();
  const billingCycleLabel = billingCycleValue?.includes('year')
    ? 'Anual'
    : 'Mensal';
  const billingHistory = currentSubscription
    ? [
        {
          id: currentSubscription.id,
          date: currentSubscription.startDate,
          description: `${planName} - ${billingCycleLabel}`,
          amount: monthlyPriceLabel,
          status: currentSubscription.status,
        },
      ]
    : [];
  const trialBadgeLabel = isTrial
    ? computedTrialDaysLeft !== null
      ? `${computedTrialDaysLeft} dias restantes`
      : 'Trial ativo'
    : isSubscriptionActive || isActive
    ? 'Assinatura ativa'
    : 'Plano inativo';
  const trialMessage = isTrial
    ? computedTrialDaysLeft !== null
      ? `Restam ${computedTrialDaysLeft} dias para o fim do seu teste gratuito.`
      : 'Seu periodo de teste esta ativo.'
    : isSubscriptionActive || isActive
    ? 'Seu plano esta ativo e pronto para uso total.'
    : 'Assine o plano mensal para liberar todas as funcionalidades.';
  const statusDescription = isExpired
    ? 'Seu acesso expirou. Renove para continuar usando.'
    : isTrial
    ? 'Trial ativo com todas as funcoes principais.'
    : isSubscriptionActive || isActive
    ? 'Assinatura ativa com acesso completo.'
    : 'Nenhuma assinatura ativa no momento.';
  const paymentMethodTitle =
    currentSubscription?.paymentGateway === 'stripe'
      ? 'Pagamento via Stripe'
      : currentSubscription?.paymentGateway === 'mercadopago'
        ? 'Pagamento via Mercado Pago'
        : 'Nenhum metodo cadastrado';
  const paymentMethodSubtitle =
    currentSubscription?.paymentGateway === 'stripe'
      ? 'Atualize cartao ou dados de cobranca no portal.'
      : currentSubscription?.paymentGateway === 'mercadopago'
        ? 'Renove sua assinatura via Mercado Pago.'
        : 'Adicione um metodo para manter a assinatura ativa.';
  const billingStatusLabel: Record<string, string> = {
    active: 'Pago',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  const billingStatusTone: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200',
    expired: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  };

  const handleSubscribe = () => {
    if (!paidPlan) {
      toast({
        variant: 'destructive',
        title: 'Plano indisponivel',
        description: 'Nenhum plano ativo foi encontrado.',
      });
      return;
    }
    if (mpPaymentEnabled) {
      mpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSelectedPlan(paidPlan.id);
    subscribeMutation.mutate(paidPlan.id);
  };

  const handleOpenBillingPortal = () => {
    if (currentSubscription?.paymentGateway === 'stripe') {
      billingPortalMutation.mutate();
      return;
    }
    toast({
      title: 'Portal indisponivel',
      description: 'Gerencie a assinatura entrando em contato com o suporte.',
    });
  };

  const handleCancelSubscription = () => {
    if (!isSubscriptionActive && !isTrial) {
      toast({
        title: 'Nenhuma assinatura ativa',
        description: 'Nao ha assinatura ativa para cancelar.',
      });
      return;
    }
    handleOpenBillingPortal();
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b1220] dark:text-slate-100 [--plan-primary:#1d4ed8] [--plan-accent:#0ea5e9]'>
      <div className='pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.22),transparent_70%)]' />
      <div className='pointer-events-none absolute left-0 top-32 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18),transparent_70%)]' />
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.65),transparent_45%)] dark:bg-[linear-gradient(120deg,rgba(2,6,23,0.15),transparent_45%)]' />

      <main className='relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8'>
        <motion.div
          variants={containerVariants}
          initial='hidden'
          animate='show'
          className='space-y-8'
        >
          <motion.div variants={itemVariants} className='space-y-4'>
            <div className='text-sm text-slate-500 dark:text-slate-400'>
              Home <span className='px-2'>/</span> Configuracoes{' '}
              <span className='px-2'>/</span>{' '}
              <span className='text-slate-900 dark:text-white'>
                Assinatura
              </span>
            </div>
            <div className='space-y-2'>
              <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
                Gerenciamento de Assinatura
              </h1>
              <p className='text-base text-slate-600 dark:text-slate-300'>
                Gerencie seu plano atual, historico de cobrancas e metodos de
                pagamento.
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className='border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='space-y-4 p-6'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 text-sm font-semibold'>
                    <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'>
                      <Timer className='h-4 w-4' />
                    </span>
                    <span>
                      {isTrial
                        ? 'Periodo de Teste (Trial)'
                        : 'Ciclo da Assinatura'}
                    </span>
                  </div>
                  <Badge className='bg-slate-900 text-white dark:bg-white/10 dark:text-white'>
                    {trialBadgeLabel}
                  </Badge>
                </div>
                <Progress
                  value={trialProgress}
                  className='h-2 bg-slate-100 dark:bg-slate-800'
                />
                <p className='text-sm text-slate-600 dark:text-slate-300'>
                  {trialMessage}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className='grid gap-4 md:grid-cols-3'
          >
            <Card className='border border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='p-5'>
                <div className='flex items-start gap-3'>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${statusTone}`}
                  >
                    <ShieldCheck className='h-5 w-5' />
                  </div>
                  <div className='space-y-1'>
                    <p className='text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400'>
                      Status da assinatura
                    </p>
                    <p className='text-lg font-semibold'>{statusLabel}</p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>
                      {statusDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className='border border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='p-5'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-100'>
                    <CalendarDays className='h-5 w-5' />
                  </div>
                  <div className='space-y-1'>
                    <p className='text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400'>
                      Proxima cobranca
                    </p>
                    <p className='text-lg font-semibold'>{nextBillingLabel}</p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>
                      Referente ao ciclo mensal atual
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className='border border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='p-5'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-100'>
                    <Wallet className='h-5 w-5' />
                  </div>
                  <div className='space-y-1'>
                    <p className='text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400'>
                      Valor mensal
                    </p>
                    <p className='text-lg font-semibold'>
                      {monthlyPriceLabel}
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>
                      Plano unico com renovacao mensal
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='text-xl font-semibold'>Planos Disponiveis</h2>
              <Badge className='bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'>
                Plano unico
              </Badge>
            </div>
            <Card className='relative overflow-hidden border border-slate-200/70 bg-white/90 shadow-lg dark:border-slate-800/60 dark:bg-slate-950/50'>
              <div className='pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.2),transparent_70%)]' />
              <CardContent className='relative space-y-5 p-6'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'>
                      <Sparkles className='h-5 w-5' />
                    </div>
                    <div>
                      <p className='text-lg font-semibold'>{planName}</p>
                      <p className='text-xs text-slate-500 dark:text-slate-300'>
                        Plano mensal com acesso total ao sistema
                      </p>
                    </div>
                  </div>
                  <Badge className='bg-[color:var(--plan-primary)] text-white'>
                    POPULAR
                  </Badge>
                </div>
                <div className='flex items-end gap-2'>
                  <span className='text-3xl font-semibold'>
                    {monthlyPriceLabel}
                  </span>
                  <span className='text-sm text-slate-500 dark:text-slate-300'>
                    /mes
                  </span>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {planHighlights.map((feature) => (
                    <div key={feature} className='flex items-start gap-3'>
                      <Check className='mt-0.5 h-5 w-5 text-emerald-500' />
                      <span className='text-sm text-slate-600 dark:text-slate-200'>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
                {!paidPlan && (
                  <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'>
                    Nenhum plano ativo foi encontrado. Verifique o cadastro no
                    painel administrativo.
                  </div>
                )}
                <Button
                  className='w-full gap-2 bg-[color:var(--plan-primary)] text-white hover:bg-blue-700'
                  onClick={handleSubscribe}
                  disabled={
                    !paidPlan ||
                    subscribeMutation.isPending ||
                    selectedPlan === paidPlan?.id ||
                    (!mpPaymentEnabled && isSubscriptionActive)
                  }
                >
                  {subscribeMutation.isPending &&
                  selectedPlan === paidPlan?.id &&
                  !mpPaymentEnabled ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Assinando...
                    </>
                  ) : isSubscriptionActive && !mpPaymentEnabled ? (
                    'Seu plano atual'
                  ) : mpPaymentEnabled ? (
                    <>
                      {isSubscriptionActive || isActive
                        ? 'Renovar agora'
                        : 'Pagar com Mercado Pago'}
                      <ArrowRight className='h-4 w-4' />
                    </>
                  ) : (
                    <>
                      Assinar agora
                      <ArrowRight className='h-4 w-4' />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {showMpPayment && (
            <motion.div
              variants={itemVariants}
              ref={mpSectionRef}
              className='scroll-mt-24 space-y-4'
            >
              <Card className='border border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/60 dark:bg-slate-950/50'>
                <CardContent className='space-y-4 p-6'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200'>
                      MP
                    </div>
                    <div>
                      <p className='text-base font-semibold'>
                        Renovar com Mercado Pago
                      </p>
                      <p className='text-xs text-slate-500 dark:text-slate-300'>
                        Pague via PIX, debito ou cartao de credito.
                      </p>
                    </div>
                  </div>
                  <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'>
                    PIX instantaneo
                  </Badge>
                </div>

                <div className='rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40'>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                    Escolha quantos meses deseja renovar
                  </p>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {[1, 2, 3, 4, 5].map((months) => {
                      const isSelected = normalizedMonths === months;
                      return (
                        <Button
                          key={months}
                          type='button'
                          size='sm'
                          variant={isSelected ? 'default' : 'outline'}
                          className={
                            isSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'border-slate-300 text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200'
                          }
                          onClick={() => setRenewalMonths(months)}
                        >
                          {months} mes{months > 1 ? 'es' : ''}
                        </Button>
                      );
                    })}
                  </div>
                  <div className='mt-4 grid gap-3 text-sm sm:grid-cols-3'>
                    <div>
                      <p className='text-xs uppercase text-slate-500 dark:text-slate-400'>
                        Valor mensal
                      </p>
                      <p className='font-semibold'>
                        {formatPrice(String(unitPriceValue || 0))}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs uppercase text-slate-500 dark:text-slate-400'>
                        Desconto
                      </p>
                      <p className='font-semibold text-emerald-600'>
                        {discountPercent}% OFF
                      </p>
                      <p className='text-[11px] text-slate-400'>
                        Maximo de 10%
                      </p>
                    </div>
                    <div>
                      <p className='text-xs uppercase text-slate-500 dark:text-slate-400'>
                        Total
                      </p>
                      <p className='font-semibold'>
                        {formatPrice(String(netAmountRounded || 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='mp-payer-email'>Email do pagador</Label>
                      <Input
                        id='mp-payer-email'
                        value={payerEmail}
                        onChange={(event) => setPayerEmail(event.target.value)}
                        placeholder='email@empresa.com'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='mp-payer-document'>CPF ou CNPJ</Label>
                      <Input
                        id='mp-payer-document'
                        value={payerDocument}
                        onChange={(event) =>
                          setPayerDocument(event.target.value)
                        }
                        placeholder='Somente numeros'
                      />
                    </div>
                  </div>

                  {mpError && (
                    <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                      {mpError}
                    </div>
                  )}

                  {mpSubmitting && (
                    <div className='flex items-center gap-2 text-sm text-slate-500'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Processando pagamento...
                    </div>
                  )}

                  <div id='mp_plan_payment_brick' />

                  {mpPaymentResult?.status && (
                    <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-300'>
                      Status: {mpPaymentResult.status}
                      {mpPaymentResult.statusDetail
                        ? ` (${mpPaymentResult.statusDetail})`
                        : ''}
                    </div>
                  )}

                  {mpPaymentResult?.qrCodeDataUrl && (
                    <div className='rounded-lg border border-slate-200 p-4 text-center'>
                      <p className='text-sm font-medium text-slate-700'>
                        QR Code PIX
                      </p>
                      <img
                        src={mpPaymentResult.qrCodeDataUrl}
                        alt='QR Code PIX'
                        className='mx-auto mt-3 h-48 w-48'
                      />
                      {mpPaymentResult.pixPayload && (
                        <Button
                          className='mt-3'
                          variant='outline'
                          onClick={() =>
                            navigator.clipboard.writeText(
                              mpPaymentResult.pixPayload || ''
                            )
                          }
                        >
                          Copiar codigo PIX
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            variants={itemVariants}
            className='grid gap-6 lg:grid-cols-[0.9fr_1.1fr]'
          >
            <Card className='border border-slate-200/70 bg-white/90 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='space-y-4 p-6'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-100'>
                      <CreditCard className='h-5 w-5' />
                    </div>
                    <div>
                      <p className='text-base font-semibold'>
                        Metodo de Pagamento
                      </p>
                      <p className='text-xs text-slate-500 dark:text-slate-300'>
                        Gerencie dados de cobranca.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    onClick={handleOpenBillingPortal}
                    disabled={billingPortalMutation.isPending}
                  >
                    {billingPortalMutation.isPending ? 'Abrindo...' : 'Editar'}
                  </Button>
                </div>
                <div className='rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40'>
                  <p className='text-sm font-semibold'>{paymentMethodTitle}</p>
                  <p className='text-xs text-slate-500 dark:text-slate-300'>
                    {paymentMethodSubtitle}
                  </p>
                </div>
                <div className='text-xs text-slate-500 dark:text-slate-400'>
                  Cartoes e dados sao gerenciados com seguranca no portal do
                  provedor.
                </div>
              </CardContent>
            </Card>

            <Card className='border border-slate-200/70 bg-white/90 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardContent className='space-y-4 p-6'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <p className='text-base font-semibold'>
                      Historico de Cobrancas
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-300'>
                      Consulte pagamentos anteriores do plano.
                    </p>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    disabled={billingHistory.length === 0}
                  >
                    <FileText className='h-4 w-4' />
                    Baixar tudo
                  </Button>
                </div>
                <div className='overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800/60'>
                  <Table>
                    <TableHeader className='bg-slate-100/80 dark:bg-slate-900/50'>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descricao</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fatura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingHistory.length > 0 ? (
                        billingHistory.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className='text-sm'>
                              {formatDateLabel(row.date) || '-'}
                            </TableCell>
                            <TableCell className='text-sm'>
                              {row.description}
                            </TableCell>
                            <TableCell className='text-sm'>
                              {row.amount}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  billingStatusTone[row.status] ||
                                  billingStatusTone.pending
                                }
                              >
                                {billingStatusLabel[row.status] || 'Pendente'}
                              </Badge>
                            </TableCell>
                            <TableCell className='text-sm text-slate-400'>
                              <FileText className='h-4 w-4' />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className='py-6 text-center text-sm text-slate-500 dark:text-slate-400'
                          >
                            Nenhuma cobranca registrada ainda.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className='border border-red-200/70 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/30'>
              <CardContent className='flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300'>
                    <AlertTriangle className='h-5 w-5' />
                  </div>
                  <div>
                    <p className='text-base font-semibold text-red-700 dark:text-red-200'>
                      Cancelar Assinatura
                    </p>
                    <p className='text-sm text-red-600/80 dark:text-red-300/80'>
                      Ao cancelar, o acesso premium sera encerrado ao final do
                      ciclo atual.
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  className='border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40'
                  onClick={handleCancelSubscription}
                >
                  Quero cancelar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}

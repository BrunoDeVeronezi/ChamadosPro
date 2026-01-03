import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

type FeatureItem = {
  label: string;
  included: boolean;
};

const trialFeatures: FeatureItem[] = [
  { label: 'Cadastro de clientes e chamados', included: true },
  { label: 'Agenda e agendamento publico para clientes', included: true },
  { label: 'Upload de logos e imagens', included: true },
  { label: 'Ate 10 clientes cadastrados', included: true },
  { label: 'Relatorios avancados e analytics', included: false },
  { label: 'Exportacao e importacao de dados', included: false },
  { label: 'PDFs (RAT, recibos e relatorios)', included: false },
  { label: 'Envio por WhatsApp', included: false },
  { label: 'Integracao Google Calendar', included: false },
];

const paidFeatures: FeatureItem[] = [
  { label: 'Clientes ilimitados', included: true },
  { label: 'Agenda e agendamento publico para clientes', included: true },
  { label: 'Upload de logos e imagens', included: true },
  { label: 'Exportacao e importacao de dados', included: true },
  { label: 'PDFs (RAT, recibos e relatorios)', included: true },
  { label: 'Envio por WhatsApp', included: true },
  { label: 'Relatorios avancados e analytics', included: true },
  { label: 'Integracao Google Calendar', included: true },
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

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
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

  if (plansLoading || subscriptionLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0b1120]'>
        <Loader2 className='h-8 w-8 animate-spin text-blue-500' />
      </div>
    );
  }

  const paidPlan = plans?.[0] ?? null;
  const planName = paidPlan?.name?.trim() || 'Plano Tecnico';
  const planPriceLabel = paidPlan?.price
    ? formatPrice(paidPlan.price)
    : formatPrice('35');

  const planStatus = user?.planStatus;
  const isTrial = planStatus === 'trial';
  const isExpired = planStatus === 'expired';
  const isActive = planStatus === 'active';
  const trialDaysLeft =
    typeof user?.trialDaysLeft === 'number' ? user.trialDaysLeft : null;
  const trialEndsLabel = formatDateLabel(user?.trialEndsAt);
  const trialDeleteLabel = formatDateLabel(user?.trialDeleteAt);
  const isSubscriptionActive = currentSubscription?.status === 'active';

  const handleSubscribe = () => {
    if (!paidPlan) {
      toast({
        variant: 'destructive',
        title: 'Plano indisponivel',
        description: 'Nenhum plano ativo foi encontrado.',
      });
      return;
    }
    setSelectedPlan(paidPlan.id);
    subscribeMutation.mutate(paidPlan.id);
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b1120] dark:text-white [--plan-primary:#2563eb] [--plan-accent:#14b8a6] [--plan-warn:#f97316]'>
      <div className='pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.22),transparent_70%)]' />
      <div className='pointer-events-none absolute left-0 top-32 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.18),transparent_70%)]' />
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.4),transparent_45%)] dark:bg-[linear-gradient(120deg,rgba(2,6,23,0.1),transparent_45%)]' />

      <main className='relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8'>
        <motion.div
          variants={containerVariants}
          initial='hidden'
          animate='show'
          className='space-y-10'
        >
          <motion.div
            variants={itemVariants}
            className='flex flex-wrap items-center justify-between gap-4'
          >
            <Button
              variant='ghost'
              className='gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              onClick={() => navigate('/')}
            >
              <ArrowLeft className='h-4 w-4' />
              Voltar ao painel
            </Button>
            {isSubscriptionActive && (
              <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'>
                Assinatura ativa
              </Badge>
            )}
          </motion.div>

          <motion.div
            variants={itemVariants}
            className='grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center'
          >
            <div className='space-y-4'>
              <Badge className='w-fit bg-[color:var(--plan-primary)] text-white'>
                Plano unico
              </Badge>
              <div className='space-y-3'>
                <h1 className='text-3xl font-semibold leading-tight sm:text-4xl'>
                  Plano tecnico para liberar todo o ChamadosPro
                </h1>
                <p className='text-base text-slate-600 dark:text-slate-300'>
                  Teste gratis por 30 dias com limites claros. Depois disso,
                  assine o plano pago para continuar usando o sistema.
                </p>
              </div>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                {isSubscriptionActive ? (
                  <Button
                    variant='outline'
                    onClick={() => {
                      if (currentSubscription?.paymentGateway === 'stripe') {
                        billingPortalMutation.mutate();
                        return;
                      }
                      toast({
                        title: 'Gerenciar assinatura',
                        description:
                          'Portal disponivel apenas para assinaturas Stripe.',
                      });
                    }}
                    disabled={billingPortalMutation.isPending}
                  >
                    {billingPortalMutation.isPending
                      ? 'Abrindo portal...'
                      : 'Gerenciar assinatura'}
                  </Button>
                ) : (
                  <Button
                    className='gap-2 bg-[color:var(--plan-primary)] text-white hover:bg-blue-700'
                    onClick={handleSubscribe}
                    disabled={
                      !paidPlan ||
                      subscribeMutation.isPending ||
                      selectedPlan === paidPlan?.id
                    }
                  >
                    {subscribeMutation.isPending &&
                    selectedPlan === paidPlan?.id ? (
                      <>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Assinando...
                      </>
                    ) : (
                      <>
                        Assinar por {planPriceLabel}/mes
                        <ArrowRight className='h-4 w-4' />
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant='ghost'
                  className='gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  onClick={() => navigate('/planos')}
                >
                  Ver detalhes do plano
                </Button>
              </div>
              {isTrial && (
                <div className='text-xs text-slate-500 dark:text-slate-400'>
                  Se nao assinar ate 5 dias apos o fim do trial, o login sera
                  excluido.
                </div>
              )}
            </div>

            <Card className='relative overflow-hidden border border-slate-200/70 bg-white/80 shadow-lg backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/40'>
              <div className='pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.2),transparent_70%)]' />
              <CardHeader className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-5 w-5 text-[color:var(--plan-primary)]' />
                  <CardTitle>{planName}</CardTitle>
                </div>
                <CardDescription>
                  Plano pago unico com liberacao total.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-slate-900 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-white'>
                  <div className='text-sm text-slate-500 dark:text-slate-300'>
                    Valor mensal
                  </div>
                  <div className='text-3xl font-semibold'>
                    {planPriceLabel}
                    <span className='text-base font-normal text-slate-500 dark:text-slate-300'>
                      /mes
                    </span>
                  </div>
                </div>
                <div className='space-y-3'>
                  {paidFeatures.slice(0, 4).map((feature) => (
                    <div key={feature.label} className='flex items-start gap-3'>
                      <Check className='mt-0.5 h-5 w-5 text-emerald-500' />
                      <span className='text-sm text-slate-600 dark:text-slate-200'>
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  className='w-full gap-2 bg-[color:var(--plan-primary)] text-white hover:bg-blue-700'
                  onClick={handleSubscribe}
                  disabled={
                    isSubscriptionActive ||
                    !paidPlan ||
                    subscribeMutation.isPending ||
                    selectedPlan === paidPlan?.id
                  }
                >
                  {isSubscriptionActive
                    ? 'Plano ativo'
                    : 'Assinar agora'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {(isTrial || isExpired || isActive) && (
            <motion.div variants={itemVariants}>
              <Card
                className={`border ${
                  isExpired
                    ? 'border-red-200/70 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/30'
                    : isTrial
                    ? 'border-amber-200/70 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20'
                    : 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                }`}
              >
                <CardContent className='flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex items-start gap-4'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-800 shadow-sm dark:bg-slate-900/60 dark:text-white'>
                      {isExpired ? (
                        <AlertTriangle className='h-5 w-5 text-red-500' />
                      ) : (
                        <ShieldCheck
                          className={`h-5 w-5 ${
                            isTrial
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        />
                      )}
                    </div>
                    <div className='space-y-2'>
                      <div className='text-base font-semibold'>
                        {isExpired
                          ? 'Acesso bloqueado'
                          : isTrial
                          ? 'Trial ativo'
                          : 'Assinatura ativa'}
                      </div>
                      <div className='text-sm text-slate-600 dark:text-slate-300'>
                        {isExpired
                          ? 'Seu trial terminou. Assine para liberar o menu.'
                          : isTrial
                          ? 'Use o trial por 30 dias com limites de exportacao.'
                          : 'Tudo liberado enquanto a assinatura estiver ativa.'}
                      </div>
                      <div className='flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400'>
                        {trialEndsLabel && (
                          <span>Fim do trial: {trialEndsLabel}</span>
                        )}
                        {trialDeleteLabel && (
                          <span>Exclusao do login: {trialDeleteLabel}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isTrial && trialDaysLeft !== null && (
                    <div className='rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-center text-amber-700 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200'>
                      <div className='text-2xl font-semibold'>
                        {trialDaysLeft}
                      </div>
                      <div className='text-[11px] uppercase tracking-wide'>
                        dias restantes
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            variants={itemVariants}
            className='grid gap-6 lg:grid-cols-2'
          >
            <Card className='border border-slate-200/70 bg-white/90 dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardHeader className='space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <CardTitle className='text-lg'>Trial gratuito</CardTitle>
                  <Badge className='bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'>
                    30 dias
                  </Badge>
                </div>
                <CardDescription>
                  Acesso inicial com limites e sem exportacoes.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-3 text-sm'>
                  {trialFeatures.map((feature) => (
                    <div key={feature.label} className='flex items-start gap-3'>
                      {feature.included ? (
                        <Check className='mt-0.5 h-5 w-5 text-emerald-500' />
                      ) : (
                        <X className='mt-0.5 h-5 w-5 text-slate-400' />
                      )}
                      <span
                        className={
                          feature.included
                            ? 'text-slate-700 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'>
                  Tentativas de exportar, gerar PDF ou enviar WhatsApp mostram o
                  aviso de plano pago.
                </div>
              </CardContent>
            </Card>

            <Card className='border border-slate-200/70 bg-white/95 shadow-lg dark:border-slate-800/60 dark:bg-slate-950/40'>
              <CardHeader className='space-y-2'>
                <div className='flex items-center justify-between gap-2'>
                  <CardTitle className='text-lg'>{planName}</CardTitle>
                  <Badge className='bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'>
                    Recomendado
                  </Badge>
                </div>
                <CardDescription>
                  Desbloqueio completo e integracoes liberadas.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-3 text-sm'>
                  {paidFeatures.map((feature) => (
                    <div key={feature.label} className='flex items-start gap-3'>
                      <Check className='mt-0.5 h-5 w-5 text-emerald-500' />
                      <span className='text-slate-700 dark:text-slate-200'>
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className='flex flex-col gap-3 sm:flex-row'>
                  <Button
                    className='flex-1 gap-2 bg-[color:var(--plan-primary)] text-white hover:bg-blue-700'
                    onClick={handleSubscribe}
                    disabled={
                      isSubscriptionActive ||
                      !paidPlan ||
                      subscribeMutation.isPending ||
                      selectedPlan === paidPlan?.id
                    }
                  >
                    {isSubscriptionActive ? 'Plano ativo' : 'Assinar agora'}
                    <ArrowRight className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    className='flex-1'
                    onClick={() => navigate('/')}
                  >
                    Voltar ao painel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {!paidPlan && (
            <motion.div variants={itemVariants}>
              <Card className='border border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40'>
                <CardContent className='p-6 text-sm text-slate-600 dark:text-slate-300'>
                  Nenhum plano ativo foi encontrado. Verifique o cadastro de
                  planos no painel administrativo.
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

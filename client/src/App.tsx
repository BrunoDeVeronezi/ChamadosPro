import { Switch, Route, useLocation } from 'wouter';
import { queryClient, apiRequest } from './lib/queryClient';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppSidebar, AppSidebarMobileFooter } from '@/components/app-sidebar';
import { ThemeProvider } from '@/lib/theme-provider';
import { FontSizeProvider } from '@/lib/font-size-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { FontSizeToggle } from '@/components/font-size-toggle';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ActiveTicketBanner } from '@/components/active-ticket-banner';
import { OverduePaymentsBanner } from '@/components/overdue-payments-banner';
import { PageTransition } from '@/components/page-transition';
import { PageHeaderSlot } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Dashboard from '@/pages/dashboard';
import Clientes from '@/pages/clientes';
import Servicos from '@/pages/servicos';
import Chamados from '@/pages/chamados';
import Agenda from '@/pages/agenda';
import Relatorios from '@/pages/relatorios';
import DashboardFinanceiro from '@/pages/dashboard-financeiro';
import Perfil from '@/pages/perfil';
import PerfilEmpresa from '@/pages/perfil-empresa';
import ConfirmEmail from '@/pages/confirm-email';
import ChamadoDetalhes from '@/pages/chamado-detalhes';
import CriacaoChamado from '@/pages/criacao-chamado';
import PendenciasFinanceiras from '@/pages/pendencias-financeiras';
import CadastroEmpresa from '@/pages/cadastro-empresa';
import Faturamento from '@/pages/faturamento';
import DashboardEmpresaNovo from '@/pages/dashboard-empresa-novo';
import FilaChamadosEmpresa from '@/pages/fila-chamados-empresa';
import CadastroClienteManual from '@/pages/cadastro-cliente-manual';
import CadastroClienteParceiro from '@/pages/cadastro-cliente-parceiro';
import EdicaoServico from '@/pages/edicao-servico';
import GestaoConvites from '@/pages/gestao-convites';
import DetalhesRegistroFinanceiro from '@/pages/detalhes-registro-financeiro';
import Planos from '@/pages/planos';
import ConfiguracoesLembretesEmail from '@/pages/configuracoes-lembretes-email';
import ConfiguracaoNotificacoesPush from '@/pages/configuracao-notificacoes-push';
import Manutencao from '@/pages/manutencao';
import AgendamentoPublico from '@/pages/agendamento-publico';
import Configuracoes from '@/pages/configuracoes';
import PublicBooking from '@/pages/public-booking';
import PublicBookingForm from '@/pages/public-booking-form';
import LoginCadastroUnificado from '@/pages/login-cadastro-unificado';
import Login2 from '@/pages/login-2';
import Landing from '@/pages/landing';
import RecuperarSenha from '@/pages/recuperar-senha';
import NotFound from '@/pages/not-found';
import CompletarCadastro from '@/pages/completar-cadastro';
import DadosTenant from '@/pages/dados-tenant';
import Ajuda from '@/pages/ajuda';
import SincronizacaoGoogleCalendar from '@/pages/sincronizacao-google-calendar';
import SincronizacaoGoogleCalendar2 from '@/pages/sincronizacao-google-calendar-2';
import SincronizacaoGoogleCalendar3 from '@/pages/sincronizacao-google-calendar-3';
import RelatoriosAvancados from '@/pages/relatorios-avancados';
import RelatoriosAvancados2 from '@/pages/relatorios-avancados-2';
import RelatoriosAvancados3 from '@/pages/relatorios-avancados-3';
import AnalisePlanilhasTecnicos from '@/pages/analise-planilhas-tecnicos';
import EditorOrdemServico from '@/pages/editor-ordem-servico';
import RatPublic from '@/pages/rat-public';
import RatUploadTeste from '@/pages/rat-upload-teste';
import ListagemClientes2 from '@/pages/listagem-clientes-2';
import CadastroClienteManual2 from '@/pages/cadastro-cliente-manual-2';
import CadastroClienteManual3 from '@/pages/cadastro-cliente-manual-3';
import CadastroClienteParceiro2 from '@/pages/cadastro-cliente-parceiro-2';
import CadastroClienteParceiro3 from '@/pages/cadastro-cliente-parceiro-3';
import GestaoClientesEmpresa from '@/pages/gestao-clientes-empresa';
import GerenciamentoColaboradoresEmpresa from '@/pages/gerenciamento-colaboradores-empresa';
import OpcoesCadastroAutomaticoCliente1 from '@/pages/opcoes-cadastro-automatico-cliente-1';
import OpcoesCadastroAutomaticoCliente2 from '@/pages/opcoes-cadastro-automatico-cliente-2';
import ListagemChamados2 from '@/pages/listagem-chamados-2';
import CriacaoChamado2 from '@/pages/criacao-chamado-2';
import FilaChamadosEmpresa2 from '@/pages/fila-chamados-empresa-2';
import DetalhesChamadoExecucao2 from '@/pages/detalhes-chamado-execucao-2';
import ListagemServicos2 from '@/pages/listagem-servicos-2';
import EdicaoServico2 from '@/pages/edicao-servico-2';
import PendenciasFinanceiras2 from '@/pages/pendencias-financeiras-2';
import Faturamento2 from '@/pages/faturamento-2';
import DetalhesRegistroFinanceiro2 from '@/pages/detalhes-registro-financeiro-2';
import FormularioAgendamentoPublico2 from '@/pages/formulario-agendamento-publico-2';
import AgendamentoChamadoViaAgendaPublica from '@/pages/agendamento-chamado-via-agenda-publica';
import AgendarChamadoEmpresa from '@/pages/agendar-chamado-empresa';
import ServicosAgendamentoPublico1 from '@/pages/servicos-agendamento-publico-1';
import ServicosAgendamentoPublico2 from '@/pages/servicos-agendamento-publico-2';
import Relatorios2 from '@/pages/relatorios-2';
import ModalExportacaoPdfCompleta2 from '@/pages/modal-exportacao-pdf-completa-2';
import MasterAdminLogin from '@/pages/master-admin-login';
import MasterAdmin from '@/pages/master-admin';
import TestarPerfis from '@/pages/testar-perfis';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { RoleProtectedRoute } from '@/components/role-protected-route';
import { TenantRouteWrapper } from '@/components/tenant-route-wrapper';
import { useTenantRouting } from '@/hooks/use-tenant-routing';

// Componente de contagem regressiva do Trial
function TrialCountdown({
  trialEndsAt,
  trialDeleteAt,
  onViewPlans,
}: {
  trialEndsAt?: string;
  trialDeleteAt?: string;
  onViewPlans: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      let endDate: Date;

      if (trialEndsAt) {
        // Se temos a data de término do trial, usar ela
        endDate = new Date(trialEndsAt);
      } else {
        // Caso contrário, calcular 30 dias a partir de agora (fallback)
        // Na prática, o backend deve fornecer trialEndsAt baseado na data de cadastro
        endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
      }

      const now = new Date();
      const difference = endDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Calcular imediatamente
    calculateTimeLeft();

    // Atualizar a cada segundo
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [trialEndsAt]);

  if (!timeLeft) {
    return null;
  }

  const deleteDateLabel = trialDeleteAt
    ? new Date(trialDeleteAt).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className='group relative'>
      <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer'>
        <div className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
        <span className='text-xs font-medium text-red-600 dark:text-red-400 hidden sm:inline'>
          Trial
        </span>
      </div>
      {/* Tooltip com informações e contagem regressiva */}
      <div className='absolute right-0 top-full mt-2 w-72 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50'>
        <div className='text-sm font-semibold text-gray-900 dark:text-white mb-2'>
          Trial ativo
        </div>
        <div className='text-xs text-gray-600 dark:text-gray-400 mb-3'>
          Plano atual: Tecnico
        </div>
        {/* Contagem regressiva */}
        <div className='mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800'>
          <div className='text-xs font-medium text-red-700 dark:text-red-300 mb-2'>
            Tempo restante:
          </div>
          <div className='flex items-center gap-3 text-sm font-mono'>
            <div className='flex flex-col items-center'>
              <div className='text-lg font-bold text-red-600 dark:text-red-400'>
                {String(timeLeft.days).padStart(2, '0')}
              </div>
              <div className='text-[10px] text-red-600 dark:text-red-400 uppercase'>
                Dias
              </div>
            </div>
            <div className='text-red-400'>:</div>
            <div className='flex flex-col items-center'>
              <div className='text-lg font-bold text-red-600 dark:text-red-400'>
                {String(timeLeft.hours).padStart(2, '0')}
              </div>
              <div className='text-[10px] text-red-600 dark:text-red-400 uppercase'>
                Horas
              </div>
            </div>
            <div className='text-red-400'>:</div>
            <div className='flex flex-col items-center'>
              <div className='text-lg font-bold text-red-600 dark:text-red-400'>
                {String(timeLeft.minutes).padStart(2, '0')}
              </div>
              <div className='text-[10px] text-red-600 dark:text-red-400 uppercase'>
                Min
              </div>
            </div>
            <div className='text-red-400'>:</div>
            <div className='flex flex-col items-center'>
              <div className='text-lg font-bold text-red-600 dark:text-red-400'>
                {String(timeLeft.seconds).padStart(2, '0')}
              </div>
              <div className='text-[10px] text-red-600 dark:text-red-400 uppercase'>
                Seg
              </div>
            </div>
          </div>
        </div>
        <div className='text-[11px] text-red-700 dark:text-red-300 mb-3'>
          {deleteDateLabel
            ? `Se n\u00e3o assinar at\u00e9 ${deleteDateLabel}, o login ser\u00e1 exclu\u00eddo.`
            : 'Ap\u00f3s o fim do trial, voc\u00ea tem 5 dias para assinar; depois disso o login ser\u00e1 exclu\u00eddo.'}
        </div>
        <Button
          size='sm'
          className='w-full bg-red-500 hover:bg-red-600 text-white text-xs'
          onClick={onViewPlans}
        >
          Ver planos
        </Button>
      </div>
    </div>
  );
}

function Router() {
  return (
    <PageTransition>
      <Switch>
        {/* IMPORTANTE: Rotas específicas devem vir ANTES das rotas genéricas */}
        {/* Rota de confirmação de email - deve vir ANTES da rota raiz */}
        <Route path='/confirm-email' component={ConfirmEmail} />
        {/* Rota de completar cadastro - deve vir ANTES da rota raiz */}
        <Route
          path='/completar-cadastro'
          component={() => (
            <RoleProtectedRoute>
              <CompletarCadastro />
            </RoleProtectedRoute>
          )}
        />
        {/* Rota de dados do tenant - página de edição */}
        <Route
          path='/meus-dados'
          component={() => (
            <RoleProtectedRoute>
              <DadosTenant />
            </RoleProtectedRoute>
          )}
        />
        {/* Rota de ajuda - deve vir ANTES da rota genérica :tenantSlug */}
        <Route
          path='/ajuda'
          component={() => (
            <RoleProtectedRoute>
              <Ajuda />
            </RoleProtectedRoute>
          )}
        />
        {/* Rota raiz - o TenantRouteWrapper vai redirecionar se necessário */}
        <Route
          path='/'
          component={() => {
            const { user } = useAuth();
            const isCompanyUser =
              user?.role === 'company' || (user as any)?.role === 'empresa';

            if (isCompanyUser) {
              return <DashboardEmpresaNovo />;
            }
            return <Dashboard />;
          }}
        />
        <Route
          path='/clientes'
          component={() => {
            const { user } = useAuth();
            const isCompanyUser =
              user?.role === 'company' || (user as any)?.role === 'empresa';

            if (isCompanyUser) {
              return <GestaoClientesEmpresa />;
            }
            // Padrão: sempre mostrar página de clientes de técnico
            return (
              <RoleProtectedRoute
                allowedRoles={['technician', 'operational', 'financial']}
              >
                <Clientes />
              </RoleProtectedRoute>
            );
          }}
        />
        <Route
          path='/servicos'
          component={() => (
            <RoleProtectedRoute
              allowedRoles={['technician', 'operational', 'financial']}
            >
              <Servicos />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/chamados'
          component={ChamadosRoute}
        />
        <Route
          path='/agenda'
          component={() => (
            <RoleProtectedRoute
              allowedRoles={['technician', 'operational', 'financial']}
            >
              <Agenda />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/relatorios'
          component={() => (
            <RoleProtectedRoute
              allowedRoles={['technician', 'operational', 'financial']}
            >
              <Relatorios />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/dashboard-financeiro'
          component={() => (
            <RoleProtectedRoute allowedRoles={['technician', 'financial']}>
              <DashboardFinanceiro />
            </RoleProtectedRoute>
          )}
        />
        <Route path='/perfil' component={Perfil} />
        <Route path='/perfil-empresa' component={PerfilEmpresa} />
        <Route path='/chamado/:id' component={ChamadoDetalhes} />
        <Route path='/criacao-chamado' component={CriacaoChamado} />
        <Route
          path='/pendencias-financeiras'
          component={PendenciasFinanceiras}
        />
        <Route path='/faturamento' component={Faturamento} />
        <Route path='/cadastro-empresa' component={CadastroEmpresa} />
        <Route
          path='/dashboard-empresa'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <DashboardEmpresaNovo />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/fila-chamados-empresa'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <FilaChamadosEmpresa />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/cadastro-cliente-manual'
          component={CadastroClienteManual}
        />
        <Route
          path='/cadastro-cliente-manual-2'
          component={CadastroClienteManual2}
        />
        <Route
          path='/cadastro-cliente-manual-3'
          component={CadastroClienteManual3}
        />
        <Route
          path='/cadastro-cliente-parceiro'
          component={CadastroClienteParceiro}
        />
        <Route
          path='/cadastro-cliente-parceiro-2'
          component={CadastroClienteParceiro2}
        />
        <Route
          path='/cadastro-cliente-parceiro-3'
          component={CadastroClienteParceiro3}
        />
        <Route path='/listagem-clientes-2' component={ListagemClientes2} />
        <Route
          path='/gestao-clientes-empresa'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <GestaoClientesEmpresa />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/gerenciamento-colaboradores-empresa'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <GerenciamentoColaboradoresEmpresa />
            </RoleProtectedRoute>
          )}
        />
        <Route path='/opcoes-cadastro-automatico-cliente-1'>
          {() => {
            const [, setLocation] = useLocation();
            return (
              <OpcoesCadastroAutomaticoCliente1
                isOpen={true}
                onClose={() => setLocation('/clientes')}
              />
            );
          }}
        </Route>
        <Route path='/opcoes-cadastro-automatico-cliente-2'>
          {() => {
            const [, setLocation] = useLocation();
            return (
              <OpcoesCadastroAutomaticoCliente2
                isOpen={true}
                onClose={() => setLocation('/clientes')}
              />
            );
          }}
        </Route>
        <Route path='/listagem-chamados-2' component={ListagemChamados2} />
        <Route path='/criacao-chamado-2' component={CriacaoChamado2} />
        <Route
          path='/fila-chamados-empresa-2'
          component={FilaChamadosEmpresa2}
        />
        <Route
          path='/detalhes-chamado-execucao-2/:id'
          component={DetalhesChamadoExecucao2}
        />
        <Route path='/listagem-servicos-2' component={ListagemServicos2} />
        <Route path='/edicao-servico-2/:id?' component={EdicaoServico2} />
        <Route path='/edicao-servico/:id?' component={EdicaoServico} />
        <Route
          path='/pendencias-financeiras-2'
          component={PendenciasFinanceiras2}
        />
        <Route path='/faturamento-2' component={Faturamento2} />
        <Route
          path='/detalhes-registro-financeiro-2/:id'
          component={DetalhesRegistroFinanceiro2}
        />
        <Route
          path='/formulario-agendamento-publico-2/:publicSlug/service/:serviceId'
          component={FormularioAgendamentoPublico2}
        />
        <Route
          path='/agendamento-chamado-via-agenda-publica'
          component={AgendamentoChamadoViaAgendaPublica}
        />
        <Route
          path='/agendar-chamado-empresa'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <AgendarChamadoEmpresa />
            </RoleProtectedRoute>
          )}
        />
        <Route
          path='/servicos-agendamento-publico-1/:publicSlug?'
          component={ServicosAgendamentoPublico1}
        />
        <Route
          path='/servicos-agendamento-publico-2/:publicSlug?'
          component={ServicosAgendamentoPublico2}
        />
        <Route path='/relatorios-2' component={Relatorios2} />
        <Route
          path='/gestao-convites'
          component={() => (
            <RoleProtectedRoute allowedRoles={['company']}>
              <GestaoConvites />
            </RoleProtectedRoute>
          )}
        />
        <Route path='/testar-perfis' component={TestarPerfis} />
        <Route
          path='/detalhes-registro-financeiro/:id'
          component={DetalhesRegistroFinanceiro}
        />
        <Route
          path='/configuracoes-lembretes-email'
          component={ConfiguracoesLembretesEmail}
        />
        <Route
          path='/configuracao-notificacoes-push'
          component={ConfiguracaoNotificacoesPush}
        />
        <Route path='/manutencao' component={Manutencao} />
        <Route path='/agendamento-publico' component={AgendamentoPublico} />
        <Route path='/configuracoes' component={Configuracoes} />
        <Route path='/planos' component={Planos} />
        <Route
          path='/sincronizacao-google-calendar'
          component={SincronizacaoGoogleCalendar}
        />
        <Route
          path='/sincronizacao-google-calendar-2'
          component={SincronizacaoGoogleCalendar2}
        />
        <Route
          path='/sincronizacao-google-calendar-3'
          component={SincronizacaoGoogleCalendar3}
        />
        <Route path='/relatorios-avancados' component={RelatoriosAvancados} />
        <Route
          path='/relatorios-avancados-2'
          component={RelatoriosAvancados2}
        />
        <Route
          path='/relatorios-avancados-3'
          component={RelatoriosAvancados3}
        />
        <Route
          path='/analise-planilhas-tecnicos'
          component={AnalisePlanilhasTecnicos}
        />
        <Route path='/editor-ordem-servico' component={EditorOrdemServico} />
        <Route path='/rat-upload-teste' component={RatUploadTeste} />
        <Route path='/master-admin-login' component={MasterAdminLogin} />
        <Route
          path='/master-admin'
          component={() => (
            <RoleProtectedRoute allowedRoles={['super_admin']}>
              <MasterAdmin />
            </RoleProtectedRoute>
          )}
        />
        <Route path='/login-2' component={Login2} />
        <Route
          path='/login-cadastro-unificado'
          component={LoginCadastroUnificado}
        />
        <Route path='/login' component={LoginCadastroUnificado} />
        <Route path='/recuperar-senha' component={RecuperarSenha} />
        <Route path='/rat/:token' component={RatPublic} />
        <Route path='/landing' component={Landing} />
        {/* Rotas públicas de agendamento devem ficar no fim para não capturar rotas internas */}
        <Route
          path='/:publicSlug/service/:serviceId'
          component={FormularioAgendamentoPublico2}
        />
        <Route path='/:publicSlug' component={ServicosAgendamentoPublico1} />
        <Route component={NotFound} />
      </Switch>
    </PageTransition>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, navigate] = useLocation();

  // Perfis são opcionais - empresa pode usar o sistema sem configurar perfis

  // Verificar se está em uma rota pública (sem autenticação necessária)
  // Rotas públicas: /:publicSlug ou /:publicSlug/service/:serviceId
  // Mas NÃO são rotas internas conhecidas do sistema
  const internalRoutes = new Set([
    '',
    'clientes',
    'servicos',
    'chamados',
    'agenda',
    'relatorios',
    'dashboard-financeiro',
    'perfil',
    'chamado',
    'manutencao',
    'agendamento-publico',
    'configuracoes',
    'fila-chamados-empresa',
    'dashboard-empresa',
    'gestao-clientes-empresa',
    'planos',
    'agendar-chamado-empresa',
    'gerenciamento-colaboradores-empresa',
    'master-admin',
    'master-admin-login',
    'confirm-email',
    'rat',
    'rat-upload-teste',
    'editor-ordem-servico',
    'meus-dados',
    'completar-cadastro',
    'ajuda',
  ]);

  const isPublicRoute = (() => {
    if (!location || location === '/') return false;

    const pathSegments = location.split('/').filter(Boolean);

    // Se for rota raiz, não é pública
    if (pathSegments.length === 0) return false;

    // Se tiver 1 segmento: verificar se é rota interna conhecida
    if (pathSegments.length === 1) {
      // Se for uma rota interna conhecida, não é pública
      if (internalRoutes.has(pathSegments[0]!)) return false;
      // Se não for rota interna, é provavelmente um publicSlug
      return true;
    }

    // Se tiver 3 segmentos e o segundo for "service", é rota pública
    if (pathSegments.length === 3 && pathSegments[1] === 'service') {
      // Mas verificar se o primeiro segmento não é uma rota interna
      if (internalRoutes.has(pathSegments[0]!)) return false;
      return true;
    }

    // Rota pública de assinatura da RAT
    if (pathSegments.length === 2 && pathSegments[0] === 'rat') {
      return true;
    }

    // Qualquer outro padrão não é rota pública
    return false;
  })();

  // Verificar se é rota de master admin (antes de qualquer retorno condicional)
  const isMasterAdminRoute =
    location === '/master-admin' ||
    location === '/master-admin-login' ||
    location.startsWith('/master-admin');

  // Calcular variáveis necessárias para os useEffects (antes de qualquer retorno)
  const emailConfirmed = (user as any)?.emailConfirmed;
  const needsEmailConfirm = emailConfirmed !== true;
  const emailConfirmPath = '/confirm-email';
  const isOnEmailConfirmPage = location === emailConfirmPath;
  // NENHUMA rota é permitida sem confirmação de email, exceto a própria página de confirmação
  // O sistema fica COMPLETAMENTE inacessível até a confirmação
  const allowedRoutesWithoutEmailConfirm = [
    '/confirm-email', // Única rota permitida sem confirmação
  ];
  const isAllowedRoute = allowedRoutesWithoutEmailConfirm.includes(location);
  const shouldBlockForEmail =
    needsEmailConfirm &&
    !isOnEmailConfirmPage &&
    !isMasterAdminRoute &&
    !isAllowedRoute;

  // Redirecionar master admin automaticamente para /master-admin se não estiver lá
  // IMPORTANTE: Este useEffect deve estar ANTES de todos os retornos condicionais
  useEffect(() => {
    if (
      user?.role === 'super_admin' &&
      !isMasterAdminRoute &&
      location !== '/master-admin-login' &&
      location !== '/confirm-email' &&
      !isLoading &&
      isAuthenticated
    ) {
      navigate('/master-admin', { replace: true });
    }
  }, [
    user?.role,
    isMasterAdminRoute,
    location,
    navigate,
    isLoading,
    isAuthenticated,
  ]);

  // Redirecionar automaticamente para página de confirmação se necessário
  // IMPORTANTE: Este useEffect também deve estar ANTES de todos os retornos condicionais
  // FORÇAR redirecionamento imediato se email não confirmado e não estiver na página de confirmação
  useEffect(() => {
    if (
      needsEmailConfirm &&
      !isOnEmailConfirmPage &&
      !isMasterAdminRoute &&
      !isAllowedRoute &&
      isAuthenticated &&
      !isLoading
    ) {
      // Usar window.location para forçar navegação completa
      window.location.href = emailConfirmPath;
    }
  }, [
    needsEmailConfirm,
    isOnEmailConfirmPage,
    isMasterAdminRoute,
    isAllowedRoute,
    navigate,
    emailConfirmPath,
    isAuthenticated,
    isLoading,
    location,
  ]);

  // Memoizar o style para evitar recriações desnecessárias do SidebarProvider
  // IMPORTANTE: Este hook deve estar ANTES de todos os retornos condicionais
  const style = useMemo(
    () =>
      ({
        '--sidebar-width': '16rem', // 256px quando expandido
        '--sidebar-width-icon': '3rem', // 48px quando colapsado
      } as React.CSSProperties),
    []
  );

  // Dados de plano/trial
  const planStatus = (user as any)?.planStatus as
    | 'trial'
    | 'active'
    | 'expired'
    | undefined;
  const trialDaysLeft = (user as any)?.trialDaysLeft as number | undefined;
  const trialDeleteAt = (user as any)?.trialDeleteAt as string | undefined;

  const isExpiredPlan = planStatus === 'expired';
  const expiredAllowedRoutes = new Set([
    '/planos',
    '/confirm-email',
    '/login',
    '/login-2',
    '/login-cadastro-unificado',
    '/recuperar-senha',
    '/redefinir-senha',
    '/landing',
  ]);
  const isExpiredAllowedRoute =
    isPublicRoute || expiredAllowedRoutes.has(location);

  useEffect(() => {
    if (
      isExpiredPlan &&
      isAuthenticated &&
      !isLoading &&
      !isExpiredAllowedRoute &&
      !isMasterAdminRoute
    ) {
      navigate('/planos', { replace: true });
    }
  }, [
    isExpiredPlan,
    isAuthenticated,
    isLoading,
    isExpiredAllowedRoute,
    isMasterAdminRoute,
    navigate,
  ]);
  // Paywall pos-trial removido: manter layout e redirecionar para /planos

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <div className='space-y-6 w-full max-w-md'>
          <div>
            <Skeleton className='h-9 w-64 mb-2 mx-auto' />
            <Skeleton className='h-5 w-96 mx-auto' />
          </div>
          <div className='space-y-3'>
            {[1, 2, 3].map((i) => (
              <Card key={i} className='p-6'>
                <div className='flex items-center gap-4'>
                  <Skeleton className='h-10 w-10 rounded-full' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-5 w-48' />
                    <Skeleton className='h-4 w-64' />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // SE ESTIVER NA PÁGINA DE CONFIRMAÇÃO DE EMAIL, RENDERIZAR SEM LAYOUT
  // Esta verificação deve ser feita ANTES de qualquer outra renderização
  // Permite acesso mesmo sem autenticação completa
  if (location === emailConfirmPath) {
    return (
      <div className='min-h-screen bg-background'>
        <Router />
      </div>
    );
  }

  // Se for rota pública, renderiza sem sidebar e sem autenticação
  if (isPublicRoute) {
    return (
      <div className='min-h-screen bg-background'>
        <Router />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginCadastroUnificado />;
  }

  // BLOQUEAR ACESSO SE EMAIL NÃO CONFIRMADO (ANTES DE QUALQUER OUTRA COISA)
  // Exceto se estiver na página de confirmação ou em rotas permitidas
  if (
    needsEmailConfirm &&
    !isOnEmailConfirmPage &&
    !isMasterAdminRoute &&
    !isAllowedRoute
  ) {
    // FORÇAR redirecionamento para página de confirmação
    // Usar window.location para forçar navegação completa
    setTimeout(() => {
      window.location.href = emailConfirmPath;
    }, 0);
    // Mostrar tela de bloqueio enquanto redireciona
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background px-4'>
        <div className='w-full max-w-xl'>
          <Alert className='bg-blue-50 border-blue-200 text-blue-900'>
            <div className='flex flex-col gap-3'>
              <div>
                <AlertTitle className='text-lg'>
                  Redirecionando para confirmação de email...
                </AlertTitle>
                <AlertDescription className='text-sm leading-relaxed'>
                  Você precisa confirmar seu email antes de continuar.
                </AlertDescription>
              </div>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  // Verificar se a rota atual é de empresa (reutilizando location já declarado acima)
  const isCompanyUser =
    user?.role === 'company' || (user as any)?.role === 'empresa';

  // Master admin não precisa completar cadastro
  // IMPORTANTE: Usar apenas profileCompleted como condição principal
  const needsProfileCompletion =
    user?.role !== 'super_admin' && !user?.profileCompleted;

  // Não mostrar o Alert se já estiver na página de completar cadastro
  const isCompletingProfile = location === '/completar-cadastro';

  const isCompanyRoute =
    (location === '/' && isCompanyUser) ||
    (location === '/dashboard-empresa' && isCompanyUser) ||
    (location === '/fila-chamados-empresa' && isCompanyUser) ||
    (location === '/gestao-clientes-empresa' && isCompanyUser) ||
    (location.startsWith('/dashboard-empresa') && isCompanyUser) ||
    (location.startsWith('/fila-chamados-empresa') && isCompanyUser) ||
    (location.startsWith('/gestao-clientes-empresa') && isCompanyUser);

  // Se for master admin, não renderizar o layout padrão
  if (isMasterAdminRoute) {
    // Renderizar diretamente o MasterAdmin sem layout padrão
    // O MasterAdmin já tem seu próprio sidebar implementado
    if (location === '/master-admin' && user?.role === 'super_admin') {
      return <MasterAdmin />;
    }
    // Para master-admin-login, usar o Router normal
    return <Router />;
  }

  const needsPassword = false; // fluxo antigo desativado para login Google
  const passwordPath =
    (user as any)?.role === 'company' ? '/perfil-empresa' : '/perfil';
  const isOnPasswordPage = location === passwordPath;

  // Se precisa definir senha e nao esta na pagina de perfil, bloqueia e direciona
  // fluxo de senha via Google desativado

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <div className='flex h-[100dvh] w-full overflow-hidden'>
        <AppSidebar />
        <div className='flex flex-col flex-1 overflow-hidden'>
          <header className='flex items-center justify-between gap-4 p-4 border-b relative shrink-0'>
            <div className='flex items-center gap-4 flex-1 min-w-0'>
              <SidebarTrigger data-testid='button-sidebar-toggle' />
              <PageHeaderSlot />
            </div>
            <div className='flex items-center gap-2'>
              {/* Indicador discreto de Trial */}
              {planStatus === 'trial' && (
                <TrialCountdown
                  trialEndsAt={(user as any)?.trialEndsAt}
                  trialDeleteAt={trialDeleteAt}
                  onViewPlans={() => navigate('/planos')}
                />
              )}
              <FontSizeToggle />
              <ThemeToggle />
            </div>
          </header>
          {!isCompanyRoute && (
            <div className='shrink-0'>
              <OverduePaymentsBanner />
            </div>
          )}
          {!isCompanyRoute && (
            <div className='shrink-0'>
              <ActiveTicketBanner />
            </div>
          )}
          {needsProfileCompletion && !isCompletingProfile && (
            <div className='px-4 pt-3 shrink-0'>
              <Alert>
                <AlertTitle>Complete seu cadastro</AlertTitle>
                <AlertDescription>
                  Para completar seu cadastro, finalize com CPF/CNPJ e telefone.
                  <div className='mt-3 flex gap-2'>
                    <Button
                      size='sm'
                      onClick={() => navigate('/completar-cadastro')}
                    >
                      Completar cadastro
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          <main className='flex-1 overflow-y-auto p-4 sm:p-6 pb-40 md:pb-6 scroll-smooth'>
            <Router />
          </main>
          <AppSidebarMobileFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}

function ChamadosRoute() {
  const { user } = useAuth();
  const isCompanyUser =
    user?.role === 'company' || (user as any)?.role === 'empresa';

  if (isCompanyUser) {
    return <FilaChamadosEmpresa />;
  }
  // Padrão: sempre mostrar página completa de chamados de técnico
  return (
    <RoleProtectedRoute allowedRoles={['technician', 'operational', 'financial']}>
      <Chamados />
    </RoleProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={2000}>
          <ThemeProvider defaultTheme='light'>
            <FontSizeProvider>
              <AppContent />
              <Toaster />
            </FontSizeProvider>
          </ThemeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;








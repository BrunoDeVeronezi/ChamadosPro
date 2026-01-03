import React, { useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  FileText,
  Briefcase,
  BarChart3,
  Settings,
  HelpCircle,
  Ticket,
  DollarSign,
  CreditCard,
  Lock,
  LogOut,
  Activity,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

// Menu unificado - todas as opções disponíveis
interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForRole?: 'operational'; // Esconder para perfis específicos
  id?: string; // ID único para tracking
}

// Sistema de tracking de uso dos menus (compartilhado)
const MENU_USAGE_KEY = 'app_sidebar_menu_usage';

function trackMenuUsage(menuId: string) {
  try {
    const usage = JSON.parse(localStorage.getItem(MENU_USAGE_KEY) || '{}');
    usage[menuId] = (usage[menuId] || 0) + 1;
    usage.lastUsed = Date.now();
    localStorage.setItem(MENU_USAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.error('[AppSidebar] Erro ao salvar uso do menu:', error);
  }
}

function getMenuUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(MENU_USAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

const unifiedMenuItems: MenuItem[] = [
  // Páginas comuns (sempre acessíveis)
  {
    id: 'dashboard',
    title: 'Dashboard',
    url: '/',
    icon: Activity,
  },
  {
    id: 'chamados',
    title: 'Chamados',
    url: '/chamados',
    icon: Ticket,
  },
  {
    id: 'agenda',
    title: 'Agenda',
    url: '/agenda',
    icon: Calendar,
  },
  {
    id: 'clientes',
    title: 'Clientes',
    url: '/clientes',
    icon: Users,
  },
  {
    id: 'servicos',
    title: 'Serviços',
    url: '/servicos',
    icon: Briefcase,
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    url: '/dashboard-financeiro',
    icon: DollarSign,
    hideForRole: 'operational', // Perfil operacional não vê financeiro
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    url: '/relatorios',
    icon: BarChart3,
  },
  {
    id: 'editor-os',
    title: 'Editor OS/RAT',
    url: '/editor-ordem-servico',
    icon: FileText,
  },
  {
    id: 'planos',
    title: 'Planos',
    url: '/planos',
    icon: CreditCard,
  },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const {
    isMobile: isSidebarMobile,
    setOpenMobile,
    setOpen,
    state,
    openMobile,
  } = useSidebar();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const planStatus = user?.planStatus;
  const isExpiredPlan = planStatus === 'expired';

  // Track menu usage quando a página muda
  useEffect(() => {
    const menuItem = unifiedMenuItems.find((item) => {
      if (item.url === '/') {
        return location === '/';
      }
      return location.startsWith(item.url);
    });
    if (menuItem) {
      const menuId = menuItem.id || menuItem.url;
      trackMenuUsage(menuId);
    }
  }, [location]);

  // Ordenar menus por uso (mais usados primeiro)
  const sortedMenuItems = useMemo(() => {
    const usage = getMenuUsage();
    return [...unifiedMenuItems].sort((a, b) => {
      const aId = a.id || a.url;
      const bId = b.id || b.url;
      const aUsage = usage[aId] || 0;
      const bUsage = usage[bId] || 0;
      return bUsage - aUsage;
    });
  }, []);

  // Pegar os 4 menus mais usados para o rodapé mobile
  const topMenuItems = useMemo(() => {
    return sortedMenuItems.slice(0, 4);
  }, [sortedMenuItems]);

  // Fechar menu mobile ao clicar em um link
  // Não recolher o sidebar automaticamente - deixar o usuário controlar
  const handleLinkClick = (menuId?: string) => {
    if (isSidebarMobile) {
      setOpenMobile(false);
    }
    // Track menu usage
    if (menuId) {
      trackMenuUsage(menuId);
    }
    // Removido o auto-collapse para melhorar a experiência do usuário
  };

  const isActive = (url: string) => {
    if (url === '/') {
      return location === '/';
    }
    // Para empresas, considerar que '/' também é o dashboard da empresa
    if (url === '/dashboard-empresa' && user?.role === 'company') {
      return (
        location === '/' ||
        location === '/dashboard-empresa' ||
        location.startsWith('/dashboard-empresa')
      );
    }
    return location.startsWith(url);
  };

  return (
    <Sidebar
      side='left'
      variant='sidebar'
      collapsible='icon'
      className='border-r border-sidebar-border bg-sidebar dark:bg-[#101722]'
    >
      <SidebarHeader className='border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2 overflow-hidden relative'>
        <button
          type='button'
          onClick={(e) => {
            // No mobile, fechar o sidebar antes de navegar para evitar conflitos
            if (isSidebarMobile) {
              setOpenMobile(false);
              // Pequeno delay para garantir que o sidebar feche antes de navegar
              setTimeout(() => {
                navigate('/meus-dados');
                handleLinkClick();
              }, 100);
            } else {
              navigate('/meus-dados');
              handleLinkClick();
            }
          }}
          className='flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group-data-[collapsible=icon]:justify-center min-w-0 w-full text-left z-10 relative'
        >
          {user?.companyLogoUrl && user.companyLogoUrl.trim() !== '' ? (
            // Exibir logo da empresa/tenant se disponível (para todos os tipos de usuário)
            <img
              src={user.companyLogoUrl}
              alt={user.companyName || 'Logo'}
              className='h-10 w-10 object-contain rounded-lg bg-white dark:bg-gray-800 p-1 flex-shrink-0'
              onError={(e) => {
                // Se a imagem falhar ao carregar, esconder e mostrar fallback
                console.error(
                  '[AppSidebar] Erro ao carregar logo da empresa:',
                  user.companyLogoUrl
                );
                e.currentTarget.style.display = 'none';
              }}
              onLoad={() => {
                console.log(
                  '[AppSidebar] Logo da empresa carregada com sucesso no sidebar:',
                  user.companyLogoUrl
                );
              }}
              key={`${user.companyLogoUrl}-${user.id}`} // Força re-render quando a URL ou usuário muda
            />
          ) : (
            // Logo padrão do sistema
            <div
              className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 flex-shrink-0'
              data-alt='Company logo for ChamadosPro'
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB5ZgM6RNO7AuNaqV75aoznzwklIi2-IXsKQKnqveJRbXDX_XyBANonvqvSKtwNkQrfofP7DuQ0LPBGgFzCtKozJP_wlAQ8OvjFL-F9tfAMUAa0GlML6qnpuw9We5HGjbOsvRP4Mbwx9hfg0ydKoot-XxtduLC4ZGFUEMa8jwrQR_gnThfzkwMBGZxJbEubA4O6xAL2Ba30kfCCcn3fpjBYHKzljwcVfRx_mUEN7uSbAg4K9F-dTRCxKU0gKfuV6pLlsBbi8FlZdyg")',
              }}
            ></div>
          )}
          <div className='flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden'>
            {/* Sempre usar nome da empresa se disponível, senão usar nome padrão */}
            <h1 className='text-sidebar-foreground dark:text-gray-50 text-base font-bold leading-normal truncate'>
              {user?.companyName || 'ChamadosPro'}
            </h1>
            <p className='text-sidebar-foreground/70 dark:text-gray-400 text-sm font-normal leading-normal truncate'>
              Gestão de TI
            </p>
          </div>
        </button>
      </SidebarHeader>

      <SidebarContent className='flex flex-col h-full min-h-0 overflow-hidden'>
        <div className='flex flex-col gap-1 mt-2 min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'>
          <nav className='flex flex-col gap-0.5 min-w-0 pb-2'>
            {(() => {
              // Menu unificado - filtrar baseado em role
              const userRole = user?.role;

              // Filtrar menu unificado
              const filteredMenuItems = unifiedMenuItems.filter((item) => {
                // Esconder itens baseado em role específico
                if (
                  item.hideForRole === 'operational' &&
                  userRole === 'operational'
                ) {
                  return false;
                }

                // Itens sem restrição sempre aparecem
                return true;
              });

              // No mobile, filtrar também os menus que estão no rodapé
              let finalFilteredItems = filteredMenuItems;
              if (isMobile) {
                const topMenuIds = topMenuItems.map((m) => m.id || m.url);
                finalFilteredItems = filteredMenuItems.filter(
                  (item) => !topMenuIds.includes(item.id || item.url)
                );
              }

              return finalFilteredItems;
            })().map((item: MenuItem) => {
              const active = isActive(item.url);
              const menuId = item.id || item.url;
              const isLocked = isExpiredPlan ? item.url !== '/planos' : false;
              const linkHref = isLocked ? '/planos' : item.url;
              const lockedTitle = isLocked
                ? 'Assine um plano para desbloquear o acesso.'
                : undefined;

              return (
                <Link
                  key={item.title}
                  href={linkHref}
                  onClick={() => handleLinkClick(menuId)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 min-w-0 flex-shrink-0 ${
                    active
                      ? 'bg-[#3880f5]/30 text-[#3880f5] dark:bg-[#3880f5]/30 dark:text-[#3880f5]'
                      : isLocked
                      ? 'hover:bg-sidebar-accent/50 dark:hover:bg-gray-800/50 text-sidebar-foreground/50 dark:text-gray-500 cursor-pointer'
                      : 'hover:bg-sidebar-accent dark:hover:bg-gray-800 text-sidebar-foreground/70 dark:text-gray-300'
                  }`}
                  title={lockedTitle}>
                  <item.icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      isLocked ? 'opacity-50' : ''
                    }`}
                  />
                  <span className='truncate group-data-[collapsible=icon]:hidden flex-1 text-sm'>
                    {item.title}
                  </span>
                  {isLocked && (
                    <Lock className='h-3.5 w-3.5 flex-shrink-0 text-yellow-500 dark:text-yellow-400 group-data-[collapsible=icon]:hidden' />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className='flex flex-col gap-0.5 mt-auto pt-2 pb-2 border-t border-sidebar-border dark:border-gray-700 flex-shrink-0'>
          <Link
            href={isExpiredPlan ? '/planos' : '/configuracoes'}
            onClick={handleLinkClick}
            title={
              isExpiredPlan ? 'Assine um plano para desbloquear o acesso.' : undefined
            }
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 min-w-0 flex-shrink-0 ${
              isExpiredPlan
                ? 'hover:bg-sidebar-accent/50 dark:hover:bg-gray-800/50 text-sidebar-foreground/50 dark:text-gray-500 cursor-pointer'
                : 'hover:bg-sidebar-accent dark:hover:bg-gray-800 text-sidebar-foreground/70 dark:text-gray-300'
            }`}
          >
            <Settings
              className={`w-4 h-4 flex-shrink-0 ${
                isExpiredPlan
                  ? 'text-sidebar-foreground/50 dark:text-gray-500'
                  : 'text-sidebar-foreground/70 dark:text-gray-300'
              }`}
            />
            <p
              className={`text-xs font-medium leading-normal group-data-[collapsible=icon]:hidden truncate flex-1 min-w-0 ${
                isExpiredPlan
                  ? 'text-sidebar-foreground/50 dark:text-gray-500'
                  : 'text-sidebar-foreground/70 dark:text-gray-300'
              }`}
            >
              Configurações
            </p>
            {isExpiredPlan && (
              <Lock className='h-3.5 w-3.5 flex-shrink-0 text-yellow-500 dark:text-yellow-400 group-data-[collapsible=icon]:hidden' />
            )}
          </Link>
          <Link
            href={isExpiredPlan ? '/planos' : '/ajuda'}
            onClick={handleLinkClick}
            title={
              isExpiredPlan ? 'Assine um plano para desbloquear o acesso.' : undefined
            }
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 min-w-0 relative flex-shrink-0 ${
              isExpiredPlan
                ? 'hover:bg-sidebar-accent/50 dark:hover:bg-gray-800/50 text-sidebar-foreground/50 dark:text-gray-500 cursor-pointer'
                : 'hover:bg-sidebar-accent dark:hover:bg-gray-800 text-sidebar-foreground/70 dark:text-gray-300'
            }`}
          >
            <HelpCircle
              className={`w-4 h-4 flex-shrink-0 ${
                isExpiredPlan
                  ? 'text-sidebar-foreground/50 dark:text-gray-500'
                  : 'text-sidebar-foreground/70 dark:text-gray-300'
              }`}
            />
            <p
              className={`text-xs font-medium leading-normal group-data-[collapsible=icon]:hidden truncate flex-1 min-w-0 ${
                isExpiredPlan
                  ? 'text-sidebar-foreground/50 dark:text-gray-500'
                  : 'text-sidebar-foreground/70 dark:text-gray-300'
              }`}
            >
              Ajuda
            </p>
            {isExpiredPlan && (
              <Lock className='h-3.5 w-3.5 flex-shrink-0 text-yellow-500 dark:text-yellow-400 group-data-[collapsible=icon]:hidden' />
            )}
            <SupportNotificationBadge />
          </Link>
          <button
            onClick={() => {
              window.location.href = '/api/logout';
            }}
            className='flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent dark:hover:bg-gray-800 transition-colors text-sidebar-foreground/70 dark:text-gray-300 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 min-w-0 w-full text-left flex-shrink-0'
          >
            <LogOut className='w-4 h-4 flex-shrink-0 text-sidebar-foreground/70 dark:text-gray-300' />
            <p className='text-sidebar-foreground/70 dark:text-gray-300 text-xs font-medium leading-normal group-data-[collapsible=icon]:hidden truncate flex-1 min-w-0'>
              Sair
            </p>
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

// Componente de Rodapé Mobile para AppSidebar
export function AppSidebarMobileFooter() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const { user } = useAuth();
  const planStatus = user?.planStatus;
  const isExpiredPlan = planStatus === 'expired';

  // Ordenar menus por uso (mais usados primeiro)
  const sortedMenuItems = useMemo(() => {
    const usage = getMenuUsage();
    return [...unifiedMenuItems].sort((a, b) => {
      const aId = a.id || a.url;
      const bId = b.id || b.url;
      const aUsage = usage[aId] || 0;
      const bUsage = usage[bId] || 0;
      return bUsage - aUsage;
    });
  }, []);

  // Filtrar menus baseado em role
  const filteredMenuItems = useMemo(() => {
    const userRole = user?.role;

    return sortedMenuItems.filter((item) => {
      // Esconder itens baseado em role específico
      if (item.hideForRole === 'operational' && userRole === 'operational') {
        return false;
      }

      return true;
    });
  }, [sortedMenuItems, user]);

  // Pegar os 4 menus mais usados para o rodapé mobile
  const topMenuItems = useMemo(() => {
    return filteredMenuItems.slice(0, 4);
  }, [filteredMenuItems]);

  const isActive = (url: string) => {
    if (url === '/') {
      return location === '/';
    }
    return location.startsWith(url);
  };

  const handleMenuClick = (menuId: string) => {
    trackMenuUsage(menuId);
  };

  if (!isMobile) return null;

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 md:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]'>
      {topMenuItems.map((item) => {
        const Icon = item.icon;
        const menuId = item.id || item.url;
        const active = isActive(item.url);
        const isLocked = isExpiredPlan
          ? item.url !== '/planos'
          : false;
        const linkHref = isLocked ? '/planos' : item.url;
        const iconTone = isLocked
          ? 'text-slate-400 dark:text-slate-500'
          : active
          ? 'text-primary'
          : 'text-slate-500 dark:text-slate-400';

        return (
          <Link
            key={item.title}
            href={linkHref}
            onClick={() => handleMenuClick(menuId)}
            className={`flex flex-col items-center justify-center gap-1.5 px-1 py-1 rounded-xl transition-all duration-200 flex-1 max-w-[25%] active:scale-90 ${
              iconTone
            }`}
          >
            <div
              className={`p-2 rounded-xl transition-all ${
                active && !isLocked ? 'bg-primary/10' : ''
              }`}
            >
              <Icon
                className={`w-6 h-6 ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}`}
              />
            </div>
            <span
              className={`text-[10px] font-bold truncate w-full text-center tracking-tight ${
                active && !isLocked ? 'text-primary' : ''
              }`}
            >
              {item.title}
              {isLocked && (
                <Lock className='inline-block h-3 w-3 ml-1 text-yellow-500' />
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// Componente para exibir badge de notificação de suporte
function SupportNotificationBadge() {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery<{ count: number }>({
    queryKey: ['/api/support/unread-count'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/support/unread-count',
        undefined
      );
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  const unreadCount = data?.count || 0;

  if (unreadCount === 0) return null;

  return (
    <Badge className='absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] font-bold group-data-[collapsible=icon]:hidden'>
      {unreadCount > 9 ? '9+' : unreadCount}
    </Badge>
  );
}





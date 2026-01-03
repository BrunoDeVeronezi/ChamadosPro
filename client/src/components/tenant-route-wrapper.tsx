import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useTenantRouting } from '@/hooks/use-tenant-routing';

/**
 * Wrapper de rota que redireciona para URL com tenantSlug se necessário
 *
 * Este componente deve envolver rotas que precisam usar tenantSlug.
 * Ele verifica se o usuário tem tenantSlug e se a URL atual não o usa,
 * então redireciona automaticamente.
 */
export function TenantRouteWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { tenantSlug, getTenantUrl, isTenantRoute } = useTenantRouting();

  useEffect(() => {
    // Aguardar carregamento do usuário
    if (isLoading || !user) return;

    // Se não tem tenantSlug, não fazer nada (compatibilidade com usuários antigos)
    if (!tenantSlug) return;

    // Se já está na rota com tenantSlug, não fazer nada
    if (isTenantRoute) return;

    // Rotas que não devem ter tenantSlug
    const excludedRoutes = [
      '/login',
      '/login-cadastro-unificado',
      '/confirm-email',
      '/completar-cadastro',
      '/landing',
      '/master-admin',
      '/master-admin-login',
    ];

    if (
      excludedRoutes.some(
        (route) => location === route || location.startsWith(route + '/')
      )
    ) {
      return;
    }

    // Redirecionar para URL com tenantSlug
    const newUrl = getTenantUrl(location);
    if (newUrl !== location) {
      console.log('[TenantRouteWrapper] Redirecionando para:', newUrl);
      navigate(newUrl, { replace: true });
    }
  }, [
    isLoading,
    user,
    tenantSlug,
    isTenantRoute,
    location,
    navigate,
    getTenantUrl,
  ]);

  return <>{children}</>;
}

import { useAuth } from './use-auth';
import { useLocation } from 'wouter';

/**
 * Hook para gerenciar roteamento com tenantSlug
 *
 * Retorna:
 * - tenantSlug: slug do tenant do usuário atual
 * - getTenantUrl: função para gerar URLs com tenantSlug
 * - isTenantRoute: verifica se a rota atual usa tenantSlug
 * - currentPath: caminho atual sem tenantSlug
 */
export function useTenantRouting() {
  const { user } = useAuth();
  const [location] = useLocation();

  const tenantSlug = (user as any)?.tenantSlug || null;

  // Verificar se a rota atual já usa tenantSlug
  const pathSegments = location.split('/').filter(Boolean);
  const isTenantRoute = tenantSlug && pathSegments[0] === tenantSlug;

  // Obter caminho sem tenantSlug
  const currentPath = isTenantRoute
    ? '/' + pathSegments.slice(1).join('/')
    : location;

  /**
   * Gera URL com tenantSlug se disponível
   * @param path - Caminho da rota (ex: '/dashboard', '/clientes')
   * @returns URL completa com tenantSlug (ex: '/Cyber-Tech/dashboard')
   */
  const getTenantUrl = (path: string): string => {
    if (!tenantSlug) return path;

    // Remover barra inicial se houver
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Se já começa com tenantSlug, retornar como está
    if (cleanPath.startsWith(`${tenantSlug}/`)) {
      return `/${cleanPath}`;
    }

    // Rotas que não devem ter tenantSlug
    const excludedRoutes = [
      'login',
      'login-cadastro-unificado',
      'confirm-email',
      'completar-cadastro',
      'landing',
      'pagamento',
      'master-admin',
      'master-admin-login',
    ];

    if (
      excludedRoutes.some(
        (route) => cleanPath === route || cleanPath.startsWith(`${route}/`)
      )
    ) {
      return path;
    }

    // Adicionar tenantSlug
    return `/${tenantSlug}/${cleanPath}`;
  };

  return {
    tenantSlug,
    getTenantUrl,
    isTenantRoute,
    currentPath,
  };
}

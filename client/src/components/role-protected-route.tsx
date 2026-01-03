import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import LoginCadastroUnificado from '@/pages/login-cadastro-unificado';
import { useEffect } from 'react';

type AppRole = 'technician' | 'company' | 'super_admin' | 'tech' | 'empresa';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function RoleProtectedRoute({
  children,
  // Suportar aliases antigos (technician/company) e novos (tech/empresa)
  allowedRoles = ['technician', 'company', 'tech', 'empresa', 'super_admin'],
}: RoleProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Normaliza roles para comparação (tech -> technician, empresa -> company)
  const normalizeRole = (role?: string): AppRole | undefined => {
    if (!role) return undefined;
    if (role === 'tech') return 'technician';
    if (role === 'empresa') return 'company';
    return role as AppRole;
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const userRole = normalizeRole(user.role);

      // Se o usuário não tem permissão para acessar esta rota
      if (
        allowedRoles.length > 0 &&
        (!userRole || !allowedRoles.map(normalizeRole).includes(userRole))
      ) {
        // Redirecionar para a página apropriada baseada no role
        if (userRole === 'super_admin') {
          setLocation('/master-admin');
        } else if (userRole === 'company') {
          setLocation('/dashboard-empresa');
        } else {
          setLocation('/');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-9 w-64 mb-2' />
          <Skeleton className='h-5 w-96' />
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
    );
  }

  if (!isAuthenticated) {
    return <LoginCadastroUnificado />;
  }

  // Verificar se o usuário tem permissão
  const normalizedAllowed = allowedRoles.map(normalizeRole);
  const userRole = normalizeRole(user?.role);
  if (
    allowedRoles.length > 0 &&
    user &&
    (!userRole || !normalizedAllowed.includes(userRole))
  ) {
    return null; // O useEffect vai redirecionar
  }

  return <>{children}</>;
}

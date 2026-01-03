import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Login from '@/pages/login';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();

  // Verificar se precisa completar cadastro
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Master admin não precisa completar cadastro
      if (user.role === 'super_admin') {
        return;
      }

      // Verificar se precisa completar cadastro
      // IMPORTANTE: Usar apenas profileCompleted como condição principal
      // Se profileCompleted === true, o cadastro foi completado e não deve redirecionar
      const needsProfileCompletion = !user.profileCompleted;

      // Se precisa completar e não está na página de completar cadastro, redirecionar
      if (
        needsProfileCompletion &&
        window.location.pathname !== '/completar-cadastro'
      ) {
        console.log('[ProtectedRoute] Redirecionando para completar cadastro');
        navigate('/completar-cadastro');
      }
    }
  }, [isLoading, isAuthenticated, user, navigate]);

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
    return <Login />;
  }

  // Se precisa completar cadastro, não renderizar children (já redirecionou)
  if (user && user.role !== 'super_admin') {
    // IMPORTANTE: Usar apenas profileCompleted como condição principal
    const needsProfileCompletion = !user.profileCompleted;

    if (
      needsProfileCompletion &&
      window.location.pathname !== '/completar-cadastro'
    ) {
      return null; // Aguardar redirecionamento
    }
  }

  return <>{children}</>;
}

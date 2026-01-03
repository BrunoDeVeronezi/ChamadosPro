import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';

interface ProtectedSuperAdminRouteProps {
  children: React.ReactNode;
}

export function ProtectedSuperAdminRoute({
  children,
}: ProtectedSuperAdminRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

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
    return (
      <div className='flex items-center justify-center min-h-screen p-8'>
        <Alert variant='destructive' className='max-w-md'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Você precisa estar autenticado para acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className='flex items-center justify-center min-h-screen p-8'>
        <Card className='max-w-md p-6'>
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>Acesso Restrito</AlertTitle>
            <AlertDescription className='mt-2'>
              Esta página é acessível apenas para super administradores.
              <br />
              <br />
              Seu perfil atual: <strong>{user?.role || 'N/A'}</strong>
            </AlertDescription>
          </Alert>
          <div className='mt-4'>
            <button
              onClick={() => setLocation('/')}
              className='text-sm text-blue-600 hover:underline'
            >
              Voltar para o Dashboard
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}






















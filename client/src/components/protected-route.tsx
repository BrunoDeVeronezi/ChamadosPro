import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Login from '@/pages/login';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

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

  return <>{children}</>;
}

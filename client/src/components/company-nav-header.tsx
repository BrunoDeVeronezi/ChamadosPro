import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Bell, Settings, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function CompanyNavHeader() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/dashboard-empresa') {
      return location === '/dashboard-empresa' || location === '/';
    }
    return location.startsWith(path);
  };

  return (
    <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 dark:border-gray-700 bg-white dark:bg-[#101722] px-6 py-3 sticky top-0 z-10'>
      <div className='flex items-center gap-4 text-gray-900 dark:text-white'>
        {user?.companyLogoUrl ? (
          <img
            src={user.companyLogoUrl}
            alt={user.companyName || 'Logo'}
            className='h-8 w-8 object-contain rounded-lg bg-white dark:bg-gray-800 p-1 flex-shrink-0'
          />
        ) : (
          <div className='size-6 text-[#3880f5]'>
            <svg
              fill='none'
              viewBox='0 0 48 48'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z'
                fill='currentColor'
              ></path>
            </svg>
          </div>
        )}
        <h2 className='text-lg font-bold tracking-[-0.015em]'>
          {user?.companyName || 'ChamadosPro'}
        </h2>
      </div>
      <div className='flex flex-1 justify-center items-center gap-8'>
        <Link
          href='/dashboard-empresa'
          className={`text-sm font-medium transition-colors ${
            isActive('/dashboard-empresa')
              ? 'font-semibold text-[#3880f5]'
              : 'text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'
          }`}
        >
          Dashboard
        </Link>
        <Link
          href='/fila-chamados-empresa'
          className={`text-sm font-medium transition-colors ${
            isActive('/fila-chamados-empresa')
              ? 'font-semibold text-[#3880f5]'
              : 'text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'
          }`}
        >
          Chamados
        </Link>
        <Link
          href='/gestao-clientes-empresa'
          className={`text-sm font-medium transition-colors ${
            isActive('/gestao-clientes-empresa')
              ? 'font-semibold text-[#3880f5]'
              : 'text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'
          }`}
        >
          Clientes
        </Link>
      </div>
      <div className='flex items-center gap-4'>
        <div className='flex gap-2'>
          <Button variant='ghost' size='icon' className='h-10 w-10'>
            <Bell className='w-5 h-5' />
          </Button>
          <Button variant='ghost' size='icon' className='h-10 w-10'>
            <Settings className='w-5 h-5' />
          </Button>
        </div>
        <div className='flex items-center gap-2'>
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={user.firstName || 'Usuário'}
              className='h-8 w-8 rounded-full object-cover'
            />
          ) : user?.companyLogoUrl ? (
            <img
              src={user.companyLogoUrl}
              alt={user.companyName || 'Logo'}
              className='h-8 w-8 rounded-full object-contain bg-white dark:bg-gray-800 p-1'
            />
          ) : (
            <div className='h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
              <User className='h-4 w-4 text-gray-600 dark:text-gray-300' />
            </div>
          )}
          <span className='text-sm font-medium text-gray-900 dark:text-white'>
            {user?.firstName || 'Usuário'}
          </span>
        </div>
      </div>
    </header>
  );
}


import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, User } from 'lucide-react';
import { Link } from 'wouter';

export function UserMenu() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <Button onClick={login} size='sm' data-testid='button-login'>
        Entrar
      </Button>
    );
  }

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user.email?.[0].toUpperCase() || '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='relative h-9 w-9 rounded-full'
          data-testid='button-user-menu'
        >
          <Avatar className='h-9 w-9'>
            {user.profileImageUrl ? (
              <AvatarImage
                src={user.profileImageUrl}
                alt={user.email || 'Avatar'}
                key={user.profileImageUrl} // Força re-render quando a URL muda
              />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-medium leading-none'>
              {user.firstName} {user.lastName}
            </p>
            <p className='text-xs leading-none text-muted-foreground'>
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link
            href='/perfil'
            className='flex items-center cursor-pointer'
            data-testid='nav-perfil'
          >
            <User className='mr-2 h-4 w-4' />
            <span>Meu Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href='/configuracoes'
            className='flex items-center cursor-pointer'
            data-testid='nav-configuracoes'
          >
            <Settings className='mr-2 h-4 w-4' />
            <span>Configurações</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} data-testid='button-logout'>
          <LogOut className='mr-2 h-4 w-4' />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

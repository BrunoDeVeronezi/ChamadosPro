import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useLocation } from 'wouter';

export function TenantInfo() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user.email?.[0].toUpperCase() || '';

  const displayName =
    user.companyName ||
    `${user.firstName} ${user.lastName}`.trim() ||
    user.email;

  return (
    <div className='flex items-center gap-3 px-2 py-2'>
      <Avatar className='h-10 w-10'>
        {user.profileImageUrl ? (
          <AvatarImage
            src={user.profileImageUrl}
            alt={displayName}
            key={user.profileImageUrl}
          />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className='flex flex-col min-w-0 flex-1'>
        <p className='text-sm font-medium leading-none truncate'>
          {displayName}
        </p>
        {user.email && (
          <p className='text-xs leading-none text-muted-foreground truncate mt-1'>
            {user.email}
          </p>
        )}
      </div>
      <Button
        variant='ghost'
        size='sm'
        onClick={logout}
        className='h-8 w-8 p-0'
        title='Sair'
      >
        <LogOut className='h-4 w-4' />
      </Button>
    </div>
  );
}

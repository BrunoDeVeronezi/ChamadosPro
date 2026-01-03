import { useAuth } from '@/hooks/use-auth';

interface CompanyLogoProps {
  className?: string;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function CompanyLogo({
  className = '',
  showName = true,
  size = 'md',
}: CompanyLogoProps) {
  const { user } = useAuth();

  // Mostrar a logo sempre que existir (mesmo para técnicos), pois ela representa o tenant
  const hasLogo = !!user?.companyLogoUrl;
  const companyName = user?.companyName || 'ChamadosPro';

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {hasLogo ? (
        <img
          src={user.companyLogoUrl}
          alt={companyName}
          className={`${sizeClasses[size]} object-contain rounded-lg bg-white dark:bg-gray-800 p-1`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} bg-center bg-no-repeat aspect-square bg-cover rounded-full`}
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB5ZgM6RNO7AuNaqV75aoznzwklIi2-IXsKQKnqveJRbXDX_XyBANonvqvSKtwNkQrfofP7DuQ0LPBGgFzCtKozJP_wlAQ8OvjFL-F9tfAMUAa0GlML6qnpuw9We5HGjbOsvRP4Mbwx9hfg0ydKoot-XxtduLC4ZGFUEMa8jwrQR_gnThfzkwMBGZxJbEubA4O6xAL2Ba30kfCCcn3fpjBYHKzljwcVfRx_mUEN7uSbAg4K9F-dTRCxKU0gKfuV6pLlsBbi8FlZdyg")',
          }}
        />
      )}
      {showName && (
        <h2
          className={`${textSizeClasses[size]} font-bold leading-tight tracking-[-0.015em] text-gray-900 dark:text-white`}
        >
          {hasLogo ? companyName : 'ChamadosPro'}
        </h2>
      )}
    </div>
  );
}








import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  subtitle: string;
  isActive: boolean;
}

export function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  subtitle,
  isActive,
  onClick,
  className,
}: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card
      className={cn(
        'transition-all min-h-[120px] lg:min-h-[140px] flex flex-col hover:shadow-md',
        isActive && 'border-primary ring-2 ring-primary/20',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3'>
        <p className='text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground line-clamp-1'>
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              'h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        )}
      </CardHeader>
      <CardContent className='flex flex-col gap-1 px-3 pb-3'>
        <div
          className={cn(
            'text-xl lg:text-3xl font-bold leading-none truncate',
            isActive && 'text-primary'
          )}
          data-testid='text-metric-value'
        >
          {value}
        </div>
        {subtitle && (
          <p className='text-[10px] lg:text-xs text-muted-foreground line-clamp-2'>
            {subtitle}
          </p>
        )}
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 mt-1 lg:mt-2 text-[10px] lg:text-sm ${
              isPositive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className='h-2 w-2 lg:h-3 lg:w-3' />
            ) : (
              <TrendingDown className='h-2 w-2 lg:h-3 lg:w-3' />
            )}
            <span>
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

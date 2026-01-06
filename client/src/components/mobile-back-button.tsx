import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileBackButtonProps = {
  className?: string;
  stopPropagation?: boolean;
};

export function MobileBackButton({
  className,
  stopPropagation = false,
}: MobileBackButtonProps) {
  return (
    <button
      type='button'
      aria-label='Voltar'
      className={cn(
        'sm:hidden inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-200',
        className
      )}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      }}
    >
      <ArrowLeft className='h-4 w-4' />
    </button>
  );
}

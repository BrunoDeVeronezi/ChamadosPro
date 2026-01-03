import { useLocation } from 'wouter';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

type PaidAccessOptions = {
  feature?: string;
  description?: string;
};

export function usePaidAccess() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const planStatus = (user as any)?.planStatus as
    | 'trial'
    | 'active'
    | 'expired'
    | undefined;

  const isPaid = planStatus === 'active' || user?.role === 'super_admin';

  const requirePaid = (options: PaidAccessOptions = {}) => {
    if (isPaid) return true;

    toast({
      title: 'Recurso disponivel apenas na versao paga.',
      description:
        options.description ||
        (options.feature
          ? `${options.feature} esta disponivel apenas na versao paga.`
          : 'Assine um plano para liberar esta funcionalidade.'),
      action: (
        <ToastAction altText='Ver planos' onClick={() => navigate('/planos')}>
          Ver planos
        </ToastAction>
      ),
    });

    return false;
  };

  return {
    isPaid,
    planStatus,
    requirePaid,
  };
}

import { useAuth } from './use-auth';

export interface PlanAccessResult {
  hasAccess: boolean;
  planStatus: 'trial' | 'active' | 'expired' | null | undefined;
  trialDaysLeft: number | null | undefined;
  canUpgrade: boolean;
  isTrial: boolean;
}

// Hook para verificar acesso a funcionalidades baseado no plano do usuario
export function usePlanAccess(
  feature: string,
  requiresPaid?: boolean
): PlanAccessResult {
  const { user } = useAuth();
  const planStatus = (user as any)?.planStatus as
    | 'trial'
    | 'active'
    | 'expired'
    | null
    | undefined;
  const trialDaysLeft = (user as any)?.trialDaysLeft as
    | number
    | null
    | undefined;

  const isPaid = planStatus === 'active' || user?.role === 'super_admin';
  const hasAccess = !requiresPaid || isPaid;
  const canUpgrade = !isPaid;

  return {
    hasAccess,
    planStatus,
    trialDaysLeft,
    canUpgrade,
    isTrial: planStatus === 'trial',
  };
}

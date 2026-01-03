import { ReactNode } from 'react';
import { UpgradeRequired } from './upgrade-required';
import { usePlanAccess } from '@/hooks/use-plan-access';

interface FeatureGuardProps {
  feature: string;
  requiresPaid?: boolean;
  description?: string;
  children: ReactNode;
}

// Componente que protege funcionalidades baseado no plano do usuario
export function FeatureGuard({
  feature,
  requiresPaid,
  description,
  children,
}: FeatureGuardProps) {
  const { hasAccess } = usePlanAccess(feature, requiresPaid);

  if (!hasAccess && requiresPaid) {
    return <UpgradeRequired feature={feature} description={description} />;
  }

  return <>{children}</>;
}

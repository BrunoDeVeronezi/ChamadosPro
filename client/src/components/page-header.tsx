import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

type PageHeaderSlotProps = {
  className?: string;
};

type PageHeaderProps = {
  children: ReactNode;
};

export function PageHeaderSlot({ className }: PageHeaderSlotProps) {
  const [location] = useLocation();
  const hasMountedRef = useRef(false);
  const [transitionStage, setTransitionStage] = useState<
    'entering' | 'entered'
  >('entered');

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setTransitionStage('entering');
    const enterTimer = setTimeout(() => {
      setTransitionStage('entered');
    }, 260);

    return () => clearTimeout(enterTimer);
  }, [location]);

  return (
    <div
      id='page-header-slot'
      className={cn(
        'page-transition-wrapper flex-1 min-w-0',
        transitionStage === 'entering' ? 'page-entering' : 'page-entered',
        className
      )}
    />
  );
}

export function PageHeader({ children }: PageHeaderProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const slot = document.getElementById('page-header-slot');
    if (slot instanceof HTMLElement) {
      setContainer(slot);
    }
  }, []);

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}

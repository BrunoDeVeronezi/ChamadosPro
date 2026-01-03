import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
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
      className={`page-transition-wrapper ${
        transitionStage === 'entering' ? 'page-entering' : 'page-entered'
      }`}
    >
      {children}
    </div>
  );
}

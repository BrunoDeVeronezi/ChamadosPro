import { useEffect } from 'react';

export function useVisualViewportCssVars() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = document.documentElement;
    const viewport = window.visualViewport;

    const update = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportHeight + offsetTop;
      const keyboardInset = Math.max(0, window.innerHeight - viewportBottom);

      root.style.setProperty('--app-height', `${viewportHeight}px`);
      root.style.setProperty('--visual-viewport-height', `${viewportHeight}px`);
      root.style.setProperty(
        '--visual-viewport-offset-top',
        `${offsetTop}px`
      );
      root.style.setProperty('--keyboard-inset', `${keyboardInset}px`);

      if (keyboardInset > 0) {
        root.classList.add('keyboard-open');
      } else {
        root.classList.remove('keyboard-open');
      }
    };

    update();

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
  }, []);
}

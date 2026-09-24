import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Returns false when matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Desktop breakpoint shared by Sheet and the trace layout (DESIGN §1: mobile ≤ 640 px). */
export const DESKTOP_QUERY = '(min-width: 641px)';

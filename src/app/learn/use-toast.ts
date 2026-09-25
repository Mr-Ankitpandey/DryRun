import { useCallback, useEffect, useState } from 'react';

/** How long a status toast stays up. A reading time, not an animation duration. */
export const TOAST_MS = 4000;

/** One status toast at a time; a new message replaces the old one and restarts the timer. */
export function useToast(): { message: string | null; show: (message: string) => void; dismiss: () => void } {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const show = useCallback((message: string) => setToast((t) => ({ message, id: (t?.id ?? 0) + 1 })), []);
  const dismiss = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  return { message: toast?.message ?? null, show, dismiss };
}

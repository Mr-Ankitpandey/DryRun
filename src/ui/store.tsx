/** The single owner of the persisted Store. Every screen reads and writes the
 *  store through `useStore()`; nothing else calls `storage.save`. Saves are
 *  debounced and flushed when the page is hidden, so a finished session is not
 *  lost when the tab closes. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createStorage, defaultStore } from '@/lib/storage';
import type { Storage, Store } from '@/lib/storage';

export interface StoreContextValue {
  store: Store;
  /** Applies a pure update and schedules a save. */
  update: (fn: (store: Store) => Store) => void;
  /** Replaces everything (import, reset). Saves immediately. */
  replace: (store: Store) => void;
  /** True when stored data was unreadable and a fresh store was started. */
  recovered: boolean;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

function browserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return createStorage(window.localStorage);
  } catch {
    return null;
  }
}

export interface StoreProviderProps {
  children: ReactNode;
  /** Injectable for tests; defaults to localStorage. */
  storage?: Storage | null;
  saveDelayMs?: number;
}

export function StoreProvider({ children, storage: injected, saveDelayMs = 250 }: StoreProviderProps) {
  const [storage] = useState<Storage | null>(() => (injected === undefined ? browserStorage() : injected));
  const [initial] = useState(() => (storage ? storage.load() : { store: defaultStore(), recovered: false }));
  const [store, setStore] = useState<Store>(initial.store);

  const pending = useRef<Store | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (storage && pending.current) storage.save(pending.current);
    pending.current = null;
  }, [storage]);

  const schedule = useCallback(
    (next: Store) => {
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, saveDelayMs);
    },
    [flush, saveDelayMs],
  );

  const update = useCallback(
    (fn: (s: Store) => Store) => {
      setStore((prev) => {
        const next = fn(prev);
        if (next !== prev) schedule(next);
        return next;
      });
    },
    [schedule],
  );

  const replace = useCallback(
    (next: Store) => {
      setStore(next);
      pending.current = next;
      flush();
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  const value = useMemo<StoreContextValue>(() => ({ store, update, replace, recovered: initial.recovered }), [store, update, replace, initial.recovered]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Store access for screens. Throws outside a StoreProvider (a wiring bug). */
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

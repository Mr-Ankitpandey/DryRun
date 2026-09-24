/** Theme + motion preference context. Persists through src/lib/storage and
 *  applies through src/lib/theme. `ThemeScope` re-scopes tokens for a subtree
 *  (used by the styleguide to show both themes side by side). */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createStorage, defaultStore } from '@/lib/storage';
import type { MotionPref, Storage, Store, Theme } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  motion: MotionPref;
  setMotion: (motion: MotionPref) => void;
}

const fallback: ThemeContextValue = {
  theme: 'system',
  setTheme: () => {},
  motion: 'system',
  setMotion: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(fallback);

function applyMotion(motion: MotionPref, root: HTMLElement = document.documentElement): void {
  if (motion === 'reduced') root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
}

function browserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return createStorage(window.localStorage);
  } catch {
    return null;
  }
}

export interface ThemeProviderProps {
  children: ReactNode;
  /** Injectable for tests; defaults to localStorage. */
  storage?: Storage | null;
}

export function ThemeProvider({ children, storage: injected }: ThemeProviderProps) {
  const [storage] = useState<Storage | null>(() => injected ?? browserStorage());

  const [settings, setSettings] = useState<Store['settings']>(() =>
    storage ? storage.load().store.settings : defaultStore().settings,
  );

  // Apply before paint; index.html already set the theme attribute pre-hydration.
  useLayoutEffect(() => {
    applyTheme(settings.theme);
    applyMotion(settings.motion);
  }, [settings.theme, settings.motion]);

  // Persist only when the stored value differs (no write on mount).
  useEffect(() => {
    if (!storage) return;
    const { store } = storage.load();
    if (store.settings.theme === settings.theme && store.settings.motion === settings.motion) return;
    storage.save({ ...store, settings: { ...store.settings, theme: settings.theme, motion: settings.motion } });
  }, [settings.theme, settings.motion, storage]);

  const setTheme = useCallback((theme: Theme) => setSettings((prev) => ({ ...prev, theme })), []);
  const setMotion = useCallback((motion: MotionPref) => setSettings((prev) => ({ ...prev, motion })), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: settings.theme, setTheme, motion: settings.motion, setMotion }),
    [settings.theme, settings.motion, setTheme, setMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export interface ThemeScopeProps {
  theme: 'light' | 'dark';
  children: ReactNode;
  className?: string;
}

/** Renders children with tokens re-scoped to one theme (see tokens.css). */
export function ThemeScope({ theme, children, className }: ThemeScopeProps) {
  return (
    <div data-theme={theme} className={className ? `bg-bg text-ink ${className}` : 'bg-bg text-ink'}>
      {children}
    </div>
  );
}

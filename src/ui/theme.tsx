/** Theme + motion preference context. Reads and writes settings through the
 *  StoreProvider (the only writer of persisted data) and applies them through
 *  src/lib/theme. Outside a StoreProvider it keeps settings in memory only.
 *  `ThemeScope` re-scopes tokens for a subtree (styleguide side-by-side view). */

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultStore } from '@/lib/storage';
import type { MotionPref, Store, Theme } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';
import { StoreContext } from './store';

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

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const storeCtx = useContext(StoreContext);
  const [local, setLocal] = useState<Store['settings']>(() => defaultStore().settings);
  const settings = storeCtx ? storeCtx.store.settings : local;
  const update = storeCtx?.update;

  // Apply before paint; index.html already set the theme attribute pre-hydration.
  useLayoutEffect(() => {
    applyTheme(settings.theme);
    applyMotion(settings.motion);
  }, [settings.theme, settings.motion]);

  const setSettings = useCallback(
    (patch: Partial<Store['settings']>) => {
      if (update) update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      else setLocal((prev) => ({ ...prev, ...patch }));
    },
    [update],
  );
  const setTheme = useCallback((theme: Theme) => setSettings({ theme }), [setSettings]);
  const setMotion = useCallback((motion: MotionPref) => setSettings({ motion }), [setSettings]);

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

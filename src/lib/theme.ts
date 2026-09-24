/** Applies the theme preference to <html data-theme>. 'system' removes the
 *  attribute so the CSS media query decides. Pure DOM, no React. */

import type { Theme } from './storage';

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Whether the effective theme is dark, given a preference and the media query. */
export function isDark(theme: Theme, systemDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return systemDark;
}

/** App-wide constants (lead-owned). */

export const APP_VERSION: string = __APP_VERSION__;

/** Public feedback form (Tally / Google Forms). Empty = the feedback link is hidden. */
export const FEEDBACK_URL = '';

/** Primary navigation, in order. Labels are what users do, not system names. */
export const NAV: readonly { href: string; label: string }[] = [
  { href: '/algorithms', label: 'Algorithms' },
  { href: '/review', label: 'Review' },
  { href: '/mistakes', label: 'Mistakes' },
  { href: '/progress', label: 'Progress' },
  { href: '/settings', label: 'Settings' },
];

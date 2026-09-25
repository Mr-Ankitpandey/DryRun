/** Plain-language formatting for the learning screens (review, mistakes,
 *  progress, settings). Pure and deterministic: every function takes `now`. */

import type { Calendar } from '@/learn/progress';
import { localCalendar } from '@/learn/progress';
import { DAY_MS } from '@/learn/scheduler';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** "1 mistake", "3 mistakes". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Rounded percentage as a number, or null when nothing was asked. */
export function percent(correct: number, asked: number): number | null {
  return asked === 0 ? null : Math.round((100 * correct) / asked);
}

/** How long ago `ts` was, from elapsed time: "just now", "5 minutes ago", "yesterday", "3 days ago", "2 weeks ago". */
export function timeAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${plural(Math.floor(diff / MINUTE_MS), 'minute')} ago`;
  if (diff < DAY_MS) return `${plural(Math.floor(diff / HOUR_MS), 'hour')} ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** When something falls due, from elapsed time: "now", "in 20 minutes", "in 5 hours", "tomorrow", "in 3 days". */
export function timeUntil(ts: number, now: number): string {
  const diff = ts - now;
  if (diff <= 0) return 'now';
  if (diff < HOUR_MS) return `in ${plural(Math.max(1, Math.ceil(diff / MINUTE_MS)), 'minute')}`;
  if (diff < DAY_MS) return `in ${plural(Math.ceil(diff / HOUR_MS), 'hour')}`;
  const days = Math.ceil(diff / DAY_MS);
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** 'YYYY-MM-DD' → "Sep 12". Locale-free so screenshots and tests are stable. */
export function shortDate(key: string): string {
  const [, m, d] = key.split('-');
  const month = MONTHS[Number(m) - 1];
  if (!month || !d) return key;
  return `${month} ${Number(d)}`;
}

/** Backup file name for an export made at `now`: dryrun-backup-YYYY-MM-DD.json (local date by default). */
export function backupFilename(now: number, calendar: Calendar = localCalendar): string {
  return `dryrun-backup-${calendar.key(now)}.json`;
}

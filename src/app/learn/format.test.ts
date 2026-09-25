import { describe, expect, it } from 'vitest';
import { utcCalendar } from '@/learn/progress';
import { DAY_MS } from '@/learn/scheduler';
import { backupFilename, percent, plural, shortDate, timeAgo, timeUntil } from './format';

const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('plural and percent', () => {
  it('picks the singular only for one', () => {
    expect(plural(0, 'mistake')).toBe('0 mistakes');
    expect(plural(1, 'mistake')).toBe('1 mistake');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
  it('rounds and returns null when nothing was asked', () => {
    expect(percent(7, 8)).toBe(88);
    expect(percent(0, 0)).toBeNull();
    expect(percent(0, 3)).toBe(0);
  });
});

describe('timeAgo', () => {
  it.each([
    [NOW + 5_000, 'just now'],
    [NOW - 30_000, 'just now'],
    [NOW - 1 * MIN, '1 minute ago'],
    [NOW - 45 * MIN, '45 minutes ago'],
    [NOW - 1 * HOUR, '1 hour ago'],
    [NOW - 23 * HOUR, '23 hours ago'],
    [NOW - DAY_MS, 'yesterday'],
    [NOW - 3 * DAY_MS, '3 days ago'],
    [NOW - 13 * DAY_MS, '13 days ago'],
    [NOW - 14 * DAY_MS, '2 weeks ago'],
    [NOW - 59 * DAY_MS, '8 weeks ago'],
    [NOW - 90 * DAY_MS, '3 months ago'],
    [NOW - 800 * DAY_MS, '2 years ago'],
  ])('%s → %s', (ts, text) => {
    expect(timeAgo(ts, NOW)).toBe(text);
  });
});

describe('timeUntil', () => {
  it.each([
    [NOW - 1, 'now'],
    [NOW, 'now'],
    [NOW + 10_000, 'in 1 minute'],
    [NOW + 20 * MIN, 'in 20 minutes'],
    [NOW + 5 * HOUR, 'in 5 hours'],
    [NOW + DAY_MS, 'tomorrow'],
    [NOW + 3 * DAY_MS, 'in 3 days'],
    [NOW + 3 * DAY_MS - HOUR, 'in 3 days'],
  ])('%s → %s', (ts, text) => {
    expect(timeUntil(ts, NOW)).toBe(text);
  });
});

describe('shortDate and backupFilename', () => {
  it('formats day keys without locale', () => {
    expect(shortDate('2026-09-05')).toBe('Sep 5');
    expect(shortDate('2026-01-31')).toBe('Jan 31');
    expect(shortDate('garbage')).toBe('garbage');
  });
  it('names the backup after the calendar day', () => {
    expect(backupFilename(NOW, utcCalendar)).toBe('dryrun-backup-2026-09-25.json');
    expect(backupFilename(Date.UTC(2026, 0, 2, 23, 59), utcCalendar)).toBe('dryrun-backup-2026-01-02.json');
    expect(backupFilename(NOW)).toMatch(/^dryrun-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

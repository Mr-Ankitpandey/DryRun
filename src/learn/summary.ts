/** "Copy my session summary" (docs/DESIGN.md §5 Settings): a plain-text digest
 *  the student pastes into the feedback form. Deterministic for the same store,
 *  time and version; no seeds, inputs or anything personal. Pure. */

import type { Store } from '@/lib/storage';
import { mistakeBank } from '@/trace/mistakes';
import type { Calendar } from './progress';
import { PROGRESS_DAYS, progress, utcCalendar } from './progress';

export interface SummaryOptions {
  appVersion: string;
  /** Defaults to UTC so the text does not depend on the machine's zone. */
  calendar?: Calendar;
  /** How many mistake kinds to list. */
  topMistakes?: number;
}

const pct = (correct: number, asked: number): string => (asked === 0 ? 'n/a' : `${Math.round((100 * correct) / asked)}%`);

/** Builds the summary text: totals, per-algorithm accuracy, top mistake kinds, review boxes, settings and app version. */
export function sessionSummaryText(store: Store, now: number, opts: SummaryOptions): string {
  const cal = opts.calendar ?? utcCalendar;
  const top = opts.topMistakes ?? 5;
  const graded = store.sessions.filter((s) => s.asked > 0);
  const asked = graded.reduce((n, s) => n + s.asked, 0);
  const correct = graded.reduce((n, s) => n + s.correct, 0);
  const recent = progress(store.sessions, store.mistakes, now, { calendar: cal });
  const bank = mistakeBank(store.mistakes);

  const perAlg = new Map<string, { sessions: number; asked: number; correct: number }>();
  for (const s of graded) {
    const cur = perAlg.get(s.algorithm) ?? { sessions: 0, asked: 0, correct: 0 };
    perAlg.set(s.algorithm, { sessions: cur.sessions + 1, asked: cur.asked + s.asked, correct: cur.correct + s.correct });
  }
  const algorithms = [...perAlg.entries()].sort((a, b) => b[1].asked - a[1].asked || a[0].localeCompare(b[0]));

  const lines: string[] = [];
  lines.push('DryRun session summary');
  lines.push(`App version: ${opts.appVersion}`);
  lines.push(`Generated: ${cal.key(now)}`);
  lines.push(`Using since: ${store.meta.firstSeen === null ? 'n/a' : cal.key(store.meta.firstSeen)}`);
  lines.push(`Sessions: ${store.sessions.length} total, ${graded.length} graded, ${recent.sessions} in the last ${PROGRESS_DAYS} days`);
  lines.push(`Answers: ${correct}/${asked} correct (${pct(correct, asked)})`);
  lines.push(`Mistakes recorded: ${bank.total}`);
  lines.push('');
  lines.push('Per algorithm:');
  if (algorithms.length === 0) lines.push('- none yet');
  for (const [id, a] of algorithms) {
    const review = store.review[id];
    const box = review ? `, review box ${review.box} after ${review.reviews} review${review.reviews === 1 ? '' : 's'}` : '';
    lines.push(`- ${id}: ${a.sessions} session${a.sessions === 1 ? '' : 's'}, ${a.correct}/${a.asked} correct (${pct(a.correct, a.asked)})${box}`);
  }
  lines.push('');
  lines.push('Top mistakes:');
  if (bank.byKind.length === 0) lines.push('- none yet');
  for (const g of bank.byKind.slice(0, top)) lines.push(`- ${g.label}: ${g.count}`);
  lines.push('');
  lines.push(`Settings: level ${store.settings.level}, theme ${store.settings.theme}, motion ${store.settings.motion}`);
  return lines.join('\n');
}

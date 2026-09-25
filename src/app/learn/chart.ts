/** Geometry for the accuracy small multiples (docs/DESIGN.md §5 Progress).
 *  One panel per algorithm, a shared y scale of 0–100 %, one x slot per day.
 *  Days with nothing asked are gaps: lines only join consecutive days that both
 *  have data, and a lone day is a dot. Pure; the component only draws. */

import type { DailyPoint } from '@/learn/progress';
import { plural, shortDate } from './format';

export interface PanelFrame {
  /** Full viewBox size. */
  width: number;
  height: number;
  /** Plot area inset inside the viewBox. */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The panel frame every small multiple uses, so scales are identical. */
/** `right` leaves room for the latest-value label ("100%") beside the last day. */
export const PANEL: PanelFrame = { width: 320, height: 132, left: 34, right: 38, top: 10, bottom: 24 };

export const plotWidth = (f: PanelFrame): number => f.width - f.left - f.right;
export const plotHeight = (f: PanelFrame): number => f.height - f.top - f.bottom;

/** x of day slot `i` of `n` (first day at the left edge, last at the right edge). */
export function xAt(i: number, n: number, f: PanelFrame = PANEL): number {
  const w = plotWidth(f);
  return f.left + (n <= 1 ? w / 2 : (i * w) / (n - 1));
}

/** y of an accuracy in [0, 1]; values outside are clamped. */
export function yAt(accuracy: number, f: PanelFrame = PANEL): number {
  const a = Math.min(1, Math.max(0, accuracy));
  return f.top + (1 - a) * plotHeight(f);
}

export interface PlotPoint {
  i: number;
  x: number;
  y: number;
  accuracy: number;
}

/** Runs of consecutive days that have data. A run of one is drawn as a dot only. */
export function runs(series: readonly DailyPoint[], f: PanelFrame = PANEL): PlotPoint[][] {
  const out: PlotPoint[][] = [];
  let cur: PlotPoint[] = [];
  series.forEach((p, i) => {
    if (p.accuracy === null) {
      if (cur.length) out.push(cur);
      cur = [];
      return;
    }
    cur.push({ i, x: xAt(i, series.length, f), y: yAt(p.accuracy, f), accuracy: p.accuracy });
  });
  if (cur.length) out.push(cur);
  return out;
}

const r2 = (n: number): string => String(Math.round(n * 100) / 100);

/** SVG path for a run: "M x y L x y …". Empty for runs shorter than two points. */
export function linePath(run: readonly PlotPoint[]): string {
  if (run.length < 2) return '';
  return run.map((p, k) => `${k === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join(' ');
}

/** Closed area under a run down to the 0 % baseline. Empty for runs shorter than two points. */
export function areaPath(run: readonly PlotPoint[], f: PanelFrame = PANEL): string {
  const first = run[0];
  const last = run[run.length - 1];
  if (run.length < 2 || !first || !last) return '';
  const base = r2(yAt(0, f));
  return `${linePath(run)} L${r2(last.x)} ${base} L${r2(first.x)} ${base} Z`;
}

/** Day slot nearest to an x in viewBox units, clamped to [0, n-1]. */
export function nearestDay(x: number, n: number, f: PanelFrame = PANEL): number {
  if (n <= 1) return 0;
  const step = plotWidth(f) / (n - 1);
  return Math.min(n - 1, Math.max(0, Math.round((x - f.left) / step)));
}

/** Index of the next day with data from `from` in direction `dir`, or `from` when there is none. */
export function stepToData(series: readonly DailyPoint[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < series.length; i += dir) {
    const p = series[i];
    if (p && p.accuracy !== null) return i;
  }
  return from;
}

/** Index of the most recent day with data, or -1. */
export function lastDataIndex(series: readonly DailyPoint[]): number {
  for (let i = series.length - 1; i >= 0; i--) if (series[i]?.accuracy != null) return i;
  return -1;
}

/** Bar length in [0, 1] of the widest bar for a count list (mistakes by kind). */
export function barFraction(count: number, max: number): number {
  return max <= 0 ? 0 : Math.min(1, Math.max(0, count / max));
}

const pctText = (a: number): string => `${Math.round(a * 100)}%`;

/** Screen-reader summary of one panel: how many days have data, first and latest value. */
export function panelSummary(title: string, series: readonly DailyPoint[]): string {
  const days = series.filter((p): p is DailyPoint & { accuracy: number } => p.accuracy !== null);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return `${title}: no answers in this period.`;
  if (first === last) return `${title}: answers on 1 day, ${shortDate(first.date)} at ${pctText(first.accuracy)}.`;
  return `${title}: answers on ${plural(days.length, 'day')}, from ${pctText(first.accuracy)} on ${shortDate(first.date)} to ${pctText(last.accuracy)} on ${shortDate(last.date)}.`;
}

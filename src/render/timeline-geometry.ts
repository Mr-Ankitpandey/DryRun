/** Pure geometry for the timeline strip: k ↔ x, and phase runs. */

export const TIMELINE_PAD = 10;

/** x of state k (0..length) in a strip `width` px wide. */
export function timelineX(k: number, length: number, width: number, pad = TIMELINE_PAD): number {
  const span = Math.max(0, width - 2 * pad);
  if (length <= 0) return pad;
  return pad + (Math.max(0, Math.min(length, k)) / length) * span;
}

/** Nearest k for a pointer at x. */
export function kAtX(x: number, length: number, width: number, pad = TIMELINE_PAD): number {
  const span = Math.max(1, width - 2 * pad);
  if (length <= 0) return 0;
  const k = Math.round(((x - pad) / span) * length);
  return Math.max(0, Math.min(length, k));
}

export interface PhaseRun {
  phase: string;
  /** First step index of the run. */
  from: number;
  /** One past the last step index. */
  to: number;
  /** Order of first appearance of this phase (drives its tone). */
  index: number;
}

/** Consecutive steps with the same phase, as runs. Steps without a phase join
 *  the run before them (they belong to what is going on). */
export function phaseRuns(phases: readonly (string | undefined)[]): PhaseRun[] {
  const runs: PhaseRun[] = [];
  const order = new Map<string, number>();
  phases.forEach((p, i) => {
    const last = runs[runs.length - 1];
    const phase = p ?? last?.phase ?? '';
    if (last && last.phase === phase) {
      last.to = i + 1;
      return;
    }
    if (!order.has(phase)) order.set(phase, order.size);
    runs.push({ phase, from: i, to: i + 1, index: order.get(phase) as number });
  });
  return runs;
}

/** Draw every `stride`-th step tick so ticks stay at least `minGap` px apart
 *  (1, 2, 5, 10, 20, 50, …). Ask marks are drawn regardless. */
export function tickStride(length: number, width: number, minGap = 6, pad = TIMELINE_PAD): number {
  const span = Math.max(1, width - 2 * pad);
  if (length <= 0) return 1;
  const gap = span / length;
  for (let base = 1; ; base *= 10) {
    for (const f of [1, 2, 5]) {
      const s = base * f;
      if (gap * s >= minGap || s >= length) return Math.min(s, length);
    }
  }
}

/** Half-width of an ask mark: 4 px, narrower when asks sit closer than 9 px
 *  so neighbours never merge into one blob (never below 1.5 px). */
export function askMarkHalf(asks: readonly number[], length: number, width: number, pad = TIMELINE_PAD): number {
  if (asks.length < 2 || length <= 0) return 4;
  const sorted = [...asks].sort((a, b) => a - b);
  let minStep = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const d = (sorted[i] as number) - (sorted[i - 1] as number);
    if (d > 0) minStep = Math.min(minStep, d);
  }
  if (!Number.isFinite(minStep)) return 4;
  const gapPx = (minStep / length) * Math.max(0, width - 2 * pad);
  return Math.max(1.5, Math.min(4, gapPx / 2 - 0.75));
}

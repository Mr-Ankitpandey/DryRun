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

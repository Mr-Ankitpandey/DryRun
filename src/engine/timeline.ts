/** Timeline controller as a pure reducer (no React). `k` is the index into
 *  Run.states: k = 0 is the initial state, k = steps.length is the end.
 *  A gate is the index of a step whose ask must be answered before it applies:
 *  play and forward stepping stop at k === gate. */

export type Speed = 0.5 | 1 | 1.5 | 2;

export interface Timeline {
  k: number;
  length: number; // number of steps
  playing: boolean;
  speed: Speed;
  scrubbing: boolean;
  gate: number | null;
}

export type TimelineAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; k: number }
  | { type: 'scrub'; k: number } // like seek, but flags scrubbing (zero-duration transitions)
  | { type: 'scrubEnd' }
  | { type: 'speed'; speed: Speed }
  | { type: 'gate'; gate: number | null }
  | { type: 'reset'; length: number };

export function createTimeline(length: number, gate: number | null = null): Timeline {
  return { k: 0, length, playing: false, speed: 1, scrubbing: false, gate };
}

export function timelineReducer(t: Timeline, a: TimelineAction): Timeline {
  switch (a.type) {
    case 'play':
      if (atGate(t) || t.k >= t.length) return { ...t, playing: false };
      return { ...t, playing: true };
    case 'pause':
      return { ...t, playing: false };
    case 'toggle':
      return timelineReducer(t, { type: t.playing ? 'pause' : 'play' });
    case 'next': {
      if (atGate(t) || t.k >= t.length) return { ...t, playing: false };
      const k = t.k + 1;
      const stop = k >= t.length || (t.gate !== null && k >= t.gate);
      return { ...t, k, playing: stop ? false : t.playing };
    }
    case 'prev':
      return { ...t, k: Math.max(0, t.k - 1), playing: false };
    case 'seek':
    case 'scrub': {
      const k = clamp(a.k, 0, t.gate === null ? t.length : Math.min(t.length, t.gate));
      return { ...t, k, playing: false, scrubbing: a.type === 'scrub' };
    }
    case 'scrubEnd':
      return { ...t, scrubbing: false };
    case 'speed':
      return { ...t, speed: a.speed };
    case 'gate': {
      if (a.gate !== null && (a.gate < 0 || a.gate > t.length)) throw new Error(`timeline: gate ${a.gate} outside [0, ${t.length}]`);
      const k = a.gate === null ? t.k : Math.min(t.k, a.gate);
      return { ...t, gate: a.gate, k, playing: t.playing && !(a.gate !== null && k >= a.gate) };
    }
    case 'reset':
      return createTimeline(a.length, null);
  }
}

export function atGate(t: Timeline): boolean {
  return t.gate !== null && t.k >= t.gate;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

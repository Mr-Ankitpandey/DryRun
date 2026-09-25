/** How each moving element should travel in one step (docs/DESIGN.md §3a,
 *  "Pick up and place"). Pure: derived from the step's semantic events and the
 *  state before it, never authored per algorithm.
 *
 *  - `swap`: the two elements arc in opposite directions (the one travelling
 *    right lifts over, the one travelling left dips under) so they never cross.
 *  - `move` to the next or previous slot of the same array, into an empty
 *    slot: a shift. It slides flat, because shift and swap must look different.
 *  - any other `move` (into another array, or further than one slot): a lift. */

import type { Id, Step } from '@/engine/events';
import type { State } from '@/engine/state';
import { elementAt, slotOf } from '@/engine/state';

export type Lift = 'over' | 'under' | 'flat';
export type MoveHints = ReadonlyMap<Id, Lift>;

export const NO_HINTS: MoveHints = new Map();

function safeElementAt(state: State, arr: string, i: number): Id | null {
  try {
    return elementAt(state, { arr, i });
  } catch {
    return null;
  }
}

export function moveHints(before: State | undefined, step: Step | undefined): MoveHints {
  if (!before || !step) return NO_HINTS;
  const out = new Map<Id, Lift>();
  for (const ev of step.events) {
    if (ev.t === 'swap') {
      const a = safeElementAt(before, ev.a.arr, ev.a.i);
      const b = safeElementAt(before, ev.b.arr, ev.b.i);
      if (a === null || b === null || a === b) continue;
      // a travels to b's slot: over when that is to the right.
      const aRight = ev.b.i > ev.a.i;
      out.set(a, aRight ? 'over' : 'under');
      out.set(b, aRight ? 'under' : 'over');
    } else if (ev.t === 'move') {
      const from = slotOf(before, ev.id);
      const target = safeElementAt(before, ev.to.arr, ev.to.i);
      const shift = from !== null && from.arr === ev.to.arr && Math.abs(from.i - ev.to.i) === 1 && target === null;
      out.set(ev.id, shift ? 'flat' : 'over');
    }
  }
  return out;
}

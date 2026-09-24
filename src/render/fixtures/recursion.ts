/** Quick-sort-like fixture (Lomuto partition) on a 6-element array: call /
 *  return frames form the recursion tree under the array, pointers i and j
 *  walk the segment, elements swap (object constancy), pivots settle. */

import type { Slot, Step } from '@/engine/events';
import { ids } from '@/engine/ids';
import { emptyState, withArray } from '@/engine/state';
import type { Fixture } from './types';

const INPUT = [5, 2, 8, 1, 9, 3];
const A = 'a';
const slot = (i: number): Slot => ({ arr: A, i });

function build(): Step[] {
  const a = INPUT.slice();
  const steps: Step[] = [];
  let frameNo = 0;

  const qs = (lo: number, hi: number, parent: string | null): void => {
    const id = ids.frame(++frameNo);
    steps.push({ line: 1, events: [{ t: 'call', id, label: 'qs', args: { lo, hi }, parent }], note: `Call qs(${lo}, ${hi}).`, phase: 'call' });
    if (lo >= hi) {
      const events: Step['events'] = [{ t: 'return', id }];
      if (lo === hi) events.unshift({ t: 'mark', ref: slot(lo), as: 'done' });
      steps.push({ line: 2, events, note: lo === hi ? `One element at ${lo}: already sorted, return.` : `Empty range [${lo}, ${hi}]: return.`, phase: 'call' });
      return;
    }
    const pivot = a[hi] as number;
    steps.push({
      line: 3,
      events: [
        { t: 'mark', ref: slot(hi), as: 'pivot' },
        { t: 'var', name: 'pivot', value: pivot },
        { t: 'pointer', name: 'i', at: slot(lo) },
        { t: 'pointer', name: 'j', at: slot(lo) },
        { t: 'region', name: 'less', kind: 'less', arr: A, range: null },
      ],
      note: `pivot = a[${hi}] = ${pivot}; i = j = ${lo}.`,
      phase: 'partition',
    });
    let i = lo;
    for (let j = lo; j < hi; j++) {
      const v = a[j] as number;
      const less = v < pivot;
      steps.push({
        line: 4,
        events: [{ t: 'pointer', name: 'j', at: slot(j) }, { t: 'compare', a: slot(j), b: slot(hi), result: less ? '<' : v === pivot ? '=' : '>' }],
        note: less ? `a[${j}] = ${v} < ${pivot}: it belongs on the left.` : `a[${j}] = ${v} ≥ ${pivot}: leave it.`,
        phase: 'partition',
      });
      if (less) {
        const events: Step['events'] = [];
        if (i !== j) {
          events.push({ t: 'swap', a: slot(i), b: slot(j) });
          [a[i], a[j]] = [a[j] as number, a[i] as number];
        }
        i++;
        events.push({ t: 'pointer', name: 'i', at: slot(i) }, { t: 'region', name: 'less', kind: 'less', arr: A, range: i - 1 >= lo ? [lo, i - 1] : null });
        steps.push({ line: 5, events, note: i - 1 === j ? `Already in place: i = ${i}.` : `Swap a[${i - 1}] and a[${j}]; i = ${i}.`, phase: 'partition' });
      }
    }
    const events: Step['events'] = [];
    if (i !== hi) {
      events.push({ t: 'swap', a: slot(i), b: slot(hi) });
      [a[i], a[hi]] = [a[hi] as number, a[i] as number];
    }
    events.push({ t: 'mark', ref: slot(i), as: 'settled' }, { t: 'pointer', name: 'j', at: null }, { t: 'region', name: 'less', kind: 'less', arr: A, range: null });
    steps.push({ line: 6, events, note: `Place the pivot at ${i}: everything left is smaller, right is ≥.`, phase: 'partition' });
    qs(lo, i - 1, id);
    qs(i + 1, hi, id);
    steps.push({ line: 8, events: [{ t: 'return', id }, { t: 'pointer', name: 'i', at: null }], note: `Return from qs(${lo}, ${hi}).`, phase: 'call' });
  };

  qs(0, INPUT.length - 1, null);
  return steps;
}

export const recursionFixture: Fixture = {
  id: 'recursion',
  title: 'Quick sort (Lomuto) with the call tree',
  pseudocode: ['qs(lo, hi):', '  if lo >= hi: return', '  pivot = a[hi]; i = lo', '  for j in lo..hi-1: if a[j] < pivot:', '    swap a[i], a[j]; i += 1', '  swap a[i], a[hi]', '  qs(lo, i-1); qs(i+1, hi)', '  return'],
  initial: withArray(emptyState(), A, INPUT),
  steps: build(),
};

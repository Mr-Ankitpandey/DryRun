/** Beat 5: the heap. One insert plays through: the new minimum swaps its way
 *  up, moving in the array and the tree at the same time (same element id). */

import { useCurrentFrame } from 'remotion';
import { heap } from '@/algorithms/heap';
import { AdStage } from '../components/AdStage';
import { BEAT, Beat } from '../components/Beat';
import { boundsOf } from '../lib/bounds';
import { presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(heap, presetInput(heap, 'insert-bubbles-to-root'));
const last = t.scenes.length - 1;
const bounds = boundsOf(t.scenes);
const START = 8;
const END = BEAT - 12;

export function HeapMove() {
  const frame = useCurrentFrame();
  const pos = Math.max(0, Math.min(last, ((frame - START) / (END - START)) * last));
  const k = Math.min(last - 1, Math.floor(pos));
  const a = t.scenes[k];
  const b = t.scenes[k + 1];
  const scene = a && b ? tweenScene(a, b, ease(pos - k)) : (t.scenes[last] ?? t.scenes[0]);
  if (!scene) throw new Error('ad: heap scene missing');
  return <Beat headline="See every move. Exactly." sub="Array and tree, in sync." visual={<AdStage scene={scene} layout={t.layout} bounds={bounds} />} />;
}

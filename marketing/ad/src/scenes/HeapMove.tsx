/** 17–21 s, paper. The heap: one insert plays through; the new minimum swaps
 *  its way up, moving in the array and the tree at the same time. */

import { useCurrentFrame, useVideoConfig } from 'remotion';
import { heap } from '@/algorithms/heap';
import { AdStage } from '../components/AdStage';
import { Beat } from '../components/Beat';
import { boundsOf } from '../lib/bounds';
import { presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(heap, presetInput(heap, 'insert-bubbles-to-root'));
const last = t.scenes.length - 1;
const bounds = boundsOf(t.scenes);
const START = 14;

export function HeapMove() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const end = durationInFrames - 26;
  const pos = Math.max(0, Math.min(last, ((frame - START) / (end - START)) * last));
  const k = Math.min(last - 1, Math.floor(pos));
  const a = t.scenes[k];
  const b = t.scenes[k + 1];
  const scene = a && b ? tweenScene(a, b, ease(pos - k)) : (t.scenes[last] ?? t.scenes[0]);
  if (!scene) throw new Error('ad: heap scene missing');
  return <Beat headline={'See every move.\nExactly.'} sub="Array and tree move together. Same element, same instant." visual={<AdStage scene={scene} layout={t.layout} bounds={bounds} />} />;
}

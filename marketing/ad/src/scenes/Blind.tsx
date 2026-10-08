/** Beat 6: Blind mode. The stage stays frozen while steps run hidden (the
 *  app's own sentence), then the hidden steps replay quickly. */

import { interpolate, useCurrentFrame } from 'remotion';
import { quickSort } from '@/algorithms/quick-sort';
import { hiddenSentence } from '@/app/trace/blind';
import { AdStage } from '../components/AdStage';
import { Beat } from '../components/Beat';
import { boundsOf } from '../lib/bounds';
import { findStep, presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(quickSort, presetInput(quickSort, 'random'));
// Freeze just before the first swap of the first partition; four steps run hidden.
const HIDDEN = 4;
const F = Math.max(0, findStep(t, (s) => s.events.some((e) => e.t === 'swap')) - 1);
const REPLAY = [44, 78] as const;
const bounds = boundsOf(t.scenes.slice(F, F + HIDDEN + 1));

export function Blind() {
  const frame = useCurrentFrame();
  const pos = interpolate(frame, REPLAY, [0, HIDDEN], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const k = Math.min(F + HIDDEN - 1, F + Math.floor(pos));
  const a = t.scenes[k];
  const b = t.scenes[k + 1];
  const scene = a && b ? tweenScene(a, b, ease(pos - Math.floor(pos))) : t.scenes[F];
  if (!scene) throw new Error('ad: blind scene missing');
  const frozen = frame < REPLAY[0];
  return (
    <Beat
      headline={<>Blind mode.<br />Trace it in your head.</>}
      sub={frozen ? hiddenSentence(HIDDEN) : 'Then watch what really happened.'}
      visual={
        <AdStage scene={scene} layout={t.layout} bounds={bounds} frozen={frozen} />
      }
    />
  );
}

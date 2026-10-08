/** Beat 4: Dijkstra's honest moment, a stale queue entry. The real question,
 *  answered correctly: the green ring draws on the stale node. */

import { interpolate, useCurrentFrame } from 'remotion';
import { dijkstra } from '@/algorithms/dijkstra';
import { AdStage } from '../components/AdStage';
import { Beat } from '../components/Beat';
import { FadeRing } from '../components/Marks';
import { boundsOf } from '../lib/bounds';
import { findStep, presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(dijkstra, presetInput(dijkstra, 'stale-entry'));

function setup() {
  const s = findStep(t, (st) => st.ask?.kind === 'choice' && st.ask.answer === 'yes' && st.events.some((e) => e.t === 'skip'));
  const step = t.steps[s];
  const skip = step?.events.find((e) => e.t === 'skip');
  const nodeId = skip && skip.t === 'skip' && 'id' in skip.ref ? skip.ref.id : null;
  const from = t.scenes[s - 1];
  const at = t.scenes[s];
  const after = t.scenes[s + 1];
  if (!step?.ask || !nodeId || !from || !at || !after) throw new Error('ad: stale step missing');
  return { prompt: step.ask.prompt, nodeId, from, at, after };
}
const { prompt, nodeId, from, at, after } = setup();
const bounds = boundsOf([from, at, after]);

export function Predict() {
  const frame = useCurrentFrame();
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const a = ease(interpolate(frame, [6, 22], [0, 1], clamp));
  const b = ease(interpolate(frame, [44, 60], [0, 1], clamp));
  const scene = frame < 44 ? tweenScene(from, at, a) : tweenScene(at, after, b);
  const yes = interpolate(frame, [30, 38], [0, 1], clamp);
  return (
    <Beat
      headline="Predict every step."
      sub={
        <>
          <div>{prompt}</div>
          <div style={{ marginTop: 14, opacity: yes, color: 'var(--green)', fontWeight: 600 }}>✓ Yes, skip it.</div>
        </>
      }
      visual={<AdStage scene={scene} layout={t.layout} bounds={bounds} overlay={<FadeRing scene={after} id={nodeId} from={52} />} />}
    />
  );
}

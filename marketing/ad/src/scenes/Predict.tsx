/** 13–17 s, paper. Dijkstra's honest moment, a stale queue entry: the real
 *  question, answered right; the green ring draws on the stale node. */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
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
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Predict() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = ease(interpolate(frame, [10, 26], [0, 1], clamp));
  const b = ease(interpolate(frame, [62, 80], [0, 1], clamp));
  const scene = frame < 62 ? tweenScene(from, at, a) : tweenScene(at, after, b);
  const yes = spring({ frame: frame - 46, fps, config: { damping: 14, stiffness: 180 } });
  return (
    <Beat
      headline="Predict every step."
      sub={
        <>
          <div>{prompt}</div>
          <div
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 20px',
              borderRadius: 999,
              background: 'var(--green)',
              color: 'var(--surface)',
              fontWeight: 600,
              transform: `scale(${0.6 + 0.4 * yes})`,
              transformOrigin: 'left center',
              opacity: Math.min(1, yes * 2),
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Yes. It is stale, skip it.
          </div>
        </>
      }
      visual={<AdStage scene={scene} layout={t.layout} bounds={bounds} overlay={<FadeRing scene={after} id={nodeId} from={72} />} />}
    />
  );
}

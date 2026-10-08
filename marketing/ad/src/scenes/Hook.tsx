/** Beats 1–2 (6 s), one continuous stage: the real binary-search question,
 *  a wrong tap, the ghost of the guess, the real move and the real rule. */

import { interpolate, useCurrentFrame } from 'remotion';
import { binarySearch } from '@/algorithms/binary-search';
import { AdStage } from '../components/AdStage';
import { BEAT, Beat } from '../components/Beat';
import { FadeGhost, FadeRing, Tap } from '../components/Marks';
import { boundsOf } from '../lib/bounds';
import { findStep, presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(binarySearch, presetInput(binarySearch, 'basic'));

function setup() {
  // The first "Where does mid land?" question, as the app asks it.
  const g = findStep(t, (s) => s.ask?.kind === 'pick');
  const ask = t.steps[g]?.ask;
  if (!ask || ask.kind !== 'pick') throw new Error('ad: hook ask missing');
  const wrong = ask.distractors[0];
  const before = t.scenes[g];
  const after = t.scenes[g + 1];
  if (!wrong || !before || !after) throw new Error('ad: hook data missing');
  return { answer: ask.answer, wrong, before, after };
}
const { answer, wrong, before, after } = setup();
const bounds = boundsOf([before, after]);

const TAP = 34;
const MOVE = [52, 72] as const;

export function Hook() {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, MOVE, [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const scene = tweenScene(before, after, p);
  const appear = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const second = frame >= BEAT;

  return (
    <Beat
      headline={second ? 'Wrong? Your guess stays.' : <>Binary search for 42.<br />Where does mid go next?</>}
      riseAt={second ? BEAT : 0}
      sub={second ? <span style={{ color: 'var(--red)' }}>{wrong.rule}</span> : undefined}
      visual={
        <div style={{ opacity: appear, transform: `translateY(${(1 - appear) * 24}px)` }}>
          <AdStage
            scene={scene}
            layout={t.layout}
            bounds={bounds}
            overlay={
              <>
                <Tap scene={before} id={wrong.answer} at={TAP} />
                <FadeGhost scene={before} id={wrong.answer} from={TAP + 6} />
                <FadeRing scene={after} id={answer} from={MOVE[1] - 4} tone="truth" />
              </>
            }
          />
        </div>
      }
    />
  );
}

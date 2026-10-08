/** 4–10 s, paper. The real question; a wrong tap; the ghost sketches in; the
 *  real move plays; the camera pushes in on the gap; the real rule appears. */

import { interpolate, useCurrentFrame } from 'remotion';
import { binarySearch } from '@/algorithms/binary-search';
import { outlineOf } from '@/render/outline';
import { AdStage } from '../components/AdStage';
import { Beat } from '../components/Beat';
import { FadeGhost, FadeRing, Tap } from '../components/Marks';
import { boundsOf } from '../lib/bounds';
import { findStep, presetInput, traceOf } from '../lib/trace';
import { ease, tweenScene } from '../lib/tween';

const t = traceOf(binarySearch, presetInput(binarySearch, 'basic'));

function setup() {
  // The first "Where does mid land?" question, exactly as the app asks it.
  const g = findStep(t, (s) => s.ask?.kind === 'pick');
  const ask = t.steps[g]?.ask;
  if (!ask || ask.kind !== 'pick') throw new Error('ad: challenge ask missing');
  const wrong = ask.distractors[0];
  const before = t.scenes[g];
  const after = t.scenes[g + 1];
  if (!wrong || !before || !after) throw new Error('ad: challenge data missing');
  const a = outlineOf(before, wrong.answer, 0);
  const b = outlineOf(after, ask.answer, 0);
  if (!a || !b) throw new Error('ad: challenge outlines missing');
  return { prompt: ask.prompt, answer: ask.answer, wrong, before, after, focus: { cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2 } };
}
const { prompt, answer, wrong, before, after, focus } = setup();
const bounds = boundsOf([before, after]);

const TAP = 44;
const MOVE = [66, 86] as const;
const RULE = 96;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Challenge() {
  const frame = useCurrentFrame();
  const scene = tweenScene(before, after, ease(interpolate(frame, MOVE, [0, 1], clamp)));
  const k = 1 + 0.32 * ease(interpolate(frame, [92, 130], [0, 1], clamp));
  const second = frame >= RULE;
  return (
    <Beat
      headline={second ? 'Wrong? Your guess\nstays on screen.' : prompt.replace('. ', '.\n')}
      at={second ? RULE : 8}
      sub={second ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>{wrong.rule}</span> : undefined}
      subAt={RULE + 18}
      visual={
        <AdStage
          scene={scene}
          layout={t.layout}
          bounds={bounds}
          zoom={{ ...focus, k }}
          overlay={
            <>
              <Tap scene={before} id={wrong.answer} at={TAP} />
              <FadeGhost scene={before} id={wrong.answer} from={TAP + 6} />
              <FadeRing scene={after} id={answer} from={MOVE[1] - 4} tone="truth" />
            </>
          }
        />
      }
    />
  );
}

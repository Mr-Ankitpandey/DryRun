/** 0–4 s, ink. The hook: two kinetic lines on the dark board, with the real
 *  binary-search array rising faintly underneath as a promise of what follows. */

import { interpolate, useCurrentFrame } from 'remotion';
import { binarySearch } from '@/algorithms/binary-search';
import { AdStage } from '../components/AdStage';
import { Corner, Page, display, useWide } from '../components/Beat';
import { Kinetic } from '../components/Kinetic';
import { boundsOf } from '../lib/bounds';
import { presetInput, traceOf } from '../lib/trace';

const t = traceOf(binarySearch, presetInput(binarySearch, 'basic'));
function firstScene() {
  const s = t.scenes[0];
  if (!s) throw new Error('ad: hook scene missing');
  return s;
}
const first = firstScene();
const bounds = boundsOf([first]);

export function Hook() {
  const frame = useCurrentFrame();
  const wide = useWide();
  const ghost = interpolate(frame, [40, 100], [0, 0.32], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const big = { ...display, color: 'var(--ink)', fontSize: wide ? 96 : 104 };
  return (
    <Page tone="ink" wipe={false}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: wide ? '0 160px' : '0 72px', gap: wide ? 40 : 56 }}>
        <h1 style={{ ...big, color: 'var(--ink-2)', fontSize: 64 }}>
          <Kinetic text={wide ? "You've watched binary search\na dozen times." : "You've watched\nbinary search\na dozen times."} at={4} stagger={3} />
        </h1>
        <h1 style={big}>
          <Kinetic text={wide ? 'So where does mid go next?' : 'So where does\nmid go next?'} at={46} stagger={4} />
        </h1>
      </div>
      <div style={{ position: 'absolute', left: wide ? 160 : 72, right: wide ? 160 : 72, bottom: wide ? 70 : 180, opacity: ghost, transform: `translateY(${(0.32 - ghost) * 160}px)` }}>
        <AdStage scene={first} layout={t.layout} bounds={bounds} />
      </div>
      <Corner tone="ink" />
    </Page>
  );
}

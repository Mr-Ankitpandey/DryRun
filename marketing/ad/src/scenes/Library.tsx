/** 32.5–36 s, paper. The count runs up to the real number of algorithms while
 *  the real titles from the registry drop into two columns. */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { registry } from '@/algorithms/registry';
import { Corner, Page, display, useWide } from '../components/Beat';
import { Kinetic } from '../components/Kinetic';

export function Library() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const n = registry.length;
  const count = Math.round(interpolate(frame, [6, 40], [0, n], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <Page>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: wide ? 'row' : 'column', justifyContent: 'center', alignItems: wide ? 'center' : 'stretch', padding: wide ? '120px 110px' : '210px 72px 140px', gap: wide ? 90 : 56 }}>
        <div style={{ flex: wide ? '0 0 560px' : undefined }}>
          <div style={{ ...display, fontSize: wide ? 240 : 260, color: 'var(--pen)', lineHeight: 0.9 }}>{count}</div>
          <h1 style={{ ...display, fontSize: wide ? 80 : 84, color: 'var(--ink)', marginTop: 12 }}>
            <Kinetic text={'core algorithms\nto trace.'} at={10} />
          </h1>
        </div>
        <div style={{ columns: 2, columnGap: 36, flex: 1 }}>
          {registry.map((e, i) => {
            const s = spring({ frame: frame - 12 - i * 3, fps, config: { damping: 15, stiffness: 160 } });
            return (
              <div
                key={e.id}
                style={{ breakInside: 'avoid', fontFamily: 'var(--font-ui)', fontSize: wide ? 28 : 30, lineHeight: 1.25, color: 'var(--ink)', padding: '11px 0', borderBottom: '2px solid var(--rule)', opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * -26}px)` }}
              >
                {e.title}
              </div>
            );
          })}
        </div>
      </div>
      <Corner />
    </Page>
  );
}

/** 36–39 s, pen field. Three plain promises, each with a tick that draws
 *  itself before the words rise. All three are true of the product. */

import { interpolate, useCurrentFrame } from 'remotion';
import { Corner, Page, display, useWide } from '../components/Beat';
import { Kinetic } from '../components/Kinetic';

const LINES = ['Free.', 'No sign-up.', 'Works on your phone.'];

export function Free() {
  const frame = useCurrentFrame();
  const wide = useWide();
  const size = wide ? 96 : 100;
  return (
    <Page tone="pen">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: wide ? '0 200px' : '0 72px', gap: wide ? 26 : 34 }}>
        {LINES.map((text, i) => {
          const at = 8 + i * 14;
          const draw = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
              <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                <path d="M4 12.5l5 5L20 6.5" stroke="var(--surface)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              </svg>
              <h1 style={{ ...display, fontSize: size, color: 'var(--surface)' }}>
                <Kinetic text={text} at={at + 4} />
              </h1>
            </div>
          );
        })}
      </div>
      <Corner tone="pen" />
    </Page>
  );
}

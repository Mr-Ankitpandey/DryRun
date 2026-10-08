/** 10–13 s, pen field. The problem in one line, with the "≠" drawn as two
 *  bars and a slash that writes itself, like a pen correcting the page. */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Corner, Page, display, useWide } from '../components/Beat';
import { Kinetic } from '../components/Kinetic';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function NotEqualSign({ size, frame }: { size: number; frame: number }) {
  const bars = interpolate(frame, [16, 26], [0, 1], clamp);
  const slash = interpolate(frame, [26, 38], [0, 1], clamp);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <g stroke="var(--surface)" strokeWidth={9} strokeLinecap="round" fill="none">
        <path d="M14 38 H86" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - bars} />
        <path d="M14 62 H86" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - bars} />
        <path d="M66 12 L34 88" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - slash} stroke="var(--ink)" />
      </g>
    </svg>
  );
}

export function NotEqual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const size = wide ? 150 : 170;
  const sub = spring({ frame: frame - 44, fps, config: { damping: 200 } });
  const big = { ...display, color: 'var(--surface)', fontSize: wide ? 140 : 150 };
  return (
    <Page tone="pen">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: wide ? '0 160px' : '0 72px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: wide ? 36 : 8 }}>
          <h1 style={big}>
            <Kinetic text="Watching" at={4} />
          </h1>
          <NotEqualSign size={size} frame={frame} />
          <h1 style={big}>
            <Kinetic text="knowing." at={30} />
          </h1>
        </div>
        <p style={{ margin: '28px 0 0', fontFamily: 'var(--font-ui)', fontSize: wide ? 40 : 44, lineHeight: 1.3, color: 'var(--surface)', opacity: sub, transform: `translateY(${(1 - sub) * 18}px)` }}>
          Interviews ask you to run the algorithm, not replay a video.
        </p>
      </div>
      <Corner tone="pen" />
    </Page>
  );
}

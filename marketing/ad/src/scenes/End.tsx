/** Beat 10: the end card. Wordmark, tagline, and the live link. */

import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AD_LINK } from '../config';
import { Paper, Wordmark, useWide } from '../components/Beat';

export function End() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const a = spring({ frame, fps, config: { damping: 200 } });
  const b = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const c = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  return (
    <Paper>
      <AbsoluteFill style={{ justifyContent: 'center', padding: wide ? '0 220px' : '0 80px', gap: wide ? 40 : 48 }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
          <Wordmark size={wide ? 150 : 150} />
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: wide ? 76 : 82,
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            opacity: b,
            transform: `translateY(${(1 - b) * 24}px)`,
          }}
        >
          Stop watching algorithms.
          <br />
          Start tracing them.
        </h1>
        <div style={{ opacity: c, transform: `translateY(${(1 - c) * 16}px)` }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-mono)',
              fontSize: wide ? 46 : 44,
              fontWeight: 600,
              color: 'var(--surface)',
              background: 'var(--pen)',
              padding: '18px 30px',
              borderRadius: 6,
            }}
          >
            {AD_LINK}
          </span>
        </div>
      </AbsoluteFill>
    </Paper>
  );
}

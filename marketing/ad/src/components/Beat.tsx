/** One beat of the ad: the wordmark, a headline, an optional sub-line and a
 *  visual, laid out for the composition's shape. Vertical (9:16): headline on
 *  top, visual below. Wide (16:9): headline left, visual right. The headline
 *  rises in over the first frames and the beat fades out at its end; nothing
 *  else moves unless the visual moves. */

import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const BEAT = 90; // frames per beat (3 s at 30 fps)
const OUT = 8; // frames of fade at the end of a beat

export function useWide(): boolean {
  const { width, height } = useVideoConfig();
  return width > height;
}

export function Paper({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--bg)',
        backgroundImage:
          'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function Wordmark({ size = 44 }: { size?: number }) {
  return <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', color: 'var(--ink)' }}>DryRun</div>;
}

export interface BeatProps {
  headline: ReactNode;
  sub?: ReactNode;
  visual?: ReactNode;
  /** Text-only beat: the headline is large and centred in the frame. */
  card?: boolean;
  /** Frames to hold before the headline appears. */
  delay?: number;
  /** Frame at which the headline (re)rises; set when one beat swaps headlines mid-way. */
  riseAt?: number;
  /** Fade out at the end of the beat (false for the final beat). */
  fadeOut?: boolean;
}

export function Beat({ headline, sub, visual, card = false, delay = 0, riseAt, fadeOut = true }: BeatProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wide = useWide();
  const at = riseAt ?? delay;
  const rise = spring({ frame: frame - at, fps, config: { damping: 200 } });
  const subIn = spring({ frame: frame - at - 8, fps, config: { damping: 200 } });
  const end = fadeOut ? interpolate(frame, [durationInFrames - OUT, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

  const headStyle = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.04,
    color: 'var(--ink)',
    margin: 0,
    textWrap: 'balance' as const,
    opacity: rise,
    transform: `translateY(${(1 - rise) * 28}px)`,
  };
  const subStyle = {
    fontFamily: 'var(--font-ui)',
    color: 'var(--ink-2)',
    margin: 0,
    lineHeight: 1.3,
    opacity: subIn,
    transform: `translateY(${(1 - subIn) * 16}px)`,
  };

  if (card) {
    return (
      <Paper>
        <AbsoluteFill style={{ opacity: end, padding: wide ? '0 220px' : '0 96px', justifyContent: 'center' }}>
          <h1 style={{ ...headStyle, fontSize: wide ? 120 : 112 }}>{headline}</h1>
          {sub && <p style={{ ...subStyle, fontSize: wide ? 44 : 44, marginTop: 36 }}>{sub}</p>}
        </AbsoluteFill>
        <Corner />
      </Paper>
    );
  }

  return (
    <Paper>
      <AbsoluteFill style={{ opacity: end }}>
        {wide ? (
          <div style={{ display: 'flex', height: '100%', padding: '150px 110px 110px', gap: 80, alignItems: 'center' }}>
            <div style={{ flex: '0 0 640px' }}>
              <h1 style={{ ...headStyle, fontSize: 84 }}>{headline}</h1>
              {sub && <div style={{ ...subStyle, fontSize: 36, marginTop: 32 }}>{sub}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>{visual}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '200px 72px 140px' }}>
            <h1 style={{ ...headStyle, fontSize: 84 }}>{headline}</h1>
            {sub && <div style={{ ...subStyle, fontSize: 40, marginTop: 30 }}>{sub}</div>}
            <div style={{ width: '100%', marginTop: 72 }}>{visual}</div>
          </div>
        )}
      </AbsoluteFill>
      <Corner />
    </Paper>
  );
}

/** The wordmark in the same corner on every beat: the brand is always present, never loud. */
function Corner() {
  const wide = useWide();
  return (
    <div style={{ position: 'absolute', top: wide ? 56 : 88, left: wide ? 110 : 72 }}>
      <Wordmark size={wide ? 40 : 46} />
    </div>
  );
}

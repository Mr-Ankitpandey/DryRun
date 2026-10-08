/** One beat of the ad. Every beat shares one transition and one grammar:
 *  - it wipes in from the right over the previous beat, led by a thin edge in
 *    the accent colour (the previous beat stays underneath; see Ad.tsx overlap);
 *  - the graph-paper grid drifts slowly, so still frames never feel frozen;
 *  - the headline is kinetic type; the visual eases up and drifts in scale.
 *  Tones: 'paper' (light), 'ink' (the app's dark theme), 'pen' (accent field). */

import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Kinetic } from './Kinetic';

export const WIPE = 14; // frames of the entering wipe

export type Tone = 'paper' | 'ink' | 'pen';

export function useWide(): boolean {
  const { width, height } = useVideoConfig();
  return width > height;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Text colour on a tone. On the pen field, text is the surface colour. */
export function inkOn(tone: Tone): string {
  return tone === 'pen' ? 'var(--surface)' : 'var(--ink)';
}
export function softOn(tone: Tone): string {
  return tone === 'pen' ? 'color-mix(in srgb, var(--surface) 82%, transparent)' : 'var(--ink-2)';
}

/** The page of a beat: tone, drifting grid, and the wipe-in with its edge. */
export function Page({ tone = 'paper', wipe = true, children }: { tone?: Tone; wipe?: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const p = wipe ? ease(interpolate(frame, [0, WIPE], [0, 1], clamp)) : 1;
  const line = tone === 'pen' ? 'color-mix(in srgb, var(--surface) 13%, transparent)' : 'var(--grid)';
  const bg = tone === 'pen' ? 'var(--pen)' : 'var(--bg)';
  const edge = tone === 'pen' ? 'var(--ink)' : 'var(--pen)';
  return (
    <AbsoluteFill className={tone === 'ink' ? 'dark' : undefined} style={{ clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` }}>
      <AbsoluteFill
        style={{
          backgroundColor: bg,
          backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: `${-frame * 0.45}px ${-frame * 0.3}px`,
        }}
      />
      {children}
      {wipe && p < 1 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(1 - p) * 100}%`, width: 12, background: edge }} />}
    </AbsoluteFill>
  );
}

export function Wordmark({ size = 44, color = 'var(--ink)' }: { size?: number; color?: string }) {
  return <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', color }}>DryRun</div>;
}

/** The wordmark in the same corner on every beat: present, never loud. */
export function Corner({ tone = 'paper' }: { tone?: Tone }) {
  const wide = useWide();
  return (
    <div style={{ position: 'absolute', top: wide ? 56 : 88, left: wide ? 110 : 72 }}>
      <Wordmark size={wide ? 40 : 46} color={inkOn(tone)} />
    </div>
  );
}

export const display: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  letterSpacing: '-0.025em',
  lineHeight: 1.02,
  margin: 0,
};

export interface BeatProps {
  tone?: Tone;
  /** Kinetic headline; "\n" breaks lines. */
  headline: string;
  /** Frame the headline starts (re-keys the words when it changes). */
  at?: number;
  sub?: ReactNode;
  /** Frame the sub-line appears. */
  subAt?: number;
  visual?: ReactNode;
  /** Frame the visual eases in. */
  visualAt?: number;
}

export function Beat({ tone = 'paper', headline, at = 6, sub, subAt, visual, visualAt = 4 }: BeatProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const wide = useWide();
  const subIn = spring({ frame: frame - (subAt ?? at + 14), fps, config: { damping: 200 } });
  const vIn = spring({ frame: frame - visualAt, fps, config: { damping: 22, stiffness: 120 } });
  const drift = 1 + 0.025 * (frame / durationInFrames);
  const head = { ...display, color: inkOn(tone), fontSize: wide ? 76 : 88 };
  const subStyle: CSSProperties = { fontFamily: 'var(--font-ui)', color: softOn(tone), lineHeight: 1.3, opacity: subIn, transform: `translateY(${(1 - subIn) * 18}px)` };
  const vis = visual && (
    <div style={{ opacity: Math.min(1, vIn * 1.4), transform: `translateY(${(1 - vIn) * 60}px) scale(${drift})`, transformOrigin: '50% 50%' }}>{visual}</div>
  );
  return (
    <Page tone={tone}>
      {wide ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', padding: '150px 110px 110px', gap: 80, alignItems: 'center' }}>
          <div style={{ flex: '0 0 660px' }}>
            <h1 style={head}>
              <Kinetic key={`${headline}-${at}`} text={headline} at={at} />
            </h1>
            {sub && <div style={{ ...subStyle, fontSize: 36, marginTop: 34 }}>{sub}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>{vis}</div>
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '210px 72px 140px' }}>
          <h1 style={head}>
            <Kinetic key={`${headline}-${at}`} text={headline} at={at} />
          </h1>
          {sub && <div style={{ ...subStyle, fontSize: 40, marginTop: 30 }}>{sub}</div>}
          {vis && <div style={{ width: '100%', marginTop: 72 }}>{vis}</div>}
        </div>
      )}
      <Corner tone={tone} />
    </Page>
  );
}

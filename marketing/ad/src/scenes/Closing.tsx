/** 38–45 s, ink. The closing line lands word by word; then the board clears
 *  into the end card: wordmark, tagline, the live link as a pen button with a
 *  blinking caret, and the maker's credit with the GitHub link. */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { AD_LINK, CREDIT, GITHUB_LINK } from '../config';
import { Page, Wordmark, display, useWide } from '../components/Beat';
import { Kinetic } from '../components/Kinetic';

const CARD = 74; // frame the end card takes over
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Closing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wide = useWide();
  const lineOut = interpolate(frame, [CARD - 10, CARD], [1, 0], clamp);
  const a = spring({ frame: frame - CARD, fps, config: { damping: 18, stiffness: 150 } });
  const c = spring({ frame: frame - CARD - 22, fps, config: { damping: 14, stiffness: 170 } });
  const credit = spring({ frame: frame - CARD - 40, fps, config: { damping: 200 } });
  const rule = interpolate(frame, [CARD + 36, CARD + 54], [0, 1], clamp);
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0;
  const pad = wide ? '0 160px' : '0 72px';
  return (
    <Page tone="ink">
      {frame < CARD && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: pad, opacity: lineOut }}>
          <h1 style={{ ...display, fontSize: wide ? 120 : 118, color: 'var(--ink)' }}>
            <Kinetic text={wide ? "In the interview,\nthere's no play button." : "In the\ninterview,\nthere's no\nplay button."} at={6} stagger={5} />
          </h1>
        </div>
      )}
      {frame >= CARD - 2 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: pad, gap: wide ? 30 : 40 }}>
          <div style={{ opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
            <Wordmark size={wide ? 132 : 150} color="var(--ink)" />
          </div>
          <h1 style={{ ...display, fontSize: wide ? 64 : 72, color: 'var(--ink)' }}>
            <Kinetic text={'Stop watching algorithms.\nStart tracing them.'} at={CARD + 8} stagger={3} />
          </h1>
          <div style={{ opacity: Math.min(1, c * 1.5), transform: `scale(${0.85 + 0.15 * c})`, transformOrigin: 'left center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: wide ? 42 : 44, fontWeight: 600, color: 'var(--surface)', background: 'var(--pen)', padding: '18px 30px', borderRadius: 10 }}>
              {AD_LINK}
              <span style={{ display: 'inline-block', width: 4, height: '1.1em', background: 'var(--surface)', opacity: blink }} />
            </span>
          </div>
          <div style={{ marginTop: wide ? 10 : 24 }}>
            <div style={{ height: 2, width: `${rule * 100}%`, maxWidth: wide ? 900 : '100%', background: 'var(--rule)' }} />
            <div style={{ marginTop: 22, opacity: credit, transform: `translateY(${(1 - credit) * 16}px)` }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: wide ? 32 : 36, fontWeight: 600, color: 'var(--ink)' }}>{CREDIT}</div>
              <div style={{ marginTop: 8, fontFamily: 'var(--font-ui)', fontSize: wide ? 28 : 31, color: 'var(--ink-2)' }}>Check out the project on GitHub</div>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: wide ? 30 : 31, color: 'var(--pen)' }}>{GITHUB_LINK}</div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

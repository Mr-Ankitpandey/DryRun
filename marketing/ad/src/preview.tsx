/** Browser preview of the ad: Remotion's Player plays the same composition live
 *  in the page, so nothing is encoded (no CPU-heavy render). Served by the app's
 *  Vite dev server at /marketing/ad/preview.html. Music plays when
 *  marketing/ad/public/music.mp3 exists. */

import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import './brand.css';
import { Player } from '@remotion/player';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AdProps } from './Ad';
import { Ad } from './Ad';
import { DURATION, FPS } from './config';

const MUSIC_URL = '/marketing/ad/public/music.mp3';

/** The Player passes loosely typed props; read them into the ad's own props. */
function AdFromProps(p: Record<string, unknown>) {
  return <Ad music={p.music === true} {...(typeof p.musicSrc === 'string' ? { musicSrc: p.musicSrc } : {})} />;
}

type Cut = 'vertical' | 'wide';
const SIZES: Record<Cut, { w: number; h: number; label: string }> = {
  vertical: { w: 1080, h: 1920, label: 'Vertical 9:16 (Reels, Shorts)' },
  wide: { w: 1920, h: 1080, label: 'Wide 16:9 (YouTube, LinkedIn)' },
};

function Preview() {
  const [cut, setCut] = useState<Cut>('vertical');
  const [music, setMusic] = useState(false);
  useEffect(() => {
    // Only a real audio file counts (the dev server answers unknown paths with HTML).
    void fetch(MUSIC_URL, { method: 'HEAD' })
      .then((r) => setMusic(r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')))
      .catch(() => setMusic(false));
  }, []);
  const size = SIZES[cut];
  const props: AdProps & Record<string, unknown> = { music, musicSrc: MUSIC_URL };
  const maxW = cut === 'vertical' ? 'min(420px, 92vw)' : 'min(1100px, 92vw)';
  return (
    <main style={{ minHeight: '100dvh', padding: 24, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: '0 0 4px', letterSpacing: '-0.02em' }}>DryRun ad preview</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--ink-2)' }}>
        30 seconds, plays live in this page. Music: {music ? 'on (music.mp3 found)' : 'none yet — save a track as marketing/ad/public/music.mp3 and reload'}.
      </p>
      <div role="radiogroup" aria-label="Format" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(Object.keys(SIZES) as Cut[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cut === c}
            onClick={() => setCut(c)}
            style={{
              font: 'inherit',
              padding: '10px 16px',
              borderRadius: 4,
              border: '1px solid var(--rule)',
              background: cut === c ? 'var(--ink)' : 'var(--surface)',
              color: cut === c ? 'var(--surface)' : 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            {SIZES[c].label}
          </button>
        ))}
      </div>
      <div style={{ width: maxW, border: '1px solid var(--rule)' }}>
        <Player
          key={`${cut}-${music}`}
          component={AdFromProps}
          inputProps={props}
          durationInFrames={DURATION}
          fps={FPS}
          compositionWidth={size.w}
          compositionHeight={size.h}
          style={{ width: '100%' }}
          controls
          loop
          clickToPlay
        />
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);

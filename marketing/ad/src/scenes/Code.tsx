/** 25–28.5 s, paper. The real binary-search listings: C++, Java, Python. The
 *  tab marker slides between languages and the highlight walks the real line
 *  map, line by line. */

import { interpolate, useCurrentFrame } from 'remotion';
import { binarySearch } from '@/algorithms/binary-search';
import type { CodeListing, RealLanguage } from '@/algorithms/types';
import { Beat, useWide } from '../components/Beat';

const LANGS: { id: RealLanguage; label: string }[] = [
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
  { id: 'python', label: 'Python' },
];
const TAB_W = 150;
const PER = 32; // frames per language
// Pseudocode lines walked: the loop, mid, the compare, the move.
const WALK = [2, 3, 4, 5, 2, 3, 4];

export function Code() {
  const frame = useCurrentFrame();
  const wide = useWide();
  const listings = binarySearch.code?.classic;
  const li = Math.min(LANGS.length - 1, Math.max(0, Math.floor((frame - 6) / PER)));
  const lang = LANGS[li];
  const listing: CodeListing | undefined = lang ? listings?.[lang.id] : undefined;
  if (!lang || !listing) throw new Error('ad: listing missing');
  const p = WALK[Math.min(WALK.length - 1, Math.floor(frame / 15))] ?? 2;
  const lit = new Set(listing.map[p - 1] ?? []);
  const slide = interpolate(frame - 6 - li * PER, [0, 8], [li === 0 ? 0 : (li - 1) * TAB_W, li * TAB_W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Beat
      headline={'Your language.\nLine by line.'}
      sub="Pseudocode, JavaScript, Python, C++ and Java."
      visual={
        <div style={{ background: 'var(--surface)', border: '2px solid var(--rule)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ position: 'relative', display: 'flex', borderBottom: '2px solid var(--rule)' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: slide, width: TAB_W, background: 'var(--ink)' }} />
            {LANGS.map((l) => (
              <div key={l.id} style={{ position: 'relative', width: TAB_W, textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-ui)', fontSize: 28, fontWeight: 600, color: l.id === lang.id ? 'var(--surface)' : 'var(--ink-2)' }}>
                {l.label}
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 0', fontFamily: 'var(--font-mono)', fontSize: wide ? 26 : 28, lineHeight: 1.6 }}>
            {listing.lines.slice(0, 14).map((text, i) => {
              const on = lit.has(i + 1);
              return (
                <div key={i} style={{ whiteSpace: 'pre', padding: '0 26px', background: on ? 'color-mix(in srgb, var(--pen) 16%, transparent)' : 'transparent', boxShadow: on ? 'inset 7px 0 0 var(--pen)' : 'none', color: 'var(--ink)', overflow: 'hidden' }}>
                  {text || ' '}
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}

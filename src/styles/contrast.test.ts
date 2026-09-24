/** WCAG 2.x contrast checks for the tokens in tokens.css, both themes.
 *  DESIGN §2: all text ≥ 4.5:1, semantic fills ≥ 3:1 against the surface. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

type Tokens = Record<string, string>;

/** Pulls `--name: #hex;` pairs out of the first block whose selector matches. */
function blockTokens(selector: string): Tokens {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out: Tokens = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const name = m[1];
    const hex = m[2];
    if (name && hex) out[name] = hex.toLowerCase();
  }
  return out;
}

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = chan((n >> 16) & 255);
  const g = chan((n >> 8) & 255);
  const b = chan(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: blockTokens("[data-theme='light']"),
  dark: blockTokens("[data-theme='dark']"),
} as const;

const NAMES = ['bg', 'grid', 'surface', 'ink', 'ink-2', 'rule', 'pen', 'amber', 'teal', 'red', 'green', 'hatch'];

/** [foreground, background, minimum ratio, why] */
const PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['ink', 'bg', 4.5, 'body text on the page'],
  ['ink-2', 'bg', 4.5, 'secondary text on the page'],
  ['ink', 'surface', 4.5, 'body text on panels'],
  ['ink-2', 'surface', 4.5, 'secondary text on panels'],
  ['ink', 'hatch', 4.5, 'invariant sentence on the hatch base'],
  ['bg', 'pen', 4.5, 'primary button label'],
  ['bg', 'ink', 4.5, 'toast text and selected segment'],
  ['pen', 'surface', 3, 'write/move fill'],
  ['amber', 'surface', 3, 'compare'],
  ['teal', 'surface', 3, 'frontier ring'],
  ['red', 'surface', 3, 'ghost / error outline'],
  ['green', 'surface', 3, 'correct ring'],
  ['pen', 'bg', 3, 'focus ring on the page'],
  ['red', 'bg', 3, 'error text on the page (≥ 4.5 checked below where used as text)'],
  ['red', 'surface', 4.5, 'field error message text on a panel'],
];

describe('tokens.css parses', () => {
  it('has every token in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const n of NAMES) expect(themes[theme][n], `${theme} --${n}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('computes the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

for (const theme of ['light', 'dark'] as const) {
  describe(`contrast (${theme})`, () => {
    for (const [fg, bg, min, why] of PAIRS) {
      it(`--${fg} on --${bg} ≥ ${min} (${why})`, () => {
        const a = themes[theme][fg];
        const b = themes[theme][bg];
        if (!a || !b) throw new Error(`missing token ${fg}/${bg}`);
        const ratio = contrast(a, b);
        expect(ratio, `${a} on ${b} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
      });
    }
  });
}

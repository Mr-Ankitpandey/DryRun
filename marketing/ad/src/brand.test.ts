import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Every colour token the ad declares must equal the app's light theme. */
function vars(css: string, block: RegExp): Record<string, string> {
  const m = css.match(block);
  if (!m?.[1]) throw new Error('token block not found');
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1].matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) if (k && v) out[k] = v.trim().toLowerCase();
  return out;
}

describe('ad brand tokens', () => {
  it('match the app light theme exactly', () => {
    const app = vars(readFileSync('src/styles/tokens.css', 'utf8'), /:root,\s*\[data-theme='light'\]\s*\{([^}]*)\}/);
    const ad = vars(readFileSync('marketing/ad/src/brand.css', 'utf8'), /:root\s*\{([^}]*)\}/);
    for (const [k, v] of Object.entries(app)) expect(ad[k], k).toBe(v);
  });
});

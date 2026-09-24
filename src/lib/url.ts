/** URL state helpers. The URL is the only place a trace's identity lives:
 *  algorithm id + encoded input + seed + mode/level. Opening a URL never auto-runs. */

export type Query = Record<string, string>;

export function parseQuery(search: string): Query {
  const out: Query = {};
  const s = search.startsWith('?') ? search.slice(1) : search;
  if (!s) return out;
  for (const part of s.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = decodeURIComponent(eq === -1 ? part : part.slice(0, eq));
    const v = eq === -1 ? '' : decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    if (k) out[k] = v;
  }
  return out;
}

/** Encodes values with a light touch so `i=3,7,9` stays readable. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%2C/g, ',').replace(/%3A/g, ':')}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function traceUrl(algorithmId: string, params: Record<string, string | number | undefined | null> = {}): string {
  return `/t/${algorithmId}${buildQuery(params)}`;
}

/** Comma-separated integer list codec used by array-based modules. */
export function encodeIntList(values: readonly number[]): string {
  return values.join(',');
}

export function decodeIntList(raw: string | undefined, opts: { min: number; max: number; maxLen: number }): number[] | null {
  if (raw === undefined) return null;
  if (raw.trim() === '') return [];
  const parts = raw.split(',').map((p) => p.trim());
  const out: number[] = [];
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < opts.min || n > opts.max) return null;
    out.push(n);
  }
  if (out.length > opts.maxLen) return null;
  return out;
}

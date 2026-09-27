/** Builds a CodeListing from rows written next to their pseudocode anchors, so a
 *  listing and its line map cannot drift apart. A row is `[text]` (no anchor:
 *  signature, brace, blank or helper-type line) or `[text, p]` / `[text, [p, q]]`
 *  where p, q are the 1-based pseudocode lines the listing line carries out. */

import type { CodeListing } from '@/algorithms/types';

export type Row = readonly [text: string, anchor?: number | readonly number[]];

export function listing(pseudoLines: number, rows: readonly Row[]): CodeListing {
  const map: number[][] = Array.from({ length: pseudoLines }, () => []);
  const lines: string[] = [];
  rows.forEach(([text, anchor], k) => {
    lines.push(text);
    if (anchor === undefined) return;
    for (const p of typeof anchor === 'number' ? [anchor] : anchor) {
      const entry = map[p - 1];
      if (!entry) throw new Error(`listing: line ${k + 1} anchors to pseudocode line ${p}, which does not exist`);
      entry.push(k + 1);
    }
  });
  return { lines, map };
}

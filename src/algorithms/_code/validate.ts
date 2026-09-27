/** Structural checks for a CodeListing against its pseudocode (tests only). */

import type { CodeListing } from '@/algorithms/types';

/** A listing line that needs no pseudocode anchor: blank, braces only, a
 *  function signature (unless the pseudocode names the function), or a comment. */
export function isStructural(text: string): boolean {
  const t = text.trim();
  if (t === '' || /^[{}()[\];,]+$/.test(t)) return true;
  if (t.startsWith('//') || t.startsWith('#')) return true;
  // function / method signatures in the four languages
  if (/^(export\s+)?(async\s+)?function\s+\w+\s*\(.*\)\s*\{$/.test(t)) return true;
  if (/^def\s+\w+\(.*\):$/.test(t)) return true;
  if (/^(static\s+)?[\w<>[\], ]+[\s*&]+\w+\(.*\)\s*\{$/.test(t) && !/[=;]/.test(t)) return true;
  return false;
}

/** Lines of a leading helper type (class / struct / record) up to the first
 *  blank line: a node type or result type is not an algorithm step. */
export function helperTypeLines(lines: readonly string[]): Set<number> {
  const out = new Set<number>();
  const first = (lines[0] ?? '').trim();
  if (!/^(static\s+)?(class|struct|record)\b/.test(first)) return out;
  for (let k = 0; k < lines.length && (lines[k] ?? '').trim() !== ''; k++) out.add(k + 1);
  return out;
}

/** The final `return <result>` of a listing whose pseudocode ends without a
 *  return (the result is the table / dist array the pseudocode fills). */
export function trailingReturn(lines: readonly string[]): number | null {
  for (let k = lines.length - 1; k >= 0; k--) {
    const t = (lines[k] ?? '').trim();
    if (t === '' || /^[{}();]+$/.test(t)) continue;
    return /^return\b/.test(t) ? k + 1 : null;
  }
  return null;
}

export interface ListingProblems {
  problems: string[];
  /** Pseudocode lines (1-based) whose map entry is empty. */
  empty: number[];
}

export function checkListing(pseudo: readonly string[], l: CodeListing): ListingProblems {
  const problems: string[] = [];
  const empty: number[] = [];
  if (l.map.length !== pseudo.length) problems.push(`map has ${l.map.length} entries for ${pseudo.length} pseudocode lines`);
  const used = new Set<number>();
  l.map.forEach((entry, p) => {
    if (entry.length === 0) empty.push(p + 1);
    for (const n of entry) {
      if (!Number.isInteger(n) || n < 1 || n > l.lines.length) problems.push(`pseudocode line ${p + 1} maps to missing listing line ${n}`);
      used.add(n);
    }
    if (new Set(entry).size !== entry.length) problems.push(`pseudocode line ${p + 1} lists a listing line twice`);
  });
  const helper = helperTypeLines(l.lines);
  const ret = trailingReturn(l.lines);
  l.lines.forEach((text, k) => {
    const n = k + 1;
    if (used.has(n) || helper.has(n) || n === ret || isStructural(text)) return;
    problems.push(`listing line ${n} is not mapped: ${text.trim()}`);
  });
  l.lines.forEach((text, k) => {
    if (/\t/.test(text)) problems.push(`listing line ${k + 1} has a tab`);
    if (text !== text.trimEnd()) problems.push(`listing line ${k + 1} has trailing spaces`);
  });
  return { problems, empty };
}

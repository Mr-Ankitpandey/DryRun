/** Text fitting for labels drawn inside the scene (pure). */

/** Mono advance width as a fraction of the font size (JetBrains Mono ≈ 0.6). */
export const MONO_ADVANCE = 0.6;

export function monoWidth(text: string, fontSize: number): number {
  return text.length * fontSize * MONO_ADVANCE;
}

/** The label of a recursion frame, as short as its pill needs.
 *  The scene label is `<call label>(<arg values>)`; when the call label
 *  already carries its arguments ("quicksort(0, 6)") the appended list is a
 *  duplicate and is dropped. Narrow pills fall back to "(0, 6)", then "0,6". */
export function frameLabel(sceneLabel: string, width: number, fontSize: number, suffix = ''): string {
  const doubled = /^(.*\))\(([^()]*)\)$/.exec(sceneLabel);
  const full = doubled ? (doubled[1] as string) : sceneLabel;
  const room = width - 8;
  const candidates = [full];
  const args = /\(([^()]*)\)$/.exec(full);
  if (args) {
    candidates.push(`(${args[1]})`, (args[1] as string).replace(/\s+/g, ''));
  }
  for (const c of candidates) if (monoWidth(c + suffix, fontSize) <= room) return c + suffix;
  for (const c of candidates) if (monoWidth(c, fontSize) <= room) return c;
  return candidates[candidates.length - 1] as string;
}

/** Font size of DP grid row and column labels (scene units): 13, so they stay
 *  ≥ 11 CSS px on a 360 px phone (the phone layout draws at ~0.88×). */
export const GRID_LABEL_FONT = 13;

/** A grid row label as one or two lines: a trailing parenthetical ("item 2
 *  (3, 4)": weight and value) goes on its own line, so the label column stays
 *  narrow and the text can stay large enough to read on a phone. */
export function gridLabelLines(label: string): string[] {
  const m = /^(.*\S)\s+(\([^()]*\))$/.exec(label);
  return m ? [m[1] as string, m[2] as string] : [label];
}

/** Widest line of a grid row label, in scene units. */
export function gridLabelWidth(label: string, fontSize: number): number {
  return Math.max(0, ...gridLabelLines(label).map((l) => monoWidth(l, fontSize)));
}

/** A tree node's text (a forest root's rank) sits above it: edges to its
 *  children fan out below, so the label never collides with them. */
export const TNODE_TEXT_GAP = 9;
/** Height the label adds above the circle (compare brackets start above it). */
export const TNODE_TEXT_H = 20;

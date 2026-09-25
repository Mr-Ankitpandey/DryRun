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

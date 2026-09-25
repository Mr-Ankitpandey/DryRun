/** Shallow equality for primitives, so a view re-renders only the elements
 *  whose own data changed in this step (the scene builder returns fresh
 *  objects every step). Arrays inside a prim (cell deps) compare elementwise. */

export function samePrim(a: object, b: object): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const k of ka) {
    const va = ra[k];
    const vb = rb[k];
    if (va === vb) continue;
    if (Array.isArray(va) && Array.isArray(vb) && va.length === vb.length && va.every((v, i) => v === vb[i])) continue;
    return false;
  }
  return true;
}

/** Props comparator for memo(): every prop is compared with samePrim when it is
 *  a plain object, by identity otherwise. */
export function sameProps<P extends object>(a: P, b: P): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  for (const k of keys) {
    const va = ra[k];
    const vb = rb[k];
    if (va === vb) continue;
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va) && samePrim(va, vb)) continue;
    return false;
  }
  return true;
}

/** Geometry of a directed arc between two node circles (pure): the stroke runs
 *  from rim to rim, straight or as a quadratic curve whose control point is the
 *  midpoint pushed `bend` along the left normal of a → b (the same curve the
 *  graph layout checked for clearance), and ends at the base of a filled
 *  arrowhead whose tip touches the target's rim. */

export const HEAD_LEN = 9;
export const HEAD_HALF = 4.5;
/** Gap between a node's rim and the arc. */
export const RIM_GAP = 2;

export interface ArcGeometry {
  /** SVG path of the stroke (rim to the arrowhead's base). */
  d: string;
  /** SVG path of the arrowhead triangle. */
  head: string;
  /** A point on the arc halfway along (badges, labels). */
  mid: { x: number; y: number };
}

const f = (n: number) => Math.round(n * 100) / 100;

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function arcGeometry(p: { x1: number; y1: number; x2: number; y2: number; bend?: number }, r: number): ArcGeometry {
  const h = p.bend ?? 0;
  const chord = unit(p.x2 - p.x1, p.y2 - p.y1);
  const cx = (p.x1 + p.x2) / 2 - chord.y * h;
  const cy = (p.y1 + p.y2) / 2 + chord.x * h;
  const out = h === 0 ? chord : unit(cx - p.x1, cy - p.y1);
  const into = h === 0 ? chord : unit(p.x2 - cx, p.y2 - cy);
  const start = { x: p.x1 + out.x * (r + RIM_GAP), y: p.y1 + out.y * (r + RIM_GAP) };
  const tip = { x: p.x2 - into.x * (r + RIM_GAP), y: p.y2 - into.y * (r + RIM_GAP) };
  const base = { x: tip.x - into.x * HEAD_LEN, y: tip.y - into.y * HEAD_LEN };
  // The stroke runs 1 unit under the head so no gap shows at the joint.
  const end = { x: base.x + into.x, y: base.y + into.y };
  const d = h === 0 ? `M${f(start.x)} ${f(start.y)} L${f(end.x)} ${f(end.y)}` : `M${f(start.x)} ${f(start.y)} Q${f(cx)} ${f(cy)} ${f(end.x)} ${f(end.y)}`;
  const nx = -into.y;
  const ny = into.x;
  const head = `M${f(tip.x)} ${f(tip.y)} L${f(base.x + nx * HEAD_HALF)} ${f(base.y + ny * HEAD_HALF)} L${f(base.x - nx * HEAD_HALF)} ${f(base.y - ny * HEAD_HALF)} Z`;
  const mid = h === 0 ? { x: (p.x1 + p.x2) / 2, y: (p.y1 + p.y2) / 2 } : { x: 0.25 * p.x1 + 0.5 * cx + 0.25 * p.x2, y: 0.25 * p.y1 + 0.5 * cy + 0.25 * p.y2 };
  return { d, head, mid };
}

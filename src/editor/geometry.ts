/** Hit testing and snapping on stage-space boxes. */
import type { Box, Boxes } from '../engine/layout';
import type { Layer } from '../engine/model';

const inside = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** Every layer under the point, outermost first (one path: the topmost branch). */
export function hitPath(layers: Layer[], world: Boxes, x: number, y: number): Layer[] {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (!l.visible || l.locked) continue;
    const b = world.get(l.id);
    const kids = l.children ? hitPath(l.children, world, x, y) : [];
    // Children may hang outside an unclipped frame and still be hit.
    const childOk = kids.length && (!l.clip || (b && inside(b, x, y)));
    if (childOk) return [l, ...kids];
    if (b && inside(b, x, y)) return [l];
  }
  return [];
}

export const union = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

/**
 * Snaps a moving box's edges and centre to candidate lines. Returns the
 * correction to add to the move and the guides that fired.
 */
export function snap(box: Box, xs: number[], ys: number[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const pick = (edges: number[], lines: number[]) => {
    let best: { d: number; at: number } | null = null;
    for (const e of edges)
      for (const l of lines) {
        const d = l - e;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: l };
      }
    return best;
  };
  const bx = pick([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const by = pick([box.y, box.y + box.h / 2, box.y + box.h], ys);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { dx: bx?.d ?? 0, dy: by?.d ?? 0, guides };
}

export function snapLines(boxes: Box[], stageW: number, stageH: number): { xs: number[]; ys: number[] } {
  const xs = [0, stageW / 2, stageW];
  const ys = [0, stageH / 2, stageH];
  for (const b of boxes) {
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys };
}

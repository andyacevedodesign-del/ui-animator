/**
 * Auto layout, Figma style: frames in row/column mode place their children
 * along an axis with gap and padding, and can hug their contents. Produces a
 * parent-local box for every layer; positions of children inside an
 * auto-layout frame come from the layout, not from their own x/y.
 */
import type { Layer } from './model';
import { textSize } from './text';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Boxes = Map<string, Box>;

function size(l: Layer, boxes: Boxes): { w: number; h: number } {
  if (l.type === 'text') {
    const t = textSize(l);
    return { w: t.w, h: t.h };
  }
  if (l.type !== 'frame' || !l.children) return { w: l.w, h: l.h };

  const kids = l.children;
  const sizes = kids.map((k) => {
    const s = size(k, boxes);
    boxes.set(k.id, { x: k.x, y: k.y, ...s });
    return s;
  });

  const lay = l.layout;
  if (!lay || lay.mode === 'none') return { w: l.w, h: l.h };

  const row = lay.mode === 'row';
  const flow = kids.map((k, i) => ({ k, s: sizes[i] })).filter(({ k }) => k.visible);
  const main = flow.reduce((sum, { s }) => sum + (row ? s.w : s.h), 0) + Math.max(0, flow.length - 1) * lay.gap;
  const cross = flow.reduce((m, { s }) => Math.max(m, row ? s.h : s.w), 0);
  const w = lay.hug ? (row ? main : cross) + lay.padding * 2 : l.w;
  const h = lay.hug ? (row ? cross : main) + lay.padding * 2 : l.h;

  const innerMain = (row ? w : h) - lay.padding * 2;
  const innerCross = (row ? h : w) - lay.padding * 2;
  let gap = lay.gap;
  let cursor = lay.padding;
  if (!lay.hug) {
    const free = innerMain - main;
    if (lay.justify === 'center') cursor += free / 2;
    else if (lay.justify === 'end') cursor += free;
    else if (lay.justify === 'between' && flow.length > 1) gap += free / (flow.length - 1);
  }
  for (const { k, s } of flow) {
    const along = row ? s.w : s.h;
    const across = row ? s.h : s.w;
    let off = lay.padding;
    if (lay.align === 'center') off += (innerCross - across) / 2;
    else if (lay.align === 'end') off += innerCross - across;
    boxes.set(k.id, row ? { x: cursor, y: off, w: s.w, h: s.h } : { x: off, y: cursor, w: s.w, h: s.h });
    cursor += along + gap;
  }
  return { w, h };
}

/** Parent-local boxes for the whole tree. */
export function layoutTree(layers: Layer[]): Boxes {
  const boxes: Boxes = new Map();
  for (const l of layers) boxes.set(l.id, { x: l.x, y: l.y, ...size(l, boxes) });
  return boxes;
}

/** Stage-space boxes (rotation ignored), for hit testing, the cursor and the camera. */
export function worldBoxes(layers: Layer[], local: Boxes): Boxes {
  const out: Boxes = new Map();
  const visit = (list: Layer[], ox: number, oy: number) => {
    for (const l of list) {
      const b = local.get(l.id);
      if (!b) continue;
      const wb = { x: ox + b.x, y: oy + b.y, w: b.w, h: b.h };
      out.set(l.id, wb);
      if (l.children) visit(l.children, wb.x, wb.y);
    }
  };
  visit(layers, 0, 0);
  return out;
}

export function insideAutoLayout(parent: Layer | null): boolean {
  return !!parent?.layout && parent.layout.mode !== 'none';
}

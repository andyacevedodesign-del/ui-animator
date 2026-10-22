import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Box } from '../engine/layout';
import { insideAutoLayout } from '../engine/layout';
import { findLayer, findSiblings, makeLayer, pathTo, uid, type Layer, type LayerType } from '../engine/model';
import { Renderer } from '../engine/renderer';
import type { Frame } from '../engine/resolve';
import { hitPath, snap, snapLines, union, type Guide } from './geometry';
import { useStore } from './store';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MAX_CANVAS = 4096;

type Drag =
  | { kind: 'move'; sx: number; sy: number; origin: Map<string, { x: number; y: number }>; box: Box; lines: { xs: number[]; ys: number[] }; key: string; reorder: string | null }
  | { kind: 'resize'; handle: Handle; id: string; world: Box; offset: { x: number; y: number }; key: string }
  | { kind: 'draw'; id: string; sx: number; sy: number; offset: { x: number; y: number }; type: LayerType; key: string }
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | { kind: 'marquee'; sx: number; sy: number; x: number; y: number };

export function Viewport() {
  const project = useStore((s) => s.project);
  const time = useStore((s) => s.time);
  const mode = useStore((s) => s.mode);
  const playing = useStore((s) => s.playing);
  const selection = useStore((s) => s.selection);
  const hover = useStore((s) => s.hover);
  const tool = useStore((s) => s.tool);
  const editingText = useStore((s) => s.editingText);
  const picking = useStore((s) => s.picking);
  const fitToken = useStore((s) => s.fitToken);

  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const drag = useRef<Drag | null>(null);
  const [view, setView] = useState({ zoom: 0.5, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [, force] = useState(0);
  const [dropHint, setDropHint] = useState(false);

  const W = project.stage.width;
  const H = project.stage.height;
  const rest = mode === 'design' && !playing;

  // ------------------------------------------------------------------ drawing
  const draw = useCallback(() => {
    const r = renderer.current;
    if (!r) return;
    const s = useStore.getState();
    r.setProject(s.project);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const v = viewRef.current;
    const scale = Math.min(v.zoom * dpr, MAX_CANVAS / s.project.stage.width);
    r.setScale(scale);
    frameRef.current = r.draw(s.time, { rest: s.mode === 'design' && !s.playing });
  }, []);

  useEffect(() => {
    const r = new Renderer(useStore.getState().project, canvasRef.current!);
    renderer.current = r;
    r.onAsync = () => {
      draw();
      force((n) => n + 1);
    };
    void r.ready().then(() => {
      draw();
      force((n) => n + 1);
    });
    return () => r.dispose();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [project, time, mode, playing, view, draw]);

  // --------------------------------------------------------------------- fit
  const fit = useCallback(() => {
    const el = container.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { stage } = useStore.getState().project;
    const zoom = Math.min((width - 80) / stage.width, (height - 80) / stage.height);
    setView({ zoom, x: (width - stage.width * zoom) / 2, y: (height - stage.height * zoom) / 2 });
  }, []);

  useLayoutEffect(() => {
    fit();
    const el = container.current!;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, W, H, fitToken]);

  // ------------------------------------------------------------------ helpers
  const toStage = (e: { clientX: number; clientY: number }) => {
    const rect = container.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - rect.left - v.x) / v.zoom, y: (e.clientY - rect.top - v.y) / v.zoom };
  };
  const world = () => frameRef.current?.world ?? new Map<string, Box>();

  /** Parent offset (stage position of a layer's coordinate origin). */
  const parentOffset = (id: string) => {
    const p = useStore.getState().project;
    const path = pathTo(p.layers, id);
    const parent = path[path.length - 2];
    const b = parent ? world().get(parent.id) : undefined;
    return b ? { x: b.x, y: b.y } : { x: 0, y: 0 };
  };

  /** Figma-style selection: clicks pick at the depth of the current selection. */
  const choose = (path: Layer[], deep: boolean): Layer | null => {
    if (!path.length) return null;
    if (deep) return path[path.length - 1];
    const s = useStore.getState();
    const current = s.selection[0];
    if (current) {
      const ctx = pathTo(s.project.layers, current);
      // Deepest shared ancestor of the current selection and the hit.
      let depth = 0;
      while (depth < ctx.length - 1 && depth < path.length && path[depth].id === ctx[depth].id) depth++;
      return path[Math.min(depth, path.length - 1)];
    }
    return path[0];
  };

  // ---------------------------------------------------------------- pointer
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const s = useStore.getState();
    const p = toStage(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (s.editingText) s.setEditingText(null);

    if (e.button === 1 || tool === 'hand' || e.altKey && e.shiftKey) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: view.x, py: view.y };
      return;
    }

    const path = hitPath(s.project.layers, world(), p.x, p.y);

    if (s.picking) {
      const hit = choose(path, e.metaKey || e.ctrlKey);
      if (hit) s.picking(hit.id);
      s.setPicking(null);
      return;
    }

    if (tool !== 'move') {
      const type: LayerType = tool === 'frame' ? 'frame' : tool === 'ellipse' ? 'ellipse' : tool === 'text' ? 'text' : 'rect';
      const parent = [...path].reverse().find((l) => l.type === 'frame' && !l.locked) ?? null;
      const offset = parent ? world().get(parent.id) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
      const layer = makeLayer(type, { x: Math.round(p.x - offset.x), y: Math.round(p.y - offset.y), w: 1, h: 1 });
      if (type === 'text') Object.assign(layer, { text: 'Type something', w: 200, h: 32 });
      const key = `draw-${layer.id}`;
      s.edit((pr) => {
        const target = parent ? findLayer(pr.layers, parent.id) : null;
        (target?.children ?? pr.layers).push(layer);
      }, key);
      s.select([layer.id]);
      drag.current = { kind: 'draw', id: layer.id, sx: p.x, sy: p.y, offset, type, key };
      return;
    }

    const hit = choose(path, e.metaKey || e.ctrlKey);
    if (!hit) {
      if (!e.shiftKey) s.select([]);
      drag.current = { kind: 'marquee', sx: p.x, sy: p.y, x: p.x, y: p.y };
      return;
    }
    let ids = s.selection;
    if (e.shiftKey) ids = ids.includes(hit.id) ? ids.filter((i) => i !== hit.id) : [...ids, hit.id];
    else if (!ids.includes(hit.id)) ids = [hit.id];
    s.select(ids);
    if (!ids.length) return;

    const origin = new Map<string, { x: number; y: number }>();
    const boxes: Box[] = [];
    let reorder: string | null = null;
    for (const id of ids) {
      const l = findLayer(s.project.layers, id);
      const b = world().get(id);
      if (!l || !b) continue;
      const sib = findSiblings(s.project.layers, id);
      if (insideAutoLayout(sib?.parent ?? null)) {
        if (ids.length === 1) reorder = id;
        continue;
      }
      origin.set(id, { x: l.x, y: l.y });
      boxes.push(b);
    }
    // Snap against everything that isn't moving.
    const others: Box[] = [];
    for (const [id, b] of world()) {
      if (ids.includes(id) || ids.some((sid) => pathTo(s.project.layers, id).some((a) => a.id === sid))) continue;
      others.push(b);
    }
    drag.current = {
      kind: 'move',
      sx: p.x,
      sy: p.y,
      origin,
      box: union(boxes) ?? { x: p.x, y: p.y, w: 0, h: 0 },
      lines: snapLines(others, W, H),
      key: `move-${uid()}`,
      reorder,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const s = useStore.getState();
    const p = toStage(e);
    if (!d) {
      if (tool === 'move' && !e.buttons) {
        const hit = choose(hitPath(s.project.layers, world(), p.x, p.y), e.metaKey || e.ctrlKey);
        if ((hit?.id ?? null) !== s.hover) s.setHover(hit?.id ?? null);
      }
      return;
    }
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy }));
      return;
    }
    if (d.kind === 'marquee') {
      d.x = p.x;
      d.y = p.y;
      const box = { x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(p.x - d.sx), h: Math.abs(p.y - d.sy) };
      setMarquee(box);
      const hits = s.project.layers
        .filter((l) => l.visible && !l.locked)
        .filter((l) => {
          const b = world().get(l.id);
          return b && b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
        })
        .map((l) => l.id);
      s.select(hits);
      return;
    }
    if (d.kind === 'move') {
      let dx = p.x - d.sx;
      let dy = p.y - d.sy;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (d.reorder) {
        reorderInLayout(d.reorder, p);
        return;
      }
      if (!d.origin.size) return;
      const moved = { ...d.box, x: d.box.x + dx, y: d.box.y + dy };
      const sn = e.metaKey || e.ctrlKey ? { dx: 0, dy: 0, guides: [] } : snap(moved, d.lines.xs, d.lines.ys, 6 / viewRef.current.zoom);
      dx = Math.round(dx + sn.dx);
      dy = Math.round(dy + sn.dy);
      setGuides(sn.guides);
      s.edit((pr) => {
        for (const [id, o] of d.origin) {
          const l = findLayer(pr.layers, id);
          if (l) {
            l.x = o.x + dx;
            l.y = o.y + dy;
          }
        }
      }, d.key);
      return;
    }
    if (d.kind === 'resize') {
      let { x, y, w, h } = d.world;
      const hd = d.handle;
      if (hd.includes('w')) {
        const right = x + w;
        x = Math.min(p.x, right - 1);
        w = right - x;
      }
      if (hd.includes('e')) w = Math.max(1, p.x - x);
      if (hd.includes('n')) {
        const bottom = y + h;
        y = Math.min(p.y, bottom - 1);
        h = bottom - y;
      }
      if (hd.includes('s')) h = Math.max(1, p.y - y);
      if (e.shiftKey && hd.length === 2) {
        const k = Math.max(w / d.world.w, h / d.world.h);
        const nw = d.world.w * k;
        const nh = d.world.h * k;
        if (hd.includes('w')) x = d.world.x + d.world.w - nw;
        if (hd.includes('n')) y = d.world.y + d.world.h - nh;
        w = nw;
        h = nh;
      }
      const horizontalOnly = hd === 'e' || hd === 'w';
      s.updateLayer(
        d.id,
        (l) => {
          l.x = Math.round(x - d.offset.x);
          l.y = Math.round(y - d.offset.y);
          l.w = Math.max(1, Math.round(w));
          l.h = Math.max(1, Math.round(h));
          if (l.type === 'text') l.sizing = horizontalOnly ? 'auto-height' : 'fixed';
          if (l.layout?.hug) l.layout.hug = false;
        },
        d.key,
      );
      return;
    }
    if (d.kind === 'draw') {
      let w = Math.abs(p.x - d.sx);
      let h = Math.abs(p.y - d.sy);
      if (e.shiftKey) w = h = Math.max(w, h);
      const x = p.x < d.sx ? d.sx - w : d.sx;
      const y = p.y < d.sy ? d.sy - h : d.sy;
      if (d.type === 'text') return;
      s.updateLayer(d.id, { x: Math.round(x - d.offset.x), y: Math.round(y - d.offset.y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }, d.key);
    }
  };

  const reorderInLayout = (id: string, p: { x: number; y: number }) => {
    const s = useStore.getState();
    const sib = findSiblings(s.project.layers, id);
    if (!sib?.parent?.layout) return;
    const rowAxis = sib.parent.layout.mode === 'row';
    const others = sib.list.filter((l) => l.id !== id);
    let index = others.length;
    for (let i = 0; i < others.length; i++) {
      const b = world().get(others[i].id);
      if (!b) continue;
      const centre = rowAxis ? b.x + b.w / 2 : b.y + b.h / 2;
      if ((rowAxis ? p.x : p.y) < centre) {
        index = i;
        break;
      }
    }
    if (index === sib.index) return;
    s.edit((pr) => {
      const hit = findSiblings(pr.layers, id);
      if (!hit) return;
      const [l] = hit.list.splice(hit.index, 1);
      hit.list.splice(index, 0, l);
    }, `reorder-${id}`);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides([]);
    setMarquee(null);
    if (!d) return;
    const s = useStore.getState();
    if (d.kind === 'draw') {
      const l = findLayer(s.project.layers, d.id);
      if (l && d.type !== 'text' && l.w < 4 && l.h < 4) {
        const size = d.type === 'frame' ? { w: 320, h: 200 } : { w: 120, h: 120 };
        s.updateLayer(d.id, { w: size.w, h: size.h, x: l.x - size.w / 2, y: l.y - size.h / 2 }, d.key);
      }
      if (d.type === 'text') s.setEditingText(d.id);
      s.setTool('move');
    }
  };

  const startResize = (e: React.PointerEvent, handle: Handle, id: string) => {
    e.stopPropagation();
    container.current!.setPointerCapture(e.pointerId);
    const b = world().get(id);
    if (!b) return;
    drag.current = { kind: 'resize', handle, id, world: { ...b }, offset: parentOffset(id), key: `resize-${uid()}` };
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const s = useStore.getState();
    const p = toStage(e);
    const path = hitPath(s.project.layers, world(), p.x, p.y);
    const current = s.selection[0];
    const at = path.findIndex((l) => l.id === current);
    const target = at >= 0 && at < path.length - 1 ? path[at + 1] : path[at] ?? path[0];
    if (!target) return;
    if (target.type === 'text' && target.id === current) {
      s.setEditingText(target.id);
      s.setMode('design');
    } else s.select([target.id]);
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = container.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const zoom = Math.min(8, Math.max(0.05, v.zoom * Math.exp(-e.deltaY * 0.01)));
        return { zoom, x: mx - ((mx - v.x) / v.zoom) * zoom, y: my - ((my - v.y) / v.zoom) * zoom };
      });
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };

  // Block the browser's page zoom so ctrl+wheel zooms the canvas.
  useEffect(() => {
    const el = container.current!;
    const stop = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  // ------------------------------------------------------------- image drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHint(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const p = toStage(e);
    void addImageFile(file, p.x, p.y);
  };

  // ---------------------------------------------------------------- overlay
  const v = view;
  const toScreen = (b: Box) => ({ left: v.x + b.x * v.zoom, top: v.y + b.y * v.zoom, width: b.w * v.zoom, height: b.h * v.zoom });
  const wb = world();
  const selBoxes = selection.map((id) => wb.get(id)).filter((b): b is Box => !!b);
  const selUnion = union(selBoxes);
  const single = selection.length === 1 ? findLayer(project.layers, selection[0]) : null;
  const hoverBox = hover && !selection.includes(hover) ? wb.get(hover) : undefined;
  const showChrome = !playing && !picking;
  const editing = editingText ? findLayer(project.layers, editingText) : null;
  const editBox = editing ? wb.get(editing.id) : undefined;
  const cursorClass = picking ? 'picking' : tool === 'hand' ? 'hand' : tool !== 'move' ? 'crosshair' : '';

  return (
    <div
      ref={container}
      className={`viewport ${cursorClass} ${dropHint ? 'drop' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => !drag.current && useStore.getState().setHover(null)}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onDragOver={(e) => {
        e.preventDefault();
        setDropHint(true);
      }}
      onDragLeave={() => setDropHint(false)}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} className="stage-canvas" style={{ left: v.x, top: v.y, width: W * v.zoom, height: H * v.zoom }} />
      <div className="stage-label" style={{ left: v.x, top: v.y - 22 }}>
        {project.name} · {W}×{H}
        {!rest && <span className="live-pill">{playing ? 'Playing' : 'Animate'}</span>}
      </div>

      {showChrome && hoverBox && <div className="hover-box" style={toScreen(hoverBox)} />}
      {showChrome &&
        selBoxes.length > 1 &&
        selBoxes.map((b, i) => <div key={i} className="sel-box thin" style={toScreen(b)} />)}
      {showChrome && selUnion && !editing && (
        <div className="sel-box" style={toScreen(selUnion)}>
          {single &&
            !single.locked &&
            HANDLES.map((h) => <div key={h} className={`handle ${h}`} onPointerDown={(e) => startResize(e, h, single.id)} />)}
          <div className="dims">
            {Math.round(selUnion.w)} × {Math.round(selUnion.h)}
          </div>
        </div>
      )}
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <div key={i} className="guide v" style={{ left: v.x + g.at * v.zoom }} />
        ) : (
          <div key={i} className="guide h" style={{ top: v.y + g.at * v.zoom }} />
        ),
      )}
      {marquee && <div className="marquee" style={toScreen(marquee)} />}
      {picking && <div className="pick-banner">Click a layer on the canvas · Esc to cancel</div>}

      {editing && editBox && (
        <textarea
          className="text-edit"
          autoFocus
          spellCheck={false}
          value={editing.text}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') useStore.getState().setEditingText(null);
          }}
          onChange={(e) => useStore.getState().updateLayer(editing.id, { text: e.target.value }, `text-${editing.id}`)}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            ...toScreen({ ...editBox, w: Math.max(editBox.w, 40) + 40 }),
            fontFamily: `"${editing.fontFamily ?? 'Inter'}"`,
            fontSize: (editing.fontSize ?? 16) * v.zoom,
            fontWeight: editing.fontWeight,
            lineHeight: editing.lineHeight,
            letterSpacing: (editing.letterSpacing ?? 0) * v.zoom,
            textAlign: editing.align,
          }}
        />
      )}

      <div className="zoom-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => setView((x) => zoomAround(x, 1 / 1.25, container.current!))}>−</button>
        <button className="pct" onClick={fit} title="Zoom to fit">
          {Math.round(v.zoom * 100)}%
        </button>
        <button onClick={() => setView((x) => zoomAround(x, 1.25, container.current!))}>+</button>
      </div>
    </div>
  );
}

function zoomAround(v: { zoom: number; x: number; y: number }, k: number, el: HTMLElement) {
  const { width, height } = el.getBoundingClientRect();
  const zoom = Math.min(8, Math.max(0.05, v.zoom * k));
  const cx = width / 2;
  const cy = height / 2;
  return { zoom, x: cx - ((cx - v.x) / v.zoom) * zoom, y: cy - ((cy - v.y) / v.zoom) * zoom };
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function addImageFile(file: File, cx?: number, cy?: number) {
  const url = await readFile(file);
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  const s = useStore.getState();
  const { stage } = s.project;
  const k = Math.min(1, 640 / (img.naturalWidth || 640), 480 / (img.naturalHeight || 480));
  const w = Math.round((img.naturalWidth || 400) * k);
  const h = Math.round((img.naturalHeight || 300) * k);
  const id = uid('img');
  const layer = makeLayer('image', {
    name: file.name.replace(/\.[^.]+$/, ''),
    src: `asset:${id}`,
    fill: null,
    radius: 12,
    w,
    h,
    x: Math.round((cx ?? stage.width / 2) - w / 2),
    y: Math.round((cy ?? stage.height / 2) - h / 2),
  });
  s.edit((p) => {
    p.assets[id] = url;
    p.layers.push(layer);
  });
  s.select([layer.id]);
}

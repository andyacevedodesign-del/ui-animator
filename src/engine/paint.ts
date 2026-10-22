/**
 * Paints the layer tree into a 2D context at one resolved frame. The context
 * arrives already transformed into stage space; shadows and blur, which the
 * canvas measures in device pixels, are scaled by the current transform.
 */
import { iconPath } from './icons';
import type { Frame } from './resolve';
import type { Layer, Paint } from './model';
import { restState, type AnimState } from './presets';
import { fontOf, lineHeightPx, wrapLines } from './text';

export interface PaintEnv {
  images: Map<string, CanvasImageSource & { width: number; height: number }>;
  assets: Record<string, string>;
}

const REST = restState();

export function resolveSrc(src: string | undefined, assets: Record<string, string>): string | null {
  if (!src) return null;
  if (src.startsWith('asset:')) return assets[src.slice(6)] ?? null;
  return src;
}

function deviceScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

function paintStyle(ctx: CanvasRenderingContext2D, p: Paint, w: number, h: number): string | CanvasGradient {
  if (p.type === 'solid') return p.color;
  if (p.type === 'radial') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    g.addColorStop(0, p.from);
    g.addColorStop(1, p.to);
    return g;
  }
  const a = (p.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  const half = 0.5 * (Math.abs(dx) * w + Math.abs(dy) * h);
  const g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
  g.addColorStop(0, p.from);
  g.addColorStop(1, p.to);
  return g;
}

function shapePath(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number) {
  ctx.beginPath();
  if (l.type === 'ellipse') ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
  else if (l.type === 'star') starPath(ctx, w, h, l.points ?? 4, l.inner ?? 0.15);
  else if (l.radius > 0) ctx.roundRect(0, 0, w, h, Math.min(l.radius, w / 2, h / 2));
  else ctx.rect(0, 0, w, h);
}

/**
 * A sparkle: tips on an ellipse filling the box, joined by curves pulled toward
 * the centre. With `inner` at 0 the sides are fully concave (the classic
 * four-point glint); raising it fattens the star toward a polygon.
 */
function starPath(ctx: CanvasRenderingContext2D, w: number, h: number, points: number, inner: number) {
  const n = Math.max(3, Math.round(points));
  const rx = w / 2;
  const ry = h / 2;
  const at = (a: number, k: number) => [w / 2 + Math.cos(a) * rx * k, h / 2 + Math.sin(a) * ry * k] as const;
  const step = (Math.PI * 2) / n;
  const start = -Math.PI / 2;
  ctx.moveTo(...at(start, 1));
  for (let i = 0; i < n; i++) {
    const mid = at(start + step * (i + 0.5), Math.min(1, Math.max(0, inner)) * 0.9);
    const next = at(start + step * (i + 1), 1);
    ctx.quadraticCurveTo(mid[0], mid[1], next[0], next[1]);
  }
  ctx.closePath();
}

const glowColor = (l: Layer) =>
  l.type === 'text' || l.type === 'icon' ? l.color ?? '#ffffff' : l.fill?.type === 'solid' ? l.fill.color : l.fill?.from ?? '#ffffff';

function formatCount(match: string, k: number): string {
  const decimals = match.includes('.') ? match.split('.')[1].length : 0;
  const value = parseFloat(match.replace(/,/g, '')) * k;
  const fixed = value.toFixed(decimals);
  if (!match.includes(',')) return fixed;
  const [int, frac] = fixed.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
}

function paintText(ctx: CanvasRenderingContext2D, l: Layer, w: number, s: AnimState) {
  const sizing = l.sizing ?? 'auto-width';
  let text = l.text ?? '';
  if (s.count < 1) text = text.replace(/\d[\d,]*(\.\d+)?/g, (m) => formatCount(m, s.count));
  const lines = wrapLines({ ...l, text }, sizing === 'auto-width' ? null : Math.max(1, w));
  const lh = lineHeightPx(l);
  ctx.font = fontOf(l);
  ctx.letterSpacing = `${l.letterSpacing ?? 0}px`;
  ctx.fillStyle = l.fill ? paintStyle(ctx, l.fill, w, lines.length * lh) : l.color ?? '#000';
  ctx.textBaseline = 'middle';
  const align = l.align ?? 'left';
  ctx.textAlign = align;
  const x = align === 'center' ? w / 2 : align === 'right' ? w : 0;
  const total = lines.reduce((n, line) => n + line.length, 0);
  let budget = s.chars >= 1 ? Infinity : Math.floor(total * s.chars);
  let caret: { x: number; y: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (budget <= 0 && s.chars < 1) break;
    const line = budget === Infinity ? lines[i] : lines[i].slice(0, budget);
    if (budget !== Infinity) budget -= lines[i].length;
    const y = i * lh + lh / 2;
    ctx.fillText(line, x, y);
    if (s.chars < 1 && s.chars > 0) {
      const lw = ctx.measureText(line).width;
      const left = align === 'center' ? x - ctx.measureText(lines[i]).width / 2 : align === 'right' ? x - ctx.measureText(lines[i]).width : x;
      caret = { x: left + lw + 2, y };
    }
  }
  if (caret) {
    const size = l.fontSize ?? 16;
    ctx.fillRect(caret.x, caret.y - size * 0.55, Math.max(1.5, size * 0.07), size * 1.1);
  }
}

function paintImage(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number, env: PaintEnv) {
  const src = resolveSrc(l.src, env.assets);
  const img = src ? env.images.get(src) : undefined;
  if (!img || !img.width) return;
  const r = img.width / img.height;
  const box = w / h;
  let dw = w;
  let dh = h;
  if ((l.fit ?? 'cover') === 'cover' ? r > box : r < box) dw = h * r;
  else dh = w / r;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function paintSheen(ctx: CanvasRenderingContext2D, w: number, h: number, pos: number) {
  const band = Math.max(w, h) * 0.35;
  const cx = -band + pos * (w + band * 2);
  const g = ctx.createLinearGradient(cx - band, -h * 0.4, cx + band, h * 1.4);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

export function paintLayer(ctx: CanvasRenderingContext2D, l: Layer, frame: Frame, env: PaintEnv) {
  if (!l.visible) return;
  const box = frame.local.get(l.id);
  if (!box) return;
  const s = frame.states.get(l.id) ?? REST;
  const alpha = l.opacity * s.opacity;
  if (alpha <= 0.002 || s.sx === 0 || s.sy === 0) return;
  const { w, h } = box;
  if (s.clip[0] + s.clip[2] >= 1 || s.clip[1] + s.clip[3] >= 1) return;

  ctx.save();
  ctx.translate(box.x + w / 2 + s.dx, box.y + h / 2 + s.dy);
  const rot = l.rotation + s.rot;
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  if (s.sx !== 1 || s.sy !== 1) ctx.scale(s.sx, s.sy);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha *= alpha;
  const k = deviceScale(ctx);
  const blur = s.blur + (l.blur ?? 0);
  if (blur > 0.2) ctx.filter = `blur(${(blur * k).toFixed(2)}px)`;

  if (s.clip.some((v) => v > 0)) {
    ctx.beginPath();
    ctx.rect(w * s.clip[0], h * s.clip[1], w * (1 - s.clip[0] - s.clip[2]), h * (1 - s.clip[1] - s.clip[3]));
    ctx.clip();
  }

  const boxy = l.type === 'frame' || l.type === 'rect' || l.type === 'ellipse' || l.type === 'star' || l.type === 'image';
  if (boxy) {
    shapePath(ctx, l, w, h);
    if (s.glow > 0 || l.shadow) {
      // Shadow and glow ride on the fill; with no fill there is nothing to cast them.
      ctx.save();
      ctx.fillStyle = l.fill ? paintStyle(ctx, l.fill, w, h) : 'rgba(0,0,0,0)';
      if (l.shadow) {
        ctx.shadowColor = l.shadow.color;
        ctx.shadowBlur = l.shadow.blur * k;
        ctx.shadowOffsetX = l.shadow.x * k;
        ctx.shadowOffsetY = l.shadow.y * k;
        ctx.fill();
      }
      if (s.glow > 0) {
        ctx.shadowColor = glowColor(l);
        ctx.shadowBlur = 48 * s.glow * k;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha *= Math.min(1, s.glow);
        ctx.fill();
      }
      ctx.restore();
    }
    if (l.fill) {
      ctx.fillStyle = paintStyle(ctx, l.fill, w, h);
      ctx.fill();
    }
    if (l.type === 'image') {
      ctx.save();
      ctx.clip();
      paintImage(ctx, l, w, h, env);
      ctx.restore();
    }
    if (l.type === 'frame' && l.children?.length) {
      ctx.save();
      if (l.clip) {
        shapePath(ctx, l, w, h);
        ctx.clip();
      }
      for (const c of l.children) paintLayer(ctx, c, frame, env);
      ctx.restore();
    }
    if (l.stroke && l.stroke.width > 0) {
      shapePath(ctx, l, w, h);
      ctx.strokeStyle = l.stroke.color;
      ctx.lineWidth = l.stroke.width;
      ctx.stroke();
    }
  } else if (l.type === 'text') {
    if (s.glow > 0) {
      ctx.shadowColor = glowColor(l);
      ctx.shadowBlur = 32 * s.glow * k;
    } else if (l.shadow) {
      ctx.shadowColor = l.shadow.color;
      ctx.shadowBlur = l.shadow.blur * k;
      ctx.shadowOffsetX = l.shadow.x * k;
      ctx.shadowOffsetY = l.shadow.y * k;
    }
    paintText(ctx, l, w, s);
  } else if (l.type === 'icon') {
    ctx.save();
    if (s.glow > 0) {
      ctx.shadowColor = glowColor(l);
      ctx.shadowBlur = 24 * s.glow * k;
    }
    ctx.scale(w / 24, h / 24);
    const path = iconPath(l.icon ?? 'sparkle');
    if (l.fill) {
      ctx.fillStyle = paintStyle(ctx, l.fill, 24, 24);
      ctx.fill(path);
    }
    if ((l.strokeWidth ?? 2) > 0) {
      ctx.strokeStyle = l.color ?? '#000';
      ctx.lineWidth = l.strokeWidth ?? 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    ctx.restore();
  }

  if (s.sheen !== null) {
    ctx.filter = 'none';
    if (boxy) shapePath(ctx, l, w, h);
    else {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
    }
    ctx.clip();
    paintSheen(ctx, w, h, s.sheen);
  }
  ctx.restore();
}

export function paintLayers(ctx: CanvasRenderingContext2D, layers: Layer[], frame: Frame, env: PaintEnv) {
  for (const l of layers) paintLayer(ctx, l, frame, env);
}

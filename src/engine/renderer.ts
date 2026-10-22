/**
 * Renderer: owns the output canvas, the background effect, the UI canvases and
 * the three.js stage. The editor viewport and every exporter (each with its own
 * instance at export resolution) draw through it, so preview and export match.
 *
 *   background effect ─┐
 *   UI (flat: painted straight into the output with the camera transform;
 *       3D:   painted into planes, filmed by three.js) ─┼─► output canvas
 *   cursor (output space, last) ───────────────────────┘
 */
import { loadEffect, type EffectInstance } from './backgrounds';
import type { Layer, Project } from './model';
import { walk } from './model';
import { paintLayers, resolveSrc, type PaintEnv } from './paint';
import { resolveFrame, type Frame } from './resolve';
import { needs3D, Stage3D, type Plane } from './stage3d';
import { resetTextCache } from './text';

export interface DrawOptions {
  rest?: boolean;
  /** Overlay hook, called in stage space after the UI (editor guides). */
  overlay?: (ctx: CanvasRenderingContext2D, frame: Frame) => void;
}

const FONT_WEIGHTS = [400, 500, 600, 700, 800];

export async function loadFonts(project: Project) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const families = new Set<string>(['Inter']);
  walk(project.layers, (l) => {
    if (l.type === 'text') families.add(l.fontFamily || 'Inter');
  });
  await Promise.all([...families].flatMap((f) => FONT_WEIGHTS.map((w) => document.fonts.load(`${w} 16px "${f}"`).catch(() => []))));
  resetTextCache();
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas = document.createElement('canvas');
  private bg: EffectInstance | null = null;
  private bgId: string | null = null;
  private bgSize = '';
  private stage3d: Stage3D | null = null;
  private planes = new Map<string, HTMLCanvasElement>();
  private images = new Map<string, HTMLImageElement>();
  private loading = new Map<string, Promise<void>>();
  /** Output px per stage px. */
  scale = 1;
  project: Project;
  onAsync?: () => void;

  constructor(project: Project, canvas = document.createElement('canvas')) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.project = project;
  }

  setProject(project: Project) {
    this.project = project;
    this.syncImages();
    void this.syncBackground();
  }

  setScale(scale: number) {
    this.scale = scale;
    const w = Math.max(2, Math.round(this.project.stage.width * scale));
    const h = Math.max(2, Math.round(this.project.stage.height * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Fonts, images and the background module: await before an exact frame. */
  async ready() {
    await loadFonts(this.project);
    this.syncImages();
    await Promise.all([...this.loading.values(), this.syncBackground()]);
  }

  private syncImages() {
    walk(this.project.layers, (l: Layer) => {
      const src = resolveSrc(l.src, this.project.assets);
      if (!src || this.images.has(src) || this.loading.has(src)) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const p = new Promise<void>((resolve) => {
        img.onload = () => {
          this.images.set(src, img);
          this.loading.delete(src);
          this.onAsync?.();
          resolve();
        };
        img.onerror = () => {
          this.loading.delete(src);
          resolve();
        };
      });
      img.src = src;
      this.loading.set(src, p);
    });
  }

  private async syncBackground() {
    const id = this.project.background.effect;
    if (id === this.bgId) return;
    this.bgId = id;
    this.bg?.dispose();
    this.bg = null;
    this.bgSize = '';
    if (!id) return;
    try {
      const mod = await loadEffect(id);
      if (this.bgId !== id) return;
      // A fresh canvas per effect: a WebGL context can't be handed between programs cleanly.
      this.bgCanvas = document.createElement('canvas');
      this.bg = mod.create(this.bgCanvas);
      this.onAsync?.();
    } catch (err) {
      console.error('Background failed to load', err);
    }
  }

  private plane(key: string, w: number, h: number): HTMLCanvasElement {
    let c = this.planes.get(key);
    if (!c) {
      c = document.createElement('canvas');
      this.planes.set(key, c);
    }
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  }

  draw(t: number, o: DrawOptions = {}): Frame {
    const { project, ctx, canvas, scale } = this;
    const { width: W, height: H } = project.stage;
    const frame = resolveFrame(project, t, { rest: o.rest });
    const cam = frame.camera;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background, with a little parallax when the camera zooms.
    if (this.bg) {
      const size = `${W}x${H}@${scale}`;
      if (size !== this.bgSize) {
        this.bg.setSize(W, H, scale);
        this.bgSize = size;
      }
      // Speed scales time against the same loop length, so whole-number speeds stay seamless.
      this.bg.render(t * (project.background.speed ?? 1), project.background.params, project.stage.duration);
      const z = Math.max(1, 1 + (cam.zoom - 1) * 0.25);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(z, z);
      ctx.drawImage(this.bgCanvas, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.fillStyle = project.background.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const env: PaintEnv = { images: this.images, assets: project.assets };
    let toOutput: (x: number, y: number) => { x: number; y: number };

    if (!needs3D(cam)) {
      const m = new DOMMatrix().scale(scale).translate(W / 2, H / 2).scale(cam.zoom).translate(-cam.focusX, -cam.focusY);
      ctx.setTransform(m);
      paintLayers(ctx, project.layers, frame, env);
      o.overlay?.(ctx, frame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      toOutput = (x, y) => {
        const p = m.transformPoint(new DOMPoint(x, y));
        return { x: p.x, y: p.y };
      };
    } else {
      this.stage3d ??= new Stage3D();
      // Paint density follows the zoom so close-ups stay sharp.
      const density = scale * Math.min(2, Math.max(1, cam.zoom));
      const pw = Math.round(W * density);
      const ph = Math.round(H * density);
      const groups = new Map<number, Layer[]>();
      for (const l of project.layers) {
        const d = l.depth || 0;
        groups.set(d, [...(groups.get(d) ?? []), l]);
      }
      const planes: Plane[] = [...groups.keys()]
        .sort((a, b) => a - b)
        .map((depth) => {
          const c = this.plane(`d${depth}`, pw, ph);
          const g = c.getContext('2d')!;
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, pw, ph);
          g.setTransform(density, 0, 0, density, 0, 0);
          paintLayers(g, groups.get(depth)!, frame, env);
          if (depth === 0) o.overlay?.(g, frame);
          return { key: `d${depth}`, canvas: c, depth };
        });
      this.stage3d.render(planes, canvas.width, canvas.height, W, H, cam);
      ctx.drawImage(this.stage3d.canvas, 0, 0);
      const stage = this.stage3d;
      toOutput = (x, y) => stage.project(x, y, 0, canvas.width, canvas.height);
    }

    if (frame.cursor) this.paintCursor(frame, toOutput);
    return frame;
  }

  private paintCursor(frame: Frame, toOutput: (x: number, y: number) => { x: number; y: number }) {
    const c = frame.cursor!;
    const { ctx } = this;
    const cfg = this.project.cursor;
    const p = toOutput(c.x, c.y);
    const k = this.scale * cfg.size * Math.max(1, Math.sqrt(frame.camera.zoom));
    if (c.ripple !== null) {
      const r = (14 + c.ripple * 70) * k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - c.ripple / 0.6)})`;
      ctx.lineWidth = 3 * k;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    const s = k * (1 - 0.12 * c.press);
    ctx.scale(s, s);
    if (cfg.style === 'touch') {
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.25 * c.press})`;
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12 * s;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    } else {
      const arrow = new Path2D('M0 0 L0 29 L7 22.5 L11.5 32.5 L16 30.5 L11.6 20.8 L21 20.8 Z');
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.fillStyle = '#111';
      ctx.fill(arrow);
      ctx.shadowColor = 'transparent';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#fff';
      ctx.stroke(arrow);
    }
    ctx.restore();
  }

  dispose() {
    this.bg?.dispose();
    this.stage3d?.dispose();
    this.planes.clear();
  }
}

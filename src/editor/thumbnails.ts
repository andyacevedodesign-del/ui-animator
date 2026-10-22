/**
 * Thumbnails for the background grid and the component library. Backgrounds
 * render one at a time through a single instance per effect, so the grid never
 * holds more than a handful of WebGL contexts.
 */
import { loadEffect } from '../engine/backgrounds';
import { layoutTree } from '../engine/layout';
import { blankProject, type Layer } from '../engine/model';
import { paintLayers } from '../engine/paint';
import { resolveFrame } from '../engine/resolve';
import { loadFonts } from '../engine/renderer';
import type { BackgroundPreset } from '../library/backgrounds';

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

export function backgroundThumb(p: BackgroundPreset, w = 320, h = 180): Promise<string> {
  const key = `${p.id}:${w}x${h}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (queue = queue.then(async () => {
      if (!p.effect) return '';
      const mod = await loadEffect(p.effect);
      const canvas = document.createElement('canvas');
      const inst = mod.create(canvas);
      try {
        inst.setSize(1920, 1080, w / 1920);
        inst.render(mod.meta.duration * 0.3, p.params, mod.meta.duration);
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        out.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
        return out.toDataURL('image/jpeg', 0.85);
      } finally {
        inst.dispose();
        (canvas.getContext('webgl2') as WebGL2RenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    })) as Promise<string>;
    cache.set(key, hit);
  }
  return hit;
}

/** A component painted at rest, scaled to fit the tile. */
export async function componentThumb(id: string, make: () => Layer, w = 260, h = 160): Promise<string> {
  const key = `component:${id}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      const project = blankProject();
      const layer = make();
      project.layers = [layer];
      await loadFonts(project);
      const box = layoutTree([layer]).get(layer.id)!;
      const pad = 16;
      const k = Math.min((w - pad * 2) / box.w, (h - pad * 2) / box.h, 1);
      const canvas = document.createElement('canvas');
      const dpr = 2;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, (dpr * (w - box.w * k)) / 2, (dpr * (h - box.h * k)) / 2);
      paintLayers(ctx, [{ ...layer, x: 0, y: 0 }], resolveFrame({ ...project, layers: [{ ...layer, x: 0, y: 0 }] }, 0, { rest: true }), { images: new Map(), assets: {} });
      return canvas.toDataURL('image/png');
    })();
    cache.set(key, hit);
  }
  return hit;
}

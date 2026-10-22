/**
 * Background effects are plain ES modules in /public/backgrounds, shared with
 * Background Animator: one `meta` with parameter definitions and a
 * `create(canvas)` that renders a seamless loop at any time.
 */

export type ParamCondition = { key: string; equals?: unknown; oneOf?: unknown[] };
export type ParamDef =
  | { key: string; label: string; group: string; type: 'range'; min: number; max: number; step: number; default: number; hint?: string; showWhen?: ParamCondition[] }
  | { key: string; label: string; group: string; type: 'color'; default: string; hint?: string; showWhen?: ParamCondition[] }
  | { key: string; label: string; group: string; type: 'toggle'; default: boolean; hint?: string; showWhen?: ParamCondition[] }
  | { key: string; label: string; group: string; type: 'select'; options: { value: string; label: string }[]; default: string; hint?: string; showWhen?: ParamCondition[] }
  | { key: string; label: string; group: string; type: 'points'; max: number; default: unknown[]; hint?: string; showWhen?: ParamCondition[] };

export interface EffectMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  duration: number;
  params: ParamDef[];
}

export interface EffectInstance {
  setSize(width: number, height: number, pixelScale: number): void;
  render(time: number, params: Record<string, unknown>, duration: number): void;
  dispose(): void;
}

export interface EffectModule {
  meta: EffectMeta;
  create(canvas: HTMLCanvasElement): EffectInstance;
}

export const EFFECT_IDS = ['y2k-mist', 'blurred-summer', 'mesh-gradient', 'perspective-grid', 'infinity-cove', 'aurora-flow', 'wave-lines', 'dot-grid', 'drifting-clouds'] as const;

const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const modules = new Map<string, Promise<EffectModule>>();

export function loadEffect(id: string): Promise<EffectModule> {
  let pending = modules.get(id);
  if (!pending) {
    // Hidden from the bundler on purpose: these are runtime assets, not imports.
    const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<EffectModule>;
    const url = new URL(`${base()}backgrounds/${id}.js`, location.href).href;
    pending = dynamicImport(url).catch((err) => {
      modules.delete(id);
      throw err;
    });
    modules.set(id, pending);
  }
  return pending;
}

export function paramVisible(conditions: ParamCondition[] | undefined, values: Record<string, unknown>): boolean {
  if (!conditions?.length) return true;
  return conditions.every((c) => (c.oneOf ? c.oneOf.includes(values[c.key]) : c.equals !== undefined ? values[c.key] === c.equals : true));
}

export function defaultParams(meta: EffectMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of meta.params) out[p.key] = Array.isArray(p.default) ? structuredClone(p.default) : p.default;
  return out;
}

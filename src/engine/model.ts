/**
 * A project is plain JSON: the editor state, the save file and what the
 * exporters render are the same object. Everything that moves is derived from
 * it by `resolveFrame(project, t)`, so a frame is a pure function of time.
 */

export type LayerType = 'frame' | 'rect' | 'ellipse' | 'text' | 'image' | 'icon';

export interface GradientPaint {
  type: 'linear';
  from: string;
  to: string;
  /** Degrees; 0 runs top to bottom, 90 left to right (matches the backgrounds). */
  angle: number;
}
export type Paint = { type: 'solid'; color: string } | GradientPaint;

export interface Stroke {
  color: string;
  width: number;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export type TextSizing = 'auto-width' | 'auto-height' | 'fixed';
export type TextAlign = 'left' | 'center' | 'right';

export interface AutoLayout {
  mode: 'none' | 'row' | 'column';
  gap: number;
  padding: number;
  /** Cross-axis alignment. */
  align: 'start' | 'center' | 'end';
  /** Main-axis distribution. */
  justify: 'start' | 'center' | 'end' | 'between';
  /** Size the frame to its contents. */
  hug: boolean;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  /** Parent-local position of the top-left corner, in stage pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fill: Paint | null;
  stroke: Stroke | null;
  radius: number;
  shadow: Shadow | null;
  /** Lifts a top-level layer off the page in 3D camera shots (stage pixels toward the camera). */
  depth: number;

  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: TextAlign;
  color?: string;
  sizing?: TextSizing;

  // image
  src?: string;
  fit?: 'cover' | 'contain';

  // icon
  icon?: string;
  strokeWidth?: number;

  // frame
  children?: Layer[];
  clip?: boolean;
  layout?: AutoLayout;

  anims: Anim[];
}

export interface Anim {
  id: string;
  preset: string;
  /** Start, seconds. */
  at: number;
  duration: number;
  ease: string;
  /** Strength multiplier, meaning depends on the preset (distance, angle, scale). */
  amount: number;
  /** Frames only: run the preset on each child in turn, this many seconds apart. */
  stagger: number;
}

export type CameraPreset = 'static' | 'push-in' | 'pull-out' | 'tilt-reveal' | 'orbit' | 'isometric' | 'float' | 'focus';

export interface Camera {
  preset: CameraPreset;
  /** 0..2 multiplier on the preset's motion. */
  intensity: number;
  /** focus: which layer to zoom to, and when. */
  target: string | null;
  at: number;
  duration: number;
  zoom: number;
}

export interface CursorStep {
  id: string;
  /** Arrival time, seconds. */
  at: number;
  /** Layer to land on (its centre); null uses x/y. */
  target: string | null;
  x: number;
  y: number;
  click: boolean;
}

export interface Cursor {
  enabled: boolean;
  style: 'arrow' | 'touch';
  start: { x: number; y: number };
  steps: CursorStep[];
  size: number;
}

export interface Background {
  /** Module id in /public/backgrounds, or null for a flat colour. */
  effect: string | null;
  params: Record<string, unknown>;
  color: string;
  /** Playback rate of the effect; 1 runs its loop once per stage duration. */
  speed: number;
}

export interface StageSettings {
  width: number;
  height: number;
  duration: number;
  fps: number;
}

export interface Project {
  version: 1;
  name: string;
  stage: StageSettings;
  background: Background;
  camera: Camera;
  cursor: Cursor;
  layers: Layer[];
  /** Uploaded images, referenced from layers as `asset:<id>`. */
  assets: Record<string, string>;
}

let counter = 0;
export function uid(prefix = 'l'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-5)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export const defaultLayout = (): AutoLayout => ({
  mode: 'none',
  gap: 12,
  padding: 16,
  align: 'start',
  justify: 'start',
  hug: false,
});

export function makeLayer(type: LayerType, over: Partial<Layer> = {}): Layer {
  const base: Layer = {
    id: uid(),
    name: type[0].toUpperCase() + type.slice(1),
    type,
    x: 0,
    y: 0,
    w: 120,
    h: 80,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: { type: 'solid', color: '#d9d9de' },
    stroke: null,
    radius: 0,
    shadow: null,
    depth: 0,
    anims: [],
  };
  if (type === 'frame') {
    Object.assign(base, { fill: { type: 'solid', color: '#ffffff' }, radius: 12, children: [], clip: true, layout: defaultLayout() });
  }
  if (type === 'ellipse') base.w = base.h = 80;
  if (type === 'text') {
    Object.assign(base, {
      fill: null,
      text: 'Text',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: 0,
      align: 'left',
      color: '#111118',
      sizing: 'auto-width',
    });
  }
  if (type === 'image') Object.assign(base, { fill: { type: 'solid', color: '#e4e4ea' }, fit: 'cover', w: 240, h: 160 });
  if (type === 'icon') Object.assign(base, { fill: null, icon: 'sparkle', strokeWidth: 2, color: '#111118', w: 24, h: 24 });
  return { ...base, ...over };
}

export function makeAnim(preset: string, over: Partial<Anim> = {}): Anim {
  return { id: uid('a'), preset, at: 0, duration: 0.6, ease: 'power3.out', amount: 1, stagger: 0, ...over };
}

export function blankProject(): Project {
  return {
    version: 1,
    name: 'Untitled',
    stage: { width: 1920, height: 1080, duration: 6, fps: 60 },
    background: { effect: 'mesh-gradient', params: {}, color: '#0c0d14', speed: 1 },
    camera: { preset: 'static', intensity: 1, target: null, at: 1, duration: 1.2, zoom: 1.8 },
    cursor: { enabled: false, style: 'arrow', start: { x: 1500, y: 900 }, steps: [], size: 1 },
    layers: [],
    assets: {},
  };
}

/* ---------------------------------------------------------------- tree helpers -- */

export function walk(layers: Layer[], fn: (layer: Layer, parent: Layer | null, depth: number) => void, parent: Layer | null = null, depth = 0) {
  for (const l of layers) {
    fn(l, parent, depth);
    if (l.children) walk(l.children, fn, l, depth + 1);
  }
}

export function findLayer(layers: Layer[], id: string): Layer | null {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.children) {
      const hit = findLayer(l.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** The array that holds `id`, and its index there. */
export function findSiblings(layers: Layer[], id: string, parent: Layer | null = null): { list: Layer[]; index: number; parent: Layer | null } | null {
  const index = layers.findIndex((l) => l.id === id);
  if (index >= 0) return { list: layers, index, parent };
  for (const l of layers) {
    if (l.children) {
      const hit = findSiblings(l.children, id, l);
      if (hit) return hit;
    }
  }
  return null;
}

export function pathTo(layers: Layer[], id: string): Layer[] {
  for (const l of layers) {
    if (l.id === id) return [l];
    if (l.children) {
      const sub = pathTo(l.children, id);
      if (sub.length) return [l, ...sub];
    }
  }
  return [];
}

/** Deep copy with fresh ids (layers and their animations). */
export function cloneFresh(layer: Layer): Layer {
  return {
    ...structuredClone(layer),
    id: uid(),
    anims: layer.anims.map((a) => ({ ...a, id: uid('a') })),
    children: layer.children?.map(cloneFresh),
  };
}

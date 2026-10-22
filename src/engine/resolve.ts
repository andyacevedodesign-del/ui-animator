/**
 * resolveFrame(project, t): everything that moves, as facts about one instant.
 * Pure: the same project and time always give the same frame.
 */
import { clamp01, ease, lerp } from './ease';
import { layoutTree, worldBoxes, type Box, type Boxes } from './layout';
import type { Anim, Layer, Project } from './model';
import { walk } from './model';
import { presetById, restState, type AnimState } from './presets';

export interface CameraState {
  rotX: number;
  rotY: number;
  rotZ: number;
  zoom: number;
  /** Stage point the camera centres on. */
  focusX: number;
  focusY: number;
}

export interface CursorState {
  x: number;
  y: number;
  /** 0..1 press depth. */
  press: number;
  /** Seconds since the last click, for the ripple; null when none recent. */
  ripple: number | null;
}

export interface Frame {
  t: number;
  local: Boxes;
  world: Boxes;
  states: Map<string, AnimState>;
  camera: CameraState;
  cursor: CursorState | null;
}

/** Applies one anim at time t. */
export function applyAnim(s: AnimState, a: Anim, t: number) {
  const preset = presetById(a.preset);
  if (!preset) return;
  const dur = Math.max(0.0001, a.duration);
  const raw = (t - a.at) / dur;
  switch (preset.kind) {
    case 'in': {
      const v = ease(a.ease)(clamp01(raw));
      preset.apply(s, 1 - v, a.amount, 1);
      break;
    }
    case 'out': {
      if (raw <= 0) return;
      preset.apply(s, ease(a.ease)(clamp01(raw)), a.amount, -1);
      break;
    }
    case 'emphasis': {
      if (raw <= 0 || raw >= 1) return;
      preset.apply(s, ease(a.ease)(raw), a.amount, 1);
      break;
    }
    case 'loop': {
      if (raw <= 0) return;
      preset.apply(s, raw, a.amount, 1);
      break;
    }
  }
}

/** Every layer's anims, with frame staggers pushed down onto the children. */
export function collectAnims(layers: Layer[]): Map<string, Anim[]> {
  const out = new Map<string, Anim[]>();
  const add = (id: string, a: Anim) => {
    const list = out.get(id);
    if (list) list.push(a);
    else out.set(id, [a]);
  };
  walk(layers, (l) => {
    for (const a of l.anims) {
      if (a.stagger > 0 && l.children?.length) {
        l.children.filter((c) => c.visible).forEach((c, i) => add(c.id, { ...a, at: a.at + i * a.stagger, stagger: 0 }));
      } else add(l.id, a);
    }
  });
  return out;
}

const CLICK_PRESS = 0.32;
const TRAVEL = 0.9;

function cursorAt(project: Project, world: Boxes, t: number): CursorState | null {
  const c = project.cursor;
  if (!c.enabled) return null;
  const point = (s: { target: string | null; x: number; y: number }) => {
    const b = s.target ? world.get(s.target) : undefined;
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: s.x, y: s.y };
  };
  const steps = [...c.steps].sort((a, b) => a.at - b.at);
  let pos = { ...c.start };
  let prevAt = 0;
  let press = 0;
  let ripple: number | null = null;
  for (const s of steps) {
    const to = point(s);
    const leave = Math.max(prevAt, s.at - TRAVEL);
    if (t < leave) break;
    if (t < s.at) {
      const p = ease('power3.inOut')(clamp01((t - leave) / Math.max(0.0001, s.at - leave)));
      // A slight arc reads as a hand, not a robot.
      const arc = Math.sin(Math.PI * p) * Math.min(60, Math.hypot(to.x - pos.x, to.y - pos.y) * 0.12);
      pos = { x: lerp(pos.x, to.x, p), y: lerp(pos.y, to.y, p) - arc };
      prevAt = s.at;
      return { ...pos, press: 0, ripple: null };
    }
    pos = to;
    prevAt = s.at;
    if (s.click) {
      const since = t - s.at;
      if (since < CLICK_PRESS) press = Math.sin(Math.PI * (since / CLICK_PRESS));
      if (since < 0.6) ripple = since;
    }
  }
  return { ...pos, press, ripple };
}

/** Cursor clicks press the layer they land on. */
function clickAnims(project: Project): Map<string, Anim[]> {
  const out = new Map<string, Anim[]>();
  if (!project.cursor.enabled) return out;
  for (const s of project.cursor.steps) {
    if (!s.click || !s.target) continue;
    const a: Anim = { id: `click-${s.id}`, preset: 'press', at: s.at, duration: CLICK_PRESS, ease: 'power2.out', amount: 1, stagger: 0 };
    const list = out.get(s.target);
    if (list) list.push(a);
    else out.set(s.target, [a]);
  }
  return out;
}

export function cameraAt(project: Project, world: Boxes, t: number): CameraState {
  const { camera, stage } = project;
  const I = camera.intensity;
  const D = Math.max(0.1, stage.duration);
  const cam: CameraState = { rotX: 0, rotY: 0, rotZ: 0, zoom: 1, focusX: stage.width / 2, focusY: stage.height / 2 };
  const loop = (2 * Math.PI * t) / D;
  switch (camera.preset) {
    case 'push-in':
      cam.zoom = 1 + 0.14 * I * ease('sine.inOut')(clamp01(t / D));
      break;
    case 'pull-out':
      cam.zoom = 1 + 0.14 * I * (1 - ease('sine.inOut')(clamp01(t / D)));
      break;
    case 'tilt-reveal': {
      const k = 1 - ease('power3.inOut')(clamp01(t / Math.min(D, 2.4)));
      cam.rotX = 42 * I * k;
      cam.rotZ = -10 * I * k;
      cam.zoom = 1 - 0.18 * I * k;
      break;
    }
    case 'orbit':
      cam.rotY = 12 * I * Math.sin(loop);
      cam.rotX = 8 * I * (0.5 + 0.5 * Math.cos(loop));
      cam.zoom = 0.94;
      break;
    case 'isometric':
      cam.rotX = 48 * Math.min(1, I) + 4 * Math.sin(loop);
      cam.rotZ = -32 * Math.min(1, I) + 3 * Math.cos(loop);
      cam.zoom = 0.82;
      break;
    case 'float':
      cam.rotX = 5 * I * Math.sin(loop);
      cam.rotY = 7 * I * Math.cos(loop);
      break;
    case 'focus': {
      const b: Box | undefined = camera.target ? world.get(camera.target) : undefined;
      if (!b) break;
      const p = ease('power3.inOut')(clamp01((t - camera.at) / Math.max(0.0001, camera.duration)));
      cam.zoom = lerp(1, Math.max(1, camera.zoom), p);
      cam.focusX = lerp(stage.width / 2, b.x + b.w / 2, p);
      cam.focusY = lerp(stage.height / 2, b.y + b.h / 2, p);
      break;
    }
  }
  return cam;
}

export interface ResolveOptions {
  /** Design mode shows the layout at rest: no animation at all. */
  rest?: boolean;
}

export function resolveFrame(project: Project, t: number, o: ResolveOptions = {}): Frame {
  const local = layoutTree(project.layers);
  const world = worldBoxes(project.layers, local);
  const states = new Map<string, AnimState>();
  if (!o.rest) {
    const anims = collectAnims(project.layers);
    for (const [id, list] of clickAnims(project)) anims.set(id, [...(anims.get(id) ?? []), ...list]);
    for (const [id, list] of anims) {
      const s = restState();
      for (const a of list) applyAnim(s, a, t);
      states.set(id, s);
    }
  }
  return {
    t,
    local,
    world,
    states,
    camera: o.rest ? cameraAt({ ...project, camera: { ...project.camera, preset: 'static' } }, world, t) : cameraAt(project, world, t),
    cursor: o.rest ? null : cursorAt(project, world, t),
  };
}

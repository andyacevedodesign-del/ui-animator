/**
 * Animation presets. Each is a pure function of progress: no clocks, no
 * randomness, so scrubbing backwards is free and exports are exact.
 *
 * Entrances and exits share one "move": `k` is how far the layer is from rest
 * (0 = in place, 1 = fully displaced). An entrance plays k from 1 to 0, an exit
 * from 0 to 1, continuing in the same direction the entrance travelled.
 */
import type { Anim, Layer } from './model';

export interface AnimState {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
  opacity: number;
  blur: number;
  /** Clip insets as fractions of the box: left, top, right, bottom. */
  clip: [number, number, number, number];
  /** Fraction of the text that is typed out. */
  chars: number;
  /** Numbers in the text count up from 0 to their value. */
  count: number;
  /** Light streak position across the box (-0.4..1.4), or null. */
  sheen: number | null;
  /** Halo strength 0..1. */
  glow: number;
}

export const restState = (): AnimState => ({
  dx: 0,
  dy: 0,
  sx: 1,
  sy: 1,
  rot: 0,
  opacity: 1,
  blur: 0,
  clip: [0, 0, 0, 0],
  chars: 1,
  count: 1,
  sheen: null,
  glow: 0,
});

export type PresetKind = 'in' | 'out' | 'emphasis' | 'loop';

export interface Preset {
  id: string;
  label: string;
  kind: PresetKind;
  duration: number;
  ease: string;
  /** Only meaningful on text layers. */
  textOnly?: boolean;
  /**
   * in/out: `v` is k (distance from rest), `dir` is +1 entering, -1 leaving.
   * emphasis: `v` is eased progress 0..1 over the beat.
   * loop: `v` is the phase in cycles since the start (unbounded).
   */
  apply(s: AnimState, v: number, amount: number, dir: number): void;
}

const fadeBy = (s: AnimState, k: number) => {
  s.opacity *= 1 - k;
};

interface Move {
  id: string;
  inLabel: string;
  outLabel: string;
  ease: [string, string];
  duration?: number;
  textOnly?: boolean;
  noOut?: boolean;
  apply(s: AnimState, k: number, a: number, dir: number): void;
}

const MOVES: Move[] = [
  { id: 'fade', inLabel: 'Fade in', outLabel: 'Fade out', ease: ['power2.out', 'power2.in'], apply: (s, k) => fadeBy(s, k) },
  {
    id: 'rise',
    inLabel: 'Rise in',
    outLabel: 'Rise out',
    ease: ['power3.out', 'power2.in'],
    apply: (s, k, a, dir) => {
      fadeBy(s, k);
      s.dy += 48 * a * k * dir;
    },
  },
  {
    id: 'drop',
    inLabel: 'Drop in',
    outLabel: 'Drop out',
    ease: ['power3.out', 'power2.in'],
    apply: (s, k, a, dir) => {
      fadeBy(s, k);
      s.dy -= 48 * a * k * dir;
    },
  },
  {
    id: 'slide-left',
    inLabel: 'Slide in from right',
    outLabel: 'Slide out left',
    ease: ['expo.out', 'power3.in'],
    duration: 0.8,
    apply: (s, k, a, dir) => {
      fadeBy(s, k);
      s.dx += 140 * a * k * dir;
    },
  },
  {
    id: 'slide-right',
    inLabel: 'Slide in from left',
    outLabel: 'Slide out right',
    ease: ['expo.out', 'power3.in'],
    duration: 0.8,
    apply: (s, k, a, dir) => {
      fadeBy(s, k);
      s.dx -= 140 * a * k * dir;
    },
  },
  {
    id: 'scale',
    inLabel: 'Scale in',
    outLabel: 'Scale out',
    ease: ['power3.out', 'power2.in'],
    apply: (s, k, a) => {
      fadeBy(s, k);
      const f = 1 - 0.18 * a * k;
      s.sx *= f;
      s.sy *= f;
    },
  },
  {
    id: 'pop',
    inLabel: 'Pop in',
    outLabel: 'Pop out',
    ease: ['back.out(2.2)', 'back.in(2)'],
    duration: 0.55,
    apply: (s, k, a) => {
      s.opacity *= Math.max(0, 1 - k * 1.6);
      const f = Math.max(0, 1 - 0.7 * a * k);
      s.sx *= f;
      s.sy *= f;
    },
  },
  {
    id: 'zoom',
    inLabel: 'Zoom in',
    outLabel: 'Zoom out',
    ease: ['expo.out', 'power2.in'],
    duration: 0.9,
    apply: (s, k, a) => {
      fadeBy(s, k);
      const f = 1 + 0.35 * a * k;
      s.sx *= f;
      s.sy *= f;
      s.blur += 10 * a * k;
    },
  },
  {
    id: 'blur',
    inLabel: 'Blur in',
    outLabel: 'Blur out',
    ease: ['power2.out', 'power2.in'],
    duration: 0.8,
    apply: (s, k, a) => {
      fadeBy(s, k);
      s.blur += 24 * a * k;
    },
  },
  {
    id: 'spin',
    inLabel: 'Spin in',
    outLabel: 'Spin out',
    ease: ['back.out(1.6)', 'power2.in'],
    duration: 0.8,
    apply: (s, k, a, dir) => {
      fadeBy(s, k);
      s.rot -= 120 * a * k * dir;
      const f = 1 - 0.5 * k;
      s.sx *= f;
      s.sy *= f;
    },
  },
  {
    id: 'flip',
    inLabel: 'Flip in',
    outLabel: 'Flip out',
    ease: ['back.out(1.4)', 'power2.in'],
    duration: 0.7,
    apply: (s, k) => {
      s.opacity *= 1 - k * 0.6;
      s.sy *= Math.max(0.001, 1 - k);
    },
  },
  {
    id: 'bounce',
    inLabel: 'Bounce in',
    outLabel: 'Bounce out',
    ease: ['bounce.out', 'back.in(1.4)'],
    duration: 1,
    apply: (s, k, a, dir) => {
      s.opacity *= Math.max(0, 1 - k * 3);
      s.dy -= 220 * a * k * dir;
    },
  },
  {
    id: 'wipe-right',
    inLabel: 'Wipe in →',
    outLabel: 'Wipe out →',
    ease: ['power3.inOut', 'power3.inOut'],
    duration: 0.8,
    apply: (s, k, _a, dir) => {
      if (dir > 0) s.clip[2] = Math.max(s.clip[2], k);
      else s.clip[0] = Math.max(s.clip[0], k);
    },
  },
  {
    id: 'wipe-down',
    inLabel: 'Wipe in ↓',
    outLabel: 'Wipe out ↓',
    ease: ['power3.inOut', 'power3.inOut'],
    duration: 0.8,
    apply: (s, k, _a, dir) => {
      if (dir > 0) s.clip[3] = Math.max(s.clip[3], k);
      else s.clip[1] = Math.max(s.clip[1], k);
    },
  },
  {
    id: 'wipe-up',
    inLabel: 'Wipe in ↑',
    outLabel: 'Wipe out ↑',
    ease: ['power3.inOut', 'power3.inOut'],
    duration: 0.8,
    apply: (s, k, _a, dir) => {
      if (dir > 0) s.clip[1] = Math.max(s.clip[1], k);
      else s.clip[3] = Math.max(s.clip[3], k);
    },
  },
  {
    id: 'wipe-left',
    inLabel: 'Wipe in ←',
    outLabel: 'Wipe out ←',
    ease: ['power3.inOut', 'power3.inOut'],
    duration: 0.8,
    apply: (s, k, _a, dir) => {
      if (dir > 0) s.clip[0] = Math.max(s.clip[0], k);
      else s.clip[2] = Math.max(s.clip[2], k);
    },
  },
  {
    id: 'iris',
    inLabel: 'Open from centre',
    outLabel: 'Close to centre',
    ease: ['expo.out', 'power3.in'],
    duration: 0.8,
    apply: (s, k) => {
      for (let i = 0; i < 4; i++) s.clip[i] = Math.max(s.clip[i], k / 2);
    },
  },
  {
    id: 'type',
    inLabel: 'Typewriter',
    outLabel: 'Untype',
    ease: ['none', 'none'],
    duration: 1.2,
    textOnly: true,
    apply: (s, k) => {
      s.chars = Math.min(s.chars, 1 - k);
    },
  },
  {
    id: 'count',
    inLabel: 'Count up',
    outLabel: 'Count down',
    ease: ['power2.out', 'power2.in'],
    duration: 1.4,
    textOnly: true,
    apply: (s, k) => {
      s.count = Math.min(s.count, 1 - k);
    },
  },
];

const bump = (p: number) => Math.sin(Math.PI * p);
const decay = (p: number, cycles: number) => Math.sin(p * Math.PI * 2 * cycles) * (1 - p);

const EMPHASIS: Preset[] = [
  { id: 'pulse', label: 'Pulse', kind: 'emphasis', duration: 0.5, ease: 'sine.inOut', apply: (s, p, a) => scale(s, 1 + 0.08 * a * bump(p)) },
  { id: 'press', label: 'Press', kind: 'emphasis', duration: 0.3, ease: 'power2.out', apply: (s, p, a) => scale(s, 1 - 0.06 * a * bump(p)) },
  { id: 'shake', label: 'Shake', kind: 'emphasis', duration: 0.6, ease: 'none', apply: (s, p, a) => void (s.dx += 12 * a * decay(p, 4)) },
  { id: 'wiggle', label: 'Wiggle', kind: 'emphasis', duration: 0.7, ease: 'none', apply: (s, p, a) => void (s.rot += 7 * a * decay(p, 3)) },
  { id: 'jump', label: 'Jump', kind: 'emphasis', duration: 0.6, ease: 'none', apply: (s, p, a) => void (s.dy -= 28 * a * Math.abs(Math.sin(Math.PI * p * 2)) * (1 - p * 0.6)) },
  {
    id: 'tada',
    label: 'Tada',
    kind: 'emphasis',
    duration: 0.9,
    ease: 'none',
    apply: (s, p, a) => {
      scale(s, 1 + 0.1 * a * bump(p));
      s.rot += 5 * a * Math.sin(p * Math.PI * 8) * bump(p);
    },
  },
  { id: 'glow', label: 'Glow', kind: 'emphasis', duration: 1, ease: 'sine.inOut', apply: (s, p, a) => void (s.glow = Math.max(s.glow, a * bump(p))) },
  { id: 'sheen', label: 'Sheen', kind: 'emphasis', duration: 0.9, ease: 'power2.inOut', apply: (s, p) => void (s.sheen = -0.4 + p * 1.8) },
];

const LOOPS: Preset[] = [
  { id: 'float', label: 'Float', kind: 'loop', duration: 3, ease: 'none', apply: (s, ph, a) => void (s.dy += 10 * a * Math.sin(2 * Math.PI * ph)) },
  { id: 'breathe', label: 'Breathe', kind: 'loop', duration: 2.4, ease: 'none', apply: (s, ph, a) => scale(s, 1 + 0.035 * a * Math.sin(2 * Math.PI * ph)) },
  { id: 'sway', label: 'Sway', kind: 'loop', duration: 3, ease: 'none', apply: (s, ph, a) => void (s.rot += 4 * a * Math.sin(2 * Math.PI * ph)) },
  { id: 'spin-loop', label: 'Spin', kind: 'loop', duration: 2, ease: 'none', apply: (s, ph, a) => void (s.rot += 360 * a * ph) },
  {
    id: 'orbit',
    label: 'Drift',
    kind: 'loop',
    duration: 4,
    ease: 'none',
    apply: (s, ph, a) => {
      s.dx += 8 * a * Math.cos(2 * Math.PI * ph);
      s.dy += 8 * a * Math.sin(2 * Math.PI * ph);
    },
  },
  { id: 'blink', label: 'Blink', kind: 'loop', duration: 1.2, ease: 'none', apply: (s, ph, a) => void (s.opacity *= 1 - Math.min(1, a) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph))) },
  { id: 'glow-loop', label: 'Glow pulse', kind: 'loop', duration: 2, ease: 'none', apply: (s, ph, a) => void (s.glow = Math.max(s.glow, a * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph)))) },
  {
    id: 'sheen-loop',
    label: 'Glint',
    kind: 'loop',
    duration: 2.5,
    ease: 'none',
    apply: (s, ph) => {
      // A quick sweep in the first 40% of each cycle, then rest.
      const f = ph - Math.floor(ph);
      if (f < 0.4) s.sheen = -0.4 + (f / 0.4) * 1.8;
    },
  },
];

function scale(s: AnimState, f: number) {
  s.sx *= f;
  s.sy *= f;
}

export const PRESETS: Preset[] = [
  ...MOVES.map<Preset>((m) => ({
    id: `${m.id}-in`,
    label: m.inLabel,
    kind: 'in',
    duration: m.duration ?? 0.6,
    ease: m.ease[0],
    textOnly: m.textOnly,
    apply: m.apply,
  })),
  ...MOVES.filter((m) => !m.noOut).map<Preset>((m) => ({
    id: `${m.id}-out`,
    label: m.outLabel,
    kind: 'out',
    duration: (m.duration ?? 0.6) * 0.8,
    ease: m.ease[1],
    textOnly: m.textOnly,
    apply: m.apply,
  })),
  ...EMPHASIS,
  ...LOOPS,
];

const byId = new Map(PRESETS.map((p) => [p.id, p]));
export const presetById = (id: string) => byId.get(id);

export const KIND_LABEL: Record<PresetKind, string> = { in: 'Entrance', out: 'Exit', emphasis: 'Emphasis', loop: 'Loop' };

export function presetsFor(layer: Layer | null): Preset[] {
  return PRESETS.filter((p) => !p.textOnly || layer?.type === 'text');
}

/** When an anim stops affecting the frame (loops run to the end of the stage). */
export function animEnd(a: Anim, stageDuration: number): number {
  return presetById(a.preset)?.kind === 'loop' ? stageDuration : a.at + a.duration;
}

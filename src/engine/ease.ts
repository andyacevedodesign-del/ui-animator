/**
 * GSAP's easing engine, used as plain functions of progress so every frame
 * stays a pure function of time (no tweens, no internal clocks).
 */
import gsap from 'gsap';

export type EaseFn = (t: number) => number;

const cache = new Map<string, EaseFn>();
export function ease(name: string): EaseFn {
  let fn = cache.get(name);
  if (!fn) {
    fn = (gsap.parseEase(name) as EaseFn | undefined) ?? ((t: number) => t);
    cache.set(name, fn);
  }
  return fn;
}

export const EASES: { value: string; label: string }[] = [
  { value: 'power3.out', label: 'Smooth out' },
  { value: 'expo.out', label: 'Expo out' },
  { value: 'power2.inOut', label: 'Smooth in-out' },
  { value: 'back.out(1.7)', label: 'Overshoot' },
  { value: 'back.out(3)', label: 'Big overshoot' },
  { value: 'elastic.out(1,0.45)', label: 'Elastic' },
  { value: 'bounce.out', label: 'Bounce' },
  { value: 'circ.out', label: 'Circ out' },
  { value: 'sine.inOut', label: 'Sine in-out' },
  { value: 'power2.in', label: 'Accelerate' },
  { value: 'expo.in', label: 'Expo in' },
  { value: 'none', label: 'Linear' },
];

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

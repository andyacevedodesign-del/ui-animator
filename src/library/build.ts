/** A tiny builder for component trees, so the library reads like the UI it makes. */
import { defaultLayout, makeAnim, makeLayer, type Anim, type AutoLayout, type Layer, type Paint, type Shadow } from '../engine/model';

type Over = Partial<Layer>;

export const solid = (color: string): Paint => ({ type: 'solid', color });
export const linear = (from: string, to: string, angle = 135): Paint => ({ type: 'linear', from, to, angle });
export const shadow = (y = 12, blur = 32, color = 'rgba(16,12,40,0.18)', x = 0): Shadow => ({ x, y, blur, color });

export function frame(name: string, over: Over, children: Layer[] = []): Layer {
  return makeLayer('frame', { name, clip: false, ...over, children });
}

export function auto(mode: 'row' | 'column', o: Partial<AutoLayout> = {}): AutoLayout {
  return { ...defaultLayout(), mode, hug: true, ...o };
}

export const row = (name: string, over: Over, lay: Partial<AutoLayout>, children: Layer[]) =>
  frame(name, { fill: null, radius: 0, ...over, layout: auto('row', lay) }, children);
export const col = (name: string, over: Over, lay: Partial<AutoLayout>, children: Layer[]) =>
  frame(name, { fill: null, radius: 0, ...over, layout: auto('column', lay) }, children);

export function text(value: string, over: Over = {}): Layer {
  return makeLayer('text', { name: value.replace(/\n/g, ' ').slice(0, 28), text: value, ...over });
}

export function icon(name: string, over: Over = {}): Layer {
  return makeLayer('icon', { name: `Icon / ${name}`, icon: name, ...over });
}

export function rect(name: string, over: Over = {}): Layer {
  return makeLayer('rect', { name, ...over });
}

export function ellipse(name: string, over: Over = {}): Layer {
  return makeLayer('ellipse', { name, ...over });
}

export function anim(preset: string, at: number, over: Partial<Anim> = {}): Anim {
  return makeAnim(preset, { at, ...over });
}

/** A circle with an icon centred in it. */
export function iconChip(name: string, size: number, bg: Paint, color: string): Layer {
  return frame(
    'Icon chip',
    { w: size, h: size, radius: size / 2, fill: bg, layout: { ...defaultLayout(), mode: 'row', align: 'center', justify: 'center', padding: 0 } },
    [icon(name, { w: size * 0.5, h: size * 0.5, color })],
  );
}

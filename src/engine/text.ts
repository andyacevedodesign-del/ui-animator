/**
 * Text measurement and wrapping on a shared 2D context. Results are cached by
 * font + string, so layout runs every frame without re-measuring.
 */
import type { Layer } from './model';

let ctx: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!;
  return ctx;
}

export function fontOf(l: Layer): string {
  const family = l.fontFamily || 'Inter';
  return `${l.fontWeight ?? 400} ${l.fontSize ?? 16}px "${family}", Inter, system-ui, sans-serif`;
}

const widths = new Map<string, number>();
export function measure(text: string, font: string, spacing = 0): number {
  const key = `${font}|${spacing}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    const c = measureCtx();
    c.font = font;
    c.letterSpacing = `${spacing}px`;
    w = c.measureText(text).width;
    if (widths.size > 20000) widths.clear();
    widths.set(key, w);
  }
  return w;
}

/** Fonts finished loading: cached widths were measured against fallbacks. */
export function resetTextCache() {
  widths.clear();
}

/** Hard line breaks kept; words wrap at `maxWidth` when given. */
export function wrapLines(l: Layer, maxWidth: number | null): string[] {
  const font = fontOf(l);
  const spacing = l.letterSpacing ?? 0;
  const out: string[] = [];
  for (const para of (l.text ?? '').split('\n')) {
    if (maxWidth === null) {
      out.push(para);
      continue;
    }
    const words = para.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const next = line + word;
      if (line && measure(next.trimEnd(), font, spacing) > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    out.push(line.trimEnd());
  }
  return out;
}

export function lineHeightPx(l: Layer): number {
  return (l.fontSize ?? 16) * (l.lineHeight ?? 1.3);
}

/** The box a text layer occupies under its sizing mode. */
export function textSize(l: Layer): { w: number; h: number; lines: string[] } {
  const sizing = l.sizing ?? 'auto-width';
  const lines = wrapLines(l, sizing === 'auto-width' ? null : Math.max(1, l.w));
  const font = fontOf(l);
  const spacing = l.letterSpacing ?? 0;
  const w = sizing === 'auto-width' ? Math.ceil(Math.max(1, ...lines.map((s) => measure(s, font, spacing)))) : l.w;
  const h = sizing === 'fixed' ? l.h : Math.ceil(lines.length * lineHeightPx(l));
  return { w, h, lines };
}

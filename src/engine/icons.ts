/** Icons on a 24×24 grid (Lucide-style strokes). Stroked with the layer colour, filled with its fill. */
const c = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}a${r} ${r} 0 1 1-${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0Z`;

export const ICONS: Record<string, string> = {
  sparkle: 'M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7Z M19 15c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z',
  check: 'M20 6 9 17l-5-5',
  'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  search: `${c(11, 11, 8)} M21 21l-4.35-4.35`,
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-up-right': 'M7 17 17 7M7 7h10v10',
  user: `${c(12, 8, 4)} M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1`,
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M16 2v4M8 2v4M3 10h18',
  image: `M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M21 15l-5-5L5 21 ${c(8.5, 8.5, 1.5)}`,
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M7 11V7a5 5 0 0 1 10 0v4',
  trending: 'M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6',
  chart: 'M12 20V10M18 20V4M6 20v-4',
  home: 'M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
  play: 'M6 3l14 9-14 9V3z',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  globe: `${c(12, 12, 10)} M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z`,
  more: 'M12 12h.01M19 12h.01M5 12h.01',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  clock: `${c(12, 12, 10)} M12 6v6l4 2`,
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  eye: `M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z ${c(12, 12, 3)}`,
  cursor: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
};

export const ICON_NAMES = Object.keys(ICONS);

const paths = new Map<string, Path2D>();
export function iconPath(name: string): Path2D {
  let p = paths.get(name);
  if (!p) {
    p = new Path2D(ICONS[name] ?? ICONS.sparkle);
    paths.set(name, p);
  }
  return p;
}

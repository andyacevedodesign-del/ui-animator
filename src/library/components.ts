/**
 * Ready-made UI pieces. Each returns a fresh tree (new ids), built with auto
 * layout so editing text or adding a row reflows like it would in Figma.
 */
import type { Layer } from '../engine/model';
import { defaultLayout } from '../engine/model';
import { col, ellipse, frame, icon, iconChip, linear, rect, row, shadow, solid, text } from './build';

const INK = '#15151c';
const MUTED = '#6b6b78';
const ACCENT = '#7c3aed';
const BRAND = linear('#8b5cf6', '#6366f1', 120);

export function button(label = 'Get started', primary = true): Layer {
  return row(
    `Button / ${label}`,
    { fill: primary ? BRAND : solid('#ffffff'), radius: 12, stroke: primary ? null : { color: '#e3e3ea', width: 1 }, shadow: primary ? shadow(8, 20, 'rgba(99,70,240,0.35)') : null },
    { padding: 14, gap: 8, align: 'center' },
    [
      text(label, { fontSize: 17, fontWeight: 600, color: primary ? '#ffffff' : INK }),
      ...(primary ? [icon('arrow-right', { w: 18, h: 18, color: '#ffffff', strokeWidth: 2.4 })] : []),
    ],
  );
}

export function badge(label = 'NEW'): Layer {
  return row('Badge', { fill: solid('#ede9fe'), radius: 99 }, { padding: 6, gap: 6, align: 'center' }, [
    icon('sparkle', { w: 14, h: 14, color: ACCENT, fill: solid(ACCENT), strokeWidth: 0 }),
    text(label, { fontSize: 13, fontWeight: 700, letterSpacing: 1, color: ACCENT }),
  ]);
}

export function toast(title = 'Smart replies are here', body = 'Draft an answer to any thread in one click.'): Layer {
  return row('Toast', { fill: solid('#ffffff'), radius: 18, shadow: shadow(16, 40) }, { padding: 18, gap: 16, align: 'center' }, [
    iconChip('sparkle', 44, linear('#a78bfa', '#6366f1'), '#ffffff'),
    col('Copy', {}, { gap: 3, padding: 0 }, [
      text(title, { fontSize: 18, fontWeight: 600, color: INK }),
      text(body, { fontSize: 15, color: MUTED }),
    ]),
    icon('x', { w: 18, h: 18, color: '#a3a3b0' }),
  ]);
}

export function featureCard(): Layer {
  return col(
    'Feature card',
    { fill: solid('#14141c'), radius: 24, stroke: { color: '#2a2a3a', width: 1 }, shadow: shadow(30, 80, 'rgba(0,0,0,0.45)') },
    { padding: 32, gap: 16 },
    [
      row('Badge', { fill: solid('#2e1065'), radius: 99 }, { padding: 7, gap: 6, align: 'center' }, [
        icon('sparkle', { w: 14, h: 14, color: '#c4b5fd', fill: solid('#c4b5fd'), strokeWidth: 0 }),
        text('NEW FEATURE', { fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: '#c4b5fd' }),
      ]),
      text('Meet Autopilot', { fontSize: 40, fontWeight: 700, color: '#ffffff', letterSpacing: -0.8 }),
      text('Turn any brief into a polished first draft — layouts, copy and assets, in seconds.', {
        fontSize: 18,
        lineHeight: 1.5,
        color: '#a6a6ba',
        sizing: 'auto-height',
        w: 420,
      }),
      row('Actions', {}, { gap: 12, padding: 0, align: 'center' }, [button('Try it now'), button('Learn more', false)]),
    ],
  );
}

export function toggleRow(label = 'Focus mode', on = true): Layer {
  return row(
    'Toggle row',
    { fill: solid('#ffffff'), radius: 16, w: 400, h: 68, shadow: shadow(6, 18, 'rgba(16,12,40,0.12)') },
    { hug: false, padding: 18, align: 'center', justify: 'between' },
    [
      row('Label', {}, { gap: 12, padding: 0, align: 'center' }, [
        icon('bolt', { w: 20, h: 20, color: ACCENT }),
        text(label, { fontSize: 18, fontWeight: 500, color: INK }),
      ]),
      frame('Toggle', { w: 54, h: 32, radius: 16, fill: solid(on ? ACCENT : '#d6d6de') }, [
        ellipse('Knob', { x: on ? 25 : 3, y: 3, w: 26, h: 26, fill: solid('#ffffff'), shadow: shadow(2, 4, 'rgba(0,0,0,0.2)') }),
      ]),
    ],
  );
}

export function statCard(): Layer {
  const heights = [34, 52, 40, 66, 58, 80, 96];
  return col('Stat card', { fill: solid('#ffffff'), radius: 22, shadow: shadow(20, 50) }, { padding: 28, gap: 8 }, [
    row('Header', {}, { gap: 10, padding: 0, align: 'center' }, [
      iconChip('trending', 32, solid('#ecfdf5'), '#059669'),
      text('Monthly active users', { fontSize: 16, fontWeight: 500, color: MUTED }),
    ]),
    text('48,920', { fontSize: 52, fontWeight: 700, color: INK, letterSpacing: -1.5 }),
    row('Delta', { fill: solid('#ecfdf5'), radius: 99 }, { padding: 6, gap: 4, align: 'center' }, [
      icon('arrow-up-right', { w: 14, h: 14, color: '#059669', strokeWidth: 2.6 }),
      text('12.4% this month', { fontSize: 14, fontWeight: 600, color: '#059669' }),
    ]),
    row(
      'Bars',
      { w: 320, h: 110 },
      { hug: false, padding: 0, gap: 10, align: 'end', justify: 'between' },
      heights.map((h, i) => rect(`Bar ${i + 1}`, { w: 34, h, radius: 8, fill: i === heights.length - 1 ? BRAND : solid('#e7e5f9') })),
    ),
  ]);
}

export function chatBubble(message = 'Here’s a summary of the launch thread: design is signed off, QA wraps Thursday, and we ship Monday.', mine = false): Layer {
  return row('Message', {}, { gap: 12, padding: 0, align: 'end' }, [
    ellipse('Avatar', { w: 40, h: 40, fill: mine ? linear('#f472b6', '#f59e0b') : linear('#a78bfa', '#6366f1') }),
    col('Bubble', { fill: solid(mine ? '#6d28d9' : '#ffffff'), radius: 20, shadow: shadow(8, 24, 'rgba(16,12,40,0.12)') }, { padding: 16, gap: 4 }, [
      text(mine ? 'You' : 'Assistant', { fontSize: 14, fontWeight: 600, color: mine ? '#ddd6fe' : ACCENT }),
      text(message, { fontSize: 17, lineHeight: 1.45, color: mine ? '#ffffff' : INK, sizing: 'auto-height', w: 360 }),
    ]),
  ]);
}

export function searchBar(): Layer {
  return row(
    'Search',
    { fill: solid('#ffffff'), radius: 16, w: 560, h: 60, stroke: { color: '#e6e6ee', width: 1 }, shadow: shadow(10, 30) },
    { hug: false, padding: 18, gap: 12, align: 'center' },
    [
      icon('search', { w: 22, h: 22, color: '#9b9bab' }),
      text('Search files, people and messages…', { fontSize: 18, color: '#9b9bab' }),
    ],
  );
}

export function progressBar(): Layer {
  return col('Progress', {}, { gap: 10, padding: 0 }, [
    row('Header', { w: 380 }, { hug: false, padding: 0, justify: 'between', align: 'center' }, [
      text('Uploading assets', { fontSize: 16, fontWeight: 500, color: '#ffffff' }),
      text('72%', { fontSize: 16, fontWeight: 600, color: '#c4b5fd' }),
    ]),
    frame('Track', { w: 380, h: 10, radius: 5, fill: solid('rgba(255,255,255,0.15)'), clip: true }, [
      rect('Fill', { w: 274, h: 10, radius: 5, fill: linear('#a78bfa', '#22d3ee', 90) }),
    ]),
  ]);
}

export function modal(): Layer {
  return col('Dialog', { fill: solid('#ffffff'), radius: 24, shadow: shadow(40, 90, 'rgba(10,8,30,0.35)') }, { padding: 32, gap: 18 }, [
    iconChip('shield', 52, solid('#ede9fe'), ACCENT),
    text('Turn on two-step login?', { fontSize: 26, fontWeight: 700, color: INK }),
    text('We’ll ask for a code from your phone whenever you sign in on a new device.', {
      fontSize: 17,
      lineHeight: 1.5,
      color: MUTED,
      sizing: 'auto-height',
      w: 400,
    }),
    row('Actions', {}, { gap: 12, padding: 0 }, [button('Not now', false), button('Turn on')]),
  ]);
}

export function checklist(items = ['Connect your calendar', 'Invite your team', 'Publish your first page']): Layer {
  return col(
    'Checklist',
    { fill: solid('#ffffff'), radius: 20, shadow: shadow(16, 40) },
    { padding: 24, gap: 14 },
    items.map((label) =>
      row(label, {}, { gap: 12, padding: 0, align: 'center' }, [
        iconChip('check', 28, solid('#dcfce7'), '#16a34a'),
        text(label, { fontSize: 18, fontWeight: 500, color: INK }),
      ]),
    ),
  );
}

export function avatarStack(): Layer {
  const colors: [string, string][] = [
    ['#f472b6', '#f59e0b'],
    ['#a78bfa', '#6366f1'],
    ['#34d399', '#06b6d4'],
    ['#fb7185', '#e11d48'],
  ];
  return row('Avatars', {}, { gap: -12, padding: 0, align: 'center' }, [
    ...colors.map(([a, b], i) => ellipse(`Avatar ${i + 1}`, { w: 52, h: 52, fill: linear(a, b), stroke: { color: '#ffffff', width: 3 } })),
    frame('More', { w: 52, h: 52, radius: 26, fill: solid('#f1f1f5'), stroke: { color: '#ffffff', width: 3 }, layout: { ...defaultLayout(), mode: 'row', align: 'center', justify: 'center', padding: 0 } }, [
      text('+8', { fontSize: 16, fontWeight: 600, color: MUTED }),
    ]),
  ]);
}

export function phone(): Layer {
  return frame('Phone', { w: 390, h: 800, radius: 52, fill: solid('#f6f6f9'), stroke: { color: '#16161c', width: 10 }, clip: true, shadow: shadow(40, 90, 'rgba(0,0,0,0.4)') }, [
    text('9:41', { x: 44, y: 22, fontSize: 16, fontWeight: 600, color: INK }),
    rect('Island', { x: 140, y: 18, w: 110, h: 32, radius: 16, fill: solid('#000000') }),
  ]);
}

export function browser(): Layer {
  return frame('Browser', { w: 1100, h: 680, radius: 16, fill: solid('#ffffff'), clip: true, shadow: shadow(40, 100, 'rgba(0,0,0,0.35)') }, [
    frame('Toolbar', { w: 1100, h: 48, radius: 0, fill: solid('#f2f2f6'), layout: { ...defaultLayout(), mode: 'row', hug: false, padding: 18, gap: 8, align: 'center' } }, [
      ellipse('Close', { w: 12, h: 12, fill: solid('#ff5f57') }),
      ellipse('Minimise', { w: 12, h: 12, fill: solid('#febc2e') }),
      ellipse('Zoom', { w: 12, h: 12, fill: solid('#28c840') }),
    ]),
    frame('Address', { x: 350, y: 10, w: 400, h: 28, radius: 8, fill: solid('#ffffff'), layout: { ...defaultLayout(), mode: 'row', hug: false, padding: 10, gap: 6, align: 'center', justify: 'center' } }, [
      icon('lock', { w: 12, h: 12, color: '#9b9bab' }),
      text('yourproduct.com', { fontSize: 13, color: MUTED }),
    ]),
  ]);
}

export interface ComponentEntry {
  id: string;
  name: string;
  make: () => Layer;
}

export const COMPONENTS: ComponentEntry[] = [
  { id: 'feature-card', name: 'Feature card', make: featureCard },
  { id: 'toast', name: 'Toast', make: () => toast() },
  { id: 'button', name: 'Button', make: () => button() },
  { id: 'badge', name: 'Badge', make: () => badge() },
  { id: 'stat', name: 'Stat card', make: statCard },
  { id: 'chat', name: 'Chat message', make: () => chatBubble() },
  { id: 'search', name: 'Search bar', make: searchBar },
  { id: 'toggle', name: 'Toggle row', make: () => toggleRow() },
  { id: 'checklist', name: 'Checklist', make: () => checklist() },
  { id: 'progress', name: 'Progress', make: progressBar },
  { id: 'dialog', name: 'Dialog', make: modal },
  { id: 'avatars', name: 'Avatar stack', make: avatarStack },
  { id: 'phone', name: 'Phone', make: phone },
  { id: 'browser', name: 'Browser window', make: browser },
];

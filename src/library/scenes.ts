/**
 * Starter scenes: complete, animated projects to learn from or start with.
 * Built at runtime (they measure text to centre things).
 */
import { layoutTree } from '../engine/layout';
import { blankProject, type Layer, type Project } from '../engine/model';
import { anim, text } from './build';
import { BACKGROUND_PRESETS } from './backgrounds';
import { button, chatBubble, checklist, featureCard, statCard, toast, toggleRow } from './components';

export function sizeOf(l: Layer) {
  const b = layoutTree([l]).get(l.id)!;
  return { w: b.w, h: b.h };
}

export function placeCentered(l: Layer, cx: number, cy: number): Layer {
  const { w, h } = sizeOf(l);
  l.x = Math.round(cx - w / 2);
  l.y = Math.round(cy - h / 2);
  return l;
}

function withBackground(p: Project, presetId: string): Project {
  p.stage.width = 1280;
  p.stage.height = 720;
  const b = BACKGROUND_PRESETS.find((x) => x.id === presetId)!;
  p.background = { effect: b.effect, params: { ...b.params }, color: b.color ?? p.background.color };
  return p;
}

const find = (root: Layer, name: string): Layer => {
  if (root.name === name) return root;
  for (const c of root.children ?? []) {
    try {
      return find(c, name);
    } catch {
      /* keep looking */
    }
  }
  throw new Error(`No layer named ${name}`);
};

function featureLaunch(): Project {
  const p = withBackground(blankProject(), 'nebula');
  p.name = 'Feature launch';
  p.stage.duration = 7;
  const card = placeCentered(featureCard(), 640, 373);
  card.name = 'Feature card';
  card.depth = 0;
  card.anims.push(anim('rise-in', 0.3, { duration: 0.6, stagger: 0.12, amount: 0.8 }));
  const actions = find(card, 'Actions');
  const primary = actions.children![0];
  primary.anims.push(anim('sheen-loop', 2.4, { duration: 2.6 }));
  const t = placeCentered(toast(), 1013, 100);
  t.depth = 140;
  t.anims.push(anim('slide-left-in', 4.2, { duration: 0.8 }));
  t.anims.push(anim('float', 5, { duration: 3, amount: 0.6 }));
  p.layers = [card, t];
  p.camera = { ...p.camera, preset: 'tilt-reveal', intensity: 1 };
  p.cursor = {
    enabled: true,
    style: 'arrow',
    size: 1.1,
    start: { x: 1000, y: 680 },
    steps: [{ id: 's1', at: 3.4, target: primary.id, x: 0, y: 0, click: true }],
  };
  return p;
}

function dashboard(): Project {
  const p = withBackground(blankProject(), 'dots');
  p.name = 'Metrics card';
  p.stage.duration = 6;
  const card = placeCentered(statCard(), 507, 360);
  card.depth = 0;
  card.anims.push(anim('scale-in', 0.2, { duration: 0.7, ease: 'expo.out' }));
  find(card, '48,920').anims.push(anim('count-in', 0.6, { duration: 1.6, ease: 'power3.out' }));
  find(card, 'Bars').anims.push(anim('wipe-up-in', 0.9, { duration: 0.6, stagger: 0.08, ease: 'power3.out' }));
  find(card, 'Delta').anims.push(anim('pop-in', 2.2));
  const toggle = placeCentered(toggleRow('Weekly digest'), 840, 280);
  toggle.depth = 120;
  toggle.anims.push(anim('rise-in', 1.4, { duration: 0.7 }));
  const list = placeCentered(checklist(['Share with the team', 'Set a goal', 'Export as PDF']), 827, 427);
  list.depth = 60;
  list.anims.push(anim('rise-in', 1.8, { duration: 0.6, stagger: 0.12 }));
  p.layers = [card, toggle, list];
  p.camera = { ...p.camera, preset: 'isometric', intensity: 0.6 };
  return p;
}

function chat(): Project {
  const p = withBackground(blankProject(), 'synthwave');
  p.name = 'AI reply';
  p.stage.duration = 7;
  const q = chatBubble('Can you catch me up on the launch thread?', true);
  placeCentered(q, 640, 253);
  q.anims.push(anim('rise-in', 0.3, { duration: 0.6 }));
  const a = chatBubble();
  placeCentered(a, 640, 373);
  a.anims.push(anim('rise-in', 1.3, { duration: 0.6 }));
  a.children![1].children![1].anims.push(anim('type-in', 1.6, { duration: 2.2 }));
  p.layers = [q, a];
  p.camera = { ...p.camera, preset: 'float', intensity: 1 };
  return p;
}

function summer(): Project {
  const p = withBackground(blankProject(), 'blurred-summer');
  p.name = 'Summer drop';
  p.stage.duration = 8;
  const title = text('Blurred\nSummer', { fontFamily: 'Georgia', fontSize: 112, fontWeight: 400, lineHeight: 0.95, letterSpacing: -2, color: '#fbf3ea' });
  placeCentered(title, 867, 313);
  title.anims.push(anim('blur-in', 0.4, { duration: 1.4, ease: 'power2.out' }));
  title.anims.push(anim('float', 1.8, { duration: 5, amount: 0.5 }));
  const sub = text('A dreamy new collection — soft light and faded summer memories.', { fontSize: 20, color: '#fbf3ea', sizing: 'auto-height', w: 400, align: 'center' });
  placeCentered(sub, 867, 480);
  sub.anims.push(anim('rise-in', 1.4, { duration: 0.8 }));
  const pill = button('Explore the collection', false);
  placeCentered(pill, 867, 547);
  pill.anims.push(anim('pop-in', 2.1));
  pill.anims.push(anim('sheen-loop', 3, { duration: 3 }));
  p.layers = [title, sub, pill];
  p.camera = { ...p.camera, preset: 'push-in', intensity: 0.6 };
  return p;
}

export interface SceneEntry {
  id: string;
  name: string;
  make: () => Project;
}

export const SCENES: SceneEntry[] = [
  { id: 'launch', name: 'Feature launch', make: featureLaunch },
  { id: 'summer', name: 'Blurred summer', make: summer },
  { id: 'metrics', name: 'Metrics card', make: dashboard },
  { id: 'chat', name: 'AI reply', make: chat },
  { id: 'blank', name: 'Blank', make: blankProject },
];

/** Save files: `.uianim.json`. Parsing fills defaults so older files keep opening. */
import { blankProject, makeLayer, type Anim, type Layer, type Project } from '../engine/model';

function fixLayer(raw: Partial<Layer>): Layer {
  const base = makeLayer(raw.type ?? 'rect');
  const l = { ...base, ...raw, anims: (raw.anims ?? []).map((a: Partial<Anim>) => ({ amount: 1, stagger: 0, ease: 'power3.out', ...a })) } as Layer;
  if (l.children) l.children = l.children.map(fixLayer);
  return l;
}

export function parseProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Not a UI Animator project.');
  const r = raw as Partial<Project>;
  if (r.version !== 1 || !Array.isArray(r.layers)) throw new Error('This file is not a UI Animator project (or is from a newer version).');
  const b = blankProject();
  return {
    ...b,
    ...r,
    stage: { ...b.stage, ...r.stage },
    background: { ...b.background, ...r.background },
    camera: { ...b.camera, ...r.camera },
    cursor: { ...b.cursor, ...r.cursor },
    layers: r.layers.map(fixLayer),
    assets: r.assets ?? {},
  };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation';

export function saveProjectFile(p: Project) {
  downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), `${slug(p.name)}.uianim.json`);
}

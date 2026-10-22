/**
 * Editor state. The project is immutable: an edit clones it (minus the asset
 * map, which only ever grows), so undo is a stack of references and typing in
 * a field coalesces into one step.
 */
import { create } from 'zustand';
import { cloneFresh, findLayer, findSiblings, makeAnim, type Anim, type Layer, type Project } from '../engine/model';
import { presetById } from '../engine/presets';
import { parseProject } from './project';

export type Mode = 'design' | 'animate';
export type Tool = 'move' | 'frame' | 'rect' | 'ellipse' | 'text' | 'hand';
export type RightTab = 'design' | 'animate' | 'scene' | 'cursor';

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  coalesce: { key: string; at: number } | null;
  selection: string[];
  selectedAnim: string | null;
  hover: string | null;
  mode: Mode;
  tool: Tool;
  rightTab: RightTab;
  time: number;
  playing: boolean;
  /** Text layer being edited in place. */
  editingText: string | null;
  clipboard: Layer[];
  /** Waiting for a canvas click to choose a layer (cursor and camera targets). */
  picking: ((id: string) => void) | null;
  /** Bumped to ask the viewport to fit the stage. */
  fitToken: number;

  edit(fn: (p: Project) => void, key?: string): void;
  replace(project: Project): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  setHover(id: string | null): void;
  setMode(m: Mode): void;
  setTool(t: Tool): void;
  setRightTab(t: RightTab): void;
  setTime(t: number): void;
  setPlaying(p: boolean): void;
  setEditingText(id: string | null): void;
  selectAnim(id: string | null): void;
  setPicking(fn: ((id: string) => void) | null): void;
  requestFit(): void;

  updateLayer(id: string, patch: Partial<Layer> | ((l: Layer) => void), key?: string): void;
  deleteSelection(): void;
  clearLayers(): void;
  duplicateSelection(): void;
  copy(): void;
  paste(): void;
  addAnim(layerId: string, preset: string): void;
  updateAnim(layerId: string, animId: string, patch: Partial<Anim>, key?: string): void;
  removeAnim(layerId: string, animId: string): void;
}

const STORAGE_KEY = 'ui-animator:project';

function cloneProject(p: Project): Project {
  const assets = p.assets;
  const c = structuredClone({ ...p, assets: {} });
  c.assets = assets;
  return c;
}

export function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function autosave(p: Project) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // Over quota (large images): keep working, the save file still has everything.
    }
  }, 400);
}

export const useStore = create<State>((set, get) => ({
  project: null as unknown as Project,
  past: [],
  future: [],
  coalesce: null,
  selection: [],
  selectedAnim: null,
  hover: null,
  mode: 'design',
  tool: 'move',
  rightTab: 'design',
  time: 0,
  playing: false,
  editingText: null,
  clipboard: [],
  picking: null,
  fitToken: 0,

  edit(fn, key) {
    const { project, past, coalesce } = get();
    const next = cloneProject(project);
    fn(next);
    const now = performance.now();
    const merge = key && coalesce && coalesce.key === key && now - coalesce.at < 1000;
    set({
      project: next,
      past: merge ? past : [...past.slice(-120), project],
      future: [],
      coalesce: key ? { key, at: now } : null,
    });
    autosave(next);
  },
  replace(project) {
    set({ project, past: [], future: [], selection: [], selectedAnim: null, time: 0, coalesce: null });
    autosave(project);
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], coalesce: null });
    autosave(prev);
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), coalesce: null });
    autosave(next);
  },
  select(ids) {
    set({ selection: ids, selectedAnim: null, editingText: null });
  },
  setHover: (hover) => set({ hover }),
  setMode: (mode) => set({ mode, playing: mode === 'design' ? false : get().playing }),
  setTool: (tool) => set({ tool }),
  setRightTab: (rightTab) => set({ rightTab }),
  setTime: (time) => set({ time }),
  setPlaying: (playing) => set({ playing, mode: playing ? 'animate' : get().mode }),
  setEditingText: (editingText) => set({ editingText }),
  selectAnim: (selectedAnim) => set({ selectedAnim }),
  setPicking: (picking) => set({ picking }),
  requestFit: () => set({ fitToken: get().fitToken + 1 }),

  updateLayer(id, patch, key) {
    get().edit((p) => {
      const l = findLayer(p.layers, id);
      if (!l) return;
      if (typeof patch === 'function') patch(l);
      else Object.assign(l, patch);
    }, key);
  },
  deleteSelection() {
    const { selection } = get();
    if (!selection.length) return;
    get().edit((p) => {
      for (const id of selection) {
        const hit = findSiblings(p.layers, id);
        if (hit) hit.list.splice(hit.index, 1);
      }
      p.cursor.steps.forEach((s) => {
        if (s.target && selection.includes(s.target)) s.target = null;
      });
    });
    set({ selection: [] });
  },
  clearLayers() {
    get().edit((p) => {
      p.layers = [];
      for (const s of p.cursor.steps) s.target = null;
      p.camera.target = null;
    });
    set({ selection: [], selectedAnim: null, editingText: null, hover: null });
  },
  duplicateSelection() {
    const { selection } = get();
    const fresh: string[] = [];
    get().edit((p) => {
      for (const id of selection) {
        const hit = findSiblings(p.layers, id);
        if (!hit) continue;
        const copy = cloneFresh(hit.list[hit.index]);
        copy.name = `${copy.name} copy`;
        copy.x += 24;
        copy.y += 24;
        hit.list.splice(hit.index + 1, 0, copy);
        fresh.push(copy.id);
      }
    });
    set({ selection: fresh });
  },
  copy() {
    const { project, selection } = get();
    set({ clipboard: selection.map((id) => findLayer(project.layers, id)).filter((l): l is Layer => !!l).map((l) => structuredClone(l)) });
  },
  paste() {
    const { clipboard } = get();
    if (!clipboard.length) return;
    const fresh: string[] = [];
    get().edit((p) => {
      for (const l of clipboard) {
        const copy = cloneFresh(l);
        copy.x += 24;
        copy.y += 24;
        p.layers.push(copy);
        fresh.push(copy.id);
      }
    });
    set({ selection: fresh });
  },
  addAnim(layerId, presetId) {
    const preset = presetById(presetId);
    if (!preset) return;
    const { project, time } = get();
    const layer = findLayer(project.layers, layerId);
    if (!layer) return;
    // Entrances default to the playhead (or the start); exits to just before the end.
    let at = time;
    if (preset.kind === 'out' && time < 0.05) at = Math.max(0, project.stage.duration - preset.duration - 0.3);
    const a = makeAnim(presetId, { at: Math.round(at * 100) / 100, duration: preset.duration, ease: preset.ease });
    get().edit((p) => findLayer(p.layers, layerId)?.anims.push(a));
    set({ selectedAnim: a.id });
  },
  updateAnim(layerId, animId, patch, key) {
    get().edit((p) => {
      const a = findLayer(p.layers, layerId)?.anims.find((x) => x.id === animId);
      if (a) Object.assign(a, patch);
    }, key);
  },
  removeAnim(layerId, animId) {
    get().edit((p) => {
      const l = findLayer(p.layers, layerId);
      if (l) l.anims = l.anims.filter((a) => a.id !== animId);
    });
    set({ selectedAnim: null });
  },
}));

/** Removes every layer, keeping the background, camera and cursor settings. Undoable. */
export function clearAllLayers() {
  const s = useStore.getState();
  if (!s.project.layers.length) return;
  if (!confirm('Remove all layers? The background and scene settings stay, and you can undo this.')) return;
  s.clearLayers();
}

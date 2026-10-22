import { useEffect, useRef, useState } from 'react';
import { defaultLayout, findLayer, findSiblings, makeLayer, pathTo } from '../engine/model';
import { SCENES } from '../library/scenes';
import { AnimatePanel } from './AnimatePanel';
import { DesignPanel } from './DesignPanel';
import { ExportModal } from './ExportModal';
import { LeftPanel } from './LeftPanel';
import { parseProject, saveProjectFile } from './project';
import { CursorPanel, ScenePanel } from './ScenePanel';
import { clearAllLayers, useStore, type RightTab } from './store';
import { Timeline } from './Timeline';
import { Viewport } from './Viewport';
import { layoutTree } from '../engine/layout';

export function App() {
  const [exporting, setExporting] = useState(false);
  usePlayback();
  useShortcuts();
  return (
    <div className="app">
      <TopBar onExport={() => setExporting(true)} />
      <LeftPanel />
      <main className="center">
        <Viewport />
      </main>
      <RightPanel />
      <Timeline />
      {exporting && <ExportModal onClose={() => setExporting(false)} />}
    </div>
  );
}

function TopBar({ onExport }: { onExport: () => void }) {
  const name = useStore((s) => s.project.name);
  const mode = useStore((s) => s.mode);
  const playing = useStore((s) => s.playing);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [menu, setMenu] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const s = useStore.getState();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">◆</span> UI Animator
      </div>
      <div className="menu-wrap">
        <button className="btn ghost" onClick={() => setMenu(!menu)}>
          File ▾
        </button>
        {menu && (
          <div className="menu" onMouseLeave={() => setMenu(false)}>
            <div className="menu-label">New from starter</div>
            {SCENES.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setMenu(false);
                  if (s.past.length && !confirm('Replace the current project? (Save it first if you want to keep it.)')) return;
                  s.replace(sc.make());
                  s.requestFit();
                }}
              >
                {sc.name}
              </button>
            ))}
            <hr />
            <button onClick={() => (setMenu(false), file.current?.click())}>Open project…</button>
            <button onClick={() => (setMenu(false), saveProjectFile(useStore.getState().project))}>Save project file</button>
            <hr />
            <button onClick={() => (setMenu(false), clearAllLayers())}>Clear all layers</button>
          </div>
        )}
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              s.replace(parseProject(JSON.parse(await f.text())));
              s.requestFit();
            } catch (err) {
              alert(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      </div>
      <input className="project-name" value={name} onChange={(e) => s.edit((p) => void (p.name = e.target.value), 'name')} />
      <div className="top-mid">
        <button className="icon-btn" disabled={!canUndo} onClick={s.undo} title="Undo (⌘Z)">
          ↶
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={s.redo} title="Redo (⇧⌘Z)">
          ↷
        </button>
        <div className="segmented mode">
          <button className={mode === 'design' && !playing ? 'on' : ''} onClick={() => s.setMode('design')} title="Edit the layout at rest">
            Design
          </button>
          <button className={mode === 'animate' || playing ? 'on' : ''} onClick={() => s.setMode('animate')} title="See the frame under the playhead">
            Animate
          </button>
        </div>
        <button className="btn play-btn" onClick={() => s.setPlaying(!playing)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>
      <button className="btn primary" onClick={onExport}>
        Export
      </button>
    </header>
  );
}

function RightPanel() {
  const tab = useStore((s) => s.rightTab);
  const set = useStore((s) => s.setRightTab);
  const tabs: { id: RightTab; label: string }[] = [
    { id: 'design', label: 'Design' },
    { id: 'animate', label: 'Animate' },
    { id: 'scene', label: 'Scene' },
    { id: 'cursor', label: 'Cursor' },
  ];
  return (
    <aside className="right">
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => set(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'design' ? <DesignPanel /> : tab === 'animate' ? <AnimatePanel /> : tab === 'scene' ? <ScenePanel /> : <CursorPanel />}
    </aside>
  );
}

/** Advances the playhead while playing, looping at the end. */
function usePlayback() {
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const s = useStore.getState();
      const D = s.project.stage.duration;
      let t = s.time + (now - last) / 1000;
      last = now;
      if (t >= D) t %= D;
      s.setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') return void (e.preventDefault(), s.redo());
      if (mod && key === 'd') return void (e.preventDefault(), s.duplicateSelection());
      if (mod && key === 'c') return void s.copy();
      if (mod && key === 'v') return void s.paste();
      if (mod && key === 'a') {
        e.preventDefault();
        return void s.select(s.project.layers.map((l) => l.id));
      }
      if (mod && key === 'g') {
        e.preventDefault();
        return void groupSelection(e.shiftKey);
      }
      if (e.shiftKey && key === 'a') return void groupSelection(true);
      if (mod) return;
      if (key === 'delete' || key === 'backspace') return void (e.preventDefault(), s.deleteSelection());
      if (key === ' ') return void (e.preventDefault(), s.setPlaying(!s.playing));
      if (key === 'escape') {
        if (s.picking) return void s.setPicking(null);
        const first = s.selection[0];
        const path = first ? pathTo(s.project.layers, first) : [];
        return void s.select(path.length > 1 ? [path[path.length - 2].id] : []);
      }
      if (key === 'enter') {
        const l = s.selection.length === 1 ? findLayer(s.project.layers, s.selection[0]) : null;
        if (l?.children?.length) s.select([l.children[l.children.length - 1].id]);
        else if (l?.type === 'text') s.setEditingText(l.id);
        return;
      }
      if (key.startsWith('arrow') && s.selection.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -d : key === 'arrowright' ? d : 0;
        const dy = key === 'arrowup' ? -d : key === 'arrowdown' ? d : 0;
        return void s.edit((p) => {
          for (const id of s.selection) {
            const l = findLayer(p.layers, id);
            if (l) {
              l.x += dx;
              l.y += dy;
            }
          }
        }, 'nudge');
      }
      const tools: Record<string, Parameters<typeof s.setTool>[0]> = { v: 'move', f: 'frame', r: 'rect', o: 'ellipse', t: 'text', h: 'hand' };
      if (tools[key]) return void s.setTool(tools[key]);
      if (key === 'home') return void s.setTime(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** ⌘G wraps the selection in a frame; ⇧A wraps it in an auto-layout frame. */
function groupSelection(autoLayout: boolean) {
  const s = useStore.getState();
  const ids = s.selection;
  if (!ids.length) return;
  const first = findSiblings(s.project.layers, ids[0]);
  if (!first) return;
  // Only siblings group together.
  const same = ids.filter((id) => findSiblings(s.project.layers, id)?.list === first.list);
  const local = layoutTree(s.project.layers);
  const boxes = same.map((id) => local.get(id)!);
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const frame = makeLayer('frame', {
    name: autoLayout ? 'Auto layout' : 'Frame',
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    fill: null,
    radius: 0,
    clip: false,
    children: [],
  });
  if (autoLayout) {
    const horizontal = x1 - x0 > y1 - y0;
    frame.layout = { ...defaultLayout(), mode: horizontal ? 'row' : 'column', hug: true, padding: 0 };
  }
  s.edit((p) => {
    const hit = findSiblings(p.layers, same[0])!;
    const order = hit.list.filter((l) => same.includes(l.id));
    const at = Math.max(...order.map((l) => hit.list.indexOf(l)));
    for (const l of order) {
      l.x -= x0;
      l.y -= y0;
    }
    if (autoLayout) order.sort((a, b) => (frame.layout!.mode === 'row' ? a.x - b.x : a.y - b.y));
    frame.children = order;
    const rest = hit.list.filter((l) => !same.includes(l.id));
    const insertAt = Math.min(rest.length, at - (order.length - 1));
    rest.splice(insertAt, 0, frame);
    hit.list.splice(0, hit.list.length, ...rest);
  });
  s.select([frame.id]);
}

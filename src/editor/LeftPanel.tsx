import { useEffect, useState } from 'react';
import { layoutTree } from '../engine/layout';
import { findLayer, findSiblings, makeLayer, pathTo, type Layer } from '../engine/model';
import { COMPONENTS, type ComponentEntry } from '../library/components';
import { useStore, type Tool } from './store';
import { componentThumb } from './thumbnails';
import { addImageFile } from './Viewport';

const TYPE_GLYPH: Record<Layer['type'], string> = { frame: '#', rect: '▢', ellipse: '◯', text: 'T', image: '▣', icon: '✦' };

export function LeftPanel() {
  const [tab, setTab] = useState<'layers' | 'insert'>('insert');
  return (
    <aside className="left">
      <div className="tabs">
        <button className={tab === 'layers' ? 'on' : ''} onClick={() => setTab('layers')}>
          Layers
        </button>
        <button className={tab === 'insert' ? 'on' : ''} onClick={() => setTab('insert')}>
          Insert
        </button>
      </div>
      {tab === 'layers' ? <LayerTree /> : <InsertPanel />}
    </aside>
  );
}

/* ------------------------------------------------------------------ layers -- */

type DropAt = { id: string; where: 'before' | 'after' | 'inside' } | null;

function LayerTree() {
  const layers = useStore((s) => s.project.layers);
  const [drop, setDrop] = useState<DropAt>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const onDrop = () => {
    if (!dragId || !drop || drop.id === dragId) return;
    const s = useStore.getState();
    // Never drop a frame into its own subtree.
    if (pathTo(s.project.layers, drop.id).some((l) => l.id === dragId)) return;
    s.edit((p) => {
      const from = findSiblings(p.layers, dragId);
      if (!from) return;
      const [moved] = from.list.splice(from.index, 1);
      if (drop.where === 'inside') {
        const target = findLayer(p.layers, drop.id);
        target?.children?.push(moved);
        return;
      }
      const to = findSiblings(p.layers, drop.id);
      if (!to) return;
      // The list is painted bottom-up but shown top-down, so "before" in the panel is after in paint order.
      to.list.splice(drop.where === 'before' ? to.index + 1 : to.index, 0, moved);
    });
    setDrop(null);
    setDragId(null);
  };

  if (!layers.length) return <div className="empty-panel muted">No layers yet.</div>;
  return (
    <div className="layer-tree" onDragEnd={() => (setDrop(null), setDragId(null))}>
      {[...layers].reverse().map((l) => (
        <LayerRow key={l.id} layer={l} depth={0} drop={drop} setDrop={setDrop} setDragId={setDragId} onDrop={onDrop} />
      ))}
    </div>
  );
}

function LayerRow({
  layer: l,
  depth,
  drop,
  setDrop,
  setDragId,
  onDrop,
}: {
  layer: Layer;
  depth: number;
  drop: DropAt;
  setDrop: (d: DropAt) => void;
  setDragId: (id: string) => void;
  onDrop: () => void;
}) {
  const selected = useStore((s) => s.selection.includes(l.id));
  const hovered = useStore((s) => s.hover === l.id);
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const s = useStore.getState();
  const toggle = (patch: Partial<Layer>) => s.updateLayer(l.id, patch);
  const marker = drop?.id === l.id ? drop.where : null;
  return (
    <>
      <div
        className={`layer-row ${selected ? 'on' : ''} ${hovered ? 'hover' : ''} ${l.visible ? '' : 'hidden'} ${marker ? `drop-${marker}` : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          setDragId(l.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          const f = (e.clientY - r.top) / r.height;
          setDrop({ id: l.id, where: l.type === 'frame' && f > 0.3 && f < 0.7 ? 'inside' : f < 0.5 ? 'before' : 'after' });
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        onMouseEnter={() => s.setHover(l.id)}
        onMouseLeave={() => s.setHover(null)}
        onClick={(e) => {
          const cur = useStore.getState().selection;
          s.select(e.shiftKey ? (cur.includes(l.id) ? cur.filter((x) => x !== l.id) : [...cur, l.id]) : [l.id]);
        }}
        onDoubleClick={() => setRenaming(true)}
      >
        {l.children?.length ? (
          <button
            className="caret"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="caret" />
        )}
        <span className="glyph">{TYPE_GLYPH[l.type]}</span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={l.name}
            onBlur={(e) => {
              toggle({ name: e.target.value || l.name });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <span className="name">{l.name}</span>
        )}
        {l.anims.length > 0 && <span className="anim-dot" title={`${l.anims.length} animation(s)`} />}
        <span className="row-actions">
          <button title={l.locked ? 'Unlock' : 'Lock'} className={l.locked ? 'set' : ''} onClick={(e) => (e.stopPropagation(), toggle({ locked: !l.locked }))}>
            {l.locked ? '🔒' : '🔓'}
          </button>
          <button title={l.visible ? 'Hide' : 'Show'} className={!l.visible ? 'set' : ''} onClick={(e) => (e.stopPropagation(), toggle({ visible: !l.visible }))}>
            {l.visible ? '👁' : '—'}
          </button>
        </span>
      </div>
      {open &&
        [...(l.children ?? [])].reverse().map((c) => <LayerRow key={c.id} layer={c} depth={depth + 1} drop={drop} setDrop={setDrop} setDragId={setDragId} onDrop={onDrop} />)}
    </>
  );
}

/* ------------------------------------------------------------------ insert -- */

const TOOLS: { tool: Tool; label: string; key: string; glyph: string }[] = [
  { tool: 'frame', label: 'Frame', key: 'F', glyph: '#' },
  { tool: 'rect', label: 'Rectangle', key: 'R', glyph: '▢' },
  { tool: 'ellipse', label: 'Ellipse', key: 'O', glyph: '◯' },
  { tool: 'text', label: 'Text', key: 'T', glyph: 'T' },
];

/** Drops a fresh layer into the selected frame (or the stage), centred. */
export function insertLayer(layer: Layer) {
  const s = useStore.getState();
  const { project } = s;
  const sel = s.selection.length === 1 ? findLayer(project.layers, s.selection[0]) : null;
  const parent = sel?.type === 'frame' ? sel : null;
  const box = layoutTree([layer]).get(layer.id)!;
  const pb = parent ? layoutTree(project.layers) : null;
  if (parent && pb) {
    const b = pb.get(parent.id)!;
    layer.x = Math.round((b.w - box.w) / 2);
    layer.y = Math.round((b.h - box.h) / 2);
  } else {
    layer.x = Math.round((project.stage.width - box.w) / 2);
    layer.y = Math.round((project.stage.height - box.h) / 2);
  }
  s.edit((p) => {
    const target = parent ? findLayer(p.layers, parent.id) : null;
    (target?.children ?? p.layers).push(layer);
  });
  s.select([layer.id]);
}

function InsertPanel() {
  const tool = useStore((s) => s.tool);
  return (
    <div className="panel-scroll">
      <section className="section">
        <header>
          <h3>Draw</h3>
        </header>
        <div className="tool-grid">
          {TOOLS.map((t) => (
            <button key={t.tool} className={tool === t.tool ? 'on' : ''} onClick={() => useStore.getState().setTool(tool === t.tool ? 'move' : t.tool)} title={`${t.label} (${t.key})`}>
              <span className="glyph">{t.glyph}</span>
              {t.label}
              <kbd>{t.key}</kbd>
            </button>
          ))}
          <button onClick={() => insertLayer(makeLayer('icon', { w: 48, h: 48, name: 'Icon / sparkle' }))} title="Icon">
            <span className="glyph">✦</span>Icon
          </button>
          <label className="tool-like" title="Image (or drop one on the canvas)">
            <span className="glyph">▣</span>Image
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void addImageFile(e.target.files[0])} />
          </label>
        </div>
      </section>
      <section className="section">
        <header>
          <h3>Components</h3>
        </header>
        <p className="muted small">Built with auto layout — edit the text and they reflow. Inserted into the selected frame, if any.</p>
        <div className="component-grid">
          {COMPONENTS.map((c) => (
            <ComponentTile key={c.id} entry={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ComponentTile({ entry }: { entry: ComponentEntry }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    void componentThumb(entry.id, entry.make).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [entry]);
  return (
    <button className="component-tile" onClick={() => insertLayer(entry.make())}>
      <span className="thumb">{src && <img src={src} alt="" />}</span>
      <span>{entry.name}</span>
    </button>
  );
}

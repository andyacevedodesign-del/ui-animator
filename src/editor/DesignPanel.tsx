import type { Box } from '../engine/layout';
import { layoutTree, worldBoxes } from '../engine/layout';
import { ICON_NAMES, ICONS } from '../engine/icons';
import { defaultLayout, findLayer, findSiblings, type Layer, type Paint } from '../engine/model';
import { ColorField, NumberField, Row, Section, Segmented, Select, Slider, Toggle } from './fields';
import { useStore } from './store';
import { readFile } from './Viewport';

const WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra bold' },
];
const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Georgia', label: 'Georgia' },
];
const SHADOWS = {
  soft: { x: 0, y: 8, blur: 24, color: 'rgba(16,12,40,0.14)' },
  medium: { x: 0, y: 16, blur: 40, color: 'rgba(16,12,40,0.22)' },
  deep: { x: 0, y: 30, blur: 80, color: 'rgba(0,0,0,0.45)' },
};

export function DesignPanel() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const layers = selection.map((id) => findLayer(project.layers, id)).filter((l): l is Layer => !!l);

  if (!layers.length) {
    return (
      <div className="empty-panel">
        <p>Select a layer to edit it.</p>
        <p className="muted">Draw with F (frame), R (rectangle), O (ellipse), T (text), or insert a ready-made component from the left.</p>
      </div>
    );
  }
  if (layers.length > 1) {
    return (
      <div className="panel-scroll">
        <Section title={`${layers.length} layers`}>
          <AlignBar ids={selection} />
        </Section>
      </div>
    );
  }
  return <LayerInspector layer={layers[0]} />;
}

function AlignBar({ ids }: { ids: string[] }) {
  const align = (how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => {
    const s = useStore.getState();
    const world = worldBoxes(s.project.layers, layoutTree(s.project.layers));
    const boxes = ids.map((id) => world.get(id)).filter((b): b is Box => !!b);
    if (!boxes.length) return;
    // One layer aligns to the stage, several to each other.
    const ref: Box =
      boxes.length === 1
        ? { x: 0, y: 0, w: s.project.stage.width, h: s.project.stage.height }
        : (() => {
            const x0 = Math.min(...boxes.map((b) => b.x));
            const y0 = Math.min(...boxes.map((b) => b.y));
            return { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 };
          })();
    s.edit((p) => {
      for (const id of ids) {
        const l = findLayer(p.layers, id);
        const b = world.get(id);
        if (!l || !b) continue;
        if (how === 'l') l.x += ref.x - b.x;
        if (how === 'c') l.x += Math.round(ref.x + ref.w / 2 - (b.x + b.w / 2));
        if (how === 'r') l.x += ref.x + ref.w - (b.x + b.w);
        if (how === 't') l.y += ref.y - b.y;
        if (how === 'm') l.y += Math.round(ref.y + ref.h / 2 - (b.y + b.h / 2));
        if (how === 'b') l.y += ref.y + ref.h - (b.y + b.h);
      }
    });
  };
  const btn = (how: 'l' | 'c' | 'r' | 't' | 'm' | 'b', title: string, d: string) => (
    <button className="icon-btn" title={title} onClick={() => align(how)}>
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      </svg>
    </button>
  );
  return (
    <div className="align-bar">
      {btn('l', 'Align left', 'M2 1v14M5 4h8v3H5zM5 9h5v3H5z')}
      {btn('c', 'Align centre', 'M8 1v14M3 4h10v3H3zM5 9h6v3H5z')}
      {btn('r', 'Align right', 'M14 1v14M3 4h8v3H3zM6 9h5v3H6z')}
      {btn('t', 'Align top', 'M1 2h14M4 5v8h3V5zM9 5v5h3V5z')}
      {btn('m', 'Align middle', 'M1 8h14M4 3v10h3V3zM9 5v6h3V5z')}
      {btn('b', 'Align bottom', 'M1 14h14M4 3v8h3V3zM9 6v5h3V6z')}
    </div>
  );
}

function PaintEditor({ paint, onChange, allowNone = true }: { paint: Paint | null; onChange: (p: Paint | null) => void; allowNone?: boolean }) {
  const kind = paint ? paint.type : 'none';
  const base = paint?.type === 'solid' ? paint.color : paint ? paint.from : '#7c3aed';
  const end = paint && paint.type !== 'solid' ? paint.to : '#22d3ee';
  return (
    <>
      <Segmented
        value={kind}
        options={[
          ...(allowNone ? [{ value: 'none' as const, label: 'None' }] : []),
          { value: 'solid' as const, label: 'Solid' },
          { value: 'linear' as const, label: 'Linear' },
          { value: 'radial' as const, label: 'Radial' },
        ]}
        onChange={(k) =>
          onChange(
            k === 'none'
              ? null
              : k === 'solid'
                ? { type: 'solid', color: base }
                : k === 'linear'
                  ? { type: 'linear', from: base, to: end, angle: 135 }
                  : { type: 'radial', from: base, to: end },
          )
        }
      />
      {paint?.type === 'solid' && <ColorField value={paint.color} onChange={(color) => onChange({ type: 'solid', color })} />}
      {paint?.type === 'linear' && (
        <>
          <div className="pair">
            <ColorField value={paint.from} onChange={(from) => onChange({ ...paint, from })} />
            <ColorField value={paint.to} onChange={(to) => onChange({ ...paint, to })} />
          </div>
          <Row label="Angle">
            <Slider value={paint.angle} min={0} max={360} step={1} onChange={(angle) => onChange({ ...paint, angle })} />
          </Row>
        </>
      )}
      {paint?.type === 'radial' && (
        <>
          <div className="pair">
            <ColorField value={paint.from} onChange={(from) => onChange({ ...paint, from })} />
            <ColorField value={paint.to} onChange={(to) => onChange({ ...paint, to })} />
          </div>
          <p className="muted small">Centre → edge. Use an edge colour with 0 alpha (e.g. rgba(255,180,220,0)) for a soft glow.</p>
        </>
      )}
    </>
  );
}

function LayerInspector({ layer: l }: { layer: Layer }) {
  const project = useStore((s) => s.project);
  const update = (patch: Partial<Layer> | ((l: Layer) => void), key?: string) => useStore.getState().updateLayer(l.id, patch, key ?? `${l.id}-${Object.keys(patch)[0] ?? 'fn'}`);
  const sib = findSiblings(project.layers, l.id);
  const inLayout = !!sib?.parent?.layout && sib.parent.layout.mode !== 'none';
  const topLevel = !sib?.parent;
  const box = layoutTree(project.layers);
  const size = (() => {
    // Measured size for text and hugging frames.
    const all = worldBoxes(project.layers, box);
    return all.get(l.id) ?? { w: l.w, h: l.h };
  })();
  const lay = l.layout ?? defaultLayout();

  return (
    <div className="panel-scroll">
      <Section title={l.type === 'frame' ? 'Frame' : l.type[0].toUpperCase() + l.type.slice(1)}>
        <input className="name-input" value={l.name} onChange={(e) => update({ name: e.target.value }, `${l.id}-name`)} />
        <AlignBar ids={[l.id]} />
        <div className="grid4">
          <NumberField label="X" value={l.x} onChange={(x) => update({ x })} />
          <NumberField label="Y" value={l.y} onChange={(y) => update({ y })} />
          <NumberField label="W" value={Math.round(size.w)} min={1} onChange={(w) => update((d) => ((d.w = w), d.type === 'text' && d.sizing === 'auto-width' && (d.sizing = 'auto-height'), d.layout && (d.layout.hug = false)), `${l.id}-w`)} />
          <NumberField label="H" value={Math.round(size.h)} min={1} onChange={(h) => update((d) => ((d.h = h), d.type === 'text' && (d.sizing = 'fixed'), d.layout && (d.layout.hug = false)), `${l.id}-h`)} />
          <NumberField label="↻" value={l.rotation} suffix="°" onChange={(rotation) => update({ rotation })} />
          {l.type !== 'text' && l.type !== 'icon' && <NumberField label="◜" value={l.radius} min={0} onChange={(radius) => update({ radius })} />}
        </div>
        {inLayout && <p className="muted small">Positioned by the parent’s auto layout. Drag to reorder.</p>}
        <Row label="Opacity">
          <Slider value={l.opacity} min={0} max={1} step={0.01} onChange={(opacity) => update({ opacity })} />
        </Row>
        <Row label="Layer blur" hint="An even Gaussian blur on this layer, in stage pixels — like Figma’s layer blur.">
          <Slider value={l.blur ?? 0} min={0} max={200} step={1} onChange={(blur) => update({ blur })} />
        </Row>
        {topLevel && (
          <Row label="3D lift" hint="Distance toward the camera in 3D shots. Lifted layers separate from the page when the camera tilts.">
            <Slider value={l.depth} min={0} max={400} step={5} onChange={(depth) => update({ depth })} />
          </Row>
        )}
      </Section>

      {l.type === 'frame' && (
        <Section title="Auto layout">
          <Segmented
            value={lay.mode}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'row', label: '→ Row' },
              { value: 'column', label: '↓ Column' },
            ]}
            onChange={(mode) => update((d) => void (d.layout = { ...(d.layout ?? defaultLayout()), mode }))}
          />
          {lay.mode !== 'none' && (
            <>
              <div className="grid4">
                <NumberField label="Gap" value={lay.gap} onChange={(gap) => update((d) => void (d.layout = { ...lay, gap }), `${l.id}-gap`)} />
                <NumberField label="Pad" value={lay.padding} min={0} onChange={(padding) => update((d) => void (d.layout = { ...lay, padding }), `${l.id}-pad`)} />
              </div>
              <Row label="Align">
                <Segmented
                  value={lay.align}
                  options={[
                    { value: 'start', label: 'Start' },
                    { value: 'center', label: 'Centre' },
                    { value: 'end', label: 'End' },
                  ]}
                  onChange={(align) => update((d) => void (d.layout = { ...lay, align }))}
                />
              </Row>
              {!lay.hug && (
                <Row label="Justify">
                  <Select
                    value={lay.justify}
                    options={[
                      { value: 'start', label: 'Start' },
                      { value: 'center', label: 'Centre' },
                      { value: 'end', label: 'End' },
                      { value: 'between', label: 'Space between' },
                    ]}
                    onChange={(justify) => update((d) => void (d.layout = { ...lay, justify }))}
                  />
                </Row>
              )}
              <Toggle label="Hug contents" value={lay.hug} onChange={(hug) => update((d) => void (d.layout = { ...lay, hug }))} />
            </>
          )}
          <Toggle label="Clip content" value={!!l.clip} onChange={(clip) => update({ clip })} />
        </Section>
      )}

      {l.type === 'text' && (
        <Section title="Text">
          <textarea className="text-area" value={l.text} rows={3} onChange={(e) => update({ text: e.target.value }, `${l.id}-text`)} />
          <div className="pair">
            <Select value={l.fontFamily ?? 'Inter'} options={FONTS} onChange={(fontFamily) => update({ fontFamily })} />
            <Select value={String(l.fontWeight ?? 400)} options={WEIGHTS} onChange={(w) => update({ fontWeight: Number(w) })} />
          </div>
          <div className="grid4">
            <NumberField label="Size" value={l.fontSize ?? 16} min={1} onChange={(fontSize) => update({ fontSize })} />
            <NumberField label="Line" value={l.lineHeight ?? 1.3} step={0.05} min={0.5} onChange={(lineHeight) => update({ lineHeight })} />
            <NumberField label="Track" value={l.letterSpacing ?? 0} step={0.1} onChange={(letterSpacing) => update({ letterSpacing })} />
          </div>
          <Row label="Align">
            <Segmented
              value={l.align ?? 'left'}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(align) => update({ align })}
            />
          </Row>
          <Row label="Resize">
            <Segmented
              value={l.sizing ?? 'auto-width'}
              options={[
                { value: 'auto-width', label: 'Auto W', title: 'Grow sideways' },
                { value: 'auto-height', label: 'Auto H', title: 'Fixed width, wrap lines' },
                { value: 'fixed', label: 'Fixed' },
              ]}
              onChange={(sizing) => update((d) => ((d.sizing = sizing), (d.w = Math.round(size.w)), (d.h = Math.round(size.h))))}
            />
          </Row>
          <Row label="Colour">
            <ColorField value={l.color ?? '#000000'} onChange={(color) => update({ color, fill: null }, `${l.id}-color`)} />
          </Row>
          <Row label="Gradient">
            <Toggle
              value={!!l.fill}
              onChange={(on) => update({ fill: on ? { type: 'linear', from: '#a78bfa', to: '#22d3ee', angle: 90 } : null })}
            />
          </Row>
          {l.fill && <PaintEditor paint={l.fill} allowNone={false} onChange={(fill) => update({ fill }, `${l.id}-fill`)} />}
        </Section>
      )}

      {l.type === 'icon' && (
        <Section title="Icon">
          <div className="icon-grid">
            {ICON_NAMES.map((name) => (
              <button key={name} className={name === l.icon ? 'on' : ''} title={name} onClick={() => update({ icon: name, name: `Icon / ${name}` })}>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
          <Row label="Colour">
            <ColorField value={l.color ?? '#000000'} onChange={(color) => update({ color }, `${l.id}-color`)} />
          </Row>
          <Row label="Stroke">
            <Slider value={l.strokeWidth ?? 2} min={0} max={4} step={0.1} onChange={(strokeWidth) => update({ strokeWidth })} />
          </Row>
          <Row label="Fill">
            <PaintEditor paint={l.fill} onChange={(fill) => update({ fill }, `${l.id}-fill`)} />
          </Row>
        </Section>
      )}

      {l.type === 'image' && (
        <Section title="Image">
          <Row label="Fit">
            <Segmented
              value={l.fit ?? 'cover'}
              options={[
                { value: 'cover', label: 'Fill' },
                { value: 'contain', label: 'Fit' },
              ]}
              onChange={(fit) => update({ fit })}
            />
          </Row>
          <label className="btn wide">
            Replace image…
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await readFile(file);
                const id = `img${Date.now().toString(36)}`;
                useStore.getState().edit((p) => {
                  p.assets[id] = url;
                  const d = findLayer(p.layers, l.id);
                  if (d) d.src = `asset:${id}`;
                });
              }}
            />
          </label>
        </Section>
      )}

      {l.type === 'star' && (
        <Section title="Sparkle">
          <Row label="Points">
            <Segmented
              value={String(l.points ?? 4)}
              options={['4', '5', '6', '8', '12'].map((v) => ({ value: v, label: v }))}
              onChange={(v) => update({ points: Number(v) })}
            />
          </Row>
          <Row label="Body" hint="0 gives needle-thin concave rays, higher values a fuller star">
            <Slider value={l.inner ?? 0.15} min={0} max={1} step={0.01} onChange={(inner) => update({ inner })} />
          </Row>
        </Section>
      )}

      {l.type !== 'text' && l.type !== 'icon' && (
        <Section title="Fill">
          <PaintEditor paint={l.fill} onChange={(fill) => update({ fill }, `${l.id}-fill`)} />
        </Section>
      )}

      {l.type !== 'text' && l.type !== 'icon' && (
        <Section title="Stroke" action={<Toggle value={!!l.stroke} onChange={(on) => update({ stroke: on ? { color: '#e3e3ea', width: 1 } : null })} />}>
          {l.stroke && (
            <div className="pair">
              <ColorField value={l.stroke.color} onChange={(color) => update({ stroke: { ...l.stroke!, color } }, `${l.id}-stroke`)} />
              <NumberField label="W" value={l.stroke.width} min={0} step={0.5} onChange={(width) => update({ stroke: { ...l.stroke!, width } }, `${l.id}-strokew`)} />
            </div>
          )}
        </Section>
      )}

      <Section title="Shadow" action={<Toggle value={!!l.shadow} onChange={(on) => update({ shadow: on ? { ...SHADOWS.medium } : null })} />}>
        {l.shadow && (
          <>
            <Segmented
              value={(Object.keys(SHADOWS) as (keyof typeof SHADOWS)[]).find((k) => JSON.stringify(SHADOWS[k]) === JSON.stringify(l.shadow)) ?? ('custom' as never)}
              options={[
                { value: 'soft', label: 'Soft' },
                { value: 'medium', label: 'Medium' },
                { value: 'deep', label: 'Deep' },
              ]}
              onChange={(k) => update({ shadow: { ...SHADOWS[k] } })}
            />
            <div className="grid4">
              <NumberField label="X" value={l.shadow.x} onChange={(x) => update({ shadow: { ...l.shadow!, x } }, `${l.id}-sx`)} />
              <NumberField label="Y" value={l.shadow.y} onChange={(y) => update({ shadow: { ...l.shadow!, y } }, `${l.id}-sy`)} />
              <NumberField label="Blur" value={l.shadow.blur} min={0} onChange={(blur) => update({ shadow: { ...l.shadow!, blur } }, `${l.id}-sb`)} />
            </div>
            <ColorField value={l.shadow.color} onChange={(color) => update({ shadow: { ...l.shadow!, color } }, `${l.id}-sc`)} />
          </>
        )}
      </Section>
    </div>
  );
}

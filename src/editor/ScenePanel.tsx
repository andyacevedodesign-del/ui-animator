import { useEffect, useState } from 'react';
import { defaultParams, loadEffect, paramVisible, type EffectMeta, type ParamDef } from '../engine/backgrounds';
import { findLayer, uid, type CameraPreset, type CursorStep } from '../engine/model';
import { BACKGROUND_PRESETS, type BackgroundPreset } from '../library/backgrounds';
import { ColorField, NumberField, Row, Section, Segmented, Select, Slider, Toggle } from './fields';
import { useStore } from './store';
import { backgroundThumb } from './thumbnails';

const SIZES = [
  { label: '16:9', w: 1920, h: 1080 },
  { label: '1:1', w: 1080, h: 1080 },
  { label: '4:5', w: 1080, h: 1350 },
  { label: '9:16', w: 1080, h: 1920 },
  { label: '4:3', w: 1600, h: 1200 },
];

const CAMERAS: { id: CameraPreset; name: string; hint: string }[] = [
  { id: 'static', name: 'Static', hint: 'Flat, no camera motion' },
  { id: 'tilt-reveal', name: 'Tilt reveal', hint: 'Starts laid back in 3D and settles flat' },
  { id: 'push-in', name: 'Push in', hint: 'Slow zoom towards the UI' },
  { id: 'pull-out', name: 'Pull out', hint: 'Starts close and eases back' },
  { id: 'float', name: 'Float', hint: 'Gentle 3D drift, loops' },
  { id: 'orbit', name: 'Orbit', hint: 'Swings side to side in 3D, loops' },
  { id: 'isometric', name: 'Isometric', hint: 'Exploded 3D showcase — use 3D lift on layers' },
  { id: 'focus', name: 'Focus', hint: 'Zooms into one layer' },
];

export function ScenePanel() {
  const project = useStore((s) => s.project);
  const edit = useStore((s) => s.edit);
  const { stage, background, camera } = project;

  return (
    <div className="panel-scroll">
      <Section title="Canvas">
        <div className="size-grid">
          {SIZES.map((s) => (
            <button
              key={s.label}
              className={s.w === stage.width && s.h === stage.height ? 'on' : ''}
              onClick={() => {
                edit((p) => {
                  // Keep the layout centred on the new canvas.
                  const dx = (s.w - p.stage.width) / 2;
                  const dy = (s.h - p.stage.height) / 2;
                  for (const l of p.layers) {
                    l.x = Math.round(l.x + dx);
                    l.y = Math.round(l.y + dy);
                  }
                  p.cursor.start = { x: p.cursor.start.x + dx, y: p.cursor.start.y + dy };
                  p.stage.width = s.w;
                  p.stage.height = s.h;
                });
                useStore.getState().requestFit();
              }}
            >
              <span className="ratio" style={{ aspectRatio: `${s.w} / ${s.h}` }} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid4">
          <NumberField label="W" value={stage.width} min={64} max={3840} onChange={(width) => edit((p) => void (p.stage.width = width), 'stage-w')} />
          <NumberField label="H" value={stage.height} min={64} max={3840} onChange={(height) => edit((p) => void (p.stage.height = height), 'stage-h')} />
          <NumberField label="Len" value={stage.duration} min={0.5} max={60} step={0.5} suffix="s" onChange={(duration) => edit((p) => void (p.stage.duration = duration), 'stage-d')} />
          <NumberField label="FPS" value={stage.fps} min={12} max={60} onChange={(fps) => edit((p) => void (p.stage.fps = fps), 'stage-fps')} />
        </div>
      </Section>

      <Section title="Background">
        <div className="bg-grid">
          {BACKGROUND_PRESETS.map((b) => (
            <BackgroundTile key={b.id} preset={b} active={isActive(b, background)} />
          ))}
        </div>
        {!background.effect && (
          <Row label="Colour">
            <ColorField value={background.color} onChange={(color) => edit((p) => void (p.background.color = color), 'bg-color')} />
          </Row>
        )}
        {background.effect && (
          <>
            <Row label="Speed" hint="Multiplies how fast the background moves. Whole numbers (and 0) loop seamlessly with the timeline.">
              <Slider value={background.speed ?? 1} min={0} max={4} step={0.05} onChange={(speed) => edit((p) => void (p.background.speed = speed), 'bg-speed')} />
            </Row>
            <div className="speed-presets">
              {[0, 0.5, 1, 2, 3].map((v) => (
                <button key={v} className={(background.speed ?? 1) === v ? 'on' : ''} onClick={() => edit((p) => void (p.background.speed = v))}>
                  {v === 0 ? 'Freeze' : `${v}×`}
                </button>
              ))}
            </div>
            {!Number.isInteger(background.speed ?? 1) && (
              <p className="muted small">At {background.speed}× the background won’t line up when the video loops. Use a whole number for a seamless loop.</p>
            )}
            <EffectParams effect={background.effect} params={background.params} />
          </>
        )}
      </Section>

      <Section title="Camera">
        <div className="camera-grid">
          {CAMERAS.map((c) => (
            <button key={c.id} title={c.hint} className={camera.preset === c.id ? 'on' : ''} onClick={() => edit((p) => void (p.camera.preset = c.id))}>
              <CameraGlyph id={c.id} />
              {c.name}
            </button>
          ))}
        </div>
        <p className="muted small">{CAMERAS.find((c) => c.id === camera.preset)?.hint}</p>
        {camera.preset !== 'static' && camera.preset !== 'focus' && (
          <Row label="Intensity">
            <Slider value={camera.intensity} min={0} max={2} step={0.05} onChange={(intensity) => edit((p) => void (p.camera.intensity = intensity), 'cam-i')} />
          </Row>
        )}
        {camera.preset === 'focus' && (
          <>
            <Row label="Target">
              <PickButton value={camera.target} onPick={(id) => edit((p) => void (p.camera.target = id))} />
            </Row>
            <div className="grid4">
              <NumberField label="At" value={camera.at} min={0} step={0.1} suffix="s" onChange={(at) => edit((p) => void (p.camera.at = at), 'cam-at')} />
              <NumberField label="Len" value={camera.duration} min={0.1} step={0.1} suffix="s" onChange={(duration) => edit((p) => void (p.camera.duration = duration), 'cam-d')} />
              <NumberField label="Zoom" value={camera.zoom} min={1} max={6} step={0.1} suffix="×" onChange={(zoom) => edit((p) => void (p.camera.zoom = zoom), 'cam-z')} />
            </div>
          </>
        )}
      </Section>

    </div>
  );
}

export function CursorPanel() {
  const project = useStore((s) => s.project);
  const edit = useStore((s) => s.edit);
  const { cursor } = project;
  return (
    <div className="panel-scroll">
      <Section title="Cursor" action={<Toggle value={cursor.enabled} onChange={(enabled) => edit((p) => void (p.cursor.enabled = enabled))} />}>
        {!cursor.enabled && (
          <>
            <p className="muted small">
              A scripted pointer that glides to layers and clicks them. Clicked layers press in, and a ripple plays — handy for showing how a feature is used.
            </p>
            <button className="btn primary wide" onClick={() => edit((p) => void (p.cursor.enabled = true))}>
              Turn on cursor
            </button>
          </>
        )}
        {cursor.enabled && (
          <>
            <Row label="Style">
              <Segmented
                value={cursor.style}
                options={[
                  { value: 'arrow', label: 'Pointer' },
                  { value: 'touch', label: 'Touch' },
                ]}
                onChange={(style) => edit((p) => void (p.cursor.style = style))}
              />
            </Row>
            <Row label="Size">
              <Slider value={cursor.size} min={0.5} max={3} step={0.05} onChange={(size) => edit((p) => void (p.cursor.size = size), 'cur-size')} />
            </Row>
            <div className="grid4">
              <NumberField label="X₀" value={cursor.start.x} onChange={(x) => edit((p) => void (p.cursor.start.x = x), 'cur-x')} />
              <NumberField label="Y₀" value={cursor.start.y} onChange={(y) => edit((p) => void (p.cursor.start.y = y), 'cur-y')} />
            </div>
            {[...cursor.steps]
              .sort((a, b) => a.at - b.at)
              .map((step) => (
                <CursorStepRow key={step.id} step={step} />
              ))}
            <button
              className="btn wide"
              onClick={() => {
                const t = useStore.getState().time;
                edit((p) => {
                  const last = [...p.cursor.steps].sort((a, b) => a.at - b.at).at(-1);
                  const at = Math.round(Math.max(t, last ? last.at + 1 : 1) * 100) / 100;
                  const step: CursorStep = { id: uid('c'), at, target: null, x: p.stage.width / 2, y: p.stage.height / 2, click: true };
                  p.cursor.steps.push(step);
                });
              }}
            >
              + Add cursor move
            </button>
            <p className="muted small">Each move travels to a layer (or a point) and can click it — the target presses in response.</p>
          </>
        )}
      </Section>
      </div>
  );
}

function CursorStepRow({ step }: { step: CursorStep }) {
  const project = useStore((s) => s.project);
  const edit = useStore((s) => s.edit);
  const set = (patch: Partial<CursorStep>, key?: string) =>
    edit((p) => {
      const s = p.cursor.steps.find((x) => x.id === step.id);
      if (s) Object.assign(s, patch);
    }, key);
  return (
    <div className="step-row">
      <NumberField label="At" value={step.at} min={0} step={0.05} suffix="s" onChange={(at) => set({ at }, `${step.id}-at`)} width={88} />
      <PickButton value={step.target} onPick={(target) => set({ target })} />
      {!step.target && (
        <>
          <NumberField label="X" value={step.x} onChange={(x) => set({ x }, `${step.id}-x`)} width={70} />
          <NumberField label="Y" value={step.y} onChange={(y) => set({ y }, `${step.id}-y`)} width={70} />
        </>
      )}
      <Toggle label="Click" value={step.click} onChange={(click) => set({ click })} />
      <button className="icon-btn" title="Remove" onClick={() => edit((p) => void (p.cursor.steps = p.cursor.steps.filter((s) => s.id !== step.id)))}>
        ✕
      </button>
      {step.target && !findLayer(project.layers, step.target) && <span className="muted small">missing layer</span>}
    </div>
  );
}

function PickButton({ value, onPick }: { value: string | null; onPick: (id: string | null) => void }) {
  const project = useStore((s) => s.project);
  const picking = useStore((s) => s.picking);
  const layer = value ? findLayer(project.layers, value) : null;
  return (
    <div className="pick">
      <button
        className={`btn ${picking ? 'on' : ''}`}
        title="Pick a layer on the canvas"
        onClick={() => {
          const s = useStore.getState();
          s.setPicking(s.picking ? null : (id) => onPick(id));
        }}
      >
        🎯 {layer ? layer.name : 'Pick layer'}
      </button>
      {layer && (
        <button className="icon-btn" title="Clear" onClick={() => onPick(null)}>
          ✕
        </button>
      )}
    </div>
  );
}

function isActive(b: BackgroundPreset, bg: { effect: string | null; params: Record<string, unknown>; color: string }) {
  if (b.effect !== bg.effect) return false;
  if (!b.effect) return b.color === bg.color;
  return Object.entries(b.params).every(([k, v]) => bg.params[k] === v);
}

function BackgroundTile({ preset, active }: { preset: BackgroundPreset; active: boolean }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    void backgroundThumb(preset).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [preset]);
  return (
    <button
      className={`bg-tile ${active ? 'on' : ''}`}
      onClick={() =>
        useStore.getState().edit((p) => {
          p.background = { ...p.background, effect: preset.effect, params: { ...preset.params }, color: preset.color ?? p.background.color };
        })
      }
    >
      <span className="thumb" style={{ background: preset.effect ? `#111 url(${src}) center/cover` : preset.color }} />
      <span className="bg-name">{preset.name}</span>
    </button>
  );
}

function EffectParams({ effect, params }: { effect: string; params: Record<string, unknown> }) {
  const [meta, setMeta] = useState<EffectMeta | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void loadEffect(effect).then((m) => live && setMeta(m.meta));
    return () => {
      live = false;
    };
  }, [effect]);
  if (!meta) return null;
  const values = { ...defaultParams(meta), ...params };
  const set = (key: string, value: unknown) => useStore.getState().edit((p) => void (p.background.params = { ...p.background.params, [key]: value }), `bg-${key}`);
  const shown = meta.params.filter((d) => d.type !== 'points' && d.key !== 'transparent' && paramVisible(d.showWhen, values));
  const groups = [...new Set(shown.map((d) => d.group))];
  return (
    <div className="effect-params">
      <button className="disclosure" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {meta.name} settings
      </button>
      {open && (
        <>
          <p className="muted small">{meta.tagline}</p>
          {groups.map((g) => (
            <div key={g} className="param-group">
              <h4>{g}</h4>
              {shown
                .filter((d) => d.group === g)
                .map((d) => (
                  <ParamControl key={d.key} def={d} value={values[d.key]} onChange={(v) => set(d.key, v)} />
                ))}
            </div>
          ))}
          <button className="btn wide" onClick={() => useStore.getState().edit((p) => void (p.background.params = {}))}>
            Reset to defaults
          </button>
        </>
      )}
    </div>
  );
}

function ParamControl({ def, value, onChange }: { def: ParamDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (def.type) {
    case 'range':
      return (
        <Row label={def.label} hint={def.hint}>
          <Slider value={Number(value)} min={def.min} max={def.max} step={def.step} onChange={onChange} />
        </Row>
      );
    case 'color':
      return (
        <Row label={def.label}>
          <ColorField value={String(value)} onChange={onChange} />
        </Row>
      );
    case 'toggle':
      return (
        <Row label={def.label}>
          <Toggle value={!!value} onChange={onChange} />
        </Row>
      );
    case 'select':
      return (
        <Row label={def.label}>
          <Select value={String(value)} options={def.options} onChange={onChange} />
        </Row>
      );
    default:
      return null;
  }
}

function CameraGlyph({ id }: { id: CameraPreset }) {
  const t: Record<CameraPreset, string> = {
    static: 'perspective(60px)',
    'tilt-reveal': 'perspective(60px) rotateX(40deg)',
    'push-in': 'perspective(60px) scale(1.2)',
    'pull-out': 'perspective(60px) scale(0.75)',
    float: 'perspective(60px) rotateY(18deg) rotateX(8deg)',
    orbit: 'perspective(60px) rotateY(-28deg)',
    isometric: 'perspective(120px) rotateX(50deg) rotateZ(-35deg)',
    focus: 'perspective(60px) scale(1.5) translate(4px, 3px)',
  };
  return (
    <span className="cam-glyph">
      <span style={{ transform: t[id] }} />
    </span>
  );
}

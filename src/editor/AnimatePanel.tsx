import { EASES } from '../engine/ease';
import { findLayer, makeAnim, type Anim, type Layer } from '../engine/model';
import { KIND_LABEL, presetById, presetsFor, type PresetKind } from '../engine/presets';
import { NumberField, Row, Section, Select, Slider } from './fields';
import { useStore } from './store';

interface Recipe {
  name: string;
  hint: string;
  when?: (l: Layer) => boolean;
  anims: (l: Layer, t: number, end: number) => Anim[];
}

const RECIPES: Recipe[] = [
  { name: 'Rise in', hint: 'Fade up into place', anims: (_l, t) => [makeAnim('rise-in', { at: t, duration: 0.7 })] },
  { name: 'Pop + glint', hint: 'Overshoot in, then a light sweep', anims: (_l, t) => [makeAnim('pop-in', { at: t, duration: 0.55, ease: 'back.out(2.2)' }), makeAnim('sheen', { at: t + 0.7, duration: 0.9, ease: 'power2.inOut' })] },
  {
    name: 'Stagger children',
    hint: 'Each child rises in turn',
    when: (l) => !!l.children?.length,
    anims: (_l, t) => [makeAnim('rise-in', { at: t, duration: 0.6, stagger: 0.1 })],
  },
  { name: 'Typewriter', hint: 'Types out with a caret', when: (l) => l.type === 'text', anims: (l, t) => [makeAnim('type-in', { at: t, duration: Math.max(0.6, (l.text?.length ?? 20) * 0.035), ease: 'none' })] },
  { name: 'Count up', hint: 'Numbers count from zero', when: (l) => l.type === 'text' && /\d/.test(l.text ?? ''), anims: (_l, t) => [makeAnim('count-in', { at: t, duration: 1.4, ease: 'power3.out' })] },
  { name: 'Blur reveal', hint: 'Out of focus into focus', anims: (_l, t) => [makeAnim('blur-in', { at: t, duration: 0.9, ease: 'power2.out' })] },
  { name: 'Hover float', hint: 'Gentle loop that never ends', anims: (_l, t) => [makeAnim('float', { at: t, duration: 3, ease: 'none' })] },
  { name: 'In & out', hint: 'Slides in, leaves at the end', anims: (_l, t, end) => [makeAnim('slide-left-in', { at: t, duration: 0.8, ease: 'expo.out' }), makeAnim('fade-out', { at: Math.max(t + 1, end - 0.6), duration: 0.45, ease: 'power2.in' })] },
];

const KINDS: PresetKind[] = ['in', 'emphasis', 'loop', 'out'];

export function AnimatePanel() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const selectedAnim = useStore((s) => s.selectedAnim);
  const time = useStore((s) => s.time);
  const layer = selection.length === 1 ? findLayer(project.layers, selection[0]) : null;

  if (!layer) {
    return (
      <div className="empty-panel">
        <p>Select a layer to animate it.</p>
        <p className="muted">Every animation is a preset placed on the timeline. Stage-wide motion — camera moves and the cursor — lives in the Scene tab.</p>
      </div>
    );
  }

  const add = (preset: string) => useStore.getState().addAnim(layer.id, preset);
  const applyRecipe = (r: Recipe) => {
    const anims = r.anims(layer, Math.round(time * 100) / 100, project.stage.duration);
    useStore.getState().edit((p) => findLayer(p.layers, layer.id)?.anims.push(...anims));
    useStore.getState().selectAnim(anims[0].id);
  };
  const presets = presetsFor(layer);

  return (
    <div className="panel-scroll">
      <Section title="Recipes">
        <div className="recipe-grid">
          {RECIPES.filter((r) => !r.when || r.when(layer)).map((r) => (
            <button key={r.name} className="recipe" title={r.hint} onClick={() => applyRecipe(r)}>
              <strong>{r.name}</strong>
              <span>{r.hint}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Recipes start at the playhead ({time.toFixed(2)}s).</p>
      </Section>

      <Section title={`Animations on “${layer.name}”`}>
        {!layer.anims.length && <p className="muted small">None yet — pick a recipe or a preset below.</p>}
        {layer.anims.map((a) => (
          <AnimCard key={a.id} layer={layer} anim={a} open={a.id === selectedAnim} />
        ))}
      </Section>

      {KINDS.map((kind) => (
        <Section key={kind} title={KIND_LABEL[kind]}>
          <div className="chip-grid">
            {presets
              .filter((p) => p.kind === kind)
              .map((p) => (
                <button key={p.id} className={`chip kind-${kind}`} onClick={() => add(p.id)}>
                  {p.label}
                </button>
              ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

function AnimCard({ layer, anim: a, open }: { layer: Layer; anim: Anim; open: boolean }) {
  const s = useStore.getState();
  const preset = presetById(a.preset);
  const kind = preset?.kind ?? 'in';
  const set = (patch: Partial<Anim>) => s.updateAnim(layer.id, a.id, patch, `${a.id}-${Object.keys(patch)[0]}`);
  const options = presetsFor(layer)
    .filter((p) => p.kind === kind)
    .map((p) => ({ value: p.id, label: p.label }));
  return (
    <div className={`anim-card kind-${kind} ${open ? 'open' : ''}`}>
      <header onClick={() => s.selectAnim(open ? null : a.id)}>
        <span className="dot" />
        <strong>{preset?.label ?? a.preset}</strong>
        <span className="muted small">
          {a.at.toFixed(2)}s · {kind === 'loop' ? `every ${a.duration}s` : `${a.duration}s`}
          {a.stagger > 0 ? ` · stagger ${a.stagger}s` : ''}
        </span>
        <button
          className="icon-btn"
          title="Preview from here"
          onClick={(e) => {
            e.stopPropagation();
            s.setTime(Math.max(0, a.at - 0.3));
            s.setPlaying(true);
          }}
        >
          ▶
        </button>
        <button
          className="icon-btn"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            s.removeAnim(layer.id, a.id);
          }}
        >
          ✕
        </button>
      </header>
      {open && (
        <div className="anim-body">
          <Row label="Preset">
            <Select
              value={a.preset}
              options={options}
              onChange={(preset) => {
                const p = presetById(preset)!;
                s.updateAnim(layer.id, a.id, { preset, ease: p.ease, duration: p.duration });
              }}
            />
          </Row>
          <div className="grid4">
            <NumberField label="Start" value={a.at} step={0.05} min={0} suffix="s" onChange={(at) => set({ at })} />
            <NumberField label={kind === 'loop' ? 'Period' : 'Length'} value={a.duration} step={0.05} min={0.05} suffix="s" onChange={(duration) => set({ duration })} />
          </div>
          {kind !== 'loop' && (
            <Row label="Ease">
              <Select value={a.ease} options={EASES.some((e) => e.value === a.ease) ? EASES : [{ value: a.ease, label: a.ease }, ...EASES]} onChange={(ease) => set({ ease })} />
            </Row>
          )}
          <Row label="Strength">
            <Slider value={a.amount} min={0} max={3} step={0.05} onChange={(amount) => set({ amount })} />
          </Row>
          {!!layer.children?.length && (
            <Row label="Stagger" hint="Run on each child in turn instead of the frame itself">
              <Slider value={a.stagger} min={0} max={0.5} step={0.01} onChange={(stagger) => set({ stagger })} />
            </Row>
          )}
        </div>
      )}
    </div>
  );
}

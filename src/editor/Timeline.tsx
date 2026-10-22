import { useRef, useState } from 'react';
import { walk, type Anim, type Layer } from '../engine/model';
import { presetById } from '../engine/presets';
import { useStore } from './store';

const NAME_W = 190;
const ROW_H = 26;

interface Row {
  layer: Layer;
  depth: number;
}

export function Timeline() {
  const project = useStore((s) => s.project);
  const time = useStore((s) => s.time);
  const playing = useStore((s) => s.playing);
  const selection = useStore((s) => s.selection);
  const selectedAnim = useStore((s) => s.selectedAnim);
  const [showAll, setShowAll] = useState(false);
  const lane = useRef<HTMLDivElement>(null);
  const D = project.stage.duration;

  const rows: Row[] = [];
  walk(project.layers, (layer, _p, depth) => {
    if (showAll || layer.anims.length || selection.includes(layer.id)) rows.push({ layer, depth });
  });

  const tOf = (clientX: number) => {
    const r = lane.current!.getBoundingClientRect();
    return Math.min(D, Math.max(0, ((clientX - r.left) / r.width) * D));
  };
  const pct = (t: number) => `${(t / D) * 100}%`;

  const scrub = (e: React.PointerEvent) => {
    const s = useStore.getState();
    s.setPlaying(false);
    s.setMode('animate');
    s.setTime(tOf(e.clientX));
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => s.setTime(tOf(ev.clientX));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  /** Drag a bar (move) or its right edge (resize), snapping to 0.05s and the playhead. */
  const dragAnim = (e: React.PointerEvent, layer: Layer, a: Anim, mode: 'move' | 'resize') => {
    e.stopPropagation();
    const s = useStore.getState();
    s.select([layer.id]);
    s.selectAnim(a.id);
    s.setRightTab('animate');
    const start = tOf(e.clientX);
    const at0 = a.at;
    const dur0 = a.duration;
    const key = `tl-${a.id}-${Date.now()}`;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const snapT = (t: number) => {
      const play = useStore.getState().time;
      if (Math.abs(t - play) < D * 0.01) return play;
      return Math.round(t * 20) / 20;
    };
    const move = (ev: PointerEvent) => {
      const dt = tOf(ev.clientX) - start;
      if (mode === 'move') s.updateAnim(layer.id, a.id, { at: Math.max(0, snapT(at0 + dt)) }, key);
      else s.updateAnim(layer.id, a.id, { duration: Math.max(0.05, snapT(at0 + dur0 + dt) - at0) }, key);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const dragStep = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const s = useStore.getState();
    const key = `step-${id}-${Date.now()}`;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      s.edit((p) => {
        const step = p.cursor.steps.find((x) => x.id === id);
        if (step) step.at = Math.round(tOf(ev.clientX) * 20) / 20;
      }, key);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const ticks: number[] = [];
  const step = D > 20 ? 2 : D > 8 ? 1 : 0.5;
  for (let t = 0; t <= D + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);

  const cam = project.camera;
  const camBar =
    cam.preset === 'static'
      ? null
      : cam.preset === 'focus'
        ? { at: cam.at, dur: cam.duration }
        : cam.preset === 'tilt-reveal'
          ? { at: 0, dur: Math.min(D, 2.4) }
          : { at: 0, dur: D };

  return (
    <div className="timeline">
      <div className="tl-head">
        <div className="tl-controls" style={{ width: NAME_W }}>
          <button className="play" onClick={() => useStore.getState().setPlaying(!playing)} title="Play / pause (Space)">
            {playing ? '❚❚' : '▶'}
          </button>
          <span className="time">
            {time.toFixed(2)}
            <span className="muted"> / {D.toFixed(1)}s</span>
          </span>
          <label className="small muted show-all">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> all
          </label>
        </div>
        <div className="ruler" ref={lane} onPointerDown={scrub}>
          {ticks.map((t) => (
            <span key={t} className="tick" style={{ left: pct(t) }}>
              {Number.isInteger(t) ? `${t}s` : ''}
            </span>
          ))}
          <span className="playhead-head" style={{ left: pct(time) }} />
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-row special">
          <div className="tl-name" style={{ width: NAME_W }} onClick={() => useStore.getState().setRightTab('scene')}>
            🎥 Camera <span className="muted small">{cam.preset}</span>
          </div>
          <div className="tl-lane" onPointerDown={scrub}>
            {camBar && <div className="bar camera" style={{ left: pct(camBar.at), width: pct(camBar.dur) }} />}
            <span className="playhead" style={{ left: pct(time) }} />
          </div>
        </div>
        {project.cursor.enabled && (
          <div className="tl-row special">
            <div className="tl-name" style={{ width: NAME_W }} onClick={() => useStore.getState().setRightTab('scene')}>
              ➚ Cursor
            </div>
            <div className="tl-lane" onPointerDown={scrub}>
              {project.cursor.steps.map((st) => (
                <span key={st.id} className={`diamond ${st.click ? 'click' : ''}`} style={{ left: pct(st.at) }} onPointerDown={(e) => dragStep(e, st.id)} title={`${st.at.toFixed(2)}s${st.click ? ' · click' : ''}`} />
              ))}
              <span className="playhead" style={{ left: pct(time) }} />
            </div>
          </div>
        )}
        {rows.map(({ layer, depth }) => (
          <div key={layer.id} className={`tl-row ${selection.includes(layer.id) ? 'on' : ''}`} style={{ height: ROW_H }}>
            <div className="tl-name" style={{ width: NAME_W, paddingLeft: 10 + depth * 12 }} onClick={() => useStore.getState().select([layer.id])}>
              {layer.name}
            </div>
            <div className="tl-lane" onPointerDown={scrub}>
              {layer.anims.map((a) => {
                const p = presetById(a.preset);
                const kind = p?.kind ?? 'in';
                const end = kind === 'loop' ? D : a.at + a.duration;
                const n = a.stagger > 0 ? layer.children?.filter((c) => c.visible).length ?? 0 : 0;
                const span = n > 1 ? end + a.stagger * (n - 1) : end;
                return (
                  <div
                    key={a.id}
                    className={`bar kind-${kind} ${a.id === selectedAnim ? 'on' : ''}`}
                    style={{ left: pct(a.at), width: pct(Math.max(0.02, span - a.at)) }}
                    onPointerDown={(e) => dragAnim(e, layer, a, 'move')}
                    title={`${p?.label ?? a.preset} · ${a.at.toFixed(2)}s`}
                  >
                    <span className="bar-label">{p?.label ?? a.preset}</span>
                    {kind !== 'loop' && <span className="grip" onPointerDown={(e) => dragAnim(e, layer, a, 'resize')} />}
                  </div>
                );
              })}
              <span className="playhead" style={{ left: pct(time) }} />
            </div>
          </div>
        ))}
        {!rows.length && <div className="tl-empty muted">Select a layer and add an animation from the Animate tab — it appears here as a bar you can drag.</div>}
      </div>
    </div>
  );
}

/** Inspector primitives. Number labels scrub on drag, like Figma. */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Row({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="row" title={hint}>
      {label && <span className="row-label">{label}</span>}
      <div className="row-body">{children}</div>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  width,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  width?: number;
}) {
  const [text, setText] = useState(String(round(value)));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(round(value)));
  }, [value]);
  const clampV = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v)) onChange(clampV(v));
  };
  const scrub = (e: React.PointerEvent) => {
    const start = e.clientX;
    const base = value;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onChange(clampV(round(base + Math.round((ev.clientX - start) / 2) * step * (ev.shiftKey ? 10 : 1))));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <label className="num" style={width ? { width } : undefined}>
      {label && (
        <span className="num-label" onPointerDown={scrub}>
          {label}
        </span>
      )}
      <input
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
          setText(String(round(value)));
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(clampV(round(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1))));
          }
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </label>
  );
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <NumberField value={value} step={step} min={min} max={max} onChange={onChange} width={58} />
    </div>
  );
}

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map((c) => c + c).join('');
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="color">
      <label className="swatch" style={{ background: value }}>
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
      </label>
      <input
        className="color-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => CSS.supports('color', text) && onChange(text)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

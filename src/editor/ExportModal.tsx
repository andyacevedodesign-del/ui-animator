import { useRef, useState } from 'react';
import { encodeVideo, exportStill, supportsVideo, type VideoFormat } from '../export/video';
import { Row, Segmented } from './fields';
import { downloadBlob, saveProjectFile, slug } from './project';
import { useStore } from './store';

type Format = VideoFormat | 'png' | 'project';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const time = useStore((s) => s.time);
  const [format, setFormat] = useState<Format>(supportsVideo() ? 'mp4' : 'png');
  const [scale, setScale] = useState('1');
  const [fps, setFps] = useState(String(project.stage.fps >= 50 ? 60 : 30));
  const [quality, setQuality] = useState('high');
  const [busy, setBusy] = useState<{ phase: string; progress: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const k = Number(scale);
  const name = slug(project.name);

  const run = async () => {
    setMessage(null);
    if (format === 'project') {
      saveProjectFile(project);
      return;
    }
    abort.current = new AbortController();
    try {
      if (format === 'png') {
        setBusy({ phase: 'Rendering', progress: 0.5 });
        downloadBlob(await exportStill(project, time, k), `${name}-${time.toFixed(2)}s${k === 2 ? '@2x' : ''}.png`);
      } else {
        const bpp = { draft: 0.06, high: 0.15, max: 0.3 }[quality] ?? 0.15;
        const { blob, warning } = await encodeVideo(project, { format, fps: Number(fps), scale: k, bitsPerPixel: bpp }, setBusy, abort.current.signal);
        downloadBlob(blob, `${name}-${project.stage.width * k}x${project.stage.height * k}.${format}`);
        if (warning) setMessage(warning);
        else setMessage(`Saved ${(blob.size / 1e6).toFixed(1)} MB.`);
      }
    } catch (err) {
      setMessage(err instanceof DOMException && err.name === 'AbortError' ? 'Cancelled.' : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        <header>
          <h2>Export</h2>
          <button className="icon-btn" onClick={onClose} disabled={!!busy}>
            ✕
          </button>
        </header>
        <Row label="Format">
          <Segmented
            value={format}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
              { value: 'png', label: 'PNG frame' },
              { value: 'project', label: 'Project' },
            ]}
            onChange={setFormat}
          />
        </Row>
        {format !== 'project' && (
          <Row label="Size">
            <Segmented
              value={scale}
              options={['0.5', '1', '2'].map((s) => ({ value: s, label: `${s}× · ${Math.round(project.stage.width * Number(s))}×${Math.round(project.stage.height * Number(s))}` }))}
              onChange={setScale}
            />
          </Row>
        )}
        {(format === 'mp4' || format === 'webm') && (
          <>
            <Row label="Frame rate">
              <Segmented value={fps} options={['24', '30', '60'].map((f) => ({ value: f, label: `${f} fps` }))} onChange={setFps} />
            </Row>
            <Row label="Quality">
              <Segmented
                value={quality}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'high', label: 'High' },
                  { value: 'max', label: 'Max' },
                ]}
                onChange={setQuality}
              />
            </Row>
            <p className="muted small">
              {project.stage.duration}s · {Math.round(project.stage.duration * Number(fps))} frames, rendered exactly — a slow machine never drops frames.
            </p>
          </>
        )}
        {format === 'png' && <p className="muted small">The frame under the playhead ({time.toFixed(2)}s).</p>}
        {format === 'project' && <p className="muted small">A .uianim.json with every layer, animation and image — open it again from the menu.</p>}
        {busy && (
          <div className="progress">
            <div style={{ width: `${busy.progress * 100}%` }} />
            <span>{busy.phase}</span>
          </div>
        )}
        {message && <p className="message">{message}</p>}
        <footer>
          {busy ? (
            <button className="btn" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          ) : (
            <button className="btn primary" onClick={run}>
              {format === 'project' ? 'Save project file' : `Export ${format.toUpperCase()}`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

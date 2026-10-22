/**
 * MP4 / WebM via WebCodecs + mediabunny (ported from Background Animator).
 * Frames are rendered at exact times (i / fps) into an offscreen renderer at
 * export resolution and fed with backpressure, so output never depends on how
 * fast the machine is.
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeVideo, type VideoCodec } from 'mediabunny';
import type { Project } from '../engine/model';
import { Renderer } from '../engine/renderer';

export type VideoFormat = 'mp4' | 'webm';
export type OnProgress = (p: { phase: string; progress: number }) => void;

const CODECS: Record<VideoFormat, VideoCodec[]> = { mp4: ['avc', 'hevc', 'av1'], webm: ['vp9', 'av1', 'vp8'] };

export const supportsVideo = () => typeof window !== 'undefined' && typeof window.VideoEncoder === 'function';

export async function exportRenderer(project: Project, scale: number): Promise<Renderer> {
  const r = new Renderer(project);
  await r.ready();
  r.setScale(scale);
  return r;
}

export async function encodeVideo(project: Project, o: { format: VideoFormat; fps: number; scale: number; bitsPerPixel: number }, onProgress: OnProgress, signal: AbortSignal) {
  if (!supportsVideo()) throw new Error('This browser can’t encode video (no WebCodecs). Use Chrome, Edge or Safari 16.4+.');
  const even = (n: number) => n - (n % 2);
  const width = even(Math.round(project.stage.width * o.scale));
  const height = even(Math.round(project.stage.height * o.scale));
  let codec: VideoCodec | null = null;
  for (const c of CODECS[o.format]) {
    if (await canEncodeVideo(c, { width, height })) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new Error(`This browser can’t encode ${o.format.toUpperCase()} at ${width}×${height}. Try a smaller scale.`);

  onProgress({ phase: 'Preparing', progress: 0 });
  const r = await exportRenderer(project, o.scale);
  r.canvas.width = width;
  r.canvas.height = height;
  const output = new Output({ format: o.format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target: new BufferTarget() });
  const bitrate = Math.min(80_000_000, Math.max(500_000, Math.round(width * height * o.fps * o.bitsPerPixel)));
  const source = new CanvasSource(r.canvas, { codec, quality: new Quality({ bitrate }), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: o.fps });
  try {
    await output.start();
    const total = Math.max(1, Math.round(project.stage.duration * o.fps));
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      r.draw(i / o.fps);
      await source.add(i / o.fps, 1 / o.fps);
      onProgress({ phase: `Frame ${i + 1} of ${total}`, progress: (i + 1) / total });
    }
    source.close();
    onProgress({ phase: 'Finalising', progress: 1 });
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error('Encoding produced no file.');
    const warning = o.format === 'mp4' && codec !== 'avc' ? `No H.264 encoder here, so this MP4 uses ${codec.toUpperCase()}; some players won’t open it.` : null;
    return { blob: new Blob([buffer], { type: o.format === 'mp4' ? 'video/mp4' : 'video/webm' }), warning };
  } catch (err) {
    if (output.state === 'started' || output.state === 'pending') await output.cancel().catch(() => {});
    throw err;
  } finally {
    r.dispose();
  }
}

export async function exportStill(project: Project, t: number, scale: number): Promise<Blob> {
  const r = await exportRenderer(project, scale);
  try {
    r.draw(t);
    return await new Promise<Blob>((resolve, reject) => r.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png'));
  } finally {
    r.dispose();
  }
}

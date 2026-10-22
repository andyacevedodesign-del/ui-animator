import {
  clamp,
  createLineRenderer,
  createStage,
  hexToRgba,
  lerp,
  resolveBackground,
  resolveParams,
  smoothstep,
} from './_lib.js';

export const meta = {
  id: 'wave-lines',
  name: 'Wave Lines',
  tagline: 'Stacked contour lines drifting in a swell',
  description:
    'Layered sine contours with a phase offset per line, producing a slow topographic swell. Vector-friendly, so it exports cleanly to Lottie and SVG.',
  duration: 6,
  vector: true,
  params: [
    { key: 'lines', label: 'Lines', group: 'Field', type: 'range', min: 3, max: 90, step: 1, default: 30 },
    { key: 'spread', label: 'Vertical spread', group: 'Field', type: 'range', min: 0.1, max: 1.4, step: 0.01, default: 0.72 },
    { key: 'centerY', label: 'Centre Y', group: 'Field', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'amplitude', label: 'Amplitude', group: 'Wave', type: 'range', min: 0, max: 0.5, step: 0.005, default: 0.12 },
    { key: 'frequency', label: 'Frequency', group: 'Wave', type: 'range', min: 0.2, max: 8, step: 0.1, default: 1.6 },
    { key: 'harmonic', label: 'Harmonic', group: 'Wave', type: 'range', min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: 'skew', label: 'Line offset', group: 'Wave', type: 'range', min: 0, max: 2, step: 0.01, default: 0.55 },
    { key: 'depthCurve', label: 'Depth curve', group: 'Wave', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    {
      key: 'speedCycles',
      label: 'Drift cycles',
      group: 'Wave',
      type: 'range',
      min: 0,
      max: 6,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'colorTop', label: 'Top colour', group: 'Style', type: 'color', default: '#7dd3fc' },
    { key: 'colorBottom', label: 'Bottom colour', group: 'Style', type: 'color', default: '#c084fc' },
    { key: 'lineOpacity', label: 'Line opacity', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'lineWidth', label: 'Line width', group: 'Style', type: 'range', min: 0.4, max: 8, step: 0.1, default: 1.6 },
    { key: 'glow', label: 'Glow', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'edgeFade', label: 'Edge fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
    {
      key: 'backgroundMode',
      label: 'Background',
      group: 'Style',
      type: 'select',
      options: [
        { value: 'solid', label: 'Solid colour' },
        { value: 'gradient', label: 'Linear gradient' },
      ],
      default: 'gradient',
    },
    {
      key: 'gradientStops',
      label: 'Gradient stops',
      group: 'Style',
      type: 'select',
      options: [
        { value: '2', label: '2 — start and end' },
        { value: '3', label: '3 — one middle stop' },
        { value: '4', label: '4 — two middle stops' },
      ],
      default: '2',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    { key: 'background', label: 'Background colour', group: 'Style', type: 'color', default: '#080611' },
    {
      key: 'gradientFromPos',
      label: 'Start position',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0,
      hint: 'Where the background colour sits. Everything before it stays solid.',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    {
      key: 'gradientMidColor',
      label: 'Middle colour 1',
      group: 'Style',
      type: 'color',
      default: '#120a24',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', oneOf: ['3', '4'] }],
    },
    {
      key: 'gradientMidPos',
      label: 'Middle position 1',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.35,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', oneOf: ['3', '4'] }],
    },
    {
      key: 'gradientMidColor2',
      label: 'Middle colour 2',
      group: 'Style',
      type: 'color',
      default: '#241546',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', equals: '4' }],
    },
    {
      key: 'gradientMidPos2',
      label: 'Middle position 2',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', equals: '4' }],
    },
    {
      key: 'background2',
      label: 'End colour',
      group: 'Style',
      type: 'color',
      default: '#1b1038',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    {
      key: 'gradientToPos',
      label: 'End position',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1,
      hint: 'Where the end colour sits. Everything after it stays solid.',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    {
      key: 'gradientAngle',
      label: 'Gradient angle',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 360,
      step: 1,
      default: 0,
      hint: '0 runs top to bottom, 90 left to right.',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    {
      key: 'gradientMidpoint',
      label: 'Gradient midpoint',
      group: 'Style',
      type: 'range',
      min: 0.05,
      max: 0.95,
      step: 0.01,
      default: 0.5,
      hint: 'Biases the whole ramp toward one end.',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    { key: 'transparent', label: 'Transparent background', group: 'Style', type: 'toggle', default: false },
  ],
};

export function buildWavePaths(P, width, height, time, duration, options) {
  const opts = options || {};
  const detail = opts.detail || 1;
  const chunks = opts.chunks || 0;
  const lines = Math.max(2, Math.round(P.lines * detail));
  const samples = Math.max(24, Math.min(240, Math.round(120 * (opts.sampleDetail || 1))));
  const loop = duration > 0 ? duration : 1;
  const drift = 2 * Math.PI * ((time / loop) * P.speedCycles);

  const top = hexToRgba(P.colorTop);
  const bottom = hexToRgba(P.colorBottom);
  const paths = [];

  for (let i = 0; i < lines; i++) {
    const t = lines === 1 ? 0.5 : i / (lines - 1);
    const y0 = height * (P.centerY + (t - 0.5) * P.spread);
    // Lines further from the centre get a little more amplitude, which reads as depth.
    const depth = 1 + P.depthCurve * Math.abs(t - 0.5) * 2;
    const amp = P.amplitude * height * depth;
    const phase = drift + t * Math.PI * 2 * P.skew;

    const pts = new Array((samples + 1) * 2);
    const alphas = new Array(samples + 1);
    for (let s = 0; s <= samples; s++) {
      const u = s / samples;
      const x = u * width;
      const theta = u * Math.PI * 2 * P.frequency + phase;
      const y = y0 + amp * (Math.sin(theta) + P.harmonic * 0.5 * Math.sin(theta * 2.17 + phase * 0.6));
      pts[s * 2] = x;
      pts[s * 2 + 1] = y;
      alphas[s] = P.edgeFade > 0 ? 1 - P.edgeFade * smoothstep(0.35, 0.5, Math.abs(u - 0.5)) : 1;
    }

    const rgb = [lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t)];
    const opacity = clamp(P.lineOpacity * lerp(top[3], bottom[3], t), 0, 1);

    if (chunks > 0) {
      const points = samples + 1;
      const per = Math.max(1, Math.ceil((points - 1) / chunks));
      for (let start = 0; start < points - 1; start += per) {
        const end = Math.min(start + per, points - 1);
        let sum = 0;
        for (let k = start; k <= end; k++) sum += alphas[k];
        const avg = sum / (end - start + 1);
        if (avg <= 0.004) continue;
        paths.push({
          id: 'line' + i + ':' + start,
          pts: pts.slice(start * 2, (end + 1) * 2),
          color: rgb,
          width: P.lineWidth,
          opacity: opacity * avg,
        });
      }
    } else {
      paths.push({ id: 'line' + i, pts, alphas, color: rgb, width: P.lineWidth, opacity });
    }
  }

  return {
    paths,
    background: P.background,
    backgroundFill: resolveBackground(P),
    transparent: !!P.transparent,
  };
}

export function create(canvas) {
  const stage = createStage(canvas);
  const lines = createLineRenderer(stage.gl);

  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      stage.paintBackground(resolveBackground(P), P.transparent);
      const frame = buildWavePaths(P, stage.width, stage.height, time, duration || meta.duration);
      lines.draw(frame.paths, stage.frameOpts({ glow: P.glow, glowWidth: 5 }));
    },
    dispose() {
      lines.dispose();
    },
  };
}

export function vector(params, time, duration, width, height, options) {
  const P = resolveParams(meta, params);
  const opts = options || {};
  return buildWavePaths(P, width, height, time, duration || meta.duration, {
    chunks: opts.chunks || 4,
    detail: opts.detail || 1,
    sampleDetail: opts.sampleDetail || 1,
  });
}

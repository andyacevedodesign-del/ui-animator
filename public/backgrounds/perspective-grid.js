import {
  bell,
  clamp,
  createLineRenderer,
  createStage,
  hexToRgba,
  resolveBackground,
  resolveParams,
  smoothstep,
} from './_lib.js';

export const meta = {
  id: 'perspective-grid',
  name: 'Perspective Grid',
  tagline: 'Scrolling horizon grid with a rising curve',
  description:
    'A vanishing-point grid that scrolls toward the viewer while a soft bell curve lifts the surface and breathes up and down. Built for section backgrounds that need depth without stealing attention.',
  duration: 8,
  vector: true,
  params: [
    // --- Grid -------------------------------------------------------------
    { key: 'rows', label: 'Rows', group: 'Grid', type: 'range', min: 4, max: 80, step: 1, default: 26 },
    { key: 'columns', label: 'Columns', group: 'Grid', type: 'range', min: 4, max: 90, step: 1, default: 44 },
    { key: 'horizon', label: 'Horizon', group: 'Grid', type: 'range', min: 0.02, max: 0.9, step: 0.01, default: 0.34 },
    { key: 'perspective', label: 'Perspective', group: 'Grid', type: 'range', min: 0.6, max: 5, step: 0.05, default: 2.4 },
    { key: 'spread', label: 'Spread', group: 'Grid', type: 'range', min: 0.6, max: 4, step: 0.05, default: 2.4 },
    { key: 'vanishX', label: 'Vanishing point X', group: 'Grid', type: 'range', min: -0.5, max: 0.5, step: 0.01, default: 0 },
    {
      key: 'scrollCycles',
      label: 'Scroll cycles',
      group: 'Grid',
      type: 'range',
      min: 0,
      max: 6,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'showRows', label: 'Horizontal lines', group: 'Grid', type: 'toggle', default: true },
    { key: 'showColumns', label: 'Vertical lines', group: 'Grid', type: 'toggle', default: true },

    // --- Curve ------------------------------------------------------------
    { key: 'curveDepth', label: 'Curve height', group: 'Curve', type: 'range', min: 0, max: 0.9, step: 0.01, default: 0.22 },
    { key: 'curveWidth', label: 'Curve width', group: 'Curve', type: 'range', min: 0.05, max: 1.2, step: 0.01, default: 0.32 },
    {
      key: 'curveShape',
      label: 'Curve shape',
      group: 'Curve',
      type: 'range',
      min: 0.2,
      max: 3,
      step: 0.05,
      default: 0.55,
      hint: 'Below 1 flattens the plateau, above 1 sharpens the peak.',
    },
    { key: 'curveX', label: 'Curve offset X', group: 'Curve', type: 'range', min: -0.5, max: 0.5, step: 0.01, default: 0 },
    {
      key: 'curveBias',
      label: 'Curve depth bias',
      group: 'Curve',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.9,
      hint: '0 lifts the foreground, 1 lifts the distance.',
    },
    { key: 'waveAmount', label: 'Rise & fall', group: 'Curve', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    {
      key: 'waveCycles',
      label: 'Rise & fall cycles',
      group: 'Curve',
      type: 'range',
      min: 0,
      max: 6,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },

    // --- Style ------------------------------------------------------------
    { key: 'lineColor', label: 'Line colour', group: 'Style', type: 'color', default: '#ffffff' },
    { key: 'lineOpacity', label: 'Line opacity', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'lineWidth', label: 'Line width', group: 'Style', type: 'range', min: 0.4, max: 6, step: 0.1, default: 1.4 },
    { key: 'glow', label: 'Glow', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'fogNear', label: 'Horizon fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.32 },
    { key: 'frontFade', label: 'Foreground fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: 'edgeFade', label: 'Edge fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    {
      key: 'backgroundMode',
      label: 'Background',
      group: 'Style',
      type: 'select',
      options: [
        { value: 'solid', label: 'Solid colour' },
        { value: 'gradient', label: 'Linear gradient' },
      ],
      default: 'solid',
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
    { key: 'background', label: 'Background colour', group: 'Style', type: 'color', default: '#05070d' },
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
      default: '#0b1120',
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
      default: '#1a2540',
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
      default: '#131c33',
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

/**
 * Builds the grid as design-space polylines. Both the WebGL renderer and the
 * vector (Lottie/SVG) exporter read from this single source of truth, so the
 * preview and the exports cannot drift apart.
 *
 * @param options.chunks   split each polyline into N constant-alpha pieces
 *                         (vector formats cannot express per-vertex alpha)
 * @param options.detail   multiplier on line counts / sampling, for lighter exports
 */
export function buildGridPaths(P, width, height, time, duration, options) {
  const opts = options || {};
  const detail = opts.detail || 1;
  const chunks = opts.chunks || 0;

  const rows = Math.max(2, Math.round(P.rows * detail));
  const columns = Math.max(2, Math.round(P.columns * detail));
  const horizonY = P.horizon * height;
  const planeHeight = height - horizonY;
  const vanishX = width * (0.5 + P.vanishX);
  const loop = duration > 0 ? duration : 1;

  const scroll = P.scrollCycles > 0 ? (((time / loop) * P.scrollCycles) % 1 + 1) % 1 : 0;
  const wave = 1 + P.waveAmount * Math.sin(2 * Math.PI * (time / loop) * P.waveCycles);

  const curveAmplitude = P.curveDepth * height * wave;
  const curveCenter = width * (0.5 + P.curveX);
  const curveHalfWidth = Math.max(P.curveWidth * width, 1);
  const fogNear = Math.max(P.fogNear, 0.0001);

  // Depth 0 sits on the horizon, 1 at the front plane. The power curve is what
  // bunches lines up as they approach the vanishing point.
  const depthOf = (i) => Math.pow(Math.max((i + scroll) / rows, 0), P.perspective);
  const yOf = (p) => horizonY + planeHeight * p;
  const halfWidthOf = (p) => width * 0.5 * P.spread * p;
  // How the ridge is distributed in depth: 0 lifts the near rows most (a ridge
  // running toward the viewer), 1 lifts the distant rows most (a hill sitting on
  // the horizon, which keeps the foreground flat and full).
  const bias = P.curveBias;
  const liftOf = (x, p) => {
    const weight = p + (1 - 2 * p) * bias;
    return -curveAmplitude * bell((x - curveCenter) / curveHalfWidth, P.curveShape) * weight;
  };

  const alphaOf = (p, x) => {
    let a = smoothstep(0, fogNear, p);
    a *= 1 - P.frontFade * smoothstep(0.55, 1.05, p);
    if (P.edgeFade > 0) {
      const edge = Math.abs((x - width * 0.5) / (width * 0.5));
      a *= 1 - P.edgeFade * smoothstep(0.45, 1.1, edge);
    }
    return clamp(a, 0, 1);
  };

  const color = hexToRgba(P.lineColor);
  const rgb = [color[0], color[1], color[2]];
  const opacity = P.lineOpacity * color[3];
  const width_ = P.lineWidth;
  const paths = [];

  const push = (id, pts, alphas) => {
    if (pts.length < 4) return;
    if (chunks > 0) {
      // Vector formats carry one stroke opacity per path, so long lines are cut
      // into N pieces that each take the average alpha of their span. Pieces
      // share endpoints, so the line stays visually continuous.
      const points = pts.length >> 1;
      const per = Math.max(1, Math.ceil((points - 1) / chunks));
      for (let start = 0; start < points - 1; start += per) {
        const end = Math.min(start + per, points - 1);
        const slice = pts.slice(start * 2, (end + 1) * 2);
        let sum = 0;
        for (let i = start; i <= end; i++) sum += alphas[i];
        const avg = sum / (end - start + 1);
        if (avg <= 0.004) continue;
        paths.push({
          id: id + ':' + start,
          pts: slice,
          color: rgb,
          width: width_,
          opacity: opacity * avg,
        });
      }
    } else {
      paths.push({ id, pts, alphas, color: rgb, width: width_, opacity });
    }
  };

  // Horizontal lines: one per depth step, sampled across the plane so the bell
  // curve reads as a smooth ridge rather than a polygon.
  if (P.showRows) {
    const samples = Math.max(16, Math.min(200, Math.round(columns * 2 * (opts.sampleDetail || 1))));
    for (let i = 0; i <= rows; i++) {
      const p = depthOf(i);
      if (p <= 0) continue;
      const y = yOf(p);
      const hw = halfWidthOf(p);
      const pts = new Array((samples + 1) * 2);
      const alphas = new Array(samples + 1);
      for (let s = 0; s <= samples; s++) {
        const u = (s / samples) * 2 - 1;
        const x = vanishX + u * hw;
        pts[s * 2] = x;
        pts[s * 2 + 1] = y + liftOf(x, p);
        alphas[s] = alphaOf(p, x);
      }
      push('row' + i, pts, alphas);
    }
  }

  // Vertical lines: one per column, sampled along depth so they ride the ridge.
  if (P.showColumns) {
    for (let j = 0; j <= columns; j++) {
      const u = (j / columns) * 2 - 1;
      const pts = new Array((rows + 1) * 2);
      const alphas = new Array(rows + 1);
      for (let i = 0; i <= rows; i++) {
        const p = depthOf(i);
        const x = vanishX + u * halfWidthOf(p);
        pts[i * 2] = x;
        pts[i * 2 + 1] = yOf(p) + liftOf(x, p);
        alphas[i] = alphaOf(p, x);
      }
      push('col' + j, pts, alphas);
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
      const frame = buildGridPaths(P, stage.width, stage.height, time, duration || meta.duration);
      lines.draw(frame.paths, stage.frameOpts({ glow: P.glow, glowWidth: 6 }));
    },
    dispose() {
      lines.dispose();
    },
  };
}

export function vector(params, time, duration, width, height, options) {
  const P = resolveParams(meta, params);
  const opts = options || {};
  return buildGridPaths(P, width, height, time, duration || meta.duration, {
    chunks: opts.chunks || 4,
    detail: opts.detail || 1,
    sampleDetail: opts.sampleDetail || 1,
  });
}

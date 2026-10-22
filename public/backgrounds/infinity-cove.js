import {
  clamp,
  createLineRenderer,
  createStage,
  hexToRgba,
  resolveBackground,
  resolveParams,
  smoothstep,
} from './_lib.js';

export const meta = {
  id: 'infinity-cove',
  name: 'Infinity Cove',
  tagline: 'Floor curving up into a lit back wall',
  description:
    'A cyclorama: a gridded floor that sweeps up through a fillet into a vertical back wall, lit by a band that travels from the floor and up the wall. Unlike a screen-space bend this is projected 3D, so the wall reads as a real surface — its vertical lines stay parallel and evenly spaced while the floor converges.',
  duration: 10,
  vector: true,
  params: [
    // --- Cove -------------------------------------------------------------
    {
      key: 'floorLength',
      label: 'Floor depth',
      group: 'Cove',
      type: 'range',
      min: 1,
      max: 40,
      step: 0.5,
      default: 12,
      hint: 'How far the flat floor runs before it starts to curve.',
    },
    { key: 'curveRadius', label: 'Curve radius', group: 'Cove', type: 'range', min: 0, max: 16, step: 0.1, default: 5 },
    { key: 'wallHeight', label: 'Wall height', group: 'Cove', type: 'range', min: 0, max: 20, step: 0.5, default: 5 },
    { key: 'fieldWidth', label: 'Width', group: 'Cove', type: 'range', min: 1, max: 40, step: 0.5, default: 10 },
    {
      key: 'nearDistance',
      label: 'Near edge',
      group: 'Cove',
      type: 'range',
      min: 0.5,
      max: 12,
      step: 0.1,
      default: 3.5,
      hint: 'Distance to the closest grid line. Lower pushes the floor past the bottom of frame.',
    },

    // --- Camera -----------------------------------------------------------
    { key: 'cameraHeight', label: 'Camera height', group: 'Camera', type: 'range', min: 0.05, max: 8, step: 0.05, default: 1 },
    {
      key: 'lens',
      label: 'Lens',
      group: 'Camera',
      type: 'range',
      min: 0.3,
      max: 3,
      step: 0.05,
      default: 1,
      hint: 'Focal length. Lower is wider-angle and exaggerates the sweep.',
    },
    { key: 'horizon', label: 'Eye level', group: 'Camera', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'offsetX', label: 'Offset X', group: 'Camera', type: 'range', min: -0.5, max: 0.5, step: 0.01, default: 0 },

    // --- Grid -------------------------------------------------------------
    { key: 'rows', label: 'Cross lines', group: 'Grid', type: 'range', min: 4, max: 90, step: 1, default: 34 },
    { key: 'columns', label: 'Run lines', group: 'Grid', type: 'range', min: 4, max: 90, step: 1, default: 38 },
    { key: 'showRows', label: 'Cross lines visible', group: 'Grid', type: 'toggle', default: true },
    { key: 'showColumns', label: 'Run lines visible', group: 'Grid', type: 'toggle', default: true },

    // --- Motion -----------------------------------------------------------
    {
      key: 'scrollCycles',
      label: 'Flow cycles',
      group: 'Motion',
      type: 'range',
      min: -4,
      max: 4,
      step: 1,
      default: 3,
      hint: 'Cross lines travel along the surface and up the wall. Whole numbers keep the loop seamless.',
    },
    {
      key: 'sweep',
      label: 'Light sweep',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.93,
      hint: 'A band of light travels from the floor, over the curve and up the wall.',
    },
    { key: 'sweepWidth', label: 'Sweep width', group: 'Motion', type: 'range', min: 0.04, max: 1, step: 0.01, default: 0.3 },
    {
      key: 'sweepAmbient',
      label: 'Shadow level',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.16,
      hint: 'How lit the surface stays outside the travelling band. 0 is fully dark.',
    },
    { key: 'sweepCycles', label: 'Sweep cycles', group: 'Motion', type: 'range', min: 0, max: 4, step: 1, default: 2 },
    {
      key: 'breathe',
      label: 'Wall drift',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 0.6,
      step: 0.01,
      default: 0,
      hint: 'Scales the whole cove nearer and further. Reads as a zoom pulse, so it is off by default.',
    },
    { key: 'breatheCycles', label: 'Wall drift cycles', group: 'Motion', type: 'range', min: 0, max: 4, step: 1, default: 1 },

    // --- Style ------------------------------------------------------------
    { key: 'lineColor', label: 'Line colour', group: 'Style', type: 'color', default: '#ffffff' },
    { key: 'lineOpacity', label: 'Line opacity', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'lineWidth', label: 'Line width', group: 'Style', type: 'range', min: 0.4, max: 6, step: 0.1, default: 1.4 },
    { key: 'glow', label: 'Glow', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'fade', label: 'Distance fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.32 },
    { key: 'nearFade', label: 'Foreground fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'edgeFade', label: 'Edge fade', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.4 },
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
      default: '4',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    { key: 'background', label: 'Background colour', group: 'Style', type: 'color', default: '#3e0d4a' },
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
      default: '#9602c7',
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
      default: 0.87,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', oneOf: ['3', '4'] }],
    },
    {
      key: 'gradientMidColor2',
      label: 'Middle colour 2',
      group: 'Style',
      type: 'color',
      default: '#d17dfe',
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
      default: 0.99,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', equals: '4' }],
    },
    {
      key: 'background2',
      label: 'End colour',
      group: 'Style',
      type: 'color',
      default: '#730394',
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
      default: 0.93,
      hint: 'Biases the whole ramp toward one end.',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    { key: 'transparent', label: 'Transparent background', group: 'Style', type: 'toggle', default: false },
  ],
};

/**
 * The cove profile, seen from the side and parametrised by arc length `s`
 * measured from the camera along the surface:
 *
 *        wall  |
 *              |
 *   fillet     /
 *   floor ____/            <- s runs left to right
 *
 * Returns [Z, Y] in world units: Z is depth away from the camera, Y is height
 * above the floor. Spacing grid lines evenly in `s` is what makes the grid
 * squares stay square as they ride over the curve.
 */
function profileAt(s, floorEnd, radius, arcLength) {
  if (s <= floorEnd) return [s, 0];
  if (radius > 0.001 && s < floorEnd + arcLength) {
    const angle = (s - floorEnd) / radius;
    return [floorEnd + radius * Math.sin(angle), radius * (1 - Math.cos(angle))];
  }
  return [floorEnd + radius, radius + (s - floorEnd - arcLength)];
}

export function buildCovePaths(P, width, height, time, duration, options) {
  const opts = options || {};
  const detail = opts.detail || 1;
  const chunks = opts.chunks || 0;

  const rows = Math.max(2, Math.round(P.rows * detail));
  const columns = Math.max(2, Math.round(P.columns * detail));
  const loop = duration > 0 ? duration : 1;

  const drift = 1 + P.breathe * Math.sin(2 * Math.PI * (time / loop) * P.breatheCycles);
  const floorEnd = Math.max(P.floorLength * drift, 0.01);
  const radius = Math.max(P.curveRadius * drift, 0);
  const arcLength = radius * Math.PI * 0.5;
  const near = Math.max(P.nearDistance, 0.05);
  const far = floorEnd + arcLength + Math.max(P.wallHeight, 0);
  const span = Math.max(far - near, 0.01);

  // Pinhole projection with the focal length in pixels. It keys off the LARGER
  // dimension so the cove covers tall/narrow containers too — keying off width
  // alone shrinks the vertical field of view on a phone and leaves gaps.
  const focal = Math.max(width, height) * P.lens;
  const vanishX = width * (0.5 + P.offsetX);
  const eyeY = height * P.horizon;
  const cameraY = P.cameraHeight;

  const projectX = (x, z) => vanishX + (focal * x) / z;
  const projectY = (y, z) => eyeY + (focal * (cameraY - y)) / z;

  const halfWidth = P.fieldWidth;
  const scroll = P.scrollCycles !== 0 ? ((((time / loop) * P.scrollCycles) % 1) + 1) % 1 : 0;

  // A band of light travelling along the surface. Because `u` is normalised arc
  // length, the band rises from the near floor, rolls over the fillet and
  // continues up the wall — the motion reads as travel without any geometry
  // moving. It wraps at the seam, where both ends are already faded out.
  const sweepPos = P.sweepCycles !== 0 ? ((((time / loop) * P.sweepCycles) % 1) + 1) % 1 : 0;
  const sweepWidth = Math.max(P.sweepWidth, 0.001);
  const bandAt = (u) => {
    let d = Math.abs(u - sweepPos);
    if (d > 0.5) d = 1 - d; // wrap, so the light re-enters at the floor
    return d < sweepWidth ? 0.5 * (1 + Math.cos((Math.PI * d) / sweepWidth)) : 0;
  };

  // Atmospheric fade keys off real depth, not arc length: every point on the
  // wall sits at the same distance, so the wall reads as one evenly lit plane
  // and the travelling band is what changes across it.
  const wallDepth = floorEnd + radius;
  const depthRange = Math.max(wallDepth - near, 0.0001);

  const alphaOf = (u, z, screenX) => {
    const depthT = clamp((z - near) / depthRange, 0, 1);
    const atmos = 1 - P.fade * smoothstep(0, 1, depthT); // distance haze
    let a = atmos;
    if (P.sweep > 0) {
      // The band behaves like a light source rather than a dimming mask. Haze
      // attenuates the ambient level in full but the highlight only halfway,
      // which is what keeps the band readable once it climbs onto the wall —
      // the wall is the farthest surface, so a purely multiplicative sweep
      // disappears into the haze exactly where the travel should be clearest.
      const highlight = bandAt(u) * (0.5 + 0.5 * atmos);
      const level = P.sweepAmbient * atmos + (1 - P.sweepAmbient) * highlight;
      a = atmos * (1 - P.sweep) + level * P.sweep;
    }
    // Soften the very top of the wall so lines do not hard-cut at the frame edge.
    a *= 1 - 0.55 * smoothstep(0.86, 1, u);
    a *= 1 - P.nearFade * (1 - smoothstep(0, 0.14, u));
    if (P.edgeFade > 0) {
      const edge = Math.abs((screenX - width * 0.5) / (width * 0.5));
      a *= 1 - P.edgeFade * smoothstep(0.45, 1.1, edge);
    }
    return clamp(a, 0, 1);
  };

  const color = hexToRgba(P.lineColor);
  const rgb = [color[0], color[1], color[2]];
  const opacity = P.lineOpacity * color[3];
  const paths = [];

  const push = (id, pts, alphas) => {
    if (pts.length < 4) return;
    if (chunks > 0) {
      const points = pts.length >> 1;
      const per = Math.max(1, Math.ceil((points - 1) / chunks));
      for (let start = 0; start < points - 1; start += per) {
        const end = Math.min(start + per, points - 1);
        let sum = 0;
        for (let i = start; i <= end; i++) sum += alphas[i];
        const avg = sum / (end - start + 1);
        if (avg <= 0.004) continue;
        paths.push({
          id: id + ':' + start,
          pts: pts.slice(start * 2, (end + 1) * 2),
          color: rgb,
          width: P.lineWidth,
          opacity: opacity * avg,
        });
      }
    } else {
      paths.push({ id, pts, alphas, color: rgb, width: P.lineWidth, opacity });
    }
  };

  // Cross lines: constant arc length, spanning the width. The floor and the
  // fillet are both swept along X, so each one projects to a straight screen
  // line — they only need enough points to carry the edge fade.
  if (P.showRows) {
    const step = span / rows;
    const samples = Math.max(8, Math.round(24 * (opts.sampleDetail || 1)));
    for (let i = 0; i <= rows; i++) {
      const s = near + (i + scroll) * step;
      if (s > far + step) continue;
      const [z, y] = profileAt(s, floorEnd, radius, arcLength);
      if (z <= 0.02) continue;
      const screenY = projectY(y, z);
      const u = clamp((s - near) / span, 0, 1);
      const pts = new Array((samples + 1) * 2);
      const alphas = new Array(samples + 1);
      for (let k = 0; k <= samples; k++) {
        const x = (k / samples) * 2 * halfWidth - halfWidth;
        const screenX = projectX(x, z);
        pts[k * 2] = screenX;
        pts[k * 2 + 1] = screenY;
        alphas[k] = alphaOf(u, z, screenX);
      }
      push('cross' + i, pts, alphas);
    }
  }

  // Run lines: constant X, sampled along the profile so they bend through the
  // fillet and rise up the wall.
  if (P.showColumns) {
    const samples = Math.max(24, Math.min(220, Math.round(rows * 3 * (opts.sampleDetail || 1))));
    for (let j = 0; j <= columns; j++) {
      const x = (j / columns) * 2 * halfWidth - halfWidth;
      const pts = [];
      const alphas = [];
      for (let k = 0; k <= samples; k++) {
        const s = near + (k / samples) * span;
        const [z, y] = profileAt(s, floorEnd, radius, arcLength);
        if (z <= 0.02) continue;
        const screenX = projectX(x, z);
        pts.push(screenX, projectY(y, z));
        alphas.push(alphaOf(clamp((s - near) / span, 0, 1), z, screenX));
      }
      push('run' + j, pts, alphas);
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
      const frame = buildCovePaths(P, stage.width, stage.height, time, duration || meta.duration);
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
  return buildCovePaths(P, width, height, time, duration || meta.duration, {
    chunks: opts.chunks || 4,
    detail: opts.detail || 1,
    sampleDetail: opts.sampleDetail || 1,
  });
}

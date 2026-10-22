import {
  GRADIENT_GLSL,
  createQuadRenderer,
  createStage,
  gradientUniforms,
  hexToRgba,
  resolveBackground,
  resolveParams,
} from './_lib.js';

export const meta = {
  id: 'aurora-flow',
  name: 'Aurora Flow',
  tagline: 'Soft volumetric colour drift',
  description:
    'A domain-warped noise field blending three colours. Pure fragment shader, so it stays crisp at any resolution — raster export only (no Lottie).',
  duration: 12,
  vector: false,
  params: [
    { key: 'scale', label: 'Scale', group: 'Field', type: 'range', min: 0.3, max: 5, step: 0.05, default: 1.35 },
    { key: 'warp', label: 'Warp', group: 'Field', type: 'range', min: 0, max: 2, step: 0.01, default: 0.85 },
    { key: 'detail', label: 'Detail', group: 'Field', type: 'range', min: 1, max: 5, step: 1, default: 4 },
    {
      key: 'driftCycles',
      label: 'Drift cycles',
      group: 'Field',
      type: 'range',
      min: 0,
      max: 4,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'flow', label: 'Flow radius', group: 'Field', type: 'range', min: 0, max: 2, step: 0.01, default: 0.55 },
    { key: 'colorA', label: 'Colour A', group: 'Style', type: 'color', default: '#2563eb' },
    { key: 'colorB', label: 'Colour B', group: 'Style', type: 'color', default: '#a855f7' },
    { key: 'colorC', label: 'Colour C', group: 'Style', type: 'color', default: '#22d3ee' },
    { key: 'intensity', label: 'Intensity', group: 'Style', type: 'range', min: 0, max: 2, step: 0.01, default: 1 },
    { key: 'contrast', label: 'Contrast', group: 'Style', type: 'range', min: 0.2, max: 3, step: 0.01, default: 1.25 },
    { key: 'vignette', label: 'Vignette', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'grain', label: 'Grain', group: 'Style', type: 'range', min: 0, max: 0.25, step: 0.005, default: 0.03 },
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
    { key: 'background', label: 'Background colour', group: 'Style', type: 'color', default: '#04050c' },
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
      default: '#070a18',
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
      default: '#0f182f',
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
      default: '#0b1226',
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

const FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_angle;      // loop angle, 0..2pi
uniform float u_scale;
uniform float u_warp;
uniform float u_flow;
uniform float u_detail;
uniform float u_intensity;
uniform float u_contrast;
uniform float u_vignette;
uniform float u_grain;
uniform float u_transparent;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
${GRADIENT_GLSL}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= octaves) break;
    sum += amp * valueNoise(p);
    norm += amp;
    p *= 2.02;
    amp *= 0.5;
  }
  return sum / max(norm, 0.0001);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * u_scale;

  // Sampling noise around a circle in a third dimension makes the animation
  // return exactly to its starting state at the end of the loop.
  vec2 loop = vec2(cos(u_angle), sin(u_angle)) * u_flow;

  vec2 q = vec2(fbm(p + loop + vec2(0.0, 0.0), u_detail), fbm(p + loop + vec2(5.2, 1.3), u_detail));
  vec2 r = vec2(
    fbm(p + u_warp * q + loop * 0.7 + vec2(1.7, 9.2), u_detail),
    fbm(p + u_warp * q + loop * 0.7 + vec2(8.3, 2.8), u_detail)
  );
  float f = fbm(p + u_warp * r + loop * 0.4, u_detail);

  float shaped = pow(clamp(f, 0.0, 1.0), u_contrast);
  vec3 col = mix(u_colorA, u_colorB, clamp(r.x * 1.4, 0.0, 1.0));
  col = mix(col, u_colorC, clamp(length(q) * 0.9, 0.0, 1.0));
  col *= shaped * u_intensity;

  float vig = 1.0 - u_vignette * smoothstep(0.35, 0.95, length(vec2((uv.x - 0.5) * aspect, uv.y - 0.5)));
  col *= vig;

  if (u_grain > 0.0) {
    float n = hash(uv * u_resolution + vec2(u_angle * 13.0));
    col += (n - 0.5) * u_grain;
  }

  col = max(col, vec3(0.0));

  if (u_transparent > 0.5) {
    float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
    outColor = vec4(col * a, a); // premultiplied
  } else {
    vec3 finalColor = gradientColor(gradientT(uv)) + col;
    outColor = vec4(finalColor, 1.0);
  }
}`;

export function create(canvas) {
  const stage = createStage(canvas);
  const quad = createQuadRenderer(stage.gl, FRAGMENT);

  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      const loop = duration || meta.duration;
      stage.clear(P.background, P.transparent);
      const a = hexToRgba(P.colorA);
      const b = hexToRgba(P.colorB);
      const c = hexToRgba(P.colorC);
      // A solid background is just a one-colour ramp, so the same uniforms serve both.
      const fill = resolveBackground(P);
      const flat = { ...fill, stops: [{ color: fill.from, pos: 0 }, { color: fill.from, pos: 1 }] };
      quad.draw({
        ...gradientUniforms(fill.mode === 'gradient' ? fill : flat),
        u_resolution: [canvas.width, canvas.height],
        u_angle: 2 * Math.PI * ((time / (loop > 0 ? loop : 1)) * P.driftCycles),
        u_scale: P.scale,
        u_warp: P.warp,
        u_flow: P.flow,
        u_detail: P.detail,
        u_intensity: P.intensity,
        u_contrast: P.contrast,
        u_vignette: P.vignette,
        u_grain: P.grain,
        u_transparent: P.transparent ? 1 : 0,
        u_colorA: [a[0], a[1], a[2]],
        u_colorB: [b[0], b[1], b[2]],
        u_colorC: [c[0], c[1], c[2]],
      });
    },
    dispose() {
      quad.dispose();
    },
  };
}

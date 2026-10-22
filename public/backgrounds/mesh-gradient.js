import { createQuadRenderer, createStage, hexToRgba, resolveParams } from './_lib.js';

export const meta = {
  id: 'mesh-gradient',
  name: 'Mesh Gradient',
  tagline: 'Four soft colour orbs orbiting each other',
  description:
    'The launch-page staple: four blurred colour fields drifting on closed orbits over a base colour, with optional film grain. Every orbit completes a whole number of turns, so it loops seamlessly.',
  duration: 10,
  vector: false,
  params: [
    { key: 'colorA', label: 'Colour A', group: 'Colours', type: 'color', default: '#7c3aed' },
    { key: 'colorB', label: 'Colour B', group: 'Colours', type: 'color', default: '#2563eb' },
    { key: 'colorC', label: 'Colour C', group: 'Colours', type: 'color', default: '#ec4899' },
    { key: 'colorD', label: 'Colour D', group: 'Colours', type: 'color', default: '#06b6d4' },
    { key: 'background', label: 'Base colour', group: 'Colours', type: 'color', default: '#0b0618' },
    { key: 'size', label: 'Orb size', group: 'Motion', type: 'range', min: 0.15, max: 1.2, step: 0.01, default: 0.55 },
    { key: 'softness', label: 'Softness', group: 'Motion', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1.4 },
    { key: 'orbit', label: 'Orbit radius', group: 'Motion', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.28 },
    {
      key: 'cycles',
      label: 'Orbit cycles',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 4,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'intensity', label: 'Intensity', group: 'Style', type: 'range', min: 0, max: 1.5, step: 0.01, default: 0.9 },
    { key: 'grain', label: 'Grain', group: 'Style', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.04 },
    { key: 'vignette', label: 'Vignette', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
};

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_angle;
uniform float u_size;
uniform float u_soft;
uniform float u_orbit;
uniform float u_intensity;
uniform float u_grain;
uniform float u_vignette;
uniform vec3 u_base;
uniform vec3 u_c[4];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, 0.5 - v_uv.y);
  vec3 col = u_base;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // Each orb has its own home, phase and direction; integer multipliers of the
    // loop angle keep every path closed.
    vec2 home = vec2(cos(fi * 1.7 + 0.6) * 0.42 * aspect, sin(fi * 2.3 + 0.2) * 0.32);
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float a = u_angle * dir * (1.0 + mod(fi, 2.0)) + fi * 1.5708;
    vec2 c = home + vec2(cos(a), sin(a * 1.0) * 0.8) * u_orbit;
    float d = length(p - c) / u_size;
    float w = exp(-pow(d, 2.0) * (3.0 / u_soft));
    col = mix(col, u_c[i], clamp(w * u_intensity, 0.0, 1.0));
  }
  float vig = 1.0 - u_vignette * smoothstep(0.3, 1.0, length(vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5)));
  col *= vig;
  col += (hash(v_uv * u_resolution) - 0.5) * u_grain;
  outColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

export function create(canvas) {
  const stage = createStage(canvas);
  const quad = createQuadRenderer(stage.gl, FRAGMENT);
  const colors = new Float32Array(12);
  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      const loop = duration || meta.duration;
      stage.clear(P.background, false);
      [P.colorA, P.colorB, P.colorC, P.colorD].forEach((hex, i) => {
        const [r, g, b] = hexToRgba(hex);
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      });
      const base = hexToRgba(P.background);
      quad.draw({
        u_resolution: [canvas.width, canvas.height],
        u_angle: 2 * Math.PI * (time / (loop > 0 ? loop : 1)) * P.cycles,
        u_size: P.size,
        u_soft: P.softness,
        u_orbit: P.orbit,
        u_intensity: P.intensity,
        u_grain: P.grain,
        u_vignette: P.vignette,
        u_base: [base[0], base[1], base[2]],
        'u_c[0]': { array: colors, size: 3 },
      });
    },
    dispose() {
      quad.dispose();
    },
  };
}

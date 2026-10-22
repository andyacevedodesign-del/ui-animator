import { createQuadRenderer, createStage, hexToRgba, resolveParams } from './_lib.js';

export const meta = {
  id: 'dot-grid',
  name: 'Dot Grid',
  tagline: 'A dotted field with a ripple of light',
  description:
    'A quiet dot grid — the canvas look of design tools — with rings of light rippling out from a focus point and a soft glow behind it. Sized in composition pixels, so the grid holds at any export scale.',
  duration: 6,
  vector: false,
  params: [
    { key: 'spacing', label: 'Spacing', group: 'Grid', type: 'range', min: 8, max: 80, step: 1, default: 28 },
    { key: 'dotSize', label: 'Dot size', group: 'Grid', type: 'range', min: 0.5, max: 8, step: 0.1, default: 1.6 },
    { key: 'dotColor', label: 'Dot colour', group: 'Grid', type: 'color', default: '#3a3f55' },
    { key: 'focusX', label: 'Focus X', group: 'Ripple', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'focusY', label: 'Focus Y', group: 'Ripple', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'glowColor', label: 'Ripple colour', group: 'Ripple', type: 'color', default: '#8b5cf6' },
    { key: 'rings', label: 'Rings', group: 'Ripple', type: 'range', min: 1, max: 6, step: 1, default: 2 },
    { key: 'ringWidth', label: 'Ring width', group: 'Ripple', type: 'range', min: 0.02, max: 0.5, step: 0.01, default: 0.12 },
    { key: 'swell', label: 'Dot swell', group: 'Ripple', type: 'range', min: 0, max: 3, step: 0.05, default: 1.2 },
    { key: 'halo', label: 'Centre glow', group: 'Ripple', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'background', label: 'Background', group: 'Style', type: 'color', default: '#0c0d14' },
    { key: 'vignette', label: 'Vignette', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
  ],
};

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_phase;
uniform float u_spacing;
uniform float u_dot;
uniform vec2 u_focus;
uniform float u_rings;
uniform float u_ringWidth;
uniform float u_swell;
uniform float u_halo;
uniform float u_vignette;
uniform vec3 u_bg;
uniform vec3 u_dotColor;
uniform vec3 u_glow;

void main() {
  // Composition-pixel coordinates, so spacing means the same thing at every scale.
  vec2 px = vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution / u_scale;
  vec2 comp = u_resolution / u_scale;
  vec2 cell = floor(px / u_spacing);
  vec2 centre = (cell + 0.5) * u_spacing;
  float diag = length(comp);
  float r = length(centre - u_focus * comp) / diag;
  // Rings travel outward; fract keeps the phase periodic.
  float wave = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_rings) break;
    float ring = fract(u_phase + float(i) / u_rings);
    float d = abs(r - ring * 1.1);
    wave = max(wave, (1.0 - smoothstep(0.0, u_ringWidth, d)) * (1.0 - ring));
  }
  float radius = u_dot * (1.0 + u_swell * wave);
  float dist = length(px - centre);
  float aa = 1.0 / u_scale;
  float cover = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  vec3 dotCol = mix(u_dotColor, u_glow, clamp(wave * 1.2, 0.0, 1.0));
  float halo = u_halo * exp(-pow(length(px - u_focus * comp) / diag * 3.0, 2.0));
  vec3 col = u_bg + u_glow * halo * 0.6;
  col = mix(col, dotCol, cover);
  float vig = 1.0 - u_vignette * smoothstep(0.3, 0.9, length(v_uv - 0.5) * 1.3);
  outColor = vec4(col * vig, 1.0);
}`;

export function create(canvas) {
  const stage = createStage(canvas);
  const quad = createQuadRenderer(stage.gl, FRAGMENT);
  const rgb = (hex) => hexToRgba(hex).slice(0, 3);
  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      const loop = duration || meta.duration;
      stage.clear(P.background, false);
      quad.draw({
        u_resolution: [canvas.width, canvas.height],
        u_scale: stage.scale,
        u_phase: (time / (loop > 0 ? loop : 1)) % 1,
        u_spacing: P.spacing,
        u_dot: P.dotSize,
        u_focus: [P.focusX, P.focusY],
        u_rings: P.rings,
        u_ringWidth: P.ringWidth,
        u_swell: P.swell,
        u_halo: P.halo,
        u_vignette: P.vignette,
        u_bg: rgb(P.background),
        u_dotColor: rgb(P.dotColor),
        u_glow: rgb(P.glowColor),
      });
    },
    dispose() {
      quad.dispose();
    },
  };
}

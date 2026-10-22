import { createQuadRenderer, createStage, hexToRgba, resolveParams } from './_lib.js';
import { createLayerBlur } from './_blur.js';

/**
 * Y2K Mist: airy, diffused optical textures. Soft brush swooshes of colour,
 * glowing star sparkles, ringed orbs and a thin looping light ribbon, under a
 * milky haze and film grain. Shapes are Gaussian, so blur is an even defocus.
 */

const PALETTES = {
  'pigment-mist': ['#efe8e4', '#f6b6c8', '#f2ec9c', '#a3bba3', '#6f7f98', '#f07aa0'],
  'holo-meadow': ['#8fc97a', '#3f7df0', '#b27cf0', '#f7a35c', '#fff4c4', '#ffffff'],
  'night-aura': ['#251b2b', '#9b7cf0', '#f2b38a', '#e57aa8', '#a6e3b5', '#8ad8ff'],
  'cotton-candy': ['#fbe9f4', '#a7d8ff', '#ffb3de', '#d6c2ff', '#fff1a8', '#ffffff'],
  'chrome-dream': ['#d8dce6', '#9fb4d9', '#e6d3f5', '#b5efe4', '#f5e6c4', '#ffffff'],
  'sunset-tape': ['#2a1535', '#ff6fa8', '#ffb36b', '#ffe27a', '#7a5cff', '#ffd9f0'],
};

const COLOR_KEYS = ['base', 'color1', 'color2', 'color3', 'color4', 'color5'];
const custom = [{ key: 'palette', equals: 'custom' }];

export const meta = {
  id: 'y2k-mist',
  name: 'Y2K Mist',
  tagline: 'Diffused swooshes, sparkles and orbs in dreamy palettes',
  description:
    'Airy Y2K optical textures: soft brush swooshes of colour, glowing star sparkles, ringed orbs and a looping ribbon of light, under a milky haze and film grain. Every motion completes whole cycles, so it loops seamlessly.',
  duration: 10,
  vector: false,
  params: [
    {
      key: 'layerBlur',
      label: 'Layer blur',
      group: 'Blur',
      type: 'range',
      min: 0,
      max: 160,
      step: 1,
      default: 24,
      hint: 'An even Gaussian blur over the whole picture, like a layer blur in Figma. Measured in composition pixels, so it looks the same at any export size.',
    },
    {
      key: 'palette',
      label: 'Palette',
      group: 'Colour',
      type: 'select',
      options: [
        { value: 'pigment-mist', label: 'Pigment mist' },
        { value: 'holo-meadow', label: 'Holo meadow' },
        { value: 'night-aura', label: 'Night aura' },
        { value: 'cotton-candy', label: 'Cotton candy' },
        { value: 'chrome-dream', label: 'Chrome dream' },
        { value: 'sunset-tape', label: 'Sunset tape' },
        { value: 'custom', label: 'Custom…' },
      ],
      default: 'pigment-mist',
    },
    { key: 'base', label: 'Base', group: 'Colour', type: 'color', default: '#efe8e4', showWhen: custom },
    { key: 'color1', label: 'Colour 1', group: 'Colour', type: 'color', default: '#f6b6c8', showWhen: custom },
    { key: 'color2', label: 'Colour 2', group: 'Colour', type: 'color', default: '#f2ec9c', showWhen: custom },
    { key: 'color3', label: 'Colour 3', group: 'Colour', type: 'color', default: '#a3bba3', showWhen: custom },
    { key: 'color4', label: 'Colour 4', group: 'Colour', type: 'color', default: '#6f7f98', showWhen: custom },
    { key: 'color5', label: 'Accent', group: 'Colour', type: 'color', default: '#f07aa0', showWhen: custom },

    { key: 'swooshes', label: 'Swooshes', group: 'Swooshes', type: 'range', min: 0, max: 8, step: 1, default: 5 },
    { key: 'swooshWidth', label: 'Thickness', group: 'Swooshes', type: 'range', min: 0.03, max: 0.4, step: 0.005, default: 0.12 },
    { key: 'swooshLength', label: 'Length', group: 'Swooshes', type: 'range', min: 0.2, max: 2.5, step: 0.05, default: 1.1 },
    { key: 'swooshOpacity', label: 'Strength', group: 'Swooshes', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },

    { key: 'stars', label: 'Sparkles', group: 'Sparkles', type: 'range', min: 0, max: 8, step: 1, default: 2 },
    {
      key: 'points',
      label: 'Points',
      group: 'Sparkles',
      type: 'select',
      options: [
        { value: '4', label: '4 — classic sparkle' },
        { value: '6', label: '6 — star' },
        { value: '8', label: '8 — burst' },
        { value: 'mix', label: 'Mixed' },
      ],
      default: 'mix',
    },
    {
      key: 'starCrisp',
      label: 'Keep sharp',
      group: 'Sparkles',
      type: 'toggle',
      default: true,
      hint: 'Draw sparkles on top of the layer blur, so they stay distinct. Shape softness still applies.',
    },
    { key: 'starSize', label: 'Size', group: 'Sparkles', type: 'range', min: 0.03, max: 0.4, step: 0.005, default: 0.14 },
    { key: 'starSharpness', label: 'Ray sharpness', group: 'Sparkles', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'starGlow', label: 'Glow', group: 'Sparkles', type: 'range', min: 0, max: 1.5, step: 0.01, default: 0.8 },
    {
      key: 'twinkleCycles',
      label: 'Twinkles per loop',
      group: 'Sparkles',
      type: 'range',
      min: 0,
      max: 8,
      step: 1,
      default: 2,
      hint: 'Whole numbers keep the loop seamless.',
    },

    { key: 'orbs', label: 'Orbs', group: 'Orbs', type: 'range', min: 0, max: 10, step: 1, default: 3 },
    { key: 'orbSize', label: 'Size', group: 'Orbs', type: 'range', min: 0.01, max: 0.12, step: 0.002, default: 0.035 },
    { key: 'orbRing', label: 'Ring', group: 'Orbs', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },

    { key: 'ribbon', label: 'Light ribbon', group: 'Ribbon', type: 'toggle', default: false },
    {
      key: 'ribbonCrisp',
      label: 'Keep sharp',
      group: 'Ribbon',
      type: 'toggle',
      default: true,
      hint: 'Draw the ribbon on top of the layer blur, so it stays a crisp line.',
      showWhen: [{ key: 'ribbon', equals: true }],
    },
    { key: 'ribbonColor', label: 'Colour', group: 'Ribbon', type: 'color', default: '#ffffff', showWhen: [{ key: 'ribbon', equals: true }] },
    { key: 'ribbonLoops', label: 'Loops', group: 'Ribbon', type: 'range', min: 0, max: 4, step: 1, default: 1, showWhen: [{ key: 'ribbon', equals: true }] },
    { key: 'ribbonY', label: 'Height', group: 'Ribbon', type: 'range', min: -0.45, max: 0.45, step: 0.01, default: 0.1, showWhen: [{ key: 'ribbon', equals: true }] },
    { key: 'ribbonWidth', label: 'Line width', group: 'Ribbon', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.2, showWhen: [{ key: 'ribbon', equals: true }] },

    {
      key: 'blur',
      label: 'Shape softness',
      group: 'Atmosphere',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.55,
      hint: 'Softens each shape’s own edges. For an even blur over everything, use Layer blur.',
    },
    { key: 'haze', label: 'Milky haze', group: 'Atmosphere', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'grain', label: 'Grain', group: 'Atmosphere', type: 'range', min: 0, max: 0.25, step: 0.005, default: 0.08 },
    { key: 'seed', label: 'Arrangement', group: 'Atmosphere', type: 'range', min: 0, max: 60, step: 1, default: 4 },
    {
      key: 'driftCycles',
      label: 'Drift cycles',
      group: 'Atmosphere',
      type: 'range',
      min: 0,
      max: 4,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'drift', label: 'Drift amount', group: 'Atmosphere', type: 'range', min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
};

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_angle;
uniform float u_twinkle;
uniform float u_seed;
uniform vec3 u_pal[6];
uniform float u_swooshes;
uniform float u_swW;
uniform float u_swL;
uniform float u_swA;
uniform float u_stars;
uniform float u_points;   // 0 = mixed
uniform float u_starSize;
uniform float u_sharp;
uniform float u_glow;
uniform float u_orbs;
uniform float u_orbSize;
uniform float u_orbRing;
uniform float u_ribbon;
uniform vec3 u_ribbonColor;
uniform float u_loops;
uniform float u_ribbonY;
uniform float u_ribbonW;
uniform float u_blur;
uniform float u_haze;
uniform float u_grain;
uniform float u_drift;
uniform float u_mode;   // 0 = picture, 1 = crisp ribbon overlay
uniform float u_crisp;
uniform float u_starCrisp;

const float TAU = 6.28318530718;

float h1(float n) { return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453); }
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 pal(float i) { int k = int(mod(i, 5.0)) + 1; return u_pal[k]; }
vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
// Premultiplied 'over', for the sharp overlay pass.
vec4 over(vec3 c, float a, vec4 dst) { return vec4(c * a, a) + dst * (1.0 - a); }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
  vec3 col = u_pal[0];
  vec4 ov = vec4(0.0);  // overlay pass accumulates here
  float soft = mix(0.6, 1.8, u_blur);

  // --- swooshes: brush strokes along circular arcs, Gaussian across and along.
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= u_swooshes) break;
    float ph = h1(fi + 2.0) * TAU;
    vec2 c = vec2((h1(fi) - 0.5) * aspect * 1.1, (h1(fi + 11.0) - 0.5) * 1.1);
    c += vec2(cos(u_angle + ph), sin(u_angle + ph)) * 0.08 * u_drift;
    float R = 0.25 + 0.6 * h1(fi + 5.0);
    float dir = h1(fi + 17.0) * TAU + 0.35 * u_drift * sin(u_angle + ph);
    vec2 q = rot(-dir) * (p - c);
    float ang = atan(q.y, q.x);
    float across = abs(length(q) - R);
    float w = u_swW * (0.6 + 0.8 * h1(fi + 23.0)) * soft;
    float span = u_swL * (0.5 + 0.5 * h1(fi + 29.0));
    float g = exp(-0.5 * pow(across / w, 2.0)) * exp(-0.5 * pow(ang / span, 2.0));
    col = mix(col, pal(fi), clamp(g * u_swA, 0.0, 1.0));
  }

  // --- orbs: warm core, coloured ring, cool halo.
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    if (fi >= u_orbs) break;
    float ph = h1(fi + 41.0) * TAU;
    vec2 c = vec2((h1(fi + 43.0) - 0.5) * aspect * 0.95, (h1(fi + 47.0) - 0.5) * 0.9);
    c.y += sin(u_angle + ph) * 0.03 * u_drift;
    float s = u_orbSize * (0.6 + 0.8 * h1(fi + 53.0));
    float r = length(p - c);
    float b = mix(0.18, 0.5, u_blur) * s;
    float core = exp(-0.5 * pow(r / (s * 0.75), 2.0));
    float ring = exp(-0.5 * pow((r - s) / b, 2.0)) * u_orbRing;
    float halo = exp(-0.5 * pow(r / (s * 2.6 * soft), 2.0)) * 0.35;
    col = screen(col, vec3(1.0) * halo * 0.6);
    col = mix(col, pal(3.0 + fi), clamp(ring, 0.0, 1.0));
    col = mix(col, mix(pal(2.0 + fi), vec3(1.0, 0.95, 0.7), 0.35), clamp(core, 0.0, 1.0));
  }

  // --- light ribbon: a thin prolate-cycloid curve with loops, softly glowing.
  if (u_ribbon > 0.5 && (u_mode > 0.5 || u_crisp < 0.5)) {
    float d = 1e9;
    float sway = sin(u_angle) * 0.03 * u_drift;
    float loops = max(u_loops, 0.0);
    vec2 prev = vec2(0.0);
    float span = 1.1 * aspect;
    // A prolate cycloid only loops when the curl outruns the sweep, so size the
    // curl from the loop count.
    float bb = loops > 0.0 ? 1.35 * span / (TAU * loops) : 0.0;
    for (int k = 0; k <= 120; k++) {
      float t = float(k) / 120.0;
      float th = t * TAU * loops + 3.14159265;  // loops land mid-frame, not at the edges
      vec2 pt = vec2(-0.5 * span + t * span - bb * sin(th), u_ribbonY + sway + 0.12 * sin(t * 3.1 + u_seed) + bb * (1.0 + cos(th)) * 0.5);
      if (k > 0) d = min(d, segDist(p, prev, pt));
      prev = pt;
    }
    // Width in composition pixels; antialias over ~1.2 device pixels.
    float compH = u_resolution.y / max(u_scale, 0.0001);
    float lw = u_ribbonW / compH;
    float aa = 1.2 / u_resolution.y;
    float line = 1.0 - smoothstep(lw * 0.5, lw * 0.5 + aa, d);
    float glow = exp(-0.5 * pow(d / (lw * 4.0 + 0.004), 2.0)) * 0.45;
    if (u_mode > 0.5) {
      ov = over(u_ribbonColor, clamp(line + glow, 0.0, 1.0), ov);
    } else {
      col = screen(col, u_ribbonColor * glow);
      col = mix(col, u_ribbonColor, line);
    }
  }

  // --- sparkles: n-point stars with a hot core and rays, twinkling.
  // Sharp sparkles are drawn in the overlay pass instead of the blurred picture.
  bool starsHere = (u_mode > 0.5) == (u_starCrisp > 0.5);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= u_stars || !starsHere) break;
    float ph = h1(fi + 61.0) * TAU;
    vec2 c = vec2((h1(fi + 67.0) - 0.5) * aspect * 0.85, (h1(fi + 71.0) - 0.5) * 0.85);
    c += vec2(sin(u_angle + ph), cos(u_angle + ph)) * 0.02 * u_drift;
    float n = u_points > 0.5 ? u_points : (h1(fi + 73.0) < 0.6 ? 4.0 : 6.0);
    float tw = 1.0 + 0.18 * sin(u_twinkle + ph);
    float size = u_starSize * (0.55 + 0.9 * h1(fi + 79.0)) * tw;
    vec2 q = rot(0.25 * sin(u_angle + ph) * u_drift + h1(fi + 83.0) * 0.4) * (p - c);
    float r = length(q);
    float th = atan(q.y, q.x);
    // Generalised astroid: concave sides tapering from a solid centre to needle
    // tips. Lower exponents give thinner, sharper rays.
    float e = mix(0.95, 0.22, clamp((u_sharp - 1.0) / 11.0, 0.0, 1.0));
    float k = th * n * 0.25;
    float R = pow(pow(abs(cos(k)), e) + pow(abs(sin(k)), e), -1.0 / e);
    float body = exp(-0.5 * pow(r / (size * R * 0.42 * soft), 2.0));
    float core = exp(-0.5 * pow(r / (size * 0.12 * soft), 2.0));
    float halo = exp(-0.5 * pow(r / (size * 0.9 * soft), 2.0)) * 0.35 * u_glow;
    vec3 rayCol = pal(fi + 2.0);
    vec3 coreCol = mix(pal(fi + 4.0), vec3(1.0), 0.25);
    vec3 bodyCol = mix(rayCol, vec3(1.0), 0.2 * u_glow);
    if (u_mode > 0.5) {
      ov = over(rayCol, clamp(halo, 0.0, 1.0) * 0.7, ov);
      ov = over(bodyCol, clamp(body, 0.0, 1.0), ov);
      ov = over(coreCol, clamp(core * 1.2, 0.0, 1.0), ov);
    } else {
      col = screen(col, rayCol * halo);
      col = mix(col, bodyCol, clamp(body, 0.0, 1.0));
      col = mix(col, coreCol, clamp(core * 1.2, 0.0, 1.0));
    }
  }
  if (u_mode > 0.5) {
    outColor = ov;
    return;
  }

  // --- atmosphere: milky haze, then grain.
  float mist = u_haze * (0.55 + 0.45 * sin(p.x * 2.1 + p.y * 1.3 + u_angle));
  col = mix(col, mix(u_pal[0], vec3(1.0), 0.6), mist * 0.6);
  col += (hash(v_uv * u_resolution + fract(u_angle) * 37.0) - 0.5) * u_grain;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function create(canvas) {
  const stage = createStage(canvas);
  const quad = createQuadRenderer(stage.gl, FRAGMENT);
  const blur = createLayerBlur(stage.gl);
  const colors = new Float32Array(18);
  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      const loop = duration || meta.duration;
      const f = time / (loop > 0 ? loop : 1);
      const hexes = PALETTES[P.palette] ?? COLOR_KEYS.map((k) => P[k]);
      hexes.forEach((hex, i) => {
        const [r, g, b] = hexToRgba(hex);
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      });
      const gl = stage.gl;
      blur.render({
        width: canvas.width,
        height: canvas.height,
        sigma: P.layerBlur * 0.5 * stage.scale,
        grain: P.grain,
        seed: f,
        paint: (w, h, ds) => {
          gl.clearColor(colors[0], colors[1], colors[2], 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          quad.draw({
        u_resolution: [w, h],
        u_scale: stage.scale / ds,
        u_angle: 2 * Math.PI * f * P.driftCycles,
        u_twinkle: 2 * Math.PI * f * P.twinkleCycles,
        u_seed: P.seed,
        'u_pal[0]': { array: colors, size: 3 },
        u_swooshes: P.swooshes,
        u_swW: P.swooshWidth,
        u_swL: P.swooshLength,
        u_swA: P.swooshOpacity,
        u_stars: P.stars,
        u_points: P.points === 'mix' ? 0 : Number(P.points),
        u_starSize: P.starSize,
        u_sharp: P.starSharpness,
        u_glow: P.starGlow,
        u_orbs: P.orbs,
        u_orbSize: P.orbSize,
        u_orbRing: P.orbRing,
        u_ribbon: P.ribbon ? 1 : 0,
        u_ribbonColor: hexToRgba(P.ribbonColor).slice(0, 3),
        u_loops: P.ribbonLoops,
        u_ribbonY: P.ribbonY,
        u_ribbonW: P.ribbonWidth,
        u_blur: P.blur,
        u_haze: P.haze,
        u_grain: 0,
        u_drift: P.drift,
        u_mode: 0,
        u_crisp: P.ribbonCrisp ? 1 : 0,
        u_starCrisp: P.starCrisp ? 1 : 0,
      });
        },
      });
      const sharpRibbon = P.ribbon && P.ribbonCrisp;
      const sharpStars = P.stars > 0 && P.starCrisp;
      if (sharpRibbon || sharpStars) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        quad.draw({
          u_resolution: [canvas.width, canvas.height],
          u_scale: stage.scale,
          u_angle: 2 * Math.PI * f * P.driftCycles,
          u_seed: P.seed,
          u_ribbon: sharpRibbon ? 1 : 0,
          u_ribbonColor: hexToRgba(P.ribbonColor).slice(0, 3),
          u_loops: P.ribbonLoops,
          u_ribbonY: P.ribbonY,
          u_ribbonW: P.ribbonWidth,
          u_drift: P.drift,
          u_swooshes: 0,
          u_orbs: 0,
          u_stars: sharpStars ? P.stars : 0,
          u_starCrisp: 1,
          u_twinkle: 2 * Math.PI * f * P.twinkleCycles,
          u_points: P.points === 'mix' ? 0 : Number(P.points),
          u_starSize: P.starSize,
          u_sharp: P.starSharpness,
          u_glow: P.starGlow,
          u_blur: P.blur,
          'u_pal[0]': { array: colors, size: 3 },
          u_mode: 1,
          u_crisp: 1,
        });
      }
    },
    dispose() {
      blur.dispose();
      quad.dispose();
    },
  };
}

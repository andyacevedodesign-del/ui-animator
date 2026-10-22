import { createQuadRenderer, createStage, hexToRgba, resolveParams } from './_lib.js';

export const meta = {
  id: 'blurred-summer',
  name: 'Blurred Summer',
  tagline: 'Out-of-focus flowers swaying under a soft, drifting sky',
  description:
    'A dreamy, defocused summer scene: a blue sky with cream cloud streaks billowing across it, and blurred blooms in the foreground swaying in the wind. Heavy film grain finishes the faded-photo look. Every motion completes whole cycles, so it loops seamlessly.',
  duration: 10,
  vector: false,
  params: [
    { key: 'skyTop', label: 'Sky top', group: 'Sky', type: 'color', default: '#3d9ccf' },
    { key: 'skyBottom', label: 'Sky bottom', group: 'Sky', type: 'color', default: '#9fd1dc' },
    { key: 'cloudColor', label: 'Cloud colour', group: 'Sky', type: 'color', default: '#f7e6d2' },
    { key: 'cloudAmount', label: 'Cloud cover', group: 'Sky', type: 'range', min: 0, max: 1, step: 0.01, default: 0.62 },
    { key: 'cloudStretch', label: 'Streak length', group: 'Sky', type: 'range', min: 1, max: 6, step: 0.1, default: 3.2 },
    { key: 'cloudAngle', label: 'Streak angle', group: 'Sky', type: 'range', min: -60, max: 60, step: 1, default: 18 },
    {
      key: 'skyBlur',
      label: 'Sky blur',
      group: 'Sky',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      hint: 'Removes fine detail evenly, like a lens out of focus. 0 keeps crisp wisps.',
    },
    {
      key: 'cloudWarp',
      label: 'Turbulence',
      group: 'Sky',
      type: 'range',
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 0.45,
      hint: 'How much the streaks billow and fold. Lower for smoother, calmer bands.',
    },
    {
      key: 'skyCycles',
      label: 'Sky drift cycles',
      group: 'Sky',
      type: 'range',
      min: 0,
      max: 3,
      step: 1,
      default: 1,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'flowerColor', label: 'Flower colour', group: 'Flowers', type: 'color', default: '#ff7a59' },
    { key: 'flowerGlow', label: 'Flower glow', group: 'Flowers', type: 'color', default: '#ffb08a' },
    { key: 'flowers', label: 'Flowers', group: 'Flowers', type: 'range', min: 0, max: 16, step: 1, default: 6 },
    { key: 'flowerSize', label: 'Size', group: 'Flowers', type: 'range', min: 0.02, max: 0.2, step: 0.005, default: 0.075 },
    {
      key: 'flowerBlur',
      label: 'Flower blur',
      group: 'Flowers',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.35,
      hint: 'Soft Gaussian defocus. Low is a crisp bloom, high melts into a glow.',
    },
    { key: 'seed', label: 'Arrangement', group: 'Flowers', type: 'range', min: 0, max: 50, step: 1, default: 7 },
    { key: 'wind', label: 'Wind strength', group: 'Wind', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    {
      key: 'gustCycles',
      label: 'Gusts per loop',
      group: 'Wind',
      type: 'range',
      min: 1,
      max: 6,
      step: 1,
      default: 2,
      hint: 'Whole numbers keep the loop seamless.',
    },
    { key: 'grain', label: 'Grain', group: 'Finish', type: 'range', min: 0, max: 0.25, step: 0.005, default: 0.09 },
    { key: 'haze', label: 'Haze', group: 'Finish', type: 'range', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'background', label: 'Base colour', group: 'Finish', type: 'color', default: '#9fd1dc' },
  ],
};

const MAX_FLOWERS = 16;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_resolution;
uniform float u_angle;      // sky loop angle
uniform float u_gust;       // wind loop angle
uniform vec3 u_skyTop;
uniform vec3 u_skyBottom;
uniform vec3 u_cloud;
uniform float u_cloudAmount;
uniform float u_stretch;
uniform float u_cloudAngle;
uniform float u_skyBlur;
uniform float u_warp;
uniform vec3 u_flower;
uniform vec3 u_glow;
uniform float u_count;
uniform float u_size;
uniform float u_blur;
uniform float u_seed;
uniform float u_wind;
uniform float u_grain;
uniform float u_haze;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float h1(float n) { return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Value-noise fbm seen through a Gaussian blur of width \`blur\`. Blurring
// multiplies each frequency band by exp(-(f*sigma)^2), so fine octaves fade
// out smoothly instead of being clipped — an even, lens-like softness.
float fbm(vec2 p, float blur) {
  float s = 0.0, a = 0.5, f = 1.0, norm = 0.0;
  for (int i = 0; i < 5; i++) {
    float w = exp(-pow(f * blur, 2.0));
    s += a * w * (noise(p) - 0.5);
    norm += a * w;
    p = p * 2.03 + 17.1;
    a *= 0.5;
    f *= 2.03;
  }
  // Re-normalise so blurring softens shape, not cloud cover.
  return 0.5 + 0.5 * s / max(norm, 0.0001);
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 uv = v_uv;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // --- sky: vertical ramp + streaky clouds, drifting on a closed loop.
  vec3 col = mix(u_skyBottom, u_skyTop, smoothstep(0.0, 1.0, uv.y));
  float ca = radians(u_cloudAngle);
  mat2 rot = mat2(cos(ca), -sin(ca), sin(ca), cos(ca));
  vec2 q = rot * p;
  q.x /= u_stretch;                         // long streaks along the wind
  vec2 drift = vec2(cos(u_angle), sin(u_angle)) * 0.45;
  float sb = u_skyBlur * 1.3;
  // The warp field is always smoother than the clouds, or it folds them into creases.
  vec2 warp = vec2(fbm(q * 1.6 + drift, sb + 0.6), fbm(q * 1.6 - drift + 3.7, sb + 0.6)) - 0.5;
  float c = fbm(q * 2.4 + warp * u_warp * 2.0 + drift * 0.6, sb);
  float lo = mix(0.62, 0.38, u_cloudAmount);
  float width = mix(0.04, 0.22, u_skyBlur);
  float cloud = smoothstep(lo - width, lo + width, c);
  col = mix(col, u_cloud, cloud * 0.9);

  // --- flowers: defocused blooms swaying in the wind.
  for (int i = 0; i < ${MAX_FLOWERS}; i++) {
    float fi = float(i);
    if (fi >= u_count) break;
    vec2 home = vec2((h1(fi) - 0.5) * aspect * 0.95, (h1(fi + 31.0) - 0.5) * 0.9);
    float size = u_size * (0.6 + 0.8 * h1(fi + 7.0));
    float phase = h1(fi + 13.0) * 6.2832;
    // Gusts: a broad sway plus a quicker flutter; nearer (bigger) blooms move more.
    float sway = sin(u_gust + phase) + 0.35 * sin(2.0 * u_gust + phase * 1.7);
    vec2 off = vec2(sway * 0.06, cos(u_gust + phase) * 0.018) * u_wind * (size / u_size);
    vec2 d = p - home - off;
    // Stretched along the motion, like a petal caught mid-move.
    float lean = sway * u_wind * 0.35;
    d = mat2(cos(lean), -sin(lean), sin(lean), cos(lean)) * d;
    d.x /= 1.0 + 0.35 * h1(fi + 3.0);
    // Two overlapping lobes read as a blossom rather than a dot.
    vec2 lobe = vec2(size * 0.45, size * 0.1) * (h1(fi + 5.0) > 0.5 ? 1.0 : -1.0);
    // A defocused blossom is its shape convolved with a Gaussian: model it as
    // two Gaussian lobes, with the spread growing with blur. No hard edge, no ring.
    float sigma = size * mix(0.38, 1.15, u_blur);
    vec2 a1 = (d - lobe * 0.5) / sigma;
    vec2 a2 = (d + lobe * 0.5) / sigma;
    float g = exp(-0.5 * dot(a1, a1)) + exp(-0.5 * dot(a2, a2));
    // Soft saturation: a dense core when sharp, a translucent glow when very blurred.
    float alpha = 1.0 - exp(-g * mix(5.0, 1.4, u_blur));
    vec3 tint = mix(u_glow, u_flower, alpha);
    col = mix(col, tint, alpha);
  }

  // --- finish: milky haze toward the bottom, then grain.
  col = mix(col, u_cloud, u_haze * smoothstep(0.6, 0.0, uv.y) * 0.6);
  col += (hash(uv * u_resolution + fract(u_angle) * 91.0) - 0.5) * u_grain;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
      const f = time / (loop > 0 ? loop : 1);
      stage.clear(P.background, false);
      quad.draw({
        u_resolution: [canvas.width, canvas.height],
        u_angle: 2 * Math.PI * f * P.skyCycles,
        u_gust: 2 * Math.PI * f * P.gustCycles,
        u_skyTop: rgb(P.skyTop),
        u_skyBottom: rgb(P.skyBottom),
        u_cloud: rgb(P.cloudColor),
        u_cloudAmount: P.cloudAmount,
        u_stretch: P.cloudStretch,
        u_cloudAngle: P.cloudAngle,
        u_skyBlur: P.skyBlur,
        u_warp: P.cloudWarp,
        u_flower: rgb(P.flowerColor),
        u_glow: rgb(P.flowerGlow),
        u_count: Math.min(MAX_FLOWERS, P.flowers),
        u_size: P.flowerSize,
        u_blur: P.flowerBlur,
        u_seed: P.seed,
        u_wind: P.wind,
        u_grain: P.grain,
        u_haze: P.haze,
      });
    },
    dispose() {
      quad.dispose();
    },
  };
}

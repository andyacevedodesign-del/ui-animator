import {
  GRADIENT_GLSL,
  clamp,
  createQuadRenderer,
  createStage,
  gradientUniforms,
  hexToRgba,
  resolveBackground,
  resolveParams,
} from './_lib.js';

/** Uniform array length. The shader is compiled against this, so it is fixed. */
const MAX_CLOUDS = 48;

/** A starting sky: a few big ones high up, smaller ones trailing below. */
const DEFAULT_CLOUDS = [
  { x: 0.08, y: 0.2, s: 0.62, seed: 0.14 },
  { x: 0.3, y: 0.41, s: 0.4, seed: 0.51 },
  { x: 0.52, y: 0.14, s: 0.78, seed: 0.29 },
  { x: 0.72, y: 0.36, s: 0.5, seed: 0.83 },
  { x: 0.88, y: 0.18, s: 0.66, seed: 0.37 },
  { x: 0.18, y: 0.6, s: 0.34, seed: 0.66 },
  { x: 0.63, y: 0.64, s: 0.3, seed: 0.92 },
];

export const meta = {
  id: 'drifting-clouds',
  name: 'Drifting Clouds',
  tagline: 'Cumulus crossing a blue sky',
  description:
    'Place cumulus by hand and let them drift across a gradient sky, wrapping edge to edge. Each cloud is a cluster of metaball lobes with a domed top and a flat base, its silhouette churned by noise. Bigger clouds read as nearer and outrun the small ones. Pure fragment shader, so raster export only (no Lottie).',
  duration: 20,
  vector: false,
  params: [
    // --- Clouds -----------------------------------------------------------
    {
      key: 'clouds',
      label: 'Clouds',
      group: 'Clouds',
      type: 'points',
      max: MAX_CLOUDS,
      default: DEFAULT_CLOUDS,
      hint: 'Click the sky to add one, drag to move it, arrow keys to nudge. Type a count to fill the frame in one go. Positions are fractions of the frame, so they hold their place at any composition size.',
    },
    {
      key: 'cloudSize',
      label: 'Cloud size',
      group: 'Clouds',
      type: 'range',
      min: 0.05,
      max: 0.6,
      step: 0.01,
      default: 0.26,
      hint: 'Scales every cloud at once. Each one keeps its own size on top of this.',
    },
    { key: 'fluff', label: 'Fluff', group: 'Clouds', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45 },
    {
      key: 'softness',
      label: 'Edge softness',
      group: 'Clouds',
      type: 'range',
      min: 0.05,
      max: 1.5,
      step: 0.01,
      default: 0.5,
    },
    {
      key: 'flatBase',
      label: 'Flat base',
      group: 'Clouds',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      hint: 'Cumulus sit on a level bottom. Turn this down for shapeless puffs.',
    },
    { key: 'cloudOpacity', label: 'Opacity', group: 'Clouds', type: 'range', min: 0, max: 1, step: 0.01, default: 0.94 },

    // --- Motion -----------------------------------------------------------
    {
      key: 'driftCycles',
      label: 'Drift cycles',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 6,
      step: 1,
      default: 2,
      hint: 'How many times the sky crosses itself sideways per loop. Whole numbers keep the loop seamless.',
    },
    {
      key: 'riseCycles',
      label: 'Rise cycles',
      group: 'Motion',
      type: 'range',
      min: -4,
      max: 4,
      step: 1,
      default: 1,
      hint: 'Vertical travel: positive rises, negative sinks. Anything other than 0 wraps the sky top to bottom, so a cloud leaving the top returns at the horizon.',
    },
    {
      key: 'parallax',
      label: 'Parallax',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
      hint: 'Bigger clouds drift faster on both axes, as if nearer. Every cloud still has to wrap a whole number of times per loop, so the spread is quantised — raise the cycle counts to give it more room.',
    },
    {
      key: 'bob',
      label: 'Vertical bob',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 0.3,
      step: 0.005,
      default: 0.025,
      hint: 'Up-and-down float on top of any travel. Each cloud bobs on its own phase.',
    },
    { key: 'bobCycles', label: 'Bob cycles', group: 'Motion', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    {
      key: 'churn',
      label: 'Edge churn',
      group: 'Motion',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.25,
      hint: 'Slowly reshapes each silhouette over the loop.',
    },

    // --- Retro ------------------------------------------------------------
    { key: 'pixelate', label: 'Pixelate', group: 'Retro', type: 'toggle', default: false },
    {
      key: 'pixelSize',
      label: 'Pixel size',
      group: 'Retro',
      type: 'range',
      min: 2,
      max: 64,
      step: 1,
      default: 8,
      hint: 'Block size in composition pixels, so the blocks stay the same fraction of the frame whatever you export at.',
      showWhen: [{ key: 'pixelate', equals: true }],
    },
    {
      key: 'pixelTarget',
      label: 'Apply to',
      group: 'Retro',
      type: 'select',
      options: [
        { value: 'both', label: 'Clouds and sky' },
        { value: 'clouds', label: 'Clouds only' },
        { value: 'sky', label: 'Sky only' },
      ],
      default: 'both',
      showWhen: [{ key: 'pixelate', equals: true }],
    },

    // --- Style ------------------------------------------------------------
    { key: 'cloudTop', label: 'Cloud highlight', group: 'Style', type: 'color', default: '#ffffff' },
    { key: 'cloudShadow', label: 'Cloud underside', group: 'Style', type: 'color', default: '#9db6d4' },
    { key: 'shading', label: 'Shading', group: 'Style', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
    {
      key: 'haze',
      label: 'Horizon haze',
      group: 'Style',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.45,
      hint: 'Fades clouds out as they sit lower in frame, which reads as distance.',
    },
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
      default: '3',
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }],
    },
    { key: 'background', label: 'Background colour', group: 'Style', type: 'color', default: '#1a5fb0' },
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
      default: '#5ba3de',
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
      default: 0.62,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', oneOf: ['3', '4'] }],
    },
    {
      key: 'gradientMidColor2',
      label: 'Middle colour 2',
      group: 'Style',
      type: 'color',
      default: '#a9d5f2',
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
      default: 0.85,
      showWhen: [{ key: 'backgroundMode', equals: 'gradient' }, { key: 'gradientStops', equals: '4' }],
    },
    {
      key: 'background2',
      label: 'End colour',
      group: 'Style',
      type: 'color',
      default: '#d8ecfa',
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

const CLOUD_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_count;
uniform vec3 u_cloud[${MAX_CLOUDS}];      // x, y (both 0..1, y from the top), size
uniform float u_cloudSeed[${MAX_CLOUDS}];
uniform float u_size;
uniform float u_fluff;
uniform float u_softness;
uniform float u_flatBase;
uniform float u_opacity;
uniform float u_shading;
uniform float u_haze;
uniform float u_churn;
uniform float u_angle;        // loop phase, 0..2pi
uniform float u_wrapY;
uniform vec2 u_pixel;         // block size in uv units, 0 = off
uniform float u_pixelClouds;
uniform float u_pixelSky;
uniform float u_transparent;
uniform vec3 u_cloudTop;
uniform vec3 u_cloudShadow;
${GRADIENT_GLSL}

float hash1(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p) {
  return 0.6 * valueNoise(p) + 0.3 * valueNoise(p * 2.03) + 0.1 * valueNoise(p * 4.07);
}

/**
 * A cumulus silhouette as overlapping metaballs. Lobes spread along x and ride a
 * shallow arc — highest in the middle, dropping at the edges — which is what
 * gives the domed top and level base a cumulus reads by.
 */
/**
 * Snaps a coordinate to the centre of its block, so everything downstream is
 * evaluated once per block instead of once per pixel — real pixelation rather
 * than a blur. The block size arrives in uv units measured against the
 * composition, so it covers the same fraction of the frame at any export scale.
 */
vec2 blockify(vec2 uv) {
  if (u_pixel.x <= 0.0 || u_pixel.y <= 0.0) return uv;
  return (floor(uv / u_pixel) + 0.5) * u_pixel;
}

float lobeField(vec2 q, float seed) {
  float f = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float a = hash1(seed * 91.7 + fi * 3.17 + 1.0);
    float b = hash1(seed * 47.3 + fi * 7.71 + 2.0);
    float c = hash1(seed * 13.1 + fi * 5.33 + 3.0);
    float spread = (fi / 5.0 - 0.5) * 1.42 + (a - 0.5) * 0.30;
    vec2 o = vec2(spread, b * 0.40 - 0.13 - abs(spread) * 0.46);
    // Small enough relative to the spacing that the lobes scallop the top rather
    // than fusing into one smooth mound.
    float r = 0.19 + 0.17 * c;
    vec2 d = q - o;
    f += (r * r) / max(dot(d, d), 0.004);
  }
  return f;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  // v_uv has y = 0 at the bottom. Clouds and sky get their own coordinate so
  // either can be blocked up without the other.
  vec2 uv = u_pixelClouds > 0.5 ? blockify(v_uv) : v_uv;
  vec2 uvSky = u_pixelSky > 0.5 ? blockify(v_uv) : v_uv;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Noise sampled around a circle returns to where it started at the end of the
  // loop, so the churn is seamless.
  vec2 loopOffset = vec2(cos(u_angle), sin(u_angle)) * u_churn;

  vec3 acc = vec3(0.0);   // premultiplied colour
  float alpha = 0.0;

  for (int i = 0; i < ${MAX_CLOUDS}; i++) {
    if (float(i) >= u_count) break;
    vec3 cloud = u_cloud[i];
    float radius = max(cloud.z * u_size, 0.004);

    // Wrap across the frame so a cloud leaving the right returns on the left.
    float dx = p.x - cloud.x * aspect;
    dx -= aspect * floor(dx / aspect + 0.5);
    // Vertical wrap only when something is actually travelling up or down —
    // otherwise a cloud parked near the top would show a slice at the horizon.
    float dy = uv.y - (1.0 - cloud.y);
    if (u_wrapY > 0.5) dy -= floor(dy + 0.5);
    vec2 q = vec2(dx, dy) / radius;

    // Most pixels are outside most clouds; skipping them early is what keeps a
    // skyful of clouds affordable.
    if (dot(q, q) > 4.0) continue;

    float seed = u_cloudSeed[i];
    vec2 warped = q;
    if (u_fluff > 0.0) {
      // The per-cloud offset is deliberately small. valueNoise hashes by
      // multiplying its input by ~456 and taking the fraction, so once the
      // coordinate runs into the hundreds float32 stops resolving it and the
      // field quantises into flat blocks with hard edges between them.
      vec2 offset = vec2(fract(seed * 7.13), fract(seed * 3.71)) * 6.0;
      vec2 n = vec2(fbm2(q * 1.7 + loopOffset + offset), fbm2(q * 1.7 + loopOffset + offset + 3.7));
      // A second, finer pass roughens the edge; the coarse one alone just
      // wobbles the whole silhouette. Built from q rather than from the coarse
      // coordinate, which would multiply that offset up again.
      vec2 fine = vec2(fbm2(q * 5.9 + loopOffset + offset + 8.1), fbm2(q * 5.9 + loopOffset + offset + 12.4));
      warped += ((n - 0.5) + (fine - 0.5) * 0.45) * u_fluff;
    }

    float m = smoothstep(1.0, 1.0 + u_softness, lobeField(warped, seed));
    m *= mix(1.0, smoothstep(-0.62, -0.30, warped.y), u_flatBase);
    if (m <= 0.0) continue;

    float a = m * u_opacity;
    // Lower in frame reads as further away, so haze takes it.
    a *= mix(1.0, smoothstep(0.0, 0.45, uv.y), u_haze);

    float lit = mix(1.0, smoothstep(0.15, 0.85, clamp(q.y * 0.5 + 0.55, 0.0, 1.0)), u_shading);
    vec3 tint = mix(u_cloudShadow, u_cloudTop, lit);

    acc += tint * a * (1.0 - alpha);
    alpha += a * (1.0 - alpha);
  }

  if (u_transparent > 0.5) {
    outColor = vec4(acc, alpha); // already premultiplied
  } else {
    vec3 sky = gradientColor(gradientT(uvSky));
    outColor = vec4(sky * (1.0 - alpha) + acc, 1.0);
  }
}`;

/** Tolerates hand-edited project files: anything malformed falls back rather than throwing. */
function normalizeClouds(value) {
  const list = Array.isArray(value) ? value : DEFAULT_CLOUDS;
  const out = [];
  for (let i = 0; i < list.length && out.length < MAX_CLOUDS; i++) {
    const cloud = list[i];
    if (!cloud || typeof cloud !== 'object') continue;
    const x = Number(cloud.x);
    const y = Number(cloud.y);
    const s = Number(cloud.s);
    const seed = Number(cloud.seed);
    out.push({
      x: Number.isFinite(x) ? x : 0.5,
      y: Number.isFinite(y) ? y : 0.4,
      s: clamp(Number.isFinite(s) ? s : 0.5, 0.02, 1),
      seed: Number.isFinite(seed) ? seed : (i + 1) * 0.137,
    });
  }
  return out;
}

export function create(canvas) {
  const stage = createStage(canvas);
  const quad = createQuadRenderer(stage.gl, CLOUD_FRAGMENT);
  // Reused every frame so the render loop does not allocate.
  const cloudData = new Float32Array(MAX_CLOUDS * 3);
  const seedData = new Float32Array(MAX_CLOUDS);

  return {
    setSize(width, height, pixelScale) {
      stage.setSize(width, height, pixelScale);
    },
    render(time, params, duration) {
      const P = resolveParams(meta, params);
      const loop = duration || meta.duration;
      const progress = loop > 0 ? time / loop : 0;
      const clouds = normalizeClouds(P.clouds);

      cloudData.fill(0);
      seedData.fill(0);
      const wrapY = Math.round(P.riseCycles) !== 0;
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        // Each cloud must wrap a whole number of times per loop on both axes or
        // the last frame will not meet the first, so the parallax spread is
        // rounded. The same factor drives both: one cloud being nearer should
        // speed up all of its travel, not just the sideways part.
        const factor = 1 - P.parallax * 0.55 + P.parallax * 1.3 * cloud.s;
        const across = Math.max(0, Math.round(P.driftCycles * factor));
        const up = Math.round(P.riseCycles * factor);
        const bob = P.bob * Math.sin(2 * Math.PI * (P.bobCycles * progress + cloud.seed));
        // y runs downward from the top, so rising means subtracting.
        const y = cloud.y - up * progress + bob;
        cloudData[i * 3] = (((cloud.x + across * progress) % 1) + 1) % 1;
        cloudData[i * 3 + 1] = wrapY ? ((y % 1) + 1) % 1 : y;
        cloudData[i * 3 + 2] = cloud.s;
        seedData[i] = cloud.seed;
      }

      const pixelate = P.pixelate === true && P.pixelSize > 0;
      const fill = resolveBackground(P);
      // A solid background is just a one-colour ramp, so the same uniforms serve both.
      const flat = { ...fill, stops: [{ color: fill.from, pos: 0 }, { color: fill.from, pos: 1 }] };
      const top = hexToRgba(P.cloudTop);
      const shadow = hexToRgba(P.cloudShadow);

      stage.clear(P.background, P.transparent);
      quad.draw({
        ...gradientUniforms(fill.mode === 'gradient' ? fill : flat),
        u_resolution: [canvas.width, canvas.height],
        // Query by element 0: some drivers reject the bare array name.
        'u_cloud[0]': { array: cloudData, size: 3 },
        'u_cloudSeed[0]': { array: seedData, size: 1 },
        u_count: clouds.length,
        u_size: P.cloudSize,
        u_fluff: P.fluff,
        u_softness: P.softness,
        u_flatBase: P.flatBase,
        u_opacity: P.cloudOpacity,
        u_shading: P.shading,
        u_haze: P.haze,
        u_churn: P.churn,
        u_angle: 2 * Math.PI * progress,
        u_wrapY: wrapY ? 1 : 0,
        // Sized against the design space, never the drawing buffer, so a 4K
        // export has the same blocks as a 640px preview.
        u_pixel: pixelate ? [P.pixelSize / stage.width, P.pixelSize / stage.height] : [0, 0],
        u_pixelClouds: pixelate && P.pixelTarget !== 'sky' ? 1 : 0,
        u_pixelSky: pixelate && P.pixelTarget !== 'clouds' ? 1 : 0,
        u_transparent: P.transparent ? 1 : 0,
        u_cloudTop: [top[0], top[1], top[2]],
        u_cloudShadow: [shadow[0], shadow[1], shadow[2]],
      });
    },
    dispose() {
      quad.dispose();
    },
  };
}

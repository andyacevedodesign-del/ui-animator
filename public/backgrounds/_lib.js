/**
 * Shared runtime for background-animator effects.
 *
 * This file is a plain ES module served from /effects so that it can be used in
 * three places without a build step:
 *   1. the studio preview,
 *   2. the offscreen render pass used by the MP4/WebM/GIF encoders,
 *   3. the standalone JS bundle produced by the "JS embed" exporter.
 *
 * Because the JS exporter inlines modules by stripping `import`/`export`
 * keywords (see lib/export/js-embed.ts), keep to this subset:
 *   - only `export function` / `export const` declarations,
 *   - only relative `import { a, b } from './x.js'` statements,
 *   - unique top-level names across all effect modules.
 */

/* ------------------------------------------------------------------ math -- */

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Raised-cosine bell on [-1, 1], flattened/sharpened by `shape`. */
export function bell(u, shape) {
  const a = Math.abs(u);
  if (a >= 1) return 0;
  const c = 0.5 * (1 + Math.cos(Math.PI * a));
  return shape === 1 ? c : Math.pow(c, shape);
}

/** #rgb / #rrggbb / #rrggbbaa -> [r, g, b, a] in 0..1 */
export function hexToRgba(hex) {
  let h = String(hex || '#000000').trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  if (Number.isNaN(n)) return [0, 0, 0, a];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

/** Fills missing values from an effect's parameter definitions. */
export function resolveParams(meta, params) {
  const out = {};
  for (const p of meta.params) out[p.key] = p.default;
  if (params) {
    for (const k of Object.keys(params)) {
      if (params[k] !== undefined && params[k] !== null) out[k] = params[k];
    }
  }
  return out;
}

/* --------------------------------------------------------------- webgl -- */

export function compileProgram(gl, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile failed: ' + log);
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link failed: ' + log);
  }
  return program;
}

export function getGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false, // lines are analytically antialiased in the fragment shader
    premultipliedAlpha: true,
    preserveDrawingBuffer: true, // needed so encoders can read the frame after render
    powerPreference: 'high-performance',
    desynchronized: false,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  return gl;
}

/* ------------------------------------------------------------- polyline -- */

const LINE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;    // design-space position
layout(location = 1) in vec2 a_nrm;    // miter normal (may exceed unit length)
layout(location = 2) in vec2 a_meta;   // x: side (-1|1), y: half width in design px
layout(location = 3) in vec4 a_color;  // straight (non-premultiplied) rgba

uniform vec2 u_resolution;  // drawing buffer size in device px
uniform float u_scale;      // device px per design px
uniform float u_aa;         // feather width in device px

out float v_dist;
out float v_half;
out vec4 v_color;

void main() {
  float half_w = a_meta.y * u_scale;
  float offset = a_meta.x * (half_w + u_aa);
  vec2 device = a_pos * u_scale + a_nrm * offset;

  v_dist = offset;
  v_half = half_w;
  v_color = a_color;

  vec2 clip = (device / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const LINE_FRAG = `#version 300 es
precision highp float;
in float v_dist;
in float v_half;
in vec4 v_color;
uniform float u_aa;
out vec4 outColor;

void main() {
  float coverage = clamp((v_half - abs(v_dist)) / u_aa + 0.5, 0.0, 1.0);
  float a = v_color.a * coverage;
  if (a <= 0.0) discard;
  outColor = vec4(v_color.rgb * a, a); // premultiplied
}`;

const FLOATS_PER_VERTEX = 10;
const VERTICES_PER_SEGMENT = 6;

/**
 * Batched, analytically antialiased polyline renderer with miter joins.
 *
 * A path is `{ pts: number[] (flat x,y pairs), alphas?: number[], color: [r,g,b],
 * width: number, opacity: number }`. Positions and widths are in *design* pixels;
 * `scale` maps them to the drawing buffer, so a 1920x1080 composition looks
 * identical whether it is previewed at 640px or exported at 4K.
 */
export function createLineRenderer(gl) {
  const program = compileProgram(gl, LINE_VERT, LINE_FRAG);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = FLOATS_PER_VERTEX * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 24);
  gl.bindVertexArray(null);

  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uScale = gl.getUniformLocation(program, 'u_scale');
  const uAa = gl.getUniformLocation(program, 'u_aa');

  let data = new Float32Array(4096 * FLOATS_PER_VERTEX);
  let capacityVerts = 4096;
  let vertexCount = 0;

  const ensure = (verts) => {
    if (verts <= capacityVerts) return;
    let next = capacityVerts;
    while (next < verts) next *= 2;
    data = new Float32Array(next * FLOATS_PER_VERTEX);
    capacityVerts = next;
  };

  // Scratch arrays reused across frames to keep the render loop allocation-free.
  let nx = new Float32Array(256);
  let ny = new Float32Array(256);

  const build = (paths, widthScale) => {
    let totalSegments = 0;
    for (const p of paths) {
      const n = p.pts.length >> 1;
      if (n >= 2) totalSegments += n - 1;
    }
    ensure(totalSegments * VERTICES_PER_SEGMENT);

    let o = 0;
    for (const path of paths) {
      const pts = path.pts;
      const n = pts.length >> 1;
      if (n < 2) continue;
      if (nx.length < n) {
        nx = new Float32Array(n * 2);
        ny = new Float32Array(n * 2);
      }

      // Miter normals: adjacent segments share vertices, so there are no gaps
      // and no double-blended overlaps at joins (important at low opacity).
      for (let i = 0; i < n; i++) {
        let px = 0;
        let py = 0;
        let count = 0;
        if (i > 0) {
          const dx = pts[i * 2] - pts[(i - 1) * 2];
          const dy = pts[i * 2 + 1] - pts[(i - 1) * 2 + 1];
          const len = Math.hypot(dx, dy) || 1;
          px += dx / len;
          py += dy / len;
          count++;
        }
        if (i < n - 1) {
          const dx = pts[(i + 1) * 2] - pts[i * 2];
          const dy = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1];
          const len = Math.hypot(dx, dy) || 1;
          px += dx / len;
          py += dy / len;
          count++;
        }
        const len = Math.hypot(px, py) || 1;
        let tnx = -py / len;
        let tny = px / len;

        if (count === 2) {
          // Extend the miter so the join keeps a constant stroke width.
          const dx = pts[(i + 1) * 2] - pts[i * 2];
          const dy = pts[(i + 1) * 2 + 1] - pts[i * 2 + 1];
          const dl = Math.hypot(dx, dy) || 1;
          const segNx = -dy / dl;
          const segNy = dx / dl;
          const dot = tnx * segNx + tny * segNy;
          const miter = clamp(1 / (Math.abs(dot) < 0.25 ? 0.25 : Math.abs(dot)), 1, 4);
          tnx *= miter;
          tny *= miter;
        }
        nx[i] = tnx;
        ny[i] = tny;
      }

      const half = Math.max(path.width, 0.05) * 0.5 * widthScale;
      const r = path.color[0];
      const g = path.color[1];
      const b = path.color[2];
      const baseAlpha = path.opacity;
      const alphas = path.alphas;

      for (let i = 0; i < n - 1; i++) {
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const bx = pts[(i + 1) * 2];
        const by = pts[(i + 1) * 2 + 1];
        const aa = baseAlpha * (alphas ? alphas[i] : 1);
        const ab = baseAlpha * (alphas ? alphas[i + 1] : 1);
        if (aa <= 0.0005 && ab <= 0.0005) continue;

        const anx = nx[i];
        const any = ny[i];
        const bnx = nx[i + 1];
        const bny = ny[i + 1];

        // two triangles: (a-, a+, b-) and (a+, b+, b-)
        const verts = [
          [ax, ay, anx, any, -1, aa],
          [ax, ay, anx, any, 1, aa],
          [bx, by, bnx, bny, -1, ab],
          [ax, ay, anx, any, 1, aa],
          [bx, by, bnx, bny, 1, ab],
          [bx, by, bnx, bny, -1, ab],
        ];
        for (const v of verts) {
          data[o] = v[0];
          data[o + 1] = v[1];
          data[o + 2] = v[2];
          data[o + 3] = v[3];
          data[o + 4] = v[4];
          data[o + 5] = half;
          data[o + 6] = r;
          data[o + 7] = g;
          data[o + 8] = b;
          data[o + 9] = v[5];
          o += FLOATS_PER_VERTEX;
        }
      }
    }
    vertexCount = o / FLOATS_PER_VERTEX;
  };

  const upload = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW, 0, vertexCount * FLOATS_PER_VERTEX);
  };

  return {
    /**
     * @param paths  array of path descriptors (design-space)
     * @param opts   { scale, bufferWidth, bufferHeight, glow, glowWidth }
     */
    draw(paths, opts) {
      if (!paths.length) return;
      const scale = opts.scale;
      const glow = opts.glow || 0;

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uResolution, opts.bufferWidth, opts.bufferHeight);
      gl.uniform1f(uScale, scale);
      gl.uniform1f(uAa, Math.max(1, scale * 0.75));
      gl.enable(gl.BLEND);

      if (glow > 0) {
        // Additive halo pass underneath the crisp stroke.
        const strength = glow;
        const widened = paths.map((p) => ({
          pts: p.pts,
          alphas: p.alphas,
          color: p.color,
          width: p.width * (opts.glowWidth || 5),
          opacity: p.opacity * strength * 0.35,
        }));
        build(widened, 1);
        upload();
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      }

      build(paths, 1);
      upload();
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}

/* ----------------------------------------------------------- fullscreen -- */

const QUAD_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Fullscreen-triangle renderer for shader-based effects. */
export function createQuadRenderer(gl, fragmentSource) {
  const program = compileProgram(gl, QUAD_VERT, fragmentSource);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const cache = new Map();
  const loc = (name) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name);
  };

  return {
    draw(uniforms) {
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      for (const name of Object.keys(uniforms)) {
        const value = uniforms[name];
        const l = loc(name);
        if (l === null) continue;
        if (value && value.array) {
          if (value.size === 3) gl.uniform3fv(l, value.array);
          else gl.uniform1fv(l, value.array);
        } else if (typeof value === 'number') gl.uniform1f(l, value);
        else if (value.length === 2) gl.uniform2f(l, value[0], value[1]);
        else if (value.length === 3) gl.uniform3f(l, value[0], value[1], value[2]);
        else if (value.length === 4) gl.uniform4f(l, value[0], value[1], value[2], value[3]);
      }
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}

/* ------------------------------------------------------------ background -- */

export const MAX_GRADIENT_STOPS = 4;

/**
 * Shared GLSL for multi-stop linear gradients. Injected into both the stage's
 * background pass and any effect that paints its own background, so there is
 * one implementation of the ramp.
 */
export const GRADIENT_GLSL = `
uniform vec3 u_stopColor[${MAX_GRADIENT_STOPS}];
uniform float u_stopPos[${MAX_GRADIENT_STOPS}];
uniform float u_stopCount;
uniform vec2 u_bgDir;   // unit vector, +y is down the canvas
uniform float u_bgMid;  // midpoint bias, 0..1

// Project onto the gradient axis and normalise so the ramp always spans the
// whole box corner to corner, whatever the angle.
float gradientT(vec2 uv) {
  float halfSpan = 0.5 * (abs(u_bgDir.x) + abs(u_bgDir.y));
  vec2 p = vec2(uv.x, 1.0 - uv.y) - 0.5;
  float t = clamp((dot(p, u_bgDir) + halfSpan) / max(2.0 * halfSpan, 0.0001), 0.0, 1.0);
  return u_bgMid == 0.5 ? t : pow(t, log(0.5) / log(clamp(u_bgMid, 0.01, 0.99)));
}

// Walks the stops in order. Below a segment the mix factor is 0 so the colour is
// untouched; above it the factor saturates to 1 and the next segment takes over.
vec3 gradientColor(float t) {
  vec3 c = u_stopColor[0];
  for (int i = 0; i < ${MAX_GRADIENT_STOPS - 1}; i++) {
    if (float(i + 1) >= u_stopCount) break;
    float span = max(u_stopPos[i + 1] - u_stopPos[i], 0.00001);
    c = mix(c, u_stopColor[i + 1], clamp((t - u_stopPos[i]) / span, 0.0, 1.0));
  }
  return c;
}
`;

const GRADIENT_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
${GRADIENT_GLSL}
void main() {
  outColor = vec4(gradientColor(gradientT(v_uv)), 1.0);
}`;

/**
 * Normalises the background parameters every effect shares.
 *
 * Every stop carries its own position, including the two ends, and the list is
 * sorted — so dragging any stop past another reorders the ramp rather than
 * inverting it. Positions need not span 0..1: the first colour fills everything
 * before its stop and the last fills everything after, which is what makes a
 * soft band possible.
 *
 * `angle` is in degrees: 0 runs top to bottom, 90 left to right.
 */
export function resolveBackground(P) {
  const angle = ((P.gradientAngle ?? 0) * Math.PI) / 180;
  const count = Math.max(2, Math.min(MAX_GRADIENT_STOPS, Number(P.gradientStops ?? 2) || 2));

  const stops = [{ color: P.background, pos: clamp(P.gradientFromPos ?? 0, 0, 1) }];
  if (count >= 3) {
    stops.push({ color: P.gradientMidColor || P.background2, pos: clamp(P.gradientMidPos ?? 0.35, 0.01, 0.99) });
  }
  if (count >= 4) {
    stops.push({ color: P.gradientMidColor2 || P.background2, pos: clamp(P.gradientMidPos2 ?? 0.7, 0.01, 0.99) });
  }
  stops.push({ color: P.background2 || P.background, pos: clamp(P.gradientToPos ?? 1, 0, 1) });
  stops.sort((a, b) => a.pos - b.pos);

  return {
    mode: P.backgroundMode === 'gradient' ? 'gradient' : 'solid',
    from: P.background,
    to: P.background2 || P.background,
    stops,
    angleDegrees: P.gradientAngle ?? 0,
    // Canvas space, +y downward: 0deg points straight down, 90deg to the right,
    // so `from` sits at the start of the ramp and `to` at the end.
    dir: [Math.sin(angle), Math.cos(angle)],
    midpoint: P.gradientMidpoint ?? 0.5,
  };
}

/** Packs a resolved fill into the uniforms `GRADIENT_GLSL` expects. */
export function gradientUniforms(fill) {
  const colors = new Float32Array(MAX_GRADIENT_STOPS * 3);
  const positions = new Float32Array(MAX_GRADIENT_STOPS);
  for (let i = 0; i < MAX_GRADIENT_STOPS; i++) {
    const stop = fill.stops[Math.min(i, fill.stops.length - 1)];
    const [r, g, b] = hexToRgba(stop.color);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    positions[i] = stop.pos;
  }
  return {
    // Query by element 0: some drivers reject the bare array name.
    'u_stopColor[0]': { array: colors, size: 3 },
    'u_stopPos[0]': { array: positions, size: 1 },
    u_stopCount: fill.stops.length,
    u_bgDir: fill.dir,
    u_bgMid: fill.midpoint,
  };
}

/* ------------------------------------------------------------- plumbing -- */

/**
 * Shared bookkeeping every effect needs: canvas sizing, clear colour and the
 * design-space -> device-pixel scale.
 */
export function createStage(canvas) {
  const gl = getGL(canvas);
  let designWidth = 1920;
  let designHeight = 1080;
  let scale = 1;
  let gradient = null; // built on first use so solid-background effects pay nothing

  return {
    gl,
    get scale() {
      return scale;
    },
    get width() {
      return designWidth;
    },
    get height() {
      return designHeight;
    },
    setSize(width, height, pixelScale) {
      designWidth = Math.max(1, Math.round(width));
      designHeight = Math.max(1, Math.round(height));
      scale = pixelScale || 1;
      const bw = Math.max(1, Math.round(designWidth * scale));
      const bh = Math.max(1, Math.round(designHeight * scale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
    },
    clear(backgroundHex, transparent) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (transparent) {
        gl.clearColor(0, 0, 0, 0);
      } else {
        const [r, g, b] = hexToRgba(backgroundHex);
        gl.clearColor(r, g, b, 1);
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    /** Solid colour or linear gradient, honouring the transparent toggle. */
    paintBackground(fill, transparent) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (transparent) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      const [r, g, b] = hexToRgba(fill.from);
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (fill.mode !== 'gradient') return;

      if (!gradient) gradient = createQuadRenderer(gl, GRADIENT_FRAG);
      gradient.draw(gradientUniforms(fill));
    },
    frameOpts(extra) {
      return Object.assign(
        {
          scale,
          bufferWidth: canvas.width,
          bufferHeight: canvas.height,
        },
        extra,
      );
    },
  };
}

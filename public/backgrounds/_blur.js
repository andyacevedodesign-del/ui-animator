/**
 * A real layer blur for shader backgrounds: the effect paints into an offscreen
 * target, then a separable Gaussian (horizontal, then vertical) writes it to the
 * canvas — the same even softness as a layer blur in a design tool. Grain is
 * added after blurring so it stays crisp on top of the soft picture.
 *
 * Large blurs paint at reduced resolution first; a blurred picture has no fine
 * detail to lose, and the linear upsample is itself smooth.
 */
import { compileProgram } from './_lib.js';

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const TAPS = 24;

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_step;     // one source texel along the blur axis, in uv
uniform float u_sigma;   // in source texels
uniform float u_grain;
uniform vec2 u_res;
uniform float u_seed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  // Taps span +-3 sigma, so the kernel is a full Gaussian whatever the radius.
  float spread = 3.0 * u_sigma / float(${TAPS});
  for (int i = -${TAPS}; i <= ${TAPS}; i++) {
    float x = float(i) * spread;
    float w = u_sigma > 0.01 ? exp(-0.5 * (x * x) / (u_sigma * u_sigma)) : (i == 0 ? 1.0 : 0.0);
    acc += texture(u_tex, v_uv + u_step * x).rgb * w;
    wsum += w;
  }
  vec3 c = acc / wsum;
  if (u_grain > 0.0) c += (hash(v_uv * u_res + vec2(u_seed * 97.0, u_seed * 41.0)) - 0.5) * u_grain;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function target(gl) {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  return { tex, fbo, w: 0, h: 0 };
}

function size(gl, t, w, h) {
  if (t.w === w && t.h === h) return;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  t.w = w;
  t.h = h;
}

export function createLayerBlur(gl) {
  const program = compileProgram(gl, VERT, BLUR_FRAG);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const loc = (n) => gl.getUniformLocation(program, n);
  const u = { tex: loc('u_tex'), step: loc('u_step'), sigma: loc('u_sigma'), grain: loc('u_grain'), res: loc('u_res'), seed: loc('u_seed') };
  const a = target(gl);
  const b = target(gl);

  const pass = (src, dst, dstW, dstH, step, sigma, grain, seed) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, dstW, dstH);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(u.tex, 0);
    gl.uniform2f(u.step, step[0], step[1]);
    gl.uniform1f(u.sigma, sigma);
    gl.uniform1f(u.grain, grain);
    gl.uniform2f(u.res, dstW, dstH);
    gl.uniform1f(u.seed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  return {
    /**
     * @param o.width,o.height  canvas size in device pixels
     * @param o.sigma           blur radius (standard deviation) in device pixels
     * @param o.paint(w, h, ds) draws the sharp picture into the bound target at w×h
     */
    render(o) {
      const ds = Math.max(1, Math.min(6, Math.floor(o.sigma / 8)));
      const w = Math.max(1, Math.ceil(o.width / ds));
      const h = Math.max(1, Math.ceil(o.height / ds));
      size(gl, a, w, h);
      size(gl, b, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
      gl.viewport(0, 0, w, h);
      o.paint(w, h, ds);
      const s = o.sigma / ds;
      pass(a, b, w, h, [1 / w, 0], s, 0, 0);
      pass(b, null, o.width, o.height, [0, 1 / h], s, o.grain, o.seed);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      for (const t of [a, b]) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
    },
  };
}

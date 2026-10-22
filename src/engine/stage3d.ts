/**
 * three.js camera stage. The UI is painted into canvases that become textured
 * planes; top-level layers with depth get their own plane in front of the page,
 * which is what separates them when the camera tilts. The camera is fitted so
 * that at zero rotation the page lands exactly where the flat 2D path puts it,
 * and lifted planes are shrunk to cancel perspective — switching between flat
 * and 3D never jumps.
 */
import * as THREE from 'three';
import type { CameraState } from './resolve';

export interface Plane {
  key: string;
  canvas: HTMLCanvasElement;
  depth: number;
}

const DEG = Math.PI / 180;
const FOV = 30;

interface Entry {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  tex: THREE.CanvasTexture;
  w: number;
  h: number;
}

export class Stage3D {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 1, 100000);
  private outer = new THREE.Group();
  private inner = new THREE.Group();
  private entries = new Map<string, Entry>();
  private stageW = 1920;
  private stageH = 1080;
  private dist = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.outer.add(this.inner);
    this.scene.add(this.outer);
  }

  private entry(p: Plane): Entry {
    let e = this.entries.get(p.key);
    // GPU storage is fixed at first upload, so a resized canvas needs a new texture.
    if (e && (e.w !== p.canvas.width || e.h !== p.canvas.height || e.tex.image !== p.canvas)) {
      e.tex.dispose();
      e.tex = this.texture(p.canvas);
      e.mesh.material.map = e.tex;
      e.mesh.material.needsUpdate = true;
      e.w = p.canvas.width;
      e.h = p.canvas.height;
    }
    if (!e) {
      const tex = this.texture(p.canvas);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }),
      );
      this.inner.add(mesh);
      e = { mesh, tex, w: p.canvas.width, h: p.canvas.height };
      this.entries.set(p.key, e);
    }
    return e;
  }

  private texture(canvas: HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private pose(stageW: number, stageH: number, cam: CameraState) {
    this.stageW = stageW;
    this.stageH = stageH;
    this.dist = stageH / 2 / Math.tan((FOV / 2) * DEG);
    this.camera.aspect = stageW / stageH;
    this.camera.near = 1;
    this.camera.far = this.dist * 10;
    this.camera.position.set(0, 0, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    // Negative X tips the top of the page away, like a sheet laid on a desk.
    this.outer.rotation.set(-cam.rotX * DEG, cam.rotY * DEG, cam.rotZ * DEG, 'XYZ');
    this.outer.scale.setScalar(cam.zoom);
    this.inner.position.set(-(cam.focusX - stageW / 2), cam.focusY - stageH / 2, 0);
  }

  render(planes: Plane[], outW: number, outH: number, stageW: number, stageH: number, cam: CameraState) {
    if (this.canvas.width !== outW || this.canvas.height !== outH) this.renderer.setSize(outW, outH, false);
    this.pose(stageW, stageH, cam);
    const live = new Set<string>();
    planes.forEach((p, i) => {
      live.add(p.key);
      const e = this.entry(p);
      e.tex.needsUpdate = true;
      const f = (this.dist - p.depth) / this.dist;
      e.mesh.scale.set(stageW * f, stageH * f, 1);
      e.mesh.position.set(0, 0, p.depth);
      e.mesh.renderOrder = i;
      e.mesh.visible = true;
    });
    for (const [key, e] of this.entries) {
      if (live.has(key)) continue;
      this.inner.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      e.tex.dispose();
      this.entries.delete(key);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Stage point (on the page, or lifted by `depth`) → output pixel. */
  project(x: number, y: number, depth: number, outW: number, outH: number): { x: number; y: number } {
    this.scene.updateMatrixWorld();
    const f = (this.dist - depth) / this.dist;
    const v = new THREE.Vector3((x - this.stageW / 2) * f, (this.stageH / 2 - y) * f, depth);
    this.inner.localToWorld(v);
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * outW, y: ((1 - v.y) / 2) * outH };
  }

  dispose() {
    for (const e of this.entries.values()) {
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      e.tex.dispose();
    }
    this.entries.clear();
    this.renderer.dispose();
  }
}

export const needs3D = (c: CameraState) => Math.abs(c.rotX) > 0.01 || Math.abs(c.rotY) > 0.01 || Math.abs(c.rotZ) > 0.01;

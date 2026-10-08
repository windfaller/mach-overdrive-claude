import * as THREE from 'three';
import { G, rand, shake } from './core';
import { sfx } from './audio';

const pVert = `
attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec3 iSize;
varying vec2 vUv; varying vec4 vCol; varying float vShape;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec2 c = position.xy; float size = iSize.x;
  if (iSize.y > 0.0) {
    vec3 vv = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    vec2 d = vv.xy; float l = length(d);
    if (l > 0.001) { d /= l; vec2 p = vec2(-d.y, d.x); float len = max(size, l * iSize.y);
      mv.xy += d * (c.y - 0.5) * len + p * c.x * size; }
    else mv.xy += c * size;
  } else mv.xy += c * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5; vCol = iCol; vShape = iSize.z;
}`;
const pFrag = `
varying vec2 vUv; varying vec4 vCol; varying float vShape;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 q = vUv - 0.5; float d = length(q) * 2.0;
  float a;
  if (vShape < 0.5) a = pow(max(1.0 - d, 0.0), 1.6);
  else if (vShape < 1.5) a = smoothstep(1.0, 0.0, d) * (0.5 + 0.5 * smoothstep(0.5, 0.0, d)) ;
  else { float s = fract(vShape) * 50.0; a = smoothstep(1.0, 0.2, d) * (0.55 + 0.45 * n2(q * 5.0 + s)); }
  a *= vCol.a; if (a < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`;

export class Particles {
  max: number; n = 0; mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry;
  aPos: THREE.InstancedBufferAttribute; aVel: THREE.InstancedBufferAttribute; aCol: THREE.InstancedBufferAttribute; aSize: THREE.InstancedBufferAttribute;
  P: Float32Array; V: Float32Array; L: Float32Array; // life, maxLife
  S: Float32Array; // s0,s1,stretch,shape,drag,grav,wind,a0
  C: Float32Array; // r0 g0 b0 r1 g1 b1
  constructor(max: number, blending: THREE.Blending) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index; g.setAttribute('position', base.getAttribute('position'));
    const mk = (n: number) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(3); this.aVel = mk(3); this.aCol = mk(4); this.aSize = mk(3);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iCol', this.aCol); g.setAttribute('iSize', this.aSize);
    g.instanceCount = 0; this.geo = g;
    const m = new THREE.ShaderMaterial({ vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false;
    this.P = this.aPos.array as Float32Array; this.V = this.aVel.array as Float32Array;
    this.L = new Float32Array(max * 2); this.S = new Float32Array(max * 8); this.C = new Float32Array(max * 6);
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number,
    r: number, g: number, b: number, r1: number, g1: number, b1: number, a = 1, drag = 0, grav = 0, stretch = 0, wind = 0, shape = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z;
    this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.V[i * 3 + 2] = vz;
    this.L[i * 2] = 0; this.L[i * 2 + 1] = life;
    const S = this.S, o = i * 8; S[o] = s0; S[o + 1] = s1; S[o + 2] = stretch; S[o + 3] = shape === 2 ? 2 + Math.random() * 0.99 : shape; S[o + 4] = drag; S[o + 5] = grav; S[o + 6] = wind; S[o + 7] = a;
    const C = this.C, c = i * 6; C[c] = r; C[c + 1] = g; C[c + 2] = b; C[c + 3] = r1; C[c + 4] = g1; C[c + 5] = b1;
  }
  copy(d: number, s: number) {
    const P = this.P, V = this.V, L = this.L, S = this.S, C = this.C;
    for (let k = 0; k < 3; k++) { P[d * 3 + k] = P[s * 3 + k]; V[d * 3 + k] = V[s * 3 + k]; }
    L[d * 2] = L[s * 2]; L[d * 2 + 1] = L[s * 2 + 1];
    for (let k = 0; k < 8; k++) S[d * 8 + k] = S[s * 8 + k];
    for (let k = 0; k < 6; k++) C[d * 6 + k] = C[s * 6 + k];
  }
  clear() { this.n = 0; }
  update(dt: number, ws: number) {
    const P = this.P, V = this.V, L = this.L, S = this.S, C = this.C;
    const col = this.aCol.array as Float32Array, sz = this.aSize.array as Float32Array;
    let i = 0;
    while (i < this.n) {
      L[i * 2] += dt;
      if (L[i * 2] >= L[i * 2 + 1]) { this.n--; if (i !== this.n) this.copy(i, this.n); continue; }
      const t = L[i * 2] / L[i * 2 + 1], o = i * 8;
      const k = 1 - Math.exp(-S[o + 4] * dt);
      V[i * 3] += -V[i * 3] * k; V[i * 3 + 1] += -V[i * 3 + 1] * k - S[o + 5] * dt; V[i * 3 + 2] += (ws * S[o + 6] - V[i * 3 + 2]) * k;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const c = i * 6, a = S[o + 7] * (1 - t) * Math.min(1, t * 25 + 0.3);
      col[i * 4] = C[c] + (C[c + 3] - C[c]) * t; col[i * 4 + 1] = C[c + 1] + (C[c + 4] - C[c + 1]) * t; col[i * 4 + 2] = C[c + 2] + (C[c + 5] - C[c + 2]) * t; col[i * 4 + 3] = a;
      sz[i * 3] = S[o] + (S[o + 1] - S[o]) * t; sz[i * 3 + 1] = S[o + 2]; sz[i * 3 + 2] = S[o + 3];
      i++;
    }
    this.geo.instanceCount = this.n;
    for (const a of [this.aPos, this.aVel, this.aCol, this.aSize]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, this.n * a.itemSize)); a.needsUpdate = true; }
  }
}

// --------- shockwave rings ---------
const ringMat = () => new THREE.ShaderMaterial({
  uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(1, 0.6, 0.3) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; float a=smoothstep(0.7,0.95,r)*smoothstep(1.0,0.95,r); gl_FragColor=vec4(uC, a*uA);} `,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
class Ring { mesh: THREE.Mesh; t = 1; life = 1; s0 = 1; s1 = 10; face = true; vz = 0; mat: THREE.ShaderMaterial;
  constructor() { this.mat = ringMat(); this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.mesh.visible = false; this.mesh.frustumCulled = false; } }

// --------- ribbons (missile / engine trails) ---------
const RN = 40;
const ribbonMat = new THREE.ShaderMaterial({
  vertexShader: `attribute vec4 aCol; varying vec4 vC; void main(){ vC=aCol; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `varying vec4 vC; void main(){ gl_FragColor=vC; }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const ribbonIndex: number[] = [];
for (let i = 0; i < RN - 1; i++) { const a = i * 2; ribbonIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
export class Ribbon {
  pts = new Float32Array(RN * 3); count = 0; mesh: THREE.Mesh; pos: THREE.BufferAttribute; col: THREE.BufferAttribute;
  alive = false; fading = false; fade = 1; width = 0.5; r = 1; g = 1; b = 1; alpha = 1; wind = 1;
  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(RN * 6), 3); this.pos.setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(RN * 8), 4); this.col.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos); geo.setAttribute('aCol', this.col); geo.setIndex(ribbonIndex);
    this.mesh = new THREE.Mesh(geo, ribbonMat); this.mesh.frustumCulled = false; this.mesh.visible = false;
  }
  start(x: number, y: number, z: number, w: number, r: number, g: number, b: number, a = 1, wind = 1) {
    this.alive = true; this.fading = false; this.fade = 1; this.count = 0; this.width = w; this.r = r; this.g = g; this.b = b; this.alpha = a; this.wind = wind;
    this.push(x, y, z); this.mesh.visible = true;
  }
  push(x: number, y: number, z: number) {
    this.pts.copyWithin(3, 0, (RN - 1) * 3);
    this.pts[0] = x; this.pts[1] = y; this.pts[2] = z; this.count = Math.min(RN, this.count + 1);
  }
  update(dt: number, ws: number, cam: THREE.Vector3) {
    const p = this.pts; const dz = ws * this.wind * dt;
    for (let i = 1; i < this.count; i++) p[i * 3 + 2] += dz;
    if (this.fading) { this.fade -= dt * 1.6; if (this.fade <= 0) { this.alive = false; this.mesh.visible = false; return; } }
    const P = this.pos.array as Float32Array, C = this.col.array as Float32Array; const n = this.count;
    for (let i = 0; i < RN; i++) {
      const j = Math.min(i, n - 1), j2 = Math.min(i + 1, n - 1), j0 = Math.max(0, i - 1);
      const x = p[j * 3], y = p[j * 3 + 1], z = p[j * 3 + 2];
      let tx = p[j0 * 3] - p[j2 * 3], ty = p[j0 * 3 + 1] - p[j2 * 3 + 1], tz = p[j0 * 3 + 2] - p[j2 * 3 + 2];
      const cx = cam.x - x, cy = cam.y - y, cz = cam.z - z;
      let sx = ty * cz - tz * cy, sy = tz * cx - tx * cz, sz = tx * cy - ty * cx;
      const l = Math.hypot(sx, sy, sz); if (l < 1e-5) { sx = 1; sy = 0; sz = 0; } else { sx /= l; sy /= l; sz /= l; }
      const u = i / (RN - 1); const w = this.width * (1 - u * 0.7) * (i < n ? 1 : 0);
      P[i * 6] = x + sx * w; P[i * 6 + 1] = y + sy * w; P[i * 6 + 2] = z + sz * w;
      P[i * 6 + 3] = x - sx * w; P[i * 6 + 4] = y - sy * w; P[i * 6 + 5] = z - sz * w;
      const a = this.alpha * this.fade * Math.pow(1 - u, 1.4) * (i < n - 1 ? 1 : 0);
      for (let k = 0; k < 2; k++) { const o = i * 8 + k * 4; C[o] = this.r * a; C[o + 1] = this.g * a; C[o + 2] = this.b * a; C[o + 3] = 1; }
    }
    this.pos.needsUpdate = true; this.col.needsUpdate = true;
  }
}

// --------- debris ---------
const DN = 260;
class Debris {
  mesh: THREE.InstancedMesh; P = new Float32Array(DN * 3); V = new Float32Array(DN * 3); R = new Float32Array(DN * 3); W = new Float32Array(DN * 3);
  L = new Float32Array(DN); S = new Float32Array(DN); F = new Uint8Array(DN); n = 0; m = new THREE.Matrix4(); q = new THREE.Quaternion(); e = new THREE.Euler(); tp = new THREE.Vector3(); ts = new THREE.Vector3();
  constructor() {
    const g = new THREE.DodecahedronGeometry(1, 0); g.scale(1, 0.5, 1.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.7, roughness: 0.5, emissive: 0x401000, emissiveIntensity: 1 });
    this.mesh = new THREE.InstancedMesh(g, mat, DN); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, s: number, fire: boolean) {
    if (this.n >= DN) return; const i = this.n++;
    this.P.set([x, y, z], i * 3); this.V.set([vx, vy, vz], i * 3);
    this.R.set([rand(0, 6), rand(0, 6), rand(0, 6)], i * 3); this.W.set([rand(-8, 8), rand(-8, 8), rand(-8, 8)], i * 3);
    this.L[i] = rand(1.5, 3); this.S[i] = s; this.F[i] = fire ? 1 : 0;
  }
  update(dt: number, ws: number) {
    let i = 0;
    while (i < this.n) {
      this.L[i] -= dt;
      if (this.L[i] <= 0) { this.n--; if (i !== this.n) {
        for (const A of [this.P, this.V, this.R, this.W]) for (let k = 0; k < 3; k++) A[i * 3 + k] = A[this.n * 3 + k];
        this.L[i] = this.L[this.n]; this.S[i] = this.S[this.n]; this.F[i] = this.F[this.n]; } continue; }
      const k = 1 - Math.exp(-0.8 * dt);
      this.V[i * 3] -= this.V[i * 3] * k; this.V[i * 3 + 1] -= 25 * dt; this.V[i * 3 + 2] += (ws * 0.6 - this.V[i * 3 + 2]) * k;
      for (let a = 0; a < 3; a++) { this.P[i * 3 + a] += this.V[i * 3 + a] * dt; this.R[i * 3 + a] += this.W[i * 3 + a] * dt; }
      if (this.F[i] && Math.random() < 0.7) {
        fx.add.emit(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2], 0, 0, 0, 0.35, this.S[i] * 1.6, this.S[i] * 0.4, 3, 1.2, 0.3, 0.8, 0.1, 0.02, 0.9, 2, 0, 0, 0.8);
        if (Math.random() < 0.3) fx.smoke.emit(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2], 0, 0, 0, 1.2, this.S[i] * 1.5, this.S[i] * 5, 0.09, 0.08, 0.08, 0.05, 0.05, 0.05, 0.5, 2, -3, 0, 0.9, 2);
      }
      this.e.set(this.R[i * 3], this.R[i * 3 + 1], this.R[i * 3 + 2]); this.q.setFromEuler(this.e);
      const s = this.S[i] * Math.min(1, this.L[i] * 2);
      this.tp.set(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]); this.ts.set(s, s, s); this.m.compose(this.tp, this.q, this.ts);
      this.mesh.setMatrixAt(i, this.m); i++;
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --------- speed lines ---------
const SL = 260;
class SpeedLines {
  geo = new THREE.BufferGeometry(); mesh: THREE.LineSegments; P = new Float32Array(SL * 3); pos: THREE.BufferAttribute; col: THREE.BufferAttribute;
  constructor() {
    this.pos = new THREE.BufferAttribute(new Float32Array(SL * 6), 3); this.col = new THREE.BufferAttribute(new Float32Array(SL * 6), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage); this.col.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pos); this.geo.setAttribute('color', this.col);
    this.mesh = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mesh.frustumCulled = false;
    for (let i = 0; i < SL; i++) this.reset(i, rand(-260, 20));
  }
  reset(i: number, z: number) {
    const a = rand(0, Math.PI * 2), r = rand(5, 46);
    this.P[i * 3] = Math.cos(a) * r; this.P[i * 3 + 1] = Math.sin(a) * r * 0.7 + 2; this.P[i * 3 + 2] = z;
  }
  update(dt: number, ws: number, intensity: number, cam: THREE.Vector3) {
    const P = this.pos.array as Float32Array, C = this.col.array as Float32Array;
    const len = ws * 0.05 * (0.4 + intensity);
    for (let i = 0; i < SL; i++) {
      this.P[i * 3 + 2] += ws * 1.4 * dt;
      if (this.P[i * 3 + 2] > 25) this.reset(i, rand(-280, -200));
      const x = this.P[i * 3] + cam.x, y = this.P[i * 3 + 1] + cam.y * 0.8, z = this.P[i * 3 + 2] + cam.z - 10;
      P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x; P[i * 6 + 4] = y; P[i * 6 + 5] = z - len;
      const fade = Math.min(1, (this.P[i * 3 + 2] + 280) / 80) * intensity * (i % 3 === 0 ? 0.9 : 0.35);
      const cr = G.lineColor ? G.lineColor.r : 0.6, cg = G.lineColor ? G.lineColor.g : 0.9, cb = G.lineColor ? G.lineColor.b : 1;
      C[i * 6] = cr * fade; C[i * 6 + 1] = cg * fade; C[i * 6 + 2] = cb * fade; C[i * 6 + 3] = 0; C[i * 6 + 4] = 0; C[i * 6 + 5] = 0;
    }
    this.pos.needsUpdate = true; this.col.needsUpdate = true;
  }
}

class FX {
  add!: Particles; smoke!: Particles; rings: Ring[] = []; ribbons: Ribbon[] = []; lights: { l: THREE.PointLight; t: number; i: number }[] = [];
  debris!: Debris; lines!: SpeedLines; delayed: { t: number; f: () => void }[] = [];
  init(scene: THREE.Scene) {
    this.smoke = new Particles(2600, THREE.NormalBlending); this.smoke.mesh.renderOrder = 1; scene.add(this.smoke.mesh);
    this.add = new Particles(7000, THREE.AdditiveBlending); this.add.mesh.renderOrder = 2; scene.add(this.add.mesh);
    for (let i = 0; i < 14; i++) { const r = new Ring(); this.rings.push(r); scene.add(r.mesh); }
    for (let i = 0; i < 70; i++) { const r = new Ribbon(); this.ribbons.push(r); scene.add(r.mesh); }
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffaa66, 0, 160, 1.3); scene.add(l); this.lights.push({ l, t: 0, i: 0 }); }
    this.debris = new Debris(); scene.add(this.debris.mesh);
    this.lines = new SpeedLines(); scene.add(this.lines.mesh);
  }
  clear() {
    this.add.clear(); this.smoke.clear(); this.debris.n = 0; this.delayed.length = 0;
    for (const r of this.rings) { r.t = r.life; r.mesh.visible = false; }
    for (const r of this.ribbons) { r.alive = false; r.mesh.visible = false; }
    for (const l of this.lights) { l.t = 0; l.l.intensity = 0; }
  }
  later(t: number, f: () => void) { this.delayed.push({ t, f }); }
  ribbon(): Ribbon | null { for (const r of this.ribbons) if (!r.alive) return r; return null; }
  light(p: THREE.Vector3, color: number, intensity: number, life = 0.25) {
    let best = this.lights[0]; for (const l of this.lights) if (l.t <= 0) { best = l; break; } else if (l.t < best.t) best = l;
    best.l.position.copy(p); best.l.color.setHex(color); best.i = intensity; best.t = life; best.l.intensity = intensity;
  }
  ring(p: THREE.Vector3, s0: number, s1: number, life: number, r: number, g: number, b: number, face = true, a = 1) {
    let ring = this.rings.find(x => x.t >= x.life) || this.rings[0];
    ring.t = 0; ring.life = life; ring.s0 = s0; ring.s1 = s1; ring.face = face; ring.mesh.position.copy(p); ring.mesh.visible = true;
    ring.mat.uniforms.uC.value.setRGB(r * a, g * a, b * a); ring.mesh.rotation.set(face ? 0 : -Math.PI / 2, 0, 0);
  }
  sparks(p: THREE.Vector3, n: number, spd: number, r = 3, g = 2, b = 1, dir?: THREE.Vector3) {
    for (let i = 0; i < n; i++) {
      let vx = rand(-1, 1), vy = rand(-1, 1), vz = rand(-1, 1); const l = Math.hypot(vx, vy, vz) || 1; const s = spd * rand(0.4, 1.2);
      vx = vx / l * s; vy = vy / l * s; vz = vz / l * s;
      if (dir) { vx += dir.x * spd; vy += dir.y * spd; vz += dir.z * spd; }
      this.add.emit(p.x, p.y, p.z, vx, vy, vz, rand(0.2, 0.55), rand(0.12, 0.3), 0.05, r, g, b, r * 0.6, g * 0.3, b * 0.2, 1, 2.5, 20, 0.045, 0.2, 1);
    }
  }
  muzzle(p: THREE.Vector3, r = 0.5, g = 2.5, b = 3) {
    this.add.emit(p.x, p.y, p.z, 0, 0, -20, 0.06, 2.4, 1.0, r * 1.5, g, b, r, g, b, 1, 0, 0, 0, 0, 1);
    for (let i = 0; i < 3; i++) this.add.emit(p.x, p.y, p.z, rand(-8, 8), rand(-8, 8), rand(-60, -20), 0.12, 0.25, 0.05, r, g, b, r, g * 0.5, b, 1, 3, 0, 0.04, 0, 1);
  }
  explosion(p: THREE.Vector3, s = 1, vel?: THREE.Vector3, opts: { color?: number[]; debris?: number; sound?: boolean; ring?: boolean } = {}) {
    const vx = vel ? vel.x : 0, vy = vel ? vel.y : 0, vz = vel ? vel.z : 0;
    const c = opts.color || [3, 1.4, 0.45];
    const fa = 1 / (1 + 0.25 * s);
    this.add.emit(p.x, p.y, p.z, vx, vy, vz, 0.2, 5 * s, 12 * s, 2.6, 2, 1.4, c[0], c[1], c[2], fa, 1, 0, 0, 0, 1);
    const nf = Math.min(40, Math.floor(10 + 10 * s));
    for (let i = 0; i < nf; i++) {
      const a = rand(0, Math.PI * 2), b2 = rand(-1, 1), sp = rand(6, 22) * Math.sqrt(s); const q = Math.sqrt(1 - b2 * b2);
      this.add.emit(p.x + rand(-1, 1) * s, p.y + rand(-1, 1) * s, p.z + rand(-1, 1) * s, vx + Math.cos(a) * q * sp, vy + b2 * sp, vz + Math.sin(a) * q * sp,
        rand(0.45, 0.95), rand(2, 3.5) * s, rand(4, 7) * s, c[0], c[1], c[2], 0.9, 0.12, 0.03, 0.85 * fa, 3, -2, 0, 0.25, 0);
    }
    this.sparks(p, Math.min(50, Math.floor(14 * Math.sqrt(s) + 6)), 50 * Math.sqrt(s));
    const ns = Math.min(18, Math.floor(4 + 4 * s));
    for (let i = 0; i < ns; i++) {
      this.smoke.emit(p.x + rand(-2, 2) * s, p.y + rand(-2, 2) * s, p.z + rand(-2, 2) * s, vx * 0.5 + rand(-6, 6) * s, vy * 0.5 + rand(0, 8), vz * 0.5 + rand(-6, 6) * s,
        rand(1.6, 2.8), rand(3, 5) * s, rand(9, 14) * s, 0.16, 0.13, 0.13, 0.05, 0.05, 0.06, 0.55, 2, -2, 0, 0.7, 2);
    }
    if (opts.ring !== false) this.ring(p, 1 * s, 22 * s, 0.45, 1.6, 0.9, 0.5, true, fa + 0.2);
    const nd = opts.debris !== undefined ? opts.debris : Math.floor(3 * s);
    for (let i = 0; i < nd; i++) this.debris.spawn(p.x, p.y, p.z, vx + rand(-30, 30) * Math.sqrt(s), vy + rand(-10, 40), vz + rand(-30, 30), rand(0.2, 0.6) * Math.sqrt(s), Math.random() < 0.5);
    this.light(p, 0xff9050, 120 * s, 0.3 + 0.1 * s);
    const d = G.camera.position.distanceTo(p);
    shake(Math.min(0.6, s * 18 / (d + 20)));
    if (opts.sound !== false) sfx.explosion(s, Math.min(1, 80 / (d + 30)));
  }
  update(dt: number, realDt: number) {
    const ws = G.speed;
    this.add.update(dt, ws); this.smoke.update(dt, ws); this.debris.update(dt, ws);
    const cam = G.camera.position;
    for (const r of this.ribbons) if (r.alive) r.update(dt, ws, cam);
    for (const r of this.rings) if (r.t < r.life) {
      r.t += dt; const u = Math.min(1, r.t / r.life); const s = r.s0 + (r.s1 - r.s0) * (1 - Math.pow(1 - u, 3));
      r.mesh.scale.setScalar(s); r.mat.uniforms.uA.value = (1 - u) * (1 - u) * 2.5; if (r.face) r.mesh.quaternion.copy(G.camera.quaternion);
      r.mesh.position.z += ws * 0.3 * dt; if (r.t >= r.life) r.mesh.visible = false;
    }
    for (const l of this.lights) if (l.t > 0) { l.t -= dt; l.l.intensity = Math.max(0, l.t) * l.i * 4; if (l.t <= 0) l.l.intensity = 0; }
    for (let i = this.delayed.length - 1; i >= 0; i--) { const d = this.delayed[i]; d.t -= dt; if (d.t <= 0) { this.delayed.splice(i, 1); d.f(); } }
    this.lines.update(realDt, ws, G.lineIntensity || 0, cam);
  }
}
export const fx = new FX();

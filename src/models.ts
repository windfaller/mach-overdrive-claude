import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type L = THREE.BufferGeometry[];
const _m = new THREE.Matrix4(), _e = new THREE.Euler();
function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  _e.set(rx, ry, rz); _m.makeRotationFromEuler(_e); _m.setPosition(x, y, z); g.applyMatrix4(_m);
  return g.index ? g.toNonIndexed() : g;
}
export const B = (l: L, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { l.push(place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)); };
export const C = (l: L, rt: number, rb: number, h: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { l.push(place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz)); };
export const S = (l: L, r: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(sx, sy, sz); l.push(place(g, x, y, z, 0, 0, 0)); };
export const T = (l: L, r: number, tube: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { l.push(place(new THREE.TorusGeometry(r, tube, 6, 24), x, y, z, rx, ry, rz)); };
export const merge = (l: L) => { const g = mergeGeometries(l, false); l.forEach(x => x.dispose()); return g; };

export const mats = {
  dark: new THREE.MeshStandardMaterial({ color: 0x323846, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.4 }),
  mid: new THREE.MeshStandardMaterial({ color: 0x4a5160, metalness: 0.75, roughness: 0.4, envMapIntensity: 1.0 }),
  enemyDark: new THREE.MeshStandardMaterial({ color: 0x23201f, metalness: 0.8, roughness: 0.38, envMapIntensity: 1.0 }),
  enemyMid: new THREE.MeshStandardMaterial({ color: 0x5a4a44, metalness: 0.7, roughness: 0.45 }),
};
export const glow = (r: number, g: number, b: number) => { const m = new THREE.MeshBasicMaterial(); m.color.setRGB(r, g, b); return m; };
export const additive = (r: number, g: number, b: number, o = 1) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); m.color.setRGB(r, g, b); return m; };

/** Build a 3-material part: dark body, mid accent, glow. */
export function part(fn: (d: L, m: L, g: L) => void, md: THREE.Material, mm: THREE.Material, mg: THREE.Material) {
  const d: L = [], m: L = [], g: L = []; fn(d, m, g);
  const grp = new THREE.Group();
  if (d.length) grp.add(new THREE.Mesh(merge(d), md));
  if (m.length) grp.add(new THREE.Mesh(merge(m), mm));
  if (g.length) { const gm = new THREE.Mesh(merge(g), mg); gm.name = 'glow'; grp.add(gm); }
  return grp;
}

export interface Mech { root: THREE.Group; body: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  wingL: THREE.Group; wingR: THREE.Group; blade: THREE.Group; gunTip: THREE.Object3D; flames: THREE.Mesh[]; podL: THREE.Object3D; podR: THREE.Object3D; glowMat: THREE.MeshBasicMaterial; }

export function buildMech(glowRGB: number[], md: THREE.Material = mats.dark, mm: THREE.Material = mats.mid, flameRGB = [0.4, 1.1, 2]): Mech {
  const gm = glow(glowRGB[0], glowRGB[1], glowRGB[2]);
  const root = new THREE.Group(); const body = new THREE.Group(); body.position.y = -1.5; root.add(body);
  const torso = part((d, m, g) => {
    B(d, 1.3, 0.9, 0.85, 0, 1.75, 0); B(d, 0.62, 0.55, 0.28, 0.33, 1.82, -0.45, 0, -0.25); B(d, 0.62, 0.55, 0.28, -0.33, 1.82, -0.45, 0, 0.25);
    B(m, 0.75, 0.5, 0.6, 0, 1.15, 0); B(d, 1.0, 0.35, 0.72, 0, 0.8, 0); B(m, 0.5, 0.3, 0.3, 0, 0.82, -0.4, 0.3);
    B(d, 1.15, 0.95, 0.55, 0, 1.75, 0.62); B(m, 0.9, 0.15, 0.7, 0, 2.28, 0.55);
    C(g, 0.24, 0.24, 0.08, 16, 0, 1.78, 0.92, Math.PI / 2); B(g, 0.26, 0.16, 0.05, 0, 1.78, -0.6);
    B(g, 0.04, 0.75, 0.03, 0.42, 1.72, 0.9); B(g, 0.04, 0.75, 0.03, -0.42, 1.72, 0.9);
    for (const s of [-1, 1]) {
      C(d, 0.2, 0.28, 0.8, 10, s * 0.33, 1.3, 1.05, Math.PI / 2); C(g, 0.2, 0.2, 0.04, 12, s * 0.33, 1.3, 1.46, Math.PI / 2);
      B(d, 0.7, 0.6, 0.9, s * 0.98, 2.05, 0, 0, 0, -s * 0.22); B(g, 0.72, 0.05, 0.92, s * 1.0, 1.8, 0, 0, 0, -s * 0.22);
      B(m, 0.46, 0.36, 0.62, s * 0.9, 2.47, 0.12);
      for (let k = 0; k < 3; k++) B(g, 0.08, 0.04, 0.08, s * 0.9 + (k - 1) * 0.13, 2.66, -0.05);
      B(d, 0.12, 0.6, 0.12, s * 0.25, 2.55, 0.7, 0.4, 0, s * 0.2);
    }
  }, md, mm, gm);
  body.add(torso);
  const head = part((d, m, g) => {
    B(d, 0.42, 0.36, 0.48, 0, 0, 0); B(m, 0.46, 0.12, 0.3, 0, -0.16, 0.08);
    B(g, 0.36, 0.07, 0.03, 0, 0.03, -0.25); B(g, 0.55, 0.045, 0.05, 0.2, 0.24, -0.2, 0, 0, 0.55); B(g, 0.55, 0.045, 0.05, -0.2, 0.24, -0.2, 0, 0, -0.55);
  }, md, mm, gm);
  head.position.set(0, 2.42, -0.05); body.add(head);
  const arm = (s: number) => {
    const a = new THREE.Group(); a.position.set(s * 0.98, 1.95, 0);
    a.add(part((d, m, g) => {
      B(d, 0.32, 0.72, 0.32, 0, -0.45, 0); B(d, 0.44, 0.82, 0.52, 0, -1.15, -0.05); B(m, 0.46, 0.2, 0.54, 0, -0.8, -0.05);
      B(g, 0.03, 0.6, 0.03, s * 0.23, -1.15, -0.2);
      if (s > 0) { B(d, 0.2, 0.28, 1.9, 0.05, -1.45, -0.8); B(m, 0.1, 0.1, 0.9, 0.05, -1.38, -2.0); B(g, 0.04, 0.04, 1.4, 0.16, -1.36, -0.8); B(m, 0.12, 0.35, 0.3, 0.05, -1.7, -0.5); }
      else { B(m, 0.26, 0.32, 0.7, -0.12, -1.3, -0.2); B(g, 0.08, 0.08, 0.2, -0.12, -1.42, -0.55); }
    }, md, mm, gm));
    body.add(a); return a;
  };
  const armR = arm(1), armL = arm(-1);
  const gunTip = new THREE.Object3D(); gunTip.position.set(0.05, -1.38, -2.5); armR.add(gunTip);
  const blade = new THREE.Group(); blade.position.set(-0.12, -1.42, -0.6); armL.add(blade);
  const bm = additive(1.2, 2.6, 3.2); const bc = glow(3, 4, 4.5);
  const bg1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 3.4).translate(0, 0, -1.7), bm);
  const bg2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 3.3).translate(0, 0, -1.65), bc);
  blade.add(bg1, bg2); blade.scale.set(1, 1, 0.01); blade.visible = false;
  const leg = (s: number) => {
    const l = new THREE.Group(); l.position.set(s * 0.34, 0.72, 0);
    l.add(part((d, m, g) => {
      B(d, 0.42, 0.75, 0.48, 0, -0.38, 0); B(d, 0.5, 0.98, 0.62, 0, -1.12, 0.22, 0.35); B(m, 0.36, 0.22, 0.8, 0, -1.65, 0.5, 0.6);
      B(g, 0.2, 0.06, 0.05, 0, -0.75, -0.3); B(g, 0.05, 0.6, 0.04, s * 0.26, -1.1, 0.1, 0.35);
    }, md, mm, gm));
    body.add(l); return l;
  };
  const legL = leg(-1), legR = leg(1);
  const wing = (s: number) => {
    const w = new THREE.Group(); w.position.set(s * 0.45, 2.15, 0.8);
    w.add(part((d, m, g) => {
      B(d, 2.1, 0.06, 0.45, s * 1.05, 0, 0); B(g, 2.1, 0.05, 0.05, s * 1.05, 0, -0.24);
      B(d, 1.5, 0.05, 0.34, s * 0.72, -0.5, 0.15, 0, 0, s * 0.35); B(g, 1.5, 0.04, 0.04, s * 0.72, -0.5, -0.03, 0, 0, s * 0.35);
      B(m, 0.3, 0.3, 0.5, s * 0.1, -0.15, 0);
    }, md, mm, gm));
    w.rotation.set(0, s * -0.4, s * 0.42); body.add(w); return w;
  };
  const wingL = wing(-1), wingR = wing(1);
  const flames: THREE.Mesh[] = [];
  const fm = additive(flameRGB[0], flameRGB[1], flameRGB[2], 0.9);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.8), fm);
    f.position.set(s * 0.33, 1.3, 1.47); body.add(f); flames.push(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.55), glow(1.6, 2.2, 2.8)); f.add(f2);
  }
  const podL = new THREE.Object3D(); podL.position.set(-0.9, 2.6, 0.2); body.add(podL);
  const podR = new THREE.Object3D(); podR.position.set(0.9, 2.6, 0.2); body.add(podR);
  legL.rotation.x = 0.45; legR.rotation.x = 0.55;
  return { root, body, head, armL, armR, legL, legR, wingL, wingR, blade, gunTip, flames, podL, podR, glowMat: gm };
}

export function buildDrone(gm: THREE.Material) {
  const g = new THREE.Group();
  const core = part((d, m, gl) => {
    const o = new THREE.OctahedronGeometry(1, 0); o.scale(1.2, 0.75, 1.3); d.push(o.index ? o.toNonIndexed() : o);
    S(gl, 0.36, 0, 0, 1.05); B(m, 0.5, 0.25, 1.6, 0, 0.55, -0.3);
    for (const s of [-1, 1]) { B(d, 1.4, 0.08, 0.6, s * 1.1, 0, -0.2, 0, s * 0.3, s * 0.25); B(gl, 1.3, 0.05, 0.05, s * 1.1, 0.02, 0.1, 0, s * 0.3, s * 0.25); }
  }, mats.enemyDark, mats.enemyMid, gm);
  const ring = part((d, m, gl) => { T(m, 1.55, 0.09, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B(gl, 0.18, 0.12, 0.18, Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55); } }, mats.enemyDark, mats.enemyMid, gm);
  ring.name = 'spin'; g.add(core, ring); return g;
}
export function buildFighter(gm: THREE.Material) {
  return part((d, m, g) => {
    C(d, 0.0, 0.6, 3.8, 6, 0, 0, 0.6, Math.PI / 2); B(d, 0.9, 0.5, 2.4, 0, 0, -1.0);
    for (const s of [-1, 1]) {
      B(d, 2.4, 0.08, 1.3, s * 1.3, 0, -1.0, 0, s * 0.45, 0); B(g, 2.2, 0.05, 0.06, s * 1.4, 0.03, -0.45, 0, s * 0.45, 0);
      B(m, 0.06, 0.9, 0.9, s * 0.45, 0.45, -1.8, 0, 0, s * 0.35); C(g, 0.26, 0.26, 0.1, 8, s * 0.3, 0, -2.25, Math.PI / 2);
    }
    B(g, 0.3, 0.16, 0.7, 0, 0.32, 0.4);
  }, mats.enemyDark, mats.enemyMid, gm);
}
export function buildHeavy(gm: THREE.Material) {
  return part((d, m, g) => {
    C(d, 2.2, 2.7, 3.6, 6, 0, 0, 0, Math.PI / 2, 0, 0);
    for (const s of [-1, 1]) {
      B(m, 1.1, 3.0, 3.2, s * 2.8, 0, 0); B(d, 0.7, 0.7, 3.4, s * 2.8, -1.9, 1.0); B(g, 0.35, 0.35, 0.1, s * 2.8, -1.9, 2.72);
      B(g, 0.08, 2.4, 0.08, s * 3.36, 0, 1.0); B(d, 1.4, 1.0, 1.4, s * 2.8, 1.9, -0.4);
    }
    S(g, 0.75, 0, 0, 1.75, 1, 1, 0.5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; B(g, 0.22, 0.22, 0.1, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 1.85); }
    B(m, 2.0, 0.5, 2.6, 0, 2.3, -0.3); T(m, 2.9, 0.12, 0, 0, -0.6);
  }, mats.enemyDark, mats.enemyMid, gm);
}
export function buildBattleshipHalf(sign: number, gm: THREE.Material) {
  // broadside ship lying along x; this builds x>0 (sign=1) or x<0 half
  return part((d, m, g) => {
    const s = sign;
    B(d, 86, 16, 26, s * 43, 0, 0); B(m, 80, 3, 20, s * 43, 9, 0);
    for (const y of [-4, 3]) { B(g, 80, 0.4, 0.3, s * 43, y, 13.2); }
    for (let i = 0; i < 18; i++) B(g, 1.2, 0.8, 0.2, s * (6 + i * 4.4), -0.5, 13.15);
    if (s > 0) {
      const c = new THREE.CylinderGeometry(0.5, 13, 36, 4); c.rotateY(Math.PI / 4); c.rotateZ(-Math.PI / 2); c.scale(1, 0.7, 1); c.translate(104, 0, 0); d.push(c.toNonIndexed());
      B(m, 22, 10, 12, 26, 12, 0); B(g, 18, 1, 0.3, 26, 13, 6.2); B(d, 8, 4, 8, 50, 10, 0); B(m, 14, 1.2, 1.2, 58, 11, 0);
      B(d, 8, 4, 8, 70, 9, 0); B(m, 14, 1.2, 1.2, 78, 10, 0);
    } else {
      B(m, 26, 14, 16, -14, 15, 0); B(d, 7, 22, 7, -18, 30, 0); B(g, 7.2, 0.6, 7.2, -18, 38, 0); B(g, 20, 1, 0.3, -14, 16, 8.2);
      B(d, 22, 22, 32, -90, 0, 0); for (const y of [-6, 6]) for (const z of [-8, 8]) C(g, 4, 4, 0.5, 10, -101.5, y, z, 0, 0, Math.PI / 2);
      B(d, 8, 4, 8, -50, 10, 0); B(m, 14, 1.2, 1.2, -42, 11, 0); B(d, 8, 4, 8, -66, 9, 0); B(m, 14, 1.2, 1.2, -58, 10, 0);
    }
  }, mats.enemyDark, mats.enemyMid, gm);
}
export function buildCarrier(gm: THREE.Material) {
  return part((d, m, g) => {
    B(d, 140, 14, 24, 0, 0, 0); B(m, 150, 2, 34, 0, 8, 0); B(d, 10, 18, 10, 25, 17, 10); B(g, 10.2, 1, 10.2, 25, 22, 10);
    const c = new THREE.CylinderGeometry(0.5, 11, 30, 4); c.rotateY(Math.PI / 4); c.rotateZ(-Math.PI / 2); c.translate(85, 0, 0); d.push(c.toNonIndexed());
    for (const z of [-6, 6]) C(g, 4, 4, 0.5, 10, -70.5, 0, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 14; i++) B(g, 0.8, 0.8, 0.8, -60 + i * 9, 9.5, 17);
  }, mats.enemyDark, mats.enemyMid, gm);
}

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
  light: new THREE.MeshStandardMaterial({ color: 0x9aa3b4, metalness: 0.55, roughness: 0.35, envMapIntensity: 1.2 }),
  enemyDark: new THREE.MeshStandardMaterial({ color: 0x3a2f2b, metalness: 0.7, roughness: 0.4, envMapIntensity: 1.0 }),
  enemyMid: new THREE.MeshStandardMaterial({ color: 0x7a5a4c, metalness: 0.6, roughness: 0.45 }),
};
/** Readability: a view-angle rim glow so hostile hulls separate from the dark, busy city. Warm = hostile. */
export const ENEMY_RIM = [1.5, 0.42, 0.12], RAVEN_RIM = [1.7, 0.18, 0.55];
export function addRim(m: THREE.MeshStandardMaterial, rgb: number[], pow = 2.2) {
  const col = new THREE.Color(rgb[0], rgb[1], rgb[2]);
  m.onBeforeCompile = s => {
    s.uniforms.uRim = { value: col };
    s.fragmentShader = 'uniform vec3 uRim;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr = 1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(fr, ${pow.toFixed(2)}); }`);
  };
  m.customProgramCacheKey = () => 'rim' + pow;
  return m;
}
addRim(mats.enemyDark, ENEMY_RIM); addRim(mats.enemyMid, ENEMY_RIM, 2.6);
export const glow = (r: number, g: number, b: number) => { const m = new THREE.MeshBasicMaterial(); m.color.setRGB(r, g, b); return m; };
export const additive = (r: number, g: number, b: number, o = 1) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }); m.color.setRGB(r, g, b); return m; };

/** Build a 3-material part: dark body, mid accent, glow. Tagged proc so hero assets can hide it. */
export function part(fn: (d: L, m: L, g: L, l: L) => void, md: THREE.Material, mm: THREE.Material, mg: THREE.Material, ml: THREE.Material = mm) {
  const d: L = [], m: L = [], g: L = [], l: L = []; fn(d, m, g, l);
  const grp = new THREE.Group(); grp.userData.proc = true;
  if (d.length) grp.add(new THREE.Mesh(merge(d), md));
  if (m.length) grp.add(new THREE.Mesh(merge(m), mm));
  if (l.length) grp.add(new THREE.Mesh(merge(l), ml));
  if (g.length) { const gm = new THREE.Mesh(merge(g), mg); gm.name = 'glow'; grp.add(gm); }
  return grp;
}

export interface Mech { root: THREE.Group; body: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  shinL: THREE.Group; shinR: THREE.Group; pack: THREE.Group; podGL: THREE.Group; podGR: THREE.Group; shoulderL: THREE.Group; shoulderR: THREE.Group;
  wingL: THREE.Group; wingR: THREE.Group; blade: THREE.Group; gunTip: THREE.Object3D; flames: THREE.Mesh[]; footFlames: THREE.Mesh[];
  podL: THREE.Object3D; podR: THREE.Object3D; glowMat: THREE.MeshBasicMaterial; torso: THREE.Group; variant: string; }

/**
 * Procedural mech. 'player' = aerospace interceptor (swept crest, twin-nacelle backpack, three-blade wing binders);
 * 'raven' = hunched hunter (mono-eye, spiked pauldrons, long blade arm, angular bat binders).
 * Faces -Z; the camera mostly sees the back, so backpack / thrusters / binders carry the silhouette.
 */
export function buildMech(glowRGB: number[], md: THREE.Material = mats.dark, mm: THREE.Material = mats.mid, flameRGB = [0.4, 1.1, 2], variant = 'player'): Mech {
  const R = variant === 'raven';
  const gm = glow(glowRGB[0], glowRGB[1], glowRGB[2]);
  const ml = R ? mm : mats.light;
  const root = new THREE.Group(); const body = new THREE.Group(); body.position.y = -1.5; root.add(body);
  const torso = new THREE.Group(); body.add(torso);
  torso.add(part((d, m, g, l) => {
    // chest: flared V, layered plates
    B(d, 1.2, 0.82, 0.78, 0, 1.8, 0);
    for (const s of [-1, 1]) {
      B(l, 0.66, 0.46, 0.3, s * 0.36, 1.92, -0.38, 0.18, -s * 0.32, 0);
      B(m, 0.5, 0.2, 0.36, s * 0.34, 1.58, -0.36, -0.15, -s * 0.2, 0);
      B(g, 0.28, 0.04, 0.03, s * 0.36, 1.74, -0.53, 0, -s * 0.3, 0);
      // side ribs
      B(d, 0.12, 0.6, 0.5, s * 0.62, 1.7, 0.05, 0, 0, s * 0.12);
    }
    B(m, 0.88, 0.16, 0.66, 0, 2.27, 0.04); // collar
    C(g, 0.13, 0.13, 0.05, 12, 0, 1.86, -0.56, Math.PI / 2); // core lamp
    // abdomen + waist
    B(m, 0.62, 0.5, 0.5, 0, 1.22, 0); for (let k = 0; k < 3; k++) B(d, 0.66, 0.08, 0.54, 0, 1.06 + k * 0.15, 0);
    B(d, 0.92, 0.3, 0.62, 0, 0.84, 0);
    // skirt armor
    for (const s of [-1, 1]) { B(R ? m : d, 0.4, 0.52, 0.07, s * 0.24, 0.55, -0.36, -0.25, s * 0.1, 0); B(d, 0.07, 0.55, 0.48, s * 0.52, 0.56, 0, 0, 0, s * 0.2); B(g, 0.04, 0.3, 0.02, s * 0.24, 0.6, -0.41, -0.25, 0, 0); }
    B(d, 0.78, 0.45, 0.07, 0, 0.58, 0.34, 0.28, 0, 0);
    B(g, 0.05, 0.8, 0.04, 0, 1.65, 0.41); // spine light
    if (R) { for (const s of [-1, 1]) B(d, 0.1, 0.5, 0.1, s * 0.3, 2.45, 0.35, -0.6, 0, s * 0.2); }
  }, md, mm, gm, ml));
  // backpack: the hero view from the chase camera
  const pack = new THREE.Group(); pack.position.set(0, 1.85, 0.55); torso.add(pack);
  pack.add(part((d, m, g) => {
    B(d, 1.0, 0.95, 0.45, 0, 0, 0); B(m, 0.7, 0.6, 0.12, 0, 0.05, 0.27);
    for (let k = 0; k < 4; k++) B(g, 0.5, 0.03, 0.02, 0, -0.2 + k * 0.13, 0.34);
    for (const s of [-1, 1]) {
      const nx = s * (R ? 0.42 : 0.5);
      C(d, 0.24, 0.33, 1.25, 10, nx, -0.28, 0.42, Math.PI / 2); // nacelle
      C(m, 0.36, 0.36, 0.14, 10, nx, -0.28, 0.98, Math.PI / 2); // nozzle collar
      C(g, 0.27, 0.27, 0.03, 12, nx, -0.28, 1.06, Math.PI / 2);
      B(m, 0.1, 0.55, 1.0, s * (R ? 0.68 : 0.8), -0.22, 0.4, 0, 0, s * 0.08); // nacelle armor fin
      B(g, 0.03, 0.03, 0.85, s * (R ? 0.74 : 0.86), -0.05, 0.4);
      if (!R) B(d, 0.06, 0.4, 0.55, nx, 0.12, 0.7, 0.4, 0, 0); // vertical stabilizer
    }
  }, md, mm, gm));
  // missile pods on the pack shoulders (open on launch)
  const pod = (s: number) => {
    const pg = new THREE.Group(); pg.position.set(s * 0.5, 0.5, -0.05); pack.add(pg);
    pg.add(part((d, m, g) => {
      B(m, 0.42, 0.28, 0.72, 0, 0.12, 0); B(d, 0.46, 0.08, 0.76, 0, 0.29, 0);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) B(g, 0.07, 0.03, 0.07, -0.12 + a * 0.12, 0.27, -0.2 + b * 0.14);
    }, md, mm, gm));
    return pg;
  };
  const podGL = pod(-1), podGR = pod(1);
  const head = part((d, m, g) => {
    if (R) {
      B(d, 0.42, 0.32, 0.46, 0, 0, 0); B(m, 0.5, 0.14, 0.52, 0, 0.16, 0.04); B(d, 0.3, 0.16, 0.3, 0, -0.16, -0.1);
      S(g, 0.075, 0, 0.0, -0.24, 1, 1, 0.5); B(g, 0.3, 0.03, 0.02, 0, 0.0, -0.235);
      for (const s of [-1, 1]) B(d, 0.05, 0.05, 0.55, s * 0.17, 0.2, -0.18, 0.55, 0, s * 0.35);
    } else {
      B(d, 0.36, 0.3, 0.42, 0, 0, 0); B(m, 0.3, 0.1, 0.26, 0, -0.15, -0.08);
      B(g, 0.32, 0.055, 0.03, 0, 0.02, -0.215);
      B(d, 0.06, 0.13, 0.62, 0, 0.2, 0.14, -0.32, 0, 0); B(g, 0.035, 0.035, 0.24, 0, 0.27, 0.38, -0.32, 0, 0);
      for (const s of [-1, 1]) { B(m, 0.04, 0.04, 0.42, s * 0.19, 0.11, 0.16, -0.2, s * 0.3, 0); B(d, 0.08, 0.2, 0.26, s * 0.2, -0.02, 0.02); }
    }
  }, md, mm, gm);
  head.position.set(0, 2.42, -0.05); torso.add(head);
  const shoulders: THREE.Group[] = [];
  const arm = (s: number) => {
    const a = new THREE.Group(); a.position.set(s * 0.92, 2.0, 0);
    const sh = new THREE.Group(); a.add(sh); shoulders.push(sh);
    sh.add(part((d, m, g, l) => {
      B(d, 0.62, 0.5, 0.76, s * 0.14, 0.06, 0, 0, 0, -s * 0.28); B(l, 0.66, 0.12, 0.82, s * 0.13, 0.34, 0.02, 0, 0, -s * 0.28);
      B(m, 0.5, 0.36, 0.1, s * 0.16, 0.0, -0.41, 0, 0, -s * 0.28); B(g, 0.6, 0.035, 0.035, s * 0.18, 0.12, -0.42, 0, 0, -s * 0.28);
      if (R) { B(d, 0.1, 0.8, 0.12, s * 0.28, 0.55, 0.12, -0.25, 0, -s * 0.55); B(d, 0.08, 0.55, 0.1, s * 0.4, 0.4, -0.15, 0.2, 0, -s * 0.8); }
    }, md, mm, gm, ml));
    a.add(part((d, m, g) => {
      B(d, 0.28, 0.62, 0.3, 0, -0.42, 0); S(m, 0.18, 0, -0.78, 0);
      B(d, 0.4, 0.76, 0.46, 0, -1.15, -0.05); B(m, 0.44, 0.18, 0.5, 0, -0.92, -0.05); B(m, 0.12, 0.5, 0.36, s * 0.24, -1.2, -0.02);
      B(g, 0.03, 0.5, 0.03, s * 0.24, -1.15, -0.22);
      if (s > 0) { // rifle
        B(d, 0.18, 0.26, 1.6, 0.05, -1.45, -0.75); B(m, 0.08, 0.08, 1.0, 0.05, -1.4, -1.95); B(m, 0.1, 0.12, 0.42, 0.05, -1.24, -0.62);
        B(g, 0.03, 0.03, 1.3, 0.15, -1.38, -0.8); B(m, 0.1, 0.32, 0.22, 0.05, -1.7, -0.45); B(g, 0.06, 0.06, 0.06, 0.05, -1.4, -2.45);
      } else { // blade emitter
        B(m, 0.24, 0.3, R ? 0.9 : 0.6, -0.1, -1.3, -0.25); B(g, 0.08, 0.08, 0.18, -0.1, -1.4, R ? -0.72 : -0.58);
        if (R) B(d, 0.06, 0.4, 1.1, -0.24, -1.2, -0.3, 0, 0, 0.2);
      }
    }, md, mm, gm));
    body.add(a); return a;
  };
  const armR = arm(1), armL = arm(-1);
  const gunTip = new THREE.Object3D(); gunTip.position.set(0.05, -1.4, -2.5); armR.add(gunTip);
  const blade = new THREE.Group(); blade.position.set(-0.12, -1.42, R ? -0.75 : -0.6); armL.add(blade);
  const bm = R ? additive(3, 0.4, 1.4) : additive(1.2, 2.6, 3.2); const bc = R ? glow(4.5, 2.5, 3.5) : glow(3, 4, 4.5);
  const BL = R ? 4.2 : 3.4;
  const bg1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, BL).translate(0, 0, -BL / 2), bm);
  const bg2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, BL - 0.1).translate(0, 0, -BL / 2), bc);
  blade.add(bg1, bg2); blade.scale.set(1, 1, 0.01); blade.visible = false;
  const footFlames: THREE.Mesh[] = [];
  const ffm = additive(flameRGB[0], flameRGB[1], flameRGB[2], 0.7);
  const leg = (s: number) => {
    const l = new THREE.Group(); l.position.set(s * 0.32, 0.72, 0);
    l.add(part((d, m, g) => {
      B(d, 0.38, 0.72, 0.44, 0, -0.36, 0); B(m, 0.46, 0.3, 0.52, s * 0.04, -0.06, 0); B(g, 0.04, 0.4, 0.03, s * 0.2, -0.38, -0.21);
    }, md, mm, gm));
    const shin = new THREE.Group(); shin.position.set(0, -0.74, 0); l.add(shin);
    shin.add(part((d, m, g, l) => {
      B(l, 0.38, 0.34, 0.22, 0, 0, -0.22, 0.25, 0, 0); // knee
      B(d, 0.46, 0.98, 0.56, 0, -0.52, 0.06); B(m, 0.5, 0.2, 0.6, 0, -0.18, 0.06);
      B(d, 0.32, 0.66, 0.32, 0, -0.48, 0.4); C(g, 0.11, 0.11, 0.03, 10, 0, -0.55, 0.57, Math.PI / 2); // calf thruster
      B(g, 0.05, 0.56, 0.035, 0, -0.5, -0.23); B(m, 0.34, 0.16, 0.74, 0, -1.04, -0.12); B(d, 0.3, 0.1, 0.3, 0, -1.08, 0.26);
      if (R) B(d, 0.06, 0.5, 0.06, s * 0.2, -0.2, 0.3, 0.6, 0, 0);
    }, md, mm, gm, ml));
    const ff = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.4), ffm); ff.position.set(0, -0.55, 0.58); shin.add(ff); footFlames.push(ff);
    body.add(l); return { l, shin };
  };
  const LL = leg(-1), LR = leg(1);
  const wing = (s: number) => {
    const w = new THREE.Group(); w.position.set(s * 0.42, 2.1, 0.85);
    w.add(part((d, m, g) => {
      if (R) {
        B(d, 2.4, 0.07, 0.6, s * 1.15, 0.1, 0.1, 0, s * -0.25, 0); B(g, 2.4, 0.04, 0.04, s * 1.15, 0.1, -0.2, 0, s * -0.25, 0);
        B(d, 1.8, 0.06, 0.5, s * 0.9, -0.5, 0.35, 0, s * -0.4, s * 0.3); B(g, 1.8, 0.035, 0.035, s * 0.9, -0.5, 0.1, 0, s * -0.4, s * 0.3);
        B(d, 0.08, 0.08, 1.2, s * 2.3, 0.1, 0.5, 0.3, 0, 0);
      } else {
        B(d, 2.3, 0.06, 0.5, s * 1.15, 0, 0); B(g, 2.3, 0.04, 0.05, s * 1.15, 0, -0.26);
        B(d, 1.9, 0.05, 0.38, s * 0.95, -0.36, 0.14, 0, 0, s * 0.28); B(g, 1.9, 0.035, 0.035, s * 0.95, -0.36, -0.06, 0, 0, s * 0.28);
        B(m, 1.4, 0.05, 0.3, s * 0.72, -0.7, 0.24, 0, 0, s * 0.55); B(g, 0.3, 0.04, 0.04, s * 1.3, -1.02, 0.1, 0, 0, s * 0.55);
      }
      B(m, 0.34, 0.34, 0.5, s * 0.1, -0.1, 0);
    }, md, mm, gm));
    w.rotation.set(0, s * -0.4, s * 0.42); body.add(w); return w;
  };
  const wingL = wing(-1), wingR = wing(1);
  const flames: THREE.Mesh[] = [];
  const fm = additive(flameRGB[0] * 0.8, flameRGB[1] * 0.8, flameRGB[2] * 0.8, 0.6);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.8, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.9), fm);
    f.position.set(s * (R ? 0.42 : 0.5), 1.85 - 0.28, 0.55 + 1.06); body.add(f); flames.push(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.6), additive(0.7, 1.1, 1.5, 0.8)); f.add(f2);
  }
  const podL = new THREE.Object3D(); podL.position.set(0, 0.35, -0.2); podGL.add(podL);
  const podR = new THREE.Object3D(); podR.position.set(0, 0.35, -0.2); podGR.add(podR);
  LL.l.rotation.x = 0.4; LR.l.rotation.x = 0.5; LL.shin.rotation.x = 0.45; LR.shin.rotation.x = 0.4;
  return { root, body, torso, head, armL, armR, legL: LL.l, legR: LR.l, shinL: LL.shin, shinR: LR.shin, pack, podGL, podGR, shoulderL: shoulders[1], shoulderR: shoulders[0],
    wingL, wingR, blade, gunTip, flames, footFlames, podL, podR, glowMat: gm, variant };
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

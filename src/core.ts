import * as THREE from 'three';

export const G: any = {
  time: 0, dt: 0, realDt: 0, missionTime: 0,
  speed: 140, baseSpeed: 140, speedMul: 1,
  slowScale: 1, slowTime: 0, hitstopTime: 0, timeScale: 1,
  trauma: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1),
  state: 'title', // title | playing | dead | victory
  god: false, cinematic: false,
  stats: { kills: 0, maxCombo: 0, perfect: 0, nearMiss: 0, score: 0, start: 0 },
};

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, l: number, dt: number) => lerp(a, b, 1 - Math.exp(-l * dt));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; t = clamp(t, 0, 1); return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function slowmo(scale: number, dur: number) {
  G.slowScale = Math.min(G.slowTime > 0 ? G.slowScale : 1, scale);
  G.slowTime = Math.max(G.slowTime, dur);
}
export function hitstop(dur: number) { G.hitstopTime = Math.max(G.hitstopTime, dur); }
export function shake(a: number) { G.trauma = Math.min(1.2, G.trauma + a); if (G.onShake && a > 0.08) G.onShake(a); }
export function flash(a: number, r = 1, g = 1, b = 1) { G.flash = Math.max(G.flash, a); G.flashColor.setRGB(r, g, b); }

export interface Target {
  alive: boolean; radius: number; lockable: boolean; maxLocks: number; locks: number;
  pos: THREE.Vector3; kind: string; isBoss?: boolean;
  hit(dmg: number, p: THREE.Vector3, src: string): void;
}

const _v = new THREE.Vector3();
export function toScreen(p: THREE.Vector3, out: { x: number; y: number; z: number; on: boolean }) {
  _v.copy(p).project(G.camera);
  out.x = (_v.x * 0.5 + 0.5) * G.width;
  out.y = (-_v.y * 0.5 + 0.5) * G.height;
  out.z = _v.z;
  out.on = _v.z < 1 && _v.z > -1 && out.x > -50 && out.x < G.width + 50 && out.y > -50 && out.y < G.height + 50;
  return out;
}

export function segSphere(ax: number, ay: number, az: number, bx: number, by: number, bz: number, c: THREE.Vector3, r: number) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const fx = c.x - ax, fy = c.y - ay, fz = c.z - az;
  const l2 = dx * dx + dy * dy + dz * dz || 1e-6;
  let t = (fx * dx + fy * dy + fz * dz) / l2; t = clamp(t, 0, 1);
  const px = ax + dx * t - c.x, py = ay + dy * t - c.y, pz = az + dz * t - c.z;
  return px * px + py * py + pz * pz <= r * r;
}

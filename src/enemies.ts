import * as THREE from 'three';
import { G, rand, clamp, damp, lerp, segSphere, shake, Target, easeOut, slowmo, flash } from './core';
import { mapMech } from './assets';
import { buildDrone, buildFighter, buildHeavy, buildMech, buildBattleshipHalf, glow, mats, Mech, additive, addRim, ENEMY_RIM, RAVEN_RIM } from './models';
import { fx, Ribbon } from './fx';
import { sfx } from './audio';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), look = new THREE.Object3D(); const RAVEN_GLOW = new THREE.Color(3, 0.25, 0.7);
const STATS: Record<string, { hp: number; r: number; locks: number; score: number; boom: number }> = {
  drone: { hp: 16, r: 2.2, locks: 1, score: 100, boom: 1.1 },
  fighter: { hp: 40, r: 2.6, locks: 1, score: 200, boom: 1.4 },
  heavy: { hp: 320, r: 4.8, locks: 3, score: 800, boom: 2.6 },
  elite: { hp: 1100, r: 3.6, locks: 3, score: 3000, boom: 3 },
  shipcore: { hp: 650, r: 9, locks: 6, score: 5000, boom: 4 },
};

export class Enemy implements Target {
  kind: string; mesh: THREE.Group; pos: THREE.Vector3; vel = new THREE.Vector3(); hp = 1; maxHp = 1; radius = 2; alive = false;
  lockable = true; maxLocks = 1; locks = 0; age = 0; d: any = {}; flashT = 0; flashMat: THREE.MeshStandardMaterial | null = null; mech?: Mech; spin?: THREE.Object3D;
  constructor(kind: string, mesh: THREE.Group) {
    this.kind = kind; this.mesh = mesh; this.pos = mesh.position; mesh.visible = false;
    const fm = (kind === 'elite' ? mats.dark : mats.enemyDark).clone() as THREE.MeshStandardMaterial; fm.emissive = new THREE.Color(0, 0, 0); addRim(fm, kind === 'elite' ? RAVEN_RIM : ENEMY_RIM, kind === 'elite' ? 2.0 : 2.2); this.flashMat = fm;
    mesh.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material === mats.enemyDark || m.material === mats.dark)) m.material = fm; });
    this.spin = mesh.getObjectByName('spin') || undefined;
  }
  hit(dmg: number, p: THREE.Vector3, src: string) {
    if (!this.alive) return;
    if (this.kind === 'elite' && src === 'laser' && this.d.state === 'evade') dmg *= 0.3;
    this.hp -= dmg; this.flashT = 0.07;
    if (src === 'laser') { fx.sparks(p, 6, 28, 3, 1.6, 0.6); sfx.hit(); }
    if (this.kind === 'elite' && src === 'laser' && Math.random() < 0.12 && this.d.dodgeCd <= 0) G.enemies.eliteEvade(this);
    if (this.hp <= 0) G.enemies.kill(this, src);
  }
}

interface Orb { p: THREE.Vector3; v: THREE.Vector3; life: number; dmg: number; alive: boolean; near: boolean; big: boolean }
interface EMissile { p: THREE.Vector3; v: THREE.Vector3; life: number; alive: boolean; rib: Ribbon | null; near: boolean; turn: number }

export class Enemies {
  scene: THREE.Scene; pools: Record<string, Enemy[]> = {}; active: Enemy[] = [];
  orbs: Orb[] = []; orbMesh: THREE.InstancedMesh; bigOrbMesh: THREE.InstancedMesh; missiles: EMissile[] = []; mslMesh: THREE.InstancedMesh;
  m4 = new THREE.Matrix4(); q = new THREE.Quaternion(); sv = new THREE.Vector3(1, 1, 1);
  ship: { g: THREE.Group; halves: THREE.Group[]; core: Enemy; state: string; t: number; fireT: number } | null = null;
  rGhosts: { g: THREE.Group; mat: THREE.MeshBasicMaterial; t: number }[] = []; rRibs: (Ribbon | null)[] = []; camP = new THREE.Vector3(); camL = new THREE.Vector3(); ghostT = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const mk = (kind: string, n: number, build: () => THREE.Group) => { this.pools[kind] = []; for (let i = 0; i < n; i++) { const g = build(); scene.add(g); this.pools[kind].push(new Enemy(kind, g)); } };
    const gD = glow(3.2, 0.45, 0.15), gF = glow(3, 0.25, 0.9), gH = glow(3.2, 1.3, 0.2);
    mk('drone', 40, () => buildDrone(gD));
    mk('fighter', 14, () => { const g = new THREE.Group(); g.add(buildFighter(gF)); return g; });
    mk('heavy', 6, () => { const g = new THREE.Group(); g.add(buildHeavy(gH)); return g; });
    mk('elite', 1, () => { const m = buildMech([3, 0.25, 0.7], mats.dark, mats.enemyMid, [3, 0.4, 0.8], 'raven'); m.root.scale.setScalar(1.5); m.root.rotation.y = Math.PI; const g = new THREE.Group(); g.add(m.root); (g as any).mech = m; return g; });
    const e = this.pools.elite[0]; e.mech = (e.mesh as any).mech; this.buildRavenGhosts();
    // orbs
    const om = new THREE.MeshBasicMaterial(); om.color.setRGB(4, 0.9, 0.35);
    this.orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.75, 1), om, 400); this.orbMesh.count = 0; this.orbMesh.frustumCulled = false; scene.add(this.orbMesh);
    const bm = new THREE.MeshBasicMaterial(); bm.color.setRGB(3.5, 0.5, 1.6);
    this.bigOrbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 1), bm, 200); this.bigOrbMesh.count = 0; this.bigOrbMesh.frustumCulled = false; scene.add(this.bigOrbMesh);
    for (let i = 0; i < 600; i++) this.orbs.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, dmg: 0, alive: false, near: false, big: false });
    const mm = new THREE.MeshBasicMaterial(); mm.color.setRGB(3, 1.5, 0.6);
    this.mslMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 2.2, 6).rotateX(-Math.PI / 2), mm, 60); this.mslMesh.count = 0; this.mslMesh.frustumCulled = false; scene.add(this.mslMesh);
    for (let i = 0; i < 60; i++) this.missiles.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, alive: false, rib: null, near: false, turn: 2 });
    // battleship
    const sg = new THREE.Group(); const gs = glow(3, 1.2, 0.4); const h1 = buildBattleshipHalf(1, gs), h2 = buildBattleshipHalf(-1, gs);
    const hh1 = new THREE.Group(); hh1.add(h1); const hh2 = new THREE.Group(); hh2.add(h2); sg.add(hh1, hh2);
    const coreG = new THREE.Group(); const cm = glow(4, 1.0, 0.3);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(6.5, 2), cm); coreG.add(core);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(9, 1.4, 8, 32), mats.enemyMid); coreG.add(ringM);
    sg.visible = false; scene.add(sg); scene.add(coreG);
    const ce = new Enemy('shipcore', coreG); this.ship = { g: sg, halves: [hh1, hh2], core: ce, state: 'off', t: 0, fireT: 0 };
  }
  buildRavenGhosts() {
    const e = this.pools.elite[0];
    for (const g of this.rGhosts) this.scene.remove(g.g); this.rGhosts = [];
    for (let i = 0; i < 6; i++) {
      const mat = additive(2.4, 0.3, 0.8, 0.5); const g = e.mesh.clone(true);
      g.traverse(o => { const ms = o as THREE.Mesh; if (ms.isMesh) { if ((ms.material as THREE.Material).type === 'MeshBasicMaterial') ms.userData.ghostHide = true; ms.material = mat; } if (o.userData.proc) o.children.forEach((c, k) => { if (k > 0) c.userData.ghostHide = true; }); });
      g.visible = false; this.scene.add(g); this.rGhosts.push({ g, mat, t: 0 });
    }
  }
  applyRavenModel(src: THREE.Object3D) { const e = this.pools.elite[0]; if (mapMech(e.mech!, src)) this.buildRavenGhosts(); }
  ravenGhost(e: Enemy, a = 0.5) {
    const gh = this.rGhosts.find(g => g.t <= 0) || this.rGhosts[0]; if (!gh) return;
    gh.t = 0.35; gh.mat.opacity = a; gh.g.visible = true; gh.g.position.copy(e.mesh.position); gh.g.quaternion.copy(e.mesh.quaternion);
    const src: THREE.Object3D[] = [], dst: THREE.Object3D[] = []; e.mesh.traverse(o => src.push(o)); gh.g.traverse(o => dst.push(o));
    for (let i = 1; i < src.length && i < dst.length; i++) { dst[i].position.copy(src[i].position); dst[i].quaternion.copy(src[i].quaternion); dst[i].visible = src[i].visible && !dst[i].userData.ghostHide; }
  }
  get list() { return this.active; }
  count(kind?: string) { let n = 0; for (const e of this.active) if (e.alive && (!kind || e.kind === kind)) n++; return n; }
  spawn(kind: string, d: any = {}): Enemy | null {
    const e = this.pools[kind].find(x => !x.alive && !this.active.includes(x)); if (!e) return null;
    const s = STATS[kind]; e.hp = e.maxHp = s.hp * (d.hpMul || 1); e.radius = s.r; e.maxLocks = s.locks; e.locks = 0; e.age = 0; e.alive = true; e.lockable = true;
    e.d = { ...d, shoot: d.shoot ?? true }; e.vel.set(0, 0, 0); e.flashT = 0; e.mesh.visible = true; e.mesh.scale.setScalar(kind === 'drone' || kind === 'fighter' ? 1.3 : 1);
    if (d.from) e.pos.copy(d.from); else e.pos.set(0, 0, -500);
    if (kind === 'elite') {
      e.d.state = 'enter'; e.d.t = 0; e.d.dodgeCd = 0; e.d.atk = 0; e.d.target = new THREE.Vector3(0, 6, -60);
      this.rRibs = [];
    }
    this.active.push(e); return e;
  }
  kill(e: Enemy, src: string) {
    if (!e.alive) return; e.alive = false; e.mesh.visible = false;
    const s = STATS[e.kind];
    tmp.copy(e.vel); tmp.z = Math.min(tmp.z, 0);
    fx.explosion(e.pos, s.boom, tmp, { debris: Math.round(s.boom * 3) });
    if (e.kind === 'elite') {
      slowmo(0.3, 1.1); flash(0.5, 1, 0.45, 0.3); shake(1); fx.ring(e.pos, 2, 60, 0.7, 3, 0.6, 1.2); fx.ring(e.pos, 2, 35, 0.5, 3, 2, 2);
      fx.explosion(e.pos, 4, undefined, { debris: 24 }); sfx.explosion(4);
      for (const r of this.rRibs) if (r) r.fading = true; this.rRibs = [];
      if (G.camRig && G.camRig.owner === 'raven') { G.camRig = null; G.cinematic = false; }
    }
    if (e.kind === 'heavy' || e.kind === 'elite') {
      for (let i = 0; i < (e.kind === 'elite' ? 6 : 3); i++) { const p = e.pos.clone().add(new THREE.Vector3(rand(-5, 5), rand(-4, 4), rand(-4, 4))); fx.later(0.12 + i * 0.12, () => fx.explosion(p, 1.4)); }
    }
    G.onKill && G.onKill(e, s.score, src);
  }
  shootMissiles(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    for (const m of this.missiles) if (m.alive && segSphere(ax, ay, az, bx, by, bz, m.p, 1.8)) { this.killMissile(m, true); G.addScore && G.addScore(30); return true; }
    return false;
  }
  killMissile(m: EMissile, boom: boolean) { m.alive = false; if (m.rib) m.rib.fading = true; if (boom) fx.explosion(m.p, 0.6, undefined, { debris: 0 }); }
  fireOrb(from: THREE.Vector3, to: THREE.Vector3, speed: number, dmg = 8, big = false, spread = 0) {
    const o = this.orbs.find(x => !x.alive); if (!o) return;
    o.alive = true; o.p.copy(from); o.v.copy(to).sub(from).normalize();
    if (spread) { o.v.x += rand(-spread, spread); o.v.y += rand(-spread, spread); o.v.normalize(); }
    o.v.multiplyScalar(speed); o.life = 6; o.dmg = dmg; o.near = false; o.big = big;
  }
  fireOrbDir(from: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg = 8, big = false) {
    const o = this.orbs.find(x => !x.alive); if (!o) return;
    o.alive = true; o.p.copy(from); o.v.copy(dir).normalize().multiplyScalar(speed); o.life = 6; o.dmg = dmg; o.near = false; o.big = big;
  }
  fireMissile(from: THREE.Vector3, v: THREE.Vector3, turn = 2.2) {
    const m = this.missiles.find(x => !x.alive); if (!m) return;
    m.alive = true; m.p.copy(from); m.v.copy(v); m.life = 5.5; m.near = false; m.turn = turn;
    m.rib = fx.ribbon(); if (m.rib) m.rib.start(from.x, from.y, from.z, 0.3, 2.4, 0.6, 0.3, 0.9, 1);
  }
  clear() {
    for (const e of this.active) { e.alive = false; e.mesh.visible = false; } this.active.length = 0; this.rRibs = []; for (const g of this.rGhosts) { g.t = 0; g.g.visible = false; }
    for (const o of this.orbs) o.alive = false; for (const m of this.missiles) { m.alive = false; m.rib = null; }
    if (this.ship) { this.ship.state = 'off'; this.ship.g.visible = false; this.ship.core.alive = false; this.ship.core.mesh.visible = false; }
  }
  // -------------- battleship set piece --------------
  startShip() {
    const s = this.ship!; s.state = 'approach'; s.t = 0; s.fireT = 2; s.g.visible = true; s.g.position.set(10, 34, -1500); s.g.rotation.set(0, 0.0, 0);
    s.halves[0].position.set(0, 0, 0); s.halves[0].rotation.set(0, 0, 0); s.halves[1].position.set(0, 0, 0); s.halves[1].rotation.set(0, 0, 0);
    const c = s.core; const st = STATS.shipcore; c.hp = c.maxHp = st.hp; c.radius = st.r; c.maxLocks = st.locks; c.locks = 0; c.alive = true; c.lockable = true; c.mesh.visible = true; c.d = {};
    if (!this.active.includes(c)) this.active.push(c);
  }
  updateShip(dt: number) {
    const s = this.ship!; if (s.state === 'off') return;
    s.t += dt;
    if (s.state === 'approach') {
      s.g.position.z += G.speed * 0.42 * dt;
      s.g.position.x = 10 + Math.sin(s.t * 0.3) * 6;
      s.core.pos.copy(s.g.position).add(tmp.set(0, -6, 14)); s.core.mesh.rotation.z += dt;
      (s.core.mesh.children[0] as THREE.Mesh).scale.setScalar(1 + Math.sin(G.time * 10) * 0.08);
      s.fireT -= dt;
      if (s.fireT <= 0 && s.g.position.z > -900 && s.g.position.z < -60 && G.player.alive) {
        s.fireT = 0.9;
        for (let k = 0; k < 4; k++) { tmp.copy(s.g.position).add(tmp2.set(rand(-80, 90), 10, 14)); this.fireOrb(tmp, G.player.pos, 90, 8, false, 0.08); }
      }
      if (!s.core.alive) { this.shipBreak(); }
      else if (s.g.position.z > 120) { s.state = 'off'; s.g.visible = false; s.core.alive = false; s.core.mesh.visible = false; }
    } else if (s.state === 'break') {
      s.g.position.z += G.speed * 0.3 * dt; s.g.position.y -= dt * (6 + s.t * 6);
      s.halves[0].position.x += dt * 14; s.halves[0].rotation.z -= dt * 0.12; s.halves[0].rotation.x += dt * 0.05;
      s.halves[1].position.x -= dt * 12; s.halves[1].rotation.z += dt * 0.1; s.halves[1].rotation.y += dt * 0.04;
      if (Math.random() < dt * 14) { tmp.set(rand(-90, 100), rand(-8, 14), rand(-12, 14)); s.g.localToWorld(tmp); fx.explosion(tmp, rand(1.5, 3.5), undefined, { sound: Math.random() < 0.4, debris: 2 }); }
      if (s.t > 7) { s.state = 'off'; s.g.visible = false; }
    }
  }
  shipBreak() {
    const s = this.ship!; s.state = 'break'; s.t = 0; s.core.mesh.visible = false;
    const base = s.g.position.clone();
    for (let i = 0; i < 14; i++) fx.later(i * 0.11, () => { const p = new THREE.Vector3(-90 + i * 14, rand(-5, 10), 13); s.g.localToWorld(p); fx.explosion(p, 3 + (i % 3), undefined, { debris: 5 }); });
    fx.explosion(base.add(tmp.set(0, -6, 14)), 7, undefined, { debris: 30 });
    G.hud.big('b_shipDown', 'kill'); shake(1);
  }
  eliteEvade(e: Enemy) {
    e.d.dodgeCd = 1.6; e.d.state = 'evade'; e.d.t = 0; e.d.evDir = (e.pos.x > G.player.pos.x ? 1 : -1) * (Math.random() < 0.25 ? -1 : 1);
    sfx.dodge(); G.hud.small('m_evade', 'warn'); this.ravenGhost(e, 0.6);
  }
  // ---------------- per-type AI ----------------
  ai(e: Enemy, dt: number) {
    const d = e.d, P = G.player.pos;
    if (e.kind === 'drone') {
      const ent = d.enterT || 1.8;
      if (e.age < ent) { const u = easeOut(e.age / ent); e.pos.lerpVectors(d.from, d.station, u); e.pos.y += Math.sin(u * Math.PI) * (d.arc || 20); }
      else if (e.age < ent + (d.stay || 9)) {
        const t = e.age - ent; tmp.copy(d.station); tmp.x += Math.sin(t * 1.3 + d.ph) * (d.wx ?? 8); tmp.y += Math.cos(t * 1.7 + d.ph) * (d.wy ?? 4); tmp.z += Math.sin(t * 0.6 + d.ph) * 10;
        e.pos.x = damp(e.pos.x, tmp.x, 3, dt); e.pos.y = damp(e.pos.y, tmp.y, 3, dt); e.pos.z = damp(e.pos.z, tmp.z, 3, dt);
        if (d.shoot && Math.random() < dt * (d.rate || 0.25)) this.fireOrb(e.pos, P, 75, 7, false, 0.03);
      } else { e.vel.x += Math.sign(e.pos.x || 1) * 60 * dt; e.vel.y += 50 * dt; e.vel.z += 140 * dt; e.pos.addScaledVector(e.vel, dt); if (e.pos.z > 60 || e.pos.y > 150) this.despawn(e); }
      if (e.spin) e.spin.rotation.y += dt * 6;
    } else if (e.kind === 'fighter') {
      if (e.age < 1.6) { e.pos.z = lerp(d.from.z, d.tz, easeOut(e.age / 1.6)); e.pos.x = lerp(d.from.x, d.tx, easeOut(e.age / 1.6)); e.pos.y = lerp(d.from.y, d.ty, easeOut(e.age / 1.6)); }
      else if (e.age < (d.stay || 11)) {
        const t = e.age - 1.6; const nx = d.tx * Math.cos(t * 0.7) + Math.sin(t * 1.1 + d.ph) * 25; const ny = d.ty + Math.sin(t * 1.4 + d.ph) * 9;
        e.vel.x = (nx - e.pos.x) / dt * 0.05; e.pos.x = damp(e.pos.x, nx, 2.2, dt); e.pos.y = damp(e.pos.y, ny, 2.2, dt); e.pos.z = damp(e.pos.z, d.tz + Math.sin(t) * 15, 2, dt);
        d.fire = (d.fire ?? rand(0.5, 2)) - dt;
        if (d.fire <= 0 && d.shoot) { d.fire = rand(1.8, 2.8); for (let k = 0; k < 3; k++) fx.later(k * 0.12, () => { if (e.alive) this.fireOrb(e.pos, P, 110, 6, false, 0.02); }); }
      } else { e.vel.z -= 260 * dt; e.vel.y += 30 * dt; e.pos.addScaledVector(e.vel, dt); if (e.pos.z < -900) this.despawn(e); }
    } else if (e.kind === 'heavy') {
      if (e.age < 3.5) e.pos.lerpVectors(d.from, d.station, easeOut(e.age / 3.5));
      else if (e.age < (d.stay || 40)) {
        const t = e.age; e.pos.x = damp(e.pos.x, d.station.x + Math.sin(t * 0.4) * 14, 1.5, dt); e.pos.y = damp(e.pos.y, d.station.y + Math.sin(t * 0.7) * 5, 1.5, dt);
        d.fire = (d.fire ?? 2) - dt;
        if (d.fire <= 0 && d.shoot) { d.fire = 3.2; d.alt = !d.alt;
          if (d.alt) { for (let k = -3; k <= 3; k++) { tmp.copy(P).sub(e.pos).normalize(); tmp.x += k * 0.07; this.fireOrbDir(e.pos, tmp, 70, 10, true); } }
          else for (let k = 0; k < 4; k++) this.fireMissile(e.pos, tmp.set((k - 1.5) * 30, 30, 10), 1.8);
        }
      } else { e.pos.z -= 120 * dt; if (e.pos.z < -800) this.despawn(e); }
    } else if (e.kind === 'elite') this.eliteAI(e, dt);
    if (e.kind !== 'elite') {
      look.position.copy(e.pos); look.lookAt(e.kind === 'fighter' && e.age > (d.stay || 11) ? tmp.copy(e.pos).add(e.vel) : P); e.mesh.quaternion.slerp(look.quaternion, 1 - Math.exp(-6 * dt));
      if (e.kind === 'fighter') e.mesh.rotateZ(clamp(-e.vel.x * 0.02, -0.9, 0.9));
    }
  }
  eliteAI(e: Enemy, dt: number) {
    const d = e.d, P = G.player.pos, m = e.mech!; d.t += dt; d.dodgeCd -= dt;
    const goto = (target: THREE.Vector3, k: number) => { e.pos.x = damp(e.pos.x, target.x, k, dt); e.pos.y = damp(e.pos.y, target.y, k, dt); e.pos.z = damp(e.pos.z, target.z, k, dt); };
    if (d.state === 'enter') {
      // 2.6 s entrance: drop in on a long lens, flare, name card, then hand control back
      const u = easeOut(clamp(d.t / 2.2, 0, 1)); e.pos.lerpVectors(tmp.set(0, 70, -420), tmp2.set(0, 8, -70), u);
      if (!d.cine) { d.cine = true; G.cinematic = true; sfx.ravenWarn(); }
      this.camP.set(P.x - 2.2, P.y + 0.9, P.z + 7.5); this.camL.copy(e.pos); G.camRig = { pos: this.camP, look: this.camL, fov: lerp(28, 46, u), owner: 'raven' };
      if (d.t > 1.5 && !d.flare) { d.flare = true; G.hud.big('b_raven', 'boss', 2); m.glowMat.color.setRGB(9, 1, 2.5); fx.ring(e.pos, 2, 30, 0.5, 3, 0.4, 1); shake(0.4); sfx.boost(); }
      if (d.flare) m.glowMat.color.lerp(RAVEN_GLOW, 1 - Math.exp(-3 * dt));
      if (Math.random() < 0.9) { m.flames[0].getWorldPosition(tmp); fx.add.emit(tmp.x, tmp.y, tmp.z, 0, 60, 30, 0.3, 2.5, 0.4, 3, 0.5, 1, 1, 0.1, 0.3, 0.9, 1, 0, 0.03, 0, 1); }
      if (d.t > 2.6) { d.state = 'strafe'; d.t = 0; this.rRibs = m.flames.map(f => { const r = fx.ribbon(); f.getWorldPosition(tmp); if (r) r.start(tmp.x, tmp.y, tmp.z, 0.16, 2.6, 0.35, 0.9, 0.45, 1); return r; }); if (G.camRig && G.camRig.owner === 'raven') G.camRig = null; G.cinematic = false; }
    }
    else if (d.state === 'strafe') {
      if (d.t > 1.6 || !d.tp) { d.tp = new THREE.Vector3(rand(-26, 26), rand(-8, 16), rand(-85, -55)); if (d.t > 1.6) { d.t = 0; d.atk++; d.state = ['rifle', 'missiles', 'melee', 'rifle', 'melee'][d.atk % 5]; } }
      goto(d.tp, 3);
    } else if (d.state === 'evade') {
      e.pos.x += d.evDir * 90 * (1 - d.t / 0.35) * dt; this.ghostT -= dt; if (this.ghostT <= 0) { this.ghostT = 0.05; this.ravenGhost(e, 0.45); } if (Math.random() < 0.6) { fx.add.emit(e.pos.x, e.pos.y, e.pos.z, 0, 0, 0, 0.3, 4, 1, 3, 0.3, 0.8, 1, 0.1, 0.3, 0.6, 0, 0, 0, 0.3, 0); }
      if (d.t > 0.35) { d.state = 'strafe'; d.t = 0; }
    } else if (d.state === 'rifle') {
      goto(d.tp, 2);
      if (d.t > 0.4 && Math.floor(d.t * 8) !== Math.floor((d.t - dt) * 8) && d.t < 1.8) { m.gunTip.getWorldPosition(tmp); this.fireOrb(tmp, P, 140, 6, false, 0.015); fx.muzzle(tmp, 3, 0.4, 1); }
      if (d.t > 2.2) { d.state = 'strafe'; d.t = 0; }
    } else if (d.state === 'missiles') {
      if (d.t > 0.3 && !d.fired) { d.fired = true; for (let k = 0; k < 6; k++) fx.later(k * 0.08, () => { if (!e.alive) return; (k % 2 ? m.podR : m.podL).getWorldPosition(tmp2); fx.add.emit(tmp2.x, tmp2.y, tmp2.z, 0, 0, 0, 0.1, 3, 0.6, 3, 1.2, 0.6, 2, 0.3, 0.2, 1, 0, 0, 0, 0, 1); this.fireMissile(tmp2, tmp.set((k - 2.5) * 22, rand(25, 45), 20), 2.4); }); sfx.missile(); }
      if (d.t > 1.4) { d.state = 'strafe'; d.t = 0; d.fired = false; }
    } else if (d.state === 'melee') {
      // telegraph -> dash -> slash
      if (d.t < 0.9) {
        goto(tmp.set(P.x, P.y + 2, -40), 3);
        if (!d.warned) { d.warned = true; G.hud.warn('w_eliteClose'); sfx.alarm(); fx.ring(e.pos, 1, 18, 0.4, 3, 0.4, 1); }
        // anticipation: eye flares, blade ignites early and grows, body coils
        const k = clamp((d.t - 0.35) / 0.5, 0, 1); m.blade.visible = k > 0; m.blade.scale.z = 0.3 + k * 0.7; m.glowMat.color.setRGB(3 + k * 6 * (0.6 + 0.4 * Math.sin(G.time * 40)), 0.25, 0.7 + k);
        m.body.rotation.y = damp(m.body.rotation.y, 0.7, 6, dt);
        if (Math.random() < 0.5) fx.add.emit(e.pos.x - 1, e.pos.y + 1, e.pos.z + 2, 0, 0, 0, 0.1, rand(3, 6), 0.5, 3, 0.4, 1, 1, 0.1, 0.4, 1, 0, 0, 0, 0, 1);
      }
      else if (d.t < 1.25) { const u = (d.t - 0.9) / 0.35; tmp.set(P.x, P.y + 1, P.z - 5); e.pos.lerp(tmp, u * 0.6 + 0.2); G.threat = Math.min(G.threat, 1.25 - d.t);
        this.ghostT -= dt; if (this.ghostT <= 0) { this.ghostT = 0.04; this.ravenGhost(e, 0.5); }
        if (Math.random() < 0.8) fx.add.emit(e.pos.x, e.pos.y, e.pos.z, 0, 0, 80, 0.2, 1.2, 0.2, 3, 0.4, 1, 1, 0.1, 0.3, 1, 0, 0, 0.04, 0, 1); }
      else if (!d.slashed) {
        d.slashed = true; m.blade.visible = true; m.blade.scale.z = 1; sfx.melee(); m.body.rotation.y = -0.6; m.glowMat.color.setRGB(3, 0.25, 0.7);
        if (e.pos.distanceTo(P) < 9) { if (G.player.damage(22, e.pos)) fx.sparks(P, 30, 50); }
        fx.ring(tmp.copy(e.pos).lerp(P, 0.5), 2, 14, 0.25, 3, 0.4, 1);
      } else if (d.t > 1.8) { d.state = 'strafe'; d.t = 0; d.slashed = false; d.warned = false; m.blade.visible = false; }
      else m.body.rotation.y = damp(m.body.rotation.y, 0, 5, dt);
    }
    if (e.age > 80 && d.state !== 'leave') { d.state = 'leave'; G.hud.small('m_withdraw', 'warn'); }
    if (d.state === 'leave') { e.pos.y += 60 * dt; e.pos.z -= 120 * dt; if (e.pos.z < -700) this.despawn(e); }
    // pose
    look.position.copy(e.pos); look.lookAt(P); e.mesh.quaternion.slerp(look.quaternion, 1 - Math.exp(-8 * dt));
    m.root.rotation.z = clamp(-(d.tp ? d.tp.x - e.pos.x : 0) * 0.03, -0.6, 0.6);
    m.armR.rotation.x = d.state === 'rifle' ? -1.4 : -0.3; m.armL.rotation.x = d.state === 'melee' ? (d.slashed ? 0.4 : -2.5) : 0.2;
    for (const f of m.flames) f.scale.z = (d.state === 'evade' || d.state === 'enter' ? 2.4 : 1.1) + Math.random() * 0.5;
    m.legL.rotation.x = damp(m.legL.rotation.x, d.state === 'melee' ? 0.9 : 0.5, 4, dt); m.shinL.rotation.x = damp(m.shinL.rotation.x, d.state === 'melee' ? 1.1 : 0.5, 4, dt);
    m.legR.rotation.x = damp(m.legR.rotation.x, 0.6, 4, dt); m.shinR.rotation.x = damp(m.shinR.rotation.x, 0.45, 4, dt);
    this.rRibs.forEach((r, i) => { if (r && r.alive) { m.flames[i].getWorldPosition(tmp); r.push(tmp.x, tmp.y, tmp.z); } });
    if (Math.random() < 0.6) { m.flames[0].getWorldPosition(tmp); fx.add.emit(tmp.x, tmp.y, tmp.z, 0, 0, 40, 0.25, 1, 0.1, 3, 0.5, 1.2, 1, 0.1, 0.3, 0.8, 2, 0, 0.02, 1, 0); }
  }
  despawn(e: Enemy) { e.alive = false; e.mesh.visible = false; if (e.kind === 'elite') { for (const r of this.rRibs) if (r) r.fading = true; this.rRibs = []; } }

  update(dt: number) {
    const P = G.player.pos, pl = G.player;
    this.updateShip(dt);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (!e.alive) { this.active.splice(i, 1); continue; }
      e.age += dt;
      if (e.kind !== 'shipcore') this.ai(e, dt);
      if (e.flashMat) { e.flashT -= dt; e.flashMat.emissive.setScalar(e.flashT > 0 ? 2.5 : 0); }
      if (e.kind === 'drone' || e.kind === 'fighter') {
        // body collision with player
        if (e.pos.distanceTo(P) < e.radius + 1.4 && pl.alive) { if (pl.damage(12, e.pos)) this.kill(e, 'ram'); }
      }
    }
    for (const g of this.rGhosts) if (g.t > 0) { g.t -= dt; g.mat.opacity = Math.max(0, g.t / 0.35) * 0.45; g.g.position.z += G.speed * 0.1 * dt; if (g.t <= 0) g.g.visible = false; }
    // orbs
    let n = 0, nb = 0;
    for (const o of this.orbs) {
      if (!o.alive) continue;
      o.life -= dt; if (o.life <= 0 || o.p.z > 60) { o.alive = false; continue; }
      const pz = o.p.z; o.p.addScaledVector(o.v, dt);
      const r = o.big ? 2.6 : 1.9;
      tmp.copy(o.p).sub(P);
      if (pl.alive && tmp.lengthSq() < r * r) { if (pl.damage(o.dmg, o.p)) { o.alive = false; fx.sparks(o.p, 10, 20, 3, 1, 0.5); continue; } }
      if (pl.alive && pz < P.z && o.p.z >= P.z && !o.near) { o.near = true; const dd = Math.hypot(o.p.x - P.x, o.p.y - P.y); if (dd < 5 && dd > r) pl.nearMiss(); }
      const vv = o.v.lengthSq(); const tt = -tmp.dot(o.v) / vv;
      if (tt > 0 && tt < 0.6) { tmp2.copy(tmp).addScaledVector(o.v, tt); if (tmp2.length() < r + 1.5) G.threat = Math.min(G.threat, tt); }
      this.m4.makeTranslation(o.p.x, o.p.y, o.p.z);
      if (o.big) this.bigOrbMesh.setMatrixAt(nb++, this.m4); else this.orbMesh.setMatrixAt(n++, this.m4);
    }
    this.orbMesh.count = n; this.orbMesh.instanceMatrix.needsUpdate = true; this.bigOrbMesh.count = nb; this.bigOrbMesh.instanceMatrix.needsUpdate = true;
    // enemy missiles
    let nm = 0;
    for (const m of this.missiles) {
      if (!m.alive) continue;
      m.life -= dt; if (m.life <= 0 || m.p.z > 60) { this.killMissile(m, m.life <= 0); continue; }
      tmp.copy(P).sub(m.p); const dist = tmp.length(); tmp.divideScalar(dist || 1);
      const sp = Math.min(150, m.v.length() + 80 * dt);
      if (m.p.z < P.z - 6) { tmp2.copy(m.v).normalize().lerp(tmp, 1 - Math.exp(-m.turn * dt)).normalize(); m.v.copy(tmp2).multiplyScalar(sp); }
      const pz = m.p.z; m.p.addScaledVector(m.v, dt);
      if (m.rib) m.rib.push(m.p.x, m.p.y, m.p.z);
      if (Math.random() < 0.5) fx.smoke.emit(m.p.x, m.p.y, m.p.z, 0, 0, 0, 0.7, 0.6, 2.2, 0.4, 0.35, 0.35, 0.2, 0.2, 0.2, 0.4, 3, 0, 0, 1, 2);
      if (pl.alive && m.p.distanceTo(P) < 2.4) { if (pl.damage(12, m.p)) { this.killMissile(m, true); continue; } }
      if (pz < P.z && m.p.z >= P.z && !m.near) { m.near = true; if (Math.hypot(m.p.x - P.x, m.p.y - P.y) < 6) pl.nearMiss(); }
      tmp2.copy(m.p).sub(P); const tt = -tmp2.dot(m.v) / m.v.lengthSq(); if (tt > 0 && tt < 0.6 && dist < 60) G.threat = Math.min(G.threat, tt);
      tmp2.copy(m.v).normalize(); this.q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tmp2); this.m4.compose(m.p, this.q, this.sv); this.mslMesh.setMatrixAt(nm++, this.m4);
    }
    this.mslMesh.count = nm; this.mslMesh.instanceMatrix.needsUpdate = true;
  }
}
export { shake };

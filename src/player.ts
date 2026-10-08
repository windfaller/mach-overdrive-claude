import * as THREE from 'three';
import { G, rand, clamp, damp, lerp, slowmo, hitstop, shake, flash, toScreen, segSphere, easeOut, Target } from './core';
import { buildMech, Mech, additive } from './models';
import { fx, Ribbon } from './fx';
import { sfx } from './audio';
import { isDown, wasPressed, wasReleased, aimNDC, mouse } from './input';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
const scr = { x: 0, y: 0, z: 0, on: false };

class Bolts {
  max = 180; n = 0; mesh: THREE.InstancedMesh; P = new Float32Array(180 * 3); V = new Float32Array(180 * 3); L = new Float32Array(180); D = new Float32Array(180);
  m = new THREE.Matrix4(); q = new THREE.Quaternion(); s = new THREE.Vector3(1, 1, 1); p = new THREE.Vector3(); d = new THREE.Vector3();
  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial(); mat.color.setRGB(0.8, 2.8, 3.6);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 8), mat, this.max); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
  }
  fire(from: THREE.Vector3, dir: THREE.Vector3, dmg: number) {
    if (this.n >= this.max) return; const i = this.n++;
    this.P[i * 3] = from.x; this.P[i * 3 + 1] = from.y; this.P[i * 3 + 2] = from.z;
    this.V[i * 3] = dir.x * 1200; this.V[i * 3 + 1] = dir.y * 1200; this.V[i * 3 + 2] = dir.z * 1200; this.L[i] = 0.5; this.D[i] = dmg;
  }
  kill(i: number) { this.n--; if (i === this.n) return; for (let k = 0; k < 3; k++) { this.P[i * 3 + k] = this.P[this.n * 3 + k]; this.V[i * 3 + k] = this.V[this.n * 3 + k]; } this.L[i] = this.L[this.n]; this.D[i] = this.D[this.n]; }
  update(dt: number, targets: Target[]) {
    let i = 0;
    while (i < this.n) {
      this.L[i] -= dt; if (this.L[i] <= 0) { this.kill(i); continue; }
      const ax = this.P[i * 3], ay = this.P[i * 3 + 1], az = this.P[i * 3 + 2];
      const bx = ax + this.V[i * 3] * dt, by = ay + this.V[i * 3 + 1] * dt, bz = az + this.V[i * 3 + 2] * dt;
      let hit = false;
      for (const t of targets) {
        if (!t.alive) continue;
        if (segSphere(ax, ay, az, bx, by, bz, t.pos, t.radius)) {
          this.p.set(ax, ay, az).lerp(this.p.set(bx, by, bz), 0.5);
          // pull hit point to the target surface
          this.d.copy(this.p).sub(t.pos).setLength(t.radius * 0.8).add(t.pos);
          t.hit(this.D[i], this.d, 'laser'); hit = true; break;
        }
      }
      if (!hit && G.enemies) hit = G.enemies.shootMissiles(ax, ay, az, bx, by, bz);
      if (hit) { this.kill(i); continue; }
      this.P[i * 3] = bx; this.P[i * 3 + 1] = by; this.P[i * 3 + 2] = bz;
      this.d.set(this.V[i * 3], this.V[i * 3 + 1], this.V[i * 3 + 2]).normalize(); this.q.setFromUnitVectors(up, this.d);
      this.p.set(bx, by, bz); this.m.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(i, this.m); i++;
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Missile { pos: THREE.Vector3; vel: THREE.Vector3; target: Target | null; age: number; alive: boolean; rib: Ribbon | null; dmg: number }

export class Player {
  mech: Mech; root: THREE.Group; pos: THREE.Vector3; vel = new THREE.Vector3();
  hp = 100; maxHp = 100; energy = 100; alive = true; deadT = 0; invuln = 0; regenDelay = 0;
  boosting = false; boostLock = false; boostT = 0; dodgeT = 0; dodgeDir = new THREE.Vector2(1, 0); dodgeCd = 0; roll = 0; rollTarget = 0;
  bonusT = 0; lastIx = 1;
  meleeState = 'none'; meleeT = 0; meleeDur = 0.2; meleeFrom = new THREE.Vector3(); meleeTarget: Target | null = null; combo = 0; comboT = 0; meleeCd = 0;
  fireT = 0; recoil = 0; missileReady = true; reloadT = 0; reloadMax = 2.4; locking = false; lockT = 0; maxLocks = 8;
  locks: { t: Target; age: number }[] = [];
  missiles: Missile[] = []; bolts: Bolts; ribbons: Ribbon[] = [];
  ghosts: { g: THREE.Group; objs: THREE.Object3D[]; mat: THREE.MeshBasicMaterial; t: number }[] = []; mechObjs: THREE.Object3D[] = [];
  ghostT = 0; slash: THREE.Mesh; slashMat: THREE.ShaderMaterial; slashT = 1;
  aimPoint = new THREE.Vector3(0, 0, -300); aimTarget: Target | null = null; ray = new THREE.Raycaster();
  bounds = { x: 30, y0: -15, y1: 20, r: 0 }; auto = false; extraYaw = 0; lockRadius = 200;

  constructor(scene: THREE.Scene) {
    this.mech = buildMech([0.15, 1.3, 2.0]); this.root = this.mech.root; this.pos = this.root.position; scene.add(this.root);
    this.mech.root.traverse(o => this.mechObjs.push(o));
    this.bolts = new Bolts(scene);
    for (let i = 0; i < 48; i++) this.missiles.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: null, age: 0, alive: false, rib: null, dmg: 0 });
    for (let i = 0; i < 10; i++) {
      const mat = additive(0.3, 1.2, 2.4, 0.5); const g = this.root.clone(true); const objs: THREE.Object3D[] = [];
      g.traverse(o => { objs.push(o); if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat; }); g.visible = false; scene.add(g);
      this.ghosts.push({ g, objs, mat, t: 0 });
    }
    this.slashMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(1.0, 2.6, 3.4) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.75, vUv.y) * pow(vUv.x, 1.5); gl_FragColor = vec4(uC + vec3(2.0) * pow(vUv.x, 6.0), a * uA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const sg = new THREE.RingGeometry(2.5, 7, 32, 1, 0, Math.PI * 1.1);
    // remap uv: x = angle progress, y = radial
    const uv = sg.getAttribute('uv') as THREE.BufferAttribute, p = sg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) { const x = p.getX(i), y = p.getY(i); const a = Math.atan2(y, x); const r = Math.hypot(x, y); uv.setXY(i, a / (Math.PI * 1.1), (r - 2.5) / 4.5); }
    this.slash = new THREE.Mesh(sg, this.slashMat); this.slash.visible = false; this.slash.frustumCulled = false; scene.add(this.slash);
  }

  reset() {
    this.hp = this.maxHp; this.energy = 100; this.alive = true; this.deadT = 0; this.invuln = 1; this.boosting = false; this.boostLock = false;
    this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); this.dodgeT = 0; this.meleeState = 'none'; this.combo = 0; this.bonusT = 0; this.roll = this.rollTarget = 0;
    this.missileReady = true; this.reloadT = 0; this.clearLocks(); this.root.visible = true; this.auto = false; this.extraYaw = 0; this.bolts.n = 0;
    for (const m of this.missiles) { m.alive = false; m.rib = null; }
    for (const g of this.ghosts) { g.t = 0; g.g.visible = false; }
    this.ribbons = [];
    this.mech.blade.visible = false;
  }
  startTrails() { this.ribbons = []; for (let i = 0; i < 2; i++) { const r = fx.ribbon(); if (r) { this.mech.flames[i].getWorldPosition(tmp); r.start(tmp.x, tmp.y, tmp.z, 0.35, 0.3, 1.2, 2.2, 0.8, 1); this.ribbons.push(r); } } }
  clearLocks() { for (const l of this.locks) l.t.locks = Math.max(0, l.t.locks - 1); this.locks.length = 0; this.locking = false; }

  damage(n: number, from?: THREE.Vector3) {
    if (!this.alive || this.invuln > 0 || G.god || G.cinematic || this.meleeState === 'lunge') return false;
    this.hp -= n; this.invuln = 0.7; this.regenDelay = 5;
    shake(0.5); flash(0.35, 1, 0.1, 0.05); sfx.damage(); fx.sparks(this.pos, 26, 40, 3, 1.5, 0.5);
    G.hud.damage(from); G.comboBreak && G.comboBreak();
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.hp = 0; this.alive = false; this.deadT = 0; this.clearLocks();
    fx.explosion(this.pos, 3, undefined, { debris: 20 }); fx.later(0.25, () => fx.explosion(tmp.copy(this.pos).add(new THREE.Vector3(2, 1, 0)), 2));
    slowmo(0.25, 1.6); this.root.visible = false; for (const r of this.ribbons) r.fading = true;
  }
  heal(n: number) { this.hp = Math.min(this.maxHp, this.hp + n); }

  ghost(alpha = 0.55) {
    const gh = this.ghosts.find(g => g.t <= 0) || this.ghosts[0];
    gh.t = 0.45; gh.mat.opacity = alpha; gh.g.visible = true;
    for (let i = 0; i < this.mechObjs.length; i++) { const a = this.mechObjs[i], b = gh.objs[i]; b.position.copy(a.position); b.quaternion.copy(a.quaternion); b.scale.copy(a.scale); b.visible = a.visible; }
  }
  perfectDodge() {
    G.stats.perfect++; slowmo(0.18, 0.6); this.bonusT = 4; this.energy = Math.min(100, this.energy + 40); this.heal(4);
    fx.ring(this.pos, 1, 26, 0.6, 0.4, 1.8, 3); fx.ring(this.pos, 1, 14, 0.4, 2, 2, 2);
    for (let i = 0; i < 60; i++) { const a = rand(0, Math.PI * 2); const s = rand(20, 60); fx.add.emit(this.pos.x, this.pos.y, this.pos.z, Math.cos(a) * s, Math.sin(a) * s, rand(-10, 10), rand(0.4, 0.8), 0.4, 0.05, 0.6, 2.4, 3.4, 0.2, 0.6, 2, 1, 2, 0, 0.05, 0.3, 1); }
    for (let i = 0; i < 4; i++) fx.later(i * 0.02, () => this.ghost(0.6));
    flash(0.25, 0.4, 0.9, 1.2); G.hud.big('PERFECT DODGE', 'perfect'); sfx.perfect(); shake(0.2);
    G.addScore && G.addScore(500, 'PERFECT DODGE');
  }
  nearMiss() {
    if (this.dodgeT > 0) return;
    G.stats.nearMiss++; this.energy = Math.min(100, this.energy + 8); G.hud.small('NEAR MISS +8', 'near'); sfx.nearMiss(); G.addScore && G.addScore(50);
  }
  findMeleeTarget(range: number) {
    let best: Target | null = null, bd = 1e9;
    for (const t of G.targetList as Target[]) {
      if (!t.alive || !(t.lockable || t.kind === 'core')) continue;
      const r = t.kind === 'shipcore' ? 320 : range;
      const d = t.pos.distanceTo(this.pos); if (d > r || t.pos.z > this.pos.z + 5) continue;
      toScreen(t.pos, scr); if (!scr.on) continue;
      const sd = Math.hypot(scr.x - mouse.x, scr.y - mouse.y); if (sd > 300) continue;
      const score = sd + d * 0.8; if (score < bd) { bd = score; best = t; }
    }
    return best;
  }
  startMelee() {
    const t = this.findMeleeTarget(this.boosting ? 170 : 115);
    this.mech.blade.visible = true; this.meleeT = 0; sfx.melee();
    if (t) { this.meleeState = 'lunge'; this.meleeTarget = t; this.meleeFrom.copy(this.pos); this.meleeDur = clamp(t.pos.distanceTo(this.pos) / 380, 0.1, 0.4); }
    else { this.meleeState = 'slash'; this.meleeTarget = null; this.doSlash(null); }
  }
  doSlash(t: Target | null) {
    this.meleeState = 'slash'; this.meleeT = 0; this.combo = this.comboT > 0 ? Math.min(3, this.combo + 1) : 1; this.comboT = 0.75;
    this.slash.visible = true; this.slashT = 0; this.slash.position.copy(this.pos).add(tmp.set(0, 0.5, -2));
    this.slash.rotation.set(-0.2, 0, [0.4, Math.PI - 0.6, -1.3][this.combo - 1] + rand(-0.2, 0.2)); this.slash.scale.setScalar(this.combo === 3 ? 1.6 : 1.1);
    const mult = this.bonusT > 0 ? 2 : 1;
    const hitList: Target[] = [];
    if (t && t.alive) hitList.push(t);
    for (const o of G.targetList as Target[]) if (o.alive && o !== t && o.pos.distanceTo(this.pos) < o.radius + 9 && (o.lockable || o.kind === 'core')) hitList.push(o);
    if (hitList.length) {
      for (const o of hitList) o.hit((this.combo === 3 ? 160 : 75) * mult, tmp2.copy(o.pos).lerp(this.pos, 0.3), 'melee');
      hitstop(this.combo === 3 ? 0.16 : 0.08); flash(0.3, 0.6, 1.5, 2); shake(this.combo === 3 ? 0.55 : 0.32);
      fx.sparks(tmp2, 50, 70, 1.5, 3, 4); fx.ring(tmp2, 1, 16, 0.3, 0.6, 2, 3); fx.light(tmp2, 0x66ddff, 200, 0.25); sfx.slashHit();
      for (let i = 0; i < 30; i++) { const a = rand(0, 6.28); fx.add.emit(tmp2.x, tmp2.y, tmp2.z, Math.cos(a) * 80, Math.sin(a) * 80, rand(-20, 20), 0.25, 0.3, 0.05, 2, 3.5, 4, 0.5, 1, 2, 1, 4, 0, 0.06, 0, 1); }
    }
  }

  update(dt: number) {
    const m = this.mech;
    this.invuln -= dt; this.dodgeCd -= dt; this.comboT -= dt; this.bonusT -= dt; this.meleeCd -= dt; this.regenDelay -= dt;
    if (!this.alive) { this.deadT += G.realDt; return; }
    const ctl = !this.auto && !G.cinematic && G.state === 'playing';
    // ---- input / movement
    let ix = 0, iy = 0;
    if (ctl) { ix = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0); iy = (isDown('up') ? 1 : 0) - (isDown('down') ? 1 : 0); }
    if (ix) this.lastIx = ix;
    const wantBoost = ctl && isDown('boost') && !this.boostLock;
    if (wantBoost && this.energy > 0) {
      if (!this.boosting) { sfx.boost(); fx.ring(tmp.copy(this.pos).add(tmp2.set(0, 0, 3)), 1, 12, 0.35, 0.4, 1.6, 3); shake(0.25); this.boostT = 0; G.hud.small('BOOST', 'boost'); }
      this.boosting = true; this.boostT += dt; this.energy -= 20 * dt; this.regenDelay = Math.max(this.regenDelay, 0);
      if (this.energy <= 0) { this.energy = 0; this.boosting = false; this.boostLock = true; G.hud.small('OVERHEAT', 'warn'); }
    } else { this.boosting = false; }
    if (this.boostLock && (!isDown('boost') && this.energy > 20)) this.boostLock = false;
    if (!this.boosting) this.energy = Math.min(100, this.energy + (this.dodgeT > 0 ? 0 : 22) * dt);
    if (this.regenDelay <= 0 && this.hp < this.maxHp) this.heal(2.5 * dt);
    const maxS = this.boosting ? 46 : 34;
    this.vel.x = damp(this.vel.x, ix * maxS, this.boosting ? 7 : 5.5, dt);
    this.vel.y = damp(this.vel.y, iy * maxS * 0.85, this.boosting ? 7 : 5.5, dt);
    if (ctl && wasPressed('dodge') && this.dodgeCd <= 0 && this.energy >= 10 && this.meleeState === 'none') {
      this.dodgeDir.set(ix || this.lastIx, iy); if (!ix && iy) this.dodgeDir.x = 0; this.dodgeDir.normalize();
      this.dodgeT = 0.3; this.invuln = Math.max(this.invuln, 0.38); this.energy -= 10; this.dodgeCd = 0.42; sfx.dodge();
      this.rollTarget += (this.dodgeDir.x >= 0 ? -1 : 1) * Math.PI * 2;
      this.ghost(0.4);
      if (G.threat < 0.42) this.perfectDodge();
    }
    if (this.dodgeT > 0) {
      const k = this.dodgeT / 0.3; const sp = 95 * k + 10;
      this.pos.x += this.dodgeDir.x * sp * dt; this.pos.y += this.dodgeDir.y * sp * dt; this.dodgeT -= dt;
      this.ghostT -= dt; if (this.ghostT <= 0) { this.ghost(0.35); this.ghostT = 0.05; }
    }
    // melee
    if (ctl && wasPressed('melee') && this.meleeCd <= 0) {
      if (this.meleeState === 'none' || ((this.meleeState === 'slash' && this.meleeT > 0.1) || this.meleeState === 'return') && this.comboT > 0) {
        this.startMelee(); this.meleeCd = 0.16;
      }
    }
    if (this.meleeState === 'lunge') {
      this.meleeT += dt; const t = this.meleeTarget;
      if (!t || !t.alive) { this.meleeState = 'return'; }
      else {
        const u = easeOut(this.meleeT / this.meleeDur); tmp.copy(t.pos); tmp.z += t.radius + 2.5; tmp.y -= 0.5;
        this.pos.lerpVectors(this.meleeFrom, tmp, u); this.invuln = Math.max(this.invuln, 0.1);
        this.ghostT -= dt; if (this.ghostT <= 0) { this.ghost(0.45); this.ghostT = 0.03; }
        for (let i = 0; i < 3; i++) fx.add.emit(this.pos.x + rand(-1, 1), this.pos.y + rand(-1, 1), this.pos.z, 0, 0, 120, 0.2, 0.5, 0.1, 0.5, 2, 3, 0.2, 0.5, 1.5, 1, 0, 0, 0.03, 0, 1);
        if (this.meleeT >= this.meleeDur) this.doSlash(t);
      }
    } else if (this.meleeState === 'slash') {
      this.meleeT += dt; if (this.meleeT > 0.22) this.meleeState = this.pos.z < -0.5 ? 'return' : 'none';
    } else if (this.meleeState === 'return') {
      this.pos.z = damp(this.pos.z, 0, 7, dt); if (Math.abs(this.pos.z) < 0.6) { this.pos.z = 0; this.meleeState = 'none'; }
    }
    if (this.meleeState === 'none' && this.comboT <= 0) this.mech.blade.visible = false;
    if (this.meleeState !== 'lunge') { this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; }
    // bounds
    const b = this.bounds;
    if (this.meleeState === 'none' && !this.auto) {
      if (b.r > 0) { const r = Math.hypot(this.pos.x, this.pos.y); if (r > b.r) { const k = 1 - (1 - b.r / r) * (1 - Math.exp(-8 * dt)); this.pos.x *= k; this.pos.y *= k; } }
      else { this.pos.x = clamp(this.pos.x, -b.x, b.x); this.pos.y = clamp(this.pos.y, b.y0, b.y1); }
    }
    // ---- aim
    const ndc = aimNDC(); this.ray.setFromCamera(ndc as any, G.camera);
    this.aimTarget = null; let bd = 70;
    for (const t of G.targetList as Target[]) { if (!t.alive || t.kind === 'hull' || t.pos.z > this.pos.z - 5) continue; toScreen(t.pos, scr); if (!scr.on) continue; const d = Math.hypot(scr.x - mouse.x, scr.y - mouse.y) - t.radius * 2; if (d < bd) { bd = d; this.aimTarget = t; } }
    if (this.aimTarget) this.aimPoint.copy(this.aimTarget.pos); else this.aimPoint.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction, 320);
    // ---- fire
    this.fireT -= dt;
    if (ctl && isDown('fire') && this.fireT <= 0 && this.meleeState !== 'lunge') {
      this.fireT = 1 / 13; m.gunTip.getWorldPosition(tmp);
      tmp2.copy(this.aimPoint).sub(tmp).normalize();
      this.bolts.fire(tmp, tmp2, this.bonusT > 0 ? 18 : 9); fx.muzzle(tmp); sfx.laser(); this.recoil = 1;
      if (Math.random() < 0.3) fx.light(tmp, 0x66ccff, 30, 0.06);
    }
    // ---- lock-on & missiles
    if (!this.missileReady) { this.reloadT -= dt; if (this.reloadT <= 0) { this.missileReady = true; G.hud.small('MISSILES READY', 'ok'); } }
    for (let i = this.locks.length - 1; i >= 0; i--) { const l = this.locks[i]; l.age += dt; if (!l.t.alive) { l.t.locks = Math.max(0, l.t.locks - 1); this.locks.splice(i, 1); } }
    if (ctl && isDown('lock') && this.missileReady) {
      if (!this.locking) { this.locking = true; this.lockT = 0; }
      this.lockT -= dt;
      if (this.lockT <= 0 && this.locks.length < this.maxLocks) {
        const t = this.findLockCandidate();
        if (t) { t.locks++; this.locks.push({ t, age: 0 }); this.lockT = 0.07; sfx.lockTick(); if (this.locks.length === this.maxLocks) sfx.locked(); }
      }
    }
    if (this.locking && (!isDown('lock') || !ctl)) { this.locking = false; if (ctl || this.locks.length) this.fireSalvo(); }
    this.updateMissiles(dt);
    this.bolts.update(dt, G.targetList);
    // ---- animation
    this.recoil = damp(this.recoil, 0, 18, dt);
    this.roll = damp(this.roll, this.rollTarget, 9, dt);
    const bank = -this.vel.x * 0.016, pitch = this.vel.y * 0.008;
    const aimYaw = clamp(-(this.aimPoint.x - this.pos.x) / 300, -0.35, 0.35);
    this.root.rotation.set(pitch + (this.boosting ? -0.25 : -0.08), aimYaw * 0.6 + this.extraYaw, bank + this.roll, 'YXZ');
    m.armR.rotation.x = lerp(-1.25, -1.45, this.recoil) + clamp((this.aimPoint.y - this.pos.y) / 400, -0.4, 0.4);
    m.armR.position.z = this.recoil * 0.25;
    if (this.meleeState === 'slash') { const u = clamp(this.meleeT / 0.15, 0, 1); m.armL.rotation.set(lerp(-2.6, 0.2, easeOut(u)), 0, lerp(0.6, -0.4, u) * (this.combo === 2 ? -1 : 1)); m.body.rotation.y = lerp(0.6, -0.5, u) * (this.combo === 2 ? -1 : 1); }
    else if (this.meleeState === 'lunge') { m.armL.rotation.set(-2.4, 0, 0.6); m.body.rotation.y = damp(m.body.rotation.y, 0.5, 10, dt); }
    else { m.armL.rotation.x = damp(m.armL.rotation.x, this.boosting ? 0.5 : 0.25, 6, dt); m.armL.rotation.z = damp(m.armL.rotation.z, 0, 6, dt); m.body.rotation.y = damp(m.body.rotation.y, 0, 6, dt); }
    m.blade.scale.z = damp(m.blade.scale.z, m.blade.visible ? 1 : 0.01, 20, dt);
    const spread = this.boosting ? 0.75 : 0.42;
    m.wingL.rotation.z = damp(m.wingL.rotation.z, -spread, 6, dt); m.wingR.rotation.z = damp(m.wingR.rotation.z, spread, 6, dt);
    m.legL.rotation.x = damp(m.legL.rotation.x, this.boosting ? 0.9 : 0.45 + this.vel.y * -0.006, 5, dt); m.legR.rotation.x = damp(m.legR.rotation.x, this.boosting ? 1.0 : 0.55 + this.vel.y * -0.006, 5, dt);
    m.head.rotation.y = aimYaw;
    const thr = (this.boosting ? 2.6 : 1.0) * (0.85 + Math.random() * 0.3);
    for (const f of m.flames) { f.scale.set(this.boosting ? 1.5 : 1, this.boosting ? 1.5 : 1, thr); }
    // engine particles + trails
    for (let i = 0; i < 2; i++) {
      m.flames[i].getWorldPosition(tmp);
      const n = this.boosting ? 4 : 1;
      for (let k = 0; k < n; k++) fx.add.emit(tmp.x + rand(-0.15, 0.15), tmp.y + rand(-0.15, 0.15), tmp.z + 0.5, rand(-3, 3), rand(-3, 3), 60, this.boosting ? 0.3 : 0.16, this.boosting ? 0.8 : 0.45, 0.1, 0.5, 1.4, 2.2, 0.1, 0.3, 1.2, 0.7, 3, 0, 0.02, 1, 0);
      const r = this.ribbons[i]; if (r && r.alive) { r.push(tmp.x, tmp.y, tmp.z + 0.6); r.width = damp(r.width, this.boosting ? 0.45 : 0.2, 6, dt); r.alpha = this.boosting ? 0.75 : 0.35; }
    }
    if (this.boosting && Math.random() < 0.5) {
      const a = rand(0, Math.PI * 2), r = rand(3, 7);
      fx.add.emit(this.pos.x + Math.cos(a) * r, this.pos.y + Math.sin(a) * r, this.pos.z - 30, 0, 0, 400, 0.25, 0.15, 0.1, 1, 2, 3, 0.5, 1, 2, 0.7, 0, 0, 0.05, 0, 1);
    }
    // ghosts / slash
    for (const g of this.ghosts) if (g.t > 0) { g.t -= dt; g.mat.opacity = Math.max(0, g.t / 0.45) * 0.5; g.g.position.z += G.speed * 0.12 * dt; if (g.t <= 0) g.g.visible = false; }
    if (this.slash.visible) { this.slashT += dt; this.slashMat.uniforms.uA.value = Math.max(0, 1 - this.slashT / 0.22) * 2.2; this.slash.rotation.z -= dt * 9; if (this.slashT > 0.22) this.slash.visible = false; }
  }
  findLockCandidate(): Target | null {
    let best: Target | null = null, bd = 1e9;
    for (const t of G.targetList as Target[]) {
      if (!t.alive || !t.lockable || t.locks >= t.maxLocks) continue;
      if (t.pos.z > this.pos.z - 8 || t.pos.distanceTo(this.pos) > 900) continue;
      toScreen(t.pos, scr); if (!scr.on) continue;
      const d = Math.hypot(scr.x - mouse.x, scr.y - mouse.y); if (d > this.lockRadius) continue;
      const s = d + t.locks * 120; if (s < bd) { bd = s; best = t; }
    }
    return best;
  }
  fireSalvo(force?: Target[]) {
    const targets = force || this.locks.map(l => l.t);
    const n = targets.length ? Math.min(this.maxLocks + 6, targets.length + Math.floor(targets.length / 2)) : 4;
    if (!force) { this.clearLocks(); this.missileReady = false; this.reloadT = this.reloadMax; }
    for (let i = 0; i < n; i++) {
      const t = targets.length ? targets[i % targets.length] : null;
      fx.later(i * 0.035, () => this.launchMissile(t, i));
    }
    if (n >= 6) G.hud.small(`MISSILE SALVO x${n}`, 'ok');
    shake(0.15);
  }
  launchMissile(t: Target | null, i: number) {
    const ms = this.missiles.find(x => !x.alive); if (!ms || !this.alive) return;
    const side = i % 2 ? 1 : -1; (side > 0 ? this.mech.podR : this.mech.podL).getWorldPosition(ms.pos);
    ms.vel.set(side * rand(15, 55), rand(20, 50), rand(10, 40)); ms.target = t; ms.age = 0; ms.alive = true; ms.dmg = this.bonusT > 0 ? 80 : 42;
    if (t) t.locks++;
    ms.rib = fx.ribbon(); if (ms.rib) ms.rib.start(ms.pos.x, ms.pos.y, ms.pos.z, 0.28, 1.4, 1.6, 2.0, 0.9, 1);
    fx.add.emit(ms.pos.x, ms.pos.y, ms.pos.z, 0, 0, 0, 0.1, 1.5, 0.5, 3, 2, 1, 2, 0.5, 0.2, 1, 0, 0, 0, 0, 1);
    sfx.missile();
  }
  updateMissiles(dt: number) {
    for (const ms of this.missiles) {
      if (!ms.alive) continue; ms.age += dt;
      if (ms.target && !ms.target.alive) { ms.target.locks = Math.max(0, ms.target.locks - 1); ms.target = this.retarget(ms.pos); if (ms.target) ms.target.locks++; }
      if (ms.target) tmp.copy(ms.target.pos).sub(ms.pos).normalize(); else tmp.set(0, 0, -1).add(tmp2.copy(this.aimPoint).sub(ms.pos).normalize()).normalize();
      const speed = Math.min(420, 70 + ms.age * 520); const turn = Math.min(16, 1.5 + ms.age * 22);
      tmp2.copy(ms.vel).normalize().lerp(tmp, 1 - Math.exp(-turn * dt)).normalize();
      ms.vel.copy(tmp2).multiplyScalar(speed);
      const px = ms.pos.x, py = ms.pos.y, pz = ms.pos.z;
      ms.pos.addScaledVector(ms.vel, dt);
      if (ms.rib) ms.rib.push(ms.pos.x, ms.pos.y, ms.pos.z);
      fx.smoke.emit(ms.pos.x, ms.pos.y, ms.pos.z, rand(-2, 2), rand(-2, 2), 0, rand(0.6, 1.0), 0.5, rand(2, 3.2), 0.55, 0.55, 0.6, 0.25, 0.25, 0.3, 0.45, 3, -2, 0, 1, 2);
      fx.add.emit(ms.pos.x, ms.pos.y, ms.pos.z, 0, 0, 0, 0.07, 1.1, 0.3, 3, 2, 1, 3, 0.6, 0.1, 1, 0, 0, 0, 0, 1);
      let boom = ms.age > 4.5;
      if (ms.target && segSphere(px, py, pz, ms.pos.x, ms.pos.y, ms.pos.z, ms.target.pos, ms.target.radius + 1.5)) boom = true;
      if (boom) {
        ms.alive = false; if (ms.rib) ms.rib.fading = true;
        if (ms.target) { ms.target.locks = Math.max(0, ms.target.locks - 1); if (ms.target.alive) ms.target.hit(ms.dmg, ms.pos, 'missile'); }
        for (const o of G.targetList as Target[]) if (o.alive && o !== ms.target && o.lockable && o.pos.distanceTo(ms.pos) < 7 + o.radius) o.hit(ms.dmg * 0.4, ms.pos, 'splash');
        fx.explosion(ms.pos, 0.8, undefined, { debris: 1 });
      }
    }
  }
  retarget(p: THREE.Vector3): Target | null {
    let best: Target | null = null, bd = 400;
    for (const t of G.targetList as Target[]) { if (!t.alive || !t.lockable || t.pos.z > this.pos.z) continue; const d = t.pos.distanceTo(p); if (d < bd) { bd = d; best = t; } }
    return best;
  }
}

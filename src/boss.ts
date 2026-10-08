import * as THREE from 'three';
import { G, rand, clamp, damp, lerp, easeInOut, easeOut, slowmo, hitstop, shake, flash, Target } from './core';
import { part, B, C, S, T, glow, additive, mats } from './models';
import { fx } from './fx';
import { sfx, setMusic, stopMusic } from './audio';

const SC = 1.9;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141318, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.7, emissive: new THREE.Color(0, 0, 0) });
const midMat = new THREE.MeshStandardMaterial({ color: 0x3a3640, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.7 });
const gBase = new THREE.Color(3.2, 0.9, 0.28); const gMat = glow(3.2, 0.9, 0.28);
const cBase = new THREE.Color(1.2, 2.2, 3.4); const cMat = glow(1.2, 2.2, 3.4);

class BossPart implements Target {
  alive = true; radius: number; lockable: boolean; maxLocks: number; locks = 0; pos = new THREE.Vector3(); kind: string; isBoss = true;
  anchor: THREE.Object3D; hp = 0; maxHp = 0; mesh?: THREE.Object3D; label = ''; burning = false;
  constructor(kind: string, anchor: THREE.Object3D, r: number, lockable: boolean, maxLocks = 1) { this.kind = kind; this.anchor = anchor; this.radius = r; this.lockable = lockable; this.maxLocks = maxLocks; }
  hit(dmg: number, p: THREE.Vector3, src: string) { G.boss.damage(this, dmg, p, src); }
}
interface Mod { g: THREE.Group; sp: THREE.Vector3; sr: THREE.Euler; mp: THREE.Vector3; mr: THREE.Euler; t0: number; t1: number }

export class Boss {
  root = new THREE.Group(); mods: Record<string, Mod> = {}; parts: BossPart[] = []; weak: BossPart[] = []; core!: BossPart; armorPts: BossPart[] = [];
  plates: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; home: THREE.Vector3 }[] = [];
  hp = 1; maxHp = 8000; state = 'off'; t = 0; atk = ''; atkT = 0; atkIdx = 0; idleT = 0; exposedT = 0; morph = 0; power = 0;
  coreMesh!: THREE.Mesh; blade!: THREE.Group; beam: THREE.Mesh; beamCore: THREE.Mesh; tele: THREE.Mesh; arc: THREE.Mesh; arcMat: THREE.ShaderMaterial;
  beamFrom = new THREE.Vector3(); beamTo = new THREE.Vector3(); beamOn = false; beamR = 4; sweep: any = {}; slashD: any = {}; prevFT = 0; fin: any = {};
  basePos = new THREE.Vector3(0, 26, -215); look = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.root.scale.setScalar(SC); this.root.visible = false; scene.add(this.root);
    const mod = (name: string, g: THREE.Group, sp: number[], sr: number[], mp: number[], mr: number[], t0: number, t1: number) => {
      this.root.add(g); this.mods[name] = { g, sp: new THREE.Vector3(...sp), sr: new THREE.Euler(...sr), mp: new THREE.Vector3(...mp), mr: new THREE.Euler(...mr), t0, t1 };
    };
    const anchor = (parent: THREE.Object3D, x: number, y: number, z: number) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
    // torso
    const torso = new THREE.Group();
    torso.add(part((d, m, g) => {
      B(d, 24, 12, 50); B(d, 18, 6, 44, 0, 7, -2); B(d, 26, 4, 30, 0, -7, 2);
      B(m, 4, 3, 40, 9, 9, -2); B(m, 4, 3, 40, -9, 9, -2); for (let i = 0; i < 5; i++) B(m, 14, 2, 3, 0, 10.5, -18 + i * 8);
      B(g, 24.2, 0.6, 0.6, 0, 2, 25.1); B(g, 0.4, 0.8, 44, 12.1, 0, 0); B(g, 0.4, 0.8, 44, -12.1, 0, 0); B(g, 0.4, 0.8, 30, 13.1, -7, 2); B(g, 0.4, 0.8, 30, -13.1, -7, 2);
      T(m, 7.5, 1.2, 0, -9.2, 8, Math.PI / 2);
      for (let i = 0; i < 6; i++) B(g, 1, 0.5, 1, -10 + i * 4, 10.2, 18);
    }, bodyMat, midMat, gMat));
    this.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 2), cMat); this.coreMesh.position.set(0, -9.5, 8); torso.add(this.coreMesh);
    mod('torso', torso, [0, 0, 0], [0, 0, 0], [0, 20, 0], [-Math.PI / 2, 0, 0], 1.2, 3.6);
    // nose halves
    for (const s of [-1, 1]) {
      const n = new THREE.Group(); n.add(part((d, m, g) => {
        const c = new THREE.CylinderGeometry(0.4, 9, 34, 4, 1); c.rotateY(Math.PI / 4); c.rotateX(Math.PI / 2); c.scale(0.55, 0.8, 1); c.translate(s * 4.6, 0, 17); d.push(c.toNonIndexed());
        B(g, 0.5, 0.5, 30, s * 8.2, 0, 15, 0, -s * 0.24); B(m, 6, 3, 10, s * 5, 4, 6);
      }, bodyMat, midMat, gMat));
      mod(s < 0 ? 'noseL' : 'noseR', n, [0, 0, 25], [0, 0, 0], [s * 19, 42, -2], [-Math.PI / 2, 0, -s * 0.35], 2.2, 4.2);
    }
    // bridge / head
    const bridge = new THREE.Group(); bridge.add(part((d, m, g) => {
      B(d, 10, 10, 14); B(m, 12, 3, 16, 0, 5.5, 0); B(g, 10.2, 1.2, 0.3, 0, 2, 7.05); B(g, 4, 0.6, 0.3, 0, -1.5, 7.05);
      B(d, 1, 8, 1, 3, 9, -3, 0, 0, -0.3); B(d, 1, 8, 1, -3, 9, -3, 0, 0, 0.3); B(g, 1.2, 1.2, 1.2, 4.2, 12.5, -3); B(g, 1.2, 1.2, 1.2, -4.2, 12.5, -3);
      B(m, 6, 3, 6, 0, 8, 0);
    }, bodyMat, midMat, gMat));
    mod('bridge', bridge, [0, 14, -6], [0, 0, 0], [0, 52, 1], [0, 0, 0], 2.8, 4.6);
    // wings / arms
    const wings: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.add(part((d, m, g) => {
        B(d, 46, 5, 22, s * 23, 0, 0); B(m, 40, 6, 6, s * 22, 0, -9); B(d, 30, 3, 12, s * 18, 3.5, 2);
        B(g, 46, 0.6, 0.6, s * 23, 0, 11.2); B(g, 0.6, 5.2, 0.6, s * 46, 0, 10);
        C(m, 5, 6, 12, 10, s * 40, -4, 0, Math.PI / 2); C(g, 3, 3, 0.4, 10, s * 40, -4, -6.3, Math.PI / 2);
        for (let i = 0; i < 4; i++) B(g, 1.6, 0.4, 1.6, s * (10 + i * 7), 2.6, 8);
        B(m, 6, 8, 12, s * 4, -4, 0);
      }, bodyMat, midMat, gMat));
      wings.push(w);
      mod(s < 0 ? 'wingL' : 'wingR', w, [s * 12, 0, -5], [0, 0, 0], [s * 17, 42, 0], [0, 0, s * Math.PI / 2], 1.6, 3.8);
    }
    // engines / legs
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.add(part((d, m, g) => {
        C(d, 5, 6.5, 34, 12, 0, 0, 0, Math.PI / 2); T(m, 6.6, 0.9, 0, 0, 8); T(m, 6.6, 0.9, 0, 0, -6);
        C(g, 4.6, 4.6, 0.6, 14, 0, 0, -17.3, Math.PI / 2); C(g, 3, 3, 0.5, 10, 0, 0, 17.2, Math.PI / 2);
        B(d, 4, 10, 14, s * 5, 0, 4); B(g, 0.4, 7, 0.4, s * 7.1, 0, 10);
      }, bodyMat, midMat, gMat));
      mod(s < 0 ? 'engL' : 'engR', e, [s * 14, -3, -40], [0, 0, 0], [s * 9, -12, 0], [-Math.PI / 2, 0, 0], 1.0, 3.0);
    }
    // blade (on right arm tip)
    this.blade = new THREE.Group(); this.blade.position.set(48, -4, 0);
    const bl1 = new THREE.Mesh(new THREE.BoxGeometry(84, 1.2, 4.5).translate(42, 0, 0), glow(4, 2.2, 4.5));
    const bl2 = new THREE.Mesh(new THREE.BoxGeometry(88, 3.5, 9).translate(44, 0, 0), additive(2.2, 0.3, 1.6, 0.7));
    this.blade.add(bl1, bl2); this.blade.scale.set(0.001, 1, 1); this.blade.visible = false; wings[1].add(this.blade);
    // armor plates (ship form only)
    const plate = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat); m.position.set(x, y, z); this.root.add(m);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, 0.3), gMat); gl.position.set(0, h / 2, d / 2); m.add(gl);
      this.plates.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), home: m.position.clone() });
    };
    plate(22, 2.4, 24, 0, -11, 8); plate(2.4, 11, 32, 14, 0, -4); plate(2.4, 11, 32, -14, 0, -4); plate(16, 2.4, 14, 0, 11, 16); plate(16, 2.4, 14, 0, 11, -24); plate(10, 6, 6, 0, 3, 46);
    // parts: weak points
    const wp = (parent: THREE.Object3D, x: number, y: number, z: number, label: string) => {
      const a = anchor(parent, x, y, z); const p = new BossPart('weak', a, 5 * SC, true, 4); p.hp = p.maxHp = 900; p.label = label;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 2), glow(4, 1.4, 0.3)); a.add(m); p.mesh = m;
      const r = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.8, 6, 20), midMat); a.add(r);
      this.weak.push(p); this.parts.push(p);
    };
    wp(wings[0], -40, -4, 6.5, 'PORT ARRAY'); wp(wings[1], 40, -4, 6.5, 'STARBOARD ARRAY'); wp(bridge, 0, 9, 4, 'COMMAND SPIRE');
    this.core = new BossPart('core', this.coreMesh, 6 * SC, false, 8); this.core.hp = 1; this.parts.push(this.core);
    // hull spheres
    const hull = (parent: THREE.Object3D, x: number, y: number, z: number, r: number) => { const p = new BossPart('hull', anchor(parent, x, y, z), r * SC, false); this.parts.push(p); };
    hull(torso, 0, 0, 12, 13); hull(torso, 0, 0, -12, 13); hull(this.mods.bridge.g, 0, 0, 0, 7); hull(this.mods.noseL.g, -4, 0, 16, 8); hull(this.mods.noseR.g, 4, 0, 16, 8);
    for (const s of [0, 1]) for (const k of [12, 28]) hull(wings[s], (s ? 1 : -1) * k, 0, 0, 9);
    hull(this.mods.engL.g, 0, 0, 0, 8); hull(this.mods.engR.g, 0, 0, 0, 8);
    for (let i = 0; i < 12; i++) { const par = [torso, wings[0], wings[1], this.mods.bridge.g][i % 4]; const a = anchor(par, rand(-10, 10) + (par === wings[0] ? -20 : par === wings[1] ? 20 : 0), rand(-4, 6), rand(-10, 14)); const p = new BossPart('armor', a, 4 * SC, true, 2); p.alive = false; this.armorPts.push(p); }
    // beam & telegraph & slash arc
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), additive(3, 0.6, 1.4, 0.9));
    this.beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), glow(5, 4, 5));
    this.beam.add(this.beamCore); this.beam.visible = false; this.beam.frustumCulled = false; scene.add(this.beam);
    this.tele = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), additive(3, 0.2, 0.2, 0.8)); this.tele.visible = false; scene.add(this.tele);
    this.arcMat = new THREE.ShaderMaterial({ uniforms: { uA0: { value: 0 }, uA1: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uA0, uA1, uAlpha; varying vec2 vP; void main(){ float a = atan(vP.y, vP.x); float r = length(vP);
        float lo = min(uA0, uA1), hi = max(uA0, uA1); if (a < lo || a > hi) discard;
        float lead = 1.0 - clamp(abs(a - uA1) / max(hi - lo, 0.001), 0.0, 1.0);
        float rad = smoothstep(18.0, 40.0, r) * smoothstep(105.0, 80.0, r);
        vec3 c = mix(vec3(2.6, 0.2, 1.4), vec3(5.0, 3.5, 5.0), pow(lead, 8.0));
        gl_FragColor = vec4(c, pow(lead, 2.0) * rad * uAlpha); }`, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.arc = new THREE.Mesh(new THREE.RingGeometry(15, 105, 96, 1), this.arcMat); this.arc.visible = false; this.arc.frustumCulled = false; scene.add(this.arc);
  }

  get targets(): Target[] { return this.state === 'off' ? [] : this.parts.concat(this.armorPts); }
  setMorph(t: number) {
    // t is the transformation clock; each module has its own window
    for (const k in this.mods) {
      const m = this.mods[k]; const u = easeInOut(clamp((t - m.t0) / (m.t1 - m.t0), 0, 1));
      m.g.position.lerpVectors(m.sp, m.mp, u); m.g.position.z += Math.sin(u * Math.PI) * 10; m.g.position.x *= 1 + Math.sin(u * Math.PI) * 0.3;
      m.g.rotation.set(lerp(m.sr.x, m.mr.x, u), lerp(m.sr.y, m.mr.y, u), lerp(m.sr.z, m.mr.z, u));
    }
  }
  camP = new THREE.Vector3(); camL = new THREE.Vector3();
  cam(p: THREE.Vector3, l: THREE.Vector3, fov: number) { this.camP.copy(p); this.camL.copy(l); G.camRig = { pos: this.camP, look: this.camL, fov }; }
  setPower(k: number) { this.power = k; gMat.color.copy(gBase).multiplyScalar(k); }
  reset() {
    this.state = 'off'; this.root.visible = false; this.beam.visible = false; this.tele.visible = false; this.arc.visible = false; this.beamOn = false;
    this.blade.visible = false; this.blade.scale.x = 0.001;
    for (const p of this.plates) { p.m.visible = true; p.m.position.copy(p.home); p.m.rotation.set(0, 0, 0); }
    for (const p of this.weak) { p.alive = true; p.hp = p.maxHp; p.locks = 0; p.mesh!.visible = true; p.burning = false; }
    for (const p of this.parts) { p.locks = 0; if (p.kind === 'hull') p.alive = true; }
    for (const a of this.armorPts) { a.alive = false; a.locks = 0; }
    this.core.alive = false; this.core.lockable = false; this.coreMesh.visible = false; this.coreMesh.scale.setScalar(1);
    this.hp = this.maxHp; this.setMorph(0); this.root.rotation.set(0, 0, 0); this.setPower(1); this.exposedT = 0;
    cMat.color.copy(cBase);
  }
  start(skipIntro = false) {
    this.reset(); this.root.visible = true; this.state = skipIntro ? 'p1' : 'intro'; this.t = 0; this.atkIdx = 0; this.atk = ''; this.idleT = 2;
    if (!skipIntro) { this.root.position.set(0, 60, -1300); this.setPower(0); this.root.rotation.y = 0.7; }
    else this.root.position.copy(this.basePos);
  }
  startPhase2Direct() { this.start(true); this.hp = this.maxHp * 0.5; for (const w of this.weak) { w.alive = false; w.mesh!.visible = false; } for (const p of this.plates) p.m.visible = false; this.setMorph(10); this.enterP2(); }
  updateParts() {
    this.root.updateMatrixWorld(true);
    for (const p of this.parts) p.anchor.getWorldPosition(p.pos);
    for (const p of this.armorPts) p.anchor.getWorldPosition(p.pos);
  }
  damage(p: BossPart, dmg: number, at: THREE.Vector3, src: string) {
    if (!p.alive || !(this.state === 'p1' || this.state === 'p2')) {
      if (p.kind === 'armor' && p.alive) { p.alive = false; fx.explosion(at, 2.2, undefined, { debris: 4, sound: Math.random() < 0.5 }); }
      else if (src === 'laser') { fx.sparks(at, 3, 20, 2, 2, 2); }
      return;
    }
    let real = 0;
    if (p.kind === 'weak') {
      real = dmg; p.hp -= dmg; bodyMat.emissive.setRGB(0.4, 0.1, 0.05);
      if (src === 'laser') { fx.sparks(at, 8, 35, 3, 1.5, 0.4); sfx.hit(); }
      if (p.hp <= 0) this.destroyWeak(p);
    } else if (p.kind === 'core') {
      real = dmg * (this.exposedT > 0 ? 2.2 : 1); if (src === 'laser') { fx.sparks(at, 10, 40, 1.5, 2.5, 4); sfx.hit(); }
      bodyMat.emissive.setRGB(0.1, 0.2, 0.4);
    } else if (p.kind === 'hull') { real = dmg * 0.08; if (src === 'laser') { fx.sparks(at, 3, 25, 2.5, 2.2, 1.6); sfx.ping(); } }
    this.hp -= real;
    if (this.state === 'p1' && this.hp <= this.maxHp * 0.5) { this.hp = this.maxHp * 0.5; this.beginTransform(); }
    if (this.state === 'p2' && this.hp <= this.maxHp * 0.05) { this.hp = this.maxHp * 0.04; this.beginFinisherReady(); }
  }
  destroyWeak(p: BossPart) {
    p.alive = false; p.mesh!.visible = false; p.burning = true;
    fx.explosion(p.pos, 5, undefined, { debris: 14 }); for (let i = 0; i < 4; i++) fx.later(0.15 + i * 0.15, () => fx.explosion(tmp.copy(p.pos).add(tmp2.set(rand(-8, 8), rand(-8, 8), rand(-4, 6))), 2.5));
    slowmo(0.35, 0.35); shake(0.8); flash(0.15, 1, 0.7, 0.4);
    const left = this.weak.filter(w => w.alive).length;
    G.hud.big(`${p.label} DESTROYED`, 'kill'); G.hud.small(`WEAK POINTS ${3 - left}/3`, 'ok'); G.addScore && G.addScore(2500, 'WEAK POINT');
    this.hp -= 120;
    if (left === 0 && this.state === 'p1') { this.hp = Math.min(this.hp, this.maxHp * 0.5); this.beginTransform(); }
  }
  // ---------------- state changes ----------------
  beginTransform() {
    if (this.state !== 'p1') return;
    this.state = 'transform'; this.t = 0; this.beam.visible = this.tele.visible = this.beamOn = false; this.arc.visible = false;
    G.cinematic = true; G.player.clearLocks(); G.enemies.clear(); G.hud.warn('WARNING  //  HELIOS FORM SHIFT', 6); sfx.bossWarning(); stopMusic(0.5);
    G.hud.objective('Survive the transformation');
  }
  enterP2() {
    this.state = 'p2'; this.t = 0; this.idleT = 1.5; this.atkIdx = 0; this.atk = ''; G.cinematic = false; G.camRig = null;
    this.core.alive = true; this.core.lockable = true; this.coreMesh.visible = true; this.blade.visible = true; this.blade.scale.x = 1;
    setMusic(3); G.hud.objective('Destroy HELIOS core — PERFECT DODGE its blade');
  }
  beginFinisherReady() {
    this.state = 'fready'; this.t = 0; this.beam.visible = this.tele.visible = this.beamOn = false; this.arc.visible = false;
    G.enemies.clear(); G.player.clearLocks();
    G.hud.warn('HELIOS CORE CRITICAL', 3); G.hud.prompt('PRESS <b>F</b> — OVERDRIVE FINISHER', 6); sfx.warning(); slowmo(0.4, 0.8);
  }
  beginFinisher() {
    this.state = 'finisher'; this.t = 0; this.prevFT = 0; G.cinematic = true; G.player.auto = true; G.player.meleeState = 'none'; G.player.clearLocks(); G.hud.prompt('', 0);
    this.fin = { from: new THREE.Vector3() };
  }
  // ---------------- per frame ----------------
  update(dt: number) {
    if (this.state === 'off') return;
    this.t += dt; const P = G.player.pos;
    bodyMat.emissive.multiplyScalar(Math.exp(-12 * dt));
    if (this.exposedT > 0) this.exposedT -= dt;
    const r = this.root;
    if (this.state === 'intro') this.intro(dt);
    else if (this.state === 'p1') {
      r.position.x = damp(r.position.x, Math.sin(this.t * 0.25) * 30 + P.x * 0.3, 0.8, dt); r.position.y = damp(r.position.y, this.basePos.y + Math.sin(this.t * 0.6) * 5, 1, dt); r.position.z = damp(r.position.z, this.basePos.z, 1, dt);
      r.rotation.y = 0.45 + Math.sin(this.t * 0.2) * 0.15; r.rotation.z = Math.sin(this.t * 0.5) * 0.04;
      this.phase1(dt);
    } else if (this.state === 'transform') this.transform(dt);
    else if (this.state === 'p2') this.phase2(dt);
    else if (this.state === 'fready') {
      r.position.y = damp(r.position.y, -24, 2, dt); r.rotation.x = damp(r.rotation.x, 0.25, 2, dt); r.position.z = damp(r.position.z, -170, 2, dt); r.position.x = damp(r.position.x, 0, 2, dt);
      this.mods.wingR.g.rotation.z = damp(this.mods.wingR.g.rotation.z, Math.PI / 2 - 0.2, 3, dt);
      this.coreMesh.scale.setScalar(1 + Math.sin(G.time * 30) * 0.15);
      if (Math.random() < dt * 8) { tmp.set(rand(-40, 40), rand(-40, 70), rand(-5, 10)).add(r.position); fx.explosion(tmp, rand(1, 2.5), undefined, { sound: false, debris: 2 }); }
      if (this.t > 0.3 && (G.input.wasPressed('melee') || this.t > 6)) this.beginFinisher();
    } else if (this.state === 'finisher') this.finisher(dt);
    // persistent damage fires
    for (const w of this.weak) if (w.burning && Math.random() < 0.8) {
      fx.add.emit(w.pos.x + rand(-3, 3), w.pos.y + rand(-3, 3), w.pos.z + rand(-3, 3), rand(-4, 4), rand(4, 12), 0, 0.5, 4, 1.5, 3, 1.2, 0.3, 1, 0.1, 0.02, 0.8, 1, -5, 0, 0.3, 0);
      if (Math.random() < 0.3) fx.smoke.emit(w.pos.x, w.pos.y, w.pos.z, rand(-3, 3), rand(5, 10), 0, 2.5, 4, 14, 0.12, 0.1, 0.1, 0.05, 0.05, 0.05, 0.5, 1, -6, 0, 0.4, 2);
    }
    // engine flames
    if (this.root.visible && this.state !== 'finisher' && Math.random() < 0.9) for (const k of ['engL', 'engR']) {
      tmp.set(0, 0, -18); this.mods[k].g.localToWorld(tmp); tmp2.set(0, 0, -1).applyQuaternion(this.mods[k].g.getWorldQuaternion(new THREE.Quaternion()));
      fx.add.emit(tmp.x, tmp.y, tmp.z, tmp2.x * 90, tmp2.y * 90, tmp2.z * 90, 0.4, 8 * this.power, 3, 3, 1, 0.3, 1.2, 0.2, 0.05, 0.9 * this.power, 1, 0, 0, 0.5, 0);
    }
    this.coreMesh.rotation.y += dt * 2;
    this.updateParts();
    this.updateBeam(dt);
    G.hud.boss(this.state === 'intro' ? 0 : this.hp / this.maxHp, this.state === 'off' ? false : this.state !== 'finisher' || this.t < 3);
  }
  intro(dt: number) {
    const r = this.root, t = this.t;
    const u = easeOut(t / 7); r.position.lerpVectors(tmp.set(0, 60, -1300), this.basePos, u); r.rotation.y = lerp(0.7, 0.45, u);
    this.setPower(clamp((t - 1.2) / 2.5, 0, 1) * (0.8 + 0.2 * Math.sin(t * 30)));
    const pl = G.player.pos;
    this.cam(tmp2.set(pl.x * 0.5 + 8 - t * 1.2, pl.y + 2 + t * 0.6, 24 - t), tmp3.copy(r.position).lerp(pl, 0.2), 50 + t * 2);
    if (t > 7) { this.state = 'p1'; this.t = 0; G.camRig = null; G.cinematic = false; this.idleT = 1; this.setPower(1); G.hud.objective('Destroy the 3 weak points'); setMusic(2); }
  }
  nextAttack(list: string[]) { this.atk = list[this.atkIdx % list.length]; this.atkIdx++; this.atkT = 0; this.sweep = {}; this.slashD = {}; }
  phase1(dt: number) {
    if (!this.atk) { this.idleT -= dt; if (this.idleT <= 0) this.nextAttack(['missiles', 'sweep', 'drones', 'sweep', 'missiles', 'drones', 'sweep']); }
    else {
      this.atkT += dt; const t = this.atkT;
      if (this.atk === 'missiles') {
        if (t < 0.05 && !this.sweep.w) { this.sweep.w = true; G.hud.warn('MISSILE BARRAGE', 1.6); sfx.alarm(); }
        if (Math.floor(t * 10) !== Math.floor((t - dt) * 10) && t < 1.4) {
          tmp.set(rand(-8, 8), 10, rand(-20, 20)); this.mods.torso.g.localToWorld(tmp);
          G.enemies.fireMissile(tmp, tmp2.set(rand(-40, 40), rand(50, 80), rand(10, 40)), 1.5); sfx.missile();
        }
        if (t > 2.2) this.endAttack(2.5);
      } else if (this.atk === 'sweep') this.sweepAttack(dt);
      else if (this.atk === 'drones') {
        if (Math.floor(t * 6) !== Math.floor((t - dt) * 6) && t < 1.4) {
          const s = Math.random() < 0.5 ? -1 : 1; tmp.set(s * 30, -6, 0); this.mods[s < 0 ? 'wingL' : 'wingR'].g.localToWorld(tmp);
          G.enemies.spawn('drone', { from: tmp.clone(), station: new THREE.Vector3(rand(-45, 45), rand(-8, 22), rand(-140, -90)), stay: 14, ph: rand(0, 6), shoot: true, rate: 0.3, enterT: 1.6, arc: 10 });
        }
        if (t > 1.8) this.endAttack(3);
      }
    }
    // passive turret fire
    if (Math.random() < dt * 1.6 && G.player.alive) { tmp.set(rand(-10, 10), 9, rand(-10, 20)); this.mods.torso.g.localToWorld(tmp); G.enemies.fireOrb(tmp, G.player.pos, 85, 8, true, 0.04); }
  }
  endAttack(idle: number) { this.atk = ''; this.idleT = idle; this.beamOn = false; this.beam.visible = false; this.tele.visible = false; }
  sweepAttack(dt: number) {
    const t = this.atkT, s = this.sweep, P = G.player.pos;
    tmp.set(0, 2, 8); this.mods.bridge.g.localToWorld(tmp); this.beamFrom.copy(tmp);
    if (!s.init) { s.init = true; s.dir = P.x > 0 ? -1 : 1; s.x0 = -s.dir * 75; s.x1 = s.dir * 75; s.y = P.y; G.hud.warn('BEAM SWEEP — DODGE THROUGH IT', 1.6); sfx.charge(1.3); }
    const TELE = 1.3, DUR = 1.7;
    if (t < TELE) { s.y = damp(s.y, P.y, 3, dt); this.tele.visible = true; this.aimCyl(this.tele, this.beamFrom, tmp2.set(s.x0, s.y, 0), 1 + Math.sin(t * 40) * 0.5); }
    else if (t < TELE + DUR) {
      if (!s.fired) { s.fired = true; sfx.beam(DUR); shake(0.4); }
      this.tele.visible = false; const u = (t - TELE) / DUR; const x = lerp(s.x0, s.x1, u);
      this.beamTo.set(x, s.y, 0); this.beamOn = true; this.beamR = 4;
      const vx = (s.x1 - s.x0) / DUR; const dx = P.x - x;
      if (Math.abs(P.y - s.y) < 7 && Math.sign(dx) === Math.sign(vx)) G.threat = Math.min(G.threat, Math.max(0, (Math.abs(dx) - 4) / Math.abs(vx)));
    } else this.endAttack(2.2);
  }
  aimCyl(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, w: number, extend = 1) {
    m.position.copy(a); tmp3.copy(b).sub(a); const len = tmp3.length() * extend; m.lookAt(b); m.scale.set(w, w, len);
  }
  updateBeam(dt: number) {
    if (!this.beamOn) { this.beam.visible = false; return; }
    this.beam.visible = true;
    const w = this.beamR * (0.9 + Math.random() * 0.2);
    this.aimCyl(this.beam, this.beamFrom, this.beamTo, w, 1.6);
    // impact sparks at the player's plane
    fx.add.emit(this.beamTo.x, this.beamTo.y, this.beamTo.z, rand(-20, 20), rand(-20, 20), rand(-20, 20), 0.3, 5, 1, 3, 1, 2, 1, 0.2, 0.6, 1, 2, 0, 0, 0.3, 0);
    fx.add.emit(this.beamFrom.x, this.beamFrom.y, this.beamFrom.z, 0, 0, 0, 0.1, 14, 6, 4, 2, 3, 2, 0.4, 1, 1, 0, 0, 0, 0, 1);
    shake(0.03);
    // collision: distance from player to infinite segment a->b (extended)
    const P = G.player.pos; tmp.copy(this.beamTo).sub(this.beamFrom); const L = tmp.length(); tmp.divideScalar(L);
    tmp2.copy(P).sub(this.beamFrom); const proj = tmp2.dot(tmp); tmp3.copy(this.beamFrom).addScaledVector(tmp, proj);
    if (proj > 0 && tmp3.distanceTo(P) < this.beamR + 1.2) G.player.damage(28, tmp3);
  }
  transform(dt: number) {
    const t = this.t, r = this.root, P = G.player.pos;
    // camera pull back
    this.cam(tmp2.set(P.x * 0.3 + 30 - t * 2, P.y + 14 + t, 60 + t * 3), tmp3.copy(r.position).add(tmp.set(0, 20, 0)), 62);
    r.position.lerp(tmp.set(0, -12, -190), 1 - Math.exp(-1.2 * dt)); r.rotation.y = damp(r.rotation.y, 0, 1.5, dt); r.rotation.z = damp(r.rotation.z, 0, 2, dt);
    if (t > 0.4 && !this.fin.plates) {
      this.fin.plates = true; sfx.transform();
      for (const w of this.weak) if (w.alive) { w.alive = false; w.mesh!.visible = false; w.burning = true; fx.explosion(w.pos, 3); }
      for (const p of this.plates) { p.v.copy(p.home).normalize().multiplyScalar(rand(25, 45)).add(tmp.set(0, rand(5, 20), 0)); p.w.set(rand(-2, 2), rand(-2, 2), rand(-2, 2)); p.m.getWorldPosition(tmp); const q = tmp.clone(); fx.later(rand(0, 0.8), () => fx.explosion(q, 2, undefined, { debris: 6, sound: false })); }
      this.coreMesh.visible = true; this.coreMesh.scale.setScalar(0.3);
    }
    if (this.fin.plates) for (const p of this.plates) if (p.m.visible) { p.m.position.addScaledVector(p.v, dt); p.v.y -= 20 * dt; p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; if (t > 3.5) p.m.visible = false; }
    this.setMorph(t);
    // energy crackle
    if (t > 1 && t < 5.2) {
      for (let i = 0; i < 3; i++) { tmp.set(rand(-30, 30), rand(-20, 70), rand(-10, 10)).applyMatrix4(r.matrixWorld.clone().scale(new THREE.Vector3(1 / SC, 1 / SC, 1 / SC))); tmp.copy(r.position).add(tmp2.set(rand(-40, 40), rand(-30, 90), rand(-10, 10)));
        fx.add.emit(tmp.x, tmp.y, tmp.z, rand(-30, 30), rand(-30, 30), rand(-30, 30), 0.25, 0.6, 0.1, 2, 2.6, 4, 0.5, 1, 3, 1, 3, 0, 0.05, 0, 1); }
      if (Math.random() < dt * 3) { tmp.copy(r.position).add(tmp2.set(rand(-30, 30), rand(-20, 70), rand(-5, 15))); fx.explosion(tmp, 1.5, undefined, { sound: false, debris: 3 }); }
      // converging energy into the core
      this.coreMesh.getWorldPosition(tmp); for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), d = rand(30, 60); fx.add.emit(tmp.x + Math.cos(a) * d, tmp.y + Math.sin(a) * d, tmp.z, -Math.cos(a) * d * 1.8, -Math.sin(a) * d * 1.8, 0, 0.5, 1.2, 0.2, 0.8, 2, 4, 1, 1, 3, 1, 0, 0, 0.05, 0, 1); }
      this.coreMesh.scale.setScalar(lerp(0.3, 1.2, clamp((t - 1) / 4, 0, 1)));
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) shake(0.25);
    }
    if (t > 4.4 && !this.fin.blade) { this.fin.blade = true; this.blade.visible = true; sfx.charge(0.8); }
    if (this.fin.blade) { this.blade.scale.x = Math.min(1, this.blade.scale.x + dt * 1.5); if (Math.random() < 0.7) { tmp.set(48 + rand(0, 84) * this.blade.scale.x, -4, 0); this.mods.wingR.g.localToWorld(tmp); fx.sparks(tmp, 2, 30, 3, 1, 3); } }
    if (t > 5.4 && !this.fin.roar) {
      this.fin.roar = true; this.coreMesh.getWorldPosition(tmp);
      fx.ring(tmp, 5, 260, 1.2, 3, 1.2, 3.2); fx.ring(tmp, 5, 160, 0.8, 1.2, 2.4, 3.4); fx.add.emit(tmp.x, tmp.y, tmp.z, 0, 0, 0, 0.6, 30, 120, 4, 3, 5, 1, 0.3, 1, 1, 0, 0, 0, 0, 1);
      shake(1); flash(0.3, 1, 0.6, 1); sfx.explosion(4); G.hud.big('HELIOS — FINAL FORM', 'boss'); this.setPower(1.4);
    }
    if (t > 7) this.enterP2();
  }
  phase2(dt: number) {
    const r = this.root, P = G.player.pos, t = this.atkT;
    const wingR = this.mods.wingR.g, wingL = this.mods.wingL.g;
    // idle sway
    const bob = Math.sin(this.t * 1.3) * 3;
    if (!this.atk) {
      this.idleT -= dt;
      r.position.x = damp(r.position.x, P.x * 0.6, 1.2, dt); r.position.y = damp(r.position.y, -12 + bob, 1.5, dt); r.position.z = damp(r.position.z, -165, 1.5, dt);
      wingR.rotation.z = damp(wingR.rotation.z, Math.PI / 2 * -1 + 0.25 + Math.sin(this.t) * 0.1, 3, dt); wingL.rotation.z = damp(wingL.rotation.z, Math.PI / 2 - 0.25 - Math.sin(this.t) * 0.1, 3, dt);
      if (this.idleT <= 0) this.nextAttack(['slash', 'beam', 'dash', 'missiles', 'slash', 'dash', 'beam', 'slash']);
      if (Math.random() < dt * 1.0 && G.player.alive) { this.coreMesh.getWorldPosition(tmp); G.enemies.fireOrb(tmp, P, 80, 8, true, 0.05); }
    } else this.atkT += dt;
    // face player
    this.look.position.copy(r.position); this.look.lookAt(P.x, r.position.y, P.z); r.quaternion.slerp(this.look.quaternion, 1 - Math.exp(-3 * dt));
    this.mods.bridge.g.rotation.y = clamp((P.x - r.position.x) * 0.004, -0.4, 0.4);
    this.coreMesh.scale.setScalar(this.exposedT > 0 ? 1.4 + Math.sin(G.time * 25) * 0.15 : 1 + Math.sin(G.time * 6) * 0.05);
    cMat.color.copy(cBase).multiplyScalar(this.exposedT > 0 ? 2 : 1);
    if (this.atk === 'slash') {
      const d = this.slashD;
      if (!d.init) { d.init = true; G.hud.warn('!! BLADE INCOMING — DODGE AT THE LAST MOMENT !!', 2); sfx.alarm(); d.a0 = 1.1; d.a1 = -2.5; }
      if (t < 1.1) { // dash in + raise
        r.position.x = damp(r.position.x, P.x * 0.9, 4, dt); r.position.y = damp(r.position.y, P.y - 50, 3, dt); r.position.z = damp(r.position.z, -55, 3, dt);
        wingR.rotation.z = damp(wingR.rotation.z, d.a0, 5, dt); wingR.rotation.x = damp(wingR.rotation.x, -0.7, 4, dt);
        if (Math.random() < 0.6) { tmp.set(48 + 84, -4, 0); wingR.localToWorld(tmp); fx.add.emit(tmp.x, tmp.y, tmp.z, 0, 0, 0, 0.15, rand(8, 16), 2, 4, 3, 4, 2, 0.5, 2, 1, 0, 0, 0, 0, 1); }
        d.cx = r.position.x + 17 * SC; d.cy = r.position.y + 42 * SC;
        const phi = Math.atan2(P.y - d.cy, P.x - d.cx); G.threat = Math.min(G.threat, 1.1 - t + Math.max(0, (d.a0 - phi) / 12));
      } else if (t < 1.42) {
        const u = (t - 1.1) / 0.32; const prev = d.cur ?? d.a0; const cur = lerp(d.a0, d.a1, easeInOut(u)); d.cur = cur;
        wingR.rotation.z = cur;
        this.arc.visible = true; this.arc.position.set(d.cx, d.cy, P.z - 1); this.arc.rotation.set(0, 0, 0); this.arcMat.uniforms.uA0.value = d.a0; this.arcMat.uniforms.uA1.value = cur; this.arcMat.uniforms.uAlpha.value = 1.4;
        if (!d.sfx) { d.sfx = true; sfx.melee(); sfx.beam(0.3); shake(0.6); }
        const phi = Math.atan2(P.y - d.cy, P.x - d.cx), rho = Math.hypot(P.y - d.cy, P.x - d.cx);
        if (phi <= prev + 0.05 && phi >= cur - 0.05 && rho > 14 && rho < 110 && !d.hit) { d.hit = true; if (G.player.damage(32, P)) fx.sparks(P, 40, 60, 3, 0.5, 2); }
        if (phi < prev) G.threat = Math.min(G.threat, Math.max(0, (cur - phi) / ((d.a0 - d.a1) / 0.32)));
      } else if (t < 2.4) { this.arcMat.uniforms.uAlpha.value = Math.max(0, 1.4 - (t - 1.42) * 3); r.position.z = damp(r.position.z, -150, 2, dt); wingR.rotation.x = damp(wingR.rotation.x, 0, 3, dt); }
      else { this.arc.visible = false; this.endAttack(1.8); }
    } else if (this.atk === 'beam') {
      const s = this.sweep; this.coreMesh.getWorldPosition(this.beamFrom);
      if (!s.init) { s.init = true; s.aim = P.clone(); G.hud.warn('CORE CANNON CHARGING', 1.8); sfx.charge(1.6); }
      r.position.z = damp(r.position.z, -170, 2, dt);
      if (t < 1.7) { s.aim.lerp(P, 1 - Math.exp(-6 * dt)); const a = rand(0, 6.28), dd = rand(20, 45); fx.add.emit(this.beamFrom.x + Math.cos(a) * dd, this.beamFrom.y + Math.sin(a) * dd, this.beamFrom.z + 5, -Math.cos(a) * dd * 2.5, -Math.sin(a) * dd * 2.5, 0, 0.4, 1.5, 0.3, 1, 2.5, 4, 2, 2, 4, 1, 0, 0, 0.05, 0, 1);
        this.tele.visible = t > 0.6; this.aimCyl(this.tele, this.beamFrom, s.aim, 1.5);
        if (P.distanceTo(s.aim) < 7) G.threat = Math.min(G.threat, 1.7 - t); }
      else if (t < 3.1) { if (!s.f) { s.f = true; sfx.beam(1.4); shake(0.6); flash(0.2, 1, 0.6, 1); } this.tele.visible = false;
        const step = 22 * dt; tmp.copy(P).sub(s.aim); if (tmp.length() > step) tmp.setLength(step); s.aim.add(tmp);
        this.beamTo.copy(s.aim); this.beamOn = true; this.beamR = 5.5;
        const dd = P.distanceTo(s.aim); if (dd < 12) G.threat = Math.min(G.threat, Math.max(0, (dd - 6.5) / 22)); }
      else { this.endAttack(1.6); this.exposedT = 3.5; G.hud.small('CORE EXPOSED — x2 DAMAGE', 'ok'); }
    } else if (this.atk === 'dash') {
      const s = this.sweep;
      if (!s.init) { s.init = true; s.side = r.position.x > 0 ? -1 : 1; s.n = 0; sfx.boost(); }
      const seg = Math.floor(t / 0.9);
      if (seg !== s.seg) { s.seg = seg; s.side *= -1; if (seg > 0) this.orbRing(); }
      r.position.x = damp(r.position.x, s.side * 75, 5, dt); r.position.z = damp(r.position.z, -130, 3, dt);
      if (Math.random() < 0.8) { tmp.copy(r.position).add(tmp2.set(rand(-20, 20), rand(0, 80), 0)); fx.add.emit(tmp.x, tmp.y, tmp.z, 0, 0, 0, 0.3, rand(8, 14), 2, 2.4, 0.3, 1.6, 0.6, 0.05, 0.3, 0.6, 0, 0, 0, 0.3, 0); }
      if (t > 2.8) this.endAttack(1.6);
    } else if (this.atk === 'missiles') {
      if (Math.floor(t * 12) !== Math.floor((t - dt) * 12) && t < 1.4) { const s = Math.random() < 0.5 ? 'noseL' : 'noseR'; tmp.set(0, 0, 20); this.mods[s].g.localToWorld(tmp); G.enemies.fireMissile(tmp, tmp2.set(rand(-50, 50), rand(30, 70), rand(20, 50)), 1.7); sfx.missile(); }
      if (t < 0.05 && !this.sweep.w) { this.sweep.w = true; G.hud.warn('MISSILE BARRAGE', 1.4); }
      if (t > 2) this.endAttack(1.5);
    }
  }
  orbRing() {
    this.coreMesh.getWorldPosition(tmp); const P = G.player.pos;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; tmp2.copy(P).sub(tmp).normalize(); tmp2.x += Math.cos(a) * 0.18; tmp2.y += Math.sin(a) * 0.18; G.enemies.fireOrbDir(tmp, tmp2, 85, 9, true); }
    sfx.explosion(1, 0.4);
  }
  finisher(dt: number) {
    const t = this.t, pt = this.prevFT; this.prevFT = t; const at = (x: number) => pt < x && t >= x;
    const pl = G.player, P = pl.pos, r = this.root; const f = this.fin;
    this.coreMesh.getWorldPosition(tmp3); const core = f.core || (f.core = tmp3.clone());
    if (at(0) || !f.started) { f.started = true; f.from.copy(P); G.hud.big('OVERDRIVE', 'perfect'); sfx.boost(); slowmo(0.6, 0.5); G.speedOverride = 2.4; }
    pl.boosting = t < 2.6;
    if (t < 1.9) {
      P.x = damp(P.x, 0, 3, dt); P.y = damp(P.y, 6, 3, dt);
      this.cam(tmp.set(P.x + 6, P.y - 1.5, P.z + 9), core, 88);
    }
    if (at(0.35)) {
      const pts = this.armorPts; for (const a of pts) { a.alive = true; a.locks = 0; }
      pl.locks = pts.map(t2 => ({ t: t2, age: 0 })); sfx.locked();
    }
    if (at(0.9)) { const tg = pl.locks.map((l: any) => l.t); pl.locks = []; pl.fireSalvo(tg.concat(tg)); G.hud.small('FULL SALVO', 'ok'); }
    if (at(1.9)) { f.from.copy(P); G.hud.big('', ''); slowmo(0.35, 1.1); sfx.melee(); pl.mech.blade.visible = true; }
    if (t >= 1.9 && t < 2.6) {
      const u = easeInOut((t - 1.9) / 0.7); P.lerpVectors(f.from, tmp.copy(core).add(tmp2.set(0, -2, 10)), u);
      pl.mech.armL.rotation.set(-2.6, 0, 0.6);
      if (Math.random() < 0.9) pl.ghost(0.5);
      this.cam(tmp2.set(P.x - 14, P.y + 3, P.z + 6), tmp.copy(P).lerp(core, 0.5), 75);
    }
    if (at(2.6)) {
      hitstop(0.4); flash(1, 1, 1, 1); shake(1.2); sfx.slashHit(); sfx.explosion(3);
      pl.slash.visible = true; pl.slashT = 0; pl.slash.position.copy(core); pl.slash.scale.setScalar(7); pl.slash.rotation.set(0, 0, 0.5);
      fx.sparks(core, 120, 140, 2, 3, 4); fx.ring(core, 3, 120, 0.7, 1, 2.5, 3.5); fx.ring(core, 3, 70, 0.5, 3, 3, 3);
      for (let i = 0; i < 80; i++) { const a = rand(0, 6.28); fx.add.emit(core.x, core.y, core.z, Math.cos(a) * 200, Math.sin(a) * 200, rand(-30, 30), 0.5, 0.6, 0.1, 3, 3.5, 4, 1, 1.5, 3, 1, 3, 0, 0.06, 0, 1); }
      pl.mech.armL.rotation.set(0.4, 0, -0.5); this.hp = 0; f.passFrom = P.clone();
      G.hud.bossKill();
    }
    if (t > 2.6 && t < 5.1) {
      const u = easeOut((t - 2.6) / 1.2); P.lerpVectors(f.passFrom, tmp.copy(core).add(tmp2.set(14, 4, -70)), u);
      pl.extraYaw = damp(pl.extraYaw, Math.PI * 0.85, 3, dt);
      this.cam(tmp2.copy(core).add(tmp.set(30, 6, -120)), tmp.copy(P).lerp(core, 0.45), 55);
      if (Math.random() < dt * 10) { tmp.copy(core).add(tmp2.set(rand(-40, 40), rand(-50, 60), rand(-10, 10))); fx.explosion(tmp, rand(1, 2), undefined, { sound: Math.random() < 0.3, debris: 1 }); }
      if (Math.random() < 0.8) { const a = rand(0, 6.28); fx.add.emit(core.x, core.y, core.z, Math.cos(a) * 160, Math.sin(a) * 160, rand(-40, 40), 0.3, 3, 1, 4, 3, 4.5, 1, 1.5, 3, 1, 0, 0, 0.1, 0, 1); }
      this.coreMesh.scale.setScalar(1.3 + Math.sin(G.time * 40) * 0.3 + (t - 2.6) * 0.4); cMat.color.setRGB(4, 4, 5);
      r.rotation.x = damp(r.rotation.x, 0.4, 0.8, dt); r.position.y -= dt * 4;
    }
    if (at(5.1)) {
      slowmo(0.3, 1.8); shake(1.5); flash(1, 1, 0.95, 0.85); sfx.explosion(5); sfx.explosion(4);
      fx.add.emit(core.x, core.y, core.z, 0, 0, 0, 1.4, 40, 420, 5, 4, 3, 2, 0.4, 0.1, 1, 0, 0, 0, 0, 1);
      for (let i = 0; i < 5; i++) fx.ring(core, 10, 200 + i * 120, 1 + i * 0.3, 3, 1.6 - i * 0.2, 0.6 + i * 0.3);
      for (const k in this.mods) { this.mods[k].g.getWorldPosition(tmp); const p = tmp.clone(); fx.later(rand(0, 0.5), () => fx.explosion(p, rand(5, 8), undefined, { debris: 14 })); }
      for (let i = 0; i < 14; i++) { const p = core.clone().add(tmp.set(rand(-60, 60), rand(-60, 80), rand(-20, 20))); fx.later(0.1 + i * 0.07, () => fx.explosion(p, rand(3, 6), undefined, { debris: 6, sound: i % 3 === 0 })); }
      fx.light(core, 0xffcc88, 3000, 1.5);
    }
    if (at(5.6)) { r.visible = false; this.coreMesh.visible = false; }
    if (t > 5.1) {
      this.cam(tmp2.copy(core).add(tmp.set(30 + (t - 5.1) * 6, 6 + (t - 5.1) * 3, -120 - (t - 5.1) * 4)), tmp.copy(P).lerp(core, 0.5), 55 + (t - 5.1) * 2);
    }
    if (at(6.6)) { G.hud.big('MISSION COMPLETE', 'complete', 4); sfx.victory(); stopMusic(2); }
    if (t > 10) { this.state = 'dead'; this.root.visible = false; G.speedOverride = 0; G.onBossDead && G.onBossDead(); }
  }
}
export { mats };

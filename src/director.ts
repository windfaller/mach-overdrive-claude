import * as THREE from 'three';
import { G, rand, lerp, flash, shake } from './core';
import { glow, mats } from './models';
import { fx } from './fx';
import { sfx, setMusic, resumeMusic } from './audio';

type Cond = () => boolean;
const wait = (s: number): Cond => { const t0 = G.missionTime; return () => G.missionTime - t0 >= s; };
const until = (f: () => boolean, max = 1e9): Cond => { const t0 = G.missionTime; return () => f() || G.missionTime - t0 >= max; };
const cleared = (max: number) => until(() => G.enemies.count() === 0, max);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function drones(n: number, pattern: string, o: any = {}) {
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0.5; let st: THREE.Vector3;
    if (pattern === 'arc') st = V(lerp(-48, 48, u), 6 + Math.sin(u * Math.PI) * 14, -115 - Math.sin(u * Math.PI) * 25);
    else if (pattern === 'ring') { const a = u * Math.PI * 2; st = V(Math.cos(a) * 30, 6 + Math.sin(a) * 16, -130); }
    else if (pattern === 'wall') st = V(lerp(-42, 42, (i % 5) / 4), -4 + Math.floor(i / 5) * 12, -120 - (i % 2) * 15);
    else st = V(rand(-45, 45), rand(-8, 22), rand(-150, -95));
    const side = o.side ?? (st.x < 0 ? -1 : 1);
    const from = o.fromBehind ? V(side * rand(20, 40), rand(-10, 20), 40) : V(st.x * 2.5 + side * 60, st.y + rand(30, 70), -700);
    G.enemies.spawn('drone', { from, station: st, stay: o.stay ?? 12, ph: rand(0, 6), shoot: o.shoot ?? true, rate: o.rate ?? 0.22, enterT: (o.enterT ?? 1.8) + i * 0.06, arc: o.fromBehind ? -10 : 20, wx: o.wx, wy: o.wy });
  }
}
function fighters(n: number, o: any = {}) {
  for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1;
    G.enemies.spawn('fighter', { from: V(s * rand(12, 30), rand(-6, 18), 50 + i * 10), tx: s * rand(10, 35), ty: rand(-4, 16), tz: rand(-130, -95), ph: rand(0, 6), stay: o.stay ?? 12, shoot: o.shoot ?? true }); }
}
const heavy = (x: number, y = 6) => G.enemies.spawn('heavy', { from: V(x * 2, y + 40, -800), station: V(x, y, -175), stay: 45 });

// ----------------- mass-driver tunnel hazards -----------------
class TunnelRun {
  obs: { m: THREE.Group; type: string; a: number; w: number; gx: number; gy: number; on: boolean; done: boolean }[] = [];
  run = false; t = 0;
  constructor(scene: THREE.Scene) {
    const red = glow(3.5, 0.5, 0.2), cy = glow(0.4, 2.6, 3.4);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(70, 3.6, 4), mats.dark); bar.name = 'bar'; g.add(bar);
      const e1 = new THREE.Mesh(new THREE.BoxGeometry(70, 0.4, 0.4), red); e1.position.set(0, 1.9, 2.1); bar.add(e1);
      const e2 = e1.clone(); e2.position.y = -1.9; bar.add(e2);
      const half = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3, 40, 1, false, 0, Math.PI).rotateX(Math.PI / 2), mats.dark); half.name = 'half'; g.add(half);
      const he = new THREE.Mesh(new THREE.BoxGeometry(68, 0.6, 0.6), red); he.position.set(0, 0, 1.8); half.add(he);
      for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 0.3), glow(3, 1.2, 0.1)); s.position.set(-24 + k * 12, 16, 1.6); s.rotation.z = 0.5; half.add(s); }
      const gate = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.45, 8, 32), cy); gate.name = 'gate'; g.add(gate);
      const gate2 = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.15, 6, 32), glow(3, 3, 3)); gate.add(gate2);
      g.visible = false; scene.add(g);
      this.obs.push({ m: g, type: '', a: 0, w: 0, gx: 0, gy: 0, on: false, done: false });
    }
  }
  spawn(type: string) {
    const o = this.obs.find(x => !x.on); if (!o) return;
    o.on = true; o.done = false; o.type = type; o.m.visible = true; o.m.position.set(0, 0, -1100);
    for (const c of o.m.children) c.visible = c.name === type;
    o.a = rand(0, Math.PI * 2); o.w = type === 'bar' ? rand(-0.8, 0.8) : type === 'half' ? rand(-0.25, 0.25) : 0;
    if (type === 'gate') { const a = rand(0, 6.28), r = rand(0, 14); o.gx = Math.cos(a) * r; o.gy = Math.sin(a) * r; o.m.position.x = o.gx; o.m.position.y = o.gy; }
  }
  clear() { for (const o of this.obs) { o.on = false; o.m.visible = false; } this.run = false; }
  update(dt: number) {
    if (this.run) {
      this.t -= dt;
      if (this.t <= 0) { const r = Math.random(); this.spawn(r < 0.4 ? 'bar' : r < 0.7 ? 'half' : 'gate'); this.t = rand(0.55, 1.0) * 260 / G.speed * 1.4; }
    }
    const P = G.player.pos, pl = G.player;
    for (const o of this.obs) {
      if (!o.on) continue;
      const pz = o.m.position.z; o.m.position.z += G.speed * dt; o.a += o.w * dt;
      if (o.type !== 'gate') o.m.rotation.z = o.a; else o.m.rotation.z += dt * 2;
      const z = o.m.position.z;
      // clearance at the player's position
      let clear = 99, block = false;
      if (o.type === 'bar') { clear = Math.abs(-Math.sin(o.a) * P.x + Math.cos(o.a) * P.y) - 1.8 - 1.4; block = clear < 0; }
      else if (o.type === 'half') { const d = P.x * Math.cos(o.a + Math.PI / 2) + P.y * Math.sin(o.a + Math.PI / 2); clear = -d - 1.6; block = clear < 0; }
      if (block && z < P.z) { const tti = (P.z - z) / G.speed; if (tti < 0.6) G.threat = Math.min(G.threat, tti); }
      if (pz < P.z && z >= P.z && !o.done) {
        o.done = true;
        if (o.type === 'gate') {
          if (Math.hypot(P.x - o.gx, P.y - o.gy) < 7) { pl.energy = Math.min(100, pl.energy + 30); G.baseSpeed += 10; sfx.gate(); G.hud.small('GATE  +SPEED', 'ok'); fx.ring(o.m.position, 6, 30, 0.4, 0.4, 2.4, 3.4); G.addScore(300); flash(0.15, 0.4, 0.9, 1); }
        } else if (block) { if (pl.damage(14, P)) { fx.explosion(P.clone(), 1.2, undefined, { debris: 3 }); shake(0.6); } }
        else if (clear < 5) pl.nearMiss();
      }
      if (z > 60) { o.on = false; o.m.visible = false; }
    }
  }
}

export class Director {
  gen: Generator<Cond> | null = null; cond: Cond | null = null; chapter = 0; checkpoint = 0; tunnel: TunnelRun;
  constructor(scene: THREE.Scene) { this.tunnel = new TunnelRun(scene); }
  static sectionOf(ch: number) { return ['city', 'highway', 'fleet', 'fleet', 'sky'][ch]; }
  start(ch: number) { this.chapter = ch; this.checkpoint = ch; this.tunnel.clear(); this.gen = this.mission(ch); this.cond = null; this.step(); }
  step() { if (!this.gen) return; const r = this.gen.next(); if (r.done) { this.gen = null; this.cond = null; } else this.cond = r.value; }
  update(dt: number) {
    this.tunnel.update(dt);
    if (this.cond && this.cond()) this.step();
  }
  *mission(start: number): Generator<Cond> {
    const H = G.hud, W = G.world, E = G.enemies;
    if (start <= 0) {
      this.checkpoint = 0; H.setSector('SECTOR 01 // NEO-KAI MEGACITY'); setMusic(1); resumeMusic();
      H.big('MISSION START', 'perfect', 2.4); H.objective('Break through the Neo-Kai defense line');
      yield wait(2.6);
      H.prompt('<b>WASD</b> fly &nbsp; <b>MOUSE</b> aim &nbsp; <b>LMB</b> hold to fire', 6);
      drones(6, 'arc', { shoot: false, stay: 16 }); yield cleared(18);
      yield wait(0.8);
      H.big('DRONE SWARM', 'kill'); H.prompt('Hold <b>RMB</b> (or <b>E</b>) to MULTI-LOCK · release to fire missiles', 8);
      H.objective('Multi-lock the swarm');
      drones(8, 'wall', { shoot: false, stay: 18 }); yield wait(1.2); drones(6, 'arc', { shoot: false, stay: 17, fromBehind: true });
      yield cleared(22);
      yield wait(1);
      H.prompt('<b>SHIFT</b> boost · <b>SPACE</b> dodge — dodge just before a hit for <b>PERFECT DODGE</b>', 8);
      H.objective('Clear the skyline'); setMusic(2);
      drones(8, 'random', { rate: 0.35 }); fighters(4); yield wait(7); drones(10, 'ring', { rate: 0.3 }); fighters(2);
      yield cleared(26);
      yield wait(1); H.big('SECOND WAVE', 'kill'); drones(12, 'arc', { rate: 0.3, fromBehind: true }); yield wait(3); fighters(4); heavy(0, 14);
      yield cleared(30);
    }
    if (start <= 1) {
      this.checkpoint = 1; W.setSection('highway'); H.setSector('SECTOR 02 // SKY HIGHWAY 7'); H.big('SKY HIGHWAY', 'kill'); setMusic(2); resumeMusic();
      H.objective('Clear the highway corridor'); yield wait(2.5);
      fighters(4); yield wait(3); heavy(0); drones(6, 'arc');
      H.prompt('Press <b>F</b> near a target for an ENERGY BLADE lunge · tap again to combo', 8);
      yield cleared(32);
      fighters(6); yield wait(4); drones(10, 'wall', { rate: 0.3 }); heavy(-30, 12); yield cleared(26);
      yield wait(1); H.warn('WARNING — ELITE UNIT APPROACHING', 2.5); sfx.warning(); yield wait(2.8);
      E.spawn('elite', { from: V(0, 60, -400) }); H.big('ELITE  //  RAVEN', 'boss'); H.objective('Defeat the elite mech RAVEN');
      H.prompt('RAVEN dodges rifle fire — use <b>missiles</b> and <b>blade</b>, PERFECT DODGE its lunge', 7);
      for (let k = 0; k < 6 && E.count('elite') > 0; k++) { yield until(() => E.count('elite') === 0, 15); if (E.count('elite') > 0) drones(4, 'random', { rate: 0.2 }); }
      yield until(() => E.count('elite') === 0, 30);
      yield cleared(12);
    }
    if (start <= 2) {
      this.checkpoint = 2; W.setSection('fleet'); H.setSector('SECTOR 03 // ORBITAL FLEET LINE'); H.big('BATTLE FLEET', 'kill', 2); setMusic(2); resumeMusic();
      H.objective('Punch through the fleet screen'); yield wait(3);
      drones(12, 'random', { rate: 0.3 }); fighters(4); yield wait(6); drones(8, 'arc'); yield cleared(26);
      heavy(-35, 2); heavy(35, 14); drones(6, 'ring'); yield cleared(30);
      E.startShip(); H.warn('BATTLESHIP DEAD AHEAD', 2.5); sfx.warning();
      H.objective('Destroy the battleship core'); yield wait(2);
      H.prompt('Lock the <b>CORE</b> — or <b>SHIFT</b> + <b>F</b> to blade-dive it', 8);
      yield until(() => E.ship.state === 'off', 45);
      fighters(6); drones(8, 'wall', { rate: 0.3 }); yield cleared(24);
      H.big('FLEET ESCORTS', 'kill'); heavy(-30, 0); heavy(30, 12); drones(10, 'ring', { rate: 0.3 }); yield wait(5); fighters(4); yield cleared(30);
    }
    if (start <= 3) {
      this.checkpoint = 3; if (start === 3) W.setSection('fleet', true);
      W.setSection('tunnel'); G.player.bounds.r = 22; H.setSector('SECTOR 04 // MASS DRIVER'); H.objective('Ride the mass driver — fly through the gates');
      H.warn('ENTERING MASS DRIVER TUNNEL', 2.5); sfx.warning(); setMusic(2);
      yield until(() => W.tunnel.state === 'on', 20);
      G.player.bounds.r = 22; this.tunnel.run = true; this.tunnel.t = 1; H.big('MAX VELOCITY', 'perfect');
      H.prompt('Dodge the barriers · boost through the <b>gates</b>', 5);
      G.speedRamp = 1;
      yield wait(30);
      this.tunnel.run = false; G.speedRamp = 2; yield wait(2.5);
      W.tunnel.exit(); H.small('LIGHT AHEAD', 'ok');
      yield until(() => W.tunnel.group.position.z - W.tunnel.len > -60, 20);
      flash(1.2, 1, 1, 1); sfx.explosion(3, 0.6); shake(0.6); G.speedRamp = 0; G.baseSpeed = 140; this.tunnel.clear();
      G.player.bounds.r = 0; W.tunnel.off(); W.setSection('sky', true);
    }
    // ---------------- boss ----------------
    this.checkpoint = 4;
    if (start === 4) W.setSection('sky', true);
    H.setSector('FINAL // HELIOS INTERCEPT'); H.objective(''); G.cinematic = true;
    G.boss.start(); H.warn('WARNING  ·  WARNING  ·  WARNING', 5); sfx.bossWarning(); setMusic(0);
    yield wait(3.4); H.big('HELIOS', 'boss', 2.6); yield wait(3.8);
    H.prompt('Lock and destroy the <b>3 glowing weak points</b>', 6);
    yield until(() => G.boss.state === 'dead');
  }
}

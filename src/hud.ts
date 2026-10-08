import * as THREE from 'three';
import { G, toScreen, clamp } from './core';
import { mouse } from './input';

const $ = (id: string) => document.getElementById(id)!;
const scr = { x: 0, y: 0, z: 0, on: false };

export class HUD {
  root = $('hud'); hpB = $('hpB'); hpV = $('hpV'); hpP = $('hpP'); enB = $('enB'); spdV = $('spdV'); msl = $('mslState'); mslB = $('mslB'); lockN = $('lockN');
  bossP = $('bossP'); bossHp = $('bossHp'); bossGhost = $('bossGhost'); score = $('score'); combo = $('combo'); comboN = $('comboN'); feed = $('feed');
  ret = $('reticle'); ring = $('lockRing'); bigE = $('big'); smallE = $('small'); warnE = $('warn'); promptE = $('prompt'); vign = $('vign'); tag = $('tag');
  obj = $('objective'); sector = $('sector'); markers: HTMLDivElement[] = []; warnT = 0; promptT = 0; vignA = 0; lastHp = -1; lastBoss = -1; bigT: any = 0;
  constructor() {
    const box = $('locks');
    for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'lockM'; d.innerHTML = '<span>LOCK</span>'; box.appendChild(d); this.markers.push(d); }
  }
  show(on: boolean) { this.root.classList.toggle('on', on); }
  big(text: string, cls = '', dur = 1.4) {
    if (!text) { this.bigE.className = ''; return; }
    this.bigE.textContent = text; this.bigE.className = ''; void this.bigE.offsetWidth; this.bigE.className = 'show ' + cls;
    this.bigE.style.animationDuration = dur + 's';
  }
  small(text: string, cls = '') {
    const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; this.smallE.appendChild(d);
    while (this.smallE.children.length > 3) this.smallE.firstChild!.remove();
    setTimeout(() => d.remove(), 1400);
  }
  killFeed(text: string) { const d = document.createElement('div'); d.textContent = text; this.feed.prepend(d); while (this.feed.children.length > 6) this.feed.lastChild!.remove(); setTimeout(() => d.remove(), 2200); }
  warn(text: string, dur = 2) { this.warnE.textContent = text; this.warnE.style.display = 'flex'; this.warnT = dur; }
  prompt(html: string, dur = 4) { if (!html) { this.promptE.style.display = 'none'; this.promptT = 0; return; } this.promptE.innerHTML = html; this.promptE.style.display = 'block'; this.promptT = dur; }
  objective(t: string) { this.obj.textContent = t; }
  setSector(t: string) { this.sector.textContent = t; }
  damage(_from?: THREE.Vector3) { this.vignA = 1; }
  boss(frac: number, visible: boolean) {
    this.bossP.style.display = visible ? 'block' : 'none';
    if (visible && Math.abs(frac - this.lastBoss) > 0.0005) { this.lastBoss = frac; this.bossHp.style.transform = `scaleX(${clamp(frac, 0, 1)})`; this.bossGhost.style.transform = `scaleX(${clamp(frac, 0, 1)})`; }
  }
  bossKill() { this.boss(0, true); }
  clear() { this.warnE.style.display = 'none'; this.promptE.style.display = 'none'; this.bigE.className = ''; this.smallE.innerHTML = ''; this.feed.innerHTML = ''; this.bossP.style.display = 'none'; this.lastBoss = -1; }
  update(dt: number) {
    const p = G.player;
    this.root.classList.toggle('cine', !!G.cinematic);
    const hp = Math.max(0, Math.round(p.hp));
    if (hp !== this.lastHp) { this.lastHp = hp; this.hpV.textContent = String(hp); this.hpB.style.transform = `scaleX(${p.hp / p.maxHp})`; this.hpP.classList.toggle('low', p.hp < 30); }
    this.enB.style.transform = `scaleX(${p.energy / 100})`; this.enB.classList.toggle('lock', p.boostLock);
    this.spdV.textContent = String(Math.round(G.speed * 7.2 + (p.boosting ? Math.random() * 20 : 0)));
    if (p.missileReady) { this.msl.textContent = p.locking ? 'LOCKING' : 'READY'; this.msl.className = 'ready'; this.mslB.style.transform = 'scaleX(1)'; }
    else { this.msl.textContent = 'RELOAD'; this.msl.className = 'rl'; this.mslB.style.transform = `scaleX(${1 - p.reloadT / p.reloadMax})`; }
    this.lockN.textContent = `${p.locks.length}/${p.maxLocks}`;
    this.tag.style.display = p.bonusT > 0 ? 'block' : 'none';
    this.ret.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`; this.ret.classList.toggle('hot', !!p.aimTarget);
    const showRing = p.locking && !G.cinematic;
    this.ring.style.display = showRing ? 'block' : 'none';
    if (showRing) { const r = p.lockRadius; this.ring.style.left = mouse.x - r + 'px'; this.ring.style.top = mouse.y - r + 'px'; this.ring.style.width = this.ring.style.height = r * 2 + 'px'; }
    // lock markers
    const counts = new Map<any, number>();
    let mi = 0;
    for (const l of p.locks) {
      const n = (counts.get(l.t) || 0) + 1; counts.set(l.t, n); if (n > 1) continue;
      const m = this.markers[mi++]; if (!m) break;
      toScreen(l.t.pos, scr); if (!scr.on) { m.style.display = 'none'; continue; }
      m.style.display = 'block'; m.style.transform = `translate(${scr.x}px, ${scr.y}px) rotate(${(G.time * 90) % 90}deg)`;
      if (l.age < 0.05 && !m.classList.contains('fresh')) { m.classList.add('fresh'); setTimeout(() => m.classList.remove('fresh'), 260); }
      (m.firstChild as HTMLElement).textContent = 'LOCKED';
    }
    for (const [t, n] of counts) { const idx = [...counts.keys()].indexOf(t); const m = this.markers[idx]; if (m && n > 1) (m.firstChild as HTMLElement).textContent = `LOCKED x${n}`; }
    for (; mi < this.markers.length; mi++) this.markers[mi].style.display = 'none';
    if (this.warnT > 0) { this.warnT -= dt; if (this.warnT <= 0) this.warnE.style.display = 'none'; }
    if (this.promptT > 0) { this.promptT -= dt; if (this.promptT <= 0) this.promptE.style.display = 'none'; }
    this.vignA = Math.max(0, p.hp < 30 && p.alive ? 0.35 + 0.25 * Math.sin(G.time * 6) : 0, this.vignA - dt * 1.8);
    this.vign.style.opacity = String(this.vignA);
    this.score.textContent = String(G.stats.score).padStart(7, '0');
    this.combo.style.opacity = G.combo > 1 ? '1' : '0'; this.comboN.textContent = 'x' + G.combo;
  }
}

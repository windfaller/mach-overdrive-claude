import * as THREE from 'three';
import { G, toScreen, clamp } from './core';
import { mouse } from './input';
import { t, tt, onI18n } from './i18n';

const $ = (id: string) => document.getElementById(id)!;
const scr = { x: 0, y: 0, z: 0, on: false };
type P = Record<string, string | number>;

export class HUD {
  root = $('hud'); hpB = $('hpB'); hpV = $('hpV'); hpP = $('hpP'); enB = $('enB'); enP = $('enP'); spdV = $('spdV'); msl = $('mslState'); mslB = $('mslB'); lockN = $('lockN');
  bossP = $('bossP'); bossHp = $('bossHp'); bossGhost = $('bossGhost'); score = $('score'); combo = $('combo'); comboN = $('comboN'); feed = $('feed');
  ret = $('reticle'); ring = $('lockRing'); bigE = $('big'); smallE = $('small'); warnE = $('warn'); promptE = $('prompt'); vign = $('vign'); tag = $('tag');
  obj = $('objective'); sector = $('sector'); ohE = $('overheat'); markers: HTMLDivElement[] = []; wpM: HTMLDivElement[] = []; warnT = 0; promptT = 0; vignA = 0; lastHp = -1; lastBoss = -1;
  cur = { prompt: ['', {}] as [string, P], obj: '', sector: '', warn: '' }; lastLocks = 0; pulseT = 0;
  constructor() {
    const box = $('locks');
    for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'lockM'; d.innerHTML = '<span></span>'; box.appendChild(d); this.markers.push(d); }
    for (let i = 0; i < 3; i++) { const d = document.createElement('div'); d.className = 'wpM'; d.innerHTML = '<i></i><span></span>'; box.appendChild(d); this.wpM.push(d); }
    onI18n(() => this.relabel());
  }
  relabel() {
    if (this.promptT > 0 && this.cur.prompt[0]) this.promptE.innerHTML = t(this.cur.prompt[0], this.cur.prompt[1]);
    this.obj.textContent = tt(this.cur.obj || 'standby'); this.sector.textContent = tt(this.cur.sector || 'sec1');
    if (this.warnT > 0) this.warnE.textContent = tt(this.cur.warn);
  }
  show(on: boolean) { this.root.classList.toggle('on', on); }
  big(key: string, cls = '', dur = 1.4, p: P = {}) {
    if (!key) { this.bigE.className = ''; return; }
    this.bigE.textContent = tt(key, p); this.bigE.className = ''; void this.bigE.offsetWidth; this.bigE.className = 'show ' + cls;
    this.bigE.style.animationDuration = dur + 's';
  }
  small(key: string, cls = '', p: P = {}) {
    const d = document.createElement('div'); d.textContent = tt(key, p); if (cls) d.className = cls; this.smallE.appendChild(d);
    while (this.smallE.children.length > 3) this.smallE.firstChild!.remove();
    setTimeout(() => d.remove(), 1400);
  }
  killFeed(text: string) { const d = document.createElement('div'); d.textContent = text; this.feed.prepend(d); while (this.feed.children.length > 6) this.feed.lastChild!.remove(); setTimeout(() => d.remove(), 2200); }
  warn(key: string, dur = 2) { this.cur.warn = key; this.warnE.textContent = tt(key); this.warnE.style.display = 'flex'; this.warnT = dur; }
  prompt(key: string, dur = 4, p: P = {}) {
    if (!key) { this.promptE.style.display = 'none'; this.promptT = 0; this.cur.prompt = ['', {}]; return; }
    this.cur.prompt = [key, p]; this.promptE.innerHTML = t(key, p); this.promptE.style.display = 'block'; this.promptT = dur;
  }
  objective(key: string) { this.cur.obj = key; this.obj.textContent = key ? tt(key) : ''; }
  setSector(key: string) { this.cur.sector = key; this.sector.textContent = tt(key); }
  damage(_from?: THREE.Vector3) { this.vignA = 1; }
  boss(frac: number, visible: boolean) {
    this.bossP.style.display = visible ? 'block' : 'none';
    if (visible && Math.abs(frac - this.lastBoss) > 0.0005) { this.lastBoss = frac; this.bossHp.style.transform = `scaleX(${clamp(frac, 0, 1)})`; this.bossGhost.style.transform = `scaleX(${clamp(frac, 0, 1)})`; }
  }
  bossKill() { this.boss(0, true); }
  clear() { this.warnE.style.display = 'none'; this.promptE.style.display = 'none'; this.bigE.className = ''; this.smallE.innerHTML = ''; this.feed.innerHTML = ''; this.bossP.style.display = 'none'; this.lastBoss = -1; this.warnT = this.promptT = 0; }
  lockPulse(n: number, max: number) {
    this.ring.classList.remove('pulse'); void this.ring.offsetWidth; this.ring.classList.add('pulse');
    this.ring.classList.toggle('full', n >= max);
  }
  update(dt: number) {
    const p = G.player;
    this.root.classList.toggle('cine', !!G.cinematic);
    const hp = Math.max(0, Math.round(p.hp));
    if (hp !== this.lastHp) { this.lastHp = hp; this.hpV.textContent = String(hp); this.hpB.style.transform = `scaleX(${p.hp / p.maxHp})`; this.hpP.classList.toggle('low', p.hp < 30); }
    this.enB.style.transform = `scaleX(${p.energy / 100})`; this.enB.classList.toggle('lock', p.boostLock);
    this.enP.classList.toggle('oh', p.boostLock); this.enP.classList.toggle('lowE', !p.boostLock && p.energy < 25);
    this.ohE.style.display = p.boostLock ? 'block' : 'none';
    this.spdV.textContent = String(Math.round(G.speed * 7.2 + (p.boosting ? Math.random() * 20 : 0)));
    if (p.missileReady) { this.msl.textContent = tt(p.locking ? 'locking' : 'ready'); this.msl.className = 'ready'; this.mslB.style.transform = 'scaleX(1)'; }
    else { this.msl.textContent = tt('reload'); this.msl.className = 'rl'; this.mslB.style.transform = `scaleX(${1 - p.reloadT / p.reloadMax})`; }
    this.lockN.textContent = `${p.locks.length}/${p.maxLocks}`;
    this.lockN.classList.toggle('full', p.locks.length >= p.maxLocks);
    this.tag.style.display = p.bonusT > 0 ? 'block' : 'none';
    this.ret.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`; this.ret.classList.toggle('hot', !!p.aimTarget); this.ret.classList.toggle('lockmode', p.locking);
    const showRing = p.locking && !G.cinematic;
    this.ring.style.display = showRing ? 'block' : 'none';
    if (showRing) { const r = p.lockRadius; this.ring.style.left = mouse.x - r + 'px'; this.ring.style.top = mouse.y - r + 'px'; this.ring.style.width = this.ring.style.height = r * 2 + 'px'; }
    else this.ring.classList.remove('full');
    if (p.locks.length > this.lastLocks) this.lockPulse(p.locks.length, p.maxLocks);
    this.lastLocks = p.locks.length;
    // lock markers: one per target, labelled with stack count
    const counts = new Map<any, { n: number; age: number }>();
    for (const l of p.locks) { const c = counts.get(l.t); if (c) { c.n++; c.age = Math.min(c.age, l.age); } else counts.set(l.t, { n: 1, age: l.age }); }
    let mi = 0;
    const full = p.locks.length >= p.maxLocks;
    for (const [tg, c] of counts) {
      const m = this.markers[mi++]; if (!m) break;
      toScreen(tg.pos, scr); if (!scr.on) { m.style.display = 'none'; continue; }
      const sc = 1 + Math.max(0, 0.25 - c.age) * 6;
      m.style.display = 'block'; m.style.transform = `translate(${scr.x}px, ${scr.y}px) rotate(${45 - Math.min(1, c.age * 5) * 45}deg) scale(${sc})`;
      m.classList.toggle('full', full);
      (m.firstChild as HTMLElement).textContent = c.n > 1 ? tt('lockedN', { n: c.n }) : tt('locked');
    }
    for (; mi < this.markers.length; mi++) this.markers[mi].style.display = 'none';
    // boss weak-point markers
    const b = G.boss; const showWp = b.state === 'p1' && !G.cinematic;
    for (let i = 0; i < this.wpM.length; i++) {
      const w = b.weak[i], m = this.wpM[i];
      if (!showWp || !w || !w.alive) { m.style.display = 'none'; continue; }
      toScreen(w.pos, scr); if (!scr.on) { m.style.display = 'none'; continue; }
      m.style.display = 'block'; m.style.transform = `translate(${scr.x}px, ${scr.y}px)`;
      (m.firstChild as HTMLElement).style.transform = `scaleX(${clamp(w.hp / w.maxHp, 0, 1)})`;
      (m.lastChild as HTMLElement).textContent = tt(w.label);
    }
    if (this.warnT > 0) { this.warnT -= dt; if (this.warnT <= 0) this.warnE.style.display = 'none'; }
    if (this.promptT > 0) { this.promptT -= dt; if (this.promptT <= 0) this.promptE.style.display = 'none'; }
    this.vignA = Math.max(0, p.hp < 30 && p.alive ? 0.35 + 0.25 * Math.sin(G.time * 6) : 0, this.vignA - dt * 1.8);
    this.vign.style.opacity = String(this.vignA);
    this.score.textContent = String(G.stats.score).padStart(7, '0');
    this.combo.style.opacity = G.combo > 1 ? '1' : '0'; this.comboN.textContent = 'x' + G.combo;
  }
}

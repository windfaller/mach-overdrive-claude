// Radio comms and chapter cards. Lines queue and play one at a time with a typed-in subtitle and a procedural
// portrait; how long a line stays up follows its reading length (CJK by character, Latin by word), clamped so
// fast combat never stalls on text. Driven by the game clock, so pause freezes it and slow-mo stretches it a bit.
import { G, clamp } from './core';
import { lang, tt, onI18n } from './i18n';
import { sfx } from './audio';

type Who = 'halcyon' | 'kestrel' | 'raven' | 'helios';
const CAST: Record<Who, { name: string; color: string; hostile?: boolean }> = {
  halcyon: { name: 'HALCYON', color: '#7fe8ff' },
  kestrel: { name: 'KESTREL', color: '#9fffd8' },
  raven: { name: 'RAVEN', color: '#ff5aa8', hostile: true },
  helios: { name: 'HELIOS', color: '#ff7a3a', hostile: true },
};
/** line id -> speaker; the text lives in i18n as r_<id> */
export const LINES: Record<string, Who> = {
  c0a: 'halcyon', c0b: 'kestrel', c0c: 'halcyon', c0d: 'halcyon',
  c1a: 'halcyon', c1b: 'halcyon', c1c: 'halcyon', c1d: 'raven', c1e: 'raven', c1f: 'raven',
  c2a: 'halcyon', c2b: 'halcyon', c2c: 'kestrel', c2d: 'halcyon',
  c3a: 'halcyon', c3b: 'halcyon',
  c4a: 'helios', c4b: 'halcyon', c4c: 'helios', c4d: 'halcyon', c4e: 'helios', c4f: 'kestrel',
};

// small procedural portraits: helmet + visor for pilots/operator, a sensor eye for HELIOS
function portrait(w: Who) {
  const c = CAST[w].color;
  if (w === 'helios') return `<svg viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" fill="#120604" stroke="${c}" stroke-width="1.5"/><g stroke="${c}" fill="none" stroke-width="1.2" opacity=".6"><path d="M2 14h44M2 34h44M14 2v44M34 2v44"/></g><circle cx="24" cy="24" r="10" fill="none" stroke="${c}" stroke-width="2"/><circle class="eye" cx="24" cy="24" r="4.5" fill="${c}"/></svg>`;
  const visor = w === 'raven' ? `<path d="M15 23 L24 27 L33 23 L33 26 L24 31 L15 26Z" fill="${c}"/><path d="M12 14 L8 4 L17 12 M36 14 L40 4 L31 12" stroke="${c}" stroke-width="2" fill="none"/>`
    : w === 'halcyon' ? `<rect x="14" y="22" width="20" height="4" rx="2" fill="${c}"/><path d="M34 18 C40 18 40 30 34 30" stroke="${c}" stroke-width="1.5" fill="none"/><path d="M34 30 L30 36" stroke="${c}" stroke-width="1.5"/>`
    : `<path d="M14 22 L34 22 L32 28 L16 28Z" fill="${c}"/><path d="M24 8 L24 16" stroke="${c}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" fill="#050c14" stroke="${c}" stroke-width="1.5"/><path d="M10 44 C10 34 14 30 24 30 C34 30 38 34 38 44Z" fill="#1a2632"/><path d="M12 26 C12 12 18 9 24 9 C30 9 36 12 36 26 C36 32 31 34 24 34 C17 34 12 32 12 26Z" fill="#22303e" stroke="${c}" stroke-width="1"/>${visor}</svg>`;
}

const readSecs = (s: string) => {
  const cjk = (s.match(/[぀-ヿ㐀-鿿＀-￯]/g) || []).length;
  const words = s.replace(/[぀-ヿ㐀-鿿＀-￯]/g, ' ').split(/\s+/).filter(Boolean).length;
  return clamp(1.2 + cjk * 0.11 + words * 0.3, 3, 8);
};

export class Comms {
  el: HTMLElement; face: HTMLElement; who: HTMLElement; txt: HTMLElement; card: HTMLElement;
  q: string[] = []; cur = ''; t = 0; dur = 0; shown = 0; cardT = 0;
  constructor() {
    const el = document.createElement('div'); el.id = 'comms'; el.className = 'hide-cine-no';
    el.innerHTML = '<div class="cface"></div><div class="cbody"><div class="cwho"></div><div class="ctxt"></div></div>';
    document.getElementById('hud')!.appendChild(el);
    this.el = el; this.face = el.querySelector('.cface')!; this.who = el.querySelector('.cwho')!; this.txt = el.querySelector('.ctxt')!;
    const card = document.createElement('div'); card.id = 'chCard';
    card.innerHTML = '<div class="lb t"></div><div class="lb b"></div><div class="cc"><div class="cn"></div><div class="ct"></div><div class="cl"></div></div>';
    document.body.appendChild(card); this.card = card;
    onI18n(() => { if (this.cur) this.txt.textContent = tt('r_' + this.cur); });
  }
  /** Queue a line. `now` cuts the current one (for interrupts like a boss roar). */
  say(id: string, now = false) {
    if (!LINES[id]) return;
    if (now) { this.q.length = 0; this.show(id); return; }
    if (!this.cur) this.show(id); else if (this.q.length < 4) this.q.push(id);
  }
  show(id: string) {
    const w = LINES[id], c = CAST[w];
    this.cur = id; this.t = 0; this.dur = readSecs(tt('r_' + id)); this.shown++;
    this.face.innerHTML = portrait(w); this.who.textContent = c.name; this.who.style.color = c.color;
    this.el.style.setProperty('--cc', c.color); this.el.classList.toggle('hostile', !!c.hostile);
    this.txt.textContent = ''; this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on');
    sfx.radio(!!c.hostile);
  }
  clear() { this.q.length = 0; this.cur = ''; this.el.classList.remove('on'); this.card.classList.remove('on'); this.cardT = 0; }
  /** Letterboxed chapter title: number, name and a one-line logline, about 3.2 s. */
  chapter(n: number, titleKey: string, logKey: string) {
    (this.card.querySelector('.cn') as HTMLElement).textContent = n >= 4 ? 'FINAL' : `CHAPTER 0${n + 1}`;
    (this.card.querySelector('.ct') as HTMLElement).textContent = tt(titleKey);
    (this.card.querySelector('.cl') as HTMLElement).textContent = tt(logKey);
    this.card.classList.remove('on'); void this.card.offsetWidth; this.card.classList.add('on'); this.cardT = 3.4;
  }
  update(dt: number) {
    if (this.cardT > 0) { this.cardT -= dt; if (this.cardT <= 0) this.card.classList.remove('on'); }
    if (!this.cur) return;
    this.t += dt;
    const full = tt('r_' + this.cur); const cps = lang === 'en' ? 55 : 22;
    const n = Math.min(full.length, Math.floor(this.t * cps)); if (this.txt.textContent!.length !== n) this.txt.textContent = full.slice(0, n);
    if (this.t > this.dur) { this.el.classList.remove('on'); this.cur = ''; const nx = this.q.shift(); if (nx) G.comms.show(nx); }
  }
}

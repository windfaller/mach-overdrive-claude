// Touch controls: a floating move stick on the left, drag-to-aim on the right and a thumb cluster of action
// buttons. Each finger owns the control it landed on until it lifts, so a thumb sliding off a button never
// starts aiming and a stick drag never fires. Buttons feed the same action map as keys and pad buttons
// (Touch* codes in src/input.ts), so gameplay code reads them through isDown / wasPressed unchanged.
import { G, clamp } from './core';
import { press, release, mouse, touchStick, markTouch } from './input';
import { device, setDevice, tt, onI18n } from './i18n';

type Owner =
  | { kind: 'stick'; ox: number; oy: number }
  | { kind: 'aim'; lx: number; ly: number }
  | { kind: 'btn'; code: string; el: HTMLElement };

const BTNS: { id: string; code: string; label: string }[] = [
  { id: 'fire', code: 'TouchFire', label: 't_fire' },
  { id: 'melee', code: 'TouchMelee', label: 't_blade' },
  { id: 'lock', code: 'TouchLock', label: 't_lock' },
  { id: 'beam', code: 'TouchBeam', label: 't_beam' },
  { id: 'dodge', code: 'TouchDodge', label: 't_dodge' },
  { id: 'boost', code: 'TouchBoost', label: 't_boost' },
];
/** stick travel in CSS px at scale 1; aim drag gain (cursor px per finger px) */
const STICK_R = 62, AIM_GAIN = 1.35;

const owners = new Map<number, Owner>();
let root: HTMLElement, base: HTMLElement, knob: HTMLElement, unit = 1;
const btnEl: Record<string, HTMLElement> = {};

function setStick(x: number, y: number) {
  touchStick.x = x; touchStick.y = y;
  knob.style.transform = `translate(${x * STICK_R * unit}px, ${y * STICK_R * unit}px)`;
}
function placeBase(x: number, y: number, active: boolean) {
  base.style.left = x + 'px'; base.style.top = y + 'px'; base.classList.toggle('on', active);
}
function restBase() { placeBase(innerWidth * 0.14 + 20, innerHeight - 120 * unit, false); setStick(0, 0); }

function releaseAll() {
  for (const [, o] of owners) if (o.kind === 'btn') { release(o.code); o.el.classList.remove('on'); }
  owners.clear(); touchStick.aiming = false; restBase();
}

function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') return;
  e.preventDefault(); markTouch(); setDevice('touch');
  if (!root.classList.contains('on')) return;
  const b = (e.target as HTMLElement).closest<HTMLElement>('.tb');
  let o: Owner;
  if (b) { o = { kind: 'btn', code: b.dataset.code!, el: b }; press(o.code); b.classList.add('on'); }
  else if (e.clientX < innerWidth * 0.42) {
    if ([...owners.values()].some(x => x.kind === 'stick')) return;
    o = { kind: 'stick', ox: e.clientX, oy: e.clientY }; placeBase(e.clientX, e.clientY, true); setStick(0, 0);
  } else {
    if ([...owners.values()].some(x => x.kind === 'aim')) return;
    o = { kind: 'aim', lx: e.clientX, ly: e.clientY }; touchStick.aiming = true;
  }
  owners.set(e.pointerId, o);
  try { root.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
}
function onMove(e: PointerEvent) {
  const o = owners.get(e.pointerId); if (!o) return;
  e.preventDefault(); markTouch();
  if (o.kind === 'stick') {
    const r = STICK_R * unit; let dx = (e.clientX - o.ox) / r, dy = (e.clientY - o.oy) / r;
    const m = Math.hypot(dx, dy);
    // drag the origin along when the thumb overshoots, so reversing direction responds at once
    if (m > 1.35) { o.ox += (dx / m) * (m - 1.35) * r; o.oy += (dy / m) * (m - 1.35) * r; placeBase(o.ox, o.oy, true); dx /= m / 1.35; dy /= m / 1.35; }
    const k = Math.min(1, Math.hypot(dx, dy)); const a = Math.atan2(dy, dx);
    // small radial deadzone, rescaled so the edge is still full deflection
    const v = k < 0.12 ? 0 : (k - 0.12) / 0.88;
    setStick(Math.cos(a) * v, Math.sin(a) * v);
  } else if (o.kind === 'aim') {
    mouse.x = clamp(mouse.x + (e.clientX - o.lx) * AIM_GAIN, 20, innerWidth - 20);
    mouse.y = clamp(mouse.y + (e.clientY - o.ly) * AIM_GAIN, 20, innerHeight - 20);
    o.lx = e.clientX; o.ly = e.clientY;
  } else {
    // a finger that slides off its button keeps holding it (no accidental release mid-charge)
  }
}
function onUp(e: PointerEvent) {
  const o = owners.get(e.pointerId); if (!o) return;
  owners.delete(e.pointerId); markTouch();
  if (o.kind === 'btn') { release(o.code); o.el.classList.remove('on'); }
  else if (o.kind === 'stick') restBase();
  else touchStick.aiming = false;
}

function relabel() {
  for (const b of BTNS) btnEl[b.id].querySelector('span')!.textContent = tt(b.label);
  document.body.classList.toggle('touchdev', device === 'touch');
}
function resize() {
  unit = clamp(Math.min(innerWidth, innerHeight) / 540, 0.72, 1.35);
  root.style.setProperty('--u', String(unit)); releaseAll();
}

export function initTouch(force: boolean) {
  root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = '<div class="tstick"><i></i></div><div class="tb tpause" data-code="TouchPause"><span>II</span></div>' +
    BTNS.map(b => `<div class="tb t-${b.id}" data-code="${b.code}"><em></em><span></span></div>`).join('');
  document.body.appendChild(root);
  base = root.querySelector('.tstick')!; knob = base.querySelector('i')!;
  for (const b of BTNS) btnEl[b.id] = root.querySelector('.t-' + b.id)!;
  root.addEventListener('pointerdown', onDown, { passive: false });
  root.addEventListener('pointermove', onMove, { passive: false });
  root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp);
  root.addEventListener('lostpointercapture', onUp);
  // first finger anywhere (title screen included) switches the prompts and HUD to touch
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { markTouch(); setDevice('touch'); } }, { capture: true });
  addEventListener('touchstart', () => { markTouch(); setDevice('touch'); }, { capture: true, passive: true });
  addEventListener('blur', releaseAll); addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  onI18n(relabel); resize(); relabel();
  // phones and tablets start in touch mode so the title shows touch controls before the first tap
  const coarseOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (force || coarseOnly) setDevice('touch');
}

/** Per-frame: show the overlay only in play, and mirror weapon state on the buttons. */
export function updateTouch() {
  const on = device === 'touch' && G.state === 'playing' && !G.paused;
  if (root.classList.contains('on') !== on) { root.classList.toggle('on', on); if (!on) releaseAll(); }
  if (!on) return;
  const p = G.player;
  root.classList.toggle('cine', !!G.cinematic);
  const beam = btnEl.beam;
  beam.style.setProperty('--p', String(p.charging ? p.charge / p.chargeMax : p.beamCd > 0 ? 1 - p.beamCd / p.beamCdMax : 1));
  beam.classList.toggle('cd', p.beamCd > 0 && !p.charging); beam.classList.toggle('full', p.charging && p.charge >= p.chargeMax);
  const lock = btnEl.lock;
  lock.style.setProperty('--p', String(p.missileReady ? p.locks.length / p.maxLocks : 1 - p.reloadT / p.reloadMax));
  lock.classList.toggle('cd', !p.missileReady);
  btnEl.dodge.classList.toggle('cd', p.dodgeCd > 0 || p.energy < 10);
  btnEl.boost.classList.toggle('cd', p.boostLock);
  btnEl.melee.classList.toggle('hot', G.boss && G.boss.state === 'fready');
}

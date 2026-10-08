import { G, clamp } from './core';
import { setDevice, device } from './i18n';

const down = new Set<string>();
const pressed = new Set<string>();
const released = new Set<string>();
export const mouse = { x: 0, y: 0, locked: false };
/** analog sticks after deadzone, plus aim-assist friction set by the player each frame */
export const pad = { connected: false, lx: 0, ly: 0, rx: 0, ry: 0, friction: 1 };
let lockLostCb: (() => void) | null = null;
export const onLockLost = (f: () => void) => { lockLostCb = f; };

function press(c: string) { if (!down.has(c)) pressed.add(c); down.add(c); }
function release(c: string) { if (down.has(c)) released.add(c); down.delete(c); }

export function initInput(_canvas: HTMLElement) {
  mouse.x = innerWidth / 2; mouse.y = innerHeight / 2;
  addEventListener('keydown', e => {
    if (['Space', 'ShiftLeft', 'ShiftRight', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!e.repeat) press(e.code); setDevice('kb');
  });
  addEventListener('keyup', e => release(e.code));
  addEventListener('blur', () => { for (const c of [...down]) release(c); });
  addEventListener('mousedown', e => { press('Mouse' + e.button); setDevice('kb'); });
  addEventListener('mouseup', e => release('Mouse' + e.button));
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (document.pointerLockElement) {
      mouse.x = clamp(mouse.x + e.movementX, 20, innerWidth - 20);
      mouse.y = clamp(mouse.y + e.movementY, 20, innerHeight - 20);
    } else { mouse.x = e.clientX; mouse.y = e.clientY; }
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 3) setDevice('kb');
  });
  document.addEventListener('pointerlockchange', () => {
    const was = mouse.locked; mouse.locked = !!document.pointerLockElement;
    if (was && !mouse.locked && lockLostCb) lockLostCb();
  });
}
export function requestLock(el: HTMLElement) {
  if (device === 'pad') return;
  try { const p: any = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* iframe may block */ }
}
const map: Record<string, string[]> = {
  fire: ['Mouse0', 'KeyJ', 'PadRT'],
  lock: ['Mouse2', 'KeyE', 'KeyK', 'PadLT'],
  boost: ['ShiftLeft', 'ShiftRight', 'PadLB', 'PadL3'],
  dodge: ['Space', 'PadA'],
  melee: ['KeyF', 'Mouse1', 'KeyL', 'PadX', 'PadRB'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  pause: ['KeyP', 'Escape', 'PadStart'],
  mUp: ['ArrowUp', 'KeyW', 'PadUp', 'PadLUp'], mDown: ['ArrowDown', 'KeyS', 'PadDown', 'PadLDown'],
  mLeft: ['ArrowLeft', 'PadLeft', 'PadLLeft'], mRight: ['ArrowRight', 'PadRight', 'PadLRight'],
  confirm: ['Enter', 'PadA', 'PadStart'], back: ['PadB'],
};
export const isDown = (a: string) => map[a].some(c => down.has(c));
export const wasPressed = (a: string) => map[a].some(c => pressed.has(c));
export const wasReleased = (a: string) => map[a].some(c => released.has(c)) && !isDown(a);
export const keyPressed = (c: string) => pressed.has(c);
export function endFrame() { pressed.clear(); released.clear(); }
export function aimNDC() { return { x: (mouse.x / G.width) * 2 - 1, y: -(mouse.y / G.height) * 2 + 1 }; }
export function simKey(code: string, on: boolean) { if (on) press(code); else release(code); }

/** Combined keyboard + left stick movement, each axis in [-1, 1]. */
export function moveAxis() {
  const kx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0), ky = (isDown('up') ? 1 : 0) - (isDown('down') ? 1 : 0);
  return { x: clamp(kx + pad.lx, -1, 1), y: clamp(ky - pad.ly, -1, 1) };
}

// ---------------- gamepad ----------------
const BTN = ['PadA', 'PadB', 'PadX', 'PadY', 'PadLB', 'PadRB', 'PadLT', 'PadRT', 'PadBack', 'PadStart', 'PadL3', 'PadR3', 'PadUp', 'PadDown', 'PadLeft', 'PadRight'];
const dz = (x: number, y: number, d = 0.18) => { const m = Math.hypot(x, y); if (m < d) return [0, 0]; const k = Math.min(1, (m - d) / (1 - d)) / m; return [x * k, y * k]; };
let padIndex = -1;
addEventListener('gamepadconnected', (e: any) => { padIndex = e.gamepad.index; });
export function pollPad(rdt: number, aimCursor: boolean) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  if (padIndex >= 0 && pads[padIndex]) gp = pads[padIndex]; else for (const p of pads) if (p && p.connected) { gp = p; padIndex = p.index; break; }
  pad.connected = !!gp;
  if (!gp) { pad.lx = pad.ly = pad.rx = pad.ry = 0; return; }
  let active = false;
  for (let i = 0; i < BTN.length && i < gp.buttons.length; i++) {
    const b = gp.buttons[i]; const on = b.pressed || b.value > (i === 6 || i === 7 ? 0.3 : 0.5);
    if (on) { press(BTN[i]); active = true; } else release(BTN[i]);
  }
  const [lx, ly] = dz(gp.axes[0] || 0, gp.axes[1] || 0), [rx, ry] = dz(gp.axes[2] || 0, gp.axes[3] || 0);
  pad.lx = lx; pad.ly = ly; pad.rx = rx; pad.ry = ry;
  if (lx || ly || rx || ry) active = true;
  // stick as menu d-pad
  for (const [c, on] of [['PadLUp', ly < -0.6], ['PadLDown', ly > 0.6], ['PadLLeft', lx < -0.6], ['PadLRight', lx > 0.6]] as [string, boolean][]) on ? press(c) : release(c);
  if (active) setDevice('pad');
  if (aimCursor && device === 'pad') {
    // virtual cursor: velocity curve with aim-assist friction
    const m = Math.hypot(rx, ry); const sp = 1500 * (G.height / 1080) * Math.pow(m, 1.7) * pad.friction;
    if (m > 0) { mouse.x = clamp(mouse.x + (rx / m) * sp * rdt, 20, G.width - 20); mouse.y = clamp(mouse.y + (ry / m) * sp * rdt, 20, G.height - 20); }
  }
}
export function rumble(strong: number, weak: number, ms: number) {
  if (device !== 'pad' || padIndex < 0) return;
  const gp: any = navigator.getGamepads?.()[padIndex]; const a = gp && gp.vibrationActuator;
  if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {});
}

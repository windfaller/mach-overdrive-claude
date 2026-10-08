import { G, clamp } from './core';

const down = new Set<string>();
const pressed = new Set<string>();
const released = new Set<string>();
export const mouse = { x: 0, y: 0, locked: false };

function press(c: string) { if (!down.has(c)) pressed.add(c); down.add(c); }
function release(c: string) { if (down.has(c)) released.add(c); down.delete(c); }

export function initInput(canvas: HTMLElement) {
  mouse.x = innerWidth / 2; mouse.y = innerHeight / 2;
  addEventListener('keydown', e => {
    if (['Space', 'ShiftLeft', 'ShiftRight', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!e.repeat) press(e.code);
  });
  addEventListener('keyup', e => release(e.code));
  addEventListener('blur', () => { for (const c of [...down]) release(c); });
  addEventListener('mousedown', e => press('Mouse' + e.button));
  addEventListener('mouseup', e => release('Mouse' + e.button));
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (document.pointerLockElement) {
      mouse.x = clamp(mouse.x + e.movementX, 20, innerWidth - 20);
      mouse.y = clamp(mouse.y + e.movementY, 20, innerHeight - 20);
    } else { mouse.x = e.clientX; mouse.y = e.clientY; }
  });
  document.addEventListener('pointerlockchange', () => { mouse.locked = !!document.pointerLockElement; });
}
export function requestLock(el: HTMLElement) {
  try { const p: any = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* iframe may block */ }
}
const map: Record<string, string[]> = {
  fire: ['Mouse0', 'KeyJ'],
  lock: ['Mouse2', 'KeyE', 'KeyK'],
  boost: ['ShiftLeft', 'ShiftRight'],
  dodge: ['Space'],
  melee: ['KeyF', 'Mouse1', 'KeyL'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
};
export const isDown = (a: string) => map[a].some(c => down.has(c));
export const wasPressed = (a: string) => map[a].some(c => pressed.has(c));
export const wasReleased = (a: string) => map[a].some(c => released.has(c)) && !isDown(a);
export const keyPressed = (c: string) => pressed.has(c);
export function endFrame() { pressed.clear(); released.clear(); }
export function aimNDC() { return { x: (mouse.x / G.width) * 2 - 1, y: -(mouse.y / G.height) * 2 + 1 }; }
export function simKey(code: string, on: boolean) { if (on) press(code); else release(code); }

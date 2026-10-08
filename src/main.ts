import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { G, damp, clamp, rand, flash, toScreen, hitstop } from './core';
import * as input from './input';
import { initAudio, setEngine, sfx, stopMusic, resumeMusic, setMusic, suspendAudio } from './audio';
import { fx } from './fx';
import { World } from './world';
import { Player } from './player';
import { Enemies } from './enemies';
import { Boss } from './boss';
import { HUD } from './hud';
import { Director } from './director';
import { applyDom, onI18n, setLang, LANGS, tt, t } from './i18n';
import { loadHeroAssets } from './assets';

const params = new URLSearchParams(location.search);
const TEST = params.has('test'), BOT = params.has('bot');
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const maxPR = Math.min(window.devicePixelRatio || 1, 1.5);
let pr = TEST ? 0.5 : Math.min(maxPR, 1.25);
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.info.autoReset = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.5, 6000);
camera.position.set(0, 4, 13);
G.camera = camera; G.scene = scene; G.width = innerWidth; G.height = innerHeight; G.input = input; G.vfx = 0.4;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---- post
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.4, 1.05);
composer.addPass(bloom);
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uFlash: { value: 0 }, uFlashC: { value: new THREE.Color(1, 1, 1) }, uAberr: { value: 0.002 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSpeed, uFlash, uAberr; uniform vec3 uFlashC; varying vec2 vUv;
  void main(){ vec2 c = vUv - 0.5; float d = length(c);
    float amt = uSpeed * 0.06 * smoothstep(0.12, 0.75, d);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 6; i++) { float t = float(i) / 5.0; col += texture2D(tDiffuse, vUv - c * amt * t).rgb; }
    col /= 6.0;
    float ab = (uAberr + uSpeed * 0.006) * d;
    col.r = mix(col.r, texture2D(tDiffuse, vUv + c * ab).r, 0.8);
    col.b = mix(col.b, texture2D(tDiffuse, vUv - c * ab).b, 0.8);
    col *= 1.0 - smoothstep(0.42, 0.95, d) * 0.6;
    col = mix(col, uFlashC * 4.0, clamp(uFlash, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0); }`,
});
composer.addPass(finalPass);
composer.addPass(new OutputPass());

// ---- game objects
fx.init(scene);
const world = new World(scene); G.world = world;
const player = new Player(scene); G.player = player;
const enemies = new Enemies(scene); G.enemies = enemies;
const boss = new Boss(scene); G.boss = boss;
const hud = new HUD(); G.hud = hud;
const director = new Director(scene); G.director = director;
G.targetList = [];
G.combo = 0; G.comboT = 0; G.threat = 1e9;
G.god = params.has('god') || params.has('showcase');
input.initInput(canvas);
(window as any).__G = G;
(window as any).__dbg = { composer, bloom, finalPass, renderer, scene };
loadHeroAssets({ player, enemies, boss }).catch(e => console.warn('hero assets', e));

function resize() {
  G.width = innerWidth; G.height = innerHeight; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
}
addEventListener('resize', resize); resize();

// ---- rumble on camera shake (gamepad only)
let rumbleT = 0;
G.onShake = (a: number) => { const now = performance.now(); if (now - rumbleT < 70) return; rumbleT = now; input.rumble(Math.min(1, a * 1.2), Math.min(1, a * 1.6), 60 + a * 220); };

// ---- scoring
let multiN = 0, multiT = 0, salvoN = 0, salvoT = 0;
G.addScore = (n: number, label?: string) => { G.stats.score += Math.round(n * (1 + Math.min(G.combo, 30) * 0.05)); if (label) hud.killFeed(`${tt(label)}  +${n}`); };
G.comboBreak = () => { G.combo = 0; };
G.onKill = (e: any, score: number, src: string) => {
  G.stats.kills++; G.combo++; G.comboT = 3.5; G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo);
  const name = ['drone', 'fighter', 'heavy', 'elite', 'shipcore'].includes(e.kind) ? 'k_' + e.kind : 'k_target';
  G.addScore(score, tt('k_down', { name: '@' + name }) + (src === 'melee' ? tt('k_bladeSfx') : src === 'missile' ? tt('k_mslSfx') : ''));
  multiN = multiT > 0 ? multiN + 1 : 1; multiT = 0.7;
  if (src === 'missile' || src === 'splash') {
    salvoN = salvoT > 0 ? salvoN + 1 : 1; salvoT = 0.9; sfx.chainKill(salvoN); if (salvoN <= 8) hitstop(0.02);
    if (salvoN >= 2) hud.small('m_chain', 'ok', { n: salvoN });
  } else if (multiN >= 3) hud.big(multiN >= 6 ? 'b_multiOD' : 'b_multi', 'kill', 1.2, { n: multiN });
  if (e.kind === 'elite') hud.big('b_ravenDown', 'kill', 1.8);
  if (src === 'melee') hud.small('m_bladeKill', 'ok');
};
G.onBossDead = () => { setTimeout(() => showWin(), 600); };

// ---- screens & menus
const $ = (id: string) => document.getElementById(id)!;
const screens: Record<string, HTMLElement> = { title: $('title'), over: $('over'), win: $('win'), pause: $('pause') };
let curScreen: string | null = 'title'; const menuSel: Record<string, number> = {}; let navUsed = false;
function showScreen(name: string | null) { curScreen = name; for (const k in screens) screens[k].classList.toggle('on', k === name); renderFocus(); }
for (const el of document.querySelectorAll('.langs')) for (const l of LANGS) {
  const b = document.createElement('div'); b.className = 'langBtn'; b.dataset.lang = l.id; b.textContent = l.label;
  b.onclick = () => { setLang(l.id); sfx.ui(); }; el.appendChild(b);
}
onI18n(applyDom); applyDom();
function menuItems(name: string) { return [...screens[name].querySelectorAll<HTMLElement>('.btn, .langBtn')].filter(e => e.offsetParent !== null); }
function renderFocus() {
  for (const k in screens) for (const b of screens[k].querySelectorAll('.focus')) b.classList.remove('focus');
  if (!curScreen || !navUsed) return; const it = menuItems(curScreen); if (!it.length) return;
  const i = ((menuSel[curScreen] ?? 0) % it.length + it.length) % it.length; menuSel[curScreen] = i; it[i].classList.add('focus');
}
function menuUpdate() {
  if (!curScreen) return; const it = menuItems(curScreen); if (!it.length) return;
  let d = 0; if (input.wasPressed('mUp') || input.wasPressed('mLeft')) d = -1; if (input.wasPressed('mDown') || input.wasPressed('mRight')) d = 1;
  if (d) { if (navUsed) menuSel[curScreen] = (menuSel[curScreen] ?? 0) + d; navUsed = true; sfx.ui(); renderFocus(); }
  if (input.wasPressed('confirm')) { const i = ((menuSel[curScreen] ?? 0) % it.length + it.length) % it.length; it[navUsed ? i : 0].click(); }
  if (curScreen === 'pause' && input.wasPressed('back')) setPause(false);
}
document.addEventListener('mousemove', () => { if (navUsed) { navUsed = false; renderFocus(); } });

function resetState() {
  fx.clear(); enemies.clear(); boss.reset(); player.reset(); director.tunnel.clear(); world.tunnel.off(); world.clearDynamic();
  G.state = 'playing'; G.paused = false; G.cinematic = false; G.camRig = null; G.slowTime = 0; G.slowScale = 1; G.hitstopTime = 0; G.speedOverride = 0; G.speedRamp = 0; G.baseSpeed = 140;
  G.combo = 0; player.bounds.r = 0;
}
function startMission(ch: number) {
  initAudio(); suspendAudio(false); input.requestLock(canvas);
  showScreen(null); hud.clear(); hud.show(true); resetState();
  if (ch === 0 || !G.stats.start) { G.stats = { kills: 0, maxCombo: 0, perfect: 0, nearMiss: 0, score: 0, start: performance.now() }; }
  world.setSection(Director.sectionOf(ch), true); if (ch === 3) world.setSection('fleet', true);
  player.startTrails(); resumeMusic();
  director.start(ch);
  flash(0.6, 0.6, 0.9, 1);
}
const SHOWCASES = ['missile', 'blade', 'raven', 'fleet', 'tunnel', 'boss', 'transform', 'finisher'];
function startShowcase(name: string) {
  initAudio(); suspendAudio(false); input.requestLock(canvas);
  showScreen(null); hud.clear(); hud.show(true); resetState();
  G.stats = { kills: 0, maxCombo: 0, perfect: 0, nearMiss: 0, score: 0, start: performance.now() };
  player.startTrails(); resumeMusic();
  director.showcaseStart(name);
}
function showWin() {
  G.state = 'victory'; hud.show(false); document.exitPointerLock?.();
  const s = G.stats; const secs = Math.round((performance.now() - s.start) / 1000);
  const rankScore = s.score / 1000 + s.perfect * 4 + s.maxCombo;
  $('rank').textContent = rankScore > 160 ? 'S' : rankScore > 110 ? 'A' : rankScore > 70 ? 'B' : 'C';
  $('stats').innerHTML = `${tt('s_score')} <b>${s.score.toLocaleString()}</b><br>${tt('s_kills')} <b>${s.kills}</b> &nbsp;·&nbsp; ${tt('s_chain')} <b>x${s.maxCombo}</b><br>${tt('s_perfect')} <b>${s.perfect}</b> &nbsp;·&nbsp; ${tt('s_near')} <b>${s.nearMiss}</b><br>${tt('s_time')} <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b>`;
  showScreen('win');
}
function showOver() { G.state = 'dead'; hud.show(false); document.exitPointerLock?.(); sfx.gameover(); stopMusic(1); showScreen('over'); }
function setPause(on: boolean) {
  if (G.state !== 'playing' || G.paused === on) return;
  G.paused = on; suspendAudio(on); showScreen(on ? 'pause' : null);
  if (on) { document.exitPointerLock?.(); menuSel.pause = 0; } else input.requestLock(canvas);
}
function toTitle() { G.paused = false; suspendAudio(false); G.state = 'title'; hud.show(false); resetState(); G.state = 'title'; stopMusic(0.5); world.setSection('city', true); player.startTrails(); showScreen('title'); }
$('startBtn').onclick = () => { sfx.ui(); const sc = params.get('showcase'); if (sc && SHOWCASES.includes(sc)) startShowcase(sc); else startMission(+(params.get('ch') || 0)); };
$('retryBtn').onclick = () => startMission(director.checkpoint);
$('restartBtn').onclick = () => startMission(0);
$('againBtn').onclick = () => startMission(0);
$('resumeBtn').onclick = () => setPause(false);
$('pRetryBtn').onclick = () => { G.paused = false; startMission(director.checkpoint); };
$('quitBtn').onclick = () => toTitle();
if (params.has('showcase')) {
  const box = $('showcase'); box.classList.add('on');
  for (const n of SHOWCASES) { const b = document.createElement('div'); b.className = 'btn alt'; b.textContent = n.toUpperCase(); b.onclick = () => { sfx.ui(); startShowcase(n); }; box.appendChild(b); }
}
input.onLockLost(() => { if (G.state === 'playing' && !G.paused) setPause(true); });
canvas.addEventListener('mousedown', () => { if (G.state === 'playing' && !document.pointerLockElement) input.requestLock(canvas); });
addEventListener('keydown', e => { if (e.code === 'KeyM') { G.muted = !G.muted; import('./audio').then(a => a.setMasterMute(G.muted)); } });

// title attract mode
world.setSection('city', true); player.startTrails(); G.state = 'title';

// ---- warm up shaders so the first explosion doesn't hitch
function warmup() {
  const hidden: THREE.Object3D[] = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  renderer.compile(scene, camera); composer.render(0.016);
  for (const o of hidden) o.visible = false;
}
warmup();

// ---- speed hierarchy: one intensity value drives FOV, lines, blur, aberration, thrusters, audio
function vfxTarget() {
  if (boss.state === 'finisher' && boss.t < 6.4) return 1.1;
  if (director.tunnel.run || G.speedRamp === 1) return 0.8 + 0.2 * clamp((G.baseSpeed - 140) / 190, 0, 1);
  if (player.meleeState === 'lunge') return 0.9;
  if (player.boosting) return 0.75;
  if (G.state === 'playing' && (enemies.list.length > 0 || boss.state === 'p1' || boss.state === 'p2')) return 0.55;
  return 0.4;
}

// ---- camera
const camLook = new THREE.Vector3(0, 0, -40), tv = new THREE.Vector3(), tl = new THREE.Vector3();
let fov = 68, roll = 0, speedMul = 1;
function updateCamera(dt: number, rdt: number) {
  const P = player.pos, V = G.vfx;
  if (G.camRig) {
    if (G.camRig.cut) { G.camRig.cut = false; camera.position.copy(G.camRig.pos); camLook.copy(G.camRig.look); fov = G.camRig.fov; }
    const k = 5;
    camera.position.x = damp(camera.position.x, G.camRig.pos.x, k, rdt); camera.position.y = damp(camera.position.y, G.camRig.pos.y, k, rdt); camera.position.z = damp(camera.position.z, G.camRig.pos.z, k, rdt);
    camLook.x = damp(camLook.x, G.camRig.look.x, k + 1, rdt); camLook.y = damp(camLook.y, G.camRig.look.y, k + 1, rdt); camLook.z = damp(camLook.z, G.camRig.look.z, k + 1, rdt);
    fov = damp(fov, G.camRig.fov, 3, rdt); roll = damp(roll, G.camRig.roll || 0, 3, rdt);
  } else {
    const ndc = input.aimNDC();
    const title = G.state === 'title';
    tv.set(P.x * 0.72 + (title ? Math.sin(G.time * 0.3) * 8 : 0), P.y * 0.65 + 2.7 + (title ? 1 : 0), P.z + 10 + (V - 0.4) * 3.2 + (title ? -2 : 0));
    camera.position.x = damp(camera.position.x, tv.x, 6, rdt); camera.position.y = damp(camera.position.y, tv.y, 6, rdt); camera.position.z = damp(camera.position.z, tv.z, player.meleeState === 'lunge' ? 14 : 8, rdt);
    tl.set(P.x * 0.85 + ndc.x * 9, P.y * 0.8 + 1.4 + ndc.y * 5, P.z - 40);
    camLook.x = damp(camLook.x, tl.x, 8, rdt); camLook.y = damp(camLook.y, tl.y, 8, rdt); camLook.z = damp(camLook.z, tl.z, 10, rdt);
    fov = damp(fov, 62 + V * 16, 4, rdt);
    roll = damp(roll, -player.vel.x * 0.003, 3, rdt);
  }
  camera.lookAt(camLook); camera.rotateZ(roll);
  const tr = G.trauma * G.trauma; const t = G.time * 40;
  if (tr > 0.0001) {
    camera.position.x += (Math.sin(t * 1.1) + Math.sin(t * 2.3)) * 0.35 * tr; camera.position.y += (Math.sin(t * 1.7) + Math.cos(t * 2.9)) * 0.35 * tr;
    camera.rotateZ(Math.sin(t * 1.3) * 0.02 * tr);
  }
  const jit = Math.max(0, V - 0.6) * 0.16; if (jit > 0 && !G.camRig) { camera.position.x += rand(-jit, jit); camera.position.y += rand(-jit, jit); }
  G.trauma = Math.max(0, G.trauma - rdt * 1.6);
  camera.fov = fov; camera.updateProjectionMatrix();
}

// ---- loop
let last = performance.now(), fpsAcc = 0, fpsN = 0, frameAvg = 16, adaptT = 0, spike = 0;
const fpsEl = $('fps'); if (params.has('fps')) fpsEl.style.display = 'block';
function frame(now: number) {
  requestAnimationFrame(frame);
  const raw = now - last; let rdt = clamp(raw / 1000, 0, 0.05); last = now;
  if (!G.paused) spike = Math.max(spike, raw);
  if (TEST) rdt = 1 / 20;
  input.pollPad(rdt, G.state === 'playing' && !G.paused);
  if (G.state === 'playing' && input.wasPressed('pause')) { setPause(!G.paused); input.endFrame(); return; }
  if (G.paused || G.state !== 'playing') menuUpdate();
  if (BOT && G.state === 'playing') bot(rdt);
  if (G.paused) { input.endFrame(); return; }
  G.realDt = rdt; renderer.info.reset();
  // time scale
  let ts = 1;
  if (G.hitstopTime > 0) { G.hitstopTime -= rdt; ts = 0.03; }
  else if (G.slowTime > 0) { G.slowTime -= rdt; ts = G.slowScale; if (G.slowTime <= 0) G.slowScale = 1; }
  G.timeScale = damp(G.timeScale, ts, ts < G.timeScale ? 60 : 8, rdt);
  const dt = rdt * G.timeScale; G.dt = dt; G.time += dt;
  if (G.state === 'playing') G.missionTime += dt;
  // speed
  if (G.speedRamp === 1) G.baseSpeed = Math.min(330, G.baseSpeed + 5.5 * dt);
  const boostMul = player.boosting ? 2.15 : 1;
  speedMul = damp(speedMul, G.speedOverride || boostMul, player.boosting ? 4 : 2, rdt);
  G.speed = G.baseSpeed * speedMul;
  const vt = vfxTarget(); G.vfx = damp(G.vfx, vt, vt > G.vfx ? 7 : 2.2, rdt);
  G.lineIntensity = clamp((G.vfx - 0.3) * 1.25, 0.08, 1.05);
  // targets
  const tl2 = G.targetList as any[]; tl2.length = 0;
  for (const b of boss.targets) if (b.alive && b.kind !== 'hull') tl2.push(b);
  for (const e of enemies.list) if (e.alive) tl2.push(e);
  for (const b of boss.targets) if (b.alive && b.kind === 'hull') tl2.push(b);
  G.threat = 1e9;
  if (G.state === 'playing' || G.state === 'dead') {
    director.update(dt);
    enemies.update(dt);
    boss.update(dt);
  }
  if (G.state === 'title') { player.pos.x = Math.sin(G.time * 0.5) * 8; player.pos.y = Math.sin(G.time * 0.37) * 4 + 2; }
  player.update(dt);
  if (G.state === 'playing' && !player.alive && player.deadT > 2.4) showOver();
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (multiT > 0) multiT -= dt;
  if (salvoT > 0) { salvoT -= dt; if (salvoT <= 0) { if (salvoN >= 4) hud.big('b_salvo', 'kill', 1.3, { n: salvoN }); salvoN = 0; } }
  world.update(dt);
  fx.update(dt, rdt);
  updateCamera(dt, rdt);
  setEngine(G.speed / 180, player.boosting, G.state === 'playing' && player.alive, G.vfx);
  // post
  G.flash = Math.max(0, G.flash - rdt * 2.2);
  finalPass.uniforms.uFlash.value = G.flash; finalPass.uniforms.uFlashC.value.copy(G.flashColor);
  finalPass.uniforms.uSpeed.value = damp(finalPass.uniforms.uSpeed.value, Math.max(0, G.vfx - 0.45) * 1.5, 6, rdt);
  finalPass.uniforms.uAberr.value = 0.0012 + Math.max(0, G.vfx - 0.5) * 0.006;
  bloom.strength = 0.6 + G.flash * 0.6;
  if (G.state === 'playing' || G.state === 'title') hud.update(rdt);
  if (G.direct || (TEST && !params.has('post'))) renderer.render(scene, camera); else composer.render(rdt);
  input.endFrame();
  // perf
  frameAvg = frameAvg * 0.95 + (rdt * 1000) * 0.05; fpsAcc += rdt; fpsN++; adaptT += rdt;
  if (fpsAcc > 0.5) {
    const inf = renderer.info.render;
    fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps  max ${spike.toFixed(0)}ms  pr ${pr.toFixed(2)}  p ${fx.add.n}/${fx.smoke.n}  rib ${fx.ribbons.filter(r => r.alive).length}  e ${enemies.list.length}  dc ${inf.calls}  tri ${(inf.triangles / 1000).toFixed(0)}k  vfx ${G.vfx.toFixed(2)}`;
    fpsAcc = 0; fpsN = 0; spike = 0;
  }
  if (adaptT > 1.5 && !TEST) {
    adaptT = 0;
    if (frameAvg > 20 && pr > 0.6) { pr = Math.max(0.6, pr - 0.15); resize(); }
    else if (frameAvg < 14 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.1); resize(); }
  }
}
requestAnimationFrame(frame);

// ---- autopilot (debug / attract): ?bot
let botT = 0, botLock = 0;
const bs = { x: 0, y: 0, z: 0, on: false };
function bot(dt: number) {
  botT += dt; const p = player;
  let best: any = null, bd = 1e9;
  for (const t of G.targetList) { if (!t.alive || t.kind === 'hull' || t.pos.z > p.pos.z - 5) continue; const d = t.pos.distanceTo(p.pos) - (t.kind === 'weak' || t.kind === 'core' ? 400 : 0); if (d < bd) { bd = d; best = t; } }
  if (best) { toScreen(best.pos, bs); if (bs.on) { input.mouse.x = bs.x; input.mouse.y = bs.y; } }
  else { input.mouse.x = G.width / 2; input.mouse.y = G.height / 2; }
  input.simKey('Mouse0', !!best);
  if (botLock > 0) { botLock -= dt; if (botLock <= 0) input.simKey('KeyE', false); }
  else if (p.missileReady && best && botT % 2 < dt) { input.simKey('KeyE', true); botLock = 0.7; }
  input.simKey('Space', G.threat < 0.3);
  if (best && best.pos.distanceTo(p.pos) < 90 && Math.random() < 0.05) { input.simKey('KeyF', true); } else input.simKey('KeyF', false);
  if (G.boss.state === 'fready') input.simKey('KeyF', true);
  const tx = best ? clamp(best.pos.x * 0.5, -20, 20) : 0;
  input.simKey('KeyD', p.pos.x < tx - 3); input.simKey('KeyA', p.pos.x > tx + 3);
  input.simKey('ShiftLeft', G.director.tunnel.run || (botT % 9) < 1.2);
}
const scAuto = params.get('showcase');
if (scAuto && SHOWCASES.includes(scAuto) && params.has('auto')) setTimeout(() => startShowcase(scAuto), 300);
else if (params.has('auto')) setTimeout(() => startMission(+(params.get('ch') || 0)), 300);
(window as any).__game = { startMission, startShowcase, setPause, toTitle, t };
export { setMusic };

// Headless smoke test. Build first (npm run build), then: npm run smoke [-- chapters|showcase|ui|bench|all]
// Uses the bot autopilot (?bot) in god mode with a fixed timestep (?test) and checks each chapter
// advances, the boss reaches victory, restart works, and nothing goes NaN / leaks / errors.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default || pw;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + path.join(root, 'dist', 'index.html');
const which = process.argv[2] || 'all';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
const log = (...a) => console.log(...a);
const fail = (name, msg) => { failures++; log(`  ✗ ${name}: ${msg}`); };

async function open(query, init) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  if (init) await page.addInitScript(init);
  await page.goto(url + '?' + query);
  return { page, errs };
}
const probe = page => page.evaluate(() => {
  const G = window.__G; const bad = v => !Number.isFinite(v);
  const vecs = [G.player.pos, G.camera.position, G.boss.root.position];
  return {
    st: G.state, mt: +G.missionTime.toFixed(1), ck: G.director.checkpoint, boss: G.boss.state, paused: !!G.paused,
    nan: vecs.some(v => bad(v.x) || bad(v.y) || bad(v.z)) || bad(G.vfx) || bad(G.speed),
    en: G.enemies.list.length,
    deadLocked: G.player.locks.some(l => !l.t.alive), deadTargets: G.targetList.filter(t => !t.alive).length,
  };
});
const fxCounts = page => page.evaluate(() => { const t = document.getElementById('fps').textContent; return t; });

async function chapter(ch, until, maxSec) {
  const name = `chapter ${ch}`; const { page, errs } = await open(`auto&ch=${ch}&god&test&bot&fps`);
  const t0 = Date.now(); let last = null, ok = false;
  while ((Date.now() - t0) / 1000 < maxSec) {
    await page.waitForTimeout(2000);
    const s = await probe(page); last = s;
    if (s.nan) { fail(name, 'NaN transform ' + JSON.stringify(s)); break; }
    if (s.deadLocked) { fail(name, 'dead target still locked'); break; }
    if (s.en > 80) { fail(name, 'enemy count runaway ' + s.en); break; }
    if (until(s)) { ok = true; break; }
  }
  const f = await fxCounts(page);
  const m = /p (\d+)\/(\d+)/.exec(f); if (m && (+m[1] > 7000 || +m[2] > 2600)) fail(name, 'particle overflow ' + f);
  if (!ok) fail(name, 'did not reach goal in time, last ' + JSON.stringify(last));
  if (errs.length) fail(name, 'console errors: ' + [...new Set(errs)].slice(0, 5).join(' | '));
  if (ok && !errs.length) log(`  ✓ ${name} (${last.mt}s game time)`);
  return { page, ok, errs };
}

if (which === 'all' || which === 'chapters') {
  log('chapters');
  const only = process.env.CH ? process.env.CH.split(',').map(Number) : null;
  for (const [ch, goal, max] of [[0, s => s.ck >= 1, 150], [1, s => s.ck >= 2, 170], [2, s => s.ck >= 3, 200], [3, s => s.boss !== 'off', 240]]) {
    if (only && !only.includes(ch)) continue;
    const r = await chapter(ch, goal, max); await r.page.close();
  }
  // boss to victory, then restart
  if (!only || only.includes(4)) {
  const r = await chapter(4, s => s.st === 'victory', 260);
  if (r.ok) {
    await r.page.click('#againBtn'); await r.page.waitForTimeout(1500);
    const s = await probe(r.page);
    if (s.st !== 'playing' || s.ck !== 0) fail('restart', JSON.stringify(s)); else log('  ✓ restart after victory');
  }
  await r.page.close();
  }
  // death -> game over -> retry checkpoint
  const d = await open('auto&ch=1&test');
  await d.page.waitForFunction(() => window.__G && window.__G.state === 'playing' && window.__G.missionTime > 0.5, null, { timeout: 30000 });
  await d.page.evaluate(() => { const p = window.__G.player; p.invuln = 0; p.damage(999); });
  await d.page.waitForFunction(() => window.__G.state === 'dead', null, { timeout: 30000 }).catch(() => {});
  let s = await probe(d.page);
  if (s.st !== 'dead') fail('game over', JSON.stringify(s));
  else { await d.page.click('#retryBtn'); await d.page.waitForTimeout(1200); s = await probe(d.page); if (s.st !== 'playing' || s.ck !== 1) fail('retry', JSON.stringify(s)); else log('  ✓ game over -> retry checkpoint'); }
  if (d.errs.length) fail('game over', d.errs.join(' | '));
  await d.page.close();
}

if (which === 'all' || which === 'showcase') {
  log('showcase routes');
  for (const sc of ['missile', 'blade', 'raven', 'fleet', 'tunnel', 'boss', 'transform', 'finisher']) {
    const { page, errs } = await open(`showcase=${sc}&auto&test&bot`);
    await page.waitForTimeout(sc === 'finisher' || sc === 'transform' ? 16000 : 7000);
    const s = await probe(page);
    const okState = sc === 'finisher' ? (s.st === 'victory' || s.boss === 'finisher' || s.boss === 'dead') : s.st === 'playing';
    if (s.nan || !okState || errs.length) fail(`showcase ${sc}`, JSON.stringify(s) + ' ' + errs.slice(0, 3).join(' | ')); else log(`  ✓ showcase=${sc} (boss ${s.boss})`);
    await page.close();
  }
}

if (which === 'all' || which === 'ui') {
  log('ui');
  // fake Xbox pad: A on title starts, Start pauses / resumes
  const padInit = () => {
    const btn = () => ({ pressed: false, touched: false, value: 0 });
    const pad = { id: 'Fake Xbox', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), vibrationActuator: null };
    window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null];
    window.__press = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; };
  };
  const { page, errs } = await open('test', padInit);
  await page.waitForTimeout(800);
  const tap = async i => { await page.evaluate(i => window.__press(i, true), i); await page.waitForTimeout(250); await page.evaluate(i => window.__press(i, false), i); await page.waitForTimeout(250); };
  await tap(0); await page.waitForTimeout(800);
  let s = await probe(page); if (s.st !== 'playing') fail('pad start', JSON.stringify(s)); else log('  ✓ gamepad A starts from title');
  await page.evaluate(() => { window.__pad.axes[0] = 1; }); await page.waitForTimeout(800);
  const x = await page.evaluate(() => window.__G.player.pos.x); await page.evaluate(() => { window.__pad.axes[0] = 0; });
  if (!(x > 3)) fail('pad stick', 'player x ' + x); else log('  ✓ left stick moves the mech');
  await tap(9); s = await probe(page); if (!s.paused) fail('pad pause', JSON.stringify(s)); else log('  ✓ Start pauses');
  await tap(9); s = await probe(page); if (s.paused) fail('pad resume', JSON.stringify(s)); else log('  ✓ Start resumes');
  if (errs.length) fail('ui', errs.join(' | '));
  await page.close();
  for (const [lang, word] of [['zh', '出擊'], ['ja', '出撃'], ['en', 'LAUNCH']]) {
    const o = await open('lang=' + lang); await o.page.waitForTimeout(500);
    const txt = await o.page.textContent('#startBtn'); if (txt.trim() !== word) fail('lang ' + lang, txt); else log(`  ✓ lang=${lang} -> ${word}`);
    await o.page.close();
  }
}
if (which === 'all' || which === 'bench') {
  log('benchmark');
  // ?showcase=benchmark runs all eight scenes; benchquick = 2 s each. Under SwiftShader it must never PASS.
  const { page, errs } = await open('showcase=benchmark&auto&test&benchquick');
  await page.waitForFunction(() => !!window.__benchmark, null, { timeout: 420000 }).catch(() => {});
  const rep = await page.evaluate(() => window.__benchmark);
  if (!rep) fail('benchmark', 'did not finish');
  else {
    const missing = rep.scenes.filter(s => !s.reached).map(s => s.scene);
    const keys = ['fps', 'avgMs', 'p95Ms', 'p99Ms', 'worstMs', 'spikes33', 'minPixelRatio', 'maxPixelRatio', 'peakDrawCalls', 'peakTrisK', 'peakParticles', 'peakRibbons'];
    const pk = n => rep.scenes.find(s => s.scene === n)?.peakSpeedIntensity ?? 0;
    if (rep.scenes.length !== 8) fail('benchmark', 'scene count ' + rep.scenes.length);
    else if (missing.length) fail('benchmark', 'scenes not reached: ' + missing.join(', '));
    else if (rep.scenes.some(s => keys.some(k => typeof s[k] !== 'number'))) fail('benchmark', 'missing metrics');
    else log(`  ✓ benchmark ran ${rep.scenes.length} scenes`);
    if (rep.gpu.software && rep.pass) fail('benchmark', 'software renderer reported PASS');
    else log(`  ✓ renderer "${rep.gpu.renderer.slice(0, 40)}" software=${rep.gpu.software} → ${rep.status}`);
    if (!(pk('tunnel') >= 0.95 && pk('finisher') >= 1.05 && pk('tunnel') > pk('missile'))) fail('speed tiers', JSON.stringify(rep.scenes.map(s => [s.scene, s.peakSpeedIntensity])));
    else log(`  ✓ speed tiers: tunnel ${pk('tunnel')} · finisher ${pk('finisher')} · missile ${pk('missile')}`);
    if (!(await page.isVisible('#benchPanel'))) fail('benchmark', 'result panel not shown'); else log('  ✓ result panel with Copy / Download JSON');
  }
  if (errs.length) fail('benchmark', 'console errors: ' + [...new Set(errs)].slice(0, 5).join(' | '));
  await page.close();
}
await browser.close();
log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);

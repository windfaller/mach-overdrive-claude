// Headless smoke test. Build first (npm run build), then: npm run smoke [-- chapters|showcase|ui|bench|all]
// CH=0,1,9 limits the chapters group (9 = game over -> retry). Playwright is a pinned devDependency;
// install its browser once with: npx playwright install chromium
// Uses the bot autopilot (?bot) in god mode with a fixed timestep (?test) and checks each chapter
// advances, the boss reaches victory, restart works, and nothing goes NaN / leaks / errors.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + path.join(root, 'dist', 'index.html');
const which = process.argv[2] || 'all';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
const log = (...a) => console.log(...a);
const fail = (name, msg) => { failures++; log(`  ✗ ${name}: ${msg}`); };

async function open(query, init, base = url) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  if (init) await page.addInitScript(init);
  await page.goto(base + '?' + query);
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
  for (const [ch, goal, max] of [[0, s => s.ck >= 1, 300], [1, s => s.ck >= 2, 420], [2, s => s.ck >= 3, 360], [3, s => s.boss !== 'off', 400]]) {
    if (only && !only.includes(ch)) continue;
    const r = await chapter(ch, goal, max); await r.page.close();
  }
  // boss to victory, then restart
  if (!only || only.includes(4)) {
  const r = await chapter(4, s => s.st === 'victory', 480);
  if (r.ok) {
    await r.page.click('#againBtn'); await r.page.waitForTimeout(1500);
    const s = await probe(r.page);
    if (s.st !== 'playing' || s.ck !== 0) fail('restart', JSON.stringify(s)); else log('  ✓ restart after victory');
  }
  await r.page.close();
  }
  // death -> game over -> retry checkpoint
  if (!only || only.includes(9)) {
  const d = await open('auto&ch=1&test');
  await d.page.waitForFunction(() => window.__G && window.__G.state === 'playing' && window.__G.missionTime > 0.5, null, { timeout: 30000 });
  await d.page.evaluate(() => { const p = window.__G.player; p.invuln = 0; p.damage(999); });
  await d.page.waitForFunction(() => window.__G.state === 'dead', null, { timeout: 90000 }).catch(() => {});
  let s = await probe(d.page);
  if (s.st !== 'dead') fail('game over', JSON.stringify(s));
  else { await d.page.click('#retryBtn'); await d.page.waitForTimeout(1200); s = await probe(d.page); if (s.st !== 'playing' || s.ck !== 1) fail('retry', JSON.stringify(s)); else log('  ✓ game over -> retry checkpoint'); }
  if (d.errs.length) fail('game over', d.errs.join(' | '));
  await d.page.close();
  }
}

if (which === 'all' || which === 'showcase') {
  log('showcase routes');
  for (const sc of ['missile', 'blade', 'beam', 'raven', 'fleet', 'tunnel', 'boss', 'transform', 'finisher']) {
    const { page, errs } = await open(`showcase=${sc}&auto&test&bot`);
    if (sc === 'finisher') await page.waitForFunction(() => ['finisher', 'dead'].includes(window.__G.boss.state) || window.__G.state === 'victory', null, { timeout: 90000, polling: 500 }).catch(() => {});
    else await page.waitForTimeout(sc === 'transform' ? 16000 : 7000);
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
  await page.waitForFunction(() => window.__G && window.__G.state === 'title', null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
  // hold the button until the game reacts (slow CI frames can be longer than any fixed tap), then release
  const tap = async (i, done) => { await page.evaluate(i => window.__press(i, true), i); if (done) await until(done); else await page.waitForTimeout(450); await page.evaluate(i => window.__press(i, false), i); await page.waitForTimeout(450); };
  const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 }).catch(() => {});
  await tap(0, () => window.__G.state === 'playing');
  let s = await probe(page); if (s.st !== 'playing') fail('pad start', JSON.stringify(s)); else log('  ✓ gamepad A starts from title');
  await page.evaluate(() => { window.__pad.axes[0] = 1; }); await page.waitForTimeout(800);
  const x = await page.evaluate(() => window.__G.player.pos.x); await page.evaluate(() => { window.__pad.axes[0] = 0; });
  if (!(x > 3)) fail('pad stick', 'player x ' + x); else log('  ✓ left stick moves the mech');
  await tap(9, () => window.__G.paused); s = await probe(page); if (!s.paused) fail('pad pause', JSON.stringify(s)); else log('  ✓ Start pauses');
  await tap(9, () => !window.__G.paused); s = await probe(page); if (s.paused) fail('pad resume', JSON.stringify(s)); else log('  ✓ Start resumes');
  if (errs.length) fail('ui', errs.join(' | '));
  await page.close();
  // heavy beam: hold Q to full charge, release, and it must fire and pierce
  {
    const { page, errs } = await open('auto&ch=1&god&test');
    await page.waitForFunction(() => window.__G && window.__G.state === 'playing' && window.__G.enemies.list.some(e => e.alive), null, { timeout: 60000, polling: 200 }).catch(() => {});
    await page.keyboard.down('q');
    await page.waitForFunction(() => window.__G.player.charge >= window.__G.player.chargeMax, null, { timeout: 30000, polling: 50 }).catch(() => {});
    const full = await page.evaluate(() => ({ c: window.__G.player.charge, arc: document.getElementById('chgArc').getAttribute('opacity') }));
    await page.keyboard.up('q'); await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ shots: window.__G.player.beamShots, cd: window.__G.player.beamCd, charging: window.__G.player.charging }));
    if (!(full.c >= 2) || full.arc !== '1') fail('beam charge', JSON.stringify(full));
    else if (r.shots !== 1 || r.charging || !(r.cd > 0)) fail('beam fire', JSON.stringify(r));
    else log('  ✓ heavy beam charges to full and fires on release');
    // a tap shorter than the 0.3 s minimum must not fire
    await page.evaluate(() => { window.__G.player.beamCd = 0; window.__G.input.simKey('KeyQ', true); });
    await page.waitForTimeout(60); await page.evaluate(() => window.__G.input.simKey('KeyQ', false)); await page.waitForTimeout(400);
    const tap = await page.evaluate(() => window.__G.player.beamShots);
    if (tap !== 1) fail('beam tap', 'short tap fired, shots ' + tap); else log('  ✓ a short tap does not fire the beam');
    if (errs.length) fail('beam', errs.slice(0, 3).join(' | '));
    await page.close();
  }
  // touch: tap LAUNCH, then drive the stick, fire button, drag-aim and pause with real multi-touch events
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await page.goto(url + '?test&god');
    await page.waitForFunction(() => window.__G && window.__G.state === 'title', null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 }).catch(() => {});
    await page.tap('#startBtn');
    await until(() => window.__G.state === 'playing' && document.getElementById('touch').classList.contains('on'));
    const st = await page.evaluate(() => ({ st: window.__G.state, on: document.getElementById('touch').classList.contains('on'), dev: document.body.classList.contains('touchdev') }));
    if (st.st !== 'playing' || !st.on || !st.dev) fail('touch start', JSON.stringify(st)); else log('  ✓ tapping LAUNCH starts with the touch overlay');
    await page.waitForTimeout(1500);
    // left thumb: stick to the right; right thumb: hold FIRE at the same time
    const fireBox = await page.locator('#touch .t-fire').boundingBox(); const fx = fireBox.x + fireBox.width / 2, fy = fireBox.y + fireBox.height / 2;
    const x0 = await page.evaluate(() => window.__G.player.pos.x);
    await touch('touchStart', [[150, 300, 1]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[150 + k * 15, 300, 1]]);
    await touch('touchStart', [[240, 300, 1], [fx, fy, 2]]);
    await until(() => window.__G.player.pos.x > 3, 8000);
    const mv = await page.evaluate(() => ({ x: window.__G.player.pos.x, sx: window.__G.input.touchStick.x, firing: window.__G.input.isDown('fire') }));
    await touch('touchEnd', []);
    await page.waitForTimeout(300);
    const rel = await page.evaluate(() => ({ sx: window.__G.input.touchStick.x, firing: window.__G.input.isDown('fire') }));
    if (!(mv.x > x0 + 3) || !(mv.sx > 0.5) || !mv.firing) fail('touch stick+fire', JSON.stringify({ x0, mv }));
    else if (rel.sx !== 0 || rel.firing) fail('touch release', JSON.stringify(rel));
    else log('  ✓ stick moves the mech while FIRE is held (two fingers), both release cleanly');
    // drag-aim on the right half moves the reticle
    const m0 = await page.evaluate(() => ({ x: window.__G.input.mouse.x, y: window.__G.input.mouse.y }));
    await touch('touchStart', [[560, 120, 3]]); for (let k = 1; k <= 5; k++) await touch('touchMove', [[560 - k * 12, 120 + k * 6, 3]]); await touch('touchEnd', []);
    const m1 = await page.evaluate(() => ({ x: window.__G.input.mouse.x, y: window.__G.input.mouse.y }));
    if (!(m1.x < m0.x - 30)) fail('touch aim', JSON.stringify({ m0, m1 })); else log('  ✓ drag on the right moves the aim');
    // pause button
    const pb = await page.locator('#touch .tpause').boundingBox();
    await touch('touchStart', [[pb.x + pb.width / 2, pb.y + pb.height / 2, 4]]); await until(() => window.__G.paused, 5000); await touch('touchEnd', []);
    const ps = await page.evaluate(() => ({ p: window.__G.paused, on: document.getElementById('touch').classList.contains('on') }));
    if (!ps.p || ps.on) fail('touch pause', JSON.stringify(ps)); else log('  ✓ pause button pauses and hides the overlay');
    await page.tap('#resumeBtn'); await until(() => !window.__G.paused, 5000);
    if (await page.evaluate(() => window.__G.paused)) fail('touch resume', 'still paused'); else log('  ✓ resume by tapping the menu');
    if (errs.length) fail('touch', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // shield absorbs before armor; death is a short tumble before the blast; comms + chapter card play
  {
    const { page, errs } = await open('auto&ch=0&test');
    await page.waitForFunction(() => window.__G && window.__G.state === 'playing' && window.__G.missionTime > 3, null, { timeout: 60000, polling: 200 }).catch(() => {});
    const r = await page.evaluate(() => { const p = window.__G.player; const out = {};
      p.invuln = 0; p.damage(30); out.a = [p.shield, p.hp];
      p.invuln = 0; p.damage(50); out.b = [p.shield, p.hp];
      out.comms = window.__G.comms.shown; return out; });
    if (r.a[0] !== 30 || r.a[1] !== 100 || r.b[0] !== 0 || r.b[1] !== 80) fail('shield', JSON.stringify(r)); else log('  ✓ shield absorbs first, then armor');
    if (!(r.comms >= 1)) fail('comms', 'no radio line by 3 s: ' + r.comms); else log('  ✓ radio comms play in chapter 1');
    await page.evaluate(() => { const p = window.__G.player; p.invuln = 0; p.damage(999); });
    const dying = await page.evaluate(() => ({ dying: window.__G.player.dying > 0, alive: window.__G.player.alive, vis: window.__G.player.root.visible }));
    await page.waitForFunction(() => window.__G.state === 'dead', null, { timeout: 90000 }).catch(() => {});
    const st = await page.evaluate(() => window.__G.state);
    if (!dying.dying || !dying.alive || !dying.vis || st !== 'dead') fail('death tumble', JSON.stringify({ dying, st })); else log('  ✓ death tumbles, then explodes into game over');
    if (errs.length) fail('systems', errs.slice(0, 3).join(' | '));
    await page.close();
  }
  // HELIOS: the deflector shields the other two weak points; killing a system node changes the boss
  {
    const { page, errs } = await open('auto&ch=4&god&test');
    await page.waitForFunction(() => window.__G && window.__G.boss.state === 'p1', null, { timeout: 120000, polling: 250 }).catch(() => {});
    const r = await page.evaluate(() => { const B = window.__G.boss, [port, star, spire] = B.weak, out = {};
      out.state = B.state; out.shielded = [B.shielded(port), B.shielded(star), B.shielded(spire)];
      const h0 = port.hp; port.hit(100, port.pos.clone(), 'laser'); out.halfDmg = h0 - port.hp;
      star.hit(star.hp + 1, star.pos.clone(), 'missile'); out.after = [B.shielded(port), B.shielded(spire)];
      spire.hit(spire.hp + 1, spire.pos.clone(), 'missile'); B.atk = ''; B.idleT = 0; B.atkIdx = 1; B.update(0.016); out.atk = B.atk; out.state2 = B.state;
      return out; });
    if (r.state !== 'p1') fail('helios systems', 'boss never reached p1 ' + JSON.stringify(r));
    else if (JSON.stringify(r.shielded) !== '[true,false,true]' || r.halfDmg !== 50) fail('helios deflector', JSON.stringify(r));
    else if (r.after.some(Boolean)) fail('helios deflector down', JSON.stringify(r));
    else if (r.atk === 'sweep') fail('helios beam node', 'sweep still scheduled with the emitter destroyed');
    else if (r.state2 !== 'p1' || !r.atk) fail('helios after nodes', JSON.stringify(r));
    else log(`  ✓ HELIOS deflector shields the arrays (50% dmg); destroying nodes drops the shield and the sweep beam (next: ${r.atk})`);
    if (errs.length) fail('helios', errs.slice(0, 3).join(' | '));
    await page.close();
  }
  for (const [lang, word] of [['zh', '出擊'], ['ja', '出撃'], ['en', 'LAUNCH']]) {
    const o = await open('lang=' + lang); await o.page.waitForTimeout(500);
    const txt = await o.page.textContent('#startBtn'); if (txt.trim() !== word) fail('lang ' + lang, txt); else log(`  ✓ lang=${lang} -> ${word}`);
    await o.page.close();
  }
}
if (which === 'all' || which === 'hero') {
  // Authored GLTF fixtures (tests/fixtures) through the real loader: mapping, anchors, and that readable motion survives.
  log('hero assets');
  const http = await import('node:http'), fs = await import('node:fs');
  const srv = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = u.startsWith('/fixtures/') ? path.join(root, 'tests', u) : path.join(root, 'dist', u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'model/gltf+json' }); res.end(b); });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}/`;
  const hero = 'hero=player:fixtures/hero-mech.gltf,raven:fixtures/hero-mech.gltf,helios:fixtures/hero-helios.gltf';
  const loaded = (page, n) => page.waitForFunction(n => window.__heroLoaded >= n, n, { timeout: 30000 }).then(() => true, () => false);
  const heroInit = () => { window.__heroLoaded = 0; const ci = console.info; console.info = (...a) => { if (String(a[0]).startsWith('[hero]') && String(a[0]).includes('loaded')) window.__heroLoaded++; ci(...a); }; };
  // helper in page: authored node by name under a rig (authored nodes are the ones without userData.proc)
  const node = `(r, n) => { let f = null; r.traverse(o => { if (!f && o.name === n && !o.userData.proc && o.isMesh) f = o; }); return f; }`;
  // player: mapping + banking / recoil / blade motion on the authored meshes
  {
    const { page, errs } = await open(hero + '&ch=0&auto&god&test', heroInit, base);
    if (!(await loaded(page, 3))) fail('hero', 'fixtures did not load: ' + errs.join(' | '));
    else {
      await page.waitForTimeout(3000);
      const r = await page.evaluate(async node => {
        const find = eval(node), G = window.__G, m = G.player.mech, THREE_Q = m.root.quaternion.constructor;
        const torso = find(m.root, 'torso'), arm = find(m.root, 'leftArm'), rArm = find(m.root, 'rightArm');
        const out = { mapped: !!torso && torso.parent === m.torso && arm.parent === m.armL && rArm.parent === m.armR,
          procHidden: m.torso.children.filter(c => c.userData.proc && !c.visible).length };
        const q = o => o.getWorldQuaternion(new THREE_Q());
        const wait = s => new Promise(r => setTimeout(r, s * 1000));
        // banking: strafe hard and compare the authored torso's world rotation
        const q0 = q(torso); G.input.simKey('KeyD', true); await wait(0.6); const q1 = q(torso); G.input.simKey('KeyD', false);
        out.bank = +q0.angleTo(q1).toFixed(3);
        // blade: anticipation -> swing on the authored left arm
        const a0 = q(arm); const t = G.targetList.find(t => t.alive) || null; G.player.findMeleeTarget = () => t; G.player.startMelee();
        let amax = 0; for (let i = 0; i < 8; i++) { await wait(0.04); amax = Math.max(amax, a0.angleTo(q(arm))); }
        out.blade = +amax.toFixed(3);
        return out;
      }, node);
      if (!r.mapped || !r.procHidden) fail('hero player', 'mapping ' + JSON.stringify(r));
      else if (r.bank < 0.05) fail('hero player', 'authored torso does not bank ' + JSON.stringify(r));
      else if (r.blade < 0.3) fail('hero player', 'authored arm has no blade swing ' + JSON.stringify(r));
      else log(`  ✓ player GLTF mapped, banks (${r.bank} rad) and swings the blade (${r.blade} rad)`);
    }
    if (errs.length) fail('hero player', errs.slice(0, 3).join(' | '));
    await page.close();
  }
  // Raven: entrance, evade ghosts and death on the authored rig
  {
    const { page, errs } = await open(hero + '&showcase=raven&auto&test', heroInit, base);
    if (await loaded(page, 3)) {
      await page.waitForFunction(() => window.__G.enemies.list.some(e => e.kind === 'elite' && e.alive && e.d.state && e.d.state !== 'enter'), null, { timeout: 60000 }).catch(() => {});
      const r = await page.evaluate(async node => {
        const find = eval(node), G = window.__G, e = G.enemies.list.find(e => e.kind === 'elite' && e.alive); if (!e) return { err: 'no raven' };
        const torso = find(e.mech.root, 'torso'); const out = { mapped: !!torso && torso.parent === e.mech.torso };
        e.d.dodgeCd = 0; G.enemies.eliteEvade(e); await new Promise(r => setTimeout(r, 150)); out.ghosts = G.enemies.rGhosts.filter(g => g.g.visible).length;
        e.hit(1e6, e.pos.clone(), 'missile'); await new Promise(r => setTimeout(r, 300)); out.dead = !e.alive; return out;
      }, node);
      if (r.err || !r.mapped || !r.ghosts || !r.dead) fail('hero raven', JSON.stringify(r)); else log(`  ✓ Raven GLTF mapped, evade ghosts ${r.ghosts}, death plays`);
    } else fail('hero raven', 'not loaded');
    if (errs.length) fail('hero raven', errs.slice(0, 3).join(' | '));
    await page.close();
  }
  // HELIOS: modules follow the transformation, weak-point anchor comes from the file, phase 2 and finisher complete
  {
    const { page, errs } = await open(hero + '&showcase=transform&auto&test', heroInit, base);
    if (await loaded(page, 3)) {
      await page.waitForFunction(() => window.__G.boss.state === 'transform', null, { timeout: 60000 }).catch(() => {});
      const p0 = await page.evaluate(node => { const n = eval(node)(window.__G.boss.root, 'wingL'); const w = window.__G.boss.weak[0].anchor; return n ? [n.getWorldPosition(w.position.clone()).toArray(), n.parent && n.parent.name, w.position.toArray()] : null; }, node);
      await page.waitForFunction(() => window.__G.boss.state === 'p2', null, { timeout: 90000 }).catch(() => {});
      const p1 = await page.evaluate(node => { const G = window.__G, n = eval(node)(G.boss.root, 'wingL'); return { st: G.boss.state, pos: n && n.getWorldPosition(n.position.clone()).toArray() }; }, node);
      const moved = p0 && p1.pos ? Math.hypot(p0[0][0] - p1.pos[0], p0[0][1] - p1.pos[1], p0[0][2] - p1.pos[2]) : 0;
      if (!p0) fail('hero helios', 'wingL not mapped');
      else if (p1.st !== 'p2') fail('hero helios', 'did not reach phase 2: ' + p1.st);
      else if (moved < 3) fail('hero helios', 'authored module did not move with the transform ' + moved.toFixed(1));
      else log(`  ✓ HELIOS GLTF follows the transform (wing module moved ${moved.toFixed(0)} m) into phase 2`);
    } else fail('hero helios', 'not loaded');
    if (errs.length) fail('hero helios', errs.slice(0, 3).join(' | '));
    await page.close();
    const f = await open(hero + '&showcase=finisher&auto&test&bot', heroInit, base);
    await f.page.waitForFunction(() => window.__G.boss.state === 'dead' || window.__G.state === 'victory', null, { timeout: 150000, polling: 1000 }).then(() => log('  ✓ HELIOS GLTF finisher completes'), () => fail('hero finisher', 'did not complete'));
    if (f.errs.length) fail('hero finisher', f.errs.slice(0, 3).join(' | '));
    await f.page.close();
  }
  srv.close();
}

if (which === 'all' || which === 'bench') {
  log('benchmark');
  const { page, errs } = await open('showcase=benchmark&auto&benchsec=1');
  const r = await page.waitForFunction(() => window.__bench, null, { timeout: 600000, polling: 2000 }).then(h => h.jsonValue()).catch(() => null);
  if (!r) fail('benchmark', 'did not finish');
  else {
    const panel = await page.textContent('#bench');
    if (r.scenes.length !== 8 || !(r.overall.frames > 0)) fail('benchmark', 'incomplete ' + JSON.stringify(r.overall));
    else if (r.software && r.verdict === 'PASS') fail('benchmark', 'software renderer marked PASS');
    else if (!panel.includes(r.verdict) || !panel.includes('COPY JSON')) fail('benchmark', 'panel missing');
    else log(`  ✓ benchmark ran 8 scenes, verdict ${r.verdict}${r.software ? ' (software renderer detected)' : ''}`);
  }
  if (errs.length) fail('benchmark', errs.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close();
log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);

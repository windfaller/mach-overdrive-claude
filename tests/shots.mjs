// Dev helper: screenshots with full post chain. node tests/shots.mjs <outdir> [combat,raven,blade]
import { chromium } from 'playwright';
const out = process.argv[2]; const url = 'file://' + process.cwd() + '/dist/index.html';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
async function shot(q, waits, name) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(url + '?' + q);
  for (let i = 0; i < waits.length; i++) { await p.waitForTimeout(waits[i]); await p.screenshot({ path: `${out}/${name}${i}.png` }); }
  await p.close();
}
const which = process.argv[3] || 'combat,raven,blade';
if (which.includes('combat')) await shot('auto&ch=0&god&bot', [9000, 4000], 'combat');
if (which.includes('raven')) await shot('auto&ch=1&god&bot', [22000, 4000], 'raven');
if (which.includes('blade')) await shot('showcase=blade&auto', [4000, 500, 500, 500, 500], 'blade');
if (which.includes('melee')) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(url + '?showcase=blade&auto');
  await p.waitForTimeout(3000); if (process.env.DIRECT) await p.evaluate(() => { window.__G.direct = true; });
  for (let k = 0; k < 3; k++) {
    await p.waitForFunction(() => window.__G.targetList.some(t => t.alive && t.pos.distanceTo(window.__G.player.pos) < 110 && t.pos.z < -10), null, { timeout: 20000 }).catch(() => {});
    await p.evaluate(() => { const G = window.__G, pl = G.player; const t = G.targetList.find(t => t.alive && t.pos.distanceTo(pl.pos) < 110 && t.pos.z < -10); pl.findMeleeTarget = () => t || null; pl.startMelee(); });
    for (let i = 0; i < 3; i++) { await p.waitForTimeout(60); await p.screenshot({ path: `${out}/melee${k}${i}.png` }); console.log(k, i, await p.evaluate(() => { const G = window.__G, c = G.camera; return [c.position.toArray().map(v => v.toFixed(1)), G.player.pos.toArray().map(v => v.toFixed(1)), G.player.meleeState, G.state, G.boss.state, !!G.cinematic].join(" "); })); }
    await p.waitForTimeout(800);
  }
  await p.close();
}
await b.close();

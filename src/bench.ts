import * as THREE from 'three';

/**
 * ?showcase=benchmark — runs every trailer moment back to back with the autopilot and records real frame
 * times. Meant for a real GPU: a software rasterizer (SwiftShader / llvmpipe) is detected and never passes.
 * &benchsec=N scales every scene to N seconds (used by the smoke test).
 */
const SCENES: [string, number][] = [['missile', 10], ['blade', 10], ['raven', 12], ['fleet', 10], ['tunnel', 10], ['boss', 9], ['transform', 10], ['finisher', 13]];
const WARM = 0.6; // seconds skipped at the start of each scene (scene setup, first-use uploads)

interface SceneStats { scene: string; seconds: number; frames: number; avgMs: number; p95Ms: number; p99Ms: number; worstMs: number; spikes33: number;
  prMin: number; prMax: number; drawCallsMax: number; trianglesMax: number; particlePeak: number; ribbonPeak: number }
export interface BenchResult { version: string; date: string; url: string; gpu: string; vendor: string; software: boolean; viewport: string; devicePixelRatio: number;
  verdict: 'PASS' | 'WARN' | 'FAIL' | 'INVALID'; reason: string; overall: Omit<SceneStats, 'scene'>; scenes: SceneStats[] }

export interface BenchHost {
  renderer: THREE.WebGLRenderer; startShowcase(name: string): void; toTitle(): void; setBot(on: boolean): void;
  pr(): number; particles(): number; ribbons(): number;
}

const pct = (sorted: number[], p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function gpuInfo(r: THREE.WebGLRenderer) {
  const gl = r.getContext(); let gpu = '', vendor = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    vendor = String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
  } catch { gpu = 'unknown'; }
  const software = /swiftshader|llvmpipe|softpipe|software|basic render driver|lavapipe/i.test(gpu + ' ' + vendor);
  return { gpu, vendor, software };
}

export class Bench {
  on = false; idx = -1; t = 0; scale = 1; frames: number[] = []; all: number[] = []; cur: SceneStats | null = null; scenes: SceneStats[] = [];
  el: HTMLDivElement; result: BenchResult | null = null;
  constructor(private host: BenchHost) {
    this.el = document.createElement('div'); this.el.id = 'bench'; document.body.appendChild(this.el);
    const q = new URLSearchParams(location.search).get('benchsec'); if (q) this.scale = Math.max(0.5, +q) / 10;
  }
  start() {
    this.on = true; this.idx = -1; this.scenes = []; this.all = []; this.result = null; this.host.setBot(true);
    this.el.className = 'run'; this.next();
  }
  private next() {
    if (this.cur) this.finishScene();
    this.idx++;
    if (this.idx >= SCENES.length) { this.finish(); return; }
    const [name] = SCENES[this.idx]; this.t = 0; this.frames = [];
    this.cur = { scene: name, seconds: 0, frames: 0, avgMs: 0, p95Ms: 0, p99Ms: 0, worstMs: 0, spikes33: 0, prMin: 9, prMax: 0, drawCallsMax: 0, trianglesMax: 0, particlePeak: 0, ribbonPeak: 0 };
    this.host.startShowcase(name);
  }
  /** Call once per rendered frame with the raw frame interval in ms. */
  frame(rawMs: number, dt: number) {
    if (!this.on || !this.cur) return;
    this.t += dt; const dur = SCENES[this.idx][1] * this.scale;
    if (this.t > WARM * Math.min(1, this.scale * 2)) {
      const c = this.cur, inf = this.host.renderer.info.render, pr = this.host.pr();
      this.frames.push(rawMs); c.prMin = Math.min(c.prMin, pr); c.prMax = Math.max(c.prMax, pr);
      c.drawCallsMax = Math.max(c.drawCallsMax, inf.calls); c.trianglesMax = Math.max(c.trianglesMax, inf.triangles);
      c.particlePeak = Math.max(c.particlePeak, this.host.particles()); c.ribbonPeak = Math.max(c.ribbonPeak, this.host.ribbons());
    }
    this.el.textContent = `BENCHMARK ${this.idx + 1}/${SCENES.length}  ${SCENES[this.idx][0].toUpperCase()}  ${Math.max(0, dur - this.t).toFixed(1)}s`;
    if (this.t >= dur) this.next();
  }
  private finishScene() {
    const c = this.cur!, f = this.frames, s = [...f].sort((a, b) => a - b);
    c.frames = f.length; c.seconds = r1(f.reduce((a, b) => a + b, 0) / 1000);
    c.avgMs = r1(f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0); c.p95Ms = r1(pct(s, 0.95)); c.p99Ms = r1(pct(s, 0.99)); c.worstMs = r1(s[s.length - 1] || 0);
    c.spikes33 = f.filter(v => v > 33.4).length; c.prMin = r1(c.prMin * 100) / 100; c.prMax = r1(c.prMax * 100) / 100;
    this.scenes.push(c); this.all.push(...f); this.cur = null;
  }
  private finish() {
    this.on = false; this.host.setBot(false);
    const s = [...this.all].sort((a, b) => a - b), n = s.length, sum = this.all.reduce((a, b) => a + b, 0);
    const overall = {
      seconds: r1(sum / 1000), frames: n, avgMs: r1(n ? sum / n : 0), p95Ms: r1(pct(s, 0.95)), p99Ms: r1(pct(s, 0.99)), worstMs: r1(s[n - 1] || 0),
      spikes33: this.all.filter(v => v > 33.4).length, prMin: Math.min(...this.scenes.map(x => x.prMin)), prMax: Math.max(...this.scenes.map(x => x.prMax)),
      drawCallsMax: Math.max(...this.scenes.map(x => x.drawCallsMax)), trianglesMax: Math.max(...this.scenes.map(x => x.trianglesMax)),
      particlePeak: Math.max(...this.scenes.map(x => x.particlePeak)), ribbonPeak: Math.max(...this.scenes.map(x => x.ribbonPeak)),
    };
    const g = gpuInfo(this.host.renderer);
    let verdict: BenchResult['verdict'], reason: string;
    const spikeRate = n ? overall.spikes33 / n : 1;
    if (g.software) { verdict = 'INVALID'; reason = 'Software renderer detected (' + g.gpu + '). Frame times do not reflect a real GPU; run this on real hardware.'; }
    else if (overall.avgMs <= 17.5 && overall.p95Ms <= 20 && spikeRate <= 0.005) { verdict = 'PASS'; reason = '60-FPS class: avg ≤ 17.5 ms, p95 ≤ 20 ms, < 0.5% frames over 33 ms.'; }
    else if (overall.p95Ms <= 33.4 && spikeRate <= 0.03) { verdict = 'WARN'; reason = 'Playable but below the 60-FPS target. Check the worst scene below.'; }
    else { verdict = 'FAIL'; reason = 'p95 over 33 ms or frequent spikes.'; }
    this.result = { version: 'rc3', date: new Date().toISOString(), url: location.href, gpu: g.gpu, vendor: g.vendor, software: g.software,
      viewport: `${innerWidth}x${innerHeight}`, devicePixelRatio: devicePixelRatio, verdict, reason, overall, scenes: this.scenes };
    (window as any).__bench = this.result;
    this.host.toTitle(); this.render();
  }
  private render() {
    const r = this.result!, o = r.overall;
    const row = (x: any, name: string) => `<tr><td>${name}</td><td>${x.avgMs}</td><td>${x.p95Ms}</td><td>${x.p99Ms}</td><td>${x.worstMs}</td><td>${x.spikes33}</td><td>${x.prMin}–${x.prMax}</td><td>${x.drawCallsMax}</td><td>${Math.round(x.trianglesMax / 1000)}k</td><td>${x.particlePeak}</td><td>${x.ribbonPeak}</td></tr>`;
    this.el.className = 'done';
    this.el.innerHTML = `<div class="bv ${r.verdict}">${r.verdict}</div><div class="bg">${r.gpu}</div><div class="br">${r.reason}</div>
      <table><tr><th>scene</th><th>avg ms</th><th>p95</th><th>p99</th><th>worst</th><th>&gt;33ms</th><th>pixel ratio</th><th>draw calls</th><th>tris</th><th>particles</th><th>ribbons</th></tr>
      ${r.scenes.map(x => row(x, x.scene)).join('')}${row(o, '<b>ALL</b>')}</table>
      <div class="bb"><div class="btn" id="bCopy">COPY JSON</div><div class="btn" id="bDl">DOWNLOAD JSON</div><div class="btn alt" id="bAgain">RUN AGAIN</div><div class="btn alt" id="bClose">CLOSE</div></div>`;
    const json = () => JSON.stringify(r, null, 2);
    (this.el.querySelector('#bCopy') as HTMLElement).onclick = e => { navigator.clipboard?.writeText(json()).then(() => ((e.target as HTMLElement).textContent = 'COPIED'), () => {}); };
    (this.el.querySelector('#bDl') as HTMLElement).onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json()], { type: 'application/json' }));
      a.download = `mach-overdrive-bench-${r.date.slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    (this.el.querySelector('#bAgain') as HTMLElement).onclick = () => this.start();
    (this.el.querySelector('#bClose') as HTMLElement).onclick = () => { this.el.className = ''; };
  }
}

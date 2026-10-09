import { G } from './core';

/**
 * Real-GPU benchmark: ?showcase=benchmark (click LAUNCH, or add &auto).
 * Plays the eight trailer moments back to back with the autopilot in god mode, records every
 * real frame, then shows a result panel with Copy / Download JSON. A software renderer
 * (SwiftShader, llvmpipe, …) is reported but can never PASS.
 * &benchquick shortens every scene to 2 s (smoke test only; numbers are meaningless).
 */
export interface SceneResult {
  scene: string; reached: boolean; seconds: number; frames: number;
  fps: number; avgMs: number; p95Ms: number; p99Ms: number; worstMs: number; spikes33: number;
  minPixelRatio: number; maxPixelRatio: number; peakDrawCalls: number; peakTrisK: number;
  peakParticles: number; peakRibbons: number; peakEnemies: number; peakSpeedIntensity: number;
}

interface Scene { name: string; showcase: string; dur: number; heavy?: boolean; ready?: () => boolean; until?: () => boolean }
const SCENES: Scene[] = [
  { name: 'missile', showcase: 'missile', dur: 12 },
  { name: 'blade', showcase: 'blade', dur: 12 },
  { name: 'raven', showcase: 'raven', dur: 14 },
  { name: 'fleet', showcase: 'fleet', dur: 14, heavy: true },
  { name: 'tunnel', showcase: 'tunnel', dur: 12, ready: () => G.director.tunnel.run },
  { name: 'helios intro', showcase: 'boss', dur: 8, ready: () => G.boss.state === 'intro' },
  { name: 'transform', showcase: 'transform', dur: 7.5, heavy: true, ready: () => G.boss.state === 'transform' },
  { name: 'finisher', showcase: 'finisher', dur: 12, heavy: true, ready: () => G.boss.state === 'finisher', until: () => G.boss.state === 'dead' },
];
/** Excluded from stats at the start of each ungated scene (spawn / section swap). */
const SETTLE = 1;
const READY_TIMEOUT = 40;
export const TARGETS = { fps: 58, heavyFps: 50, p95Ms: 20, spikesPerScene: 3 };

export function gpuInfo(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const vendor = String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer + ' ' + vendor);
  return { renderer, vendor, software };
}

export interface BenchCtx {
  gl: () => WebGLRenderingContext | WebGL2RenderingContext;
  startShowcase: (name: string) => void;
  done: () => void;
  stats: () => { pr: number; calls: number; tris: number; particles: number; ribbons: number; enemies: number; vfx: number };
}

export class Benchmark {
  active = false; results: SceneResult[] = []; report: any = null;
  private i = -1; private t = 0; private waitT = 0; private recording = false; private frames: number[] = [];
  private peak = { minPr: 9, maxPr: 0, calls: 0, tris: 0, particles: 0, ribbons: 0, enemies: 0, vfx: 0 };
  private interrupted = false; private quick: boolean;
  constructor(private ctx: BenchCtx, params: URLSearchParams) {
    this.quick = params.has('benchquick');
    document.addEventListener('visibilitychange', () => { if (this.active && document.hidden) this.interrupted = true; });
  }
  start() {
    document.getElementById('benchPanel')?.remove();
    this.active = true; G.benchActive = true; this.results = []; this.report = null; this.interrupted = false; this.i = -1; this.next();
  }
  private next() {
    this.i++;
    if (this.i >= SCENES.length) return this.finish();
    const sc = SCENES[this.i];
    this.t = 0; this.waitT = 0; this.frames = []; this.recording = !sc.ready;
    this.peak = { minPr: 9, maxPr: 0, calls: 0, tris: 0, particles: 0, ribbons: 0, enemies: 0, vfx: 0 };
    this.ctx.startShowcase(sc.showcase);
    G.hud.objective(''); G.hud.small('m_bench', 'ok', { n: this.i + 1, total: SCENES.length, name: sc.name.toUpperCase() });
  }
  /** Call once per rendered frame with the raw (unclamped) frame time and the simulation step. */
  frame(rawMs: number, rdt: number) {
    if (!this.active || G.paused) return;
    const sc = SCENES[this.i];
    if (!this.recording) {
      this.waitT += rdt;
      if (sc.ready!()) { this.recording = true; this.t = SETTLE; }
      else if (this.waitT > READY_TIMEOUT) { this.close(sc, false); return this.next(); }
      return;
    }
    this.t += rdt;
    if (this.t >= SETTLE) {
      const s = this.ctx.stats(), p = this.peak;
      this.frames.push(rawMs);
      p.minPr = Math.min(p.minPr, s.pr); p.maxPr = Math.max(p.maxPr, s.pr); p.calls = Math.max(p.calls, s.calls); p.tris = Math.max(p.tris, s.tris);
      p.particles = Math.max(p.particles, s.particles); p.ribbons = Math.max(p.ribbons, s.ribbons); p.enemies = Math.max(p.enemies, s.enemies); p.vfx = Math.max(p.vfx, s.vfx);
    }
    const dur = this.quick ? 2 : sc.dur;
    if (this.t - SETTLE >= dur || (sc.until && sc.until())) { this.close(sc, true); this.next(); }
  }
  private close(sc: Scene, reached: boolean) {
    const f = this.frames.slice().sort((a, b) => a - b), n = f.length, p = this.peak;
    const avg = n ? f.reduce((a, b) => a + b, 0) / n : 0, q = (x: number) => n ? f[Math.min(n - 1, Math.floor(n * x))] : 0;
    const r1 = (v: number) => +v.toFixed(1), r2 = (v: number) => +v.toFixed(2);
    this.results.push({
      scene: sc.name, reached: reached && n > 0, seconds: r1(Math.max(0, this.t - SETTLE)), frames: n,
      fps: avg ? Math.round(1000 / avg) : 0, avgMs: r1(avg), p95Ms: r1(q(0.95)), p99Ms: r1(q(0.99)), worstMs: r1(n ? f[n - 1] : 0),
      spikes33: f.filter(v => v > 33.4).length, minPixelRatio: n ? r2(p.minPr) : 0, maxPixelRatio: r2(p.maxPr),
      peakDrawCalls: p.calls, peakTrisK: Math.round(p.tris / 1000), peakParticles: p.particles, peakRibbons: p.ribbons, peakEnemies: p.enemies, peakSpeedIntensity: r2(p.vfx),
    });
  }
  private finish() {
    this.active = false;
    const gpu = gpuInfo(this.ctx.gl());
    const verdicts = this.results.map(r => {
      const heavy = !!SCENES.find(s => s.name === r.scene)?.heavy, fpsTarget = heavy ? TARGETS.heavyFps : TARGETS.fps;
      return { scene: r.scene, fpsTarget, ok: r.reached && r.fps >= fpsTarget && r.p95Ms <= TARGETS.p95Ms && r.spikes33 <= TARGETS.spikesPerScene };
    });
    const allOk = verdicts.every(v => v.ok);
    const status = gpu.software ? 'NOT CERTIFIED' : this.quick ? 'QUICK RUN' : this.interrupted ? 'INVALID' : allOk ? 'PASS' : 'CHECK';
    const all = this.results.filter(r => r.frames).flatMap(r => [r.avgMs]);
    this.report = {
      game: 'MACH OVERDRIVE', build: 'RC3', date: new Date().toISOString(), url: location.href, userAgent: navigator.userAgent,
      viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, gpu,
      status, pass: status === 'PASS',
      note: gpu.software ? 'Software renderer: these are CPU rendering numbers, not a GPU result. Never counts as PASS.'
        : this.quick ? 'benchquick: 2 s per scene, smoke test only.'
        : this.interrupted ? 'The tab was hidden during the run; rerun with the window in front.' : 'Hardware renderer.',
      targets: TARGETS, settleSeconds: SETTLE,
      summary: { worstSceneAvgMs: all.length ? Math.max(...all) : 0, totalSpikes33: this.results.reduce((a, r) => a + r.spikes33, 0),
        minPixelRatio: Math.min(...this.results.filter(r => r.frames).map(r => r.minPixelRatio), 9), peakDrawCalls: Math.max(0, ...this.results.map(r => r.peakDrawCalls)) },
      verdicts, scenes: this.results,
    };
    (window as any).__benchmark = this.report;
    console.info('MACH OVERDRIVE benchmark', JSON.stringify(this.report));
    this.ctx.done();
    this.showPanel();
  }
  showPanel() {
    const rep = this.report, json = JSON.stringify(rep, null, 2);
    const cls = rep.status === 'PASS' ? 'ok' : 'bad';
    const row = (r: SceneResult) => {
      const v = rep.verdicts.find((x: any) => x.scene === r.scene);
      return `<tr class="${v.ok ? 'ok' : 'bad'}"><td>${r.scene}${r.reached ? '' : ' (not reached)'}</td><td>${r.fps}</td><td>${r.avgMs}</td><td>${r.p95Ms}</td><td>${r.p99Ms}</td><td>${r.worstMs}</td><td>${r.spikes33}</td><td>${r.minPixelRatio}–${r.maxPixelRatio}</td><td>${r.peakDrawCalls}</td><td>${r.peakTrisK}k</td><td>${r.peakParticles}</td><td>${r.peakRibbons}</td><td>${r.peakSpeedIntensity}</td></tr>`;
    };
    const el = document.createElement('div'); el.id = 'benchPanel';
    el.innerHTML = `<h3>BENCHMARK <b class="${cls}">${rep.status}</b></h3>
      <div class="gpu">${esc(rep.gpu.renderer)} · ${rep.viewport}${rep.gpu.software ? ' · <b class="bad">SOFTWARE RENDERER</b>' : ''}</div>
      <table><tr><th>scene</th><th>fps</th><th>avg</th><th>p95</th><th>p99</th><th>worst</th><th>&gt;33ms</th><th>pixel ratio</th><th>draws</th><th>tris</th><th>particles</th><th>ribbons</th><th>speed</th></tr>${rep.scenes.map(row).join('')}</table>
      <div class="foot">${esc(rep.note)}<br>targets: ≥${TARGETS.fps} fps (≥${TARGETS.heavyFps} fleet / transform / finisher), p95 ≤ ${TARGETS.p95Ms} ms, ≤ ${TARGETS.spikesPerScene} frames over 33 ms per scene · first ${SETTLE}s of each scene excluded</div>
      <div class="btns"><button data-copy>Copy JSON</button><button data-dl>Download JSON</button><button data-again>Run again</button><button data-close>Close</button></div>`;
    el.querySelector('[data-copy]')!.addEventListener('click', e => { navigator.clipboard?.writeText(json).then(() => { (e.target as HTMLElement).textContent = 'Copied'; }); });
    el.querySelector('[data-dl]')!.addEventListener('click', () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `mach-overdrive-benchmark-${Date.now()}.json`; a.click();
    });
    el.querySelector('[data-again]')!.addEventListener('click', () => this.start());
    el.querySelector('[data-close]')!.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
  }
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);

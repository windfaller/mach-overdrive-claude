// Procedural Web Audio: every sound is synthesized, no assets.
let ctx: AudioContext = null as any;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode, noiseBuf: AudioBuffer, verb: GainNode, sig: GainNode, drive: WaveShaperNode;
let engOsc1: OscillatorNode, engOsc2: OscillatorNode, engFilter: BiquadFilterNode, engGain: GainNode, windGain: GainNode, windFilter: BiquadFilterNode;
const lastPlay: Record<string, number> = {};

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.8;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // signature bus: dry + a long synthetic hall (stereo decaying noise IR) for the trailer moments
  const ir = ctx.createBuffer(2, ctx.sampleRate * 3.2, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) { const u = i / ch.length; ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - u, 3.2) * (i < 400 ? i / 400 : 1); } }
  const conv = ctx.createConvolver(); conv.buffer = ir; verb = ctx.createGain(); verb.gain.value = 0.55; verb.connect(conv); conv.connect(sfxBus);
  sig = ctx.createGain(); sig.gain.value = 1; sig.connect(sfxBus); sig.connect(verb);
  // soft-clip stage for heavy bodies
  drive = ctx.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(x * 3.2); } drive.curve = cv; drive.connect(sig);
  // engine
  engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 400; engFilter.Q.value = 4;
  engGain = ctx.createGain(); engGain.gain.value = 0;
  engOsc1 = ctx.createOscillator(); engOsc1.type = 'sawtooth'; engOsc1.frequency.value = 55;
  engOsc2 = ctx.createOscillator(); engOsc2.type = 'sawtooth'; engOsc2.frequency.value = 55.7;
  engOsc1.connect(engFilter); engOsc2.connect(engFilter); engFilter.connect(engGain); engGain.connect(sfxBus);
  engOsc1.start(); engOsc2.start();
  const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 800; windFilter.Q.value = 0.6;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus); wind.start();
  startMusic();
}
export const audioReady = () => !!ctx;
export function setMasterMute(m: boolean) { if (master) master.gain.value = m ? 0 : 0.8; }

function now() { return ctx.currentTime; }
function gate(name: string, min: number) {
  const t = performance.now(); if (lastPlay[name] && t - lastPlay[name] < min) return false;
  lastPlay[name] = t; return true;
}
function env(g: GainNode, t: number, a: number, peak: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function osc(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, dest: AudioNode = sfxBus, a = 0.005) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
}
function noise(t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, a = 0.005, dest: AudioNode = sfxBus) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + a + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
}

/** Three-band hit: sub thump, mid body, high transient — the base of every heavy sound. */
function impact(t: number, sub: number, mid: number, hi: number, len = 1) {
  if (sub) { osc('sine', 110, 32, t, 0.35 * len, sub); }
  if (mid) { noise(t, 0.18 * len, mid, 'bandpass', 900, 250, 1.2, 0.002); osc('triangle', 260, 120, t, 0.12 * len, mid * 0.4); }
  if (hi) noise(t, 0.05, hi, 'highpass', 6000, 3500, 0.8, 0.001);
}
const proc = {
  laser() { if (!ctx || !gate('laser', 45)) return; const t = now();
    osc('square', 1400, 260, t, 0.07, 0.05); osc('sine', 2600, 900, t, 0.05, 0.04); noise(t, 0.04, 0.05, 'highpass', 5000, 3000); osc('sine', 180, 90, t, 0.06, 0.08); },
  hit() { if (!ctx || !gate('hit', 30)) return; const t = now(); noise(t, 0.06, 0.12, 'bandpass', 3200, 1500, 2); osc('square', 700, 300, t, 0.04, 0.03); },
  ping() { if (!ctx || !gate('ping', 60)) return; const t = now(); osc('triangle', 3000, 2400, t, 0.08, 0.03); },
  explosion(size = 1, vol = 1) {
    if (!ctx || !gate('exp' + (size > 2 ? 'b' : 's'), size > 2 ? 60 : 35)) return; const t = now();
    const v = Math.min(1, 0.3 + size * 0.2) * vol;
    noise(t, 0.4 + size * 0.35, 0.5 * v, 'lowpass', 2500, 80, 0.7, 0.003);
    noise(t, 0.15, 0.3 * v, 'bandpass', 1200, 400, 1);
    osc('sine', 120, 28, t, 0.3 + size * 0.25, 0.6 * v);
    if (size > 2) { noise(t + 0.08, 1.4, 0.35 * v, 'lowpass', 900, 50, 0.5, 0.05); osc('sawtooth', 60, 20, t, 1.2, 0.2 * v); }
  },
  missile() { if (!ctx || !gate('msl', 25)) return; const t = now();
    impact(t, 0.25, 0.1, 0.12, 0.5); noise(t + 0.02, 0.55, 0.18, 'bandpass', 400, 2800, 1.5, 0.01); osc('sawtooth', 180, 90, t, 0.25, 0.04); },
  lockTick(n = 1) { if (!ctx || !gate('lk', 40)) return; const t = now(); const f = 900 * Math.pow(2, n * 2 / 12); osc('sine', f, f, t, 0.05, 0.08); osc('square', f * 2, f * 2, t, 0.02, 0.02); },
  locked() { if (!ctx) return; const t = now(); [1760, 2217, 2637].forEach((f, i) => osc('square', f, f, t + i * 0.05, 0.12, 0.035)); osc('sine', 3520, 3520, t + 0.15, 0.3, 0.04); },
  chainKill(n = 1) { if (!ctx || !gate('chain', 50)) return; const t = now(); const f = 660 * Math.pow(2, Math.min(n, 12) / 12); osc('triangle', f, f * 1.5, t, 0.15, 0.06); impact(t, 0.2, 0, 0.06, 0.6); },
  melee() { if (!ctx) return; const t = now();
    noise(t, 0.22, 0.4, 'bandpass', 1500, 6000, 2, 0.02);
    [523, 1307, 2140, 3011].forEach((f, i) => osc('sine', f, f * 0.98, t + 0.03, 0.6 - i * 0.1, 0.06)); },
  slashHit() { if (!ctx) return; const t = now();
    impact(t, 0.7, 0.35, 0.3); noise(t, 0.3, 0.5, 'highpass', 2500, 800, 1, 0.001); osc('sawtooth', 1200, 200, t, 0.15, 0.08); },
  boost() { if (!ctx || !gate('boost', 300)) return; const t = now();
    impact(t, 0.45, 0.12, 0); noise(t, 0.8, 0.35, 'bandpass', 300, 3000, 1.2, 0.05); osc('sawtooth', 80, 240, t, 0.6, 0.08); },
  dodge() { if (!ctx) return; const t = now(); noise(t, 0.25, 0.25, 'bandpass', 3000, 600, 2, 0.01); },
  /** PERFECT DODGE: time-suck swell -> crystalline bell stack with shimmer -> sub drop, into the hall. */
  perfect() { if (!ctx) return; const t = now(), h = t + 0.22;
    noise(t, 0.24, 0.45, 'bandpass', 300, 7000, 1.4, 0.2, sig);               // reverse-style inhale
    osc('sine', 1800, 300, t, 0.22, 0.05, sig, 0.18);                        // pitch suck
    noise(h, 0.03, 0.5, 'highpass', 9000, 6000, 0.7, 0.001, sig);            // glass tick
    [1318.5, 1975.5, 2637, 3951, 5274].forEach((f, i) => { osc('sine', f, f * 1.002, h + i * 0.012, 2.2 - i * 0.25, 0.07 - i * 0.01, sig); osc('sine', f * 2.76, f * 2.76, h, 0.5, 0.012, sig); });
    for (let i = 0; i < 6; i++) osc('triangle', 2637 * Math.pow(2, i / 12 * 2), 2637 * Math.pow(2, i / 12 * 2), h + 0.08 + i * 0.05, 0.4, 0.015, sig);
    osc('sine', 90, 28, h, 1.4, 0.55, sfxBus); noise(h, 0.9, 0.12, 'lowpass', 600, 60, 0.7, 0.01, sig); },
  nearMiss() { if (!ctx || !gate('nm', 150)) return; const t = now(); noise(t, 0.35, 0.3, 'bandpass', 4000, 400, 3, 0.03); osc('sawtooth', 900, 300, t, 0.25, 0.03); },
  gate() { if (!ctx) return; const t = now(); [660, 990, 1320].forEach((f, i) => osc('triangle', f, f * 1.5, t + i * 0.05, 0.25, 0.08)); },
  damage() { if (!ctx || !gate('dmg', 80)) return; const t = now(); osc('square', 140, 50, t, 0.25, 0.25); noise(t, 0.3, 0.4, 'lowpass', 3000, 200, 1); },
  warning() { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) { osc('square', 880, 880, t + i * 0.36, 0.16, 0.06); osc('square', 660, 660, t + i * 0.36 + 0.18, 0.16, 0.06); } },
  alarm() { if (!ctx || !gate('alarm', 500)) return; const t = now(); osc('sawtooth', 1200, 600, t, 0.3, 0.05); },
  ravenWarn() { if (!ctx) return; const t = now(); impact(t, 0.6, 0.3, 0.2, 1.5); for (let i = 0; i < 3; i++) { osc('sawtooth', 300, 1500, t + 0.15 + i * 0.22, 0.18, 0.06); } osc('square', 90, 60, t, 1.2, 0.1); },
  /** FINISHER core impact: vacuum inhale, crack, distorted body, long sub drop and a held major chord in the hall. */
  finisher() { if (!ctx) return; const t = now();
    noise(t, 0.04, 0.9, 'highpass', 7000, 4000, 0.7, 0.001, sig);                                                     // crack
    impact(t, 1, 0.7, 0.6, 2.8);
    osc('sawtooth', 62, 24, t, 2.8, 0.4, drive, 0.003); osc('square', 93, 31, t, 1.6, 0.18, drive, 0.003);           // distorted body
    osc('sine', 70, 18, t, 3.4, 1.0, sfxBus, 0.004);                                                                  // sub drop
    noise(t, 3.0, 0.5, 'lowpass', 6000, 50, 0.6, 0.006, sig);                                                         // blast air
    [261.6, 392, 523.25, 659.3, 784, 1046.5].forEach((f, i) => { osc('sawtooth', f, f * 1.003, t + 0.06, 3.2 - i * 0.2, 0.02, sig, 0.4); osc('sine', f * 2, f * 2, t + 0.06, 2.8, 0.025, sig, 0.3); });
    for (let i = 0; i < 5; i++) noise(t + 0.25 + i * 0.18, 0.5, 0.2, 'bandpass', 1400 - i * 200, 200, 2, 0.01, sig); },  // debris rumble tail
  /** MISSILE SALVO: one launch event under the per-missile pops — pod clack, ignition roar sweeping up, crackle ripple. */
  salvo(n = 8) { if (!ctx || !gate('salvo', 200)) return; const t = now();
    impact(t, 0.55, 0.25, 0.25, 0.7); noise(t, 0.05, 0.35, 'bandpass', 2400, 1200, 4, 0.001, sig);
    noise(t + 0.02, 0.4 + n * 0.055, 0.35, 'bandpass', 300, 3600, 1.3, 0.04, sig); osc('sawtooth', 70, 160, t, 0.6 + n * 0.05, 0.08, drive, 0.04);
    for (let i = 0; i < n; i++) { const s = t + i * 0.055; noise(s, 0.06, 0.22, 'highpass', 3500 + (i % 3) * 900, 2000, 1.5, 0.001, sig); osc('sine', 160 - i * 6, 60, s, 0.12, 0.12, sfxBus); }
    noise(t + n * 0.055, 1.6, 0.2, 'lowpass', 2400, 120, 0.7, 0.2, sig); },
  bossWarning() { if (!ctx) return; const t = now(); impact(t, 0.8, 0.2, 0, 3); impact(t + 2.2, 0.8, 0.2, 0, 3);
    for (let k = 0; k < 2; k++) { const s = t + k * 2.2; osc('sawtooth', 65, 65, s, 1.8, 0.35, sfxBus, 0.4); osc('sawtooth', 97.5, 97.5, s, 1.8, 0.25, sfxBus, 0.4); osc('sawtooth', 130, 129, s, 1.8, 0.15, sfxBus, 0.4); } },
  /** HELIOS TRANSFORM (7.5 s, matches boss timing): sub drone, staged servo clanks with metal ring-outs,
   *  a rising formant roar at 5.8 s and a final slam at 7.5 s into the hall. */
  transform() { if (!ctx) return; const t = now();
    osc('sine', 34, 42, t, 7.4, 0.5, sfxBus, 1.2); osc('sawtooth', 41, 55, t, 7.2, 0.08, drive, 1.0);              // sub drone
    osc('sawtooth', 50, 700, t + 0.4, 5.2, 0.12, sig, 0.8); osc('square', 75, 900, t + 0.9, 4.6, 0.04, sig, 0.6);   // riser
    noise(t, 5.6, 0.18, 'bandpass', 120, 2600, 3, 2.5, sig);                                                          // building air
    for (let i = 0; i < 10; i++) { const s = t + 0.7 + i * 0.5 + (i % 3) * 0.06;
      impact(s, 0.35, 0.3, 0.15, 0.8);                                                                              // servo clank
      noise(s, 0.45, 0.35, 'bandpass', 900 - i * 40, 220, 5, 0.004, sig);
      [233 + i * 17, 377 + i * 11, 611 + i * 23].forEach(f => osc('sine', f, f * 0.995, s + 0.01, 0.9, 0.025, sig));  // metal ring-out
      if (i % 2) noise(s + 0.12, 0.2, 0.12, 'highpass', 5000, 3000, 2, 0.002, sig); }                                // hydraulic hiss
    const r = t + 5.8;                                                                                                // roar
    [70, 105, 140, 210].forEach((f, i) => osc('sawtooth', f * 0.8, f, r, 1.5, 0.12 - i * 0.02, drive, 0.25));
    noise(r, 1.5, 0.35, 'bandpass', 500, 1400, 2.5, 0.2, sig); noise(r, 1.5, 0.25, 'bandpass', 1500, 2600, 3, 0.2, sig);
    const k = t + 7.5; impact(k, 1, 0.6, 0.4, 2.5); noise(k, 2.6, 0.6, 'lowpass', 3200, 50, 0.6, 0.004, sig); osc('sine', 80, 22, k, 2.4, 0.9, sfxBus); },
  charge(dur = 1.5) { if (!ctx) return; const t = now(); osc('sawtooth', 100, 1400, t, dur, 0.08, sfxBus, dur * 0.8); noise(t, dur, 0.15, 'bandpass', 200, 4000, 4, dur * 0.8); },
  beam(dur = 1.5) { if (!ctx) return; const t = now(); noise(t, dur, 0.5, 'lowpass', 1800, 600, 2, 0.02); osc('sawtooth', 55, 50, t, dur, 0.3, sfxBus, 0.02); osc('square', 220, 200, t, dur, 0.05, sfxBus, 0.02); },
  victory() { if (!ctx) return; const t = now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => osc('triangle', f, f, t + i * 0.12, 1.2, 0.1));
    [261.6, 329.6, 392, 523.25].forEach(f => osc('sawtooth', f, f, t + 0.6, 3, 0.04, sfxBus, 0.3)); },
  gameover() { if (!ctx) return; const t = now(); [392, 349, 311, 262].forEach((f, i) => osc('triangle', f, f * 0.98, t + i * 0.3, 0.6, 0.12)); },
  ui() { if (!ctx) return; const t = now(); osc('square', 1200, 1800, t, 0.06, 0.05); },
};

type SfxName = keyof typeof proc;
// ---- asset replacement hook: a loaded sample for a name plays instead of the synthesized version
const samples: Partial<Record<string, AudioBuffer>> = {};
export async function loadSamples(map: Record<string, string>) {
  initAudio(); if (!ctx) return;
  await Promise.all(Object.entries(map).map(async ([k, url]) => {
    try { const r = await fetch(url); if (r.ok) samples[k] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { console.warn('sample', k, e); }
  }));
}
function playSample(b: AudioBuffer, vol = 1) { const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxBus); s.start(); }
export const sfx = new Proxy(proc, { get(o, k: string) { const f = (o as any)[k]; return (...a: any[]) => { const b = samples[k]; if (b && ctx) { if (gate('smp' + k, 30)) playSample(b); } else if (f) f(...a); }; } }) as typeof proc;
export type { SfxName };
export function suspendAudio(on: boolean) { if (!ctx) return; if (on) ctx.suspend(); else ctx.resume(); }
/** Pull everything down for a beat of silence (finisher), then restore. */
export function duck(on: boolean, time = 0.15) { if (!ctx) return; master.gain.setTargetAtTime(on ? 0.08 : 0.8, now(), time); }

export function setEngine(speed01: number, boosting: boolean, on: boolean, vfx = 0.5) {
  if (!ctx) return; const t = now();
  const s = Math.min(1.5, speed01 * (0.75 + vfx * 0.4));
  engOsc1.frequency.setTargetAtTime(45 + s * 70, t, 0.1);
  engOsc2.frequency.setTargetAtTime(45.8 + s * 72, t, 0.1);
  engFilter.frequency.setTargetAtTime(200 + s * 900 + (boosting ? 800 : 0), t, 0.1);
  engGain.gain.setTargetAtTime(on ? 0.05 + s * 0.04 : 0, t, 0.15);
  windGain.gain.setTargetAtTime(on ? 0.03 + s * s * 0.12 : 0, t, 0.15);
  windFilter.frequency.setTargetAtTime(500 + s * 1800, t, 0.15);
}

// ---------------- music: tiny step sequencer -----------------
let intensity = 0, step = 0, nextTime = 0, musicOn = false, bpm = 132;
export function setMusic(level: number) { intensity = level; bpm = level >= 3 ? 150 : level >= 2 ? 142 : 132; }
export function stopMusic(fade = 1) { if (!ctx) return; musicBus.gain.setTargetAtTime(0, now(), fade / 3); musicOn = false; }
export function resumeMusic() { if (!ctx) return; musicBus.gain.setTargetAtTime(0.42, now(), 0.3); musicOn = true; }
const bassA = [0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 3, 0, 5, 7];
const bassB = [0, 12, 0, 12, 3, 15, 3, 15, 5, 17, 5, 17, 7, 19, 10, 22];
const chords = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]];
function kick(t: number, v = 0.9) { osc('sine', 150, 40, t, 0.28, v, musicBus, 0.002); }
function snare(t: number) { noise(t, 0.18, 0.35, 'highpass', 1800, 900, 0.8, 0.002, musicBus); osc('triangle', 220, 160, t, 0.1, 0.15, musicBus); }
function hat(t: number, v = 0.08) { noise(t, 0.04, v, 'highpass', 8000, 7000, 1, 0.001, musicBus); }
function bass(t: number, semi: number, dur: number) {
  const f = 55 * Math.pow(2, semi / 12) * (intensity >= 3 ? 1.0 : 1);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6;
  fl.frequency.setValueAtTime(300 + intensity * 350, t); fl.frequency.exponentialRampToValueAtTime(120, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, 0.22, dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(t: number, ch: number[], dur: number) {
  ch.forEach(s => { const f = 220 * Math.pow(2, s / 12);
    [0.996, 1.004].forEach(dt => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * dt;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900 + intensity * 300;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.025, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05); }); });
}
function lead(t: number, semi: number, dur: number) { osc('square', 440 * Math.pow(2, semi / 12), 440 * Math.pow(2, semi / 12), t, dur, 0.03, musicBus, 0.01); }
const leadPat = [12, -1, 15, -1, 19, -1, 17, 15, 12, -1, 10, -1, 12, -1, -1, -1];
function schedule() {
  if (!ctx) return;
  const spb = 60 / bpm / 4;
  while (nextTime < now() + 0.12) {
    const t = nextTime, s = step % 16, bar = Math.floor(step / 16) % 4;
    if (musicOn) {
      const ch = chords[bar];
      if (s === 0) pad(t, ch, spb * 16);
      if (intensity >= 1) {
        if (s % 4 === 0) kick(t);
        if (intensity >= 3 && s % 4 === 2) kick(t, 0.5);
        if (s === 4 || s === 12) snare(t);
        if (s % 2 === 1 || intensity >= 2) hat(t, s % 2 ? 0.07 : 0.035);
        const pat = intensity >= 2 ? bassB : bassA;
        bass(t, pat[s] + ch[0], spb * 0.9);
        if (intensity >= 2 && leadPat[s] >= 0 && bar % 2 === 1) lead(t, leadPat[s] + ch[0], spb * 1.8);
      } else if (s % 8 === 0) bass(t, ch[0], spb * 7);
    }
    nextTime += spb; step++;
  }
}
function startMusic() { nextTime = now() + 0.1; musicOn = true; setInterval(schedule, 25); }

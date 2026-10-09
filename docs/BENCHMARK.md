# Real-GPU benchmark

Status: **not certified.** No real-GPU run has been recorded yet. Every number produced in CI or a cloud container comes from SwiftShader (CPU rendering) and is reported as `NOT CERTIFIED`; it never counts as a pass.

## How to run (on the target machine, real browser, window in front)
1. Open `https://windfaller.github.io/mach-overdrive-claude/?showcase=benchmark` (add `&fps` for the live overlay).
2. Click **LAUNCH** (needed for audio). Do not switch tabs: a hidden tab marks the run `INVALID`.
3. The autopilot plays eight scenes back to back in god mode (about 2 minutes): missile, blade, raven, fleet, tunnel, helios intro, transform, finisher.
4. The result panel appears. Press **Download JSON** and send the file back to the project thread.

The JSON is also on `window.__benchmark` and in the console.

## What is recorded, per scene
`fps avgMs p95Ms p99Ms worstMs spikes33` (frames over 33 ms), `minPixelRatio maxPixelRatio` (adaptive resolution range, 0.6–1.5), `peakDrawCalls peakTrisK peakParticles peakRibbons peakEnemies`, and `peakSpeedIntensity` (the speed-hierarchy value, see below). The first 1 s of each ungated scene is excluded (spawn / section swap). Gated scenes (tunnel, helios intro, transform, finisher) record from the moment they actually start.

## Pass rule
- Hardware renderer (SwiftShader / llvmpipe / software / Basic Render → `NOT CERTIFIED`).
- Every scene reached.
- ≥ 58 fps average (≥ 50 for fleet, transform, finisher), p95 ≤ 20 ms, ≤ 3 frames over 33 ms per scene.
- Tab stayed visible.

## What to do with the result
Optimize only what the JSON points at. If it passes, no rendering refactor. Likely suspects if it does not (from the README): additive particle overdraw in big explosions (7000 cap), the 6 pooled point lights, the half-float bloom chain. Low `minPixelRatio` with low draw calls means fill-rate bound; high draw calls with high pixel ratio means CPU / draw-call bound.

## Speed hierarchy (calibrated in RC3)
One intensity value drives FOV, speed lines, radial blur, aberration, camera jitter, thrusters and engine pitch (`SPEED_TIERS` in `src/main.ts`):

| normal | combat | boost | blade lunge | tunnel | finisher |
|---|---|---|---|---|---|
| 0.4 | 0.55 | 0.75 | 0.9 | 1.0 | 1.1 |

The tunnel used to start at 0.8 and ramp to 1.0, so for its first seconds it read barely faster than boost; it is now 1.0 from the first frame. The smoke test checks the recorded peaks (tunnel ≥ 0.95, finisher ≥ 1.05, missile scene below tunnel).

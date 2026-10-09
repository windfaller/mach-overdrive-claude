# MACH OVERDRIVE 高速機甲：超限驅動

CI (`.github/workflows/pages.yml`): `npm ci → npm run check → npm run build → npm run smoke` (sharded across parallel jobs) → deploy. Any failure blocks the deploy. GitHub Pages is currently switched off; the deploy job only runs when the repository variable `DEPLOY_PAGES` is `true`.

Run: `npm install && npm run dev` (Vite). Build: `npm run build` → single-file `dist/index.html`.

## Controls
| | Keyboard / mouse | Gamepad (Xbox layout) |
|---|---|---|
| Fly | WASD | Left stick |
| Aim | Mouse | Right stick (soft aim assist) |
| Pulse rifle | LMB | RT |
| Multi-lock → missiles | hold RMB / E, release | hold LT, release |
| Energy blade | F | X (or RB) |
| Boost | Shift | LB (or L3) |
| Dodge / perfect dodge | Space | A |
| Pause | Esc / P | Start |

Menus work with mouse, arrow keys + Enter, or D-pad + A. M mutes. Languages: EN / 繁中 / 日本語 (title or pause menu, or `?lang=en|zh|ja`).

## Debug & showcase
- `?ch=0..4` start chapter (0 city, 1 highway + Raven, 2 fleet + battleship, 3 mass driver, 4 HELIOS), `&auto` skip title, `&god` invincible, `&fps` perf overlay (fps, worst frame, pixel ratio, particles, ribbons, draw calls, triangles, speed intensity), `&bot` autopilot, `&test` fixed-step low-res headless mode.
- `?showcase` adds a scene picker to the title; `?showcase=missile|blade|raven|fleet|tunnel|boss|transform|finisher&auto` jumps straight in (god mode on, scenes loop).
- `?showcase=benchmark&auto` runs all eight moments back to back with the autopilot and shows avg / p95 / p99 / worst frame, frames over 33 ms, pixel-ratio range, draw calls, triangles and particle / ribbon peaks per scene, with Copy JSON and Download JSON. Run it on a real GPU: a software renderer (SwiftShader, llvmpipe) is detected and reported as INVALID, never PASS. PASS = avg ≤ 17.5 ms, p95 ≤ 20 ms, under 0.5% of frames over 33 ms.

## QA
`npx playwright install chromium` once (Playwright is a pinned devDependency), then `npm run build && npm run smoke`. It drives each chapter with the bot and checks chapter progression, boss victory, restart, game over → retry, every showcase route, gamepad start / move / pause, language switching, the benchmark run, and authored GLTF fixtures (`tests/fixtures`) keeping banking, blade, Raven and HELIOS motion. It fails on console errors, NaN transforms, particle overflow, enemy runaway or dead targets left locked. `npm run smoke -- chapters|showcase|ui|bench|hero` runs one group; `CH=0,1,9` limits chapters (9 = game over). `node tests/shots.mjs <dir> combat,raven,blade,melee` saves full-quality screenshots.

## Hero assets (GLTF)
No authored models are in yet; the procedural meshes are blockouts, not final art. The brief for the three hero models is in [docs/ASSET_BRIEF.md](docs/ASSET_BRIEF.md).

Procedural models are the default and the fallback. To use authored models, fill `HERO_ASSETS` in `src/assets.ts` (files go in `public/assets/`) or pass `?hero=player:assets/player.glb,raven:assets/raven.glb,helios:assets/helios.glb`. A missing or broken file logs a warning and keeps the procedural model.

Gameplay never reads the mesh hierarchy; authored nodes are re-parented onto the procedural rig by name, so the existing procedural animation, anchors and hitboxes keep working. Units: 1 unit ≈ 1 m, facing −Z, rest pose with joints at zero.
- Player / Raven nodes: `torso head leftArm rightArm leftLeg rightLeg leftShin rightShin leftWing rightWing backpack`; anchors `gunMuzzle missilePodL missilePodR bladeAnchor thrusterL thrusterR`. Any missing slot keeps its procedural part.
- HELIOS nodes: modules `torso noseL noseR bridge wingL wingR limbL limbR` (they follow the ship → mech transformation), anchors `weak_port weak_starboard weak_spire core`. An animation clip whose name contains `transform` replaces the procedural transformation and is scrubbed by the same 7.5 s clock.

## Audio replacement
The four signature moments (missile salvo, perfect dodge, HELIOS transform, finisher) are layered syntheses with drive and a hall reverb; they are the first candidates for authored samples.
Every sound is synthesized. Fill `AUDIO_ASSETS` in `src/assets.ts` with `{ sfxName: 'assets/sfx/file.ogg' }` (names: `laser missile lockTick locked chainKill melee slashHit boost dodge perfect nearMiss alarm ravenWarn bossWarning transform finisher explosion …`, see `proc` in `src/audio.ts`); a loaded sample plays instead of the synth with no gameplay change.

## Notes
- Visual speed is one intensity value (normal 0.4 → combat 0.55 → boost 0.75 → blade lunge 0.9 → mass driver tunnel 1.0 → finisher 1.1; speed lines and radial blur ramp steeply above combat so cruise stays calm) driving FOV, speed lines, radial blur, chromatic aberration, camera jitter, thruster length and engine pitch (`vfxTarget` in `src/main.ts`).
- Performance: adaptive pixel ratio (0.6–1.5) reacts to frame time. Likely heavy spots to watch with `?fps` on a real GPU: additive particle overdraw during big explosions (7000 cap), the 6 pooled point lights (they cost on every lit material even when idle), and the half-float bloom chain.
- `npm audit` (5 findings: esbuild/vite dev server, micromatch/braces via vite-plugin-singlefile) only affects local dev/build tooling, not the shipped single HTML file. Fixing requires major-version upgrades, so it is left as is.

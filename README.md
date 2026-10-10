# MACH OVERDRIVE 高速機甲：超限驅動

CI (`.github/workflows/pages.yml`): `npm ci → npm run check → npm run build → npm run smoke` (sharded across parallel jobs) → deploy. Any failure blocks the deploy. GitHub Pages is currently switched off; the deploy job only runs when the repository variable `DEPLOY_PAGES` is `true`.

Run: `npm install && npm run dev` (Vite). Build: `npm run build` → single-file `dist/index.html`.

## Controls
| | Keyboard / mouse | Gamepad (Xbox layout) | Touch |
|---|---|---|---|
| Fly | WASD | Left stick | Floating stick (left 42% of the screen) |
| Aim | Mouse | Right stick (soft aim assist) | Drag on the right (aim assist, auto-fire on target) |
| Pulse rifle | LMB | RT | FIRE |
| Multi-lock → missiles | hold RMB / E, release | hold LT, release | hold LOCK, release |
| Heavy beam | hold Q, release | hold Y, release | hold BEAM, release |
| Energy blade | F | X (or RB) | BLADE |
| Boost | Shift | LB (or L3) | BOOST |
| Dodge / perfect dodge | Space | A | DODGE |
| Pause | Esc / P | Start | II |

Touch controls switch on with the first finger (or `?touch`). Each finger owns the control it landed on until it lifts. On phones the game asks for fullscreen and landscape when a mission starts.

## Combat systems
- **Heavy beam**: charge 0.3–2 s; damage 80→340 (×1.15 at full, enough to one-shot a heavy unit), width 1.4→4 m, pierces every target on the line and shoots down missiles. Cooldown scales with charge (1.4–2.4 s). The rifle is blocked while charging.
- **E-shield**: 60 points that absorb damage before armor and recharge at 15/s after 4 s without hits. Armor only regenerates while the shield is full. Below 30% armor the mech smokes and sparks. Death is a 0.85 s tumble before the blast.
- **Telegraphs**: heavy units flash an orange ring 0.7 s before each volley. Enemy missiles that are off screen show as red arrows on the screen edge.
- **HELIOS systems**: each weak point runs a system. PORT ARRAY = missile hatches (barrage and turret fire drop when it dies), STARBOARD ARRAY = deflector (the other two take half damage inside a shield bubble while it stands), COMMAND SPIRE = sweep-beam emitter (the sweep leaves the attack rotation). Each kill lurches the hull and gives a 3.2 s window with no attack.
- **RAVEN phase 2**: at half armor RAVEN releases its limiter (1.2 s, 90% damage reduction) and then fights 30% faster.
- **Radio comms**: queued lines with procedural portraits (HALCYON, KESTREL, RAVEN, HELIOS), typed in, on screen for their reading time. Each chapter opens with a letterboxed title card. All text is in EN / 繁中 / 日本語.

Menus work with mouse, arrow keys + Enter, or D-pad + A. M mutes. Languages: EN / 繁中 / 日本語 (title or pause menu, or `?lang=en|zh|ja`).

## Debug & showcase
- `?ch=0..4` start chapter (0 city, 1 highway + Raven, 2 fleet + battleship, 3 mass driver, 4 HELIOS), `&auto` skip title, `&god` invincible, `&fps` perf overlay (fps, worst frame, pixel ratio, particles, ribbons, draw calls, triangles, speed intensity), `&bot` autopilot, `&test` fixed-step low-res headless mode.
- `?showcase` adds a scene picker to the title; `?showcase=missile|blade|beam|raven|fleet|tunnel|boss|transform|finisher&auto` jumps straight in (god mode on, scenes loop).
- `?showcase=benchmark&auto` runs all nine moments back to back with the autopilot and shows avg / p95 / p99 / worst frame, frames over 33 ms, pixel-ratio range, draw calls, triangles and particle / ribbon peaks per scene, with Copy JSON and Download JSON. Run it on a real GPU: a software renderer (SwiftShader, llvmpipe) is detected and reported as INVALID, never PASS. PASS = avg ≤ 17.5 ms, p95 ≤ 20 ms, under 0.5% of frames over 33 ms.

## QA
`npx playwright install chromium` once (Playwright is a pinned devDependency), then `npm run build && npm run smoke`. It drives each chapter with the bot and checks chapter progression, boss victory, restart, game over → retry, every showcase route, gamepad start / move / pause, language switching, the benchmark run, and authored GLTF fixtures (`tests/fixtures`) keeping banking, blade, Raven and HELIOS motion. It fails on console errors, NaN transforms, particle overflow, enemy runaway or dead targets left locked. `npm run smoke -- chapters|showcase|ui|bench|hero` runs one group; `CH=0,1,9` limits chapters (9 = game over). `node tests/shots.mjs <dir> combat,raven,blade,melee` saves full-quality screenshots.

## Hero assets (GLTF)
The player mech and RAVEN ship as authored GLBs (`src/hero/*.glb`, inlined into the single-file build). They are remasters of the procedural blockout made in Blender: every plate is rebuilt with bevelled edges and weighted normals, and the armor gets tiling panel-line normal and roughness maps. Rebuild them with:

```
npx esbuild tools/dump-rig.ts --bundle --platform=node --format=esm --outfile=/tmp/dump.mjs && node /tmp/dump.mjs player /tmp/player.json && node /tmp/dump.mjs raven /tmp/raven.json
pip install bpy   # Blender as a Python module
python tools/remaster_mech.py /tmp/player.json src/hero/player.glb player
python tools/remaster_mech.py /tmp/raven.json src/hero/raven.glb raven
```

HELIOS is still procedural. The brief for final art is in [docs/ASSET_BRIEF.md](docs/ASSET_BRIEF.md).

Procedural models remain the fallback. Override per run with `?hero=player:assets/player.glb,raven:assets/raven.glb,helios:assets/helios.glb`, or force the blockouts with `?hero=none`. A missing or broken file logs a warning and keeps the procedural model.

Gameplay never reads the mesh hierarchy; authored nodes are re-parented onto the procedural rig by name, so the existing procedural animation, anchors and hitboxes keep working. Units: 1 unit ≈ 1 m, facing −Z, rest pose with joints at zero.
- Player / Raven nodes: `torso head leftArm rightArm leftShoulder rightShoulder leftLeg rightLeg leftShin rightShin leftWing rightWing backpack leftPod rightPod`; anchors `gunMuzzle missilePodL missilePodR bladeAnchor thrusterL thrusterR`. Any missing slot keeps its procedural part.
- HELIOS nodes: modules `torso noseL noseR bridge wingL wingR limbL limbR` (they follow the ship → mech transformation), anchors `weak_port weak_starboard weak_spire core`. An animation clip whose name contains `transform` replaces the procedural transformation and is scrubbed by the same 7.5 s clock.

## Audio replacement
The four signature moments (missile salvo, perfect dodge, HELIOS transform, finisher) are layered syntheses with drive and a hall reverb; they are the first candidates for authored samples.
Every sound is synthesized. Fill `AUDIO_ASSETS` in `src/assets.ts` with `{ sfxName: 'assets/sfx/file.ogg' }` (names: `laser missile lockTick locked chainKill melee slashHit boost dodge perfect nearMiss alarm ravenWarn bossWarning transform finisher explosion …`, see `proc` in `src/audio.ts`); a loaded sample plays instead of the synth with no gameplay change.

## Notes
- Visual speed is one intensity value (normal 0.4 → combat 0.55 → boost 0.75 → blade lunge 0.9 → mass driver tunnel 1.0 → finisher 1.1; speed lines and radial blur ramp steeply above combat so cruise stays calm) driving FOV, speed lines, radial blur, chromatic aberration, camera jitter, thruster length and engine pitch (`vfxTarget` in `src/main.ts`).
- Performance: adaptive pixel ratio (0.6–1.5) reacts to frame time. Likely heavy spots to watch with `?fps` on a real GPU: additive particle overdraw during big explosions (7000 cap), the 6 pooled point lights (they cost on every lit material even when idle), and the half-float bloom chain.
- `npm audit` (5 findings: esbuild/vite dev server, micromatch/braces via vite-plugin-singlefile) only affects local dev/build tooling, not the shipped single HTML file. Fixing requires major-version upgrades, so it is left as is.

# Hero asset brief (RC3)

Status: **no authored models or produced audio are in the repository.** `HERO_ASSETS` and `AUDIO_ASSETS` in `src/assets.ts` are empty, so everything on screen is the procedural blockout and every sound is synthesized. That is the fallback, not final art.

Integration contract (node names, units, anchors) is in the README, *Hero assets (GLTF)*. Test a file without editing code: `?hero=player:assets/player.glb` / `raven:` / `helios:`, and `?sfx=missile:assets/sfx/missile.ogg,…`. `window.__audio.sampleState()` lists which sounds are samples.

Current procedural budgets for reference: player ≈ 2.1k tris / 10 materials, Raven ≈ 2.2k / 9, HELIOS ≈ 4.0k / 8.

## Priority
1. Player  2. HELIOS  3. Raven

## Player
- **Silhouette:** reads at 30 px tall from behind and three-quarter rear (the gameplay camera). Head, shoulders and backpack must separate from the torso against a bright city / sky.
- **Armor layering:** two or three readable plate layers over a dark under-frame; panel lines carry the cold energy accents.
- **Backpack / thrusters:** large, rear-facing, the main boost read. `thrusterL` / `thrusterR` anchors at the nozzle exits.
- **Missile pods:** shoulder or back mounted, open-able covers. Anchors `missilePodL` / `missilePodR` at the launch faces.
- **Blade:** `bladeAnchor` at the hilt in the left hand; the energy blade is drawn by the game.
- **Gun:** right-arm rifle, `gunMuzzle` at the barrel tip.
- **Readable limbs:** separate `leftArm rightArm leftLeg rightLeg leftShin rightShin` nodes, pivots at shoulder / hip / knee. `leftWing rightWing` fold for boost.
- **Accents:** cold cyan / blue emissive (glow color is set by the game; give emissive masks).
- **Budget:** ≤ 15k tris, ≤ 8 materials, 1 unit ≈ 1 m, facing −Z, rest pose with every joint at zero rotation.

## Raven (rival)
- Same class and rig as the player (same node names), visibly the same generation of machine.
- **Hostile warm energy:** red / orange emissive.
- **More aggressive proportions:** longer forearms and blade, forward-leaning stance, sharper head and shoulder line.
- **Melee readability:** the blade arm and its wind-up must read from the player's camera at 60–100 m.
- Budget as player.

## HELIOS (boss)
- **Phase 1:** battleship / mech hybrid, massive scale (current blockout spans roughly 200 m).
- **Transformation-capable modules**, separate nodes that the game moves during the 7.5 s transform: `torso noseL noseR bridge wingL wingR limbL limbR`. Optional clip whose name contains `transform` replaces the procedural move and is scrubbed by the same clock.
- **Core:** `core` anchor, center chest in Phase 2, the finisher target.
- **Three weak points:** `weak_port weak_starboard weak_spire`, each on a different silhouette edge so the lock-on reads.
- **Budget:** ≤ 40k tris, ≤ 10 materials.

## Motion acceptance after a model swap
Authored nodes ride on the procedural rig, so the procedural animation should carry over. Check each with the showcase routes (`?showcase=…&auto`) and `?fps`:
- **Player:** banking on strafe, boost posture (torso pitch, wings), rifle recoil (right arm kick), blade anticipation and recovery, thruster flames at the new anchors, wings.
- **Raven** (`showcase=raven`): dodge, melee wind-up, death.
- **HELIOS** (`showcase=boss`, `transform`, `finisher`): weak points sit on the hull, Phase 1 attacks, transform does not leave modules behind, Phase 2, finisher camera frames the core.

## Audio
All sounds are synthesized. Produced samples plug into `AUDIO_ASSETS` as `name: url` or `name: { url, gain }`. Priority events (names are the keys):

`boost missile lockTick locked laser melee slashHit perfect nearMiss ravenWarn bossWarning transform finisher explosion`

These four must be trailer quality before anything else:
1. **Missile salvo** (`missile`, `lockTick`, `locked`, `chainKill`): crisp lock ticks rising in pitch, a punchy multi-launch, a cascading chain of hits.
2. **Perfect dodge** (`perfect`): a short, bright time-slow whoosh with a tonal sting; must cut through combat.
3. **HELIOS transform** (`transform`): ~7.5 s, mechanical anticipation → heavy servo and plate movement → a reveal hit at the end.
4. **Finisher** (`finisher`): ~12 s, the game ducks the mix to near silence first; the sample needs a held breath, the strike, and a long tail.

For each produced sample check gain against the synth mix (no clipping on the master), latency (trim leading silence), layering with music, and relative loudness to `explosion`.

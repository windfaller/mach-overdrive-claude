# MACH OVERDRIVE — Hero Asset Brief (RC3)

**Status:** no authored hero models exist yet. `HERO_ASSETS` in `src/assets.ts` is empty, so the game ships the procedural placeholder meshes. These placeholders are blockouts. They are **not** final art.

The loading pipeline is finished and covered by tests. `npm run smoke -- hero` loads GLTF fixtures and checks four things:
- authored nodes attach to the rig;
- anchors move to the authored positions;
- banking and blade motion still read on the authored meshes;
- the Raven and HELIOS sequences still complete.

Priority order: **1. Player → 2. HELIOS → 3. Raven.**

Art direction is original. Do not copy Gundam, ZOE, Armored Core or Macross designs. Energy color is the faction code:
- **cool cyan/blue** = player;
- **warm red/orange/magenta** = hostile.

The game uses that code for readability, so keep it.

---

## Common technical rules (all three)

| | |
|---|---|
| Format | `.glb` (binary glTF 2.0), one file per hero, in `public/assets/` |
| Units / axes | 1 unit = 1 m, **+Y up, facing −Z** (the camera mostly sees the back) |
| Origin | hips / centre of mass at (0,0,0) |
| Rest pose | every joint at **zero rotation**, which is the pose the rig binds in. Arms hang slightly forward and legs are straight. |
| Hierarchy | flat is fine. The loader finds nodes **by name** and re-parents them onto the gameplay rig, which keeps driving the animation. Any missing slot keeps its procedural part. |
| Pivots | each part's pivot sits at its joint: shoulder for an arm, hip for a thigh, knee for a shin, wing root for a wing |
| Materials | PBR metal/rough. Put energy and glow surfaces on a separate material named `*_glow` with an emissive colour. Bloom picks those up, so don't bake glow into albedo. |
| Budget | Player ≤ 25k tris and ≤ 3 materials. Raven ≤ 25k tris. HELIOS ≤ 120k tris and ≤ 6 materials. 2k textures max. No skinning (rigid parts only). |
| Draw calls | merge each slot into 1–3 meshes. Ghost after-images clone the rig, so mesh count multiplies. |

## 1. Player — interceptor mech (`player.glb`)

**Silhouette from behind at 30–60 m:**
- a wide V of three-feather wing binders over a twin-nacelle backpack;
- a narrow waist and long legs;
- a swept crest on the head.

It must read as fast, light and aerospace. Avoid a bulky tank.

**Armour layering:** three depth layers:
1. dark under-frame;
2. mid-grey armour plates with panel breaks;
3. light-grey edge trims.

Leave visible gaps at the waist, knees and elbows so the limbs read in motion.

**Backpack / thrusters:**
- two main nozzles, which are the brightest cool-blue points;
- calf thrusters;
- foot vents.

**Missile pods:** one on each shoulder or upper back, hinged so they can kick open (the rig rotates them on X). Put the cells on the face that opens.

**Weapons:**
- rifle in the right hand;
- energy blade emitter on the left forearm.

**Readable limbs:**
- arms and legs must separate from the torso against a dark city;
- use the light trims and cool glow lines along the outer edges.

| Node name | Rig slot | Notes |
|---|---|---|
| `torso` | chest / waist | lean, bank, recoil |
| `head` | head | aim tracking |
| `leftArm`, `rightArm` | shoulders | right = rifle (aim pose), left = blade arm (anticipation → swing → recovery) |
| `leftLeg`, `rightLeg` | hips | |
| `leftShin`, `rightShin` | knees | |
| `leftWing`, `rightWing` | wing roots | spring physics on Z; spread when boosting |
| `backpack` | pack | |

| Anchor (empty node) | Used for |
|---|---|
| `gunMuzzle` | rifle shot origin + muzzle flash |
| `missilePodL`, `missilePodR` | missile launch points |
| `bladeAnchor` | blade origin on the left forearm |
| `thrusterL`, `thrusterR` | main flame cones + engine trails (flame points +Z) |

## 2. HELIOS — battleship → giant mech (`helios.glb`)

**Phase 1 (ship form):**
- a battleship that fills the sky (the rig scales it by 1.9);
- twin forward prows;
- a central bridge tower;
- swept wing hangars;
- engine limbs folded along the hull.

**Massive scale cues:**
- many small repeated details (hatches, lights, gun turrets);
- strong top-down lighting breaks.

**Transformation-capable modules.** Each module is one node that the 7.5 s transform moves:
- `torso`, the central hull and future chest;
- `noseL` and `noseR`, the prows that become arms;
- `bridge`, which becomes the head;
- `wingL` and `wingR`;
- `limbL` and `limbR`, the engine pods that become legs.

Modules must not interpenetrate badly at either end pose. Faces that are hidden in ship form can carry the mech-form detail.

**Optional animation:** you can author the transform yourself as a clip whose name contains `transform`. The game scrubs it with the same 7.5 s clock in place of the procedural blend.

**Core:** a large exposed reactor at the chest centre, warm and very bright, revealed in phase 2 and at the finisher. Anchor: `core`.

**Three weak points:** these are the phase 1 targets. Make them armoured glowing nodes that look breakable. Anchors:
- `weak_port`, on the left hangar;
- `weak_starboard`, on the right hangar;
- `weak_spire`, on the bridge tower.

## 3. Raven — elite rival (`raven.glb`)

**Same-class rival:** use the player's proportions and node list, so the same rig and anchors apply. The game scales it by 1.5.

**Silhouette:**
- hunched and predatory;
- spiked pauldrons;
- angular bat-like binders instead of feathers;
- a mono-eye;
- horns or a blade crest.

**Hostile warm energy:** magenta-red glow lines and thrusters.

**Melee readability:** the left arm carries a long blade, about 1.4× the player's. The silhouette of the blade arm raised in anticipation must read at 80 m. Give the arm a bright edge so the wind-up is visible.

**Evade and death:** rigid parts, no special nodes. The game spawns after-image ghosts from the rig and handles the explosion.

## Acceptance

1. Add the files to `public/assets/` and fill in `HERO_ASSETS`, or test with `?hero=player:assets/player.glb,…`.
2. `npm run smoke` passes, including the `hero` group.
3. `?showcase=missile|blade|raven|transform|finisher` all read clearly. Check:
   - banking;
   - boost posture;
   - rifle recoil;
   - blade anticipation and recovery;
   - thrusters and wings;
   - the Raven's dodge, melee wind-up and death;
   - HELIOS weak points, phase 1, the transform, phase 2 and the finisher.
4. `?showcase=benchmark` on a real GPU stays PASS.

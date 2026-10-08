import * as THREE from 'three';
import type { Mech } from './models';
import { loadSamples } from './audio';

/**
 * Hero asset manifest. Leave entries empty to use the procedural models (the default, always works).
 * Drop authored files in /public/assets and point at them here, or override per run with
 * ?hero=player:assets/player.glb,raven:assets/raven.glb,helios:assets/helios.glb
 */
export const HERO_ASSETS: { player?: string; raven?: string; helios?: string } = {};
/** Optional wav/ogg replacements keyed by sfx name (laser, missile, lockTick, locked, melee, slashHit, boost, perfect, ...). */
export const AUDIO_ASSETS: Record<string, string> = {};

/** Node names the mapping layer looks for. Missing slots keep their procedural part. */
export const MECH_SLOTS = {
  torso: 'torso', head: 'head', armL: 'leftArm', armR: 'rightArm', legL: 'leftLeg', legR: 'rightLeg', shinL: 'leftShin', shinR: 'rightShin',
  wingL: 'leftWing', wingR: 'rightWing', pack: 'backpack',
} as const;
export const MECH_ANCHORS = { gunTip: 'gunMuzzle', podL: 'missilePodL', podR: 'missilePodR', blade: 'bladeAnchor', thrL: 'thrusterL', thrR: 'thrusterR', melee: 'meleeAnchor' } as const;
/** HELIOS: module nodes (transform targets), weak point / core anchors, and optional groups. */
export const HELIOS_SLOTS = { torso: 'torso', noseL: 'noseL', noseR: 'noseR', bridge: 'bridge', wingL: 'wingL', wingR: 'wingR', engL: 'limbL', engR: 'limbR' } as const;
export const HELIOS_ANCHORS = { weak0: 'weak_port', weak1: 'weak_starboard', weak2: 'weak_spire', core: 'core' } as const;

function find(root: THREE.Object3D, name: string) { let r: THREE.Object3D | null = null; root.traverse(o => { if (!r && o.name === name) r = o; }); return r as THREE.Object3D | null; }

/**
 * Re-home authored nodes onto the procedural rig. The rig keeps driving gameplay animation; the
 * authored meshes simply ride on the matching rig groups. Rig and model must share the rest pose
 * and units (1 unit ≈ 1 m, facing -Z, origin at the hips / center of mass).
 */
export function mapMech(mech: Mech, src: THREE.Object3D) {
  const root = mech.root;
  const saved = { p: root.position.clone(), q: root.quaternion.clone(), s: root.scale.clone() };
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
  // bind in the rest pose: every rig joint at zero rotation
  const rest = new Map<THREE.Object3D, THREE.Euler>();
  root.traverse(o => { if (o === root || o.userData.proc) return; rest.set(o, o.rotation.clone()); o.rotation.set(0, 0, 0); });
  // authored file is expressed in the rig's own space: parent it to the rig root while re-homing
  src.position.set(0, 0, 0); src.quaternion.identity(); src.scale.set(1, 1, 1); root.add(src);
  root.updateMatrixWorld(true);
  let used = 0;
  for (const [slot, name] of Object.entries(MECH_SLOTS)) {
    const node = find(src, name); const grp = (mech as any)[slot] as THREE.Object3D | undefined;
    if (!node || !grp) continue;
    for (const c of grp.children) if (c.userData.proc) c.visible = false;
    grp.attach(node); used++;
  }
  // anchors: copy authored positions into the rig's anchor objects
  const anchor = (name: string, target?: THREE.Object3D) => {
    const n = find(src, name) || find(root, name); if (!n || !target || !target.parent) return;
    const w = n.getWorldPosition(new THREE.Vector3()); target.position.copy(target.parent.worldToLocal(w));
  };
  anchor(MECH_ANCHORS.gunTip, mech.gunTip); anchor(MECH_ANCHORS.podL, mech.podL); anchor(MECH_ANCHORS.podR, mech.podR);
  anchor(MECH_ANCHORS.blade, mech.blade); anchor(MECH_ANCHORS.thrL, mech.flames[0]); anchor(MECH_ANCHORS.thrR, mech.flames[1]);
  root.remove(src);
  root.traverse(o => { const e = rest.get(o); if (e) o.rotation.copy(e); });
  root.position.copy(saved.p); root.quaternion.copy(saved.q); root.scale.copy(saved.s);
  return used;
}

export function mapHelios(mods: Record<string, { g: THREE.Group }>, anchors: { weak: THREE.Object3D[]; core: THREE.Object3D }, src: THREE.Object3D, root: THREE.Object3D) {
  src.position.set(0, 0, 0); src.quaternion.identity(); src.scale.set(1, 1, 1); root.add(src);
  root.updateMatrixWorld(true); let used = 0;
  for (const [slot, name] of Object.entries(HELIOS_SLOTS)) {
    const node = find(src, name); const m = mods[slot]; if (!node || !m) continue;
    for (const c of m.g.children) if (c.userData.proc) c.visible = false;
    m.g.attach(node); used++;
  }
  const wk = [HELIOS_ANCHORS.weak0, HELIOS_ANCHORS.weak1, HELIOS_ANCHORS.weak2];
  wk.forEach((n, i) => { const a = find(src, n) || find(root, n); const t = anchors.weak[i]; if (a && t && t.parent) t.position.copy(t.parent.worldToLocal(a.getWorldPosition(new THREE.Vector3()))); });
  const c = find(src, HELIOS_ANCHORS.core) || find(root, HELIOS_ANCHORS.core); if (c && anchors.core.parent) anchors.core.position.copy(anchors.core.parent.worldToLocal(c.getWorldPosition(new THREE.Vector3())));
  root.remove(src);
  return used;
}

function overrides() {
  const q = new URLSearchParams(location.search).get('hero'); const out: Record<string, string> = { ...HERO_ASSETS } as any;
  if (q) for (const kv of q.split(',')) { const [k, v] = kv.split(':'); if (k && v) out[k] = v; }
  return out;
}

/** Loads whatever hero assets are configured. With an empty manifest this returns immediately. */
export async function loadHeroAssets(ctx: { player: any; enemies: any; boss: any }) {
  if (Object.keys(AUDIO_ASSETS).length) loadSamples(AUDIO_ASSETS);
  const list = overrides(); const keys = Object.keys(list).filter(k => list[k]);
  if (!keys.length) return;
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  await Promise.all(keys.map(async k => {
    try {
      const g = await loader.loadAsync(list[k]);
      g.scene.traverse((o: any) => { if (o.isMesh) { o.frustumCulled = false; } });
      if (k === 'player') ctx.player.applyHeroModel(g.scene);
      else if (k === 'raven') ctx.enemies.applyRavenModel(g.scene);
      else if (k === 'helios') ctx.boss.applyHeroModel(g.scene, g.animations);
      console.info(`[hero] ${k} loaded from ${list[k]}`);
    } catch (e) { console.warn(`[hero] ${k} failed, keeping procedural model`, e); }
  }));
}

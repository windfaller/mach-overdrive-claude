import * as THREE from 'three';
import { buildMech, mats } from '../src/models';
import { writeFileSync } from 'node:fs';
const variant = process.argv[2] || 'player';
const m: any = variant === 'raven' ? buildMech([3, 0.25, 0.7], mats.dark, mats.enemyMid, [3, 0.4, 0.8], 'raven') : buildMech([0.15, 1.3, 2.0]);
m.root.traverse((o: any) => { if (o !== m.root && !o.userData.proc && !o.isMesh) o.rotation.set(0, 0, 0); });
m.root.updateMatrixWorld(true);
const slots: Record<string, any> = { torso: m.torso, head: m.head, leftArm: m.armL, rightArm: m.armR, leftShoulder: m.shoulderL, rightShoulder: m.shoulderR,
  leftLeg: m.legL, rightLeg: m.legR, leftShin: m.shinL, rightShin: m.shinR, leftWing: m.wingL, rightWing: m.wingR, backpack: m.pack, leftPod: m.podGL, rightPod: m.podGR };
const matName = (mt: any) => mt === mats.dark ? 'dark' : mt === mats.mid ? 'mid' : mt === mats.light ? 'light' : mt.type === 'MeshBasicMaterial' ? 'glow' : 'other';
const out: any = { slots: {}, anchors: {} };
for (const [name, g] of Object.entries(slots)) {
  const piv = new THREE.Vector3(); g.getWorldPosition(piv);
  const parts: any[] = [];
  const groups = g.userData.proc ? [g] : g.children.filter((c: any) => c.userData.proc && !Object.values(slots).includes(c));
  for (const c of groups) for (const ms of c.children) {
    if (!(ms as any).isMesh) continue;
    const geo = ms.geometry.clone().applyMatrix4(ms.matrixWorld);
    parts.push({ mat: matName(ms.material), pos: Array.from(geo.getAttribute('position').array).map((v: number) => +v.toFixed(5)) });
  }
  out.slots[name] = { pivot: piv.toArray(), parts };
}
for (const [n, o] of Object.entries({ gunMuzzle: m.gunTip, missilePodL: m.podL, missilePodR: m.podR, bladeAnchor: m.blade, thrusterL: m.flames[0], thrusterR: m.flames[1] })) out.anchors[n] = (o as any).getWorldPosition(new THREE.Vector3()).toArray();
const outFile = process.argv[3] || `${variant}.json`;
writeFileSync(outFile, JSON.stringify(out));
console.log(variant, Object.entries(out.slots).map(([k, v]: any) => k + ':' + v.parts.length).join(' '));

// Dumps the procedural HELIOS hull per transforming module, in each module's own space, for tools/remaster_mech.py.
// usage: npx esbuild tools/dump-helios.ts --bundle --platform=node --format=esm --outfile=/tmp/dumph.mjs && node /tmp/dumph.mjs /tmp/helios.json
import * as THREE from 'three';
import { Boss } from '../src/boss';
import { writeFileSync } from 'node:fs';
const b: any = new Boss(new THREE.Scene());
const names: Record<string, string> = { torso: 'torso', noseL: 'noseL', noseR: 'noseR', bridge: 'bridge', wingL: 'wingL', wingR: 'wingR', engL: 'limbL', engR: 'limbR' };
const matName = (mt: any) => mt.type === 'MeshBasicMaterial' ? 'glow' : mt.color.getHex() === 0x141318 ? 'dark' : 'mid';
const out: any = { slots: {}, anchors: {}, local: true };
for (const [k, name] of Object.entries(names)) {
  const g: THREE.Group = b.mods[k].g; g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(); const parts: any[] = [];
  for (const c of g.children) if (c.userData.proc) for (const ms of c.children as any[]) {
    if (!ms.isMesh) continue;
    const geo = ms.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, ms.matrixWorld));
    const nonIdx = geo.index ? geo.toNonIndexed() : geo;
    parts.push({ mat: matName(ms.material), pos: Array.from(nonIdx.getAttribute('position').array as Float32Array).map(v => +v.toFixed(4)) });
  }
  out.slots[name] = { pivot: [0, 0, 0], parts };
}
writeFileSync(process.argv[2] || 'helios.json', JSON.stringify(out));
console.log(Object.entries(out.slots).map(([k, v]: any) => k + ':' + v.parts.length + '/' + v.parts.reduce((s: number, p: any) => s + p.pos.length / 9, 0)).join(' '));

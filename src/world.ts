import * as THREE from 'three';
import { G, rand, pick, clamp } from './core';
import { buildCarrier, buildBattleshipHalf, glow, additive } from './models';
import { fx } from './fx';

const SPAN = 1800, FAR = -1700, NEAR = 80;

// ---------- atmosphere presets ----------
type Atmo = { fog: number; dens: number; top: number; hor: number; bot: number; sun: number; sunDir: number[]; hemiS: number; hemiG: number; hemiI: number; dir: number; dirI: number; line: number; stars: number; exp: number };
const ATMO: Record<string, Atmo> = {
  city: { fog: 0x120f2e, dens: 0.0011, top: 0x020210, hor: 0x3a1a5e, bot: 0x0c0b22, sun: 0xff4fa0, sunDir: [0.3, 0.08, -1], hemiS: 0x6070ff, hemiG: 0x301030, hemiI: 1.0, dir: 0xa0b0ff, dirI: 1.6, line: 0x80d0ff, stars: 1, exp: 1.0 },
  highway: { fog: 0x2a1438, dens: 0.0010, top: 0x060418, hor: 0xb03a5a, bot: 0x1a0c22, sun: 0xff7050, sunDir: [-0.2, 0.06, -1], hemiS: 0x8070ff, hemiG: 0x402020, hemiI: 1.0, dir: 0xffb090, dirI: 1.8, line: 0xffc0a0, stars: 0.6, exp: 1.0 },
  fleet: { fog: 0x4a2418, dens: 0.0009, top: 0x140810, hor: 0xff6a2a, bot: 0x2a0e08, sun: 0xffa040, sunDir: [0.15, 0.12, -1], hemiS: 0xffa070, hemiG: 0x301010, hemiI: 1.1, dir: 0xffa060, dirI: 2.4, line: 0xffd0a0, stars: 0, exp: 1.0 },
  tunnel: { fog: 0x02080e, dens: 0.0024, top: 0x000000, hor: 0x02080e, bot: 0x000000, sun: 0x000000, sunDir: [0, 1, 0], hemiS: 0x40c0ff, hemiG: 0x102030, hemiI: 1.2, dir: 0x60e0ff, dirI: 1.2, line: 0x80ffff, stars: 0, exp: 1.0 },
  sky: { fog: 0x9a6a88, dens: 0.00055, top: 0x0a1440, hor: 0xffa070, bot: 0xc06a80, sun: 0xffc080, sunDir: [-0.35, 0.1, -1], hemiS: 0xa0b0ff, hemiG: 0x804050, hemiI: 1.2, dir: 0xffd0a0, dirI: 2.6, line: 0xffffff, stars: 0.2, exp: 1.0 },
};

const skyVert = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const skyFrag = `uniform vec3 uTop, uHor, uBot, uSun, uSunDir; uniform float uStars, uTime; varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){ vec3 d = normalize(vDir); float y = d.y;
  vec3 c = y > 0.0 ? mix(uHor, uTop, pow(clamp(y,0.0,1.0), 0.45)) : mix(uHor, uBot, pow(clamp(-y,0.0,1.0), 0.35));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSun * (pow(s, 900.0) * 10.0 + pow(s, 40.0) * 0.5 + pow(s, 4.0) * 0.12);
  c += uHor * 0.35 * exp(-abs(y) * 18.0);
  if (uStars > 0.0 && y > 0.05) { vec3 g = floor(d * 260.0); float st = step(0.9975, h(g)); c += vec3(st) * uStars * smoothstep(0.05, 0.4, y) * (0.6 + 0.4 * sin(uTime * 3.0 + h(g) * 50.0)); }
  gl_FragColor = vec4(c, 1.0); }`;

const bVert = `attribute float aSeed; varying vec3 vL; varying vec3 vN; varying float vSeed; varying vec3 vSc;
#include <fog_pars_vertex>
void main(){ vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vL = (position + vec3(0.0, 0.5, 0.0)) * sc; vSc = sc; vN = normal; vSeed = aSeed;
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const bFrag = `uniform vec3 uBase, uW1, uW2, uEdge; uniform float uTime; varying vec3 vL; varying vec3 vN; varying float vSeed; varying vec3 vSc;
#include <common>
#include <fog_pars_fragment>
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){ vec3 n = normalize(vN); vec2 f;
  if (abs(n.x) > 0.5) f = vL.zy; else if (abs(n.z) > 0.5) f = vL.xy; else f = vL.xz;
  float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.7, 0.6))), 0.0);
  vec3 col = uBase * lit;
  if (abs(n.y) < 0.5) {
    float bands = fract(vSeed * 7.13);
    vec2 cs = bands > 0.5 ? vec2(4.0, 5.0) : vec2(2.6, 4.0);
    vec2 cell = floor(f / cs); vec2 g = fract(f / cs);
    float win = step(0.18, g.x) * step(g.x, 0.82) * step(0.22, g.y) * step(g.y, 0.78);
    float r = hh(cell + vSeed * 31.0);
    float on = step(0.72 - 0.18 * fract(vSeed * 3.7), r);
    vec3 wc = mix(uW1, uW2, step(0.86, r)) * (0.25 + 0.75 * hh(cell + 7.3));
    col += win * on * wc;
    float strip = step(0.97, fract(f.x / 9.0 + vSeed)) * step(0.6, fract(vSeed * 11.0));
    col += strip * uEdge * 1.6;
    float top = smoothstep(2.0, 0.0, vSc.y - vL.y) * step(0.35, fract(vSeed * 5.3));
    col += top * uEdge * 2.2;
    float ad = step(0.82, fract(vSeed * 13.7)) * step(abs(vL.y - vSc.y * fract(vSeed * 2.9) * 0.8 - 20.0), 6.0);
    col += ad * mix(uEdge, uW2, 0.5) * (1.4 + 0.6 * sin(uTime * 4.0 + vSeed * 20.0));
  } else col += uEdge * 0.05;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

function stripMat(frag: string, extra: Record<string, any> = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScroll: { value: 0 }, uTime: { value: 0 }, ...extra }]),
    vertexShader: `varying vec3 vL; varying vec2 vUv;
    #include <fog_pars_vertex>
    void main(){ vL = position; vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
    fragmentShader: `uniform float uScroll, uTime; varying vec3 vL; varying vec2 vUv;
    #include <common>
    #include <fog_pars_fragment>
    ${frag}`, fog: true,
  });
}
const roadFrag = `void main(){ float z = vL.z - uScroll; float x = vL.x;
  vec3 c = vec3(0.025, 0.028, 0.04);
  float lane = abs(fract(x / 7.6 + 0.5) - 0.5) * 7.6; float dash = step(0.5, fract(z / 14.0));
  c += vec3(0.6, 1.4, 2.0) * step(lane, 0.12) * dash * step(abs(x), 21.0);
  c += vec3(2.6, 0.9, 0.3) * step(21.0, abs(x)) * step(abs(x), 21.6);
  c += vec3(0.25, 0.1, 0.3) * pow(0.5 + 0.5 * sin(z * 0.05 + x * 0.1), 8.0);
  float lamp = smoothstep(4.0, 0.0, abs(fract(z / 40.0) * 40.0 - 20.0)) * smoothstep(23.0, 15.0, abs(x)) * 0.35;
  c += vec3(1.0, 0.7, 0.4) * lamp;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;
const wallFrag = `void main(){ float z = vL.z - uScroll; float y = vL.y;
  vec3 c = vec3(0.05, 0.05, 0.07);
  c += vec3(2.5, 0.8, 0.25) * step(abs(y - 0.4), 0.12);
  c += vec3(0.4, 1.6, 2.4) * step(0.92, fract(z / 10.0)) * step(abs(y + 0.3), 0.25);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;
const groundFrag = `void main(){ float z = vL.z - uScroll; vec2 p = vec2(vL.x, z);
  vec3 c = vec3(0.01, 0.01, 0.025);
  vec2 g = abs(fract(p / 60.0 + 0.5) - 0.5) * 60.0;
  float line = step(min(g.x, g.y), 0.6);
  c += vec3(0.3, 0.15, 0.9) * line * 0.6;
  vec2 b = floor(p / 60.0); float r = fract(sin(dot(b, vec2(12.9, 78.2))) * 43758.5);
  vec2 gg = fract(p / 6.0); float dots = step(0.8, fract(sin(dot(floor(p / 6.0), vec2(4.1, 7.7))) * 9137.0)) * step(0.3, gg.x) * step(gg.x, 0.6) * step(0.3, gg.y) * step(gg.y, 0.6);
  c += mix(vec3(1.0, 0.6, 0.2), vec3(0.3, 0.8, 1.2), step(0.5, r)) * dots * 0.9;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;
const tunnelFrag = `void main(){ float z = vL.z - uScroll; float a = atan(vL.y, vL.x) / 6.2831853 + 0.5;
  vec3 c = vec3(0.03, 0.04, 0.05);
  vec2 g = vec2(fract(a * 24.0), fract(z / 9.0));
  float seam = step(0.96, g.x) + step(0.95, g.y);
  c += vec3(0.05, 0.08, 0.1) * seam;
  float panel = step(0.5, fract(sin(dot(floor(vec2(a * 24.0, z / 9.0)), vec2(12.9, 78.2))) * 43758.5));
  c += vec3(0.02, 0.025, 0.03) * panel;
  float strips = step(abs(fract(a * 6.0) - 0.5), 0.008);
  c += vec3(0.3, 2.0, 2.8) * strips;
  float ring = smoothstep(1.2, 0.0, abs(fract(z / 80.0) * 80.0 - 40.0));
  c += vec3(0.6, 2.2, 3.0) * ring;
  float warn = step(abs(fract(z / 240.0) * 240.0 - 120.0), 3.0) * step(0.5, fract((a * 48.0) + z * 0.1));
  c += vec3(2.5, 0.9, 0.1) * warn;
  float pulse = smoothstep(6.0, 0.0, abs(fract((z + uTime * 400.0) / 600.0) * 600.0 - 300.0));
  c += vec3(0.5, 1.5, 2.5) * pulse * strips * 3.0;
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

class Strip {
  group = new THREE.Group(); state = 'off'; scroll = 0; len: number; mats: THREE.ShaderMaterial[] = []; restZ = 40; onEnd?: () => void;
  constructor(len: number) { this.len = len; this.group.visible = false; }
  enter(dist = 1500) { this.state = 'enter'; this.group.position.z = -dist; this.group.visible = true; }
  place() { this.state = 'on'; this.group.position.z = this.restZ; this.group.visible = true; }
  exit() { if (this.state !== 'off') this.state = 'exit'; }
  off() { this.state = 'off'; this.group.visible = false; }
  update(dt: number, ws: number) {
    if (this.state === 'off') return;
    if (this.state === 'enter') { this.group.position.z += ws * dt; if (this.group.position.z >= this.restZ) { this.group.position.z = this.restZ; this.state = 'on'; } }
    else if (this.state === 'on') this.scroll += ws * dt;
    else if (this.state === 'exit') { this.group.position.z += ws * dt; if (this.group.position.z - this.len > 60) this.off(); }
    for (const m of this.mats) { m.uniforms.uScroll.value = this.scroll % 7200; m.uniforms.uTime.value = G.time; }
  }
}

interface Rec { x: number; y: number; z: number; w: number; h: number; d: number; v: number; on: boolean; kind: number }

export class World {
  scene: THREE.Scene; sky: THREE.Mesh; skyU: any; hemi: THREE.HemisphereLight; dirL: THREE.DirectionalLight;
  atmoFrom: any = null; atmoTo: Atmo = ATMO.city; atmoT = 1; atmoDur = 1; cur: any = {};
  flags: Record<string, boolean> = {};
  bld: THREE.InstancedMesh; bRec: Rec[] = []; bMat: THREE.ShaderMaterial;
  traffic: THREE.InstancedMesh; tRec: Rec[] = [];
  pillars: THREE.InstancedMesh; pRec: Rec[] = [];
  clouds: THREE.InstancedMesh; cRec: Rec[] = [];
  rocks: THREE.InstancedMesh; rRec: Rec[] = [];
  signs: { mesh: THREE.Mesh; z: number; on: boolean }[] = [];
  ships: { g: THREE.Group; v: number; on: boolean }[] = [];
  road: Strip; ground: Strip; tunnel: Strip; endLight: THREE.Mesh; mouth: THREE.Group;
  m4 = new THREE.Matrix4(); q = new THREE.Quaternion(); v = new THREE.Vector3(); s = new THREE.Vector3(); col = new THREE.Color();
  flakT = 0; cq = new THREE.Quaternion(); flatQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); eu = new THREE.Euler();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uStars: { value: 1 }, uTime: { value: 0 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);
    scene.fog = new THREE.FogExp2(0x000000, 0.001);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); scene.add(this.hemi);
    this.dirL = new THREE.DirectionalLight(0xffffff, 1); this.dirL.position.set(0.4, 1, 0.6); scene.add(this.dirL);

    // buildings
    const bg = new THREE.BoxGeometry(1, 1, 1);
    const N = 340; const seeds = new Float32Array(N); for (let i = 0; i < N; i++) seeds[i] = Math.random();
    bg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.bMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uBase: { value: new THREE.Color(0x10121c) }, uW1: { value: new THREE.Color(0.95, 0.55, 0.25) }, uW2: { value: new THREE.Color(0.2, 0.9, 1.6) }, uEdge: { value: new THREE.Color(1.8, 0.25, 1.3) }, uTime: { value: 0 } }]), vertexShader: bVert, fragmentShader: bFrag, fog: true });
    this.bld = new THREE.InstancedMesh(bg, this.bMat, N); this.bld.frustumCulled = false; this.bld.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < N; i++) this.bRec.push({ x: 0, y: 0, z: FAR + (i / N) * SPAN, w: 0, h: 0, d: 0, v: 0, on: false, kind: 0 });
    scene.add(this.bld);
    // signs
    const words = ['超限', 'NEO//KAI', '零式', 'HYPERION', '電脳街', 'AXIOM', 'OVERDRIVE', '夜光', 'VOLT 24', '星海'];
    const cols = ['#ff3ad0', '#28e8ff', '#ffb020', '#7cff5a', '#ff4a4a'];
    const texs = words.map((w, i) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d')!;
      const col = cols[i % cols.length]; x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
      x.fillStyle = col; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 20; x.fillText(w, 256, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
    for (let i = 0; i < 26; i++) {
      const m = new THREE.MeshBasicMaterial({ map: texs[i % texs.length], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      m.color.setScalar(1.3);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(48, 12), m); mesh.visible = false; scene.add(mesh); this.signs.push({ mesh, z: 0, on: false });
    }
    // traffic
    this.traffic = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 4), new THREE.MeshBasicMaterial(), 360);
    this.traffic.frustumCulled = false; this.traffic.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 360; i++) { this.tRec.push({ x: 0, y: 0, z: FAR + Math.random() * SPAN, w: 0, h: 0, d: 0, v: 0, on: false, kind: 0 }); this.traffic.setColorAt(i, this.col.setRGB(1, 1, 1)); }
    scene.add(this.traffic);
    // pillars
    this.pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 1, 5), new THREE.MeshStandardMaterial({ color: 0x1a1c24, metalness: 0.6, roughness: 0.5 }), 40);
    this.pillars.frustumCulled = false; for (let i = 0; i < 40; i++) this.pRec.push({ x: 0, y: 0, z: FAR + i * 45, w: 0, h: 0, d: 0, v: 0, on: false, kind: 0 }); scene.add(this.pillars);
    // clouds
    const cMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: new THREE.Color(1, 0.7, 0.6) }, uShade: { value: new THREE.Color(0.4, 0.25, 0.35) } }]),
      vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vS;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vS = aSeed; vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
      fragmentShader: `uniform vec3 uCol, uShade; varying vec2 vUv; varying float vS;
      #include <common>
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p = vUv - 0.5; float d = length(p) * 2.0;
        float f = n(vUv * 4.0 + vS * 30.0) * 0.5 + n(vUv * 9.0 + vS * 11.0) * 0.3 + n(vUv * 19.0) * 0.2;
        float a = smoothstep(1.0, 0.25, d + (f - 0.5) * 0.9) * 0.85;
        if (a < 0.01) discard;
        vec3 c = mix(uShade, uCol, f);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`, fog: true, transparent: true, depthWrite: false,
    });
    const cg = new THREE.PlaneGeometry(1, 1); const cs = new Float32Array(150); for (let i = 0; i < 150; i++) cs[i] = Math.random(); cg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(cs, 1));
    this.clouds = new THREE.InstancedMesh(cg, cMat, 150); this.clouds.frustumCulled = false; this.clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 150; i++) this.cRec.push({ x: 0, y: 0, z: FAR + (i / 150) * SPAN, w: 0, h: 0, d: 0, v: 0, on: false, kind: 0 });
    scene.add(this.clouds);
    // rocks / wreckage
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x2a2630, metalness: 0.5, roughness: 0.6 }), 60);
    this.rocks.frustumCulled = false; for (let i = 0; i < 60; i++) this.rRec.push({ x: 0, y: 0, z: FAR + (i / 60) * SPAN, w: 0, h: 0, d: 0, v: rand(-1, 1), on: false, kind: 0 }); scene.add(this.rocks);
    // ships
    const sg = glow(2.5, 1.0, 0.4);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      if (i % 3 === 2) { g.add(buildBattleshipHalf(1, sg), buildBattleshipHalf(-1, sg)); g.scale.setScalar(rand(0.8, 1.3)); }
      else { g.add(buildCarrier(sg)); g.scale.setScalar(rand(1, 1.8)); }
      g.visible = false; scene.add(g); this.ships.push({ g, v: 0, on: false });
    }
    // strips
    this.road = new Strip(2600);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(46, 2600, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -1300), stripMat(roadFrag));
    road.position.y = -26; road.frustumCulled = false; this.road.mats.push(road.material as any); this.road.group.add(road);
    const wm = stripMat(wallFrag); this.road.mats.push(wm);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 2600).translate(0, 0, -1300), wm); w.position.set(s * 23.4, -25, 0); w.frustumCulled = false; this.road.group.add(w); }
    scene.add(this.road.group);
    this.ground = new Strip(3000);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(5000, 3000).rotateX(-Math.PI / 2).translate(0, 0, -1500), stripMat(groundFrag)); gr.position.y = -140; gr.frustumCulled = false;
    this.ground.mats.push(gr.material as any); this.ground.group.add(gr); scene.add(this.ground.group);
    this.tunnel = new Strip(4200);
    const tm = stripMat(tunnelFrag); this.tunnel.mats.push(tm);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 4200, 40, 1, true).rotateX(Math.PI / 2).translate(0, 0, -2100), tm); tube.material.side = THREE.BackSide; tube.frustumCulled = false; this.tunnel.group.add(tube);
    this.mouth = new THREE.Group();
    const wallM = new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.7, roughness: 0.5 });
    const wall = new THREE.Mesh(new THREE.RingGeometry(34, 700, 48, 1), wallM); this.mouth.add(wall);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(36, 2.5, 8, 48), glow(0.4, 2.2, 3)); this.mouth.add(frame);
    const frame2 = new THREE.Mesh(new THREE.TorusGeometry(48, 1.2, 6, 48), glow(3, 1, 0.2)); this.mouth.add(frame2);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 6), wallM); b.position.set(Math.cos(a) * 70, Math.sin(a) * 70, 3); b.rotation.z = a + Math.PI / 2; this.mouth.add(b);
      const l = new THREE.Mesh(new THREE.BoxGeometry(1, 50, 1), glow(0.4, 2, 3)); l.position.set(Math.cos(a) * 70, Math.sin(a) * 70, 6.2); l.rotation.z = a + Math.PI / 2; this.mouth.add(l); }
    this.tunnel.group.add(this.mouth);
    this.endLight = new THREE.Mesh(new THREE.CircleGeometry(34, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6), fog: false }));
    this.endLight.position.z = -4200 + 2; this.tunnel.group.add(this.endLight);
    scene.add(this.tunnel.group);
    this.setAtmo('city', 0.01);
  }

  setAtmo(name: string, dur: number) {
    this.atmoFrom = { ...this.cur }; this.atmoTo = ATMO[name]; this.atmoT = 0; this.atmoDur = dur;
    if (!this.cur.fog) { this.atmoT = 1; this.applyAtmo(1, true); }
  }
  applyAtmo(t: number, snap = false) {
    const to = this.atmoTo, fr = this.atmoFrom; const c = this.col; const tc = new THREE.Color();
    const mix = (key: string, hex: number) => { tc.setHex(hex); if (snap || !fr[key]) return tc.clone(); return fr[key].clone().lerp(tc, t); };
    for (const k of ['fog', 'top', 'hor', 'bot', 'sun', 'hemiS', 'hemiG', 'dir', 'line']) this.cur[k + '_'] = mix(k, (to as any)[k]);
    for (const k of ['dens', 'hemiI', 'dirI', 'stars']) this.cur[k + '_'] = snap || fr[k] === undefined ? (to as any)[k] : fr[k] + ((to as any)[k] - fr[k]) * t;
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(this.cur.fog_); fog.density = this.cur.dens_;
    this.skyU.uTop.value.copy(this.cur.top_); this.skyU.uHor.value.copy(this.cur.hor_); this.skyU.uBot.value.copy(this.cur.bot_); this.skyU.uSun.value.copy(this.cur.sun_);
    this.skyU.uSunDir.value.lerp(new THREE.Vector3(...to.sunDir), snap ? 1 : t); this.skyU.uStars.value = this.cur.stars_;
    this.hemi.color.copy(this.cur.hemiS_); this.hemi.groundColor.copy(this.cur.hemiG_); this.hemi.intensity = this.cur.hemiI_;
    this.dirL.color.copy(this.cur.dir_); this.dirL.intensity = this.cur.dirI_;
    G.lineColor = this.cur.line_;
    // the "cur" values are stored as the raw keys too, so the next transition starts from here
    for (const k of ['fog', 'top', 'hor', 'bot', 'sun', 'hemiS', 'hemiG', 'dir', 'line', 'dens', 'hemiI', 'dirI', 'stars']) this.cur[k] = this.cur[k + '_'];
    void c;
  }

  /** section: city | highway | fleet | tunnel | sky */
  setSection(name: string, instant = false) {
    const f = this.flags; for (const k of Object.keys(f)) f[k] = false;
    if (name === 'city') { f.buildings = f.signs = f.skyTraffic = f.ground = f.center = true; }
    if (name === 'highway') { f.buildings = f.signs = f.skyTraffic = f.roadTraffic = f.ground = f.pillars = true; }
    if (name === 'fleet') { f.clouds = f.ships = f.flak = true; }
    if (name === 'sky') { f.clouds = f.rocks = f.farShips = true; }
    if (name === 'highway') { if (instant) this.road.place(); else if (this.road.state === 'off' || this.road.state === 'exit') this.road.enter(1500); } else if (instant) this.road.off(); else this.road.exit();
    if (f.ground) { if (instant) this.ground.place(); else if (this.ground.state === 'off' || this.ground.state === 'exit') this.ground.enter(1400); } else if (instant) this.ground.off(); else this.ground.exit();
    if (name === 'tunnel') { if (instant) this.tunnel.place(); else this.tunnel.enter(1600); } else if (instant) this.tunnel.off();
    this.setAtmo(name, instant ? 0.01 : name === 'sky' ? 0.01 : 5);
    if (instant) this.prefill();
  }
  prefill() {
    for (const r of this.bRec) { r.z = FAR + Math.random() * SPAN; this.spawnB(r); }
    for (const r of this.cRec) { r.z = FAR + Math.random() * SPAN; this.spawnC(r); }
    for (const r of this.tRec) { r.z = FAR + Math.random() * SPAN; this.spawnT(r); }
    for (const r of this.rRec) { r.z = FAR + Math.random() * SPAN; this.spawnR(r); }
    for (const r of this.pRec) { this.spawnP(r); }
    for (const s of this.signs) s.on = false;
    for (const s of this.ships) { s.on = false; s.g.visible = false; }
    if (this.flags.ships || this.flags.farShips) for (const s of this.ships) { this.spawnShip(s); s.g.position.z = rand(-1700, -300); }
  }
  spawnB(r: Rec) {
    r.on = !!this.flags.buildings;
    if (!r.on) return;
    if (this.flags.center && Math.random() < 0.18) { r.x = rand(-50, 50); r.h = rand(30, 95); r.w = rand(16, 34); r.d = rand(16, 34); }
    else { const side = Math.random() < 0.5 ? -1 : 1; const near = Math.random() < 0.55; r.x = side * (near ? rand(48, 140) : rand(140, 520)); r.h = near ? rand(90, 260) : rand(140, 420); r.w = rand(18, 46); r.d = rand(18, 52);
      if (this.flags.roadTraffic) r.x = side * (near ? rand(60, 150) : rand(150, 520)); }
    r.y = -140;
    if (this.flags.signs && Math.abs(r.x) < 180 && Math.abs(r.x) > 40 && Math.random() < 0.3) {
      const s = this.signs.find(s => !s.on); if (s) { s.on = true; s.z = r.z; const side = Math.sign(r.x);
        s.mesh.position.set(r.x - side * (r.w / 2 + 1), rand(-20, Math.min(60, r.y + r.h - 10)), r.z); s.mesh.rotation.set(0, -side * Math.PI / 2 + side * 0.35, 0); s.mesh.visible = true; }
    }
  }
  spawnT(r: Rec) {
    const road = this.flags.roadTraffic && Math.random() < 0.55;
    r.on = road || !!this.flags.skyTraffic; if (!r.on) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (road) { r.x = pick([-19, -11.4, -3.8, 3.8, 11.4, 19]); r.y = -25.2; r.v = r.x < 0 ? rand(30, 60) : -rand(40, 80); r.kind = r.x < 0 ? 0 : 1; }
    else { const lane = Math.random() < 0.5 ? -1 : 1; r.x = lane * rand(42, 160); r.y = rand(-30, 70); r.v = dir * rand(30, 90); r.kind = dir > 0 ? 0 : 1; }
  }
  spawnC(r: Rec) {
    r.on = !!this.flags.clouds; if (!r.on) return;
    const below = Math.random() < 0.75;
    r.x = rand(-700, 700); r.y = below ? rand(-160, -70) : rand(60, 200); r.w = rand(140, 360); r.kind = below ? 0 : 1;
    if (!below && Math.abs(r.x) < 120) r.x = Math.sign(r.x || 1) * rand(120, 600);
  }
  spawnR(r: Rec) { r.on = !!this.flags.rocks; if (!r.on) return; const side = Math.random() < 0.5 ? -1 : 1; r.x = side * rand(55, 260); r.y = rand(-60, 80); r.w = rand(2, 14); }
  spawnP(r: Rec) { r.on = !!this.flags.pillars; }
  spawnShip(s: any) {
    s.on = true; s.g.visible = true; const side = Math.random() < 0.5 ? -1 : 1;
    s.g.position.set(side * rand(220, 650), rand(-90, 160), -1900); s.g.rotation.set(0, side * rand(0.0, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI), rand(-0.05, 0.05)); s.v = rand(0.15, 0.4);
  }
  update(dt: number) {
    const ws = G.speed;
    if (this.atmoT < 1) { this.atmoT = Math.min(1, this.atmoT + dt / this.atmoDur); this.applyAtmo(this.atmoT); }
    const cam = G.camera.position; this.sky.position.copy(cam); this.skyU.uTime.value = G.time; this.bMat.uniforms.uTime.value = G.time;
    this.road.update(dt, ws); this.ground.update(dt, ws); this.tunnel.update(dt, ws);
    const m4 = this.m4, q = this.q, v = this.v, s = this.s;
    // buildings
    q.identity();
    for (let i = 0; i < this.bRec.length; i++) {
      const r = this.bRec[i]; r.z += ws * dt;
      if (r.z > NEAR + r.d) { r.z -= SPAN; this.spawnB(r); }
      if (!r.on) s.set(0, 0, 0); else s.set(r.w, r.h, r.d);
      v.set(r.x, r.y + r.h / 2, r.z); m4.compose(v, q, s); this.bld.setMatrixAt(i, m4);
    }
    this.bld.instanceMatrix.needsUpdate = true;
    for (const sg of this.signs) if (sg.on) { sg.mesh.position.z += ws * dt; (sg.mesh.material as any).opacity = 0.85 + 0.15 * Math.sin(G.time * 20 + sg.mesh.id); if (sg.mesh.position.z > NEAR + 40) { sg.on = false; sg.mesh.visible = false; } }
    // traffic
    for (let i = 0; i < this.tRec.length; i++) {
      const r = this.tRec[i]; r.z += (ws - r.v) * dt;
      if (r.z > NEAR) { r.z -= SPAN; this.spawnT(r); this.traffic.setColorAt(i, r.kind === 0 ? this.col.setRGB(3, 0.25, 0.2) : this.col.setRGB(2.4, 2.4, 3)); }
      if (r.on) s.set(1, 1, 1); else s.set(0, 0, 0);
      v.set(r.x, r.y, r.z); m4.compose(v, q, s); this.traffic.setMatrixAt(i, m4);
    }
    this.traffic.instanceMatrix.needsUpdate = true; if (this.traffic.instanceColor) this.traffic.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.pRec.length; i++) {
      const r = this.pRec[i]; r.z += ws * dt; if (r.z > NEAR) { r.z -= SPAN; this.spawnP(r); }
      s.set(r.on ? 1 : 0, r.on ? 114 : 0, r.on ? 1 : 0); v.set(0, -27 - 57, r.z); m4.compose(v, q, s); this.pillars.setMatrixAt(i, m4);
    }
    this.pillars.instanceMatrix.needsUpdate = true;
    // clouds
    const cq = this.cq;
    for (let i = 0; i < this.cRec.length; i++) {
      const r = this.cRec[i]; r.z += ws * dt * 0.9;
      if (r.z > NEAR + 200) { r.z -= SPAN + 300; this.spawnC(r); }
      if (!r.on) s.set(0, 0, 0); else if (r.kind === 0) { s.set(r.w, r.w * 0.6, 1); cq.copy(this.flatQ); }
      else { s.set(r.w, r.w * 0.5, 1); cq.copy(G.camera.quaternion); }
      v.set(r.x, r.y, r.z); m4.compose(v, cq, s); this.clouds.setMatrixAt(i, m4);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.rRec.length; i++) {
      const r = this.rRec[i]; r.z += ws * dt; if (r.z > NEAR) { r.z -= SPAN; this.spawnR(r); }
      const k = r.on ? r.w : 0; s.set(k, k * 0.7, k * 1.3); q.setFromEuler(this.eu.set(G.time * r.v * 0.3, G.time * 0.2 * r.v, 0)); v.set(r.x, r.y, r.z); m4.compose(v, q, s); this.rocks.setMatrixAt(i, m4);
    }
    q.identity(); this.rocks.instanceMatrix.needsUpdate = true;
    // ships
    for (const sh of this.ships) {
      if (!sh.on) { if ((this.flags.ships || this.flags.farShips) && Math.random() < dt * 0.4) this.spawnShip(sh); continue; }
      sh.g.position.z += ws * sh.v * dt; if (this.flags.farShips) sh.g.position.y -= dt * 3;
      if (sh.g.position.z > 300) { sh.on = false; sh.g.visible = false; }
    }
    // flak & distant battle
    if (this.flags.flak) {
      this.flakT -= dt;
      if (this.flakT <= 0) {
        this.flakT = rand(0.05, 0.25);
        const x = rand(-600, 600), y = rand(-40, 220), z = rand(-1400, -300);
        if (Math.abs(x) > 60 || y > 60) {
          const big = Math.random() < 0.25;
          fx.add.emit(x, y, z, 0, 0, ws * 0.8, big ? 0.6 : 0.3, big ? 30 : 12, big ? 60 : 20, 4, 2.4, 1, 2, 0.4, 0.1, 1, 0, 0, 0, 0, 1);
          if (big) for (let i = 0; i < 8; i++) fx.add.emit(x, y, z, rand(-60, 60), rand(-60, 60), rand(-60, 60) + ws * 0.8, 0.8, 4, 1, 3, 1.4, 0.4, 1, 0.2, 0, 1, 1, 10, 0, 0, 0);
          if (Math.random() < 0.4) { const tx = rand(-300, 300); for (let k = 0; k < 6; k++) fx.add.emit(tx, -150, z, rand(-20, 20), rand(300, 420), ws * 0.8, 1.2, 1.2, 0.8, 3, 2.5, 1, 2, 1, 0.3, 1, 0, 0, 0.04, 0, 1); }
        }
      }
    }
  }
  clearDynamic() { for (const s of this.signs) { s.on = false; s.mesh.visible = false; } }
}
export { clamp };

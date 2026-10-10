"""Remaster the procedural mech blockout into an authored hero GLB (Blender, run headless with bpy).

Input: a rig dump from tools/dump-rig.ts (rest pose, rig space, every primitive grouped by slot and material).
Each primitive is rebuilt with bevelled edges and weighted normals so plates catch light along their edges,
and the armor gets tiling panel-line / wear maps generated here. Node names follow docs/ASSET_BRIEF.md, so the
game's loader re-homes the parts onto the procedural rig and all gameplay animation keeps working.

usage: python tools/remaster_mech.py <rig.json> <out.glb> [player|raven]
"""
import sys, json, math, random
import numpy as np
import bpy, bmesh
from mathutils import Vector

src, out = sys.argv[1], sys.argv[2]
variant = sys.argv[3] if len(sys.argv) > 3 else 'player'
rig = json.load(open(src))
random.seed(7); np.random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------- textures: panel lines + rivets (normal), wear / grime (roughness) ----------------
N = 512
def panel_maps(seed, cell=64, line=2):
    rng = np.random.default_rng(seed)
    h = np.zeros((N, N), np.float32)
    # irregular panel grid: rows/cols at jittered spacing, some cells split again
    def cuts(n):
        xs, x = [], 0
        while x < N: xs.append(x); x += int(rng.integers(cell // 2, cell * 2))
        return xs
    for y in cuts(N): h[y:y + line, :] = 1
    for x in cuts(N):
        y0 = int(rng.integers(0, N)); ln = int(rng.integers(N // 4, N))
        ys = (np.arange(ln) + y0) % N; h[ys[:, None], np.arange(x, min(N, x + line))[None, :]] = 1
    # rivet rows
    for _ in range(40):
        y, x = int(rng.integers(4, N - 4)), int(rng.integers(4, N - 60))
        for k in range(int(rng.integers(3, 8))):
            cx = x + k * 8; yy, xx = np.ogrid[-3:4, -3:4]; m = (yy ** 2 + xx ** 2) <= 4
            h[y - 3:y + 4, cx - 3:cx + 4][m] = np.maximum(h[y - 3:y + 4, cx - 3:cx + 4][m], 0.6)
    # height -> grooves (lines are recessed), blur slightly
    g = -h
    for _ in range(2): g = (g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)) / 5
    dx = (np.roll(g, -1, 1) - np.roll(g, 1, 1)) * 2.2; dy = (np.roll(g, -1, 0) - np.roll(g, 1, 0)) * 2.2
    nz = np.ones_like(g); l = np.sqrt(dx * dx + dy * dy + nz)
    nrm = np.stack([(-dx / l) * 0.5 + 0.5, (dy / l) * 0.5 + 0.5, nz / l * 0.5 + 0.5, np.ones_like(g)], -1)
    # roughness: low-freq grime + darker (rougher) grooves
    noise = rng.random((N // 32, N // 32)).astype(np.float32)
    noise = np.kron(noise, np.ones((32, 32), np.float32))
    for _ in range(6): noise = (noise + np.roll(noise, 3, 0) + np.roll(noise, 3, 1)) / 3
    rough = np.clip(0.28 + noise * 0.22 + h * 0.35, 0, 1)
    orm = np.stack([1 - h * 0.5, rough, np.full_like(g, 0.8) - h * 0.3, np.ones_like(g)], -1)  # glTF ORM: R=AO G=rough B=metal (grooves less metallic)
    return nrm, orm

def make_image(name, arr, non_color=True):
    import tempfile, os
    img = bpy.data.images.new(name, N, N, alpha=True, float_buffer=False)
    if non_color: img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(arr.astype(np.float32).ravel()); img.update()
    path = os.path.join(tempfile.gettempdir(), name + '.png')
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    img = bpy.data.images.load(path); img.name = name
    if non_color: img.colorspace_settings.name = 'Non-Color'
    img.pack()
    return img

nrm, orm = panel_maps(3)
IMG_N = make_image('panel_normal', nrm); IMG_ORM = make_image('panel_orm', orm)

def srgb(c): return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c]
def hexrgb(h): return srgb([((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255])

def pbr(name, base, metal, rough, detail=True):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if detail:
        uv = nt.nodes.new('ShaderNodeUVMap')
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = IMG_N
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.6
        nt.links.new(uv.outputs['UV'], tn.inputs['Vector']); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
        to = nt.nodes.new('ShaderNodeTexImage'); to.image = IMG_ORM
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(uv.outputs['UV'], to.inputs['Vector']); nt.links.new(to.outputs['Color'], sep.inputs['Color'])
        # glTF exporter reads roughness from G and metal from B of the same image
        nt.links.new(sep.outputs['Green'], b.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    return m

if variant == 'raven':
    MATS = { 'dark': pbr('raven_dark', hexrgb(0x2a2226), 0.85, 0.32), 'mid': pbr('raven_mid', hexrgb(0x6a2a34), 0.7, 0.38),
             'light': pbr('raven_light', hexrgb(0x7a5a4c), 0.6, 0.4) }
    GLOW = (1.0, 0.08, 0.25)
else:
    MATS = { 'dark': pbr('frame_dark', hexrgb(0x2c323e), 0.85, 0.3), 'mid': pbr('armor_mid', hexrgb(0x5a6272), 0.75, 0.38),
             'light': pbr('trim_light', hexrgb(0xc4ccd8), 0.5, 0.32) }
    GLOW = (0.08, 0.65, 1.0)
gm = bpy.data.materials.new(variant + '_glow'); gm.use_nodes = True
bb = gm.node_tree.nodes['Principled BSDF']; bb.inputs['Base Color'].default_value = (0, 0, 0, 1)
bb.inputs['Emission Color'].default_value = (*GLOW, 1); bb.inputs['Emission Strength'].default_value = 4.0
MATS['glow'] = gm; MATS['other'] = MATS['mid']

# ---------------- geometry ----------------
def triplanar_uv(bm, scale=0.55):
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u * scale, v * scale)

def build(name, tris, mat_key):
    verts, faces, idx = [], [], {}
    for i in range(0, len(tris), 9):
        f = []
        for k in range(3):
            p = tuple(round(c, 4) for c in tris[i + k * 3:i + k * 3 + 3])
            if p not in idx: idx[p] = len(verts); verts.append(p)
            f.append(idx[p])
        if len(set(f)) == 3: faces.append(f)
    me = bpy.data.meshes.new(name); me.from_pydata([(x, -z, y) for (x, y, z) in verts], [], faces)  # three (Y-up) -> Blender (Z-up)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006)
    # coplanar triangle pairs -> quads so bevels run along real edges
    bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=0.01, angle_shape_threshold=3.2)
    bm.normal_update()
    if mat_key != 'glow':
        # bevel only the hard edges (box corners, cylinder caps), sized to the thinnest plate dimension
        hard = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(50)]
        if hard: bmesh.ops.bevel(bm, geom=hard, offset=0.018, segments=2, profile=0.6, affect='EDGES', clamp_overlap=True)
    triplanar_uv(bm)
    bm.to_mesh(me); bm.free()
    me.materials.append(MATS[mat_key])
    for p in me.polygons: p.use_smooth = True
    if mat_key != 'glow':
        wn = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); wn.keep_sharp = True; wn.weight = 100
    return ob

tri_total = 0
for slot, data in rig['slots'].items():
    px, py, pz = data['pivot']
    emp = bpy.data.objects.new(slot, None); emp.location = (px, -pz, py); scene.collection.objects.link(emp)
    by_mat = {}
    for p in data['parts']: by_mat.setdefault(p['mat'], []).extend(p['pos'])
    for mk, tris in by_mat.items():
        ob = build(f'{slot}_{mk}', tris, mk)
        ob.parent = emp; ob.location = (-px, pz, -py)  # mesh data is in rig space; cancel the pivot offset
        tri_total += sum(len(p.vertices) - 2 for p in ob.data.polygons)
for name, (x, y, z) in rig['anchors'].items():
    a = bpy.data.objects.new(name, None); a.location = (x, -z, y); scene.collection.objects.link(a)

print('triangles ~', tri_total)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_image_format='AUTO',
                          export_materials='EXPORT', export_normals=True, export_tangents=False, use_selection=False)
print('wrote', out)

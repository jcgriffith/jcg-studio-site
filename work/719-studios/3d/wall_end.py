import bpy
from mathutils import Vector
D = bpy.data; w = D.objects['New Desert Wall']; M = w.matrix_world; me = w.data
print('WALLMETA mods', [m.type for m in w.modifiers], 'polys', len(me.polygons), 'verts', len(me.vertices), 'mats', [s.material.name if s.material else None for s in w.material_slots])
ws = [M @ v.co for v in me.vertices]
print('WALLMETA bounds x', round(min(p.x for p in ws), 3), round(max(p.x for p in ws), 3), 'y', round(min(p.y for p in ws), 3), round(max(p.y for p in ws), 3))
print('WALLVERT x-levels', sorted({round(p.x, 3) for p in ws}))
print('WALLVERT y-levels > 0.5', sorted({round(p.y, 3) for p in ws if p.y > 0.5}))
for p in me.polygons:
    c = M @ p.center
    if c.y > 0.6:
        n = (M.to_3x3() @ p.normal).normalized()
        xs = [round((M @ me.vertices[i].co).x, 3) for i in p.vertices]; ys = [round((M @ me.vertices[i].co).y, 3) for i in p.vertices]; zs = [round((M @ me.vertices[i].co).z, 2) for i in p.vertices]
        print('WALLPOLY', p.index, 'n', tuple(round(v, 2) for v in n), 'mat', p.material_index, 'x', min(xs), max(xs), 'y', min(ys), max(ys), 'z', min(zs), max(zs), 'area', round(p.area, 3))
# anything else sitting at the wall's end that could read as a wider cap
for o in D.objects:
    if o.type != 'MESH' or o.hide_render or o is w: continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb))); hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    if lo.x < 5.7 and hi.x > 5.2 and lo.y < 1.5 and hi.y > 0.9 and hi.z > 1.0 and not o.name.startswith(('1_+PVC', 'Sprinkler')):
        print('NEAR', o.name[:40], 'x', round(lo.x, 2), round(hi.x, 2), 'y', round(lo.y, 2), round(hi.y, 2), 'z', round(lo.z, 2), round(hi.z, 2))

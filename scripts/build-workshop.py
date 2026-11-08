import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument('--catalog', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--renders')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
catalog = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
output = Path(args.out).resolve()
output.mkdir(parents=True, exist_ok=True)
random.seed(23)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=0.6, metallic=0, glow=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if glow:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = glow
    return result


concrete = material('warm limestone', (0.29, 0.285, 0.255), 0.92)
stone_edge = material('cut stone', (0.42, 0.405, 0.36), 0.78)
graphite = material('graphite', (0.025, 0.032, 0.032), 0.55, 0.4)
metal = material('brushed titanium', (0.24, 0.27, 0.25), 0.38, 0.72)
brass = material('aged brass', (0.4, 0.24, 0.095), 0.4, 0.7)
wood = material('smoked oak', (0.19, 0.105, 0.045), 0.7)
paper = material('warm paper', (0.62, 0.59, 0.47), 0.85)
green = material('phosphor', (0.12, 0.78, 0.34), 0.45, glow=1.6)
dim_green = material('screen', (0.008, 0.032, 0.024), 0.5, glow=0.3)
amber = material('warm practical light', (1, 0.59, 0.21), 0.5, glow=3)
leaf_mat = material('leaves', (0.055, 0.12, 0.045), 0.9)
soil = material('soil', (0.025, 0.018, 0.012), 1)
rubber = material('keycaps', (0.14, 0.15, 0.125), 0.7)
label_mat = material('lettering', (0.75, 0.73, 0.62), 0.65)
static_objects = []
interior_objects = []
active_objects = static_objects


def finish(obj, name, mat):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    active_objects.append(obj)
    return obj


def cube(name, location, scale, mat, bevel=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('soft machined edges', 'BEVEL')
        mod.width = min(bevel, min(scale) * 0.22)
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat)


def cylinder(name, location, radius, depth, mat, vertices=16, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    if rotation:
        obj.rotation_euler = rotation
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return finish(obj, name, mat)


def line(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_u = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, position in zip(spline.points, points):
        point.co = (*position, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, mat)


def empty(name, position, **extras):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    for key, value in extras.items():
        obj[key] = value
    return obj


def text(name, words, position, size=0.13):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = words
    curve.size = size
    curve.extrude = 0.0007
    curve.resolution_u = 2
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return finish(obj, name, label_mat)


def ribbon(name, center, radii, tilt, depth=1.55, thickness=0.24, segments=112):
    verts = []
    faces = []
    cx, cy, cz = center
    for i in range(segments):
        theta = 2 * math.pi * i / segments
        for radial, side in [(1, -1), (1, 1), (-1, 1), (-1, -1)]:
            x = (radii[0] + radial * thickness / 2) * math.cos(theta)
            z = (radii[1] + radial * thickness / 2) * math.sin(theta)
            verts.append((cx + x * math.cos(tilt) - z * math.sin(tilt), cy + side * depth / 2, cz + x * math.sin(tilt) + z * math.cos(tilt)))
    for i in range(segments):
        for j in range(4):
            faces.append((i * 4 + j, ((i + 1) % segments) * 4 + j, ((i + 1) % segments) * 4 + (j + 1) % 4, i * 4 + (j + 1) % 4))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, concrete)


def railing(start, end, height=0.65):
    a, b = Vector(start), Vector(end)
    count = max(2, int((b - a).length / 0.35))
    for i in range(count + 1):
        p = a.lerp(b, i / count)
        line('baluster', [p, p + Vector((0, 0, height))], 0.012, metal)
    for z in [0.28, height]:
        line('handrail', [a + Vector((0, 0, z)), b + Vector((0, 0, z))], 0.018, metal)


def stairs(start, end, width=0.9, count=24):
    a, b = Vector(start), Vector(end)
    step = (b - a) / count
    for i in range(count):
        p = a + step * (i + 0.5)
        cube('floating stair', p, (abs(step.x) + 0.025, width, 0.12), stone_edge)
    for side in [-1, 1]:
        railing(a + Vector((0, side * width / 2, 0.07)), b + Vector((0, side * width / 2, 0.07)))


def plant(x, y, z, size=0.5):
    cylinder('terracotta planter', (x, y, z + size * 0.23), size * 0.24, size * 0.46, graphite)
    cylinder('pot soil', (x, y, z + size * 0.47), size * 0.22, 0.02, soil)
    for i in range(9):
        angle = i * 2.4
        reach = size * random.uniform(0.45, 0.8)
        end = Vector((x + math.cos(angle) * reach, y + math.sin(angle) * reach, z + size * random.uniform(0.9, 1.8)))
        start = Vector((x, y, z + size * 0.4))
        line('plant stem', [start, start.lerp(end, 0.6), end], size * 0.013, leaf_mat)
        sideways = Vector((-math.sin(angle), math.cos(angle), 0)) * size * 0.2
        middle = start.lerp(end, 0.72)
        mesh = bpy.data.meshes.new('leaf')
        mesh.from_pydata([start.lerp(end, 0.45), middle + sideways, end, middle - sideways], [], [(0, 1, 2, 3)])
        mesh.update()
        obj = bpy.data.objects.new('leaf', mesh)
        bpy.context.collection.objects.link(obj)
        finish(obj, 'leaf', leaf_mat)


def monitor(x, y, z, width=0.95, height=0.62, portal=False):
    cube('monitor foot', (x, y + 0.12, z - 0.42), (0.36, 0.29, 0.045), metal)
    for support in ([-width / 2 - 0.03, width / 2 + 0.03] if portal else [0]):
        cube('monitor stand', (x + support, y + 0.2, z - 0.21), (0.06, 0.07, 0.39), metal)
    for side in [-1, 1]:
        cube('monitor side', (x + side * (width / 2 + 0.03), y, z), (0.065, 0.12, height + 0.12), metal)
        cube('monitor horizontal', (x, y, z + side * (height / 2 + 0.03)), (width, 0.12, 0.065), metal)
    if not portal:
        cube('monitor screen', (x, y + 0.015, z), (width, 0.02, height), dim_green, 0)
        for row in range(10):
            length = width * random.uniform(0.18, 0.7)
            cube('code line', (x - width * 0.38 + length / 2, y - 0.003, z + height * 0.36 - row * height * 0.075), (length, 0.004, 0.008), green, 0)
    cylinder('status light', (x + width * 0.35, y - 0.064, z - height / 2 - 0.025), 0.009, 0.006, green, 8, (math.pi / 2, 0, 0))


def keyboard(x, y, z, scale=1):
    cube('keyboard base', (x, y, z), (0.62 * scale, 0.25 * scale, 0.035 * scale), metal)
    for row in range(4):
        for col in range(11):
            cube('keyboard key', (x + (col - 5) * 0.05 * scale, y + (row - 1.5) * 0.052 * scale, z + 0.028 * scale), (0.041 * scale, 0.041 * scale, 0.019 * scale), rubber, 0)


def desk(x, y, z, portal=False, screens=1):
    cube('solid oak desk', (x, y, z + 0.76), (2.45, 0.92, 0.09), wood)
    for side in [-1, 1]:
        for front in [-1, 1]:
            cube('steel desk leg', (x + side * 1.05, y + front * 0.34, z + 0.36), (0.045, 0.045, 0.72), graphite)
    if screens == 1:
        monitor(x, y + 0.16, z + 1.27, 0.84 if portal else 1.02, 0.52 if portal else 0.64, portal)
    else:
        for offset in [-0.58, 0.58]:
            monitor(x + offset, y + 0.16, z + 1.28, 0.92, 0.59)
    keyboard(x, y - 0.25, z + 0.83)
    cylinder('coffee mug', (x + 0.85, y - 0.19, z + 0.9), 0.07, 0.15, paper)
    cube('notebook', (x - 0.9, y - 0.22, z + 0.84), (0.24, 0.32, 0.04), paper)
    for i in range(3):
        cube('note line', (x - 0.9, y - 0.29 + i * 0.06, z + 0.861), (0.16, 0.006, 0.002), graphite, 0)
    cube('chair seat', (x, y - 1, z + 0.44), (0.48, 0.45, 0.08), graphite)
    cube('chair back', (x, y - 1.22, z + 0.72), (0.48, 0.07, 0.52), graphite)
    cylinder('chair stem', (x, y - 1, z + 0.23), 0.035, 0.42, metal)
    for a in range(5):
        angle = a * math.tau / 5
        line('chair spoke', [(x, y - 1, z + 0.05), (x + 0.3 * math.cos(angle), y - 1 + 0.3 * math.sin(angle), z + 0.04)], 0.02, metal)


def room(slug, position, screens=1, portal=False, vault=False):
    x, y, z = position
    cube('cantilever floor', (x, y, z - 0.15), (3.8, 2.6, 0.3), concrete)
    cube('back wall', (x, y + 1.23, z + 1.2), (3.8, 0.16, 2.5), concrete)
    cube('roof slab', (x, y + 0.05, z + 2.53), (3.8, 2.5, 0.18), concrete)
    cube('left pier', (x - 1.84, y + 0.05, z + 1.2), (0.13, 2.5, 2.5), concrete)
    for offset in [-1.2, 0, 1.2]:
        for level in [0.3, 1.1, 1.9]:
            cylinder('formwork tie', (x + offset, y + 1.139, z + level), 0.025, 0.008, graphite, 8, (math.pi / 2, 0, 0))
    cube('light channel', (x, y + 0.2, z + 2.36), (1.8, 0.09, 0.05), amber, 0)
    text('project name', slug, (x - 1.63, y - 1.33, z - 0.12), 0.12)
    if vault:
        cylinder('vault door', (x, y + 0.1, z + 1.06), 0.9, 0.25, metal, 64, (math.pi / 2, 0, 0))
        for radius in [0.7, 0.83]:
            points = [(x + radius * math.cos(a * math.tau / 64), y - 0.04, z + 1.06 + radius * math.sin(a * math.tau / 64)) for a in range(65)]
            line('vault rim', points, 0.018, brass)
        cylinder('vault hub', (x, y - 0.15, z + 1.06), 0.11, 0.16, brass, 24, (math.pi / 2, 0, 0))
        for a in range(6):
            angle = a * math.tau / 6
            line('vault handle', [(x, y - 0.25, z + 1.06), (x + 0.4 * math.cos(angle), y - 0.25, z + 1.06 + 0.4 * math.sin(angle))], 0.026, metal)
        for a in range(12):
            angle = a * math.tau / 12
            cylinder('vault bolt', (x + 0.78 * math.cos(angle), y - 0.07, z + 1.06 + 0.78 * math.sin(angle)), 0.035, 0.025, graphite, 6, (math.pi / 2, 0, 0))
    else:
        desk(x, y + 0.25, z, portal=portal, screens=screens)
    for side in [-1, 1]:
        plant(x + side * 1.55, y + 0.65, z, 0.34)
    railing((x - 1.8, y - 1.25, z + 0.05), (x - 0.65, y - 1.25, z + 0.05))
    railing((x + 0.65, y - 1.25, z + 0.05), (x + 1.8, y - 1.25, z + 0.05))
    empty('Room_' + slug, position)
    empty('Hotspot_' + slug, (x, y - 1.3, z + 2.0))
    empty('Cam_Room_' + slug, (x + 0.12, y - 5.5, z + 2.25))
    empty('Aim_Room_' + slug, (x, y + 0.25, z + 1.2))


placements = [
    ((-3.25, 0, 4.1), 1, True, False),
    ((3.15, 0.6, 4.4), 2, False, False),
    ((0.1, 1.7, 7.4), 2, False, False),
    ((-5.15, -0.25, 0.15), 1, False, False),
    ((3.75, 0.45, 0.25), 1, False, True),
    ((6.5, 2.7, 2.25), 2, False, False),
    ((-6.7, 2.6, 3.0), 1, False, False),
]
assert len(catalog) == len(placements), 'Every project must have an authored room'
for item, (position, screens, portal, vault) in zip(catalog, placements):
    room(item['id'], position, screens, portal, vault)

ribbon('ascending concrete loop', (-0.3, 1.25, 4.2), (7.6, 3.2), math.radians(33), 1.15)
ribbon('return concrete loop', (-0.5, 1.65, 3.9), (7.4, 3.4), math.radians(-32), 1.1)
ribbon('upper concrete loop', (-0.4, 2.15, 6.1), (3.6, 3.2), math.radians(20), 1.05)
stairs((-4.65, -1.3, 0.35), (1.5, -1.3, 4.4), 0.88, 32)
stairs((1.5, -0.4, 4.4), (-1.7, 1, 7.4), 0.78, 26)
stairs((5.1, 1.7, 0.45), (5.1 + 1.3, 2, 2.35), 0.7, 16)
for i in range(4):
    line('green signal conduit', [(-3.8 + i * 0.06, 1.0, 4.1), (-3.8 + i * 0.06, 1.0, 2.2), (2.8 + i * 0.06, 1.0, 2.2), (2.8 + i * 0.06, 1.0, 4.4)], 0.012, green)

empty('Cam_Overview', (9.86, -16.84, 10.832))
empty('Aim_Overview', (0, 0.5, 4.1))
empty('Light_Key', (1, -8, 16))
empty('Light_Rim', (12, 2, 9))
empty('Light_Interior', (-3.25, 0.89, 5.53))
root = empty('WorkshopRoot', (0, 0, 0))


def join_materials(objects, parent, prefix):
    grouped = {}
    for obj in objects:
        grouped.setdefault(obj.data.materials[0].name, []).append(obj)
    joined = []
    for mat_name, members in grouped.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in members:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = members[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = prefix + mat_name
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
        joined.append(obj)
    return joined


exterior_meshes = join_materials(static_objects, root, 'exterior_')
active_objects = interior_objects
interior_root = empty('InteriorRoot', (0, 0, 0))
cube('interior floor', (0, 3.5, -0.08), (8.4, 7.4, 0.16), wood)
cube('interior back', (0, 7.12, 2.5), (8.4, 0.2, 5.2), concrete)
cube('interior ceiling', (0, 3.5, 5.08), (8.4, 7.4, 0.16), graphite)
for side in [-1, 1]:
    cube('interior side', (side * 4.13, 3.5, 2.5), (0.2, 7.4, 5.2), concrete)
    for shelf in [1.2, 2.2, 3.2]:
        cube('wall shelving', (side * 3.8, 4, shelf), (0.6, 3.8, 0.06), wood)
        for i in range(12):
            cube('bound notebook', (side * 3.8, 2.3 + i * 0.29, shelf + 0.25), (0.3, 0.12, random.uniform(0.3, 0.5)), paper if i % 3 else graphite)
cube('interior desk', (0, 4.7, 1.25), (5.4, 1.9, 0.15), wood)
for x in [-2.35, 2.35]:
    for y in [4, 5.4]:
        cube('interior desk leg', (x, y, 0.6), (0.09, 0.09, 1.2), metal)
keyboard(0, 4.1, 1.36, 1.5)
monitor(-1.7, 5.3, 2.15, 1.2, 0.8)
cube('model plinth', (0.2, 5.05, 1.36), (2.55, 1.4, 0.08), graphite)
for x in [-2.5, 2.5]:
    cylinder('lamp base', (x, 4.9, 1.4), 0.22, 0.08, brass)
    line('lamp arm', [(x, 4.9, 1.4), (x, 4.9, 2.5), (x * 0.75, 4.5, 2.8)], 0.035, brass)
    cylinder('lamp shade', (x * 0.75, 4.5, 2.74), 0.28, 0.14, graphite)
    cylinder('lamp diffuser', (x * 0.75, 4.5, 2.66), 0.24, 0.015, amber)
plant(-3.2, 6, 0, 1.1)
plant(3.2, 6, 0, 0.9)
text('interior title', 'TOOLS ALL THE WAY DOWN', (-2.7, 6.99, 3.7), 0.32)
text('interior subtitle', 'a workshop inside a workshop', (-2.7, 6.98, 3.2), 0.17)
interior_meshes = join_materials(interior_objects, interior_root, 'interior_')

sx, sy, sz = placements[0][0]
portal_center = Vector((sx, sy + 0.41, sz + 1.27))
aperture_width, aperture_height = 0.84, 0.52
scale = 0.1
interior_root.location = portal_center + Vector((0, 0.04, -aperture_height / 2))
interior_root.scale = (scale, scale, scale)
mini = empty('MiniatureWorkshop', (0, 0, 0))
mini.parent = interior_root
mini.location = (0.2, 5.05, 1.44)
mini.scale = (0.14, 0.14, 0.14)
for obj in exterior_meshes:
    copy = obj.copy()
    copy.data = obj.data
    bpy.context.collection.objects.link(copy)
    copy.name = 'miniature_' + obj.name
    copy.parent = mini
    copy.matrix_parent_inverse.identity()
    copy.matrix_basis = obj.matrix_world.copy()

empty('MonitorAperture', portal_center, width=aperture_width, height=aperture_height)
empty('Cam_PortalApproach', portal_center + Vector((0, -1.4, 0)))
empty('Aim_PortalApproach', portal_center + Vector((0, 0.5, 0)))
empty('Cam_PortalCross', portal_center + Vector((0, 0.07, 0)))
empty('Aim_PortalCross', portal_center + Vector((0, 0.55, -0.015)))
empty('Cam_Interior', portal_center + Vector((0, 0.22, -0.015)))
empty('Aim_Interior', portal_center + Vector((0.02, 0.55, -0.06)))

bpy.context.view_layer.update()
required = ['WorkshopRoot', 'Cam_Overview', 'Aim_Overview', 'MonitorAperture', 'MiniatureWorkshop', 'Light_Key', 'Light_Rim', 'Light_Interior']
for item in catalog:
    required.extend(prefix + item['id'] for prefix in ['Room_', 'Cam_Room_', 'Aim_Room_', 'Hotspot_'])
for suffix in ['PortalApproach', 'PortalCross', 'Interior']:
    required.extend([f'Cam_{suffix}', f'Aim_{suffix}'])
assert all(bpy.data.objects.get(name) is not None for name in required)
near_plane = 0.002
assert math.tan(math.radians(42 / 2)) * near_plane * 2 * 3.5 < aperture_width
assert math.tan(math.radians(42 / 2)) * near_plane * 2 < aperture_height

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
try:
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'HIP'
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type == 'HIP'
    scene.cycles.device = 'GPU' if any(device.type == 'HIP' for device in preferences.devices) else 'CPU'
except (TypeError, ValueError):
    scene.cycles.device = 'CPU'

scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for obj in exterior_meshes + interior_meshes:
    obj.data.color_attributes.new(name='WorkshopAO', type='FLOAT_COLOR', domain='CORNER')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type='AO')
for obj in exterior_meshes + interior_meshes:
    emissive = obj.data.materials[0] in [green, dim_green, amber]
    for entry in obj.data.color_attributes['WorkshopAO'].data:
        shade = 1.0 if emissive else 0.35 + 0.65 * entry.color[0]
        entry.color = (shade, shade, shade, 1)

bpy.ops.object.select_all(action='DESELECT')
asset_path = output / 'workshop.glb'
bpy.ops.export_scene.gltf(filepath=str(asset_path), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False, export_animations=False, export_materials='EXPORT', export_vertex_color='ACTIVE')
triangles = sum(len(p.vertices) - 2 for obj in bpy.context.scene.objects if obj.type == 'MESH' for p in obj.data.polygons)
manifest = {
    'schemaVersion': 1,
    'asset': '/workshop/workshop.glb',
    'projectIds': [item['id'] for item in catalog],
    'nodes': required,
    'stats': {'triangles': triangles, 'bytes': asset_path.stat().st_size},
    'aperture': {'width': aperture_width, 'height': aperture_height, 'nearPlane': near_plane},
}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('WORKSHOP_EXPORT', json.dumps(manifest['stats']))

if args.renders:
    render_dir = Path(args.renders).resolve()
    render_dir.mkdir(parents=True, exist_ok=True)
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.035, 0.045, 0.04, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.3
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'

    def area(name, position, power, size, color, target):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power
        data.shape = 'DISK'
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

    area('softbox key', (1, -8, 16), 2300, 9, (1, 0.85, 0.65), (0, 0, 4))
    area('cool rim', (-9, 5, 11), 1900, 7, (0.64, 0.8, 1), (0, 0, 4))
    area('right rim', (12, 2, 9), 1700, 6, (1, 0.67, 0.34), (0, 0, 4))
    for position, _, _, _ in placements:
        x, y, z = position
        area('room practical', (x, y + 0.1, z + 2.2), 45, 1, (1, 0.69, 0.35), (x, y + 0.2, z + 0.5))
    area('miniature desk light', portal_center + Vector((0, 0.48, 0.16)), 2, 0.3, (1, 0.68, 0.3), portal_center + Vector((0, 0.5, -0.1)))
    camera_data = bpy.data.cameras.new('RenderCamera')
    camera_data.sensor_fit = 'VERTICAL'
    camera_data.angle = math.radians(42)
    camera_data.clip_start = near_plane
    camera_data.clip_end = 150
    camera = bpy.data.objects.new('RenderCamera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for suffix in ['Overview', 'Room_screengrab', 'PortalApproach', 'PortalCross', 'Interior']:
        camera.location = bpy.data.objects['Cam_' + suffix].matrix_world.translation
        target = bpy.data.objects['Aim_' + suffix].matrix_world.translation
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(render_dir / (suffix + '.png'))
        bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(render_dir / 'workshop.blend'))

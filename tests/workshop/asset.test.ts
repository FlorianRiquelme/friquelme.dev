import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Mesh, Raycaster, Vector3, type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import sharp from 'sharp';
import { projects } from '../../src/data/projects';

const asset = readFileSync(new URL('../../public/workshop/workshop.glb', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../../public/workshop/manifest.json', import.meta.url), 'utf8'));
const projectIds = projects.map(project => new URL(project.repo).pathname.split('/').at(-1));
let scene: Group;

function position(name: string): Vector3 {
  const node = scene.getObjectByName(name);
  if (!node) throw new Error(`Missing workshop anchor: ${name}`);
  return node.getWorldPosition(new Vector3());
}

beforeAll(async () => {
  const data = Uint8Array.from(asset).buffer;
  scene = (await new GLTFLoader().parseAsync(data, '')).scene;
  scene.updateMatrixWorld(true);
});

describe('the shipped Blender workshop', () => {
  it('contains a room, hotspot and finite camera anchors for every canonical project', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.asset).toBe('/workshop/workshop.glb');
    expect(manifest.projectIds).toEqual(projectIds);
    expect(projectIds).toHaveLength(7);
    const required = ['WorkshopRoot', 'Cam_Overview', 'Aim_Overview', 'MonitorAperture', 'MiniatureWorkshop', 'Light_Key', 'Light_Rim', 'Light_Interior'];
    for (const id of projectIds) {
      required.push(...['Room_', 'Cam_Room_', 'Aim_Room_', 'Hotspot_'].map(prefix => prefix + id));
    }
    for (const suffix of ['PortalApproach', 'PortalCross', 'Interior']) required.push(`Cam_${suffix}`, `Aim_${suffix}`);
    expect(manifest.nodes).toEqual(required);
    for (const name of required) expect(position(name).toArray().every(Number.isFinite), name).toBe(true);
  });

  it('keeps the camera and sampled near-plane clearance away from geometry in both directions', () => {
    const routes = [
      ...projectIds.map(id => ['Overview', `Room_${id}`]),
      ['Room_screengrab', 'PortalApproach'],
      ['PortalApproach', 'PortalCross'],
      ['PortalCross', 'Interior'],
    ];
    const radius = Math.tan(21 * Math.PI / 180) * 0.002 * 3.5;
    const offsets = [new Vector3(), ...[-1, 1].flatMap(x => [-1, 1].map(y => new Vector3(x * radius, y * radius, 0)))];
    expect(routes).toHaveLength(10);
    for (const [from, to] of routes) {
      for (const [start, end] of [[from, to], [to, from]]) {
        for (const offset of offsets) {
          const a = position(`Cam_${start}`).add(offset);
          const delta = position(`Cam_${end}`).add(offset).sub(a);
          const ray = new Raycaster(a, delta.clone().normalize(), 0.002, delta.length());
          expect(ray.intersectObject(scene, true).map(hit => hit.object.name), `${start} -> ${end}`).toEqual([]);
        }
      }
    }
  });

  it('places the interior behind a real opening that contains the crossing camera', () => {
    const aperture = scene.getObjectByName('MonitorAperture')!;
    expect(aperture.userData.width).toBe(0.84);
    expect(aperture.userData.height).toBe(0.52);
    expect(manifest.aperture).toEqual({ width: 0.84, height: 0.52, nearPlane: 0.002 });
    const center = position('MonitorAperture');
    const approach = position('Cam_PortalApproach');
    const crossing = position('Cam_PortalCross');
    const interior = position('Cam_Interior');
    expect(approach.z).toBeGreaterThan(center.z);
    expect(crossing.z).toBeLessThan(center.z);
    expect(interior.z).toBeLessThan(crossing.z);
    expect(crossing.x).toBeCloseTo(center.x, 6);
    expect(crossing.y).toBeCloseTo(center.y, 6);
  });

  it('shares exterior geometry with the miniature and exports baked shading', () => {
    const exterior = scene.getObjectByName('WorkshopRoot')!;
    const miniature = scene.getObjectByName('MiniatureWorkshop')!;
    const outerMeshes = exterior.children.filter((child): child is Mesh => child instanceof Mesh);
    const miniMeshes = miniature.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(outerMeshes.length).toBeGreaterThan(0);
    expect(miniMeshes).toHaveLength(outerMeshes.length);
    for (const mesh of miniMeshes) expect(outerMeshes.some(outer => outer.geometry === mesh.geometry)).toBe(true);
    scene.traverse(object => {
      if (object instanceof Mesh) {
        expect(object.geometry.getAttribute('color'), object.name).toBeDefined();
      }
    });
    expect(manifest.stats.bytes).toBe(asset.length);
    let triangles = 0;
    scene.traverse(object => {
      if (object instanceof Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    });
    expect(triangles).toBe(manifest.stats.triangles);
  });

  it('ships a decodable poster for the non-WebGL experience', async () => {
    const poster = await sharp(readFileSync(new URL('../../public/workshop/poster.webp', import.meta.url))).metadata();
    expect(poster.format).toBe('webp');
    expect(poster.width).toBe(1600);
    expect(poster.height).toBe(1100);
  });
});

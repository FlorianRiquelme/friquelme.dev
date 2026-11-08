import { describe, expect, it } from 'vitest';
import {
  parseManifest,
  requiredNodeNames,
  validateProjectIdentity,
  validateSceneNodes,
  WorkshopAssetError,
} from '../../src/lib/workshop/manifest';
import { projectIdFromRepo, workshopProjectIds, workshopProjects } from '../../src/lib/workshop/projects';

const validInput = () => ({
  schemaVersion: 1,
  asset: '/workshop/workshop.glb',
  projectIds: [...workshopProjectIds],
  nodes: requiredNodeNames(workshopProjectIds),
  stats: { triangles: 110_664, bytes: 3_723_432 },
  aperture: { width: 0.84, height: 0.52, nearPlane: 0.002 },
});

describe('workshop project identity', () => {
  it('derives exactly the seven canonical repository suffixes', () => {
    expect(workshopProjectIds).toEqual([
      'screengrab',
      'nachtschicht',
      'cmux-workspace-tools',
      'claudefuel',
      'ddev-claude',
      'openrouter-zdr',
      'jev-kit',
    ]);
    expect(new Set(workshopProjectIds).size).toBe(7);
  });

  it('keeps the site data as the source of titles, descriptions and URLs', () => {
    const screengrab = workshopProjects[0];
    expect(screengrab.title).toBe('screengrab');
    expect(screengrab.repo).toBe('https://github.com/FlorianRiquelme/screengrab');
    expect(screengrab.install).toBe('brew install --cask FlorianRiquelme/tap/screengrab');
    expect(screengrab.version).toBe('v1.0.0');
  });

  it('rejects non-canonical repository hosts and nameless repositories', () => {
    expect(() => projectIdFromRepo('https://example.com/owner/project')).toThrow();
    expect(() => projectIdFromRepo('https://github.com/')).toThrow();
  });
});

describe('workshop manifest boundary', () => {
  it('parses the generated manifest shape', () => {
    expect(parseManifest(validInput())).toEqual(validInput());
  });

  it('rejects a wrong schema, asset or malformed arrays', () => {
    expect(() => parseManifest({ ...validInput(), schemaVersion: 2 })).toThrow(WorkshopAssetError);
    expect(() => parseManifest({ ...validInput(), asset: '/workshop/other.glb' })).toThrow(WorkshopAssetError);
    expect(() => parseManifest({ ...validInput(), projectIds: ['screengrab', 'screengrab'] })).toThrow(WorkshopAssetError);
    expect(() => parseManifest({ ...validInput(), nodes: [1] })).toThrow(WorkshopAssetError);
  });

  it('rejects non-positive stats and aperture values', () => {
    expect(() => parseManifest({ ...validInput(), stats: { triangles: 0, bytes: 1 } })).toThrow(WorkshopAssetError);
    expect(() => parseManifest({ ...validInput(), aperture: { width: 0.84, height: 0.52, nearPlane: 0 } })).toThrow(WorkshopAssetError);
  });

  it('requires the manifest to agree with the site project ids exactly', () => {
    const manifest = parseManifest(validInput());
    expect(() => validateProjectIdentity(manifest, workshopProjectIds)).not.toThrow();
    expect(() => validateProjectIdentity(manifest, workshopProjectIds.slice(0, 6))).toThrow(WorkshopAssetError);
    expect(() => validateProjectIdentity(manifest, [...workshopProjectIds.slice(1), 'unknown'])).toThrow(WorkshopAssetError);
  });

  it('requires every declared node and every project node in the manifest', () => {
    const input = validInput();
    const missingNode = parseManifest({ ...input, nodes: input.nodes.filter((name) => name !== 'Aim_Overview') });
    expect(() => validateProjectIdentity(missingNode, workshopProjectIds)).toThrow(WorkshopAssetError);
  });

  it('requires every manifest node to exist in the parsed scene', () => {
    const manifest = parseManifest(validInput());
    expect(() => validateSceneNodes(manifest, manifest.nodes)).not.toThrow();
    expect(() => validateSceneNodes(manifest, manifest.nodes.filter((name) => name !== 'MonitorAperture'))).toThrow(WorkshopAssetError);
    expect(() => validateSceneNodes(manifest, [...manifest.nodes, 'MonitorAperture'])).toThrow(WorkshopAssetError);
  });
});

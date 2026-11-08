export interface WorkshopManifest {
  schemaVersion: 1;
  asset: '/workshop/workshop.glb';
  projectIds: string[];
  nodes: string[];
  stats: { triangles: number; bytes: number };
  aperture: { width: number; height: number; nearPlane: number };
}

export class WorkshopAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopAssetError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new WorkshopAssetError(`Manifest ${field} must be an array`);
  const strings = value.map((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') throw new WorkshopAssetError(`Manifest ${field} must contain non-empty strings`);
    return entry;
  });
  if (new Set(strings).size !== strings.length) throw new WorkshopAssetError(`Manifest ${field} must not contain duplicates`);
  return strings;
}

function readPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new WorkshopAssetError(`Manifest ${field} must be a positive number`);
  return value;
}

export function parseManifest(input: unknown): WorkshopManifest {
  if (!isRecord(input)) throw new WorkshopAssetError('Manifest must be an object');
  if (input.schemaVersion !== 1) throw new WorkshopAssetError('Manifest schemaVersion must be 1');
  if (input.asset !== '/workshop/workshop.glb') throw new WorkshopAssetError('Manifest asset must be /workshop/workshop.glb');
  const stats = input.stats;
  if (!isRecord(stats)) throw new WorkshopAssetError('Manifest stats must be an object');
  const aperture = input.aperture;
  if (!isRecord(aperture)) throw new WorkshopAssetError('Manifest aperture must be an object');
  return {
    schemaVersion: 1,
    asset: '/workshop/workshop.glb',
    projectIds: readStringArray(input.projectIds, 'projectIds'),
    nodes: readStringArray(input.nodes, 'nodes'),
    stats: {
      triangles: readPositiveNumber(stats.triangles, 'stats.triangles'),
      bytes: readPositiveNumber(stats.bytes, 'stats.bytes'),
    },
    aperture: {
      width: readPositiveNumber(aperture.width, 'aperture.width'),
      height: readPositiveNumber(aperture.height, 'aperture.height'),
      nearPlane: readPositiveNumber(aperture.nearPlane, 'aperture.nearPlane'),
    },
  };
}

export function requiredNodeNames(projectIds: readonly string[]): string[] {
  return [
    'WorkshopRoot',
    'MiniatureWorkshop',
    'MonitorAperture',
    'Cam_Overview',
    'Aim_Overview',
    'Cam_PortalApproach',
    'Aim_PortalApproach',
    'Cam_PortalCross',
    'Aim_PortalCross',
    'Cam_Interior',
    'Aim_Interior',
    'Light_Key',
    'Light_Rim',
    'Light_Interior',
    ...projectIds.flatMap((id) => [`Room_${id}`, `Cam_Room_${id}`, `Aim_Room_${id}`, `Hotspot_${id}`]),
  ];
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((entry) => values.has(entry));
}

export function validateProjectIdentity(manifest: WorkshopManifest, expectedProjectIds: readonly string[]): void {
  if (expectedProjectIds.length === 0) throw new WorkshopAssetError('No expected project ids were supplied');
  if (!sameMembers(manifest.projectIds, expectedProjectIds)) {
    throw new WorkshopAssetError(`Manifest project ids do not match the site: ${manifest.projectIds.join(', ')}`);
  }
  const missing = requiredNodeNames(expectedProjectIds).filter((name) => !manifest.nodes.includes(name));
  if (missing.length > 0) throw new WorkshopAssetError(`Manifest is missing required nodes: ${missing.join(', ')}`);
}

export function validateSceneNodes(manifest: WorkshopManifest, sceneNames: Iterable<string>): void {
  const counts = new Map<string, number>();
  for (const name of sceneNames) counts.set(name, (counts.get(name) ?? 0) + 1);
  const invalid = manifest.nodes.filter(name => counts.get(name) !== 1);
  if (invalid.length > 0) throw new WorkshopAssetError(`Scene requires exactly one of each manifest node: ${invalid.join(', ')}`);
}

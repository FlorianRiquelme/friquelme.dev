export const VERTICAL_FOV_DEGREES = 42;
export const NEAR_PLANE = 0.002;
const REFERENCE_ASPECT = 16 / 10;
const MAX_OVERVIEW_SCALE = 2.4;

const tanHalfVertical = Math.tan((VERTICAL_FOV_DEGREES * Math.PI) / 360);
const referenceHalfWidth = tanHalfVertical * REFERENCE_ASPECT;

export function overviewDistanceScale(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  const currentHalfWidth = tanHalfVertical * aspect;
  const portrait = Math.min(MAX_OVERVIEW_SCALE, Math.max(1, referenceHalfWidth / currentHalfWidth));
  return portrait;
}

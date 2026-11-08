import { describe, expect, it } from 'vitest';
import { NEAR_PLANE, overviewDistanceScale, VERTICAL_FOV_DEGREES } from '../../src/lib/workshop/framing';

describe('workshop framing', () => {
  it('uses the approved camera contract', () => {
    expect(VERTICAL_FOV_DEGREES).toBe(42);
    expect(NEAR_PLANE).toBe(0.002);
  });

  it('keeps the reference wide framing generous and pulls back for portrait', () => {
    expect(overviewDistanceScale(16 / 10)).toBe(1);
    const portrait = overviewDistanceScale(0.75);
    expect(portrait).toBeGreaterThan(1);
    expect(portrait).toBeLessThan(overviewDistanceScale(0.5));
    expect(overviewDistanceScale(0.0001)).toBe(2.4);
  });

  it('ignores invalid aspect ratios', () => {
    expect(overviewDistanceScale(0)).toBe(1);
    expect(overviewDistanceScale(-1)).toBe(1);
    expect(overviewDistanceScale(Number.NaN)).toBe(1);
  });

});

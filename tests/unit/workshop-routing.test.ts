import { describe, expect, it } from 'vitest';
import { workshopProjectIds } from '../../src/lib/workshop/projects';
import {
  advanceRoute,
  cameraPath,
  isRouteSettled,
  retargetRoute,
  roomNode,
  routeProgress,
  settleRoute,
  settledRoute,
  startRoute,
  WorkshopRouteError,
} from '../../src/lib/workshop/routing';

const ids = workshopProjectIds;

describe('workshop camera graph', () => {
  it('moves from overview into a room and back without a portal detour', () => {
    expect(cameraPath('overview', roomNode('screengrab'), ids)).toEqual(['room:screengrab']);
    expect(cameraPath(roomNode('jev-kit'), 'overview', ids)).toEqual(['overview']);
  });

  it('traverses the screengrab portal in adjacent edges', () => {
    expect(cameraPath(roomNode('screengrab'), 'interior', ids)).toEqual(['approach', 'cross', 'interior']);
    expect(cameraPath('overview', 'interior', ids)).toEqual(['room:screengrab', 'approach', 'cross', 'interior']);
    expect(cameraPath('interior', roomNode('screengrab'), ids)).toEqual(['cross', 'approach', 'room:screengrab']);
  });

  it('leaves the interior through the aperture before reaching another room', () => {
    const path = cameraPath('interior', roomNode('jev-kit'), ids);
    expect(path).toEqual(['cross', 'approach', 'room:screengrab', 'overview', 'room:jev-kit']);
    expect(path.indexOf('overview')).toBeGreaterThan(path.indexOf('room:screengrab'));
    expect(path.indexOf('cross')).toBeLessThan(path.indexOf('overview'));
  });

  it('routes a non-featured room to the interior through the screengrab room', () => {
    expect(cameraPath(roomNode('nachtschicht'), 'interior', ids)).toEqual([
      'overview',
      'room:screengrab',
      'approach',
      'cross',
      'interior',
    ]);
  });

  it('rejects unknown projects instead of inventing a camera', () => {
    expect(() => cameraPath('overview', roomNode('unknown'), ids)).toThrow(WorkshopRouteError);
    expect(() => startRoute('interior', roomNode('unknown'), ids)).toThrow(WorkshopRouteError);
  });
});

describe('workshop route state', () => {
  it('walks one adjacent edge at a time and settles on a large delta', () => {
    const start = startRoute('overview', 'interior', ids);
    expect(start.segment).toEqual({ start: 'overview', end: 'room:screengrab' });
    expect(start.queue).toEqual(['approach', 'cross', 'interior']);
    const atApproach = advanceRoute(start, 950);
    expect(atApproach.segment).toEqual({ start: 'room:screengrab', end: 'approach' });
    expect(isRouteSettled(atApproach)).toBe(false);
    const atCross = advanceRoute(atApproach, 1_250);
    expect(atCross.segment).toEqual({ start: 'approach', end: 'cross' });
    const atInterior = advanceRoute(atCross, 10_000);
    expect(atInterior.segment.end).toBe('interior');
    expect(isRouteSettled(atInterior)).toBe(true);
    expect(routeProgress(atInterior)).toBe(1);
  });

  it('finishes the active edge when it already heads the new route', () => {
    const started = startRoute('overview', 'interior', ids);
    const moving = advanceRoute(started, 200);
    const retargeted = retargetRoute(moving, 'approach', ids);
    expect(retargeted.segment).toEqual({ start: 'overview', end: 'room:screengrab' });
    expect(retargeted.queue).toEqual(['approach']);
    expect(retargeted.destination).toBe('approach');
  });

  it('reverses an early edge before routing somewhere else', () => {
    const started = startRoute('overview', 'interior', ids);
    const moving = advanceRoute(started, 100);
    const retargeted = retargetRoute(moving, roomNode('jev-kit'), ids);
    expect(retargeted.segment).toEqual({ start: 'room:screengrab', end: 'overview' });
    expect(retargeted.elapsedMs).toBe(850);
    expect(retargeted.queue).toEqual(['room:jev-kit']);
    expect(retargeted.destination).toBe(roomNode('jev-kit'));
  });

  it('finishes a late edge and then routes from its endpoint', () => {
    const started = startRoute('overview', 'interior', ids);
    const moving = advanceRoute(started, 800);
    const retargeted = retargetRoute(moving, roomNode('jev-kit'), ids);
    expect(retargeted.segment).toEqual({ start: 'overview', end: 'room:screengrab' });
    expect(retargeted.queue).toEqual(['overview', 'room:jev-kit']);
    expect(retargeted.destination).toBe(roomNode('jev-kit'));
  });

  it('keeps repeated requests for the same destination idempotent', () => {
    const moving = advanceRoute(startRoute('overview', 'interior', ids), 300);
    expect(retargetRoute(moving, 'interior', ids)).toBe(moving);
  });

  it('settles instants without replaying the path', () => {
    const moving = advanceRoute(startRoute('overview', 'interior', ids), 300);
    const settled = settleRoute(moving);
    expect(isRouteSettled(settled)).toBe(true);
    expect(settled.destination).toBe('interior');
    expect(advanceRoute(settled, 10_000)).toEqual(settled);
  });

  it('starts a fresh route once settled', () => {
    const settled = settledRoute(roomNode('screengrab'));
    const next = retargetRoute(settled, 'interior', ids);
    expect(next.segment).toEqual({ start: 'room:screengrab', end: 'approach' });
    expect(next.destination).toBe('interior');
  });
});

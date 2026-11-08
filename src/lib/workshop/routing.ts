export type CameraNode = 'overview' | 'approach' | 'cross' | 'interior' | `room:${string}`;

export type WorkshopView = { kind: 'overview' } | { kind: 'room'; projectId: string } | { kind: 'interior' };

export interface CameraSegment {
  start: CameraNode;
  end: CameraNode;
}

export interface RouteState {
  segment: CameraSegment;
  elapsedMs: number;
  durationMs: number;
  queue: CameraNode[];
  destination: CameraNode;
}

export class WorkshopRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopRouteError';
  }
}

export const INTERIOR_PROJECT_ID = 'screengrab';

export function roomNode(projectId: string): CameraNode {
  return `room:${projectId}`;
}

export function projectIdOfRoom(node: CameraNode): string | null {
  return node.startsWith('room:') ? node.slice('room:'.length) : null;
}

export function viewToNode(view: WorkshopView): CameraNode {
  if (view.kind === 'overview') return 'overview';
  if (view.kind === 'interior') return 'interior';
  return roomNode(view.projectId);
}

export function nodeToView(node: CameraNode): WorkshopView {
  if (node === 'interior') return { kind: 'interior' };
  const projectId = projectIdOfRoom(node);
  if (projectId) return { kind: 'room', projectId };
  if (node === 'overview') return { kind: 'overview' };
  return { kind: 'room', projectId: INTERIOR_PROJECT_ID };
}

export function viewLabel(view: WorkshopView): string {
  if (view.kind === 'overview') return 'overview';
  if (view.kind === 'interior') return 'inside the monitor';
  return `${view.projectId} room`;
}

function isKnownNode(node: string, projectIds: readonly string[]): node is CameraNode {
  if (node === 'overview' || node === 'approach' || node === 'cross' || node === 'interior') return true;
  const projectId = projectIdOfRoom(node as CameraNode);
  return projectId !== null && projectIds.includes(projectId);
}

function assertKnownNode(node: string, projectIds: readonly string[]): asserts node is CameraNode {
  if (!isKnownNode(node, projectIds)) throw new WorkshopRouteError(`Unknown camera node: ${node}`);
}

function neighbours(node: CameraNode, projectIds: readonly string[]): CameraNode[] {
  if (node === 'overview') return projectIds.map(roomNode);
  if (node === 'approach') return [roomNode(INTERIOR_PROJECT_ID), 'cross'];
  if (node === 'cross') return ['approach', 'interior'];
  if (node === 'interior') return ['cross'];
  const projectId = projectIdOfRoom(node);
  if (!projectId) throw new WorkshopRouteError(`Unknown camera node: ${node}`);
  return projectId === INTERIOR_PROJECT_ID ? ['overview', 'approach'] : ['overview'];
}

export function cameraPath(from: CameraNode, to: CameraNode, projectIds: readonly string[]): CameraNode[] {
  assertKnownNode(from, projectIds);
  assertKnownNode(to, projectIds);
  if (from === to) return [];
  const previous = new Map<CameraNode, CameraNode>();
  const queue: CameraNode[] = [from];
  const seen = new Set<CameraNode>([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const next of neighbours(current, projectIds)) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, current);
      if (next === to) {
        const path: CameraNode[] = [to];
        let cursor = to;
        while (cursor !== from) {
          const parent = previous.get(cursor);
          if (!parent) throw new WorkshopRouteError(`Broken camera path from ${from} to ${to}`);
          if (parent === from) break;
          cursor = parent;
          path.push(cursor);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  throw new WorkshopRouteError(`No camera path from ${from} to ${to}`);
}

export function edgeDurationMs(from: CameraNode, to: CameraNode): number {
  const portal = (node: CameraNode) => node === 'approach' || node === 'cross' || node === 'interior';
  return portal(from) || portal(to) ? 1_250 : 950;
}

export function settledRoute(node: CameraNode): RouteState {
  return {
    segment: { start: node, end: node },
    elapsedMs: 1,
    durationMs: 1,
    queue: [],
    destination: node,
  };
}

export function startRoute(from: CameraNode, destination: CameraNode, projectIds: readonly string[]): RouteState {
  const path = cameraPath(from, destination, projectIds);
  if (path.length === 0) return settledRoute(destination);
  const [first, ...rest] = path;
  return {
    segment: { start: from, end: first },
    elapsedMs: 0,
    durationMs: edgeDurationMs(from, first),
    queue: rest,
    destination,
  };
}

export function isRouteSettled(state: RouteState): boolean {
  return state.queue.length === 0 && state.segment.end === state.destination && state.elapsedMs >= state.durationMs;
}

export function routeProgress(state: RouteState): number {
  if (state.durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, state.elapsedMs / state.durationMs));
}

export function advanceRoute(state: RouteState, deltaMs: number): RouteState {
  let current = state;
  let remaining = Math.max(0, deltaMs);
  if (isRouteSettled(current)) return current;
  while (remaining > 0) {
    const left = current.durationMs - current.elapsedMs;
    if (left > 0) {
      const used = Math.min(left, remaining);
      current = { ...current, elapsedMs: current.elapsedMs + used };
      remaining -= used;
    }
    if (current.elapsedMs < current.durationMs) break;
    const [next, ...rest] = current.queue;
    if (!next) return { ...current, queue: [], elapsedMs: current.durationMs };
    current = {
      segment: { start: current.segment.end, end: next },
      elapsedMs: 0,
      durationMs: edgeDurationMs(current.segment.end, next),
      queue: rest,
      destination: current.destination,
    };
  }
  return current;
}

export function settleRoute(state: RouteState): RouteState {
  return settledRoute(state.destination);
}

export function retargetRoute(state: RouteState, destination: CameraNode, projectIds: readonly string[]): RouteState {
  assertKnownNode(destination, projectIds);
  if (isRouteSettled(state)) return startRoute(state.destination, destination, projectIds);
  if (state.destination === destination) return state;
  const progress = routeProgress(state);
  if (progress <= 0) return startRoute(state.segment.start, destination, projectIds);
  const forward = cameraPath(state.segment.start, destination, projectIds);
  const finishesForward = forward[0] === state.segment.end;
  if (finishesForward) {
    return { ...state, queue: cameraPath(state.segment.end, destination, projectIds), destination };
  }
  if (progress >= 0.5) {
    return { ...state, queue: cameraPath(state.segment.end, destination, projectIds), destination };
  }
  const rest = cameraPath(state.segment.start, destination, projectIds);
  return {
    segment: { start: state.segment.end, end: state.segment.start },
    elapsedMs: state.durationMs - state.elapsedMs,
    durationMs: state.durationMs,
    queue: rest,
    destination,
  };
}

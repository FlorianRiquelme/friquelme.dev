import { surfaceOf, web, type BrowserName } from '@e2e-dev/web';
import type { BrowserContext } from 'playwright';
import { browserTargets } from '../../scripts/browser-targets.mjs';

// e2e loads the config and the test files through separate module instances
// within one worker, so the engines and the `surfaceOf` that knows them are
// shared through a process-wide registry instead of a module export.
const registryKey = Symbol.for('friquelme.dev/browser-targets');
const created = {
  surfaceOf,
  targets: browserTargets.map(({ name, browser, viewport }) => ({ name, engine: web({ browser: browser as BrowserName, viewport }) })),
};
const registry: typeof created = ((globalThis as Record<symbol, typeof created>)[registryKey] ??= created);

export const targets = registry.targets;

/**
 * The Playwright context of the attempt that is running in this worker.
 *
 * TesterArmy 0.16 has no public API for page errors, response statuses or
 * reduced-motion emulation. The fixtures use the context only to observe those
 * events and to set media emulation; every navigation, action and assertion goes
 * through the recorded `app`, `screen` and `browser` fixtures.
 */
export function activeContext(): BrowserContext {
  const live = targets.flatMap(({ engine }) => {
    try {
      return [registry.surfaceOf(engine)!.context()];
    } catch {
      return [];
    }
  });
  if (live.length !== 1) throw new Error(`Expected exactly one running browser attempt, found ${live.length}`);
  return live[0];
}

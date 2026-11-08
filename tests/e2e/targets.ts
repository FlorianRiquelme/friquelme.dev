import { surfaceOf, web, type BrowserName } from '@e2e-dev/web';
import { firefox, type BrowserContext } from 'playwright';
import { browserTargets } from '../../scripts/browser-targets.mjs';

// e2e loads the config and the test files through separate module instances
// within one worker, so the engines and the `surfaceOf` that knows them are
// shared through a process-wide registry instead of a module export.
const registryKey = Symbol.for('friquelme.dev/browser-targets');
function createTargets() {
  // TesterArmy 0.11 exposes no launch preferences. Firefox needs this preference
  // for software WebGL 2 on GPU-less runners: https://bugzilla.mozilla.org/show_bug.cgi?id=1970486
  const launchFirefox = firefox.launch.bind(firefox);
  firefox.launch = options => launchFirefox({
    ...options,
    firefoxUserPrefs: { ...options?.firefoxUserPrefs, 'webgl.force-enabled': true },
  });
  return {
    surfaceOf,
    targets: browserTargets.map(({ name, browser, viewport }) => ({ name, engine: web({ browser: browser as BrowserName, viewport }) })),
  };
}
const registry = ((globalThis as Record<symbol, ReturnType<typeof createTargets>>)[registryKey] ??= createTargets());

export const targets = registry.targets;

/**
 * The Playwright context of the attempt that is running in this worker.
 *
 * TesterArmy 0.16 has no public API to observe every page error or response,
 * or to emulate reduced motion. The fixtures use the context only to observe those
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

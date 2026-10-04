import { routes } from '../support/site';

/** Base URL of the deployment under test. Unset or malformed is a failure, never a skip. */
export function deployedBaseUrl(): URL {
  const value = process.env.DEPLOYED_BASE_URL;
  if (!value) throw new Error('DEPLOYED_BASE_URL is not set; point it at the deployment to verify, e.g. https://friquelme.dev');
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`DEPLOYED_BASE_URL must be an https URL, got ${value}`);
  return url;
}

/** Preview deployments (pr-<N>.preview.friquelme.dev) carry X-Robots-Tag; everything else must not. */
export function isPreview(url: URL): boolean {
  return /^pr-[0-9]+\.preview\.friquelme\.dev$/.test(url.hostname);
}

/** Fails loudly when the deployment cannot be reached. */
export async function requireReachable(url: URL): Promise<void> {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    await response.arrayBuffer();
  } catch (error) {
    throw new Error(`Deployment ${url.origin} is unreachable: ${(error as Error).message}`);
  }
}

export { routes };

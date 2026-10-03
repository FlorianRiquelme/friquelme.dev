import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { chatgpt } from 'e2e/oauth/chatgpt';
import { openai } from '@ai-sdk/openai';

const provider = process.env.TRIAL_PROVIDER;
const modelId = process.env.TRIAL_MODEL;
if (provider && !['chatgpt', 'openai'].includes(provider)) {
  throw new Error('TRIAL_PROVIDER must be chatgpt or openai');
}
if (provider && !modelId) throw new Error('Set TRIAL_MODEL to an authorized model ID');

export default {
  projectId: 'friquelme-issue-75',
  targets: [{
    name: 'web',
    engine: web({ browser: 'chromium', viewport: process.env.TRIAL_VIEWPORT === 'mobile'
      ? { width: 390, height: 844 } : { width: 1280, height: 900 } }),
    app: { url: process.env.TRIAL_BASE_URL ?? 'http://100.84.161.116:14375', environment: 'test' },
  }],
  tests: ['tests/*.e2e.ts'],
  workers: 1,
  retries: 1,
  timeout: 180_000,
  assertionTimeout: 5_000,
  trace: 'on',
  cache: { mode: 'read-write', dir: '.e2e/cache' },
  reporters: ['list', 'markdown'],
  ...(provider && modelId ? {
    agents: { default: {
      model: provider === 'chatgpt' ? chatgpt(modelId) : openai(modelId),
      maxSteps: 10,
      maxModelCalls: 10,
      judgmentTimeout: 60_000,
      context: 'Public portfolio and blog. Follow the requested link; never navigate directly to bypass a broken link. Do not visit external sites or submit forms.',
    } },
  } : {}),
} satisfies E2EConfig;

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The browser chrome colour must stay equal to the page canvas token, so tests read it from the source.
const css = readFileSync(resolve('src/styles/global.css'), 'utf8');
const match = css.match(/--color-bg-page:\s*(#[0-9a-fA-F]{6})\s*;/);
if (!match) throw new Error('--color-bg-page hex value not found in src/styles/global.css');
export const bgPageColor = match[1].toLowerCase();

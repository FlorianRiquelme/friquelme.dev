import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { projects } from '../src/data/projects.ts';

const output = resolve(process.argv[2] ?? '.planning/workshop/catalog.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(projects.map(project => ({
  id: new URL(project.repo).pathname.split('/').at(-1),
  title: project.title,
})), null, 2));

import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/blog';
import { projects } from '../data/projects';

export async function GET(context: APIContext) {
  const posts = getPublishedPosts(await getCollection('blog'));
  const site = context.site!.origin;

  const lines: string[] = [];
  lines.push('# friquelme.dev');
  lines.push('');
  lines.push(
    '> Personal site of Florian Riquelme, senior software engineer at SVO Netz GmbH, part of SVO-Gruppe, a regional energy and infrastructure provider in Celle, Germany. Open-source tools for working with coding agents, and writing about how they are built.',
  );
  lines.push('');
  lines.push(
    "Florian is a full-stack engineer (PHP, React, TypeScript, Go, Swift, AWS) with 9+ years of experience shipping SaaS platforms, e-commerce, and web applications. At SVO Netz GmbH he builds, reviews and operates the group's own software, turns prototypes colleagues built at team offsites into tools they rely on every day, and looks after the group's Statamic-based customer websites svo.de and svo-netz.de. He maintains open-source tools for working with coding agents and writes about building them.",
  );
  lines.push('');
  lines.push('## Pages');
  lines.push('');
  lines.push(`- [Homepage](${site}/): About, current work, projects, contact.`);
  lines.push(`- [Blog](${site}/blog/): Index of all posts.`);
  lines.push('');
  lines.push('## Projects');
  lines.push('');
  for (const project of projects) {
    lines.push(`- [${project.title}](${project.repo}): ${project.description}`);
  }
  lines.push('');
  lines.push('## Blog posts');
  lines.push('');
  for (const post of posts) {
    lines.push(
      `- [${post.data.title}](${site}/blog/${post.id}/): ${post.data.description}`,
    );
  }
  lines.push('');
  lines.push('## Contact');
  lines.push('');
  lines.push('- Email: flo@friquelme.dev');
  lines.push('- GitHub: https://github.com/FlorianRiquelme');
  lines.push('- LinkedIn: https://linkedin.com/in/florian-riquelme-b97756143');
  lines.push('- Source: https://github.com/FlorianRiquelme/friquelme.dev');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

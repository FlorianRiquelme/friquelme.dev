import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/blog';

export async function GET(context: APIContext) {
  const posts = getPublishedPosts(await getCollection('blog'));
  const site = context.site!.origin;

  const lines: string[] = [];
  lines.push('# friquelme.dev');
  lines.push('');
  lines.push(
    '> Personal site of Florian Riquelme — senior software engineer at digital-masters in Hamburg, Germany. Writing about brownfield AI: integrating LLMs into existing production codebases without breaking trust.',
  );
  lines.push('');
  lines.push(
    'Florian is a full-stack engineer (PHP, React, TypeScript, Go, AWS) with 9+ years of experience shipping SaaS platforms, e-commerce, and web applications. He maintains open-source tooling around autonomous AI workflows (nachtschicht, ddev-claude) and writes about the operational reality of running AI inside real codebases — eval-gated rollouts, reversibility, and trust-building patterns.',
  );
  lines.push('');
  lines.push('## Pages');
  lines.push('');
  lines.push(`- [Homepage](${site}/): About, current work, skills, projects, contact.`);
  lines.push(`- [Blog](${site}/blog/): Index of all posts.`);
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

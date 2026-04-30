export type SeoHome = {
  kind: 'home';
  title: string;
  description: string;
};

export type SeoPost = {
  kind: 'post';
  title: string;
  description: string;
  slug: string;
  datePublished: Date;
};

export type SeoProject = {
  kind: 'project';
  title: string;
  description: string;
  slug: string;
};

export type SeoInput = SeoHome | SeoPost | SeoProject;

export type SeoContext = {
  site: URL;
  pathname: string;
};

export type ArticleJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  datePublished: string;
};

export type SeoOutput = {
  canonical: string;
  type: 'website' | 'article';
  articleJsonLd?: ArticleJsonLd;
};

export function getSeoMeta(input: SeoInput, ctx: SeoContext): SeoOutput {
  const canonical = new URL(ctx.pathname, ctx.site).href;

  if (input.kind === 'post') {
    return {
      canonical,
      type: 'article',
      articleJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.title,
        datePublished: input.datePublished.toISOString(),
      },
    };
  }

  return { canonical, type: 'website' };
}

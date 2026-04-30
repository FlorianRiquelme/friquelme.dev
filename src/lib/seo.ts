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
  dateModified?: Date;
  author: string;
  tags: string[];
  imageSrc?: string;
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

type Person = {
  '@type': 'Person';
  name: string;
  url: string;
};

type WebPageRef = {
  '@type': 'WebPage';
  '@id': string;
};

export type ArticleJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'BlogPosting';
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: Person;
  publisher: Person;
  mainEntityOfPage: WebPageRef;
  image?: string;
  keywords: string;
};

export type SeoOutput = {
  canonical: string;
  type: 'website' | 'article';
  articleJsonLd?: ArticleJsonLd;
};

const PUBLISHER_NAME = 'Florian Riquelme';

export function getSeoMeta(input: SeoInput, ctx: SeoContext): SeoOutput {
  const canonical = new URL(ctx.pathname, ctx.site).href;

  if (input.kind === 'post') {
    const siteOrigin = ctx.site.origin;
    return {
      canonical,
      type: 'article',
      articleJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: input.title,
        description: input.description,
        datePublished: input.datePublished.toISOString(),
        ...(input.dateModified && {
          dateModified: input.dateModified.toISOString(),
        }),
        author: {
          '@type': 'Person',
          name: input.author,
          url: siteOrigin,
        },
        publisher: {
          '@type': 'Person',
          name: PUBLISHER_NAME,
          url: siteOrigin,
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonical,
        },
        ...(input.imageSrc && {
          image: new URL(input.imageSrc, ctx.site).href,
        }),
        keywords: input.tags.join(', '),
      },
    };
  }

  return { canonical, type: 'website' };
}

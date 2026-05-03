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

type ImageObject = {
  '@type': 'ImageObject';
  url: string;
};

type Publisher = Person & {
  logo: ImageObject;
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
  dateModified: string;
  author: Person;
  publisher: Publisher;
  mainEntityOfPage: WebPageRef;
  image: string;
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
    const image = input.imageSrc
      ? new URL(input.imageSrc, ctx.site).href
      : new URL(`/og/${input.slug}.png`, ctx.site).href;
    const publisherLogo = new URL('/og/index.png', ctx.site).href;
    return {
      canonical,
      type: 'article',
      articleJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: input.title,
        description: input.description,
        datePublished: input.datePublished.toISOString(),
        dateModified: (input.dateModified ?? input.datePublished).toISOString(),
        author: {
          '@type': 'Person',
          name: input.author,
          url: siteOrigin,
        },
        publisher: {
          '@type': 'Person',
          name: PUBLISHER_NAME,
          url: siteOrigin,
          logo: {
            '@type': 'ImageObject',
            url: publisherLogo,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonical,
        },
        image,
        keywords: input.tags.join(', '),
      },
    };
  }

  return { canonical, type: 'website' };
}

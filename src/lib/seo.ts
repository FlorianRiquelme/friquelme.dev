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

export const PERSON_ID = 'https://friquelme.dev/#person';

type Person = {
  '@type': 'Person';
  '@id'?: string;
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

type SpeakableSpecification = {
  '@type': 'SpeakableSpecification';
  cssSelector: string[];
};

type BreadcrumbItem = {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
};

export type BreadcrumbListJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
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
  speakable: SpeakableSpecification;
};

export type SeoOutput = {
  canonical: string;
  type: 'website' | 'article';
  articleJsonLd?: ArticleJsonLd;
  breadcrumbsJsonLd?: BreadcrumbListJsonLd;
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
          '@id': PERSON_ID,
          name: input.author,
          url: siteOrigin,
        },
        publisher: {
          '@type': 'Person',
          '@id': PERSON_ID,
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
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['.article-title', '.article-summary'],
        },
      },
      breadcrumbsJsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: new URL('/', ctx.site).href,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: new URL('/blog/', ctx.site).href,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: input.title,
            item: canonical,
          },
        ],
      },
    };
  }

  return { canonical, type: 'website' };
}

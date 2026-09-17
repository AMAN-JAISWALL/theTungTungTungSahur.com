/**
 * JSON-LD for the site. Each page emits a single `@graph` (assembled in Layout.astro),
 * so nodes point at each other by `@id` instead of repeating themselves.
 */
import { CONTACT_EMAIL, CONTACT_PATH, LORE_PATH, SITE } from '../site';

export interface Crumb {
  label: string;
  href: string;
}

export interface QuestionAnswer {
  q: string;
  a: string;
}

export const absolute = (path: string) => new URL(path, SITE.url).href;

/**
 * Answers are written with site-relative links for the rendered page, but JSON-LD is read
 * away from it (Search Console, answer engines), where `/games` has no host to resolve against.
 */
const absolutizeLinks = (html: string) => html.replace(/href="\//g, `href="${SITE.url}/`);

export const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;
/** The meme character. Referenced from every page that is about him. */
export const CHARACTER_ID = `${absolute(LORE_PATH)}#character`;

export const pageId = (path: string) => `${absolute(path)}#webpage`;

/** A pointer to another node in the same graph. */
export const ref = (id: string) => ({ '@id': id });

export const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE.name,
  url: SITE.url,
  logo: { '@type': 'ImageObject', url: absolute('/icon-512.png'), width: 512, height: 512 },
  email: CONTACT_EMAIL,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: CONTACT_EMAIL,
    url: absolute(CONTACT_PATH),
    availableLanguage: 'English',
  },
};

export const website = {
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'en',
  publisher: ref(ORG_ID),
};

/**
 * Ties the site to the real-world entity via `sameAs`, so search engines and
 * answer engines resolve "Tung Tung Tung Sahur" to the meme rather than guessing.
 */
export const character = {
  '@type': 'Thing',
  '@id': CHARACTER_ID,
  name: 'Tung Tung Tung Sahur',
  alternateName: ['Triple T', 'T³', 'TTT Sahur', 'Tun Tun Tun Sahur'],
  description:
    'An AI-generated meme character from Indonesian TikTok: an anthropomorphic kentongan (a wooden slit drum) carrying a bat, named after the “tung tung tung” knocking that wakes people for sahur, the pre-dawn meal during Ramadan.',
  sameAs: [
    'https://en.wikipedia.org/wiki/Tung_Tung_Tung_Sahur',
    'https://www.wikidata.org/wiki/Q134227481',
    'https://knowyourmeme.com/memes/tung-tung-tung-sahur',
  ],
};

export const breadcrumbList = (path: string, items: Crumb[]) => ({
  '@type': 'BreadcrumbList',
  '@id': `${absolute(path)}#breadcrumb`,
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.label,
    item: absolute(item.href),
  })),
});

export interface PageGraphOptions {
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage';
  path: string;
  name: string;
  description: string;
  image: string;
  crumbs?: Crumb[];
  /** Questions rendered on the page; adds FAQPage to the page node. */
  faq?: readonly QuestionAnswer[];
  /** Whether the page is about the meme character. */
  about?: boolean;
  datePublished?: string;
  dateModified?: string;
}

/** The nodes every page shares: publisher, site, character and the page itself. */
export function pageGraph({
  type = 'WebPage',
  path,
  name,
  description,
  image,
  crumbs,
  faq,
  about = true,
  datePublished,
  dateModified,
}: PageGraphOptions): Record<string, unknown>[] {
  const url = absolute(path);
  const page: Record<string, unknown> = {
    // A page carrying an FAQ section is both, so the questions hang off one node.
    '@type': faq?.length ? [type, 'FAQPage'] : type,
    '@id': pageId(path),
    url,
    name,
    description,
    inLanguage: 'en',
    isPartOf: ref(SITE_ID),
    primaryImageOfPage: { '@type': 'ImageObject', url: absolute(image) },
  };
  if (about) page.about = ref(CHARACTER_ID);
  if (datePublished) page.datePublished = datePublished;
  if (dateModified) page.dateModified = dateModified;
  if (crumbs?.length) page.breadcrumb = ref(`${url}#breadcrumb`);
  if (faq?.length) {
    page.mainEntity = faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: `<p>${absolutizeLinks(item.a)}</p>` },
    }));
  }

  return [
    organization,
    website,
    ...(about ? [character] : []),
    page,
    ...(crumbs?.length ? [breadcrumbList(path, crumbs)] : []),
  ];
}

/** JSON-LD builders shared by pages. */
import { SITE } from '../site';

export interface Crumb {
  label: string;
  href: string;
}

const absolute = (path: string) => new URL(path, SITE.url).href;

export const breadcrumbSchema = (items: Crumb[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.label,
    item: absolute(item.href),
  })),
});

export const organization = {
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: absolute('/icon-512.png'),
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  publisher: organization,
};

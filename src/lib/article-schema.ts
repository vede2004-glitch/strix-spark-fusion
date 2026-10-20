import type { NewsItem } from "@/lib/news";

export const SITE_URL = "https://hirx.ro";

const plain = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1");

export function articleSchema(item: NewsItem, image: string | null) {
  const url = `${SITE_URL}/hir/${encodeURIComponent(item.group_id)}`;
  const published = item.published_at ? new Date(item.published_at * 1000) : null;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: plain(item.title),
    description: plain(item.lead),
    articleBody: plain(item.content),
    articleSection: item.category,
    inLanguage: "hu",
    ...(published && Number.isFinite(published.getTime()) ? { datePublished: published.toISOString() } : {}),
    ...(image?.startsWith("https://") ? { image: [image] } : {}),
    publisher: { "@type": "Organization", name: "Stirix.ro", url: SITE_URL },
    citation: item.sources.filter((source) => /^https?:\/\//.test(source.link)).map((source) => ({
      "@type": "CreativeWork",
      name: source.title,
      url: source.link,
      publisher: { "@type": "Organization", name: source.source },
    })),
  };
}

export function breadcrumbSchema(item: NewsItem) {
  const url = `${SITE_URL}/hir/${encodeURIComponent(item.group_id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Főoldal", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Összes hír", item: `${SITE_URL}/osszes` },
      { "@type": "ListItem", position: 3, name: plain(item.title), item: url },
    ],
  };
}

/** Escape HTML delimiters so article text cannot terminate the metadata script. */
export function serializeArticleSchema(schema: Record<string, unknown>) {
  return JSON.stringify(schema).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
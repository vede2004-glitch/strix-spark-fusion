import raw from "@/data/news.json";
import type { Lang } from "@/lib/lang";

export type NewsSource = { source: string; title: string; link: string };
export type LangContent = { title: string; lead: string; content: string };

type RawItem = {
  group_id: string;
  category?: string | null;
  image: string | null;
  is_synthesized: boolean;
  sources_count?: number | undefined;
  sources: NewsSource[];
  published_at?: number | null;
  // Lapos magyar mezők
  title_hu?: string;
  lead_hu?: string;
  content_hu?: string;
  // Lapos román mezők
  title_ro?: string;
  lead_ro?: string;
  content_ro?: string;
};

export type NewsItem = Omit<RawItem, "title_hu" | "lead_hu" | "content_hu" | "title_ro" | "lead_ro" | "content_ro" | "category"> & {
  // Magyar alapértelmezések (kereséshez, AI-hoz, SEO-hoz)
  title: string;
  lead: string;
  content: string;
  category: string;
  i18n: Record<Lang, LangContent>;
};

export const CATEGORIES = ["Általános", "Politika", "Sport", "Közélet", "Kultúra", "Gazdaság", "Bulvár"] as const;
export const ALL = "Összes hír";

const normCategory = (c?: string | null) => {
  const hit = CATEGORIES.find((k) => k.toLocaleLowerCase("hu") === (c ?? "").trim().toLocaleLowerCase("hu"));
  return hit ?? "Általános";
};

const clean = (s?: string) => (s ?? "").replace(/\.{3,}$/, "…");

function normalize(r: RawItem): NewsItem {
  const huContent: LangContent = {
    title: r.title_hu ?? "",
    lead: clean(r.lead_hu),
    content: r.content_hu ?? "",
  };

  const roContent: LangContent = {
    title: r.title_ro ?? r.title_hu ?? "",
    lead: clean(r.lead_ro || r.lead_hu),
    content: r.content_ro ?? r.content_hu ?? "",
  };

  const i18n: Record<Lang, LangContent> = {
    hu: huContent,
    ro: roContent,
  };

  return {
    group_id: r.group_id,
    image: r.image,
    is_synthesized: r.is_synthesized,
    sources_count: r.sources_count,
    sources: r.sources || [],
    published_at: r.published_at ?? null,
    title: huContent.title,
    lead: huContent.lead,
    content: huContent.content,
    category: normCategory(r.category),
    i18n,
  };
}

/** Kiválasztott nyelv, hiányzó mezőnként magyar fallback. */
export function tr(n: NewsItem, lang: Lang): LangContent {
  const hu = n.i18n.hu;
  const l = n.i18n[lang];
  if (!l) return hu;
  return {
    title: l.title.trim() || hu.title,
    lead: l.lead.trim() || hu.lead,
    content: l.content.trim() || hu.content,
  };
}

export const news = (raw as unknown as RawItem[]).map(normalize);

// A) csoportosított, AI által összefűzött hírek (2+ forrás)
export const synthesized = news.filter((n) => n.is_synthesized);

// Magyar nyelvű források – a HU nézet élő sávjába csak ezek kerülhetnek
export const HUNGARIAN_SOURCES = [
  "Maszol",
  "Transtelex",
  "Hargita Népe",
  "Szatmári Friss",
  "Manna",
  "MTI",
  "Kolozsvári Rádió",
  "Szatmári Sport",
  "Krónika",
  "Romkat",
  "Vásárhely.ma",
  "Mediatica.ro"
];

export const isHungarianSource = (n: NewsItem) =>
  n.sources.some((s) => HUNGARIAN_SOURCES.some((h) => s.source.toLocaleLowerCase("hu").includes(h.toLocaleLowerCase("hu"))));

// B) egyedi, egyforrású hírek → élő idősáv
export const singles = news
  .filter((n) => !n.is_synthesized)
  .sort((a, b) => (b.published_at ?? 0) - (a.published_at ?? 0));

export const getNews = (id: string) => news.find((n) => n.group_id === id);

export function timeAgo(ts: number | null | undefined, lang: Lang = "hu") {
  if (!ts) return lang === "ro" ? "Recent" : "Friss";
  const min = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  if (min < 60) return lang === "ro" ? `acum ${min} min.` : `${min} perce`;
  const h = Math.round(min / 60);
  if (lang === "ro") return h < 24 ? `acum ${h} ore` : `acum ${Math.round(h / 24)} zile`;
  return h < 24 ? `${h} órája` : `${Math.round(h / 24)} napja`;
}

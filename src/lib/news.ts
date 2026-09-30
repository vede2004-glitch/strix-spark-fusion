import raw from "@/data/news.json";
import type { Lang } from "@/lib/lang";

export type NewsSource = { source: string; title: string; link: string };
export type LangContent = { title: string; lead: string; content: string };
type RawLang = Partial<LangContent> | null | undefined;
type RawItem = {
  group_id: string;
  title?: string;
  lead?: string;
  content: string | Partial<Record<Lang, RawLang>>;
  image: string | null;
  sources: NewsSource[];
  is_synthesized: boolean;
  category?: string | null;
  published_at: number | null;
};
export type NewsItem = Omit<RawItem, "content" | "title" | "lead" | "category"> & {
  // magyar alapértelmezés (keresés, AI, SEO)
  title: string;
  lead: string;
  content: string;
  category: string;
  i18n: Partial<Record<Lang, LangContent>>;
};

export const CATEGORIES = ["Általános", "Politika", "Sport", "Közélet", "Kultúra", "Gazdaság", "Bulvár"] as const;
export const ALL = "Összes hír";

const normCategory = (c?: string | null) => {
  const hit = CATEGORIES.find((k) => k.toLocaleLowerCase("hu") === (c ?? "").trim().toLocaleLowerCase("hu"));
  return hit ?? "Általános";
};
const clean = (s?: string) => (s ?? "").replace(/\.{3,}$/, "…");
const valid = (l: RawLang): l is Partial<LangContent> => !!l && !!(l.title?.trim() || l.content?.trim());

function normalize(r: RawItem): NewsItem {
  const i18n: Partial<Record<Lang, LangContent>> = {};
  if (typeof r.content === "string") {
    i18n.hu = { title: r.title ?? "", lead: clean(r.lead), content: r.content };
  } else {
    for (const l of ["hu", "ro", "en"] as Lang[]) {
      const v = r.content?.[l];
      if (valid(v)) i18n[l] = { title: v.title ?? "", lead: clean(v.lead), content: v.content ?? "" };
    }
  }
  const hu = i18n.hu ?? i18n.ro ?? i18n.en ?? { title: r.title ?? "", lead: clean(r.lead), content: "" };
  i18n.hu = hu;
  return { ...r, title: hu.title, lead: hu.lead, content: hu.content, category: normCategory(r.category), i18n };
}

/** Kiválasztott nyelv, hiányzó mezőnként magyar fallback. */
export function tr(n: NewsItem, lang: Lang): LangContent {
  const hu = n.i18n.hu!;
  const l = n.i18n[lang];
  if (!l) return hu;
  return { title: l.title.trim() || hu.title, lead: l.lead.trim() || hu.lead, content: l.content.trim() || hu.content };
}

export const news = (raw as unknown as RawItem[]).map(normalize);
// A) csoportosított, AI által összefűzött hírek (2+ forrás)
export const synthesized = news.filter((n) => n.is_synthesized);
// Magyar nyelvű források – a HU nézet élő sávjába csak ezek kerülhetnek
export const HUNGARIAN_SOURCES = ["Maszol", "Transtelex", "Hargita Népe", "Szatmári Friss", "Manna", "MTI", "Kolozsvári Rádió", "Szatmári Sport", "Krónika", "Romkat"];
export const isHungarianSource = (n: NewsItem) =>
  n.sources.some((s) => HUNGARIAN_SOURCES.some((h) => s.source.toLocaleLowerCase("hu").includes(h.toLocaleLowerCase("hu"))));

// B) egyedi, egyforrású hírek → élő idősáv
export const singles = news
  .filter((n) => !n.is_synthesized)
  .sort((a, b) => (b.published_at ?? 0) - (a.published_at ?? 0));

export const getNews = (id: string) => news.find((n) => n.group_id === id);

export function timeAgo(ts: number | null) {
  if (!ts) return "Friss";
  const min = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  if (min < 60) return `${min} perce`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} órája` : `${Math.round(h / 24)} napja`;
}

import raw from "@/data/news.json";

export type NewsSource = { source: string; title: string; link: string };
export type NewsItem = {
  group_id: string;
  title: string;
  lead: string;
  content: string;
  image: string | null;
  sources: NewsSource[];
  is_synthesized: boolean;
  category: string;
  published_at: number | null;
};

export const news = (raw as NewsItem[]).map((n) => ({ ...n, lead: n.lead.replace(/\.{3,}$/, "…") }));
// A) csoportosított, AI által összefűzött hírek (2+ forrás)
export const synthesized = news.filter((n) => n.is_synthesized);
// Magyar nyelvű források – a HU nézet élő sávjába csak ezek kerülhetnek
export const HUNGARIAN_SOURCES = ["Maszol", "Transtelex", "Hargita Népe", "Szatmári Friss", "Manna", "MTI"];
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

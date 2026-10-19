import raw from "@/data/news.json";
import archiveRaw from "@/data/archive.json";
import historyRaw from "@/data/news_archive.json";
import type { Lang } from "@/lib/lang";
import { localTz } from "@/lib/lang";

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

export const CATEGORIES = ["Politika", "Gazdaság", "Erdély", "Sport", "Kultúra", "Bulvár"] as const;
export const ALL = "Összes hír";

const normCategory = (c?: string | null) => {
  // A korábbi "Közélet" kategória az "Erdély" fül alá vonult
  const key = (c ?? "").trim() === "Közélet" ? "Erdély" : (c ?? "").trim();
  const hit = CATEGORIES.find((k) => k.toLocaleLowerCase("hu") === key.toLocaleLowerCase("hu"));
  return hit ?? "Általános";
};

const clean = (s?: string) => (s ?? "").replace(/\.{3,}$/, "…");

// Ha nincs published_at, a group_id-ben lévő unix időbélyeget használjuk (group_<ts>_<n>)
const tsFromId = (id: string) => {
  const m = /_(\d{9,11})_/.exec(id);
  return m ? Number(m[1]) : null;
};

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
    published_at: r.published_at ?? tsFromId(r.group_id),
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


export function timeAgo(ts: number | null | undefined, lang: Lang = "hu") {
  if (!ts) return lang === "ro" ? "Recent" : "Friss";
  const min = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  if (min < 60) return lang === "ro" ? `acum ${min} min.` : `${min} perce`;
  const h = Math.round(min / 60);
  if (lang === "ro") return h < 24 ? `acum ${h} ore` : `acum ${Math.round(h / 24)} zile`;
  return h < 24 ? `${h} órája` : `${Math.round(h / 24)} napja`;
}

/** Pontos dátum + időpont, pl. „okt. 5. 14:20" */
export function formatDate(ts: number | null | undefined, lang: Lang = "hu") {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(lang === "ro" ? "ro-RO" : "hu-HU", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    ...(localTz ? {} : { timeZone: "Europe/Bucharest" }),
  });
}

export const RECENT_HOURS = 12;
/** Igaz, ha a hír az elmúlt 24 órában jelent meg (dátum nélküli hír frissnek számít).
 *  Szándékosan csak egy paramétert vesz: a `.filter(isRecent)` hívásnál a filter az elem
 *  indexét adná át második argumentumként, ami egy korábbi `now` paraméterrel felülírta
 *  volna a Date.now()-t, és minden hír átment volna a szűrőn. */
export const isRecent = (n: NewsItem) =>
  !n.published_at || Date.now() / 1000 - n.published_at <= RECENT_HOURS * 3600;

/** Archív cikkek (weboldalparolas.py → src/data/archive.json), group_id szerint összevonva. */
type ArchiveRaw = {
  group_id?: string; source?: string; title?: string; link?: string;
  image?: string | null; summary?: string; category?: string | null; fetched_at?: number;
};
/** Minden valaha elkészült kártya (cikk_szintetizalas.py → news_archive.json), a friss news.json felülírja. */
const currentIds = new Set(news.map((n) => n.group_id));
export const history = (historyRaw as unknown as RawItem[]).filter((r) => r.group_id && !currentIds.has(r.group_id)).map(normalize);
const knownIds = new Set([...news, ...history].map((n) => n.group_id));
const archiveGroups = new Map<string, ArchiveRaw[]>();
for (const a of archiveRaw as unknown as ArchiveRaw[]) {
  const id = a.group_id || a.link;
  if (!id || knownIds.has(id)) continue;
  archiveGroups.set(id, [...(archiveGroups.get(id) ?? []), a]);
}
export const archive: NewsItem[] = [...archiveGroups.entries()].map(([id, arts]) => {
  const first = arts[0] ?? {};
  const c: LangContent = { title: first.title ?? "", lead: clean(first.summary?.slice(0, 220)), content: first.summary ?? "" };
  return {
    group_id: id,
    image: arts.find((x) => x.image)?.image ?? null,
    is_synthesized: false,
    sources: arts.map((x) => ({ source: x.source ?? "", title: x.title ?? "", link: x.link ?? "" })),
    published_at: Math.max(...arts.map((x) => x.fetched_at ?? 0)) || null,
    title: c.title, lead: c.lead, content: c.content,
    category: normCategory(first.category),
    i18n: { hu: c, ro: c },
  };
});

export const getNews = (id: string) => news.find((n) => n.group_id === id) ?? history.find((n) => n.group_id === id) ?? archive.find((n) => n.group_id === id);

/** Relevancia: több forrás + AI összefűzés előre, azon belül frissebb előre. Az archívumot is tartalmazza. */
export const byRelevance = [...news, ...history, ...archive].sort(
  (a, b) =>
    (b.sources.length + (b.is_synthesized ? 1 : 0)) - (a.sources.length + (a.is_synthesized ? 1 : 0)) ||
    (b.published_at ?? 0) - (a.published_at ?? 0),
);


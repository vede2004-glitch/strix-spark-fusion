import type { NewsItem } from "@/lib/news";

// A src/galeria mappa képei, almappánként (kategóriánként) csoportosítva.
// A Vite build-time beágyazza őket, így élesben is működik.
const modules = import.meta.glob("../galeria/**/*.jpg", { eager: true, import: "default" }) as Record<string, string>;

const byFolder: Record<string, string[]> = {};
for (const [path, url] of Object.entries(modules)) {
  const folder = /\.\.\/galeria\/([^/]+)\//.exec(path)?.[1];
  if (!folder) continue;
  (byFolder[folder] ??= []).push(url);
}

// Hírkategória → galéria almappa
const folderFor: Record<string, string> = {
  Politika: "politika",
  Gazdaság: "altalanos",
  Erdély: "erdely",
  Sport: "sport",
  Kultúra: "kultura",
  Bulvár: "bulvar",
  Általános: "altalanos",
};

// Determinisztikus "random": ugyanahhoz a hírhez mindig ugyanaz a kép tartozik.
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Kép a hírhez: ha van saját képe, azt adja vissza; különben a kategóriájának megfelelő galéria-képet. */
// A szkript ilyen placeholder URL-t ír, ha nincs kép — ezt "nincs kép"-ként kezeljük.
const isPlaceholder = (url: string) => /via\.placeholder\.com|placehold|Nincs\+Kep/i.test(url);

export function newsImage(n: NewsItem): string | null {
  if (n.image && !isPlaceholder(n.image)) return n.image;
  const folder = folderFor[n.category] ?? "altalanos";
  const pool = (byFolder[folder]?.length ? byFolder[folder] : byFolder["altalanos"]) ?? [];
  if (!pool.length) return null;
  return pool[hash(n.group_id) % pool.length] ?? null;
}

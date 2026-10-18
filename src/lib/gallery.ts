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

// Determinisztikus "random": ugyanahhoz a hírhez mindig ugyanaz a kép tartozik,
// de a képek jól szétszóródnak a hírek között (FNV-1a + avalanche keverés —
// az egyszerű 31-es hash a egymás utáni group_id-kra hasonló értékeket adott).
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27220a95);
  h ^= h >>> 16;
  return h >>> 0;
};

// A képlistát egyszer, determinisztikusan átkeverjük, hogy a fájlrendezési
// sorrend és a hash-értékek ne egyezzenek rá ugyanarra a képre egymás után.
const shuffled = (urls: string[]) =>
  urls
    .map((u) => ({ u, k: hash(u) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.u);

const byFolderShuffled: Record<string, string[]> = {};
for (const [folder, urls] of Object.entries(byFolder)) {
  byFolderShuffled[folder] = shuffled(urls);
}

/** Kép a hírhez: ha van saját képe, azt adja vissza; különben a kategóriájának megfelelő galéria-képet. */
// A szkript ilyen placeholder URL-t ír, ha nincs kép — ezt "nincs kép"-ként kezeljük.
const isPlaceholder = (url: string) => /via\.placeholder\.com|placehold|Nincs\+Kep/i.test(url);

export function newsImage(n: NewsItem): string | null {
  if (n.image && !isPlaceholder(n.image)) return n.image;
  const folder = folderFor[n.category] ?? "altalanos";
  const pool = (byFolderShuffled[folder]?.length ? byFolderShuffled[folder] : byFolderShuffled["altalanos"]) ?? [];
  if (!pool.length) return null;
  return pool[hash(n.group_id) % pool.length] ?? null;
}

import { news } from "@/lib/news";

export type SourceLanguage = "hu" | "ro";
export type SourceEntry = { name: string; url: string; feedUrl: string; language: SourceLanguage; articleCount: number };

const HU_MARKERS = ["hargita", "kolozsvári", "manna", "maszol", "mediatica", "romkat", "szatmári", "transtelex", "vásárhely"];

const getSiteUrl = (link: string) => {
  try { return new URL(link).origin; } catch { return link; }
};

const languageOf = (name: string): SourceLanguage =>
  HU_MARKERS.some((marker) => name.toLocaleLowerCase("hu").includes(marker)) ? "hu" : "ro";

export function getActiveSources(): SourceEntry[] {
  const sources = new Map<string, SourceEntry>();
  for (const item of news) {
    for (const source of item.sources) {
      const name = source.source.trim();
      if (!name) continue;
      const existing = sources.get(name);
      if (existing) {
        existing.articleCount += 1;
        if (!existing.url && source.link) existing.url = getSiteUrl(source.link);
      } else {
        sources.set(name, { name, url: getSiteUrl(source.link), feedUrl: "", language: languageOf(name), articleCount: 1 });
      }
    }
  }
  return [...sources.values()].sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

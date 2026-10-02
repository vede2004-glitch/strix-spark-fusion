import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileCode2, Link2, RotateCcw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveSources, type SourceEntry } from "@/lib/sourceDirectory";
import type { Lang } from "@/lib/lang";

const STORAGE_KEY = "stirix-source-directory-v1";
const copy = {
  hu: { manager: "Forráslista kezelése", managerText: "Töltsd be a Python hírszkriptedet. A rendszer frissíti a hivatkozásokat, a már meglévőket nem duplázza, és csak a jelenlegi hírekben szereplő forrásokat tartja meg.", import: "Python szkript betöltése", reset: "Alaphelyzet", search: "Forrás keresése…", checked: "Ellenőrizve", stories: "hír", website: "Weboldal", rss: "RSS-cím", noRss: "Nincs RSS-cím a betöltött szkriptben", active: "aktív forrás", updated: "hivatkozás frissítve", ignored: "inaktív forrás kihagyva", badFile: "Nem találtam RSS_FEEDS forráslistát ebben a Python fájlban.", saved: "A forráslista frissült.", resetDone: "A saját módosításokat töröltem.", huSources: "Magyar források", roSources: "Román források", empty: "Nincs a keresésnek megfelelő forrás." },
  ro: { manager: "Administrarea surselor", managerText: "Încarcă scriptul Python de știri. Sistemul actualizează linkurile, evită duplicatele și păstrează doar sursele prezente în știrile actuale.", import: "Încarcă scriptul Python", reset: "Resetează", search: "Caută o sursă…", checked: "Verificată", stories: "știri", website: "Site", rss: "Adresă RSS", noRss: "Scriptul încărcat nu conține o adresă RSS", active: "surse active", updated: "linkuri actualizate", ignored: "surse inactive omise", badFile: "Nu am găsit lista RSS_FEEDS în acest fișier Python.", saved: "Lista surselor a fost actualizată.", resetDone: "Modificările locale au fost șterse.", huSources: "Surse în limba maghiară", roSources: "Surse în limba română", empty: "Nu există surse pentru această căutare." },
} as const;

function parsePythonFeeds(text: string) {
  const block = text.match(/RSS_FEEDS\s*=\s*\{([\s\S]*?)\n\}/)?.[1];
  if (!block) return [];
  const feeds: Array<{ name: string; feedUrl: string }> = [];
  const entry = /["']([^"']+)["']\s*:\s*["'](https?:\/\/[^"']+)["']/g;
  for (const match of block.matchAll(entry)) feeds.push({ name: match[1].trim(), feedUrl: match[2].trim() });
  return feeds;
}

const normalizeName = (name: string) => name.toLocaleLowerCase("hu").replace(/\s*\([^)]*\)\s*/g, " ").replace(/[^a-záéíóöőúüű0-9]/gi, "").trim();

function SourceCard({ source, lang, onUrlChange }: { source: SourceEntry; lang: Lang; onUrlChange: (name: string, url: string) => void }) {
  const t = copy[lang];
  return <article className="rounded-lg border border-border bg-card/70 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-display text-base font-bold text-foreground">{source.name}</h3><p className="mt-1 text-xs text-muted-foreground">{source.articleCount} {t.stories}</p></div><Badge variant="outline" className="gap-1 border-primary/30 text-primary"><CheckCircle2 className="size-3" />{t.checked}</Badge></div>
    <label className="mt-4 block text-xs font-bold text-muted-foreground">{t.website}</label>
    <div className="mt-1 flex gap-2"><Input aria-label={`${source.name} ${t.website}`} value={source.url} onChange={(event) => onUrlChange(source.name, event.target.value)} /><Button variant="outline" size="icon" onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")} disabled={!source.url} title={t.website} aria-label={`${source.name} ${t.website}`}><ExternalLink className="size-4" /></Button></div>
    <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" /><span className="break-all">{source.feedUrl || t.noRss}</span></div>
  </article>;
}

export function SourceManager({ lang }: { lang: Lang }) {
  const defaults = useMemo(() => getActiveSources(), []);
  const [sources, setSources] = useState(defaults);
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<{ updated: number; ignored: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[lang];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SourceEntry[] | null;
      if (!saved) return;
      const activeNames = new Set(defaults.map((source) => source.name));
      setSources(saved.filter((source) => activeNames.has(source.name)));
    } catch {}
  }, [defaults]);

  const persist = (next: SourceEntry[]) => { setSources(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {} };
  const onFile = async (file?: File) => {
    if (!file) return;
    const feeds = parsePythonFeeds(await file.text());
    if (!feeds.length) { toast.error(t.badFile); return; }
    const byName = new Map(feeds.map((feed) => [normalizeName(feed.name), feed]));
    let updated = 0;
    const next = defaults.map((source) => {
      const feed = byName.get(normalizeName(source.name));
      if (!feed) return source;
      updated += 1;
      let url = source.url;
      try { url = new URL(feed.feedUrl).origin; } catch {}
      return { ...source, feedUrl: feed.feedUrl, url };
    });
    persist(next);
    setReport({ updated, ignored: Math.max(0, feeds.length - updated) });
    toast.success(t.saved);
  };
  const updateUrl = (name: string, url: string) => persist(sources.map((source) => source.name === name ? { ...source, url } : source));
  const reset = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} setSources(defaults); setReport(null); toast.success(t.resetDone); };
  const visible = sources.filter((source) => source.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")));

  return <div className="space-y-8">
    <section className="rounded-lg border border-primary/25 bg-primary/5 p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><div className="flex items-center gap-2 text-primary"><FileCode2 className="size-5" /><h2 className="font-display text-xl font-bold">{t.manager}</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{t.managerText}</p></div><div className="flex flex-wrap gap-2"><input ref={inputRef} type="file" accept=".py,text/x-python" className="hidden" onChange={(event) => { void onFile(event.target.files?.[0]); event.target.value = ""; }} /><Button onClick={() => inputRef.current?.click()}><Upload className="mr-2 size-4" />{t.import}</Button><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 size-4" />{t.reset}</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-border bg-background/60 p-3"><strong className="text-xl">{sources.length}</strong><p className="text-xs text-muted-foreground">{t.active}</p></div><div className="rounded-md border border-border bg-background/60 p-3"><strong className="text-xl">{report?.updated ?? 0}</strong><p className="text-xs text-muted-foreground">{t.updated}</p></div><div className="rounded-md border border-border bg-background/60 p-3"><strong className="text-xl">{report?.ignored ?? 0}</strong><p className="text-xs text-muted-foreground">{t.ignored}</p></div></div></section>
    <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="pl-9" /></div>
    {(["hu", "ro"] as const).map((language) => { const group = visible.filter((source) => source.language === language); if (!group.length) return null; return <section key={language}><div className="mb-4 flex items-center gap-3"><h2 className="font-display text-xl font-bold">{language === "hu" ? t.huSources : t.roSources}</h2><Badge variant="secondary">{group.length}</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.map((source) => <SourceCard key={source.name} source={source} lang={lang} onUrlChange={updateUrl} />)}</div></section>; })}
    {!visible.length && <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>}
  </div>;
}

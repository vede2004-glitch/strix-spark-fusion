import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveSources, type SourceEntry } from "@/lib/sourceDirectory";
import type { Lang } from "@/lib/lang";

const STORAGE_KEY = "stirix-source-directory-v1";
const copy = {
  hu: { manager: "Forráslista kezelése", managerText: "Itt ellenőrizheted és szerkesztheted a megjelenő források webcímeit. A lista automatikusan a jelenlegi hírek forrásaiból épül fel, a RSS-címeket pedig megjelenítjük tájékoztatásként.", reset: "Alaphelyzet", resetDone: "A saját módosításokat töröltem.", search: "Forrás keresése…", checked: "Ellenőrizve", stories: "hír", website: "Weboldal", rss: "RSS-cím", noRss: "Nincs ismert RSS-cím", active: "aktív forrás", huSources: "Magyar források", roSources: "Román források", empty: "Nincs a keresésnek megfelelő forrás." },
  ro: { manager: "Administrarea surselor", managerText: "Aici poți verifica și edita adresele web ale surselor afișate. Lista se generează automat din sursele știrilor actuale, iar adresele RSS sunt afișate cu titlu informativ.", reset: "Resetează", resetDone: "Modificările locale au fost șterse.", search: "Caută o sursă…", checked: "Verificată", stories: "știri", website: "Site", rss: "Adresă RSS", noRss: "Nu există adresă RSS cunoscută", active: "surse active", huSources: "Surse în limba maghiară", roSources: "Surse în limba română", empty: "Nu există surse pentru această căutare." },
} as const;

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
  const updateUrl = (name: string, url: string) => persist(sources.map((source) => source.name === name ? { ...source, url } : source));
  const reset = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} setSources(defaults); toast.success(t.resetDone); };
  const visible = sources.filter((source) => source.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")));

  return <div className="space-y-8">
    <section className="rounded-lg border border-primary/25 bg-primary/5 p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><h2 className="font-display text-xl font-bold">{t.manager}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t.managerText}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 size-4" />{t.reset}</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-1"><div className="rounded-md border border-border bg-background/60 p-3"><strong className="text-xl">{sources.length}</strong><p className="text-xs text-muted-foreground">{t.active}</p></div></div></section>
    <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="pl-9" aria-label={t.search} /></div>
    {(["hu", "ro"] as const).map((language) => { const group = visible.filter((source) => source.language === language); if (!group.length) return null; return <section key={language}><div className="mb-4 flex items-center gap-3"><h2 className="font-display text-xl font-bold">{language === "hu" ? t.huSources : t.roSources}</h2><Badge variant="secondary">{group.length}</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.map((source) => <SourceCard key={source.name} source={source} lang={lang} onUrlChange={updateUrl} />)}</div></section>; })}
    {!visible.length && <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>}
  </div>;
}

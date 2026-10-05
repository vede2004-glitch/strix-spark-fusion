import { createFileRoute, Link } from "@tanstack/react-router";
import { synthesized, singles, timeAgo, formatDate, isRecent, isHungarianSource, tr, CATEGORIES, ALL, type NewsItem } from "@/lib/news";
import { useLang, setLang, LANGS } from "@/lib/lang";
import { Search, X } from "lucide-react";
import { SiteMenu } from "@/components/SiteMenu";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import borderCrossing from "@/assets/stirix-border-crossing.jpg";
import hospital from "@/assets/stirix-hospital.jpg";
import harghita from "@/assets/stirix-harghita.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stirix.ro – Minden hír egy helyen" },
      { name: "description", content: "Románia hírei magyarul és románul, több forrásból, gyors AI-összefoglalókkal." },
      { property: "og:title", content: "Stirix.ro – Minden hír egy helyen" },
      { property: "og:description", content: "Románia hírei magyarul és románul, több forrásból, gyors AI-összefoglalókkal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const categories = [ALL, ...CATEGORIES];
const categoryRo: Record<string, string> = {
  [ALL]: "Toate știrile", "Általános": "General", "Politika": "Politică", Sport: "Sport",
  "Közélet": "Societate", "Kultúra": "Cultură", "Gazdaság": "Economie", "Bulvár": "Monden",
};
const fallbackImages = [borderCrossing, hospital, harghita];
const img = (n: NewsItem, i: number) => n.image || fallbackImages[i % 3];

function Index() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Összes hír");
  const lang = useLang();
  const language = lang.toUpperCase();
  const ro = lang === "ro";
  const labelCategory = (value: string) => ro ? categoryRo[value] ?? value : value;
  const t = (n: NewsItem) => tr(n, lang);
  const [mobileSearch, setMobileSearch] = useState(false);
  const match = (n: NewsItem) => (category === "Összes hír" || n.category === category) && `${t(n).title} ${t(n).lead}`.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu"));
  const aiList = useMemo(() => synthesized.filter(isRecent).filter(match), [category, query, lang]);
  const liveList = useMemo(
    () => singles.filter(isRecent).filter((n) => (language === "HU" ? isHungarianSource(n) : language === "RO" ? !isHungarianSource(n) : true)).filter(match).slice(0, 25),
    [category, query, lang],
  );
  const [lead, side1, side2, ...rest] = aiList;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto grid h-17 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-5 md:gap-8">
            <a href="#top" aria-label="Stirix főoldal" className="flex min-w-0 items-center gap-3">
              <img src="/stirix-logo.png" alt="Stirix.ro" className="h-11 w-28 shrink-0 object-contain object-left sm:h-13 sm:w-34" />
              <span className="hidden border-l border-border pl-3 text-[9px] font-bold uppercase leading-tight text-muted-foreground lg:block">{ro ? <>Toate știrile<br />într-un singur loc</> : <>Minden hír<br />egy helyen</>}</span>
            </a>
            <label className="hidden items-center rounded-full border border-border bg-secondary px-4 py-2 focus-within:border-primary/50 md:flex">
              <span className="mr-3 size-2 shrink-0 rounded-full bg-primary animate-live" />
              <span className="sr-only">{ro ? "Căutare" : "Keresés"}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ro ? "Caută știri..." : "Keresés hírekre..."} className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="flex items-center">
              {LANGS.map((item) => <Button key={item} variant="ghost" size="sm" onClick={() => setLang(item)} className={lang === item ? "text-primary" : ""}>{item.toUpperCase()}</Button>)}
            </div>
            <Button variant="outline" size="icon" aria-label={mobileSearch ? (ro ? "Închide căutarea" : "Kereső bezárása") : (ro ? "Căutare" : "Keresés")} onClick={() => setMobileSearch((value) => !value)} className="md:hidden">{mobileSearch ? <X className="size-4" /> : <Search className="size-4" />}</Button>
            <SiteMenu />
          </div>
        </div>
        {mobileSearch && <div className="border-t border-border px-4 py-3 md:hidden"><label className="flex items-center rounded-md border border-border bg-secondary px-3"><Search className="mr-2 size-4 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ro ? "Caută știri..." : "Keresés hírekre..."} className="h-10 w-full bg-transparent text-sm outline-none" /></label></div>}
        <nav aria-label={ro ? "Categorii de știri" : "Hírkategóriák"} className="mx-auto flex max-w-7xl gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {categories.map((item) => <Button key={item} variant={category === item ? "default" : "ghost"} size="sm" onClick={() => setCategory(item)} className="whitespace-nowrap">{labelCategory(item)}</Button>)}
          <Button asChild variant="outline" size="sm" className="ml-auto whitespace-nowrap"><Link to="/osszes">{ro ? "Toate știrile (arhivă)" : "Minden hír (archívum)"}</Link></Button>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {lead && <section aria-label={ro ? "Știri principale" : "Kiemelt hírek"} className="grid grid-cols-12 gap-4 lg:auto-rows-[240px]">
          <Link to="/hir/$id" params={{ id: lead.group_id }} className="group relative col-span-12 min-h-[470px] overflow-hidden rounded-lg border border-border lg:col-span-8 lg:row-span-2">
            <img src={img(lead, 0)} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,var(--overlay)_42%,transparent_100%)]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3"><span className="rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">✨ {ro ? "Știre sintetizată cu AI" : "AI Összesített Hír"}</span><span className="text-[10px] font-bold uppercase text-muted-foreground">{labelCategory(lead.category)} · {timeAgo(lead.published_at, lang)} · {formatDate(lead.published_at, lang)}</span></div>
              <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-[1.1] sm:text-5xl">{t(lead).title}</h1>
              <p className="mt-4 hidden max-w-2xl text-base font-medium text-foreground/65 line-clamp-3 sm:block">{t(lead).lead}</p>
              <p className="mt-5 text-xs font-medium uppercase text-muted-foreground">{ro ? `Pe baza a ${lead.sources.length} surse` : `${lead.sources.length} forrás alapján`}</p>
            </div>
          </Link>
          {[side1, side2].filter((n): n is NewsItem => !!n).map((n) => <Link key={n.group_id} to="/hir/$id" params={{ id: n.group_id }} className="group col-span-12 flex min-h-44 flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/30 sm:col-span-6 lg:col-span-4 lg:min-h-0"><div><p className="mb-3 text-[10px] font-bold uppercase text-primary">✨ AI · {labelCategory(n.category)}</p><h2 className="font-display text-xl font-bold leading-tight line-clamp-4 transition-colors group-hover:text-primary">{t(n).title}</h2></div><div className="mt-4 flex items-center justify-between"><span className="text-[10px] font-medium uppercase text-muted-foreground">{formatDate(n.published_at, lang)}</span><span className="grid size-7 place-items-center rounded-full border border-border text-[10px] text-muted-foreground" aria-label={ro ? `${n.sources.length} surse` : `${n.sources.length} forrás`}>{n.sources.length}</span></div></Link>)}
        </section>}

        <section className="mt-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4"><h2 className="font-display text-lg font-extrabold uppercase">{ro ? "Știri sintetizate cu AI" : "AI összesített hírek"}</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary animate-live" />{aiList.length} {ro ? "știri" : "hír"}</span></div>
            {rest.length ? <div className="grid grid-cols-1 gap-x-6 gap-y-9 md:grid-cols-2">
              {rest.map((story, i) => <Link key={story.group_id} to="/hir/$id" params={{ id: story.group_id }} className="group min-w-0">
                <div className="relative mb-4 aspect-video overflow-hidden rounded-lg border border-border bg-card"><img src={img(story, i + 1)} loading="lazy" alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-sm border border-primary/20 bg-background/85 px-2 py-1 text-[9px] font-bold uppercase text-primary backdrop-blur">✨ {ro ? "Sintetizat cu AI" : "AI Összesített"}</span></div>
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-muted-foreground"><span>{labelCategory(story.category)}</span><span>{formatDate(story.published_at, lang)}</span></div>
                <h3 className="font-display text-lg font-bold leading-tight transition-colors group-hover:text-primary">{t(story).title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{t(story).lead}</p>
                <p className="mt-3 text-[10px] font-bold uppercase text-primary">{ro ? `Pe baza a ${story.sources.length} surse` : `${story.sources.length} forrás alapján`}</p>
              </Link>)}
            </div> : <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{lead ? (ro ? "Nu mai sunt știri sintetizate cu AI în această secțiune." : "Nincs több AI összesített hír ebben a nézetben.") : (ro ? "Niciun rezultat. Încearcă altă căutare sau categorie." : "Nincs találat. Próbálj másik keresést vagy kategóriát.")}</div>}
          </div>

          <aside className="col-span-12 lg:col-span-4">
            <div className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-32">
              <h2 className="mb-6 flex items-center justify-between font-display text-lg font-extrabold uppercase">{ro ? "Ultimele știri" : "Friss hírek"}<span className="flex items-center gap-2 font-sans text-[10px] text-muted-foreground"><span className="size-2 rounded-full bg-primary animate-live" />{ro ? "Live" : "Élő"}</span></h2>
              <ol className="max-h-[60vh] space-y-4 overflow-y-auto border-l border-border pl-4">
                {liveList.map((n) => <li key={n.group_id} className="relative"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/60" /><Link to="/hir/$id" params={{ id: n.group_id }} className="group block"><span className="text-[10px] font-bold uppercase text-muted-foreground">{formatDate(n.published_at, lang)} · {n.sources[0]?.source}</span><h3 className="mt-1 text-sm font-bold leading-snug transition-colors group-hover:text-primary">{t(n).title}</h3></Link></li>)}
                {!liveList.length && <li className="text-xs text-muted-foreground">{ro ? "Nu sunt știri recente." : "Nincs friss hír."}</li>}
              </ol>
              <div className="mt-8 border-t border-border pt-8"><div className="rounded-md border border-primary/10 bg-primary/5 p-4"><p className="mb-2 text-[11px] font-bold uppercase text-primary">Stirix AI</p><p className="text-xs leading-relaxed text-foreground/70">{ro ? "Știrile marcate cu ✨ sunt sintetizate cu AI din mai multe surse, pentru a vedea informația completă într-un singur loc." : "A ✨ jelölésű hírek több forrásból, AI-jal összefűzve készülnek, hogy egy helyen lásd a teljes hírt."}</p></div></div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="mt-20 border-t border-border py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row"><img src="/stirix-logo.png" alt="Stirix.ro" className="h-10 w-32 object-contain" /><p className="text-center text-[10px] font-bold uppercase text-muted-foreground">© 2026 Stirix.ro · {ro ? "Toate știrile într-un singur loc" : "Minden hír egy helyen"}</p><div className="flex gap-5 text-[10px] font-bold uppercase text-muted-foreground"><a href="#top" className="hover:text-primary">{ro ? "Surse" : "Források"}</a><a href="#top" className="hover:text-primary">{ro ? "Contact" : "Kapcsolat"}</a></div></div></footer>
    </div>
  );
}

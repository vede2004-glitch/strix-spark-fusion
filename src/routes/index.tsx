import { createFileRoute, Link } from "@tanstack/react-router";
import { news, synthesized, singles, timeAgo, isHungarianSource, type NewsItem } from "@/lib/news";
import { Menu, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/stirix-logo.png.asset.json";
import borderCrossing from "@/assets/stirix-border-crossing.jpg";
import hospital from "@/assets/stirix-hospital.jpg";
import harghita from "@/assets/stirix-harghita.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stirix.ro – Minden hír egy helyen" },
      { name: "description", content: "Erdély és Románia hírei több forrásból, gyors AI-összefoglalókkal." },
      { property: "og:title", content: "Stirix.ro – Minden hír egy helyen" },
      { property: "og:description", content: "Erdély és Románia hírei több forrásból, gyors AI-összefoglalókkal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const categories = ["Összes hír", ...Array.from(new Set(news.map((n) => n.category)))];
const fallbackImages = [borderCrossing, hospital, harghita];
const img = (n: NewsItem, i: number) => n.image || fallbackImages[i % 3];

function Index() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Összes hír");
  const [language, setLanguage] = useState("HU");
  const [mobileSearch, setMobileSearch] = useState(false);
  const match = (n: NewsItem) => (category === "Összes hír" || n.category === category) && `${n.title} ${n.lead}`.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu"));
  const aiList = useMemo(() => synthesized.filter(match), [category, query]);
  const liveList = useMemo(
    () => singles.filter((n) => (language === "HU" ? isHungarianSource(n) : language === "RO" ? !isHungarianSource(n) : true)).filter(match).slice(0, 25),
    [category, query, language],
  );
  const [lead, side1, side2, ...rest] = aiList;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto grid h-17 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-5 md:gap-8">
            <a href="#top" aria-label="Stirix főoldal" className="flex min-w-0 items-center gap-3">
              <img src={logoAsset.url} alt="Stirix.ro" className="h-10 w-28 shrink-0 object-cover object-center sm:h-12 sm:w-36" />
              <span className="hidden border-l border-border pl-3 text-[9px] font-bold uppercase leading-tight text-muted-foreground lg:block">Minden hír<br />egy helyen</span>
            </a>
            <label className="hidden items-center rounded-full border border-border bg-secondary px-4 py-2 focus-within:border-primary/50 md:flex">
              <span className="mr-3 size-2 shrink-0 rounded-full bg-primary animate-live" />
              <span className="sr-only">Keresés</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés hírekre..." className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="flex items-center">
              {["HU", "RO", "EN"].map((item) => <Button key={item} variant="ghost" size="sm" onClick={() => setLanguage(item)} className={language === item ? "text-primary" : ""}>{item}</Button>)}
            </div>
            <Button variant="outline" size="icon" aria-label={mobileSearch ? "Kereső bezárása" : "Keresés"} onClick={() => setMobileSearch((value) => !value)} className="md:hidden">{mobileSearch ? <X className="size-4" /> : <Search className="size-4" />}</Button>
            <Button variant="outline" size="icon" aria-label="Menü"><Menu className="size-4" /></Button>
          </div>
        </div>
        {mobileSearch && <div className="border-t border-border px-4 py-3 md:hidden"><label className="flex items-center rounded-md border border-border bg-secondary px-3"><Search className="mr-2 size-4 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keresés hírekre..." className="h-10 w-full bg-transparent text-sm outline-none" /></label></div>}
        <nav aria-label="Hírkategóriák" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {categories.map((item) => <Button key={item} variant={category === item ? "default" : "ghost"} size="sm" onClick={() => setCategory(item)} className="whitespace-nowrap">{item}</Button>)}
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {lead && <section aria-label="Kiemelt hírek" className="grid grid-cols-12 gap-4 lg:auto-rows-[240px]">
          <Link to="/hir/$id" params={{ id: lead.group_id }} className="group relative col-span-12 min-h-[470px] overflow-hidden rounded-lg border border-border lg:col-span-8 lg:row-span-2">
            <img src={img(lead, 0)} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,var(--overlay)_42%,transparent_100%)]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3"><span className="rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">✨ AI Összesített Hír</span><span className="text-[10px] font-bold uppercase text-muted-foreground">{lead.category} · {timeAgo(lead.published_at)}</span></div>
              <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-[1.1] sm:text-5xl">{lead.title}</h1>
              <p className="mt-4 hidden max-w-2xl text-base font-medium text-foreground/65 line-clamp-3 sm:block">{lead.lead}</p>
              <p className="mt-5 text-xs font-medium uppercase text-muted-foreground">{lead.sources.length} forrás alapján</p>
            </div>
          </Link>
          {[side1, side2].filter((n): n is NewsItem => !!n).map((n) => <Link key={n.group_id} to="/hir/$id" params={{ id: n.group_id }} className="group col-span-12 flex min-h-44 flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/30 sm:col-span-6 lg:col-span-4 lg:min-h-0"><div><p className="mb-3 text-[10px] font-bold uppercase text-primary">✨ AI · {n.category}</p><h2 className="font-display text-xl font-bold leading-tight line-clamp-4 transition-colors group-hover:text-primary">{n.title}</h2></div><div className="mt-4 flex items-center justify-between"><span className="text-[10px] font-medium uppercase text-muted-foreground">{timeAgo(n.published_at)}</span><span className="grid size-7 place-items-center rounded-full border border-border text-[10px] text-muted-foreground" aria-label={`${n.sources.length} forrás`}>{n.sources.length}</span></div></Link>)}
        </section>}

        <section className="mt-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4"><h2 className="font-display text-lg font-extrabold uppercase">AI összesített hírek</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary animate-live" />{aiList.length} hír</span></div>
            {rest.length ? <div className="grid grid-cols-1 gap-x-6 gap-y-9 md:grid-cols-2">
              {rest.map((story, i) => <Link key={story.group_id} to="/hir/$id" params={{ id: story.group_id }} className="group min-w-0">
                <div className="relative mb-4 aspect-video overflow-hidden rounded-lg border border-border bg-card"><img src={img(story, i + 1)} loading="lazy" alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-sm border border-primary/20 bg-background/85 px-2 py-1 text-[9px] font-bold uppercase text-primary backdrop-blur">✨ AI Összesített</span></div>
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-muted-foreground"><span>{story.category}</span><span>{timeAgo(story.published_at)}</span></div>
                <h3 className="font-display text-lg font-bold leading-tight transition-colors group-hover:text-primary">{story.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{story.lead}</p>
                <p className="mt-3 text-[10px] font-bold uppercase text-primary">{story.sources.length} forrás alapján</p>
              </Link>)}
            </div> : <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{lead ? "Nincs több AI összesített hír ebben a nézetben." : "Nincs találat. Próbálj másik keresést vagy kategóriát."}</div>}
          </div>

          <aside className="col-span-12 lg:col-span-4">
            <div className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-32">
              <h2 className="mb-6 flex items-center justify-between font-display text-lg font-extrabold uppercase">Friss hírek<span className="flex items-center gap-2 font-sans text-[10px] text-muted-foreground"><span className="size-2 rounded-full bg-primary animate-live" />Élő</span></h2>
              <ol className="max-h-[60vh] space-y-4 overflow-y-auto border-l border-border pl-4">
                {liveList.map((n) => <li key={n.group_id} className="relative"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/60" /><Link to="/hir/$id" params={{ id: n.group_id }} className="group block"><span className="text-[10px] font-bold uppercase text-muted-foreground">{timeAgo(n.published_at)} · {n.sources[0]?.source}</span><h3 className="mt-1 text-sm font-bold leading-snug transition-colors group-hover:text-primary">{n.title}</h3></Link></li>)}
                {!liveList.length && <li className="text-xs text-muted-foreground">Nincs friss hír.</li>}
              </ol>
              <div className="mt-8 border-t border-border pt-8"><div className="rounded-md border border-primary/10 bg-primary/5 p-4"><p className="mb-2 text-[11px] font-bold uppercase text-primary">Stirix AI</p><p className="text-xs leading-relaxed text-foreground/70">A ✨ jelölésű hírek több forrásból, AI-jal összefűzve készülnek, hogy egy helyen lásd a teljes hírt.</p></div></div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="mt-20 border-t border-border py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row"><img src={logoAsset.url} alt="Stirix.ro" className="h-9 w-28 object-cover object-center" /><p className="text-center text-[10px] font-bold uppercase text-muted-foreground">© 2026 Stirix.ro · Minden hír egy helyen</p><div className="flex gap-5 text-[10px] font-bold uppercase text-muted-foreground"><a href="#top" className="hover:text-primary">Források</a><a href="#top" className="hover:text-primary">Kapcsolat</a></div></div></footer>
    </div>
  );
}

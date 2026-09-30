import { createFileRoute } from "@tanstack/react-router";
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

const categories = ["Összes hír", "Erdély", "Románia", "Gazdaság", "Kultúra", "Technológia", "Sport"];

const stories = [
  { category: "Marosvásárhely", title: "Új szárny épül a marosvásárhelyi kórháznak – uniós támogatással", excerpt: "Több mint 50 millió eurós keretből valósul meg a fejlesztés, modern sürgősségi osztállyal.", image: hospital, time: "2 órája", sources: 6 },
  { category: "Erdély", title: "Havazásra figyelmeztetnek a Hargitában: lezárt utak", excerpt: "A hegyvidéki szakaszokon kötelező a téli gumi, több úton pedig korlátozásra kell számítani.", image: harghita, time: "4 órája", sources: 3 },
  { category: "Gazdaság", title: "Új befektetés érkezik Erdélybe – 500 munkahely jöhet létre", excerpt: "Egy nemzetközi technológiai vállalat nyit új regionális központot.", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=900", time: "5 órája", sources: 4 },
  { category: "Erdély", title: "Fejlesztések indulnak Nagyvárad belvárosában", excerpt: "A közlekedési és közösségi terek korszerűsítésére különítettek el jelentős keretet.", image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=900", time: "1 órája", sources: 2 },
  { category: "Kultúra", title: "Megnyílt a 20. Kolozsvári Filmnapok", excerpt: "Rekordszámú nevezéssel és tíz helyszínen indul az idei programsorozat.", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=900", time: "3 órája", sources: 5 },
  { category: "Technológia", title: "Digitális tantermekkel bővülnek az erdélyi iskolák", excerpt: "Új eszközök és gyorsabb hálózat segíti a magyar nyelvű oktatást.", image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=900", time: "6 órája", sources: 7 },
];

function Index() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Összes hír");
  const [language, setLanguage] = useState("HU");
  const [mobileSearch, setMobileSearch] = useState(false);
  const filteredStories = useMemo(() => stories.filter((story) => {
    const matchesCategory = category === "Összes hír" || story.category === category || (category === "Erdély" && ["Marosvásárhely", "Erdély"].includes(story.category));
    const haystack = `${story.title} ${story.excerpt} ${story.category}`.toLocaleLowerCase("hu");
    return matchesCategory && haystack.includes(query.toLocaleLowerCase("hu"));
  }), [category, query]);

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
        <section aria-label="Kiemelt hírek" className="grid grid-cols-12 gap-4 lg:auto-rows-[240px]">
          <article className="group relative col-span-12 min-h-[470px] overflow-hidden rounded-lg border border-border lg:col-span-8 lg:row-span-2">
            <img src={borderCrossing} width={1200} height={800} alt="Határátkelő Erdélyben alkonyatkor" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_0%,var(--overlay)_42%,transparent_100%)]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3"><span className="rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">Kiemelt</span><span className="text-[10px] font-bold uppercase text-muted-foreground">12 perce frissült</span></div>
              <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-[1.1] sm:text-5xl">Újabb stratégiai határátkelő nyílik Magyarország és Románia között</h1>
              <p className="mt-4 hidden max-w-2xl text-base font-medium text-foreground/65 sm:block">Három új gyorsforgalmi kapcsolat épül ki a két ország között, jelentősen csökkentve a várakozási időt.</p>
              <div className="mt-5 flex flex-wrap items-center gap-5"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary"><span className="grid size-6 place-items-center rounded-full bg-primary text-[9px] text-primary-foreground">AI</span>Összefoglalva</span><span className="text-xs font-medium uppercase text-muted-foreground">8 forrás alapján</span></div>
            </div>
          </article>
          {[
            ["Gazdaság", "Történelmi aszály sújtja az erdélyi mezőgazdaságot: 30%-os kiesés várható", "4 órája", "5"],
            ["Kultúra", "Megnyílt a 20. Kolozsvári Filmnapok: rekordszámú nevezés", "2 órája", "3"],
          ].map(([label, title, time, count], index) => <article key={title} className="group col-span-12 flex min-h-44 flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/30 sm:col-span-6 lg:col-span-4 lg:min-h-0"><div><p className="mb-3 text-[10px] font-bold uppercase text-muted-foreground">{label}</p><h2 className="font-display text-xl font-bold leading-tight transition-colors group-hover:text-primary">{title}</h2></div><div className="mt-4 flex items-center justify-between"><span className="text-[10px] font-medium uppercase text-muted-foreground">{time}</span><span className="grid size-7 place-items-center rounded-full border border-border text-[10px] text-muted-foreground" aria-label={`${count} forrás`}>{count}</span></div></article>)}
        </section>

        <section className="mt-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4"><h2 className="font-display text-lg font-extrabold uppercase">Friss hírek</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary animate-live" />Élő frissítés</span></div>
            {filteredStories.length ? <div className="grid grid-cols-1 gap-x-6 gap-y-9 md:grid-cols-2">
              {filteredStories.map((story) => <article key={story.title} className="group min-w-0">
                <div className="relative mb-4 aspect-video overflow-hidden rounded-lg border border-border bg-card"><img src={story.image} loading="lazy" width={800} height={450} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute right-3 top-3 rounded-sm border border-primary/20 bg-background/85 px-2 py-1 text-[9px] font-bold uppercase text-primary backdrop-blur">AI összegzés</span></div>
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-muted-foreground"><span>{story.category}</span><span>{story.time}</span></div>
                <h3 className="font-display text-lg font-bold leading-tight transition-colors group-hover:text-primary">{story.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{story.excerpt}</p>
                <p className="mt-3 text-[10px] font-bold uppercase text-primary">{story.sources} forrás alapján</p>
              </article>)}
            </div> : <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nincs találat. Próbálj másik keresést vagy kategóriát.</div>}
          </div>

          <aside className="col-span-12 lg:col-span-4">
            <div className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-32">
              <h2 className="mb-6 font-display text-lg font-extrabold uppercase">Népszerű témák</h2>
              <ol className="space-y-6">
                {["A gázárak alakulása a téli szezon előtt", "RMDSZ-kongresszus: új prioritások", "Digitalizáció az erdélyi kisvállalkozásoknál"].map((title, index) => <li key={title} className="group flex gap-4"><span className="font-display text-2xl font-extrabold text-primary/40">0{index + 1}</span><div><h3 className="text-sm font-bold leading-snug transition-colors group-hover:text-primary">{title}</h3><span className="mt-1 block text-[10px] uppercase text-muted-foreground">{["12,4 ezer", "8,1 ezer", "5,9 ezer"][index]} olvasás</span></div></li>)}
              </ol>
              <div className="mt-8 border-t border-border pt-8"><div className="rounded-md border border-primary/10 bg-primary/5 p-4"><p className="mb-2 text-[11px] font-bold uppercase text-primary">Stirix AI</p><p className="text-xs leading-relaxed text-foreground/70">42 különböző forrást figyelünk, hogy egy helyen lásd a teljes hírt.</p></div></div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="mt-20 border-t border-border py-10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row"><img src={logoAsset.url} alt="Stirix.ro" className="h-9 w-28 object-cover object-center" /><p className="text-center text-[10px] font-bold uppercase text-muted-foreground">© 2026 Stirix.ro · Minden hír egy helyen</p><div className="flex gap-5 text-[10px] font-bold uppercase text-muted-foreground"><a href="#top" className="hover:text-primary">Források</a><a href="#top" className="hover:text-primary">Kapcsolat</a></div></div></footer>
    </div>
  );
}

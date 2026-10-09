import { BrandLogo } from "@/components/BrandLogo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { SiteMenu } from "@/components/SiteMenu";
import { getNews, timeAgo, tr } from "@/lib/news";
import { useLang, setLang, LANGS } from "@/lib/lang";
import { ArticleQA } from "@/components/ArticleQA";

export const Route = createFileRoute("/hir/$id")({
  loader: ({ params }) => {
    const item = getNews(params.id);
    if (!item) throw notFound();
    return item;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} – Stirix.ro` : "Hír – Stirix.ro";
    const desc = loaderData?.lead.slice(0, 160) ?? "Stirix.ro hír";
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (loaderData?.image?.startsWith("https://")) {
      meta.push({ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image });
    }
    return { meta };
  },
  component: Article,
});

function Article() {
  const item = Route.useLoaderData();
  const lang = useLang();
  const t = tr(item, lang);
  const ro = lang === "ro";
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />{ro ? "Înapoi" : "Vissza"}</Link>
          <div className="flex items-center gap-1">{LANGS.map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={`px-2 text-xs font-bold ${lang === l ? "text-primary" : "text-muted-foreground"}`}>{l.toUpperCase()}</button>)}</div>
          <Link to="/" aria-label="Stirix.ro"><BrandLogo className="h-9 w-28 origin-left object-contain sm:w-36" /></Link>
          <SiteMenu />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase">
          {item.is_synthesized ? <span className="inline-flex items-center gap-1 rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 text-primary"><Sparkles className="size-3" />{ro ? "Știre sintetizată cu AI" : "AI Összesített Hír"}</span> : <span className="rounded-sm border border-border px-2 py-1 text-muted-foreground">{ro ? "Sursă unică" : "Egyedi forrás"}</span>}
          <span className="text-muted-foreground">{ro ? ({ "Általános": "General", "Politika": "Politică", "Közélet": "Societate", "Kultúra": "Cultură", "Gazdaság": "Economie", "Bulvár": "Monden" }[item.category] ?? item.category) : item.category}</span>
          <span className="text-muted-foreground">{timeAgo(item.published_at, lang)}</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{t.title}</h1>
        {item.is_synthesized && !t.content.trim().startsWith(t.lead.replace(/…$/, "").trim().slice(0, 60)) && <p className="mt-4 text-lg font-medium leading-relaxed text-foreground/75">{t.lead}</p>}
        {item.image && <img src={item.image} alt="" className="mt-6 aspect-video w-full rounded-lg border border-border object-cover" />}
        <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/85">
          {t.content.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <section className="mt-12 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-sm font-extrabold uppercase">{item.is_synthesized ? (ro ? `Surse utilizate (${item.sources.length})` : `Felhasznált források (${item.sources.length})`) : (ro ? "Sursă" : "Forrás")}</h2>
          <ul className="space-y-3">
            {item.sources.map((s) => <li key={s.link}><a href={s.link} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:border-primary/40"><div><p className="text-[10px] font-bold uppercase text-primary">{s.source}</p><p className="mt-1 text-sm font-semibold leading-snug group-hover:text-primary">{s.title}</p></div><ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" /></a></li>)}
          </ul>
        </section>
        <ArticleQA key={item.group_id} id={item.group_id} />
      </main>
    </div>
  );
}

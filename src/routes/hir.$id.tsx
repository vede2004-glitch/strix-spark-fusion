import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import logoAsset from "@/assets/stirix-logo.png.asset.json";
import { getNews, timeAgo } from "@/lib/news";

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
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />Vissza</Link>
          <Link to="/"><img src={logoAsset.url} alt="Stirix.ro" className="h-10 w-28 object-cover" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase">
          {item.is_synthesized ? <span className="inline-flex items-center gap-1 rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 text-primary"><Sparkles className="size-3" />AI Összesített Hír</span> : <span className="rounded-sm border border-border px-2 py-1 text-muted-foreground">Egyedi forrás</span>}
          <span className="text-muted-foreground">{item.category}</span>
          <span className="text-muted-foreground">{timeAgo(item.published_at)}</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{item.title}</h1>
        {item.is_synthesized && <p className="mt-4 text-lg font-medium leading-relaxed text-foreground/75">{item.lead}</p>}
        {item.image && <img src={item.image} alt="" className="mt-6 aspect-video w-full rounded-lg border border-border object-cover" />}
        <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/85">
          {item.content.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <section className="mt-12 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-sm font-extrabold uppercase">{item.is_synthesized ? `Felhasznált források (${item.sources.length})` : "Forrás"}</h2>
          <ul className="space-y-3">
            {item.sources.map((s) => <li key={s.link}><a href={s.link} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:border-primary/40"><div><p className="text-[10px] font-bold uppercase text-primary">{s.source}</p><p className="mt-1 text-sm font-semibold leading-snug group-hover:text-primary">{s.title}</p></div><ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" /></a></li>)}
          </ul>
        </section>
      </main>
    </div>
  );
}

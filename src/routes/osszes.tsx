import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/lang";
import { ALL, CATEGORIES, byRelevance, formatDate, tr } from "@/lib/news";

export const Route = createFileRoute("/osszes")({
  head: () => ({
    meta: [
      { title: "Minden hír relevancia szerint – Stirix.ro" },
      { name: "description", content: "A Stirix.ro összes híre egy helyen, a legtöbb forrásból összefűzött hírekkel elöl." },
      { property: "og:title", content: "Minden hír relevancia szerint – Stirix.ro" },
      { property: "og:description", content: "A Stirix.ro összes híre egy helyen, relevancia szerint rendezve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AllNews,
});

const categoryRo: Record<string, string> = {
  [ALL]: "Toate știrile", "Általános": "General", "Politika": "Politică", Sport: "Sport",
  "Közélet": "Societate", "Kultúra": "Cultură", "Gazdaság": "Economie", "Bulvár": "Monden",
};

function AllNews() {
  const lang = useLang();
  const ro = lang === "ro";
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const list = useMemo(
    () => byRelevance.filter((n) => (category === ALL || n.category === category) && `${tr(n, lang).title} ${tr(n, lang).lead}`.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu"))),
    [category, query, lang],
  );

  return (
    <PageShell
      eyebrow={ro ? "Arhivă" : "Archívum"}
      title={ro ? "Toate știrile, după relevanță" : "Minden hír relevancia szerint"}
      intro={ro ? "Știrile din mai multe surse apar primele, apoi cele mai noi." : "Elöl a több forrásból összefűzött hírek, utánuk a legfrissebbek."}
    >
      <div className="mb-6 flex flex-col gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ro ? "Caută știri..." : "Keresés hírekre..."} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary/50" />
        <div className="flex gap-2 overflow-x-auto">
          {[ALL, ...CATEGORIES].map((c) => <Button key={c} size="sm" variant={category === c ? "default" : "ghost"} onClick={() => setCategory(c)} className="whitespace-nowrap">{ro ? categoryRo[c] ?? c : c}</Button>)}
        </div>
      </div>
      <p className="mb-4 text-xs font-bold uppercase text-muted-foreground">{list.length} {ro ? "știri" : "hír"}</p>
      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {list.map((n) => (
          <li key={n.group_id}>
            <Link to="/hir/$id" params={{ id: n.group_id }} className="group flex gap-4 p-4">
              {n.image && <img src={n.image} alt="" loading="lazy" className="hidden size-20 shrink-0 rounded-md object-cover sm:block" />}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  {n.is_synthesized && <span className="text-primary">✨ AI · </span>}
                  {ro ? categoryRo[n.category] ?? n.category : n.category} · {formatDate(n.published_at, lang)} · {n.sources.length > 1 ? (ro ? `${n.sources.length} surse` : `${n.sources.length} forrás`) : n.sources[0]?.source}
                </p>
                <h2 className="mt-1 font-display text-base font-bold leading-snug transition-colors group-hover:text-primary">{tr(n, lang).title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tr(n, lang).lead}</p>
              </div>
            </Link>
          </li>
        ))}
        {!list.length && <li className="p-8 text-center text-sm text-muted-foreground">{ro ? "Niciun rezultat." : "Nincs találat."}</li>}
      </ol>
    </PageShell>
  );
}

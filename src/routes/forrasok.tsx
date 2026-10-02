import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, GitMerge, Link2, Rss, Sparkles } from "lucide-react";
import { PageShell, glass, meta } from "@/components/PageShell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/forrasok")({
  head: () => meta("Forrásaink & Átláthatóság – Stirix.ro", "A Stirix.ro által figyelt magyar és román hírforrások, és hogyan készülnek az AI-összesített hírek."),
  component: Sources,
});

const SOURCES = [
  ["Maszol", "https://maszol.ro", "HU"], ["Transtelex", "https://transtelex.ro", "HU"], ["Krónika", "https://kronikaonline.ro", "HU"],
  ["Hargita Népe", "https://hargitanepe.ro", "HU"], ["Szatmári Friss", "https://szatmarifriss.ro", "HU"], ["Manna", "https://manna.ro", "HU"],
  ["Kolozsvári Rádió", "https://radiocluj.ro", "HU"], ["Romkat", "https://romkat.ro", "HU"], ["MTI", "https://mti.hu", "HU"],
  ["Digi24", "https://digi24.ro", "RO"], ["Agerpres", "https://agerpres.ro", "RO"], ["GSP", "https://gsp.ro", "RO"],
  ["HotNews", "https://hotnews.ro", "RO"], ["Mediafax", "https://mediafax.ro", "RO"], ["Libertatea", "https://libertatea.ro", "RO"],
];

function Sources() {
  const ro = useLang() === "ro";
  const steps = ro
    ? [[Rss, "Colectare", "Citim fluxurile RSS ale surselor de mai jos."], [GitMerge, "Grupare", "Articolele despre același eveniment sunt grupate."], [Sparkles, "Sinteză AI", "AI scrie un rezumat neutru din mai multe surse."], [Link2, "Atribuire", "Fiecare știre listează și leagă sursele originale."]]
    : [[Rss, "Gyűjtés", "Az alábbi források RSS-csatornáit olvassuk."], [GitMerge, "Csoportosítás", "Az ugyanarról szóló cikkeket összekapcsoljuk."], [Sparkles, "AI összefoglaló", "Az AI több forrásból semleges összefoglalót ír."], [Link2, "Hivatkozás", "Minden hír végén ott vannak az eredeti források linkjei."]];
  return (
    <PageShell eyebrow={ro ? "Surse & Transparență" : "Forrásaink & Átláthatóság"} title={ro ? "De unde vin știrile noastre" : "Honnan jönnek a híreink"} intro={ro ? "Nu modificăm atribuirea surselor: fiecare articol trimite la publicația originală." : "A források megjelölését soha nem változtatjuk meg: minden hír az eredeti kiadványhoz vezet."}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([I, t, d], i) => { const Icon = I as typeof Rss; return (
          <div key={t as string} className={glass}><div className="flex items-center justify-between"><Icon className="size-6 text-primary" /><span className="font-display text-3xl font-bold text-muted-foreground/40">0{i + 1}</span></div><h3 className="mt-4 font-display font-bold">{t as string}</h3><p className="mt-2 text-sm text-muted-foreground">{d as string}</p></div>
        ); })}
      </div>
      <h2 className="mt-14 font-display text-2xl font-bold">{ro ? "Surse integrate" : "Figyelt források"}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SOURCES.map(([name, url, l]) => (
          <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card/70 p-5 text-center transition-colors hover:border-primary/50">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">{name.slice(0, 2)}</span>
            <span className="text-sm font-bold group-hover:text-primary">{name}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">{l} <ExternalLink className="size-3" /></span>
          </a>
        ))}
      </div>
    </PageShell>
  );
}

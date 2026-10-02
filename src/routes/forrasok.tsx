import { createFileRoute } from "@tanstack/react-router";
import { GitMerge, Link2, Rss, Sparkles } from "lucide-react";
import { PageShell, glass, meta } from "@/components/PageShell";
import { SourceManager } from "@/components/SourceManager";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/forrasok")({
  head: () => meta("Forrásaink & Átláthatóság – Stirix.ro", "A Stirix.ro által figyelt magyar és román hírforrások, és hogyan készülnek az AI-összesített hírek."),
  component: Sources,
});

function Sources() {
  const lang = useLang();
  const ro = lang === "ro";
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
      <p className="mt-2 text-sm text-muted-foreground">{ro ? "Lista este creată automat din sursele știrilor actuale." : "A lista automatikusan a jelenlegi hírek forrásaiból épül fel."}</p>
      <div className="mt-6"><SourceManager lang={lang} /></div>
    </PageShell>
  );
}

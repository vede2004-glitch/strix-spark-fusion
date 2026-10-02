import { createFileRoute } from "@tanstack/react-router";
import { Clock, Scale, Zap } from "lucide-react";
import { PageShell, glass, meta } from "@/components/PageShell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/rolunk")({
  head: () => meta("Rólunk – Stirix.ro", "A Stirix.ro küldetése: gyors, semleges, 0-24 automatizált magyar–román hírportál Romániában."),
  component: About,
});

function About() {
  const ro = useLang() === "ro";
  const vals = ro
    ? [[Zap, "Rapid", "Știrile apar la câteva minute după publicare."], [Scale, "Neutru", "Mai multe surse, un rezumat echilibrat."], [Clock, "24/7", "Sistem automatizat care nu doarme niciodată."]]
    : [[Zap, "Gyors", "A hírek perceken belül megjelennek."], [Scale, "Semleges", "Több forrás, kiegyensúlyozott összefoglaló."], [Clock, "0-24", "Automatizált rendszer, amely sosem alszik."]];
  return (
    <PageShell eyebrow={ro ? "Despre noi" : "Rólunk"} title={ro ? "Toate știrile din România, într-un singur loc" : "Románia összes híre, egy helyen"} intro={ro ? "Misiunea noastră este să oferim în România un portal de știri rapid, neutru și automatizat 24/7, în limbile maghiară și română." : "Küldetésünk egy gyors, semleges, 0-24 órában automatizált, magyar és román nyelvű hírportál Romániában."}>
      <div className="grid gap-5 md:grid-cols-3">
        {vals.map(([I, t, d]) => { const Icon = I as typeof Zap; return (
          <div key={t as string} className={glass}><Icon className="size-6 text-primary" /><h2 className="mt-4 font-display text-xl font-bold">{t as string}</h2><p className="mt-2 text-sm text-muted-foreground">{d as string}</p></div>
        ); })}
      </div>
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, CreditCard, Server, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageShell, glass, field, meta } from "@/components/PageShell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/tamogatas")({
  head: () => meta("Támogatás – Stirix.ro", "Támogasd a független erdélyi híraggregációt: szerverköltségek és mobilalkalmazás-fejlesztés."),
  component: Support,
});

const AMOUNTS: Record<"RON" | "EUR" | "HUF", number[]> = { RON: [20, 50, 100], EUR: [5, 10, 20], HUF: [1500, 4000, 8000] };
const IBAN = "RO00 XXXX 0000 0000 0000 0000";

function Support() {
  const ro = useLang() === "ro";
  const [monthly, setMonthly] = useState(false);
  const [cur, setCur] = useState<keyof typeof AMOUNTS>("RON");
  const [amount, setAmount] = useState<number | "custom">(50);
  const [custom, setCustom] = useState("");
  const faq = ro
    ? [["Pe ce se cheltuie banii?", "Exclusiv pe costurile serverelor, procesarea AI și dezvoltarea aplicațiilor mobile."], ["Când apar aplicațiile iOS și Android?", "Lucrăm la ele acum; donațiile grăbesc lansarea."], ["Pot anula donația lunară?", "Da, oricând, fără obligații."]]
    : [["Mire fordítjátok a pénzt?", "Kizárólag a szerverek, az AI-feldolgozás költségeire és a mobilalkalmazások fejlesztésére."], ["Mikor jön az iOS és Android app?", "Jelenleg fejlesztjük; a támogatások gyorsítják a megjelenést."], ["Lemondhatom a havi támogatást?", "Igen, bármikor, kötelezettség nélkül."]];
  return (
    <PageShell eyebrow={ro ? "Susține-ne" : "Támogatás"} title={ro ? "Susține agregarea independentă de știri din Transilvania!" : "Támogasd a független erdélyi híraggregációt!"}>
      <div className="grid gap-5 md:grid-cols-2">
        {[{ icon: Server, t: ro ? "Servere & AI" : "Szerverek & AI", d: ro ? "Funcționare 24/7 și costurile procesării AI a știrilor." : "Folyamatos, 24/7 működés és a hírek AI-feldolgozásának költségei." },
          { icon: Smartphone, t: ro ? "Aplicații mobile" : "Mobilalkalmazások", d: ro ? "Dezvoltarea aplicațiilor native pentru iOS și Android." : "A natív iOS és Android alkalmazások fejlesztése." }].map(({ icon: I, t, d }) => (
          <div key={t} className={glass}><I className="size-6 text-primary" /><h2 className="mt-4 font-display text-xl font-bold">{t}</h2><p className="mt-2 text-sm text-muted-foreground">{d}</p></div>
        ))}
      </div>

      <div className={`${glass} mt-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-full border border-border p-1">
            <Button size="sm" className="rounded-full" variant={!monthly ? "default" : "ghost"} onClick={() => setMonthly(false)}>{ro ? "O singură dată" : "Egyszeri"}</Button>
            <Button size="sm" className="rounded-full" variant={monthly ? "default" : "ghost"} onClick={() => setMonthly(true)}>{ro ? "Lunar" : "Havi"}</Button>
          </div>
          <div className="flex rounded-full border border-border p-1">
            {Object.keys(AMOUNTS).map((c) => <Button key={c} size="sm" className="rounded-full" variant={cur === c ? "default" : "ghost"} onClick={() => { setCur(c as keyof typeof AMOUNTS); setAmount(AMOUNTS[c as keyof typeof AMOUNTS][1]!); }}>{c}</Button>)}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AMOUNTS[cur].map((a) => <Button key={a} variant={amount === a ? "default" : "outline"} className="h-14 text-base font-bold" onClick={() => setAmount(a)}>{a.toLocaleString("hu")} {cur}</Button>)}
          <Button variant={amount === "custom" ? "default" : "outline"} className="h-14" onClick={() => setAmount("custom")}>{ro ? "Altă sumă" : "Egyéni"}</Button>
        </div>
        {amount === "custom" && <input type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={ro ? `Sumă (${cur})` : `Összeg (${cur})`} className={`${field} mt-3`} />}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[[ro ? "Card bancar" : "Bankkártya", "Stripe"], ["Revolut", "@stirix"], ["PayPal", "paypal.me/stirix"]].map(([t, s]) => (
            <button key={t as string} onClick={() => toast(ro ? "Plata online va fi disponibilă în curând." : "Az online fizetés hamarosan elérhető.")} className="flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/50">
              <CreditCard className="size-5 text-primary" /><span><span className="block text-sm font-bold">{t}</span><span className="text-xs text-muted-foreground">{s}</span></span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <div><p className="text-xs font-bold uppercase text-primary">{ro ? "Transfer bancar (IBAN)" : "Banki átutalás (IBAN)"}</p><p className="mt-1 font-mono text-sm">{IBAN}</p></div>
          <Button size="icon" variant="ghost" aria-label="Copy IBAN" onClick={() => { navigator.clipboard.writeText(IBAN); toast(ro ? "IBAN copiat" : "IBAN kimásolva"); }}><Copy className="size-4" /></Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{monthly ? (ro ? "Donație lunară" : "Havi támogatás") : (ro ? "Donație unică" : "Egyszeri támogatás")}: {amount === "custom" ? custom || "–" : amount} {cur}</p>
      </div>

      <h2 className="mt-12 font-display text-2xl font-bold">{ro ? "Întrebări frecvente" : "Gyakori kérdések"}</h2>
      <Accordion type="single" collapsible className="mt-4">
        {faq.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{a}</AccordionContent></AccordionItem>)}
      </Accordion>
    </PageShell>
  );
}

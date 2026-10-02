import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/lang";

type QA = { q: string; a: string; error?: boolean };
const MAX_Q = 3;

export function ArticleQA({ id }: { id: string }) {
  const lang = useLang();
  const ro = lang === "ro";
  const chip = ro ? "Rezumat scurt" : "Rövid összefoglaló";
  const limitMsg = ro ? "Poți adresa maximum 3 întrebări despre acest articol în fiecare sesiune." : "Ehhez a cikkhez legfeljebb 3 kérdést tehetsz fel munkamenetenként.";
  const storeKey = `stirix-qa:${id}:${lang}`;
  const [items, setItems] = useState<QA[]>([]);
  const [past, setPast] = useState<{ q: string; a: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  useEffect(() => {
    setItems([]);
    setCount(0);
    setLimitHit(false);
    try { setPast(JSON.parse(localStorage.getItem(storeKey) || "[]")); } catch { setPast([]); }
  }, [storeKey]);
  function savePast(q: string, a: string) {
    setPast((prev) => {
      const next = [{ q, a }, ...prev.filter((p) => p.q !== q)].slice(0, 20);
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    if (count >= MAX_Q) { setLimitHit(true); return; }
    setCount((c) => c + 1);
    setInput("");
    setLoading(true);
    const history = items.filter((i) => !i.error).slice(-5).map(({ q, a }) => ({ q, a }));
    setItems((prev) => [...prev, { q, a: "" }]);
    const update = (fn: (x: QA) => QA) => setItems((prev) => prev.map((x, i) => (i === prev.length - 1 ? fn(x) : x)));
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, question: q, history, lang }),
      });
      if (!res.ok || !res.body) {
        const msg = res.status === 402 ? (ro ? "Limita AI a fost atinsă. Încearcă mai târziu." : "Elfogytak az AI keretek. Próbáld később.") : res.status === 429 ? (ro ? "Prea multe solicitări. Încearcă din nou peste un minut." : "Túl sok kérés, próbáld újra egy perc múlva.") : (await res.text()) || (ro ? "A apărut o eroare." : "Hiba történt.");
        update((x) => ({ ...x, a: msg, error: true }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        update((x) => ({ ...x, a: x.a + chunk }));
      }
      let final = "";
      update((x) => { final = x.a; return x.a.trim() ? x : { ...x, a: ro ? "Nu am primit niciun răspuns." : "Nem érkezett válasz.", error: true }; });
      setTimeout(() => { if (final.trim()) savePast(q, final.trim()); }, 0);
    } catch {
      update((x) => ({ ...x, a: ro ? "Conexiunea a eșuat. Încearcă din nou." : "Nem sikerült kapcsolódni. Próbáld újra.", error: true }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-primary/25 bg-card p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase">
        <MessageCircleQuestion className="size-4 text-primary" />{ro ? "Întreabă despre articol (AI)" : "Kérdezz a cikkről (AI)"}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{ro ? "Răspunsurile sunt generate exclusiv pe baza articolului și a surselor sale." : "A válaszok csak a cikk és a forrásai alapján készülnek."}</p>

      {items.length > 0 && (
        <ul className="mb-4 space-y-4">
          {items.map((it, i) => (
            <li key={i} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{it.q}</p>
              {it.a ? (
                <p className={`whitespace-pre-wrap text-sm leading-relaxed ${it.error ? "text-destructive" : "text-foreground/85"}`}>{it.a}</p>
              ) : (
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />{ro ? "Se generează răspunsul…" : "Válasz készül…"}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div className="mb-4 rounded-md border border-border">
          <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)} className="flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-xs uppercase">
            {ro ? "Întrebări adresate anterior" : "Korábban feltett kérdések"} ({past.length})<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
          {open && (
            <ul className="space-y-3 border-t border-border px-3 py-3">
              {past.map((p, i) => <li key={i}><p className="text-sm font-bold">{p.q}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{p.a}</p></li>)}
            </ul>
          )}
        </div>
      )}
      {limitHit && <p className="mb-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{limitMsg}</p>}
      <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">{ro ? `${Math.max(0, MAX_Q - count)} întrebări rămase` : `${Math.max(0, MAX_Q - count)} kérdés maradt`}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={loading} onClick={() => ask(chip)} className="h-auto rounded-full px-3 py-1 font-semibold text-muted-foreground">{chip}</Button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={ro ? "Scrie întrebarea…" : "Írd be a kérdésed…"} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <Button type="submit" disabled={loading || !input.trim()} className="h-auto gap-2 px-4 py-2 text-sm">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{ro ? "Întreabă" : "Kérdezés"}
        </Button>
      </form>
    </section>
  );
}

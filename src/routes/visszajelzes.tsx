import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Bug, Languages, Lightbulb, Tags } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell, glass, field, meta } from "@/components/PageShell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/visszajelzes")({
  head: () => meta("Visszajelzés & Hibabejelentés – Stirix.ro", "Jelezd a hibás fordítást, technikai hibát vagy rossz kategóriát, vagy oszd meg fejlesztési ötleted."),
  component: Feedback,
});

const types = [
  { id: "translation", hu: "Hibás fordítás", ro: "Traducere eronată", icon: Languages },
  { id: "tech", hu: "Technikai hiba", ro: "Problemă tehnică", icon: Bug },
  { id: "category", hu: "Kategória besorolási hiba", ro: "Categorie incorectă", icon: Tags },
  { id: "idea", hu: "Fejlesztési ötlet", ro: "Sugestie", icon: Lightbulb },
];
const schema = z.object({
  url: z.union([z.literal(""), z.string().trim().url().max(500)]),
  text: z.string().trim().min(5).max(3000),
  email: z.union([z.literal(""), z.string().trim().email().max(255)]),
});

function Feedback() {
  const ro = useLang() === "ro";
  const [type, setType] = useState("translation");
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) { toast.error(ro ? "Verifică link-ul, descrierea și emailul." : "Ellenőrizd a linket, a leírást és az emailt."); return; }
    e.currentTarget.reset();
    toast.success(ro ? "Mulțumim pentru feedback!" : "Köszönjük a visszajelzést!");
  };
  return (
    <PageShell eyebrow={ro ? "Feedback & Erori" : "Visszajelzés"} title={ro ? "Ajută-ne să fim mai buni" : "Segíts, hogy jobbak legyünk"} intro={ro ? "Ai găsit o eroare sau ai o idee? Spune-ne." : "Hibát találtál vagy van egy ötleted? Írd meg nekünk."}>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {types.map(({ id, hu, ro: r, icon: I }) => (
            <button type="button" role="radio" aria-checked={type === id} key={id} onClick={() => setType(id)} className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left text-sm font-semibold transition-colors ${type === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/70 hover:border-primary/40"}`}>
              <I className="size-5" />{ro ? r : hu}
            </button>
          ))}
        </div>
        <div className={`${glass} space-y-4`}>
          <input name="url" maxLength={500} placeholder={ro ? "Link articol (opțional)" : "Cikk linkje (opcionális)"} className={field} />
          <textarea name="text" rows={6} maxLength={3000} placeholder={ro ? "Descriere detaliată" : "Részletes leírás"} className={field} />
          <input name="email" maxLength={255} placeholder={ro ? "Email de contact (opțional)" : "Email cím (opcionális)"} className={field} />
          <Button type="submit" className="w-full">{ro ? "Trimite" : "Küldés"}</Button>
        </div>
      </form>
    </PageShell>
  );
}

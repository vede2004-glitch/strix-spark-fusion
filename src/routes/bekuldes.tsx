import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, ImagePlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageShell, glass, field, meta } from "@/components/PageShell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/bekuldes")({
  head: () => meta("Hír beküldése – Stirix.ro", "Van egy jó sztorid vagy sajtóközleményed? Küldd be a Stirix.ro szerkesztőségének."),
  component: Submit,
});

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  link: z.union([z.literal(""), z.string().trim().url().max(500)]),
  contact: z.string().trim().min(3).max(255),
});

function Submit() {
  const ro = useLang() === "ro";
  const [files, setFiles] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = schema.safeParse(Object.fromEntries(f));
    if (!r.success) { toast.error(ro ? "Verifică câmpurile (titlu, descriere, link, contact)." : "Ellenőrizd a mezőket (cím, leírás, link, elérhetőség)."); return; }
    e.currentTarget.reset(); setFiles([]); setDone(true);
  };
  return (
    <PageShell eyebrow={ro ? "Trimite o știre" : "Sajtószoba"} title={ro ? "Ai o știre sau un comunicat de presă?" : "Van egy jó sztorid vagy sajtóközleményed?"} intro={ro ? "Trimite-ne informațiile, iar redacția le va verifica." : "Küldd el nekünk, a szerkesztőség ellenőrzi és feldolgozza."}>
      <form onSubmit={onSubmit} className={`${glass} mx-auto max-w-2xl space-y-4`}>
        <input name="title" maxLength={200} placeholder={ro ? "Titlu" : "Cím"} className={field} />
        <textarea name="body" rows={7} maxLength={5000} placeholder={ro ? "Descriere detaliată" : "Részletes leírás"} className={field} />
        <input name="link" maxLength={500} placeholder={ro ? "Link (opțional)" : "Link (opcionális)"} className={field} />
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary/50">
          <ImagePlus className="size-6 text-primary" />
          {files.length ? files.join(", ") : ro ? "Atașează imagini sau fișiere" : "Képek vagy csatolmányok feltöltése"}
          <input type="file" multiple className="hidden" onChange={(e) => setFiles([...(e.target.files ?? [])].map((x) => x.name))} />
        </label>
        <input name="contact" maxLength={255} placeholder={ro ? "Email / telefon de contact" : "Elérhetőség (email / telefon)"} className={field} />
        <Button type="submit" className="w-full">{ro ? "Trimite" : "Beküldés"}</Button>
      </form>
      <Dialog open={done} onOpenChange={setDone}>
        <DialogContent>
          <DialogHeader className="items-center text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <DialogTitle className="font-display">{ro ? "Mulțumim!" : "Köszönjük!"}</DialogTitle>
            <DialogDescription>{ro ? "Am primit știrea ta. Te contactăm dacă avem întrebări." : "Megkaptuk a beküldött hírt. Ha kérdésünk van, keresünk."}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

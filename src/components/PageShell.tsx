import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SiteMenu } from "@/components/SiteMenu";
import { LANGS, setLang, useLang } from "@/lib/lang";

export function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  const lang = useLang();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4">
          <Link to="/"><img src="/favicon.png" alt="Stirix.ro" className="size-10 object-contain sm:size-12" /></Link>
          <div className="flex items-center gap-2">
            {LANGS.map((l) => <Button key={l} variant="ghost" size="sm" onClick={() => setLang(l)} className={lang === l ? "text-primary" : ""}>{l.toUpperCase()}</Button>)}
            <SiteMenu />
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-5xl">{title}</h1>
          {intro && <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{intro}</p>}
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">{children}</main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Stirix.ro</footer>
    </div>
  );
}

export const glass = "rounded-xl border border-border bg-card/70 p-6 shadow-lg backdrop-blur-md";
export const field = "w-full rounded-md border border-input bg-secondary px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60";

export function meta(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

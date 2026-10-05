import { Link } from "@tanstack/react-router";
import { HeartHandshake, Info, Library, Menu, MessageSquareWarning, Moon, Newspaper, Send, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LANGS, setLang, useLang } from "@/lib/lang";
import { setTheme, useTheme } from "@/lib/theme";

const items = [
  { to: "/", hu: "Főoldal", ro: "Pagina principală", icon: Newspaper },
  { to: "/osszes", hu: "Minden hír (archívum)", ro: "Toate știrile (arhivă)", icon: Library },
  { to: "/tamogatas", hu: "Támogatás", ro: "Susține-ne", icon: HeartHandshake },
  { to: "/bekuldes", hu: "Hír beküldése", ro: "Trimite o știre", icon: Send },
  { to: "/visszajelzes", hu: "Visszajelzés & Hibabejelentés", ro: "Feedback & Erori", icon: MessageSquareWarning },
  { to: "/forrasok", hu: "Forrásaink & Átláthatóság", ro: "Surse & Transparență", icon: Library },
  { to: "/rolunk", hu: "Rólunk", ro: "Despre noi", icon: Info },
] as const;

export function SiteMenu() {
  const lang = useLang();
  const theme = useTheme();
  const ro = lang === "ro";
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label={ro ? "Meniu" : "Menü"}><Menu className="size-4" /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 border-border bg-background">
        <SheetHeader><SheetTitle className="font-display">{ro ? "Meniu" : "Menü"}</SheetTitle></SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {items.map(({ to, hu, ro: r, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }} activeProps={{ className: "bg-secondary text-primary" }} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition-colors hover:bg-secondary">
              <Icon className="size-4 text-primary" />{ro ? r : hu}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{ro ? "Setări" : "Beállítások"}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">{ro ? "Temă" : "Téma"}</span>
            <div className="flex rounded-full border border-border p-1">
              <Button size="sm" variant={theme === "dark" ? "default" : "ghost"} className="h-8 rounded-full" onClick={() => setTheme("dark")}><Moon className="size-4" />{ro ? "Întunecat" : "Sötét"}</Button>
              <Button size="sm" variant={theme === "light" ? "default" : "ghost"} className="h-8 rounded-full" onClick={() => setTheme("light")}><Sun className="size-4" />{ro ? "Luminos" : "Világos"}</Button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">{ro ? "Limbă" : "Nyelv"}</span>
            <div className="flex rounded-full border border-border p-1">
              {LANGS.map((l) => <Button key={l} size="sm" variant={lang === l ? "default" : "ghost"} className="h-8 rounded-full" onClick={() => setLang(l)}>{l === "hu" ? "Magyar" : "Română"}</Button>)}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

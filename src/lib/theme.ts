import { useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const KEY = "stirix-theme";
let current: Theme = "dark";
const subs = new Set<() => void>();

function apply(t: Theme) {
  document.documentElement.classList.toggle("light", t === "light");
}

export function setTheme(t: Theme) {
  current = t;
  try { localStorage.setItem(KEY, t); } catch {}
  apply(t);
  subs.forEach((f) => f());
}

export function useTheme(): Theme {
  const theme = useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => current,
    () => "dark" as Theme,
  );
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY) as Theme | null;
      if (s && s !== current) setTheme(s);
      else apply(current);
    } catch {}
  }, []);
  return theme;
}

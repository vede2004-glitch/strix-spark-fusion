import { useEffect, useSyncExternalStore } from "react";

export type Lang = "hu" | "ro";
export const LANGS: Lang[] = ["hu", "ro"];
const KEY = "stirix-lang";
let current: Lang = "hu";
const subs = new Set<() => void>();

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch {}
  subs.forEach((f) => f());
}

/** Igaz hidratálás után: ekkor az időket a látogató saját időzónájában írjuk ki. */
export let localTz = false;

export function useLang(): Lang {
  localTz = useSyncExternalStore(() => () => {}, () => true, () => false);
  const lang = useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => current,
    () => "hu" as Lang,
  );
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY) as Lang | null;
      if (s && LANGS.includes(s) && s !== current) setLang(s);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return lang;
}

import { useEffect, useSyncExternalStore } from "react";

export type Lang = "hu" | "ro";
export const LANGS: Lang[] = ["hu", "ro"];
const KEY = "stirix-lang";
let current: Lang = "hu";
let locked = false;
const subs = new Set<() => void>();

/** A domén (hirx.ro / strix.ro) által meghatározott nyelv; render előtt hívandó. */
export function initDomainLang(l: Lang | null) {
  locked = !!l;
  if (l) current = l;
}

export function setLang(l: Lang) {
  // Doménhez kötött nyelvnél (hirx.ro / stirix.ro) a váltás a másik doménre visz.
  if (locked && l !== current && typeof window !== "undefined") {
    try { localStorage.setItem(KEY, l); } catch {}
    const target = l === "hu" ? "https://hirx.ro" : "https://stirix.ro";
    const q = new URLSearchParams(window.location.search);
    q.delete("lang");
    if (l === "ro") q.set("lang", "ro");
    const qs = q.toString();
    window.location.href = target + window.location.pathname + (qs ? "?" + qs : "");
    return;
  }
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
    () => current,
  );
  useEffect(() => {
    if (locked) return;
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

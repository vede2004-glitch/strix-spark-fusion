import type { Lang } from "./lang";

export const HU_ORIGIN = "https://hirx.ro";
export const RO_ORIGIN = "https://stirix.ro";

const clean = (host: string | null | undefined) => ((host ?? "").toLowerCase().split(":")[0] ?? "").replace(/^www\./, "");

/** Az accept-language első (legelőnyösebb) nyelve magyar-e. */
export function prefersHungarian(acceptLanguage: string | null | undefined): boolean {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "hu" || first.startsWith("hu-") || first.startsWith("hu;");
}

/** stirix.ro: magyar böngésző → 301 hirx.ro; minden más marad a román stirix.ro-n. */
export function domainRedirect(host: string | null | undefined, acceptLanguage: string | null | undefined, pathAndQuery = "/"): string | null {
  if (clean(host) !== "stirix.ro") return null;
  return prefersHungarian(acceptLanguage) ? HU_ORIGIN + pathAndQuery : null;
}

/** hirx.ro → magyar, stirix.ro → román, egyéb domén → nincs kényszerített nyelv. */
export function domainLang(host: string | null | undefined): Lang | null {
  const h = clean(host);
  if (h === "hirx.ro") return "hu";
  if (h === "stirix.ro") return "ro";
  return null;
}

export function originFor(lang: Lang) {
  return lang === "hu" ? HU_ORIGIN : RO_ORIGIN;
}

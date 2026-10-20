import { createFileRoute } from "@tanstack/react-router";
import { news, history, archive } from "@/lib/news";
import { domainLang, originFor } from "@/lib/domains";

const STATIC_PAGES = ["/", "/osszes", "/tamogatas", "/bekuldes", "/visszajelzes", "/forrasok", "/rolunk"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function urlEntry(loc: string, lastmod?: string | null) {
  return `  <url>\n    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lang = domainLang(request.headers.get("host") ?? url.host) ?? "ro";
        const origin = originFor(lang);

        const seen = new Set<string>();
        const items = [...news, ...history, ...archive].filter((n) => {
          if (seen.has(n.group_id)) return false;
          seen.add(n.group_id);
          return true;
        });

        const entries: string[] = STATIC_PAGES.map((p) => urlEntry(origin + p));
        for (const item of items) {
          const articleUrl = `${origin}/hir/${encodeURIComponent(item.group_id)}`;
          const ts = item.published_at;
          const lastmod = ts && Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : null;
          entries.push(urlEntry(articleUrl, lastmod));
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

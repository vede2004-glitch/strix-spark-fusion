import { createFileRoute } from "@tanstack/react-router";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import { getNews, tr } from "@/lib/news";

const Body = z.object({
  id: z.string().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(10).default([]),
  lang: z.enum(["hu", "ro"]).default("hu"),
});

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = Body.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return new Response("Érvénytelen kérés.", { status: 400 });

          const { id, question, history, lang } = parsed.data;
          const item = getNews(id);
          if (!item) return new Response(lang === "ro" ? "Articolul nu a fost găsit." : "A cikk nem található.", { status: 404 });

          const article = tr(item, lang);
          const sources = item.sources.map((s) => `- ${s.source}: ${s.title} (${s.link})`).join("\n");

          const system = lang === "ro"
            ? `Ești asistentul portalului de știri Stirix.ro. Răspunde în limba română pe baza articolului:\n\nTITLU: ${article.title}\nTEXT:\n${article.content}\nSURSE:\n${sources}`
            : `Te a Stirix.ro hírportál segítője vagy. Kizárólag az alábbi cikk és források alapján válaszolj, mindig magyarul, tömören:\n\nCIKK CÍME: ${article.title}\nSZÖVEG:\n${article.content}\nFORRÁSOK:\n${sources}`;

          const messages = [
            ...history.flatMap((h) => [
              { role: "user" as const, content: h.q },
              { role: "assistant" as const, content: h.a },
            ]),
            { role: "user" as const, content: question },
          ];

          // Közvetlenül a hivatalos Gemini-t hívja meg (automatikusa a GEMINI_API_KEY-t keresi a környezeti változókban)
          const result = streamText({
            model: google("gemini-1.5-flash"),
            system,
            messages,
            abortSignal: request.signal,
          });

          return result.toTextStreamResponse();
        } catch (err: any) {
          console.error("Hiba történt:", err);
          return new Response(`Szerver hiba: ${err?.message || err}`, { status: 500 });
        }
      },
    },
  },
});

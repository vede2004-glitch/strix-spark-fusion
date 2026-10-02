import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { getNews, tr } from "@/lib/news";

// ---------------------------------------------------------------------------
// Gemini AI Gateway Konfiguráció
// ---------------------------------------------------------------------------
const DEFAULT_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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

          // Változók beolvasása Vercel-ből vagy alapértelmezett Gemini beállítások
          const apiKey = process.env["AI_GATEWAY_API_KEY"] || process.env["GEMINI_API_KEY"];
          const rawUrl = (process.env["AI_GATEWAY_URL"] || DEFAULT_GEMINI_URL).trim().replace(/\/+$/, "");
          const modelName = process.env["AI_GATEWAY_MODEL"] || DEFAULT_GEMINI_MODEL;

          if (!apiKey) {
            return new Response(
              lang === "ro" ? "Serviciul AI nu este configurat." : "Az AI szolgáltatás nincs beállítva (hiányzik a Gemini API kulcs).",
              { status: 500 }
            );
          }

          // Kifejezetten a tisztított OpenAI-kompatibilis Gemini szolgáltató
          const provider = createOpenAI({
            baseURL: rawUrl,
            apiKey: apiKey,
            compatibility: "compatible",
          });

          const sources = item.sources.map((s) => `- ${s.source}: ${s.title} (${s.link})`).join("\n");
          const system = lang === "ro"
            ? `Ești asistentul portalului de știri Stirix.ro. Răspunde în limba română pe baza articolului:\n\nTITLU: ${article.title}\nTEXT:\n${article.content}\nSURSE:\n${sources}`
            : `Te a Stirix.ro hírportál segítője vagy. Kizárólag az alábbi cikk és források alapján válaszolj, mindig magyarul, tömören (legfeljebb 5 mondat):\n\nCIKK CÍME: ${article.title}\nSZÖVEG:\n${article.content}\nFORRÁSOK:\n${sources}`;

          const messages = [
            ...history.flatMap((h) => [
              { role: "user" as const, content: h.q },
              { role: "assistant" as const, content: h.a },
            ]),
            { role: "user" as const, content: question },
          ];

          const result = streamText({
            model: provider.chat(modelName),
            system,
            messages,
            abortSignal: request.signal,
            onError: ({ error }) => console.error("Gemini hiba:", error),
          });

          return result.toTextStreamResponse();
        } catch (err: any) {
          console.error("Szerver hiba:", err);
          return new Response(`Szerver hiba: ${err?.message || err}`, { status: 500 });
        }
      },
    },
  },
});

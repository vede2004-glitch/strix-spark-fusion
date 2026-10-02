import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { getNews, tr } from "@/lib/news";

// ---------------------------------------------------------------------------
// Gemini AI Konfiguráció
// ---------------------------------------------------------------------------
const DEFAULT_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

const Body = z.object({
  id: z.string().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(10).default([]),
  lang: z.enum(["hu", "ro"]).default("hu"),
});

type Gateway = {
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
};

function resolveGateway(): Gateway {
  let rawUrl = (process.env["AI_GATEWAY_URL"] || DEFAULT_GEMINI_URL).trim().replace(/\/+$/, "");
  
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    rawUrl = `https://${rawUrl}`;
  }

  const model = process.env["AI_GATEWAY_MODEL"] || DEFAULT_GEMINI_MODEL;
  const apiKey = process.env["AI_GATEWAY_API_KEY"] || process.env["GEMINI_API_KEY"];

  return { baseUrl: rawUrl, model, apiKey };
}

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Érvénytelen kérés. / Solicitare invalidă.", { status: 400 });
        
        const { id, question, history, lang } = parsed.data;
        const item = getNews(id);
        if (!item) return new Response(lang === "ro" ? "Articolul nu a fost găsit." : "A cikk nem található.", { status: 404 });
        
        const article = tr(item, lang);
        const gw = resolveGateway();

        if (!gw.apiKey) {
          return new Response(
            lang === "ro" ? "Serviciul AI nu este configurat." : "Az AI szolgáltatás nincs beállítva. (Hiányzik a Gemini API kulcs)", 
            { status: 500 }
          );
        }

        // Közvetlen OpenAI-kompatibilis Gemini szolgáltató
        const provider = createOpenAI({
          baseURL: gw.baseUrl,
          apiKey: gw.apiKey,
        });

        const sources = item.sources.map((s) => `- ${s.source}: ${s.title} (${s.link})`).join("\n");
        const system = lang === "ro"
          ? `Ești asistentul portalului de știri Stirix.ro. Răspunde întotdeauna în limba română, exclusiv pe baza articolului și a surselor de mai jos. Răspunsul trebuie să fie concis: cel mult 5 propoziții sau o listă scurtă. Dacă informația nu apare în articol, spune clar acest lucru. Nu inventa fapte.

TITLUL ARTICOLULUI: ${article.title}
CATEGORIE: ${item.category}
TEXT:
${article.content}

SURSE:
${sources}`
          : `Te a Stirix.ro hírportál segítője vagy. Kizárólag az alábbi cikk és források alapján válaszolj, mindig magyarul, tömören (legfeljebb 5 mondat vagy rövid felsorolás). Ha a válasz nem derül ki a cikkből, mondd ki egyértelműen. Ne találj ki tényeket.

CIKK CÍME: ${article.title}
KATEGÓRIA: ${item.category}
SZÖVEG:
${article.content}

FORRÁSOK:
${sources}`;

        const messages = [
          ...history.flatMap((h) => [
            { role: "user" as const, content: h.q },
            { role: "assistant" as const, content: h.a },
          ]),
          { role: "user" as const, content: question },
        ];

        const result = streamText({
          model: provider.chat(gw.model),
          system,
          messages,
          abortSignal: request.signal,
          onError: ({ error }) => console.error("ask error", error),
        });

        return result.toTextStreamResponse();
      },
    },
  },
});

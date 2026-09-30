import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { getNews } from "@/lib/news";

// ---------------------------------------------------------------------------
// AI gateway configuration
//
// The Q&A chat talks to one OpenAI-compatible endpoint. It is configurable, so
// pointing it at your own serverless / Gemini gateway in production needs no
// code edit — just set environment variables (Lovable: Settings -> Secrets):
//
//   AI_GATEWAY_URL       e.g. https://my-gateway.example.com/v1
//   AI_GATEWAY_API_KEY   the key that endpoint expects
//   AI_GATEWAY_MODEL     model id served there, e.g. google/gemini-2.5-flash
//   AI_GATEWAY_PROTOCOL  "responses" (default) or "chat" for a plain
//                        /chat/completions gateway
//
// With none of them set the app keeps using the Lovable AI Gateway defaults
// below. The Lovable key is never sent to a third-party endpoint.
// ---------------------------------------------------------------------------
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const AI_GATEWAY_MODEL = "openai/gpt-6-astra";
const AI_GATEWAY_PROTOCOL = "responses";

const LOVABLE_HOST = "ai.gateway.lovable.dev";
const RUN = "X-Lovable-AIG-Run-ID";

const Body = z.object({
  id: z.string().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(10).default([]),
});

type Gateway = {
  baseUrl: string;
  model: string;
  protocol: "responses" | "chat";
  isLovable: boolean;
  apiKey?: string;
};

// Reads process.env at call time (module scope is not reliable on the edge runtime).
function resolveGateway(): Gateway | null {
  const baseUrl = (process.env["AI_GATEWAY_URL"] || AI_GATEWAY_URL).replace(/\/+$/, "");
  const model = process.env["AI_GATEWAY_MODEL"] || AI_GATEWAY_MODEL;
  const protocol = (process.env["AI_GATEWAY_PROTOCOL"] || AI_GATEWAY_PROTOCOL).toLowerCase() === "chat" ? "chat" : "responses";

  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return null; // AI_GATEWAY_URL is not a valid absolute URL
  }

  const isLovable = host === LOVABLE_HOST || host.endsWith(`.${LOVABLE_HOST}`);
  const apiKey = process.env["AI_GATEWAY_API_KEY"] || (isLovable ? process.env["LOVABLE_API_KEY"] : undefined);

  return { baseUrl, model, protocol, isLovable, apiKey };
}

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Érvénytelen kérés.", { status: 400 });
        const { id, question, history } = parsed.data;
        const item = getNews(id);
        if (!item) return new Response("A cikk nem található.", { status: 404 });
        if (item.is_synthesized) return new Response("Ennél a hírnél nem érhető el a kérdezés.", { status: 403 });

        const gw = resolveGateway();
        if (!gw) return new Response("Az AI végpont (AI_GATEWAY_URL) nem érvényes URL.", { status: 500 });
        if (!gw.apiKey) return new Response("Az AI szolgáltatás nincs beállítva.", { status: 500 });

        const headers: Record<string, string> = {};
        if (gw.isLovable) {
          headers["Lovable-API-Key"] = gw.apiKey;
          headers["X-Lovable-AIG-SDK"] = "vercel-ai-sdk";
        }

        let runId: string | undefined;
        const provider = createOpenAI({
          baseURL: gw.baseUrl,
          apiKey: gw.apiKey,
          headers,
          fetch: async (input, init) => {
            const next = new Headers(init?.headers);
            if (runId) next.set(RUN, runId);
            const res = await fetch(input, { ...init, headers: next });
            runId ??= res.headers.get(RUN) ?? undefined;
            return res;
          },
        });

        const sources = item.sources.map((s) => `- ${s.source}: ${s.title} (${s.link})`).join("\n");
        const system = `Te a Stirix.ro hírportál segítője vagy. Kizárólag az alábbi cikk és források alapján válaszolj, mindig magyarul, tömören (legfeljebb 5 mondat vagy rövid felsorolás). Ha a válasz nem derül ki a cikkből, mondd ki egyértelműen. Ne találj ki tényeket.

CIKK CÍME: ${item.title}
KATEGÓRIA: ${item.category}
SZÖVEG:
${item.content}

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
          model: gw.protocol === "chat" ? provider.chat(gw.model) : provider.responses(gw.model),
          system,
          messages,
          abortSignal: request.signal,
          ...(gw.protocol === "chat"
            ? {}
            : {
                providerOptions: {
                  openai: {
                    forceReasoning: true,
                    reasoningEffort: "low",
                    reasoningSummary: "auto",
                    store: false,
                    include: ["reasoning.encrypted_content"],
                  },
                },
              }),
          onError: ({ error }) => console.error("ask error", error),
        });
        return result.toTextStreamResponse();
      },
    },
  },
});

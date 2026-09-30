import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { getNews } from "@/lib/news";

const Body = z.object({
  id: z.string().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(10).default([]),
});

const RUN = "X-Lovable-AIG-Run-ID";

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
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Az AI szolgáltatás nincs beállítva.", { status: 500 });

        let runId: string | undefined;
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: async (input, init) => {
            const headers = new Headers(init?.headers);
            if (runId) headers.set(RUN, runId);
            const res = await fetch(input, { ...init, headers });
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
          model: provider.responses("openai/gpt-6-astra"),
          system,
          messages,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
          onError: ({ error }) => console.error("ask error", error),
        });
        return result.toTextStreamResponse();
      },
    },
  },
});

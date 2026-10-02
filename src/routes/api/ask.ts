import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getNews, tr } from "@/lib/news";

const Body = z.object({
  id: z.string().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(4000) })).max(10).default([]),
  lang: z.enum(["hu", "ro"]).default("hu"),
});

// Konfiguráció futásidőben, környezeti változókból (lásd .env.example):
// AI_GATEWAY_URL, AI_GATEWAY_API_KEY, AI_GATEWAY_MODEL, AI_GATEWAY_PROTOCOL
function aiConfig() {
  const raw = (process.env["AI_GATEWAY_URL"] || "https://ai.gateway.lovable.dev").replace(/\/+$/, "");
  // /v1-et csak akkor fűzünk hozzá, ha az URL-ben egyáltalán nincs útvonal
  const hasPath = new URL(raw).pathname.replace(/\/+$/, "").length > 0;
  const base = hasPath ? raw : `${raw}/v1`;
  const apiKey = process.env["AI_GATEWAY_API_KEY"] || process.env["LOVABLE_API_KEY"] || "";
  const model = process.env["AI_GATEWAY_MODEL"] || "openai/gpt-6-astra";
  const protocol: "chat" | "responses" = (process.env["AI_GATEWAY_PROTOCOL"] || "responses") === "chat" ? "chat" : "responses";
  return { base, apiKey, model, protocol };
}

// SSE válaszból kinyeri a szöveg-darabokat, és sima szövegfolyammá alakítja.
function pipeStream(upstream: Response, protocol: "chat" | "responses", signal: AbortSignal): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();
  let buf = "";
  const nextEvent = (s: string): [string, string] | null => {
    const i1 = s.indexOf("\n\n");
    const i2 = s.indexOf("\r\n\r\n");
    const i = i1 === -1 ? i2 : i2 === -1 ? i1 : Math.min(i1, i2);
    if (i === -1) return null;
    const sepLen = s.startsWith("\r\n\r\n", i) ? 4 : 2;
    return [s.slice(0, i), s.slice(i + sepLen)];
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buf += decoder.decode(value, { stream: true });
          for (;;) {
            const ev = nextEvent(buf);
            if (!ev) break;
            const [rawEvent, rest] = ev;
            buf = rest;
            const data = rawEvent
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (!data || data === "[DONE]") continue;
            try {
              const evt = JSON.parse(data) as any;
              const delta =
                protocol === "chat"
                  ? evt.choices?.[0]?.delta?.content
                  : evt.type === "response.output_text.delta"
                    ? evt.delta
                    : undefined;
              if (typeof delta === "string" && delta) controller.enqueue(new TextEncoder().encode(delta));
            } catch {
              // nem JSON-es esemény – kihagyjuk
            }
          }
        }
      } catch (err: any) {
        if (signal.aborted) {
          try { await controller.close(); } catch { /* már lezárva */ }
        } else {
          controller.error(err);
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

function forwardHeaders(from: Headers, to: Headers) {
  from.forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) to.set(name, value);
  });
}

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
            ? `Ești asistentul portalului de știri Stirix.ro. Răspunde în limba română pe baza articolului, concis:\n\nTITLU: ${article.title}\nTEXT:\n${article.content}\nSURSE:\n${sources}`
            : `A Stirix.ro hírportál segítője vagy. Kizárólag az alábbi cikk és források alapján válaszolj, mindig magyarul, tömören:\n\nCIKK CÍME: ${article.title}\nSZÖVEG:\n${article.content}\nFORRÁSOK:\n${sources}`;

          const messages = [
            ...history.flatMap((h) => [
              { role: "user" as const, content: h.q },
              { role: "assistant" as const, content: h.a },
            ]),
            { role: "user" as const, content: question },
          ];

          const { base, apiKey, model, protocol } = aiConfig();
          if (!apiKey) return new Response(lang === "ro" ? "AI nu este configurat." : "Az AI nincs beállítva.", { status: 401 });

          const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "X-Lovable-AIG-SDK": "fetch",
          };
          if (protocol === "responses") headers["Lovable-API-Key"] = apiKey;

          const upstream = await fetch(
            protocol === "chat" ? `${base}/chat/completions` : `${base}/responses`,
            {
              method: "POST",
              headers,
              signal: request.signal,
              body: JSON.stringify(
                protocol === "chat"
                  ? {
                      model,
                      stream: true,
                      messages: [{ role: "system", content: system }, ...messages],
                    }
                  : {
                      model,
                      stream: true,
                      store: false,
                      instructions: system,
                      input: messages,
                      include: ["reasoning.encrypted_content"],
                      reasoning: { effort: "medium", summary: "auto" },
                    },
              ),
            },
          );

          const outHeaders = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          forwardHeaders(upstream.headers, outHeaders);

          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text().catch(() => "");
            return new Response(text || "AI hiba", { status: upstream.status || 502, headers: outHeaders });
          }

          return new Response(pipeStream(upstream, protocol, request.signal), { headers: outHeaders });
        } catch (err: any) {
          console.error("Hiba történt:", err);
          return new Response(`Szerver hiba: ${err?.message || err}`, { status: 500 });
        }
      },
    },
  },
});

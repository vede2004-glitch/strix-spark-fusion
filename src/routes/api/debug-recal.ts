import { createServerFileRoute } from "@tanstack/react-start/server";
import { synthesized, isRecent } from "@/lib/news";

export const ServerRoute = createServerFileRoute("/api/public/debug-recal").methods({
  GET: () => {
    const now = Date.now() / 1000;
    const recent = synthesized.filter((n) => isRecent(n));
    const ages = synthesized
      .map((n) => ({ id: n.group_id, pub: n.published_at, age_h: Math.round((now - (n.published_at ?? 0)) / 360) / 10 }))
      .sort((a, b) => b.age_h - a.age_h)
      .slice(0, 5);
    return Response.json({
      syn: synthesized.length,
      recent: recent.length,
      now,
      oldest: ages,
    });
  },
});

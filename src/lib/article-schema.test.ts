import { describe, expect, test } from "bun:test";
import type { NewsItem } from "./news";
import { articleSchema, serializeArticleSchema } from "./article-schema";

const item: NewsItem = {
  group_id: "group_1792497600_1", category: "Erdély", image: null,
  is_synthesized: true, published_at: 1792497600,
  title: "**Hír**", lead: "Bevezető", content: "Cikk",
  sources: [{ source: "Maszol", title: "Eredeti hír", link: "https://maszol.ro/hir" }],
  i18n: { hu: { title: "Hír", lead: "Bevezető", content: "Cikk" }, ro: { title: "Știre", lead: "Introducere", content: "Articol" } },
};

describe("article structured data", () => {
  test("retains original source attribution for citations", () => {
    const schema = articleSchema(item, null);
    expect(schema.citation).toEqual([{ "@type": "CreativeWork", name: "Eredeti hír", url: "https://maszol.ro/hir", publisher: { "@type": "Organization", name: "Maszol" } }]);
  });
  test("uses the article timestamp and plain headline without fabricated modification dates", () => {
    const schema = articleSchema(item, null);
    expect(schema.datePublished).toBe(new Date(1792497600 * 1000).toISOString());
    expect(schema.headline).toBe("Hír");
    expect(schema).not.toHaveProperty("dateModified");
  });
  test("article text cannot close the JSON-LD script", () => {
    const text = "</script><script>alert(1)</script>";
    const serialized = serializeArticleSchema(articleSchema({ ...item, content: text }, null));
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized).articleBody).toBe(text);
  });
});
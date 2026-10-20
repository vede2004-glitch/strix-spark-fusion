import { describe, expect, test } from "bun:test";
import { domainLang, domainRedirect } from "./domains";

describe("multi-domain routing", () => {
  test("stirix.ro with Hungarian browser goes to hirx.ro", () => {
    expect(domainRedirect("stirix.ro", "hu-HU,hu;q=0.9,en;q=0.8", "/hir/x")).toBe("https://hirx.ro/hir/x");
  });
  test("stirix.ro with any other language goes to strix.ro", () => {
    expect(domainRedirect("www.stirix.ro", "ro-RO,ro;q=0.9")).toBe("https://strix.ro/");
    expect(domainRedirect("stirix.ro", null)).toBe("https://strix.ro/");
  });
  test("other domains are not redirected", () => {
    expect(domainRedirect("hirx.ro", "hu")).toBeNull();
  });
  test("hirx.ro is Hungarian, strix.ro is Romanian", () => {
    expect(domainLang("hirx.ro")).toBe("hu");
    expect(domainLang("strix.ro")).toBe("ro");
    expect(domainLang("localhost:8080")).toBeNull();
  });
});

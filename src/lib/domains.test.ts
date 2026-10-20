import { describe, expect, test } from "bun:test";
import { domainLang, domainRedirect } from "./domains";

describe("multi-domain routing", () => {
  test("stirix.ro with Hungarian browser goes to hirx.ro", () => {
    expect(domainRedirect("stirix.ro", "hu-HU,hu;q=0.9,en;q=0.8", "/hir/x")).toBe("https://hirx.ro/hir/x");
  });
  test("stirix.ro with any other language stays on stirix.ro", () => {
    expect(domainRedirect("www.stirix.ro", "ro-RO,ro;q=0.9")).toBeNull();
    expect(domainRedirect("stirix.ro", null)).toBeNull();
  });
  test("hirx.ro is never redirected", () => {
    expect(domainRedirect("hirx.ro", "ro")).toBeNull();
  });
  test("hirx.ro is Hungarian, stirix.ro is Romanian", () => {
    expect(domainLang("hirx.ro")).toBe("hu");
    expect(domainLang("stirix.ro")).toBe("ro");
    expect(domainLang("localhost:8080")).toBeNull();
  });
});

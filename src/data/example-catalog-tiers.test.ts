import { describe, expect, it } from "vitest";
import { EXAMPLE_CATALOG, renderExamplesNav } from "./example-catalog";
import { renderProPage } from "./pro-page";

/*
 * The start page is split in two (Johan 6/10): the open FlowWeaver first,
 * then FlowWeaver PRO, where the e-services — the guides that send something
 * in — are shown and demonstrated. A guide is in one tier, never both, and a
 * section appears in a tier only when it has a guide there.
 */
describe("the start page's two tiers", () => {
  const pro = EXAMPLE_CATALOG.flatMap((s) => [...s.guides, ...(s.collapsed ?? [])]).filter((g) => g.pro);
  const open = EXAMPLE_CATALOG.flatMap((s) => [...s.guides, ...(s.collapsed ?? [])]).filter((g) => !g.pro);

  it("the guides that send are PRO, the rest are open", () => {
    const proHrefs = pro.flatMap((g) => [g.build, g.try]).filter(Boolean).join(" ");
    for (const slug of ["claim", "quote", "booking", "membership", "complaint", "conference", "moving", "survey", "borrow", "submission", "form-order", "recipients", "email-result", "secure-runtime", "every-field", "page-viewer", "preview-service", "housing-allowance.html"]) {
      expect(proHrefs, slug).toContain(`/${slug}`);
    }
    const openHrefs = open.flatMap((g) => [g.build, g.try]).filter(Boolean).join(" ");
    for (const slug of ["service-finder", "housing-screening", "editor-basic", "troubleshooting", "map.html", "citizenship", "loan-calculator", "housing-allowance-calc"]) {
      expect(openHrefs, slug).toContain(slug);
    }
    expect(pro.length).toBeGreaterThan(10);
  });

  it("the start page lists the open guides and only a teaser for PRO, linking to /pro/", () => {
    const html = renderExamplesNav("sv");
    const proStart = html.indexOf('class="examples-index__pro"');
    expect(proStart).toBeGreaterThan(0);
    expect(html.slice(proStart)).toContain("FlowWeaver PRO");
    expect(html.slice(proStart)).toContain('href="./pro/"');
    for (const g of pro) {
      expect(html, g.title.sv).not.toContain(`href="${g.try ?? g.build}"`);
    }
    for (const g of open) {
      const at = html.indexOf(`href="${g.try ?? g.build}"`);
      expect(at, g.title.sv).toBeGreaterThan(-1);
      expect(at, g.title.sv).toBeLessThan(proStart);
    }
    // Företag has only sending guides: not an open section.
    expect(html).not.toContain('id="module-foretag"');
  });

  it("/pro/ carries every PRO guide once, the comparison, and nothing open", () => {
    const html = renderProPage("sv");
    const onPro = (href: string): string => `href="${href.replace(/^\.\//, "../")}"`;
    for (const g of pro) {
      const at = html.indexOf(onPro(g.try ?? g.build!));
      expect(at, g.title.sv).toBeGreaterThan(-1);
      expect(html.indexOf(onPro(g.try ?? g.build!), at + 1), `${g.title.sv} twice`).toBe(-1);
    }
    for (const g of open) {
      expect(html, g.title.sv).not.toContain(onPro(g.try ?? g.build!));
    }
    expect(html).toContain('id="pro-foretag"');
    expect(html).toContain("Bara FlowWeaver PRO");
    expect(html).toContain("Inlämning, E-postresultat");
    // The English page is the same page in English, not a copy of the Swedish.
    expect(renderProPage("en")).toContain("FlowWeaver PRO only");
  });
});

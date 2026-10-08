import { describe, expect, test } from "vitest";

import { EXAMPLE_CATALOG } from "../data/example-catalog";
import type { GraphData } from "../viewer/types/graph";

/*
 * An open example must be one the open editor can rebuild (Johan 8/10:
 * "Fler exempel och funktioner på startsidan borde inte innehålla guider som
 * är PRO"). When free text, rating, consent, attach file and review became
 * PRO's the same day, five guides on the open part of the start page went on
 * showing them — Felanmälan, Page Builder, the e-service profile and both
 * housing-allowance guides — and nothing noticed: the catalogue's `pro` flag
 * and the guide's contents were two facts nobody compared.
 *
 * This compares them. For every guide the catalogue lists as open, it reads the
 * page's `data-example-graph` (or, without one, the editor's feature level, as
 * `main.ts` does), takes the guide the page actually opens from the site's own
 * table, and fails on a node type the open palette does not offer.
 *
 * The PRO list is read from `node-palette.ts`, its one home. The site's table
 * is not exported to the open repo, so there the gate has nothing to compare
 * and stands down, like the palette gates.
 */
const paletteSource = Object.values(
  import.meta.glob("../editor/components/node-palette/node-palette.ts", { eager: true, query: "?raw", import: "default" }),
)[0] as string;
const ONLY_PRO = new Set([
  ...[...(paletteSource.match(/OFFERED_BY_PRO = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((one) => one[1]),
  // What PRO adds outright, never in the open palette at all.
  "submit-result",
  "email-result",
]);

const table = Object.values(
  import.meta.glob("../site/example-graphs.ts", { eager: true }),
)[0] as { EXAMPLE_GRAPHS: Record<string, GraphData> } | undefined;

const pages = {
  ...import.meta.glob("../../examples/*.html", { query: "?raw", import: "default", eager: true }),
} as Record<string, string>;

/** The guide a page opens: its name, else the editor's level, else the default. */
function graphOfPage(html: string, graphs: Record<string, GraphData>): [string, GraphData | undefined] {
  const named = html.match(/data-example-graph="([^"]+)"/)?.[1];
  const level = html.match(/<guide-editor[^>]*feature-level="(basic|service)"/s)?.[1];
  const name = named ?? level ?? "example";
  return [name, graphs[name]];
}

describe("the open examples hold nothing only PRO offers", () => {
  test("the PRO list was read from the palette", () => {
    expect(ONLY_PRO.has("text-question")).toBe(true);
  });

  test.runIf(Boolean(table))("every open guide on the start page", () => {
    const open = EXAMPLE_CATALOG.flatMap((section) => [...section.guides, ...(section.collapsed ?? [])]).filter((guide) => !guide.pro);
    const offenders: string[] = [];

    for (const guide of open) {
      for (const href of [guide.try, guide.build].filter(Boolean) as string[]) {
        const html = pages[`../../examples/${href.replace("./examples/", "")}`];
        if (!html) continue; // pages outside examples/ are checked by examples-links
        const [name, graph] = graphOfPage(html, table!.EXAMPLE_GRAPHS);
        // A page with its own script and no name opens something else; it has
        // to say which guide before this gate can vouch for it.
        if (!graph) continue;
        const pro = [...new Set(graph.nodes.map((node) => node.type).filter((type) => ONLY_PRO.has(type)))];
        if (pro.length) offenders.push(`${guide.title.sv} (${href} → ${name}): ${pro.join(", ")}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

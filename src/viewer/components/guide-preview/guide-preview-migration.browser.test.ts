import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { migrateGraph, readGraphVersion } from "../../core/graph-migrations";

import type { GuidePreview } from "./guide-preview";

/**
 * An older guide renders for the resident, not an empty page.
 *
 * ## What was measured
 *
 * A v3 guide — a page carrying its two built-in text fields — set straight on
 * `<guide-preview>`:
 *
 *     RÅ (v3 som den lagrats):  fält=0, inget fel
 *     MIGRERAD (samma graf):    fält=2, "Ditt namn", "Din e-post"
 *
 * No error either way. The page simply had nothing on it, which is the worst
 * shape a fault can take: it looks like a guide somebody built badly.
 *
 * `migrateGraph` was called in exactly two places in production code — the file
 * import and the editor's setter — and neither is on the viewer's path. The
 * SiteVision module sets `element.graph` straight from stored JSON, so that is
 * the path a published guide actually takes.
 *
 * ## Why this test drives the setter with an object
 *
 * Because that is the door that was open. A test that imported a JSON file
 * would have passed all along — `importGraphJson` migrated from the start. The
 * fault lived in the difference between the two doors, which is exactly what
 * `accepted-graph.ts` was written about for the editor, six weeks before the
 * viewer turned out to have the same hole.
 *
 * ## The measurement that was wrong first
 *
 * `migrateGraph(graph)` with one argument applies nothing: the version is its
 * **second** parameter, not something it reads off the graph. Both sides then
 * rendered zero fields and the first run looked like proof that all was well.
 * Hence `readGraphVersion` here, and hence a test that asserts the *difference*
 * has a known value rather than that two things merely agree.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A page from before v4, carrying its two fields in the page's own data. */
const oldGuide = () => ({
  version: 3,
  startNodeId: "p",
  nodes: [
    {
      id: "p",
      type: "page",
      position: { x: 0, y: 0 },
      data: {
        title: "Om dig",
        firstLabel: "Ditt namn",
        firstVariableName: "namn",
        secondLabel: "Din e-post",
        secondVariableName: "epost",
      },
    },
  ],
  connections: [],
});

async function render(graph: unknown): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graph as never;

  await settle();
  await settle();

  return preview;
}

const fieldsOf = (preview: GuidePreview): string[] =>
  Array.from(preview.shadowRoot!.querySelectorAll<HTMLElement>("[data-page-variable]")).map(
    (field) => field.getAttribute("data-page-variable") ?? "",
  );

describe("en guide i äldre format", () => {
  test("renderar sina fält", async () => {
    expect(fieldsOf(await render(oldGuide()))).toEqual(["namn", "epost"]);
  });

  test("och likadant som om värden migrerat den själv", async () => {
    const guide = oldGuide();
    const beforehand = migrateGraph(guide as never, readGraphVersion(guide)).graph;

    expect(fieldsOf(await render(oldGuide()))).toEqual(fieldsOf(await render(beforehand)));
  });

  test("utan att säga något om det till invånaren", async () => {
    // Migreringen är vår sak, inte hens. Ett besked här vore ett fel hen inte
    // kan göra något åt.
    const preview = await render(oldGuide());

    expect(preview.shadowRoot!.querySelector(".guide-preview__error")).toBeNull();
  });
});

describe("en guide som redan är i dagens format", () => {
  test("rörs inte, hur många gånger den än sätts", async () => {
    /*
     * A host may set the same graph twice — a re-render, a language switch, a
     * fresh read from storage. The guessing migrations (v1→v3) cannot tell old
     * data from new, so running them on a modern graph would rewrite text
     * somebody just wrote.
     */
    const preview = await render({
      startNodeId: "q",
      nodes: [
        {
          id: "q",
          type: "text-question",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Ditt namn" }, variableName: "namn" },
        },
      ],
      connections: [],
    });

    const first = JSON.stringify(preview.graph);

    preview.graph = preview.graph as never;
    await settle();

    expect(JSON.stringify(preview.graph)).toBe(first);
  });

  test("och bär ingen versionsnyckel inåt", async () => {
    // Versionen hör till den serialiserade filen. Bärs den internt läcker den
    // in i allt som jämför grafer.
    const preview = await render({ ...oldGuide(), version: 3 });

    expect((preview.graph as { version?: number } | null)?.version).toBeUndefined();
  });
});

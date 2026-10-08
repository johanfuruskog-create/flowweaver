import { describe, expect, test } from "vitest";

// Meningarna kommer ur editorns ordlista, som registrerar sig när den laddas.
// Ett test får importera den; tjänsten får inte, och `entries.test.ts` räknar
// bara källgrafen (CLAUDE.md).
import "../../editor/localization/editor-ui-strings";

import { GuideMergeService } from "./guide-merge-service";

import type { MergeSide } from "./guide-merge-service";
import type { GraphData } from "../types/graph";

/**
 * Att slå ihop två redaktörers arbete, rad för rad (berättelse 131).
 *
 * ## Vad varje fall pinnar
 *
 * Kriterium 1 och 2 i berättelsen, ett test per påstående. Ett enda test över
 * en graf med allting ändrat blir grönt så fort *någon* av sakerna hittas —
 * och det som avgör om någons arbete överlever är precis de fall som inte
 * hittas.
 *
 * Mätningarna som skrevs mot, och som setts falla:
 *
 *  - jämför hela grafen i stället för `visitorContent` mot utgångspunkten →
 *    positioner dyker upp som rader (*bara flyttad*-testet);
 *  - en väg till en borttagen nod följer med → grafen har en väg till
 *    ingenting (*hängande väg*-testet).
 */

const guide = (): GraphData =>
  ({
    startNodeId: "q1",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Boendeform" },
          variableName: "boende",
          options: [
            { id: "hyres", label: { sv: "Hyresrätt" }, value: "hyres" },
            { id: "bostad", label: { sv: "Bostadsrätt" }, value: "bostad" },
          ],
        },
      },
      {
        id: "r1",
        type: "result",
        position: { x: 300, y: 0 },
        data: { title: { sv: "Kontaktuppgifter" } },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "hyres" }, to: { nodeId: "r1", portId: "in" } },
    ],
  }) as unknown as GraphData;

/** Samma guide med en sak gjord i den. */
const after = (change: (graph: GraphData) => void): GraphData => {
  const copy = JSON.parse(JSON.stringify(guide())) as GraphData;

  change(copy);

  return copy;
};

const heading = (graph: GraphData, id: string): unknown =>
  (graph.nodes.find((node) => node.id === id)?.data as Record<string, unknown> | undefined)?.title;

const plan = (theirs: GraphData, mine: GraphData) =>
  GuideMergeService.plan(guide(), theirs, mine);

const applied = (theirs: GraphData, mine: GraphData, choices: Record<string, MergeSide> = {}) =>
  GuideMergeService.apply(plan(theirs, mine), choices);

describe("vad två redaktörer ändrat sedan utgångspunkten", () => {
  /*
   * Det vanliga fallet, och hela skälet berättelsen finns: två som arbetar i
   * samma guide rör oftast olika saker.
   */
  test("två oberoende ändringar ger två rader, ingen med ett val", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      graph.nodes.push({
        id: "r2",
        type: "result",
        position: { x: 300, y: 200 },
        data: { title: { sv: "Kontakta hyresvärden" } },
      } as never);
    });

    const result = plan(theirs, mine);

    expect(result.rows).toHaveLength(2);
    expect(result.overlaps, "ingenting att välja mellan").toEqual([]);
    expect(result.rows.map((row) => row.id).sort()).toEqual(["content:q1", "node:r2"]);
  });

  /*
   * En nod som bara dragits över arbetsytan är ingen ändring att välja mellan.
   * Mutationen som fäller det: jämför hela grafen i stället för
   * `visitorContent` — då blir varje flyttad nod en rad, och en lista där
   * koordinater ligger bland frågorna är en lista ingen läser klart.
   */
  test("en nod som bara flyttats finns inte i listan", () => {
    const theirs = after((graph) => (graph.nodes[0]!.position = { x: 900, y: 40 }));
    const mine = after((graph) => (graph.nodes[1]!.position = { x: 40, y: 900 }));

    expect(plan(theirs, mine).rows).toEqual([]);
  });

  test("samma fält ändrat av båda ger en markerad rad", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Var bor du?" };
    });

    const result = plan(theirs, mine);

    expect(result.overlaps.map((row) => row.id)).toEqual(["content:q1"]);
    expect(result.overlaps[0]!.theirs).toHaveLength(1);
    expect(result.overlaps[0]!.mine).toHaveLength(1);
  });

  /*
   * *Annas* tar bort noden, *Min* behåller den med min text. Diff-tjänsten
   * säger *steget togs bort* på den ena sidan och *rubriken har ändrats* på
   * den andra — två skilda nycklar — och utan att de förs ihop står det som
   * två rader utan val, alltså en tyst förlust.
   */
  test("borttagen mot ändrad ger en markerad rad, inte två tysta", () => {
    const theirs = after((graph) => {
      graph.nodes = graph.nodes.filter((node) => node.id !== "r1");
      graph.connections = [];
    });
    const mine = after((graph) => {
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Så når du oss" };
    });

    const result = plan(theirs, mine);

    expect(result.overlaps.map((row) => row.id)).toEqual(["node:r1"]);
    expect(result.overlaps[0]!.theirs.map((one) => one.message).join(" ")).toContain("tagits bort");
    expect(result.overlaps[0]!.mine.map((one) => one.message).join(" ")).toContain("rubriken");
    /* Och den nya texten följer med, så valet inte görs i blindo (20/9). */
    expect(result.overlaps[0]!.mine[0]!.after).toBe("Så når du oss");
    expect(result.overlaps[0]!.theirs[0]!.after, "en borttagning har ingen ny text").toBeUndefined();
  });

  /*
   * Samma ändring av båda är ingen fråga. Raden står kvar och dämpad — den som
   * läser listan ska se att den är genomläst, inte undra vart posten tog vägen.
   */
  test("samma ändring av båda är löst, och står utan val", () => {
    const same = (graph: GraphData) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    };

    const result = plan(after(same), after(same));

    expect(result.overlaps).toEqual([]);
    expect(result.rows.map((row) => [row.id, row.resolved])).toEqual([["content:q1", true]]);
  });

  /*
   * Olika **slag** på samma nod är två rader utan val: hon skrev om frågan,
   * jag flyttade fältet, och båda följer med.
   */
  test("olika slag på samma nod är två rader utan val", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      graph.nodes[0]!.parentPageId = "sida-1";
      graph.nodes[0]!.order = 2;
    });

    const result = plan(theirs, mine);

    expect(result.overlaps).toEqual([]);
    expect(result.rows.map((row) => row.id).sort()).toEqual(["content:q1", "page:q1"]);
  });

  /* Krockarna överst: den som öppnar rutan ska se det som kräver svar. */
  test("krockarna står överst i listan", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Så når du oss" };
    });
    const mine = after((graph) => {
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Kontakta oss" };
    });

    const result = plan(theirs, mine);

    expect(result.rows[0]!.overlap, "den som kräver ett svar först").toBe(true);
    expect(result.rows[0]!.id).toBe("content:r1");
  });
});

describe("grafen som blir kvar", () => {
  test("behåll båda: två oberoende ändringar finns i resultatet", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      graph.nodes.push({
        id: "r2",
        type: "result",
        position: { x: 300, y: 200 },
        data: { title: { sv: "Kontakta hyresvärden" } },
      } as never);
    });

    const result = applied(theirs, mine);

    expect(heading(result.graph, "q1")).toEqual({ sv: "Hur bor du?" });
    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual(["q1", "r1", "r2"]);
    expect(result.unanswered).toEqual([]);
  });

  test("Annas respektive Min på en krock ger rätt värde", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Var bor du?" };
    });

    expect(heading(applied(theirs, mine, { "content:q1": "theirs" }).graph, "q1")).toEqual({
      sv: "Hur bor du?",
    });
    expect(heading(applied(theirs, mine, { "content:q1": "mine" }).graph, "q1")).toEqual({
      sv: "Var bor du?",
    });
  });

  /*
   * Ingen graf byggs på en halv fråga. Rutan hindrar det (kriterium 3), och
   * tjänsten säger det också — ett anrop utan svar ska inte tyst få *min*.
   */
  test("en krock utan val räknas upp i stället för att gissa", () => {
    const theirs = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
    });
    const mine = after((graph) => {
      (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Var bor du?" };
    });

    expect(applied(theirs, mine).unanswered).toEqual(["content:q1"]);
  });

  /*
   * Valideringen, och den är berättelsens egen mutation: en väg till en
   * borttagen nod följer med → grafen har en väg till ingenting, som visaren
   * följer och hamnar nowhere. Här väljs *Annas* på noden hon tog bort, och
   * kopplingen dit måste falla med den — och **sägas**, aldrig städas tyst.
   */
  test("en väg till en borttagen nod följer inte med, och det sägs", () => {
    const theirs = after((graph) => {
      graph.nodes = graph.nodes.filter((node) => node.id !== "r1");
    });
    const mine = after((graph) => {
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Så når du oss" };
    });

    const result = applied(theirs, mine, { "node:r1": "theirs" });

    expect(result.graph.nodes.map((node) => node.id)).toEqual(["q1"]);
    expect(
      result.graph.connections,
      "en koppling till en nod som inte finns är en väg till ingenting",
    ).toEqual([]);
    expect(result.droppedConnections, "och den städas aldrig i tysthet").toEqual(["c1"]);
  });

  test("och Min behåller noden, med min text och sin väg", () => {
    const theirs = after((graph) => {
      graph.nodes = graph.nodes.filter((node) => node.id !== "r1");
    });
    const mine = after((graph) => {
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Så når du oss" };
    });

    const result = applied(theirs, mine, { "node:r1": "mine" });

    expect(heading(result.graph, "r1")).toEqual({ sv: "Så når du oss" });
    expect(result.graph.connections.map((link) => link.id)).toEqual(["c1"]);
    expect(result.droppedConnections).toEqual([]);
  });

  /*
   * Positionen är aldrig en fråga — men den får inte heller gå förlorad. Min
   * när jag flyttat noden, annars deras: den som dragit ett kort vill hitta
   * det där hen la det.
   */
  test("positionen är min där jag flyttat noden, annars deras", () => {
    const theirs = after((graph) => {
      graph.nodes[0]!.position = { x: 900, y: 40 };
      graph.nodes[1]!.position = { x: 950, y: 60 };
    });
    const mine = after((graph) => (graph.nodes[0]!.position = { x: 11, y: 22 }));

    const result = applied(theirs, mine);
    const at = (id: string) => result.graph.nodes.find((node) => node.id === id)?.position;

    expect(at("q1"), "jag flyttade den").toEqual({ x: 11, y: 22 });
    expect(at("r1"), "hon flyttade den, jag rörde den inte").toEqual({ x: 950, y: 60 });
  });

  /*
   * En ny väg hos den ena och en omdragen hos den andra är två olika
   * kopplingar, alltså ingen fråga — båda följer med.
   */
  test("vägar som inte rör varandra följer båda med", () => {
    const theirs = after((graph) => {
      graph.nodes.push({
        id: "r2",
        type: "result",
        position: { x: 300, y: 200 },
        data: { title: { sv: "Kontakta hyresvärden" } },
      } as never);
      graph.connections.push({
        id: "c2",
        from: { nodeId: "q1", portId: "bostad" },
        to: { nodeId: "r2", portId: "in" },
      } as never);
    });
    const mine = after((graph) => {
      (graph.nodes[1]!.data as Record<string, unknown>).title = { sv: "Så når du oss" };
    });

    const result = applied(theirs, mine);

    expect(result.graph.connections.map((link) => link.id).sort()).toEqual(["c1", "c2"]);
    expect(heading(result.graph, "r1")).toEqual({ sv: "Så når du oss" });
  });
});

import { describe, expect, test } from "vitest";

// Sentences come from the editor's table, which registers itself when loaded.
// A test may import it; the service may not, and `entries.test.ts` counts only
// the source graph (CLAUDE.md).
import "../../editor/localization/editor-ui-strings";

import { GuideDiffService } from "./guide-diff-service";

import type { GraphData } from "../types/graph";

/**
 * What a publication would change for a visitor, said in sentences (story 125).
 *
 * ## Why this is a list and not a boolean
 *
 * Story 124 answered *has anything changed?* — enough for a dot beside a name,
 * useless in front of a decision. An editor about to publish is asking *what
 * changes*, and the honest answer names the questions, the answers and the
 * routes, in the guide's own words.
 *
 * ## What each case pins
 *
 * One test per kind in the story's table, because a diff that finds four of six
 * kinds is a diff that lies by omission — and a single test over a graph with
 * six changes in it goes green the moment any one of them is found.
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
      {
        id: "r2",
        type: "result",
        position: { x: 300, y: 200 },
        data: { title: { sv: "Kontakta hyresvärden" } },
      },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "hyres" }, to: { nodeId: "r1", portId: "in" } },
    ],
  }) as unknown as GraphData;

/** The same guide with one thing done to it. */
const after = (change: (graph: GraphData) => void): GraphData => {
  const copy = JSON.parse(JSON.stringify(guide())) as GraphData;

  change(copy);

  return copy;
};

const compare = (next: GraphData) => GuideDiffService.compare(guide(), next);

describe("vad en publicering ändrar för besökaren", () => {
  test("en nod som bara flyttats ger ingen rad alls", () => {
    const rows = compare(after((graph) => (graph.nodes[0]!.position = { x: 900, y: 40 })));

    expect(rows, "arbetsytan hör inte till besökaren").toEqual([]);
  });

  test("content: frågans rubrik", () => {
    const rows = compare(
      after((graph) => ((graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" })),
    );

    expect(rows.map((row) => row.kind)).toEqual(["content"]);
    expect(rows[0]!.nodeId).toBe("q1");
    expect(rows[0]!.message).toBe("Hur bor du?: rubriken har ändrats.");
    expect(rows[0]!.before, "före och efter, för den som vill se exakt vad").toBe("Boendeform");
    expect(rows[0]!.after).toBe("Hur bor du?");
  });

  test("content: något annat än rubriken", () => {
    const rows = compare(
      after((graph) => ((graph.nodes[0]!.data as Record<string, unknown>).required = true)),
    );

    expect(rows.map((row) => row.message)).toEqual(["Boendeform: innehållet har ändrats."]);
  });

  test("option: ett alternativ tillagt, borttaget och omdöpt", () => {
    const added = compare(
      after((graph) => {
        const options = (graph.nodes[0]!.data as { options: unknown[] }).options;

        options.push({ id: "annat", label: { sv: "Annat" }, value: "annat" });
      }),
    );
    const removed = compare(
      after((graph) => {
        const data = graph.nodes[0]!.data as { options: unknown[] };

        data.options = data.options.slice(0, 1);
      }),
    );
    const renamed = compare(
      after((graph) => {
        const options = (graph.nodes[0]!.data as { options: { label: unknown }[] }).options;

        options[0]!.label = { sv: "Hyresrätt eller andrahand" };
      }),
    );

    expect(added.map((row) => row.message)).toEqual([
      'Boendeform: alternativet "Annat" har lagts till.',
    ]);
    expect(removed.map((row) => row.message)).toEqual([
      'Boendeform: alternativet "Bostadsrätt" har tagits bort.',
    ]);
    expect(renamed.map((row) => row.message)).toEqual([
      'Boendeform: alternativet "Hyresrätt" heter nu "Hyresrätt eller andrahand".',
    ]);
    expect(added.map((row) => row.kind)).toEqual(["option"]);
  });

  /*
   * Alternativ känns igen på sitt id, aldrig på sin plats i listan. Ett nytt
   * alternativ högst upp flyttar alla andra ett steg ned, och en jämförelse på
   * plats läser det som att varenda alternativ bytt namn — tre rader om en
   * handling, och ingen av dem sann.
   */
  test("option: ett nytt alternativ först är ett tillägg, inte tre omdöpningar", () => {
    const rows = compare(
      after((graph) => {
        const data = graph.nodes[0]!.data as { options: unknown[] };

        data.options = [{ id: "annat", label: { sv: "Annat" }, value: "annat" }, ...data.options];
      }),
    );

    expect(rows.map((row) => row.message)).toEqual([
      'Boendeform: alternativet "Annat" har lagts till.',
    ]);
  });

  /*
   * Och ordningen mellan dem är också något besökaren ser. Den står inte i
   * berättelsens tabell, men en översikt som säger *inga ändringar* när Ja och
   * Nej bytt plats ljuger på precis det sätt tjänsten finns för att låta bli.
   */
  test("option: alternativen byter plats", () => {
    const rows = compare(
      after((graph) => {
        const data = graph.nodes[0]!.data as { options: unknown[] };

        data.options = [data.options[1], data.options[0]];
      }),
    );

    expect(rows.map((row) => row.message)).toEqual([
      "Boendeform: alternativen har fått en ny ordning.",
    ]);
  });

  test("route: en koppling byter mål", () => {
    const rows = compare(after((graph) => (graph.connections[0]!.to.nodeId = "r2")));

    expect(rows.map((row) => row.kind)).toEqual(["route"]);
    expect(rows[0]!.message).toBe(
      'Boendeform → Hyresrätt: leder nu till "Kontakta hyresvärden", tidigare "Kontaktuppgifter".',
    );
  });

  test("route: en koppling tillagd och en borttagen", () => {
    const added = compare(
      after((graph) =>
        graph.connections.push({
          id: "c2",
          from: { nodeId: "q1", portId: "bostad" },
          to: { nodeId: "r2", portId: "in" },
        }),
      ),
    );
    const removed = compare(after((graph) => (graph.connections = [])));

    expect(added.map((row) => row.message)).toEqual([
      'Boendeform → Bostadsrätt: leder nu till "Kontakta hyresvärden".',
    ]);
    expect(removed.map((row) => row.message)).toEqual([
      "Boendeform → Hyresrätt: leder inte längre vidare.",
    ]);
  });

  test("node: en nod tillagd och en borttagen", () => {
    const added = compare(
      after((graph) =>
        graph.nodes.push({
          id: "r3",
          type: "result",
          position: { x: 600, y: 0 },
          data: { title: { sv: "Ansök här" } },
        } as never),
      ),
    );
    const removed = compare(after((graph) => (graph.nodes = graph.nodes.slice(0, 2))));

    expect(added.map((row) => row.message)).toEqual(["Ansök här: steget har lagts till."]);
    expect(removed.map((row) => row.message)).toEqual([
      "Kontakta hyresvärden: steget har tagits bort.",
    ]);
  });

  test("start: guiden börjar någon annanstans", () => {
    const rows = compare(after((graph) => (graph.startNodeId = "r1")));

    expect(rows.map((row) => row.kind)).toEqual(["start"]);
    expect(rows[0]!.message).toBe('Guiden börjar nu med "Kontaktuppgifter".');
  });

  test("page: ett fält flyttas på sin sida", () => {
    const sida = (): GraphData =>
      ({
        startNodeId: "p1",
        settings: { sourceLocale: "sv" },
        nodes: [
          { id: "p1", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Kontakt" } } },
          {
            id: "f1",
            type: "text-question",
            position: { x: 20, y: 40 },
            parentPageId: "p1",
            order: 0,
            data: { title: { sv: "E-post" }, variableName: "epost" },
          },
          {
            id: "f2",
            type: "text-question",
            position: { x: 20, y: 80 },
            parentPageId: "p1",
            order: 1,
            data: { title: { sv: "Telefon" }, variableName: "telefon" },
          },
        ],
        connections: [],
      }) as unknown as GraphData;
    const flyttad = JSON.parse(JSON.stringify(sida())) as GraphData;

    flyttad.nodes[1]!.order = 5;

    const rows = GuideDiffService.compare(sida(), flyttad);

    expect(rows.map((row) => row.kind)).toEqual(["page"]);
    expect(rows[0]!.message).toBe('Kontakt: fältet "E-post" har flyttats.');
  });

  /*
   * Kriterium 2. En ny nod kommer sällan ensam — den kopplas in — och en lista
   * som säger "steget har lagts till" och sedan tre rader om vägar dit är en
   * lista som beskriver samma handling fyra gånger.
   */
  describe("en handling ger en rad", () => {
    test("en ny nod med kopplingar ger en rad, inte en per koppling", () => {
      const rows = compare(
        after((graph) => {
          graph.nodes.push({
            id: "r3",
            type: "result",
            position: { x: 600, y: 0 },
            data: { title: { sv: "Ansök här" } },
          } as never);
          graph.connections.push({
            id: "c2",
            from: { nodeId: "q1", portId: "bostad" },
            to: { nodeId: "r3", portId: "in" },
          });
        }),
      );

      expect(rows.map((row) => row.kind)).toEqual(["node"]);
      expect(rows.map((row) => row.message)).toEqual(["Ansök här: steget har lagts till."]);
    });

    test("en borttagen nod ger en rad, och inga vägrader för dess kopplingar", () => {
      const rows = compare(
        after((graph) => {
          graph.nodes = graph.nodes.filter((node) => node.id !== "r1");
          graph.connections = [];
        }),
      );

      expect(rows.map((row) => row.kind)).toEqual(["node"]);
      expect(rows.map((row) => row.message)).toEqual([
        "Kontaktuppgifter: steget har tagits bort.",
      ]);
    });
  });

  /*
   * Ordningen är ett påstående om vad som är störst: det som ändrar vägen
   * genom guiden läses först, en flyttad ruta på en sida sist.
   */
  test("ordningen sätter det som ändrar vägen först", () => {
    const rows = compare(
      after((graph) => {
        (graph.nodes[0]!.data as Record<string, unknown>).title = { sv: "Hur bor du?" };
        (graph.nodes[0]!.data as { options: { label: unknown }[] }).options[0]!.label = {
          sv: "Hyra",
        };
        graph.connections[0]!.to.nodeId = "r2";
        graph.startNodeId = "r1";
      }),
    );

    expect(rows.map((row) => row.kind)).toEqual(["start", "route", "option", "content"]);
  });

  /*
   * Första publiceringen har ingenting att jämföra med. Då är frågan inte "vad
   * ändras" utan "vad är det jag publicerar", och svaret är guiden i den ordning
   * starten leder.
   */
  describe("första publiceringen", () => {
    test("utan en tidigare version finns ingen jämförelse", () => {
      expect(GuideDiffService.compare(null, guide())).toEqual([]);
    });

    test("innehållsöversikten räknar upp guiden från starten", () => {
      const rows = GuideDiffService.outline(guide());

      expect(rows.map((row) => row.title)).toEqual([
        "Boendeform",
        "Kontaktuppgifter",
        "Kontakta hyresvärden",
      ]);
      expect(rows[0]!.nodeId).toBe("q1");
    });
  });
});

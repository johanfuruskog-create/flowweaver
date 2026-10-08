import { afterEach, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
import { GuideHealthService } from "./guide-health-service";

import type { GraphData } from "../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../testing/optional-pro";
await withPro("editor/services/submission-health-rules.ts");
const { submissionSchema } = (await proModule("viewer/services/submission-schema-service.ts")) ?? {};
// Every guide here: PRO's list (open and PRO) where it is, the open list where not.
import { BUNDLED_GRAPHS as OPEN_GRAPHS } from "../../data/bundled-graphs";
const BUNDLED_GRAPHS: Array<[string, GraphData]> =
  ((await proModule("data/bundled-graphs.ts"))?.ALL_BUNDLED_GRAPHS as Array<[string, GraphData]> | undefined) ?? OPEN_GRAPHS;
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * A small guide that works: one question with two answers, each leading to its
 * own result. Every test breaks one thing in it.
 */
function heltGraf(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: "Är du folkbokförd i kommunen?",
          variableName: "folkbokford",
          options: [
            { id: "ja", label: "Ja", value: "ja" },
            { id: "nej", label: "Nej", value: "nej" },
          ],
        },
      },
      { id: "r1", type: "result", position: { x: 300, y: 0 }, data: { title: "Du kan ansöka" } },
      { id: "r2", type: "result", position: { x: 300, y: 200 }, data: { title: "Du kan inte ansöka" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
    ],
  };
}

function koder(graph: GraphData): string[] {
  return GuideHealthService.analyze(graph)
    .map((issue) => issue.code)
    .sort();
}

describe("en hel guide", () => {
  test("ger inga problem", () => {
    expect(GuideHealthService.analyze(heltGraf())).toEqual([]);
  });
});

describe("errors a resident walks into", () => {
  // The option is visible, selectable, and then it ends. The engine says "leder
  // inte vidare" — but only once someone has clicked.
  test("ett svarsalternativ utan koppling", () => {
    const graf = heltGraf();
    graf.connections = graf.connections.filter((c) => c.id !== "c2");

    const problem = GuideHealthService.analyze(graf);
    const deadEnd = problem.filter((issue) => issue.code === "dead-option");

    expect(deadEnd).toHaveLength(1);
    expect(deadEnd[0].severity).toBe("error");
    expect(deadEnd[0].nodeId).toBe("q1");
    expect(deadEnd[0].message).toContain("Nej");
  });

  // What happens when a variable name changes: the rule silently points at the
  // old one, the condition is never true, and the resident lands in the
  // otherwise branch.
  test("a rule reading a variable nobody sets", () => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "regel",
      type: "rule",
      position: { x: 600, y: 0 },
      data: {
        title: "Välj väg",
        cases: [
          {
            id: "fall",
            label: "Ja",
            match: "all",
            conditions: [
              { id: "v", variableName: "folkbokfordd", operator: "equals", value: "ja" },
            ],
          },
        ],
        fallbackLabel: "annars",
      },
    });

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unset-rule-variable",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].severity).toBe("error");
    expect(problem[0].message).toContain("folkbokfordd");
  });

  test("the receiver's row printing a variable nobody sets (story 092)", () => {
    const graf = heltGraf();
    graf.nodes[1] = { id: "r1", type: "submit-result", position: { x: 300, y: 0 },
      data: { title: "Tack", recipientIds: ["x"], row: [{ id: "t", label: "Titel", cell: "{{namn}}" }] } };

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unset-template-variable",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].nodeId).toBe("r1");
    expect(problem[0].message).toContain('"namn"');
  });

  test("a text printing a variable nobody sets", () => {
    const graf = heltGraf();
    graf.nodes[1].data.description = "Tack {{namn}}, vi hör av oss.";

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unset-template-variable",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].severity).toBe("error");
    expect(problem[0].nodeId).toBe("r1");
    expect(problem[0].message).toContain("namn");
  });

  test("braces written as text (the viewer's escape, 25/9) print no variable and raise nothing", () => {
    const graf = heltGraf();
    graf.nodes[1].data.description = "Skriv \\{{namn}} i fältet.";

    expect(
      GuideHealthService.analyze(graf).filter((issue) => issue.code === "unset-template-variable"),
    ).toEqual([]);
  });

  test("the warning names the field the text is in, so the list can lead there (story 136, criterion 14)", () => {
    const graf = heltGraf();
    graf.nodes[1].data.description = "Tack, vi hör av oss.";
    graf.nodes[1].data.title = "Hej {{namn}}";

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unset-template-variable",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].field).toBe("title");
  });

  test("a variable that is actually set raises nothing", () => {
    const graf = heltGraf();
    graf.nodes[1].data.description = "Tack, du svarade {{folkbokford}}.";

    expect(koder(graf)).toEqual([]);
  });
});

describe("warnings about work nobody reaches", () => {
  // No resident can be hurt by something they never see. But in a guide with
  // thirty nodes you do not spot it yourself.
  test("a result with no path to it", () => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "r3",
      type: "result",
      position: { x: 600, y: 400 },
      data: { title: "Bortglömt" },
    });

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unreachable-result",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].severity).toBe("warning");
    expect(problem[0].nodeId).toBe("r3");
  });

  test("a question that is never asked", () => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "q2",
      type: "question",
      position: { x: 0, y: 400 },
      data: {
        title: "Ställs aldrig",
        variableName: "b",
        options: [{ id: "ja2", label: "Ja", value: "ja" }],
      },
    });
    graf.connections.push({
      id: "c3",
      from: { nodeId: "q2", portId: "ja2" },
      to: { nodeId: "r1", portId: "input" },
    });

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "unreachable-node",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].severity).toBe("warning");
    expect(problem[0].nodeId).toBe("q2");
  });

  // Notes are not part of the flow and never have a path to them.
  test("a note does not count as unreachable", () => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "note",
      type: "annotation",
      position: { x: 0, y: 600 },
      data: { title: "Kom ihåg" },
    });

    expect(koder(graf)).toEqual([]);
  });

  test("with no start node, no path is sought", () => {
    const graf = heltGraf();
    graf.startNodeId = null;

    expect(
      GuideHealthService.analyze(graf).filter((issue) =>
        issue.code.startsWith("unreachable"),
      ),
    ).toEqual([]);
  });
});

describe("a page without fields", () => {
  // The page shows its heading and a Continue button — an information page.
  // That may be deliberate, but it is also exactly what you get if you forgot
  // the fields.
  test("warns, but does not count as an error", () => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "sida",
      type: "page",
      position: { x: 900, y: 0 },
      data: { title: "Dina uppgifter" },
    });
    graf.connections.push({
      id: "c9",
      from: { nodeId: "q1", portId: "ja" },
      to: { nodeId: "sida", portId: "input" },
    });

    const problem = GuideHealthService.analyze(graf).filter(
      (issue) => issue.code === "empty-page",
    );

    expect(problem).toHaveLength(1);
    expect(problem[0].severity).toBe("warning");
    expect(problem[0].nodeId).toBe("sida");
  });

  test("a page with fields does not warn", () => {
    const graf = heltGraf();
    graf.nodes.push(
      {
        id: "sida",
        type: "page",
        position: { x: 900, y: 0 },
        data: { title: "Dina uppgifter" },
      },
      {
        id: "f1",
        type: "text-question",
        position: { x: 0, y: 0 },
        parentPageId: "sida",
        order: 0,
        data: { title: "Namn", variableName: "namn" },
      },
    );
    graf.connections.push({
      id: "c9",
      from: { nodeId: "q1", portId: "ja" },
      to: { nodeId: "sida", portId: "input" },
    });

    expect(
      GuideHealthService.analyze(graf).filter(
        (issue) => issue.code === "empty-page",
      ),
    ).toEqual([]);
  });
});

/*
 * En sida som upprepas (story 084) behöver ordet besökaren ser och namnet
 * reglerna läser. Saknas något av dem kan sidan inte visas som avsett — fel,
 * inte varning. En sida som inte upprepas berörs inte, hur tom den än är.
 */
describe("en sida som upprepas", () => {
  const medSida = (data: Record<string, unknown>): GraphData => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "sida",
      type: "page",
      position: { x: 900, y: 0 },
      data: { title: "Dina barn", ...data },
    });
    graf.connections.push({
      id: "c-sida",
      from: { nodeId: "q1", portId: "ja" },
      to: { nodeId: "sida", portId: "input" },
    });
    return graf;
  };
  const koder = (graf: GraphData) =>
    GuideHealthService.analyze(graf)
      .filter((issue) => issue.code.startsWith("repeat-"))
      .map((issue) => [issue.code, issue.severity, issue.nodeId]);

  test("utan ord och utan variabelnamn fälls den två gånger, som fel", () => {
    expect(koder(medSida({ repeats: true }))).toEqual([
      ["repeat-without-word", "error", "sida"],
      ["repeat-without-variable", "error", "sida"],
    ]);
  });

  test("ett översatt ord räknas som ord, ett blankt gör det inte", () => {
    expect(koder(medSida({ repeats: true, repeatWord: { sv: "barn" }, repeatVariable: "barn" }))).toEqual([]);
    expect(koder(medSida({ repeats: true, repeatWord: "  ", repeatVariable: "barn" }))).toEqual([
      ["repeat-without-word", "error", "sida"],
    ]);
  });

  test("en sida som inte upprepas berörs inte", () => {
    expect(koder(medSida({}))).toEqual([]);
    expect(koder(medSida({ repeats: false, repeatWord: "" }))).toEqual([]);
  });

  /*
   * Listan är satt av sidan, inte av någon fråga: {{barn}} i en text räknar
   * upp posterna (story 090 fällde det som "ingen fråga sätter").
   */
  test("listans namn i en text är satt, av sidan", () => {
    const graf = medSida({ repeats: true, repeatWord: "barn", repeatVariable: "barn" });
    graf.nodes[1].data.description = "Dina barn: {{barn}}";

    expect(
      GuideHealthService.analyze(graf).filter((issue) => issue.code === "unset-template-variable"),
    ).toEqual([]);
  });

  test("summan av ett talfält på sidan är satt, antalet och summan av ett textfält är det inte (story 091)", () => {
    const graf = medSida({ repeats: true, repeatWord: "barn", repeatVariable: "barn" });
    graf.nodes.push({ id: "f1", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "sida", order: 0, data: { title: "Ålder", variableName: "alder" } });
    graf.nodes[1].data.description = "{{barn.count}} barn, {{barn.alder.sum}} år tillsammans, {{barn.namn.sum}}";

    expect(
      GuideHealthService.analyze(graf)
        .filter((issue) => issue.code === "unset-template-variable")
        .map((issue) => issue.message),
    ).toEqual(['"Du kan ansöka": texten skriver ut "barn.namn.sum" som ingen fråga sätter.']);
  });
});

describe("varje problem pekar ut sin nod", () => {
  test("so the list can lead there", () => {
    const graf = heltGraf();
    graf.connections = [];

    const problem = GuideHealthService.analyze(graf);

    expect(problem.length).toBeGreaterThan(0);
    problem.forEach((issue) => {
      expect(graf.nodes.some((node) => node.id === issue.nodeId)).toBe(true);
    });
  });
});

/*
 * Mottagar-flaggorna (uppföljningen från story 050 + e-postresultatets
 * id-modell): en fritextadress ska pekas om till katalogen, och ett id som
 * städats ur katalogen går till värdens standardmottagare tills guiden
 * pekas om — båda är redaktörens att åtgärda, ingen besökare skadas.
 */
describe("mottagarna", () => {
  afterEach(() => unregisterSubmissionReceiver());

  const katalog = () =>
    registerSubmissionReceiver({
      recipients: () => [{ id: "gatukontoret", label: "Gatukontoret" }],
      submit: async () => ({ reference: "X-1" }),
    });

  function medNod(type: string, data: Record<string, unknown>): GraphData {
    const graf = heltGraf();

    graf.nodes.push({ id: "m", type, position: { x: 600, y: 0 }, data } as never);
    graf.connections.push({
      id: "cm",
      from: { nodeId: "q1", portId: "ja" },
      to: { nodeId: "m", portId: "input" },
    } as never);
    return graf;
  }

  test.runIf(PRO)("en fritextadress i ett e-postresultat flaggas för ompekning", () => {
    const graf = medNod("email-result", { title: "Underlag", to: "intern@example.se" });

    expect(koder(graf)).toContain("legacy-email-recipient");
  });

  test.runIf(PRO)("ett mottagar-id som städats ur katalogen flaggas — i båda nodtyperna", () => {
    katalog();

    expect(koder(medNod("submit-result", { title: "Tack", recipientId: "nedlagda-kontoret" })))
      .toContain("stale-recipient");
    expect(koder(medNod("email-result", { title: "Underlag", recipientId: "nedlagda-kontoret" })))
      .toContain("stale-recipient");
  });

  test.runIf(PRO)("ett id som finns i katalogen, besökarvalet och det ännu ovalda är alla tysta", () => {
    katalog();

    expect(koder(medNod("submit-result", { title: "Tack", recipientId: "gatukontoret" })))
      .not.toContain("stale-recipient");
    expect(koder(medNod("email-result", { title: "Underlag", recipientId: "@visitor" })))
      .not.toContain("stale-recipient");
    expect(koder(medNod("submit-result", { title: "Tack", recipientId: "" })))
      .not.toContain("stale-recipient");
  });

  test.runIf(PRO)("utan registrerad katalog fälls ingen dom om id:t", () => {
    expect(koder(medNod("submit-result", { title: "Tack", recipientId: "vadsomhelst" })))
      .not.toContain("stale-recipient");
  });

  /*
   * A blank recipientId is the guide's own fact — nothing to do with the
   * catalog. Flagged with and without one registered, and only for
   * submit-result: an email-result with no id is a legal legacy shape
   * (no email sent, or a free-text `to`).
   */
  describe("ingen mottagare vald", () => {
    test.runIf(PRO)("en inlämning utan recipientId flaggas, med och utan katalog", () => {
      expect(koder(medNod("submit-result", { title: "Tack" })))
        .toContain("no-recipient-chosen");

      katalog();
      expect(koder(medNod("submit-result", { title: "Tack", recipientId: "" })))
        .toContain("no-recipient-chosen");
    });

    test.runIf(PRO)("meddelandet pekar på nodens titel och standardmottagaren", () => {
      const problem = GuideHealthService.analyze(
        medNod("submit-result", { title: "Tack för din anmälan" })
      ).find((issue) => issue.code === "no-recipient-chosen");

      expect(problem?.severity).toBe("warning");
      expect(problem?.nodeId).toBe("m");
      expect(problem?.message).toContain("Tack för din anmälan");
      expect(problem?.message).toContain("standardmottagare");
    });

    test.runIf(PRO)("ett e-postresultat utan recipientId flaggas inte — tomt id är lagligt där", () => {
      expect(koder(medNod("email-result", { title: "Underlag" })))
        .not.toContain("no-recipient-chosen");
    });

    test.runIf(PRO)("en vald mottagare är tyst", () => {
      katalog();
      expect(koder(medNod("submit-result", { title: "Tack", recipientId: "gatukontoret" })))
        .not.toContain("no-recipient-chosen");
    });
  });

  /*
   * emailCopy promises the visitor a receipt at the address held in
   * emailVariable. A blank variable, or one no question ever sets, breaks
   * that promise silently — the visitor who asked for confirmation never
   * gets one.
   */
  describe("mejlkopia utan fungerande variabel", () => {
    test.runIf(PRO)("emailCopy påslagen men emailVariable tom", () => {
      const problem = GuideHealthService.analyze(
        medNod("submit-result", { title: "Tack", emailCopy: true, emailVariable: "" })
      ).find((issue) => issue.code === "broken-email-copy");

      expect(problem?.severity).toBe("warning");
      expect(problem?.nodeId).toBe("m");
    });

    test.runIf(PRO)("emailCopy påslagen men variabeln sätts av ingen fråga", () => {
      const problem = GuideHealthService.analyze(
        medNod("submit-result", { title: "Tack", emailCopy: true, emailVariable: "epost" })
      ).find((issue) => issue.code === "broken-email-copy");

      expect(problem?.message).toContain("epost");
    });

    test.runIf(PRO)("emailCopy påslagen och variabeln sätts av en fråga — tyst", () => {
      const graf = medNod("submit-result", {
        title: "Tack",
        emailCopy: true,
        emailVariable: "epost",
      });
      graf.nodes.push({
        id: "fraga-epost",
        type: "text-question",
        position: { x: 300, y: 300 },
        data: { title: "Din e-post", variableName: "epost" },
      });

      expect(koder(graf)).not.toContain("broken-email-copy");
    });

    test.runIf(PRO)("emailCopy avstängd — ingen dom fälls oavsett variabel", () => {
      expect(
        koder(medNod("submit-result", { title: "Tack", emailCopy: false, emailVariable: "" }))
      ).not.toContain("broken-email-copy");
    });
  });
});

/*
 * The review step is the visible declaration in the submission contract
 * (docs/INLAMNING-KONTRAKT.md): a submit-result reachable without any
 * review node anywhere in the graph nudges the editor toward adding one.
 * Deliberately coarse — existence anywhere is enough, no path analysis
 * between the two.
 */
describe("inlämning utan granskningssteg", () => {
  test.runIf(PRO)("en nådd inlämning utan review-nod flaggas", () => {
    const graf: GraphData = {
      startNodeId: "q1",
      nodes: [
        {
          id: "q1",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Vill du anmäla?",
            variableName: "svar",
            options: [{ id: "ja", label: "Ja", value: "ja" }],
          },
        },
        { id: "s1", type: "submit-result", position: { x: 300, y: 0 }, data: { title: "Tack" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "s1", portId: "input" } },
      ],
    };

    const problem = GuideHealthService.analyze(graf).find(
      (issue) => issue.code === "submit-without-review"
    );

    expect(problem?.severity).toBe("warning");
    expect(problem?.nodeId).toBe("s1");
  });

  test("en review-nod någonstans i grafen räcker — även utan koppling till inlämningen", () => {
    const graf: GraphData = {
      startNodeId: "q1",
      nodes: [
        {
          id: "q1",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Vill du anmäla?",
            variableName: "svar",
            options: [{ id: "ja", label: "Ja", value: "ja" }],
          },
        },
        { id: "s1", type: "submit-result", position: { x: 300, y: 0 }, data: { title: "Tack" } },
        { id: "granska", type: "review", position: { x: 600, y: 600 }, data: { title: "Granska" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "s1", portId: "input" } },
      ],
    };

    expect(
      GuideHealthService.analyze(graf).some((issue) => issue.code === "submit-without-review")
    ).toBe(false);
  });

  test("en inlämning som inte nås flaggas inte — den skadar ingen besökare", () => {
    const graf: GraphData = {
      startNodeId: "q1",
      nodes: [
        {
          id: "q1",
          type: "question",
          position: { x: 0, y: 0 },
          data: {
            title: "Vill du anmäla?",
            variableName: "svar",
            options: [{ id: "ja", label: "Ja", value: "ja" }],
          },
        },
        { id: "r1", type: "result", position: { x: 300, y: 0 }, data: { title: "Klart" } },
        { id: "s1", type: "submit-result", position: { x: 300, y: 300 }, data: { title: "Tack" } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
      ],
    };

    expect(
      GuideHealthService.analyze(graf).some((issue) => issue.code === "submit-without-review")
    ).toBe(false);
  });
});

/**
 * Story 087: a date bound that points at a variable — `min: "{{fran}}"`. Three
 * ways for it to point wrong, all errors: the visitor would either be stopped
 * by a rule nobody can read or never protected by one that reads nothing.
 */
describe("en datumgräns som pekar på en variabel", () => {
  const period = (
    fran: Record<string, unknown> | null,
    tillMin: string,
    order: "fran-first" | "till-first" = "fran-first",
  ): GraphData => {
    const graf = heltGraf();
    const franNode = fran && {
      id: "fran",
      type: "date-question",
      position: { x: 600, y: 0 },
      data: { title: "Från", variableName: "fran", ...fran },
    };
    const tillNode = {
      id: "till",
      type: "date-question",
      position: { x: 900, y: 0 },
      data: { title: "Till", variableName: "till", min: tillMin },
    };
    const steps = (order === "fran-first" ? [franNode, tillNode] : [tillNode, franNode]).filter(
      (node): node is NonNullable<typeof node> => node !== null,
    );
    const [first, second] = steps;

    graf.nodes.push(...steps);
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    graf.connections.push(
      { id: "c-in", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: first.id, portId: "input" } },
      ...(second
        ? [
            { id: "c-mid", from: { nodeId: first.id, portId: "continue" }, to: { nodeId: second.id, portId: "input" } },
            { id: "c-out", from: { nodeId: second.id, portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
          ]
        : [{ id: "c-out", from: { nodeId: first.id, portId: "continue" }, to: { nodeId: "r1", portId: "input" } }]),
    );
    return graf;
  };
  const gränser = (graf: GraphData) =>
    GuideHealthService.analyze(graf)
      .filter((issue) => issue.code.startsWith("date-bound") || issue.code === "unset-template-variable")
      .map((issue) => [issue.code, issue.severity, issue.nodeId, issue.message]);

  test("från före till, båda datum: inget att anmärka", () => {
    expect(gränser(period({}, "{{fran}}"))).toEqual([]);
    expect(gränser(period({}, "2026-01-01"))).toEqual([]);
    // Story 086: the engine's day is a bound no question sets.
    expect(gränser(period({}, "{{idag}}"))).toEqual([]);
  });

  test("en variabel ingen fråga sätter — en gång, inte också som malltext", () => {
    expect(gränser(period(null, "{{fran}}"))).toEqual([
      ["date-bound-unset", "error", "till", '"Till": tidigast pekar på variabeln "fran" som ingen fråga sätter.'],
    ]);
  });

  test("en variabel som inte är ett datum", () => {
    const graf = period({}, "{{fran}}");
    graf.nodes.find((node) => node.id === "fran")!.type = "text-question";

    expect(gränser(graf)).toEqual([
      ["date-bound-not-date", "error", "till", '"Till": tidigast pekar på "Från" som inte är en datumfråga.'],
    ]);
  });

  test("en variabel som frågas efter fältet", () => {
    expect(gränser(period({}, "{{fran}}", "till-first"))).toEqual([
      ["date-bound-after", "error", "till", '"Till": tidigast pekar på "Från" som frågas efter det här fältet.'],
    ]);
  });

  test("på samma sida är ordningen fri", () => {
    const graf = heltGraf();
    graf.nodes.push(
      { id: "sida", type: "page", position: { x: 600, y: 0 }, data: { title: "Period" } },
      { id: "till", type: "date-question", parentPageId: "sida", order: 0, position: { x: 0, y: 0 }, data: { title: "Till", variableName: "till", min: "{{fran}}" } },
      { id: "fran", type: "date-question", parentPageId: "sida", order: 1, position: { x: 0, y: 0 }, data: { title: "Från", variableName: "fran" } },
    );
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    graf.connections.push(
      { id: "c-in", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "sida", portId: "input" } },
      { id: "c-out", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
    );

    expect(gränser(graf)).toEqual([]);
  });
});

describe("datum i uträkningen (story 086)", () => {
  /*
   * `age` och `days` tar en variabel som bär ett datum: en datumfråga, ett
   * personnummer, eller `idag`. Allt annat fälls här — före någon besökare
   * får ett fel i stället för ett tal.
   */
  const rakning = (formula: string, source: { type: string; format?: string } | null) => {
    const graf = heltGraf();
    graf.nodes.push(
      ...(source
        ? [{ id: "src", type: source.type, position: { x: 0, y: 0 }, data: { title: "Källan", variableName: "pnr", format: source.format } }]
        : []),
      { id: "calc", type: "calculation", position: { x: 0, y: 0 }, data: { title: "Uträkning", assignments: [{ id: "a", variableName: "x", formula }] } },
    );
    return GuideHealthService.analyze(graf)
      .filter((issue) => issue.code.startsWith("date-argument"))
      .map((issue) => [issue.code, issue.severity, issue.nodeId, issue.message]);
  };

  test("ett datum, ett personnummer eller idag: inget att anmärka", () => {
    expect(rakning("age(pnr)", { type: "date-question" })).toEqual([]);
    expect(rakning("age(pnr)", { type: "text-question", format: "personnummer" })).toEqual([]);
    expect(rakning("days(pnr; idag)", { type: "date-question" })).toEqual([]);
    expect(rakning("round(pnr)", { type: "number-question" })).toEqual([]);
  });

  test("en variabel som varken är datum eller personnummer", () => {
    expect(rakning("age(pnr)", { type: "text-question" })).toEqual([
      ["date-argument-not-date", "error", "calc", '"Uträkning": age(pnr) — "Källan" är varken en datumfråga eller ett personnummer.'],
    ]);
    expect(rakning("days(pnr; idag)", { type: "number-question" })).toEqual([
      ["date-argument-not-date", "error", "calc", '"Uträkning": days(pnr) — "Källan" är varken en datumfråga eller ett personnummer.'],
    ]);
  });

  test("en variabel ingen fråga sätter", () => {
    expect(rakning("age(pnr)", null)).toEqual([
      ["date-argument-unset", "error", "calc", '"Uträkning": age(pnr) — ingen fråga sätter "pnr".'],
    ]);
  });
});

describe("inlämningens schema är äldre än guiden (story 094)", () => {
  const guide = (variableName: string, meta?: GraphData["meta"]): GraphData => ({
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 0, y: 0 }, data: { title: "Namn", variableName, required: true } },
      { id: "r", type: "review", position: { x: 150, y: 0 }, data: { title: "Granska" } },
      { id: "s1", type: "submit-result", position: { x: 300, y: 0 }, data: { title: "Tack", recipientIds: ["x"] } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      { id: "c2", from: { nodeId: "r", portId: "continue" }, to: { nodeId: "s1", portId: "input" } },
    ],
    ...(meta ? { meta } : {}),
  });

  test.runIf(PRO)("ett bytt variabelnamn efter exporten flaggas på inlämningen", () => {
    const exported = submissionSchema(guide("namn"));
    const problem = GuideHealthService.analyze(guide("fornamn", { submissionSchema: exported })).find(
      (issue) => issue.code === "stale-submission-schema"
    );

    expect(problem?.severity).toBe("warning");
    expect(problem?.nodeId).toBe("s1");
    expect(problem?.message).toContain("inlämningens schema är äldre än guiden");
  });

  test.runIf(PRO)("ett schema som stämmer, eller inget schema alls, är tyst", () => {
    const exported = submissionSchema(guide("namn"));

    expect(koder(guide("namn", { submissionSchema: exported }))).not.toContain("stale-submission-schema");
    expect(koder(guide("namn"))).not.toContain("stale-submission-schema");
  });
});

/*
 * Story 095: the page that counts while the visitor answers. Two things the
 * editor cannot see on the canvas — a calculation in the page reading a
 * variable the guide asks for later, and a slider that has no span or walks
 * one krona at a time over hundreds of thousands.
 */
describe("uträkningen i sidan och reglaget (story 095)", () => {
  const sida = (
    amount: Record<string, unknown>,
    formula = "lan * 2",
    after: Record<string, unknown> | null = null,
  ): GraphData => {
    const graf = heltGraf();
    graf.nodes.push(
      { id: "sida", type: "page", position: { x: 600, y: 0 }, data: { title: "Låna" } },
      { id: "lan", type: "number-question", parentPageId: "sida", order: 0, position: { x: 0, y: 0 }, data: { title: "Lånesumma", variableName: "lan", ...amount } },
      { id: "calc", type: "calculation", parentPageId: "sida", order: 1, position: { x: 0, y: 0 }, data: { title: "Räkna", assignments: [
        { id: "a0", variableName: "r", formula: "0.06 / 12" },
        { id: "a1", variableName: "kostnad", formula },
      ] } },
    );
    if (after) {
      graf.nodes.push({ id: "sen", type: "number-question", position: { x: 900, y: 0 }, data: { title: "Lånetid", variableName: "ar", ...after } });
    }
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    graf.connections.push(
      { id: "c-in", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "sida", portId: "input" } },
      ...(after
        ? [
            { id: "c-mid", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "sen", portId: "input" } },
            { id: "c-out", from: { nodeId: "sen", portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
          ]
        : [{ id: "c-out", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "r1", portId: "input" } }]),
    );
    return graf;
  };
  const fynd = (graf: GraphData) =>
    GuideHealthService.analyze(graf)
      .filter((issue) => issue.code.startsWith("slider") || issue.code === "calculation-reads-later")
      .map((issue) => [issue.code, issue.severity, issue.nodeId, issue.message]);

  test("ett reglage med spann och steg, och en uträkning som läser sidans egna fält: inget att anmärka", () => {
    expect(fynd(sida({ presentation: "range", min: 10000, max: 800000, step: 5000 }, "lan * r"))).toEqual([]);
  });

  test("uträkningen läser en variabel som frågas efter sidan", () => {
    expect(fynd(sida({ min: 0, max: 10 }, "lan * ar", { min: 1, max: 15 }))).toEqual([
      ["calculation-reads-later", "error", "calc", '"Räkna": uträkningen läser "ar" som frågas efter sidan — då räknas den inte om medan besökaren svarar.'],
    ]);
  });

  test("en variabel som frågas före sidan är i sin ordning", () => {
    const graf = sida({ min: 0, max: 10 }, "lan * 2 + antal");
    graf.nodes.find((node) => node.id === "q1")!.data.variableName = "antal";

    expect(fynd(graf)).toEqual([]);
  });

  test("ett reglage utan spann", () => {
    expect(fynd(sida({ presentation: "range" }))).toEqual([
      ["slider-without-range", "warning", "lan", '"Lånesumma": reglaget har inget spann — sätt lägsta och högsta värde.'],
    ]);
    expect(fynd(sida({ presentation: "range", min: 0 }))).toHaveLength(1);
  });

  test("ett reglage med för många lägen", () => {
    expect(fynd(sida({ presentation: "range", min: 10000, max: 800000 }))).toEqual([
      ["slider-too-fine", "warning", "lan", '"Lånesumma": reglaget har 790\u00a0000 lägen mellan 10\u00a0000 och 800\u00a0000 — sätt ett större steg.'],
    ]);
    // A step that is set but still leaves a krona a pixel is the same fault.
    expect(fynd(sida({ presentation: "range", min: 0, max: 1000000, step: 5 }))).toHaveLength(1);
    /*
     * The panel's defaults are 0–120 with step 1. Judging "step 1 over more
     * than a hundred" warned the moment an editor chose the slider on a fresh
     * field — a warning for having done nothing yet. Positions are what the
     * thumb walks, so that is what is measured; a thousand is the line.
     */
    expect(fynd(sida({ presentation: "range", min: 0, max: 120 }))).toEqual([]);
    expect(fynd(sida({ presentation: "range", min: 0, max: 1000 }))).toEqual([]);
    expect(fynd(sida({ presentation: "range", min: 0, max: 1001 }))).toHaveLength(1);
    // The stepper walks one at a time by design; only the slider is judged.
    expect(fynd(sida({ presentation: "stepper", min: 10000, max: 800000 }))).toEqual([]);
  });
});

describe("en koppling bakåt (6/9)", () => {
  /*
   * Johan: "Kan man loopa runt en fråga i dagsläget? Det skulle ju innebära
   * att det pågår i evigheter." Measured before the rule: the engine only
   * stops cycles among the automatic nodes (rule → rule); through a question
   * it shows the question again, for ever, and the health said nothing.
   */
  function slinga(): GraphData {
    const graf = heltGraf();
    graf.nodes.push({
      id: "regel", type: "rule", position: { x: 150, y: 0 },
      data: { title: "Kontroll", cases: [{ id: "ok", label: "Om ja", match: "all", conditions: [{ id: "c", variableName: "folkbokford", operator: "equals", value: "ja" }] }], fallbackLabel: "Annars" },
    });
    graf.connections = [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "regel", portId: "input" } },
      { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
      { id: "c3", from: { nodeId: "regel", portId: "ok" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c4", from: { nodeId: "regel", portId: "default" }, to: { nodeId: "q1", portId: "input" } },
    ];
    return graf;
  }

  test("tillbaka till en fråga som redan är ställd varnar", () => {
    expect(GuideHealthService.analyze(slinga())).toEqual([
      {
        code: "flow-loop",
        severity: "warning",
        nodeId: "regel",
        message: '"Kontroll" leder tillbaka till "Är du folkbokförd i kommunen?", som redan är ställd — besökaren kan gå runt utan att komma vidare.',
      },
    ]);
  });

  test("en fråga som leder till sig själv varnar också", () => {
    const graf = heltGraf();
    graf.connections[0] = { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "q1", portId: "input" } };

    expect(koder(graf)).toEqual(["flow-loop", "unreachable-result"]);
  });

  test("en tvärkoppling mellan två grenar är ingen slinga", () => {
    // Ja → r1, Nej → r2 → r1: r1 nås först via Ja, men Nej-vägens koppling
    // dit går framåt ändå. Ordningen från starten skulle ha kallat det slinga.
    const graf = heltGraf();
    graf.nodes[2] = { id: "r2", type: "question", position: { x: 300, y: 200 }, data: { title: "Bor du i Sverige?", variableName: "sverige", options: [{ id: "ja", label: "Ja", value: "ja" }] } };
    graf.connections.push({ id: "c3", from: { nodeId: "r2", portId: "ja" }, to: { nodeId: "r1", portId: "input" } });

    expect(koder(graf)).toEqual([]);
  });

  test("men två vägar som möts framåt är ingen slinga", () => {
    // Ja och Nej går båda till samma resultat — vanligt, och inte bakåt.
    const graf = heltGraf();
    graf.connections[1] = { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r1", portId: "input" } };
    graf.nodes.pop();

    expect(koder(graf)).toEqual([]);
  });
});

describe("en text som visas som ruta (story 096)", () => {
  const sida = (text: Record<string, unknown>): GraphData => {
    const graf = heltGraf();
    graf.nodes.push(
      { id: "sida", type: "page", position: { x: 600, y: 0 }, data: { title: "Låna" } },
      { id: "lan", type: "number-question", parentPageId: "sida", order: 0, position: { x: 0, y: 0 }, data: { title: "Lånesumma", variableName: "lan" } },
      { id: "ruta", type: "page-heading", parentPageId: "sida", order: 1, position: { x: 0, y: 0 }, data: text },
    );
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    graf.connections.push(
      { id: "c-in", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "sida", portId: "input" } },
      { id: "c-out", from: { nodeId: "sida", portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
    );
    return graf;
  };
  const fynd = (graf: GraphData) =>
    GuideHealthService.analyze(graf)
      .filter((issue) => issue.code === "empty-callout")
      .map((issue) => [issue.code, issue.severity, issue.nodeId, issue.message]);

  test("en ruta utan rubrik och utan text är en tom ram", () => {
    expect(fynd(sida({ presentation: "warning", title: "", description: "" }))).toEqual([
      ["empty-callout", "warning", "ruta", '"ruta": rutan är tom — skriv en rubrik eller en text, eller visa den som text.'],
    ]);
    expect(fynd(sida({ presentation: "info", title: { sv: " " } }))).toHaveLength(1);
  });

  test("en ruta med bara rubrik, eller bara text, duger", () => {
    expect(fynd(sida({ presentation: "warning", title: "Att låna kostar pengar" }))).toEqual([]);
    expect(fynd(sida({ presentation: "tip", title: "", description: { sv: "Ta fram ditt personnummer." } }))).toEqual([]);
  });

  test("en vanlig tom text är ingen ruta och anmärks inte här", () => {
    expect(fynd(sida({ title: "", description: "" }))).toEqual([]);
  });
});

/*
 * Story 108: ett exempelfoto utan alt-text.
 *
 * Adressen ensam är en halv bild: provet ritar den, besökaren kan bifoga den,
 * och den som inte ser den får ingenting. Samma form som sidan som upprepas
 * utan ord för vad som upprepas — inställningen gjord, halvan som gör den
 * användbar inte — så det är ett fel och inte en varning.
 */
describe("ett exempelfoto på en filfråga (story 108)", () => {
  const medFoto = (data: Record<string, unknown>): GraphData => {
    const graf = heltGraf();
    graf.nodes.push({
      id: "foto",
      type: "file-question",
      position: { x: 600, y: 0 },
      data: { title: "Har du bilder på skadan?", variableName: "bilder", ...data },
    });
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    graf.connections.push(
      { id: "c-in", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "foto", portId: "input" } },
      { id: "c-ut", from: { nodeId: "foto", portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
    );
    return graf;
  };
  const fynd = (graf: GraphData) =>
    GuideHealthService.analyze(graf)
      .filter((issue) => issue.code === "example-image-without-alt")
      .map((issue) => [issue.code, issue.severity, issue.nodeId, issue.message]);

  test("utan alt-text säger hälsan till, och pekar ut noden", () => {
    expect(fynd(medFoto({ exampleImage: "/exempel/testbil-fyra-vyer.jpg" }))).toEqual([
      [
        "example-image-without-alt",
        "error",
        "foto",
        '"Har du bilder på skadan?": exempelfotot saknar alt-text — skriv vad bilden visar.',
      ],
    ]);
    // Ett mellanslag är ingen beskrivning.
    expect(fynd(medFoto({ exampleImage: "/exempel/testbil.jpg", exampleImageAlt: { sv: " " } }))).toHaveLength(1);
  });

  test("med alt-text är det ingenting", () => {
    expect(
      fynd(medFoto({ exampleImage: "/exempel/testbil.jpg", exampleImageAlt: { sv: "En bil med en buckla." } })),
    ).toEqual([]);
  });

  test("en filfråga utan exempelfoto behöver ingen alt-text", () => {
    expect(fynd(medFoto({}))).toEqual([]);
    expect(fynd(medFoto({ exampleImage: "   " }))).toEqual([]);
  });
});

/*
 * The case that was really written, not a mutation invented to have one.
 *
 * On 14/9 the conference guide's rule was given a label as `{ sv, en }` — the
 * shape every other piece of text in a graph has. `RuleCasesService` requires a
 * string and drops anything else, so the rule kept **zero** cases and sent every
 * visitor down the fallback, with `kvar` holding the right number the whole
 * time. Nothing on screen looked wrong.
 *
 * It is PRAXIS 5's most expensive line, walked into by hand by somebody who had
 * read the rule the day before — which says the shape is easy to get wrong, not
 * that the person was careless. This is what tells the editor instead.
 */
describe("ett regelfall som visaren inte kan använda", () => {
  const ruleGraph = (label: unknown): GraphData =>
    ({
      startNodeId: "fraga",
      nodes: [
        {
          id: "fraga",
          type: "number-question",
          position: { x: 0, y: 0 },
          data: { title: "Hur många?", variableName: "antal" },
        },
        {
          id: "regel",
          type: "rule",
          position: { x: 300, y: 0 },
          data: {
            title: "Finns det plats?",
            cases: [
              {
                id: "det-finns-plats",
                label,
                match: "all",
                conditions: [
                  { id: "c", variableName: "antal", operator: "greater-than-or-equal", value: "0" },
                ],
              },
            ],
            fallbackLabel: "Väntelista",
          },
        },
      ],
      connections: [
        { id: "c1", from: { nodeId: "fraga", portId: "continue" }, to: { nodeId: "regel", portId: "input" } },
      ],
    }) as never;

  test("säger till, och säger vad det betyder för besökaren", () => {
    const issues = GuideHealthService.analyze(ruleGraph({ sv: "Det finns plats", en: "There is room" }));
    const issue = issues.find((one) => one.code === "ignored-rule-case");

    expect(issue, "inget besked om det bortkastade regelfallet").toBeTruthy();
    expect(issue!.severity).toBe("error");
    expect(issue!.nodeId).toBe("regel");
    // Namnet på fallet, så redaktören vet vilket — och följden, inte formen.
    expect(issue!.message).toContain("det-finns-plats");
    expect(issue!.message).toContain("varje besökare skickas vidare på reservvägen");
  });

  test("tiger när fallet går att använda", () => {
    const issues = GuideHealthService.analyze(ruleGraph("Det finns plats"));

    expect(issues.filter((one) => one.code === "ignored-rule-case")).toEqual([]);
  });
});

describe("samma variabelnamn på samma väg (24/9)", () => {
  /*
   * Two nodes saving under one name is not a fault in itself — the same
   * question on two branches that exclude each other is how a guide is built.
   * It is one when both can be answered in the same visit: the later answer
   * overwrites the earlier, and the rule reading the name gets the wrong one.
   */
  const fraga = (id: string, title: string, variableName: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: "number-question",
    position: { x: 0, y: 0 },
    data: { title, variableName },
    ...extra,
  });
  const koppling = (from: string, to: string, portId = "continue") => ({
    id: `${from}-${to}`,
    from: { nodeId: from, portId },
    to: { nodeId: to, portId: "input" },
  });
  /** q1 → (ja) the given chain → r1. The nej branch still goes to r2. */
  const kedja = (...nodes: ReturnType<typeof fraga>[]): GraphData => {
    const graf = heltGraf();
    graf.nodes.push(...(nodes as GraphData["nodes"]));
    graf.connections = graf.connections.filter((c) => c.id !== "c1");
    const steps = ["q1", ...nodes.filter((node) => !("parentPageId" in node)).map((node) => node.id), "r1"];
    steps.slice(1).forEach((to, index) => {
      graf.connections.push(koppling(steps[index], to, index === 0 ? "ja" : "continue"));
    });
    return graf;
  };
  const krockar = (graf: GraphData) =>
    GuideHealthService.analyze(graf).filter((issue) => issue.code === "variable-name-clash");

  // 1
  test("samma namn på grenar som utesluter varandra: ingen flagga", () => {
    const graf = heltGraf();
    graf.nodes.push(fraga("hyr", "Har du barn?", "harBarn") as never, fraga("ager", "Har du barn?", "harBarn") as never);
    graf.connections = [
      koppling("q1", "hyr", "ja"),
      koppling("hyr", "r1"),
      koppling("q1", "ager", "nej"),
      koppling("ager", "r2"),
    ];

    expect(koder(graf), "grafen ska vara hel utöver krocken").toEqual([]);
    expect(krockar(graf)).toEqual([]);
  });

  // 2
  test("samma namn på samma väg: en flagga, på den senare, som leder till fältet", () => {
    const graf = kedja(fraga("a", "Har du barn?", "barn"), fraga("b", "Hur många barn har du?", "barn"));

    expect(krockar(graf)).toEqual([{
      code: "variable-name-clash",
      severity: "warning",
      nodeId: "b",
      field: "variableName",
      message: '"Hur många barn har du?": sparar svaret som "barn", som "Har du barn?" tidigare på samma väg också sparar — det senare svaret skriver över det förra. Ge en av dem ett annat namn.',
    }]);
  });

  test("A når B på flera vägar: fortfarande en flagga", () => {
    const graf = kedja(fraga("a", "Har du barn?", "barn"), fraga("b", "Hur många barn har du?", "barn"));
    graf.nodes.push(fraga("x", "Mellan", "x") as never, fraga("y", "Mellan", "y") as never);
    graf.connections.push(koppling("a", "x"), koppling("x", "b"), koppling("a", "y"), koppling("y", "b"));

    expect(krockar(graf).map((issue) => issue.nodeId)).toEqual(["b"]);
  });

  // 3
  test("tre på samma väg: två flaggor, var och en mot den närmast före", () => {
    const graf = kedja(
      fraga("a", "Första", "barn"),
      fraga("b", "Andra", "barn"),
      fraga("c", "Tredje", "barn"),
    );
    const found = krockar(graf);

    expect(found.map((issue) => issue.nodeId).sort()).toEqual(["b", "c"]);
    expect(found.find((issue) => issue.nodeId === "c")!.message).toContain('som "Andra" tidigare');
  });

  // 4
  test("två fält på samma sida: en flagga, på fältet som kommer sist", () => {
    const graf = kedja(
      fraga("sida", "Om dig", "") as never,
      // Listed first but ordered second: the order on the page is what counts.
      fraga("f2", "Ditt namn igen", "namn", { parentPageId: "sida", order: 1 }),
      fraga("f1", "Ditt namn", "namn", { parentPageId: "sida", order: 0 }),
    );
    graf.nodes.find((node) => node.id === "sida")!.type = "page";
    delete graf.nodes.find((node) => node.id === "sida")!.data.variableName;

    const found = krockar(graf);
    expect(found.map((issue) => [issue.nodeId, issue.field])).toEqual([["f2", "variableName"]]);
    expect(found[0].message).toContain('som "Ditt namn" tidigare');
  });

  // 5
  test("ett fält på en sida och en fråga senare på vägen: en flagga", () => {
    const graf = kedja(
      fraga("sida", "Om dig", "") as never,
      fraga("f1", "Ditt namn", "namn", { parentPageId: "sida", order: 0 }),
      fraga("sen", "Vad heter du?", "namn"),
    );
    graf.nodes.find((node) => node.id === "sida")!.type = "page";
    delete graf.nodes.find((node) => node.id === "sida")!.data.variableName;

    expect(krockar(graf).map((issue) => issue.nodeId)).toEqual(["sen"]);
  });

  // 6
  test("olika namn, eller tomma, på samma väg: ingen flagga", () => {
    expect(krockar(kedja(fraga("a", "Har du barn?", "harBarn"), fraga("b", "Hur många?", "antalBarn")))).toEqual([]);
    expect(krockar(kedja(fraga("a", "Har du barn?", ""), fraga("b", "Hur många?", "")))).toEqual([]);
    expect(krockar(kedja(fraga("a", "Har du barn?", "  "), fraga("b", "Hur många?", " ")))).toEqual([]);
    // The measurement above can go red: the same chain with one name shared does.
    expect(krockar(kedja(fraga("a", "Har du barn?", "barn"), fraga("b", "Hur många?", " barn ")))).toHaveLength(1);
  });

  // 7 — the definition's gate. A false positive here is a fault in the
  // definition, not in the guide: the bundled guides are built right.
  test.each(BUNDLED_GRAPHS)("exempelguiden %s har ingen krock", (_name, graph) => {
    expect(krockar(graph).map((issue) => `${issue.nodeId}: ${issue.message}`)).toEqual([]);
  });
});

describe("GuideHealthService.variablesSetBefore (Johan 25/9)", () => {
  const question = (id: string, variableName: string) => ({ id, type: "text-question", position: { x: 0, y: 0 }, data: { title: id, variableName } });
  const link = (from: string, to: string) => ({ id: `${from}-${to}`, from: { nodeId: from, portId: "continue" }, to: { nodeId: to, portId: "input" } });
  // start → a (sets x) → end, start → b (sets y) → end
  const graph = {
    startNodeId: "start",
    nodes: [question("start", "s"), question("a", "x"), question("b", "y"), question("end", "z")],
    connections: [link("start", "a"), link("start", "b"), link("a", "end"), link("b", "end")],
  } as unknown as GraphData;
  const at = (id: string) => [...GuideHealthService.variablesSetBefore(graph, graph.nodes.find((node) => node.id === id)!)].sort();

  test("an answer set on some path there counts; one on another branch or later does not", () => {
    expect(at("end")).toEqual(["idag", "s", "x", "y"]);
    expect(at("a")).toEqual(["idag", "s"]);
    expect(at("start")).toEqual(["idag"]);
  });
});

/*
 * Ett svarsalternativ utan text (Johan 28/9: "Då varnar vi för det").
 * Besökaren ser en rad utan ord att välja. En varning och inte ett fel:
 * alternativet går att välja och leder vidare. Numret är platsen i listan,
 * räknat från 1, så redaktören hittar raden i panelen.
 */
describe("ett svarsalternativ utan text (28/9)", () => {
  const medTomtAlternativ = (label: unknown): GraphData => {
    const graph = heltGraf();
    graph.nodes[0].data.options = [
      { id: "ja", label: "Ja", value: "ja" },
      { id: "nej", label, value: "nej" },
    ];
    return graph;
  };

  test("varnar med platsen i listan, på frågans nod", () => {
    const issues = GuideHealthService.analyze(medTomtAlternativ("  "));

    expect(issues).toEqual([
      {
        code: "option-without-text",
        severity: "warning",
        nodeId: "q1",
        message: '"Är du folkbokförd i kommunen?": svarsalternativ 2 saknar text.',
      },
    ]);
  });

  test("säger det på editorns språk", () => {
    const [issue] = GuideHealthService.analyze(medTomtAlternativ(""), { locale: "en" });

    expect(issue.message).toBe('"Är du folkbokförd i kommunen?": answer option 2 has no text.');
  });

  test("en etikett på något av guidens språk räcker, för visaren faller tillbaka på den", () => {
    expect(koder(medTomtAlternativ({ sv: "", en: "No" }))).toEqual([]);
  });

  test("tiger om alternativet som skrivs just nu", () => {
    expect(GuideHealthService.analyze(medTomtAlternativ(""), { writingOptionId: "nej" })).toEqual([]);
    expect(koder(medTomtAlternativ(""))).toEqual(["option-without-text"]);
  });
});

/*
 * En uträkning på en sida som läser ett fält som är tomt vid ankomst
 * (berättelse 118). Texten gick förbi ordlistan och stod på svenska även i
 * en engelsk editor (filmen "Räkna medan man svarar", 30/9).
 */
describe("en uträkning som läser ett tomt fält", () => {
  const sida = (): GraphData => ({
    startNodeId: "p",
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: "Avgift" } },
      { id: "f", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "p", order: 0, data: { title: "Inkomst", variableName: "inkomst" } },
      { id: "c", type: "calculation", position: { x: 0, y: 0 }, parentPageId: "p", order: 1, data: {
        title: "Avgift",
        assignments: [{ id: "a", variableName: "avgift", formula: "inkomst * 0.03" }],
      } },
    ],
    connections: [],
  } as unknown as GraphData);
  const varningen = (locale?: string) =>
    GuideHealthService.analyze(sida(), locale ? { locale } : {}).find((issue) => issue.code === "calculation-reads-empty");

  test("säger vad besökaren ser, på svenska som standard", () => {
    expect(varningen()).toEqual({
      code: "calculation-reads-empty",
      severity: "warning",
      nodeId: "c",
      message: '"Avgift": läser "inkomst", som är tom när besökaren kommer fram — rutan visar streck tills hen svarat. Ge fältet ett startvärde.',
    });
  });

  test("säger det på editorns språk", () => {
    expect(varningen("en")?.message).toBe(
      '"Avgift": reads "inkomst", which is empty when the visitor arrives — the box shows a dash until they answer. Give the field a start value.',
    );
  });
});

/*
 * The extension point (open-core step 3c): the full version's rules — the
 * recipient checks, the review nudge, the stale schema — register themselves
 * here instead of living in this file, so the open health check never imports
 * the receiver registry.
 */
describe("registered rules", () => {
  const graf: GraphData = { startNodeId: null, nodes: [], connections: [] };

  afterEach(() => GuideHealthService.unregisterRule("probe"));

  test("a registered rule's issues come out of analyze, and stop when it is unregistered", () => {
    GuideHealthService.registerRule("probe", (graph) => [
      { code: "unreachable-node", severity: "warning", nodeId: `probe-${graph.nodes.length}`, message: "probe" },
    ]);
    expect(GuideHealthService.analyze(graf).map((issue) => issue.nodeId)).toContain("probe-0");

    GuideHealthService.unregisterRule("probe");
    expect(GuideHealthService.analyze(graf)).toEqual([]);
  });

  test("registering the same id again replaces the rule rather than doubling it", () => {
    const issue = { code: "unreachable-node", severity: "warning", nodeId: "p", message: "probe" } as const;
    GuideHealthService.registerRule("probe", () => [issue]);
    GuideHealthService.registerRule("probe", () => [issue]);
    expect(GuideHealthService.analyze(graf)).toHaveLength(1);
  });
});

import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { PageFieldsService } from "../viewer/services/page-fields-service";
import { PageRepeatService } from "../viewer/services/page-repeat-service";
import { GuideTraversalEngine } from "../viewer/core/guide-traversal-engine";
import { GuideHealthService } from "../editor/services/guide-health-service";
import { reachableViewerKeys } from "../editor/services/reachable-viewer-keys";

import { uniqueAcrossRepeatsGraph } from "./unique-across-repeats-graph";

import type { GraphData } from "../viewer/types/graph";

/**
 * Berättelse 138 — *Varje upprepning ska välja olika*, utan webbläsare: vad
 * tjänsterna erbjuder en post, hälsokontrollen och nåbarhetsräkningen.
 * Besökarens halva står i `unique-across-repeats.browser.test.ts`.
 */

const graph = (): GraphData => structuredClone(uniqueAcrossRepeatsGraph);
const pageOf = (source: GraphData) => source.nodes.find((node) => node.id === "unique-page")!;
const field = (source: GraphData, records: Record<string, string>[], index: number, variable: string) =>
  PageFieldsService.getFields(
    source,
    pageOf(source),
    PageRepeatService.recordAnswers({}, "bokningar", records, index),
    "sv",
  ).find((candidate) => candidate.variableName === variable)!;
const values = (options: { value: string }[]) => options.map((option) => option.value);

describe("varje upprepning ska välja olika (berättelse 138)", () => {
  const records = [{ tid: "0930", namn: "Alva", lunch: "ja" }, { tid: "", namn: "", lunch: "" }];

  test("kriterium 2: post 1 ser allt, post 2 ser inte det post 1 valt — och raden sägs", () => {
    expect(values(field(graph(), records, 0, "tid").options)).toEqual(["0930", "1100", "1400"]);
    expect(field(graph(), records, 0, "tid").optionsHidden).toBeUndefined();

    const second = field(graph(), records, 1, "tid");
    expect(values(second.options)).toEqual(["1100", "1400"]);
    // Inställningen dolde något: dess egen rad, inte villkorens (Astra 29/9).
    expect(second.optionsTaken).toBe(true);
    expect(second.optionsHidden).toBeUndefined();
    expect(field(graph(), records, 0, "tid").optionsTaken).toBeUndefined();
  });

  test("hjälpraden: villkoret och inställningen sägs var för sig", () => {
    const both = graph();
    const afternoon = (both.nodes.find((node) => node.id === "unique-time")!.data.options as { value: string; visibility?: unknown }[])
      .find((option) => option.value === "1400")!;
    afternoon.visibility = {
      match: "all",
      conditions: [{ id: "unique-afternoon-lunch", variableName: "lunch", operator: "equals", value: "ja" }],
    };

    const second = field(both, records, 1, "tid");
    expect(values(second.options)).toEqual(["1100"]);
    expect([second.optionsHidden, second.optionsTaken]).toEqual([true, true]);
  });

  test("kriterium 4: döljningen är symmetrisk — post 1 ser inte det post 2 valt, det egna valet syns alltid", () => {
    const both = [{ tid: "0930", namn: "Alva", lunch: "ja" }, { tid: "1100", namn: "Nils", lunch: "ja" }];

    expect(values(field(graph(), both, 0, "tid").options)).toEqual(["0930", "1400"]);
    expect(values(field(graph(), both, 1, "tid").options)).toEqual(["1100", "1400"]);

    // Ett svar som stod kvar när listan ändrades: båda har det, båda ser det.
    const clash = [{ tid: "0930", namn: "", lunch: "" }, { tid: "0930", namn: "", lunch: "" }];
    expect(values(field(graph(), clash, 0, "tid").options)).toEqual(["0930", "1100", "1400"]);
    expect(values(field(graph(), clash, 1, "tid").options)).toEqual(["0930", "1100", "1400"]);
  });

  test("tomläget: frågan förblir obligatorisk, och motorn släpper inte en tom upprepning", () => {
    const two = graph();
    const time = two.nodes.find((node) => node.id === "unique-time")!;
    time.data.options = (time.data.options as { value: string }[]).filter((option) => option.value !== "1400");
    const three = [
      { tid: "0930", namn: "Alva", lunch: "ja" },
      { tid: "1100", namn: "Nils", lunch: "ja" },
      { tid: "", namn: "Bo", lunch: "nej" },
    ];

    const empty = field(two, three, 2, "tid");
    expect(empty.options).toEqual([]);
    expect(empty.required).toBe(true);

    const engine = new GuideTraversalEngine(two, { locale: "sv" });
    expect(engine.answerPage({ bokningar: three } as never).success).toBe(false);
    expect(engine.getCurrentNode()?.id).toBe("unique-page");
  });

  test("avgränsningen (Astra 29/9): inställningen gör inte en frivillig fråga obligatorisk", () => {
    const voluntary = graph();
    voluntary.nodes.find((node) => node.id === "unique-name")!.data.required = false;
    const two = [
      { tid: "0930", namn: "", lunch: "ja" },
      { tid: "1100", namn: "", lunch: "nej" },
    ];

    expect(field(voluntary, two, 1, "namn").required).toBe(false);
    const engine = new GuideTraversalEngine(voluntary, { locale: "sv" });
    expect(engine.answerPage({ bokningar: two } as never).success).toBe(true);
    expect(engine.getCurrentNode()?.id).toBe("unique-done");
  });

  test("kriterium 5: ett fält utan inställningen erbjuder allt i varje post", () => {
    expect(values(field(graph(), records, 1, "lunch").options)).toEqual(["ja", "nej"]);

    const off = graph();
    delete off.nodes.find((node) => node.id === "unique-time")!.data.uniqueAcrossRepeats;
    expect(values(field(off, records, 1, "tid").options)).toEqual(["0930", "1100", "1400"]);
  });

  test("granskningen läser varje post mot posterna före den: etiketter, inte värden", () => {
    const stored = [{ tid: "0930", namn: "Alva", lunch: "ja" }, { tid: "1100", namn: "Nils", lunch: "ja" }];
    const rows = PageRepeatService.records(graph(), pageOf(graph()), stored, { bokningar: stored }, "sv");

    expect(rows.map((row) => row.fields[0])).toEqual(["Vilken tid?: 09.30", "Vilken tid?: 11.00"]);
  });

  test("kriterium 7: inställningen på en sida som inte upprepas varnar", () => {
    const moved = graph();
    pageOf(moved).data.repeats = false;
    const issues = (source: GraphData) =>
      GuideHealthService.analyze(source)
        .filter((issue) => issue.code === "unique-outside-repeat")
        .map((issue) => [issue.severity, issue.nodeId]);

    expect(issues(graph())).toEqual([]);
    expect(issues(moved)).toEqual([
      ["warning", "unique-time"],
      ["warning", "unique-name"],
    ]);
  });

  test("nåbarhetsräkningen: valideringarna och inställningens rad kan sägas, villkorens inte", () => {
    const keys = reachableViewerKeys(graph());

    expect(keys).toContain("validation.alreadyGiven");
    expect(keys).toContain("validation.alreadyChosen");
    expect(keys).toContain("field.optionsTakenElsewhere");
    expect(keys).toContain("field.noOptionsLeft");
    expect(keys).toContain("validation.noOptionsLeft");
    // Fixturen har inga villkor på alternativen: villkorsraden och
    // tömningen kan inte sägas här (Johan 29/9 — eget val töms aldrig).
    expect(keys).not.toContain("field.someOptionsHidden");
    expect(keys).not.toContain("validation.choiceRedo");

    const off = graph();
    off.nodes.forEach((node) => delete node.data.uniqueAcrossRepeats);
    expect(reachableViewerKeys(off)).not.toContain("validation.alreadyChosen");
    expect(reachableViewerKeys(off)).not.toContain("field.optionsTakenElsewhere");
  });
});

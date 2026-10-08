import { describe, expect, test } from "vitest";

import { TemplateVariableService } from "./template-variable-service";
import type { GraphData } from "../types/graph";

const graph: GraphData = {
  startNodeId: "choice",
  nodes: [{
    id: "choice",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      variableName: "contactMethod",
      options: [{ id: "email", label: "E-post", value: "email" }],
    },
  }],
  connections: [],
};

describe("TemplateVariableService", () => {
  test("reuses answer labels and leaves missing variables visible", () => {
    expect(TemplateVariableService.resolve(
      "Kontakt: {{ contactMethod }}, {{name}}, {{missing}}",
      { contactMethod: "email", name: "Anna" },
      graph
    )).toEqual({
      template: "Kontakt: {{ contactMethod }}, {{name}}, {{missing}}",
      resolved: "Kontakt: E-post, Anna, {{missing}}",
      missingVariables: ["missing"],
    });
  });
});
describe("formaterade svar i en mall", () => {
  const graph = {
    startNodeId: "p",
    nodes: [
      {
        id: "p",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: "Personnummer", variableName: "pnr", format: "personnummer" },
      },
      {
        id: "e",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: "E-post", variableName: "epost", format: "email" },
      },
    ],
    connections: [],
  } as never;

  const answers = { pnr: "195603281949", epost: "anna@exempel.se" };

  test("skrivs i den form som går att kontrollera", () => {
    /*
     * The same principle the service already followed for options, where
     * `{{kön}}` prints "Kvinna" rather than the stored `k`: a template is read by
     * a person. The stored twelve digits stay in `getAnswers()` for a register.
     */
    expect(TemplateVariableService.resolve("Ditt nummer: {{pnr}}", answers, graph).resolved).toBe(
      "Ditt nummer: 19560328-1949",
    );
  });

  test("men en mottagaradress rörs aldrig", () => {
    /*
     * The one caller whose result is a machine string. A space inserted into an
     * address for legibility is the kind of fault nobody finds until a letter
     * fails to arrive — so it has a method of its own rather than a flag with a
     * default that is right four times out of five.
     */
    expect(TemplateVariableService.resolveExact("{{pnr}}", answers, graph).resolved).toBe(
      "195603281949",
    );
  });

  test("och format utan egen form lämnas som de är", () => {
    expect(TemplateVariableService.resolve("{{epost}}", answers, graph).resolved).toBe(
      "anna@exempel.se",
    );
  });
});

describe("tal i en mall", () => {
  const graph = {
    startNodeId: "n",
    nodes: [
      {
        id: "n",
        type: "number-question",
        position: { x: 0, y: 0 },
        data: { title: "Boendekostnad", variableName: "boende", unit: "kr/mån" },
      },
      {
        id: "t",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: { title: "Bostaden", variableName: "rum" },
      },
    ],
    connections: [],
  } as never;

  test("får tusentalsavgränsare", () => {
    /*
     * The separator Swedish uses is a **non-breaking** space, which is right and
     * is why this normalises before comparing: it keeps 7 and 400 on the same
     * line. The first version of this test compared against an ordinary space
     * and failed against a string that looked identical on screen.
     */
    const resolved = TemplateVariableService.resolve(
      "Du betalar {{boende}} kr",
      { boende: "7400" },
      graph,
      "sv",
    ).resolved;

    expect(resolved).toContain("\u00a0");
    expect(resolved.replace(/\u00a0/g, " ")).toBe("Du betalar 7 400 kr");
  });

  test("men aldrig enheten, för den skriver författaren själv", () => {
    /*
     * `{{manadsbidrag}} kr/mån`, `{{maxLoan}} kr` and `{{pris}} kr` all appear in
     * the bundled guides. Appending the field's unit here would give
     * "7 400 kr/mån kr/mån" — the unit belongs to the field, where it now stands
     * beside the input.
     */
    const resolved = TemplateVariableService.resolve(
      "{{boende}}",
      { boende: "7400" },
      graph,
      "sv",
    ).resolved;

    expect(resolved).not.toContain("kr");
  });

  test("och språket avgör hur det skrivs", () => {
    expect(
      TemplateVariableService.resolve("{{boende}}", { boende: "7400" }, graph, "en").resolved,
    ).toBe("7,400");
  });

  test("en textfråga rörs inte, hur mycket siffror den än innehåller", () => {
    // Guarded by the node's type rather than by the value: a text answer never
    // reaches the number formatting at all.
    expect(
      TemplateVariableService.resolve("{{rum}}", { rum: "007" }, graph, "sv").resolved,
    ).toBe("007");
  });

  test("och en talfråga med ett svar som inte är ett tal lämnas som den är", () => {
    /*
     * The reachable case for the numeric guard, and the one the first version of
     * this test missed entirely: it asserted on a *text* question, which the type
     * check already excludes, so removing the guard changed nothing and the test
     * stayed green.
     *
     * A number question can hold something else — a host setting answers
     * directly, a value carried over from a lookup — and rewriting "cirka 7000"
     * into a number would be inventing an answer nobody gave.
     */
    expect(
      TemplateVariableService.resolve("{{boende}}", { boende: "cirka 7000" }, graph, "sv")
        .resolved,
    ).toBe("cirka 7000");
  });

  test("och former JavaScript råkar förstå men ingen skrev med flit", () => {
    /*
     * `Number("0x10")` is 16 and `Number("1e5")` is 100000, so leaving the check
     * to `Number.isFinite` alone would turn a string somebody stored into a
     * figure nobody wrote. This is the whole reason the guard is a pattern and
     * not just a finiteness test — established by removing it and watching this
     * fail, after two earlier versions of these tests could not tell the
     * difference.
     */
    expect(
      TemplateVariableService.resolve("{{boende}}", { boende: "0x10" }, graph, "sv").resolved,
    ).toBe("0x10");
    expect(
      TemplateVariableService.resolve("{{boende}}", { boende: "1e5" }, graph, "sv").resolved,
    ).toBe("1e5");
  });

  test("men inledande nollor på en talfråga är inte information", () => {
    /*
     * `007` on a number question is seven, and printing it as `7` is right — an
     * assumption of mine to the contrary is what this test caught. Leading zeros
     * matter on an *identifier*, and an identifier belongs on a text question
     * with a format, which is exactly what the personnummer work built.
     */
    expect(
      TemplateVariableService.resolve("{{boende}}", { boende: "007" }, graph, "sv").resolved,
    ).toBe("7");
  });
});

/*
 * Two faults found by the small-firm templates (story 109, 11/9): a multiple
 * choice's answer is a list, and the option lookup compared each option's
 * value with the whole list joined — so `{{arbete}}` printed the codes. And a
 * single choice's label was resolved without the reader's language, so an
 * English letter said "Måla".
 */
describe("valda alternativ i en mall", () => {
  const painting: GraphData = {
    startNodeId: "work",
    nodes: [{
      id: "work",
      type: "multi-choice",
      position: { x: 0, y: 0 },
      data: {
        variableName: "arbete",
        options: [
          { id: "mala", label: { sv: "Måla", en: "Paint" }, value: "mala" },
          { id: "tapetsera", label: { sv: "Tapetsera", en: "Wallpaper" }, value: "tapetsera" },
        ],
      },
    }],
    connections: [],
  };

  test("ett flerval skrivs som sina etiketter, inte sina koder", () => {
    expect(TemplateVariableService.resolve("Arbete: {{arbete}}", { arbete: ["mala", "tapetsera"] }, painting).resolved)
      .toBe("Arbete: Måla, Tapetsera");
  });

  test("etiketten följer läsarens språk", () => {
    expect(TemplateVariableService.resolve("Work: {{arbete}}", { arbete: ["mala"] }, painting, "en").resolved)
      .toBe("Work: Paint");
    expect(TemplateVariableService.resolve("Work: {{arbete}}", { arbete: "tapetsera" }, painting, "en").resolved)
      .toBe("Work: Wallpaper");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * A field never takes its weight from its label, as it never takes its size
 * (the field rule's own comment). Measured 30/9 (GRAFISK-PROFIL, *Hierarkin
 * — roller*): every text box wrapped in the panel's capital caption drew what
 * the editor had written in the caption's 700 — the service call's rows, the
 * rating steps, the submission's column headings — through `font: inherit`.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function panelWith(type: string, data: Record<string, unknown>): ShadowRoot {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = { id: "n", type, position: { x: 0, y: 0 }, data: { title: "Nod", ...data } } as never;
  return panel.shadowRoot!;
}

const weight = (el: Element) => getComputedStyle(el).fontWeight;

describe("vikten i panelens fält", () => {
  test("tjänsteanropets rader: värdet 400 under sin etikett", async () => {
    const root = panelWith("service-call", {
      responseMappings: [{ id: "a", field: "maxLoan", variableName: "maxLan", label: "Maxlån" }],
    });
    await settle();

    const inputs = [...root.querySelectorAll<HTMLInputElement>("[data-mapping-id] [data-mapping-property]")];
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(weight(input)).toBe("400");
      expect(Number(weight(input.closest("label")!))).toBeGreaterThanOrEqual(600);
    }
  });

  test("betygsstegen: värdet 400", async () => {
    const root = panelWith("rating-question", { variableName: "betyg", scale: 4, labels: [{ sv: "Dåligt" }, { sv: "Bra" }] });
    await settle();

    const inputs = [...root.querySelectorAll<HTMLInputElement>("[data-rating-label-index]")];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(weight(input)).toBe("400");
  });
});

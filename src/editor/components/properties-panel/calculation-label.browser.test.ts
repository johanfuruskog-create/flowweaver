import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Story 078: a calculation row can carry its own label — the alias a
 * question has — so a result card says *Maxlån*, not *maxLån*. The field
 * sits on the row in the panel, and what is typed lands on the node.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("uträkningsradens etikett", () => {
  test("finns på raden och når nodens assignments", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1400px; height: 900px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "n",
      nodes: [{
        id: "n",
        type: "calculation",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Räkna" }, assignments: [{ id: "a", variableName: "maxLån", formula: "pris * 0,85" }] },
      }, {
        id: "pris",
        type: "number-question",
        position: { x: 0, y: 200 },
        data: { title: { sv: "Vad kostar bostaden?" }, variableName: "pris", variableLabel: "Bostadspris" },
      }],
      connections: [],
    } as never;
    await settle();
    await settle();
    editor.shadowRoot!
      .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
      .selectNodeById("n");
    await settle();

    const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
    const field = panel.querySelector<HTMLInputElement>('[data-assignment-id="a"] [data-assignment-property="label"]');

    expect(field, "etikettfältet finns på raden").not.toBeNull();
    // The formula's own menu names the guide's variables alias first, like
    // every other list of them (Johan 3/9) — the name is what the formula
    // uses. The running list under the rows is gone (139, Astra §10).
    const formula = panel.querySelector<HTMLElement & { variables: Array<{ value: string; label: string }> }>('[data-assignment-id="a"] rich-text-field[formula]');

    expect(formula!.variables).toContainEqual(expect.objectContaining({ value: "pris", label: "Bostadspris" }));
    field!.value = "Maxlån";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    const node = editor.graph!.nodes.find((one) => one.id === "n")!;
    expect((node.data.assignments as Array<{ label?: string }>)[0]!.label).toBe("Maxlån");
  });
});

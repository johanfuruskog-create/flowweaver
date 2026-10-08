import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Story 079: a service response row can carry its own label — as a
 * calculation row can since 078 — so a result card says *Maxlån*, not
 * *maxLoan*. The field sits on the row in the panel, and what is typed
 * lands on the node.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("uträkningsradens etikett", () => {
  test("finns på raden och når nodens responseMappings", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1400px; height: 900px;";
    document.body.append(editor);
    editor.graph = {
      startNodeId: "n",
      nodes: [{
        id: "n",
        type: "service-call",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Fråga tjänsten" }, responseMappings: [{ id: "a", field: "maxLoan", variableName: "maxLoan" }] },
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
    const field = panel.querySelector<HTMLInputElement>('[data-mapping-id="a"] [data-mapping-property="label"]');

    expect(field, "etikettfältet finns på raden").not.toBeNull();
    field!.value = "Maxlån";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    const node = editor.graph!.nodes.find((one) => one.id === "n")!;
    expect((node.data.responseMappings as Array<{ label?: string }>)[0]!.label).toBe("Maxlån");
  });
});

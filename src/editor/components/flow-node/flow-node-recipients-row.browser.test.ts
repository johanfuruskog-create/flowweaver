// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";
// The recipient line is the full version's, registered from here (open-core step 3c).


import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("index.ts", "editor/node-types/submission-node-properties.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Story 068 — flödets slutpunkt syns på kortet. Ett formulär ser i dag
 * likadant ut vare sig ärendet går till Gatukontoret eller till värdens
 * standardbrevlåda; slutpunkten var den enda fakta som krävde panelen.
 * Namn ur värdens katalog, aldrig adresser; ingen rad utan mottagare —
 * hälsoflaggan bär redan det fallet.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterSubmissionReceiver?.();
});

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

registerSubmissionReceiver?.({
  recipients: () => [
    { id: "gatukontoret", label: "Gatukontoret" },
    { id: "parkforvaltningen", label: "Parkförvaltningen" },
  ],
  submit: async () => ({ reference: "t" }),
});

async function mounted(data: Record<string, unknown>, type = "submit-result"): Promise<FlowNode> {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "slut",
    nodes: [{ id: "slut", type, position: { x: 0, y: 0 }, data: { title: { sv: "Tack" }, ...data } }],
    connections: [],
  } as unknown as GraphData;
  await settle();

  const node = editor.shadowRoot!.querySelector<FlowNode>("flow-node")!;

  return node;
}

const row = (node: FlowNode): HTMLElement | null =>
  node.shadowRoot!.querySelector<HTMLElement>("[data-recipients-row]");

describe.runIf(PRO)("Skickas till-raden", () => {
  test("mottagarna står med namn på kortet", async () => {
    const node = await mounted({ recipientIds: ["gatukontoret", "parkforvaltningen"] });

    expect(row(node), "raden finns").toBeTruthy();
    expect(row(node)!.textContent).toContain("Skickas till");
    expect(row(node)!.textContent).toContain("Gatukontoret");
    expect(row(node)!.textContent).toContain("Parkförvaltningen");
    // Namnen är radens tyngdpunkt — fetade (Johan 2/9), etiketten inte.
    expect(row(node)!.querySelector("strong")?.textContent).toContain(
      "Gatukontoret",
    );
  });

  test("utan mottagare ingen rad — flaggan bär det fallet", async () => {
    const node = await mounted({ recipientIds: [] });

    expect(row(node)).toBeNull();
  });

  test("besökarens egen adress sägs med ord, inte variabel", async () => {
    const node = await mounted(
      { recipientId: "@visitor", visitorVariable: "epost" },
      "email-result",
    );

    expect(row(node), "raden finns").toBeTruthy();
    expect(row(node)!.textContent?.toLowerCase()).toContain("besökarens egen adress");
    expect(row(node)!.querySelector("strong")?.textContent?.toLowerCase()).toContain(
      "besökarens egen adress",
    );
    expect(row(node)!.textContent).not.toContain("epost");
  });
});

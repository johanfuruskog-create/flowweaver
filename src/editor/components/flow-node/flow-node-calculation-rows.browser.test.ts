import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../node-editor/node-editor";

import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Uppdrag 29/9 Del D, Astras spec §11: uträkningsnoden på canvasen visar
 * upp till tre uträkningars etiketter under rubriken, sedan "+2
 * uträkningar". Etikett, annars variabelnamn. Raderna är information —
 * inga egna portar.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const row = (id: string, variableName: string, label?: Record<string, string>) =>
  ({ id, variableName, formula: "1", ...(label ? { label } : {}) });

async function mounted(assignments: unknown[], locale = "sv"): Promise<FlowNode> {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  editor.activeLocale = locale;
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = {
    version: 9,
    startNodeId: "calc",
    nodes: [{ id: "calc", type: "calculation", position: { x: 0, y: 0 }, data: { title: { sv: "Räkna" }, assignments } }],
    connections: [],
  } as unknown as GraphData;
  await settle();

  return editor.shadowRoot!.querySelector<FlowNode>("flow-node")!;
}

const lines = (node: FlowNode): string[] =>
  [...node.shadowRoot!.querySelectorAll<HTMLElement>("[data-calculation-rows] li")].map((one) => one.textContent!.trim());

describe("uträkningarna på kortet", () => {
  test("tre etiketter, sedan hur många fler", async () => {
    const node = await mounted([
      row("a", "grund", { sv: "Grundbelopp", en: "Base amount" }),
      row("b", "barntillagg"),
      row("c", "bidrag", { sv: "Bidrag", en: "Allowance" }),
      row("d", "extra", { sv: "Extra" }),
      row("e", "sista"),
    ]);

    expect(lines(node)).toEqual(["Grundbelopp", "barntillagg", "Bidrag", "+2 uträkningar"]);
  });

  test("ingen fler-rad vid tre eller färre, och en rad per uträkning", async () => {
    const node = await mounted([row("a", "grund", { sv: "Grundbelopp" })]);

    expect(lines(node)).toEqual(["Grundbelopp"]);
  });

  test("raderna följer kortets språk och får inga portar", async () => {
    const node = await mounted([
      row("a", "grund", { sv: "Grundbelopp", en: "Base amount" }),
      row("b", "b"), row("c", "c"), row("d", "d"),
    ], "en");

    expect(lines(node)).toEqual(["Base amount", "b", "c", "+1 more calculation"]);
    expect(node.shadowRoot!.querySelectorAll("[data-calculation-rows] [data-port-id], [data-calculation-rows] .flow-node__port")).toHaveLength(0);
  });

  /*
   * K3 (Siv, mätt 29/9): the node is a single `role="group"` `tabindex="0"`
   * stop whose `aria-label` REPLACES the accessible name — nothing inside it
   * is a Tab stop, so a visible `<ul>` alone said nothing to a keyboard or
   * screen-reader user tabbing between nodes. Measured on the DOM before the
   * fix: `getAttribute("aria-label")` held only the title, and `[data-
   * calculation-rows]` carried no `aria-hidden`, so it was in neither the
   * name nor an `aria-describedby` description — read by neither channel a
   * Tab stop actually uses.
   */
  test("etiketterna och fler-ordet finns i nodens tillgängliga namn, och listan är aria-hidden", async () => {
    const node = await mounted([
      row("a", "grund", { sv: "Grundbelopp", en: "Base amount" }),
      row("b", "barntillagg"),
      row("c", "bidrag", { sv: "Bidrag", en: "Allowance" }),
      row("d", "extra", { sv: "Extra" }),
      row("e", "sista"),
    ]);
    const group = node.shadowRoot!.querySelector(".flow-node")!;
    const name = group.getAttribute("aria-label") ?? "";

    expect(name).toContain("Grundbelopp");
    expect(name).toContain("barntillagg");
    expect(name).toContain("Bidrag");
    expect(name).toContain("+2 uträkningar");
    expect(node.shadowRoot!.querySelector("[data-calculation-rows]")!.getAttribute("aria-hidden")).toBe("true");
  });
});

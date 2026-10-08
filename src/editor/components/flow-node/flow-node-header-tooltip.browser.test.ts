import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";
import type { FlowNode } from "./flow-node";
import type { GraphData } from "../../../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { bookingExampleGraph } = ((await proModule("data/booking-example-graph.ts")) ?? {}) as { bookingExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * E10 godkänd som byggd (Astra, uppdraget 2026-09-30, bilaga 5): ögat och ⋯
 * behöver inget synligt ord, men ska ha ett tydligt tillgängligt namn OCH
 * ett tooltip vid hover och vid tangentbordsfokus — samma krav canvasens
 * zoomrad redan håller (`bindCanvasToolbarTooltip`, node-editor.ts). Namnet
 * fanns redan (`aria-label` + `title`); `title` ensam ger bara hover, aldrig
 * fokus, vilket är hela bristen det här provet fångar.
 *
 * Siv, genomgången 30/9: sett falla mot koden utan `bindHeaderTooltip` —
 * `[data-header-tooltip]` saknades i markupen och ingen text visades på
 * `focus()`.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function canvas(): Promise<NodeEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = structuredClone(bookingExampleGraph);

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!nodeEditor) throw new Error("node-editor saknas.");

  return nodeEditor;
}

function firstNode(nodeEditor: NodeEditor): FlowNode {
  const node = nodeEditor.shadowRoot!.querySelector<FlowNode>("flow-node");

  if (!node) throw new Error("ingen nod hittad.");

  return node;
}

describe("nodhuvudets tooltip (E10, bilaga 5)", () => {
  test.runIf(PRO)("ögat visar tooltip vid pointerenter, med samma text som aria-label", async () => {
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const eye = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-visitor-toggle]")!;
    const tooltip = node.shadowRoot!.querySelector<HTMLElement>("[data-header-tooltip]")!;

    expect(tooltip.hidden, "dold innan hovring").toBe(true);

    eye.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle();

    expect(tooltip.hidden, "synlig efter pointerenter").toBe(false);
    expect(tooltip.textContent).toBe(eye.getAttribute("aria-label"));
    expect(tooltip.getAttribute("role")).toBe("tooltip");
    expect(tooltip.getAttribute("aria-hidden"), "namnet kommer från knappens aria-label, inte tooltipen").toBe("true");
  });

  test.runIf(PRO)("⋯ visar tooltip vid tangentbordsfokus, inte bara hover", async () => {
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const menu = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!;
    const tooltip = node.shadowRoot!.querySelector<HTMLElement>("[data-header-tooltip]")!;

    menu.focus();
    await settle();

    expect(node.shadowRoot!.activeElement, "fokus landade på knappen").toBe(menu);
    expect(tooltip.hidden, "tooltipen visas på tangentbordsfokus, inte bara på hover").toBe(false);
    expect(tooltip.textContent).toBe(menu.getAttribute("aria-label"));
  });

  test.runIf(PRO)("döljs vid blur, och vid Escape medan den visas", async () => {
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const menu = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!;
    const tooltip = node.shadowRoot!.querySelector<HTMLElement>("[data-header-tooltip]")!;

    menu.focus();
    await settle();
    expect(tooltip.hidden).toBe(false);

    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(tooltip.hidden, "Escape döljer direkt, ingen väntan").toBe(true);

    // Fokus lämnar och kommer tillbaka (focus() ger inget nytt "focus" om
    // elementet redan är aktivt — vilket det fortfarande är efter Escape),
    // så nästa visning prövas via en riktig hovring i stället.
    menu.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle();
    expect(tooltip.hidden, "pointerenter visar den igen").toBe(false);
    menu.blur();
    expect(tooltip.hidden, "blur döljer direkt").toBe(true);
  });

  test.runIf(PRO)("bytt etikett (menyn öppnas) uppdaterar ett redan synligt tooltip", async () => {
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const menu = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!;
    const tooltip = node.shadowRoot!.querySelector<HTMLElement>("[data-header-tooltip]")!;
    const closedLabel = menu.getAttribute("aria-label");

    menu.focus();
    await settle();
    expect(tooltip.textContent).toBe(closedLabel);

    // `menuOpen` patches the button in place (updateMenuButton) rather than
    // re-rendering — the whole reason `refreshHeaderTooltip` exists.
    node.menuOpen = true;
    await settle();

    const openLabel = menu.getAttribute("aria-label");

    expect(openLabel, "etiketten bytte när menyn öppnades").not.toBe(closedLabel);
    expect(tooltip.textContent, "tooltipen följde med, i stället för att stå kvar med det gamla ordet").toBe(openLabel);
  });
});

describe("⋯ följer ögats tabbordning (hittat under E10:s mätning)", () => {
  test.runIf(PRO)("`current` uppdaterar ⋯:s tabindex precis som ögats, utan en full render", async () => {
    /*
     * `updateTabOrder` (anropad av `set current`, alltså varje gång
     * node-editors `makeCurrent` flyttar tabbstoppet — betydligt oftare än
     * en full `render()`) satte tabindex på kortet, portarna och ögat, men
     * aldrig på ⋯. En nod som blev "current" utan att räknas om behöll
     * ⋯:s tabindex från sin senaste render — nästan alltid -1 — och en
     * tangentbordsanvändare som tabbade från ögat hoppade rakt förbi ⋯ till
     * nodens första port. Nåbar ändå via Shift+F10/ContextMenu (K3), men
     * den vägen fokuserar aldrig knappen, så dess tooltip (E10, bilaga 5)
     * visades aldrig för den som kom dit så.
     */
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const eye = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-visitor-toggle]")!;
    const menu = node.shadowRoot!.querySelector<HTMLButtonElement>("[data-node-menu]")!;

    for (const value of [true, false, true]) {
      node.current = value;
      expect(menu.tabIndex, `current=${value}`).toBe(eye.tabIndex);
    }
  });
});

describe("tooltipen är hoverable (WCAG 1.4.13, Astra, uppdraget bilaga 8 punkt 2)", () => {
  /*
   * Mätt med en riktig mus i en Playwright-rigg (Siv, 1/10): pekaren flyttad
   * från ögat in i tooltipens EGEN ruta (den står ovanför huvudet, utanför
   * knappens box) dolde tooltipen efter 200 ms ändå — precis vad Astra
   * frågade om. Här samma prövning utan skärm: en `pointerenter` på
   * tooltip-elementet innan dölj-timern hinner slå till ska räknas som att
   * pekaren fortfarande är "på" kontrollen, inte som att den lämnat den.
   */
  test.runIf(PRO).each(["ögat", "⋯"] as const)("%s: pekaren i tooltipens egen ruta håller den kvar", async (which) => {
    const nodeEditor = await canvas();
    const node = firstNode(nodeEditor);
    const button = node.shadowRoot!.querySelector<HTMLButtonElement>(
      which === "ögat" ? "[data-visitor-toggle]" : "[data-node-menu]",
    )!;
    const tooltip = node.shadowRoot!.querySelector<HTMLElement>("[data-header-tooltip]")!;

    button.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle();
    expect(tooltip.hidden, "synlig efter hover på knappen").toBe(false);

    button.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    // Pekaren "korsar" glappet till tooltipens ruta innan 200 ms dölj-
    // fördröjningen hinner slå till.
    tooltip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await settle(300);

    expect(tooltip.hidden, "ska ligga kvar när pekaren står i tooltipens egen ruta").toBe(false);

    tooltip.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await settle(300);
    expect(tooltip.hidden, "döljs när pekaren till slut lämnar tooltipen också").toBe(true);
  });
});

// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";


import type { PropertiesPanel } from "./properties-panel";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("index.ts");
const { registerSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Story 056 — mottagarna som borttagbara etiketter, inte kryssrutor.
 *
 * En katalog kan vara lång, och det VALDA ska gå att läsa utan att man skannar
 * en lista efter bockar. Johans krav, och samma resonemang som mottagarväljaren
 * redan följer: hellre visa vad som gäller än be någon leta reda på det.
 *
 * Värdet är en lista i grafen (`recipientIds`), och panelen bär den genom ett
 * dolt fält med JSON — samma väg som kartans startvy använder för sitt
 * sammansatta värde.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panel(data: Record<string, unknown>): Promise<PropertiesPanel> {
  const element = document.createElement("properties-panel") as PropertiesPanel;

  element.editorMode = "administrator";
  document.body.append(element);
  /* Katalogen kommer samma väg som väljaren redan använder: värdens registrerade
     mottagare, lästa synkront ur registrets cache. */
  registerSubmissionReceiver({
    recipients: () => [
      { id: "gatukontoret", label: "Gatukontoret" },
      { id: "parken", label: "Parkförvaltningen" },
      { id: "kundcenter", label: "Kundcenter" },
    ],
    submit: async () => ({ reference: "FW-1" }),
  });
  element.nodeData = {
    id: "in",
    type: "submit-result",
    position: { x: 0, y: 0 },
    data: { title: "Tack", ...data },
  } as never;

  await settle();

  return element;
}

/**
 * Kontrollen bor i `chip-picker` sedan mottagarlistan använder samma som
 * visaren, regelvillkoret och synligheten. Påståendena är desamma — de går
 * bara genom dess skugg-DOM.
 */
const väljaren = (element: PropertiesPanel, property: string): ShadowRoot =>
  element.shadowRoot!.querySelector(`[data-recipient-picker="${property}"]`)!.shadowRoot!;

const chips = (element: PropertiesPanel, property: string): string[] =>
  [...väljaren(element, property).querySelectorAll(".chip-picker__chip-label")].map(
    (one) => one.textContent?.trim() ?? "",
  );

/** Vad som går att lägga till. Söket tömmer listan tills man skrivit. */
const erbjudna = (element: PropertiesPanel, property: string): string[] => {
  const rot = väljaren(element, property);

  // Alternativen visas när kontrollen används.
  rot.querySelector<HTMLElement>(".chip-picker__box")
    ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

  return [...rot.querySelectorAll("[data-add]")].map(
    (one) => one.textContent?.trim() ?? "",
  );
};

describe("mottagarlistan i panelen", () => {
  test.runIf(PRO)("visar valda mottagare som etiketter med namn, inte id", async () => {
    const element = await panel({ recipientIds: ["gatukontoret", "parken"] });

    expect(chips(element, "recipientIds")).toEqual(["Gatukontoret", "Parkförvaltningen"]);
  });

  test.runIf(PRO)("och erbjuder bara dem som inte redan är valda", async () => {
    const element = await panel({ recipientIds: ["gatukontoret"] });
    expect(erbjudna(element, "recipientIds")).toEqual(["Parkförvaltningen", "Kundcenter"]);
  });

  test.runIf(PRO)("kopiemottagarna har en egen lista", async () => {
    const element = await panel({
      recipientIds: ["gatukontoret"],
      copyRecipientIds: ["kundcenter"],
    });

    expect(chips(element, "copyRecipientIds")).toEqual(["Kundcenter"]);
  });

  test.runIf(PRO)("en gammal guide med bara recipientId visas som en etikett", async () => {
    // Grafen kan komma omigrerad från en värd; panelen ska inte se tom ut.
    const element = await panel({ recipientId: "parken" });

    expect(chips(element, "recipientIds")).toEqual(["Parkförvaltningen"]);
  });

  test.runIf(PRO)("ett id som inte finns i katalogen står kvar, märkt", async () => {
    // Samma regel som e-postväljaren fick i story 054: tysta bort ingenting.
    const element = await panel({ recipientIds: ["borttagen"] });

    expect(chips(element, "recipientIds")[0]).toMatch(/borttagen/);
  });
});

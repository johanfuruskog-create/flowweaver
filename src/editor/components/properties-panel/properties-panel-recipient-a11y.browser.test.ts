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
 * Story 056 — mottagarlistan för den som inte ser den.
 *
 * Mönstret är byggt av inbyggda kontroller med flit: en `<select>` som lägger
 * till och riktiga knappar som tar bort. Ett eget listbox-mönster med
 * `aria-multiselectable` kräver att hela tangentbordsmodellen implementeras för
 * hand, och den görs nästan alltid fel.
 *
 * Fyra saker som inte följer av valet av element, och som därför prövas här:
 *
 * - **Fokus överlever en borttagning.** Knappen man tryckte på slutar existera;
 *   utan hjälp hamnar fokus på `<body>`, skärmläsaren tystnar och den som
 *   använder tangentbord har tappat sin plats.
 * - **Något säger att det hände.** Den som ser en etikett dyka upp får svaret
 *   gratis; en skärmläsare får ingenting utan en `aria-live`-rad.
 * - **Etiketterna är en lista.** Då annonseras antalet, som är hela poängen med
 *   ett flerval.
 * - **Gruppen har ett namn.** Annars är väljaren och etiketterna två orelaterade
 *   saker i uppläsningen.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panel(ids: string[]): Promise<PropertiesPanel> {
  registerSubmissionReceiver({
    recipients: () => [
      { id: "gatukontoret", label: "Gatukontoret" },
      { id: "parken", label: "Parkförvaltningen" },
      { id: "kundcenter", label: "Kundcenter" },
    ],
    submit: async () => ({ reference: "FW-1" }),
  });

  const element = document.createElement("properties-panel") as PropertiesPanel;

  element.editorMode = "administrator";
  document.body.append(element);
  element.nodeData = {
    id: "in",
    type: "submit-result",
    position: { x: 0, y: 0 },
    data: { title: "Tack", recipientIds: ids },
  } as never;

  await settle();

  return element;
}

/**
 * Kontrollen bor i `chip-picker` sedan mottagarlistan använder samma som
 * visaren, regelvillkoret och synligheten. Påståendena är desamma — de går
 * bara genom dess skugg-DOM, och uppläsning och fokus ägs av kontrollen i
 * stället för av panelen.
 */
const väljaren = (element: PropertiesPanel): ShadowRoot =>
  element.shadowRoot!.querySelector('[data-recipient-picker="recipientIds"]')!.shadowRoot!;

/** Alternativen visas när kontrollen används — samma gest som ett finger gör. */
const öppnaVäljaren = (rot: ShadowRoot): void => {
  rot.querySelector<HTMLElement>(".chip-picker__box")
    ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
};

const removeButtons = (element: PropertiesPanel): HTMLButtonElement[] =>
  [...väljaren(element).querySelectorAll<HTMLButtonElement>("[data-remove]")];

const deepActive = (): Element | null => {
  let node: Element | null = document.activeElement;

  while (node?.shadowRoot?.activeElement) {
    node = node.shadowRoot.activeElement;
  }

  return node;
};

describe("mottagarlistan för skärmläsare och tangentbord", () => {
  test.runIf(PRO)("etiketterna är en lista, så antalet annonseras", async () => {
    const element = await panel(["gatukontoret", "parken"]);
    const list = väljaren(element).querySelector("[data-chips]")!;

    expect(list.tagName).toBe("UL");
    expect(list.querySelectorAll("li")).toHaveLength(2);
  });

  test.runIf(PRO)("gruppen bär fältets namn", async () => {
    const element = await panel(["gatukontoret"]);
    const group = väljaren(element).querySelector('[role="group"]')!;

    // Kontrollen bär namnet själv, som `aria-label` — den vet inte var i
    // panelen den sitter, och ska inte behöva peka på ett id utanför sig.
    expect(group.getAttribute("aria-label")).toBe("Mottagare");
  });

  test.runIf(PRO)("en borttagning flyttar fokus till nästa etikett", async () => {
    const element = await panel(["gatukontoret", "parken"]);

    removeButtons(element)[0]!.focus();
    removeButtons(element)[0]!.click();
    await settle();

    expect(deepActive()?.getAttribute("data-value")).toBe("parken");
  });

  test.runIf(PRO)("och till väljaren när den sista togs bort", async () => {
    // Fokus får aldrig falla till body: då tystnar uppläsningen mitt i en
    // handling användaren själv utförde.
    const element = await panel(["gatukontoret"]);

    removeButtons(element)[0]!.focus();
    removeButtons(element)[0]!.click();
    await settle();

    // Till det som går att lägga till, eller till söket — aldrig till body.
    const kvar = deepActive();

    expect(
      kvar?.hasAttribute("data-add") || kvar?.hasAttribute("data-search"),
    ).toBe(true);
  });

  test.runIf(PRO)("och något säger vad som hände", async () => {
    const element = await panel(["gatukontoret", "parken"]);

    removeButtons(element)[0]!.click();
    await settle();

    const status = väljaren(element).querySelector("[data-status]")!;

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/Gatukontoret/);
  });

  /*
   * The picker is the rule's value picker in a new place, and it kept the
   * rule's words: "3 värden" under a list of offices, "Gatukontoret
   * tillagt" in the neuter (measured 3/9). The recipient strings sat in the
   * registry unused. A recipient is a recipient in every sentence.
   */
  test.runIf(PRO)("räknar mottagare, inte värden", async () => {
    const element = await panel(["gatukontoret"]);
    const rot = väljaren(element);

    öppnaVäljaren(rot);
    await settle();
    expect(rot.querySelector("[data-count]")?.textContent?.trim()).toBe("2 mottagare");
    removeButtons(element)[0]!.click();
    await settle();
    expect(rot.querySelector("[data-status]")?.textContent).toBe("Gatukontoret borttagen. 0 valda.");
  });

  test.runIf(PRO)("en tillagd mottagare syns direkt, utan att värden svarat", async () => {
    /*
     * Panelen skickar bara `node-data-changed` och väntar på att noden kommer
     * tillbaka. För ett textfält räcker det — fältet visar redan det man
     * skrivit — men etiketternas tillstånd finns bara i omritningen. Utan en
     * lokal uppdatering står listan kvar oförändrad medan statusraden säger
     * "3 valda", vilket är värre än att inte säga något alls.
     */
    const element = await panel(["gatukontoret"]);
    öppnaVäljaren(väljaren(element));
    await settle();
    väljaren(element)
      .querySelector<HTMLButtonElement>('[data-add][data-value="parken"]')!
      .click();
    await settle();

    const labels = [...väljaren(element).querySelectorAll(".chip-picker__chip-label")]
      .map((one) => one.textContent?.trim());

    expect(labels).toEqual(["Gatukontoret", "Parkförvaltningen"]);
  });

  test.runIf(PRO)("krysset träffas i 44 px — samma kontroll som visaren", async () => {
    /*
     * Mätt med fingertoppar, inte med knappens ruta: krysset ritas litet så
     * etiketten inte blir mest kryss, och ytan läggs på med ett pseudoelement
     * som `getBoundingClientRect` inte känner till.
     *
     * 44 och inte 24 sedan mottagarlistan använder samma kontroll som visaren.
     * AA-golvet är 24 och hade räckt vid ett tangentbord; ingen har blivit
     * sämre av ett större mål, och guider byggs på en iPad.
     */
    const element = await panel(["gatukontoret"]);
    const kryss = removeButtons(element)[0]!;
    const mitt = kryss.getBoundingClientRect();
    const x = mitt.left + mitt.width / 2;
    const y = mitt.top + mitt.height / 2;

    for (const [dx, dy] of [[-21, -21], [21, 21]] as const) {
      const träff = väljaren(element).elementFromPoint(x + dx, y + dy);

      expect(träff === kryss || kryss.contains(träff)).toBe(true);
    }
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Berättelse 134, kriterium 3 — hur redaktören väljer det.
 *
 * Samma brytare som fältet har, samma tre kontroller, samma skylt, en nivå
 * ner. Och en hjälprad som säger vilket av tre områden man står i: det här
 * alternativet, hela fältet, eller vägen genom guiden — tre mekanismer som
 * alla börjar med *visas bara om* behöver var sin mening om vad de gäller
 * (067:s mönster).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const VILLKOR = {
  match: "all",
  conditions: [
    { id: "c1", variableName: "allergi", operator: "not-one-of", value: "notter" },
  ],
};

async function mounted(villkorat: boolean): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = {
    version: 8,
    startNodeId: "allergi",
    settings: { sourceLocale: "sv", locales: ["sv"] },
    nodes: [
      {
        id: "allergi",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Allergier" },
          variableName: "allergi",
          options: [
            { id: "a1", label: { sv: "Nötter" }, value: "notter" },
            { id: "a2", label: { sv: "Inga" }, value: "inga" },
          ],
        },
      },
      {
        id: "meny",
        type: "question",
        position: { x: 600, y: 0 },
        data: {
          title: { sv: "Meny" },
          variableName: "meny",
          options: [
            { id: "veg", label: { sv: "Vegetariskt" }, value: "veg" },
            {
              id: "curry",
              label: { sv: "Nötcurry" },
              value: "curry",
              ...(villkorat ? { visibility: VILLKOR } : {}),
            },
          ],
        },
      },
    ],
    connections: [
      { id: "k1", from: { nodeId: "allergi", portId: "a1" }, to: { nodeId: "meny", portId: "in" } },
    ],
  } as never;
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("meny");
  await settle();

  return editor;
}

const panel = (editor: GuideEditor): ShadowRoot =>
  editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

const block = (editor: GuideEditor, optionId: string): HTMLElement =>
  panel(editor).querySelector<HTMLElement>(
    `.properties-panel__option-visibility[data-option-id="${optionId}"]`,
  )!;

describe("134 kriterium 3 — alternativets visas om i panelen", () => {
  test("kriterium 3: varje alternativ har en brytare, av som förval", async () => {
    const editor = await mounted(false);

    for (const id of ["veg", "curry"]) {
      const brytare = block(editor, id).querySelector<HTMLInputElement>(
        '[data-option-visibility-property="enabled"]',
      );

      expect(brytare, `${id} har en brytare`).toBeTruthy();
      expect(brytare!.getAttribute("role")).toBe("switch");
      expect(brytare!.checked).toBe(false);
    }

    // Av betyder inga kontroller — inte tomma kontroller.
    expect(block(editor, "veg").querySelector('[data-option-visibility-property="variableName"]')).toBeNull();
  });

  test("kriterium 3: på ger samma tre kontroller som fältets visas om", async () => {
    const editor = await mounted(true);
    const villkorat = block(editor, "curry");

    expect(
      villkorat.querySelector<HTMLInputElement>('[data-option-visibility-property="enabled"]')!.checked,
    ).toBe(true);

    const variabel = villkorat.querySelector<HTMLSelectElement>(
      '[data-option-visibility-property="variableName"]',
    );
    const villkor = villkorat.querySelector<HTMLSelectElement>(
      '[data-option-visibility-property="operator"]',
    );
    const värde = villkorat.querySelector('[data-option-visibility-property="value"]');

    expect(variabel?.value).toBe("allergi");
    expect(villkor?.value).toBe("not-one-of");
    expect(värde, "värdekontrollen finns").toBeTruthy();
  });

  /*
   * Vända 6 (konceptbild 3, 29/9): skylten ("Visas bara om Allergi inte är
   * Nötter") är struken. Ted mätte att den — liksom den planerade sammanfatt-
   * ningsraden i villkorsytan — inte kan göras SANN för alla fall: den visade
   * bara första villkoret och påstod att det var hela bilden. Villkorsytan
   * under reglaget visar redan sanningen i sina egna fält (variabel,
   * jämförelse, värde); ingen mening ovanpå den.
   */
  test("kriterium 3: ingen skylt — villkorsytans egna fält är sanningen", async () => {
    const editor = await mounted(true);

    expect(block(editor, "curry").querySelector("[data-option-visibility-badge]")).toBeNull();
    expect(block(editor, "veg").querySelector("[data-option-visibility-badge]")).toBeNull();
  });

  /*
   * Johan via Astra 29/9 (UPPDRAG-2026-09-28-SVARSALTERNATIV, fråga 6):
   * hjälpraden säger inställningens omfattning i en mening — "Styr bara om
   * det här svarsalternativet visas." — och pekar inte längre mot fältets
   * "visas om" och Regeln; den jämförelsen kan ligga bakom en hjälpknapp om
   * den behövs. "En rad" betyder kort text, aldrig trunkering: på smala
   * skärmar ska raden brytas, inte klippas.
   */
  test("kriterium 3: hjälpraden säger omfattningen, kort och utan trunkering", async () => {
    const editor = await mounted(false);

    const hjälp = block(editor, "curry").querySelector<HTMLElement>(
      "[data-option-visibility-scope]",
    );

    expect(hjälp, "hjälpraden finns").toBeTruthy();
    expect(hjälp!.textContent).toContain("det här svarsalternativet");
    expect(hjälp!.textContent).toContain("visas");
    expect(hjälp!.textContent!.toLowerCase(), "jämförelsen med Regeln är borta ur raden").not.toContain("regel");
    // En hjälprad, inte en varning — samma ton som fältets.
    expect(hjälp!.getAttribute("role")).toBeNull();

    const style = getComputedStyle(hjälp!);

    expect(style.whiteSpace, "får radbrytas").toBe("normal");
    expect(style.textOverflow, "aldrig ellips").toBe("clip");
    expect(hjälp!.scrollWidth, "inget klipps i sidled").toBeLessThanOrEqual(hjälp!.clientWidth);
  });

  test("kriterium 3: brytaren skriver och tar bort villkoret på rätt alternativ", async () => {
    const editor = await mounted(false);
    const brytare = block(editor, "curry").querySelector<HTMLInputElement>(
      '[data-option-visibility-property="enabled"]',
    )!;

    brytare.checked = true;
    brytare.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const options = () =>
      (editor.getData().nodes.find((node) => node.id === "meny")!.data.options as Array<{
        id: string;
        visibility?: unknown;
      }>);

    expect(options().find((option) => option.id === "curry")?.visibility).toBeTruthy();
    expect(options().find((option) => option.id === "veg")?.visibility).toBeUndefined();

    const av = block(editor, "curry").querySelector<HTMLInputElement>(
      '[data-option-visibility-property="enabled"]',
    )!;
    av.checked = false;
    av.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    // Av tar bort flaggan helt: ett tomt villkor i en sparad guide är brus
    // som ser ut som ett beslut.
    expect(options().find((option) => option.id === "curry")).not.toHaveProperty("visibility");
  });
});

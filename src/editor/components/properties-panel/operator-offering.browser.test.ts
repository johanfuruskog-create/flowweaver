import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { registerCodeList, unregisterCodeList } from "../../../viewer/code-lists/code-list-registry";
import { navetCountryCodes } from "../../../viewer/code-lists/navet-country-codes";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Ordet följer variabeln, och `lika med` erbjuds inte på en lista.
 *
 * ## Var det här hittades
 *
 * Johan på plattan 31/8, om medborgarskapsexemplets villkor *land.value är
 * någon av XS*: *"borde det inte vara lika med?"* Nej — svaret är en lista, och
 * `one-of` betyder "något av dina svar finns i listan". Villkoret var rätt;
 * **ordet** var skrivet för ett svar mot flera värden.
 *
 * Två beslut kom ur det (31/8):
 *
 * 1. På en flervärd variabel heter de fyra *innehåller något av*, *innehåller
 *    inget av*, *innehåller bara* och *innehåller annat än*. På en envärd står
 *    *är någon av* kvar. Det viktiga är att de fyra läses som fyra OLIKA
 *    frågor.
 * 2. `lika med` erbjuds inte på en flervärd variabel. I motorn betyder den
 *    "hela listan, som text, är exakt det här" — avsiktligt strängt (se
 *    `rule-evaluator.ts`), men som erbjudande en fälla. Motorn rörs inte, och
 *    en graf som redan har `equals` på en lista utvärderas som förut.
 *
 * ## Varför det befintliga valet ändå VISAS
 *
 * För att en `<select>` som inte innehåller sitt eget värde visar något annat
 * — det första alternativet — och nästa gång någon rör panelen sparas det. En
 * regel skulle alltså tyst byta betydelse av att ha öppnats. Samma mönster som
 * variabelväljarens rad för en variabel guiden inte längre har.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterCodeList("navet-country-codes");
});

const settle = (ms = 160) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const flervärtUppslag = {
  type: "multi-autocomplete-question",
  data: {
    title: { sv: "Länder" },
    variableName: "land",
    variableLabel: "Medborgarskap",
    source: "codelist",
    codeListId: "navet-country-codes",
  },
};

const enkeltUppslag = { ...flervärtUppslag, type: "autocomplete-question" };

/** Regelpanelen för ett villkor på `land.value`. */
async function regelpanel(fråga: Record<string, unknown>, operator: string) {
  registerCodeList(navetCountryCodes);

  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q",
    nodes: [
      { id: "q", position: { x: 0, y: 0 }, ...fråga },
      {
        id: "r",
        type: "rule",
        position: { x: 400, y: 0 },
        data: {
          title: { sv: "Var?" },
          cases: [{
            id: "c",
            label: "Norden",
            match: "any",
            conditions: [{ id: "v", variableName: "land.value", operator, value: "SE" }],
          }],
        },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("r");
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

/** Synlighetspanelen för ett sidfält som beror på en flervalsfråga. */
async function synlighetspanel(frågetyp: string) {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "s",
    nodes: [
      { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      {
        id: "q",
        type: frågetyp,
        position: { x: 0, y: 0 },
        parentPageId: "s",
        order: 1,
        layout: { columnSpan: 12 },
        data: {
          title: { sv: "Tjänster" },
          variableName: "tjanster",
          options: [
            { id: "a", label: { sv: "Bygglov" }, value: "bygglov" },
            { id: "b", label: { sv: "Sophämtning" }, value: "sopor" },
          ],
        },
      },
      {
        id: "f",
        type: "text-question",
        position: { x: 0, y: 0 },
        parentPageId: "s",
        order: 2,
        layout: { columnSpan: 12 },
        visibility: {
          match: "all",
          conditions: [{ id: "v", variableName: "tjanster", operator: "one-of", value: "bygglov" }],
        },
        data: { title: { sv: "Fastighetsbeteckning" }, variableName: "fastighet" },
      },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById("f");
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

const orden = (panel: ShadowRoot, selector: string): string[] =>
  [...panel.querySelectorAll<HTMLOptionElement>(`select[${selector}] option`)]
    .map((one) => one.textContent!.trim());

const regelorden = (panel: ShadowRoot) =>
  orden(panel, "data-rule-condition-property='operator'");

describe("regelvillkoret på en flervärd variabel", () => {
  test("erbjuder de fyra frågorna en lista har, i innehåller-form", async () => {
    const panel = await regelpanel(flervärtUppslag, "one-of");

    expect(regelorden(panel)).toEqual([
      "Innehåller något av",
      "Innehåller inget av",
      "Innehåller bara",
      "Innehåller annat än",
    ]);
  });

  test("och erbjuder inte 'lika med'", async () => {
    const panel = await regelpanel(flervärtUppslag, "one-of");

    expect(regelorden(panel)).not.toContain("Är lika med");
    expect(regelorden(panel)).not.toContain("Är inte lika med");
  });

  test("men visar ett befintligt equals-villkor med sitt eget ord, valt", async () => {
    const panel = await regelpanel(flervärtUppslag, "equals");
    const vald = panel.querySelector<HTMLSelectElement>(
      "select[data-rule-condition-property='operator']",
    )!;

    expect(vald.value).toBe("equals");
    expect(regelorden(panel)).toContain("Är lika med");
  });
});

describe("regelvillkoret på en envärd variabel", () => {
  test("står kvar med 'är'-orden", async () => {
    const panel = await regelpanel(enkeltUppslag, "one-of");

    expect(regelorden(panel)).toEqual([
      "Är lika med",
      "Är inte lika med",
      "Är någon av",
      "Är inte någon av",
    ]);
  });

  test("och erbjuder inte alla-paret, som är dubbletter där", async () => {
    // På ett enskilt svar är `all-of` samma fråga som `one-of` — bevisat i
    // `rule-all-of.test.ts`. Två rader som betyder samma sak är en fälla.
    const panel = await regelpanel(enkeltUppslag, "one-of");

    expect(regelorden(panel)).not.toContain("Innehåller bara");
    expect(regelorden(panel)).not.toContain("Innehåller annat än");
  });

  test("men visar ett befintligt all-of-villkor, valt", async () => {
    const panel = await regelpanel(enkeltUppslag, "all-of");
    const vald = panel.querySelector<HTMLSelectElement>(
      "select[data-rule-condition-property='operator']",
    )!;

    expect(vald.value).toBe("all-of");
  });
});

describe("värdet till de nya operatorerna", () => {
  test("väljs som flera, precis som till 'innehåller något av'", async () => {
    // `all-of` läser sitt värde som en kommalista. Ritades det som ett enkelval
    // vore operatorn en omväg till `equals`.
    const panel = await regelpanel(flervärtUppslag, "all-of");
    const picker = panel.querySelector("[data-rule-value-picker]")!;

    expect(picker.hasAttribute("single")).toBe(false);
  });
});

describe("sidfältets synlighet ställer samma fråga", () => {
  test("så den får samma ord på en flervalsfråga", async () => {
    const panel = await synlighetspanel("multi-choice");
    const ord = orden(panel, "data-visibility-property='operator'");

    expect(ord.slice(0, 4)).toEqual([
      "Innehåller något av",
      "Innehåller inget av",
      "Innehåller bara",
      "Innehåller annat än",
    ]);
    expect(ord).not.toContain("Är lika med");
  });

  test("och 'är'-orden på en envalsfråga", async () => {
    const panel = await synlighetspanel("question");
    const ord = orden(panel, "data-visibility-property='operator'");

    expect(ord.slice(0, 4)).toEqual([
      "Är lika med",
      "Är inte lika med",
      "Är någon av",
      "Är inte någon av",
    ]);
    expect(ord).not.toContain("Innehåller bara");
  });
});

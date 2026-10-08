import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { FieldPicker } from "../field-picker/field-picker";

/**
 * "Välj variabel" är inte en variabel.
 *
 * Johan, på iPaden 31/8, med regelns variabellista öppen: *"välj en variabel
 * — det är ingen variabel."* iOS ritar en `<select>` som en lista med bock
 * på det valda, och platshållaren stod där som ett alternativ bland
 * variablerna, med bocken på sig. En webbläsare med mus visar den bara som
 * rutans text, så ingen hade sett den som ett val.
 *
 * Platshållaren är `disabled`: den syns (grå) så länge inget är valt, men
 * går inte att välja. Det är plattformens egen form för "inget valt än", och
 * den gäller alla tre väljare som har platshållaren — regelns villkor,
 * sidfältets synlighet och e-postväljaren — så att en plattanvändare möter
 * en regel och inte tre.
 *
 * Sedan story 143 (30/9) är villkorets väljare `<field-picker>`, inte en
 * `<select>`: platshållaren *Välj fråga eller variabel* är det stängda
 * fältets text och ingen rad i listan. Avsikten är densamma — den syns när
 * inget är valt, och den går inte att välja.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 180) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function panelFor(nodes: unknown[], selected: string): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = { startNodeId: "s", nodes, connections: [] } as never;

  await settle();
  await settle();

  editor.shadowRoot!
    .querySelector<HTMLElement & { selectNodeById(id: string): void }>("node-editor")!
    .selectNodeById(selected);
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;
}

const fråga = {
  id: "s",
  type: "question",
  position: { x: 0, y: 0 },
  data: {
    title: { sv: "Har du bil?" },
    variableName: "bil",
    options: [{ id: "ja", label: { sv: "Ja" }, value: "yes" }],
  },
};

/** The placeholder stands in the closed field, and no row of the list is it. */
function expectPlaceholderOnly(picker: FieldPicker): void {
  const rows = [...picker.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')];

  expect(picker, "väljaren finns").not.toBeNull();
  expect(picker.value, "inget valt").toBe("");
  expect(picker.shadowRoot!.querySelector(".control__text")!.textContent, "men platshållaren står i rutan").toBe("Välj fråga eller variabel");
  expect(rows.length, "listan har rader").toBeGreaterThan(0);
  expect(picker.options.map((option) => option.value), "platshållaren är inte en variabel").not.toContain("");
  expect(rows.map((row) => row.textContent), "och ingen rad heter som den").not.toContainEqual(expect.stringContaining("Välj"));
  expect(picker.shadowRoot!.querySelector('[aria-selected="true"]'), "ingen rad är vald").toBeNull();
}

describe("platshållaren i variabelväljaren", () => {
  test("går inte att välja i regelns villkor", async () => {
    const panel = await panelFor(
      [
        fråga,
        {
          id: "r",
          type: "rule",
          position: { x: 400, y: 0 },
          data: {
            title: { sv: "Var?" },
            cases: [
              {
                id: "c",
                label: "Ny",
                match: "any",
                conditions: [{ id: "v", variableName: "", operator: "equals", value: "" }],
              },
            ],
          },
        },
      ],
      "r",
    );
    expectPlaceholderOnly(panel.querySelector<FieldPicker>('field-picker[data-rule-condition-property="variableName"]')!);
  });

  test("och inte i sidfältets synlighet", async () => {
    const panel = await panelFor(
      [
        { id: "s", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        { ...fråga, id: "q", parentPageId: "s", order: 1, layout: { columnSpan: 12 } },
        {
          id: "f",
          type: "text-question",
          position: { x: 0, y: 0 },
          parentPageId: "s",
          order: 2,
          layout: { columnSpan: 12 },
          visibility: {
            match: "all",
            conditions: [{ id: "v", variableName: "", operator: "equals", value: "" }],
          },
          data: { title: { sv: "Registreringsnummer" }, variableName: "regnr" },
        },
      ],
      "f",
    );
    expectPlaceholderOnly(panel.querySelector<FieldPicker>('field-picker[data-visibility-property="variableName"]')!);
  });
});

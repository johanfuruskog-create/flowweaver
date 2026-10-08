import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";
import type { QuestionOption } from "../../../viewer/types/graph";

/**
 * Vägen in till berättelse 062: redaktören märker alternativet som står ensamt.
 *
 * ## Varför bara på en flervalsfråga
 *
 * Ett enkelval ersätter redan varje val med det nya — där finns ingenting att
 * utesluta, och en lysknapp som inte gör något är värre än ingen alls (praxis
 * 9: be aldrig redaktören bestämma sådant som inte är deras). Kardinaliteten
 * läses ur nodtypens `behavior.answer.cardinality`, samma hem som
 * operatorerna använder — inte ur typens namn.
 *
 * ## Varför flaggan tas BORT när knappen slås av
 *
 * `exclusive: false` i en sparad guide är brus som ser ut som ett beslut, och
 * frånvaro är det som betyder samma sak överallt annars.
 */

afterEach(() => document.body.replaceChildren());

const OPTIONS = [
  { id: "a", label: "Danmark", value: "DK" },
  { id: "b", label: "Statslös", value: "XS" },
];

function mount(type: string, options: unknown[] = OPTIONS): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "q",
    type,
    position: { x: 0, y: 0 },
    data: { title: "Vilka länder?", variableName: "land", options },
  } as never;

  return panel;
}

const switchOf = (panel: PropertiesPanel, id: string): HTMLInputElement | null =>
  panel.shadowRoot!.querySelector<HTMLInputElement>(
    `[data-option-id="${id}"] [data-option-property="exclusive"]`,
  );

describe("lysknappen per alternativ", () => {
  test("erbjuds på en flervalsfråga, med ord ur registret", () => {
    const panel = mount("multi-choice");

    expect(switchOf(panel, "a"), "ingen lysknapp på alternativet").not.toBeNull();
    expect(switchOf(panel, "a")!.getAttribute("role")).toBe("switch");
    expect(
      switchOf(panel, "a")!.closest("label")?.textContent?.trim(),
    ).toContain("Utesluter andra val");
  });

  test("erbjuds inte på ett enkelval — där ersätter varje val redan det förra", () => {
    const panel = mount("question");

    expect(switchOf(panel, "a")).toBeNull();
  });

  test("står på för ett alternativ som redan bär flaggan", () => {
    const panel = mount("multi-choice", [
      { id: "a", label: "Danmark", value: "DK" },
      { id: "b", label: "Statslös", value: "XS", exclusive: true },
    ]);

    expect(switchOf(panel, "a")!.checked).toBe(false);
    expect(switchOf(panel, "b")!.checked).toBe(true);
  });
});

describe("vad panelen rapporterar", () => {
  const reported = (panel: PropertiesPanel): Promise<QuestionOption[]> =>
    new Promise((resolve) => {
      panel.addEventListener(
        "node-data-changed",
        (event) =>
          resolve(
            (event as CustomEvent<{ property: string; value: QuestionOption[] }>).detail
              .value,
          ),
        { once: true },
      );
    });

  test("slår på flaggan på just det alternativet", async () => {
    const panel = mount("multi-choice");
    const heard = reported(panel);

    switchOf(panel, "b")!.click();

    const options = await heard;

    expect(options.map((one) => one.exclusive)).toEqual([undefined, true]);
  });

  test("tar bort flaggan igen i stället för att skriva false", async () => {
    const panel = mount("multi-choice", [
      { id: "a", label: "Danmark", value: "DK" },
      { id: "b", label: "Statslös", value: "XS", exclusive: true },
    ]);
    const heard = reported(panel);

    switchOf(panel, "b")!.click();

    const options = await heard;

    expect(Object.hasOwn(options[1]!, "exclusive")).toBe(false);
  });

  test("rör inte etiketten eller värdet", async () => {
    const panel = mount("multi-choice");
    const heard = reported(panel);

    switchOf(panel, "b")!.click();

    const options = await heard;

    expect(options.map((one) => `${String(one.label)}=${one.value}`)).toEqual([
      "Danmark=DK",
      "Statslös=XS",
    ]);
  });
});

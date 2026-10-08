import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";
import { evaluateFormula } from "../../../viewer/core/formula-evaluator";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Uppdrag 29/9 Del D, Astras spec §10: formelhjälpen fälls ut direkt under
 * formelfältet i kortet, stängd från början, och går att läsa medan man
 * skriver. Den dokumenterar bara det parsern kan: varje exempel är vanlig
 * formeltext som `evaluateFormula` räknar ut.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(ruleCalcAstraGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("rc-calc");
  await settle();
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  await userEvent.click(panel.querySelector<HTMLElement>('[data-assignment-id="rc-a-total"] [data-action="toggle-assignment"]')!);
  return panel;
}

describe("formelhjälpen", () => {
  test("står direkt under formelfältet, stängd från början", async () => {
    const panel = await mount();
    const card = panel.querySelector<HTMLElement>('[data-assignment-id="rc-a-total"]')!;
    const help = card.querySelector<HTMLDetailsElement>("details[data-formula-help]")!;
    const formula = card.querySelector<HTMLElement>('[data-assignment-property="formula"]')!;

    expect(help, "hjälpen finns i kortet").not.toBeNull();
    expect(help.open).toBe(false);
    expect(formula.closest("label")!.nextElementSibling, "direkt under formeln").toBe(help);
  });

  test("rubrikraden står mitt i sin 44 px-rad, som Avancerat — inte högst upp med luften under (Fia 29/9)", async () => {
    const panel = await mount();
    const summary = panel.querySelector<HTMLElement>('[data-assignment-id="rc-a-total"] details[data-formula-help] > summary')!;
    const row = summary.getBoundingClientRect();
    const range = document.createRange();

    range.selectNodeContents(summary);
    const words = range.getBoundingClientRect();

    expect(row.height).toBeGreaterThanOrEqual(44);
    // Measured 29/9: 8 px above the words, 22 px below.
    expect(Math.abs((words.top - row.top) - (row.bottom - words.bottom))).toBeLessThanOrEqual(2);
  });

  test("har avsnitten, och de utfällbara för fler funktioner och datum", async () => {
    const panel = await mount();
    const help = panel.querySelector<HTMLDetailsElement>('[data-assignment-id="rc-a-total"] details[data-formula-help]')!;
    const text = help.textContent!;

    for (const heading of ["Skriv en formel", "Räknesätt", "Tal och argument", "Vanliga funktioner"]) {
      expect(text).toContain(heading);
    }
    for (const name of ["round", "min", "max", "pow"]) expect(text).toContain(name);
    const nested = [...help.querySelectorAll<HTMLDetailsElement>("details")];
    expect(nested.map((one) => one.querySelector("summary")!.textContent!.trim())).toEqual(["Fler funktioner", "Datum och ålder"]);
    expect(nested[0]!.textContent).toMatch(/floor[\s\S]*ceil[\s\S]*abs[\s\S]*sqrt/);
    expect(nested[1]!.textContent).toMatch(/age\(personnummer\)[\s\S]*days\(från; till\)[\s\S]*idag/);
  });

  test("varje exempel är formeltext parsern räknar ut", async () => {
    const panel = await mount();
    const examples = [...panel.querySelectorAll<HTMLElement>('[data-assignment-id="rc-a-total"] [data-formula-example]')]
      .map((one) => one.textContent!.trim());
    const values = {
      inkomst: 30000, pris: 2000000, kontantinsats: 300000, grund: 3000, barntillagg: 4500, lan: 1700000, r: 0.004, n: 360,
    };
    const texts = { personnummer: "19800101-1234", flytt: "2026-01-01", fran: "2026-01-01", till: "2026-02-01", idag: "2026-09-29" };

    expect(examples.length).toBeGreaterThanOrEqual(6);
    for (const example of examples) {
      const result = evaluateFormula(example, values, { texts } as never);
      expect(result.success, `${example}: ${"error" in result ? result.error : ""}`).toBe(true);
    }
  });

  test("den långa formelspråkstexten under listan är borta", async () => {
    const panel = await mount();

    expect(panel.textContent).not.toContain("Varje rad sätter en variabel till resultatet av en formel");
  });
});

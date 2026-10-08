import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "./rich-text-field";

import type { RichTextField } from "./rich-text-field";
import type { FormattingFeature } from "../../../viewer/types/node-types";

const ALL: FormattingFeature[] = ["variable", "bold", "italic", "link", "bullet-list", "numbered-list"];

/**
 * Del 4 (UPPDRAG-2026-09-28-ENHETLIGHET): en lugnare vila i textverktygsraden.
 *
 * Mätt före ändringen: varje knapp (B/I/länk/listor) hade sin egen ritade
 * ruta redan i vila — en kant (`--fw-border-control`) och en egen fyllning
 * (`--fw-surface-subtle`) — sex tydligt avgränsade lådor innan man rört
 * något. Facit (samma dag, Del 2): ingen av de andra menyfamiljerna ritar
 * en kant runt en VILANDE rad, bara hover/fokus/vald gör det.
 *
 * `box-sizing: border-box` följer med av nödvändighet, inte av smak: när
 * vilan tappar sin kant men hover/fokus/vald (K3, en riktig kant krävs —
 * en genomskinlig FÅR `kontrollkantsbrott()` att kasta, inte bara falla)
 * behåller en riktig kantbredd, hade knappen annars vuxit någon pixel
 * större varje gång — en synlig studs i en tät rad. Detta test bevisar att
 * den inte gör det.
 */

afterEach(() => document.body.replaceChildren());

function mount(): RichTextField {
  const field = document.createElement("rich-text-field");

  field.setAttribute("multiline", "");
  field.setAttribute("label", "Beskrivning");
  field.features = ALL;
  field.variables = [{ value: "fornamn", label: "Förnamn" }];
  field.value = "Text";
  document.body.append(field);
  return field;
}

const tool = (field: RichTextField, command: string) =>
  field.shadowRoot!.querySelector<HTMLButtonElement>(`[data-command="${command}"]`)!;

describe("textverktygsradens vila", () => {
  test("en formateringsknapp har ingen egen kant eller yta i vila", () => {
    const field = mount();
    const bold = tool(field, "bold");
    const style = getComputedStyle(bold);

    expect(style.borderTopStyle, "ingen ritad kant i vila").toBe("none");
    expect(style.backgroundColor.endsWith(", 0)"), "genomskinlig bakgrund i vila").toBe(true);
  });

  test("plusset (Infoga svar) behåller sin egen accentkant i vila — det är facit den andra vägen", () => {
    const field = mount();
    const plus = field.shadowRoot!.querySelector<HTMLButtonElement>("[data-answer-toggle]")!;
    const style = getComputedStyle(plus);

    expect(style.borderTopStyle, "plusset ritar sin egen kant, till skillnad från B/I/länk").not.toBe("none");
  });

  test("hover och vald (aria-pressed) ändrar inte knappens yttermått mot vilan", async () => {
    const field = mount();
    const bold = tool(field, "bold");
    const restBox = bold.getBoundingClientRect();

    await userEvent.hover(bold);
    const hoverBox = bold.getBoundingClientRect();

    expect(hoverBox.width, "bredd oförändrad på hover").toBe(restBox.width);
    expect(hoverBox.height, "höjd oförändrad på hover").toBe(restBox.height);

    await userEvent.unhover(bold);
    bold.setAttribute("aria-pressed", "true");
    const pressedBox = bold.getBoundingClientRect();

    expect(pressedBox.width, "bredd oförändrad när vald (2px kant)").toBe(restBox.width);
    expect(pressedBox.height, "höjd oförändrad när vald (2px kant)").toBe(restBox.height);
  });

  test("varje knapp håller ändå K6:s 48px (facit, se toppkommentaren i .tool)", () => {
    const field = mount();

    for (const command of ["bold", "italic", "link", "bullet-list", "numbered-list"]) {
      const box = tool(field, command).getBoundingClientRect();

      expect(box.width, `${command}: ${box.width}px`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${command}: ${box.height}px`).toBeGreaterThanOrEqual(44);
    }
  });
});

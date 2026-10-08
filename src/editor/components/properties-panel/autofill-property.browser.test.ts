import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import { AUTOFILL_TOKENS } from "../../../viewer/core/autofill";

import type { PropertiesPanel } from "./properties-panel";

/**
 * *Vad fältet är* (story 110): the editor says what a text field holds.
 *
 * Nothing is read off the title — see `viewer/core/autofill.ts` — so this is
 * where the word is chosen, and the list is the browser's, not ours. A format
 * that already carries a word (e-post, telefon, postnummer) has said the same
 * thing, so the choice is not offered beside it: two settings for one answer
 * is two things to disagree.
 */

afterEach(() => document.body.replaceChildren());

function panelFor(data: Record<string, unknown>, locale = "sv"): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  // Opt in: the default is readonly, and this test builds.
  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.editorLocale = locale;
  panel.nodeData = {
    id: "q",
    type: "text-question",
    position: { x: 0, y: 0 },
    data: { title: "Namn", variableName: "namn", ...data },
  };

  return panel;
}

const autofillSelect = (panel: PropertiesPanel) =>
  panel.shadowRoot!.querySelector<HTMLSelectElement>('select[data-property="autofill"]');

describe("vad fältet är", () => {
  test("erbjuder webbläsarens ord och inget annat, med svenska etiketter", () => {
    const select = autofillSelect(panelFor({}))!;

    expect([...select.options].map((option) => option.value)).toEqual([
      "",
      ...AUTOFILL_TOKENS,
    ]);
    expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
      "Inget",
      "Namn",
      "Förnamn",
      "Efternamn",
      "Gatuadress",
      "Ort",
      "Land",
      "Organisation",
    ]);
  });

  test("etiketterna finns på engelska", () => {
    const panel = panelFor({}, "en");
    const select = autofillSelect(panel)!;
    const text = panel.shadowRoot?.textContent ?? "";

    expect(text).toContain("What the field is");
    expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
      "None",
      "Name",
      "First name",
      "Last name",
      "Street address",
      "City or town",
      "Country",
      "Organisation",
    ]);
    expect(text).not.toContain("Gatuadress");
  });

  test.each(["email", "phone", "postnummer"])(
    "formatet %s bär redan ordet — valet visas inte",
    (format) => {
      expect(autofillSelect(panelFor({ format }))).toBeNull();
    },
  );

  test("ett format utan eget ord lämnar valet kvar", () => {
    expect(autofillSelect(panelFor({ format: "personnummer" }))).not.toBeNull();
  });

  test("valet försvinner samma stund redaktören väljer e-post", async () => {
    const panel = panelFor({ autofill: "name" });

    expect(autofillSelect(panel)).not.toBeNull();

    const format = panel.shadowRoot!.querySelector<HTMLSelectElement>(
      'select[data-property="format"]',
    )!;

    await userEvent.selectOptions(format, "email");

    expect(autofillSelect(panel)).toBeNull();
    // Fokus stannar i fältet som ändrades, som vid varje annan grind.
    expect(panel.shadowRoot!.activeElement).toBe(
      panel.shadowRoot!.querySelector('select[data-property="format"]'),
    );
  });
});

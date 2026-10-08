import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { ruleCalcAstraGraph } from "../../../data/rule-calc-astra-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Astras skisser 03, 04 och 05 (29/9, Johan: "Viktigt att vi följer
 * skisserna"): the shapes the rule and calculation cards take from them,
 * measured in the rendered panel. Each assertion names the sketch it holds.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(nodeId: string): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(ruleCalcAstraGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById(nodeId);
  await settle();
  await settle();
  const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

  for (const toggle of panel.querySelectorAll<HTMLButtonElement>('[data-action^="toggle-"][aria-expanded="false"]')) toggle.click();
  await settle();
  return panel;
}

const box = (el: Element) => el.getBoundingClientRect();

describe("regelkortet enligt bild 03", () => {
  test("'Villkor 1' är ett band över gruppens hela bredd, på en annan yta än gruppen", async () => {
    const panel = await mount("rc-rule");
    const heading = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-house"] .properties-panel__condition-heading')!;
    const group = heading.closest<HTMLElement>(".properties-panel__condition")!;

    expect(box(heading).width).toBeGreaterThanOrEqual(box(group).width - 2);
    expect(box(heading).top - box(group).top).toBeLessThanOrEqual(1);
    expect(getComputedStyle(heading).backgroundColor).not.toBe(getComputedStyle(group).backgroundColor);
  });

  test("OCH/ELLER står mellan två linjer", async () => {
    const panel = await mount("rc-rule");
    const join = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-house"] .properties-panel__condition-join')!;

    for (const side of ["::before", "::after"]) {
      expect(parseFloat(getComputedStyle(join, side).width), side).toBeGreaterThan(40);
      expect(getComputedStyle(join, side).height).toBe("1px");
    }
  });

  test("'Lägg till villkor' är samma fullbreda konturknapp som 'Lägg till regel'", async () => {
    const panel = await mount("rc-rule");
    const card = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-house"]')!;
    const add = card.querySelector<HTMLElement>('[data-action="add-rule-condition"]')!;
    const addRule = panel.querySelector<HTMLElement>('[data-action="add-rule-case"]')!;
    const name = card.querySelector<HTMLElement>('[data-rule-case-property="label"]')!;

    expect(box(add).width).toBeCloseTo(box(name).width, 0);
    for (const property of ["borderTopStyle", "borderTopColor", "backgroundColor", "color"] as const) {
      expect(getComputedStyle(add)[property], property).toBe(getComputedStyle(addRule)[property]);
    }
    // One plus, and it is the icon: the words carry none. Until 2/10 the
    // string held a "+" too and this line counted it as the one — the test
    // approved "+ + Lägg till villkor" (Johan saw it in the recap film).
    expect(add.querySelectorAll("svg")).toHaveLength(addRule.querySelectorAll("svg").length);
    expect(add.querySelectorAll("svg")).toHaveLength(1);
    expect(add.textContent).not.toMatch(/\+/);
  });

  test("plusset i 'Lägg till' och papperskorgen i 'Ta bort' har knappens egen färg och storlek, inte fältrubrikens", async () => {
    const panel = await mount("rc-rule");

    for (const selector of ['[data-action="add-rule-case"]', '[data-action="remove-rule-case"]', '[data-action="remove-rule-condition"]']) {
      const button = panel.querySelector<HTMLElement>(selector)!;
      const sign = button.querySelector<HTMLElement>(":scope > span")!;

      // Measured 29/9: the field's caption rule made them 12 px, uppercase, muted.
      expect(getComputedStyle(sign).color, selector).toBe(getComputedStyle(button).color);
      expect(getComputedStyle(sign).fontSize, selector).toBe(getComputedStyle(button).fontSize);
    }
  });

  test("ett öppet kort har ingen färgad ram — huvudets ljusa band bär öppet läge (bild 03/05)", async () => {
    const panel = await mount("rc-rule");
    const open = panel.querySelector<HTMLElement>('[data-rule-case-id="rc-case-house"]')!;
    const closedPanel = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;
    const head = open.querySelector<HTMLElement>(":scope > .properties-panel__option-header")!;

    expect(open.hasAttribute("data-rule-case-open")).toBe(true);
    expect(getComputedStyle(open).borderTopColor).toBe(getComputedStyle(closedPanel).borderTopColor);
    expect(getComputedStyle(head).backgroundColor).not.toBe(getComputedStyle(open).backgroundColor);
  });

  test("Annars har inget huvudband, och hjälpraderna läses i 13 px", async () => {
    const panel = await mount("rc-rule");
    const otherwise = panel.querySelector<HTMLElement>("[data-rule-otherwise]")!;
    const head = otherwise.querySelector<HTMLElement>(".properties-panel__option-header")!;

    // No band: the head is see-through, the card's own surface shows.
    expect(["rgba(0, 0, 0, 0)", getComputedStyle(otherwise).backgroundColor]).toContain(getComputedStyle(head).backgroundColor);
    expect(getComputedStyle(otherwise.querySelector(".properties-panel__option-body")!).borderTopWidth).toBe("0px");
    expect(getComputedStyle(otherwise.querySelector(".properties-panel__options-hint")!).fontSize).toBe("13px");
  });
});

describe("villkoret på de andra ställena", () => {
  test("'Visa alternativet när' står inte mindre än etiketterna under sig", async () => {
    const panel = await mount("rc-housing");
    const toggle = panel.querySelector<HTMLInputElement>('[data-option-id="rc-h-house"] [data-option-visibility-property="enabled"]')!;

    toggle.click();
    await settle();
    const section = panel.querySelector<HTMLElement>('.properties-panel__option-visibility[data-option-id="rc-h-house"]')!;
    const heading = section.querySelector<HTMLElement>(".properties-panel__option-visibility-heading")!;
    const label = section.querySelector<HTMLElement>(".properties-panel__condition > label")!;

    // Measured 29/9: 13 px / 600 over 14 px / 700 labels.
    expect(parseFloat(getComputedStyle(heading).fontSize)).toBeGreaterThanOrEqual(parseFloat(getComputedStyle(label).fontSize));
    expect(Number(getComputedStyle(heading).fontWeight)).toBeGreaterThanOrEqual(Number(getComputedStyle(label).fontWeight));
  });
});

describe("uträkningskortet enligt bild 03, 04 och 05", () => {
  test("variabelnamnet står i formelns typsnitt", async () => {
    const panel = await mount("rc-calc");
    const name = panel.querySelector<HTMLInputElement>('[data-assignment-id="rc-a-total"] [data-assignment-property="variableName"]')!;

    expect(getComputedStyle(name).fontFamily).toMatch(/mono/i);
  });

  test("Formelhjälp är en fullbred rad med chevronen till höger, utan webbläsarens markör", async () => {
    const panel = await mount("rc-calc");
    const summary = panel.querySelector<HTMLElement>('[data-assignment-id="rc-a-total"] details[data-formula-help] > summary')!;
    const after = getComputedStyle(summary, "::after");

    expect(getComputedStyle(summary).display).toBe("flex");
    expect(getComputedStyle(summary).justifyContent).toBe("space-between");
    expect(after.borderRightStyle).toBe("solid");
    expect(after.transform).not.toBe("none");
    // The card's label size, as *Formel* above it.
    const formulaLabel = panel.querySelector<HTMLElement>('[data-assignment-id="rc-a-total"] rich-text-field')!.closest("label")!;
    expect(getComputedStyle(summary).fontSize).toBe(getComputedStyle(formulaLabel).fontSize);
  });

  test("bild 04: en funktion är syntaxen på en rad och vad den gör på nästa, med en linje mellan funktionerna", async () => {
    const panel = await mount("rc-calc");
    const help = panel.querySelector<HTMLDetailsElement>('[data-assignment-id="rc-a-total"] details[data-formula-help]')!;

    help.open = true;
    await settle();
    const rows = [...help.querySelectorAll<HTMLElement>(":scope > div > section .properties-panel__formula-functions > div")];

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(box(row.querySelector("dd")!).top, row.textContent!).toBeGreaterThanOrEqual(box(row.querySelector("dt")!).bottom - 1);
      expect(getComputedStyle(row).borderTopStyle).toBe("solid");
    }
    expect(help.querySelector(".properties-panel__formula-strip"), "räknesätten som en remsa").not.toBeNull();
    expect(help.textContent).toContain("Infoga variabel hämtar namnet från guiden.");
  });
});

/**
 * Astras granskning av vända 1 (bilaga 2, 29/9), punkt 1 och 2: the
 * section heading of the rules and the calculations is the answer options'
 * own heading, in sentence case; inside the shared cards a field label is
 * `--fw-weight-strong`, a heading `--fw-weight-heading`, a value normal.
 * Measured before the change: every card label at 700, the same as the
 * card titles, and *Regler* and *Uträkningar* as 12 px uppercase captions.
 */
describe("bilaga 2 — rubrikhierarkin och de lugnare etiketterna", () => {
  const weight = (el: Element) => getComputedStyle(el).fontWeight;
  const token = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

  test("'Regler' och 'Uträkningar' ritas som 'Svarsalternativ'", async () => {
    const options = await mount("rc-housing");
    const reference = options.querySelector<HTMLElement>(".properties-panel__options-heading h3")!;
    const style = (el: Element) => {
      const cs = getComputedStyle(el);
      return { size: cs.fontSize, weight: cs.fontWeight, color: cs.color, transform: cs.textTransform, spacing: cs.letterSpacing };
    };
    const expected = style(reference);

    document.body.replaceChildren();
    for (const [node, text] of [["rc-rule", "Regler"], ["rc-calc", "Uträkningar"]] as const) {
      const panel = await mount(node);
      const heading = panel.querySelector<HTMLElement>(".properties-panel__options-heading h3");

      expect(heading?.textContent?.trim(), node).toBe(text);
      expect(style(heading!), node).toEqual(expected);
      document.body.replaceChildren();
    }
  });

  test("i korten: etiketter i strong-vikt, rubriker i heading-vikt, värden i normal vikt", async () => {
    const cases = [
      ["rc-housing", '[data-option-id="rc-h-rent"]'],
      ["rc-rule", '[data-rule-case-id="rc-case-house"]'],
      ["rc-calc", '[data-assignment-id="rc-a-total"]'],
    ] as const;

    for (const [node, cardSelector] of cases) {
      const panel = await mount(node);
      const card = panel.querySelector<HTMLElement>(cardSelector)!.closest(".properties-panel__option--card") ?? panel.querySelector<HTMLElement>(cardSelector)!;
      const strong = token(card, "--fw-weight-strong");
      const heading = token(card, "--fw-weight-heading");
      const labels = [
        ...card.querySelectorAll<HTMLElement>(".properties-panel__option-body > label:not(.properties-panel__option-exclusive)"),
        ...card.querySelectorAll<HTMLElement>(".properties-panel__condition > label, .properties-panel__condition-combine"),
      ];

      expect(labels.length, node).toBeGreaterThan(0);
      for (const label of labels) {
        expect(weight(label), `${node}: ${label.textContent?.trim().slice(0, 24)}`).toBe(strong);
        for (const value of label.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select")) {
          expect(weight(value), `${node}: värdet i ${label.textContent?.trim().slice(0, 24)}`).toBe("400");
        }
      }
      expect(weight(card.querySelector(".properties-panel__option-title")!), `${node}: kortets rubrik`).toBe(heading);
      for (const group of card.querySelectorAll(".properties-panel__condition-heading")) {
        expect(weight(group), `${node}: ${group.textContent}`).toBe(heading);
      }
      document.body.replaceChildren();
    }
  });
});

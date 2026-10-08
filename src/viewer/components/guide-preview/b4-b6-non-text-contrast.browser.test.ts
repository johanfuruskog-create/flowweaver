import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { effektivBakgrund, kontrast, tillRgba } from "../../../testing/contrast";
import { applyPalette, palettes } from "../../styles/palettes";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * WCAG 1.4.11 (3:1) for the B4-B6 non-text indicators that neither
 * `kontrollkantsbrott` nor `guide-preview-boundary-contrast` reach:
 *
 * - the group's own 3 px edge (`[data-invalid][data-group]`,
 *   `fieldset.guide-preview__options[data-invalid]`) — a `<fieldset>`/`<div>`,
 *   not in `kontrollkantsbrott`'s `input, select, textarea, button, [role]`
 *   selector;
 * - the search field's red edge, drawn on `chip-picker`'s own
 *   `.chip-picker__box` (a `<div>` inside another shadow root) rather than the
 *   `<input>` the sweep would reach;
 * - the keyboard focus ring drawn OVER an already-red field (Astra 1/10,
 *   bilaga 10 punkt 7: *"fel och fokus ska kunna visas samtidigt"*) — the
 *   sweep only ever sees one state at a time;
 * - the consent checkbox's checked accent, read off the real component in
 *   all four palettes (`palettes.browser.test.ts` already proves the token
 *   PAIRS everywhere; this proves the actual markup still draws the pair it
 *   promises).
 *
 * The standalone chosen-row edge is already measured in
 * `guide-preview-boundary-contrast.browser.test.ts`; not repeated here.
 */

afterEach(() => {
  document.body.replaceChildren();
  applyPalette(null);
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: unknown, theme?: "dark"): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  if (theme) preview.theme = theme;
  preview.style.cssText = "display:block;width:640px;";
  document.body.append(preview);
  preview.graph = graph as GraphData;
  await settle();
  return preview;
}

const next = async (preview: GuidePreview) => {
  preview.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();
};

const end = { id: "end", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Klart" } } };

const pageGraph = {
  startNodeId: "p",
  nodes: [
    { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Din vistelse" } } },
    {
      id: "nights", type: "question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Sover du över?" }, variableName: "over", required: true,
        options: [
          { id: "ja", label: { sv: "Ja" }, value: "ja" },
          { id: "nej", label: { sv: "Nej" }, value: "nej" },
        ],
      },
    },
    {
      id: "policy", type: "autocomplete-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
      data: {
        title: { sv: "Försäkring" }, variableName: "forsakring", source: "mock", minChars: 1,
        allowFreeText: false, required: true,
        mockItems: [{ value: "NF-1", label: { sv: "NF-1 Hem" } }],
      },
    },
    {
      id: "intyg", type: "consent-question", parentPageId: "p", order: 2, position: { x: 0, y: 0 },
      data: { title: { sv: "Jag intygar att uppgifterna stämmer" }, variableName: "intyg" },
    },
    end,
  ],
  connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
};

const multiStep = {
  startNodeId: "q",
  nodes: [
    {
      id: "q", type: "multi-choice", position: { x: 0, y: 0 },
      data: {
        title: { sv: "Vad har hänt?" }, variableName: "vad", required: true,
        options: [
          { id: "a", label: { sv: "Vattenskada" }, value: "vatten" },
          { id: "b", label: { sv: "Brand" }, value: "brand" },
        ],
      },
    },
    end,
  ],
  connections: [{ id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "end", portId: "input" } }],
};

describe.each([["ljust", undefined], ["mörkt", "dark" as const]])("visaren i %s tema", (_namn, tema) => {
  test("gruppens egen 3 px-kant (en fristående flerval-grupp)", async () => {
    const preview = await mount(multiStep, tema);
    await next(preview);
    const root = preview.shadowRoot!;
    const group = root.querySelector<HTMLFieldSetElement>("fieldset.guide-preview__options[data-invalid]")!;
    const style = getComputedStyle(group);

    expect(style.borderInlineStartWidth).toBe("3px");
    const edge = tillRgba(style.borderInlineStartColor);
    const bg = effektivBakgrund(group.parentElement!);
    const ratio = kontrast(edge, bg);

    expect(ratio, `${style.borderInlineStartColor} mot kortet`).toBeGreaterThanOrEqual(3);
  });

  test("gruppens egen 3 px-kant (radiogruppen på en sida)", async () => {
    const preview = await mount(pageGraph, tema);
    await next(preview);
    const root = preview.shadowRoot!;
    const cell = root.querySelector<HTMLElement>('[data-page-field-id="nights"][data-invalid][data-group]')!;
    const style = getComputedStyle(cell);

    expect(style.borderInlineStartWidth).toBe("3px");
    const edge = tillRgba(style.borderInlineStartColor);
    const bg = effektivBakgrund(cell.parentElement!);

    expect(kontrast(edge, bg), `${style.borderInlineStartColor} mot kortet`).toBeGreaterThanOrEqual(3);
  });

  test("sökfältets röda kant (chip-picker__box i felläge)", async () => {
    const preview = await mount(pageGraph, tema);
    await next(preview);
    const root = preview.shadowRoot!;
    const picker = root.querySelector<HTMLElement>("chip-picker")!;
    const box = picker.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;
    const style = getComputedStyle(box);

    expect(picker.closest("[data-invalid]"), "fältet är markerat ogiltigt").not.toBeNull();
    expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);

    const edge = tillRgba(style.borderTopColor);
    const bg = effektivBakgrund(box.parentElement!);

    expect(kontrast(edge, bg), `${style.borderTopColor} mot rutans grannskap`).toBeGreaterThanOrEqual(3);
  });

  test("fokusringen syns ÄVEN på ett fält som redan har felets röda kant", async () => {
    const preview = await mount(pageGraph, tema);
    await next(preview);
    const root = preview.shadowRoot!;
    const nightsBox = root.querySelector<HTMLElement>('[data-page-field-id="nights"]')!;
    // The text field in error: focus it for real, the way field-focus.browser.test.ts does.
    const policy = root.querySelector<HTMLElement>("chip-picker")!;
    const search = policy.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

    search.focus();
    await settle();

    const box = policy.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;
    const style = getComputedStyle(box);
    // The ring's bearer, per _focus.scss: an opaque outline in --fw-text.
    const ring = tillRgba(style.outlineColor);
    const bg = effektivBakgrund(box.parentElement!);

    expect(style.outlineStyle, "ringen är faktiskt ritad").toBe("solid");
    expect(kontrast(ring, bg), `${style.outlineColor} mot omgivningen, fält i fel`).toBeGreaterThanOrEqual(3);
    // And the error edge is still there underneath — not replaced by focus.
    expect(nightsBox.hasAttribute("data-invalid")).toBe(true);
  });
});

describe.each(Object.values(palettes))("samtyckets accent under palett=$id", (palette) => {
  describe.each([["ljust", undefined], ["mörkt", "dark" as const]])("%s", (_namn, tema) => {
    test("ikryssad: kant och bock klarar 3:1 mot kortet / mot rutans fyllning", async () => {
      applyPalette(palette);
      const preview = await mount(pageGraph, tema);
      await next(preview);
      const root = preview.shadowRoot!;
      const box = root.querySelector<HTMLInputElement>("input[data-consent]")!;

      box.click();
      await settle();
      expect(box.checked).toBe(true);

      const style = getComputedStyle(box);
      const fill = tillRgba(style.backgroundColor);
      const bg = effektivBakgrund(box.closest("label")!.parentElement!);
      const tick = tillRgba(style.getPropertyValue("--fw-on-primary") || getComputedStyle(preview).getPropertyValue("--fw-on-primary"));

      expect(kontrast(fill, bg), `rutans fyllning ${style.backgroundColor} mot kortet`).toBeGreaterThanOrEqual(3);
      expect(kontrast(tick, fill), "bocken mot rutans fyllning").toBeGreaterThanOrEqual(4.5);
    });
  });
});

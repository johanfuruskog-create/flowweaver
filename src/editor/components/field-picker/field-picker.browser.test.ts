import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "./field-picker";
import { ikonkontrastbrott, kontrast, tillRgba } from "../../../testing/contrast";

import type { FieldPicker, FieldPickerOption } from "./field-picker";

/**
 * Story 143 — the condition row's searchable field picker, as a component.
 *
 * What the story's Kontroll asks of the browser: no text marking in the rows
 * (double-click and a small drag over the chip) while the search box marks
 * as any text box; the … in the closed field measured, not assumed; open,
 * search, arrows, Enter, Escape, Tab; the saved choice untouched by a search
 * or an abandoned one; the combobox semantics of point 8; opening upward near
 * the window's bottom. The same component in a rule and in a visibility
 * condition is proved in the panel (`condition-row.browser.test.ts`).
 */

const LONG = "Har någon i hushållet haft ett eget företag eller uppdrag med F-skatt under de senaste tolv månaderna?";

// Astras skiss 1 and 3: the rows the pictures show, in their groups.
const ROWS: FieldPickerOption[] = [
  { value: "barn", label: "Hur många barn har du?", group: "Svar från guiden" },
  { value: "manadsinkomst", label: "Vilken är din sammanlagda månadsinkomst före skatt?", group: "Svar från guiden" },
  { value: "kommun", label: "Vilken kommun bor du i?", group: "Svar från guiden" },
  { value: "eget_foretag_eller_fskatt_senaste_tolv_manaderna", label: LONG, group: "Svar från guiden" },
  { value: "barn_alder", label: "Barnets ålder", group: "Svar från guiden" },
  { value: "bostadsyta", label: "Hur stor är bostaden?", group: "Svar från guiden" },
  { value: "boende", label: "Vilken typ av boende har du?", group: "Svar från guiden" },
  { value: "bidrag", label: "Beräknat bidrag", group: "Uträkningar" },
];

afterEach(() => document.body.replaceChildren());

const settle = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(value = "barn", style = "width: 280px; margin: 24px;"): FieldPicker {
  const picker = document.createElement("field-picker");
  picker.setAttribute("label", "Svar eller värde");
  picker.style.cssText = style;
  document.body.append(picker);
  picker.options = ROWS;
  picker.value = value;
  return picker;
}

const part = <T extends Element = HTMLElement>(picker: FieldPicker, selector: string): T =>
  picker.shadowRoot!.querySelector<T>(selector)!;
const control = (picker: FieldPicker) => part<HTMLButtonElement>(picker, ".control");
const search = (picker: FieldPicker) => part<HTMLInputElement>(picker, ".search input");
const popup = (picker: FieldPicker) => part(picker, ".popup");
const shownRows = (picker: FieldPicker) =>
  [...picker.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')].filter((row) => !row.hidden);

/** The focused element, through shadow roots. */
function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Every event the panel would read as a new choice. */
function choicesSeen(picker: FieldPicker): string[] {
  const seen: string[] = [];
  picker.addEventListener("input", () => seen.push("input"));
  picker.addEventListener("change", () => seen.push("change"));
  return seen;
}

describe("stängt fält", () => {
  test("visar bara frågans namn, och ett långt namn slutar i … (Astra 30/9)", async () => {
    const picker = mount("eget_foretag_eller_fskatt_senaste_tolv_manaderna");
    await settle();
    const text = part(picker, ".control__text");
    const style = getComputedStyle(text);

    expect(text.textContent, "namnet ensamt, ingen bricka").toBe(LONG);
    expect(control(picker).querySelector(".chip")).toBeNull();
    expect(text.scrollWidth, "namnet är längre än fältet").toBeGreaterThan(text.clientWidth);
    expect(style.textOverflow, "avkortningen ritas som …").toBe("ellipsis");
    expect(style.whiteSpace).toBe("nowrap");
    expect(style.overflow).toBe("hidden");
    // The text stops before the chevron's room: the field's right padding, not the text, ends it.
    expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(
      control(picker).getBoundingClientRect().right - Number.parseFloat(getComputedStyle(control(picker)).paddingRight) + 1,
    );
  });

  test("utan val står platshållaren, och den är ingen rad att välja", async () => {
    const picker = mount("");
    await settle();

    expect(part(picker, ".control__text").textContent).toBe("Välj fråga eller variabel");
    expect(shownRows(picker).map((row) => row.querySelector(".chip")!.textContent)).not.toContain("");
    expect(picker.shadowRoot!.querySelector('[aria-selected="true"]')).toBeNull();
  });
});

describe("combobox och listbox (punkt 8)", () => {
  test("fältet är en combobox som äger listan; sökrutan pekar ut den aktiva raden", async () => {
    const picker = mount("kommun");
    await settle();
    const field = control(picker);

    expect(field.getAttribute("role")).toBe("combobox");
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(field.getAttribute("aria-label")).toBe("Svar eller värde");
    const list = picker.shadowRoot!.getElementById(field.getAttribute("aria-controls")!)!;
    expect(list.getAttribute("role"), "aria-controls pekar på listan").toBe("listbox");

    await userEvent.click(field);
    await settle();
    const box = search(picker);
    expect(deepActive(), "fokus i sökrutan").toBe(box);
    expect(box.getAttribute("role")).toBe("combobox");
    expect(box.getAttribute("aria-controls")).toBe(list.id);
    expect(box.getAttribute("aria-expanded")).toBe("true");
    /*
     * Only one combobox owns the list while it is open (K4; measured 30/9 in
     * Chromium's own accessibility tree — left as `role="combobox"` on both,
     * the tree carried two comboboxes pointed at the same listbox at once).
     * The field keeps its name and value as a plain button meanwhile, and
     * gets its own role, state and relationship back once it is the
     * combobox again.
     */
    expect(picker.shadowRoot!.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    expect(field.getAttribute("role")).toBeNull();
    expect(field.getAttribute("aria-expanded")).toBeNull();
    expect(field.getAttribute("aria-controls")).toBeNull();
    expect(field.getAttribute("aria-haspopup")).toBeNull();
    expect(field.getAttribute("aria-label")).toBe("Svar eller värde");
    expect(field.textContent).toBe("Vilken kommun bor du i?");

    const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options).toHaveLength(ROWS.length);
    expect(options.filter((one) => one.getAttribute("aria-selected") === "true").map((one) => one.id))
      .toEqual([options[2].id]);
    expect(options.every((one) => one.getAttribute("aria-selected") !== null), "varje rad säger om den är vald").toBe(true);
    expect(box.getAttribute("aria-activedescendant"), "det valda är aktivt vid öppning").toBe(options[2].id);

    await userEvent.keyboard("{ArrowDown}");
    expect(box.getAttribute("aria-activedescendant"), "pilen flyttar den aktiva raden").toBe(options[3].id);
    expect(options[3].classList.contains("option--active")).toBe(true);

    // The plus menu's look, never its menu semantics.
    expect(picker.shadowRoot!.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
    // A group is named by its heading.
    const group = list.querySelector<HTMLElement>('[role="group"]')!;
    expect(picker.shadowRoot!.getElementById(group.getAttribute("aria-labelledby")!)!.textContent).toBe("Svar från guiden");
  });

  test("utan träffar finns ingen lista att expandera", async () => {
    const picker = mount();
    await userEvent.click(control(picker));
    await userEvent.keyboard("hyresgäst");

    expect(search(picker).getAttribute("aria-expanded")).toBe("false");
    expect(part(picker, ".empty").hidden).toBe(false);
    expect(part(picker, ".empty").textContent).toBe("Inga träffar");
    /*
     * Said out loud, not just shown: measured 30/9 (Siv) — the paragraph had
     * neither `role` nor `aria-live`, so a screen reader user who typed a
     * search with no hits was never told. The live count next to it goes
     * silent in the same search (its own text is empty when there is
     * nothing to count), so this is the only announcement left.
     */
    expect(part(picker, ".empty").getAttribute("role")).toBe("status");
    expect(part(picker, ".empty").getAttribute("aria-live")).toBe("polite");
  });
});

describe("sökning och val (punkt 6 och 7)", () => {
  test("sökningen skriver aldrig valet — ingen händelse når värden, listan står kvar", async () => {
    const picker = mount("barn");
    const seen = choicesSeen(picker);

    await userEvent.click(control(picker));
    await userEvent.keyboard("ålder");
    await settle();

    expect(seen, "inget input/change från sökrutan").toEqual([]);
    expect(picker.value).toBe("barn");
    expect(picker.isOpen, "listan stängdes inte av skrivandet").toBe(true);
    expect(shownRows(picker).map((row) => row.querySelector(".chip")!.textContent)).toEqual(["barn_alder"]);
    expect(part(picker, ".search__count").textContent).toBe("1 träff av 8");
    expect(part(picker, ".option__label .hit").textContent, "den matchade delen markerad").toBe("ålder");
  });

  test("träffar både namnet och det tekniska namnet, oavsett skiftläge", async () => {
    const picker = mount();
    await userEvent.click(control(picker));
    await userEvent.keyboard("FSKATT");

    expect(shownRows(picker).map((row) => row.querySelector(".chip")!.textContent)).toEqual([
      "eget_foretag_eller_fskatt_senaste_tolv_manaderna",
    ]);
    await userEvent.clear(search(picker));
    await userEvent.keyboard("BOSTADEN");
    expect(shownRows(picker).map((row) => row.querySelector(".chip")!.textContent)).toEqual(["bostadsyta"]);
    expect(part(picker, '.group:not([hidden]) .group__label').textContent, "gruppen står kvar över träffen").toBe("Svar från guiden");
  });

  test("Escape stänger utan ändring och lämnar fokus på fältet; nästa öppning är tom", async () => {
    const picker = mount("barn");
    const seen = choicesSeen(picker);

    await userEvent.click(control(picker));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}ålder");
    await userEvent.keyboard("{Escape}");

    expect(picker.isOpen).toBe(false);
    expect(seen).toEqual([]);
    expect(picker.value).toBe("barn");
    expect(deepActive()).toBe(control(picker));
    expect(control(picker).getAttribute("aria-expanded")).toBe("false");

    await userEvent.keyboard("{Enter}");
    expect(picker.isOpen, "Enter på fältet öppnar").toBe(true);
    expect(search(picker).value, "sökningen tom").toBe("");
    expect(shownRows(picker)).toHaveLength(ROWS.length);
  });

  test("Escape med en aktiv rad från pilarna, utan skrivning, väljer inte den raden", async () => {
    // Skiljer sig från testet ovan: där tar sökningen bort den aktiva raden
    // (filter() nollställer den) innan Escape hinner prövas mot en. Här
    // flyttas bara pilen, så activeIndex pekar på en rad när Escape trycks.
    const picker = mount("barn");
    const seen = choicesSeen(picker);

    await userEvent.click(control(picker));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.keyboard("{Escape}");

    expect(picker.value, "den pilade raden valdes inte").toBe("barn");
    expect(seen).toEqual([]);
    expect(picker.isOpen).toBe(false);
  });

  test("öppning rullar fram det valda alternativet, som var utom synhåll (story point 7)", async () => {
    // Fler rader än ytan (MAX_HEIGHT 480) rymmer, så det valda — långt ner —
    // står utanför listans start tills öppningen rullar fram till det.
    const many: FieldPickerOption[] = Array.from({ length: 20 }, (_, i) => ({
      value: `v${i}`,
      label: `Alternativ ${i}`,
      group: "Grupp",
    }));
    const picker = document.createElement("field-picker");
    picker.setAttribute("label", "Svar eller värde");
    picker.style.cssText = "width: 280px; margin: 24px;";
    document.body.append(picker);
    picker.options = many;
    picker.value = "v18";
    await settle();

    await userEvent.click(control(picker));
    await settle();

    const list = part(picker, ".list");
    const chosen = picker.shadowRoot!.querySelector<HTMLElement>('[aria-selected="true"]')!;
    const listBox = list.getBoundingClientRect();
    const rowBox = chosen.getBoundingClientRect();

    expect(list.scrollTop, "listan rullade från toppen").toBeGreaterThan(0);
    expect(rowBox.top, "den valda raden syns ovanifrån").toBeGreaterThanOrEqual(listBox.top);
    expect(rowBox.bottom, "den valda raden syns nerifrån").toBeLessThanOrEqual(listBox.bottom);
  });

  test("pil och Enter väljer, stänger och lämnar fokus på fältet", async () => {
    const picker = mount("barn");
    const seen = choicesSeen(picker);

    control(picker).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(picker.isOpen, "pil ned öppnar").toBe(true);
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(picker.value).toBe("manadsinkomst");
    expect(seen, "som en select: input och change, en gång var").toEqual(["input", "change"]);
    expect(picker.isOpen).toBe(false);
    expect(deepActive()).toBe(control(picker));
    expect(part(picker, ".control__text").textContent).toBe(ROWS[1].label);
  });

  test("Enter tar den enda träffen utan pilar ('ålder', Enter)", async () => {
    const picker = mount("barn");
    await userEvent.click(control(picker));
    await userEvent.keyboard("ålder{Enter}");

    expect(picker.value).toBe("barn_alder");
  });

  test("Enter med flera träffar och ingen aktiv rad väljer ingen ('bo' ger flera)", async () => {
    const picker = mount("barn");
    const seen = choicesSeen(picker);
    await userEvent.click(control(picker));
    await userEvent.keyboard("bo");
    expect(shownRows(picker).length, "flera träffar, ingen ensam").toBeGreaterThan(1);

    await userEvent.keyboard("{Enter}");

    expect(picker.value, "ingen av träffarna valdes bara för att den råkar stå först").toBe("barn");
    expect(seen).toEqual([]);
    expect(picker.isOpen, "listan står kvar öppen").toBe(true);
  });

  test("Tab lämnar utan att välja — också med en aktiv rad", async () => {
    const after = document.createElement("button");
    after.textContent = "Nästa";
    const picker = mount("barn");
    document.body.append(after);
    const seen = choicesSeen(picker);

    await userEvent.click(control(picker));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.tab();

    expect(picker.isOpen, "Tab stänger").toBe(false);
    expect(seen).toEqual([]);
    expect(picker.value).toBe("barn");
    expect(deepActive(), "fokus gick vidare, fastnade inte").toBe(after);
  });

  test("Skift+Tab stänger också och lämnar fokus på fältet", async () => {
    const picker = mount("barn");
    const seen = choicesSeen(picker);

    await userEvent.click(control(picker));
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.tab({ shift: true });

    expect(picker.isOpen, "ingen öppen yta kvar bakom fokus").toBe(false);
    expect(seen).toEqual([]);
    expect(deepActive()).toBe(control(picker));
  });

  test("ett klick på brickan väljer hela raden", async () => {
    const picker = mount("barn");
    await userEvent.click(control(picker));
    const row = shownRows(picker).find((one) => one.querySelector(".chip")!.textContent === "kommun")!;

    await userEvent.click(row.querySelector(".chip")!);

    expect(picker.value).toBe("kommun");
    expect(picker.isOpen).toBe(false);
  });
});

/*
 * Johan 30/9: "när man markerar brickan markeras också texten i den". Astra:
 * `user-select: none` on the rows, the chips included; the search box keeps
 * ordinary selection. Real pointer input (Playwright's mouse through
 * `userEvent`), since a synthetic event starts no selection.
 */
describe("ingen textmarkering i raderna (Astra 30/9)", () => {
  const marked = (picker: FieldPicker): string =>
    `${document.getSelection()?.toString() ?? ""}${(picker.shadowRoot as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()?.toString() ?? ""}`;

  test("dubbelklick på brickan markerar ingenting — inte heller det som låg under listan", async () => {
    const picker = mount("kommun");
    /*
     * Text under the list, as the panel's next labels are: the first click
     * chooses and closes, so the second press lands there (measured: it
     * marked a word of it).
     */
    const under = document.createElement("p");
    under.textContent = "Villkor Värde ".repeat(200);
    under.style.cssText = "margin: 0 24px; font-size: 16px; line-height: 20px;";
    document.body.append(under);
    await userEvent.click(control(picker));
    const chip = shownRows(picker)[4].querySelector<HTMLElement>(".chip")!;

    await userEvent.dblClick(chip);

    expect(picker.value, "raden valdes").toBe("barn_alder");
    expect(marked(picker)).toBe("");
  });

  test("ett litet musdrag över brickan markerar ingenting", async () => {
    const picker = mount("barn");
    await userEvent.click(control(picker));
    const [, second, third] = shownRows(picker);
    const chip = second.querySelector<HTMLElement>(".chip")!;
    const box = chip.getBoundingClientRect();

    /*
     * From the chip's start a little right and down into the next row's
     * name. Ending in another row is what keeps the mark to look at: a drag
     * that ends on the chip it began on is a click, which chooses the row
     * and redraws it — measured, the mark then went with the old row and
     * the test passed without `user-select` at all.
     */
    await userEvent.dragAndDrop(chip, third.querySelector<HTMLElement>(".option__label")!, {
      sourcePosition: { x: 2, y: box.height / 2 },
      targetPosition: { x: 40, y: 6 },
    } as never);

    expect(picker.isOpen, "ingen rad valdes av draget").toBe(true);
    expect(picker.value).toBe("barn");
    expect(marked(picker)).toBe("");
  });

  test("men i sökrutan markerar ett drag texten som vanligt", async () => {
    const picker = mount("barn");
    await userEvent.click(control(picker));
    await userEvent.keyboard("bostad");
    const box = search(picker);
    const rect = box.getBoundingClientRect();
    const start = Number.parseFloat(getComputedStyle(box).paddingLeft) + 1;

    await userEvent.dragAndDrop(box, box, {
      sourcePosition: { x: start, y: rect.height / 2 },
      targetPosition: { x: start + 40, y: rect.height / 2 },
    } as never);

    expect(box.selectionEnd! - box.selectionStart!, "några tecken markerade").toBeGreaterThan(0);
  });
});

describe("placering (punkt 9)", () => {
  test("under fältet, lika bred, när det finns plats", async () => {
    const picker = mount("barn", "position: fixed; top: 16px; left: 16px; width: 280px;");
    await userEvent.click(control(picker));
    const field = control(picker).getBoundingClientRect();
    const surface = popup(picker).getBoundingClientRect();

    expect(surface.top).toBeGreaterThanOrEqual(field.bottom);
    expect(surface.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(Math.abs(surface.width - field.width), "fältets bredd").toBeLessThanOrEqual(1);
    expect(Math.abs(surface.left - field.left)).toBeLessThanOrEqual(1);
  });

  test("öppnas uppåt nära fönstrets nederkant, och ryms i fönstret", async () => {
    const picker = mount("barn", "position: fixed; bottom: 16px; left: 16px; width: 280px;");
    await userEvent.click(control(picker));
    const field = control(picker).getBoundingClientRect();
    const surface = popup(picker).getBoundingClientRect();

    expect(popup(picker).dataset.side).toBe("above");
    expect(surface.bottom, "ovanför fältet").toBeLessThanOrEqual(field.top);
    expect(surface.top, "inte utanför fönstret").toBeGreaterThanOrEqual(0);
    // The list scrolls in what is left; the search zone stays on top.
    const list = part(picker, ".list");
    expect(list.scrollHeight).toBeGreaterThanOrEqual(list.clientHeight);
    expect(part(picker, ".search").getBoundingClientRect().top).toBeGreaterThanOrEqual(surface.top);
  });
});

/*
 * K6: every target at least 44 px. The rows are 46 (Fia's measure from the
 * sketch), the search box and its clear cross the control height.
 */
describe("K6 — träffytor", () => {
  test("rader, sökruta, kryss och fält är minst 44 px höga", async () => {
    const picker = mount("barn");
    await userEvent.click(control(picker));
    await userEvent.keyboard("b");

    const heights = {
      fält: control(picker).getBoundingClientRect().height,
      sökruta: search(picker).getBoundingClientRect().height,
      kryss: part(picker, ".search__clear").getBoundingClientRect().height,
      ...Object.fromEntries(shownRows(picker).map((row, i) => [`rad ${i + 1}`, row.getBoundingClientRect().height])),
    };
    for (const [name, height] of Object.entries(heights)) expect(height, name).toBeGreaterThanOrEqual(44);
  });
});

/*
 * K3/1.4.11: a control identified by a shape, not a word. The editor-wide
 * sweep (`guide-editor-icon-contrast.browser.test.ts`) walks every shadow
 * root under a *mounted editor*, but its fixture never selects a rule or
 * opens a field-picker — the popup, its rows and the clear cross inside it
 * exist nowhere in that sweep's graph. Measured here instead, in the open
 * state where the cross is visible (Astra's skiss 3) and a row is chosen, in
 * both themes.
 */
describe.each(["light", "dark"] as const)("K3 — kontrollernas kant eller yta (%s)", (theme) => {
  afterEach(() => document.body.removeAttribute("data-fw-theme"));

  test("krysset syns mot sökrutan", async () => {
    document.body.setAttribute("data-fw-theme", theme);
    const picker = mount("barn");
    await userEvent.click(control(picker));
    await userEvent.keyboard("b");
    await settle();

    /*
     * `ikonkontrastbrott`, not `kontrollkantsbrott`: the cross draws no
     * surface or border of its own (`background: none`), so it is a glyph
     * button — exactly what `ikonkontrastbrott` reads `color` for. Scoped to
     * `.search` so the sweep never reaches an `option` row: run over the
     * whole popup, `kontrollkantsbrott` read the chosen row's own tint at
     * ~1.07:1 — a real number, but not a real failure. That tint is
     * decoration; the row's selectedness is identified by the tick (measured
     * on its own below), exactly the "sibling carries the identity" case
     * neither sweep's docstring claims to judge.
     */
    const brott = ikonkontrastbrott(part(picker, ".search"));
    expect(brott, brott.join("\n")).toEqual([]);
  });

  /*
   * `kontrollkantsbrott` walks `button`, `input` and a fixed set of roles —
   * not a bare `<svg>` glyph inside a `role="option"` row (its documented
   * blind spot: "a sibling that carries the real visual identity"). The tick
   * is exactly that, so it is measured by hand here, the same way the rating
   * mark's is (`guide-preview-rating-contrast.browser.test.ts`).
   */
  test("bocken på den valda raden syns mot radens ton", async () => {
    document.body.setAttribute("data-fw-theme", theme);
    const picker = mount("barn");
    await userEvent.click(control(picker));
    await settle();

    const row = picker.shadowRoot!.querySelector<HTMLElement>('[aria-selected="true"]')!;
    const tick = row.querySelector<HTMLElement>(".option__tick")!;
    const bakgrund = tillRgba(getComputedStyle(row).backgroundColor);
    const glyf = tillRgba(getComputedStyle(tick).color);

    expect(kontrast(glyf, bakgrund), "bock mot radens ton").toBeGreaterThanOrEqual(3);
  });
});

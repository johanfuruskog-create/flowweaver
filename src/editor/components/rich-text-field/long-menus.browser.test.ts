import { page, userEvent } from "@vitest/browser/context";
import { afterAll, afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { longAnswerListCalculationGraph, longAnswerListGraph } from "../../../data/long-answer-list-graph";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Uppdrag 28/9, Del 3: långa menyer i textfältet ryms.
 *
 * Mätt 28/9 i körande editor i 900 × 600 med 14 svar (fixturen): panelens
 * synliga del var 460 px (108–568) och plusmenyn 520 px (108–628, taket i
 * scss:en) — den kunde aldrig synas hel, de nedersta 60 px låg under
 * panelens kant och utanför fönstret, och 8 av 15 rader syntes. Tangent-
 * bordet nådde sista raden (fokus rullar), pekaren bara genom två
 * rullytor i varandra. I 1280 × 800 rymdes den.
 */

afterEach(() => document.body.replaceChildren());
afterAll(async () => {
  await page.viewport(1280, 800);
});

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The nearest scrolling ancestor, across shadow roots. */
function scrollerOf(element: Element): HTMLElement {
  let node: Node | null = element;

  while (node) {
    node = (node as Element).parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null);
    if (node instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  throw new Error("Ingen rullande förfader.");
}

async function lowEditor(): Promise<HTMLElement> {
  await page.viewport(900, 600);
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);
  editor.graph = structuredClone(longAnswerListGraph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("long-result");
  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!.querySelector<HTMLElement>('rich-text-field[data-property="description"]')!;
}

/** The menu lies wholly inside the part of the panel and the window that shows. */
function expectWhollyVisible(menu: HTMLElement): void {
  const shown = scrollerOf(menu).getBoundingClientRect();
  const box = menu.getBoundingClientRect();

  expect(box.top, "menyns topp ovanför panelens synliga del").toBeGreaterThanOrEqual(shown.top - 0.5);
  expect(box.bottom, "menyns botten under panelens synliga del").toBeLessThanOrEqual(Math.min(shown.bottom, innerHeight) + 0.5);
}

/*
 * The control the menu opened from stays in view beside it — mätt 28/9: with
 * the menu filling the whole visible band, `scrollIntoView` pushed the chip
 * being swapped 54 px above the panel's edge, so nobody could see which
 * chip the choice would replace.
 */
function expectAnchorVisible(anchor: HTMLElement, menu: HTMLElement): void {
  const shown = scrollerOf(menu).getBoundingClientRect();
  const box = anchor.getBoundingClientRect();

  expect(box.top, "det menyn öppnades från står ovanför panelens synliga del").toBeGreaterThanOrEqual(shown.top - 0.5);
  expect(box.bottom).toBeLessThanOrEqual(shown.bottom + 0.5);
}

/** The focused row lies inside the menu's own scrollport and the panel's. */
function expectFocusedVisible(field: HTMLElement, menu: HTMLElement): void {
  const row = field.shadowRoot!.activeElement as HTMLElement;
  const box = row.getBoundingClientRect();
  const port = menu.getBoundingClientRect();

  expect(menu.contains(row), "fokus i menyn").toBe(true);
  expect(box.top).toBeGreaterThanOrEqual(port.top - 0.5);
  expect(box.bottom).toBeLessThanOrEqual(port.bottom + 0.5);
}

/**
 * The field's own selection — read through the shadow root, robust to which
 * element currently holds DOM focus (`activeElement`), because a menu button
 * takes focus away from the text while the field's remembered selection
 * stands untouched underneath it (uppdrag 28/9, 1c).
 */
function selectionRange(field: HTMLElement): Range {
  const shadow = field.shadowRoot as ShadowRoot & { getSelection?: () => Selection | null };
  const own = shadow.getSelection?.();

  if (own && own.rangeCount > 0) return own.getRangeAt(0);
  const selection = document.getSelection() as Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] };
  const composed = selection.getComposedRanges?.({ shadowRoots: [shadow] })[0];
  const range = document.createRange();

  if (!composed) return selection.getRangeAt(0);
  range.setStart(composed.startContainer, composed.startOffset);
  range.setEnd(composed.endContainer, composed.endOffset);
  return range;
}

describe("långa menyer i en låg panel (900 × 600, 14 svar)", () => {
  test("plusmenyn ryms hel i panelens synliga del, och End håller sista raden synlig", async () => {
    const field = await lowEditor();
    const toggle = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;

    toggle.scrollIntoView({ block: "center" });
    await settle();
    await userEvent.click(toggle);
    await settle(200);
    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;

    expectWhollyVisible(menu);
    expectAnchorVisible(toggle, menu);
    expect(menu.scrollHeight, "listan är längre än menyn — annars mäter provet inget").toBeGreaterThan(menu.clientHeight);

    menu.querySelector<HTMLElement>("button")!.focus();
    await userEvent.keyboard("{End}");
    await settle();
    expectFocusedVisible(field, menu);
    expectWhollyVisible(menu);

    await userEvent.keyboard("{Escape}");
    expect(field.shadowRoot!.activeElement, "Escape återför fokus till plusset").toBe(toggle);
  });

  /*
   * Uppdrag 28/9, 1c: Del 3:s leverans prövad som helhet. End var redan mätt
   * (testet ovan) — piltangenterna och Home har ingen egen kod (`onMenuKeyDown`
   * flyttar fokus, `menu.scrollIntoView`/fokusets egen `scrollIntoView` sköter
   * synligheten), men ingen körning hade provat att fokus faktiskt stannar
   * synligt genom HELA listan, ett steg i taget, eller att Home tar fokus
   * hela vägen tillbaka till toppen igen efter att ha rullat till botten.
   */
  test("piltangenter och Home håller fokuserat alternativ synligt genom hela plusmenyn", async () => {
    const field = await lowEditor();
    const toggle = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;

    await userEvent.click(toggle);
    await settle(200);
    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
    const items = [...menu.querySelectorAll<HTMLElement>("button")];

    expect(items.length, "listan är lång — annars mäter provet inget").toBeGreaterThan(8);

    items[0]!.focus();
    expectFocusedVisible(field, menu);

    for (let step = 1; step < items.length; step += 1) {
      await userEvent.keyboard("{ArrowDown}");
      await settle();
      expect(field.shadowRoot!.activeElement, `steg ${step}`).toBe(items[step]);
      expectFocusedVisible(field, menu);
    }

    await userEvent.keyboard("{Home}");
    await settle();
    expect(field.shadowRoot!.activeElement, "Home till första raden").toBe(items[0]);
    expectFocusedVisible(field, menu);
  });

  test("brickans byt-meny ryms hel och sista alternativet nås med tangentbordet", async () => {
    const field = await lowEditor();
    const chip = field.shadowRoot!.querySelector<HTMLElement>("[data-text] [data-chip]")!;

    chip.scrollIntoView({ block: "center" });
    await settle();
    await userEvent.click(chip);
    await settle(200);
    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;

    expect(menu.hidden).toBe(false);
    expectWhollyVisible(menu);
    expectAnchorVisible(chip, menu);

    menu.querySelector<HTMLElement>("button")!.focus();
    await userEvent.keyboard("{End}");
    await settle();
    expectFocusedVisible(field, menu);
  });

  /*
   * Uppdrag 28/9, 1c: Escape på plusmenyn återför fokus till plusset (testet
   * ovan, redan mätt) — brickans byt-meny har ingen knapp att återgå till,
   * bara brickan själv (`onMenuKeyDown`s `else this.focusText()`). Ingen
   * körning hade provat att den vägen faktiskt landar rätt: brickan kvar
   * vald, ingen ändring gjord.
   */
  test("Escape på brickans byt-meny stänger den och lämnar brickan vald, ingen ändring", async () => {
    const field = (await lowEditor()) as HTMLElement & { value: string };
    const before = field.value;
    const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;
    const chip = field.shadowRoot!.querySelector<HTMLElement>("[data-text] [data-chip]")!;

    await userEvent.click(chip);
    await settle(200);
    const menu = field.shadowRoot!.querySelector<HTMLElement>("[data-chip-menu]")!;

    expect(menu.hidden).toBe(false);
    menu.querySelector<HTMLElement>("button")!.focus();
    await userEvent.keyboard("{Escape}");
    await settle();

    expect(menu.hidden, "byt-menyn stängd").toBe(true);
    expect(field.shadowRoot!.activeElement, "fokus tillbaka i texten, inte kvar på menyknappen").toBe(text);
    expect(chip.hasAttribute("data-selected"), "brickan kvar vald").toBe(true);
    expect(field.value, "ingen ändring").toBe(before);
  });

  /*
   * Uppdrag 28/9, 1c: den sista av Del 3:s obekräftade punkter —
   * textmarkeringen i fältet ska stå kvar efter att en meny öppnats och
   * stängts med Escape UTAN val. Att öppna plusmenyn rör aldrig `this.
   * selection` (bara `onMenuKeyDown`s Escape gör det, och bara vid ett val),
   * så webbläsarens egen markering i `[data-text]` ska aldrig ha flyttat sig
   * — mätt direkt i DOM:en, inte i modellen, eftersom det är det en besökare
   * skulle se.
   */
  test("textmarkeringen i fältet är bevarad efter att plusmenyn öppnats och stängts med Escape, utan val", async () => {
    const field = await lowEditor();
    const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

    text.focus();
    await userEvent.keyboard("{Control>}{Home}{/Control}{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
    await settle();
    const before = selectionRange(field);
    const beforeText = before.toString();

    expect(beforeText.length, "något är faktiskt markerat — annars mäter provet inget").toBeGreaterThan(0);

    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);
    await settle(200);
    await userEvent.keyboard("{Escape}");
    await settle();

    const after = selectionRange(field);

    expect(after.toString(), "samma markerade text").toBe(beforeText);
    expect(after.startContainer, "samma startpunkt").toBe(before.startContainer);
    expect(after.startOffset).toBe(before.startOffset);
    expect(after.endContainer, "samma slutpunkt").toBe(before.endContainer);
    expect(after.endOffset).toBe(before.endOffset);
  });

  test("ett val ur den långa menyn infogar vid markören och byter brickan på sin plats, och texten syns efteråt", async () => {
    const field = (await lowEditor()) as HTMLElement & { value: string };
    const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;

    text.focus();
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await userEvent.click(field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!);
    await settle(200);
    field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu] button")!.focus();
    await userEvent.keyboard("{End}{Enter}");
    await settle(200);

    expect(field.value).toBe("Vi har tagit emot din ansökan, {{fornamn}}.{{idag}}");
    expect(field.shadowRoot!.activeElement, "fokus tillbaka i texten").toBe(text);
    expectAnchorVisible(text, text);

    await userEvent.click(text.querySelector<HTMLElement>("[data-chip]")!);
    await settle(200);
    const swaps = [...field.shadowRoot!.querySelectorAll<HTMLElement>("[data-chip-menu] [data-swap]")];

    swaps[swaps.length - 1]!.focus();
    await userEvent.keyboard("{Enter}");
    await settle(200);

    expect(field.value).toBe("Vi har tagit emot din ansökan, {{idag}}.{{idag}}");
    expect(field.shadowRoot!.activeElement).toBe(text);
  });
});

/*
 * Astras granskning av vända 1 (bilaga 2, 29/9): "Visa menyn i en hel
 * viewport och bekräfta att sista alternativet kan nås med både tangentbord
 * och scroll." The tests above hold the text field's menu; the formula's
 * menu has a search box first and two-line rows, and had no test of its own.
 */
describe("formelfältets meny i en låg panel (900 × 600, 14 svar)", () => {
  async function lowFormula(): Promise<HTMLElement> {
    await page.viewport(900, 600);
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.panelOpen = true;

    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 900px; height: 600px;";
    document.body.append(editor);
    editor.graph = structuredClone(longAnswerListCalculationGraph) as never;
    await settle();
    await settle();
    (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("long-calc");
    await settle();
    await settle();
    const panel = editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!;

    for (const toggle of panel.querySelectorAll<HTMLButtonElement>('[data-action^="toggle-"][aria-expanded="false"]')) toggle.click();
    await settle();
    return panel.querySelector<HTMLElement>('[data-assignment-id="long-a-total"] rich-text-field')!;
  }

  async function openMenu(field: HTMLElement): Promise<HTMLElement> {
    const toggle = field.shadowRoot!.querySelector<HTMLElement>("[data-answer-toggle]")!;

    toggle.scrollIntoView({ block: "center" });
    await settle();
    await userEvent.click(toggle);
    await settle(200);
    return field.shadowRoot!.querySelector<HTMLElement>("[data-answer-menu]")!;
  }

  test("menyn ryms hel, och sista alternativet nås med End och med pilarna från sökrutan", async () => {
    const field = await lowFormula();
    const menu = await openMenu(field);
    const items = [...menu.querySelectorAll<HTMLElement>("button[data-insert]")];

    expectWhollyVisible(menu);
    expect(menu.scrollHeight, "listan är längre än menyn — annars mäter provet inget").toBeGreaterThan(menu.clientHeight);
    expect(items.length).toBeGreaterThan(8);

    items[0]!.focus();
    await userEvent.keyboard("{End}");
    await settle();
    expect(field.shadowRoot!.activeElement, "End till sista raden").toBe(items.at(-1));
    expectFocusedVisible(field, menu);
    expectWhollyVisible(menu);

    field.shadowRoot!.querySelector<HTMLElement>("[data-answer-search]")!.focus();
    for (let step = 0; step < items.length; step += 1) {
      await userEvent.keyboard("{ArrowDown}");
      await settle(30);
      expect(field.shadowRoot!.activeElement, `steg ${step + 1}`).toBe(items[step]);
      expectFocusedVisible(field, menu);
    }
  });

  test("menyn rullar själv, och rullad till botten syns sista raden hel ovanför menyns nederkant", async () => {
    const field = await lowFormula();
    const menu = await openMenu(field);
    const last = [...menu.querySelectorAll<HTMLElement>("button[data-insert]")].at(-1)!;

    expect(getComputedStyle(menu).overflowY).toBe("auto");
    expect(last.getBoundingClientRect().top, "sista raden syns inte innan menyn rullas").toBeGreaterThan(menu.getBoundingClientRect().bottom);

    menu.scrollTop = menu.scrollHeight;
    await settle();
    const port = menu.getBoundingClientRect();
    const box = last.getBoundingClientRect();

    expect(box.top).toBeGreaterThanOrEqual(port.top - 0.5);
    expect(box.bottom).toBeLessThanOrEqual(port.bottom + 0.5);
    expectWhollyVisible(menu);
  });
});

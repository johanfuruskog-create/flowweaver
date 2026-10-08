import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The error summary: counted and linked, instead of hunting red edges
 * (story 051).
 *
 * A page with several fields and several faults told the visitor nothing
 * about how many, and the WCAG pattern — a summary on top, one link per
 * fault, focus moved there so the screen reader announces it — was
 * missing. One fault keeps today's behaviour (focus straight to the
 * field); the summary earns its place only when there is something to
 * summarise.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function pageGraph(): GraphData {
  return {
    startNodeId: "sida",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Hur når vi dig?" } } },
      {
        id: "tel",
        type: "text-question",
        parentPageId: "sida",
        order: 1,
        position: { x: 0, y: 0 },
        data: { title: { sv: "Telefonnummer" }, variableName: "tel", required: true },
      },
      {
        id: "epost",
        type: "text-question",
        parentPageId: "sida",
        order: 2,
        position: { x: 0, y: 0 },
        data: { title: { sv: "E-post" }, variableName: "epost", required: true },
      },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "sida", portId: "output" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;
}

async function mountAndSubmit(fill: Record<string, string>, width?: number): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  if (width) preview.style.cssText = `display: block; width: ${width}px;`;
  document.body.append(preview);
  preview.graph = pageGraph();
  await settle();

  const root = preview.shadowRoot!;
  for (const [variable, value] of Object.entries(fill)) {
    const input = root.querySelector<HTMLInputElement>(`[data-page-variable="${variable}"]`);
    if (input) input.value = value;
  }
  root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
  await settle();

  return preview;
}

describe("felsummeringen", () => {
  test("two faults: an alert on top that counts, and one link per fault", async () => {
    const preview = await mountAndSubmit({});
    const summary = preview.shadowRoot!.querySelector('[data-error-summary]');

    expect(summary).toBeTruthy();
    expect(summary!.getAttribute("role")).toBe("alert");
    expect(summary!.textContent).toContain("2");
    const links = summary!.querySelectorAll("[data-error-link]");
    expect(links.length).toBe(2);
    // Besökarens språk: frågans rubrik, inte variabelnamnet.
    expect(links[0]!.textContent).toContain("Telefonnummer");
  });

  test("a link moves focus to its field", async () => {
    const preview = await mountAndSubmit({});
    const root = preview.shadowRoot!;

    root.querySelectorAll<HTMLElement>("[data-error-link]")[1]!.click();
    await settle(60);

    const active = root.activeElement as HTMLInputElement | null;
    expect(active?.getAttribute("data-page-variable")).toBe("epost");
  });

  test("a single fault keeps today's behaviour: no summary", async () => {
    const preview = await mountAndSubmit({ tel: "070-123 45 67" });

    expect(preview.shadowRoot!.querySelector("[data-error-summary]")).toBeNull();
    expect(preview.shadowRoot!.querySelectorAll("[data-invalid]").length).toBe(1);
  });

  /*
   * K6 (genomgången 30/9, rad V2): a list of links is not running text, so
   * the "link in a sentence" exception does not apply. Measured before the
   * fix at 900 px: every link 23 px tall, and each overlapped the next by
   * 4 px (the `padding: 2px 0` of an inline box reaches into the line
   * above and below). Each link is now its own 44 px target and they touch
   * without overlapping.
   */
  test.each([900, 390])("i %i px: varje länk är 44 px att träffa och ingen överlappar nästa", async (width) => {
    const preview = await mountAndSubmit({}, width);
    const rects = [...preview.shadowRoot!.querySelectorAll<HTMLElement>("[data-error-link]")].map((link) =>
      link.getBoundingClientRect(),
    );

    expect(rects.length).toBe(2);
    for (const rect of rects) expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rects[1]!.top).toBeGreaterThanOrEqual(rects[0]!.bottom - 0.5);
  });

  /*
   * Mätt 21/9 (Fable/Johan, variant C i 390 px): "när en rad bryts blir
   * texten centrerad och punkten hamnar på sista raden". Länken var en
   * `<button>` — mätt med `Element.getClientRects()`: en `<button>`
   * genererar EN atomisk box över hela sin höjd oavsett `display`-värde
   * (som en `inline-block`), så en tvåradig länktext gav en enda rect i
   * stället för två. `<li>`s punkt riktar sig efter den atomiska boxens
   * baslinje — per spec den SISTA radens — därför hamnade den vid rad två,
   * och webbläsarens hängande indrag (som bara fungerar på riktiga
   * radfragment) uteblev.
   *
   * `rects.length` är alltså den mätbara motsvarigheten till "punkten på
   * rätt rad": en riktig `<a>` ger EN rect per synlig rad, en `<button>`
   * ger alltid en enda oavsett hur många rader texten bryter till. Testet
   * sett falla mot gårdagens `<button>`-markup: `rects.length` var 1 (inte
   * > 1) och `rects[1]` fanns inte alls.
   */
  test("i 390 px: en trasig länk bryter till två rader, vänsterställda och med punkten på rätt rad", async () => {
    const preview = await mountAndSubmit({}, 390);
    const root = preview.shadowRoot!;
    const link = root.querySelectorAll<HTMLElement>("[data-error-link]")[0]!;
    const li = link.closest("li")!;

    // The bullet itself cannot be measured. What put it on the last line was
    // an atomic `<button>`; an `<a>` has real line fragments.
    expect(link.localName, "an <a>, never an atomic <button>").toBe("a");

    // The text's own lines, not the link's boxes: since V2 (30/9) the link
    // is one flex box of 44 px, so `link.getClientRects()` is always one
    // rect. The text inside it is still an anonymous box with a fragment
    // per line — the thing the bullet and the hanging indent follow.
    const textRange = document.createRange();
    textRange.selectNodeContents(link);
    const rects = [...textRange.getClientRects()].filter((rect) => rect.width > 0);

    // Texten bröt verkligen till fler än en rad vid den här bredden — annars
    // testar vi ingenting.
    const lineTops = [...new Set(rects.map((rect) => Math.round(rect.top)))];
    expect(lineTops.length).toBeGreaterThan(1);

    // Vänsterställt: fortsättningsraden börjar på samma x som den första.
    const firstLine = rects.find((rect) => Math.round(rect.top) === lineTops[0])!;
    const secondLine = rects.find((rect) => Math.round(rect.top) === lineTops[1])!;
    expect(Math.abs(secondLine.left - firstLine.left)).toBeLessThan(1);

    // Samma y som punkten: `<li>`s punkt riktar sig efter den första radboxen
    // (list-style-position: outside). Since the link got its 44 px the text is
    // centred in it, so the first line starts at most a few px below the
    // `<li>`'s top — never a whole line down, which is where the `<button>`
    // put it. Checked by picture as well (genomgången 30/9, V2, 390 px).
    expect(firstLine.top - li.getBoundingClientRect().top).toBeGreaterThanOrEqual(-0.5);
    expect(firstLine.top - li.getBoundingClientRect().top).toBeLessThan(firstLine.height / 2);
  });

  /*
   * Johans beslut 21/9: felsummeringen får ingen synlig fokusram. Den
   * behåller `tabindex="-1"` och `.focus()` vid render — skärmläsaren och
   * läsordningen behöver dem — men ritar varken streck eller ring. Rutan
   * är inte en knapp: den går inte att trycka på, och två ramar på varandra
   * (dess egen 4px röda kant plus en fokusring) lovade en handling som inte
   * finns. Länkarna i den behåller sin vanliga fokusring.
   *
   * `:focus-visible` matchar inte tillförlitligt ett `.focus()` från skript
   * om inget tangenttryck skett först på sidan (samma mätning som
   * `focus-two-bearers.browser.test.ts`: webbläsaren avgör läget utifrån
   * SENASTE draget, inte hur just detta anrop kom till). Ett riktigt
   * `Tab`-tryck före klicket sätter tangentbordsläget, så `.focus()`-anropet
   * i `renderPageErrorSummary` sedan räknas som tangentbordsfokus — annars
   * hade testet kunnat mäta "ingen ram" på ett element som aldrig ens
   * försökte matcha regeln (PRAXIS 12).
   */
  test("felsummeringen tar fokus utan ram, länken efter den behåller sin", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    document.body.append(preview);
    preview.graph = pageGraph();
    await settle();

    await userEvent.keyboard("{Tab}");
    const root = preview.shadowRoot!;
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();

    const summary = root.querySelector<HTMLElement>("[data-error-summary]")!;

    expect(root.activeElement).toBe(summary);
    expect(summary.matches(":focus-visible"), "räknas som tangentbordsfokus").toBe(true);

    const summaryStyle = getComputedStyle(summary);
    expect(summaryStyle.outlineStyle).toBe("none");
    expect(summaryStyle.boxShadow).toBe("none");

    // Länken efter den behåller de två bärarna (samma krav som
    // focus-two-bearers.browser.test.ts, men på det här elementet).
    await userEvent.keyboard("{Tab}");
    const link = root.querySelector<HTMLElement>("[data-error-link]")!;

    expect(root.activeElement).toBe(link);
    expect(link.matches(":focus-visible"), "räknas som tangentbordsfokus").toBe(true);

    const linkStyle = getComputedStyle(link);
    expect(linkStyle.outlineStyle).toBe("solid");
    expect(parseFloat(linkStyle.outlineWidth)).toBeGreaterThanOrEqual(3);
    expect(linkStyle.boxShadow).not.toBe("none");
  });
});

/*
 * The summary keeps up with the fields under it (Astra 1/10, bilaga 12):
 * never *3 saker* once one is put right. Measured before: all three put
 * right, and the summary still counted three with three links until Next.
 */
describe("sammanfattningen följer fälten", () => {
  const options = [
    { id: "a", label: { sv: "Ja" }, value: "ja" },
    { id: "b", label: { sv: "Nej" }, value: "nej" },
  ];
  const graph = {
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sidan" } } },
      { id: "x", type: "question", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, data: { title: { sv: "Kommer du?" }, variableName: "x", required: true, options } },
      { id: "y", type: "question", parentPageId: "p", order: 1, position: { x: 0, y: 0 }, data: { title: { sv: "Äter du kött?" }, variableName: "y", required: true, options } },
      { id: "z", type: "text-question", parentPageId: "p", order: 2, position: { x: 0, y: 0 }, data: { title: { sv: "Namn" }, variableName: "z", required: true } },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as unknown as GraphData;

  test("antalet och länkarna uppdateras när ett fel rättas, och sammanfattningen går under två", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;
    document.body.append(preview);
    preview.graph = graph;
    await settle();
    const root = preview.shadowRoot!;
    root.querySelector<HTMLElement>('[data-action="next"]')!.click();
    await settle();
    const summary = () => root.querySelector<HTMLElement>("[data-error-summary]");
    const read = () => ({
      title: summary()?.querySelector("h3")?.textContent?.trim(),
      links: [...(summary()?.querySelectorAll("[data-error-link]") ?? [])].map((link) => link.textContent?.trim()),
    });

    expect(read().title).toBe("3 saker behöver rättas innan du kan gå vidare");

    root.querySelector<HTMLInputElement>('[data-page-field-id="x"] input')!.click();
    await settle();
    expect(read()).toEqual({
      title: "2 saker behöver rättas innan du kan gå vidare",
      links: ["Äter du kött?: Välj ett alternativ.", "Namn: Fältet är obligatoriskt."],
    });

    // A remaining link still takes focus to its field.
    summary()!.querySelector<HTMLAnchorElement>('[data-error-field="z"]')!.click();
    expect(root.activeElement).toBe(root.querySelector('[data-page-field-id="z"] input'));

    root.querySelector<HTMLInputElement>('[data-page-field-id="y"] input')!.click();
    await settle();
    expect(summary(), "under två: felet sägs vid fältet, ingen sammanfattning").toBeNull();
    expect(root.querySelector('[data-page-field-id="z"] .guide-preview__field-error')?.textContent?.trim()).toBe("Fältet är obligatoriskt.");
  });
});

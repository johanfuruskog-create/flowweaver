// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import type { GuideEditor } from "./guide-editor";

/**
 * Story 072, etapp 1 — Översikten som vänsterflik. Guiden som lista:
 * läsbar uppifrån och ned, nåbar utan pekare, grenar under svarets
 * etikett, hälsan synlig på raden. Klick markerar noden medan
 * egenskaperna står kvar till höger — därför vänster, inte höger
 * (flikkonflikten, Johans fråga 2/9).
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const grenGraf = {
  version: 8,
  startNodeId: "fraga",
  nodes: [
    { id: "fraga", type: "question", position: { x: 0, y: 0 }, data: {
      title: { sv: "Är felet farligt?" }, variableName: "farligt", presentation: "radio",
      options: [
        { id: "ja", label: { sv: "Ja, det kan skada någon" }, value: "ja" },
        { id: "nej", label: { sv: "Nej, det kan vänta" }, value: "nej" },
      ] } },
    { id: "ring", type: "result", position: { x: 500, y: 0 }, data: { title: { sv: "Ring oss direkt" } } },
    { id: "slut", type: "submit-result", position: { x: 500, y: 300 }, data: { title: { sv: "Tack" } } },
  ],
  connections: [
    { id: "c1", from: { nodeId: "fraga", portId: "ja" }, to: { nodeId: "ring", portId: "input" } },
    { id: "c2", from: { nodeId: "fraga", portId: "nej" }, to: { nodeId: "slut", portId: "input" } },
  ],
};

async function mounted(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = structuredClone(grenGraf) as never;
  await settle();
  return editor;
}

/*
 * Öppnas via Vy-menyn (Johans beslut 2/9 kväll, på skiss: listan tar
 * canvasytan i stället för en smal vänsterflik — komponenten flyttade
 * bara hem). Esc tar tillbaka arbetsytan.
 */
const oppnaOversikt = async (editor: GuideEditor) => {
  const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!;

  toolbar.shadowRoot!
    .querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!
    .click();
  await settle(120);
  toolbar.shadowRoot!
    .querySelector<HTMLButtonElement>('[data-action="toggle-list-view"]')!
    .click();
  await settle(150);
  return editor.shadowRoot!.querySelector<HTMLElement>("guide-outline")!;
};

describe("översikten", () => {
  test.runIf(PRO)("flikparet finns och Översikt ritar trädet med grenrubriker", async () => {
    const editor = await mounted();

    const outline = await oppnaOversikt(editor);

    expect(outline.hidden).toBe(false);
    // Vyn tar canvasytan — den täcker arbetsytans rektangel.
    const canvasRect = editor.shadowRoot!
      .querySelector("node-editor")!
      .getBoundingClientRect();
    const outlineRect = outline.getBoundingClientRect();
    expect(outlineRect.width).toBeGreaterThan(canvasRect.width * 0.9);
    const rader = [...outline.shadowRoot!.querySelectorAll<HTMLElement>("[data-outline-row]")];
    // Grenrubrikerna är knappar, inte treeitem-rader — läs hela trädet.
    const tradText = outline.shadowRoot!
      .querySelector('[role="tree"]')!
      .textContent!.replace(/\s+/g, " ");

    expect(tradText).toContain("Är felet farligt?");
    expect(tradText).toContain("Ja, det kan skada någon");
    expect(tradText).toContain("Ring oss direkt");
    // Hälsan på raden: inlämningen utan mottagare bär markören.
    const tackRad = rader.find((rad) => rad.textContent?.includes("Tack"));
    expect(tackRad?.querySelector("[data-outline-health]"), "⚠ på Tack").toBeTruthy();
  });

  /*
   * Johan 3/9: "lite mer tydliga ikoner i listvyn så det speglar
   * strukturvyns ikoner". Samma silhuett som nodhuvudet och paletten
   * ritar, ur samma register — och dold för hjälpmedel, typen står i
   * ordet bredvid som på canvasen.
   */
  test("raden bär nodtypens ikon, samma som nodhuvudet", async () => {
    const editor = await mounted();
    const outline = await oppnaOversikt(editor);
    const fraga = outline.shadowRoot!.querySelector<HTMLElement>(
      '[data-outline-row][data-node-type="question"]',
    )!;
    const ikon = fraga.querySelector<HTMLElement>("[data-outline-icon]");

    expect(ikon?.querySelector("svg"), "en silhuett på frågeraden").toBeTruthy();
    expect(ikon?.getAttribute("aria-hidden")).toBe("true");
    // Samma teckning som canvasen: nodhuvudets svg för samma typ.
    const canvasIkon = [...editor.shadowRoot!
      .querySelector("node-editor")!
      .shadowRoot!.querySelectorAll<HTMLElement>("flow-node")]
      .map((node) => node.shadowRoot!.querySelector('.flow-node[data-node-type="question"] .flow-node__type-icon svg'))
      .find(Boolean);

    expect(ikon!.querySelector("svg")!.innerHTML).toBe(canvasIkon!.innerHTML);
  });

  test("klick i listan markerar noden — egenskaperna följer", async () => {
    const editor = await mounted();
    const outline = await oppnaOversikt(editor);

    const ringRad = [...outline.shadowRoot!.querySelectorAll<HTMLElement>("[data-outline-row]")]
      .find((rad) => rad.textContent?.includes("Ring oss direkt"))!;

    ringRad.click();
    await settle(250);

    const panelText = editor.shadowRoot!
      .querySelector("properties-panel")!
      .shadowRoot!.textContent;

    expect(panelText).toContain("Ring oss direkt");
    // Vyn står kvar öppen — man bläddrar vidare — och dess egen
    // markering följer med.
    expect(outline.hidden).toBe(false);
    const markerad = [...outline.shadowRoot!.querySelectorAll<HTMLElement>("[data-outline-row]")]
      .find((rad) => rad.getAttribute("aria-selected") === "true");
    expect(markerad?.textContent).toContain("Ring oss direkt");
  });

  test("trädet är ett träd för hjälpmedel", async () => {
    const editor = await mounted();
    const outline = await oppnaOversikt(editor);

    expect(outline.shadowRoot!.querySelector('[role="tree"]')).toBeTruthy();
    expect(
      outline.shadowRoot!.querySelectorAll('[role="treeitem"]').length,
    ).toBeGreaterThan(2);
  });
});

describe("tillbaka till arbetsytan", () => {
  /*
   * Samma post öppnar och stänger listan, och med listan uppe stod det
   * fortfarande "Visa som lista" — inget sa att den var vägen tillbaka
   * (Johan 3/9). Posten byter namn, som "Helskärm" ↔ "Avsluta helskärm":
   * ingen bock, för en ibockad "Visa som lista" ser ut att gå att välja igen.
   */
  const listPost = (editor: GuideEditor) =>
    editor.shadowRoot!
      .querySelector("editor-toolbar")!
      .shadowRoot!.querySelector<HTMLButtonElement>('[data-action="toggle-list-view"]')!;

  test("posten heter \"Visa arbetsytan\" medan listan är uppe — och Esc byter tillbaka", async () => {
    const editor = await mounted();

    expect(listPost(editor).textContent?.trim()).toBe("Visa som lista");
    expect(listPost(editor).getAttribute("aria-pressed")).toBe("false");
    const outline = await oppnaOversikt(editor);

    expect(outline.hidden).toBe(false);
    expect(listPost(editor).getAttribute("role")).toBe("menuitem");
    expect(listPost(editor).textContent?.trim()).toBe("Visa arbetsytan");
    expect(listPost(editor).getAttribute("aria-pressed")).toBe("true");
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle(150);
    expect(outline.hidden).toBe(true);
    expect(listPost(editor).textContent?.trim()).toBe("Visa som lista");
    expect(listPost(editor).getAttribute("aria-pressed")).toBe("false");
  });

  /*
   * The card wears an asterisk after a required field's title (story 077);
   * the list showed the same field bare (measured 3/9). The same mark, and
   * the word for whoever hears the row instead of seeing it.
   */
  test("en obligatorisk fråga bär asterisken i listan också", async () => {
    const editor = await mounted();
    const outline = await oppnaOversikt(editor);
    const rad = (id: string) =>
      outline.shadowRoot!.querySelector<HTMLElement>(`[data-outline-row][data-node-id="${id}"]`)!;

    expect(rad("fraga").querySelector(".guide-outline__required")).toBeNull();
    editor.graph = {
      ...editor.graph!,
      nodes: editor.graph!.nodes.map((node) =>
        node.id === "fraga" ? { ...node, data: { ...node.data, required: true } } : node),
    } as never;
    await settle(150);

    const mark = rad("fraga").querySelector<HTMLElement>(".guide-outline__required")!;
    expect(mark?.textContent).toBe("*");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(rad("fraga").getAttribute("aria-label")).toContain("obligatorisk");
    expect(rad("ring").getAttribute("aria-label")).toBeNull();
  });

  /*
   * With the list up, the Vy menu still listed Zooma in/ut, Passa in,
   * Visa som besökaren ser den, variabelnamnen — every one a canvas act
   * that did nothing while the canvas was hidden (measured 3/9). They go
   * while the list is up; the list item itself and Helskärm stay.
   */
  test("canvasens poster i Vy-menyn är borta medan listan är uppe", async () => {
    const editor = await mounted();
    const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;
    const post = (action: string) =>
      toolbar.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    const canvasPoster = ["zoom-in", "zoom-out", "zoom-reset", "fit-to-content", "visitor-view-all", "structure-view-all", "toggle-variables"];
    // What is drawn, not the attribute: `.has-kbd` and the checkbox row set
    // their own `display`, which beat `hidden` on the first build (3/9).
    const borta = (action: string) => getComputedStyle(post(action)).display === "none";

    for (const action of canvasPoster) expect(borta(action), action).toBe(false);
    await oppnaOversikt(editor);
    toolbar.querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!.click();
    await settle(120);

    for (const action of canvasPoster) expect(borta(action), action).toBe(true);
    expect(borta("toggle-list-view")).toBe(false);
    expect(borta("fullscreen")).toBe(false);
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(150);
    for (const action of canvasPoster) expect(post(action).hidden, action).toBe(false);
  });

  /*
   * Vy → Visa variabelnamn (story 077): chipen är av tills någon vill se
   * dem, och då på alla kort i en gest. En bock som Moduler-menyns, men
   * menyn stängs — det är en vy, och canvasen är svaret.
   */
  test("Visa variabelnamn tänder chipen på alla kort, stänger menyn, och släcker igen", async () => {
    const editor = await mounted();
    const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;
    const post = () => toolbar.querySelector<HTMLButtonElement>('[data-action="toggle-variables"]')!;
    const meny = () => toolbar.querySelector<HTMLElement>('[data-menu="view"]')!;
    const kort = () =>
      [...editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!.querySelectorAll("flow-node")];
    const chipSyns = () =>
      kort()
        .map((one) => one.shadowRoot!.querySelector(".flow-node__field-labels"))
        .filter((rad): rad is Element => rad !== null)
        .map((rad) => getComputedStyle(rad).display !== "none");

    expect(post().getAttribute("role")).toBe("menuitemcheckbox");
    expect(post().getAttribute("aria-checked")).toBe("false");
    expect(chipSyns(), "en fråga med variabel, av").toEqual([false]);

    toolbar.querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!.click();
    await settle(120);
    post().click();
    await settle(150);
    expect(meny().hidden, "menyn stängs").toBe(true);
    expect(post().getAttribute("aria-checked")).toBe("true");
    expect(chipSyns()).toEqual([true]);
    expect(kort().every((one) => one.hasAttribute("data-show-variables"))).toBe(true);

    post().click();
    await settle(150);
    expect(post().getAttribute("aria-checked")).toBe("false");
    expect(chipSyns()).toEqual([false]);
  });

  /*
   * Johans bild 3/9: med listan uppe gjorde "Visa alla som besökaren ser
   * dem" och "Visa alla som struktur" ingenting synligt — de verkar på
   * canvasen, som låg dold under listan. Det enda som tog en tillbaka var
   * att välja "Visa som lista" igen. En canvasvy lämnar listan.
   */
  for (const action of ["visitor-view-all", "structure-view-all"]) {
    test(`${action} lämnar listan`, async () => {
      const editor = await mounted();
      const outline = await oppnaOversikt(editor);
      const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!;

      expect(outline.hidden).toBe(false);
      toolbar.shadowRoot!
        .querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!
        .click();
      await settle(120);
      toolbar.shadowRoot!
        .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!
        .click();
      await settle(150);
      expect(outline.hidden).toBe(true);
    });
  }
});

/*
 * Johan 2/9 kväll, från telefonen: raderna ska bära nodfärgerna — samma
 * tint/ink-par som palettens badge och nodhuvudet på canvasen, så att
 * listan, paletten och arbetsytan talar samma färgspråk. Innehåll är
 * indigo som förut; avslut grönt, regel lila.
 */
describe("raderna bär nodens färg", () => {
  test("ett avslut är grönt, en fråga indigo", async () => {
    const editor = await mounted();
    const outline = await oppnaOversikt(editor);
    const row = (id: string) =>
      outline.shadowRoot!.querySelector<HTMLElement>(`[data-outline-row][data-node-id="${id}"]`)!;
    const tint = (name: string) => {
      const probe = document.createElement("div");
      probe.style.background = `var(--fw-node-${name}-tint)`;
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };

    expect(row("ring").dataset.nodeType).toBe("result");
    expect(getComputedStyle(row("ring")).backgroundColor).toBe(tint("end"));
    expect(getComputedStyle(row("fraga")).backgroundColor).toBe(tint("content"));
    expect(tint("end")).not.toBe(tint("content"));
  });
});

/*
 * Story 076: listan följer provet. Johan 2/9 kväll: "Om jag stegar i
 * preview [r]ändras det i listvyn?" — nej, provet gick bara till canvasen.
 * Listan är samma guide, och när den täcker canvasen är den enda spegeln
 * av provet den som syns.
 */
describe("listan följer provet", () => {
  const startaProvet = async (editor: GuideEditor) => {
    const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!;

    toolbar.shadowRoot!
      .querySelector<HTMLButtonElement>('[data-menu-trigger="guide"]')!
      .click();
    await settle(120);
    toolbar.shadowRoot!
      .querySelector<HTMLButtonElement>('[data-action="prove-guide"]')!
      .click();
    await settle();
    await settle();
  };

  /* Sidopanelens förhandsgranskning — den redaktören stegar i. */
  const panel = (editor: GuideEditor) =>
    editor.shadowRoot!.querySelector<HTMLElement>(".guide-editor__preview-panel guide-preview")!;

  test("Du är här flyttar i listan när Nästa trycks i förhandsgranskningen", async () => {
    const editor = await mounted();

    await startaProvet(editor);
    const outline = await oppnaOversikt(editor);
    const row = (id: string) =>
      outline.shadowRoot!.querySelector<HTMLElement>(`[data-outline-row][data-node-id="${id}"]`)!;

    // Öppnad mitt i provet: läget syns direkt (punkt 4).
    expect(row("fraga").hasAttribute("data-current")).toBe(true);
    expect(row("fraga").textContent).toContain("Steg 1");
    expect(row("fraga").querySelector("[data-proving-mark]")?.getAttribute("aria-label")).toBe("Du är här");

    const radio = panel(editor).shadowRoot!.querySelector<HTMLInputElement>('input[data-option-id="ja"]')!;

    radio.click();
    await settle(120);
    panel(editor).shadowRoot!.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await settle();
    await settle();

    expect(row("ring").hasAttribute("data-current")).toBe(true);
    expect(row("ring").textContent).toContain("Steg 2");
    expect(row("fraga").hasAttribute("data-current")).toBe(false);
    expect(row("fraga").hasAttribute("data-answered")).toBe(true);
    expect(row("fraga").querySelector("[data-proving-mark]")?.textContent).toBe("✓");
    // Den andra grenen är dämpad — inte bara i färg (punkt 3).
    expect(Number(getComputedStyle(row("slut")).opacity)).toBeLessThan(1);
    expect(getComputedStyle(row("ring")).opacity).toBe("1");
    expect(row("slut").querySelector("[data-proving-mark]")).toBe(null);
  });
});

/*
 * Listans ⇄ (flera vägar hit) ritade markeringen på canvasen — under listan,
 * utan att starta läget, så Esc kunde inte släcka den (läst 5/9, mätt här).
 * En ingång till, samma läge: listan lämnas, raden på arbetsytan säger
 * vilken nod, och Esc avslutar som från Guide-menyn.
 */
describe("⇄ i listan startar Vägar hit", () => {
  const sammanflode = {
    ...grenGraf,
    nodes: [
      ...grenGraf.nodes,
      { id: "mellan", type: "question", position: { x: 250, y: 0 }, data: {
        title: { sv: "Bor någon där?" }, variableName: "bor", presentation: "radio",
        options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }] } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "fraga", portId: "ja" }, to: { nodeId: "mellan", portId: "input" } },
      { id: "c2", from: { nodeId: "fraga", portId: "nej" }, to: { nodeId: "slut", portId: "input" } },
      { id: "c3", from: { nodeId: "mellan", portId: "ja" }, to: { nodeId: "slut", portId: "input" } },
    ],
  };

  test.runIf(PRO)("knappen är läsbar för hjälpmedel, lämnar listan och tänder läget på noden", async () => {
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.setAttribute("mode", "administrator");
    editor.style.cssText = "display: block; width: 1400px; height: 800px;";
    document.body.append(editor);
    editor.graph = structuredClone(sammanflode) as never;
    await settle();
    const outline = await oppnaOversikt(editor);

    const again = outline.shadowRoot!.querySelector<HTMLButtonElement>("[data-outline-routes]");
    if (!again) throw new Error("⇄ saknas trots två vägar till slut");
    expect(again.getAttribute("aria-label")).toBe("Vägar hit");
    again.click();
    await settle();

    expect(outline.hidden).toBe(true);
    const canvas = editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!;
    const bar = canvas.querySelector<HTMLElement>("[data-routes-bar]");
    expect(bar?.hidden).toBe(false);
    expect(bar?.textContent).toContain("Tack");
    expect(canvas.querySelectorAll(".node-editor__connection--highlighted").length).toBe(3);
  });
});

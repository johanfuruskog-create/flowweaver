import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * The panel's tick boxes: the right size, and pressable by a finger.
 *
 * ## What was measured
 *
 * **311×13 px.** A checkbox stretched the full width of the panel and shorter
 * than the row it sat in, because `.properties-panel__field input` set
 * `width: 100%` and a text field's padding with no exception for a control that
 * is not a text field. Wider than its own label, and under the 24px WCAG 2.5.8
 * asks of anything a finger has to hit.
 *
 * The viewer had it right the whole time a component away: an 18px control
 * inside a 45px label.
 *
 * ## Why they are drawn by us now
 *
 * They were the platform's, on the reasoning that `appearance: none` hands us a
 * job we had not done — Windows' high contrast mode repaints native controls and
 * leaves author-drawn ones alone, so a hand-drawn box would vanish there. That
 * objection is answered by one rule rather than avoided: `forced-colors` returns
 * the control to the platform wholesale.
 *
 * What drawing them buys is measurement. 1.4.11 exempts a control the browser
 * paints, which sounds like a favour and is a blind spot: `kontrollkantsbrott`
 * has to skip anything with `appearance: auto`, so a tick box could be invisible
 * against its background and nothing would say so. Drawn, it is measured with
 * everything else — 4.97:1 in light and 5.75:1 in dark.
 *
 * The drawing itself lives in `styles/_tick-boxes.scss`, shared by the panel and
 * the viewer, because two components drawing the same control is two drawings
 * that drift.
 */


/** "#16a34a" som webbläsaren rapporterar den: "rgb(22, 163, 74)". */
const hex2rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** WCAG 2.5.8: the smallest a target may be. */
const TARGET = 24;

async function panelWithANodeSelected(): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 900px;";
  document.body.append(editor);
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "text-question", position: { x: 40, y: 40 }, data: { title: "Ett", variableName: "a" } },
    ],
    connections: [],
  } as never;

  await settle();
  await settle();

  (
    editor.shadowRoot!.querySelector("node-editor") as unknown as {
      selectNodeById?(id: string): void;
    }
  ).selectNodeById?.("q1");

  await settle();
  await settle();

  const panel = editor.shadowRoot!.querySelector("properties-panel");

  if (!panel?.shadowRoot) throw new Error("properties-panel saknas.");

  return panel.shadowRoot;
}

const tickBoxes = (root: ShadowRoot): HTMLInputElement[] =>
  [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]')]
    .filter((box) => box.getBoundingClientRect().width > 0);

describe("kryssrutorna i egenskapspanelen", () => {
  test("ingen av/på-inställning blev kvar som kryssruta", async () => {
    /*
     * Var "är kvadratiska, inte utdragna över panelen" — skrivet mot
     * 311×13-felet, där ett textfälts bredd läckte in i kontrollen. Sedan
     * panelens booleans blev lysknappar (31/8) är formen avsiktligt bredare
     * än hög, och det påståendet bär formtestet nedan. Det som ska vaktas
     * här är i stället att ingen boolean glöms halvvägs: en fyrkantig
     * kryssruta bredvid tre lysknappar är två produkter i samma panel.
     */
    const boxes = tickBoxes(await panelWithANodeSelected());

    // An empty sweep reads exactly like a clean one.
    expect(boxes.length, "inga av/på-kontroller hittades").toBeGreaterThan(0);

    const leftBehind = boxes
      .filter((box) => box.getAttribute("role") !== "switch")
      .map((box) => box.dataset.property ?? box.outerHTML.slice(0, 60));

    expect(leftBehind, "booleans som inte blev lysknappar").toEqual([]);
  });

  test("och raden runt dem går att träffa med ett finger", async () => {
    /*
     * The row rather than the box: the label wraps the input, so the whole line
     * is the target and 2.5.8 is met by the row. Asserting on the box alone
     * would demand an 24px checkbox nobody wants to look at.
     */
    const boxes = tickBoxes(await panelWithANodeSelected());
    const small = boxes
      .map((box) => box.closest("label")?.getBoundingClientRect())
      .filter((rect) => !rect || rect.height < TARGET)
      .map((rect) => (rect ? `${Math.round(rect.height)}px` : "ingen label runt rutan"));

    expect(small, `rader under ${TARGET}px`).toEqual([]);
  });

  test("och de är ritade av oss, inte av plattformen", async () => {
    // Which is what puts them under `kontrollkantsbrott` at all: that sweep
    // skips `appearance: auto`, because the browser's own painting is not ours
    // to measure or to fix.
    const boxes = tickBoxes(await panelWithANodeSelected());
    const native = boxes.filter(
      (box) => getComputedStyle(box).appearance !== "none",
    ).length;

    expect(native, "kryssrutor som fortfarande ritas av webbläsaren").toBe(0);
  });

  test("och en ikryssad ruta syns som ikryssad", async () => {
    /*
     * Checked by what changes, not by a screenshot: the box takes the primary
     * colour and the tick scales from nothing to full size. A drawn control that
     * forgets to show its own state is worse than the native one it replaced.
     */
    const boxes = tickBoxes(await panelWithANodeSelected());
    const box = boxes[0]!;
    const before = getComputedStyle(box, "::before").transform;

    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const style = getComputedStyle(box);
    const primary = getComputedStyle(box).getPropertyValue("--fw-primary").trim();

    expect(style.backgroundColor, "ikryssad ruta byter inte färg").not.toBe(
      getComputedStyle(box).getPropertyValue("--fw-surface").trim(),
    );
    expect(primary, "--fw-primary saknas").not.toBe("");
    expect(
      getComputedStyle(box, "::before").transform,
      `bocken syns inte (före: ${before})`,
    ).not.toBe(before);
  });

  test("är lysknappar: bredare än höga, och säger det till skärmläsaren", async () => {
    /*
     * Johans beslut framför tre designskisser 31/8: panelens av/på-inställningar
     * ("Obligatoriskt fält", synligheten, radbrytet) ritas som lysknappar —
     * och BARA panelens. Visarens samtycke förblir en kryssruta, för ett
     * godkännande är ett avtal, inte en inställning; "reglage, på" är fel ord
     * för ett intyg. `role="switch"` på en riktig checkbox är hela mönstret:
     * tangentbord, form och tillstånd är plattformens, bara ordet och färgen
     * är våra.
     */
    const boxes = tickBoxes(await panelWithANodeSelected());

    expect(boxes.length, "inga av/på-kontroller hittades").toBeGreaterThan(0);

    for (const box of boxes) {
      expect(box.getAttribute("role"), "kontrollen säger inte switch").toBe("switch");

      const rect = box.getBoundingClientRect();

      expect(rect.width, "lysknappen är inte bredare än hög").toBeGreaterThan(rect.height + 8);
      expect(rect.height, "under fingrets golv i en rad som bär målet").toBeGreaterThanOrEqual(18);
    }
  });

  test("och på är GRÖNT, som en lysknapp ska vara", async () => {
    /*
     * Johans ord 31/8: "på ska vara grön." Indigo är väljandets färg i
     * verktyget; av/på är ett tillstånd, och grönt är ordet för på — samma
     * token som hälsopricken och Avslut (`--fw-success`), så mörkt läge
     * följer med gratis.
     */
    const boxes = tickBoxes(await panelWithANodeSelected());
    const box = boxes[0]!;

    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    const style = getComputedStyle(box);
    const success = style.getPropertyValue("--fw-success").trim();

    expect(success, "--fw-success saknas").not.toBe("");
    expect(style.borderColor, "påslagen lysknapp är inte grön").toBe(hex2rgb(success));
  });

  test("och högkontrastläget får tillbaka kontrollen", () => {
    /*
     * Read from the stylesheet, because no browser this suite runs on can be put
     * into forced-colors mode — and a promise nobody checks is how the objection
     * to drawing these at all was supposed to be answered.
     *
     * The rule matters more than its wording: in high contrast the user has asked
     * the system to decide what controls look like, and the honest answer is to
     * stop having opinions rather than to pick different ones.
     */
    const rule = sheet.slice(sheet.indexOf("@media (forced-colors: active)"));

    expect(sheet, "ingen forced-colors-regel alls").toContain("forced-colors: active");
    expect(rule.slice(0, 400), "kontrollen lämnas inte tillbaka").toContain(
      "appearance: auto",
    );
  });
});

/*
 * The shared drawing, read the way every other file-reading test here reads one
 * — through Vite, never `node:fs`.
 */
const sheet = Object.values(
  import.meta.glob("../../../viewer/styles/_tick-boxes.scss", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

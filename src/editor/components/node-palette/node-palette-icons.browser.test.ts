import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./node-palette";

import { NODE_ICONS } from "../../../viewer/node-types/node-icons";
import { proModule } from "../../../testing/optional-pro";

// Whether PRO is here, asked without running it: its palette adds to the
// shared groups the moment it loads, which the open order must not see.
const PRO_PALETTE = Object.keys(import.meta.glob("../../../pro/editor/palette.ts")).length > 0;

/**
 * Every built-in type draws a stroke icon; a typed icon stays as typed.
 *
 * The palette used to render unicode glyphs — "H", "#", "☑", "⌕" — which the
 * platform's font turned into mixed weights and, on a tablet, emoji. The set
 * in `node-icons.ts` replaces them for the built-ins; custom templates keep
 * whatever their author typed, because that string is theirs and lives in the
 * graph.
 */

afterEach(() => {
  document.body.replaceChildren();
});

function montera(): HTMLElement {
  const palette = document.createElement("node-palette");
  // The whole palette, open: the node types and their icons are drawn there;
  // the rail carries one button per category (story 146).
  palette.setAttribute("open", "");
  document.body.append(palette);
  return palette;
}

describe("palettens ikoner", () => {
  test("varje inbyggd typ ritas som streck, inte som en bokstav", () => {
    const palette = montera();
    const buttons = [
      ...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>(".node-palette__full button[data-node-type]"),
    ].filter((button) => (button.dataset.nodeType ?? "") in NODE_ICONS);

    expect(buttons.length, "paletten visar inbyggda typer").toBeGreaterThan(10);

    for (const button of buttons) {
      expect(
        button.querySelector(".node-palette__icon svg"),
        `${button.dataset.nodeType} ritas som SVG`,
      ).not.toBeNull();
    }
  });

  test("ikonens yta ärver badgens färg, så kontrastgrinden och mörkt tema följer med", () => {
    /*
     * Fylld stil sedan 31/8 (Johans val av variant 1, tintad badge): ytan är
     * `currentColor` och urtagen bär klassen `cut`, som stilarket fyller med
     * familjens tintfärg. Mörkt tema mörknar tinten och ljusnar bläcket
     * (tokens-kommentaren: "annars blir det mörkt-på-mörkt"), så ikonen
     * följer med utan egen mörk-läge-kod — och `ikonkontrastbrott` mäter
     * bläcket mot badgen i båda teman.
     */
    const palette = montera();
    const svg = palette.shadowRoot!.querySelector<SVGElement>(
      'button[data-node-type="rule"] .node-palette__icon svg',
    );

    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("fill"), "ytan är inte currentColor").toBe("currentColor");
    expect(svg!.getAttribute("stroke"), "fylld stil ritar inte med streck").toBeNull();
  });

  test("en mall utan egen ikon ärver sin bastyps streck", () => {
    const palette = montera() as HTMLElement & { templates: unknown };

    palette.templates = [
      { type: "template:t1", base: "question", label: "Min mall", icon: "" },
    ];

    expect(
      palette.shadowRoot!.querySelector('button[data-node-type="template:t1"] .node-palette__icon svg'),
      "mallen ärver frågans streckikon",
    ).not.toBeNull();
  });

  test("men en typad ikon står kvar som text", () => {
    const palette = montera() as HTMLElement & { templates: unknown };

    palette.templates = [
      { type: "template:t2", base: "question", label: "Egen", icon: "★" },
    ];

    const icon = palette.shadowRoot!.querySelector('button[data-node-type="template:t2"] .node-palette__icon');

    expect(icon?.querySelector("svg")).toBeNull();
    expect(icon?.textContent?.trim()).toBe("★");
  });
});

describe("innehållsgruppens ordning", () => {
  test("är ämnesordningen, med sökfälten i anslutning till varandra", () => {
    /*
     * Johans regel 31/8: "användaren behöver tycka det är logiskt" — och de
     * två sökfälten hörde ihop men stod isär. Ordningen är ämnen i följd:
     * välja bland alternativ, skriva fritt, söka i en lista, särskilda svar,
     * visa (inte fråga), bygga sida. Vald ur tre uppritade förslag (A).
     *
     * Testet läser den RITADE följden, inte listan i källan: fram till i dag
     * styrde registreringsordningen medan den handskrivna listan bara avgjorde
     * medlemskap — två hem för ordningen, där det synliga var det falska.
     * Sett falla på just det.
     */
    const palette = montera();
    const drawn = [
      ...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>(".node-palette__full button[data-node-type]"),
    ].map((button) => button.dataset.nodeType ?? "");

    const content = drawn.slice(0, drawn.indexOf("rule"));

    // The open palette: the fields that belong to sending (free text, the
    // rating, the attachment, consent) are FlowWeaver PRO's since 8/10 and
    // are added back by PRO — the order with them is the test below.
    expect(content).toEqual([
      "question",
      "multi-choice",
      "number-question",
      "date-question",
      "autocomplete-question",
      "multi-autocomplete-question",
      "map-question",
      "image",
      "annotated-image",
      "code",
      "page",
      // Sidbarnen (sidrubrik, mellanrum) saknas med flit: de visas först när
      // guiden har en Sida att lägga dem i, och den här paletten har ingen graf.
    ]);
  });

  /*
   * With PRO the sending fields stand where they stood in the open list until
   * 8/10. Last in the file: loading PRO's palette adds to the shared groups.
   */
  test.runIf(PRO_PALETTE)("med PRO står fälten för inlämning på sina gamla platser", async () => {
    await proModule("editor/palette.ts");
    const palette = montera();
    const drawn = [
      ...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>(".node-palette__full button[data-node-type]"),
    ].map((button) => button.dataset.nodeType ?? "");

    expect(drawn.slice(0, drawn.indexOf("rule"))).toEqual([
      "question",
      "multi-choice",
      "text-question",
      "number-question",
      // Betyg (story 115) beside the number: it IS a number, picked off a
      // scale, and the two belong next to each other in the same subject.
      "rating-question",
      "date-question",
      "autocomplete-question",
      "multi-autocomplete-question",
      "map-question",
      "file-question",
      "consent-question",
      "image",
      "annotated-image",
      "code",
      "page",
    ]);
  });
});

describe("paletten under ett finger", () => {
  test("ett lodrätt svep på en knapp får skrolla listan", () => {
    /*
     * Johans iPad 1/9: paletten gick inte att skrolla när den blev för lång.
     * Chromium friade layouten (224 px synligt av 784, overflow-y auto) —
     * felet var gesten. Knapparna bar `touch-action: none` för att kunna
     * dras ut, och knapparna fyller listan, så ett svep hade ingenstans att
     * bli en skroll. `pan-y` låter webbläsaren ta lodräta svep (den skickar
     * pointercancel, som draghanteraren redan städar på) medan vågräta —
     * att dra en nod UT, åt höger — förblir drag.
     */
    const palette = montera();
    const button = palette.shadowRoot!.querySelector<HTMLButtonElement>("button[data-node-type]")!;

    expect(getComputedStyle(button).touchAction, "knappen tar alla svep själv").toBe("pan-y");
  });
});

describe("badgen och etiketten", () => {
  test("badgen linjerar med FÖRSTA raden, även när etiketten bryts", () => {
    /*
     * Johan 1/9: "när det är två rader ska den ligga i baseline med första
     * raden." Mätt: på en tvåradig etikett låg badgens mitt 7,5 px under
     * första radens mitt — knappen centrerade badgen mot hela blocket. En
     * ikon hör till sin första rad, inte till blockets mitt.
     */
    const palette = montera();
    // Narrower than the open palette's 230 (story 146), so a label is sure to
    // break whatever font the page outside an editor gives it.
    palette.shadowRoot!.querySelector<HTMLElement>(".node-palette__full")!.style.width = "190px";
    const buttons = [...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>(".node-palette__full button[data-node-type]")];
    const wrapped = buttons
      .map((button) => {
        const label = button.querySelector(".node-palette__label")!;
        const range = document.createRange();
        range.selectNodeContents(label);
        const lines = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        return { button, lines };
      })
      .find((one) => one.lines.length > 1);

    expect(wrapped, "ingen etikett bryts vid 190px — mätningen saknar sitt fall").toBeDefined();

    const badge = wrapped!.button.querySelector(".node-palette__icon")!.getBoundingClientRect();
    const first = wrapped!.lines[0];
    const diff = Math.abs((badge.top + badge.height / 2) - (first.top + first.height / 2));

    expect(diff, "badgen står inte i höjd med första raden").toBeLessThanOrEqual(1.5);
  });
});

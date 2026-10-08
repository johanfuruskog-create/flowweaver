// The sending steps are FlowWeaver PRO's; this test uses them (open-core step 4).
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";


import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
await withPro("viewer/index.ts");
const { registerSubmissionReceiver, unregisterSubmissionReceiver } = (await proModule("viewer/core/submission-registry.ts")) ?? {};
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * The viewer on a narrow surface: give the question room, keep the action reachable.
 *
 * ## What was measured
 *
 * On 360×780 against the bundled guides: the question starts **422px down** and
 * the card takes the rest. Over half a phone is spent before the question
 * begins — on our own example page, which has less above it than a municipal
 * site would. Across thirteen steps the "Nästa" button was **entirely below the
 * fold in five of them** at scroll 0, and `scrollY` stays at 0 after each step:
 * nothing brings the view back.
 *
 * With the every-field guide, whose card runs to 1181px, the button ended at
 * **1546px** — 766px of scrolling to reach the only way forward. Sticky puts it
 * at 768px.
 *
 * ## Why a container query and not a media query
 *
 * Because the viewer can sit in a narrow column on a wide screen — a
 * municipality's sidebar is the ordinary case, not the exception. `@media`
 * measures the window and would hand a 300px column the full-width treatment,
 * which is exactly the wrong answer to exactly that question. The test below
 * pins this: a narrow *element* in a wide window must get the narrow layout.
 */

afterEach(() => {
  document.body.replaceChildren();
  unregisterSubmissionReceiver();
});

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Long enough that the card cannot fit, which is when any of this matters. */
function tallGraph(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vilken av de här beskriver din situation bäst just nu?" },
          description: { sv: "Välj det som stämmer närmast. ".repeat(12) },
          variableName: "sit",
          options: Array.from({ length: 8 }, (_, index) => ({
            id: `o${index}`,
            label: { sv: `Alternativ ${index + 1} med en ganska lång etikett` },
            value: `v${index}`,
          })),
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: Array.from({ length: 8 }, (_, index) => ({
      id: `c${index}`,
      from: { nodeId: "q", portId: `o${index}` },
      to: { nodeId: "r", portId: "input" },
    })),
  } as GraphData;
}

async function viewerOfWidth(width: number): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.style.cssText = `display: block; width: ${width}px;`;
  document.body.append(preview);
  preview.graph = tallGraph();

  await settle();
  await settle();

  return preview;
}

const part = (preview: GuidePreview, selector: string): HTMLElement =>
  preview.shadowRoot!.querySelector<HTMLElement>(selector)!;

describe("på en smal yta", () => {
  test.runIf(PRO)("håller sig vägen framåt kvar på skärmen", async () => {
    /*
     * Asserted on the button's position rather than on the CSS: `position:
     * sticky` is how it is done today, and what has to hold is that the only way
     * forward can be reached without hunting for it.
     */
    const preview = await viewerOfWidth(360);
    const card = part(preview, ".guide-preview__card").getBoundingClientRect();
    const next = part(preview, '[data-action="next"]').getBoundingClientRect();

    expect(card.height, "kortet får plats — då mäter testet ingenting").toBeGreaterThan(
      window.innerHeight,
    );
    expect(
      next.bottom,
      `Nästa slutar ${Math.round(next.bottom)}px, vikten är ${window.innerHeight}px`,
    ).toBeLessThanOrEqual(window.innerHeight);
  });

  test.runIf(PRO)("och ger frågan tillbaka höjd och bredd", async () => {
    const narrow = await viewerOfWidth(360);
    const heading = getComputedStyle(part(narrow, "h2")).fontSize;
    const padding = getComputedStyle(part(narrow, ".guide-preview__card")).paddingTop;

    expect(heading, "rubriken krympte inte").toBe("22px");
    expect(padding, "kortets padding krympte inte").toBe("16px");
  });
});

describe("på kvittensen", () => {
  test.runIf(PRO)("står Nytt ärende sist, under listan — inget att nå i tumzonen där", async () => {
    /*
     * Flowbasket's 390 px still (8/9) showed "Nytt ärende" pinned over "Det här
     * skickades". That one was a full-page screenshot artefact of the sticky
     * band — but the band itself was wrong for the receipt: the visitor is
     * reading what was sent, and a restart button is the last thing to hold in
     * the thumb zone while covering the list. Johan: "Kvittensen kan ta bort
     * stickyn."
     */
    registerSubmissionReceiver({
      recipients: () => [{ id: "kontoret", label: "Kontoret" }],
      submit: async () => ({ reference: "FW-TEST-1" }),
    });
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.style.cssText = "display: block; width: 360px;";
    document.body.append(preview);
    preview.graph = {
      version: 8,
      startNodeId: "q",
      nodes: [
        { id: "q", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Vad hände?" }, variableName: "svar", required: true } },
        {
          id: "slut",
          type: "submit-result",
          position: { x: 500, y: 0 },
          data: {
            title: { sv: "Tack för din beställning" },
            description: { sv: "Vi postar blanketterna och bekräftar per e-post. ".repeat(20) },
            recipientIds: ["kontoret"],
          },
        },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "slut", portId: "input" } },
      ],
    } as unknown as GraphData;
    await settle();
    await settle();

    const input = part(preview, "[data-text-answer]") as HTMLInputElement;

    input.value = "Lampan är trasig";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    part(preview, '[data-action="next"]').click();
    await settle(600);

    const card = part(preview, ".guide-preview__card").getBoundingClientRect();
    const sent = part(preview, ".guide-preview__submit-sent").getBoundingClientRect();
    const navigation = part(preview, ".guide-preview__navigation").getBoundingClientRect();

    expect(card.height, "kortet får plats — då mäter testet ingenting").toBeGreaterThan(
      window.innerHeight,
    );
    expect(
      navigation.top,
      `Nytt ärende börjar ${Math.round(navigation.top)}px, listan slutar ${Math.round(sent.bottom)}px`,
    ).toBeGreaterThanOrEqual(sent.bottom);
  });
});

describe("kortets inre avstånd", () => {
  /*
   * Astra 30/9 (B8, GENOMGANG V28): 24 px (`--fw-space-5`) in a wide viewer,
   * 16 px kept when the viewer is narrower than 400 px — the component's
   * responsive variant, steered by the viewer's own width (`data-under`), not
   * the window's. 390 is the phone the comparison was shot in.
   */
  test.runIf(PRO).each([
    [900, "24px"],
    [390, "16px"],
  ])("är %i px bred: %s runt om", async (width, padding) => {
    const style = getComputedStyle(part(await viewerOfWidth(width), ".guide-preview__card"));

    expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual([
      padding,
      padding,
      padding,
      padding,
    ]);
  });
});

describe("på en bred yta", () => {
  test.runIf(PRO)("är ingenting av det här påslaget", async () => {
    const wide = await viewerOfWidth(900);

    expect(getComputedStyle(part(wide, "h2")).fontSize).toBe("26px");
    expect(
      getComputedStyle(part(wide, ".guide-preview__navigation")).position,
    ).toBe("static");
  });
});

describe("måttet som räknas", () => {
  test.runIf(PRO)("är visarens egen bredd, inte fönstrets", async () => {
    /*
     * The distinguishing assertion. The window here is wide; the element is not.
     * A media query would give this viewer the roomy layout and put the button
     * out of reach in a sidebar — which is the common way to embed us.
     */
    const narrowInWideWindow = await viewerOfWidth(340);

    expect(window.innerWidth, "fönstret är smalt — testet skiljer inget").toBeGreaterThan(
      600,
    );
    expect(getComputedStyle(part(narrowInWideWindow, "h2")).fontSize).toBe("22px");
  });
});

describe("i en nod på canvasen", () => {
  test.runIf(PRO)("står knappraden sist, under svaren — miniatyren ärver inte telefonregeln", async () => {
    /*
     * Johans telefon 3/9, på USP-filmen: *"Knappar för långt upp på noden"*.
     * A node is always narrower than 400 px, so the miniature met the phone
     * rule above, and `position: sticky; bottom: 0` lifted the buttons up over
     * the answers whenever the card ran below the canvas's visible edge.
     * Measured at the film's frame: navigation y=532, options y=560.
     */
    const box = document.createElement("div");

    box.style.cssText = "width: 260px; height: 120px; overflow: auto;";
    document.body.append(box);
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("editor-view", "");
    preview.style.cssText = "display: block; width: 260px;";
    box.append(preview);
    preview.graph = tallGraph();
    await settle();
    await settle();

    const options = part(preview, ".guide-preview__options").getBoundingClientRect();
    const navigation = part(preview, ".guide-preview__navigation").getBoundingClientRect();

    expect(box.getBoundingClientRect().bottom, "kortet får plats — då mäter testet ingenting")
      .toBeLessThan(navigation.bottom + options.height);
    expect(
      navigation.top,
      `knappraden börjar ${Math.round(navigation.top)}px, svaren slutar ${Math.round(options.bottom)}px`,
    ).toBeGreaterThanOrEqual(options.bottom);
  });
});

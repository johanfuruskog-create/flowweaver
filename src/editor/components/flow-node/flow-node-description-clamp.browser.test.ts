import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * The card's description stops at two rows — Uppdrag 23/9, Del A punkt 3.
 *
 * The whole text still exists: it is unabridged in the properties panel and in
 * the visitor's own view (`FormattedTextService` renders the page field there,
 * a separate surface this class never touches). Only the *card* — a thumbnail
 * on a canvas people scan, not read — stops early. `-webkit-line-clamp` is the
 * floor K18 already sets (Chrome 98 / Safari 15.4 / Firefox 95 all support the
 * unprefixed and prefixed forms), so no fallback is needed.
 */

const NODBREDD = 240;

const LONG_DESCRIPTION =
  "Det här är en beskrivning som är skriven för att med säkerhet svämma över " +
  "två rader på ett kort som bara är 240 pixlar brett, med flera meningar " +
  "efter varandra så att en tredje och en fjärde rad annars skulle rita ut " +
  "sig på canvasen, vilket är precis det uppdraget säger ska stoppas.";

function mount(node: FlowNodeData): FlowNode {
  const el = document.createElement("flow-node") as FlowNode;
  el.style.cssText = `display: block; width: ${NODBREDD}px;`;
  document.body.append(el);
  el.nodeData = node;
  return el;
}

afterEach(() => document.body.replaceChildren());

describe("kortets beskrivning", () => {
  test("klipps efter två rader — inget bortom den höjden målas", () => {
    /*
     * `Range.getClientRects()` var fel mätpunkt: `-webkit-line-clamp` klipper
     * med `overflow: hidden`, det tar inte bort de extra radernas layout, så
     * en rect-räkning såg alla nio raderna även med klippningen aktiv. Det
     * webbläsaren faktiskt målar är begränsat av containerns egen höjd — så
     * det är den som bevisar att en tredje rad aldrig ritas: en `overflow:
     * hidden`-låda kan inte visa något utanför sin egen ruta, oavsett hur
     * mycket text som ligger dold därunder.
     */
    const el = mount({
      id: "n",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "v", description: LONG_DESCRIPTION },
    });

    const description = el.shadowRoot?.querySelector<HTMLElement>(
      ".flow-node__description",
    );
    if (!description) throw new Error("beskrivningen saknas.");

    const style = getComputedStyle(description);

    // Chromium rapporterar `-webkit-box` som "flow-root" här (dess egen
    // serialisering av den äldre boxmodellen) — beteendet nedan, den faktiska
    // höjden, är vad som räknas.
    expect(style.overflow).toBe("hidden");
    expect(style.webkitLineClamp).toBe("2");

    const lineHeight = parseFloat(style.lineHeight);
    const rows = description.getBoundingClientRect().height / lineHeight;

    // Ett par tiondelar för avrundning; långt under vad nio rader skulle ge.
    expect(rows).toBeLessThan(2.2);
  });

  test("kortets höjd följer klippningen, inte den fulla texten", () => {
    const short = mount({
      id: "short",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "v", description: "En kort mening." },
    });
    const long = mount({
      id: "long",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "v", description: LONG_DESCRIPTION },
    });

    const shortDescription = short.shadowRoot!.querySelector<HTMLElement>(
      ".flow-node__description",
    )!;
    const longDescription = long.shadowRoot!.querySelector<HTMLElement>(
      ".flow-node__description",
    )!;

    // Två rader kan vara någon pixel högre än en (radhöjden), men aldrig fyra
    // raders värde — det vore beviset att texten klipps visuellt men fortsätter
    // ta plats i layouten.
    const oneRow = shortDescription.getBoundingClientRect().height;
    const twoRows = longDescription.getBoundingClientRect().height;

    expect(twoRows).toBeGreaterThan(oneRow);
    expect(twoRows).toBeLessThan(oneRow * 3);
  });

  test("hela texten finns kvar i datan, bara kortet klipper den", () => {
    const el = mount({
      id: "n",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: "Fråga", variableName: "v", description: LONG_DESCRIPTION },
    });

    expect(el.nodeData?.data.description).toBe(LONG_DESCRIPTION);
  });
});

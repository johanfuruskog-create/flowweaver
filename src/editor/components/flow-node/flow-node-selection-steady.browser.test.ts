import { afterEach, describe, expect, test } from "vitest";

// Nodtyperna först: `flow-node` drar in editorns egenskapsdefinitioner, och de
// slår upp typerna redan när modulen laddas.
import "../../../viewer/node-types/default-node-types";
import "./flow-node";

// Stilmallen som den skeppas: kortets stilar delas som ett adopterat blad när
// canvasen bygger många noder, så de finns inte alltid som `<style>` i roten.
import styles from "./flow-node.scss?inline";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * Markeringsramen står still medan man skriver (berättelse 124:s efterspel).
 *
 * ## Felet det här är skrivet ur
 *
 * Johan såg ramen blinka runt den markerade noden vid varje tangenttryck i
 * egenskapspanelen. Mätt: varje tecken ger `graph-changed`, canvasen sätter ny
 * `nodeData`, och `render()` bygger om hela kortet. Den nya `<article>` föddes
 * **omarkerad** och fick `data-selected` påsatt en rad senare — och eftersom
 * `.flow-node` har `transition: box-shadow 120ms` spelades ringen upp på nytt
 * varje gång.
 *
 * ## Vad som mäts, och varför just det
 *
 * Att kortet ser markerat ut efteråt säger ingenting: det gjorde det förut
 * också, en bråkdel senare. Det som skiljer är **hur** attributet kom dit —
 * skrivet i mallen, eller påsatt efter att elementet redan fanns. Det andra
 * lämnar ett fönster där webbläsaren kan ha räknat om stilen, och det fönstret
 * är blinket.
 *
 * En `MutationObserver` ser skillnaden: sätts attributet efteråt finns en
 * `attributes`-post för `data-selected`. Föds kortet med det finns ingen.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const node = (title: string): FlowNodeData =>
  ({
    id: "q1",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title,
      variableName: "bor",
      options: [
        { id: "ja", label: "Ja", value: "ja" },
        { id: "nej", label: "Nej", value: "nej" },
      ],
    },
  }) as unknown as FlowNodeData;

async function mount(): Promise<FlowNode> {
  const element = document.createElement("flow-node") as FlowNode;

  element.setAttribute("editor-locale", "sv");
  document.body.append(element);
  element.nodeData = node("Bor du i kommunen?");
  element.selected = true;
  await settle();

  return element;
}

describe("markeringen medan man skriver", () => {
  test("kortet föds markerat — attributet sätts aldrig på efteråt", async () => {
    const element = await mount();
    const seen: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "data-selected") {
          seen.push((record.target as HTMLElement).className);
        }
      }
    });

    observer.observe(element.shadowRoot!, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-selected"],
    });

    // Ett tecken till i rubriken, precis som egenskapspanelen gör.
    element.nodeData = node("Bor du i kommunen i dag?");

    /*
     * Mätt direkt, före nästa bildruta: ringen är redan tänd. Det är det
     * blinket ÄR — ett ögonblick där kortet står omarkerat och skuggan tonar in
     * därifrån. Ett kort som föds markerat har ingen skugga att tona från.
     */
    const genast = getComputedStyle(element.shadowRoot!.querySelector(".flow-node")!).boxShadow;

    expect(genast, "ringen finns redan i första bildrutan").not.toBe("none");

    await settle();
    observer.disconnect();

    expect(seen, "ramen ska inte tändas om för ett tecken").toEqual([]);
    expect(
      element.shadowRoot!.querySelector(".flow-node")?.hasAttribute("data-selected"),
      "och kortet är förstås markerat hela tiden",
    ).toBe(true);
  });

  test("och en omarkerad nod föds omarkerad", async () => {
    const element = await mount();

    element.selected = false;
    await settle();
    element.nodeData = node("Bor du här?");
    await settle();

    const card = element.shadowRoot!.querySelector(".flow-node")!;

    expect(card.hasAttribute("data-selected")).toBe(false);
    expect(card.getAttribute("aria-selected")).toBe("false");
  });

  /*
   * Och ringen animeras inte för den som bett att slippa rörelse. Den låg
   * utanför `prefers-reduced-motion`-blocket medan allt annat på kortet låg
   * innanför — mätt 18/9, i samma omgång som blinket.
   */
  test("ingen övergång på ramen för den som bett om mindre rörelse", async () => {
    const element = await mount();
    /*
     * Läst ur stilmallen som skeppas, för provet kan inte be webbläsaren att
     * låtsas ha rörelse avstängd: `prefers-reduced-motion` styrs av systemet,
     * och vitest kör i en webbläsare vi inte kan ljuga för. Det som går att
     * påstå är att regeln finns i det som levereras — och det är den som
     * saknades.
     */
    void element;

    const off = styles
      .split("@media")
      .filter((part) => part.startsWith(" (prefers-reduced-motion: reduce)"))
      .some((part) => /(^|\s)\.flow-node\s*\{\s*transition:\s*none/.test(part));

    expect(off, "ramens övergång stängs av i rörelseblocket").toBe(true);
  });
});

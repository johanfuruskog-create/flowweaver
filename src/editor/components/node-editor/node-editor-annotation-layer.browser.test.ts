import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Anteckningen ligger överst.
 *
 * ## Var det upptäcktes
 *
 * Johan frågade hur anteckningar fungerar för ett fält inne på en sida — en
 * väg som aldrig prövats. Mätt: sidbarn har `z-index: 3`, vanliga noder 2, och
 * anteckningen hade ingen egen regel alls. Den hamnade alltså BAKOM varje fält
 * på en sida, och delvis bakom vilken nod som helst som råkade ritas senare.
 *
 * ## Varför just överst
 *
 * En anteckning är inte en del av flödet — den är någon som pekar på flödet.
 * Att den skyms av det den kommenterar är samma sorts fel som en varning bakom
 * en dialog: den finns, men når inte fram. Och den som skriver en lapp gör det
 * för att bli läst.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const graph = {
  startNodeId: "sida",
  nodes: [
    { id: "sida", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om dig" } } },
    {
      id: "falt",
      type: "text-question",
      position: { x: 0, y: 0 },
      parentPageId: "sida",
      order: 0,
      data: { title: { sv: "Din e-post" }, variableName: "epost" },
    },
    { id: "fraga", type: "question", position: { x: 900, y: 0 }, data: { title: { sv: "Nöjd?" }, variableName: "n" } },
    {
      id: "lapp",
      type: "annotation",
      position: { x: 400, y: 60 },
      data: { text: "Fältet ska bort efter upphandlingen.", targetNodeId: "falt", arrow: true },
    },
  ],
  connections: [],
};

async function canvas(): Promise<ShadowRoot> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = graph as never;

  await settle();
  await settle();

  return editor.shadowRoot!.querySelector("node-editor")!.shadowRoot!;
}

const lagerFör = (root: ShadowRoot, id: string): number => {
  const nod = [...root.querySelectorAll("flow-node")].find(
    (one) => (one as { nodeId?: string }).nodeId === id,
  )!;

  return Number(getComputedStyle(nod).zIndex);
};

describe("anteckningen i lagren", () => {
  test("ligger över ett fält på en sida", async () => {
    const root = await canvas();

    expect(lagerFör(root, "lapp")).toBeGreaterThan(lagerFör(root, "falt"));
  });

  test("och över en vanlig nod", async () => {
    const root = await canvas();

    expect(lagerFör(root, "lapp")).toBeGreaterThan(lagerFör(root, "fraga"));
  });

  test("och dess pil ritas ovanför sidkortet den pekar in i", async () => {
    /*
     * Johans öga: "pilen går inte ända fram till fältet i sidnoden". Mätt slutar
     * linjen 0 px från fältets överkant — geometrin var rätt hela tiden. Felet
     * var LAGRET: kopplingarnas svg ligger på z-index 1, samma som sidkortet och
     * under fälten (3), så linjen ritades under en ogenomskinlig yta och
     * försvann vid sidans kant.
     *
     * Flödespilarna ska fortsätta ligga bakom noderna — de kopplar kanter. Det
     * är anteckningens linje som ska ovanpå, för den pekar IN i något.
     */
    const root = await canvas();
    const länk = root.querySelector(".node-editor__annotation-link");
    const lager = länk?.closest("svg");

    expect(länk, "ingen anteckningslinje ritades").toBeTruthy();
    expect(Number(getComputedStyle(lager!).zIndex)).toBeGreaterThan(lagerFör(root, "falt"));
  });

  test("medan sidbarnet fortfarande ligger över sin sida", async () => {
    // Lagringen får inte kastas om på vägen: fältet ska synas i sitt kort.
    const root = await canvas();

    expect(lagerFör(root, "falt")).toBeGreaterThan(lagerFör(root, "sida"));
  });
});

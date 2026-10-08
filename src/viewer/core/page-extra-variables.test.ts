import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";

import { answerText } from "./answer-values";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/**
 * A page keeps the second variable a field stores, not only the first.
 *
 * ## The fault this is written from
 *
 * `answerPage` committed `field.variableName` and dropped everything else the
 * form carried. A lookup stores two things — the label somebody reads and the
 * **code** a rule branches on — and on a page the code was thrown away. The
 * hidden field held `DE`; the answers held only `Tyskland`.
 *
 * Which means every rule written against the code, on a page, quietly tested an
 * empty string. `every-field` has had `codeVariableName: "adressKod"` on a page
 * this whole time.
 *
 * ## The shape it belongs to
 *
 * The third of the same kind found today: the service was right, the component
 * was right, and the answer was lost on the way through the page. `format` was
 * dropped there too, and an unticked consent was read as `true` there. A page is
 * where a form lives, so a page is where these cost the most.
 *
 * ## Vad som ändrades i version 9
 *
 * Koden ligger inte i en variabel bredvid längre; den är en **del** av svaret.
 * `land` bär `{ label, value }`, och ett villkor namnger delen — `land.value`.
 * Det var enda skälet den andra variabeln fanns: ett villkor kunde bara namnge
 * en hel variabel.
 *
 * Felet det här testet skrevs från gäller likafullt, och gäller nu delen: går
 * svaret genom en sida ska koden komma fram, inte bara etiketten.
 */

const settle = () => undefined;

const pageWith = (field: Record<string, unknown>): GraphData =>
  ({
    startNodeId: "p",
    settings: { sourceLocale: "sv" },
    nodes: [
      { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
      { id: "f", parentPageId: "p", order: 0, position: { x: 0, y: 0 }, ...field },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
    ],
  }) as unknown as GraphData;

describe("a lookup on a page", () => {
  test("keeps the code a rule would branch on", () => {
    const engine = new GuideTraversalEngine(
      pageWith({
        type: "autocomplete-question",
        data: {
          title: { sv: "Land" },
          variableName: "land",
          source: "mock",
          mockItems: [{ id: "1", label: { sv: "Tyskland" }, value: "DE" }],
        },
      }),
    );

    settle();
    engine.answerPage({ land: { label: "Tyskland", code: "DE" } });

    // Etiketten var aldrig poängen. Koden finns för att etiketter översätts
    // och koder inte gör det — och nu reser de tillsammans.
    expect(engine.getAnswers()).toMatchObject({ land: { label: "Tyskland", code: "DE" } });
  });

  test("still keeps the label", () => {
    const engine = new GuideTraversalEngine(
      pageWith({
        type: "autocomplete-question",
        data: { title: { sv: "Land" }, variableName: "land", source: "mock", mockItems: [] },
      }),
    );

    engine.answerPage({ land: { label: "Tyskland", code: "DE" } });

    expect(answerText(engine.getAnswers().land)).toBe("Tyskland");
  });
});

describe("what is not kept", () => {
  test("a value the page never asked for", () => {
    /*
     * The engine commits what the fields declare, not whatever the form
     * happened to contain. Otherwise anything a host put in the DOM would
     * become a guide variable.
     */
    const engine = new GuideTraversalEngine(
      pageWith({
        type: "text-question",
        data: { title: { sv: "Namn" }, variableName: "namn" },
      }),
    );

    engine.answerPage({ namn: "Anna", smugglat: "nej tack" });

    expect(engine.getAnswers().smugglat).toBeUndefined();
  });
});

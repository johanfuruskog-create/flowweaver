import { describe, expect, test } from "vitest";

import "../node-types/default-node-types";
import { GuideTraversalEngine } from "./guide-traversal-engine";

import type { GraphData } from "../types/graph";

/*
 * Blankettfilmens engelska tagning (story 090): granskningen sa *Namn* och
 * *Postadress* i en guide besökaren läste på engelska — sidan själv sa
 * *Name*. Posterna motorn skriver fick fältens etiketter utan språk, alltså
 * källspråket, och granskningen, mejlets `{{lista}}` och ett fel om ett
 * tomt fält läser alla de posterna.
 */
const graph: GraphData = {
  startNodeId: "delivery",
  nodes: [
    { id: "delivery", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Leverans", en: "Delivery" } } },
    {
      id: "f-name", type: "text-question", position: { x: 0, y: 0 }, parentPageId: "delivery", order: 0,
      data: { title: { sv: "Namn", en: "Name" }, variableName: "namn", required: true },
    },
    {
      id: "forms", type: "page", position: { x: 300, y: 0 },
      data: { title: { sv: "Blanketter", en: "Forms" }, repeats: true, repeatWord: { sv: "blankett", en: "form" }, repeatVariable: "blankett" },
    },
    {
      id: "f-count", type: "number-question", position: { x: 0, y: 0 }, parentPageId: "forms", order: 0,
      data: { title: { sv: "Antal", en: "Quantity" }, variableName: "antal", required: true },
    },
    { id: "done", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart" } },
  ],
  connections: [
    { id: "a", from: { nodeId: "delivery", portId: "continue" }, to: { nodeId: "forms", portId: "input" } },
    { id: "b", from: { nodeId: "forms", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
  ],
  settings: { sourceLocale: "sv", locales: ["sv", "en"] },
};

describe("posternas etiketter följer språket besökaren läser på", () => {
  test("en sida och en upprepad sida, på engelska", () => {
    const engine = new GuideTraversalEngine(graph, { locale: "en" });

    expect(engine.answerPage({ namn: "Anna" })).toMatchObject({ success: true });
    expect(engine.answerPage({ blankett: [{ antal: "2" }] })).toMatchObject({ success: true });
    expect(engine.getAnswerRecords().map((record) => record.questionTitle)).toEqual(["Name", "Form 1 — Quantity"]);
  });

  /*
   * Samma klass av fel i en annan kodväg: inlämningsfilmen på engelska (29/8
   * och 4/9) visade *Vad gäller felet? / Ja, det kan skada någon* i
   * granskningen och kvittot. Sidfälten var rättade; frågenoderna skrev
   * fortfarande titel och alternativ utan språk.
   */
  test("en frågenods titel och valda alternativ, på engelska", () => {
    const questions: GraphData = {
      startNodeId: "what",
      nodes: [
        {
          id: "what", type: "text-question", position: { x: 0, y: 0 },
          data: { title: { sv: "Vad gäller felet?", en: "What is the fault?" }, variableName: "fel" },
        },
        {
          id: "danger", type: "question", position: { x: 300, y: 0 },
          data: {
            title: { sv: "Är felet farligt?", en: "Is the fault dangerous?" },
            variableName: "farligt",
            options: [
              { id: "yes", label: { sv: "Ja, det kan skada någon", en: "Yes, somebody could get hurt" }, value: "ja" },
              { id: "no", label: { sv: "Nej, det kan vänta", en: "No, it can wait" }, value: "nej" },
            ],
          },
        },
        { id: "done", type: "result", position: { x: 600, y: 0 }, data: { title: "Klart" } },
      ],
      connections: [
        { id: "a", from: { nodeId: "what", portId: "continue" }, to: { nodeId: "danger", portId: "input" } },
        { id: "b", from: { nodeId: "danger", portId: "yes" }, to: { nodeId: "done", portId: "input" } },
      ],
      settings: { sourceLocale: "sv", locales: ["sv", "en"] },
    };
    const engine = new GuideTraversalEngine(questions, { locale: "en" });

    expect(engine.answerValue("The lamp is out")).toMatchObject({ success: true });
    expect(engine.answer("yes")).toMatchObject({ success: true });
    expect(engine.getAnswerRecords().map((record) => [record.questionTitle, record.optionLabel])).toEqual([
      ["What is the fault?", "The lamp is out"],
      ["Is the fault dangerous?", "Yes, somebody could get hurt"],
    ]);
  });

  test("felet om ett tomt fält nämner fältet på samma språk", () => {
    const engine = new GuideTraversalEngine(graph, { locale: "en" });

    expect(engine.answerPage({ namn: "" })).toMatchObject({ error: { message: expect.stringContaining('"Name"') } });
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../viewer/node-types/default-node-types";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../testing/optional-pro";
const PRO = await withPro("viewer/node-types/submission-node-types.ts", "editor/node-types/submission-node-properties.ts");

import { reachableViewerKeys } from "./reachable-viewer-keys";
import { TranslationProgressService } from "./translation-progress-service";
import { isViewerString } from "../../viewer/localization/built-in-strings";
import { registerLocale, unregisterLocale } from "../../viewer/localization/registry";

import type { GraphData } from "../../viewer/types/graph";

const graph: GraphData = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: { sv: "Fråga", en: "Question" }, // översatt
        description: "Beskrivning", // bara källa → oöversatt
        variableName: "svar",
        variableLabel: "Svaret", // oöversatt — aliaset räknas som rubriken (story 080)
        options: [
          { id: "a", label: { sv: "Ja", en: "Yes" }, value: "yes" }, // översatt
          { id: "b", label: "Nej", value: "no" }, // oöversatt
        ],
      },
    },
    {
      id: "c",
      type: "calculation",
      position: { x: 200, y: 0 },
      data: { title: { sv: "Räkna", en: "Calculate" }, assignments: [{ id: "a", variableName: "x", formula: "1", label: "Ett" }] }, // title översatt, radetiketten inte
    },
    {
      id: "r",
      type: "result",
      position: { x: 400, y: 0 },
      data: { title: "Klart", description: "" }, // title oöversatt, tom description hoppas över
    },
    {
      id: "s",
      type: "submit-result",
      position: { x: 600, y: 0 },
      // The receiver's row (story 092): heading translated, cell not.
      data: { title: { sv: "Tack", en: "Thanks" }, row: [{ id: "t", label: { sv: "Titel", en: "Title" }, cell: "Ärende: {{svar}}" }] },
    },
  ],
  connections: [],
};

describe("TranslationProgressService", () => {
  /*
   * The viewer's own texts count as content since story 017. English is a
   * language we ship, so they arrive already satisfied — the editor is not
   * asked to retype "Next".
   *
   * The number is what *this guide* can reach, not the whole table: a guide is
   * measured against the texts it can show. Reading it from the same function
   * the service uses is on purpose — a hardcoded count here would pass while
   * the two drifted, which is the shape of half the faults in this repo.
   */
  const VIEWER_KEYS = reachableViewerKeys(graph).length;

  test.runIf(PRO)("counts the content that has source text", () => {
    const progress = TranslationProgressService.getProgress(graph, "en");

    // Content: q.title, q.description, q.variableLabel, option a, option b,
    // c.title, c's row label, r.title, s.title, s's column heading and cell
    // = 11 (r.description and s's empty texts are skipped). Plus every viewer text.
    expect(progress.total).toBe(11 + VIEWER_KEYS);
    // Translated: q.title + option a + c.title + s.title + s's heading = 5,
    // plus the viewer texts English ships.
    expect(progress.translated).toBe(5 + VIEWER_KEYS);
    // Nodes with gaps: q (description, alias, option b), c (row label), r (title), s (cell).
    expect(progress.untranslatedNodeIds.sort()).toEqual(["c", "q", "r", "s"]);
    expect(progress.untranslatedViewerKeys).toEqual([]);
  });

  test("the source language is always 100%", () => {
    const progress = TranslationProgressService.getProgress(graph, "sv");
    expect(progress.translated).toBe(progress.total);
    expect(progress.untranslatedNodeIds).toEqual([]);
    expect(progress.untranslatedViewerKeys).toEqual([]);
  });
});

describe("the viewer's texts are content", () => {
  /*
   * Story 017, criterion 1. This is the case the old count hid: a guide could
   * show 100% while a resident met Swedish buttons in an Arabic guide. The
   * questions were translated; the count was measuring the wrong thing.
   */
  afterEach(() => unregisterLocale("ar"));

  test("a language we do not ship leaves them all outstanding", () => {
    const progress = TranslationProgressService.getProgress(graph, "ar");

    // "All" is all the ones this guide can show — the rest are texts it never
    // renders, and asking for them would be asking for work with no reader.
    expect(progress.untranslatedViewerKeys.sort()).toEqual(
      reachableViewerKeys(graph).sort(),
    );
    expect(progress.untranslatedViewerKeys).toContain("nav.next");
  });

  test("the guide's own text satisfies a key", () => {
    const withOwn: GraphData = {
      ...graph,
      settings: { strings: { "nav.next": { ar: "التالي" } } },
    };

    expect(
      TranslationProgressService.getProgress(withOwn, "ar").untranslatedViewerKeys,
    ).not.toContain("nav.next");
  });

  // Criterion 5: the count measures what the resident meets, not who wrote it.
  test("a host's pack satisfies it just as well", () => {
    registerLocale("ar", { "nav.next": "التالي" });

    expect(
      TranslationProgressService.getProgress(graph, "ar").untranslatedViewerKeys,
    ).not.toContain("nav.next");
  });

  test("an empty override does not satisfy it", () => {
    const empty: GraphData = {
      ...graph,
      settings: { strings: { "nav.next": { ar: "  " } } },
    };

    expect(
      TranslationProgressService.getProgress(empty, "ar").untranslatedViewerKeys,
    ).toContain("nav.next");
  });

  /*
   * Story 115 criterion 6: a rating's words go through the translation mode
   * like any other field text. They are not options — a step has no value —
   * so they had to be counted on purpose, and this is what says they were.
   */
  test("a rating's words and both its ways out are things to translate", () => {
    const rating: GraphData = {
      startNodeId: "b",
      nodes: [
        {
          id: "b",
          type: "rating-question",
          position: { x: 0, y: 0 },
          data: {
            title: { sv: "Betyg", en: "Rating" },
            variableName: "betyg",
            steps: 3,
            labels: [{ sv: "Dåligt", en: "Poor" }, { sv: "Bra" }, ""],
            notApplicable: true,
            notApplicableLabel: { sv: "Bor inte här" },
            dontKnow: true,
            dontKnowLabel: { sv: "Har inte tittat", en: "Have not looked" },
          },
        },
      ],
      connections: [],
      settings: { sourceLocale: "sv", locales: ["sv", "en"] },
    } as unknown as GraphData;

    const progress = TranslationProgressService.getProgress(rating, "en");

    /*
     * Five things with Swedish text: the title, two words (the third is empty
     * and has nothing to translate), and both ways out. Three of them are in
     * English — a way out is a field text like any other, and a translator who
     * cannot see them ships a scale that is half in the wrong language.
     */
    expect({ total: progress.contentTotal, done: progress.contentTranslated }).toEqual({
      total: 5,
      done: 3,
    });
  });

  // Criterion 7 as arithmetic: an Arabic guide creates a demand for 55 viewer
  // texts and nothing at all from the editor's 447.
  test("the demand is the viewer's texts and nothing more", () => {
    const outstanding = TranslationProgressService.getProgress(graph, "ar")
      .untranslatedViewerKeys;

    expect(outstanding.filter((key) => !isViewerString(key))).toEqual([]);
  });
});

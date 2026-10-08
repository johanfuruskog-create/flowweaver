import { afterEach, describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/node-editor/node-editor";
import "../viewer/components/guide-preview/guide-preview";

import { exampleGraph } from "./example-graph";
import { businessFormExampleGraph } from "./business-form-example-graph";
import { housingAllowanceCalcExampleGraph } from "./housing-allowance-calc-example-graph";
import { loanCalculatorExampleGraph } from "./loan-calculator-example-graph";
import { housingScreeningExampleGraph } from "./housing-screening-example-graph";
import { basicExampleGraph } from "./profile-example-graphs";
import { troubleshootingExampleGraph } from "./troubleshooting-example-graph";
import { pageBuilderExampleGraph } from "./page-builder-example-graph";
import { citizenshipExampleGraph } from "./citizenship-example-graph";
import { municipalityExampleGraph } from "./municipality-example-graph";
import { serviceFinderExampleGraph } from "./service-finder-example-graph";
import { serviceCallExampleGraph } from "./service-call-example-graph";
import { requestClassificationExampleGraph } from "./request-classification-example-graph";

import type { NodeEditor } from "../editor/components/node-editor/node-editor";
import type { GraphData } from "../viewer/types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule } from "../testing/optional-pro";
const { claimExampleGraph } = ((await proModule("data/claim-example-graph.ts")) ?? {}) as { claimExampleGraph: GraphData };
const { movingExampleGraph } = ((await proModule("data/moving-example-graph.ts")) ?? {}) as { movingExampleGraph: GraphData };
const { complaintExampleGraph } = ((await proModule("data/complaint-example-graph.ts")) ?? {}) as { complaintExampleGraph: GraphData };
const { membershipExampleGraph } = ((await proModule("data/membership-example-graph.ts")) ?? {}) as { membershipExampleGraph: GraphData };
const { bookingExampleGraph } = ((await proModule("data/booking-example-graph.ts")) ?? {}) as { bookingExampleGraph: GraphData };
const { quoteExampleGraph } = ((await proModule("data/quote-example-graph.ts")) ?? {}) as { quoteExampleGraph: GraphData };
const { borrowExampleGraph } = ((await proModule("data/borrow-example-graph.ts")) ?? {}) as { borrowExampleGraph: GraphData };
const { formOrderExampleGraph } = ((await proModule("data/form-order-example-graph.ts")) ?? {}) as { formOrderExampleGraph: GraphData };
const { surveyExampleGraph } = ((await proModule("data/survey-example-graph.ts")) ?? {}) as { surveyExampleGraph: GraphData };
const { conferenceExampleGraph } = ((await proModule("data/conference-example-graph.ts")) ?? {}) as { conferenceExampleGraph: GraphData };
const { everyFieldExampleGraph } = ((await proModule("data/every-field-example-graph.ts")) ?? {}) as { everyFieldExampleGraph: GraphData };
const { housingAllowanceExampleGraph } = ((await proModule("data/housing-allowance-example-graph.ts")) ?? {}) as { housingAllowanceExampleGraph: GraphData };
const { serviceExampleGraph } = ((await proModule("data/service-example-graph.ts")) ?? {}) as { serviceExampleGraph: GraphData };

/**
 * No two nodes in a bundled example may sit on top of each other.
 *
 * ## The failure this is written from
 *
 * Johan opened the screening example and its three results were stacked over one
 * another. The positions in the file put them 200 px apart; measured in the
 * browser they are 323 and 346 tall, so each one covered most of the one above.
 * Nobody had noticed because the file looks tidy — the numbers are evenly
 * spaced, and it is only the rendered height that makes them wrong.
 *
 * That is the shape of this whole class of fault: a position is a number in a
 * file, a height is a consequence of the text somebody wrote, and the two only
 * meet on a canvas.
 *
 * ## Why every example, and not just the one that was wrong
 *
 * These graphs are the first thing anyone sees of the tool. A guide that looks
 * like a filing accident says something about the editor that is not true, and
 * the fault is invisible in review — you have to open the page.
 *
 * ## What is allowed to overlap
 *
 * A Page's own fields. They are positioned *inside* the page node and drawn
 * within it, so they overlap it by construction. Nothing else may.
 */

afterEach(() => document.body.replaceChildren());

// PRO's guides are absent in the open repo; the open ones are measured either way.
const examples: Array<[string, GraphData]> = ([
  ["standard", exampleGraph],
  ["business-form", businessFormExampleGraph],
  ["claim", claimExampleGraph],
  ["moving", movingExampleGraph],
  ["complaint", complaintExampleGraph],
  ["membership", membershipExampleGraph],
  ["booking", bookingExampleGraph],
  ["quote", quoteExampleGraph],
  ["housing-allowance", housingAllowanceExampleGraph],
  ["housing-allowance-calc", housingAllowanceCalcExampleGraph],
  ["borrow", borrowExampleGraph],
  ["loan-calculator", loanCalculatorExampleGraph],
  ["housing-screening", housingScreeningExampleGraph],
  ["basic", basicExampleGraph],
  ["service", serviceExampleGraph],
  ["troubleshooting", troubleshootingExampleGraph],
  ["every-field", everyFieldExampleGraph],
  ["page-builder", pageBuilderExampleGraph],
  ["form-order", formOrderExampleGraph],
  ["survey", surveyExampleGraph],
  ["citizenship", citizenshipExampleGraph],
  ["municipality", municipalityExampleGraph],
  ["service-finder", serviceFinderExampleGraph],
  ["service-call", serviceCallExampleGraph],
  ["conference", conferenceExampleGraph],
  ["request-classification", requestClassificationExampleGraph],
] as Array<[string, GraphData | undefined]>).filter((entry): entry is [string, GraphData] => entry[1] !== undefined);

/*
 * The three that used to be excluded are in the list.
 *
 * They failed the first run of this check and were queued rather than hidden:
 * troubleshooting had fourteen results in one column overlapping each other by
 * 40–140 px, and the two Page examples had their columns closer together than
 * the pages are wide. All three were positioned by hand, which is the fault —
 * a position is a number in a file and a height is a consequence of the text
 * somebody wrote, and nobody can hold both in their head for twenty-four nodes.
 *
 * They were laid out again by `tools/relayout.mjs`, which measures the drawn
 * boxes in a real editor and computes columns from the connections. Anything
 * hand-placed will drift the same way; that is the tool to reach for.
 */

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(graph: GraphData): NodeEditor {
  const editor = document.createElement("node-editor") as NodeEditor;

  editor.editorMode = "administrator";
  // Big enough that the canvas never has to shrink anything to fit.
  editor.style.cssText = "display: block; width: 1400px; height: 900px;";
  document.body.append(editor);
  editor.graph = graph;
  return editor;
}

/**
 * Pairs of nodes whose cards intersect, with the overlap in pixels.
 *
 * Measured on the drawn elements rather than computed from `position`, because
 * the height is not in the data — it comes from how much text the node ended up
 * carrying, which is exactly what makes this worth checking.
 */
/*
 * The air two cards must keep between them, not only "not touching".
 *
 * Until 7/10 this counted overlap, and a guide placed with one pixel to spare
 * passed — until a line wrapped differently in a busy browser and the same
 * guide overlapped by 2, 5 or 50 px, three times in ten full runs and once in
 * the deploy gate (*claim-policy-page* over *claim-leak*, LOGG 7/10). A
 * floor makes that deterministic: a placement that close fails every run.
 * Measured the same day, the smallest air in any bundled guide was 61 px
 * (that pair, moved) and the next 80; 40 leaves room for a wrap and still
 * fails the one-pixel case.
 */
const MIN_AIR = 40;

function overlaps(editor: NodeEditor, graph: GraphData): string[] {
  const insidePage = new Set(
    graph.nodes.filter((node) => node.parentPageId).map((node) => node.id),
  );
  const pages = new Set(
    graph.nodes.filter((node) => node.type === "page").map((node) => node.id),
  );

  const drawn = [...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? [])]
    .map((element) => ({
      id: (element as unknown as { nodeId: string | null }).nodeId ?? "?",
      box: element.getBoundingClientRect(),
    }))
    .filter((one) => one.box.width > 0);

  const found: string[] = [];

  for (let a = 0; a < drawn.length; a += 1) {
    for (let b = a + 1; b < drawn.length; b += 1) {
      const one = drawn[a];
      const other = drawn[b];

      // A page and its own fields are drawn one inside the other on purpose.
      const related =
        (insidePage.has(one.id) && pages.has(other.id)) ||
        (insidePage.has(other.id) && pages.has(one.id)) ||
        (insidePage.has(one.id) && insidePage.has(other.id));

      if (related) continue;

      const across = Math.min(one.box.right, other.box.right) - Math.max(one.box.left, other.box.left);
      const down = Math.min(one.box.bottom, other.box.bottom) - Math.max(one.box.top, other.box.top);

      if (across > -MIN_AIR && down > -MIN_AIR) {
        found.push(`${one.id} ↔ ${other.id} (${Math.round(across)}×${Math.round(down)} px)`);
      }
    }
  }

  return found;
}

describe("the bundled example guides", () => {
  test.each(examples)("%s draws no node on top of another", async (_name, graph) => {
    const editor = mount(graph);
    await settle();

    expect(overlaps(editor, graph)).toEqual([]);
  });
});

/**
 * The same question asked of the node's *other* view — which for a page is not
 * the same question at all.
 *
 * Story 064 gives every step node an eye that draws it the way a visitor sees
 * it. With the eye lit it is the mirror that holds the card up and the
 * structure that steps out of the flow (`.flow-node__visitor` in
 * flow-node.scss), so a mirror taller than its structure is the one way a node
 * can grow over its neighbour. That is what this second sweep measures.
 *
 * A page is the case it was written for: a page node's height is set from its
 * fields' own layout (`--page-height`), and its visitor view is taken out of
 * the flow so it cannot move the measured text block the fields are placed
 * against. That is safe because a page is *shorter* as a visitor view — and
 * this is the check that says so out loud. If a page ever grows in the
 * visitor's view instead, it fails here rather than hanging out of the bottom
 * of its own frame on somebody's screen.
 *
 * ## It reads the mirror the canvas drew, and does not build a second one
 *
 * It used to mount a fresh `<guide-preview>` in a box as wide as the card. That
 * is not what a node holds: the canvas mirror carries `editor-view` (a
 * miniature at half the viewer's scale) and is as wide as the card's CONTENT,
 * while a bare preview is the viewer at full size. Measured 23/9 2026 on four
 * nodes: the bare mount answered 645, 311, 465 and 516 px where the drawn
 * mirror is 285, 124, 204 and 260. It over-reported by roughly 2x on questions
 * — which is how two examples came out overlapping on a day nothing on the
 * canvas had moved — and on `service-contact-page` it *under*-reported (341 for
 * 541), a miss in exactly the direction this check exists to catch. Giving the
 * second mount `editor-view` would have closed most of that gap and left ±50 px
 * of it (257 for 204), because the width would still be the card's outer box.
 * The mirror itself has no gap: it is the thing being asked about.
 */
function visitorHeight(element: HTMLElement): number {
  const mirror = element.shadowRoot?.querySelector<HTMLElement>(
    "[data-visitor-preview]",
  );

  // Not every node type has an eye. Then there is no second view to leave room
  // for, and the card's own box is the whole answer.
  return mirror ? mirror.getBoundingClientRect().height : 0;
}

function overlapsInEitherView(editor: NodeEditor, graph: GraphData): string[] {
  const drawn = [
    ...(editor.shadowRoot?.querySelectorAll<HTMLElement>("flow-node") ?? []),
  ]
    .map((element) => ({
      id: (element as unknown as { nodeId: string | null }).nodeId ?? "?",
      box: element.getBoundingClientRect(),
      visitor: visitorHeight(element),
    }))
    .filter((one) => {
      const node = graph.nodes.find((candidate) => candidate.id === one.id);

      // A page's own fields are drawn inside it, and a page child has no view
      // of its own to grow into — the page draws it.
      return node !== undefined && !node.parentPageId && one.box.width > 0;
    })
    .map((one) => ({
      id: one.id,
      left: one.box.left,
      right: one.box.right,
      top: one.box.top,
      height: Math.max(one.box.height, one.visitor),
    }));

  const found: string[] = [];

  for (let a = 0; a < drawn.length; a += 1) {
    for (let b = a + 1; b < drawn.length; b += 1) {
      const one = drawn[a];
      const other = drawn[b];
      const across =
        Math.min(one.right, other.right) - Math.max(one.left, other.left);
      const down =
        Math.min(one.top + one.height, other.top + other.height) -
        Math.max(one.top, other.top);

      if (across > -MIN_AIR && down > -MIN_AIR) {
        found.push(
          `${one.id} ↔ ${other.id} (${Math.round(across)}×${Math.round(down)} px)`,
        );
      }
    }
  }

  return found;
}

describe("the bundled example guides, with every node as tall as its visitor view", () => {
  test.each(examples)("%s leaves room for the visitor view", async (_name, graph) => {
    const editor = mount(graph);
    await settle();

    expect(overlapsInEitherView(editor, graph)).toEqual([]);
  });
});

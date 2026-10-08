import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";
import { targetSizeViolations } from "../../../testing/target-size";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Layout invariants for what the resident meets.
 *
 * The same idea as `flow-node-layout.browser.test.ts`: a matrix of nasty
 * content, and assertions about geometry rather than about pixels. What breaks
 * in a layout breaks measurably — text sticking out, a control too small to
 * hit.
 *
 * Add a case to the matrix when something looks odd. One case then covers every
 * invariant, rather than one test per bug.
 */

const BREDD = 600;

const HARD_TEXTS: Array<[namn: string, text: string]> = [
  ["kort", "Ja"],
  ["lång mening", "Jag ansöker om bygglov för en tillbyggnad på min villa i Örebro kommun"],
  ["ett obrytbart ord", "https://exempel.se/mycket/lang/adress/som/aldrig/tar/slut"],
  ["många ord utan skiljetecken", "ord ".repeat(80)],
  // Arabic reads from the right. The overflow and hit-area invariants hold both
  // ways — text sticking out to the left is just as broken.
  ["arabiska", "هل تعيش في البلدية؟ الرمز يحدد القواعد التي تنطبق عليك"],
  ["arabiska med latinsk text i", "الرمز {{kommunkod}} يحدد https://exempel.se القواعد"],
];

/** WCAG 2.2, Target Size (Minimum). */
const MIN_HIT_AREA = 24;

function graf(text: string): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: text },
          description: { sv: text },
          variableName: "svar",
          options: [
            { id: "a", label: { sv: text }, value: "a" },
            { id: "b", label: { sv: "Nej" }, value: "b" },
          ],
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: text } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "a" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
});

function montera(data: GraphData, tema?: "dark"): GuidePreview {
  if (tema) {
    document.documentElement.dataset.theme = tema;
  }

  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = `display: block; width: ${BREDD}px;`;
  document.body.append(preview);
  preview.graph = data;
  return preview;
}

/** Ingenting sticker ut i sidled ur den bredd visaren fått. */
function overflowInvariant(preview: GuidePreview): string[] {
  const rot = preview.getBoundingClientRect();
  const tolerans = 0.5;

  return [
    ...(preview.shadowRoot?.querySelectorAll<HTMLElement>("*") ?? []),
  ].flatMap((del) => {
    const rect = del.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return [];
    }

    return rect.right > rot.right + tolerans || rect.left < rot.left - tolerans
      ? [
          `${del.tagName.toLowerCase()}.${del.className || "—"} sticker ut: ` +
            `${rect.left.toFixed(0)}–${rect.right.toFixed(0)} utanför ${rot.left.toFixed(0)}–${rot.right.toFixed(0)}`,
        ]
      : [];
  });
}

/**
 * Every control can be hit. The measurement lives in `testing/target-size`
 * and is shared with the K6 gate (`guide-preview-target-size`), which holds
 * 44 px over the viewer's own controls; here 24 px holds over hostile content.
 */
function hitAreaInvariant(preview: GuidePreview): string[] {
  return targetSizeViolations(preview.shadowRoot!, MIN_HIT_AREA);
}

/** Ingen synlig text hamnar i en ruta utan höjd. */
function klippningInvariant(preview: GuidePreview): string[] {
  return [
    ...(preview.shadowRoot?.querySelectorAll<HTMLElement>("h1, h2, h3, p, legend, label") ?? []),
  ].flatMap((del) => {
    const harText = (del.textContent ?? "").trim().length > 0;
    const rect = del.getBoundingClientRect();

    return harText && rect.width > 0 && rect.height === 0
      ? [`${del.tagName.toLowerCase()} har text men noll höjd`]
      : [];
  });
}

const INVARIANTER = [overflowInvariant, hitAreaInvariant, klippningInvariant];

const brott = (preview: GuidePreview): string[] =>
  INVARIANTER.flatMap((kontroll) => kontroll(preview));

describe("the viewer's layout holds for hard content", () => {
  test.each(HARD_TEXTS)("%s", (_namn, text) => {
    expect(brott(montera(graf(text)))).toEqual([]);
  });

  test.each(HARD_TEXTS)("%s, i mörkt läge", (_namn, text) => {
    expect(brott(montera(graf(text), "dark"))).toEqual([]);
  });

  // Efter ett svar byter visaren steg — layouten ska hålla där också.
  test("och efter att man svarat", () => {
    const preview = montera(graf(HARD_TEXTS[1][1]));

    preview.shadowRoot
      ?.querySelector<HTMLInputElement>('input[type="radio"]')
      ?.click();
    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();

    expect(brott(preview)).toEqual([]);
  });
});

describe("a narrow screen", () => {
  // 320px is the narrowest screen it is reasonable to plan for, and that is
  // where text and controls first start competing.
  test.each(HARD_TEXTS)("%s på 320px", (_namn, text) => {
    const preview = montera(graf(text));
    preview.style.width = "320px";

    expect(brott(preview)).toEqual([]);
  });
});

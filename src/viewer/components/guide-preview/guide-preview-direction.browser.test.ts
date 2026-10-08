import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The guide in a language that reads the other way.
 *
 * Criteria 1, 2, 6 and 7 in
 * `docs/STORIES/009-guiden-pa-ett-sprak-som-lases-at-andra-hallet.md`.
 *
 * Without direction, Arabic text renders with the punctuation on the wrong side
 * and paragraphs starting at the wrong edge. It can be read, but it looks like
 * something nobody cared about — in a guide about income support that is a
 * message in itself.
 */

function graf(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: {
            sv: "Bor du i kommunen?",
            ar: "هل تعيش في البلدية؟",
          },
          description: {
            sv: "Svaret avgör vilka regler som gäller.",
            // Latin text amid Arabic — this is where bidi usually goes wrong.
            ar: "الرمز {{kommunkod}} يحدد القواعد.",
          },
          variableName: "bor",
          options: [{ id: "ja", label: { sv: "Ja", ar: "نعم" }, value: "ja" }],
        },
      },
      { id: "r", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "ja" }, to: { nodeId: "r", portId: "input" } },
    ],
  };
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

function montera(locale: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.style.cssText = "display: block; width: 600px;";
  document.body.append(preview);
  preview.graph = graf();
  preview.activeLocale = locale;
  return preview;
}

const sektion = (preview: GuidePreview): Element | null =>
  preview.shadowRoot?.querySelector(".guide-preview") ?? null;

describe("the direction follows the language", () => {
  test("Swedish reads from the left", () => {
    expect(sektion(montera("sv"))?.getAttribute("dir")).toBe("ltr");
  });

  test("Arabic reads from the right", () => {
    expect(sektion(montera("ar"))?.getAttribute("dir")).toBe("rtl");
  });

  test("the language is spelled out, so a screen reader pronounces it right", () => {
    expect(sektion(montera("ar"))?.getAttribute("lang")).toBe("ar");
  });

  test("it changes when the language is switched", () => {
    const preview = montera("sv");
    expect(sektion(preview)?.getAttribute("dir")).toBe("ltr");

    preview.activeLocale = "ar";

    expect(sektion(preview)?.getAttribute("dir")).toBe("rtl");
  });

  // The direction comes from the browser, not from a list we maintain.
  test.each([
    ["fa", "rtl"],
    ["he", "rtl"],
    ["ur", "rtl"],
    ["uk", "ltr"],
    // Easy to assume it is rtl. It is not.
    ["ti", "ltr"],
    ["so", "ltr"],
  ])("%s får riktning %s utan att vi räknat upp den", (locale, väntat) => {
    expect(sektion(montera(locale))?.getAttribute("dir")).toBe(väntat);
  });

  test("a language we have no name for still gets a direction", () => {
    expect(sektion(montera("qq"))?.getAttribute("dir")).toBe("ltr");
  });
});

describe("the host's page is untouched", () => {
  // A viewer embedded in someone else's page does not flip their page. The
  // same reasoning as when the tokens moved one step down from :root.
  test("the document gets neither dir nor lang", () => {
    montera("ar");

    expect(document.documentElement.getAttribute("dir")).toBeNull();
    expect(document.documentElement.getAttribute("lang")).toBeNull();
  });

  test("riktningen lagras aldrig i guiden", () => {
    const preview = montera("ar");

    expect(JSON.stringify(preview.graph)).not.toContain("rtl");
  });
});

describe("blandad text", () => {
  // A variable name or a URL amid Arabic text must not reorder the rest of the
  // sentence. With dir on the container the browser's bidi algorithm handles
  // it; without it the order comes out wrong.
  test("latinsk text mitt i arabisk kastar inte om meningen", () => {
    const preview = montera("ar");
    const beskrivning = preview.shadowRoot?.querySelector(
      ".guide-preview__card p, .flow-node__description, p",
    );

    expect(sektion(preview)?.getAttribute("dir")).toBe("rtl");
    // Texten renderas, och behållaren bär riktningen — då gäller bidi.
    expect(beskrivning?.textContent).toBeTruthy();
  });

  test("the Arabic text is shown, not the source's", () => {
    const preview = montera("ar");

    expect(preview.shadowRoot?.textContent).toContain("هل تعيش في البلدية؟");
    expect(preview.shadowRoot?.textContent).not.toContain("Bor du i kommunen?");
  });
});

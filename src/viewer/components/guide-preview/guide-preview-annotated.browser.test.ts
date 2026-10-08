import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(comments: unknown[], locale?: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = {
    startNodeId: "img",
    nodes: [
      {
        id: "img",
        type: "annotated-image",
        position: { x: 0, y: 0 },
        data: { title: "Kom igång", imageUrl: "https://example.com/a.png", alt: "Skärm", comments },
      },
      { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c", from: { nodeId: "img", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
  if (locale) preview.activeLocale = locale;
  return preview;
}

const COMMENTS = [
  { id: "1", text: "Klicka på Arkiv", x: 20, y: 30, arrow: "up" },
  { id: "2", text: "Välj Exportera", x: 60, y: 70, arrow: "left" },
];

function next(preview: GuidePreview): void {
  preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
}

describe("guide-preview – annoterad bild (genomstegning)", () => {
  test("shows the image, the pins and steps one comment at a time before leaving the node", () => {
    const preview = mount(COMMENTS);
    const shadow = preview.shadowRoot!;

    expect(shadow.querySelector("img.guide-preview__annotated-img")).not.toBeNull();
    expect(shadow.querySelectorAll(".guide-preview__pin")).toHaveLength(2);
    expect(shadow.textContent).toContain("Kommentar 1/2");
    expect(shadow.textContent).toContain("Klicka på Arkiv");

    next(preview); // → kommentar 2 (samma nod)
    expect(shadow.textContent).toContain("Kommentar 2/2");
    expect(shadow.textContent).toContain("Välj Exportera");
    expect(shadow.textContent).not.toContain("Klart");

    next(preview); // → nästa nod (resultat)
    expect(shadow.textContent).toContain("Klart");
  });

  test("Previous steps back one comment at a time", () => {
    const preview = mount(COMMENTS);
    next(preview); // kommentar 2
    expect(preview.shadowRoot?.textContent).toContain("Kommentar 2/2");
    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="previous"]')
      ?.click();
    expect(preview.shadowRoot?.textContent).toContain("Kommentar 1/2");
  });

  test("the counter is localised (English)", () => {
    const preview = mount(COMMENTS, "en");
    expect(preview.shadowRoot?.textContent).toContain("Comment 1/2");
  });
});

describe("en kommentar skriven på två språk", () => {
  /*
   * The tutorial's comments are { sv, en } maps, like every other authored
   * text — and the parse used to flatten them to "", so the page showed
   * numbered pins and "Kommentar 1/2" with nothing after it. Found by Johan
   * on the published tutorial.
   */
  test("visas på visningsspråket, inte som tomhet", () => {
    const preview = mount(
      [{ id: "a", text: { sv: "Dra hit noden.", en: "Drag the node here." }, x: 10, y: 10, arrow: "left" }],
    );
    const caption = preview.shadowRoot!.querySelector(".guide-preview__annotation-caption");

    expect(caption?.textContent).toContain("Dra hit noden.");

    preview.activeLocale = "en";

    expect(
      preview.shadowRoot!.querySelector(".guide-preview__annotation-caption")?.textContent,
    ).toContain("Drag the node here.");
  });
});

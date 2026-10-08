import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(imageData: Record<string, unknown>, locale?: string): GuidePreview {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = {
    startNodeId: "img",
    nodes: [
      { id: "img", type: "image", position: { x: 0, y: 0 }, data: imageData },
      { id: "done", type: "result", position: { x: 0, y: 0 }, data: { title: "Klart" } },
    ],
    connections: [
      { id: "c", from: { nodeId: "img", portId: "continue" }, to: { nodeId: "done", portId: "input" } },
    ],
  } as GraphData;
  if (locale) preview.activeLocale = locale;
  return preview;
}

describe("guide-preview – bildnod (bildspel)", () => {
  test("shows the image with alt text and a caption, moves on with Next", () => {
    const preview = mount({
      imageUrl: "https://example.com/steg-1.png",
      alt: "Skärmdump av steg 1",
      caption: "Klicka på Arkiv för att börja.",
    });
    const img = preview.shadowRoot?.querySelector<HTMLImageElement>(
      "img.guide-preview__image"
    );
    expect(img?.getAttribute("src")).toBe("https://example.com/steg-1.png");
    expect(img?.getAttribute("alt")).toBe("Skärmdump av steg 1");
    expect(preview.shadowRoot?.textContent).toContain("Klicka på Arkiv för att börja.");

    preview.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-action="next"]')
      ?.click();
    expect(preview.shadowRoot?.textContent).toContain("Klart");
  });

  test("without a URL a placeholder shows instead of a broken image", () => {
    const preview = mount({ imageUrl: "", caption: "" });
    expect(preview.shadowRoot?.querySelector("img.guide-preview__image")).toBeNull();
    expect(preview.shadowRoot?.textContent).toContain("Ingen bild angiven");
  });

  test("the placeholder is localised (English)", () => {
    const preview = mount({ imageUrl: "" }, "en");
    expect(preview.shadowRoot?.textContent).toContain("No image set");
  });

  test("no title gives no Untitled node heading", () => {
    const preview = mount({ imageUrl: "https://example.com/a.png" });
    expect(preview.shadowRoot?.textContent).not.toContain("Namnlös");
  });
});

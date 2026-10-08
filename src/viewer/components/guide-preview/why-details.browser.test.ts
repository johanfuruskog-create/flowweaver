import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * "Varför frågar vi det här?" — trust built at the field (story 051).
 *
 * A visitor hesitating over their personal number should get the reason
 * right there, not in a policy page. The editor writes an optional text on
 * the question; the viewer renders it as a real `<details>` under the
 * heading — closed by default, absent entirely when the editor wrote
 * nothing. A native details, never a widget: keyboard, screen reader and
 * print come for free.
 */

afterEach(() => document.body.replaceChildren());

function mount(withWhy: boolean): GuidePreview {
  const graph: GraphData = {
    startNodeId: "q",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "q",
        type: "text-question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Vad är ditt personnummer?" },
          variableName: "pnr",
          ...(withWhy
            ? { why: { sv: "Vi hämtar din folkbokföringsadress så du slipper skriva den." } }
            : {}),
        },
      },
      { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Tack" } } },
    ],
    connections: [
      { id: "c", from: { nodeId: "q", portId: "output" }, to: { nodeId: "r", portId: "input" } },
    ],
  } as never;

  const preview = document.createElement("guide-preview") as GuidePreview;

  document.body.append(preview);
  preview.graph = graph;

  return preview;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

describe("varför-frågan", () => {
  test("renders as a closed details with the editor's text", async () => {
    const preview = mount(true);

    await settle();

    const details = preview.shadowRoot!.querySelector<HTMLDetailsElement>(
      "details.guide-preview__why",
    );

    expect(details).toBeTruthy();
    expect(details!.open).toBe(false);
    expect(details!.querySelector("summary")!.textContent).toContain(
      "Varför frågar vi det här?",
    );
    expect(details!.textContent).toContain("folkbokföringsadress");
  });

  test("does not exist at all when the editor wrote nothing", async () => {
    const preview = mount(false);

    await settle();

    expect(preview.shadowRoot!.querySelector(".guide-preview__why")).toBeNull();
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * The visitor's card in a phone (Johan 25/9, four pictures, "gillar båda
 * effekterna"): the shadow stays under 400 px, and the edge is drawn in the
 * control-border token so the card reads as a card in dark mode too — the
 * old `--fw-border` edge measured 1.95:1 against the page. Measured as the
 * computed values a 360 px host gets, in both themes.
 */

afterEach(() => document.body.replaceChildren());

const graph = (): GraphData =>
  ({
    startNodeId: "q",
    nodes: [{ id: "q", type: "question", position: { x: 0, y: 0 }, data: { title: { sv: "Bor du i kommunen?" }, variableName: "bor", options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }] } }],
    connections: [],
  }) as unknown as GraphData;

async function cardAt(width: number, theme: "light" | "dark"): Promise<{ card: HTMLElement; host: HTMLElement }> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  preview.setAttribute("data-fw-theme", theme);
  preview.style.cssText = `display:block;width:${width}px;`;
  document.body.append(preview);
  preview.graph = graph();
  await new Promise((r) => setTimeout(r, 150));
  const card = preview.shadowRoot!.querySelector<HTMLElement>(".guide-preview__card");
  if (!card) throw new Error("kortet saknas");
  return { card, host: preview };
}

const tokenOf = (host: HTMLElement, name: string): string => {
  const probe = document.createElement("div");
  probe.style.color = `var(${name})`;
  host.shadowRoot!.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

describe("kortet i telefonen", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: skuggan står kvar under 400 px och kanten är kontrollkantens`, async () => {
      const { card, host } = await cardAt(360, theme);
      const cs = getComputedStyle(card);

      expect(host.getAttribute("data-under") ?? "", "hosten mäter inte sin bredd").toContain("400");
      expect(cs.boxShadow, "skuggan borttagen").not.toBe("none");
      expect(cs.borderTopColor).toBe(tokenOf(host, "--fw-border-control"));
    });
  }

  test("på skrivbordet är kanten densamma", async () => {
    const { card, host } = await cardAt(680, "light");
    expect(getComputedStyle(card).borderTopColor).toBe(tokenOf(host, "--fw-border-control"));
  });
});

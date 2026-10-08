import { afterEach, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";

/**
 * A node with no exits takes its line 22 px from the bottom of the card.
 *
 * The port rows are laid out after the content, so a result's lone entry ring
 * sat under the text — on the agency guides then in `examples/imported/` (removed 7/10, decision 8) that was
 * 300 px below the header, with the line ending where nobody looks for it
 * (Johan, 7/9 2026: "porten sitter för långt ner på resultatet … går det inte
 * att räkna från botten istället för toppen?"). Measured before the fix: card
 * 303–622, line end at y=591.
 *
 * The first fix put the ring level with the header. Johan's call, on the
 * before/after stills: "Sätt 24px från botten" — then 32 and 28 from stills,
 * and 22 chosen: that is where a question's last answer ring sits (measured
 * on "Bor du i Sverige?": content padding 16 + border 1 + 5 px of the 28 px
 * row), so a result beside a question meets its line at the same height —
 * the second test holds the two together. Counted from the bottom edge
 * the ring is in the same place on a short card and a long one, and on the
 * visitor's view as on the structure — the card's height is what it is
 * measured against, so it can never end up outside.
 *
 * A question keeps its entry ring on the first port row, where it shares the
 * line with the first exit; only a node with nothing after it moves the ring.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mount(node: Record<string, unknown>): FlowNode {
  const element = document.createElement("flow-node") as FlowNode;
  element.setAttribute("active-locale", "sv");
  element.nodeData = node as never;
  document.body.append(element);
  return element;
}

const longText = Array.from({ length: 8 }, (_, i) => `Rad ${i + 1} i ett långt resultat som fyller kortet.`).join("\n\n");

test("resultatets ring sitter 22 px från kortets underkant, inte under texten", async () => {
  const element = mount({
    id: "r",
    type: "result",
    position: { x: 0, y: 0 },
    data: { title: { sv: "Svar" }, description: { sv: longText } },
  });
  await settle();

  const card = element.shadowRoot!.querySelector(".flow-node")!.getBoundingClientRect();
  const text = element.shadowRoot!.querySelector(".flow-node__content")!.getBoundingClientRect();
  const ring = element.shadowRoot!.querySelector(".flow-node__port--input")!.getBoundingClientRect();

  expect(Math.round(card.bottom - ring.bottom), "ringens underkant från kortets").toBe(22);
  // Out of the flow: the card ends where the text ends, not a row later.
  expect(Math.round(card.bottom - text.bottom), "kortets kant under texten").toBeLessThanOrEqual(2);
  // On the card's left edge, as before.
  expect(Math.abs(ring.left + ring.width / 2 - card.left)).toBeLessThanOrEqual(2);
});

test("en fråga behåller ringen på första portraden", async () => {
  const element = mount({
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: "Fråga" },
      description: { sv: longText },
      options: [
        { id: "a", label: { sv: "Ja" }, value: "a" },
        { id: "b", label: { sv: "Nej" }, value: "b" },
      ],
    },
  });
  await settle();

  const header = element.shadowRoot!.querySelector(".flow-node__header")!.getBoundingClientRect();
  const ring = element.shadowRoot!.querySelector(".flow-node__port--input")!.getBoundingClientRect();
  const firstExit = element.shadowRoot!.querySelector(".flow-node__port--output")!.getBoundingClientRect();

  expect(ring.top).toBeGreaterThan(header.bottom);
  expect(Math.abs(ring.top - firstExit.top)).toBeLessThanOrEqual(1);

  // The last answer's ring is where a result's entry ring sits: 22 from the
  // bottom. If a padding or row height changes, both numbers must move.
  const card = element.shadowRoot!.querySelector(".flow-node")!.getBoundingClientRect();
  const exits = element.shadowRoot!.querySelectorAll(".flow-node__port--output");
  const lastExit = exits[exits.length - 1]!.getBoundingClientRect();
  expect(Math.round(card.bottom - lastExit.bottom), "sista svarets ring från kortets underkant").toBe(22);
});

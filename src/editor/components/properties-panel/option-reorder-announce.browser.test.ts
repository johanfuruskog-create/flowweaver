import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";

/**
 * Says where a moved answer option landed — for a drag as well as a press.
 *
 * ## The fault this is written from
 *
 * A node moved with the arrow keys was already announced
 * (`editor.announce.nodeMoved`, in `node-editor`). An answer option moved by
 * its grip, or by the *Flytta upp/ned* buttons, said nothing — mätt mot
 * artiklarna 22/9 (docs/IDEAS.md).
 *
 * ## Why two moves, not one
 *
 * A live region that keeps the same words is not re-read by a screen reader
 * — that is the whole contract `aria-live` makes. Moving the same option
 * twice, to two different places, is what proves the second announcement is
 * not the first one stuck.
 */

afterEach(() => document.body.replaceChildren());

function mount(): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  panel.editorMode = "administrator";
  document.body.append(panel);
  panel.nodeData = {
    id: "q",
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: "Vad gäller ärendet?",
      variableName: "amne",
      options: [
        { id: "a", label: "Bygglov", value: "bygglov" },
        { id: "b", label: "Avlopp", value: "avlopp" },
        { id: "c", label: "Buller", value: "buller" },
      ],
    },
  } as never;

  return panel;
}

const announceOf = (panel: PropertiesPanel): string | null | undefined =>
  panel.shadowRoot?.querySelector<HTMLElement>("[data-announce]")?.textContent;

const handleOf = (panel: PropertiesPanel, id: string) =>
  panel.shadowRoot!.querySelector<HTMLElement>(
    `.properties-panel__option[data-option-id="${id}"] [data-action="drag-option"]`,
  )!;

const moveButton = (panel: PropertiesPanel, id: string, direction: "up" | "down") =>
  panel.shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-action="move-option-${direction}"][data-option-id="${id}"]`,
  )!;

const rowOf = (panel: PropertiesPanel, id: string) =>
  panel.shadowRoot!.querySelector<HTMLElement>(
    `.properties-panel__option[data-option-id="${id}"]`,
  )!;

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("uppläsning efter ett flyttat svarsalternativ", () => {
  test("säger var alternativet landade, dragen med greppet", async () => {
    const panel = mount();
    const handle = handleOf(panel, "a");
    const row = rowOf(panel, "a").getBoundingClientRect();
    const top = handle.getBoundingClientRect().top;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientY: top, bubbles: true, composed: true }),
    );
    // Nine tenths into its own row — past the threshold and past the point
    // where the row below gives up its place (properties-panel-option-order
    // measures the same nine tenths).
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: row.top + row.height * 0.9 }),
    );
    window.dispatchEvent(new PointerEvent("pointerup"));
    await settle();

    expect(announceOf(panel)).toBe("Bygglov, nu på plats 2 av 3");
  });

  test("och med Flytta nedåt-knappen", async () => {
    const panel = mount();

    moveButton(panel, "a", "down").click();
    await settle();

    expect(announceOf(panel)).toBe("Bygglov, nu på plats 2 av 3");
  });

  test("och nollställs mellan två flytt, så samma text inte tystnar", async () => {
    const panel = mount();

    // Two different options, each moved once — the panel does not own the
    // order (the host does, by the documented contract: it echoes a new
    // `nodeData` back), so a second press on the same option before that
    // echo would only repeat the first request. Two options is what a
    // redaktör actually does in one sitting, and it is enough to prove the
    // region is not stuck on its first sentence.
    moveButton(panel, "a", "down").click();
    await settle();

    const afterFirst = announceOf(panel);

    expect(afterFirst).toBe("Bygglov, nu på plats 2 av 3");

    moveButton(panel, "c", "up").click();
    await settle();

    const afterSecond = announceOf(panel);

    expect(afterSecond).not.toBe(afterFirst);
    expect(afterSecond).toBe("Buller, nu på plats 2 av 3");
  });
});

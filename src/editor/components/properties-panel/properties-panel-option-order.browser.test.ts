import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import type { PropertiesPanel } from "./properties-panel";
import { expectDrawnCursor } from "../../../testing/drawn-cursor";

/**
 * Arranging the answers to a question, by hand.
 *
 * ## Why this file exists now and not before
 *
 * The panel has had a pointer drag for options for a long time and not one test
 * for it — a hundred and seventy lines of gesture that the whole suite was
 * silent about. It was replaced today by the gesture the version list uses, and
 * a replacement nobody can check is a rewrite on trust.
 *
 * ## What is claimed
 *
 * The same three promises the version list makes, because it is now the same
 * code: a press is not a drag, passing the middle of a neighbour is not enough
 * to trade places, and the option in your hand says so while you hold it.
 *
 * The panel keeps reporting in its own words — one option and where it landed,
 * rather than the whole order — so that part is checked here too. It is the
 * host's contract and the rewrite must not have quietly changed it.
 */

afterEach(() => {
  document.body.replaceChildren();
});

function mount(): PropertiesPanel {
  const panel = document.createElement("properties-panel") as PropertiesPanel;

  // Opt in: the default is readonly, and arranging is building.
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
  };

  return panel;
}

const options = (panel: PropertiesPanel) => [
  ...(panel.shadowRoot?.querySelectorAll<HTMLElement>(
    ".properties-panel__option[data-option-id]"
  ) ?? []),
];

const handleOf = (panel: PropertiesPanel, id: string) =>
  panel.shadowRoot?.querySelector<HTMLElement>(
    `.properties-panel__option[data-option-id="${id}"] [data-option-handle], ` +
      `.properties-panel__option[data-option-id="${id}"] button[data-option-id]`
  ) ?? null;

describe("arranging a question's answers", () => {
  test("there is something to take hold of", () => {
    const panel = mount();

    expect(options(panel).map((option) => option.dataset.optionId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(handleOf(panel, "a")).not.toBeNull();
  });

  test("a press that does not move asks for nothing", () => {
    const panel = mount();
    const asked = vi.fn();

    panel.addEventListener("question-option-reorder", asked);

    const handle = handleOf(panel, "a")!;
    const top = handle.getBoundingClientRect().top;

    handle.dispatchEvent(new PointerEvent("pointerdown", { clientY: top, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top + 8 }));
    window.dispatchEvent(new PointerEvent("pointerup"));

    expect(asked).not.toHaveBeenCalled();
  });

  test("the option in your hand says so while you hold it", () => {
    const panel = mount();
    const handle = handleOf(panel, "a")!;
    const top = handle.getBoundingClientRect().top;
    const marked = () =>
      panel.shadowRoot?.querySelectorAll("[data-dragging]").length ?? 0;

    expect(marked()).toBe(0);
    expectDrawnCursor(handle, "grab", "greppet i vila");

    handle.dispatchEvent(new PointerEvent("pointerdown", { clientY: top, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top + 40 }));

    expect(marked()).toBe(1);
    expectDrawnCursor(
      panel.shadowRoot!.querySelector(".properties-panel__option[data-dragging]")!,
      "grabbing",
      "det burna svarsalternativet"
    );

    window.dispatchEvent(new PointerEvent("pointerup"));
  });

  test("dragging past a neighbour reports where it landed", () => {
    const panel = mount();
    let detail: { optionId: string; targetIndex: number } | undefined;

    panel.addEventListener("question-option-reorder", (event) => {
      detail = (event as CustomEvent<{ optionId: string; targetIndex: number }>).detail;
    });

    const first = options(panel)[0]!.getBoundingClientRect();
    const handle = handleOf(panel, "a")!;

    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientY: handle.getBoundingClientRect().top,
        bubbles: true,
      })
    );
    // Nine tenths into its own row: past the threshold and past the point where
    // the row below gives up its place.
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: first.top + first.height * 0.9 })
    );
    window.dispatchEvent(new PointerEvent("pointerup"));

    /*
     * One option and its index, not the whole order. That is what the host
     * listens for, and the rewrite had every opportunity to change it quietly.
     */
    expect(detail).toEqual({ nodeId: "q", optionId: "a", targetIndex: 1 });
  });

  test("passing the middle is not enough to trade places", () => {
    const panel = mount();
    const shown = () => options(panel).map((option) => option.dataset.optionId);
    const first = options(panel)[0]!.getBoundingClientRect();
    const handle = handleOf(panel, "a")!;
    const top = handle.getBoundingClientRect().top;

    handle.dispatchEvent(new PointerEvent("pointerdown", { clientY: top, bubbles: true }));

    // Past the threshold first, upwards, where the top option cannot go — so
    // what follows tests the rule rather than the threshold.
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: top - 20 }));
    expect(shown()).toEqual(["a", "b", "c"]);

    // Three fifths down: past the middle, which is where a tremor used to be
    // enough.
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: first.top + first.height * 0.6 })
    );
    expect(shown()).toEqual(["a", "b", "c"]);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientY: first.top + first.height * 0.9 })
    );
    expect(shown()).toEqual(["b", "a", "c"]);

    window.dispatchEvent(new PointerEvent("pointerup"));
  });
});

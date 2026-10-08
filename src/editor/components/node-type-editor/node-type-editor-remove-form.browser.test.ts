import { afterEach, expect, test } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "./node-type-editor";
import type { NodeTypeEditor } from "./node-type-editor";

/**
 * B3 (Astra 30/9, GENOMGANG E5): the node templates' *Ta bort* in the
 * profile's destructive form — words and bin in `--fw-danger-text`, no fill,
 * no frame, 44 px. Measured before: a neutral outline in `--fw-border`, text
 * `--fw-text-secondary`, 27 px — the same form as *Redigera* beside it.
 */

afterEach(() => document.body.replaceChildren());

/*
 * Parks the real browser pointer on the dialog's own backdrop, away from any
 * control (measured 1/10 — mät orsaken innan fixen).
 *
 * `<dialog>` is centered by the user agent at a fixed pixel position for a
 * fixed 1280×800 viewport, so a button in a dialog with this fixture's
 * content always lands at the same screen coordinate every run. A browser-
 * mode `userEvent.click`/`.hover` moves the ACTUAL cursor and nothing moves
 * it back between tests — a test's own `afterEach` here only clears the DOM
 * — so an earlier test elsewhere in the suite that interacted with a button
 * at that same coordinate leaves the real pointer resting there. The next
 * dialog to render a button at that spot is then born `:hover` the instant
 * it appears, with no new pointer event of its own, which this file's
 * background-colour assertions ("ingen fyllning"/"aldrig fylld") read as a
 * random failure depending on what ran immediately before in the same
 * worker. Reproduced directly: a prior test clicks `[data-delete-type]`,
 * then this same assertion sees `rgb(254, 243, 242)` (the hover fill)
 * instead of `rgba(0, 0, 0, 0)` without the line below; sett falla, and the
 * exact message the flake reported.
 */
async function parkPointer(editor: NodeTypeEditor): Promise<void> {
  await userEvent.hover(editor.shadowRoot!.querySelector("dialog")!);
}

test("nodmallarnas Ta bort har den destruktiva formen", async () => {
  const editor = document.createElement("node-type-editor") as NodeTypeEditor;
  document.body.append(editor);
  editor.open({
    specs: [{ type: "custom-x", label: "Kommunval", base: "question", values: { title: "Hej" } }],
    onCreate: () => {},
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await parkPointer(editor);

  const button = editor.shadowRoot!.querySelector<HTMLElement>("[data-delete-type]")!;
  const style = getComputedStyle(button);
  const probe = document.createElement("span");
  probe.style.color = "var(--fw-danger-text)";
  button.parentElement!.append(probe);

  expect(button.querySelector("svg"), "soptunnan").not.toBeNull();
  expect(button.querySelector("svg")!.getBoundingClientRect().width).toBeCloseTo(18, 0);
  expect(style.color).toBe(getComputedStyle(probe).color);
  expect(style.backgroundColor, "ingen fyllning").toBe("rgba(0, 0, 0, 0)");
  expect(style.borderLeftStyle, "ingen ram").toBe("none");
  expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  // The accessible name still says which template goes.
  expect(button.getAttribute("aria-label")).toContain("Kommunval");
});

/**
 * And *Lägg till nodmall* as the local add (GENOMGANG E6): primary outline
 * with the plus as an icon, `--fw-radius-button`, 44 px. Measured before: the
 * outline without a plus, 41 px.
 */
test("Lägg till nodmall har tilläggsformen med plus-ikonen", async () => {
  const editor = document.createElement("node-type-editor") as NodeTypeEditor;
  document.body.append(editor);
  editor.open({ specs: [], onCreate: () => {} });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await parkPointer(editor);

  const button = editor.shadowRoot!.querySelector<HTMLElement>('[data-action="add-new"]')!;
  const style = getComputedStyle(button);
  const probe = document.createElement("span");
  probe.style.cssText = "border: 1px solid var(--fw-primary); color: var(--fw-primary-strong); border-radius: var(--fw-radius-button);";
  button.parentElement!.append(probe);
  const want = getComputedStyle(probe);

  expect(button.querySelector("svg"), "plus som ikon").not.toBeNull();
  expect(button.querySelector("svg")!.getBoundingClientRect().width).toBeCloseTo(18, 0);
  expect(style.borderTopColor).toBe(want.borderTopColor);
  expect(style.color).toBe(want.color);
  expect(style.borderTopLeftRadius).toBe(want.borderTopLeftRadius);
  expect(style.backgroundColor, "aldrig fylld").toBe("rgba(0, 0, 0, 0)");
  expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  expect(button.textContent!.trim()).toBe("Lägg till nodmall");
});

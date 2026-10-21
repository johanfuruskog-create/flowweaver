import { afterEach, expect, test } from "vitest";

import "./node-type-editor";
import type { NodeTypeEditor } from "./node-type-editor";

/**
 * The dialog's fields join the 44 px family (Johan 9/10). They were 40 px —
 * `padding: 10px 12px` and nothing more — and the select alone was held at 40
 * by a `min-height: 0` so it would not stand taller than the name field
 * beside it. Now both have the floor, and stay the same height as each other.
 */

afterEach(() => document.body.replaceChildren());

test("mallens namnfält och rullgardin är 44 px och lika höga", async () => {
  const editor = document.createElement("node-type-editor") as NodeTypeEditor;
  document.body.append(editor);
  editor.open({ specs: [], onCreate: () => {} });
  await new Promise((resolve) => setTimeout(resolve, 100));
  // The form with both fields is the one "Lägg till" opens.
  editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="add-new"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const visible = (el: Element) => el.getBoundingClientRect().height > 0;
  const root = editor.shadowRoot!;
  const name = [...root.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(visible);
  const select = [...root.querySelectorAll<HTMLSelectElement>(".node-type-editor__select > select")].find(visible);

  expect(name, "namnfältet syns").toBeTruthy();
  expect(select, "rullgardinen syns").toBeTruthy();

  const nameHeight = name!.getBoundingClientRect().height;
  const selectHeight = select!.getBoundingClientRect().height;

  expect(nameHeight).toBeGreaterThanOrEqual(44);
  expect(selectHeight).toBeGreaterThanOrEqual(44);
  expect(Math.abs(nameHeight - selectHeight), `${nameHeight} / ${selectHeight}`).toBeLessThan(0.5);
});

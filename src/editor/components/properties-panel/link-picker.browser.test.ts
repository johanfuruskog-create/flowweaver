import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./properties-panel";

import {
  registerLinkPicker,
  unregisterLinkPicker,
} from "../../core/link-picker-registry";
import type { LinkPickContext } from "../../core/link-picker-registry";
import type { PropertiesPanel } from "./properties-panel";
import type { RichTextField } from "../rich-text-field/rich-text-field";

/**
 * Story 100, criteria 2 and 4: the link button asks the host's picker when
 * one is registered, and is exactly what it was when none is. Focus comes
 * back to the field either way — the host's dialog is the host's, the
 * return is ours to guarantee.
 */

afterEach(() => {
  unregisterLinkPicker();
  document.body.replaceChildren();
});

function mount(): { field: RichTextField; text: HTMLElement; link: HTMLButtonElement; panel: PropertiesPanel } {
  const panel = document.createElement("properties-panel") as PropertiesPanel;
  panel.editorMode = "administrator";
  panel.sourceLocale = "sv";
  document.body.append(panel);
  panel.nodeData = {
    id: "r",
    type: "result",
    position: { x: 0, y: 0 },
    data: { title: "Svar", description: "Läs mer" },
  };
  // The description is a `<rich-text-field>` since story 136; its link button sits in its toolbar.
  const field = panel.shadowRoot!.querySelector<RichTextField>('[data-property="description"]')!;
  const text = field.shadowRoot!.querySelector<HTMLElement>("[data-text]")!;
  const link = field.shadowRoot!.querySelector<HTMLButtonElement>('[data-command="link"]')!;

  return { field, text, link, panel };
}

/** "mer" selected, the way a person does it: from the end, three to the left. */
async function selectMer(text: HTMLElement): Promise<void> {
  text.focus();
  await userEvent.keyboard("{End}{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}");
}

test("utan väljare: fältets egen dialog frågar efter adressen", async () => {
  const { field, text, link } = mount();

  await selectMer(text);
  await userEvent.click(link);

  const dialog = field.shadowRoot!.querySelector("prompt-dialog")!.shadowRoot!;
  const input = dialog.querySelector<HTMLInputElement>("[data-input]")!;

  expect(dialog.querySelector("dialog")!.open).toBe(true);
  input.value = "/studera.html";
  dialog.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();
  await vi.waitFor(() => expect(field.value).not.toBe("Läs mer"));

  expect(field.value).toBe("Läs [mer](/studera.html)");
});

test("med väljare: det markerade blir texten, adressen och referensen väljarens", async () => {
  const pick = vi.fn(async (_context: LinkPickContext) => ({
    url: "/du-vill-ansoka/studera.html",
    label: "Studera",
    ref: "sv:4.1b914ea",
  }));
  registerLinkPicker({ pick });
  const { field, text, link, panel } = mount();
  const changed = vi.fn();
  panel.addEventListener("node-data-changed", changed);

  await selectMer(text);
  await userEvent.click(link);
  await vi.waitFor(() => expect(field.value).not.toBe("Läs mer"));

  expect(field.value).toBe('Läs [mer](/du-vill-ansoka/studera.html "sv:4.1b914ea")');
  expect(pick).toHaveBeenCalledWith({ locale: "sv", selectedText: "mer" });
  expect(changed).toHaveBeenCalled();
  expect(field.shadowRoot!.activeElement, "fokus tillbaka i texten").toBe(text);
});

test("med väljare och inget markerat: sidans titel blir texten", async () => {
  registerLinkPicker({ pick: async () => ({ url: "/studera.html", label: "Studera" }) });
  const { field, text, link } = mount();

  text.focus();
  await userEvent.keyboard("{End}");
  await userEvent.click(link);
  await vi.waitFor(() => expect(field.value).not.toBe("Läs mer"));

  expect(field.value).toBe("Läs mer[Studera](/studera.html)");
});

test("avbrutet val: ingenting sätts in, fokus tillbaka", async () => {
  registerLinkPicker({ pick: async () => null });
  const { field, text, link } = mount();

  await selectMer(text);
  await userEvent.click(link);
  await vi.waitFor(() => expect(field.shadowRoot!.activeElement).toBe(text));

  expect(field.value).toBe("Läs mer");
});

test("i en länk tar knappen bort länken, som fet tar bort fetstil", async () => {
  const { field, text, link } = mount();

  field.value = "Läs [mer](/studera.html)";
  text.focus();
  await userEvent.keyboard("{End}{ArrowLeft}");
  expect(link.getAttribute("aria-pressed")).toBe("true");

  await userEvent.click(link);

  expect(field.value).toBe("Läs mer");
});

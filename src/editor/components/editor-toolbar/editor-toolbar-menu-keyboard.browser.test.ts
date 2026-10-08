import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Story 081: the top menus follow the menu pattern (K4), and a choice in
 * them — by key or by mouse — leaves focus in the editor. Every shortcut
 * listens on <guide-editor>, so a menu that drops focus on body takes all
 * of them with it; measured 3/9 as Ctrl+K doing nothing after Vy → Visa
 * som lista.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount() {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  document.body.append(editor);
  editor.graph = { version: 8, startNodeId: null, nodes: [], connections: [] } as never;
  await settle(200);
  const tb = editor.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;
  const trigger = tb.querySelector<HTMLButtonElement>('[data-menu-trigger="edit"]')!;
  const menu = tb.querySelector<HTMLElement>('[data-menu="edit"]')!;
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].filter((one) => !one.hidden && !one.disabled);
  const key = (target: Element, key: string) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));

  return { editor, tb, trigger, menu, items, key };
}

describe("toppmenyn med tangentbord", () => {
  test("pil ned öppnar och fokuserar första posten, pilarna slår om, Escape går tillbaka", async () => {
    const { tb, trigger, menu, items, key } = await mount();

    trigger.focus();
    key(trigger, "ArrowDown");
    await settle();
    expect(menu.hidden, "menyn öppen").toBe(false);
    expect(tb.activeElement, "första posten har fokus").toBe(items()[0]);

    key(tb.activeElement!, "ArrowUp");
    expect(tb.activeElement, "pil upp från första slår om till sista").toBe(items().at(-1));
    key(tb.activeElement!, "Home");
    expect(tb.activeElement).toBe(items()[0]);

    key(tb.activeElement!, "Escape");
    await settle();
    expect(menu.hidden, "Escape stänger").toBe(true);
    expect(tb.activeElement, "fokus tillbaka på knappen").toBe(trigger);
  });

  test("pil höger går till grannmenyn, öppen", async () => {
    const { tb, trigger, key } = await mount();

    trigger.focus();
    key(trigger, "ArrowDown");
    await settle();
    key(tb.activeElement!, "ArrowRight");
    await settle();
    expect(tb.querySelector<HTMLElement>('[data-menu="guide"]')!.hidden, "Guide-menyn öppen").toBe(false);
    expect(tb.activeElement).toBe(tb.querySelector('[data-menu="guide"] [role=menuitem]'));
  });

  test("ett musval lämnar fokus i editorn, så kortkommandona lever", async () => {
    const { editor, tb } = await mount();

    tb.querySelector<HTMLButtonElement>('[data-menu-trigger="view"]')!.click();
    await settle();
    const menu = tb.querySelector<HTMLElement>('[data-menu="view"]')!;
    const item = menu.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')!;
    // A real click focuses the button first, then the menu hides under it.
    item.focus();
    item.click();
    await settle(300);
    expect(menu.hidden).toBe(true);
    expect(document.activeElement, "fokus kvar i editorn, inte på body").toBe(editor);
    expect(editor.shadowRoot!.activeElement).not.toBeNull();
  });

  test("ett val som inte tar fokus lämnar det på menyknappen", async () => {
    const { tb, trigger, menu } = await mount();

    trigger.click();
    await settle();
    const item = menu.querySelector<HTMLButtonElement>('[data-action="quick-open"]')!;
    item.focus();
    // Escape is the choice that certainly moves nothing else: the menu closes.
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await settle();
    expect(tb.activeElement).toBe(trigger);
  });
});

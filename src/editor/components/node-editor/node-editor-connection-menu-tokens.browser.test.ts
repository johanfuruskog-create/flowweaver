import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { NodeEditor } from "./node-editor";

/**
 * Del 2 (UPPDRAG-2026-09-28-ENHETLIGHET): nodens ⋯-meny och kopplingens
 * meny (samma behållare, `.node-editor__connection-menu`) följer den
 * godkända plusmenyn för yta, ram, skugga, radie och radhöjd. Mätt före
 * ändringen: bakgrunden var `--fw-surface` (inte `-raised`), skuggan en
 * literal `0 8px 24px rgb(16 24 40 / 18%)` (inte en token), radien
 * `--fw-radius-md` (8px, inte `-xl` 12px), och varje rad bara 35px hög —
 * under K6:s 44px-golv. Ramen (`--fw-border`) och typografin (16px/400)
 * var redan rätt, mätt samma gång, och rörs inte här.
 *
 * Den allmänna radens hover fick plusmenyns primärfärger, men den
 * destruktiva radens EGEN röda text (`node-editor-menu-colour.browser.test.ts`
 * skyddar redan att bara den är röd i vila) måste hålla i sig även på
 * hover nu när den allmänna hover-regeln också sätter en textfärg — annars
 * vinner den på specificitet och gör "Ta bort koppling" lila mitt i en
 * muspekning, exakt den urvattning den befintliga kommentaren i källan
 * varnar för.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function openConnectionMenu() {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  // Samma fungerande uppställning som `node-editor-connection-color.browser.test.ts`:
  // en `question`-nods eget svarsalternativ som portId, inte en gissad "out" —
  // en fri textfråga har ingen sådan port, och gav ingen renderad linje alls
  // (mätt: bara `--preview`-linjen fanns i DOM:en, ingen `--hit`).
  editor.graph = {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 40, y: 40 },
        data: { title: "Fråga", variableName: "a", options: [{ id: "q1-ja", label: "Ja", value: "ja" }] },
      },
      { id: "r1", type: "result", position: { x: 400, y: 40 }, data: { title: "Slut" } },
    ],
    connections: [{ id: "c1", from: { nodeId: "q1", portId: "q1-ja" }, to: { nodeId: "r1", portId: "input" } }],
  } as never;

  await settle();
  await settle();

  const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;

  const path = nodeEditor.shadowRoot!.querySelector<SVGPathElement>(
    "path.node-editor__connection-hit",
  )!;
  const box = path.getBoundingClientRect();

  path.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, composed: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 }),
  );
  await settle();

  const menu = nodeEditor.shadowRoot!.querySelector<HTMLElement>(".node-editor__connection-menu")!;
  const items = () =>
    [...menu.querySelectorAll<HTMLButtonElement>("button:not(.node-editor__connection-color)")];

  return { menu, items };
}

describe("kopplingens meny", () => {
  test.each([
    [null] as const,
    ["dark"] as const,
  ])("yta, radie och skugga följer plusmenyns facit (%s)", async (theme) => {
    if (theme) document.body.setAttribute("data-fw-theme", theme);

    try {
      const { menu } = await openConnectionMenu();
      const style = getComputedStyle(menu);
      const probe = document.createElement("div");

      probe.style.cssText = "background: var(--fw-surface-raised); box-shadow: var(--fw-shadow-raised);";
      menu.append(probe);
      const probeStyle = getComputedStyle(probe);

      expect(style.backgroundColor, "bakgrund, --fw-surface-raised").toBe(probeStyle.backgroundColor);
      expect(style.boxShadow, "skugga, --fw-shadow-raised, ingen literal").toBe(probeStyle.boxShadow);
      expect(style.borderRadius, "radie, --fw-radius-xl (12px)").toBe("12px");
      probe.remove();
    } finally {
      document.body.removeAttribute("data-fw-theme");
    }
  });

  test("raden håller K6:s 44px-golv (facit 46px)", async () => {
    const { items } = await openConnectionMenu();

    expect(items().length, "kopplingsmenyn öppnade inga poster").toBeGreaterThan(0);
    for (const item of items()) {
      expect(
        item.getBoundingClientRect().height,
        `${item.textContent?.trim()}: ${item.getBoundingClientRect().height}px`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("den röda borttagningsposten håller sin färg även på hover", async () => {
    const { items } = await openConnectionMenu();
    const remove = items().find((item) => item.dataset.action?.startsWith("remove-"))!;

    expect(remove, "ingen borttagningspost i menyn").toBeTruthy();

    const before = getComputedStyle(remove).color;

    await userEvent.hover(remove);

    expect(getComputedStyle(remove).color, "text stannar röd på hover, blir inte lila").toBe(before);
  });
});

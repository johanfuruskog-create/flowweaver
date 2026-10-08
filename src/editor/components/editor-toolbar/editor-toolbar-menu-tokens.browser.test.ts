import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import type { GuideEditor } from "../guide-editor/guide-editor";

/**
 * Del 2 (UPPDRAG-2026-09-28-ENHETLIGHET): verktygsradens sex menyer följer
 * den godkända plusmenyn (`.menu` i rich-text-field.scss) för yta, ram,
 * skugga, radie och radhöjd — mätt före ändringen: bakgrunden var
 * `--fw-surface` (inte `-raised`), ramen `--fw-border-control` (inte
 * `--fw-border`), radien `--fw-radius-md` (8px, inte `-xl` 12px), och
 * varje rad bara 35px hög — under K6:s 44px-golv för en tät kontrollrad.
 * Skuggan (`--fw-shadow-raised`) och typografin (16px/400) var redan rätt,
 * mätt samma gång, och rörs inte här.
 *
 * `white-space: nowrap` togs bort samtidigt (Astras krav: långa etiketter
 * radbryts i stället för att göra hela menyn bred) — testat mot
 * `editor.toolbar.exportSchema` ("Exportera inlämningens schema"), den
 * etikett kommentaren i källan pekade ut som skälet till att raden fanns.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function openFileMenu() {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = { startNodeId: null, nodes: [], connections: [] } as never;
  await settle(200);

  const toolbar = editor.shadowRoot!.querySelector("editor-toolbar")!.shadowRoot!;

  toolbar.querySelector<HTMLButtonElement>('[data-menu-trigger="file"]')!.click();
  await settle();

  const menu = toolbar.querySelector<HTMLElement>('[data-menu="file"]')!;
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter((one) => !one.hidden);

  return { toolbar, menu, items };
}

describe("verktygsradens menyer", () => {
  test.each([
    [null] as const,
    ["dark"] as const,
  ])("yta, ram, radie och skugga följer plusmenyns facit (%s)", async (theme) => {
    if (theme) document.body.setAttribute("data-fw-theme", theme);

    try {
      const { menu } = await openFileMenu();
      const style = getComputedStyle(menu);

      const probe = document.createElement("div");

      probe.style.cssText =
        "background: var(--fw-surface-raised); border-color: var(--fw-border); box-shadow: var(--fw-shadow-raised);";
      menu.append(probe);
      const probeStyle = getComputedStyle(probe);

      expect(style.backgroundColor, "bakgrund, --fw-surface-raised").toBe(probeStyle.backgroundColor);
      expect(style.borderTopColor, "ram, --fw-border").toBe(probeStyle.borderColor);
      expect(style.boxShadow, "skugga, --fw-shadow-raised").toBe(probeStyle.boxShadow);
      expect(style.borderRadius, "radie, --fw-radius-xl (12px)").toBe("12px");
      probe.remove();
    } finally {
      document.body.removeAttribute("data-fw-theme");
    }
  });

  test("varje rad håller K6:s 44px-golv (facit 46px)", async () => {
    const { items } = await openFileMenu();

    for (const item of items()) {
      expect(
        item.getBoundingClientRect().height,
        `${item.textContent?.trim()}: ${item.getBoundingClientRect().height}px`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("behåller innehållsberoende bredd: en lång men verklig etikett tvingas INTE radbryta", async () => {
    // Astras krav (Johans rättning 28/9, efter en före/efter-jämförelse): en
    // lång etikett SKA KUNNA radbrytas, inte TVINGAS. Ett första försök satte
    // taket så lågt att även "Exportera inlämningens schema" — som rymdes på
    // en rad i den gamla verktygsraden — tvingades brytas. Menyn ska i
    // stället växa med sitt innehåll (width: max-content) upp till ett tak
    // mätt mot den bredaste av alla sex menyers rader (Vy-menyns "Visa alla
    // som besökaren ser dem", 302px meny — se kommentaren vid
    // editor-toolbar.scss `[role="menu"]`).
    const { menu, items } = await openFileMenu();
    const long = items().find((item) => item.dataset.action === "export-schema")!;

    expect(long, "exportera-inlämningens-schema-posten saknas").toBeTruthy();

    const range = document.createRange();

    range.selectNodeContents(long);
    expect(range.getClientRects().length, "\"Exportera inlämningens schema\" bröts över flera rader trots att den ryms på en").toBe(1);
    // Menyn har växt förbi sin min-width-golv (210px) för att rymma raden.
    expect(menu.getBoundingClientRect().width).toBeGreaterThan(280);
  });

  test("men en verkligt lång etikett radbryts ändå, ovanför taket, utan att krocka med kbd-hinten", async () => {
    const { menu, items } = await openFileMenu();
    const target = items().find((item) => item.dataset.action === "save")!;
    const kbd = target.querySelector("kbd")!;
    const originalText = target.childNodes[0]!.textContent;

    target.childNodes[0]!.textContent =
      "En konstgjort mycket lång etikett som verkligen inte ryms på en enda rad oavsett bredd ";

    const range = document.createRange();

    range.selectNodeContents(target);
    expect(range.getClientRects().length, "en riktigt lång etikett ska ändå brytas").toBeGreaterThan(1);
    // Och menyn har inte bara vuxit obegränsat för att göra plats åt den.
    expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(310 + 1);

    // kbd-hinten ligger helt innanför sin egen posts ruta även när etiketten
    // bredvid den har brutit över flera rader — ingen överlappning med en
    // granne eller ett utflöde utanför menyn.
    const itemBox = target.getBoundingClientRect();
    const kbdBox = kbd.getBoundingClientRect();

    expect(kbdBox.left).toBeGreaterThanOrEqual(itemBox.left);
    expect(kbdBox.right).toBeLessThanOrEqual(itemBox.right + 1);

    target.childNodes[0]!.textContent = originalText;
  });

  test("hover byter yta och text till plusmenyns primärfärger", async () => {
    const { items } = await openFileMenu();
    const item = items()[0]!;
    const before = getComputedStyle(item).backgroundColor;

    await userEvent.hover(item);

    const probe = document.createElement("div");

    probe.style.cssText = "background: var(--fw-primary-surface); color: var(--fw-primary-hover);";
    item.append(probe);
    const probeStyle = getComputedStyle(probe);

    expect(getComputedStyle(item).backgroundColor, "hover-bakgrund, --fw-primary-surface").toBe(
      probeStyle.backgroundColor,
    );
    expect(getComputedStyle(item).backgroundColor, "skiljer sig från vila").not.toBe(before);
    expect(getComputedStyle(item).color, "hover-text, --fw-primary-hover").toBe(probeStyle.color);
    probe.remove();
  });
});

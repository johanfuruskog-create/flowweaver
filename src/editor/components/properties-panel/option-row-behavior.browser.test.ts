import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import { optionPortsGraph } from "../../../data/option-ports-graph";
import { exportGraphJson, importGraphJson } from "../../core/graph-io";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Uppdrag 28/9 svarsalternativen, etapp 2 — beteendet i Fias rad (hookarna
 * `data-option-open`, `toggle-option`, `data-option-body`,
 * `data-option-title`; lagringsvärdet är sedan vända 5 ett vanligt fält).
 *
 * Utfällt är ett gränssnittstillstånd: det bor i panelen per alternativ-id,
 * aldrig i modellen, och en växling är ingen ändring av guiden. Det följer
 * alternativet när det flyttas, med knapp och med drag, och fokus följer med.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: GraphData = optionPortsGraph as GraphData): Promise<{ editor: GuideEditor; panel: ShadowRoot; changes: string[] }> {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.panelOpen = true;  // story 145: the side panel starts folded; these tests work in it
  const changes: string[] = [];

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1300px; height: 1400px;";
  document.body.append(editor);
  editor.graph = structuredClone(graph) as never;
  await settle();
  await settle();
  (editor.shadowRoot!.querySelector("node-editor") as unknown as { selectNodeById(id: string): void }).selectNodeById("ports-question");
  await settle();
  await settle();
  editor.addEventListener("graph-changed", (event) => changes.push((event as CustomEvent<{ reason: string }>).detail.reason));

  return { editor, panel: editor.shadowRoot!.querySelector("properties-panel")!.shadowRoot!, changes };
}

const row = (panel: ShadowRoot, id: string) =>
  panel.querySelector<HTMLElement>(`.properties-panel__option[data-option-id="${id}"]`)!;
const isOpen = (panel: ShadowRoot, id: string) => {
  const element = row(panel, id);

  return {
    attribute: element.hasAttribute("data-option-open"),
    body: !element.querySelector<HTMLElement>("[data-option-body]")!.hidden,
    expanded: element.querySelector('[data-action="toggle-option"]')!.getAttribute("aria-expanded"),
  };
};
const OPEN = { attribute: true, body: true, expanded: "true" };
/** The heading's visible name — its text without the hidden position. */
const nameOf = (element: HTMLElement) => {
  const title = element.querySelector<HTMLElement>("[data-option-title]")!;
  return [...title.childNodes]
    .filter((node) => !(node instanceof HTMLElement && node.hasAttribute("data-option-position")))
    .map((node) => node.textContent)
    .join("")
    .trim();
};
const CLOSED = { attribute: false, body: false, expanded: "false" };
/**
 * The editor's floor as far as the text field goes (K18: Firefox 121, Safari
 * 16.4): no `field-sizing`. Chromium — the only engine the cloud runs — and
 * Playwright's WebKit have it and size the field themselves, so without this
 * the script that does it on the floor could go unnoticed (measured 29/9:
 * with the script removed only Firefox failed). An adopted sheet, because the
 * panel redraws its shadow root with innerHTML.
 */
function asOnTheFloor(panel: ShadowRoot): void {
  const sheet = new CSSStyleSheet();

  sheet.replaceSync("textarea { field-sizing: fixed !important; }");
  panel.adoptedStyleSheets = [...panel.adoptedStyleSheets, sheet];
}
const order = (graph: GraphData): string[] =>
  (graph.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>).map((option) => option.label);

describe("svarsalternativens rader", () => {
  test("stängda från början; en växling fäller ut raden utan att ändra guiden", async () => {
    const { editor, panel, changes } = await mount();
    const before = JSON.stringify(editor.getData());

    expect(isOpen(panel, "ports-mail")).toEqual(CLOSED);
    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);

    expect(isOpen(panel, "ports-mail")).toEqual(OPEN);
    expect(isOpen(panel, "ports-phone")).toEqual(CLOSED);
    expect(changes, "en växling är ingen ändring av guiden").toEqual([]);
    expect(JSON.stringify(editor.getData())).toBe(before);

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    expect(isOpen(panel, "ports-mail")).toEqual(CLOSED);
  });

  /*
   * Johans förenkling (vända 5, 28/9): lagringsvärdet är ett vanligt fält i
   * det öppna kortet — ingen chip, ingen egen utfällning. Det som måste
   * hålla är att det man skriver där är det som sparas: genom filformatet
   * (export och import) och in i en ny editor, med etiketten och kopplingen
   * orörda.
   */
  test("ett redigerat lagringsvärde finns kvar efter sparad guide och ny editor", async () => {
    const first = await mount();

    await userEvent.click(row(first.panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const field = row(first.panel, "ports-mail").querySelector<HTMLInputElement>('[data-option-property="value"]')!;

    expect(field.checkVisibility(), "fältet syns direkt i det öppna kortet").toBe(true);
    field.focus();
    await userEvent.keyboard("{Control>}a{/Control}mejl");
    await userEvent.tab();
    await settle(600);

    const saved = exportGraphJson(first.editor.getData() as GraphData);
    if (!saved.success) throw new Error(saved.errors.join("; "));
    document.body.replaceChildren();

    const loaded = importGraphJson(saved.json);
    if (!loaded.success) throw new Error(loaded.errors.join("; "));
    const second = await mount(loaded.graph);
    const options = (second.editor.getData() as GraphData).nodes.find((node) => node.id === "ports-question")!.data
      .options as Array<{ id: string; label: string; value: string }>;

    expect(options[0]).toMatchObject({ id: "ports-mail", label: "E-post", value: "mejl" });
    await userEvent.click(row(second.panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    expect(row(second.panel, "ports-mail").querySelector<HTMLInputElement>('[data-option-property="value"]')!.value).toBe("mejl");
    expect(
      (second.editor.getData() as GraphData).connections.find((connection) => connection.from.portId === "ports-mail")?.to.nodeId,
      "kopplingen följer alternativets id, inte värdet",
    ).toBe("ports-to-mail");
  });

  test("öppet läge och fokus följer alternativet när det flyttas med knappen", async () => {
    const { editor, panel } = await mount();

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="move-option-down"]')!);
    await settle();

    expect(order(editor.getData() as GraphData)).toEqual(["Telefon", "E-post", "Brev"]);
    expect(isOpen(panel, "ports-mail")).toEqual(OPEN);
    expect(isOpen(panel, "ports-phone")).toEqual(CLOSED);
    let active = panel.activeElement as HTMLElement | null;
    expect(active?.dataset.action).toBe("move-option-down");
    expect(active?.dataset.optionId).toBe("ports-mail");

    // Längst ned blir Flytta ned inaktiv: fokus går till Flytta upp på samma alternativ.
    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="move-option-down"]')!);
    await settle();
    active = panel.activeElement as HTMLElement | null;
    expect(order(editor.getData() as GraphData)).toEqual(["Telefon", "Brev", "E-post"]);
    expect(row(panel, "ports-mail").querySelector<HTMLButtonElement>('[data-action="move-option-down"]')!.disabled).toBe(true);
    expect(active?.dataset.action).toBe("move-option-up");
    expect(active?.dataset.optionId).toBe("ports-mail");
  });

  test("Lägg till lägger sist, öppnar raden och sätter markören i texten, med Nytt alternativ som rubrik", async () => {
    const { editor, panel } = await mount();

    await userEvent.click(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    await settle(300);

    const rows = [...panel.querySelectorAll<HTMLElement>(".properties-panel__option[data-option-id]")];
    const added = rows.at(-1)!;
    const id = added.dataset.optionId!;

    expect(rows).toHaveLength(4);
    expect(isOpen(panel, id)).toEqual(OPEN);
    expect((panel.activeElement as HTMLElement | null)?.dataset.optionProperty).toBe("label");
    expect((panel.activeElement as HTMLElement | null)?.dataset.optionId).toBe(id);
    expect(nameOf(added)).toBe("Nytt alternativ");

    await userEvent.keyboard("Brevduva");
    await settle();
    expect(nameOf(added), "rubriken följer texten").toBe("Brevduva");
    const options = (editor.getData() as GraphData).nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>;
    expect(options.at(-1)!.label).toBe("Brevduva");

    // Tillbaka till tomt: rubriken tar platshållaren igen, inte en nyckel.
    await userEvent.keyboard("{Control>}a{/Control}{Backspace}");
    await settle();
    expect(nameOf(added), "rubriken när texten töms").toBe("Nytt alternativ");
  });

  /*
   * Fias risk, mätt 28/9: en öppen rad (373 px) bytte inte plats med en
   * stängd granne (86 px) förrän pekaren gått ~280 px — gesten jämför
   * pekaren med radens egen lucka. Raden fälls ihop innan gesten mäter och
   * öppnas efter släppet; `reorder-gesture.ts` är orörd.
   */
  test("en öppen rad byter plats med en stängd inom en radhöjd, och är öppen igen efter släppet", async () => {
    const { editor, panel } = await mount();

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const closedHeight = row(panel, "ports-phone").getBoundingClientRect().height;
    // Konceptbild 2 (29/9): huvudet är en rad, 60 px, plus kortets ram. Bytet
    // prövas mot den höjden — inte mot etapp 2:s 86 px.
    expect(closedHeight, "en stängd rads höjd").toBeGreaterThanOrEqual(60);
    expect(closedHeight).toBeLessThanOrEqual(64);
    const handle = row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="drag-option"]')!;
    const grip = handle.getBoundingClientRect();
    const x = grip.left + grip.width / 2;
    const y0 = grip.top + grip.height / 2;
    const y1 = y0 + closedHeight * 1.05;
    const at = (y: number) => ({ bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1 });

    handle.dispatchEvent(new PointerEvent("pointerdown", at(y0)));
    for (let step = 1; step <= 20; step += 1) {
      window.dispatchEvent(new PointerEvent("pointermove", at(y0 + ((y1 - y0) * step) / 20)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.dispatchEvent(new PointerEvent("pointerup", at(y1)));
    await settle(300);

    expect(order(editor.getData() as GraphData), `bytet efter ${Math.round(y1 - y0)} px`).toEqual(["Telefon", "E-post", "Brev"]);
    expect(isOpen(panel, "ports-mail")).toEqual(OPEN);
    expect((panel.activeElement as HTMLElement | null)?.dataset.optionId).toBe("ports-mail");
  });

  /*
   * Ett drag som släpps utan byte ritar inte om panelen — då är det
   * släpp-lyssnaren ensam som fäller ut raden igen.
   */
  test("en öppen rad som släpps utan byte är öppen igen", async () => {
    const { editor, panel } = await mount();
    const before = JSON.stringify(editor.getData());

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const handle = row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="drag-option"]')!;
    const grip = handle.getBoundingClientRect();
    const at = { bubbles: true, composed: true, clientX: grip.left + grip.width / 2, clientY: grip.top + grip.height / 2, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1 };

    handle.dispatchEvent(new PointerEvent("pointerdown", at));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(isOpen(panel, "ports-mail"), "hopfälld under draget").not.toEqual(OPEN);
    window.dispatchEvent(new PointerEvent("pointerup", at));
    await settle(300);

    expect(JSON.stringify(editor.getData())).toBe(before);
    expect(isOpen(panel, "ports-mail")).toEqual(OPEN);
  });

  /*
   * Konceptbild 2 (Johan 29/9). Huvudet är en rad utan synlig position;
   * "Alternativ N" läses i rubriken, en gång, och kontrollernas namn förblir
   * korta med etiketten (ledaren 29/9).
   */
  test("positionen läses i rubriken och följer en flytt; kontrollernas namn bär den inte", async () => {
    const { panel } = await mount();
    const positions = () =>
      [...panel.querySelectorAll<HTMLElement>(".properties-panel__option[data-option-id]")].map(
        (element) => `${element.dataset.optionId}:${element.querySelector("[data-option-title] [data-option-position]")?.textContent}`,
      );

    expect(positions()).toEqual(["ports-mail:Alternativ 1, ", "ports-phone:Alternativ 2, ", "ports-letter:Alternativ 3, "]);
    expect(row(panel, "ports-mail").querySelector<HTMLElement>("[data-option-position]")!.getBoundingClientRect().width, "dold för ögat").toBeLessThanOrEqual(1);
    expect(row(panel, "ports-mail").querySelector('[data-action="move-option-down"]')!.getAttribute("aria-label")).toBe("Flytta E-post nedåt");

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="move-option-down"]')!);
    await settle();
    expect(positions()).toEqual(["ports-phone:Alternativ 1, ", "ports-mail:Alternativ 2, ", "ports-letter:Alternativ 3, "]);
  });

  /*
   * Etiketten är en rad i modellen: visaren ritar den med vanligt
   * blanktecken, så en radbrytning blir ett mellanslag för besökaren men
   * följer med i datan (mätt 29/9). Enter skriver ingen, en inklistrad blir
   * ett mellanslag — i fältet och i modellen samtidigt.
   */
  test("etikettfältet tar ingen radbrytning: Enter skriver ingen, en inklistrad blir mellanslag", async () => {
    const { editor, panel } = await mount();
    const label = () =>
      ((editor.getData() as GraphData).nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>)[0].label;

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const field = row(panel, "ports-mail").querySelector<HTMLTextAreaElement>('textarea[data-option-property="label"]')!;

    field.focus();
    await userEvent.keyboard("{Control>}a{/Control}Brev{Enter}du{Shift>}{Enter}{/Shift}va");
    expect(field.value).toBe("Brevduva");
    expect(label()).toBe("Brevduva");

    field.setSelectionRange(4, 4);
    // LF only: a textarea keeps no CR, but setRangeText places the caret by the raw length (measured).
    field.setRangeText(" post\n  en\n", 4, 4, "end");
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
    expect(field.value).toBe("Brev post en duva");
    expect(label()).toBe("Brev post en duva");
    expect(field.selectionStart, "markören efter det inklistrade").toBe("Brev post en ".length);
  });

  test("etikettfältet växer med texten och krymper tillbaka, utan rullning inuti", async () => {
    const { panel } = await mount();
    asOnTheFloor(panel);

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const field = row(panel, "ports-mail").querySelector<HTMLTextAreaElement>('textarea[data-option-property="label"]')!;
    const oneLine = field.getBoundingClientRect().height;

    expect(field.scrollHeight, "en rad ryms från början").toBeLessThanOrEqual(field.clientHeight);
    field.focus();
    await userEvent.keyboard(" — skickas till den adress du har angett i ditt konto hos kommunen, inom tre arbetsdagar");
    const grown = field.getBoundingClientRect().height;

    expect(grown).toBeGreaterThan(oneLine * 1.5);
    expect(field.scrollHeight, "ingen rullning inuti").toBeLessThanOrEqual(field.clientHeight);

    await userEvent.keyboard("{Control>}a{/Control}Ja");
    expect(field.getBoundingClientRect().height).toBeCloseTo(oneLine, 0);
  });

  /*
   * Utan att något skrivs: en lång etikett ska rymmas när kortet öppnas, och
   * när panelen ritas om med kortet öppet (en flytt). Mätt på golvet
   * (`asOnTheFloor`), där skriptet är det som mäter.
   */
  test("en lång etikett ryms när kortet öppnas och efter en omritning", async () => {
    const long = structuredClone(optionPortsGraph) as GraphData;
    (long.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>)[0].label =
      "E-post till den adress du har angett i ditt konto hos kommunen, inom tre arbetsdagar";
    const { panel } = await mount(long);
    asOnTheFloor(panel);
    const field = () => row(panel, "ports-mail").querySelector<HTMLTextAreaElement>('[data-option-property="label"]')!;

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    expect(field().scrollHeight, "när kortet öppnas").toBeLessThanOrEqual(field().clientHeight);

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="move-option-down"]')!);
    await settle();
    expect(field().scrollHeight, "efter omritningen").toBeLessThanOrEqual(field().clientHeight);
  });

  test("rubriken följer texten utan att tappa positionen", async () => {
    const { panel } = await mount();

    await userEvent.click(row(panel, "ports-mail").querySelector<HTMLElement>('[data-action="toggle-option"]')!);
    const field = row(panel, "ports-mail").querySelector<HTMLTextAreaElement>('[data-option-property="label"]')!;

    field.focus();
    await userEvent.keyboard("{Control>}a{/Control}Mejl");
    const title = row(panel, "ports-mail").querySelector<HTMLElement>("[data-option-title]")!;

    expect(title.querySelector("[data-option-position]")?.textContent).toBe("Alternativ 1, ");
    expect(title.textContent).toBe("Alternativ 1, Mejl");
    expect(row(panel, "ports-mail").querySelector("[data-option-tooltip]")!.textContent, "tooltipen visar samma namn").toBe("Mejl");
  });

  /*
   * Namnet i huvudet klipps med ellips; tooltipen visar hela. Den kommer
   * när chevronen får fokus och när pekaren är över huvudet — bara om
   * namnet faktiskt är avkortat — och Escape stänger den utan att röra
   * kortet eller låta editorn ta tangenten.
   */
  test("tooltipen: vid fokus och hover när namnet är avkortat, Escape stänger bara den, inom panelen", async () => {
    const long = structuredClone(optionPortsGraph) as GraphData;
    const options = long.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>;
    options[0].label = "E-post till den adress du har angett i ditt konto hos kommunen";
    const { editor, panel } = await mount(long);
    const mail = row(panel, "ports-mail");
    const tooltip = mail.querySelector<HTMLElement>("[data-option-tooltip]")!;
    const toggle = mail.querySelector<HTMLElement>('[data-action="toggle-option"]')!;
    const title = mail.querySelector<HTMLElement>("[data-option-title]")!;

    // Pekaren bort från huvudet: förra provets pekare kan stå där raden nu ritats.
    await userEvent.hover(panel.querySelector<HTMLElement>('[data-action="add-option"]')!);
    // Hoverable (WCAG 1.4.13, 29/9): en kort nådebit innan `hide()` körs, så
    // pekaren hinner in i tooltipen genom mellanrummet ovanför huvudet.
    await settle(250);
    expect(title.scrollWidth, "namnet är avkortat").toBeGreaterThan(title.clientWidth);
    expect(tooltip.hidden, "stängd från början").toBe(true);

    toggle.focus();
    expect(tooltip.hidden, "visas vid fokus").toBe(false);
    expect(toggle.getAttribute("aria-describedby")).toBe(tooltip.id);

    /*
     * Inom panelens synliga yta — också i värsta läget, rullad så att huvudet
     * står precis i överkanten av det som rullar, där en tooltip ovanför
     * huvudet skulle klippas.
     */
    const clipOf = (): { top: number; left: number; right: number; bottom: number; scroller: HTMLElement | null } => {
      let clip = { top: -Infinity, left: -Infinity, right: Infinity, bottom: Infinity };
      let scroller: HTMLElement | null = null;
      for (let node: Element | null = tooltip.parentElement; node; node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)) {
        const style = getComputedStyle(node);
        if (style.overflow === "visible") continue;
        if (!scroller && /(auto|scroll)/.test(style.overflowY)) scroller = node as HTMLElement;
        const r = node.getBoundingClientRect();
        clip = { top: Math.max(clip.top, r.top), left: Math.max(clip.left, r.left), right: Math.min(clip.right, r.right), bottom: Math.min(clip.bottom, r.bottom) };
      }
      return { ...clip, scroller };
    };
    const inside = (label: string) => {
      const box = tooltip.getBoundingClientRect();
      const clip = clipOf();
      expect(box.top, `${label}: inte klippt ovantill`).toBeGreaterThanOrEqual(clip.top);
      expect(box.bottom, `${label}: inte klippt nedtill`).toBeLessThanOrEqual(clip.bottom);
      expect(box.left, label).toBeGreaterThanOrEqual(clip.left);
      expect(box.right, label).toBeLessThanOrEqual(clip.right);
    };
    inside("som den ritas");

    const { scroller } = clipOf();
    expect(scroller, "panelen rullar").not.toBeNull();
    const head = mail.querySelector<HTMLElement>(".properties-panel__option-header")!;
    scroller!.style.paddingBottom = "2000px"; // plats att rulla huvudet till överkanten
    scroller!.scrollTop += head.getBoundingClientRect().top - scroller!.getBoundingClientRect().top;
    toggle.blur();
    toggle.focus();
    // WebKit rundar rullningen till hela pixlar (mätt: 1 px), fortfarande värsta läget.
    expect(Math.abs(head.getBoundingClientRect().top - scroller!.getBoundingClientRect().top), "huvudet i överkanten").toBeLessThanOrEqual(1);
    inside("huvudet i överkanten");

    /*
     * I helskärmsläget lämnar Escape läget om ingen annan tagit tangenten
     * (`handleWideModeKeydown`, `defaultPrevented`). Tooltipens Escape ska
     * inte kasta ut redaktören ur helskärm.
     */
    editor.toggleAttribute("wide", true);
    await userEvent.keyboard("{Escape}");
    expect(tooltip.hidden, "Escape stänger tooltipen").toBe(true);
    expect(editor.hasAttribute("wide"), "helskärmen står kvar").toBe(true);
    expect(isOpen(panel, "ports-mail"), "kortet står kvar").toEqual(CLOSED);
    expect(panel.activeElement, "fokus står kvar").toBe(toggle);
    expect(mail.isConnected, "editorn tog inte tangenten").toBe(true);

    toggle.blur();
    await userEvent.hover(mail.querySelector<HTMLElement>(".properties-panel__option-header")!);
    expect(tooltip.hidden, "visas vid hover").toBe(false);
    await userEvent.unhover(mail.querySelector<HTMLElement>(".properties-panel__option-header")!);
    await settle(250);
    expect(tooltip.hidden, "stängd när pekaren lämnat, efter nådebiten").toBe(true);

    const phone = row(panel, "ports-phone");
    phone.querySelector<HTMLElement>('[data-action="toggle-option"]')!.focus();
    expect(phone.querySelector<HTMLElement>("[data-option-tooltip]")!.hidden, "ett kort namn behöver ingen").toBe(true);
  });

  /*
   * WCAG 1.4.13 "hoverable" (Siv, 29/9, vända 5): tooltipen sitter
   * `margin-bottom: var(--fw-space-2)` ovanför huvudet — ett riktigt
   * mellanrum, inte en gemensam kant. Pekaren som går rakt mot tooltipen
   * passerar den bit som hör till VARKEN huvudet eller tooltipen, och
   * `pointerleave` på huvudet fyrade en omedelbar `hide()` innan pekaren
   * hann fram — mätt med en riktig pekarväg, inte gissat av CSS:en. En
   * nådebit (200 ms), struken av att landa på endera ytan igen, löser det.
   */
  test("tooltipen står kvar när pekaren förs in i den, genom mellanrummet ovanför huvudet", async () => {
    const long = structuredClone(optionPortsGraph) as GraphData;
    const options = long.nodes.find((node) => node.id === "ports-question")!.data.options as Array<{ label: string }>;
    options[0].label = "E-post till den adress du har angett i ditt konto hos kommunen";
    const { panel } = await mount(long);
    const mail = row(panel, "ports-mail");
    const tooltip = mail.querySelector<HTMLElement>("[data-option-tooltip]")!;
    const head = mail.querySelector<HTMLElement>(".properties-panel__option-header")!;

    await userEvent.hover(head);
    expect(tooltip.hidden, "visas vid hover").toBe(false);

    // Rakt in i tooltipen, som en riktig pekarrörelse genom mellanrummet.
    await userEvent.hover(tooltip);
    await settle(250);
    expect(tooltip.hidden, "kvar synlig med pekaren över tooltipen (1.4.13 hoverable)").toBe(false);

    await userEvent.unhover(tooltip);
    await settle(250);
    expect(tooltip.hidden, "stängs när pekaren lämnar även tooltipen").toBe(true);
  });
});

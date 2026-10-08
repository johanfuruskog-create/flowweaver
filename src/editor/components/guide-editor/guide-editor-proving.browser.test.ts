import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { exampleGraph } from "../../../data/example-graph";
import { citizenshipExampleGraph } from "../../../data/citizenship-example-graph";
import { registerCodeList } from "../../../viewer/code-lists/code-list-registry";
import { navetCountryCodes } from "../../../viewer/code-lists/navet-country-codes";

import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { FlowNode } from "../flow-node/flow-node";
import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Starting and ending a run of the guide on the canvas (story 065, points 1–2).
 *
 * Three things are held here, and all three were reachable only through the
 * preview panel before:
 *
 * 1. A run is started **deliberately and always from the start step** — from
 *    the Guide menu, never by clicking a node in the middle. A step halfway
 *    through a guide has a state that depends on everything before it, so a
 *    route that jumps in is one no visitor could ever take.
 * 2. The line at the top says a run is going on, and says which step of how
 *    many. It carries `role="status"`, so the step change is announced.
 * 3. The run leaves nothing behind: `graph` comes back byte-identical and no
 *    change event is dispatched, exactly as the eye of story 064.
 */

afterEach(() => document.body.replaceChildren());

// Landslistan bakom Medborgarskaps-sökfältet — utan den svarar pickern
// "Inga träffar" och förslagslistan öppnas aldrig.
registerCodeList(navetCountryCodes);

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function mount(): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.style.cssText = "display: block; width: 1400px; height: 800px;";
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = structuredClone(exampleGraph);
  return editor;
}

function canvas(editor: GuideEditor): NodeEditor {
  const found = editor.shadowRoot?.querySelector<NodeEditor>("node-editor");

  if (!found) throw new Error("node-editor saknas");
  return found;
}

function nodeElement(editor: GuideEditor, id: string): FlowNode {
  const found = [
    ...(canvas(editor).shadowRoot?.querySelectorAll<FlowNode>("flow-node") ?? []),
  ].find((element) => element.nodeId === id);

  if (!found) throw new Error(`ingen nod med id ${id}`);
  return found;
}

function bar(editor: GuideEditor): HTMLElement | null {
  const element = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
    "[data-proving-bar]",
  );

  return element && !element.hidden ? element : null;
}

async function startProving(editor: GuideEditor): Promise<void> {
  const toolbar =
    editor.shadowRoot?.querySelector<EditorToolbar>("editor-toolbar");
  const trigger = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-menu-trigger="guide"]',
  );
  const item = toolbar?.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-action="prove-guide"]',
  );

  if (!trigger || !item) throw new Error("hittade inte Prova guiden i Guide-menyn");

  await userEvent.click(trigger);
  await userEvent.click(item);
  await settle();
  await settle();
}

describe("provläget", () => {
  test("raden är osynlig på en nyladdad sida — display, inte bara attributet", async () => {
    // Johans bild 2/9: "Börja om", "Avsluta" och en tom textpill stod på en
    // nyss laddad sida. `display: flex` på klassen slog ut UA-regeln för
    // `[hidden]` — tredje gången fällan biter (paletten, bollen, raden).
    const editor = mount();
    await settle();
    await settle();

    const provingBar = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
      "[data-proving-bar]",
    );
    if (!provingBar) throw new Error("raden finns inte i canvasen");
    expect(provingBar.hidden).toBe(true);
    expect(getComputedStyle(provingBar).display).toBe("none");
  });

  test("Guide → Prova guiden startar provet och visar raden", async () => {
    const editor = mount();
    await settle();

    expect(bar(editor)).toBe(null);

    await startProving(editor);

    const row = bar(editor);

    expect(row).not.toBe(null);
    expect(
      row?.querySelector("[data-proving-text]")?.getAttribute("role"),
    ).toBe("status");
    expect(row?.textContent).toContain("steg 1");
    // Ingen total: "av 6" var längsta vägen, inte den här vägens längd.
    expect(row?.textContent).not.toContain(" av ");
    expect(canvas(editor).hasAttribute("data-proving")).toBe(true);
  });

  test("startnoden är den aktuella", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    expect(nodeElement(editor, "question-age").hasAttribute("data-current")).toBe(
      true,
    );
    expect(
      nodeElement(editor, "question-gender").hasAttribute("data-current"),
    ).toBe(false);
  });

  test("Escape avslutar provet och lämnar fokus på noden man stod på", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const viewport = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport",
    );

    viewport?.focus();
    viewport?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      }),
    );
    await settle();

    expect(bar(editor)).toBe(null);
    expect(canvas(editor).hasAttribute("data-proving")).toBe(false);
    expect(
      canvas(editor).shadowRoot?.activeElement,
    ).toBe(nodeElement(editor, "question-age"));
  });

  test("provet lämnar inga spår i guiden", async () => {
    const editor = mount();
    await settle();

    const before = JSON.stringify(editor.getData());
    let changes = 0;

    editor.addEventListener("graph-changed", () => {
      changes += 1;
    });

    await startProving(editor);

    expect(JSON.stringify(editor.getData())).toBe(before);
    expect(changes).toBe(0);
  });
});

/**
 * The live step, and what Next does with it (story 065 points 3–4).
 *
 * "One engine, two mirrors": the run belongs to the preview panel's engine, and
 * the node on the canvas draws that same engine — not a second one holding a
 * copy of the same answers. So a Next pressed in the node is a Next in the
 * panel, with nothing in between to fall out of step.
 */
describe("den levande vyn", () => {
  test("den aktuella nodens besökarvy går att fylla i", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const preview = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );

    expect(preview).not.toBe(null);
    expect(preview?.hasAttribute("inert")).toBe(false);
    expect(
      preview?.shadowRoot?.querySelector("input, textarea, select"),
    ).not.toBe(null);
  });

  test("Nästa flyttar provet, panorerar dit och lämnar den besvarade noden", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const steps: string[] = [];

    editor.shadowRoot?.addEventListener("preview-node-changed", (event) => {
      steps.push((event as CustomEvent).detail.nodeId);
    });

    const live = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");

    if (!field) throw new Error("inget fält i den levande vyn");

    field.value = "30";
    field.dispatchEvent(new Event("input", { bubbles: true }));

    const next = [
      ...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ].find((button) => button.dataset.action === "next");

    if (!next) throw new Error("ingen Nästa-knapp i den levande vyn");

    next.click();
    await settle();
    await settle();

    expect(nodeElement(editor, "question-gender").hasAttribute("data-current")).toBe(
      true,
    );
    expect(nodeElement(editor, "question-age").hasAttribute("data-current")).toBe(
      false,
    );
    expect(nodeElement(editor, "question-age").hasAttribute("data-answered")).toBe(
      true,
    );
    expect(steps.at(-1)).toBe("question-gender");
    expect(bar(editor)?.textContent).toContain("steg 2");
    expect(bar(editor)?.textContent).not.toContain(" av ");

    const viewport = canvas(editor).shadowRoot?.querySelector<HTMLElement>(
      ".node-editor__viewport",
    );
    // Åkningen glider sedan 1/10 (provet nedan), så vyn frågas först när
    // den stannat — `scrollend`, eller en sekund om webbläsaren saknar den.
    await Promise.race([
      new Promise<void>((resolve) => viewport!.addEventListener("scrollend", () => resolve(), { once: true })),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
    const box = nodeElement(editor, "question-gender").getBoundingClientRect();
    const view = viewport!.getBoundingClientRect();

    expect(box.left).toBeGreaterThanOrEqual(view.left);
    expect(box.right).toBeLessThanOrEqual(view.right);
  });

  test("åkningen till nästa steg glider, den klipper inte", async () => {
    /*
     * Promon 1/10 2026 visade varje stegbyte som ett klipp på en bildruta.
     * Johan: "så borde det fungera i produkten också, mjuk övergång … på
     * åkningen mellan noderna". Glidningen är canvasens (se
     * node-editor-center-smooth); här hålls att provläget BER om den — och
     * att inget annat i editorn gör det, så arbetsytans osynliga flyttar
     * förblir klipp.
     */
    const editor = mount();
    await settle();
    await startProving(editor);

    const centred = vi.spyOn(canvas(editor), "centerNodeById");
    const live = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!field) throw new Error("inget fält i den levande vyn");
    field.value = "30";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const next = [
      ...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ].find((button) => button.dataset.action === "next");
    if (!next) throw new Error("ingen Nästa-knapp i den levande vyn");

    next.click();
    await settle();

    expect(centred).toHaveBeenCalledWith("question-gender", { smooth: true });
  });

  test("ett flikbyte mitt i provet byter inte motor under spegeln", async () => {
    // Johans bilder 2/9 03:03 (Medborgarskap på surfplattan): efter Egenskaper
    // och tillbaka visade nodkortet resultatet medan panelen stod kvar på
    // frågan och raden sade steg 1. Uppmätt: refreshSidebarPreview gav
    // panelen `graph =` (en NY motor) mitt i provet — nodens spegel behöll
    // den gamla, och skalet hörde bara den enas händelser.
    const editor = mount();
    await settle();

    await startProving(editor);

    const properties = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="properties"]',
    );
    const preview = editor.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-sidebar-mode="preview"]',
    );
    if (!properties || !preview) throw new Error("flikarna saknas");
    await userEvent.click(properties);
    await settle();
    await userEvent.click(preview);
    await settle();

    const live = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");

    field!.value = "30";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    [
      ...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ]
      .find((button) => button.dataset.action === "next")!
      .click();
    await settle();
    await settle();

    expect(bar(editor)?.textContent).toContain("steg 2");
  });

  test("sökfältets förslagslista tar plats i kortet i stället för att ligga över knapparna", async () => {
    // Johans bild 2/9 03:02: listan låg över Föregående/Nästa och "Tyskland"
    // klipptes av kortets kant. Overlayn är rätt i en smal panel (mätningen i
    // _picker.scss), men på canvaskortet ska rutan följa innehållet (064).
    const editor = document.createElement("guide-editor") as GuideEditor;
    editor.style.cssText = "display: block; width: 1400px; height: 800px;";
    editor.setAttribute("mode", "administrator");
    document.body.append(editor);
    editor.graph = structuredClone(citizenshipExampleGraph);
    await settle();

    await startProving(editor);

    const live = nodeElement(editor, "medborgarskap").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const picker = live?.shadowRoot?.querySelector("chip-picker");
    const input = picker?.shadowRoot?.querySelector<HTMLInputElement>(
      "input[type='search']",
    );
    if (!input) throw new Error("sökfältet saknas");

    input.focus();
    input.value = "Ty";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await settle();

    const list = picker!.shadowRoot!.querySelector<HTMLElement>(
      ".chip-picker__list:not([hidden])",
    );
    if (!list) {
      const status = picker!.shadowRoot!.querySelector("[data-status]")?.textContent;
      const raw = picker!.shadowRoot!.querySelector(".chip-picker__list");
      throw new Error(
        `förslagslistan öppnades inte — värde "${input.value}", status "${status}", list hidden=${raw?.hasAttribute("hidden")}, barn=${raw?.childElementCount}`,
      );
    }
    const nav = live!.shadowRoot!.querySelector<HTMLElement>(
      ".guide-preview__navigation",
    );
    const card = live!.shadowRoot!.querySelector<HTMLElement>(
      ".guide-preview__card",
    );

    const listBox = list.getBoundingClientRect();
    expect(
      listBox.bottom,
      "listan ligger över knapparna",
    ).toBeLessThanOrEqual(nav!.getBoundingClientRect().top + 1);
    expect(
      listBox.bottom,
      "listan klipps av kortet",
    ).toBeLessThanOrEqual(card!.getBoundingClientRect().bottom + 1);
  });

  test("fliken visar samma steg som noden", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const live = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");

    field!.value = "30";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    [
      ...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ]
      .find((button) => button.dataset.action === "next")!
      .click();
    await settle();
    await settle();

    const panel = editor.shadowRoot?.querySelector(
      ".guide-editor__preview-panel guide-preview",
    ) as unknown as { getCurrentNodeId(): string | null };

    expect(panel.getCurrentNodeId()).toBe("question-gender");
  });

  test("en ändring lämnar bara raden kvar — arbetsytan är redigerbar igen", async () => {
    // Johans bild 2/9: efter "Guiden ändrad — börja om" låg linjerna kvar
    // dämpade och ögon och menyer var borta, fast man redigerar. Stale är
    // slutet på provet för allt utom raden.
    const editor = mount();
    await settle();

    await startProving(editor);

    const ne = canvas(editor);
    const panel = editor.shadowRoot!.querySelector("properties-panel");
    ne.selectNodeById("question-age");
    await settle();
    const input = panel?.shadowRoot?.querySelector<HTMLInputElement>("input[type=text], textarea");
    if (!input) throw new Error("inget titelfält i panelen");
    input.value += " x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    await settle();

    expect(bar(editor)?.hidden).toBe(false);
    expect(bar(editor)?.textContent).toContain("Guiden ändrad");
    expect(ne.hasAttribute("data-proving")).toBe(false);

    const nodes = [...ne.shadowRoot!.querySelectorAll<FlowNode>("flow-node")];
    expect(nodes.filter((n) => n.hasAttribute("data-proving")).length).toBe(0);
    expect(nodes.filter((n) => n.hasAttribute("data-visitor-view")).length).toBe(0);
    const dimmed = nodes.filter(
      (n) => Number(getComputedStyle(n.shadowRoot!.querySelector(".flow-node")!).opacity) < 0.9,
    );
    expect(dimmed.length).toBe(0);
    const lineOpacities = [
      ...new Set(
        [...ne.shadowRoot!.querySelectorAll(".node-editor__connection")].map(
          (l) => getComputedStyle(l).opacity,
        ),
      ),
    ];
    expect(lineOpacities).toEqual(["1"]);
    const eyes = nodes.filter((n) => {
      const toggle = n.shadowRoot!.querySelector<HTMLElement>("[data-visitor-toggle]");
      return toggle && !toggle.hidden;
    });
    expect(eyes.map((n) => n.nodeId)).toContain("question-age");
    expect(eyes.length).toBe(9);
    const menus = nodes.filter((n) => {
      const menu = n.shadowRoot!.querySelector<HTMLElement>("[data-node-menu]");
      return menu && getComputedStyle(menu).display !== "none";
    });
    expect(menus.length).toBe(nodes.length);
  });

  test("Avsluta efter en ändring lämnar alla ögon kvar", async () => {
    // Den nod som redigerades under provet ritades om utan öga (renderingen
    // utelämnar knappen medan provet är på) och fick det aldrig tillbaka.
    const editor = mount();
    await settle();

    await startProving(editor);

    const ne = canvas(editor);
    ne.selectNodeById("question-age");
    await settle();
    const input = editor.shadowRoot!
      .querySelector("properties-panel")
      ?.shadowRoot?.querySelector<HTMLInputElement>("input[type=text], textarea");
    if (!input) throw new Error("inget titelfält i panelen");
    input.value += " x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    editor.shadowRoot!
      .querySelector("node-editor")!
      .shadowRoot!.querySelector<HTMLButtonElement>("[data-proving-end]")!
      .click();
    await settle();

    const toggle = editor.shadowRoot!
      .querySelector("node-editor")!
      .shadowRoot!.querySelectorAll<FlowNode>("flow-node");
    const eyes = [...toggle].filter((n) => {
      const button = n.shadowRoot!.querySelector<HTMLElement>("[data-visitor-toggle]");
      return button && !button.hidden;
    });
    expect(eyes.map((n) => n.nodeId)).toContain("question-age");
    expect(eyes.length).toBe(9);
  });

  test("design D: steget på kanten, bollen i menyns plats, allt annat släckt", async () => {
    // Johan 1/9: "Tycker D, sedan släcker vi alla andra, tänder upp den valda
    // steg för steg — och där man varit." The header keeps the type's name;
    // the menu button is gone; the mark is a ball (dot here, tick where the
    // run has been); the edge carries "Steg N" where START usually sits.
    const editor = mount();
    await settle();

    await startProving(editor);

    const age = nodeElement(editor, "question-age");
    const inner = (node: FlowNode, selector: string) =>
      node.shadowRoot?.querySelector<HTMLElement>(selector) ?? null;

    expect(age.getAttribute("data-step")).toBe("1");
    expect(inner(age, "[data-step-flag]")?.hidden).toBe(false);
    expect(inner(age, "[data-step-flag]")?.textContent).toBe("Steg 1");
    expect(getComputedStyle(inner(age, ".flow-node__start-flag")!).display).toBe("none");
    expect(getComputedStyle(inner(age, ".flow-node__header-text")!).display).not.toBe("none");
    expect(getComputedStyle(inner(age, "[data-node-menu]")!).display).toBe("none");
    expect(inner(age, "[data-proving-mark]")?.getAttribute("aria-label")).toBe("Du är här");
    expect(inner(age, ".flow-node__proving-dot")).not.toBeNull();

    // Everything the run has not reached is dimmed; the lines too.
    const vision = nodeElement(editor, "question-vision");
    expect(Number(getComputedStyle(inner(vision, ".flow-node")!).opacity)).toBeLessThan(0.5);
    expect(Number(getComputedStyle(inner(age, ".flow-node")!).opacity)).toBe(1);

    const live = inner(age, "[data-visitor-preview]");
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (!field) throw new Error("inget fält i den levande vyn");
    field.value = "30";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    [...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .find((button) => button.dataset.action === "next")
      ?.click();
    await settle();
    await settle();

    expect(age.getAttribute("data-step")).toBe("1");
    expect(inner(age, "[data-proving-mark]")?.getAttribute("aria-label")).toBe("besvarad");
    expect(inner(age, "[data-proving-mark]")?.textContent).toBe("✓");
    expect(Number(getComputedStyle(inner(age, ".flow-node")!).opacity)).toBe(1);

    const gender = nodeElement(editor, "question-gender");
    expect(gender.getAttribute("data-step")).toBe("2");
    expect(inner(gender, "[data-step-flag]")?.textContent).toBe("Steg 2");
    expect(nodeElement(editor, "rule-age").hasAttribute("data-step")).toBe(false);

    const lines = [
      ...(canvas(editor).shadowRoot?.querySelectorAll<SVGElement>(".node-editor__connection") ?? []),
    ];
    const off = lines.filter((line) => !line.hasAttribute("data-trail"));
    expect(off.length).toBeGreaterThan(0);
    expect(Number(getComputedStyle(off[0]).opacity)).toBeLessThan(0.5);
  });

  test("den besvarade noden har svaret kvar i fältet", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const live = nodeElement(editor, "question-age").shadowRoot?.querySelector(
      "[data-visitor-preview]",
    );
    const field = live?.shadowRoot?.querySelector<HTMLInputElement>("input");

    field!.value = "30";
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    [
      ...(live?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? []),
    ]
      .find((button) => button.dataset.action === "next")!
      .click();
    await settle();
    await settle();

    const node = nodeElement(editor, "question-age");
    const answered = node.shadowRoot?.querySelector(
      "[data-visitor-preview]",
    ) as (Element & { refresh?: () => void }) | null;

    /*
     * The step has to have been left first, or this asserts nothing: the value
     * was typed straight into that field, so a Next that did nothing would
     * leave it there and the test would pass against a canvas where no run ever
     * moved.
     */
    expect(node.hasAttribute("data-answered")).toBe(true);

    // Drawn again, so the value can only come from the run's answers.
    answered?.refresh?.();
    await settle();

    expect(
      answered?.shadowRoot?.querySelector<HTMLInputElement>("input")?.value,
    ).toBe("30");
  });
});

/**
 * The trail: green where the run has been (story 065 point 5).
 *
 * Half the value sits in the rules. A rule is passed without stopping, so it is
 * never a step a visitor sees — but it is *why* they end up where they do, and
 * the run marks the rule and the exit that actually held. That is the answer to
 * "varför hamnade jag här?", which is the question this whole story exists for.
 *
 * The trail is never colour alone (KRAV): the line is also thicker, the
 * answered node carries its tick, and the current one its frame.
 */
function port(node: FlowNode, portId: string): HTMLElement {
  const element = node.shadowRoot?.querySelector<HTMLElement>(
    `[data-port-direction="output"][data-port-id="${portId}"]`,
  );

  if (!element) throw new Error(`ingen utgång ${portId}`);
  return element;
}

function liveStep(editor: GuideEditor, nodeId: string) {
  const preview = nodeElement(editor, nodeId).shadowRoot?.querySelector(
    "[data-visitor-preview]",
  );

  if (!preview?.shadowRoot) throw new Error(`ingen levande vy i ${nodeId}`);

  return {
    type(value: string) {
      const field = preview.shadowRoot!.querySelector<HTMLInputElement>("input");

      if (!field) throw new Error("inget fält");
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    },
    press(action: "next" | "previous") {
      const button = preview.shadowRoot!.querySelector<HTMLButtonElement>(
        `[data-action="${action}"]`,
      );

      if (!button) throw new Error(`ingen ${action}-knapp`);
      button.click();
    },
  };
}

function trailConnections(editor: GuideEditor): string[] {
  return [
    ...(canvas(editor).shadowRoot?.querySelectorAll<SVGPathElement>(
      ".node-editor__connection[data-trail]",
    ) ?? []),
  ]
    .map((path) => path.dataset.connectionId ?? "")
    .sort();
}

describe("spåret", () => {
  test("utanför provet finns inget spår", async () => {
    const editor = mount();
    await settle();

    expect(trailConnections(editor)).toEqual([]);
  });

  test("regeln och den utfallsport som slog in bär spåret", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const step = liveStep(editor, "question-age");

    step.type("30");
    step.press("next");
    await settle();
    await settle();

    const rule = nodeElement(editor, "rule-age");

    expect(trailConnections(editor)).toEqual(["adult-to-gender", "age-to-rule"]);
    expect(rule.hasAttribute("data-trail")).toBe(true);
    expect(port(rule, "adult").hasAttribute("data-trail")).toBe(true);
    expect(port(rule, "default").hasAttribute("data-trail")).toBe(false);
  });

  test("Föregående, nytt svar, Nästa tänder om spåret längs den nya vägen", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    liveStep(editor, "question-age").type("30");
    liveStep(editor, "question-age").press("next");
    await settle();
    await settle();

    liveStep(editor, "question-gender").press("previous");
    await settle();
    await settle();

    const again = liveStep(editor, "question-age");

    again.type("10");
    again.press("next");
    await settle();
    await settle();

    const rule = nodeElement(editor, "rule-age");

    expect(trailConnections(editor)).toEqual(["age-to-rule", "child-to-result"]);
    expect(port(rule, "adult").hasAttribute("data-trail")).toBe(false);
    expect(port(rule, "default").hasAttribute("data-trail")).toBe(true);
    expect(nodeElement(editor, "result-age").hasAttribute("data-current")).toBe(
      true,
    );
  });
});

/**
 * An edit ends the run (story 065 point 8).
 *
 * A trail is a statement about a graph, and once the graph has changed the
 * statement is about something that no longer exists. Recomputing it live would
 * mean deciding what an answer to a question somebody just deleted meant — so
 * the run is over instead, and says so. The line stays until it is started
 * again or ended, because a line that vanished would look like a bug.
 */
describe("en ändring avslutar provet", () => {
  test("en ändrad rubrik släcker spåret och raden säger till", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const step = liveStep(editor, "question-age");

    step.type("30");
    step.press("next");
    await settle();
    await settle();

    expect(trailConnections(editor).length).toBeGreaterThan(0);

    editor.shadowRoot?.querySelector("properties-panel")?.dispatchEvent(
      new CustomEvent("node-data-changed", {
        detail: { nodeId: "question-age", property: "title", value: "Ny rubrik" },
        bubbles: true,
        composed: true,
      }),
    );
    await settle();

    expect(trailConnections(editor)).toEqual([]);
    expect(bar(editor)?.textContent).toContain("Guiden ändrad");
    expect(
      nodeElement(editor, "question-gender").hasAttribute("data-current"),
    ).toBe(false);
  });

  test("en ångring når provet, fast den aldrig skickar graph-changed", async () => {
    const editor = mount();
    await settle();

    // An edit first, so there is something to undo — and a fresh run after it,
    // so the trail under test belongs to the guide the undo rolls back.
    editor.shadowRoot?.querySelector("properties-panel")?.dispatchEvent(
      new CustomEvent("node-data-changed", {
        detail: { nodeId: "question-age", property: "title", value: "Ny rubrik" },
        bubbles: true,
        composed: true,
      }),
    );
    await settle();

    await startProving(editor);

    const step = liveStep(editor, "question-age");

    step.type("30");
    step.press("next");
    await settle();
    await settle();

    expect(trailConnections(editor).length).toBeGreaterThan(0);

    /*
     * An undo dispatches its `graph-changed` on the host, not into the shadow
     * root, so `handleGraphChanged` never hears it — measured 2026-09-01. If
     * the run only listened there, this is the case that would slip through.
     */
    editor.undo();
    await settle();

    expect(trailConnections(editor)).toEqual([]);
    expect(bar(editor)?.textContent).toContain("Guiden ändrad");
  });

  test("Börja om startar ett nytt prov från start", async () => {
    const editor = mount();
    await settle();

    await startProving(editor);

    const step = liveStep(editor, "question-age");

    step.type("30");
    step.press("next");
    await settle();
    await settle();

    canvas(editor)
      .shadowRoot?.querySelector<HTMLButtonElement>("[data-proving-restart]")
      ?.click();
    await settle();
    await settle();

    expect(bar(editor)?.textContent).toContain("steg 1");
    expect(bar(editor)?.textContent).not.toContain(" av ");
    expect(trailConnections(editor)).toEqual([]);
    expect(nodeElement(editor, "question-age").hasAttribute("data-current")).toBe(
      true,
    );
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";
import "../publish-dialog/publish-dialog";

import { GuideHealthService } from "../../services/guide-health-service";

import type { GuideEditor } from "./guide-editor";
import type { PropertiesPanel } from "../properties-panel/properties-panel";
import type { PublishDialog } from "../publish-dialog/publish-dialog";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * *Gå till noden* tar en ända fram till fältet — och fäller upp **Avancerat**
 * när fältet ligger där.
 *
 * ## Varför mekanismen finns innan någon kod använder den
 *
 * Johans beslut 23/9 2026 gjorde folden stängd som standard, även när
 * variabeln används: automatisk öppning utifrån innehållet gör panelen mindre
 * förutsägbar. Undantaget han pekade ut är en **navigering**: *"Öppna gruppen
 * automatiskt när användaren navigerar till ett valideringsfel i ett dolt
 * fält, och fokusera då rätt fält."*
 *
 * Alla 34 hälsokoderna lästes 23/9: **ingen** pekade då på `variableName`,
 * `variableLabel` eller `cssClasses`. Så vägen byggdes först och provades med
 * en **syntetisk** hälsoflagga som bär ett `field` (första blocket nedan).
 * Den första riktiga koden kom 24/9: `variable-name-clash`, som provas i det
 * sista blocket med den riktiga analysen, från hälsolistan och från
 * publiceringsdialogens varningsrad.
 *
 * ## Vad som drivs
 *
 * Båda ändarna: `revealNode` direkt (den delade implementationen som både
 * hälsoremsan och publiceringsdialogens *Gå till frågan* går igenom) och ett
 * riktigt klick på hälsoremsans knapp, så att `data-health-field` verkligen
 * följer med hela vägen.
 */

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

function graph(): GraphData {
  return {
    startNodeId: "q1",
    nodes: [
      {
        id: "q1",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [
            { id: "ja", label: { sv: "Ja" }, value: "ja" },
            { id: "nej", label: { sv: "Nej" }, value: "nej" },
          ],
        },
      },
      { id: "r1", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Ja" } } },
      { id: "r2", type: "result", position: { x: 400, y: 200 }, data: { title: { sv: "Nej" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "r1", portId: "input" } },
      { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
    ],
  } as unknown as GraphData;
}

/** En hälsoflagga som namnger ett fält — det ingen riktig kod gör ännu. */
function syntheticIssue(field: string) {
  return [
    {
      code: "dead-option" as const,
      severity: "error" as const,
      nodeId: "q1",
      field,
      message: `Syntetiskt fel i ${field}`,
    },
  ];
}

async function editorWith(field: string): Promise<GuideEditor> {
  vi.spyOn(GuideHealthService, "analyze").mockReturnValue(syntheticIssue(field));

  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = graph();
  await settle();
  await settle();

  return editor;
}

const panelOf = (editor: GuideEditor): PropertiesPanel =>
  editor.shadowRoot!.querySelector<PropertiesPanel>("properties-panel")!;

const foldOf = (editor: GuideEditor): HTMLDetailsElement | null =>
  panelOf(editor).shadowRoot!.querySelector<HTMLDetailsElement>(
    'details[data-property-section="advanced"]',
  );

const focused = (editor: GuideEditor): string | undefined =>
  (panelOf(editor).shadowRoot!.activeElement as HTMLElement | null)?.dataset
    ?.property;

describe("navigering till ett fel i ett fält", () => {
  test("ett fel i variableName fäller upp Avancerat och sätter markören i fältet", async () => {
    const editor = await editorWith("variableName");

    // Folden finns först när en nod är vald, så noden väljs utan fält först:
    // då säger provet något om just den här noden, inte om en tom panel.
    editor.revealNode("q1");
    await settle();

    expect(foldOf(editor)?.open, "folden ska vara stängd innan resan").toBe(false);

    editor.revealNode("q1", "variableName");
    await settle();

    expect(foldOf(editor)?.open, "folden ska ha fällts upp").toBe(true);
    expect(focused(editor), "markören ska stå i fältet").toBe("variableName");
  });

  test("ett fel i Rubrik lämnar folden som den var", async () => {
    const editor = await editorWith("title");

    editor.revealNode("q1", "title");
    await settle();

    expect(foldOf(editor)?.open, "folden ska stå kvar stängd").toBe(false);
    expect(focused(editor), "markören ska stå i rubriken").toBe("title");
  });

  test("hälsoremsans knapp bär fältet och tar en hela vägen dit", async () => {
    const editor = await editorWith("variableName");
    const button = editor.shadowRoot!.querySelector<HTMLButtonElement>(
      "[data-health-node]",
    )!;

    expect(button.dataset.healthField, "fältet ska följa med till knappen").toBe(
      "variableName",
    );

    button.click();
    await settle();

    expect(foldOf(editor)?.open).toBe(true);
    expect(focused(editor)).toBe("variableName");
  });

  test("en flagga utan fält bär inget attribut och rör inte folden", async () => {
    vi.spyOn(GuideHealthService, "analyze").mockReturnValue([
      {
        code: "dead-option" as const,
        severity: "error" as const,
        nodeId: "q1",
        message: "Ett alternativ leder ingenstans",
      },
    ]);

    const editor = document.createElement("guide-editor") as GuideEditor;

    editor.setAttribute("mode", "administrator");
    editor.setAttribute("feature-level", "advanced");
    editor.style.cssText = "display: block; width: 1200px; height: 700px;";
    document.body.append(editor);
    editor.graph = graph();
    await settle();
    await settle();

    const button = editor.shadowRoot!.querySelector<HTMLButtonElement>(
      "[data-health-node]",
    )!;

    expect(button.dataset.healthField).toBeUndefined();

    button.click();
    await settle();

    expect(foldOf(editor)?.open).toBe(false);
  });
});

/*
 * Den första riktiga koden som namnger ett fält (24/9): två frågor på samma
 * väg sparar båda som "barn". Ingen attrapp av analysen här — flaggan ska
 * komma ur `GuideHealthService` själv, annars prövar provet en flagga som
 * ingen kod sätter.
 */
function clashGraph(): GraphData {
  const base = graph();
  const question = (id: string, title: string, x: number) => ({
    id,
    type: "number-question",
    position: { x, y: 0 },
    data: { title: { sv: title }, variableName: "barn" },
  });
  base.nodes.push(
    question("a", "Har du barn?", 400) as never,
    question("b", "Hur många barn har du?", 800) as never,
  );
  const r1 = base.nodes.find((node) => node.id === "r1")!;
  r1.position = { x: 1200, y: 0 };
  base.connections = [
    { id: "c1", from: { nodeId: "q1", portId: "ja" }, to: { nodeId: "a", portId: "input" } },
    { id: "c2", from: { nodeId: "q1", portId: "nej" }, to: { nodeId: "r2", portId: "input" } },
    { id: "c3", from: { nodeId: "a", portId: "continue" }, to: { nodeId: "b", portId: "input" } },
    { id: "c4", from: { nodeId: "b", portId: "continue" }, to: { nodeId: "r1", portId: "input" } },
  ];
  return base;
}

async function clashEditor(): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);
  editor.graph = clashGraph();
  await settle();
  await settle();

  return editor;
}

/** `document.activeElement`, followed down through every shadow root. */
function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** Which node the panel shows, read from its title field — not its state. */
const shownTitle = (editor: GuideEditor): string =>
  panelOf(editor).shadowRoot!.querySelector<HTMLInputElement>('[data-property="title"]')?.value ?? "";

function expectAtTheField(editor: GuideEditor): void {
  const active = deepActive() as HTMLElement | null;

  expect(shownTitle(editor), "panelen ska visa den senare frågan").toBe("Hur många barn har du?");
  expect(foldOf(editor)?.open, "Avancerat ska vara uppfällt").toBe(true);
  expect(active?.getAttribute("data-property"), "fokus ska stå i Spara svaret som").toBe("variableName");
  expect(active!.getRootNode(), "fältet ska vara panelens").toBe(panelOf(editor).shadowRoot);
  expect(active!.matches(":focus-visible"), "ringen ska synas").toBe(true);
}

describe("en krock i variabelnamn leder till fältet (24/9)", () => {
  // 8
  test("från hälsolistan: ett problem, och trycket landar i Spara svaret som", async () => {
    const editor = await clashEditor();
    const root = editor.shadowRoot!;

    expect(root.querySelector("[data-health-count]")!.textContent?.trim()).toBe("1 varning");

    const row = root.querySelector<HTMLButtonElement>('[data-health-node="b"]');
    expect(row, "raden ska peka på den senare frågan").not.toBeNull();
    expect(root.querySelectorAll("[data-health-node]")).toHaveLength(1);

    row!.click();
    await settle();

    expectAtTheField(editor);
  });

  // 8, från publiceringsdialogen (Johan 24/9: varningen stoppar inte, men raden leder dit)
  test("från publiceringsdialogens varningsrad: samma väg ända in i fältet", async () => {
    const editor = await clashEditor();
    const dialog = document.createElement("publish-dialog") as PublishDialog;

    dialog.editorLocale = "sv";
    document.body.append(dialog);
    // The host's wiring, as in src/host/guide-storage.ts: the intent goes to revealNode.
    dialog.addEventListener("publish-goto-intent", (event) => {
      const detail = (event as CustomEvent<{ nodeId: string; field?: string }>).detail;
      editor.revealNode(detail.nodeId, detail.field);
    });
    void dialog.ask({
      version: 2,
      previous: 1,
      changes: [],
      outline: false,
      issues: GuideHealthService.analyze(editor.graph),
    });
    await settle();

    const warnings = dialog.shadowRoot!.querySelector<HTMLElement>("[data-warnings]")!;
    expect(warnings.hidden, "varningsraden ska synas").toBe(false);
    expect(
      dialog.shadowRoot!.querySelector('[data-action="confirm"]')!.getAttribute("aria-disabled"),
      "en varning stoppar inte publiceringen",
    ).toBe("false");

    const go = warnings.querySelector<HTMLButtonElement>('[data-goto="b"]');
    expect(go, "varningsraden ska ha en väg till frågan").not.toBeNull();

    go!.click();
    await settle();

    expect(dialog.shadowRoot!.querySelector("dialog")!.open, "dialogen stängde").toBe(false);
    expectAtTheField(editor);
  });

  // 9
  test("med Avancerat redan öppet: fokus i fältet, gruppen inte hoptryckt", async () => {
    const editor = await clashEditor();

    editor.revealNode("b");
    await settle();
    const fold = foldOf(editor)!;
    fold.querySelector<HTMLElement>("summary")!.click();
    await settle();
    expect(foldOf(editor)!.open, "Avancerat ska vara öppet före trycket").toBe(true);

    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-health-node="b"]')!.click();
    await settle();

    expectAtTheField(editor);
  });
});

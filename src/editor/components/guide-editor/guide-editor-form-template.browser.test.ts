// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { withPro } from "../../../testing/optional-pro";
const PRO = await withPro("index.ts");
import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { GuideHealthService } from "../../services/guide-health-service";

import type { GuideEditor } from "./guide-editor";
import type { NodeEditor } from "../node-editor/node-editor";

/**
 * Story 052 — the form recipe, made visible.
 *
 * The shape a form takes — **a page with fields → review → submission** — is
 * invisible today. Somebody who already knows builds it correctly in a minute;
 * somebody who does not builds a page straight into a submission and finds out
 * in the test run. The nodes, the contract and the catalogue exist; the recipe
 * lives in the head of whoever built them.
 *
 * ## What this measures, and what it deliberately does not
 *
 * Four of the story's five criteria are editor behaviour and are asserted here.
 * The fifth — that it works in the SiteVision dialog without adaptation — is a
 * claim about *where the template lives* (the library, not the example site)
 * plus a question of where a hand reaches for it. The first half is structural;
 * the second is settled by opening the dialog, which is Johan's on Tuesday.
 *
 * So the grip sits behind one call site: moving it from the File menu to the
 * palette afterwards is two lines, not a rewrite.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function editorWith(graph: unknown): Promise<GuideEditor> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = graph as never;

  await settle();
  await settle();

  return editor;
}

const emptyGuide = { startNodeId: null, nodes: [], connections: [] };

const oneQuestion = {
  startNodeId: "q",
  nodes: [
    {
      id: "q",
      type: "text-question",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    },
  ],
  connections: [],
};

/** The File menu's item, which is where the sketch put it. */
const newFormItem = (editor: GuideEditor): HTMLButtonElement | null =>
  editor.shadowRoot
    ?.querySelector("editor-toolbar")
    ?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="new-form"]') ?? null;

const createForm = async (editor: GuideEditor): Promise<void> => {
  const item = newFormItem(editor);

  if (!item) throw new Error("Menyvalet 'Snabbstart: formulär' finns inte.");

  item.click();
  await settle();
  await settle();
};

describe("the grip", () => {
  test("is in the File menu, where the sketch put it", async () => {
    expect(newFormItem(await editorWith(emptyGuide))).not.toBeNull();
  });

  test("and says what it makes, not what it is", async () => {
    /*
     * Johan's word, and the better one: it names what the grip *does*. Not
     * "Formulärmall" — that names our machinery, and the menu is read by
     * somebody who has never heard the word template. It would also stop being
     * true three seconds later, since nothing about the result is a template.
     *
     * The trailing noun stays: somebody hunting for how to start a form scans
     * for "formulär", not for "snabbstart".
     */
    expect(newFormItem(await editorWith(emptyGuide))?.textContent?.trim()).toBe(
      "Snabbstart: formulär",
    );
  });
});

describe("where the grip is NOT offered", () => {
  test("an editor without pages does not show it", async () => {
    /*
     * Hittat när inlämningsfilmen skulle spelas in: exempelsidan kör bara
     * modulen *inmatning*, för modulerna bockas i efter vad exemplets graf
     * använder — och den har inga sidor. Arkiv-menyn erbjöd ändå snabbstarten,
     * som skapar en sidnod, varpå editorn flaggade sin egen produkt:
     * "Nodtypen Sida ingår inte i den valda funktionsnivån."
     *
     * Ett grepp som skapar något editorn inte kan visa ska inte finnas i
     * menyn. Alternativet — att bygga en stomme utan sida — vore inte
     * formulärets recept längre, och story 052 handlar om just receptet.
     */
    const editor = await editorWith(emptyGuide);

    editor.setAttribute("feature-level", "basic");
    await settle();

    expect(newFormItem(editor)?.hidden ?? true).toBe(true);
  });
});

describe("what one grip creates", () => {
  test.runIf(PRO)("a page, a review step and a submission — wired in that order", async () => {
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const graph = editor.getData();
    const types = graph.nodes.map((node) => node.type);

    expect(types).toContain("page");
    expect(types).toContain("review");
    expect(types).toContain("submit-result");

    // Two pages since 2/9 (formulärspårets steg 1): Om dig, sedan ärendet.
    const pages = graph.nodes.filter((node) => node.type === "page");
    const review = graph.nodes.find((node) => node.type === "review")!;
    const submit = graph.nodes.find((node) => node.type === "submit-result")!;

    expect(pages).toHaveLength(2);

    const goesTo = (from: string, to: string): boolean =>
      graph.connections.some((line) => line.from.nodeId === from && line.to.nodeId === to);

    expect(goesTo(pages[0]!.id, pages[1]!.id), "Om dig → ärendet").toBe(true);
    expect(goesTo(pages[1]!.id, review.id), "ärendet → granska").toBe(true);
    expect(goesTo(review.id, submit.id), "granska → inlämning").toBe(true);
  });

  test("with a field on the page, so the page is not empty", async () => {
    /*
     * An empty page is one of the health service's own findings, and a template
     * that creates a problem on arrival teaches the wrong lesson.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const graph = editor.getData();
    const page = graph.nodes.find((node) => node.type === "page")!;

    expect(graph.nodes.some((node) => node.parentPageId === page.id)).toBe(true);
  });

  test("and the guide starts at the page when there was nothing before", async () => {
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const graph = editor.getData();

    expect(graph.startNodeId).toBe(graph.nodes.find((node) => node.type === "page")!.id);
  });
});

describe("what it does not do", () => {
  test.runIf(PRO)("no recipient comes with the template", async () => {
    /*
     * The story's sharpest line: a template with a recipient already chosen is
     * an errand that goes to the wrong place out of convenience. The recipient
     * is the host's catalogue and the editor's deliberate choice.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const submit = editor.getData().nodes.find((node) => node.type === "submit-result")!;

    expect(submit.data.recipientId ?? "").toBe("");
  });

  test("and it does not touch the start node of a guide that already has one", async () => {
    // Inserting must not quietly re-route a guide somebody is in the middle of.
    const editor = await editorWith(oneQuestion);

    await createForm(editor);

    expect(editor.getData().startNodeId).toBe("q");
  });

  test("and it leaves what was already there alone", async () => {
    const editor = await editorWith(oneQuestion);

    await createForm(editor);

    expect(editor.getData().nodes.some((node) => node.id === "q")).toBe(true);
  });
});

describe("what the health check says about a fresh skeleton", () => {
  test.runIf(PRO)("exactly one thing, and it is the next thing to do", async () => {
    /*
     * Silent except "no recipient chosen" — which is not noise but the first
     * action, pointed at. Anything else in that list would be the template
     * handing the editor a fault to clean up.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const problems = GuideHealthService.analyze(editor.getData());

    expect(problems.map((problem) => problem.code)).toEqual(["no-recipient-chosen"]);
  });
});

describe("the view, after the quick start", () => {
  test("the page it selects is on screen, whole", async () => {
    /*
     * Measured 3/9 (LOGG "Ny redaktör i editorn"): the skeleton landed and the
     * first page was selected, but the view stayed where it was — the panel
     * said "Sida · Om dig" while the card on screen was "Om ditt ärende", and
     * the selected one stood half behind the palette.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);
    await settle();

    const nodeEditor = editor.shadowRoot!.querySelector("node-editor")!;
    const viewport = nodeEditor.shadowRoot!.querySelector(".node-editor__viewport")!.getBoundingClientRect();
    const selected = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement & { selected: boolean }>("flow-node")]
      .find((node) => node.selected)
      ?.getBoundingClientRect();

    expect(selected, "en markerad nod").toBeDefined();
    expect(selected!.left, "vänsterkanten inom vyn").toBeGreaterThanOrEqual(viewport.left);
    expect(selected!.right, "högerkanten inom vyn").toBeLessThanOrEqual(viewport.right);
    expect(selected!.top).toBeGreaterThanOrEqual(viewport.top);
    expect(selected!.bottom).toBeLessThanOrEqual(viewport.bottom);
  });

  test("and readable: the zoom has a floor, the selected page still whole", async () => {
    /*
     * The skeleton is ~1 900 px wide, so fitting all of it lands the zoom
     * around 55 % and the cards go small (3/9). Johan: a floor. Below it the
     * view zooms to the floor and centres on the selected page instead — the
     * rest of the skeleton is partly off screen, which is what "Passa in" is
     * for.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);
    await settle();

    const nodeEditor = editor.shadowRoot!.querySelector<NodeEditor>("node-editor")!;
    const viewport = nodeEditor.shadowRoot!.querySelector(".node-editor__viewport")!.getBoundingClientRect();
    const selected = [...nodeEditor.shadowRoot!.querySelectorAll<HTMLElement & { selected: boolean }>("flow-node")]
      .find((node) => node.selected)!
      .getBoundingClientRect();

    expect(nodeEditor.getZoom()).toBeGreaterThanOrEqual(0.75);
    expect(selected.left).toBeGreaterThanOrEqual(viewport.left);
    expect(selected.right).toBeLessThanOrEqual(viewport.right);
    expect(selected.top).toBeGreaterThanOrEqual(viewport.top);
    expect(selected.bottom).toBeLessThanOrEqual(viewport.bottom);
  });
});

describe("undo, after the quick start", () => {
  test("takes the whole skeleton in one step", async () => {
    /*
     * Johan's rule, and the reason it has its own undo reason rather than
     * counting as four node creations: undoing a recipe one node at a time
     * leaves somebody pressing Ctrl+Z and wondering how many more there are.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);
    // Åtta noder sedan 2/9: två sidor, fyra fält, granska, inlämning.
    expect(editor.getData().nodes).toHaveLength(8);

    editor.undo();
    await settle();

    expect(editor.getData().nodes).toHaveLength(0);
  });

  test("and every change made afterwards is its own step", async () => {
    /*
     * The other half of the same sentence: the skeleton is one moment, and
     * what you do next is ordinary editing. One undo returns the edit and
     * leaves the four nodes standing — because they are nodes, not a template
     * being replayed.
     */
    const editor = await editorWith(emptyGuide);

    await createForm(editor);

    const page = editor.getData().nodes.find((node) => node.type === "page")!;

    // Genom canvasen, som en redigering i panelen gör — det är den vägen som
    // spelar in ett ångra-steg.
    editor.shadowRoot!
      .querySelector<HTMLElement & {
        updateNodeData(id: string, property: string, value: unknown): void;
      }>("node-editor")!
      .updateNodeData(page.id, "title", { sv: "Anmäl ett fel", en: "Report a fault" });
    await settle();

    expect(
      (editor.getData().nodes.find((node) => node.id === page.id)!.data.title as { sv: string })
        .sv,
    ).toBe("Anmäl ett fel");

    editor.undo();
    await settle();

    const after = editor.getData();

    expect(after.nodes, "stommen står kvar").toHaveLength(8);
    expect((after.nodes.find((node) => node.id === page.id)!.data.title as { sv: string }).sv).toBe(
      "Om dig",
    );
  });
});

describe("what the host is told", () => {
  test("the change is announced as its own kind, not as an import", async () => {
    /*
     * Written after a mutation found nothing: swapping the reason changed no
     * behaviour, which meant the reason was decorative and my claim about why
     * undo is whole was wrong. Undo is one step because the skeleton is applied
     * in one `replaceGraph`.
     *
     * The reason still matters, to somebody else: a host's autosave or version
     * list is told what kind of change arrived, and "a form was started" is not
     * "a guide was imported". This is what keeps that true.
     */
    const editor = await editorWith(emptyGuide);
    const reasons: string[] = [];

    editor.addEventListener("graph-changed", (event) => {
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason);
    });

    await createForm(editor);

    expect(reasons).toContain("form-skeleton-added");
  });
});

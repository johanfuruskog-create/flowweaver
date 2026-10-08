import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import { templateFileJson } from "../../core/template-file";

import type { ConfirmationDialog } from "../confirmation-dialog/confirmation-dialog";
import type { EditorToolbar } from "../editor-toolbar/editor-toolbar";
import type { GuideEditor } from "./guide-editor";
import type { GraphData, NodeTemplate } from "../../../viewer/types/graph";

/**
 * Importing must never take the guide by surprise.
 *
 * ## The fault this is written from
 *
 * Johan, asked to try the flow: *"är inte redaktören rädd att skriva över
 * guiden? Jag skulle vilja vara försiktig med det. Det skapar onödig oro."*
 *
 * He was right, and measured it was worse than wariness deserved. Choosing a
 * file replaced the guide outright — no question anywhere, and the only
 * destructive action in the editor without one. Everything else that removes
 * something asks first.
 *
 * And it had just got worse by my hand: one menu item had become two very
 * different outcomes depending on the file's shape. A template adds a palette
 * entry and leaves the guide alone; a guide erases everything. One word, two
 * opposite results, discovered after choosing the file.
 *
 * ## What is worth testing hardest
 *
 * That the guide survives. Every other assertion here is about wording; this one
 * is about somebody's afternoon.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const GUIDE: GraphData = {
  startNodeId: "mine",
  nodes: [
    { id: "mine", type: "question", position: { x: 0, y: 0 }, data: { title: "Min egen fråga", options: [] } },
  ],
  connections: [],
} as never;

/*
 * A guide the importer actually accepts. The first version gave its question no
 * options, which `importGraphJson` refuses — so the import never reached the
 * confirmation, the guide survived for the wrong reason, and both safeguards
 * could be deleted with every assertion here still green.
 */
const OTHER: GraphData = {
  startNodeId: "theirs",
  nodes: [
    {
      id: "theirs",
      type: "question",
      position: { x: 0, y: 0 },
      data: {
        title: "Deras fråga",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ],
      },
    },
  ],
  connections: [],
} as never;

const TEMPLATE: NodeTemplate = {
  type: "nodmall-ssn",
  label: "Social security number",
  base: "text-question",
  values: { mask: "###-##-####" },
};

async function editorWithAGuide(): Promise<{ editor: GuideEditor; toolbar: EditorToolbar }> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.style.cssText = "display: block; width: 1200px; height: 800px;";
  document.body.append(editor);
  editor.graph = GUIDE;

  await settle();
  await settle();

  const toolbar = editor.shadowRoot!.querySelector<EditorToolbar>("editor-toolbar")!;

  return { editor, toolbar };
}

const fileInputOf = (toolbar: EditorToolbar): HTMLInputElement =>
  toolbar.shadowRoot!.querySelector<HTMLInputElement>("[data-import-file]")!;

const menuItem = (toolbar: EditorToolbar, action: string): HTMLButtonElement =>
  toolbar.shadowRoot!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

describe("att importera en guide", () => {
  test("rör ingenting förrän frågan är besvarad", async () => {
    const { editor, toolbar } = await editorWithAGuide();

    await userEvent.upload(
      fileInputOf(toolbar),
      new File([JSON.stringify(OTHER)], "deras.json", { type: "application/json" }),
    );

    // The dialog is open and the guide is exactly as it was.
    expect(editor.getData().startNodeId).toBe("mine");
  });

  test("och avbryter man är guiden kvar", async () => {
    /*
     * The assertion that matters. A confirmation that cannot be declined is a
     * delay, not a safeguard.
     */
    const { editor, toolbar } = await editorWithAGuide();

    await userEvent.upload(
      fileInputOf(toolbar),
      new File([JSON.stringify(OTHER)], "deras.json", { type: "application/json" }),
    );

    const dialog = editor.shadowRoot!.querySelector<ConfirmationDialog>("confirmation-dialog")!;
    const cancel = await vi.waitUntil(() =>
      dialog.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="cancel"]'),
    );

    await userEvent.click(cancel!);
    await settle();

    expect(editor.getData().startNodeId).toBe("mine");
    // The title however it is packaged: the point is that the guide survived,
    // not which shape its text is in.
    expect(JSON.stringify(editor.getData().nodes[0]!.data.title)).toContain("Min egen fråga");
  });
});

describe("att importera en mall", () => {
  test("lämnar guiden orörd och frågar ingenting", async () => {
    /*
     * Nothing is at risk on this path, so nothing is asked. A dialog here would
     * teach people to click through dialogs, which is how the one that matters
     * stops working.
     */
    const { editor, toolbar } = await editorWithAGuide();

    menuItem(toolbar, "import-template").click();
    await userEvent.upload(
      fileInputOf(toolbar),
      new File([templateFileJson(TEMPLATE)], "ssn.mall.json", { type: "application/json" }),
    );
    await settle();

    expect(editor.getData().startNodeId).toBe("mine");
    expect(editor.getData().nodes).toHaveLength(1);
  });
});

/*
 * Berättelse 123, kriterium 2: en mall är inte en tjänst.
 *
 * Mallfilens format har ingen plats för en guides identitet — den bär ett
 * nodmall och inget annat — men "har ingen plats" är ett påstående om koden,
 * och det här är mätningen av det. En fil som ändå bär ett id ska inte kunna
 * ge guiden det: två redaktörer som bygger var sin guide ur samma mall bygger
 * två tjänster, och två tjänster med samma id är oskiljbara i registret.
 */
describe("en mall och en identitet", () => {
  test("en mallfil kan inte ge guiden ett id", async () => {
    const { editor, toolbar } = await editorWithAGuide();
    const smuggled = JSON.parse(templateFileJson(TEMPLATE)) as Record<string, unknown>;

    smuggled.meta = { id: "mallens-id" };

    menuItem(toolbar, "import-template").click();
    await userEvent.upload(
      fileInputOf(toolbar),
      new File([JSON.stringify(smuggled)], "ssn.mall.json", { type: "application/json" }),
    );
    await settle();

    expect(editor.getData().meta?.id, "guiden behåller sin egen identitet").toBeUndefined();
  });
});

describe("när filen inte är den man bad om", () => {
  test("en guide under Importera mall ersätter ingenting", async () => {
    /*
     * The one direction where guessing wrong destroys something. Everywhere else
     * the shape decides and the wording explains; here somebody expecting a
     * palette entry does not expect their guide to be replaced, so it is refused
     * outright.
     */
    const { editor, toolbar } = await editorWithAGuide();

    menuItem(toolbar, "import-template").click();
    await userEvent.upload(
      fileInputOf(toolbar),
      new File([JSON.stringify(OTHER)], "deras.json", { type: "application/json" }),
    );
    await settle();
    await settle();

    expect(editor.getData().startNodeId).toBe("mine");

    /*
     * And no question was asked, which is the assertion that holds this up.
     *
     * Checking only that the guide survived cannot fail: without the refusal the
     * file reaches the confirmation instead, and a test that never answers it
     * sees the guide standing either way. Being *asked* whether to replace your
     * guide is itself the surprise this exists to prevent — somebody who chose
     * "Importera mall" is not deciding about their guide at all.
     */
    /*
     * The dialog's own open state, not the presence of its buttons — those are
     * in the DOM whether or not it is showing, so asserting on them passes
     * always and fails always.
     */
    const dialog = editor
      .shadowRoot!.querySelector<ConfirmationDialog>("confirmation-dialog")!
      .shadowRoot!.querySelector("dialog")!;

    expect(dialog.open, "frågan om att ersätta guiden ställdes ändå").toBe(false);
  });
});

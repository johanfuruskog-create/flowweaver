import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "../guide-editor/guide-editor";

import {
  registerCodeList,
  unregisterCodeList,
} from "../../../viewer/code-lists/code-list-registry";

import type { GuideEditor } from "../guide-editor/guide-editor";
import type { GraphData } from "../../../viewer/types/graph";
import type { CodeList } from "../../../viewer/code-lists/code-list-registry";

/**
 * The editor offers the code lists that are loaded, and only those.
 *
 * ## Why this is not a fixed list in the node type
 *
 * Nothing is registered by default — a bundled list would cost every resident
 * the download whether or not their guide asks about countries — so a host adds
 * the ones they use. A fixed list of choices written beside the node type would
 * then offer lists that are not there, and a field pointed at one of those finds
 * nothing while looking perfectly configured.
 *
 * That is not hypothetical. The palette did exactly this in 0.7.3: it offered
 * templates built on node types the current level did not have, three buttons
 * that added nothing when pressed, without error and without a word.
 *
 * ## What is asserted
 *
 * That registering a list makes it appear and unregistering makes it go — the
 * behaviour, rather than the presence of a function call. A mutation that
 * replaced the registry lookup with an empty list passed every other test in the
 * suite, which is why this file exists.
 */

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );

const guide = (): GraphData =>
  ({
    startNodeId: "sok",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "sok",
        type: "autocomplete-question",
        position: { x: 60, y: 60 },
        data: { title: { sv: "Vilket land?" }, source: "codelist" },
      },
    ],
    connections: [],
  }) as unknown as GraphData;

const prov = (id: string, label: string): CodeList => ({
  id,
  standard: "custom",
  label: { sv: label },
  version: "1",
  published: "2026-08-15",
  source: "Testet självt",
  items: [{ value: "X", label: { sv: "Något" } }],
});

async function mountAndSelect(): Promise<HTMLSelectElement | null> {
  const editor = document.createElement("guide-editor") as GuideEditor;

  editor.setAttribute("mode", "administrator");
  editor.setAttribute("feature-level", "advanced");
  editor.style.cssText = "display: block; width: 1200px; height: 700px;";
  document.body.append(editor);

  editor.graph = guide();
  await settle();
  await settle();

  const canvas = editor.shadowRoot?.querySelector("node-editor")?.shadowRoot;
  const node = canvas?.querySelector("flow-node")?.shadowRoot?.querySelector<HTMLElement>(
    ".flow-node",
  );

  node?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
  node?.click();
  await settle();
  await settle();

  return (
    editor.shadowRoot
      ?.querySelector("properties-panel")
      ?.shadowRoot?.querySelector<HTMLSelectElement>('[data-property="codeListId"]') ?? null
  );
}

const labels = (select: HTMLSelectElement | null): string[] =>
  [...(select?.options ?? [])].map((option) => option.textContent?.trim() ?? "");

afterEach(() => {
  document.body.replaceChildren();
  unregisterCodeList("prov-ett");
  unregisterCodeList("prov-tva");
});

describe("the code list a lookup question can point at", () => {
  test("offers every list that is registered", async () => {
    registerCodeList(prov("prov-ett", "Första provlistan"));
    registerCodeList(prov("prov-tva", "Andra provlistan"));

    const found = labels(await mountAndSelect());

    expect(found.join(" | ")).toContain("Första provlistan");
    expect(found.join(" | ")).toContain("Andra provlistan");
  });

  test("offers nothing but the empty choice when none is registered", async () => {
    // The default state of the product: a host that has added no list sees no
    // list, rather than a name that resolves to nothing.
    const found = labels(await mountAndSelect());

    expect(found).toEqual(["—"]);
  });

  test("stops offering a list that has been taken away", async () => {
    registerCodeList(prov("prov-ett", "Första provlistan"));
    unregisterCodeList("prov-ett");

    const found = labels(await mountAndSelect());

    expect(found.join(" | ")).not.toContain("Första provlistan");
  });

  test("says which standard each list uses", async () => {
    /*
     * Two lists can name the same places and disagree entirely about what to
     * store — `SE`, `SWE`, `752`. Choosing between them without being told which
     * is which is choosing blind.
     */
    registerCodeList(prov("prov-ett", "Första provlistan"));

    const found = labels(await mountAndSelect());

    expect(found.join(" | ")).toContain("custom");
  });
});

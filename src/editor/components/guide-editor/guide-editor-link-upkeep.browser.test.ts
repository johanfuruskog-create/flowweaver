import { afterEach, expect, test, vi } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./guide-editor";

import {
  registerLinkPicker,
  unregisterLinkPicker,
} from "../../core/link-picker-registry";
import type { GuideEditor } from "./guide-editor";
import type { GraphData } from "../../../viewer/types/graph";

/**
 * Story 100, criterion 1c: when a guide is opened in the editor, every link
 * with the host's reference is asked about. A moved page gets its address
 * rewritten — as a change, so the host hears `graph-changed` and the guide
 * is unsaved — and a page that is gone is a warning on the node. Without a
 * host that answers, the text is left exactly as it came.
 */

afterEach(() => {
  unregisterLinkPicker();
  document.body.replaceChildren();
});

const text = (moved: string, gone: string): string =>
  `Se [Flyttad](${moved} "sv:flyttad") och [Borta](${gone} "sv:borta") och [Kvar](/kvar.html "sv:kvar").`;

function graf(): GraphData {
  return {
    startNodeId: "r",
    nodes: [
      {
        id: "r",
        type: "result",
        position: { x: 0, y: 0 },
        data: { title: "Svar", description: text("/gammal.html", "/borta.html") },
      },
    ],
    connections: [],
  };
}

function montera(data: GraphData): GuideEditor {
  const editor = document.createElement("guide-editor") as GuideEditor;
  editor.setAttribute("mode", "administrator");
  document.body.append(editor);
  editor.graph = data;
  return editor;
}

const description = (editor: GuideEditor): string =>
  editor.graph.nodes[0]!.data.description as string;

test("en flyttad sida skrivs om, en borttagen blir en varning", async () => {
  registerLinkPicker({
    pick: async () => null,
    resolve: async (ref) =>
      ref === "sv:flyttad" ? { url: "/ny.html" } : ref === "sv:borta" ? null : { url: "/kvar.html" },
  });
  const editor = montera(graf());
  const changed = vi.fn();
  editor.addEventListener("graph-changed", changed);

  await vi.waitFor(() => expect(description(editor)).toBe(text("/ny.html", "/borta.html")));

  expect(changed).toHaveBeenCalledTimes(1);
  const count = editor.shadowRoot!.querySelector("[data-health-count]")!.textContent;
  expect(count).toContain("1 varning");
  expect(editor.shadowRoot!.querySelector("[data-health-list]")!.textContent).toContain(
    "sidan länken pekar på finns inte längre",
  );
});

test("utan väljare lämnas texten som den kom", async () => {
  const editor = montera(graf());
  const changed = vi.fn();
  editor.addEventListener("graph-changed", changed);

  await new Promise((resolve) => setTimeout(resolve, 60));

  expect(description(editor)).toBe(text("/gammal.html", "/borta.html"));
  expect(changed).not.toHaveBeenCalled();
  expect(editor.shadowRoot!.querySelector("[data-health-count]")!.textContent).toBe("Inga problem");
});

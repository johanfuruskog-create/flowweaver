import { afterEach, describe, expect, test, vi } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";
import "../editor/components/guide-versions/guide-versions";

import { checkSetup } from "./setup-check";
import { clearDeclaredLocales, unregisterLocale } from "../viewer/localization/registry";
import { init } from "./init";

import type { GuideVersions } from "../editor/components/guide-versions/guide-versions";
import type { HostSetup } from "./init";
import type { GraphData } from "../viewer/types/graph";

/**
 * `init` produces a setup the setup check approves of.
 *
 * This began as a test of the minimal example's own helper — story 015,
 * criterion 3. The helper was the prototype; `init` is the API, `examples/
 * minimal.html` calls it, and the same loop closes tighter now that the thing
 * under test is what a host actually imports.
 *
 * The loop is worth naming. `checkSetup` knows what a done setup looks like;
 * `init` claims to produce one. Either `init` drifts and the check catches it,
 * or the check drifts and `init` catches it.
 */

function graph(): GraphData {
  return {
    startNodeId: "q",
    nodes: [
      {
        id: "q",
        type: "question",
        position: { x: 0, y: 0 },
        data: {
          title: { sv: "Bor du i kommunen?" },
          variableName: "bor",
          options: [{ id: "ja", label: { sv: "Ja" }, value: "ja" }],
        },
      },
    ],
    connections: [],
    settings: { locales: ["sv", "en"] },
  };
}

afterEach(() => {
  document.body.replaceChildren();
  clearDeclaredLocales();
  ["ar"].forEach(unregisterLocale);
});

function run(overrides: Partial<HostSetup> = {}): {
  editor: HTMLElement;
  saveGuide: ReturnType<typeof vi.fn>;
  saveTemplates: ReturnType<typeof vi.fn>;
} {
  const editor = document.createElement("guide-editor");
  editor.style.cssText = "display: block; width: 900px; height: 600px;";
  document.body.append(editor);

  const saveGuide = vi.fn();
  const saveTemplates = vi.fn();
  init(editor, {
    graph: graph(),
    mode: "administrator",
    languages: { offer: ["sv", "en"], source: "sv" },
    onSave: saveGuide,
    onTemplatesChange: saveTemplates,
    ...overrides,
  });
  return { editor, saveGuide, saveTemplates };
}

describe("what init produces", () => {
  // The claim the whole file exists to make, checked by the thing built to
  // check it.
  test("checkSetup finds nothing to say about it", () => {
    expect(checkSetup(run().editor)).toEqual({ ok: true, findings: [] });
  });

  test("and the guide is actually loaded", () => {
    const { editor } = run();

    // The node's text lives in the flow-node's own shadow root, not in the
    // canvas's — reading the canvas returns its stylesheet and nothing else.
    const node = editor.shadowRoot
      ?.querySelector("node-editor")
      ?.shadowRoot?.querySelector("flow-node");

    expect(node?.shadowRoot?.textContent).toContain("Bor du i kommunen?");
  });
});

describe("each step of the sequence took effect", () => {
  test("the mode is set, so the guide can be edited", () => {
    expect(run().editor.getAttribute("mode")).toBe("administrator");
  });

  test("the declared list reaches the registry", () => {
    run({ languages: { offer: ["sv", "en", "ar"], source: "sv" } });

    expect(checkSetup(document.querySelector("guide-editor") as HTMLElement).ok).toBe(
      true,
    );
  });

  test("a language pack is registered before anything renders", () => {
    const { editor } = run({ packs: { ar: { viewer: { "nav.next": "التالي" } } } });

    // The pack settles part of Arabic, so the report changes shape rather than
    // the count staying at every key.
    expect(checkSetup(editor).ok).toBe(true);
  });

  test("the editor's language is the host's to set", () => {
    expect(
      run({ languages: { tool: "en" } }).editor.getAttribute("editor-locale"),
    ).toBe("en");
  });
});

describe("the storage the host promised", () => {
  /*
   * Steps 8 and 9 in the sequence are the two that are not optional. The
   * library stores nothing, so nobody but the host can stop the work being
   * lost — and nothing in the package can detect that they forgot.
   */
  test("a change reaches saveGuide", async () => {
    const { editor, saveGuide } = run();

    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: graph(), reason: "node-updated" },
      }),
    );
    await new Promise((done) => requestAnimationFrame(done));

    expect(saveGuide).toHaveBeenCalled();
  });

  test("and what it receives is the guide, not an empty object", () => {
    const { editor, saveGuide } = run();

    editor.dispatchEvent(
      new CustomEvent("graph-changed", {
        detail: { graph: graph(), reason: "node-updated" },
      }),
    );

    expect(saveGuide.mock.calls[0]?.[0]?.nodes?.length).toBe(1);
  });
});

describe("leaving a step out", () => {
  // The sequence's value is in what each omission leads to, so the omissions
  // have to be observable rather than described.
  test("no mode leaves a guide nobody can edit, and the check says so", () => {
    const { editor } = run({ mode: undefined });

    expect(checkSetup(editor).findings.map((finding) => finding.id)).toContain(
      "mode-not-set",
    );
  });

  test("no declared list is silent, because it is a decision not taken", () => {
    const { editor } = run({ languages: {} });

    expect(checkSetup(editor).ok).toBe(true);
  });
});

/**
 * The same call wires the version list.
 *
 * A host that mounts two of our elements should not have to learn two ways of
 * setting them up — and the language is the one that goes wrong quietly: the
 * list ships Swedish and English and defaults to Swedish, so an English page
 * that never set the attribute gets an English editor above a Swedish table
 * and nothing says a word.
 */
describe("init wires the version list too", () => {
  function list(setup: HostSetup = {}): GuideVersions {
    const element = document.createElement("guide-versions") as GuideVersions;

    document.body.appendChild(element);
    init(element, setup);

    return element;
  }

  test("the tool's language reaches it", () => {
    const element = list({ languages: { tool: "en" } });

    expect(element.getAttribute("editor-locale")).toBe("en");
    expect(element.shadowRoot?.textContent).toContain("No versions yet.");
  });

  test("the versions reach it", () => {
    const element = list({
      versions: [{ id: "v1", label: "guide.json", current: true }],
    });

    expect(element.shadowRoot?.querySelectorAll("tbody tr")).toHaveLength(1);
  });

  /*
   * A host that pins its editor to dark and cannot pin the list beside it gets
   * a dark editor and a white table under it, which reads as a bug in the tool
   * rather than as a gap in its API.
   */
  test("and so does the theme the host decided", () => {
    expect(list({ theme: "dark" }).dataset.fwTheme).toBe("dark");
  });

  // Undefined is "not the host's business"; null is a decision.
  test("saying nothing about the theme leaves it to the operating system", () => {
    expect(list().dataset.fwTheme).toBeUndefined();
  });

  test("and the tokens resolve on it, so the check is happy", () => {
    expect(checkSetup(list({ languages: { tool: "en" } })).ok).toBe(true);
  });
});

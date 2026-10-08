import { describe, expect, it } from "vitest";

import "../viewer/node-types/default-node-types";
import "../editor/components/guide-editor/guide-editor";
import "../viewer/components/guide-preview/guide-preview";
import "../editor/components/guide-versions/guide-versions";
import "../editor/components/prompt-dialog/prompt-dialog";

import { GuideEditor } from "../editor/components/guide-editor/guide-editor";
import { GuidePreview } from "../viewer/components/guide-preview/guide-preview";
import { GuideVersions } from "../editor/components/guide-versions/guide-versions";
import { PromptDialog } from "../editor/components/prompt-dialog/prompt-dialog";
import {
  attributesOf,
  eventsIn,
  exportsIn,
  membersOf,
} from "./public-surface";

import type { PublicSurface } from "./public-surface";

/**
 * The package's surface is frozen — story 013, criteria 4 and 5.
 *
 * The guide's *format* is already guarded: raise CURRENT_GRAPH_VERSION without
 * adding a migration and a test fails. The surface had no such guard, and we
 * have broken it silently: `data-theme` became `data-fw-theme` in v0.2.1, a
 * breaking change for every host that had set it, and it appeared nowhere.
 *
 * A test cannot know what a host depends on. It can know what we offer, and
 * hold us to noticing when that changes. Compare, review, then freeze with
 * `-u` — the same rhythm as `node-contract.test.ts`.
 *
 * A **removal** or a **rename** is what this exists to catch. An addition is
 * safe and still shows up, because a surface that grows without anyone looking
 * is how the surface gets hard to keep.
 */

const RAW = import.meta.glob("../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function currentSurface(): PublicSurface {
  return {
    elements: [
      {
        tag: "guide-editor",
        attributes: attributesOf(GuideEditor),
        members: membersOf(GuideEditor, RAW["../editor/components/guide-editor/guide-editor.ts"] ?? ""),
      },
      {
        tag: "guide-preview",
        attributes: attributesOf(GuidePreview),
        members: membersOf(GuidePreview, RAW["../viewer/components/guide-preview/guide-preview.ts"] ?? ""),
      },
      {
        tag: "guide-versions",
        attributes: attributesOf(GuideVersions),
        members: membersOf(GuideVersions, RAW["../editor/components/guide-versions/guide-versions.ts"] ?? ""),
      },
      /*
       * A host mounts this one too, now that it ships.
       *
       * The version list asks questions that take a word — what shall the copy
       * be called, what is this version — and a host has to answer them with
       * something. Until this was exported the only thing we left them was
       * `window.prompt`, which is why it is on the offer and therefore in here.
       */
      {
        tag: "prompt-dialog",
        attributes: attributesOf(PromptDialog),
        members: membersOf(PromptDialog, RAW["../editor/components/prompt-dialog/prompt-dialog.ts"] ?? ""),
      },
    ],
    // Only the elements a host mounts. Their children raise events too, but
    // those are our wiring rather than our offer.
    events: eventsIn(
      {
        editor: RAW["../editor/components/guide-editor/guide-editor.ts"] ?? "",
        preview: RAW["../viewer/components/guide-preview/guide-preview.ts"] ?? "",
        versions: RAW["../editor/components/guide-versions/guide-versions.ts"] ?? "",
      },
      // theme.ts announces on behalf of the element; announcing is all it does.
      { theme: RAW["../viewer/core/theme.ts"] ?? "" }
    ),
    exports: {
      "entries/viewer.ts": exportsIn(RAW["./viewer.ts"] ?? ""),
      "entries/editor.ts": exportsIn(RAW["./editor.ts"] ?? ""),
    },
  };
}

describe("the public surface", () => {
  it("matches the frozen snapshot", async () => {
    // Compare and review first, then freeze with
    //   npx vitest run public-surface -u
    // once the change has been written down for the hosts who will meet it.
    await expect(`${JSON.stringify(currentSurface(), null, 2)}\n`).toMatchFileSnapshot(
      "./public-surface.snapshot.json",
    );
  });
});

describe("the surface is worth freezing", () => {
  // A snapshot of nothing passes forever. These are the shapes the file is
  // supposed to have, so an empty or half-derived surface fails loudly rather
  // than quietly agreeing with itself.
  it("names every element a host mounts", () => {
    expect(currentSurface().elements.map((element) => element.tag)).toEqual([
      "guide-editor",
      "guide-preview",
      "guide-versions",
      "prompt-dialog",
    ]);
  });

  /*
   * The version list's whole contract with a host is the intents it raises: it
   * renders and asks, and the host reads, writes, renames and removes. An
   * intent that stopped being raised would break a host silently, in the one
   * direction the element can break anyone.
   */
  it("finds the intents the version list raises", () => {
    expect(currentSurface().events).toContain("version-delete-intent");
    expect(currentSurface().events).toContain("version-activate-intent");
  });

  it("finds the attributes a host actually sets", () => {
    const editor = currentSurface().elements[0];

    expect(editor.attributes).toContain("mode");
    expect(editor.attributes).toContain("editor-locale");
  });

  it("finds the members a host actually calls", () => {
    const editor = currentSurface().elements[0];

    expect(editor.members).toContain("graph");
    expect(editor.members).toContain("setTheme");
  });

  it("finds events the element raises on itself", () => {
    expect(currentSurface().events).toContain("graph-changed");
  });

  /*
   * `theme-change` is announced by a helper handed the element as its target,
   * not by the element itself. The first version of this file missed it — a
   * surface guard with a hole in exactly the place the guard exists for, since
   * `data-theme` → `data-fw-theme` was a theming change too.
   */
  it("finds events announced on the element's behalf", () => {
    expect(currentSurface().events).toContain("theme-change");
  });

  // The platform's contract with the element is not ours with the host.
  it("leaves the lifecycle out", () => {
    expect(currentSurface().elements[0].members).not.toContain(
      "connectedCallback",
    );
  });

  it("finds what the entries export", () => {
    expect(currentSurface().exports["entries/viewer.ts"]).toContain(
      "registerLocale",
    );
  });
});

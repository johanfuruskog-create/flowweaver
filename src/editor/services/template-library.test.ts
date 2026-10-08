import { beforeEach, describe, expect, test } from "vitest";

import {
  getEditableLibrary,
  getLibrary,
  mergeIntoLibrary,
  removeFromLibrary,
  saveToLibrary,
  setLibrary,
  subscribeToLibrary,
  updateInLibrary,
} from "./template-library";

import type { NodeTemplate } from "../../viewer/types/graph";

function mall(type: string, label = type): NodeTemplate {
  return { type, label, base: "text-question", values: {} };
}

/** The library is a module-level singleton; reset between tests. */
beforeEach(() => {
  setLibrary([]);
  getLibrary()
    .filter((spec) => spec.type.startsWith("test-"))
    .forEach((spec) => removeFromLibrary(spec.type));
});

describe("the host owns the storage", () => {
  // The library used to write to localStorage directly. The consequence was
  // that a template was visible only to whoever created it, in that browser.
  //
  // This test runs in node, where `localStorage` does not exist at all. Saving
  // and reading still work — that is the proof. The old version would have kept
  // quiet and returned an empty list in the same environment, which is worse
  // than failing loudly.
  test("the library works with no storage at all", () => {
    expect(globalThis.localStorage).toBeUndefined();

    saveToLibrary(mall("test-a"));

    expect(getEditableLibrary().map((spec) => spec.type)).toEqual(["test-a"]);
  });

  test("a host can set the list from outside", () => {
    setLibrary([mall("test-a"), mall("test-b")]);

    expect(getEditableLibrary().map((spec) => spec.type)).toEqual([
      "test-a",
      "test-b",
    ]);
  });

  test("junk in the list is filtered out rather than crashing", () => {
    setLibrary([mall("test-a"), { type: "trasig" }, null, "nej"]);

    expect(getEditableLibrary().map((spec) => spec.type)).toEqual(["test-a"]);
  });

  // The host saved the old, frozen shape. It must be read, not discarded.
  test("a host that saved the old shape gets its templates back", () => {
    setLibrary([
      {
        type: "test-gammal",
        label: "Telefonnummer",
        fields: [{ id: "format", label: "Format", control: "select", defaultValue: "phone" }],
        behavior: {
          answer: { variableField: "variableName", cardinality: "single", input: "text" },
          flow: { kind: "linear" },
        },
      },
    ]);

    expect(getEditableLibrary()).toEqual([
      {
        type: "test-gammal",
        label: "Telefonnummer",
        base: "text-question",
        values: { format: "phone" },
      },
    ]);
  });

  test("anything other than a list yields an empty library", () => {
    setLibrary(undefined);

    expect(getEditableLibrary()).toEqual([]);
  });
});

describe("changes are announced", () => {
  test("a saved template reaches the listener with the whole list", () => {
    const sedda: string[][] = [];
    const av = subscribeToLibrary((specs) =>
      sedda.push(specs.map((spec) => spec.type)),
    );

    saveToLibrary(mall("test-a"));
    saveToLibrary(mall("test-b"));

    expect(sedda).toEqual([["test-a"], ["test-a", "test-b"]]);
    av();
  });

  test("removal and renaming are announced too", () => {
    saveToLibrary(mall("test-a"));

    const sedda: string[][] = [];
    const av = subscribeToLibrary((specs) =>
      sedda.push(specs.map((spec) => spec.label)),
    );

    updateInLibrary("test-a", { label: "Nytt namn" });
    removeFromLibrary("test-a");

    expect(sedda).toEqual([["Nytt namn"], []]);
    av();
  });

  // Without that distinction, every load would bounce back as a write, and the
  // host would write its own list in a loop.
  test("the host setting the list is not a change", () => {
    const av = subscribeToLibrary(() => {
      throw new Error("setLibrary får inte avfyra en ändring.");
    });

    setLibrary([mall("test-a")]);

    av();
  });

  test("an unregistered listener is no longer heard", () => {
    let antal = 0;
    const av = subscribeToLibrary(() => {
      antal += 1;
    });

    saveToLibrary(mall("test-a"));
    av();
    saveToLibrary(mall("test-b"));

    expect(antal).toBe(1);
  });
});

describe("inbyggda mallar", () => {
  // A host sending two templates of its own must not accidentally remove
  // E-postfråga, Telefonnummer and Personnummer.
  test("survives the host setting its list", () => {
    mergeIntoLibrary([mall("test-inbyggd")], { builtin: true });

    setLibrary([mall("test-egen")]);

    expect(getLibrary().map((spec) => spec.type)).toContain("test-inbyggd");
    expect(getLibrary().map((spec) => spec.type)).toContain("test-egen");
  });

  // They used to be removable, and a flag in localStorage kept them from coming
  // back. That flag could not survive storage moving out: the host saves only
  // the editor's own templates, and an empty list is indistinguishable from a
  // first run.
  test("cannot be removed", () => {
    mergeIntoLibrary([mall("test-fast")], { builtin: true });

    removeFromLibrary("test-fast");

    expect(getLibrary().map((spec) => spec.type)).toContain("test-fast");
  });

  test("does not count as something the host should save", () => {
    mergeIntoLibrary([mall("test-inbyggd2")], { builtin: true });
    saveToLibrary(mall("test-egen2"));

    expect(getEditableLibrary().map((spec) => spec.type)).not.toContain(
      "test-inbyggd2",
    );
    expect(getEditableLibrary().map((spec) => spec.type)).toContain(
      "test-egen2",
    );
  });
});

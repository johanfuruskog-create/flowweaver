import { describe, expect, test } from "vitest";

/**
 * The rich text field never calls `execCommand` (story 137 criterion 6).
 *
 * `execCommand` is the browser writing its own DOM — a `<b>` here, a
 * `<span style>` there, different in each engine — which is exactly what the
 * field exists not to let happen: the model owns the text, and the toolbar
 * changes the model. The command is also formally deprecated.
 *
 * Scoped to the field and its model on purpose. The viewer's masked input
 * (`guide-preview.ts`, the shaped value) uses `execCommand("insertText")` to
 * keep a native field's own undo history, for reasons written beside it; that
 * is a different control with a different owner, and a repo-wide ban would
 * either fail on it or grow an exception list. Tests are excluded, since they
 * may well name the command to say it is absent.
 */
const sources = {
  ...import.meta.glob(["../editor/components/rich-text-field/*.ts", "!../editor/components/rich-text-field/*.test.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../editor/core/rich-text-model.ts", { query: "?raw", import: "default", eager: true }),
} as Record<string, string>;

describe("ingen execCommand i textfältet", () => {
  test("det finns källor att läsa", () => {
    expect(Object.keys(sources).some((path) => path.endsWith("rich-text-field.ts"))).toBe(true);
    expect(Object.keys(sources).some((path) => path.endsWith("rich-text-model.ts"))).toBe(true);
  });

  test.each(Object.entries(sources))("%s", (_path, source) => {
    expect(source).not.toMatch(/execCommand/);
  });
});

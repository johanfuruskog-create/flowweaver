import { describe, expect, it } from "vitest";

import { EDITOR_STRINGS } from "./editor-strings";

/*
 * The panel's add buttons draw the plus as an icon (`renderAddButton`,
 * properties-panel.ts), so the words must not carry one too. Johan saw
 * "+ + Lägg till villkor" in the recap film 1/10: the icon from the button
 * and a "+" baked into the string, left over from the time the button drew
 * none. Every key `renderAddButton` is given is listed here; a new add
 * button gets its key added.
 */
const ADD_BUTTON_KEYS = [
  "editor.properties.add-option",
  "editor.properties.add-comment",
  "editor.properties.add-field",
  "editor.properties.add-calculation",
  "editor.properties.add-column",
  "editor.properties.add-condition",
  "editor.properties.add-rule",
] as const;

describe("add buttons: the plus is the icon, never in the words", () => {
  for (const key of ADD_BUTTON_KEYS) {
    it(key, () => {
      const entry = EDITOR_STRINGS[key as keyof typeof EDITOR_STRINGS] as Record<string, string>;
      expect(entry, `${key} saknas`).toBeDefined();
      for (const [locale, text] of Object.entries(entry)) {
        expect(text.trimStart().startsWith("+"), `${key}.${locale}: "${text}"`).toBe(false);
      }
    });
  }
});

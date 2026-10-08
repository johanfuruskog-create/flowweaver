import { afterEach, expect, test } from "vitest";

import { applyPalette, palettes } from "./viewer";

/*
 * Story 140: a host recolours FlowWeaver in one call, through what the package
 * exports — so the test imports the entry, not the library file behind it. The
 * value is read on a mounted `<guide-preview>`, which carries the default
 * tokens itself; a scale that reached only `:root` would lose to them there.
 */

afterEach(() => {
  applyPalette(null);
  document.querySelectorAll("guide-preview").forEach((element) => element.remove());
});

function primaryOn(element: Element): string {
  return getComputedStyle(element).getPropertyValue("--fw-primary").trim();
}

test("applyPalette(palettes.hav) ger guide-preview skalans --fw-primary, och null tar bort det", () => {
  const preview = document.body.appendChild(document.createElement("guide-preview"));
  preview.setAttribute("data-fw-theme", "light");
  const indigo = primaryOn(preview);

  applyPalette(palettes.hav);

  expect(primaryOn(preview)).toBe(palettes.hav.light["--fw-primary"]);
  expect(primaryOn(preview)).not.toBe(indigo);

  applyPalette(null);

  expect(primaryOn(preview)).toBe(indigo);
});

test("i mörkt läge ger skalan sitt mörka värde", () => {
  const preview = document.body.appendChild(document.createElement("guide-preview"));
  preview.setAttribute("data-fw-theme", "dark");

  applyPalette(palettes.hav);

  expect(primaryOn(preview)).toBe(palettes.hav.dark["--fw-primary"]);
});

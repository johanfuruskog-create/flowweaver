import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

import { kontrast, tillRgba } from "../../../testing/contrast";

/**
 * Den valda etiketten måste gå att läsa i båda lägena.
 *
 * Tonen är en token och inte en färg, just för att kortet är vitt i ljust läge
 * och mörkt i mörkt. En etikett som stod fast i en nyans hade fallit igenom i
 * det ena — och det upptäcks aldrig av den som bara arbetar i ett av dem.
 *
 * 4,5:1 är WCAG 1.4.3 för text. Krysset mäts också: det är den enda vägen
 * tillbaka från ett felval, och ett kryss man inte ser är ett val man inte kan
 * ångra.
 */

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-theme");
});

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function chip(tema: "light" | "dark"): Promise<{
  etikett: number;
  kryss: number;
}> {
  document.documentElement.setAttribute("data-theme", tema);

  const element = document.createElement("chip-picker") as HTMLElement & {
    options: Array<{ label: string; value: string }>;
    value: string[];
  };

  document.body.append(element);
  element.options = [{ label: "Danmark", value: "DK" }];
  element.value = ["DK"];
  await settle();

  const pillen = element.shadowRoot!.querySelector<HTMLElement>("[data-chosen]")!;
  const bakom = tillRgba(getComputedStyle(pillen).backgroundColor);
  const läs = (selector: string): number =>
    kontrast(
      tillRgba(getComputedStyle(element.shadowRoot!.querySelector(selector)!).color),
      bakom,
    );

  return {
    etikett: läs(".chip-picker__chip-label"),
    kryss: läs("[data-remove]"),
  };
}

describe("den valda etiketten", () => {
  for (const tema of ["light", "dark"] as const) {
    test(`är läsbar i ${tema === "light" ? "ljust" : "mörkt"} läge`, async () => {
      const mätt = await chip(tema);

      expect(mätt.etikett, `etiketten ${mätt.etikett.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(mätt.kryss, `krysset ${mätt.kryss.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

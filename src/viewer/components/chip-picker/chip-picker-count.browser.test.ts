import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

import { VIEWER_STRINGS } from "../../localization/viewer-strings";

/**
 * Räknaren under rutan säger vad den räknar (uppdrag 29/9 Del D, Astras
 * spec §11): *2 kvar att välja*, inte *2 värden*, när talet är det som
 * återstår — och i sökläget det som faktiskt räknas, träffarna.
 *
 * Kontrollen delas av editorn och besökarens flervalslista, så orden prövas
 * i båda registren.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & { options: Array<{ label: string; value: string }>; value: string[] };

async function mount(): Promise<Picker> {
  const element = document.createElement("chip-picker") as Picker;

  document.body.append(element);
  element.options = [
    { label: "Sverige", value: "SE" },
    { label: "Danmark", value: "DK" },
    { label: "Norge", value: "NO" },
  ];
  element.value = ["SE"];
  await settle();
  return element;
}

const count = (element: Picker): string =>
  element.shadowRoot!.querySelector("[data-count]")?.textContent?.trim() ?? "";

describe("räknaren", () => {
  test("säger hur många som är kvar att välja", async () => {
    const element = await mount();

    expect(count(element)).toBe("2 kvar att välja");
  });

  test("i sökläget säger den hur många träffar sökningen gav", async () => {
    const element = await mount();
    const box = element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

    box.focus();
    box.value = "mark";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(320);

    expect(count(element)).toBe("1 träff");
  });

  test("besökarens register har samma ord, på svenska och engelska", () => {
    expect(VIEWER_STRINGS["choice.left"]).toEqual({ sv: "{n} kvar att välja", en: "{n} left to choose" });
    expect(VIEWER_STRINGS["choice.oneLeft"]).toEqual({ sv: "1 kvar att välja", en: "1 left to choose" });
    expect(VIEWER_STRINGS["choice.matches"]).toEqual({ sv: "{n} träffar", en: "{n} matches" });
    expect(VIEWER_STRINGS["choice.oneMatch"]).toEqual({ sv: "1 träff", en: "1 match" });
  });
});

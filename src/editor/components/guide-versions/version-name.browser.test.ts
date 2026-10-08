import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersions } from "./guide-versions";

/**
 * A version's name, and the clock it is told by (story 124, 17/9).
 *
 * ## The fault this is written from
 *
 * One frozen version said two times on one line: the row was called
 * *2026-09-16 13:05* and the *Sparad* column beside it said *15:05*. The name
 * had been minted by the storage out of `toISOString()` — UTC — while the
 * column rendered the reader's own zone. Nothing was wrong with either half;
 * they were simply two renderings of one instant, and a reader cannot tell
 * which one is the truth.
 *
 * So the element tells the time in one place, and a version nobody named is
 * named by that same text. The id is the last resort and reads as one.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A moment with a clear difference between UTC and Stockholm: 13:05Z = 15:05. */
const SAVED_AT = Date.parse("2026-09-16T13:05:00.000Z");

async function list(version: Record<string, unknown>): Promise<GuideVersions> {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", "sv");
  document.body.append(element);
  element.versions = [{ id: "v-3f2a9c", savedAt: SAVED_AT, ...version }] as never;
  await settle();

  return element;
}

/*
 * Tiden står i radens metarad sedan 18/9 kväll, inte i en egen kolumn.
 *
 * Påståendet är detsamma och det är det som betyder något: namnet och tiden är
 * EN rendering av samma ögonblick, inte två. Att kolumnen blev en rad ändrar
 * var man läser den, inte vad som måste stämma.
 */
const cells = (element: GuideVersions): { name: string; when: string } => ({
  name: element.shadowRoot!.querySelector(".text")?.textContent?.trim() ?? "",
  when: element.shadowRoot!.querySelector("[data-when]")?.textContent?.trim() ?? "",
});

describe("vad en version heter", () => {
  test("en version ingen döpt heter när den sparades — samma text som kolumnen", async () => {
    const { name, when } = cells(await list({}));

    expect(when, "kolumnen säger något").not.toBe("");
    expect(name, "och raden säger samma sak, inte ett id").toBe(when);
    expect(name).not.toContain("v-3f2a9c");
  });

  /*
   * Och ingenstans står ordet *undefined*.
   *
   * Johan såg det i ett besked 17/9: sidan skrev `${version.label} visas` och
   * `label` är valfri — en odöpt version har ingen. Namnet är listans sak, och
   * den som frågar efter det ska få det den visar. Kontrollen är bred med
   * flit: den läser hela raden, inte fältet någon råkade tänka på.
   */
  test("en odöpt version säger ingenstans *undefined*", async () => {
    const element = await list({});

    expect(element.shadowRoot!.textContent).not.toContain("undefined");
  });

  /*
   * Ordningen bytte plats 17/9, och skälet står i komponenten: anteckningen
   * sköt ner namnet och brickan till en andra rad i en smal panel. Namnet leder
   * nu, anteckningen står under — och utan namn är anteckningen kvar som
   * radens första ord, precis som förut.
   */
  test("ett namn vinner över tiden, och anteckningen står under namnet", async () => {
    expect(cells(await list({ label: "bostadsbidrag.json" })).name).toBe("bostadsbidrag.json");

    const båda = await list({ label: "bostadsbidrag.json", note: "Före regeländringen" });

    expect(cells(båda).name).toBe("bostadsbidrag.json");
    expect(båda.shadowRoot!.querySelector(".note")?.textContent).toBe("Före regeländringen");
    expect(cells(await list({ note: "Före regeländringen" })).name).toBe("Före regeländringen");
  });

  /*
   * Utan tid finns ingenting bättre än id:t, och då ska det stå — en tom rad
   * vore värre än en obegriplig.
   */
  test("utan både namn och tid står id:t kvar", async () => {
    const element = document.createElement("guide-versions") as GuideVersions;

    document.body.append(element);
    element.versions = [{ id: "v-3f2a9c" }] as never;
    await settle();

    expect(cells(element).name).toBe("v-3f2a9c");
  });
});

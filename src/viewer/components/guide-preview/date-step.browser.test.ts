import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * A date on a step of its own, and a rule that reads it.
 *
 * ## The fault this is written from
 *
 * The engine's date branch validated the answer, found it good — and never
 * committed it. The step then fell through to *"the node type is not supported
 * yet in the declarative engine"*, a message about something else entirely. The
 * field rendered, the button enabled, the click registered, and nothing
 * happened.
 *
 * No unit test saw it, because the validation was correct. Only clicking
 * through the guide did. Validating and committing are two halves, and a branch
 * that does one is the easy mistake.
 *
 * ## What the range asserts
 *
 * "Från och till" is two conditions under `match: "all"`, and the interesting
 * values are the ends: the first and the last day are inside. An off-by-one in a
 * text comparison shows up exactly there and nowhere else.
 */

afterEach(() => document.body.replaceChildren());

const guide = (): GraphData =>
  ({
    startNodeId: "d",
    settings: { sourceLocale: "sv" },
    nodes: [
      {
        id: "d",
        type: "date-question",
        position: { x: 0, y: 0 },
        data: { title: { sv: "Vilket datum?" }, variableName: "datum", required: true },
      },
      {
        id: "r",
        type: "rule",
        position: { x: 300, y: 0 },
        data: {
          title: { sv: "I mars?" },
          fallbackLabel: "Utanför",
          cases: [
            {
              id: "mars",
              label: "I mars",
              match: "all",
              conditions: [
                { id: "a", variableName: "datum", operator: "greater-than-or-equal", value: "2026-03-01" },
                { id: "b", variableName: "datum", operator: "less-than-or-equal", value: "2026-03-31" },
              ],
            },
          ],
        },
      },
      { id: "ja", type: "result", position: { x: 600, y: 0 }, data: { title: { sv: "Inom perioden" } } },
      { id: "nej", type: "result", position: { x: 600, y: 200 }, data: { title: { sv: "Utanför perioden" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "d", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      { id: "c2", from: { nodeId: "r", portId: "mars" }, to: { nodeId: "ja", portId: "input" } },
      { id: "c3", from: { nodeId: "r", portId: "default" }, to: { nodeId: "nej", portId: "input" } },
    ],
  }) as unknown as GraphData;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 140));

async function answer(date: string): Promise<string> {
  document.body.replaceChildren();

  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = guide();
  await settle();
  await settle();

  const input = preview.shadowRoot?.querySelector<HTMLInputElement>('input[type="date"]');

  if (!input) return "inget datumfält";

  input.value = date;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();

  preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();
  await settle();

  const said = preview.shadowRoot?.textContent ?? "";

  return said.includes("Inom perioden")
    ? "inom"
    : said.includes("Utanför perioden")
      ? "utanför"
      : "kom ingenstans";
}

describe("a date step", () => {
  test("renders the platform's own date control", async () => {
    const preview = document.createElement("guide-preview") as GuidePreview;

    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = guide();
    await settle();
    await settle();

    expect(preview.shadowRoot?.querySelector('input[type="date"]')).toBeTruthy();
  });

  test("moves on when a date is given", async () => {
    // The half that was missing: validated, found good, never committed.
    expect(await answer("2026-03-15")).not.toBe("kom ingenstans");
  });
});

describe("a rule reading that date", () => {
  test("puts a date inside the range on the right path", async () => {
    expect(await answer("2026-03-15")).toBe("inom");
  });

  test("counts the first and the last day as inside", async () => {
    // Where an off-by-one lives, and nowhere else.
    expect(await answer("2026-03-01")).toBe("inom");
    expect(await answer("2026-03-31")).toBe("inom");
  });

  test("puts the days on either side outside", async () => {
    expect(await answer("2026-02-28")).toBe("utanför");
    expect(await answer("2026-04-01")).toBe("utanför");
  });
});

describe("viloläget — innan man tryckt", () => {
  async function mount(locale = "sv"): Promise<GuidePreview> {
    document.body.replaceChildren();
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("active-locale", locale);
    document.body.append(preview);
    preview.graph = guide();
    await settle();
    await settle();
    return preview;
  }

  /*
   * Design A, vald av Johan 31/8 ur tre uppritade förslag: i vila visar
   * fältet formatet som spöktext och en kalenderikon till höger. Skälet är
   * mätt på hans telefon samma kväll: med `appearance: none` är ett tomt
   * datumfält en TOM GRÅ PLATTA på iOS — ingenting säger vad som ska in
   * eller att ett tryck öppnar en väljare.
   *
   * Spöket är text bredvid fältet (aria-hidden, pekar-genomsläppligt), inte
   * ett placeholder-attribut — datumfält har inget. Det släcks så snart
   * fältet bär ett värde, för då är plattformens egen utskrift svaret.
   */
  test("visar formatet som spöktext och en kalenderikon", async () => {
    const preview = await mount();
    const ghost = preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]");
    const icon = preview.shadowRoot!.querySelector("[data-date-icon] svg");

    expect(ghost, "spöktexten finns").not.toBeNull();
    expect(ghost!.hidden, "och syns när fältet är tomt").toBe(false);
    expect(ghost!.textContent?.trim()).toBe("ÅÅÅÅ-MM-DD");
    expect(ghost!.getAttribute("aria-hidden"), "men läses inte upp — etiketten säger redan vad fältet är").toBe("true");
    expect(icon, "kalenderikonen ritas").not.toBeNull();
  });

  test("och släcker spöket så snart ett datum står i fältet", async () => {
    const preview = await mount();
    const input = preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]')!;

    input.value = "2026-03-14";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(
      preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]")!.hidden,
      "spöket står kvar ovanpå ett svar",
    ).toBe(true);
  });

  test("och spöket viker undan när fältet fokuseras för skrivning", async () => {
    /*
     * Chromium ritar segmenten (mm/dd/yyyy) i fältet — mätt i mobilemulerad
     * skärmbild 31/8: två spöken ovanpå varandra. Regeln: tomt OCH oberört
     * fält visar vårt spöke och gömmer den nakna texten (color: transparent);
     * vid fokus byter de plats, för då skriver man i plattformens segment.
     */
    const preview = await mount();
    const input = preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]')!;

    expect(getComputedStyle(input).color, "den nativa texten döljs inte i vila").toBe("rgba(0, 0, 0, 0)");

    input.focus();
    await settle();

    expect(
      preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]")!.hidden,
      "spöket står kvar under skrivning",
    ).toBe(true);
    expect(getComputedStyle(input).color, "segmenten syns inte när man skriver").not.toBe("rgba(0, 0, 0, 0)");

    input.blur();
    await settle();

    expect(
      preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]")!.hidden,
      "spöket kommer inte tillbaka efter lämnat tomt fält",
    ).toBe(false);
  });

  test("och fältet har textfältets höjd som golv", async () => {
    /*
     * Johans iPhone 31/8, mot skissen: fältet var för lågt. iOS låter inte
     * ett datumfält växa med padding som ett textfält gör — det faller ihop
     * till sin inre höjd. Golvet är textfältets uppmätta 45px, så de två
     * fältsorterna står lika höga på varje plattform. Läst ur stilarket som
     * grov-pekdonsregeln: ingen svit kan köra iOS (WebKit startar inte i
     * WSL:n), så regeln i arket är det som går att vakta här — telefonen
     * mätte resten.
     */
    const sheet = (await import("./guide-preview.scss?inline")).default as string;
    const block = sheet.slice(sheet.indexOf(".guide-preview__date"));

    expect(block.slice(0, 600), "datumfältet saknar sitt höjdgolv").toContain("min-height: 45px");
  });

  test("på engelska heter formatet YYYY-MM-DD", async () => {
    const preview = await mount("en");

    expect(
      preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]")!.textContent?.trim(),
    ).toBe("YYYY-MM-DD");
  });
});

describe("datum som fält på en sida", () => {
  /*
   * Johans iPhone hittade tredje vägen 31/8: design A byggdes i
   * STEG-renderaren, men every-field-guidens datum ligger som FÄLT på sidan
   * "Om felet" — och sidfältets datum var en naken input i den generella
   * textfältsmallen. Privat flik friade cachen; skärmbilden pekade på sidan.
   * Samma läxa som uppslaget: tre vägar in, sviten täckte en.
   */
  async function mountPage(): Promise<GuidePreview> {
    document.body.replaceChildren();
    const preview = document.createElement("guide-preview") as GuidePreview;
    preview.setAttribute("active-locale", "sv");
    document.body.append(preview);
    preview.graph = {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Om felet" } } },
        {
          id: "d",
          type: "date-question",
          parentPageId: "p",
          order: 0,
          position: { x: 0, y: 0 },
          layout: { columnSpan: 12 },
          data: { title: { sv: "När märkte du felet?" }, variableName: "datum" },
        },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
      ],
      connections: [
        { id: "x", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as unknown as GraphData;
    await settle();
    await settle();
    return preview;
  }

  test("bär samma viloläge som steget: spöke och ikon", async () => {
    const preview = await mountPage();
    const ghost = preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]");

    expect(ghost, "sidfältets datum saknar spöket").not.toBeNull();
    expect(ghost!.hidden).toBe(false);
    expect(ghost!.textContent?.trim()).toBe("ÅÅÅÅ-MM-DD");
    expect(preview.shadowRoot!.querySelector("[data-date-icon] svg"), "och ikonen").not.toBeNull();
  });

  test("och sidfältens inputs bär ytans färg, inte webbläsarens", async () => {
    /*
     * Johans iPhone i ljust läge 31/8: datumfältet stod GRÅTT mot det vita
     * kortet. Sidfältsregeln satte kant, färg och padding — men aldrig
     * `background`, så varje sidfälts-input red på webbläsarens egen: vit på
     * skrivbordet (osynligt), iOS kontrollton på telefonen. Regelns egen
     * kommentar varnar för UA-grått på KANTEN och missade fyllningen.
     *
     * Vaktad i stilarket, som höjdgolvet och grov-pekdonsregeln: ett första
     * försök som mätte beräknad stil i "mörkt tema" var grönt av slump —
     * testmiljöns tokens följer inte dokumentets data-theme, så UA-vitt
     * råkade vara token-vitt. Praxis 12 i förkroppsligad form.
     */
    const sheet = (await import("./guide-preview.scss?inline")).default as string;
    // Själva input-regeln, inte förälderblocket: kommentarerna före den är
    // längre än man tror, och en vakt som mäter fel ställe är ingen vakt.
    const rule = sheet.slice(sheet.indexOf(".guide-preview__page-field input"));

    expect(rule.length, "input-regeln finns i arket").toBeGreaterThan(0);
    expect(
      rule.slice(0, 700),
      "sidfältets input-regel saknar background",
    ).toContain("background: var(--fw-surface)");
  });

  test("och spöket släcks när sidfältet får ett värde", async () => {
    const preview = await mountPage();
    const input = preview.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]')!;

    input.value = "2026-03-14";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    expect(preview.shadowRoot!.querySelector<HTMLElement>("[data-date-ghost]")!.hidden).toBe(true);
  });
});

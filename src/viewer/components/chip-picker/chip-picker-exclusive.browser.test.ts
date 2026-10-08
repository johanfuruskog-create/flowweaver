import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

/**
 * Berättelse 062 — ett val som utesluter de andra.
 *
 * Man kan inte vara statslös och tysk medborgare. Kontrollen lät en välja
 * båda, och exemplets regel fick städa efteråt med ett `one-of XS` som
 * skyddsnät för ett svar som inte borde kunna finnas.
 *
 * ## Varför testerna prövar ERSÄTTANDE och inte spärrande
 *
 * Två varianter vägdes 31/8. Den spärrande — det exklusiva går inte att
 * välja medan annat är valt — förkastades: en knapp som vägrar utan att säga
 * varför är samma felklass som palettens tysta knappar, och på en platta ser
 * en död knapp ut som en bugg. Alltså gör varje tryck något, och det som
 * försvann sägs i statusraden.
 *
 * ## Varför statusraden prövas på ORSAKEN
 *
 * Johans kvarstående oro var *"om man förstår varför valda alternativ
 * försvinner"*. En rad som säger "Danmark togs bort" svarar på vad, inte på
 * varför — och då är mekanismen halv. Påståendena här riktas mot
 * `[data-status]` och inte mot skuggträdet, praxis 12: etiketterna och
 * räknaren står på samma sida och skulle svara för raden.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & {
  options: Array<{ label: string; value: string; exclusive?: boolean }>;
  value: string[];
  strings: Record<string, string>;
};

async function mount(
  options: Array<{ label: string; value: string; exclusive?: boolean }>,
  attributes: string[] = [],
): Promise<Picker> {
  const element = document.createElement("chip-picker") as Picker;

  for (const name of attributes) element.setAttribute(name, "");
  document.body.append(element);
  element.options = options;
  await settle();

  return element;
}

/** Två länder och två av Skatteverkets fyra egna koder. */
const BLANDAT = [
  { label: "Danmark", value: "DK" },
  { label: "Tyskland", value: "DE" },
  { label: "Statslös", value: "XS", exclusive: true },
  { label: "Okänt land", value: "XO", exclusive: true },
];

const chips = (element: Picker): string[] =>
  [...element.shadowRoot!.querySelectorAll(".chip-picker__chip-label")].map(
    (one) => one.textContent?.trim() ?? "",
  );

const status = (element: Picker): string =>
  element.shadowRoot!.querySelector("[data-status]")?.textContent?.trim() ?? "";

const separator = (element: Picker): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>("[data-separator]");

const optionOrder = (element: Picker): string[] =>
  [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-options] > li")].map(
    (one) => one.textContent?.trim() ?? "",
  );

async function open(element: Picker): Promise<void> {
  element.shadowRoot!
    .querySelector<HTMLElement>(".chip-picker__box")!
    .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  await settle();
}

async function choose(element: Picker, value: string): Promise<void> {
  await open(element);

  /*
   * En lång lista står inte och väntar — den hämtas fram med ett ord. Så
   * måste testet göra samma sak som en människa, annars finns ingen knapp.
   */
  const box = element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]:not([hidden])");

  if (box) {
    box.value = element.options.find((one) => one.value === value)?.label ?? value;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  }

  const button = element.shadowRoot!.querySelector<HTMLButtonElement>(
    `[data-add][data-value="${value}"]`,
  );

  if (!button) throw new Error(`${value} går inte att välja — det står inte i listan.`);

  button.click();
  await settle();
}

describe("ersättningsregeln", () => {
  test("det exklusiva valet blir ensamt", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");
    await choose(element, "DE");
    await choose(element, "XS");

    expect(chips(element)).toEqual(["Statslös"]);
  });

  test("ett vanligt val tar bort det exklusiva", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "XS");
    await choose(element, "DK");

    expect(chips(element)).toEqual(["Danmark"]);
  });

  test("två exklusiva utesluter varandra — ensam betyder ensam", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "XS");
    await choose(element, "XO");

    expect(chips(element)).toEqual(["Okänt land"]);
  });

  test("vanliga val står kvar bredvid varandra som förut", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");
    await choose(element, "DE");

    expect(chips(element)).toEqual(["Danmark", "Tyskland"]);
  });
});

describe("statusraden", () => {
  test("säger VARFÖR när det exklusiva rensade de andra", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");
    await choose(element, "XS");

    expect(status(element)).toContain("Danmark");
    expect(status(element), "raden säger vad, inte varför").toContain(
      "inte kombineras med andra val",
    );
  });

  test("säger VARFÖR när det exklusiva åkte ut", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "XS");
    await choose(element, "DK");

    expect(status(element)).toContain("Statslös");
    expect(status(element), "raden säger vad, inte varför").toContain(
      "inte kombineras med andra val",
    );
  });

  test("nämner varje val som togs bort, inte bara det första", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");
    await choose(element, "DE");
    await choose(element, "XS");

    expect(status(element)).toContain("Danmark");
    expect(status(element)).toContain("Tyskland");
  });

  test("ett vanligt val utan något att rensa säger som förut", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");

    expect(status(element)).toContain("tillagt");
    expect(status(element)).not.toContain("inte kombineras med andra val");
  });
});

describe("ångra", () => {
  test("krysset tar tillbaka det exklusiva valet", async () => {
    const element = await mount(BLANDAT);

    await choose(element, "DK");
    await choose(element, "XS");

    element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    expect(chips(element)).toEqual([]);
    expect(status(element)).toContain("borttaget");
  });

  test("Backspace i en tom ruta tar tillbaka det senaste", async () => {
    /* Nio alternativ: över tröskeln, alltså finns en sökruta att backa i. */
    const element = await mount([
      ...BLANDAT,
      { label: "Norge", value: "NO" },
      { label: "Finland", value: "FI" },
      { label: "Island", value: "IS" },
      { label: "Polen", value: "PL" },
      { label: "Estland", value: "EE" },
    ]);

    await choose(element, "DK");
    await choose(element, "XS");
    expect(chips(element)).toEqual(["Statslös"]);

    const box = element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

    box.value = "";
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await settle();

    expect(chips(element)).toEqual([]);
  });
});

describe("avskiljaren", () => {
  test("ritas när listan har både vanliga och exklusiva alternativ", async () => {
    const element = await mount(BLANDAT);

    await open(element);

    expect(separator(element)).not.toBeNull();
    expect(separator(element)!.textContent).toContain("eller");
  });

  test("ritas inte när alla alternativ är vanliga", async () => {
    const element = await mount([
      { label: "Danmark", value: "DK" },
      { label: "Tyskland", value: "DE" },
    ]);

    await open(element);

    expect(separator(element)).toBeNull();
  });

  test("ritas inte när alla alternativ är exklusiva", async () => {
    const element = await mount([
      { label: "Statslös", value: "XS", exclusive: true },
      { label: "Okänt land", value: "XO", exclusive: true },
    ]);

    await open(element);

    expect(separator(element)).toBeNull();
  });

  test("försvinner när det sista vanliga valet är gjort", async () => {
    const element = await mount([
      { label: "Danmark", value: "DK" },
      { label: "Statslös", value: "XS", exclusive: true },
    ]);

    await choose(element, "DK");
    await open(element);

    expect(separator(element)).toBeNull();
  });

  test("är inte träffbar: ingen knapp, inget val, ingen tabbplats", async () => {
    const element = await mount(BLANDAT);

    await open(element);

    const rad = separator(element)!;

    expect(rad.querySelector("button")).toBeNull();
    expect(rad.hasAttribute("data-add")).toBe(false);
    expect(rad.tabIndex).toBeLessThan(0);

    rad.click();
    await settle();

    expect(chips(element), "ett tryck på avskiljaren valde något").toEqual([]);
  });

  test("de exklusiva står under den, aldrig blandade i mängden", async () => {
    const element = await mount(BLANDAT);

    await open(element);

    const rader = optionOrder(element);
    const vid = rader.findIndex((one) => one.includes("eller"));

    expect(vid, "ingen avskiljare i listan").toBeGreaterThan(-1);
    expect(rader.slice(0, vid)).toEqual(["Danmark", "Tyskland"]);
    expect(rader.slice(vid + 1)).toEqual(["Statslös", "Okänt land"]);
  });
});

describe("en lista utan flaggor — panelens värdar", () => {
  test("beter sig precis som före flaggan", async () => {
    const element = await mount([
      { label: "Ett", value: "1" },
      { label: "Två", value: "2" },
      { label: "Tre", value: "3" },
    ]);

    await choose(element, "1");
    await choose(element, "2");
    await choose(element, "3");

    expect(chips(element)).toEqual(["Ett", "Två", "Tre"]);
    expect(separator(element)).toBeNull();
    expect(status(element)).not.toContain("inte kombineras med andra val");
  });
});

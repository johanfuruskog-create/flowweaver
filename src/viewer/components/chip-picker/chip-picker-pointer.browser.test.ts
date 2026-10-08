import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

/**
 * Pekaren, och varför fokus inte får bära stängningen.
 *
 * ## Felklassen, mätt två gånger på riktiga enheter
 *
 * Safari på plattan ger inte knappar fokus vid tryck. Det som HADE fokus
 * blurras då med `relatedTarget: null` — långt före klicket — och en
 * lyssnare som läser det som "fokus gick utanför" stänger och ritar om,
 * varpå klicket landar på en knapp som inte finns längre. Ingenting väljs,
 * listan bara stängs.
 *
 * Det var precis felet i var-knappen (dagboken 31/8, två poster). Den här
 * kontrollen bar samma villkor och har aldrig mätts på en platta.
 *
 * Tre regler faller ur det, och varje regel har ett test här:
 *
 * 1. `relatedTarget: null` betyder **vet ej**, inte "utanför" — då stängs
 *    ingenting. Fokus som pekar ut en mottagare utanför roten stänger.
 * 2. Tryck utanför stängs av en `pointerdown`-lyssnare på dokumentet.
 *    Pekaren ljuger aldrig om var den landade. En gång bunden, inte en per
 *    omritning.
 * 3. Knapparna som väljer och tar bort avbryter `mousedown`, så fokus
 *    ALDRIG lämnar sökrutan. Då finns felklassen inte på någon plattform,
 *    och plattans tangentbord fälls inte ihop mitt i valet. `mousedown` och
 *    inte `pointerdown`: att avbryta pointerdown ställer in
 *    kompatibilitetskedjan på iOS, och då kommer inget klick alls.
 *
 * Tillgängligheten hålls i sin egen gren: ett klick utan koordinater
 * (`detail === 0`, alltså Enter eller mellanslag) flyttar fokus som förut.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & {
  options: Array<{ label: string; value: string }>;
  value: string[];
};

/** Tolv alternativ, alltså över tröskeln: kontrollen får en sökruta. */
async function long(): Promise<Picker> {
  const element = document.createElement("chip-picker") as Picker;

  document.body.append(element);
  element.options = ["Danmark", "Jordanien", "Sudan", "Sydsudan", "Sverige",
    "Norge", "Island", "Finland", "Tyskland", "Polen", "Estland", "Lettland"]
    .map((label) => ({ label, value: label }));
  await settle();

  return element;
}

/** Två alternativ, alltså ingen sökruta — den grenen har sin egen fokusväg. */
async function short(): Promise<Picker> {
  const element = document.createElement("chip-picker") as Picker;

  document.body.append(element);
  element.options = [
    { label: "Danmark", value: "DK" },
    { label: "Tyskland", value: "DE" },
  ];
  await settle();

  return element;
}

const box = (element: Picker): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;

const option = (element: Picker, value: string): HTMLButtonElement | null =>
  element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-add][data-value="${value}"]`);

async function open(element: Picker): Promise<void> {
  box(element).dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  await settle();
}

async function search(element: Picker, term: string): Promise<void> {
  const field = element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

  field.value = term;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

describe("på en platta där knappar inte får fokus", () => {
  test("ett tryck på ett alternativ stänger inte listan i förtid", async () => {
    const element = await long();

    await open(element);
    await search(element, "dan");

    expect(option(element, "Danmark"), "inget alternativ att trycka på").not.toBeNull();

    // Safaris beteende vid tryck: det fokuserade blurras utan att någon ny
    // mottagare pekas ut — före click-händelsen.
    option(element, "Danmark")!.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true, relatedTarget: null }),
    );
    await settle();

    const kvar = option(element, "Danmark");

    expect(kvar, "listan stängdes av en blur utan mottagare").not.toBeNull();

    kvar!.click();
    await settle();

    expect(element.value).toEqual(["Danmark"]);
  });

  test("och ett tryck på krysset tar ändå bort", async () => {
    const element = await short();

    element.value = ["DK"];
    await settle();

    const kryss = element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!;

    kryss.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true, relatedTarget: null }),
    );
    await settle();

    element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    expect(element.value).toEqual([]);
  });
});

describe("vad som stänger listan", () => {
  test("fokus som pekar ut något utanför kontrollen", async () => {
    /*
     * Påståendet är detsamma som förut — lämnar man kontrollen stängs den.
     * Simuleringen är det som rättats: en `focusout` utan mottagare säger
     * inte att fokus gick ut, den säger att webbläsaren inte vet vart.
     */
    const utanför = document.createElement("input");

    document.body.append(utanför);

    const element = await short();

    await open(element);
    expect(element.shadowRoot!.querySelectorAll("[data-add]").length).toBeGreaterThan(0);

    box(element).dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true, relatedTarget: utanför }),
    );
    await settle();

    expect(element.shadowRoot!.querySelectorAll("[data-add]")).toHaveLength(0);
  });

  test("och ett tryck utanför, även när inget fokus flyttas", async () => {
    const utanför = document.createElement("div");

    document.body.append(utanför);

    const element = await short();

    await open(element);
    expect(element.shadowRoot!.querySelectorAll("[data-add]").length).toBeGreaterThan(0);

    utanför.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await settle();

    expect(element.shadowRoot!.querySelectorAll("[data-add]")).toHaveLength(0);
  });

  test("men inte ett tryck inuti den", async () => {
    const element = await short();

    await open(element);

    option(element, "DK")!.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true }),
    );
    await settle();

    expect(option(element, "DK"), "trycket i listan stängde den").not.toBeNull();
  });
});

describe("knapparna stjäl aldrig fokus", () => {
  test("alternativet avbryter mousedown", async () => {
    /*
     * Mekanismen mäts, för webbläsarens fokusflytt ÄR den default som
     * avbryts — en syntetisk `mousedown` flyttar inget fokus att räkna.
     * Att fokus står kvar genom ett riktigt klick mäts där sökrutan
     * överlever omritningen.
     */
    const element = await short();

    await open(element);

    const händelse = new MouseEvent("mousedown", {
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    option(element, "DK")!.dispatchEvent(händelse);

    expect(händelse.defaultPrevented).toBe(true);
  });

  test("och krysset gör det också", async () => {
    const element = await short();

    element.value = ["DK"];
    await settle();

    const händelse = new MouseEvent("mousedown", {
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!
      .dispatchEvent(händelse);

    expect(händelse.defaultPrevented).toBe(true);
  });

  test("ett pektryck flyttar inte fokus in i kontrollen", async () => {
    const utanför = document.createElement("input");

    document.body.append(utanför);

    const element = await short();

    await open(element);
    utanför.focus();

    option(element, "DK")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }),
    );
    await settle();

    expect(element.shadowRoot!.activeElement, "kontrollen tog fokus vid ett pektryck").toBeNull();
    expect(document.activeElement).toBe(utanför);
  });

  test("men tangentbordet får fokus dit det brukar", async () => {
    /*
     * Vakttestet för villkoret ovan. Enter och mellanslag ger ett klick utan
     * koordinater (`detail === 0`); då står den som valde på en knapp som
     * just lämnat listan, och fokus måste vidare — annars hamnar det på
     * body och nästa tabb börjar om från sidans topp.
     */
    const element = await short();

    await open(element);
    option(element, "DK")!.click();
    await settle();

    expect(
      element.shadowRoot!.activeElement?.getAttribute("data-value"),
      "tangentbordsvalet lämnade fokus på ingenting",
    ).toBe("DE");
  });
});

describe("dokumentlyssnaren", () => {
  test("binds en gång, hur många omritningar som än sker — och släpps vid urkoppling", async () => {
    /*
     * Roten överlever varje omritning; en lyssnare per render hade blivit en
     * hög av dubbletter som alla stänger samma lista. Räknas på dokumentet,
     * för det är där den sitter: pekaren ska ses även när den landar helt
     * utanför komponenten.
     */
    const lagda: EventListenerOrEventListenerObject[] = [];
    const släppta: EventListenerOrEventListenerObject[] = [];
    const riktigAdd = document.addEventListener;
    const riktigRemove = document.removeEventListener;

    document.addEventListener = function (this: Document, type: string, listener: never, options?: never) {
      if (type === "pointerdown" && listener) lagda.push(listener);
      return riktigAdd.call(this, type, listener, options);
    } as typeof document.addEventListener;
    document.removeEventListener = function (this: Document, type: string, listener: never, options?: never) {
      if (type === "pointerdown" && listener) släppta.push(listener);
      return riktigRemove.call(this, type, listener, options);
    } as typeof document.removeEventListener;

    try {
      const element = await short();

      for (let varv = 0; varv < 10; varv += 1) {
        element.value = varv % 2 === 0 ? ["DK"] : [];
        await settle(0);
      }

      expect(lagda, "en lyssnare per omritning").toHaveLength(1);

      element.remove();
      await settle(0);

      expect(släppta, "lyssnaren låg kvar efter urkoppling").toEqual(lagda);
    } finally {
      document.addEventListener = riktigAdd;
      document.removeEventListener = riktigRemove;
    }
  });
});

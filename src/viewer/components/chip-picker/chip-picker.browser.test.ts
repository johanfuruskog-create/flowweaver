import { afterEach, describe, expect, test } from "vitest";

import "./chip-picker";

/**
 * Kontrollen ska se likadan ut var den än monteras.
 *
 * ## Vad `compact` får ändra, och inte
 *
 * Johan: *etiketten skiljer sig från hur det ser ut i visaren.* Och han har
 * rätt — `compact` krympte både träffytan OCH ritningen, så samma kontroll
 * hade två utseenden. Att den ser likadan ut är hela skälet att den är en.
 *
 * Träffytan är däremot avsiktligt olika: 44px i visaren, som möts av fingrar,
 * och 24 i editorn, som används vid ett tangentbord (WCAG 2.2 AA:s golv,
 * 2.5.8). Det går ihop just för att krysset **ritas litet och träffas stort** —
 * ytan läggs på med ett pseudoelement, så bilden får vara densamma medan måttet
 * skiljer sig.
 *
 * Alternativknapparna är en annan sak och krymper fortfarande: de är många, de
 * står i en smal panel, och de är inte etiketten.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function picker(compact: boolean): Promise<HTMLElement> {
  const element = document.createElement("chip-picker") as HTMLElement & {
    options: Array<{ label: string; value: string }>;
    value: string[];
  };

  if (compact) element.setAttribute("compact", "");
  document.body.append(element);
  element.options = [{ label: "Danmark", value: "DK" }, { label: "Tyskland", value: "DE" }];
  element.value = ["DK"];
  await settle();

  return element;
}

const chipOf = (element: HTMLElement): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>("[data-chosen]")!;

const drawn = (element: HTMLElement): Record<string, string> => {
  const label = element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__chip-label")!;
  const style = getComputedStyle(label);

  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    höjd: `${Math.round(chipOf(element).getBoundingClientRect().height)}`,
    radie: getComputedStyle(chipOf(element)).borderRadius,
  };
};

describe("etiketten", () => {
  test("ritas likadant med och utan compact", async () => {
    expect(drawn(await picker(true))).toEqual(drawn(await picker(false)));
  });

  test("och krysset syns lika stort", async () => {
    const kryss = (element: HTMLElement): string =>
      getComputedStyle(element.shadowRoot!.querySelector(".chip-picker__chip-remove")!).width;

    expect(kryss(await picker(true))).toBe(kryss(await picker(false)));
  });
});

describe("träffytan", () => {
  test("är 44 px i visaren", async () => {
    const element = await picker(false);
    const kryss = element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!;
    const mitt = kryss.getBoundingClientRect();

    for (const [dx, dy] of [[-21, -21], [21, 21]] as const) {
      const träff = element.shadowRoot!.elementFromPoint(
        mitt.left + mitt.width / 2 + dx,
        mitt.top + mitt.height / 2 + dy,
      );

      expect(träff === kryss || kryss.contains(träff)).toBe(true);
    }
  });

  test("och 24 px i editorn — ett tangentbord, inte ett finger", async () => {
    const element = await picker(true);
    const kryss = element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!;
    const mitt = kryss.getBoundingClientRect();
    const x = mitt.left + mitt.width / 2;
    const y = mitt.top + mitt.height / 2;

    expect(element.shadowRoot!.elementFromPoint(x + 11, y + 11) === kryss).toBe(true);
    // Och inte mer än så: ytan ska inte äta grannens.
    expect(element.shadowRoot!.elementFromPoint(x + 21, y) === kryss).toBe(false);
  });

  test("och sökrutan är 16px också i editorn", async () => {
    /*
     * Inte en smakfråga: allt under 16px får iOS att zooma in sidan när
     * fältet får fokus, och sedan står editorn kvar inzoomad. Johan bygger
     * guider på en iPad, så panelen möts av samma webbläsare som visaren.
     */
    const element = document.createElement("chip-picker") as HTMLElement & {
      options: Array<{ label: string; value: string }>;
    };

    element.setAttribute("compact", "");
    document.body.append(element);
    // Över tröskeln, annars finns ingen sökruta att mäta.
    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    const search = element.shadowRoot!.querySelector(".chip-picker__search")!;

    expect(search, "ingen sökruta att mäta").not.toBeNull();
    expect(getComputedStyle(search).fontSize).toBe("16px");
  });
});

describe("sökträffarna", () => {
  const many = async (): Promise<HTMLElement> => {
    const element = document.createElement("chip-picker") as HTMLElement & {
      options: Array<{ label: string; value: string }>;
    };

    document.body.append(element);
    element.options = ["Danmark", "Jordanien", "Sudan", "Sydsudan", "Sverige",
      "Norge", "Island", "Finland", "Tyskland", "Polen"]
      .map((label) => ({ label, value: label }));
    await settle();

    return element;
  };

  const type = async (element: HTMLElement, term: string): Promise<void> => {
    element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();

    const search = element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

    search.value = term;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  };

  test("ligger ovanpå innehållet, inte i flödet", async () => {
    /*
     * Johan ringade in dem: träffarna sköt ner resten av regeln — knappen
     * "Ta bort regeln" hamnade under fyra landknappar, och nästa regel
     * längre ner för varje bokstav man skrev. En lista som växer under
     * fingret flyttar det man siktar på.
     *
     * Samma lösning som uppslagsfältets förslag: förankrad under rutan,
     * ovanpå det som står under.
     */
    const element = await many();

    await type(element, "dan");

    const lista = element.shadowRoot!.querySelector<HTMLElement>("[data-options]")!;

    expect(getComputedStyle(lista).position).toBe("absolute");
  });

  test("och tar ingen höjd i kontrollen", async () => {
    const element = await many();
    const före = element.getBoundingClientRect().height;

    await type(element, "dan");

    expect(element.getBoundingClientRect().height).toBe(före);
  });

  test("stängs när man valt", async () => {
    /*
     * Man skrev för att hitta en sak. När den är vald är listan gjord — och
     * en öppen lista som ligger kvar över innehållet är i vägen.
     */
    const element = await many();

    await type(element, "dan");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="Danmark"]')!.click();
    await settle();

    expect(element.shadowRoot!.querySelectorAll("[data-add]")).toHaveLength(0);
    expect(element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!.value).toBe("");
  });


  test("men RUTAN växer på höjden när många läggs till", async () => {
    /*
     * Johans krav, och skillnaden mot träffarna: det VALDA ska få plats.
     * Etiketterna radbryts och rutan blir högre — man ska se allt man valt
     * utan att rulla inuti en liten låda. Träffarna ligger ovanpå just för
     * att de INTE ska flytta något; det valda är svaret och får ta plats.
     */
    const element = document.createElement("chip-picker") as HTMLElement & {
      options: Array<{ label: string; value: string }>;
      value: string[];
    };

    document.body.append(element);
    element.style.width = "300px";
    element.options = Array.from({ length: 20 }, (_, at) => ({
      label: `Ett ganska långt namn ${at}`,
      value: `v${at}`,
    }));
    element.value = ["v0"];
    await settle();

    const box = () => element.shadowRoot!.querySelector(".chip-picker__box")!;
    const en = box().getBoundingClientRect().height;

    element.value = Array.from({ length: 12 }, (_, at) => `v${at}`);
    await settle();

    const tolv = box().getBoundingClientRect();

    expect(tolv.height).toBeGreaterThan(en * 3);
    // Och ingen inre rullning: allt valt syns.
    expect(box().scrollHeight).toBeLessThanOrEqual(Math.ceil(tolv.height) + 1);
  });

  test("och statusraden böjer sig efter antalet", async () => {
    /*
     * Johan: *när det bara är ett värde valt, skriv "1 vald".* Svenskan böjer
     * sig efter antalet, och "1 valda" är fel på ett sätt som får texten att se
     * maskinskriven ut — vilket den ju är, men det ska inte synas.
     *
     * Formen väljs av kontrollen, inte av värden: den är den enda som vet
     * antalet i det ögonblick raden skrivs.
     */
    const element = document.createElement("chip-picker") as HTMLElement & {
      options: Array<{ label: string; value: string }>;
      value: string[];
      strings: Record<string, string>;
    };

    document.body.append(element);
    element.strings = {
      added: "{label} tillagt. {n} valda.",
      addedOne: "{label} tillagt. 1 vald.",
      removed: "{label} borttaget. {n} valda.",
      removedOne: "{label} borttaget. 1 vald.",
    };
    element.options = [
      { label: "Sverige", value: "SE" },
      { label: "Danmark", value: "DK" },
    ];
    await settle();

    const status = () => element.shadowRoot!.querySelector("[data-status]")!.textContent?.trim();
    const öppna = () =>
      element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!
        .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    const lagg = (v: string) => {
      öppna();
      element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-add][data-value="${v}"]`)!.click();
    };

    lagg("SE");
    await settle();
    expect(status()).toBe("Sverige tillagt. 1 vald.");

    lagg("DK");
    await settle();
    expect(status()).toBe("Danmark tillagt. 2 valda.");

    element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();
    expect(status()).toBe("Sverige borttaget. 1 vald.");
  });

  test("en kort lista står inte och tar plats", async () => {
    /*
     * Johan i mottagarlistan: alternativen låg som ett block under fältet och
     * tog plats hela tiden. Det var undantaget "kort lista visar allt", och
     * det var fel av samma skäl som den långa listan: ytan är inte kontrollens
     * att ta innan någon använt den.
     *
     * Nu finns bara en regel — alternativen visas när kontrollen används, och
     * alltid ovanpå. En regel färre, inte en till.
     */
    const element = await picker(false);

    expect(element.shadowRoot!.querySelectorAll("[data-add]")).toHaveLength(0);
  });

  test("men kommer fram när man går in i den", async () => {
    const element = await picker(false);

    element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();

    expect(element.shadowRoot!.querySelectorAll("[data-add]").length).toBeGreaterThan(0);
    expect(
      getComputedStyle(element.shadowRoot!.querySelector("[data-options]")!).position,
    ).toBe("absolute");
  });

  test("och försvinner när man lämnar den", async () => {
    /*
     * Att lämna kontrollen betyder att fokus pekar ut något annat. En
     * `focusout` UTAN mottagare räknas inte längre — den säger inte att fokus
     * gick ut, den säger att webbläsaren inte vet vart, och Safari skickar
     * just den när ett finger landar på en knapp i listan. Simuleringen är
     * rättad; påståendet är detsamma. Se `chip-picker-pointer.browser.test.ts`.
     */
    const utanför = document.createElement("input");

    document.body.append(utanför);

    const element = await picker(false);
    // Hämtas om efter varje omritning: rutan är ett nytt element då, och en
    // händelse på den gamla når ingen.
    const box = () => element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!;

    box().dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();
    box().dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true, relatedTarget: utanför }),
    );
    await settle(120);

    expect(element.shadowRoot!.querySelectorAll("[data-add]")).toHaveLength(0);
  });
});

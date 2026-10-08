import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";

import "./chip-picker";

import type { LookupResult } from "../../services/lookup-service";

/**
 * Var alternativen kommer ifrån, och rutan man söker i.
 *
 * ## En källa, två hastigheter
 *
 * Kontrollen hämtade förut bara ur en färdig lista, och uppslagsfältet bara
 * ur en tjänst. Det var det första av tre skäl att hålla dem isär — och det
 * höll inte: **en lokal lista är en sökning som råkar svara direkt.** Värden
 * som redan sätter `options` märker ingenting; den som sätter `search` får
 * fördröjning, sekvensnummer, "Söker…" och ett feltillstånd.
 *
 * ## Rutan skapas en gång
 *
 * Pillboxen byggde om hela sin skugga vid varje tangenttryck och satte
 * tillbaka markören för hand. Det håller inte på en platta: skärmtangentbordet
 * hör ihop med ETT element, och byts elementet ut mitt i en inmatning fälls
 * tangentbordet ihop. Rutan ritas därför i `render()`, en gång, och `paint()`
 * ritar om allt runt den.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Picker = HTMLElement & {
  options: Array<{ label: string; value: string; hint?: string }>;
  value: string[];
  choices: Array<{ label: string; value: string }>;
  text: string;
  search: (term: string) => Promise<LookupResult>;
  strings: Record<string, string>;
};

const KOMMUNER = [
  { value: "1880", label: "Örebro", hint: "Örebro län" },
  { value: "1881", label: "Kumla" },
  { value: "0180", label: "Stockholm" },
];

function mount(): Picker {
  const element = document.createElement("chip-picker") as Picker;

  document.body.append(element);

  return element;
}

const searchBox = (element: Picker): HTMLInputElement =>
  element.shadowRoot!.querySelector<HTMLInputElement>("[data-search]")!;

const shown = (element: Picker): string[] =>
  [...element.shadowRoot!.querySelectorAll("[data-add]")].map(
    (one) => one.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );

const count = (element: Picker): string =>
  element.shadowRoot!.querySelector("[data-count]")?.textContent?.trim() ?? "";

const status = (element: Picker): string =>
  element.shadowRoot!.querySelector("[data-status]")?.textContent?.trim() ?? "";

async function type(element: Picker, term: string): Promise<void> {
  const box = searchBox(element);

  box.focus();
  box.value = term;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(320);
}

describe("en färdig lista är en sökning som svarar direkt", () => {
  test("filtreringen sker utan att en enda fördröjning passeras", async () => {
    /*
     * Mätt och inte antaget: en tidsutlösare skulle ha lagt 200 ms mellan
     * varje bokstav i editorns egna listor, där svaret redan finns i minnet.
     * Räknas på `setTimeout`, för det är den fördröjningen består av.
     */
    const element = mount();

    element.options = ["Danmark", "Jordanien", "Sudan", "Sydsudan", "Sverige",
      "Norge", "Island", "Finland", "Tyskland", "Polen"]
      .map((label) => ({ label, value: label }));
    await settle();

    const timer = vi.spyOn(window, "setTimeout");

    try {
      searchBox(element).focus();
      searchBox(element).value = "dan";
      searchBox(element).dispatchEvent(new Event("input", { bubbles: true }));

      expect(shown(element), "listan väntade på en fördröjning").toEqual([
        "Danmark",
        "Jordanien",
        "Sudan",
        "Sydsudan",
      ]);
      expect(timer).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });
});

describe("en källa som söker", () => {
  function remote(
    search: (term: string) => Promise<LookupResult> = async () => ({
      items: KOMMUNER,
      error: null,
    }),
  ): Picker {
    const element = mount();

    element.setAttribute("single", "");
    element.setAttribute("min-chars", "2");
    element.search = search;
    element.strings = {
      hint: "Skriv minst {n} tecken för att söka",
      searching: "Söker…",
      error: "Uppslaget kunde inte nås",
      noMatches: "Inga träffar på {term}",
      count: "{n} alternativ",
      oneLeft: "1 alternativ",
      // A search counts matches (uppdrag 29/9 Del D).
      matches: "{n} träffar",
      oneMatch: "1 träff",
      removed: "{label} borttaget. {n} valda.",
      removedOne: "{label} borttaget. 1 vald.",
    };

    return element;
  }

  test("söker inte förrän minsta antalet tecken är skrivet", async () => {
    const search = vi.fn(async () => ({ items: KOMMUNER, error: null }));
    const element = remote(search);

    await type(element, "ö");

    expect(search).not.toHaveBeenCalled();
    expect(shown(element)).toEqual([]);
    expect(status(element)).toBe("Skriv minst 2 tecken för att söka");
  });

  test("och öppnar listan med ett alternativ per träff", async () => {
    const element = remote();

    await type(element, "öre");

    expect(shown(element)).toEqual(["Örebro Örebro län", "Kumla", "Stockholm"]);
  });

  test("antalet sägs EN gång, i raden som läses upp", async () => {
    /*
     * Uppslaget sa "3 förslag, använd piltangenterna". Modellen har inga
     * piltangenter — alternativen är riktiga knappar i tabbordningen — så
     * raden säger antalet och inget mer.
     *
     * Och den säger det i statusraden, inte i räkneraden. Båda raderna syns;
     * när svaret lades i statusraden för skärmläsarens skull stod "Inga
     * träffar på Tyra" två gånger under rutan — Johans mätning på plattan,
     * kommunexemplet 31/8. En sökt källa har därför bara den ena raden.
     */
    const element = remote();

    await type(element, "öre");

    expect(status(element)).toBe("3 träffar");
    expect(count(element), "räkneraden upprepar statusraden").toBe("");
  });

  test("ingen träff stänger listan och säger det, en gång", async () => {
    const element = remote(async () => ({ items: [], error: null }));

    await type(element, "xyz");

    expect(shown(element)).toEqual([]);
    expect(status(element)).toBe("Inga träffar på xyz");
    expect(count(element), "räkneraden upprepar statusraden").toBe("");
  });

  test("ett fel stänger listan och säger det", async () => {
    const element = remote(async () => ({ items: [], error: "503" }));

    await type(element, "öre");

    expect(shown(element)).toEqual([]);
    expect(status(element)).toBe("Uppslaget kunde inte nås");
  });

  test("ett omkört svar skriver inte över ett nyare", async () => {
    let anrop = 0;
    const element = remote(async (term) => {
      anrop += 1;
      await new Promise((resolve) => setTimeout(resolve, anrop === 1 ? 400 : 0));
      return { items: [{ value: term, label: `Träff på ${term}` }], error: null };
    });

    await type(element, "aaa");
    await type(element, "bbb");
    await settle(700);

    expect(shown(element)).toEqual(["Träff på bbb"]);
  });

  test("knappen väljer, och paret följer med ut", async () => {
    const element = remote();
    const rapporterat: unknown[] = [];

    element.addEventListener("chip-change", (event) => {
      rapporterat.push((event as CustomEvent).detail);
    });

    await type(element, "öre");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1880"]')!.click();
    await settle();

    expect(element.value).toEqual(["1880"]);
    expect(element.choices).toEqual([{ label: "Örebro", value: "1880" }]);
    expect(rapporterat.at(-1)).toEqual({
      value: ["1880"],
      choices: [{ label: "Örebro", value: "1880" }],
    });
  });

  test("och valet syns som en etikett i rutan, inte som text i den", async () => {
    /*
     * Johans beslut 31/8, med förbehållet att han vill se det på plattan:
     * enkelvalet ser ut som flervalet, för det ÄR samma kontroll.
     */
    const element = remote();

    await type(element, "öre");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1880"]')!.click();
    await settle();

    expect(
      element.shadowRoot!.querySelector("[data-chosen] .chip-picker__chip-label")?.textContent?.trim(),
    ).toBe("Örebro");
    expect(searchBox(element).value, "etiketten stod kvar i sökrutan").toBe("");
  });

  test("och platshållaren släcks när något är valt", async () => {
    /*
     * Johan på plattan 31/8, kommunexemplet: chippet "Lekplats" och bredvid
     * det "Börja skriva, t.ex. belysning". Frågan är besvarad, och en
     * uppmaning att skriva bredvid svaret säger emot chippet. I flerval är
     * platshållaren rätt — rutan bjuder in nästa val — så den står kvar där.
     */
    const element = remote();

    expect(searchBox(element).placeholder).not.toBe("");

    await type(element, "öre");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1880"]')!.click();
    await settle();

    expect(searchBox(element).placeholder, "platshållaren bredvid ett valt chip").toBe("");
  });

  test("Backspace i en tom sökruta tar bort det sista chippet", async () => {
    /*
     * Det varje pillbox gör: när det inte finns något att sudda i rutan
     * suddar Backspace det senast valda. Fokus står kvar i rutan, och raden
     * säger vad som hände — samma väg som krysset.
     */
    const element = remote();

    element.removeAttribute("single");
    await type(element, "öre");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1880"]')!.click();
    await settle();
    await type(element, "kum");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1881"]')!.click();
    await settle();
    expect(element.value).toEqual(["1880", "1881"]);

    const box = searchBox(element);

    box.focus();
    await userEvent.keyboard("{Backspace}");
    await settle();

    expect(element.value, "sista chippet borta").toEqual(["1880"]);
    expect(status(element)).toContain("borttaget");
    expect(element.shadowRoot!.activeElement, "fokus står kvar i rutan").toBe(searchBox(element));

    // Med text i rutan suddar Backspace texten, inte ett chip.
    await type(element, "st");
    await userEvent.keyboard("{Backspace}");
    await settle();

    expect(element.value).toEqual(["1880"]);
    expect(searchBox(element).value).toBe("s");
  });

  test("valet töms när man skriver vidare", async () => {
    /*
     * Koden gäller bara det man valt. Skriver man vidare är svaret fri text
     * igen, och en kvarliggande kod hade blivit en tyst lögn.
     */
    const element = remote();

    await type(element, "öre");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="1880"]')!.click();
    await settle();
    expect(element.value).toEqual(["1880"]);

    await type(element, "Öreb");

    expect(element.value).toEqual([]);
    expect(element.text).toBe("Öreb");
  });

  test("men en färdig lista tappar inte sitt val av att man söker", async () => {
    // Editorns tre värdar: ett villkorsvärde är valt tills någon tar bort det.
    const element = mount();

    element.setAttribute("single", "");
    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    element.value = ["L3"];
    await settle();

    await type(element, "Land 5");

    expect(element.value).toEqual(["L3"]);
  });

  test("Escape stänger listan", async () => {
    const element = remote();

    await type(element, "öre");
    expect(shown(element).length).toBeGreaterThan(0);

    searchBox(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(shown(element)).toEqual([]);
  });
});

describe("upplysningen bredvid etiketten", () => {
  test("ritas nedtonad på alternativet", async () => {
    /*
     * Två Örebro i samma lista är två kommuner man inte kan skilja åt.
     * `hint` är det som skiljer dem, och den ska inte läsas som en del av
     * namnet — därav den egna, svagare tonen.
     */
    const element = mount();

    element.options = KOMMUNER;
    element.strings = { search: "Sök…" };
    await settle();

    element.shadowRoot!.querySelector<HTMLElement>(".chip-picker__box")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await settle();

    const hint = element.shadowRoot!.querySelector<HTMLElement>(
      '[data-add][data-value="1880"] .chip-picker__option-hint',
    );

    expect(hint?.textContent?.trim()).toBe("Örebro län");
    expect(
      getComputedStyle(hint!).color,
      "upplysningen ritas som namnet",
    ).not.toBe(
      getComputedStyle(
        element.shadowRoot!.querySelector<HTMLElement>(
          '[data-add][data-value="1880"] .chip-picker__option-label',
        )!,
      ).color,
    );
  });
});

describe("sökrutan står kvar", () => {
  test("är samma element före och efter ett tangenttryck", async () => {
    /*
     * Skärmtangentbordet på en platta hör ihop med ETT element. Byts det ut
     * mitt i inmatningen fälls tangentbordet ihop, och markören måste sättas
     * tillbaka för hand — vilket pillboxen gjorde, vid varje bokstav.
     */
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    const före = searchBox(element);

    await type(element, "Land 1");

    expect(searchBox(element)).toBe(före);
  });

  test("och överlever att något väljs och tas bort", async () => {
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    const före = searchBox(element);

    await type(element, "Land 1");
    element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="L1"]')!.click();
    await settle();
    element.shadowRoot!.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    await settle();

    expect(searchBox(element)).toBe(före);
  });

  test("och fokus lämnar den aldrig under ett riktigt klick", async () => {
    /*
     * Den skarpa mätningen bakom hela pekarmönstret: rutan blurrades en gång
     * före fixen — dels av att knappen tog fokus, dels av att omritningen
     * kastade bort själva elementet. Noll efter.
     */
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    await type(element, "Land 1");

    const box = searchBox(element);
    let blurrad = 0;

    box.focus();
    box.addEventListener("blur", () => { blurrad += 1; });

    await userEvent.click(
      element.shadowRoot!.querySelector<HTMLButtonElement>('[data-add][data-value="L1"]')!,
    );
    await settle(120);

    expect(blurrad, "sökrutan tappade fokus under valet").toBe(0);
    expect(element.value).toEqual(["L1"]);
  });
});

describe("stängningen rör inte det som skrivits", () => {
  /*
   * Med en sökt källa ÄR rutan svarsfältet: en uppslagsfråga kan tillåta ett
   * svar som inte står på listan (`allowFreeText`), och då är det man skrivit
   * hela svaret. Gamla uppslagsfältet rörde aldrig sin input när listan
   * stängdes. Pillboxens `close()` tömde den — för där är rutan ett filter,
   * och ett filter ska inte ligga kvar.
   *
   * Regeln är alltså källans, inte gestens: en färdig lista töms, en sökt
   * behåller.
   */
  function remote(): Picker {
    const element = mount();

    element.setAttribute("single", "");
    element.setAttribute("min-chars", "2");
    element.search = async () => ({ items: KOMMUNER, error: null });

    return element;
  }

  test("en sökt källa behåller texten när man trycker utanför", async () => {
    const utanför = document.createElement("div");

    document.body.append(utanför);

    const element = remote();

    await type(element, "Kum");
    expect(shown(element).length).toBeGreaterThan(0);

    utanför.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await settle();

    expect(element.text, "svaret man skrev försvann när listan stängdes").toBe("Kum");
    expect(shown(element), "listan stod kvar öppen").toEqual([]);
  });

  test("och när fokus lämnar kontrollen", async () => {
    const utanför = document.createElement("input");

    document.body.append(utanför);

    const element = remote();

    await type(element, "Kum");

    searchBox(element).dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true, relatedTarget: utanför }),
    );
    await settle();

    expect(element.text).toBe("Kum");
    expect(shown(element)).toEqual([]);
  });

  test("men en färdig lista tömmer sitt filter", async () => {
    const utanför = document.createElement("div");

    document.body.append(utanför);

    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    await type(element, "Land 1");

    utanför.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await settle();

    expect(element.text, "filtret låg kvar över nästa gång kontrollen öppnas").toBe("");
  });

  test("och ett sent svar öppnar inte listan igen efter stängningen", async () => {
    /*
     * Utan att sekvensnumret räknas upp vid stängning landar svaret på den
     * sökning som pågick, sätter `open` och målar — och listan står plötsligt
     * öppen ovanpå det besökaren tryckte på.
     */
    const utanför = document.createElement("div");

    document.body.append(utanför);

    const element = mount();

    element.setAttribute("min-chars", "2");
    element.search = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { items: KOMMUNER, error: null };
    };

    const box = searchBox(element);

    box.focus();
    box.value = "Kum";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    // Efter fördröjningen, medan uppslaget är i luften.
    await settle(260);

    utanför.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await settle(400);

    expect(shown(element), "det sena svaret öppnade listan igen").toEqual([]);
  });
});

describe("när sökningen är klar", () => {
  /*
   * Skärmläsaren hörde "Söker…" och sedan tystnad: räkneraden är inte en
   * live-region, och pillboxens regel att inte läsa upp antalet per
   * tangenttryck skrevs för en lokal lista. En sökt källa svarar EFTER 200 ms
   * fördröjning — svaret är en händelse, inte en bokstav, och det är precis
   * vad en live-region är till för. Gamla uppslagsfältet sa "3 förslag".
   */
  function remote(
    search: (term: string) => Promise<LookupResult>,
  ): Picker {
    const element = mount();

    element.setAttribute("min-chars", "2");
    element.search = search;
    element.strings = {
      searching: "Söker…",
      noMatches: "Inga träffar på {term}",
      count: "{n} alternativ",
      oneLeft: "1 alternativ",
      // A search counts matches (uppdrag 29/9 Del D).
      matches: "{n} träffar",
      oneMatch: "1 träff",
    };

    return element;
  }

  test("säger antalet i live-regionen", async () => {
    const element = remote(async () => ({ items: KOMMUNER, error: null }));

    await type(element, "öre");

    expect(status(element)).toBe("3 träffar");
  });

  test("och säger det när det inte blev några", async () => {
    const element = remote(async () => ({ items: [], error: null }));

    await type(element, "xyz");

    expect(status(element)).toBe("Inga träffar på xyz");
  });

  test("men en färdig lista tiger vid varje bokstav", async () => {
    /*
     * Vakten åt andra hållet. Där finns ingen fördröjning som samlar ihop
     * tangenttrycken, så en uppläsning per bokstav gör regionen obrukbar.
     */
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    await type(element, "Land 1");

    expect(status(element)).toBe("");
  });
});

describe("Escape", () => {
  test("sväljs inte av en stängd kontroll", async () => {
    /*
     * Kontrollen sitter i dialoger som stängs med Escape. Att stoppa
     * händelsen ovillkorligt gjorde en stängd pillbox till en fälla: dialogen
     * fick aldrig veta.
     */
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    let nådde = 0;

    document.addEventListener("keydown", () => { nådde += 1; }, { once: true });

    searchBox(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );

    expect(nådde, "en stängd kontroll svalde dialogens Escape").toBe(1);
  });

  test("men stoppas när listan var öppen", async () => {
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    await settle();

    await type(element, "Land 1");
    expect(shown(element).length).toBeGreaterThan(0);

    let nådde = 0;

    document.addEventListener("keydown", () => { nådde += 1; }, { once: true });

    searchBox(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );
    await settle();

    expect(nådde, "Escape som stängde listan gick vidare till dialogen").toBe(0);
    expect(shown(element)).toEqual([]);
  });
});

describe("valen jämförs utan att kunna krocka", () => {
  test("två olika par läses inte som samma", async () => {
    /*
     * Settern jämförde `${label} ${value}` sammanfogat utan avgränsare, så
     * `[{label:"a b", value:"c"}]` och `[{label:"a", value:"b c"}]` blev
     * samma sträng — och den andra skrivningen ignorerades tyst.
     */
    const element = mount();

    element.choices = [{ label: "a b", value: "c" }];
    await settle();

    element.choices = [{ label: "a", value: "b c" }];
    await settle();

    expect(element.choices).toEqual([{ label: "a", value: "b c" }]);
  });
});

describe("en sluten lista öppnas utan att man skriver", () => {
  /*
   * Bär över från uppslagsfältets `min-chars="0"`.
   *
   * Med ett adressregister är skrivandet enda vettiga vägen in: ingen vill se
   * varje adress. Med en SLUTEN lista — länder, kommuner, ärendetyper — har
   * den som inte vet hur vi stavar det ingenting att skriva. Listan säger
   * *Belarus*, man tänker Vitryssland. Synonymer svarar på hälften av det; att
   * kunna titta svarar på andra hälften.
   */
  const ITEMS = [
    { value: "SE", label: "Sverige" },
    { value: "DK", label: "Danmark" },
    { value: "FI", label: "Finland" },
  ];

  function mountWith(minChars: string): Picker {
    const element = mount();

    element.setAttribute("single", "");
    element.setAttribute("min-chars", minChars);
    element.search = async (term: string) => ({
      items: ITEMS.filter((item) =>
        item.label.toLowerCase().includes(term.trim().toLowerCase()),
      ),
      error: null,
    });

    return element;
  }

  test("visar listan när man kommer till den, innan något skrivits", async () => {
    const element = mountWith("0");

    searchBox(element).focus();
    await settle(320);

    expect(shown(element)).toEqual(["Sverige", "Danmark", "Finland"]);
  });

  test("och filtrerar så snart något skrivs", async () => {
    const element = mountWith("0");

    searchBox(element).focus();
    await settle(320);
    await type(element, "dan");

    expect(shown(element)).toEqual(["Danmark"]);
  });

  test("men ett fält som ber om två tecken står stängt", async () => {
    // Förvalet är oförändrat: ett adressregister har ingenting att göra med
    // att visa allt det vet i samma stund någon tabbar in i det.
    const element = mountWith("2");

    searchBox(element).focus();
    await settle(320);

    expect(shown(element)).toEqual([]);
  });
});

describe("rutan är EN kontroll", () => {
  /*
   * Bär över från uppslagsfältet, och vaktar den delade `_picker.scss`: två
   * ramar innanför varandra är det som får en väljare att se hemmagjord ut.
   * Mäts som bredd, inte som klassnamn — ett namn kan bytas medan bilden säger
   * något annat.
   */
  async function withChip(): Promise<Picker> {
    const element = mount();

    element.options = Array.from({ length: 12 }, (_, at) => ({
      label: `Land ${at}`,
      value: `L${at}`,
    }));
    element.value = ["L0"];
    await settle();

    return element;
  }

  test("rutan bär ramen, inte sökrutan", async () => {
    const element = await withChip();
    const kant = (el: Element): string => getComputedStyle(el).borderTopWidth;

    expect(kant(element.shadowRoot!.querySelector(".chip-picker__box")!)).not.toBe("0px");
    expect(kant(searchBox(element))).toBe("0px");
  });

  test("och etiketten står på samma rad som sökrutan så länge den får plats", async () => {
    const element = await withChip();
    const chip = element.shadowRoot!
      .querySelector<HTMLElement>("[data-chosen]")!
      .getBoundingClientRect();

    expect(searchBox(element).getBoundingClientRect().left).toBeGreaterThan(chip.right - 1);
  });

  test("och valen överlever att ett annat attribut ändras", async () => {
    /*
     * Uppslagsfältet läste sina val ur attribut och byggde om listan ur dem,
     * så en platshållare som bytte språk kunde tömma svaret. Kontrollen tar
     * valen som EGENSKAP och har ingen attributväg tillbaka — det här testet
     * finns för att den inte ska få en.
     */
    const element = await withChip();

    element.setAttribute("label", "Något annat");
    element.setAttribute("compact", "");
    await settle();

    expect(element.value).toEqual(["L0"]);
  });
});

describe("när man kommer tillbaka till en sökt ruta", () => {
  test("söks det om, i stället för att raden ljuger om en lista som slängts", async () => {
    /*
     * `close()` behåller texten för en sökt källa — rutan är svarsfältet — men
     * slänger det listan höll, för listan är borta. Utan en ny sökning stod
     * räkneraden kvar och beskrev det som slängdes: "Inga träffar på Kum"
     * under en ruta ingen hade sökt med.
     */
    const utanför = document.createElement("div");

    document.body.append(utanför);

    const element = mount();
    let anrop = 0;

    element.setAttribute("single", "");
    element.setAttribute("min-chars", "2");
    element.search = async () => {
      anrop += 1;
      return { items: KOMMUNER, error: null };
    };
    element.strings = {
      noMatches: "Inga träffar på {term}",
      count: "{n} alternativ",
      searching: "Söker…",
    };

    await type(element, "Kum");
    expect(anrop).toBe(1);

    utanför.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await settle();

    expect(element.text, "texten skulle stå kvar").toBe("Kum");
    expect(count(element), "raden beskrev en lista som inte finns").toBe("");

    searchBox(element).dispatchEvent(
      new FocusEvent("focusin", { bubbles: true, composed: true }),
    );
    await settle(320);

    expect(anrop, "ingen ny sökning gjordes").toBe(2);
    expect(shown(element).length).toBeGreaterThan(0);
  });

  test("och texten går att skriva tillbaka utan att en sökning startar", async () => {
    /*
     * Värdens väg att lämna tillbaka fri text vid ett steg bakåt. Att skriva
     * den ska inte öppna en lista besökaren inte bett om, och inte heller
     * eka värdens egen skrivning tillbaka som en ändring.
     */
    const element = mount();
    let anrop = 0;
    let rapporter = 0;

    element.setAttribute("single", "");
    element.setAttribute("min-chars", "2");
    element.search = async () => {
      anrop += 1;
      return { items: KOMMUNER, error: null };
    };
    element.addEventListener("chip-change", () => { rapporter += 1; });
    await settle();

    element.text = "Ödeshög";
    await settle(320);

    expect(element.text).toBe("Ödeshög");
    expect(searchBox(element).value).toBe("Ödeshög");
    expect(anrop, "en sökning startade av en återställning").toBe(0);
    expect(rapporter, "återställningen ekades tillbaka som en ändring").toBe(0);
    expect(shown(element)).toEqual([]);
  });
});

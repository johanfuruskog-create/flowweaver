import { afterEach, describe, expect, test } from "vitest";

import "./publish-dialog";

import type { PublishDialog, PublishRequest } from "./publish-dialog";
import type { GuideChange } from "../../../viewer/services/guide-diff-service";
import type { GuideHealthIssue } from "../../services/guide-health-service";

/**
 * Hur en rad i granskningen är byggd (berättelse 125, ändrad 22/9).
 *
 * ## Felet det här ursprungligen skrevs ur
 *
 * Johan såg det i bilderna 18/9: knappen *Frågan* stod till höger på raden
 * *steget har lagts till* och under texten på raderna som bär ett före och ett
 * efter. Knapparna vandrade alltså omkring i listan efter hur mycket text raden
 * råkade ha — och en kontroll man måste leta efter på varje rad är en kontroll
 * som kostar mer än den ger. Rättningen då gjorde knappen till höger
 * ovillkorligt, aldrig under texten.
 *
 * ## Varför det bytte riktning igen (Siv/Fable 22/9, LOGG samma dag)
 *
 * Den ovillkorliga sido-vid-sida-raden höll vid vanlig textstorlek men inte
 * vid `rot 32px` (200 % textförstoring, WCAG 1.4.4): dialogens fasta
 * `560px`-bredd växer inte med texten, så textkolumnen pressades till en
 * 28×2025 px remsa, ett tecken per rad, medan knappen tog allt mer plats i
 * samma fasta bredd. Johans beslut: text och knapp på VARSIN hela rad i en
 * enkolumns-grid — deterministiskt i alla storlekar, ingen bredd att
 * förhandla om. Se `publish-dialog.scss` vid `li` och
 * `publish-dialog-text-zoom.browser.test.ts`.
 *
 * Mätt i komponenten och inte i röken, för det är ett påstående om radens form
 * och inte om sidan runt omkring: här kan det fällas på en sekund.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CHANGES: GuideChange[] = [
  {
    kind: "node",
    nodeId: "r3",
    title: "Kontakta stadsbyggnadskontoret",
    message: "Kontakta stadsbyggnadskontoret: steget har lagts till.",
  },
  {
    kind: "content",
    nodeId: "q1",
    title: "Hur stor är tomten?",
    message: "Hur stor är tomten?: rubriken har ändrats.",
    before: "Hur stor är tomten, i kvadratmeter?",
    after: "Hur stor är tomten?",
  },
  {
    kind: "option",
    nodeId: "q1",
    title: "Hur stor är tomten?",
    message: 'Hur stor är tomten?: alternativet "Kanske" har lagts till.',
  },
];

async function open(width: string, over: Partial<PublishRequest> = {}, locale = "sv"): Promise<PublishDialog> {
  const element = document.createElement("publish-dialog") as PublishDialog;

  element.editorLocale = locale;
  document.body.append(element);
  element.style.setProperty("--test-width", width);

  const request: PublishRequest = {
    version: 4,
    previous: 3,
    changes: CHANGES,
    outline: false,
    issues: [],
    ...over,
  };

  void element.ask(request);
  await settle();

  // Bredden sätts på dialogen själv: elementet är `display: contents`, så en
  // bredd på värden når inte lådan.
  element.shadowRoot!.querySelector<HTMLDialogElement>("dialog")!.style.width = width;
  await settle();

  return element;
}

const previewButtons = (element: PublishDialog): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-changes-list] [data-preview]"),
];

describe("en rad i granskningen, förhandsgranskningsknappens namn (K3, öppen fråga 4)", () => {
  test("varje knapp bär radens egen nodtitel, inte bara den delade synliga texten", async () => {
    const element = await open("360px");
    const buttons = previewButtons(element);

    expect(buttons.length).toBe(3);
    // Synlig text delas medvetet — det är namnet för skärmläsaren
    // (aria-label) som måste skilja raderna åt, annars läser en
    // skärmläsare tre identiska "Förhandsgranska härifrån".
    for (const [index, button] of buttons.entries()) {
      expect(button.textContent?.trim(), `rad ${index}: synlig text oförändrad`).toBe("Förhandsgranska härifrån");
      expect(button.getAttribute("aria-label"), `rad ${index}: bär nodens titel`).toContain(CHANGES[index]!.title);
    }

    // Två olika noder ("Kontakta stadsbyggnadskontoret" och "Hur stor är
    // tomten?") ska ge två olika namn.
    const labels = new Set(buttons.map((button) => button.getAttribute("aria-label")));
    expect(labels.size, "minst två olika namn bland tre rader på två noder").toBeGreaterThanOrEqual(2);
  });
});

describe("en rad i granskningen", () => {
  test.each(["360px", "520px"])("knapparna står i samma kolumn vid %s", async (width) => {
    const element = await open(width);
    const buttons = previewButtons(element);
    const left = buttons.map((button) => button.getBoundingClientRect().left);

    expect(buttons.length, "en knapp per rad").toBe(3);
    expect(Math.max(...left) - Math.min(...left), "samma kolumn, oavsett hur mycket text raden bär").toBeLessThan(1);
  });

  /*
   * Ändrad 22/9: knappen ligger nu under sin egen text, på samma vänsterkant
   * som texten (en enkolumns-grid, se publish-dialog.scss) — aldrig ovanpå
   * eller till höger om den, oavsett hur många rader texten bryter till.
   */
  test("under sin egen text, aldrig ovanpå den, på samma vänsterkant", async () => {
    const element = await open("360px");
    const rows = [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-changes-list] li")];

    for (const row of rows) {
      const text = row.querySelector<HTMLElement>(".publish-dialog__text")!;
      const button = row.querySelector<HTMLElement>("[data-preview]")!;
      const textRect = text.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      expect(buttonRect.top, `knappen under texten: ${text.textContent?.slice(0, 20)}`).toBeGreaterThanOrEqual(
        textRect.bottom,
      );
      expect(Math.abs(buttonRect.left - textRect.left), "samma vänsterkant som texten").toBeLessThan(1);
    }
  });

  /*
   * Och ingen knapp hamnar utanför lådan. Det är samma fel UX fann i
   * versionslistan dagen innan: en knapp som ligger utanför sin behållare är
   * osynlig för den som inte kan rulla i sidled.
   */
  test("ingen knapp klipps mot dialogens kant", async () => {
    const element = await open("360px");
    const box = element.shadowRoot!.querySelector<HTMLDialogElement>("dialog")!.getBoundingClientRect();

    for (const button of previewButtons(element)) {
      const rect = button.getBoundingClientRect();

      expect(rect.right, "innanför högerkanten").toBeLessThanOrEqual(box.right);
      expect(rect.left, "innanför vänsterkanten").toBeGreaterThanOrEqual(box.left);
    }
  });

  /*
   * Mutationskontroll 28/9 (Per), Enhetlighet Del 5: knappen hette "Frågan" —
   * vad raden HANDLAR OM, inte vad knappen GÖR (den startar en förhandsvisning
   * från just den noden, `askPreview`/`publish-preview-intent`). Rättat till
   * en handling, samma verbform som syskonknappen "Förhandsgranska från
   * start". Ingen annan fil i repot läser strängens innehåll
   * (`editor.publish.previewNode`), bara att nyckeln finns — det här provet
   * är det enda som ser ordet.
   */
  test("knappen som förhandsgranskar en enskild fråga heter Förhandsgranska härifrån, sv och en", async () => {
    const svElement = await open("360px");

    for (const button of previewButtons(svElement)) {
      expect(button.textContent, "sv").toBe("Förhandsgranska härifrån");
    }

    const enElement = await open("360px", {}, "en");

    for (const button of previewButtons(enElement)) {
      expect(button.textContent, "en").toBe("Preview from here");
    }
  });
});

/*
 * QA, mutationskontroll (berättelse 125, kriterium 5, 7, 8, 10). Mätt i
 * komponenten och inte i röken (`smoke:guide-storage`), av samma skäl som
 * radens form ovan: det är ett påstående om dialogen själv, den enda platsen
 * `blocked()`, fokus, Esc och rollerna faktiskt avgörs — och röken kan just nu
 * inte köras (`guide-storage.ts` är mitt i en annan omgång ändringar).
 */

const ERROR: GuideHealthIssue = {
  code: "date-argument-not-date",
  severity: "error",
  nodeId: "q1",
  message: "Källan är varken en datumfråga eller ett personnummer.",
};

const WARNING: GuideHealthIssue = {
  code: "broken-email-copy",
  severity: "warning",
  nodeId: "q2",
  message: "Ingen fråga sätter variabeln.",
};

describe("blockerande fel", () => {
  /*
   * Johan 23/9: "konstig ram som skärs av" runt *Vad ändrades?*. Ringen ritas
   * 8 px utanför fältet, och kroppen rullar — alltså klipper den. Mätt som
   * avståndet från fältets kant till kroppens innehållskant, båda sidor.
   */
  test("fokusringen runt anteckningsfältet får plats i den rullande kroppen", async () => {
    const element = await open("560px");
    const body = element.shadowRoot!.querySelector<HTMLElement>(".publish-dialog__body")!;
    const input = element.shadowRoot!.querySelector<HTMLElement>("input")!;
    const b = body.getBoundingClientRect();
    const i = input.getBoundingClientRect();
    const gutter = body.offsetWidth - body.clientWidth; // scrollbar-gutter, if the engine draws one
    const room = { left: i.left - b.left, right: b.right - gutter - i.right };

    expect(room.left, JSON.stringify(room)).toBeGreaterThanOrEqual(8);
    expect(room.right, JSON.stringify(room)).toBeGreaterThanOrEqual(8);
  });

  test("ett fel gör Publicera inaktiv, med skälet i etiketten och alert-rollen", async () => {
    const element = await open("560px", { issues: [ERROR] });
    const root = element.shadowRoot!;
    const confirm = root.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
    const errors = root.querySelector<HTMLElement>("[data-errors]")!;

    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.getAttribute("aria-label")).toContain("Åtgärda felen först");
    expect(errors.hidden, "felraden syns").toBe(false);
    expect(errors.getAttribute("role")).toBe("alert");
  });

  test("bara varningar blockerar inte", async () => {
    const element = await open("560px", { issues: [WARNING] });
    const root = element.shadowRoot!;

    expect(root.querySelector('[data-action="confirm"]')!.getAttribute("aria-disabled")).toBe("false");
    expect(root.querySelector<HTMLElement>("[data-errors]")!.hidden, "ingen felrad").toBe(true);
    expect(root.querySelector<HTMLElement>("[data-warnings]")!.hidden, "varningsraden syns").toBe(false);
  });

  test("Gå till frågan stänger dialogen och skickar nodeId och anteckningen med sig", async () => {
    const element = await open("560px", { issues: [ERROR] });
    const root = element.shadowRoot!;

    root.querySelector<HTMLInputElement>("[data-input]")!.value = "Något att komma ihåg";

    let detail: { nodeId: string; note: string } | null = null;

    element.addEventListener("publish-goto-intent", (event) => {
      detail = (event as CustomEvent<{ nodeId: string; note: string }>).detail;
    });

    root.querySelector<HTMLButtonElement>("[data-goto]")!.click();
    await settle();

    expect(root.querySelector("dialog")!.open, "dialogen stängde").toBe(false);
    expect(detail).toEqual({ nodeId: "q1", note: "Något att komma ihåg" });
  });

  test("granskningens lista bär role=status", async () => {
    const element = await open("560px");

    expect(element.shadowRoot!.querySelector("[data-changes]")!.getAttribute("role")).toBe("status");
  });
});

describe("fokus, Esc och en stängd dialog", () => {
  test("rubriken tar fokus när dialogen öppnas", async () => {
    const element = await open("560px");

    expect(element.shadowRoot!.activeElement).toBe(element.shadowRoot!.querySelector("[data-title]"));
  });

  test("Esc stänger dialogen och löser med null, ingen anropar Publicera", async () => {
    const element = await open("560px");
    const dialog = element.shadowRoot!.querySelector<HTMLDialogElement>("dialog")!;

    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settle();

    expect(dialog.open, "stängde").toBe(false);
  });

  test("en stängd dialog tar inga klick — [open] är villkoret, inte elementnamnet", async () => {
    const element = document.createElement("publish-dialog") as PublishDialog;

    document.body.append(element);
    await settle();

    const dialog = element.shadowRoot!.querySelector<HTMLDialogElement>("dialog")!;

    expect(dialog.open, "aldrig öppnad").toBe(false);
    expect(getComputedStyle(dialog).display, "webbläsarens egen display: none för en stängd dialog").toBe("none");
  });
});

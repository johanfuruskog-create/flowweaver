import { userEvent } from "@vitest/browser/context";
import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";

/**
 * Story 118, kriterium 7: "Redaktören kan kräva att besökaren *rört* fältet,
 * inte bara att det har ett värde."
 *
 * `guide-traversal-engine.require-interaction.test.ts` mäter motorns dom på
 * `isUntouched` isolerat. Den här filen mäter visaren i en webbläsare.
 *
 * FORMEN ÄNDRAD 15/9 (Johan, e44b551): ett orört fält AVVISADES först —
 * fältfel, banderoll. Nu FRÅGAS det, i en modal `<dialog>`: *"Du har inte
 * ändrat {fält}, som står på {värde}. Vill du gå vidare ändå?"* med *Ändra*
 * (stannar, fokus i fältet) och *Gå vidare* (lägger namnet i touched och
 * prövar igen). Motorn är oförändrad dom — `validation.fieldUntouched` finns
 * kvar för en värd som kör motorn direkt utan visaren.
 *
 * OCH: ett INSKICKAT värde som skiljer sig från fältets ankomstvärde räknas
 * som ändrat av motorn själv (`isUntouched`s `submitted`-parameter), oavsett
 * om visaren sett en `input`/`change`-händelse. `touched` behövs bara för det
 * enda fall värdet inte kan avslöja: besökaren vill ha EXAKT det värde som
 * redan stod där. Det är dialogens enda ärende.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 100) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(graph: GraphData): Promise<GuidePreview> {
  const preview = document.createElement("guide-preview") as GuidePreview;
  document.body.append(preview);
  preview.graph = graph;
  await settle();
  return preview;
}

function pageField(preview: GuidePreview, variable: string): HTMLInputElement | null {
  return preview.shadowRoot?.querySelector<HTMLInputElement>(
    `input[data-page-variable="${variable}"]`,
  ) ?? null;
}

/** Fältets egen felruta i sidfältscellen — för ÄKTA fel (obligatoriskt,
 * format), inte längre för "orört" sedan dialogen (PRAXIS 12: rikta mot
 * elementet som bär påståendet). */
function fieldError(preview: GuidePreview, fieldId: string): string {
  return (
    preview.shadowRoot
      ?.querySelector(`[data-page-field-id="${fieldId}"] .guide-preview__field-error`)
      ?.textContent ?? ""
  );
}

function isInvalid(preview: GuidePreview, fieldId: string): boolean {
  return preview.shadowRoot?.querySelector(`[data-page-field-id="${fieldId}"]`)
    ?.hasAttribute("data-invalid") ?? false;
}

async function clickNext(preview: GuidePreview): Promise<void> {
  preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="next"]')?.click();
  await settle();
}

/** Skriver in och avfyrar `input` med bubbling, precis som en besökare gör
 * och precis som reglagets egen brygga gör (`wireNumberControls`). */
function typeInto(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
}

/**
 * Sätter fältets DOM-värde UTAN att avfyra `input`/`change` — alltså utan att
 * visarens `touchedVariables` någonsin ser namnet. Skiljer "rört" (visarens
 * egen mätning) från "skiljer sig från ankomstvärdet" (motorns egen, sedan
 * 15/9) — de två vägarna som båda släpper igenom ett orört-i-visarens-mening
 * fält, prövade var för sig.
 */
function setWithoutTouching(field: HTMLInputElement, value: string): void {
  field.value = value;
}

const onResult = (preview: GuidePreview): boolean =>
  preview.shadowRoot?.querySelector('[data-node-type="result"]') !== null;
const onPage = (preview: GuidePreview): boolean =>
  preview.shadowRoot?.querySelector('[data-node-type="page"]') !== null;

/** Frågedialogen — `<dialog class="guide-preview__ask">`, byggd och slängd
 * per fråga (askAboutUntouched i guide-preview.ts). */
const dialogOf = (preview: GuidePreview): HTMLDialogElement | null =>
  preview.shadowRoot?.querySelector<HTMLDialogElement>("dialog.guide-preview__ask") ?? null;
const dialogText = (preview: GuidePreview): string =>
  dialogOf(preview)?.querySelector("h2")?.textContent ?? "";
const activeElement = (preview: GuidePreview): Element | null =>
  preview.shadowRoot?.activeElement ?? null;

async function answerDialog(preview: GuidePreview, action: "change" | "continue"): Promise<void> {
  dialogOf(preview)?.querySelector<HTMLButtonElement>(`[data-ask="${action}"]`)?.click();
  await settle();
}

describe("ett talfält med kravet på — dialogen (Johans form 15/9)", () => {
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Tal" }, variableName: "tal", startValue: 5,
            required: true, requireInteraction: true,
          },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("orört: dialogen öppnas och namnger rätt fält och värde — inget fältfel", async () => {
    const preview = await mount(graph());

    // Startvärdet syns redan (steg 2) — det är precis det som gör frågan
    // meningsfull: fältet ser besvarat ut utan att vara det.
    expect(pageField(preview, "tal")?.value).toBe("5");

    await clickNext(preview);

    // Kvar på sidan, men INGET fältfel längre — se toppkommentaren.
    expect(onPage(preview)).toBe(true);
    expect(isInvalid(preview, "n")).toBe(false);
    expect(fieldError(preview, "n")).toBe("");

    // Dialogen namnger fältet OCH värdet, i en mening man kan svara på utan
    // att leta upp vilket fält och vad det står på (Johans skäl, e44b551).
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Tal");
    expect(dialogText(preview)).toContain("5");
  });

  test("Ändra: dialogen stänger, fokus i fältet, kvar på sidan", async () => {
    const preview = await mount(graph());

    await clickNext(preview);
    expect(dialogOf(preview)).not.toBeNull();

    await answerDialog(preview, "change");

    expect(dialogOf(preview)).toBeNull();
    expect(onPage(preview)).toBe(true);
    expect(activeElement(preview)).toBe(pageField(preview, "tal"));
    // Värdet orört — Ändra ändrar ingenting åt besökaren.
    expect(pageField(preview, "tal")?.value).toBe("5");
  });

  test("Escape gör samma sak som Ändra", async () => {
    const preview = await mount(graph());

    await clickNext(preview);
    expect(dialogOf(preview)).not.toBeNull();

    // Ett riktigt tangenttryck genom webbläsaren — plattformens dialog
    // hanterar Escape själv (`cancel`-händelsen), inget vi kan trigga med
    // ett syntetiskt KeyboardEvent-dispatch.
    await userEvent.keyboard("{Escape}");
    await settle();

    expect(dialogOf(preview)).toBeNull();
    expect(onPage(preview)).toBe(true);
    expect(activeElement(preview)).toBe(pageField(preview, "tal"));
  });

  test("Gå vidare: dialogen stänger och guiden går vidare", async () => {
    const preview = await mount(graph());

    await clickNext(preview);
    await answerDialog(preview, "continue");

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });

  test("ett värde skilt från ankomstvärdet, inskickat UTAN beröring, frågas inte", async () => {
    // Motorns egen regel (isUntouched, submitted-parametern): ett inskickat
    // värde som skiljer sig från ankomstvärdet räknas som ändrat, oavsett om
    // visaren sett en input-händelse. touchedVariables förblir tom här.
    const preview = await mount(graph());

    setWithoutTouching(pageField(preview, "tal")!, "9");
    await clickNext(preview);

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });

  test("ändrat via en riktig input-händelse frågas förstås inte heller", async () => {
    const preview = await mount(graph());

    typeInto(pageField(preview, "tal")!, "9");
    await clickNext(preview);

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });
});

describe("kravet av: dagens beteende gäller orört (K7)", () => {
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: { title: { sv: "Tal" }, variableName: "tal", startValue: 5, required: true },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("Nästa släpper igenom ett orört startvärde när kravet saknas — ingen dialog", async () => {
    const preview = await mount(graph());

    expect(pageField(preview, "tal")?.value).toBe("5");
    await clickNext(preview);

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });
});

describe("ett obligatoriskt reglage med kravet (kriterium 4: en mekanism)", () => {
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "n", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Reglage" }, variableName: "regl", presentation: "range",
            min: 0, max: 100, required: true, requireInteraction: true,
          },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("anländer uppfyllt idag, dialogen frågar om den orörd — släpper efter ett drag utan dialog", async () => {
    const preview = await mount(graph());
    const slider = () => preview.shadowRoot?.querySelector<HTMLInputElement>('input[type="range"]');

    // Reglaget visar alltid ett läge — `min`, eftersom inget startValue är satt.
    expect(slider()?.value).toBe("0");

    await clickNext(preview);
    expect(onPage(preview)).toBe(true);
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Reglage");
    expect(dialogText(preview)).toContain("0");

    await answerDialog(preview, "change");
    expect(onPage(preview)).toBe(true);

    // Ett drag: sätt reglagets värde och avfyra dess egen `input` — precis
    // det en pekare gör, och den väg `wireNumberControls` skriver in i fältet
    // och avfyrar FÄLTETS `input` (se guide-preview.ts, "renderNumberControls").
    // Värdet skiljer sig nu från ankomstvärdet (0) — ingen dialog denna gång.
    typeInto(slider()!, "70");
    await clickNext(preview);

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });
});

describe("flera orörda fält frågas i tur och ordning, ett rört frågas inte", () => {
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "a", type: "number-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Ett" }, variableName: "ett", startValue: 1,
            required: true, requireInteraction: true,
          },
        },
        {
          id: "b", type: "number-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Två" }, variableName: "tva", startValue: 2,
            required: true, requireInteraction: true,
          },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("båda orörda: fråga Ett, sedan fråga Två, sedan resultatet", async () => {
    const preview = await mount(graph());

    await clickNext(preview);
    expect(dialogText(preview)).toContain("Ett");
    expect(dialogText(preview)).toContain("1");

    await answerDialog(preview, "continue");

    // Fortfarande på sidan (motorn har inte tagit steget än — Två återstår)
    // och en NY dialog, för Två.
    expect(onPage(preview)).toBe(true);
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Två");
    expect(dialogText(preview)).toContain("2");

    await answerDialog(preview, "continue");

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });

  test("ett rört fält frågas inte alls — bara det andra", async () => {
    const preview = await mount(graph());

    typeInto(pageField(preview, "ett")!, "9");
    await clickNext(preview);

    // Ett var rört — enda dialogen gäller Två.
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Två");
    expect(dialogText(preview)).not.toContain("Ett");

    await answerDialog(preview, "continue");
    expect(onResult(preview)).toBe(true);
  });
});

describe("ett avvisat Nästa på ett äkta fel frågar inte om det orörda förrän felet är rättat", () => {
  /*
   * Ordningen mätt: `validatePageFields` (äkta fel — obligatoriskt, format)
   * körs FÖRE `clearedOfUntouched` (dialogen). Ett tomt obligatoriskt fält
   * ska alltså stoppa Nästa utan att någon dialog någonsin visas — att fråga
   * "menar du precis 500 kr?" medan ett annat fält står tomt vore att fråga
   * om fel sak.
   *
   * `belopp` har HÄR ett startvärde och lämnas ORÖRT (ingen input-händelse,
   * inget värde skilt från ankomstvärdet) — annars bevisar testet ingenting
   * om dialogen, bara om värde-skiljer-sig-vägen (se testen ovan).
   */
  function graph(): GraphData {
    return {
      startNodeId: "p",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida" } } },
        {
          id: "a", type: "text-question", parentPageId: "p", order: 0, position: { x: 0, y: 0 },
          data: { title: { sv: "Namn" }, variableName: "namn", required: true },
        },
        {
          id: "b", type: "number-question", parentPageId: "p", order: 1, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Belopp" }, variableName: "belopp", startValue: 500,
            required: true, requireInteraction: true,
          },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "p", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("namn tomt stoppar Nästa utan dialog; rättat namn ger EN dialog för belopp", async () => {
    const preview = await mount(graph());

    expect(pageField(preview, "belopp")?.value).toBe("500");

    // "namn" är tomt — Nästa avvisas på grund av namn, ingen dialog ännu.
    await clickNext(preview);
    expect(onPage(preview)).toBe(true);
    expect(isInvalid(preview, "a")).toBe(true);
    expect(fieldError(preview, "a")).toContain("obligatoriskt");
    expect(dialogOf(preview)).toBeNull();

    // Rätta bara "namn" — rör aldrig "belopp".
    typeInto(pageField(preview, "namn")!, "Anna");
    await clickNext(preview);

    // Nu, och först nu, frågan om belopp.
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Belopp");
    expect(dialogText(preview)).toContain("500");

    await answerDialog(preview, "continue");
    expect(onResult(preview)).toBe(true);
  });

  /*
   * Ersätter det gamla "glömmer inte beröringen"-fallet (se `bakåt och fram`
   * längre ned för varför det inte längre bevisade det det påstod). Det här
   * är det SMALA fall `touchedVariables` fortfarande bär något motorns egen
   * `isUntouched` inte kan se själv: besökaren ändrar fältet och ångrar sig
   * TILLBAKA till exakt startvärdet — rört, men värdet är åter lika med
   * ankomstvärdet, så motorns egen värde-skiljer-sig-väg (submitted vs
   * arrivalValueOf) säger ingenting. Bara mängden vet att hen faktiskt var där.
   *
   * Ett äkta besökarfall: ångrar sig tillbaka till förslaget, sedan hindras
   * av ett annat tomt fält, rättar det — och ska inte behöva svara på en
   * fråga om ett fält hen redan tagit ställning till.
   */
  test("ändrat och ångrat tillbaka till startvärdet: ett äkta fel på ett annat fält glömmer inte det", async () => {
    const preview = await mount(graph());

    // Två RIKTIGA input-händelser: 500 → 600 → 500. Rört, värdet är åter
    // exakt ankomstvärdet.
    typeInto(pageField(preview, "belopp")!, "600");
    typeInto(pageField(preview, "belopp")!, "500");

    // "namn" är tomt — Nästa avvisas på grund av namn. Sidan ritas om
    // (redrawn === true, samma nod) — det här är omritningen mutationen
    // "töm vid varje omritning" skulle träffa.
    await clickNext(preview);
    expect(onPage(preview)).toBe(true);
    expect(isInvalid(preview, "a")).toBe(true);
    expect(dialogOf(preview)).toBeNull();

    // Rätta "namn" — rör aldrig "belopp" en gång till.
    typeInto(pageField(preview, "namn")!, "Anna");
    await clickNext(preview);

    // Ingen dialog: mängden mindes att belopp rördes, trots omritningen.
    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(true);
  });
});

describe("fristående talsteg (inte på en sida) med kravet — dialogen", () => {
  function graph(): GraphData {
    return {
      startNodeId: "n",
      settings: { sourceLocale: "sv" },
      nodes: [
        {
          id: "n", type: "number-question", position: { x: 0, y: 0 },
          data: {
            title: { sv: "Fristående tal" }, variableName: "fri", startValue: 7,
            required: true, requireInteraction: true,
          },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c", from: { nodeId: "n", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("orört: dialogen namnger stegets egen rubrik och värdet — ingen felruta", async () => {
    const preview = await mount(graph());
    const field = () =>
      preview.shadowRoot?.querySelector<HTMLInputElement>("input[data-number-answer]") ?? null;

    expect(field()?.value).toBe("7");

    await clickNext(preview);

    expect(onResult(preview)).toBe(false);
    expect(dialogOf(preview)).not.toBeNull();
    expect(dialogText(preview)).toContain("Fristående tal");
    expect(dialogText(preview)).toContain("7");

    // Den delade felrutan (`data-number-validation`) är INTE längre vägen —
    // se toppkommentaren och Ändra-testet nedan.
    const region = preview.shadowRoot?.querySelector<HTMLElement>("[data-number-validation]");
    expect(region?.hidden).not.toBe(false);
  });

  test("Ändra stannar på steget med fokus i fältet", async () => {
    const preview = await mount(graph());
    const field = () =>
      preview.shadowRoot?.querySelector<HTMLInputElement>("input[data-number-answer]") ?? null;

    await clickNext(preview);
    await answerDialog(preview, "change");

    expect(dialogOf(preview)).toBeNull();
    expect(onResult(preview)).toBe(false);
    expect(activeElement(preview)).toBe(field());
  });

  test("Gå vidare går vidare; en ändring utan dialog går också vidare", async () => {
    const preview = await mount(graph());

    await clickNext(preview);
    await answerDialog(preview, "continue");
    expect(onResult(preview)).toBe(true);

    // Andra grafen, andra vägen: en riktig ändring frågar aldrig.
    const other = await mount(graph());
    const otherField = () =>
      other.shadowRoot?.querySelector<HTMLInputElement>("input[data-number-answer]") ?? null;

    typeInto(otherField()!, "12");
    await clickNext(other);

    expect(dialogOf(other)).toBeNull();
    expect(onResult(other)).toBe(true);
  });
});

describe("återgång från granskningen strandar inte", () => {
  /*
   * Liten testgraf med väg till granskning: en fristående fråga, en sida med
   * ett fält (A), en sida med det krävda fältet (B), granskning, resultat.
   * Ändra på A:s rad efter att B är besvarat: uppspelningen mot granskningen
   * ska passera B automatiskt (motorns egen `remembered`-läsning i
   * `isUntouched`, sedan 5009b1a — ingen touched-mängd behövs längre för
   * det), inte stranda besökaren på B med en dialog den aldrig kan se.
   */
  function graph(): GraphData {
    return {
      startNodeId: "q",
      settings: { sourceLocale: "sv" },
      nodes: [
        {
          id: "q", type: "question", position: { x: 0, y: 0 },
          data: {
            title: { sv: "Bor du i kommunen?" }, variableName: "bor",
            options: [
              { id: "o-ja", label: { sv: "Ja" }, value: "ja" },
              { id: "o-nej", label: { sv: "Nej" }, value: "nej" },
            ],
          },
        },
        { id: "p1", type: "page", position: { x: 100, y: 0 }, data: { title: { sv: "Om dig" } } },
        {
          id: "a", type: "text-question", parentPageId: "p1", order: 0, position: { x: 0, y: 0 },
          data: { title: { sv: "Namn" }, variableName: "namn", required: true },
        },
        { id: "p2", type: "page", position: { x: 200, y: 0 }, data: { title: { sv: "Belopp" } } },
        {
          id: "b", type: "number-question", parentPageId: "p2", order: 0, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Belopp" }, variableName: "belopp",
            required: true, requireInteraction: true,
          },
        },
        { id: "granska", type: "review", position: { x: 300, y: 0 }, data: { title: { sv: "Granska" } } },
        { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Tack" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "q", portId: "o-ja" }, to: { nodeId: "p1", portId: "input" } },
        { id: "c2", from: { nodeId: "p1", portId: "continue" }, to: { nodeId: "p2", portId: "input" } },
        { id: "c3", from: { nodeId: "p2", portId: "continue" }, to: { nodeId: "granska", portId: "input" } },
        { id: "c4", from: { nodeId: "granska", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("Ändra på en tidigare sida spelar upp den krävda sidan utan att stranda där", async () => {
    const preview = await mount(graph());
    const root = preview.shadowRoot!;

    root.querySelector<HTMLInputElement>('input[value="o-ja"]')!.click();
    await clickNext(preview);

    typeInto(pageField(preview, "namn")!, "Anna");
    await clickNext(preview);

    typeInto(pageField(preview, "belopp")!, "500");
    await clickNext(preview);

    expect(root.querySelector('[data-node-type="review"]')).toBeTruthy();

    // Ändra "Om dig" (frågan A), som ligger FÖRE den krävda sidan.
    root.querySelector<HTMLButtonElement>('[data-review-edit][data-review-question="p1"]')!.click();
    await settle();
    expect(pageField(preview, "namn")?.value).toBe("Anna");

    typeInto(pageField(preview, "namn")!, "Nils");
    await clickNext(preview);

    // Uppspelningen ska ha passerat B och landat tillbaka på granskningen —
    // inte strandat besökaren på sidan med kravet, och ingen dialog kvar.
    expect(dialogOf(preview)).toBeNull();
    expect(root.querySelector('[data-node-type="review"]')).toBeTruthy();
    expect(root.querySelector('[data-page-field-id="b"]')).toBeNull();
  });
});

describe("bakåt och fram", () => {
  /*
   * Berättelsens löfte: "går hen tillbaka finns svaret, inget startvärde
   * läggs på, och frågan uppstår inte igen." Sedan 5009b1a läser `isUntouched`
   * även `remembered` (det `getPrefill()` håller efter `previous()`), så det
   * här gäller nu — QA:s tidigare fynd (samma dag) är rättat och verifierat.
   * Ingen dialog ska uppstå en andra gång.
   */
  function graph(): GraphData {
    return {
      startNodeId: "p1",
      settings: { sourceLocale: "sv" },
      nodes: [
        { id: "p1", type: "page", position: { x: 0, y: 0 }, data: { title: { sv: "Sida 1" } } },
        {
          id: "n", type: "number-question", parentPageId: "p1", order: 0, position: { x: 0, y: 0 },
          data: {
            title: { sv: "Tal" }, variableName: "tal", startValue: 5,
            required: true, requireInteraction: true,
          },
        },
        { id: "p2", type: "page", position: { x: 100, y: 0 }, data: { title: { sv: "Sida 2" } } },
        {
          id: "x", type: "text-question", parentPageId: "p2", order: 0, position: { x: 0, y: 0 },
          data: { title: { sv: "X" }, variableName: "x" },
        },
        { id: "r", type: "result", position: { x: 200, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "p1", portId: "continue" }, to: { nodeId: "p2", portId: "input" } },
        { id: "c2", from: { nodeId: "p2", portId: "continue" }, to: { nodeId: "r", portId: "input" } },
      ],
    } as never;
  }

  test("efter att sidan passerats en gång stoppar en andra ankomst (via bakåt) inte Nästa igen", async () => {
    const preview = await mount(graph());

    typeInto(pageField(preview, "tal")!, "8");
    await clickNext(preview);
    expect(pageField(preview, "x")).not.toBeNull();

    preview.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="previous"]')?.click();
    await settle();
    // Det skrivna finns kvar i fältet (kriterium 3) — det är INTE startvärdet.
    expect(pageField(preview, "tal")?.value).toBe("8");

    await clickNext(preview);

    expect(dialogOf(preview)).toBeNull();
    expect(pageField(preview, "x")).not.toBeNull();
  });
});

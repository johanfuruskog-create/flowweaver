import { afterEach, describe, expect, test } from "vitest";

import "./publish-dialog";

import type { PublishDialog, PublishRequest } from "./publish-dialog";
import type { GuideChange } from "../../../viewer/services/guide-diff-service";

/**
 * Avsikten i granskningen: **vems** ändringar, och **vänta** (berättelse 130).
 *
 * Johan: *"Om inte Anna hade tänkt klart och inte vill att det skulle
 * publiceras?"* Rutan sa redan vad som ändras. Två saker saknades, och båda är
 * valfria egenskaper som en värd fyller i — en värd utan inloggning har inga
 * namn att ge, och då ritas ingenting av det här.
 *
 *  - `contributors`: *Sedan version 3 har Anna Andersson (08:29) och du ändrat
 *    guiden.* En upplysning under underrubriken, inte en varning: två som
 *    arbetat i samma guide är det normala.
 *  - `draftNote`: någons egna ord, ritade som en varning som inte stoppar
 *    något. Publicera går — ingen ska kunna säga att de inte visste.
 *
 * Mätt i komponenten: det är påståenden om rutans form, och de faller här på
 * en sekund i stället för i ett rökprov på fyra minuter.
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
];

async function open(over: Partial<PublishRequest> = {}): Promise<PublishDialog> {
  const element = document.createElement("publish-dialog") as PublishDialog;

  element.editorLocale = "sv";
  document.body.append(element);

  void element.ask({
    version: 4,
    previous: 3,
    changes: CHANGES,
    outline: false,
    issues: [],
    ...over,
  });
  await settle();

  return element;
}

const textOf = (element: PublishDialog, selector: string): string =>
  (element.shadowRoot!.querySelector<HTMLElement>(selector)?.textContent ?? "").trim();

const shown = (element: PublishDialog, selector: string): boolean =>
  element.shadowRoot!.querySelector<HTMLElement>(selector)?.checkVisibility() === true;

describe("vilkas ändringar granskningen innehåller", () => {
  test("namnger de andra med tid och sätter du sist", async () => {
    const element = await open({
      contributors: [
        { name: "Anna Andersson", me: false, at: "2026-09-19T06:29:00.000Z" },
        { name: "Johan Furuskog", me: true, at: "2026-09-19T06:31:00.000Z" },
      ],
    });

    expect(textOf(element, "[data-contributors]")).toMatch(
      /^Sedan version 3 har Anna Andersson \(\d{2}[:.]\d{2}\) och du ändrat guiden\.$/,
    );
  });

  /*
   * Ensam i arbetskopian: då är uppräkningen brus. *Bara du* säger samma sak
   * och säger det på en rad man läser förbi, vilket är vad den som är ensam
   * ska kunna göra.
   */
  test("och säger bara du när ingen annan varit där", async () => {
    const element = await open({
      contributors: [{ name: "Johan Furuskog", me: true, at: "2026-09-19T06:31:00.000Z" }],
    });

    expect(textOf(element, "[data-contributors]")).toBe(
      "Sedan version 3 har bara du ändrat guiden.",
    );
  });

  /*
   * En värd utan inloggning skickar inget, och då står raden inte där alls.
   * Den formen ÄR kontraktet: valfritt i båda ändar.
   */
  test("utan värdens svar står raden inte där", async () => {
    const element = await open();

    expect(shown(element, "[data-contributors]")).toBe(false);
  });

  test("och den första publiceringen har ingen version att räkna från", async () => {
    const element = await open({
      previous: null,
      contributors: [{ name: "Anna Andersson", me: false, at: "2026-09-19T06:29:00.000Z" }],
    });

    expect(textOf(element, "[data-contributors]")).toMatch(
      /^Anna Andersson \(\d{2}[:.]\d{2}\) har ändrat guiden\.$/,
    );
    expect(textOf(element, "[data-contributors]")).not.toContain("version");
  });
});

describe("arbetsanteckningen i granskningen", () => {
  const NOTE = {
    text: "Inte klar — juristen ska läsa resultattexterna.",
    name: "Anna Andersson",
    at: "2026-09-19T06:30:00.000Z",
  };

  test("står som en egen ruta med vem, när, orden och frågan", async () => {
    const element = await open({ draftNote: NOTE });

    expect(shown(element, "[data-draft-note]")).toBe(true);
    expect(textOf(element, "[data-draft-note-title]")).toMatch(
      /^Anna Andersson skrev \d{2}[:.]\d{2}$/,
    );
    expect(textOf(element, "[data-draft-note-text]")).toBe(NOTE.text);
    expect(textOf(element, "[data-draft-note-ask]")).toBe("Publicera ändå?");
  });

  /*
   * Den stoppar ingenting. En anteckning som hindrade publicering hade varit
   * ett lås utan nyckel: den som skrev den kanske har gått hem, och den som
   * publicerar har läst den och tagit ansvaret.
   */
  test("men stoppar ingenting — knappen säger fortfarande Publicera", async () => {
    const element = await open({ draftNote: NOTE });
    const confirm = element.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-action="confirm"]',
    );

    expect(confirm?.textContent?.trim()).toBe("Publicera");
    expect(confirm?.disabled ?? false, "aldrig avstängd (kriterium 3)").toBe(false);
  });

  /*
   * Orden är någons egna och ritas som text, aldrig som markup: texten kommer
   * ur en värds session, och en anteckning som lyder `<img onerror=…>` är en
   * väg in (K11, `docs/RUNTIME-SECURITY.md`).
   */
  test("och orden ritas som text, aldrig som markup", async () => {
    const element = await open({
      draftNote: { ...NOTE, text: '<img src=x onerror="window.__fel = true">' },
    });
    const box = element.shadowRoot!.querySelector<HTMLElement>("[data-draft-note-text]");

    expect(box?.querySelector("img"), "ingen tagg byggdes").toBeNull();
    expect(box?.textContent).toContain("<img");
  });

  test("utan anteckning står rutan inte där", async () => {
    const element = await open();

    expect(shown(element, "[data-draft-note]")).toBe(false);
  });
});

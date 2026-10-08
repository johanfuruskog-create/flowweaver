import { afterEach, describe, expect, test } from "vitest";

import "./guide-versions";

import type { GuideVersions } from "./guide-versions";

/**
 * *av Johan Furuskog*, under the version's name (story 126, criterion 8).
 *
 * ## Why the row says it at all
 *
 * A version is somebody's act. An editor looking back at six of them is usually
 * asking *who changed this* before *when* — and until now the list could only
 * answer the second. Sitevision's history has said both for twenty years, and
 * it is the first thing anybody looks for there.
 *
 * ## The two things that are easy to get wrong, and are therefore measured
 *
 * **A host without a login sends no `by` at all.** Then the row has no such
 * line — not an empty one, and not the word *av* followed by nothing. That is
 * the whole of the *unknown is not blank* rule the number and the note already
 * follow: something invented to fill a gap is wrong for everybody except
 * whoever invented it.
 *
 * **The name is what shows; the subject never is.** `by.subject` is opaque —
 * whatever the host's directory calls a person — and exists so two people with
 * the same name can be told apart, not so an editor can read an id. A row that
 * fell back to the subject when the name was missing would put
 * `mock-test-testsson` under somebody's version.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const SAVED_AT = Date.parse("2026-09-18T09:00:00.000Z");

async function list(version: Record<string, unknown>, locale = "sv"): Promise<GuideVersions> {
  const element = document.createElement("guide-versions") as GuideVersions;

  element.setAttribute("editor-locale", locale);
  document.body.append(element);
  element.versions = [{ id: "v-1", number: 4, savedAt: SAVED_AT, ...version }] as never;
  await settle();

  return element;
}

const authorLine = (element: GuideVersions): string =>
  element.shadowRoot!.querySelector("[data-by]")?.textContent?.trim() ?? "";

/**
 * Just the name cell's words.
 *
 * Not the whole shadow root: that includes the element's own stylesheet, and a
 * sweep over it matched *av* inside a CSS property the first time this was
 * written. A check that can be green or red for reasons in a stylesheet is not
 * a check about the row.
 */
const nameCell = (element: GuideVersions): string =>
  element.shadowRoot!.querySelector("td")?.textContent?.trim() ?? "";

describe("vem som frös versionen", () => {
  test("står under namnet, med namnet och inte med id:t", async () => {
    const element = await list({ by: { subject: "abc-123", name: "Johan Furuskog" } });

    expect(authorLine(element)).toBe("av Johan Furuskog");
    expect(
      nameCell(element),
      "subject finns för att skilja två personer åt, aldrig för att läsas",
    ).not.toContain("abc-123");
  });

  test("engelska värden säger by", async () => {
    expect(authorLine(await list({ by: { name: "Johan Furuskog" } }, "en"))).toBe("by Johan Furuskog");
  });

  /*
   * De två sätten att inte veta, och båda ska ge samma sak: ingen rad.
   *
   * Utan `by` är det en värd utan inloggning. Med `by` men utan namn är det en
   * värd som har en session men inget namn i den — Entra utan *optional
   * claims*, till exempel. En rad som sa *av* och sedan ingenting hade varit
   * värre än ingen rad, och en som sa subject hade varit värre än så.
   */
  test("utan värd-inloggning finns ingen rad alls", async () => {
    expect(authorLine(await list({}))).toBe("");
    expect(nameCell(await list({})), "ingen halv mening heller").not.toContain("av ");
  });

  test("och ett tomt namn ger heller ingen rad", async () => {
    expect(authorLine(await list({ by: { subject: "abc-123" } }))).toBe("");
    expect(authorLine(await list({ by: { subject: "abc-123", name: "" } }))).toBe("");
  });

  /*
   * Anteckningen och namnet är två olika upplysningar och står på två rader.
   * De slogs ihop i ett utkast — *"Före regeländringen, av Johan"* — och blev
   * en mening som läser som om Johan skrev regeländringen.
   */
  test("anteckningen och namnet är två rader, inte en mening", async () => {
    const element = await list({ note: "Före regeländringen", by: { name: "Johan Furuskog" } });

    expect(element.shadowRoot!.querySelector(".note")?.textContent).toBe("Före regeländringen");
    expect(authorLine(element)).toBe("av Johan Furuskog");
  });
});

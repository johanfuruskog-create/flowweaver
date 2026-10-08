import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import type { GuidePreview } from "./guide-preview";

/**
 * Visaren renderar det som knappen skriver.
 *
 * ## Felet det här är skrivet från
 *
 * Nodtypen deklarerar sina format (`formatting: ["bold", "italic", "link"]`)
 * och editorn ritar en knapp per format. Visaren läste inte den listan — den
 * hade **tre egna, hårdkodade**. Alltså kunde editorn erbjuda ett format som
 * visaren visar som rå markdown.
 *
 * Samtyckesnoden var precis det fallet: en Länk-knapp i panelen, och
 * `[villkoren](/villkor)` med klamrar och parenteser hos besökaren. Redaktören
 * klickar på en knapp verktyget gav hen, och besökaren får skräp.
 *
 * ## Vad testet påstår
 *
 * Att listan bara finns på ETT ställe. Det är därför det prövar nodtypernas
 * egna format i stället för en handskriven lista: en ny nodtyp med länk ska
 * fungera utan att någon minns att ändra visaren.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function kortet(node: Record<string, unknown>): Promise<string> {
  const preview = document.createElement("guide-preview") as GuidePreview;

  preview.setAttribute("active-locale", "sv");
  document.body.append(preview);
  preview.graph = {
    version: 9,
    startNodeId: "q",
    nodes: [
      { id: "q", position: { x: 0, y: 0 }, ...node },
      { id: "r", type: "result", position: { x: 400, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [{ id: "c", from: { nodeId: "q", portId: "continue" }, to: { nodeId: "r", portId: "input" } }],
  } as never;

  await settle();

  return preview.shadowRoot!.querySelector(".guide-preview__card")?.innerHTML ?? "";
}

describe("ett format som editorn erbjuder", () => {
  test("renderas av visaren — samtyckets länk", async () => {
    const html = await kortet({
      type: "consent-question",
      data: { title: { sv: "Jag godkänner [villkoren](/villkor)" }, variableName: "ok" },
    });

    expect(html, "länken blev en länk").toContain("<a ");
    expect(html, "ingen rå markdown").not.toContain("[villkoren]");
  });

  test("och en beskrivning med punktlista blir en lista", async () => {
    /*
     * "Du behöver: X, Y, Z" är den vanligaste formen i offentlig text, och
     * renderaren har kunnat den hela tiden — den var bara avstängd överallt
     * utom i e-postresultatets brödtext.
     */
    const html = await kortet({
      type: "text-question",
      data: {
        title: { sv: "Namn" },
        variableName: "n",
        description: { sv: "Du behöver:\n\n- personnummer\n- fastighetsbeteckning" },
      },
    });

    expect(html).toContain("<ul>");
    expect(html).not.toContain("- personnummer");
  });

  test("och en resultattext likaså", async () => {
    const html = await kortet({
      type: "result",
      data: {
        title: { sv: "Du kan ansöka" },
        description: { sv: "Ta med:\n\n1. legitimation\n2. kvitto" },
      },
    });

    expect(html).toContain("<ol>");
  });
});

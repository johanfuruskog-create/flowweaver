import { afterEach, describe, expect, test } from "vitest";

import "../../../viewer/node-types/default-node-types";
import "./flow-node";

import type { FlowNode } from "./flow-node";
import type { FlowNodeData } from "../../../viewer/types/graph";

/**
 * Story 055 — fältet säger vad det är, inte bara vad det heter.
 *
 * Kortet visade typ och rubrik. Variabelnamnet, formatet och om fältet är
 * obligatoriskt fanns bara i panelen, ett klick bort — och variabeln är det
 * andra noder pekar på. Ett felskrivet namn var osynligt tills något annat
 * slutade fungera.
 *
 * Avgjort skiss för skiss med Johan i den riktiga editorn:
 *
 * - **Formatet i typremsan**, `Textfråga | E-post`, med registrets läsbara
 *   namn. Det hör till vad noden ÄR, och det kortar etikettraden till två på
 *   ett fält som kan vara 198 px brett.
 * - **Etiketterna sist i kortet**, efter beskrivningen. Rubrik och beskrivning
 *   är skrivna till besökaren; ett variabelnamn mellan dem bryter en mening.
 * - **Obligatorisk sköter sig själv**: `required` finns bara på fält som går
 *   att lämna tomma, så etiketten dyker aldrig upp på en Ja/Nej-fråga.
 *
 * Story 077 (3/9) tog två steg tillbaka: variabelnamnet ritas fortfarande
 * sist, men syns bara när arbetsytan bär `data-show-variables` (Vy → Visa
 * variabelnamn), och obligatoriskt är en asterisk efter rubriken i stället
 * för ett chip — med ordet i kortets tillgängliga namn.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 40) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mount(node: Partial<FlowNodeData> & { type: string }): Promise<FlowNode> {
  const element = document.createElement("flow-node") as FlowNode;

  document.body.append(element);
  element.nodeData = {
    id: "n",
    position: { x: 0, y: 0 },
    data: {},
    ...node,
  } as FlowNodeData;

  await settle();

  return element;
}

const text = (element: FlowNode, selector: string): string =>
  element.shadowRoot?.querySelector(selector)?.textContent?.trim() ?? "";

const etiketter = (element: FlowNode): string[] =>
  [...(element.shadowRoot?.querySelectorAll(".flow-node__field-label") ?? [])]
    .map((one) => one.textContent?.replace(/\s+/g, " ").trim() ?? "");

describe("typremsan", () => {
  test("bär formatets läsbara namn efter typen", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "E-postadress" }, variableName: "epost", format: "email" },
    });

    expect(text(node, ".flow-node__header-text")).toBe("Textfråga | E-post");
  });

  test("och står ensam när fältet saknar format", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    });

    expect(text(node, ".flow-node__header-text")).toBe("Textfråga");
  });

  test("på ett fält på en sida står formatet ensamt — ikonen bär typen", async () => {
    // Measured 3/9: a third-width field gives the strip 118 px, and
    // `Textfråga | E-post` needs 144, so the format was what got clipped
    // (bedömningen 3/9, I). The type still reaches the accessible name.
    const node = await mount({
      type: "text-question",
      parentPageId: "p",
      layout: { columnSpan: 4 },
      data: { title: { sv: "E-postadress" }, variableName: "epost", format: "email" },
    });

    expect(text(node, ".flow-node__header-text")).toBe("E-post");
    expect(node.shadowRoot!.querySelector(".flow-node")!.getAttribute("aria-label")).toContain("Textfråga | E-post");
  });
});

describe("etiketterna i kortets fot", () => {
  test("visar variabelnamnet", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    });

    expect(etiketter(node)).toEqual(["namn"]);
  });

  test("och aliaset först, när det finns", async () => {
    // Johan 3/9: aliaset är det ord regeleditorn visar, så det ska stå
    // först; namnet är det tekniska tillägget, som i variabelväljaren.
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Vad heter du?" }, variableName: "namn", variableLabel: "Namn" },
    });

    expect(etiketter(node)).toEqual(["Namn — namn"]);
  });

  test("även när aliaset är översatt", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Vad heter du?" }, variableName: "namn", variableLabel: { sv: "Namn", en: "Name" } },
    });

    expect(etiketter(node)).toEqual(["Namn — namn"]);
  });

  test("men bara när arbetsytan säger till", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    });
    const rad = node.shadowRoot!.querySelector(".flow-node__field-labels")!;

    expect(getComputedStyle(rad).display, "av som standard").toBe("none");
    node.toggleAttribute("data-show-variables", true);
    expect(getComputedStyle(rad).display, "på med attributet").toBe("flex");
  });

  test("obligatoriskt är en asterisk efter rubriken, och ordet i namnet", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, variableName: "namn", required: true },
    });
    const rubrik = node.shadowRoot!.querySelector(".flow-node__title")!;

    expect(etiketter(node), "inget chip").toEqual(["namn"]);
    expect(rubrik.textContent!.replace(/\s+/g, " ").trim()).toBe("Ditt namn *");
    expect(rubrik.querySelector(".flow-node__required")?.getAttribute("aria-hidden")).toBe("true");
    expect(node.shadowRoot!.querySelector(".flow-node")!.getAttribute("aria-label")).toBe(
      "Textfråga: Ditt namn (obligatorisk)",
    );
  });

  test("men ingen asterisk utan krav", async () => {
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, variableName: "namn" },
    });

    expect(node.shadowRoot!.querySelector(".flow-node__required")).toBeNull();
    expect(node.shadowRoot!.querySelector(".flow-node")!.getAttribute("aria-label")).toBe(
      "Textfråga: Ditt namn",
    );
  });

  test("men ingenting på en nod utan variabel", async () => {
    // Sidor, regler och resultat har inget att säga här.
    const node = await mount({ type: "page", data: { title: { sv: "Om dig" } } });

    expect(etiketter(node)).toEqual([]);
  });

  test("och de ligger sist i kortet, efter beskrivningen", async () => {
    /*
     * Läsordningen: rubrik → beskrivning (besökarens text) → etiketter
     * (byggets data). Ett variabelnamn mellan de två första bryter en mening
     * mitt itu — mätt i skisserna, där beskrivningen knuffades ner.
     */
    const node = await mount({
      type: "text-question",
      data: { title: { sv: "Ditt namn" }, description: { sv: "För- och efternamn." }, variableName: "namn" },
    });
    const delar = [...(node.shadowRoot?.querySelectorAll(
      ".flow-node__title, .flow-node__description, .flow-node__field-labels",
    ) ?? [])].map((one) => one.className);

    expect(delar[delar.length - 1]).toContain("flow-node__field-labels");
  });
});

describe("variabler i kortets text", () => {
  /*
   * `{{applicantName}}` i ett resultat är ett utvecklarord på kortet, som
   * chipen var (Johan 3/9). Samma lucka som besökarvyn ritar: variabelns
   * etikett ur guiden, streckad — och namnet som det är när guiden saknar
   * frågan bakom det.
   */
  test("ritas som luckor med variabelns etikett", async () => {
    const node = document.createElement("flow-node") as FlowNode;

    document.body.append(node);
    node.previewGraph = {
      version: 8,
      startNodeId: "namn",
      nodes: [
        { id: "namn", type: "text-question", position: { x: 0, y: 0 }, data: { title: { sv: "Sökandens namn" }, variableName: "applicantName" } },
      ],
      connections: [],
    } as never;
    node.nodeData = {
      id: "slut",
      type: "result",
      position: { x: 0, y: 0 },
      data: { title: { sv: "Tack" }, description: { sv: "Hej {{applicantName}}, vi hör av oss till {{email}}." } },
    } as FlowNodeData;
    await settle();

    const luckor = [...node.shadowRoot!.querySelectorAll(".flow-node__description .flow-node__variable-gap")]
      .map((one) => one.textContent?.trim());

    expect(luckor).toEqual(["Sökandens namn", "email"]);
    expect(text(node, ".flow-node__description")).toBe("Hej Sökandens namn, vi hör av oss till email.");
  });
});

import { afterEach, describe, expect, test } from "vitest";

import "../../node-types/default-node-types";
import "./guide-preview";

import { kontrast, tillRgba } from "../../../testing/contrast";
import { citizenshipExampleGraph } from "../../../data/citizenship-example-graph";
import { municipalityExampleGraph } from "../../../data/municipality-example-graph";

import type { GuidePreview } from "./guide-preview";
import type { GraphData } from "../../types/graph";
// FlowWeaver PRO where it is, nothing in the open repo (src/testing/optional-pro.ts).
import { proModule, withPro } from "../../../testing/optional-pro";
const { surveyExampleGraph } = ((await proModule("data/survey-example-graph.ts")) ?? {}) as { surveyExampleGraph: GraphData };
const { borrowExampleGraph } = ((await proModule("data/borrow-example-graph.ts")) ?? {}) as { borrowExampleGraph: GraphData };
const PRO = (await withPro("viewer/node-types/submission-node-types.ts"));

/**
 * Story 116 — hur långt är kvar.
 *
 * Här prövas *att* mätaren ritas och vad den säger, inte vad den räknar:
 * räknesättet står för sig själv i `guide-route-analyzer-progress.test.ts`, och
 * ett tal som gick fel skulle falla där först. Det som bara syns i en renderad
 * sida är det som mäts här — att guiden styr om listen finns alls, att den
 * läggs till utan att ta bort stegmärkningen, att den tiger på resultatsidan,
 * på granskningen och i en guide utan något att mäta, och att talet finns både
 * som fylld yta och som ord.
 */

afterEach(() => document.body.replaceChildren());

const settle = (ms = 200) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Tre frågor i rad och ett resultat: 33 %, 67 %, 100 %, sedan inget. */
function threeQuestions(progress: boolean): GraphData {
  const question = (id: string) => ({
    id,
    type: "question",
    position: { x: 0, y: 0 },
    data: {
      title: { sv: `Fråga ${id}` },
      variableName: id,
      presentation: "radio",
      options: [{ id: `${id}-ja`, label: { sv: "Ja" }, value: "ja" }],
    },
  });

  return {
    version: 8,
    startNodeId: "a",
    nodes: [
      question("a"),
      question("b"),
      question("c"),
      { id: "slut", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "a", portId: "a-ja" }, to: { nodeId: "b", portId: "input" } },
      { id: "c2", from: { nodeId: "b", portId: "b-ja" }, to: { nodeId: "c", portId: "input" } },
      { id: "c3", from: { nodeId: "c", portId: "c-ja" }, to: { nodeId: "slut", portId: "input" } },
    ],
    settings: progress
      ? { sourceLocale: "sv", progress: true }
      : { sourceLocale: "sv" },
  } as unknown as GraphData;
}

async function mounted(graph: GraphData, theme?: "dark"): Promise<ShadowRoot> {
  const gp = document.createElement("guide-preview") as GuidePreview;

  // The theme goes on the element: the viewer's tokens hang off
  // `data-fw-theme` on itself and it never reads the document's.
  if (theme) gp.theme = theme;
  gp.style.cssText = "display: block; width: 600px;";
  document.body.append(gp);
  gp.graph = graph;
  await settle();
  return gp.shadowRoot!;
}

const meter = (root: ShadowRoot) => root.querySelector('[role="progressbar"]');

async function answer(root: ShadowRoot): Promise<void> {
  root.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
  await settle();
  [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.dataset.action === "next")!
    .click();
  await settle();
}

const stepMark = (root: ShadowRoot) =>
  root.querySelector(".guide-preview__step")?.textContent?.trim() ?? null;

describe("listen läggs till i huvudet, stegmärkningen tas inte bort", () => {
  test("utan fältet ser kortet ut precis som i dag", async () => {
    const root = await mounted(threeQuestions(false));

    expect(meter(root)).toBeNull();
    expect(root.querySelector(".guide-preview__progress-value")).toBeNull();
    // Off adds nothing to the head. On a first step there is nothing passed
    // to name, so no row at all (Astra 1/10, bilaga 10 punkt 8).
    expect(root.querySelector(".guide-preview__step-row")).toBeNull();
  });

  test("påslagen står listen över stegmärkningen, som står kvar", async () => {
    const root = await mounted(threeQuestions(true));

    expect(meter(root)).not.toBeNull();
    expect(stepMark(root)).toBe("Steg 1");
    // Listen först, stegmärkningens rad sedan — inte tvärtom och inte i samma
    // rad, vilket var det Johan avfärdade.
    expect(
      meter(root)!.compareDocumentPosition(
        root.querySelector(".guide-preview__step-row")!
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      root.querySelector(".guide-preview__step-row")!.querySelector('[role="progressbar"]')
    ).toBeNull();
  });


  test("en guide med bara ett räknat steg får ingen list", async () => {
    const graph = {
      version: 8,
      startNodeId: "a",
      nodes: [
        {
          id: "a",
          type: "text-question",
          position: { x: 0, y: 0 },
          data: { title: { sv: "Vad?" }, variableName: "a" },
        },
        { id: "slut", type: "result", position: { x: 0, y: 0 }, data: { title: { sv: "Klart" } } },
      ],
      connections: [
        { id: "c1", from: { nodeId: "a", portId: "continue" }, to: { nodeId: "slut", portId: "input" } },
      ],
      settings: { sourceLocale: "sv", progress: true },
    } as unknown as GraphData;

    const root = await mounted(graph);

    expect(meter(root)).toBeNull();
    expect(root.querySelector(".guide-preview__step-row")).toBeNull();
  });

  /*
   * Kriterium 7 på riktiga guider, inte bara en fixtur byggd för ändamålet.
   * `borrow`, `citizenship` och `municipality` mättes fram (QA, story 116) som
   * de tre av de 26 buntade exempelguiderna vars längsta väg har färre än två
   * räknade steg — en fråga, sedan bara en regel och resultat. Progress är
   * inte satt på dem alls i `src/data/`, så det testas här genom att sätta
   * `settings.progress = true` för hand: annars provas bara kriterium 5 (fältet
   * saknas) och aldrig kriterium 7 (det finns inget att mäta).
   */
  test.each(
    // borrow is PRO's guide: measured where it is, the open two either way.
    ([
      ["borrow", borrowExampleGraph],
      ["citizenship", citizenshipExampleGraph],
      ["municipality", municipalityExampleGraph],
    ] as Array<[string, GraphData]>).filter(([, graph]) => graph !== undefined),
  )("%s har färre än två räknade steg och får ingen list ändå", async (_namn, exempel) => {
    const graph = structuredClone(exempel) as unknown as GraphData;
    (graph as { settings?: Record<string, unknown> }).settings = {
      ...(graph as { settings?: Record<string, unknown> }).settings,
      progress: true,
    };

    const root = await mounted(graph);

    expect(meter(root)).toBeNull();
  });
});

describe("vad mätaren säger", () => {
  test("talet finns som bredd, som värde och som ord", async () => {
    const root = await mounted(threeQuestions(true));
    const rail = meter(root)!;

    expect(rail.getAttribute("aria-valuenow")).toBe("33");
    expect(rail.getAttribute("aria-valuemin")).toBe("0");
    expect(rail.getAttribute("aria-valuemax")).toBe("100");
    // Namnet, annars annonseras "33 procent" om ingenting alls (K4).
    expect(rail.getAttribute("aria-label")).toBe("Så långt har du kommit");
    // Samma ord som står på skärmen, så listen och talet inte annonseras som
    // två skilda saker när de ligger i olika rader.
    expect(rail.getAttribute("aria-valuetext")).toBe("33 %");
    expect(
      rail.querySelector<HTMLElement>(".guide-preview__progress-bar")!.style.width
    ).toBe("33%");
    // Och som text på stegmärkningens rad, för den som inte kan avläsa en
    // fylld yta (K3).
    const shown = root
      .querySelector(".guide-preview__step-row")
      ?.querySelector(".guide-preview__progress-value");

    expect(shown?.textContent?.trim()).toBe("33 %");
    // Dolt för uppläsning, för listen säger redan samma ord.
    expect(shown?.getAttribute("aria-hidden")).toBe("true");
  });

  /*
   * Attrappen som höll med: `aria-label` på ett <p> är förbjudet (rollen
   * paragraph står på ARIA:s Name Prohibited-lista), så attributet gjorde
   * ingenting alls. Mätt mot renderad DOM av tillgänglighetsrollen 13/9.
   */
  test("stegmärkningen bär inget aria-label", async () => {
    const root = await mounted(threeQuestions(true));

    expect(root.querySelector(".guide-preview__step")?.hasAttribute("aria-label")).toBe(
      false
    );
  });

  test("talet stiger steg för steg och slutar på 100", async () => {
    const root = await mounted(threeQuestions(true));

    await answer(root);
    expect(meter(root)!.getAttribute("aria-valuenow")).toBe("67");

    await answer(root);
    expect(meter(root)!.getAttribute("aria-valuenow")).toBe("100");
  });

  /*
   * Placeringen är Johans, avgjord på bild 13/9 kväll: i frågekortets huvud,
   * bredvid stegmärkningen — inte på en egen rad ovanför steget, och utan
   * synlig rubrik. Det är ett beslut och inte en slump, alltså mätt här.
   */
  test("listen står i kortets huvud, utan rubrik", async () => {
    const root = await mounted(threeQuestions(true));

    expect(meter(root)!.closest(".guide-preview__card")).not.toBeNull();
    // Rubriken bor i det tillgängliga namnet, inte i en synlig rad: en sådan
    // åt upp raden på 390 px tills stapeln blev smalare än sin egen text.
    expect(root.textContent).not.toContain("Så långt har du kommit");
  });

  test("resultatsidan får ingen mätare", async () => {
    const root = await mounted(threeQuestions(true));

    await answer(root);
    await answer(root);
    await answer(root);

    expect(root.textContent).toContain("Klart");
    expect(meter(root)).toBeNull();
  });

  /*
   * Kriterium 6, på riktiga enkäten och inte på en form byggd för ändamålet.
   * `survey-declined` täcker resultatgrenen; det här är granskningen — Johans
   * beslut 13/9 kväll: talet var sant men sa *klart* med två knapptryck kvar.
   */
  test.runIf(PRO)("enkätens granskningssteg får ingen mätare, men frågan före når 100 %", async () => {
    const root = await mounted(structuredClone(surveyExampleGraph));
    let last: string | null = null;

    // Svara på allt som kräver ett val och gå vidare tills granskningen syns.
    for (let step = 0; step < 12; step += 1) {
      if (root.querySelector("h2")?.textContent?.includes("Granska dina svar")) {
        break;
      }

      last = meter(root)?.getAttribute("aria-valuenow") ?? last;
      const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      if (radios.length > 0) radios[0].click();
      await settle();
      [...root.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.dataset.action === "next")
        ?.click();
      await settle();
    }

    expect(root.querySelector("h2")?.textContent).toContain("Granska dina svar");
    expect(meter(root)).toBeNull();
    // Granskningen är inte slutet på mätarens väg — den sista sidan är det.
    expect(last).toBe("100");
  });

  // Story 116 kept *Resultat* in the slot (its *Utanför omfattningen*); Astra
  // 1/10 (bilaga 10 punkt 8) took the node type's word away: the way there.
  test("resultatsidan visar vägen dit och inget Resultat, påslagen som avslagen", async () => {
    for (const on of [false, true]) {
      const root = await mounted(threeQuestions(on));

      await answer(root);
      await answer(root);
      await answer(root);

      expect(root.textContent, String(on)).toContain("Klart");
      expect(stepMark(root), String(on)).toBeNull();
      expect(root.querySelectorAll(".guide-preview__steps li").length, String(on)).toBe(3);
      expect(meter(root), String(on)).toBeNull();
      document.body.replaceChildren();
    }
  });

  test("guidens språk styr texten", async () => {
    const gp = document.createElement("guide-preview") as GuidePreview;

    gp.style.cssText = "display: block; width: 600px;";
    gp.setAttribute("active-locale", "en");
    document.body.append(gp);
    gp.graph = threeQuestions(true);
    await settle();

    const root = gp.shadowRoot!;

    expect(meter(root)!.getAttribute("aria-label")).toBe("How far you have come");
    expect(
      root.querySelector(".guide-preview__progress-value")?.textContent?.trim()
    ).toBe("33%");
  });
});

/**
 * WCAG 1.4.11 på själva mätaren, i båda temana.
 *
 * `kontrollkantsbrott` letar bland `input, select, textarea, button` och når
 * därför aldrig hit: listen är en `<div role="progressbar">`. Utan den här
 * mätningen fanns ingen grind alls över mätarens ytor, och det var precis där
 * felet satt — spåret mätte 1,24:1 mot kortet och en mätare på två procent är
 * nästan bara spår.
 *
 * **Två krav, inte ett**, och det är hela poängen: kanten måste gå att hitta
 * mot kortet, OCH det fyllda måste gå att skilja från det tomma. Det närmaste
 * svaret — att fylla spåret med `--fw-border-control` — klarar det första och
 * faller på det andra (1,01:1 i mörkt tema, alltså osynlig fyllnad). Båda står
 * här så att nästa ändring inte kan laga den ena genom att bryta den andra.
 */
describe.each([["ljust", undefined], ["mörkt", "dark" as const]])(
  "mätarens ytor i %s tema",
  (_namn, theme) => {
    const KRAV = 3;

    test("spåret går att hitta mot kortet", async () => {
      const root = await mounted(threeQuestions(true), theme);
      const track = meter(root)! as HTMLElement;
      const style = getComputedStyle(track);
      const behind = tillRgba(
        getComputedStyle(root.querySelector<HTMLElement>(".guide-preview__card")!)
          .backgroundColor
      );

      /*
       * Kanten ELLER ytan, den starkare av dem — samma regel som
       * `kontrollkantsbrott` skriver ut: en fylld kontroll hittas på sin yta,
       * en ritad på sin kant, och att kräva båda faller på varje kontroll som
       * står på en yta lik sin egen.
       *
       * `borderTopColor` måste läsas TILLSAMMANS med bredden. Utan kant svarar
       * den `currentColor`, alltså textfärgen, och mätningen hade gått grön på
       * ett spår utan kant — den första versionen av det här testet gjorde
       * precis det och gick igenom mutationen som tog bort kanten.
       */
      const framed =
        style.borderTopStyle !== "none" &&
        parseFloat(style.borderTopWidth) > 0;
      const edge = framed ? kontrast(tillRgba(style.borderTopColor), behind) : 0;
      const surface = kontrast(tillRgba(style.backgroundColor), behind);
      const ratio = Math.max(edge, surface);

      expect(
        ratio,
        `spår mot kort: ${ratio.toFixed(2)}:1 (kant ${edge.toFixed(2)}, yta ${surface.toFixed(2)})`
      ).toBeGreaterThanOrEqual(KRAV);
    });

    test("det fyllda går att skilja från det tomma", async () => {
      const root = await mounted(threeQuestions(true), theme);
      const track = meter(root)! as HTMLElement;
      const fill = track.querySelector<HTMLElement>(".guide-preview__progress-bar")!;

      const ratio = kontrast(
        tillRgba(getComputedStyle(fill).backgroundColor),
        tillRgba(getComputedStyle(track).backgroundColor)
      );

      expect(ratio, `fyllt mot spår: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(KRAV);
    });
  }
);

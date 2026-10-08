import { describe, expect, test } from "vitest";

import "../viewer/node-types/default-node-types";
import { getNodeTypes } from "../viewer/node-types/node-type-registry";

/**
 * Varje registrerad nodtyp går att skapa.
 *
 * Paletten är den **enda** vägen att lägga till en nod i editorn, och dess
 * gruppindelning är en handskriven lista i `node-palette.ts`. En typ som inte
 * står där ritas inte, och en typ som inte ritas kan ingen skapa — hur färdig
 * den än är i övrigt.
 *
 * Det hade hänt fem gånger utan att någon märkte det: `consent-question`,
 * `date-question`, `file-question`, `autocomplete-question` och
 * `multi-autocomplete-question` fanns i registret med etikett, ikon,
 * översättning, tester, hälsokontroller och en visare som ritade dem. Ingen av
 * dem gick att lägga till i en guide.
 *
 * Ingenting fångade det: alla andra grindar utgår från registret, och
 * registret var rätt. Felet satt i det enda stället som inte läser registret.
 *
 * Grinden läser gruppindelningen ur källan snarare än att importera den. Den
 * är intern i komponenten, och att exportera den bara för ett tests skull vore
 * att ändra en yta för att kunna mäta den.
 */

const source = Object.entries(
  import.meta.glob("../editor/components/node-palette/node-palette.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  }),
)[0]?.[1] as string;

const grouped = new Set(
  [...source.matchAll(/types:\s*\[([^\]]*)\]/g)]
    .flatMap((match) => [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((one) => one[1])),
);

/*
 * The types only FlowWeaver PRO offers (Johan 8/10): the viewer draws them, so
 * they are registered, but the open palette leaves them out and PRO adds them
 * (`src/pro/editor/palette.ts`). Read from the palette's own list, and — where
 * PRO is present, in the working repo — checked against what PRO adds.
 */
const offeredByPro = new Set(
  [...(source.match(/OFFERED_BY_PRO = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((one) => one[1]),
);
const proPalette = Object.values(
  import.meta.glob("../pro/editor/palette.ts", { eager: true, query: "?raw", import: "default" }),
)[0] as string | undefined;

describe("paletten och registret", () => {
  test("gruppindelningen gick att läsa ur källan", () => {
    // Utan det här påståendet skulle en ändrad skrivning i `node-palette.ts`
    // göra grinden tyst grön i stället för att fälla.
    expect(grouped.size).toBeGreaterThan(10);
  });

  test("varje registrerad nodtyp står i en grupp", () => {
    const missing = getNodeTypes()
      .map(({ type }) => type)
      .filter((type) => !grouped.has(type) && !offeredByPro.has(type));

    expect(missing, "nodtyper som ingen kan skapa").toEqual([]);
  });

  test("och ingen grupp namnger en typ som inte finns", () => {
    /*
     * Andra hållet, och lika tyst: en omdöpt typ lämnar en knapp som inte gör
     * något. Templates räknas inte — de är inte nodtyper och listas separat.
     */
    const registered = new Set(getNodeTypes().map(({ type }) => type));

    expect([...grouped].filter((type) => !registered.has(type))).toEqual([]);
  });

  test("PRO:s typer läses ur paletten, och PRO lägger till var och en", () => {
    expect(offeredByPro.size, "listan OFFERED_BY_PRO gick inte att läsa").toBeGreaterThan(0);
    if (!proPalette) return; // the open repo has no PRO to check against

    const added = new Set(
      [...proPalette.matchAll(/addPaletteTypes\([^,]+,\s*\[([^\]]*)\]/g)].flatMap((match) =>
        [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((one) => one[1]),
      ),
    );

    expect([...offeredByPro].filter((type) => !added.has(type)), "PRO lägger inte till").toEqual([]);
  });
});

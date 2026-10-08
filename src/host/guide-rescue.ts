import type { GraphData } from "../viewer/types/graph";

/**
 * Webbläsarkopian — det som inte hann sparas, tills någon bestämt sig
 * (berättelse 129).
 *
 * ## Varför den finns, och varför den inte är en andra lagring
 *
 * Johan 18/9: *"kan vi undvika att man blir tvungen att exportera?"* Frågan kom
 * ur krockrutan: den som väljer *Ladda om* tappar det som skrivits sedan sista
 * lyckade sparningen, och att be någon exportera en fil först är att be någon
 * göra en säkerhetskopia åt sig själv mitt i ett avbrott.
 *
 * Så sidan lägger grafen här i samma ögonblick krocken upptäcks — **före**
 * rutan visas, aldrig efter. Ordningen är hela poängen: en kopia som skrivs
 * efter ett val är en kopia som inte finns om fönstret stängs medan rutan står
 * öppen, och det är precis då någon stänger det.
 *
 * Det bryter inte *en lagring i taget* (`docs/LAGRING-KONTRAKT.md`). Den regeln
 * handlar om var guiden **bor** — och den bor hos värden, hela tiden. Det här
 * är ingen arbetskopia: den läses aldrig som guiden, den sparas aldrig till
 * automatiskt, och den försvinner så fort någon svarat på frågan. Sidan säger
 * fortfarande en enda sak om sparning.
 *
 * ## En nyckel per guide
 *
 * Två guider som krockar samma förmiddag är två kopior, inte en som skriver
 * över den andra. `at` följer med för att raden ska kunna säga *från 08:19* —
 * en kopia utan tid är en kopia man inte vågar ta tillbaka.
 */
export interface GuideRescue {
  graph: GraphData;
  /** När kopian lades undan, i ISO — raden skriver ut den i läsarens klocka. */
  at: string;
  /**
   * Utgångspunkten kopian byggdes på — arbetskopian som sidan senast **läste**
   * (berättelse 131).
   *
   * Mätt 19/9, och det avgjorde formen: en sammanslagning behöver tre grafer,
   * och den tredje är den enda som inte överlever en omladdning. Utan den kan
   * räddningsraden bara erbjuda *allt mitt* eller *allt hennes* — det gamla
   * valet mellan två sorters förlust — för två grafer räcker för att se att de
   * skiljer sig, aldrig för att veta vem som gjorde vad.
   *
   * Valfri: en kopia skriven innan fältet fanns saknar den, och raden erbjuder
   * då ingen sammanslagning i stället för att gissa en utgångspunkt.
   */
  base?: GraphData;
}

const keyFor = (guideId: string): string => `flowweaver.guide-rescue:${guideId}`;

/**
 * Lägg undan grafen.
 *
 * Tyst när det inte går — privat läge, full lagring, en värd som förbjudit
 * den. Ett fel här är inget den som redigerar kan göra något åt, och en ruta
 * om att en säkerhetskopia misslyckades ovanpå beskedet om en krock är två
 * problem för priset av ett.
 */
export function writeRescue(guideId: string, graph: GraphData, base?: GraphData | null): void {
  try {
    localStorage.setItem(
      keyFor(guideId),
      JSON.stringify({ graph, at: new Date().toISOString(), ...(base ? { base } : {}) }),
    );
  } catch {
    /* Se ovan. */
  }
}

/** Kopian om det finns en, annars `null`. En trasig rad är ingen kopia. */
export function readRescue(guideId: string): GuideRescue | null {
  try {
    const held = JSON.parse(localStorage.getItem(keyFor(guideId)) ?? "null") as
      | Partial<GuideRescue>
      | null;

    if (!held || !held.graph || !Array.isArray((held.graph as GraphData).nodes)) {
      return null;
    }

    const base = held.base as GraphData | undefined;

    return {
      graph: held.graph as GraphData,
      at: String(held.at ?? ""),
      // En halv utgångspunkt är ingen utgångspunkt: hellre ingen sammanslagning
      // än en räknad mot en graf utan noder.
      ...(base && Array.isArray(base.nodes) ? { base } : {}),
    };
  } catch {
    return null;
  }
}

/** Frågan är besvarad; kopian ska inte ligga kvar och fråga igen. */
export function clearRescue(guideId: string): void {
  try {
    localStorage.removeItem(keyFor(guideId));
  } catch {
    /* Se `writeRescue`. */
  }
}

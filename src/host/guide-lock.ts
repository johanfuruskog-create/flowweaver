/**
 * Låset på en guide, som en sida ser det (berättelse 129).
 *
 * ## Varför det inte är en sjunde metod på `GraphStore`
 *
 * Lagringskontraktet är sex frågor om **en guide**, och de gäller varenda värd
 * — Sitevision, en kommun, `localStorage` i den här webbläsaren. Låset gäller
 * bara en värd som vet *vem* som frågar, och `LocalStorageGraphStore` hade
 * fått två metoder att svara "nej" på för att hålla gränssnittet helt.
 *
 * Samma delning som `host-login.ts` redan gjorde av inloggningen, och av samma
 * skäl: det som förutsätter en identitet bor bredvid identiteten.
 *
 * ## Varför varje fönster har ett eget id
 *
 * Subjektet räcker inte som *vem håller låset*. Öppnar Anna guiden på en andra
 * dator är det första fönstret inte längre det som arbetar — men subjektet är
 * detsamma, så en jämförelse på det ensamt hade låtit båda fönstren tro att de
 * höll låset. Båda hade autosparat, och det ena hade mötts av en krockruta
 * utan att någonsin få veta varför.
 *
 * Id:t myntas per sidladdning och betyder ingenting för värden mer än *en
 * annan sittning* — rättigheten prövas alltid på personen
 * (`docs/LAGRING-KONTRAKT.md`).
 *
 * ## Varför ett svar aldrig är ett fel
 *
 * En värd utan låsvägar svarar `404`, och det är ett fullgott svar: sidan
 * säger då ingenting om vem som arbetar och fungerar precis som före den här
 * berättelsen. Samma sak när värden inte går att nå — ett lås är en vy, och en
 * vy som inte går att hämta är en vy som inte visas.
 */

/** Låset som värden beskriver det — namnet och tiderna, aldrig subjektet. */
export interface GuideLock {
  name: string;
  /** När arbetet började. */
  since: string;
  /** När guiden senast rördes. */
  activeAt: string;
  /** När löftet går ut, om ingen rör guiden. */
  until: string;
  /** Är det den inloggades eget lås? Värdens svar, aldrig en namnjämförelse. */
  me: boolean;
}

export type LockAnswer =
  /** Låset är mitt, i det här fönstret. */
  | { kind: "held"; lock: GuideLock }
  /** Någon annan — eller en annan av mina sittningar — håller det. */
  | { kind: "taken"; lock: GuideLock }
  /** Värden sa nej: övertagande kräver publicerare, och den här rollen är det inte. */
  | { kind: "refused" }
  /** Värden har inga lås, eller gick inte att nå. Sidan arbetar som förut. */
  | { kind: "none" };

export interface GuideLockClient {
  /** Det här fönstrets id — samma sträng så länge sidan är laddad. */
  readonly window: string;
  /** Ta eller förnya låset. `takeOver` tar någon annans. */
  take(options?: { takeOver?: boolean }): Promise<LockAnswer>;
  /**
   * Släpp låset.
   *
   * `keepalive`, för den enda gång det spelar roll är på väg ut ur sidan: ett
   * anrop som dör med sitt fönster lämnar guiden låst i tio minuter åt någon
   * som redan gått.
   */
  release(): void;
}

/**
 * Låset ur ett svar, eller `null`.
 *
 * Exporterad för att `GET /guides/<id>` bär samma fält (`ServerGraphStore`):
 * en andra avläsning av samma form hade varit en andra tolkning att hålla i
 * takt med värdens.
 */
export const readLock = (value: unknown): GuideLock | null => {
  const one = value as Partial<GuideLock> | null;

  return one && typeof one.name === "string"
    ? {
        name: one.name,
        since: String(one.since ?? ""),
        activeAt: String(one.activeAt ?? ""),
        until: String(one.until ?? ""),
        me: one.me === true,
      }
    : null;
};

export function guideLock(
  base: string,
  guideId: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
): GuideLockClient {
  const root = base.replace(/\/$/, "");
  const path = `${root}/guides/${encodeURIComponent(guideId)}/lock`;
  /*
   * En slumpsträng och inte något som identifierar datorn: värden ska kunna
   * skilja två sittningar åt och ingenting mer. `crypto.randomUUID` finns i
   * varje webbläsare sidan stödjer (K18), och reservvägen är för en testrigg
   * utan säker kontext.
   */
  const windowId =
    globalThis.crypto?.randomUUID?.() ?? `w-${Math.random().toString(36).slice(2)}`;

  return {
    window: windowId,

    async take(options = {}): Promise<LockAnswer> {
      let answer: Response;

      try {
        answer = await fetcher(path, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            window: windowId,
            ...(options.takeOver ? { takeOver: true } : {}),
          }),
        });
      } catch {
        return { kind: "none" };
      }

      if (answer.status === 409) {
        const body = (await answer.json().catch(() => null)) as { lock?: unknown } | null;
        const held = readLock(body?.lock);

        // Ett `409` utan lås i kroppen är en värd som inte följer kontraktet.
        // Att gissa vem som håller det vore värre än att säga ingenting.
        return held ? { kind: "taken", lock: held } : { kind: "none" };
      }

      if (answer.status === 401) {
        return { kind: "refused" };
      }

      if (!answer.ok) {
        return { kind: "none" };
      }

      const body = (await answer.json().catch(() => null)) as { lock?: unknown } | null;
      const held = readLock(body?.lock);

      return held ? { kind: "held", lock: held } : { kind: "none" };
    },

    release(): void {
      /*
       * Ingen väntan på svaret, och inget som bryr sig om det.
       *
       * Det här anropas från `pagehide`, där ingenting går att invänta. Går det
       * fel ligger låset kvar tills det löper ut av sig självt — vilket är
       * precis vad bäst-före finns till för, och skälet att det aldrig behöver
       * städas.
       */
      void fetcher(`${path}?window=${encodeURIComponent(windowId)}`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}

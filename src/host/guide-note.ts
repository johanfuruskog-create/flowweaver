/**
 * Arbetsanteckningen på en guide, som en sida skriver den (berättelse 130).
 *
 * ## Varför den inte är en sjunde metod på `GraphStore`
 *
 * Samma delning som låset (`guide-lock.ts`): lagringskontraktets sex frågor
 * gäller **varje** värd, och den här gäller bara en värd som vet vem som
 * frågar. Ett `LocalStorageGraphStore` hade fått en metod till att svara
 * "nej" på för att hålla gränssnittet helt.
 *
 * ## Varför en egen väg hos värden
 *
 * Den som skriver anteckningen ändrar inte guiden. Ett fält på `PUT …/draft`
 * hade betytt att en mening kräver en hel graf — och att den som skriver den
 * samtidigt skriver över vad någon annan hunnit spara, eller möts av en `409`
 * om något hen inte rört.
 *
 * ## Varför ett svar aldrig är ett fel
 *
 * En värd utan anteckningsväg svarar `404`, och sidan visar då ingen
 * anteckning och erbjuder ingen. Samma sak när värden inte går att nå: en
 * anteckning är en vy, och en vy som inte går att hämta är en vy som inte
 * visas.
 */

/** Anteckningen som värden beskriver den — namnet och tiden, aldrig subjektet. */
export interface GuideNote {
  text: string;
  /** Vem som skrev den. */
  name: string;
  /** Var det den inloggade själv? Värdens svar, aldrig en namnjämförelse. */
  me: boolean;
  /** När den skrevs, i värdens klocka. */
  at: string;
}

export type NoteAnswer =
  /** Den står hos värden nu — eller är borta, när `note` är `null`. */
  | { kind: "saved"; note: GuideNote | null }
  /** Värden sa nej: att ändra någon annans anteckning kräver publicerare. */
  | { kind: "refused" }
  /** Värden har ingen sådan väg, eller gick inte att nå. */
  | { kind: "none" };

export interface GuideNoteClient {
  /** Skriv anteckningen. En tom text tar bort den. */
  write(text: string): Promise<NoteAnswer>;
}

const asNote = (value: unknown): GuideNote | null => {
  const one = value as
    | { text?: unknown; at?: unknown; by?: { name?: unknown; me?: unknown } }
    | null;

  return one && typeof one.text === "string" && one.text !== ""
    ? {
        text: one.text,
        name: String(one.by?.name ?? ""),
        me: one.by?.me === true,
        at: String(one.at ?? ""),
      }
    : null;
};

export function guideNote(
  base: string,
  guideId: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
): GuideNoteClient {
  const path = `${base.replace(/\/$/, "")}/guides/${encodeURIComponent(guideId)}/note`;

  return {
    async write(text: string): Promise<NoteAnswer> {
      let answer: Response;

      try {
        answer = await fetcher(path, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch {
        return { kind: "none" };
      }

      if (answer.status === 401) {
        return { kind: "refused" };
      }

      if (!answer.ok) {
        return { kind: "none" };
      }

      const body = (await answer.json().catch(() => null)) as { draftNote?: unknown } | null;

      return { kind: "saved", note: asNote(body?.draftNote) };
    },
  };
}

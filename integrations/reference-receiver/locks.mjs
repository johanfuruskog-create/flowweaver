/**
 * Låset på en guide — vem som arbetar i den just nu (berättelse 129).
 *
 * ## Varför det är ett löfte med bäst-före och inte ett lås
 *
 * Johans jämförelse satte formen: *"I Sitevision låser man bara guiden och det
 * står låst av Anna."* Och sedan: *"lås upp om det har varit inaktivitet."*
 *
 * Skillnaden mot ett riktigt lås är hela modellen. Ett lås som måste låsas upp
 * kräver att någon gör det, och den som stängde laptoplocket gör det aldrig —
 * så ett kvarglömt lås blir en fråga till supporten. Det här löper ut av sig
 * självt: `until` är en tidpunkt, och ett lås som passerat den **finns inte**.
 * Ingen städning, ingen bakgrundsjobb, ingen rad i loggen. Att läsa posten är
 * att veta svaret.
 *
 * ## Vad låset INTE är
 *
 * Det är inte skyddet. `PUT …/draft` och `POST …/versions` kräver det aldrig:
 * den villkorade skrivningen från berättelse 127 (`draftSavedAt`, `409`) är det
 * som gör att ingens arbete försvinner, och den gäller oavsett vem som håller
 * vad. Ett lås som tappats är ju precis det fall där två ändå skriver — så ett
 * lås som vore villkor för att skriva hade gjort skyddsnätet beroende av den
 * sak det finns till för att täcka upp.
 *
 * Låset är en **vy**: *någon annan arbetar här, börja inte samtidigt*.
 *
 * ## Varför tiderna är värdens, alla tre
 *
 * `since`, `activeAt` och `until` sätts här och aldrig av en sida. Två
 * webbläsare på två maskiner har två klockor, och den som låg fem minuter fel
 * hade fått eller tappat ett lås av fel skäl — och ingen hade sett varför.
 * Samma stans som `draftSavedAt` och `savedAt` (`docs/LAGRING-KONTRAKT.md`).
 *
 * ## Varför subjektet aldrig går ut på tråden
 *
 * `publicLock` ger namnet och tiderna, plus `me` — *är det du själv?* — som
 * värden avgör. Samma skäl som `draftSavedBy.me` i berättelse 127: sidan lär
 * sig aldrig sitt eget subjekt, och två Anna Andersson på en kommun hade gjort
 * en namnjämförelse till fel svar för en av dem.
 */

/** Livslängden när `.env` inte säger något — referensvärdens tio minuter. */
export const LOCK_MINUTES_DEFAULT = 10;

/**
 * Hur länge ett lås lever, ur miljön.
 *
 * **Decimaler tillåtna**, och det är inte en bekvämlighet: rökproven måste
 * kunna vänta in värdens klocka på riktigt, och ett prov som väntar tio
 * minuter är ett prov ingen kör. `LOCK_MINUTES=0.05` är tre sekunder, och det
 * är samma variabel som i drift — en egen `LOCK_SECONDS` bara för prov hade
 * varit en andra väg till samma svar, alltså en till att glömma (PRAXIS 14).
 *
 * **`LOCK_MINUTES=0` stänger av låset** (Johan 20/9). Det är ett uttryckligt
 * val och inte en felskrivning: med låset på går krocken i berättelse 131
 * nästan inte att framkalla via ytan — sidan förnyar låset före varje
 * sparning, så den som blivit av med det hamnar i läsläge i stället för att
 * skriva. Skyddet fungerar, och just därför måste det gå att stänga av för
 * att mäta det som ligger bakom.
 *
 * Med noll svarar låsvägarna `404` precis som hos en värd som inte byggt
 * låset, och sidan arbetar som före 129. Ingen halvmesyr: ett lås som lever
 * noll sekunder hade varit ett lås som alltid är utgånget, alltså ett
 * tillstånd varje läsare måste förstå.
 *
 * Negativt och skräp faller fortfarande tillbaka på förvalet. En felskrivning
 * i `.env` ska inte tyst stänga av skyddet — den ska inte märkas alls.
 */
export function lockMinutes(env = process.env) {
  const raw = String(env.LOCK_MINUTES ?? "").trim();
  const said = Number(raw);

  if (raw !== "" && Number.isFinite(said) && said === 0) {
    return 0;
  }

  return Number.isFinite(said) && said > 0 ? said : LOCK_MINUTES_DEFAULT;
}

/**
 * Låset på guiden om det lever — annars `null`.
 *
 * Ett lås som passerat `until` behandlas som att det aldrig fanns. Posten
 * ligger kvar i registret tills någon tar låset igen och skriver över den, och
 * det är med flit: att radera den hade varit en skrivning för att ta bort en
 * uppgift ingen längre läser.
 */
export function liveLock(guide, now = Date.now()) {
  const lock = guide?.lock;

  if (!lock || typeof lock.subject !== "string" || lock.subject === "") {
    return null;
  }

  const until = Date.parse(String(lock.until ?? ""));

  return Number.isFinite(until) && until > now ? lock : null;
}

/**
 * Låset efter att någon tagit eller förnyat det.
 *
 * `since` följer med när det är samma person som redan håller det — raden
 * säger *sedan 08:15*, alltså när arbetet började och inte när tangenten
 * trycktes. `activeAt` är det senare, och de är två tider för att de svarar på
 * två frågor (berättelsens tillägg om *Ta över*).
 */
export function takenLock({ held, subject, name, window = "", now = Date.now(), minutes }) {
  const at = new Date(now).toISOString();
  const sameSitting = held?.subject === subject && held?.window === window;

  return {
    subject,
    /**
     * Vilket **fönster** som håller det, som en opak sträng sidan myntar.
     *
     * Subjektet räcker inte: samma person kan öppna guiden på två datorer, och
     * då är det ena fönstret inte längre det som arbetar — men subjektet är
     * detsamma, så en jämförelse på det ensamt hade låtit båda tro att de höll
     * låset. Båda hade autosparat, och den ena hade mötts av en krockruta utan
     * att någonsin få veta varför.
     *
     * Det är en **identifierare och ingen tid** (`docs/LAGRING-KONTRAKT.md`):
     * värden litar aldrig på den för vad någon får göra, bara för att skilja
     * två sittningar åt. Rättigheten prövas på subjektet, som förut.
     */
    window: String(window ?? ""),
    name: String(name ?? ""),
    since: sameSitting ? held.since : at,
    activeAt: at,
    until: new Date(now + minutes * 60_000).toISOString(),
  };
}

/**
 * Låset som en sida får se det: namnet, tiderna, och om det är ens eget.
 *
 * Aldrig subjektet — se toppkommentaren.
 */
export function publicLock(lock, subject) {
  return {
    name: String(lock.name ?? ""),
    since: lock.since,
    activeAt: lock.activeAt,
    until: lock.until,
    me: lock.subject === String(subject ?? ""),
  };
}

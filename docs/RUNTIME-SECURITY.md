# Säker körning: exponera aldrig logiken för slutanvändaren

## Problemet

I dag skeppas hela grafen (med formler, regelvillkor och trösklar) till
webbläsaren, och motorn körs där. Det är helt okej för **editorn och
previewn** — de är designverktyg. Men för en **publicerad e-tjänst** är
det osäkert: formlerna i en uträkningsnod (`min(pris * 0,85 ; inkomst *
5)`) och regelvillkoren (`marginal >= 0`) blir synliga via "visa källa"
eller den exporterade JSON:en. En banks riskmodell hör inte hemma i
klienten.

## Principen

> **Skicka aldrig grafen till klienten — skicka bara det aktuella stegets
> vy. Motorn kör där grafen bor.**

Vänd på dagens flöde så att det blir server-drivet:

1. Klienten postar ett svar (`{ sessionId, värde }`).
2. Servern håller sessionen (svaren + var man är) och grafen. Den kör
   `engine.answerValue(...)`, passerar uträknings- och regelnoder på
   servern, och landar på nästa nod.
3. Servern skickar tillbaka **bara en vymodell** för nästa steg — frågans
   titel/alternativ eller resultatets upplösta text. Inga formler, inga
   villkor.

## Var motorn körs: SiteVision WebApp = frontend + BFF

En SiteVision-webapp är frontend **och** backend-for-frontend, dvs. en
Node-liknande servermiljö. Den ramverksfria motorn körs i BFF:en.

| Frontend (webbläsaren) | BFF (Node-likt, i SiteVision) |
| --- | --- |
| Renderar vymodeller, postar svar | Håller grafen + sessionen |
| Ingen graf, inga formler | Kör motorn, utvärderar calc/regel |
| Ser bara sitt eget steg | Skickar tillbaka en sanerad vy |

## Vad som är dolt respektive synligt

- **Formeln och regeln** lämnar aldrig servern.
- **Mellanvariabler** som inte visas (t.ex. `marginal`, `lånebehov`) når
  aldrig klienten alls — servern räknar och slänger dem.
- **Slutvärdet** som användaren ska se (`maxLån = 2 550 000`) skickas som
  färdig text i resultatet. Det är *hur* det räknades ut som är hemligt,
  inte svaret.

## Nodtyperna i det här upplägget

- **Uträkning och regel är redan säkra** när guiden körs server-side —
  deras logik körs i BFF:en. Det är körsättet som gör dem säkra, inte
  nodtypen. Man behöver alltså inte flytta varje känslig uträkning till en
  tjänst.
- **Micro-tjänst-noden** är för logik som bor i ett *annat* system (en
  banks riskmotor, en kreditupplysning). Dess riktiga anrop — och API-
  nycklarna — sker också i BFF:en, aldrig i klienten.

Kort sagt: **mellanlagret gömmer din egen logik; micro-tjänst-noden hämtar
någon annans.**

## Den enda kod-sömmen: en vymodell-layer

Kodbasen är redan förberedd — `GuideTraversalEngine`, tjänsterna och
formeltolkaren är ramverksfria och har inga DOM-beroenden, så de kan köras
rakt av i en BFF.

Det som återstår är att skilja **"det som ska renderas"** från
**"logiken"**:

- I dag renderar `guide-preview` HTML direkt från grafen i webbläsaren.
- För BFF-läget behövs ett mellansteg: `nod → formelfri, serialiserbar
  vymodell` (titel, beskrivning upplöst, alternativ, eller resultattext) →
  klienten renderar från vymodellen.

Då är formlerna aldrig med på resan, oavsett hur klienten renderar.

## Demo: `examples/secure-runtime.html`

En körbar demonstration. Bolåneguiden körs genom `SimulatedBff`
(`src/runtime/simulated-bff.ts`), som håller grafen och motorn och bara
delar ut formelfria vymodeller. Sidan visar tre paneler bredvid varandra:

- **Klienten** – renderar steget enbart från vymodellen.
- **Vad klienten fick** – vymodellens JSON (resultatet visar `2550000`,
  aldrig `min(...)`).
- **Vad BFF:en håller – skickas aldrig** – kalkylens formler och
  regelvillkoret.

På GitHub Pages körs `SimulatedBff` i webbläsaren, så demon är en
*simulering* – men gränssnittet är format som ett server-API, så samma
klass lyfts oförändrad till en riktig BFF.

## Från simulerad till riktig BFF

`SimulatedBff` och kärnmotorn har inga DOM-beroenden och kan flyttas rakt
in i en BFF (den Node-liknande delen av en SiteVision-webapp):

1. **Flytta motorn server-side.** Instansiera `SimulatedBff(graph)` i
   BFF:en. Grafen laddas där och skickas aldrig till klienten.
2. **Exponera metoderna som HTTP.** `currentStep`, `answerChoice`,
   `answerValue`, `answerPage`, `back`, `restart` blir endpoints som
   returnerar `StepViewModel` som JSON. T.ex. `POST /guide/answer
   { kind, payload }`.
3. **Håll sessionen server-side.** En instans per session (i en
   session-store), och skicka bara ett `sessionId` till klienten.
4. **Klienten byter metodanrop mot `fetch`.** `renderStep()` i demon är
   redan skriven mot enbart en `StepViewModel`, så själva renderingen är
   oförändrad – bara datakällan byts.
5. **Micro-tjänst-noden** ringer sina externa anrop härifrån, med
   API-nycklarna i BFF:en.

## Tjänste-noden: mock på Pages, riktig fetch i BFF:en

Tjänste-noden (`service-call`) har två körlägen som delar samma
svarsmappning:

- **Mock (`ServiceCallService.runMock`)** – synkron, läser nodens
  exempelsvar. Används i editorn, previewn och på GitHub Pages, där ingen
  backend finns. Motorn passerar noden automatiskt (standardläge).
- **Live (`ServiceCallService.runLive`)** – asynkron, gör det riktiga
  anropet mot endpointen. Hör hemma i BFF:en, där endpointen, nätverket
  och API-nycklarna finns.

Eftersom ett riktigt anrop är asynkront skapar BFF:en motorn i live-läge,
så att den **stannar** vid tjänste-noden i stället för att köra mocken:

```ts
const engine = new GuideTraversalEngine(graph, { deferServiceCalls: true });

// Efter varje svar: lös upp alla väntande tjänste-noder med riktiga anrop.
async function settle() {
  while (engine.getCurrentNode()?.type === "service-call") {
    const node = engine.getCurrentNode()!;
    // SSRF-skydd: relativa endpoints tillåts, absoluta måste vara https och
    // finnas i allowlistan. endpointen kommer från (opålitlig) grafdata.
    const outcome = await ServiceCallService.runLive(node, engine.getAnswers(), {
      allowedHosts: ["api.internt.se"],
    });
    engine.advanceServiceCall(outcome.answers);
  }
  return toStepViewModel(engine.getCurrentNode()!, engine.getAnswers(), graph, meta);
}
```

Klienten märker ingen skillnad – den får samma vymodell oavsett om värdet
kom från mocken eller det riktiga anropet. Bara vart anropet sker skiljer.

## Sajtens egen CSP: vem sidan får ringa

Det här dokumentet handlar annars om att köra motorn hos en värd. Det här
avsnittet handlar om **vår egen sajt**, som också är en värd, och om den enda
regel som styr vad dess sidor får ringa.

Sidorna skickas med `connect-src 'self'` — en guide behöver ingen utgående
trafik, och en policy som tillåter mer än den behöver är en policy ingen kan
resonera om. Två undantag finns, båda **per sida** och båda till **exakt ett
ursprung**, aldrig ett jokertecken:

| Sidor | Ursprung | Varför |
| --- | --- | --- |
| Kartsidorna | `https://nominatim.openstreetmap.org` | Omvänd geokodning fyller i gatuadressen för en vald punkt (story 046). |
| Intressesidorna | `endpoint` ur `src/site/interest-form.json` | Anmälan talar inlämningskontraktet mot vår egen mottagare (uppdraget GleSYS, steg 4). |

**Regeln, och den är hela avsnittet:** en bredd gäller de sidor som behöver
den och ingen annan, och den skrivs som ett ursprung och inte som ett mönster.
En sida som inte ringer någon ska inte kunna det, för då är ett inplanterat
skript utan väg ut.

Intressesidornas ursprung **läses ur samma rad som adressen sidan postar
till**, i bygget. Adressen och tillståndet att ringa den är samma beslut, och
på två ställen hade det ena blivit efter. Tom adress betyder ingen mottagare
och därmed ingen bredd. Hur det görs står bredvid koden, i
`contentSecurityPolicy()` i `vite.config.ts`; att det ska vara så står här.

Grinden är `npm run smoke:site`, som läser den **byggda** markupen: exakt
intressesidorna bär ursprunget, ingen annan sida gör det. Ett blockerat anrop
syns annars bara i en webbläsarkonsol hos en besökare.

## Status

- **Klart:** ramverksfri motor, vymodell-layer (`toStepViewModel`),
  `SimulatedBff` + körbar demo, och tjänste-nodens mock- och live-lägen
  (`runMock`/`runLive` + `deferServiceCalls`/`advanceServiceCall`).
- **Kvarstår (Fas 5):** flytta `SimulatedBff` till en riktig BFF och
  ersätt de direkta anropen med HTTP + sessionshantering.

# Värdsystemskontraktet — hela sömmen på ett ställe

FlowWeaver är en inbäddad komponent som **äger ingenting**: den lagrar
inget, ringer ingen och bestämmer inte hur sidan ser ut. Allt sådant är
värdsystemets — och det här dokumentet är kartan över exakt vad det
betyder. Varje söm har sitt eget kontrakt med detaljerna; det här
dokumentet upprepar dem inte, det pekar.

Nivåerna är **ambitioner, inte krav**. Nivå 1 räcker för att visa en
guide. Allt därutöver är frivilligt — och en förmåga som inte kopplats in
renderar ärligt (ett uppslagsfält säger att uppslaget inte kunde nås, en
inlämning utan mottagare ger besökaren ett ärligt fel och svaren kvar),
aldrig en trasig yta.

## Så integrerar ni på en förmiddag

**Fyra flöden först** (Johan 22/9): spara och läsa guider, versioner, e-post
via inlämningen, och identitet. Allt annat kommer efter dem. Varje steg pekar
på kontraktet med detaljerna, och inget steg kräver steget efter.

0. **Visa en guide** — förutsättningen, och den är liten: en script-tagg eller
   npm-paketet, `tokens.css`, och grafen som egenskap på `<guide-preview>`.
   Raderna står färdiga på [install.html](https://flowweaver.se/install.html).
   → [`JSON-KONTRAKT.md`](JSON-KONTRAKT.md)
1. **Spara och läsa guider.** Peka editorn mot `GET/POST /guides` hos er, eller
   kör referensvärden medan ni bygger ert eget. **Editorn autosparar inte** —
   den skickar `graph-changed`, och värden sparar. Att arbetskopian går att läsa
   tillbaka efter en omladdning är måttet på att flödet fungerar;
   `src/host/autosave-controller.ts` är referensappens halva av det.
   → [`LAGRING-KONTRAKT.md`](LAGRING-KONTRAKT.md)

   **Kör referensvärden lokalt, inte mot `api.flowweaver.se`.** `/guides` kräver
   `Authorization: Bearer <session eller guidehemlighet>`: sessionen kommer ur
   vår egen inloggning, och hemligheten **myntas på servern** med `guides.mjs
   new`. En extern värd kan alltså inte skaffa sig någondera, och alla svar blir
   `401 unauthorized`. Lokalt tar det två kommandon:

   ```bash
   FLOWWEAVER_DB=./flowweaver.sqlite \
   RECIPIENTS_FILE=integrations/reference-receiver/recipients.example.json \
   OUTBOX_DIR=./outbox \
     node integrations/reference-receiver/server.mjs 4320

   FLOWWEAVER_DB=./flowweaver.sqlite \
     node integrations/reference-receiver/guides.mjs new --note "Provguide"
   ```

   `new` säger id och hemlighet **en gång** och skriver ut adressen som
   `?guide=<id>&key=<hemlighet>`. `FLOWWEAVER_DB` är inte valfri: utan den
   finns ingen lagring alls — bara inlämningen svarar — och inlämningens
   dubblettskydd är av, se *Upprepade anrop* nedan.
2. **Versioner.** *Publicera* skapar en **oföränderlig** version och pekar ut
   den publicerade; **numret är ert**, inte klientens. En äldre version går att
   återställa till arbetskopian utan att gamla versioner eller nod-id:n ändras.
   → [`LAGRING-KONTRAKT.md`](LAGRING-KONTRAKT.md)
3. **E-post via er.** `registerSubmissionReceiver` på er sida, och en
   `POST /submit` hos er som validerar, skickar och svarar med ett
   referensnummer. Ni styr mottagare, avsändare och tjänst; visaren visar
   resultatet, både vid framgång och vid fel.
   → [`INLAMNING-KONTRAKT.md` › *Vad guiden lämnar*](INLAMNING-KONTRAKT.md#vad-guiden-lämnar-payload)

   **Nyttolastens minsta form**, så att en mottagare går att prova innan en
   guide finns. Fälten står i kontraktets tabell; de här fyra är de som
   referensmottagaren avvisar en inlämning utan:

   ```json
   {
     "recipientIds": ["gatukontoret"],
     "answers": { "plats": "Storgatan 1" },
     "records": [{ "question": "Var är det?", "answer": "Storgatan 1", "variable": "plats" }],
     "protection": { "honeypot": "", "elapsedMs": 9000 }
   }
   ```

   `recipientIds` är listan att skriva; `recipientId` finns kvar för den som
   redan byggt, och en mottagare ska ta emot båda. `protection` är
   robotskyddets råmaterial: tom honungsfälla och minst 1 500 ms genomgång.

   **Prova inlämningen lokalt, mot er själva.** `api.flowweaver.se` har en
   enda mottagare och den är verklig, så en skarp inlämning dit mejlar en
   riktig person. Sätt i stället `RECEIVER_TEST_ADDRESS=<er adress>` bredvid
   de andra variablerna i kommandot under steg 1: referensmottagaren lägger
   då raden `test` överst i `GET /recipients` och gör den till standard, så
   både ett giltigt id och ett okänt id landar hos er. Adressen bor i miljön,
   aldrig i katalogfilen och aldrig i klienten (Johans beslut 22/9: ingen
   provmottagare på den skarpa servern — dess standardrad är den riktiga).
4. **Identitet.** Er inloggning i `Authorization`, roller som avgör vad
   redaktören får, och lås som bär namnet. Har ni ingen inloggning är
   **hemlighet per guide** det minsta alternativet.
   → [`LAGRING-KONTRAKT.md` › *Identitet — er sak*](LAGRING-KONTRAKT.md#identitet--er-sak-och-kontraktet-låser-inte-fast-någon).
   [`IDENTITET-KONTRAKT.md`](IDENTITET-KONTRAKT.md) är en skiss om **besökarens**
   identitet och säger inget om `Authorization`, roller eller hemligheten.

Sist: **`checkSetup(element)`** svarar på vad som inte är inkopplat och vad
det leder till. Varje uppsättningsfel vi haft var tyst; det här är sättet att
inte ha ett.

**Vad `checkSetup` räknar som fel** — tre saker, och bara de
(`src/entries/setup-check.ts`): att inga tokens löser ut på elementet, att
`guide-editor` saknar `mode` och därför är låst, och att ett språk guiden
erbjuder saknar texter eller står utanför `declareLocales`. Den säger
**ingenting** om lagring, mottagare eller `onSave`: den kan inte veta att en
lyssnare finns, och den kan aldrig veta att en sparfunktion sparar. `ok: true`
betyder alltså *inget av de tre*, inte *allt är inkopplat*.

Referensvärden (`integrations/reference-receiver/`) kör alla fyra på
`api.flowweaver.se` och är exemplet att läsa när en rad är otydlig — men det
är **vår** installation, med vår inloggning. En värd som vill prova mot en
server kör en egen kopia enligt steg 1.

## Nivå 1 — visa en guide

Två taggar och en JSON. Det är hela åtagandet.

| Värden gör | Detaljer |
| --- | --- |
| Laddar visaren och tokens | `flowweaver-viewer.global.js` + `tokens.css` som vanliga taggar, eller ES-modulen/npm-paketet. **Pinna versionen** — linjekanalen `lib/0.X/` ger rättelser, aldrig brytande ändringar; den rullande adressen ger vad som helst den dag det mergas. |
| Lagrar och levererar guiden | Grafen är JSON ([`JSON-KONTRAKT.md`](JSON-KONTRAKT.md)) som värden lagrar var den vill och sätter som egenskap på `<guide-preview>`. Äldre grafer lyfts automatiskt till aktuell version vid inläsning. |
| Sätter språket | `active-locale` utifrån sidans språk — värden vet redan vilket det är. |

Redan på nivå 1 berättar visaren besökarens resa — `guide-progress`
(start, nästa, tillbaka, resultat, inskickat) för värdens trattmätning,
utan att något svar lämnar besökaren:
[`HANDELSER-KONTRAKT.md`](HANDELSER-KONTRAKT.md).

Vad som når webbläsaren och vad som inte borde:
[`RUNTIME-SECURITY.md`](RUNTIME-SECURITY.md).

## Nivå 2 — redigera i värdsystemet

Editorn är en komponent som monteras i värdens adminmiljö. Värden håller
tre saker:

| Värden gör | Detaljer |
| --- | --- |
| Bryggan till sitt formulär | `guide-editor` är ett eget element och deltar inte i formulär — ett dolt fält som editorn skriver till vid varje ändring är mönstret. |
| Lagringen | Guiden, nodmallarna (K6e i [`KRAV.md`](KRAV.md)) och gärna versioner — `guide-versions`-komponenten finns, lagret är värdens. |
| Verifieringen | `checkSetup()` svarar om uppsättningen är rätt — varje uppsättningsfel vi haft var tyst, det här är sättet att fråga. |

## Nivå 3 — full kraft: registren

Det som gör guiderna till tjänster. Varje rad är en registrering värden
gör en gång, och ett kontrakt som säger exakt vad som förväntas åt båda
håll:

| Förmåga | Värden registrerar | Kontraktet |
| --- | --- | --- |
| Inlämning och kvittens | `registerSubmissionReceiver` — mottagarkatalog som `{id, label}` (adresser stannar hos värden), en standardrad, robotskyddsdomen, referensnumret | [`INLAMNING-KONTRAKT.md`](INLAMNING-KONTRAKT.md) |
| Uppslagsfält | **Ingenting** — en BFF som svarar på uppslagsfrågor, se nedan | [`UPPSLAG-KONTRAKT.md`](UPPSLAG-KONTRAKT.md) |
| Kartfrågor | `registerMapProvider` — FlowWeaver ritar ingen karta | [`KART-KONTRAKT.md`](KART-KONTRAKT.md) |
| Bifogade filer | Mottagandet och gallringen — filen lämnar aldrig webbläsaren förrän värden tar den | [`FIL-KONTRAKT.md`](FIL-KONTRAKT.md) |
| Kodlistor | `registerCodeList` — listorna skeppas som JSON bredvid bundlarna, inget bundlas in | — |
| Fler språk | `registerLocale`/`declareLocales` — visarens ~95 texter per språk; verktygets språk, innehållets språk och utbudet är tre oberoende axlar | — |
| Värdens utseende | Tokens — namnen är kontraktet, värdena är värdens | [`DESIGNSYSTEM-ADAPTER.md`](DESIGNSYSTEM-ADAPTER.md) |

**Uppslaget har ingen registrering, och det är avsiktligt.** Adressen är
**fältets** — redaktören skriver den i uppslagsfältets `endpoint`, och visaren
anropar den direkt (`src/viewer/services/lookup-service.ts`) med
`?q=<term>&limit=8`, plus `&locale=` när guiden har ett visningsspråk. Svaret
ska vara `{ "version": 1, "items": [{ "value": "…", "label": "…" }] }`; ett
svar med en annan `version` avvisas hellre än läses fel, och fältet faller
tillbaka på fritext. Ett fält kan också bära sin egen lista och söka lokalt,
utan nätverk — samma yta, samma tangentbord, innan någon BFF finns.

Att prova mot vår: `https://api.flowweaver.se/lookup/kommuner?q=sto` och
`/lookup/lander`. `/broken/*` svarar **fel med flit**, en väg per
avvisningsregel i [`UPPSLAG-KONTRAKT.md`](UPPSLAG-KONTRAKT.md), så ett fält som
säger *"Uppslaget kunde inte nås"* för var och en av dem gör sitt jobb.

## Ansvaren — vad värden bygger, och hur långt vi kommit

Sex ansvar, **i de fyra flödenas ordning** (Johan 22/9): lagring, inlämning
och e-posten som följer av den, identitet — och därefter det övriga. Varje rad
säger vad värden bygger, vilket kontrakt som säger exakt vad, vad klienten har
för yta, vilken väg referensvärden visar det på, och hur färdig sömmen är.
**Mätt mot koden 22/9**, inte mot minnet.

Versionerna är inte en egen rad utan en del av **lagringen**, för det är samma
kontrakt och samma vägar. Att de är ett eget flöde i prioriteringen betyder att
de mäts för sig, inte att de byggs för sig.

Statusen betyder: *färdig* = kontrakt, klientyta och referensväg finns och
mäts av ett prov; *delvis* = fungerar men något är oskrivet eller omätt;
*återstår* = inte byggt.

| Ansvar | Vad värden bygger | Kontrakt | Klientens yta | Referensvägen | Status |
| --- | --- | --- | --- | --- | --- |
| **Lagring** | Arbetskopia, frysta versioner, pekaren på den publicerade, lås | [`LAGRING-KONTRAKT.md`](LAGRING-KONTRAKT.md) | `GraphStore`-adapter, `init({ versions, onSave })`, `<guide-versions>` | `GET/POST /guides`, `GET /guides/:id`, `PUT/DELETE …/draft`, `POST …/versions`, `…/snapshots`, `…/current`, `…/lock`, `…/note` | **färdig** — `smoke:storage` kör hela vägen |
| **Inlämning** | En `POST /submit` som tar emot svaren och svarar med ett referensnummer, plus mottagarkatalogen | [`INLAMNING-KONTRAKT.md`](INLAMNING-KONTRAKT.md) | `registerSubmissionReceiver`, `getFiles()` | `POST /submit`, `GET /recipients`, registret i `cases.mjs` | **färdig** — avvisningsreglerna mäts av `smoke:receiver` |
| **E-post** | Utskicket. Nyckeln bor i värdens `.env`, aldrig i klienten | [`INLAMNING-KONTRAKT.md` › *E-posten är värdens*](INLAMNING-KONTRAKT.md) | e-postresultatet öppnar besökarens eget program, utan server | `receiver.mjs` skickar med Resend; `reply_to` är besökaren | **delvis** — utskicket finns och körs, men bilagor går inte via `mailto` |
| **Identitet** | Inloggningen, vad `Authorization` bär, och vilken roll en person har | [`LAGRING-KONTRAKT.md` › *Identitet — er sak*](LAGRING-KONTRAKT.md#identitet--er-sak-och-kontraktet-låser-inte-fast-någon) | `Authorization` är värdens; session mot `GET/POST /guides`; *Logga in igen* vid 401, *du får inte* vid 403 | `auth.mjs` (OIDC med PKCE), `roles.mjs`; hemlighet per guide som minsta alternativ | **delvis** — [`IDENTITET-KONTRAKT.md`](IDENTITET-KONTRAKT.md) är en skiss om **besökarens** identitet, inte om den här raden; byte av hemlighet återstår |
| **Uppslag** | En BFF som svarar på uppslag, kartfrågor och kodlistor | [`UPPSLAG-KONTRAKT.md`](UPPSLAG-KONTRAKT.md), [`KART-KONTRAKT.md`](KART-KONTRAKT.md) | Uppslaget: **fältets `endpoint`**, ingen registrering. Karta och kodlistor: `registerMapProvider`, `registerCodeList` | `tools/mock-bff.mjs`, live på `api.flowweaver.se/lookup/*` och `/broken/*` | **färdig** — `smoke:lookup` kör kontraktet, även avvisningarna |
| **Filer** | Mottagandet och gallringen av bilagor | [`FIL-KONTRAKT.md`](FIL-KONTRAKT.md) | `getFiles()` — filen lämnar aldrig webbläsaren förrän värden tar den | bilagor i `POST /submit`, `outbox/` | **delvis** — gallringen är värdens och mäts inte av oss |

Två ansvar står utanför tabellen därför att de inte är något värden
*bygger*: **händelserna** ([`HANDELSER-KONTRAKT.md`](HANDELSER-KONTRAKT.md))
är något värden lyssnar på, och **utseendet**
([`DESIGNSYSTEM-ADAPTER.md`](DESIGNSYSTEM-ADAPTER.md)) är tokens värden
sätter. Båda är färdiga och kräver ingen server.

## Vad värden garanterar

Kontrakten säger vad värden **svarar**. Det här säger vad värden **lovar** —
sex frågor en värd behöver kunna svara ja på innan guider blir en tjänst, och
vad referensvärden gör i dag. Mätt 22/9, ur Astras granskning.

| Garanti | Vad det betyder | Referensvärden i dag |
| --- | --- | --- |
| **Behörighet per guide och operation** | Prövas **på servern**, per begäran — aldrig av gränssnittet. Läsläge i editorn är ingen spärr; servern nekar. | `allows(roleOf(session), neededRole(method, section))`, prövad före uppslaget så svaret inte beror på vad som finns. Rollstegen `reader < editor < publisher < admin`. |
| **Samtidiga ändringar** | Villkorad skrivning med en **stämpel**: klienten skickar tillbaka den stämpel den läste, och en skrivning mot en nyare kopia avvisas i stället för att skriva över. Därtill lås, och ett sätt att slå ihop. | `draftSavedAt` → `409 conflict` (127), lås med fönster (129), sammanslagning (131). Ingen `ETag`/`If-Match` — stämpeln är vår, och den bär vem som skrev. |
| **Upprepade anrop** | Ett återförsök efter ett förlorat svar får inte bli ett andra ärende. Inlämningen bär ett `submissionId` per **logisk** inlämning, och värden deklarerar hur länge den minns det. | `retryWindowHours: 24` i `GET /recipients`. Samma id och samma innehåll → `200 { reference, repeated: true }`, samma referens och inget andra utskick; **`repeated` är hur klienten ser att det var ett återförsök**, och saknas vid det första svaret. Samma id men annat innehåll → `409 submission-conflict` med den första referensen, för det är en andra inlämning som lånat ett id. Jämförelsen går på hela nyttolasten utom id:t, med nycklarna sorterade rekursivt — omordnade nycklar är samma inlämning, ett ändrat svar är det inte. **Skyddet finns bara med ett register**: utan `FLOWWEAVER_DB` har mottagaren ingenting att minnas id:t i, och samma id ger då två referenser och två ärenden — medan `GET /recipients` ändå deklarerar `retryWindowHours: 24`. Mätt 22/9. En värd som lovar fönstret måste alltså ha ett lager bakom löftet; att bara svara på frågan räcker inte. Publicering är säker redan genom stämpeln. |
| **Kvittots betydelse** | *Mottaget* är inte *skickat*. Kvittot säger att ärendet är registrerat; om utskicket lyckades står i registret. | Referensen myntas, ärendet skrivs till utkorgen **och** levereras i `deliver()`; `delivery` i filen säger vad som hände. Svaret `{ reference }` kommer efter leveransförsöken — men lovar dem inte. |
| **Drift och data** | Backup, återställning och gallring är värdens, och de ska vara skrivna. | `docs/DRIFT.md`: backup och återställning av registret; guider gallras efter 90 dagar; bilagornas gallring står i [`FIL-KONTRAKT.md`](FIL-KONTRAKT.md) och är värdens. |
| **Två åtkomstlägen** | Se nedan. | |

### Identiteten: två lägen, och bara ett i taget

En värd svarar **på ett sätt**, och vilket beror på om det finns en
inloggning:

- **Inloggat läge.** Värden verifierar identiteten, prövar behörighet per
  guide och operation, och versionens `by` kommer ur den verifierade
  identiteten. Rollen avgör; guidehemligheten avvisas hur god den än är, för
  två vägar in är två saker att göra fel.
- **Guidehemlighet.** För en värd utan inloggning. Hemligheten **är**
  identiteten och ger allt på just den guiden — även publicering — och aldrig
  något på någon annan. Ingen automatisk nedgradering till läsläge.
  **Känd risk (Johan 22/9):** exempelsajten bär hemligheten i adressen,
  `?guide=<id>&key=<hemlighet>`, och en adress hamnar i webbläsarhistorik och
  serverloggar — en värd som bygger på hemlighetsläget ska bära den i
  `Authorization`, aldrig i adressen; ett bättre sätt för sajten byggs
  tillsammans med nyckelbytet nedan.

**Att byta eller återkalla en hemlighet återstår.** Den skapas en gång
(`guides.mjs new`), och det finns ännu ingen väg att byta den. Kravlistan står
i `docs/UPPDRAG-2026-09-22-INTEGRATIONS-API.md`; kontraktet kommer att beskriva
hur **förlorad åtkomst rapporteras**, inte hur värden byter.

## Fel — en form för alla kontrakt

Varje kontrakt i det här dokumentet svarar på samma sätt när det säger nej.
Värden som bygger sex sömmar ska inte behöva lära sig sex felformer.

```json
{ "error": "<kod>", "message": "<mening för loggen, engelska>", "…": "extra fält" }
```

- **`error`** är en kort kebab-sträng ur listan nedan. Den är det klienten
  läser, och den byter aldrig betydelse.
- **`message`** är frivillig och är till för värdens logg — engelska,
  aldrig något en besökare eller redaktör ser.
- **Extra fält** hör till koden: `locked` bär `lock`, `conflict` bär
  stämplarna, en okänd väg bär `finns` med vägarna som finns.
- **HTTP-statusen följer koden** och motsäger den aldrig.

| Kod | Status | Betyder | Var |
| --- | --- | --- | --- |
| `unauthorized` | 401 | Ingen eller **ogiltig** autentisering | lagring, identitet |
| `forbidden` | 403 | Identiteten är giltig, **rollen** räcker inte | lagring, identitet |
| `locked` | 409 | Någon annan håller låset; `lock` säger vem | lagring |
| `conflict` | 409 | Arbetskopian ändrades under tiden | lagring |
| `no-guide` | 404 | Guiden finns inte | lagring |
| `no-version` | 404 | Versionen finns inte | lagring |
| `no-lock` | 404 | Inget lås att släppa | lagring |
| `no-note` | 404 | Ingen anteckning att ta bort | lagring |
| `no-storage` | 503 | Värden har ingen lagring inkopplad | lagring |
| `no-login` | 404 | Värden har ingen inloggning inkopplad. **Bara på `/auth/*`** | identitet |
| `graph` | 400 / 413 | Grafen är trasig eller för stor | lagring |
| `rejected` | 400 | Inlämningen avvisades av en regel | inlämning |
| `submission-conflict` | 409 | Samma `submissionId`, annat innehåll | inlämning |
| `no-recipient` | 503 | Ingen mottagare är inkopplad | inlämning |
| `mail` | 502 | Utskicket misslyckades hos värden | e-post |
| `provider` | 502 | Identitetsleverantören svarade inte | identitet |
| `no-route` | 404 | Vägen finns inte | alla |
| `no-method` | 405 | Vägen finns, men inte med den metoden | alla |

Listan bor på ett ställe i koden — `integrations/reference-receiver/errors.mjs`
— och ett prov går igenom varje `send(4xx|5xx …)` i `server.mjs` och kräver
att koden står där. **En kod är en kod**: en svensk mening i `error` är ett
fel, och två av dem fanns fram till 22/9.

**Statusen skiljer tre saker åt** (Johans ja 22/9, A8), och det är inte
kosmetik: `401` betyder att autentiseringen saknas och klienten ska erbjuda
inloggning; `403` att identiteten dög men rollen inte räcker, och då är en ny
inloggning **inte** lösningen — den ger samma roll tillbaka; `404` att guiden
inte finns eller inte får synas, vilket är sättet att dölja existens.

**Ett `no-route`-svar säger också vilken version som svarar** (Johans ja
22/9). Svaret som räknar upp vägarna bär fältet `version`:

```json
{ "error": "no-route", "version": { "commit": "a1b2c3d", "rolledOutAt": "2026-09-22T19:04:00Z" }, "finns": ["GET /recipients", "…"] }
```

Det finns för att servern inte byggs, den kopieras — alltså kan en avvikelse
mot det här dokumentet lika gärna vara en gammal utrullning som ett fel i
koden, och utifrån går de två inte att skilja åt. Fyra av avvikelserna i del C
(svensk mening i `error`, `404` i stället för `405`, `payload` utanför
kodlistan, `retryWindowHours` som saknades) var alla utrullningen.

`version` är `null` när ingen utrullning skrivit en, till exempel i varje
lokal körning. Den är **inte** en hälsokontroll: `GET /` är fortfarande `404`
och fortfarande `no-route`, för `/` är ingen väg. Ett `200` där hade gjort den
till en — den skulle stå i `finns`, och varje övervakning som läser `200` som
*tjänsten mår bra* hade fått ett löfte den här servern inte kontrollerar. Den
vet inte ens om registret går att läsa när den svarar.

**`no-login` gäller bara `/auth/*`** (mätt 22/9). En värd utan inloggning har
inga inloggningsvägar att svara på, och säger `404` i stället för att visa en
dörr som inte leder någonstans. `/guides` däremot finns alltid, och svarar
`401 unauthorized` — hemligheten per guide är legitimationen där, och ett
`no-login` hade sagt att vägen inte fanns.

**`rejected` bär aldrig något fält som säger varför**, och det är ett beslut,
inte en lucka: en robot som får veta vilken fälla den gick i är en robot som
fått rättningen. Skälet skrivs i **serverns logg** (`avvisad: …`), och
`smoke:receiver` mäter att det stannar där — raden heter *"skälet stannar på
servern"*. Klientens *visa vad och var* nedan betyder därför den form besökaren
fyllde i, aldrig ett besked ur svaret. Svaren ligger kvar oavsett.

**Klienten översätter koden till ord på ett ställe**
(`src/viewer/core/host-errors.ts`): en tabell **kod → nyckel i ordlistan →
tillåten åtgärd**. Åtgärden är den tredje kolumnen och den som gör tabellen
värd att ha — en nyckel utan åtgärd blir en mening, och en mening utan åtgärd
blir en återvändsgränd.

| Kod | Nyckel | Vad ytan ska göra |
| --- | --- | --- |
| `unauthorized` | `host.signIn` | Bevara arbetet, erbjud inloggning |
| `forbidden` | `host.forbidden` | Förklara begränsningen. Ingen ny inloggning |
| `conflict`, `locked` | `host.conflict` / `host.locked` | Bevara lokalt, erbjud krockhantering |
| `no-guide`, `no-version`, `no-lock`, `no-note` | `host.missing` | Visa vad och var |
| `rejected` | `host.rejected` | Visa vad och var — det går att rätta |
| `no-storage`, `no-login`, `no-recipient`, `no-route`, `no-method` | `host.notConnected` | Reservbesked, bevara inmatningen |
| *okänd kod* | `host.general` | Reservbesked, bevara inmatningen |

**`message` visas aldrig rakt av** och styr aldrig beteende. Den är värdens
loggrad, på engelska, och en yta som återger den lär besökaren att läsa
felkoder. Koden styr; texten är för den som driftar.

**En fel guidehemlighet blir inte *Logga in igen*.** Beskedet beror på
åtkomstläget: i hemlighetsläge finns ingen inloggning att erbjuda, och en
knapp som föreslår en är en väg som inte finns.

Besökaren får ett enda besked oavsett kod, och det är med flit: hen kan inte
göra något åt `no-storage`, och svaren ligger kvar hur som helst. Redaktören
får koden översatt, för hen kan logga in igen, fråga den som håller låset,
eller säga till den som driftar servern.

## Löftena tillbaka

Det värden får i utbyte, och som gör samtalet med ett dataskyddsombud
kort:

- **Ingenting lagras hos oss.** Svaren finns i webbläsaren tills värden
  tar emot dem; stänger besökaren fliken är de borta.
- **Ingenting anropas.** Biblioteket gör inga egna nätverksanrop — varje
  anrop som sker är värdens registrerade förmåga som gör det.
- **Adresser finns inte i kontraktens typer.** En intern e-postadress kan
  inte hamna i guidens JSON eller i klientens trafik, för det finns inget
  fält att lägga den i.
- **Tillgängligheten är grindad**, inte lovad: kontrast, tangentbord och
  skärmläsare mäts av tester som stoppar en utrullning.

## Status — färdigt, delvis, återstår

Mätt 22/9, **i de fyra flödenas ordning**: lagring, versioner, e-post via
inlämningen, identitet — och därefter det övriga. Listan finns för att luckorna
ska vara synliga utan att någon läser koden; inget av *återstår* är byggt i den
här omgången.

### Färdigt

- **1. Lagring**, hela vägen: arbetskopia, publicerad pekare, lås och
  anteckning, med `smoke:storage` som prov.
- **2. Versioner**: oföränderliga, numret värdens, återställning utan att
  gamla versioner eller nod-id:n ändras. Samma kontrakt och samma prov som
  lagringen.
- **3. Inlämning och e-post**, med avvisningsreglerna mätta av
  `smoke:receiver`, en väg per regel i uppslags-mockens `/broken/*`, och
  sedan 22/9 ett `submissionId` som gör ett återförsök till ett återförsök
  i stället för ett andra ärende.
- **4. Identitet**: inloggning (OIDC med PKCE), roller, lås som bär namnet,
  och sedan 22/9 `401`/`403`/`404` efter sin betydelse. `smoke:login` kör
  hela vägen.
- **Uppslag, karta, kodlistor, språk och tokens** — registreringar med
  kontrakt, och `smoke:lookup` som kör uppslagskontraktet skarpt.
- **Händelser** (`graph-changed`, `guide-progress`) och **utseendet**
  (tokens): inget att bygga hos värden.
- **Felformen**, sedan 22/9: en form, en kodlista, ett prov som håller
  `server.mjs` mot den.

### Delvis

- **Identitet.** [`IDENTITET-KONTRAKT.md`](IDENTITET-KONTRAKT.md) har ett
  avsnitt *Öppna frågor*, och besökarens identitet är en skiss och inte en
  nodtyp. Redaktörens väg är körd skarpt (`smoke:login`), men **byte och
  återkallelse av en guidehemlighet återstår** — den skapas en gång och kan
  inte bytas.
- **E-post.** Utskicket finns i referensvärden och körs varje dag, men
  `mailto`-vägen bifogar inga filer — en begränsning i webbläsaren, inte i
  kontraktet. Skrivet i [`INLAMNING-KONTRAKT.md`](INLAMNING-KONTRAKT.md).
- **Filer.** Mottagandet är mätt; **gallringen är värdens** och kan inte
  mätas av oss. [`FIL-KONTRAKT.md`](FIL-KONTRAKT.md) säger vad som gäller.
- **Sitevision-modulen** (`integrations/sitevision-webapp/`). Mätt 22/9:
  konfigurationen talar `/guides` och `/versions/:id/...` — **versions­schemat
  från före berättelse 124–131**, inte dagens `/guides/:id/draft|versions|
  current|lock`. Den är alltså ett fungerande exempel på sin tids kontrakt,
  inte på dagens. Vad som saknas mot de fyra ansvaren är del D i
  `docs/UPPDRAG-2026-09-22-INTEGRATIONS-API.md`, och det mesta av det kräver
  en riktig Sitevision-instans (`docs/MATPROTOKOLL-SITEVISION.md`).
- **`integrations/node-mongo/`.** Samma mätning, samma svar: `client/version-store.js`
  talar `/versions?space=…` och `/versions/:id/...`. Det är det äldre schemat,
  och README:t säger själv att det speglar Sitevision-modulen. Exemplet visar
  fortfarande det det påstår sig visa — att bara lagringen byter — men det
  visar det mot ett kontrakt som flyttat.

### Återstår

- **Kontrakten som sidor på sajten (eller repot öppet).** Ansvarstabellen på
  `install.html` länkar varje rad till sitt kontrakt på GitHub, och repot är
  privat — för en värd leder varje sådan länk till en 404. Tabellen är därmed
  läsbar bara för oss. Antingen publiceras kontrakten som sidor på sajten, som
  `install.html` själv, eller så öppnas repot. Länkarna står kvar som de är
  tills det är avgjort; att peka dem någon annanstans innan målet finns vore
  att byta en trasig länk mot en som ljuger.
- **Byte och återkallelse av guidehemlighet.** Kravlistan står i
  `docs/UPPDRAG-2026-09-22-INTEGRATIONS-API.md`: omedelbart byte, den gamla
  ogiltig atomärt, en väg tillbaka om svaret med den nya försvinner.
- **Identitetskontraktets öppna frågor**, som de står i dokumentet.
- **Kontroll hos värden** — att värden kan säga *den här guiden får inte
  publiceras än* (IDEAS 20/9). Ingen rad i något kontrakt i dag.
- **SSE-knuffen** — att värden kan säga till klienten att något ändrats i
  stället för att klienten frågar (IDEAS, berättelse 132).
- **WordPress** som tredje värdexempel (IDEAS).
- **Händelsekontraktets täckning**: `graph-changed` och `guide-progress` är
  skrivna och mätta; om fler händelser behövs vet vi inte förrän en värd
  frågar. Det är en lucka i kunskap, inte i kod.

## Att se det fungera

Exempelsajten är referensimplementationen av det här dokumentet — varje
förmåga har en sida där värdens halva spelas öppet (inlämningsexemplet
visar till och med katalogen och leveransen). `integrations/
sitevision-webapp/` är ett komplett värdsystemsexempel att läsa och
kopiera ur, med sitt eget README om vad som är exempel och vad som är
mönster.

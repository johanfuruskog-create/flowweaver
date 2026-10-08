# Arkitektur

## Grundidé

Systemet bygger på att editorn endast producerar ett JSON-schema.

Renderaren ansvarar för att visa guiden eller e-tjänsten.

JSON fungerar därför som kontraktet mellan editor och renderare.

---

## Komponenter

Editor

↓

JSON-schema

↓

Renderare

↓

Guide / E-tjänst

---

## Grundprinciper

- Allt representeras av noder.
- Alla noder är datadrivna.
- Editorn känner inte till SiteVision.
- Editorn känner inte till React.
- Kommunikation sker via Custom Events.
- Lagring hanteras av omgivande applikation.

---

## Lager

### Två träd: `src/viewer/` och `src/editor/`

Biblioteket är två träd med samma inre indelning (`components/`, `core/`,
`services/`, `localization/`, `node-types/`, `types/`). Allt en besökares
sida laddar bor i `src/viewer/`; det bara editorn behöver bor i
`src/editor/`. Editorn får importera visaren fritt — den bäddar in
`<guide-preview>` — men ingenting under `viewer/` importerar `editor/`, inte
ens en typ. Grinden är `src/entries/entries.test.ts`, som följer
importgrafen från `entries/viewer.ts` i källkoden, så även `import type`
räknas. En typ båda sidor behöver bor därför i `viewer/types/` — som
namnen på editorns förmågor (`editor-capabilities.ts`), eftersom en
nodtypsdeklaration pekar ut vilken förmåga som låser upp den.

Delningen gjordes 8 september 2026, efter att editorns 500 strängar visat
sig följa med i varje visarbundle. Katalogen är beslutet skrivet i filträdet:
en ny fil måste väljas en sida, och fel sida syns i grinden.

**Ett repo, två releaser** (Johans beslut 8 september 2026). Kravet är att
**visaren är fristående**: den bygger ensam, bär ingen editorkod, och
grinden håller det så — det är huvudsaken, och det är uppfyllt. Hur
träden utvecklas är en följdfråga, och svaret är: i ett repo, inte som två
paket var för sig. Skälet är mätt: riktningen är absolut åt ena hållet, men
åt det andra är editorn en
klient av visarens *insida* — 35 editorfiler importerar 42 visarmoduler över
307 importrader (`types/graph` 107, nodregistret 27, `localized-text` 21,
`<guide-preview>` 12 …), inte visarens publika ingång. Två repon skulle
göra de 42 modulerna till fryst publik yta och varje visarändring till en
versionsbump över en repogräns; nästan varje story rör båda sidor, och
testerna delar fixturerna i `src/data/`. Det som blir två är *det som
skeppas*: visarbundeln med `tokens.css` och typerna som den fria delen,
editorbundeln som den betalda (PRODUCT-VISION, *Where the line is drawn*).
Sedan samma dag är det två npm-paket, `@johanfuruskog-create/flowweaver-viewer`
(MIT) och `…/flowweaver-editor` (BUSL-1.1), skrivna av
`scripts/write-lib-manifest.mjs` ur samma bygge och med samma version —
för `license` i `package.json` är ett fält, inte en karta. Editorpaketet bär
bara sin egen licens' kod: dess typdeklarationer importerar visarens genom
ett beroende på visarpaketet (som exponerar `./types/*`), inte genom en kopia.
Kopian prövades och gav en konsument med båda paketen två deklarationer av
`guide-preview` (TS2717). Bundlarna på Pages och i en release, som laddas
utan `package.json`, bär licensen på sin första rad.

Två följder. Editorbundeln bäddar in sin egen kopia av visaren (930 kB, varav
~319 kB visare), så en script-tagg fungerar ensam i ett CMS; elementen är
dubbeldefinitionsskyddade, men två bundlar på samma sida har var sitt
nodregister. Det behålls tills en värd har båda på en sida och behöver dela
registret — då blir visaren editorns peer, inte förr. Och behövs det en dag
ett *offentligt* visarrepo — källkoden öppen medan editorns är stängd, det
enda som faktiskt kräver två repon — görs det som en spegel av `src/viewer/`
+ `entries/viewer.ts`, som riktningsgrinden garanterar bygger ensam, inte
som ett andra utvecklingsrepo.

### Core

`viewer/core/` innehåller ramverksfri TypeScript för grafoperationer,
traversering, migreringar och format. Kärnan känner inte till DOM eller
Web Components och kan därför återanvändas av både editor och renderare.
Det som bara editorn räknar ut — kopplingsregler, grafvalidering, historik,
in- och utläsning av filer — ligger i `editor/core/`.

`GuideTraversalEngine` läser en klonad graf, startar på dess explicita
`startNodeId` och följer frågealternativens kopplingar. Motorn samlar svar men
ändrar aldrig grafens JSON. Textfrågor lagrar det exakta textvärdet och kan
validera obligatoriskt svar samt minsta och högsta längd innan flödet följer sin
`continue`-port. Fel som saknade alternativ, kopplingar eller noder
returneras som typade resultat så att olika gränssnitt kan presentera dem på
ett lämpligt sätt.

Regelnoder har en ordnad lista med grenar. Varje gren har ett stabilt port-id,
en redigerbar etikett och ett eller flera villkor som kombineras med **alla**
(`AND`) eller **minst ett** (`OR`). Villkoren refererar till tidigare sparade
svar via `variableName` och jämför dem med stabila svarsvärden. Första
matchande gren används; om ingen matchar följs den fasta `default`-porten
(**Annars**). Första versionen stöder `equals` och `not-equals`.
`GuideTraversalEngine` passerar regelnoder
automatiskt, medan `rule-evaluator.ts` håller själva utvärderingen fristående
från DOM och Web Components. Väganalysen bär med sig kända svar så att den kan
utesluta regelgrenar som inte är möjliga.

### Nodtyper

`viewer/node-types/` registrerar datadrivna noddefinitioner. En nodtyp
beskriver egenskaper, input-portar och hur output-portar skapas från
nodens data.

En egenskap deklareras i två halvor, på var sin sida om delningen. Visaren
behöver veta att fältet **finns** och vad det är värt när noden saknar
nyckeln (`NodeFieldDeclaration`: id, standardvärde, formatering) — det står
hos typen i `viewer/node-types/default-node-types.ts`. Editorn behöver
dessutom veta hur den ska **fråga efter** det (`NodePropertyForm`: etikett,
hjälptext, kontroll, val, sektion, villkor) — det står i
`editor/node-types/default-node-properties.ts` och fogas till fälten med
`describeNodeProperties(typ, formulär)`, id mot id, vid editorns laddning.
Editorns läsare går genom `editableProperties(definition)` i
`editor/node-types/node-properties.ts`, som är den import som fäster
formulären. En värds egen nodtyp får fortfarande registrera hela
egenskapen i ett stycke; registret tar båda formerna. Delningen gjordes
för att formulären — 42 kB svenska etiketter och hjälptexter — följde med i
varje besökares sida (LOGG 8/9 2026).

### Pages och formulärfält

Den nuvarande `PageNode`-implementationen är en teknisk MVP med två fasta
textfält. Den verifierar sidvis rendering, gemensam validering, historik och
sidans `continue`-port. Den är inte den långsiktiga datamodellen.

Målbilden är att Page är en visuell behållare och ett atomiskt guide-steg.
Vanliga fråge- och fältnoder placeras inuti Page på editorns canvas. De behåller
sin identitet i grafens platta `nodes`-lista och får `parentPageId`, lokal
position och ordning. Noderna bäddas alltså inte in som kopior i `page.data`.

```ts
{
  id: "contact-page",
  type: "page",
  position: { x: 400, y: 200 },
  data: { title: "Kontaktuppgifter" }
}

{
  id: "email",
  type: "text-question",
  parentPageId: "contact-page",
  order: 2,
  position: { x: 40, y: 180 },
  data: {
    title: "E-postadress",
    variableName: "email"
  }
}
```

Barnens position är relativ till Page-behållaren. `order` är den semantiska
ordningen för tangentbordsnavigering, validering och rendering; positionen är
endast editorns visuella layout.

Flödeskopplingar finns mellan Page, Rule och Resultat. Barnnoder på samma Page
kopplas inte ihop med linjer. Previewn samlar i stället Page-barnen i `order`,
renderar dem tillsammans och sparar alla giltiga svar innan Page följer sin
utgång. Det gör grafens flödesnivå lättare att läsa:

```text
Page → Rule → Page → Resultat
```

Villkorsstyrda barn ligger kvar på sin Page men får ett synlighetsvillkor i sin
data. Editorn visar villkoret som en badge eller accent på fältnoden, exempelvis
`Visas om: Kontaktväg = E-post`, utan en intern kopplingslinje. Previewn
utvärderar villkoret mot sidans aktuella och tidigare svar. Dolda fält ska inte
blockera validering och deras svarspolicy måste vara explicit: behåll, rensa
eller ignorera vid inskick.

Följande invariants ska gälla:

- En barnnod får tillhöra högst en Page.
- `parentPageId` måste peka på en befintlig Page.
- Page får inte vara sitt eget barn och cykliskt ägarskap är ogiltigt.
- Endast flödesnoder får delta i externa flödeskopplingar.
- Barnens variabelnamn ska vara unika i grafens svarskontrakt.
- Borttagning av en Page kräver ett explicit val att ta bort eller frigöra barnen.
- Flytt mellan Pages uppdaterar förälder, lokal position och ordning atomiskt.
- Import/export ska bevara okända framtida fält och validera ägarskapet.

Övergången från tvåfälts-MVP:n sker stegvis: först utökas `FlowNodeData` med
valfritt `parentPageId` och `order`; därefter byggs containerlayout och
drag-and-drop; sedan läser previewn barnnoder; sist migreras MVP-fälten till
riktiga barnnoder. Äldre grafer med fristående frågor fortsätter vara giltiga.

![Koncept för Page som visuell nodbehållare](assets/page-node-container-concept.png)

#### Ansvarsgräns mot SiteVision

FlowWeaver äger formulärschemat, redigeringsupplevelsen, klientvalideringen,
flödeslogiken och ett strukturerat svarskontrakt. Kärnan ska inte känna till
SiteVision, specifika ärendesystem eller hur personuppgifter lagras.

En värdmodul, exempelvis i SiteVision, ansvarar för publicering, behörighet,
servervalidering, lagring, inskick, notifieringar, loggning och integration med
bakomliggande system. Den tar emot FlowWeavers graf och svar via publika
kontrakt och events. Det gör att samma Page- och formulärmotor kan användas i
SiteVision, React eller en fristående webbapplikation.

### E-postresultat

E-postresultat är en terminal nod som producerar ett neutralt datakontrakt men
aldrig skickar e-post. Noden innehåller mallar för mottagare, ämne och brödtext.
Alla tre fälten använder samma frågevariabler och samma dubbla klammerparenteser
som vanliga resultattexter.

Det producerade objektet innehåller både originalmallarna och upplösta värden
samt en lista över variabler som saknar svar. Okända variabler lämnas synliga i
den upplösta texten så att värdsystemet kan stoppa eller hantera resultatet.

FlowWeaver ansvarar för design, variabelupplösning, valideringsunderlag och
förhandsvisning. Värdsystemet ansvarar ensamt för leverans, avsändare,
autentisering, loggning och felhantering. Inga SMTP-uppgifter eller API-nycklar
får lagras i grafens JSON.
När editorns provkörning når ett e-postresultat öppnar komponenten email-output-dialog ett säkert formatterat underlag. Komponenten används oavsett om guiden körs i sidopanelen eller i den stora förhandsvisningen och innehåller ingen leveranslogik.
### Begränsad textformatering

Längre textfält lagras som vanlig text med en uttryckligen begränsad
Markdown-delmängd. Fri HTML, tabeller och bilder stöds inte. Varje
egenskapsdefinition anger sin egen formatteringsprofil:

- Fråge- och sidbeskrivningar: fet och kursiv text.
- Resultatbeskrivningar: fet, kursiv och länk.
- E-postens mottagare och ämne: oformaterad text med variabler.
- E-postens brödtext: fet, kursiv, länk, punktlista, numrerad lista och
  variabler.

Editorn använder fortfarande textarea och infogar den enkla syntaxen kring
markerad text. Renderaren tillåter endast profilens funktioner, escapar HTML
och accepterar bara länkar med http, https eller mailto. Variabelvärden skyddas
innan formatteringen tolkas och infogas därefter som escapad text. Ett svar kan
därför inte skapa HTML eller aktivera egen formattering.

E-postresultatets output märks med formatet markdown. Värdsystemet kan välja
att använda den upplösta Markdown-texten som ren text eller rendera den med
samma dokumenterade delmängd.
### Web Components

`viewer/components/` och `editor/components/` ansvarar för presentation och
användarinteraktion.
Komponenterna använder kärnans operationer i stället för att själva
implementera grafregler.

`<guide-preview>` renderar frågor och resultat från `GraphData` med hjälp av
`GuideTraversalEngine`. Komponenten äger bara sitt tillfälliga svarstillstånd
och ändrar aldrig grafen som den får från värdapplikationen.

`<node-palette>` läser tillgängliga typer från nodtypsregistret och skickar
`node-type-add` när redaktören väljer en typ. Paletten ansvarar bara för val av
nodtyp; `<guide-editor>` skapar noden och `<node-editor>` placerar den. Globala
åtgärder som import, export, preview och helskärm ligger separat i
`<editor-toolbar>`.

Editorn öppnar previewn i `<guide-preview-dialog>` och skickar en klon av den
aktuella grafen, inklusive ännu osparade ändringar. Dialogen hanterar modalitet,
Escape och fokusåterställning medan preview-komponenten förblir fristående.

### Lagring

Editorn skickar `graph-changed` men känner inte till lagringsformen. Demoappen
kopplar eventet till en fristående autosave-controller och en Local
Storage-adapter. Andra värdapplikationer kan ersätta adaptern med exempelvis
SiteVision eller ett API utan att ändra `<guide-editor>`.

Den lokala lagringen är versionsmärkt och valideras innan den återställs.
Ändringar sparas 500 millisekunder efter den senaste redigeringen.
Lokala utkast får tillfälligt sakna startnod så att ett pågående byte kan
återställas efter omladdning. Import och export kräver fortfarande en giltig
startnod när grafen innehåller frågor.
FlowWeaver visar en modal bekräftelsedialog innan demoappen får en
`graph-reset-request`. Återställningen skickar därefter `graph-reset` och
sparas som en vanlig ändring.

Editorn påstår aldrig var eller när guiden sparas — det vet bara värden.
`Ctrl+S` stoppar webbläsarens egen spara-dialog och skickar ett avbrytbart
`save-request` på `<guide-editor>`. En värd som tar det (`preventDefault`)
äger svaret: exempelsajten skriver det som väntar i autosparningen direkt och
säger *Sparad lokalt 14:12*, versionssidan sparar utkastet i den öppna
versionen och säger *Sparat i …*. Ohanterat säger editorn bara att sidan
sköter sparningen (story 083 — det gamla *"sparas automatiskt i den här
webbläsaren"* stod bredvid en versionsrad som sa *Utkast · Spara*).

Tillfällig återkoppling visas av FlowWeavers toast-komponent. Värdapplikationen
kan anropa `showToast()` för exempelvis lagrings- och integrationsresultat,
utan att själv behöva implementera editorns visuella återkoppling.

### Det värden lägger till

Biblioteket ritar ingen karta, skickar inget ärende, hämtar ingen sida.
Där en guide behöver något ur värdens system **registrerar värden det**, och
biblioteket bär kontraktet. Tre register (två i `viewer/core/`, länkväljaren i
`editor/core/`), exporterade från
`entries/editor.ts` (uppslaget är det fjärde kontraktet men ingen
registrering: värden svarar på en adress, `docs/UPPSLAG-KONTRAKT.md`):

| Register | Vad värden lägger till | Utan registrering |
| --- | --- | --- |
| `registerMapProvider` | kartdialogen (story 046, `docs/KART-KONTRAKT.md`) | kartfrågan säger att kartan inte är kopplad |
| `registerSubmissionReceiver` | mottagarkatalogen och inlämningen (050, `docs/INLAMNING-KONTRAKT.md`) | inlämningen har ingen att skicka till |
| `registerLinkPicker` | länkväljaren (100) | länkknappen skriver `[text](https://)` |

**Länkväljaren** är den minsta: `pick(context)` ger `{ url, label?, ref? }`
eller `null` för avbrutet. Länken skrivs `[text](adress "ref")` — adressen
för världen, värdens referens i markdowns titelplats. Renderaren skriver
aldrig ut referensen. Finns `resolve(ref)` frågar editorn om varje referens
när guiden öppnas: en flyttad sida får sin nya adress inskriven som en
ändring (guiden blir osparad), en borttagen blir hälsovarningen `dead-link`.
Svaren minns registret (`isLinkReferenceDead`), så hälsokontrollen förblir
synkron. Biblioteket hämtar fortfarande ingenting.

**Exempelfotot** (story 108) är samma princip utan register: en filfråga kan
bära en adress och en alt-text i sin data, och knappen *Använd exempelfoto*
ritas bara där värden satt attributet `example-files` på `<guide-preview>`.
Biblioteket hämtar adressen när någon trycker och gör en riktig `File` av
svaret — därefter är den besökarens fil, med allt vad `docs/FIL-KONTRAKT.md`
säger om den. Utan attributet ritas ingen knapp: på en riktig blankett finns
ingen exempelbil att bifoga.

### Publika kontrakt

`src/viewer/types/graph.ts` beskriver JSON-grafen,
`src/viewer/types/node-types.ts` beskriver noddefinitionerna och
`src/editor/types/events.ts` beskriver Custom Events mellan komponenterna.

---

## Funktionsnivåer

Funktionsnivån är konfiguration av editorn och ingår inte i `GraphData`.
`basic`, `advanced` och `service` löses till en uppsättning capabilities som
filtrerar nodpalett, egenskapsfält och globala åtgärder. Standardläget är
`advanced` för bakåtkompatibilitet.

Nodtyper och egenskapsdefinitioner kan ange `requiredCapability`. Editorn
kontrollerar samma capability både när gränssnittet renderas och när ett event
begär en åtgärd, så en dold nodtyp kan inte skapas genom ett syntetiskt event.
När en befintlig graf innehåller en nodtyp som inte ingår i profilen bevaras
noden och dess data, men egenskapspanelen förklarar att noden kräver en annan
funktionsnivå.

---

## Webbkomponent

Editorn exponeras som den fristående Web Component-komponenten
`<guide-editor>`.

Värdapplikationen styr den inbäddade storleken med CSS-variablerna
`--flowweaver-height` och `--flowweaver-min-height`. Storleken är
presentationskonfiguration och lagras därför inte i grafens JSON.

Editorns verktygsfält kan aktivera webbläsarens Fullscreen API. När viewportens
storlek ändras kompenserar nodeditorn sin scrollposition så att samma punkt i
arbetsytan ligger kvar i centrum. Helskärmsstatus och viewportposition är
gränssnittstillstånd och ingår inte i grafens JSON.

En tom graf öppnas vid arbetsytans mitt. Den punkten är grafens logiska
koordinat `(0, 0)` och blir utgångspunkt för den första noden. Befintliga grafer
centreras efter sina renderade nodgränser. Nod- och SVG-lagret delar samma
origo, så kopplingar och noder använder fortsatt exakt samma koordinatsystem.

Arbetsytan behåller en buffert runt viewporten och de renderade noderna. När
bufferten nås växer ytan i block åt den berörda riktningen. Vid expansion åt
vänster eller uppåt flyttas världsorigo och scrollposition lika långt. Det gör
att innehållet ligger visuellt stilla och att grafens logiska koordinater inte
behöver skrivas om.

Det innebär att den kan användas i:

- SiteVision
- React
- Vanilla JavaScript
- GitHub Pages
- Andra miljöer

utan att själva editorn behöver ändras.

---

## Data

JSON är den enda sanningskällan.

Renderaren ska endast läsa JSON.

Editorn ska endast skriva JSON.

Grafen har ett explicit `startNodeId`. Det första steget i en tom guide blir
start (story 082) — det finns inget annat det kunde vara. Därefter skapas nya
frågor som vanliga frågor och redaktören väljer uttryckligen vilken som ska
vara startnod. Startfrågan saknar input-port medan övriga frågor kan ta emot
flera inkommande flöden. Om startfrågan tas bort lämnas grafen utan startnod
tills redaktören uttryckligen väljer **Gör till startnod** på en frågenod —
grafen väljer aldrig en ny start tyst (den regeln togs bort i `a599201`).
Den tidigare startnoden blir då en vanlig fråga och den nya startnodens
inkommande kopplingar tas bort efter bekräftelse.

Vid import behandlas filens innehåll som okänd data. Först kontrolleras
JSON-strukturen och därefter grafens semantik, exempelvis nodtyper, portar,
kopplingar och startnod. Den befintliga grafen ersätts endast om båda lagren
godkänner filen. Samma semantiska kontroll körs före export.

---

## Långsiktig modell

QuestionNode

↓

RuleNode

↓

ResultNode

↓

PageNode

↓

Flera QuestionNodes

↓

RuleNode

↓

ResultNode

På detta sätt kan samma regelmotor användas både för guider och e-tjänster.

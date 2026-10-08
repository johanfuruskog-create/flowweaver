# Ändringar

Formatet är per version, nyast först. Varje post säger vad som ändrats och —
när något bryter — **vad en värd måste göra**.

Versionerna följer semver med 0.x-regeln: en brytande ändring höjer minor.

## Osläppt — fälten för inlämning flyttar till PRO

**Vad en värd måste göra:** ingenting för guider som redan finns — de ritas
och redigeras som förut. Det öppna `flowweaver-editor` erbjuder inte längre
fritext, betyg, samtycke, bifoga fil och granska för nya noder, och inte
mallarna e-post, telefon och personnummer; `flowweaver-pro-editor` gör det.
Knappen *Nytt formulär* i verktygsfältet finns bara i PRO.

## Osläppt — editorn blir öppen källkod: MPL-2.0

**Vad en värd måste göra:** ingenting. Editorn (`src/editor/`,
`flowweaver-editor`) går från Business Source License 1.1 till **Mozilla
Public License 2.0** från nästa version. Du får använda den i drift utan att
fråga; ändrar du i editorns egna filer och sprider dem delar du de filerna
under MPL. Versioner publicerade före bytet behåller BSL 1.1. Visaren är MIT
som förut. Det som säljs är FlowWeaver PRO, med en egen licens.

## Osläppt — nodpaletten blir en kategorilist med sökning

**Vad en värd måste göra:** ingenting för att editorn ska fungera. Nodpaletten
är nu en 57 px spalt med en knapp per kategori; en kategori med flera noder
öppnar dem bredvid spalten, en med en enda lägger till den direkt. » öppnar
hela paletten över flödet, med sökfältet *Sök nod* överst (berättelse 146).
Den börjar infälld i alla bredder — den fälls inte längre ihop av sig själv
under 1200 px.

- `palette-open` / `paletteOpen` öppnar hela paletten innan editorn ritas,
  och `palette-open-changed` med `{ open }` kommer när redaktören ändrar —
  samma kontrakt som `panel-open`.
- `palette-search="off"` lämnar sökfältet ute.
- **Egna sökord** per nodtyp registrerar du som strängar, till exempel
  `registerLocale("sv", { "nodeType.rule.keywords": "villkor, om" })`.
  Biblioteket har inga egna.

Är den fulla paletten och sidopanelen öppna samtidigt i en editor där de
inte ryms, fälls den som öppnades först in.

## Osläppt — sidopanelen fälls in och lägger sig över flödet

**Vad en värd måste göra:** ingenting för att editorn ska fungera — men den
ser annorlunda ut. Sidopanelen (Egenskaper, Förhandsgranskning) börjar nu
**infälld** till en 57 px spalt vid arbetsytans kant och lägger sig **över**
flödet när den öppnas, i stället för att stå bredvid det (berättelse 145).
Vill du att den börjar öppen skriver du `panel-open` på `<guide-editor>`
(eller `editor.panelOpen = true`) innan editorn ritas. Vill du minnas läget
lyssnar du på `panel-open-changed` med `{ open }`, som kommer när
redaktören öppnar eller fäller in den — aldrig när du själv sätter läget.
Biblioteket sparar ingenting (K6e), precis som för `panel-width`.

`panel-width` och `panel-width-changed` är oförändrade, men taket är nytt:
bredden hålls mellan 380 px och ytan panelen ligger över, minus 200 px åt
arbetsytans egna kontroller — inte längre editorns bredd minus 620, som
var regeln medan panelen stod bredvid.

Inget i guidens format ändras: panelens läge är en vy och hör aldrig till
grafen.

## Osläppt — FlowWeaver PRO: inlämningen är egna bundlar

**Vad en värd måste göra:** registrerar du en mottagare, eller använder
noderna *Inlämning* och *E-postresultat*, laddar du PRO-bundlarna i stället
för de öppna: `flowweaver-pro-viewer` och `flowweaver-pro-editor` (samma
globala API plus `registerSubmissionReceiver`, `listSubmissionRecipients`,
`VISITOR_RECIPIENT_ID`, `submissionSchema` och inlämningstyperna). De öppna
bundlarna exporterar inte längre inlämningsnamnen, och en öppen visare som
möter en guide med en inlämning ritar steget som ett vanligt resultat —
rubrik och text, inget skickas, inget referensnummer hittas på — och varnar
i konsolen. Sparade guider är oförändrade: typen `SubmissionSchema` är kvar
som öppet kontrakt (`meta.submissionSchema`), bara koden som räknar fram
schemat är PRO:s.

**Varför.** Det öppna FlowWeaver hjälper besökaren fram till ett svar;
FlowWeaver PRO låter besökaren skicka in det. Koden som skickar bor nu i
`src/pro/` och ingen öppen fil importerar den (grinden `open-core.test.ts`).

## Osläppt — inlämningen blir en egen modul

**Vad en värd måste göra:** ingenting om du skrev `modules="service"` (eller
`tjanst`) — det betyder nu två moduler, `pages` och `submission`, och ger
exakt det det gav. Ingenting för sparade guider: grafformatet är oförändrat.
**Ett undantag:** en editor i `feature-level="basic"` erbjuder inte längre
noden *Inlämning* i paletten. Den hade ingen spärr förut; nu kräver den
kapaciteten `submission`. Guider som redan har noden bevaras oförändrade vid
öppning och export (noden står kvar, den kan bara inte läggas till). Vill du
ha den i en enkel editor: lägg till `submission` i `modules`.

**Varför.** Gränsen mellan det öppna FlowWeaver och fullversionen går vid att
*skicka in*: det öppna hjälper besökaren fram till ett svar, fullversionen
låter besökaren lämna det. Modulen `service` blandade båda sidorna — sidor,
ruttanalys och tjänsteanrop med inlämning och e-postresultat — så den delas:
`pages` (sidor, ruttanalys, tjänsteanrop) och `submission` (inlämning,
e-postresultat). `EditorCapabilities` har ett sextonde namn, `submission`.

## 0.11.0 — formulärsatsningen: granska, lämna in, få kvitto

**Vad en värd måste göra:** ingenting för befintliga guider — grafformatet
lyfts automatiskt (v7, se nedan). Vill du ta emot inlämningar registrerar
du en mottagare; kontraktet står i `docs/INLAMNING-KONTRAKT.md`.

**Två nya nodtyper.** *Granska* visar besökarens svar som läsbara rader
med Ändra-knappar — motorn spelar upp resterande svar tillbaka till
granskningen, men aldrig frågan som ändras och aldrig förbi ett steg utan
sparat svar. *Inlämning* lämnar strukturerade svar till värdens mottagare
och visar kvittensen med mottagarens eget referensnummer; ett avvisat
ärende är ärligt — svaren kvar, försök igen, aldrig ett påhittat nummer.

**Inlämningskontraktet.** `registerSubmissionReceiver` exporteras ur både
visaren och editorn (editorn behöver katalogen till mottagarväljaren och
hälsokontrollen). Mottagare pekas ut med **id ur värdens katalog** —
adresser finns inte i kontraktets typer och kan därför aldrig hamna i
guidens JSON eller klientens trafik. Robotskydd utan captcha: honungsfälla
och tidsfälla, dömda hos mottagaren.

**E-postresultatet bytte till samma id-modell** — fritextfältet för
mottagaradress är ersatt av katalogväljaren plus valet "Besökarens egen
adress (ur ett svar)". Grafformatet lyfts till **v7**: en ren
`{{variabel}}` migreras automatiskt till besökarvalet; en bokstavlig
adress fortsätter fungera men flaggas av hälsokontrollen
(`legacy-email-recipient`) tills den pekats om. `EmailResultOutput` fick
`recipientId` — en värd som läser `resolved.to` får ett tomt värde när ett
katalog-id valts och ska då lösa id:t i sin backend.

**Formulärvänligare frågor.** Varje frågetyp kan bära en "Varför frågar vi
det här?"-rad (utfällare hos besökaren), sidor med flera fel får en
felsummering enligt WCAG-mönstret (räknad, länkad, fokuserad), och
formatregistret sätter `inputMode`/`autocomplete` så telefonfältet får
sifferknappsats och e-postfältet autofylls.

**Hälsokontrollen dömer mottagare.** `stale-recipient` när ett id städats
ur katalogen (ärenden går till värdens standardmottagare tills guiden
pekas om) och `legacy-email-recipient` för fritextadresser — aldrig någon
dom när ingen katalog är registrerad.

## 0.10.3 — nodhuvudet talar redaktörens språk, och etiketterna pekar mot sina portar

**Vad en värd måste göra:** ingenting. Rättelser och visuell polish, inga
API-ändringar.

**Nodhuvudet stramades upp.** "Start · " i huvudraden blev en liten
START-flik på kortets axel (genomsläpplig för draghandtaget), typetiketten
är vänsterställd och håller en rad med ellips i stället för att radbrytas
mitt i ordet, och "Saknar översättning"-plaketten ersattes av samma
varningsskylt som en okopplad nod bär — med meddelandet i markörens namn
och i nodens tillgängliga namn, så skärmläsaren hör mer än förut medan
ögat störs mindre.

**Radbruten text pekar mot sin port.** Utgångsetiketter är högerställda,
så ett långt svarsalternativ som bryter rad hänger ihop med pricken det
tillhör i stället för att andra raden driver åt vänster.

**Menyn och panelen talar redaktörens språk.** Arkiv säger "Exportera
guide" och "Importera guide" (filnamnet `.json` syns ändå i filväljaren),
fotomarkeringens inställning heter "Låt besökaren markera i bilden", och
översättningslägets hint säger källans faktiska språk — "The source in
English is shown for reference" — i stället för hårdkodad svenska.

**Terminologi:** den som använder en guide heter *besökare* (en:
*visitor*) i alla texter — verktyget riktar sig bredare än kommuner.

## 0.10.2 — kontrollernas kanter går att se, och kryssrutorna är våra

**Vad en värd måste göra:** ingenting. Bara rättningar. En ny token,
`--fw-border-control`, finns i `tokens.css` — har ni en egen temaadapter kan ni
sätta den, annars ärver ni vårt värde.

**Fältkanter som syns.** Varje textfält, listruta och knapp i både visaren och
editorn ritade sin kant med `--fw-border`, en token gjord för avdelare. Mätt mot
WCAG 1.4.11, som kräver 3:1: **1,47** i ljust läge och **1,95** i mörkt. Nu
`--fw-border-control` — 4,97 respektive 5,75 — vilket ligger nära webbläsarens
egen fältkant, den vårt datumfält redan fick gratis och klarade sig på. Arton
regler i nio komponenter.

**Kryssrutor och radioknappar ritas av oss.** Panelens kryssrutor var
**311×13 px** — de ärvde `width: 100%` från textfältens regel, blev bredare än
etiketten bredvid och lägre än de 24 px WCAG 2.5.8 kräver av något ett finger ska
träffa. Nu 18×18 i en rad som bär träffytan, med samma utseende i visaren och
editorn.

De är fortfarande `<input>`-element — aldrig `<div role="checkbox">` — så
tangentbord, formulärsemantik och skärmläsare är oförändrade. I Windows
högkontrastläge lämnas kontrollen tillbaka till plattformen med
`@media (forced-colors: active)`, så en egenritad ruta inte kan försvinna där.

**Varför det gjordes ritat och inte lämnat åt webbläsaren:** 1.4.11 undantar
kontroller plattformen målar, vilket låter som en tjänst och är en blind fläck —
vår mätning måste hoppa över dem, så en osynlig kryssruta hade ingen sagt ifrån
om. Ritad mäts den med allt annat.

## 0.10.1 — canvasen svarar på ett finger, och vyn står stilla när den ska

**Vad en värd måste göra:** ingenting. Bara rättningar, ingen ny yta, inga
ändrade kontrakt. Bädda in `lib/0.10.1/` eller stå kvar på `lib/0.10/`, som
pekar på den här.

**Vägen tillbaka fungerar på en surfplatta.** Knappen som hämtar hem guiden när
man panorerat bort från den gjorde ingenting på iPad. Mätt på enheten: fem tryck,
`pointerdown` och `pointerup` varje gång med `isTrusted` sant — och noll `click`.
WebKit skapade det aldrig. Ett tryck godtas nu direkt på `pointerup` när det är
kort, stilla och inte en mus; klick och tryck avdubbleras, så en webbläsare som
skickar båda anpassar vyn en gång.

**Och den tar dig till närmaste nod**, inte till hela guiden nedzoomad. Med smal
canvas och bred graf klampade anpassningen mot minsta zoom och landade på en vy
där guiden stack ut åt båda håll, för liten att läsa. Nu centreras noden närmast
där du står, med zoomen orörd.

**Vyn dras inte bort igen efter att den hämtats hem.** En flick lämnar ett glid
som rullar vidare, och centreringen slogs mot det: alla noder kom tillbaka och
var borta en halv sekund senare. Allt som centrerar om vyn stoppar nu rörelsen
först.

**Arbetsytan ger tillbaka plats den slutat behöva.** Trimmen kunde bara köra i
samma andetag som en tillväxt, så att panorera *hem* mot guiden gav aldrig
tillbaka något — mätt: ut till en kant och tillbaka, och ytan stod kvar på
2800×5400 hela vägen. Den körs nu när scrollen lagt sig.

**Anpassningen frågar efter plats innan den scrollar.** Ett mål till vänster om
arbetsytan klampades till noll, varpå bufferten läste nollan, växte ett steg och
kompenserade scrollen med exakt det steget — vyn hamnade där den började.
`centerViewportAt` har burit den ordningen sedan helskärmsarbetet; `fitToContent`
fick den aldrig.

## 0.10.0 — filuppladdningen fick en enklare modell, och canvasen blev användbar med fingrarna

**Vad en värd måste göra:** har ni kopplat `uploadFile` eller lyssnat på
`file-released` i 0.9.0 slutar de fungera — de finns inte längre. Byt till att
hämta filerna vid inlämning:

```js
preview.addEventListener("preview-node-changed", async (event) => {
  if (!ärSlutet(event.detail.nodeId)) return;

  await minTjänst.skicka({
    answers: preview.getAnswers(),
    files: preview.getFiles(),      // [{ fieldId, variableName, file }]
  });
});
```

**Varför.** 0.9.0 lät filen lämna webbläsaren så fort den valdes, med motiveringen
att formuläret annars bär megabyte genom varje steg. Det stämde inte: ett `File`
från en filväljare är ett handtag till något på disk, inte innehållet i minnet.
Med det borta försvinner varaktig lagring, referensen som måste gå att slå upp,
och gallringsansvaret — för det vanliga fallet, som är att en blankett skickas i
ett svep.

**Nodtypen har en variabel, inte två.** `referenceVariableName` är borttagen ur
*Bifoga fil*. En guide sparad med den bär en nyckel ingenting läser; det gör
ingen skada och behöver ingen migrering. Skrev ni `{{fotoRef}}` i ett resultat
blir det tomt — men det var det redan, om ni inte kopplat `uploadFile`.

**`getFormData()` kodar kroppen åt er.** Behöver ni posta svaren och filen till
en egen tjänst är det ett anrop:

```js
await fetch("/api/ansokan", { method: "POST", body: preview.getFormData() });
```

Samma kodning som ett riktigt formulär: varje svar under sitt variabelnamn, filen
som en egen del med `filename`. Skriver man kroppen själv är det lätt att tappa
filnamnet, eller att skicka urlencodat och få namnet utan bytes — tyst. En
filvariabel förekommer **en gång**, och det är filen: `cv` är inte strängen
`cv.pdf`.

**Modellen som togs bort är inte glömd.** `docs/FIL-KONTRAKT.md` beskriver den,
vilken tjänst den kräver, och varför den inte går att välja idag: en söm som
finns är en söm någon förlitar sig på.

### Canvasen går att använda med fingrarna

Allt nedan hittades genom att köra editorn på en surfplatta. Ingenting av det
syntes i sviten, och flera av dem gick igenom tester som såg ut att pröva just
den saken.

**Kopplingar går att dra.** Porterna saknade `touch-action`, så ett drag
scrollade canvasen i stället — och när det var löst avbröt släppet kopplingen,
eftersom en touch ger elementet implicit pekarfångst och `pointerup` landade på
porten man startade från. Snapavståndet räknas nu i skärmpixlar i stället för att
krympa när man zoomar ut, och ett finger får mer marginal än en mus.

**Nyp zoomar grafen, inte sidan**, som en tvåpunktstransform: det som ligger
under fingrarna stannar under dem. Panoreringen är därför vår, med tröghet och
en tröskel innan en beröring blir en rörelse.

**Menyn går att nå utan höger musknapp.** `⋯` i varje nodhuvud och ett handtag
mitt på varje koppling, båda också nåbara med tangentbord (`Shift+F10` eller
menytangenten). Fem av menyns kommandon fanns tidigare ingen annan väg till,
vilket gjorde det till ett tillgänglighetskrav och inte en förbättring.

**Helskärm väljer väg själv:** plattformens inne i en iframe, där den är det enda
som tar sig ur ramen, och ett eget läge annars — som inte kan kastas ut av
systemets svepgest.

**Arbetsytan lämnar tillbaka utrymme** den slutat behöva, i stället för att växa
hela sessionen tills guiden ligger tusentals pixlar utanför vyn.

**Minikartan visas när guiden inte syns**, inte när den *skulle rymmas*. Den
gömde sig förut precis när den var enda vägen tillbaka.

**Och när ingen nod alls är på skärmen finns en knapp mitt på ytan:** *Tillbaka
till guiden*. Att panorera förbi guiden är avsiktligt — så gör man plats för en
ny nod — men en canvas man panorerat tom ser inte tom ut, den ser trasig ut.

### Övrigt

**Kontrasten mäts även på kontroller som bärs av en form**, inte bara på text —
`ikonkontrastbrott` sveper varje ikonknapp i editorn i båda temana. En knapp som
ritar sig själv ska klara 3:1 mot omgivningen, annars är det glyfen som ska det.

**En kopplings färg överlever att sparas och läsas tillbaka.** Den skrevs till
lagringen men ströks vid inläsning, så en guide kunde färgas, sparas och öppnas
grå. Samma väg bär *Importera*.

## 0.9.0 — fyra fälttyper till, kodlistor att lägga till, och fyra svar som tappades på vägen

**Fyra nya fälttyper.** Ett formulär frågar efter mer än text och siffror.

| Nodtyp | Vad den gör |
| --- | --- |
| **Datumfråga** | `<input type="date">`, svaret som ISO-sträng, tidigast/senast |
| **Samtycke** | en kryssruta med sin egen etikett — inte ett flerval med ett alternativ |
| **Sökfält med flera val** | flera värden ur en sökt lista, visade som taggar, med minst/högst |
| **Bifoga fil** | filtyp och storlek prövas här, uppladdningen är värdens |

**Kodlistor: sådant ett fält väljer ur.** Länder enligt Skatteverkets NAVET (204
koder, ISO 3166-1 alpha-2), samt SCB:s 21 län och 290 kommuner. **Ingenting är
inbyggt** — listorna ligger som JSON bredvid bundlarna och en värd registrerar de
den använder. En lista kostar annars varje invånare en nedladdning i varje guide,
även de som aldrig frågar efter land.

**Regeln kan säga "är någon av".** Ett villkor i stället för tjugosju när en guide
förgrenar på tillhörighet — EU, Norden, utanför. Och datum jämförs i ordning, så
*från och till* är två villkor under `match: "all"`.

**Valideringen har fått en egen sektion**, med en ruta där redaktören kan **pröva
ett värde** och se exakt vad en invånare skulle få se. Regexen ligger sist, med
skälet bredvid sig: ett mönster kan bara säga att värdet har fel format, aldrig
vad som var fel.

**Nya format:** postnummer och organisationsnummer. Och personnummerkontrollen
prövar nu datumdelen — `9902310003` gick igenom förut — accepterar
**samordningsnummer**, och avvisar tio nollor.

### Fyra svar som tappades på vägen genom en sida

Alla fyra hade rätt kod i tjänsten och i komponenten, och tappade svaret däremellan.
En sida är vad ett formulär är, så det är där de kostade mest:

- **`format` prövades aldrig** för fält på en sida. Man kunde välja *Personnummer*,
  se det stå kvar i panelen, och aldrig få veta att det inte tillämpades.
- **Ett otickat samtycke rapporterades som `true`** — en kryssruta lämnar sitt
  `value` oavsett — så varje obligatoriskt samtycke passerade.
- **Ett uppslag på en sida tappade sin kod.** `codeVariableName` är hela skälet
  att koden finns, och den nådde aldrig svaren.
- **Datumsteget validerade och committade aldrig**, så guiden stod still med ett
  meddelande om fel sak.

### För en värd

**`getData()` stämplar nu grafens version.** Lagrar ni det ni får som JSON och
läser tillbaka det, tolkades det förut som v1 och kördes genom hela
migreringskedjan — inklusive de som gissar. Ingen åtgärd krävs; det som lagras
från och med nu säger vilket format det är i.

**Nytt: `registerCodeList(lista)`** för listor ett fält väljer ur, och
**`preview.uploadFile`** för filer. Båda följer samma mönster som `registerLocale`
— biblioteket signalerar, ni avgör vad som händer.

**En guide som använder de nya fälttyperna kan inte öppnas i 0.8.1.** Åt andra
hållet är allt oförändrat: guider byggda i 0.8.x fungerar som förut.

## 0.8.1 — portar ett finger träffar

**Portarnas träffytor är 44×44** — Apples mått sedan den första iPhonen, och
WCAG 2.2 SC 2.5.5. De var 18×18, vilket är bekvämt för en pekare som landar där
man tittade och dåligt för ett finger, som täcker en centimeter och kommer
ungefär rätt.

Pricken är kvar på 18 px. Den är också den punkt kopplingen ritas till, och på en
fråga med fem svar börjar större prickar tränga undan etiketterna — så det är
träffytan som växer, osynligt runt pricken, som på en kryssruta.

**Posterbilden på startsidan visar guiden.** Den som slagit på
`prefers-reduced-motion` fick filmens första bildruta, alltså den tomma
arbetsytan innan något ritats — en blank ruta där sidan lovar en stillbild.

### För en värd

**Noderna blir något högre.** Avståndet mellan två portar gick från 40 till 44 px
för att träffytorna inte ska överlappa varandra — två ytor ovanpå varandra gör
fel port nåbar, vilket är värre än en liten yta. Det kostar **4 px per portrad**:
en fråga med två svar växer 8 px, en med sex svar 24 px.

Ingen data ändras och inget API rör sig. Men en guide vars noder placerats tätt
för hand kan behöva luft mellan sig. Våra åtta exempel klarade sig utan
ändringar — kontrollerat med `example-graphs-no-overlap`, som prövar den saken
på ritade rutor och inte på positionerna i filen.

## 0.8.0 — hälsan i nodens huvud, vägarna på begäran, och en arbetsyta som går att nå med tangentbord

**Fel står inte längre skrivna i noden.** Ett band med ordet *Fel* låg tvärs över
varje drabbad nod, och i ett halvbyggt flöde är fel normaltillståndet — en nod är
felaktig i samma sekund den skapas. Bandet är ersatt av en **markering i nodens
huvud**, och den bär orsaken i klartext, inte ordet "Fel". Orsaken finns kvar i
hälsopanelen som förut.

Det var inte bara utrymme. Bandet **ändrade nodens höjd** — mätt, 213 px blev 232
— och den höjdändringen flyttade portarna under sig från kopplingar som redan var
ritade. Nitton pixlar fel, och det rättade sig aldrig. Markören har fast storlek,
så rörelsen uppstår inte längre.

**Fråga en nod vilka vägar som leder hit.** Högerklicka på ett resultat och välj
*Visa vägarna hit*: varje koppling som kan nå dit tänds, resten tonas ned. Det är
frågan en redaktör har om ett avslag, och den går inte att läsa ur en ritning så
fort det finns en regel i mitten. Fungerar på alla noder och alla nivåer.

**Ytan slutade prata ovombedd.** Den pulserande markeringen är borta. Nedtoningen
som slog till vid varje klick på en nod är borta — den såg likadan ut som
väganalysen och lästes som en väg som inte släckts. *Visa vägarna hit* svarar på
samma fråga, när någon ställt den. Och "Prova detta"-rutan är borta; behövs en
förklaring i ytan finns anteckningsnoder.

**En nedtonad port behåller sin färg** i stället för att bli genomskinlig. Tre
nedtoningar multiplicerades tidigare till 0,019 och porten försvann helt. Färgen
är information, opaciteten är fokus.

**En startnod är lika stor som samma nod annars.** Startnoden har ingen ingång, och
porten tog radens höjd med sig — mätt, 229 px blev 189, och allt under flyttade.
Raden står kvar och bara innehållet går. Garantin prövas nu på varje nodtyp som
döljer sina ingångar som start.

**Stora guider ritas sex gånger snabbare.** En guide med 120 noder tog två
sekunder att rita och tar nu 412 ms; 250 noder gick från 6,8 sekunder till 1,1.
Profilen pekade ut en rad: `get nodeData` lämnar ut en djup kopia — vilket är
rätt, ingen ska kunna nå in i elementet — och canvasen anropade den i slingor
bara för att jämföra ett id. Sextio procent av tiden gick åt till att kopiera
data ingen läste. Det finns nu en `nodeId`-getter för just den jämförelsen.

**Visaren följer värdens tema.** Den hade ingen temahantering alls: i en mörk sida
stod guiden kvar som ett vitt kort, eftersom tokens hänger på elementet och
ingenting satte det.

### Arbetsytan går att använda utan pekdon

**Kopplingar med tangentbord.** Enter på en utgång tar upp den, Enter på en ingång
fullbordar kopplingen, Escape lägger ner den — samma gest som draget, i två tryck.
Det halvgjorda läget syns som en grön ring på porten och sägs i en `aria-live`-ruta,
med namnet på noden i andra änden. Även ett avslag: en koppling grafen inte tar
emot får ett besked i stället för att tyst utebli.

**Pilarna flyttar mellan noder.** Fokus går till närmaste nod åt det hållet, med
rakt fram före något som ligger närmare men snett. Är noden upptagen med Enter
flyttar pilarna noden i stället, som i vilket ritverktyg som helst.

**Arbetsytan kostar lika många tabbstopp oavsett guidens storlek.** Varje nod bar
`tabindex="0"` och varje port är en knapp, så åtta noder gav 31 stopp och trettio
frågor uppemot hundratjugo. En nod i taget ligger nu i tabbordningen tillsammans
med sina egna portar, och pilarna flyttar vilken. Mätt efteråt: sju noder, tre
stopp.

**F6 hoppar mellan editorns fyra delar** — åtgärder, palett, arbetsyta, panel —
och Shift+F6 bakåt. Ctrl med en siffra gick inte att använda: webbläsarna behåller
dem för sina flikar.

**Portarnas träffytor är 24×24** i stället för 18×18, golvet WCAG 2.2 sätter
(SC 2.5.8). Pricken är kvar på 18 — den är också den punkt kopplingen ritas till.

Alla genvägar står i genvägsdialogen (`?`).

### För en värd

**Borttaget — det här bryter.** Tre delar av `<guide-editor>` finns inte längre,
eftersom funktionen de hörde till är borta:

| Borttaget | Vad du gör i stället |
| --- | --- |
| `showStarterHint(steps?)` | Inget. Rutan finns inte; använd anteckningsnoder om ytan behöver en förklaring. |
| `spotlightNode(id)` | Inget. Markeringen pulserar inte längre. |
| Händelsen `starter-hint-dismiss` | Sluta lyssna. Den skickas aldrig. |

Använder ni någon av dem: ta bort anropet. De kastar inget fel i dag — metoden
finns bara inte, så `editor.showStarterHint()` blir ett `TypeError`.

**Nytt: `theme` och `setTheme()` på `<guide-preview>`.** Samma API som editorn
redan har, och av samma skäl: satt på elementet och inte på dokumentet, så en
visare i er sida inte färgar om sidan runt sig.

```js
const preview = document.querySelector("guide-preview");

preview.setTheme("dark");   // "light", "dark" eller null för att följa systemet
```

Följer ni redan editorns tema är det en rad till på samma ställe.

## 0.7.3 — en palett som håller vad den visar

**En knapp som inte gör något är borta.** Paletten erbjöd mallar byggda på
nodtyper den aktuella nivån inte har — tre knappar märkta `@`, `☎` och `#` som
lade till ingenting när man tryckte på dem, utan fel och utan besked. En mall
erbjuds nu exakt när noden den skulle skapa gör det.

Orsaken var inte ett saknat filter utan en **inaktuell lista**: paletten gallrar
sina nodtyper när kapabiliteten byter, men mallistan skrevs bara om vid en
omritning. Så en editor som flyttades från `advanced` till `basic` fortsatte
erbjuda det den inte längre hade.

**Raden ovanför arbetsytan bryter mellan sina poster i stället för inuti dem.**
I ett smalt fönster bröt värdens text var som helst — *Du redigerar:* på en rad
och guidens namn på nästa, skilt från orden som säger vad det är. Nu flyttar
språkvalet ned i stället.

### För en värd

**Nytt: `unsupportedNodeTypes(graph?)` på `<guide-editor>`.** Svarar med namnen
på de nodtyper en graf innehåller som den aktuella funktionsnivån inte erbjuder.

```js
const missing = editor.unsupportedNodeTypes(guide);
// → ["calculation", "service-call"]
```

Den finns för det ögonblick en värd låter någon importera en guide. Editorn
klarar redan en nod den inte har nivå för — den ritas, dess data behålls, den
fungerar för besökaren, och panelen säger ifrån när man markerar den — men det
är en nod i taget, hittad genom att klicka. Det här säger det om guiden som
helhet, **innan** den sätts, så frågan *vill du höja nivån?* går att ställa i
rätt ordning.

Namn och inte ett antal, för *"två nodtyper ingår inte: Uträkning,
Serveranrop"* är en mening man kan svara på.

Ingenting brytande. Pekar ni på `lib/0.7/` får ni det här utan att göra
någonting.

## 0.7.2 — språkvalet flyttar dit det får plats

**Att välja språk står inte längre i verktygsfältet.** Etiketten intill det —
*Redigerar källan* eller *Översätter till* — bröt i två rader i ett fält som är
56 px högt, och tvingades den till en rad sköt den i stället språkväljaren
utanför kanten där den klipptes. Mätt vid 792 px, alltså den bredd en editor får
bredvid egenskapspanelen: väljaren slutade 39 pixlar utanför fältet.

Kontrollen sitter nu på raden ovanför arbetsytan, tillsammans med det värden
själv lägger där. Den raden ritas därför alltid; det är värdens egen post som
fälls ihop när den är tom. Menyerna i verktygsfältet är vänsterställda igen.

**Andelen översatt och hoppet till nästa oöversatta** följer med till samma rad,
och ryms nu bredvid varandra även när alla fyra syns samtidigt.

### För en värd

Ingenting brytande. `editor-toolbar` är intern och dess `guideLocales`,
`activeLocale` och `translationProgress` finns inte längre — de har flyttat in i
`guide-editor`, som är den enda som satte dem. Den publika ytan är oförändrad,
vilket dess frysta ögonblicksbild vaktar.

Pekar ni på `lib/0.7/` får ni det här utan att göra någonting. Pekar ni på
`lib/0.7.1/` står ni stilla tills ni byter siffra — vilket är hela poängen med
den adressen.

## 0.7.1 — en gest för listor, och versionerna står kvar

**Att ordna en lista med fingret.** Versionslistan och en frågas svarsalternativ
använder nu samma gest, och den fungerar på pekskärm. Ta tag i greppet och dra:
raden lyfts, de andra glider undan, och den du håller följer fingret tills du
släpper. Tröskel innan ett tryck blir ett drag, och en halv rads marginal innan
något byter plats — annars räckte en darrning.

Det var två olika drag förut, ett per lista, och det ena byggde på webbläsarens
HTML5-drag som inte finns på iPad. Nu är det ett: `startReorder` i
`src/controllers/reorder-gesture.ts`. Nästa lista kopplas in i stället för att
skrivas om.

**Helskärm på bred skärm lämnar plats åt vänster.** Första gången man gick i
helskärm på en riktigt bred skärm användes inte hela ytan, och noder gick inte
att flytta åt vänster. Andra gången fungerade det. Arbetsytan växte med ett fast
steg i stället för med det som faktiskt fattades.

**Versionerna säger vad de väger.** Listan visar storleken per version och säger
till när en närmar sig vad lagringen rymmer, i stället för att låta någon
upptäcka taket genom att slå i det.

**`<prompt-dialog>` ingår.** Listan ställer frågor som besvaras med ett ord, och
en värd som bygger sin egen lista behövde elementet.

### För en värd

Ingenting brytande. Pekar ni på `lib/0.7/` får ni det här utan att göra
någonting.

**Nytt:** `lib/<version>/` bevaras nu mellan utgivningar. Adressen till en
släppt version försvann tidigare vid nästa release, eftersom sajten byggs om i
sin helhet och bara den aktuella versionens katalog skapades. Varje släppt
version ligger nu i repot under `public/lib/<version>/` och republiceras oförändrad
vid varje utrullning. En pinnad adress är därmed pinnad på riktigt, och man byter
version genom att byta en siffra.

## 0.7.0 — rättelser efter releasen

Utgiven samma dag som 0.7.0 och i samma linje: pekar ni på `lib/0.7/` får ni det
här utan att göra någonting.

**Mellanslag drog inte arbetsytan när en nod var markerad.** Panoreringen gick
trögt, och noden ryckte tillbaka fokus medan man höll på.

Två saker ägde tangenten. Arbetsytan använder ett hållet mellanslag som handen,
och en nod med fokus tog det som *markera* — så varje repetition av
tangenttrycket, trettio gånger i sekunden, markerade noden igen. Varje markering
ritade om egenskapspanelen, och med en resultatnod och öppen förhandsgranskning
även den. Panoreringen blev en kräldrag.

En tangent kan inte betyda två saker på samma plats. **Arbetsytan behåller
mellanslag** — att hålla det är den enda vägen att panorera utan mushjul — och
**noden behåller Enter**, som markerar allt annat i editorn. Kortkommandorutan
sa dessutom bara hälften: mellanslag stod under *markera noden* och panorering
saknades helt. Nu står panorering där, och markering säger Enter.

**`lib/0.7/` — linjen, inte bara bygget.** Adresserna på sajten var fullständiga
versioner, och en rättelse som inte höjer numret hade då ingenstans att ta vägen
— eller, om den höjde det, bytte katalogen namn och nådde ingen som redan pekade
dit. Nu publiceras båda:

- `lib/0.7/` tar emot varje bygge i 0.7-linjen — rättelser når er utan att ni rör något
- `lib/0.7.0/` är versionens katalog, för den som hellre skriver hela numret

**Det som är hugget i sten är release-assetsen**, som skrivs en gång av taggen.
De innehåller alltså 0.7.0 utan rättelserna ovan — och kräver dessutom åtkomst
till repot, eftersom det är privat. Sajten är den adress som gäller.

## 0.7.0

**Versionslistan är en del av paketet.** `<guide-versions>` har funnits i
kodbasen sedan 0.6.0 men gick inte att nå utifrån. Nu exporteras den, med allt
vad det innebär: formen är bunden, och en ändring av den är en brytande ändring
härifrån och framåt.

### Nytt

**`<guide-versions>` — versionerna av en guide, och ingenting om var de ligger.**
Elementet ritar rader och skickar avsikter; att läsa, skriva, döpa om och ta bort
stannar hos den som äger lagringen.

```html
<guide-versions id="versions"></guide-versions>
```

```js
init(document.getElementById("versions"), {
  languages: { tool: "en" },
  theme: "dark",
  versions: [{ id: "12.abc", label: "guide.json", savedAt: 1754392320000, current: true }],
});

versions.addEventListener("version-activate-intent", (e) => publish(e.detail.version.id));
```

Sju avsikter: `version-open-intent`, `-activate-`, `-duplicate-`, `-rename-`,
`-note-`, `-delete-` och `-reorder-`. Alla ligger i den frysta ytan.

**`init()` tar `versions` och `theme`.** Samma anrop wirar editorn och listan, av
ett skäl som kostade oss en kväll att se: språket går fel **tyst**. Listan
levereras med svenska och engelska och faller tillbaka på svenska, så en engelsk
sida som satte editorns språk men inte listans fick en engelsk editor ovanför en
svensk tabell — utan att något sa ifrån.

**`theme` och `setTheme()` på versionslistan**, med samma ord och samma
semantik som på `<guide-editor>`: `null` lämnar tillbaka beslutet till
operativsystemet.

**`lib/X.Y.Z/` på sajten.** Bundlarna publiceras nu även under versionens egen
katalog:

```html
<script src="https://johanfuruskog-create.github.io/flowweaver/lib/0.7.0/flowweaver-viewer.global.js"></script>
```

Det är **versionens linje**, inte ett visst bygge: den tar emot rättelser så
länge changeloggen står på numret, men aldrig en brytande ändring — 0.x-regeln
höjer minor för sådana. En värd uppgraderar genom att byta en siffra, medvetet.
Adressen utan version är fortfarande rullande och når er den dag något mergas.
Vill ni ha något som aldrig kan ändras alls finns release-assetsen.

### Rättat

**Versionslistan fick inga temavariabler hos en värd.** `guide-versions` stod
inte i tokens-scopet, så varje `var(--fw-…)` i den resolvede till ingenting:
menyns bakgrund var genomskinlig och sidan under lyste igenom. Drabbade bara den
som redan nådde elementet ur källkoden, alltså oss.

**En öppen meny ritades under värdens egna element.** Panelen lämnar elementets
låda, och allt som ritats efter oss målade över den. Elementet tar nu plats i
staplingen medan en meny är öppen, och lämnar tillbaka den när den stängs.

### Ändrat i gränssnittet

Ingenting av det här är ett API, men redaktören kommer att se skillnaden.

**Sex knappar per rad blev en knapp och en meny.** *Visa för besökare* stannar på
raden — det är vad listan finns för — och resten ligger bakom *Åtgärder*.
Versionens namn hade sex tecken kvar när knapparna tagit sitt; nu har det
bredden.

**Etiketten säger `Publicerad`**, i grönt, i stället för *Visas för besökare*.

**Nekade åtgärder är `aria-disabled` i stället för `disabled`.** En avstängd
knapp kan inte få fokus, så *Ta bort* på den publicerade raden — det enda
alternativ som bär ett skäl — var det enda ett tangentbord aldrig kunde nå.
Läser ni DOM:en i egna tester är det här raden att ändra.

## 0.6.0

**Guider som redigerats i editorn tappade sina inställningar när de sparades.**
Det är den viktigaste raden i den här utgåvan — läs den även om ni inte rör
något annat.

### Rättat, och det brådskar

`getData()` — det `graph-changed` bär, alltså det ni sparar — returnerade
canvasens kopia av grafen hel. Canvasens `settings` är vad som fanns när guiden
laddades, och ingenting uppdaterade den.

Så en ändring av **vilka språk guiden erbjuds på** eller av en **text redaktören
anpassat** applicerades, visades rätt i panelen, hamnade i ångra-historiken —
och försvann på vägen ut. Editorn såg rätt ut och sparningen var fel.

Noder kommer nu från canvasen och inställningar från editorn: varje halva från
sin ägare.

**Vad ni bör göra:** guider sparade med 0.5.0 eller tidigare kan sakna
`settings.locales` och `settings.strings` som redaktören faktiskt satt. Det går
inte att återskapa ur grafen — de skrevs aldrig. Be redaktörerna kontrollera
språkvalen och de anpassade texterna i guider de redigerat.

### Att göra vid uppgradering

**1. Redaktören kan inte längre lägga till eller ta bort språk.**

Panelens fritextfält, *Ta bort*-knappen och radioknappen för källspråk är borta.
Kvar är en kryssruta per språk. Källan är ibockad och avstängd.

Vilka språk som får bockas i kommer från `declareLocales()`. **Har ni inte
kallat på den ser redaktören bara guidens egna språk och kan inte lägga till
något.** Deklarera vid uppstart:

```js
declareLocales(["sv", "en", "fi"], { default: "sv" });
```

Att bocka av ett språk ändrar bara `settings.locales` — översättningarna ligger
kvar i noderna, så det är reversibelt.

**2. Källspråket sätts utifrån.**

`settings.sourceLocale` i guiden, med värdens förval för en ny guide. Editorn
kan inte längre byta det, och händelserna `guide-source-locale-changed` och
`guide-locale-blocked` finns inte kvar.

### Nytt

**Guiden säger när den inte finns på ditt språk.** En invånare som ber om
finska och får svenska får också veta varför:

> Guiden är inte översatt till finska. Den visas därför på svenska.

Meddelandet visas per steg — en guide är ofta delvis översatt — och löses upp
med **engelska före källan**, eftersom hela dess syfte är att läsas av någon som
inte kunde läsa guiden. Ett registrerat paket på läsarens språk vinner över
båda.

**`active-locale` som attribut på `<guide-preview>`.** Visaren tog sitt språk
bara genom en property, så `setAttribute` gjorde ingenting alls — tyst. Det gick
alltså inte att bygga en språkväljare mot den.

**Nodernas text på canvasen läses åt rätt håll.** `dir` och `lang` sätts på
nodens innehåll när innehållsspråket läses höger-till-vänster. På innehållet,
inte på kortet: headern namnger nodtypen och är verktygets ord.

**Språkväljaren i verktygsraden är avstängd** när guiden bara erbjuds på ett
språk. En lista med ett alternativ läser som något trasigt.

### Rättat i övrigt

**Reservspråket var alltid svenska.** En guide skriven på engelska med en delvis
svensk översättning svarade en läsare som bett om arabiska på svenska. Kedjan är
nu *efterfrågat → basspråk → guidens källa → engelska → första*, och gäller både
innehållet och visarens knappar.

**Översättningsandelen mätte hela texttabellen.** En översättare av en åttanodig
guide fick veta att 52 saker återstod, varav de flesta texter guiden aldrig
renderar. Andelen mäts mot vad guiden faktiskt kan visa — 10 i stället för 49
för screening-guiden. Knappen säger *"text"* i stället för *"nod"*, eftersom den
stannar vid båda sorterna.

**Nodtypens namn översattes inte överallt.** Paletten sa *Question* medan noden
bredvid sa *Fråga*. Samma uttryck fanns på sex ställen och var rätt på två.

**Editorns skal bytte inte språk.** Flikarna *Egenskaper* och
*Förhandsgranskning* renderades en gång och stod kvar på svenska i en engelsk
editor.

**`checkSetup` påstod "meets Swedish buttons".** Den namnger guidens faktiska
språk.

## 0.5.0

Ett språk som saknas faller nu tillbaka på **guidens eget källspråk**, inte på
svenska. Och visartexternas nycklar heter vad en invånare ser, inte vilken
komponent som ritar dem.

### Att göra vid uppgradering

**1. Registrerar ni ett språkpaket: nycklarna har bytt namn.**

De hette `preview.*`, vilket namngav komponenten — och `guide-preview` ritar två
olika saker för två olika publiker. De heter nu vad de är på invånarens skärm.

| Före | Efter |
| --- | --- |
| `preview.writeAnswer`, `preview.required`, `preview.hint.*`, `preview.chooseOption`, `preview.selectPlaceholder`, `preview.enterNumber*`, `preview.unitSuffix`, `preview.chooseOneOrMore` | `field.*` |
| `preview.lookup.*` | `lookup.*` |
| `preview.noImage`, `preview.annotationCounter` | `image.none`, `image.commentCounter` |
| `preview.currentStep`, `preview.unnamedNode` | `step.current`, `step.untitled` |
| `field.chooseOption` *(felmeddelandet)* | `validation.chooseOption` |

`nav.next`, `nav.previous` och `nav.restart` är **oförändrade** — det var de enda
en redaktör kunde anpassa före 0.4.0.

En nyckel under ett gammalt namn slutar gälla **tyst**: texten finns ju, den är
bara inte längre överskriven. `coverageOf("ar")` visar tappet. Ingen migrering
följer med, eftersom 0.4.x aldrig nått en installation — receptet för att göra
det ordentligt efter lansering står i `docs/JSON-KONTRAKT.md`.

**2. Visar ni `email-result` för en invånare: uppdelningen är borta.**

`Producerar e-postdata – skickar inte.`, varningen om saknade variabler och
listan `Till/Ämne/Brödtext` var byggarens vy, och den ritades även för
invånaren — med den upplösta mottagaradressen utskriven. Invånaren får nu
nodens rubrik och beskrivning som varje annat steg. Datan kommer oförändrat ur
`getOutput()` och `email-result`-händelsen; presentationen är er.

### Rättat

**Reservspråket var alltid svenska.** En guide skriven på engelska med en delvis
svensk översättning svarade en läsare som bett om arabiska på **svenska** —
varken det efterfrågade språket eller guidens källa. Kedjan är nu

    efterfrågat → dess basspråk → guidens källa → engelska → första

Engelska ligger efter källan: källan är den text författaren faktiskt skrev och
den enda som garanterat är komplett. En guide utan `settings.sourceLocale` löses
fortfarande upp som svensk — sådant innehåll *är* svenskt.

**Knapparna föll tillbaka åt ett annat håll än innehållet.** En somalisk läsare
av en engelskskriven guide fick engelska frågor och svenska knappar på samma
skärm. De följer varandra nu.

**`checkSetup` påstod "meets Swedish buttons".** Den namnger guidens faktiska
språk.

### Nytt

**`active-locale` som attribut på `<guide-preview>`.** Visaren tog sitt språk
bara genom `activeLocale`-propertyn, så `setAttribute("active-locale", …)` gjorde
ingenting alls — tyst. En värd som bäddar in visaren i vanlig HTML hade ingen väg
att säga vilket språk som skulle visas, och en språkväljare på sidan gick inte
att bygga. Attributet speglar `guide-editor` och läses redan när grafen landar.

**En sida för den som sätter upp språken.** `examples/language.html` kör
`declareLocales`, `registerLocale`, `coverageOf`, `active-locale`,
`editor-locale` och `checkSetup` och skriver ut vad anropen gav. Guiden på sidan
är skriven på engelska med delvis arabisk översättning — det är vad en ofärdig
översättning ser ut som. Den ingår inte i biblioteket; den ligger på sajten.

### Städat

Fem valideringstexter var samma regel sagd två gånger (`field.minLength` bredvid
`validation.minLength`) och en översättare fick skriva båda. Sidfältens väg
använder `validation.*`.

Editorns egna canvas-texter heter `canvas.*` i stället för `preview.*`, och en
grind renderar varje nodtyp som en invånare möter den och kräver att varje nyckel
den frågar efter är en visarnyckel.

## 0.4.1

Releaserna innehöll bara ES-modulerna. **De klassiska byggena publicerades
aldrig**, trots att de byggs — så en `<script src>` mot en release-fil mötte
`export {` i en klassisk parser och kastade `SyntaxError`.

### Att göra vid uppgradering

**Laddar ni oss med en vanlig script-tagg: peka på `.global.js`.**

```html
<script src=".../v0.4.1/flowweaver-editor.global.js"></script>
```

`flowweaver-editor.js` är ES-modulen och kräver `type="module"` eller en
bundlare. Båda publiceras nu.

Det drabbade Sitevision-modulens inställningsdialog i varje version före den
här: editorn registrerades aldrig och dialogen visade sitt laddningsfel.

`smoke:lib` band aldrig ihop vad vi bygger med vad vi publicerar — den mätte
`dist-lib/` lokalt, där båda filerna alltid funnits. Den jämför listorna nu.

## 0.4.0

Språk är tre saker, inte två. Och paketet kan för första gången svara på frågan
*"blev uppsättningen rätt?"*

### Att göra vid uppgradering

**En sak krävs, och bara om ni märkt beteendet.** Att byta språk i editorns
verktygsrad ändrar inte längre editorns egna knappar och paneler.

Förut gjorde den det, och det var fel: en översättare som bytte till engelska
för att översätta *innehållet* fick verktyget att byta språk under händerna.
Axlarna är åtskilda nu.

Har ni en språkkontroll som förlitade sig på det, sätt attributet:

```js
editor.setAttribute("editor-locale", "en");   // verktygets språk
```

Innehållsspråket väljs fortfarande i verktygsraden och rör bara guidens text.

### Nytt: värden äger språken

```js
FlowWeaver.registerLocale("fi", { "editor.toolbar.file": "Arkisto" });
FlowWeaver.declareLocales(["sv", "en", "ar"], { default: "sv" });
```

Ett tredje editorspråk kräver **ingen kodändring** — registrera ett paket och
sätt `editor-locale`. Svenska och engelska följer med paketet; resten är er.

`declareLocales` gör "lägg till språk" till ett val ur er lista i stället för en
fritextruta. Säger ni ingenting behåller editorn fritextrutan — en förvaltning
som behöver somaliska ska inte blockeras för att ingen anropat funktionen.

`registerLocale` svarar med hur mycket paketet täcker, per publik. **Ingenting
stängs av för ett halvt paket:** en fullständighetsregel hade tagit ert finska
verktyg ifrån er i det ögonblick ni uppgraderar, för en ändring ni inte gjort.

### Nytt: visarens texter är innehåll

*Nästa*, *Föregående* och *Välj ett alternativ* räknas nu i
översättningsandelen och nås av hoppet till nästa oöversatta. Förut kunde en
guide visa **100 %** medan en invånare mötte svenska knappar i en arabisk guide.

Redaktören kommer åt alla 55 visartexter, inte tre av dem. En text invånaren ser
men redaktören inte når är en text ingen äger.

Och en guides `settings.strings` kan bara överstyra visartexter. En nyckel som
hör till verktyget bevaras men gör ingenting — ingen guide byter namn på *Fråga*
i paletten.

### Nytt: fråga om uppsättningen

```js
FlowWeaver.checkSetup(document.querySelector("guide-editor"));
```

Svarar med vad som saknas **och vad det leder till**. Den varnar bara för det
den kan se: den vet inte om er sparningslyssnare faktiskt sparar, och säger
därför ingenting om det.

Ett minimalt exempel finns på `examples/minimal.html` — och det kan inte bli
inaktuellt, för samma kod körs av ett test som låter `checkSetup` döma.

### Rättat

En sida i den medskickade bolåneguiden renderade **noll fält**. Två
obligatoriska fält, namn och kommun, saknades tyst sedan migrering v3→v4.
Exempeldata går nu genom samma formatvakt som allt annat.

Editorns innehållsfält följer textriktningen: en översättare som skriver
arabiska ser sin text som invånaren kommer att se den. Variabelnamn och
alternativens värden står kvar vänsterlästa — de är koder, inte text.

## 0.3.0

Designvariablerna flyttar ett steg ner från `:root`, och bundeln bär dem själv.

### Att göra vid uppgradering

**Ingenting krävs.** En konsument som laddar bundeln får rätt utseende utan att
också hämta `tokens.css`.

**Två saker blir möjliga:**

Ni behöver inte längre scopa om vår CSS för att slippa få er egen sida
ommålad. Variablerna ligger på FlowWeavers egna taggar, så en inbäddad editor
klär sig själv och ingenting annat — värdens rullister, formulärkontroller och
bakgrunder rörs inte.

Vill ni ändra en färg stylar ni **elementet** i stället för dokumentet:

```css
guide-editor { --fw-primary: #b45309; }
```

Selektorerna ligger i `:where()` och har noll specificitet, så vilken regel som
helst hos er vinner utan `!important`.

**Det som slutar fungera:** att sätta `--fw-*` på `:root` påverkar inte längre
våra komponenter. Ett direkt satt värde på elementet vinner alltid över ett ärvt.
Flytta regeln till elementet.

För den som vill klä ett helt område där flera av våra element bor — en dialog,
en panel — finns opt-in-klassen `.flowweaver-scope`.

### Varför

Varje värd som bäddade in oss fick skriva ett eget skript som bytte ut
selektorn, för `:root` satte `color-scheme` på hela deras dokument. I mörkt
OS-läge blev deras kontroller svarta av att någon lagt in en guide.

Ungefär en tredjedel av Sitevision-exemplet fanns bara för att lösa det. Ett
andra exempel hade fått samma kod en gång till.

## 0.2.1

Rättar en läcka i 0.2.0. Elementnivå-temat satt på `[data-theme]`, som är en
vanlig konvention en värd själv kan använda — varje element på värdens sida med
det attributet fick våra variabler **och** `color-scheme`, som styr hur
webbläsaren ritar formulärkontroller och scrollbars i hela subträdet.

Attributet är nu vårt eget: `data-fw-theme`. `setTheme()` och `theme`-attributet
fungerar som förut; det är bara det interna attributnamnet som bytt.

På dokumentet läser vi fortfarande `:root[data-theme]` — där är det sidans eget
val, och det är sidan som satt det.

Hittades vid uppgraderingen av Sitevision-modulen, där all CSS scopas om till
modulens rot. Vakten som skulle fångat det kontrollerade att inget `:root` blev
kvar, alltså ett antagande om vad filen borde innehålla. Den kontrollerar nu det
som faktiskt gäller: att **varje** selektor nämner modulens klass.

## 0.2.0

Sju berättelser byggda (se [`docs/STORIES/`](docs/STORIES/README.md)), och två
genomgripande omtag: hur nodmallar fungerar, och vad editorn låter en användare
göra.

### Att göra vid uppgradering

**1. Sätt `mode`. Editorn är annars låst.**

Förmåga är nu **opt in** — utan attribut får man `readonly`, och det gör även ett
okänt värde. Det gäller också `<guide-editor>` utan attribut i HTML.

```html
<guide-editor mode="edit"></guide-editor>
```

| Läge | Får | Tar bort jämfört med steget ovanför |
| --- | --- | --- |
| `administrator` | allt | — |
| `edit` | bygga guiden, **använda** mallarna | hanteringen av det gemensamma mallbiblioteket |
| `translator` | översätta till valt språk | källtexten, identiteter, positioner, paletten |
| `readonly` | titta | allt |

**2. Bygg en tema-kontroll om ni vill ha en.**

Editorn har ingen tema-knapp längre — en växlare är värdens chrome.

```ts
editor.setTheme("dark"); // "light" | "dark" | null (följ OS-inställningen)
```

Temat sätts på elementet, inte på dokumentet: editorn färgar inte längre om
sidan omkring sig.

**3. Ta över lagringen av det biblioteket slutat spara.**

Biblioteket rör ingen lagring alls — det anropar värden med data och värdsystemet
avgör vad som händer. Det som flyttat ut sedan 0.1.1: temavalet
(`theme-change`) och startknuffens avfärdande (`starter-hint-dismiss`).

### Grafformatet: v3 → v6

Gamla filer migreras vid inläsning; ingen behöver skrivas om för hand.

- **v4** – sidans två inbyggda textfält blir riktiga barnnoder.
- **v5** – nodmallar blir grundtyp plus värden i stället för en fryst kopia.
  `settings.customNodeTypes` → `settings.nodeTemplates`.
- **v6** – en nod ur en mall får grundtypen som `type` och mallens nyckel som
  härkomst i `template`.

**Nedgradering är säker.** Kontrollerat mot 0.1.1: en guide sparad av 0.2.0 öppnas
utan fel, ritas som riktiga noder och tappar varken `template` eller
`nodeTemplates` — okända nycklar bevaras. Sparar 0.1.1 tillbaka läser 0.2.0 den
utan skada, eftersom migreringarna är formvaktade och blir tomma operationer på
redan migrerat innehåll.

### Nodmallar

En mall är en **grundtyp plus sparade värden**, inte en egen nodtyp. Formen ägs
av grundtypen och ärvs levande, så en rättning når varje sparad mall.

- Mallen är **härkomst, inte identitet**: tas den bort fungerar noderna
  oförändrat, de heter bara grundtypens namn.
- En borttagen mall går att **återskapa** från noderna, under samma nyckel.
- Borttagning kräver en bekräftelse som säger vad som händer och hur många noder
  i guiden som berörs.
- Härkomsten går att byta eller ta bort per nod, utan att någon egenskap ändras.

### Redaktörens vardag

- Guiden har namn, beskrivning och ansvarig.
- Kontroller som visar vad som är trasigt, med märkning på noderna och prickar i
  minikartan.
- En ny sida börjar tom, med en anvisning i stället för två fält man måste ta
  bort.
- Översättningsläge med andel klart, markerade noder, källtext under fältet och
  ett hopp till nästa oöversatta.

### Rättat

- Porten trycktes ihop till en oval när svarsalternativet var långt. Cirkeln är
  både träffområdet och kopplingens ankarpunkt, så det var mer än kosmetik.
- Ett fälts standardvärde deklareras nu en gång, tillsammans med fältet.

## 0.1.1

Första fungerande distributionen: visaren och editorn som fristående bundlar,
tokens.css och typdeklarationer.

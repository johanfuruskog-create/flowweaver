# Filkontraktet

Fältet *Bifoga fil* (`file-question`) lämnar över filen till **dig**. Det här
dokumentet beskriver vad Flowweaver gör, vad den kräver tillbaka, och vad den
**inte** kan göra och därför är ditt ansvar.

## Grundprincipen

Flowweaver laddar aldrig upp och lagrar aldrig. Två krav bestämmer det:

- **K9:** anrop till tredje part sker i BFF:en, aldrig i klienten. En guide som
  körs inbäddad på en kommunsida får inte bära en nyckel till ert filarkiv.
- **K6e:** biblioteket lagrar ingenting. Persistensen är er.

## En modell byggd, en beskriven

Det avgörande är **när** filen lämnar webbläsaren, och det avgörs i sin tur av
vad som ska hända med den.

| | **A. Håll till inlämning** | **B. Ladda upp vid val** |
| --- | --- | --- |
| | **byggd** | **beskriven, inte byggd** |
| Filen reser | en gång, vid inlämning | när den väljs |
| Behöver en tjänst | nej | **ja** — något som tar emot den |
| Varaktig lagring | nej | ja |
| Referens att slå upp | ingen | ja |
| Gallring | ingen fråga | er rutin |
| Utkast som kan återupptas | nej | ja |
| En omladdning | tappar filen | behåller den |

**A är det enda som går att välja**, och det är avsiktligt. De flesta blanketter
skickas i ett svep: någon fyller i, bifogar sitt CV, skickar. Då finns ingen
anledning att filen ska ta vägen någonstans dessförinnan — och allt det som gör
filer besvärliga, hela vägen ner till arkivlagen, gäller inte.

B är beskriven för att formen ska finnas kvar den dag någon behöver den, inte för
att den ska gå att koppla in idag. **Halvbyggd valfrihet är sämre än ingen**: en
söm som finns är en söm någon förlitar sig på, och den skulle ha pekat på en
tjänst ingen av oss har skrivit.

**Ett `File` kostar ingenting att hålla.** Det är ett handtag till filen på disk,
inte innehållet i minnet; webbläsaren läser bytesen först när någon begär dem. Att
bära det genom tio steg är gratis. Det var ett felaktigt antagande om just detta
som gjorde att den här texten först bara beskrev B.

## A. Håll till inlämning

> **Det som är byggt.** Det enda fältet gör.

Filen stannar i webbläsaren tills guiden nått sitt slut, och skickas då i **ett**
anrop tillsammans med resten av svaren.

En guide har ingen *inlämning* i sig — den **når ett resultat**, och värden
märker det på `preview-node-changed`. Filerna hämtas därför på samma sätt som
svaren, med en metod bredvid den som redan finns:

```js
preview.addEventListener("preview-node-changed", async (event) => {
  if (!ärSlutet(event.detail.nodeId)) return;

  await minTjänst.skicka({
    answers: preview.getAnswers(),
    files: preview.getFiles(),      // [{ fieldId, variableName, file }]
  });                                // multipart
});
```

Ingen ny livscykel uppfinns: `getFiles()` står bredvid `getAnswers()` och svarar
på samma fråga om en annan sorts svar. Ingenting har rest innan dess, så det
finns ingenting att städa om någon ångrar sig eller stänger fliken.

### Ett exempelfoto, om värden bjuder på ett

Story 108. En filfråga kan bära ett **exempelfoto** i sin data — en adress och
en alt-text — och en visarsida som sätter attributet `example-files` på
`<guide-preview>` får då knappen *Använd exempelfoto* bredvid filväljaren.
Trycket hämtar adressen och lägger resultatet i fältet som en `File`.

**Därefter är det besökarens fil**, utan undantag: samma kontroll av typ och
storlek, samma plats i `heldFiles`, samma `getFiles()` och `getFormData()`,
samma markeringar — och samma gallring, vilket här betyder ingen, eftersom
ingenting reser före inlämningen (modell A). Det finns ingen väg vid sidan av
filfältet, för en andra väg vore en andra sak att hålla sann.

Knappen är **värdens**, aldrig påslagen av sig själv: exempelsajten bjuder på
en bil att peka i, en riktig skadeanmälan har inget exempel att bifoga. Och
biblioteket lagrar fortfarande ingenting och hämtar ingenting i förväg — det
enda anropet är den adress noden pekar på, i det ögonblick någon trycker.

### Eller låt webbläsaren koda kroppen

`preview.getFormData()` ger samma sak, kodad som ett riktigt formulär hade kodat
den:

```js
await fetch("/api/ansokan", { method: "POST", body: preview.getFormData() });
```

**Varför det är mer än en bekvämlighet.** Det är den här delen värdar gör fel.
En multipart-kropp snickrad för hand tappar `filename`; en kropp som blir
urlencodad i stället för multipart bär filens *namn* och noll bytes, och
ingenting någonstans säger till. `fetch` med en `FormData` skriver alltid
multipart med en gräns, så hela den felklassen är borta.

**En filvariabel förekommer en gång, som filen.** Ett riktigt formulär med
`<input type="file" name="cv">` ger *en* del — filen, med `filename="cv.pdf"` —
och ingen extra textdel som upprepar namnet. Vi gör likadant: `cv` är filen, inte
strängen `cv.pdf`. Hade vi lagt in båda skulle `data.get("cv")` ge strängen och
gömma filen bakom den.

Har ett filfält ingen variabel kan guiden inte hänvisa till det, men filen är
ändå verklig — den läggs under `file-<fältets id>` snarare än att tappas tyst.

### Hur ni plockar upp den på andra sidan

**Kroppen bär bara det som behövs för att ta emot inlämningen.** Svaren och
filerna, ingenting om hur guiden är byggd — inga rubriker, inga nod-id:n, ingen
graf. Det är avsiktligt och det är till er fördel: allt vi lade i kroppen skulle
bli något er endpoint kan börja läsa, och därmed något ni sitter fast i nästa gång
vi ändrar det. Behöver ni mer finns det att fråga efter, och då gör ni det
uttryckligen.

Det som kommer fram är en vanlig multipart-kropp. Ingenting av det här är vårt
format — det är webbläsarens, och er plattform kan redan läsa det.

```js
const data = await request.formData();

const namn = data.get("namn");   // "Anna Andersson"
const cv = data.get("cv");       // File
```

**I Sitevision** (skiss, ej körd mot en installation) läser WebAppens serverkod
samma kropp: `request.getParameter("namn")` för svaren och `request.getFile("cv")`
för filen, som anländer som en `sv:temporaryFile` — vilket räcker hela vägen, om
det är ett mejl den ska bifogas.

**Nyckeln är variabelnamnet redaktören valde.** Det är hela sammanbindningen: ett
fält som heter `cv` blir en del som heter `cv`. Och det är också den svaga punkten
värd att känna till innan den biter:

> **Variabelnamn är ett gränssnitt, inte en etikett.** Döper en redaktör om `cv`
> till `meritforteckning` slutar er endpoint hitta filen, tyst. Behandla dem som
> kolumnnamn i en tabell er kod läser — ett byte är en brytande ändring, och den
> sker i editorn där ingen ser er kod.

Behöver ni något stabilare finns **fältets id** — nodens id i grafen, som inte
ändras när variabeln döps om — men det får ni be om: `getFiles()` ger det. Det
ligger inte i kroppen, dels för att det hade krävt en extra textdel per fil och
det är precis den dubbleringen vi undviker ovan, dels för att de flesta värdar
inte behöver det och inte ska betala för det.

**Vad ni kan läsa av filen**, och vad ni inte ska tro på:

| | |
| --- | --- |
| `file.name` | filnamnet personen valde. Läsbart, och det enda vi lovar |
| `file.size` | bytes. Sant |
| `file.type` | webbläsarens **gissning** ur filändelsen. Sniffa själva om det spelar roll |

**Ett fält bär en fil.** Vi läser `files[0]`, och filväljaren är inte `multiple`.
Ska tre bilagor bifogas är det tre fält — eller repeatern, som inte är byggd.

**Frågornas rubriker följer inte med.** Ni får `{ namn: "Anna", cv: "cv.pdf" }`,
inte *"Vad heter du?"*. Motorn har rubrikerna internt för historikvisningen, och de
ligger med flit inte på den publika ytan: en rubrik är redaktörens text på det
språk besökaren råkade välja, och en endpoint som byggde något på den skulle gå
sönder av en språkändring eller en omformulering.

För ett e-postresultat spelar det ingen roll — redaktören skrev texten runt
variablerna. Bygger ni ett ärende av svaren är mappningen från variabelnamn till
mening er, och det är ytterligare ett skäl att läsa rutan ovan om att
variabelnamn är ett gränssnitt.

**Vad vi inte kan låna av webbläsaren:** själva inlämningen. Ett native
`<form action>` är en *navigering*, och en guide slutar på en resultatnod som vi
ritar — postar webbläsaren och lämnar sidan finns den noden inte. Många guider
postar dessutom ingenting alls; det finns ingen `action` att peka på. Kodningen
går att låna, inlämningen inte.

**Ett e-postresultat är det typiska fallet.** Ansökan skickas, CV:t bifogas
mejlet, och filen behöver aldrig existera någon annanstans.

**I Sitevision** anländer filen då som en `sv:temporaryFile` i samma begäran, och
det är precis vad en temporär fil är till för: den ska leva från inlämning till
utskick och inte längre. Ingen flytt till arkivet, ingen identifierare att
bevara.

**Priset:** en omladdning mitt i formuläret tappar filen, och ett sparat utkast
kan inte innehålla den. Webbläsaren tillåter inte att ett filfält fylls i av
kod — av goda säkerhetsskäl — så det gäller oavsett vad vi gör.

## B. Ladda upp vid val

> **Inte byggd, och går inte att välja.** Det finns ingen `uploadFile`, ingen
> `file-released` och ingen referensvariabel — de togs bort, för en söm som finns
> är en söm någon kopplar in. Det här avsnittet är en beskrivning inför
> framtiden, inte en beskrivning av produkten.

Skulle behövas när filen måste överleva sessionen: utkast som ska kunna
återupptas, ett långt ärende, eller ett flöde där filen granskas innan resten
skickas. Ingen av dem är aktuell nu, och A täcker det som är det.

Formen den skulle ha, skissad så att nästa omgång slipper börja om:

```js
// Skiss. Finns inte.
preview.uploadFile = async (file, context) => {
  const sparad = await minTjänst.spara(file);   // en riktig endpoint

  return { reference: sparad.id, label: file.name };
};
```

| I `context` | Betydelse |
| --- | --- |
| `nodeId`, `fieldId` | vilket fält filen kom från |
| `variableName` | variabeln filnamnet hamnar i |
| `accept`, `maxSize` | vad redaktören satt, om du vill pröva samma sak igen |

| Du returnerar | Krav |
| --- | --- |
| `reference` | **måste** vara en sträng. Ett id, en URL, vad ni vill — vi läser den aldrig |
| `label` | **måste** vara en icke-tom sträng. Det en människa får se |

Kastar funktionen skulle felets meddelande visas vid fältet och inget svar
sparas — alltså ett meddelande en invånare kan läsa, inte en stacktrace.

### Tjänsten det kräver

Det här är hela skillnaden mot A: **B förutsätter att ni har någonstans att
lägga filen, och att den vägen dit går genom er egen server.** `uploadFile` är en
funktion, inte en tjänst — den är bara sladden fram till en.

**Varför den måste vara serversidig (K9).** Guiden körs i besökarens webbläsare,
inbäddad på en sida vem som helst kan öppna. En nyckel till ert filarkiv i den
koden är utlämnad — och att den ligger i en bundlad fil gör den inte gömd.
Klientens enda motpart ska vara er egen origin.

Vad tjänsten behöver göra, i tur och ordning:

| Steg | Varför just där |
| --- | --- |
| **Ta emot** filen som multipart | webbläsarens enda naturliga form |
| **Avgöra vem som frågar** | en öppen uppladdningsendpoint är en gratis fillagring åt internet |
| **Pröva om** typ och storlek | vår kontroll i klienten är en artighet, inte ett skydd — den går att kringgå |
| **Skanna**, om ni ska | vi kan inte, och det är enda stället det kan ske |
| **Lägga undan** varaktigt | en `sv:file`, en S3-nyckel, en rad i en tabell |
| **Svara** med `{ reference, label }` | referensen ska gå att slå upp i morgon, se nästa avsnitt |

Det är samma mönster som uppslagsfältets — se `docs/UPPSLAG-KONTRAKT.md`. Där
frågar klienten er BFF som frågar Navet; här lämnar klienten en fil till er BFF
som lägger den där ni bestämt. Biblioteket vet i båda fallen bara att det ställde
en fråga och fick ett svar.

**I Sitevision är WebAppens serverkod den tjänsten.** Uppladdningen når den som
en `sv:temporaryFile`; därifrån är det er kod som flyttar den till arkivet och
returnerar identifieraren. Ni behöver ingen separat BFF för att bygga B — men ni
behöver skriva den delen, och det är inte tre rader.

**Är det för mycket, är det ett skäl att välja A.** Hela den här tabellen
försvinner om filen aldrig behöver överleva sessionen.

### Ett genomarbetat exempel

Ingenting här går att köra. Det är skrivet för att nästa omgång ska slippa börja
med ett tomt papper, och för att skillnaden mot A ska vara konkret snarare än en
rad i en tabell.

**Scenariot måste vara ett som A inte klarar.** En jobbansökan med CV gör inte
det — där bifogas filen och mejlet går, i ett svep. Det här gör det:

> **Ansökan om bygglov.** Fem sidor att fylla i, ritningar som ska bifogas, och
> en handläggare som hör av sig veckan efter. Den som söker gör det på kvällen,
> orkar inte klart, och fortsätter på lördagen — från en annan dator.

Det är kravet som avgör: **ett utkast som ska kunna återupptas.** Filen måste
finnas kvar när webbläsaren stängts, och den kan inte ligga i ett `File` i ett
stängt flikfönster. Ingen mängd händighet i klienten löser det.

#### Vad värden skriver

En endpoint, på er egen origin. Inte för att vi säger det utan för att **K9** gör
det: guiden körs inbäddad på en sida vem som helst kan öppna, och en nyckel till
filarkivet i den koden är utlämnad.

```js
// POST /api/bilagor  — er tjänst, inte vår.
export async function taEmot(request, session) {
  const fil = await request.formData().then((data) => data.get("file"));

  // 1. Vem frågar. Utan det här är endpointen gratis fillagring åt internet.
  if (!session.ärInloggad) return svar(401, "Du måste vara inloggad.");

  // 2. Pröva om. Klientens kontroll är en artighet — den går att kringgå.
  if (!ärTillåtenTyp(fil) || fil.size > 10 * 1024 * 1024) {
    return svar(400, "Bifoga en PDF eller JPG på högst 10 MB.");
  }

  // 3. Skanna, om ni skannar. Enda stället det kan ske.
  if (!(await skanna(fil)).ren) return svar(400, "Filen gick inte att ta emot.");

  // 4. Varaktigt, och knutet till utkastet så gallringen vet vad den äger.
  const id = await arkivet.spara(fil, { utkast: session.utkastId });

  return svar(200, { reference: id, label: fil.name });
}
```

Meddelandena i steg 2 och 3 hamnar under fältet och läses av en invånare, inte av
er. *"Filen gick inte att ta emot"* är avsiktligt intetsägande — att skriva
*"virus hittat"* till någon som råkat bifoga fel fil hjälper ingen.

#### Vad biblioteket skulle behöva

Kopplingen som **inte finns**:

```js
// Skiss. `uploadFile` togs bort; den här raden gör ingenting idag.
preview.uploadFile = async (file, context) => {
  const svar = await fetch("/api/bilagor", { method: "POST", body: kropp(file) });

  if (!svar.ok) throw new Error(await svar.text());   // visas vid fältet

  return svar.json();                                  // { reference, label }
};

preview.addEventListener("file-released", (event) => {
  void fetch(`/api/bilagor/${event.detail.reference}`, { method: "DELETE" });
});
```

Och nodtypen skulle behöva sin andra variabel tillbaka — `referenceVariableName`
— så att utkastet vet vilken fil det äger. Filnamnet räcker inte: två personer
laddar upp `ritning.pdf`.

#### I Sitevision

WebAppens serverkod **är** den endpointen; ni behöver ingen separat BFF. Men den
måste göra ett steg till, och det är det som gör B dyrare än den ser ut:

```js
// Skiss, aldrig körd mot en installation.
const tempFile = request.getFile("file");        // sv:temporaryFile
const arkivFil = fileUtil.createFile(mapp, tempFile);   // sv:file — varaktig

return { reference: arkivFil.getIdentifier(), label: tempFile.getName() };
```

Raden i mitten är hela poängen. En `sv:temporaryFile` är enligt Sitevisions egen
dokumentation *"very volatile and short-lived"* och **kan aldrig slås upp på sin
identifierare** — den duger som transport och aldrig som referens. I modell A
uppstår frågan inte, för där ska ingenting slås upp senare.

#### Vad exemplet kostar er

Läs det som en prislapp, inte som en instruktion:

| | |
| --- | --- |
| **Endpoint** med inloggning, omprövning, skanning | er kod |
| **Arkivplats** och behörigheter | ert beslut |
| **Gallring** av utkast som aldrig blev en ansökan | er rutin, se nedan |
| **Utkastlagring** som vet vilka referenser det äger | er kod |
| I biblioteket | en söm och en variabel |

Den sista raden är den minsta. Det är därför B inte är byggd: det som saknas är
inte biblioteksdelen.

### Referensen måste överleva

Gäller bara modell B. Referensen **slås upp senare**: den lagras i guidens svar,
bärs genom stegen, kan hamna i ett sparat utkast, och används först när
formuläret skickas. En identifierare som bara gäller under det anrop som skapade
den duger alltså inte.

**Sitevision, som exempel.** En uppladdning till en WebApp anländer som en
`sv:temporaryFile`, som enligt deras dokumentation är *"very volatile and
short-lived"* och **"can never be looked up by its identifier"**. I modell B är
den alltså transporten, inte referensen: er `uploadFile` behöver flytta filen till
något varaktigt, exempelvis en `sv:file` i arkivet, och returnera **den**
identifieraren.

I modell A uppstår frågan aldrig — där *är* temp-filen hela historien.

*Ej kört mot en installation.* Läst i dokumentationen 2026-08-17; första deployen
är testet, som för allt annat i den integrationen.

### Gallring

**Gäller bara modell B**, och det är det starkaste skälet att välja A när A
räcker.

Från det ögonblick filen laddas upp ligger den hos er, oavsett vad som händer
sedan. Det ger tre sätt en fil kan bli föräldralös — och lägg märke till vem det
handlar om: **den som fyller i formuläret**, inte redaktören som byggde det.

| Vad som händer | Skulle ni få veta? |
| --- | --- |
| Invånaren väljer en annan fil | **ja** — `file-released` med den gamla referensen |
| Fältet töms | **ja** — samma händelse |
| Någon stänger fliken mitt i | **nej** |

```js
// Skiss. `file-released` finns inte.
preview.addEventListener("file-released", (event) => {
  const { reference } = event.detail;
  // Radera nu, märk för städning, eller ingenting — ert beslut.
});
```

**Den tredje raden är den som kostar.** Webbläsaren ger inget tillförlitligt
besked om att någon lämnar en sida, så det gick inte att lova något där. Ni
skulle behöva en egen gallringsrutin för filer som aldrig blev en inlämning.

Det enda biblioteket kunde hjälpa med: varje levande referens ligger i guidens
svar, så den som sparar utkast vet exakt vilka filer utkastet äger.

**Varför det inte bara är städning.** En bifogad handling innehåller ofta
personuppgifter. En fil som blir liggande för att någon stängde fliken är då inte
skräp utan en lagringstid ingen beslutat om — arkivlagen och GDPR gäller den lika
mycket som den inlämnade. Bara ni känner era gallringsbeslut, er lagring och vem
som får radera.

### Avfört tills vidare: fakta om filen som variabler

**Beslutat 2026-08-17 att inte bygga.** Skrivet här för att skälet ska finnas
kvar, inte för att det ska tas upp igen nästa gång någon får idén.

En granskande tjänst vet mer om filen än vad den heter. Idag får `uploadFile`
bara returnera `{ reference, label }`, så ingenting av det kan nå guiden — en
regelnod kan inte fråga något om en fil. Frågan var om den skulle kunna det.

Fakta är värda en variabel **när en människa i guiden måste reagera på
innehållet**, inte när de bara styr vad mottagaren gör efteråt. Och det är just
de fallen som kräver OCR eller en språkmodell:

| Skulle bära sin kostnad | Kräver |
| --- | --- |
| CV:t läses, fälten är förifyllda | OCR **och** tolkning |
| *"Vi läste: Anna Andersson. Stämmer det?"* | OCR **och** tolkning |
| ritningen är skannad → fråga om skala | ingenting särskilt |
| dokumentet är redan signerat → hoppa över steget | ingenting särskilt |

De två nedersta är billiga och tunna. De två översta är de som gör något
verkligt, och de är också de som drar in OCR och modeller. **Det är inte vad det
här är för**, i alla fall inte nu.

Att utvinningen skulle ligga i värdens tjänst och inte hos oss — K9 ser till det
— ändrar inte beslutet. Vi skulle bära tillbaka värden, aldrig läsa en fil. Men
en mekanism vars enda meningsfulla användning förutsätter maskineri vi inte tänker
befatta oss med är ingen mekanism att bygga i förväg.

**Om det ändå blir aktuellt:** räkna inte upp några fakta. Låt `uploadFile`
returnera en öppen påse värden och låt noden bestämma vilka variabelnamn de
landar i — samma form som uppslaget har för etikett och kod. Då behöver
biblioteket aldrig ha en åsikt om vad en fil kan säga om sig själv, och behöver
inte ändras igen när nästa sorts fakta dyker upp.

## Variabeln

Fältet sparar **en** sak: `variableName` får filnamnet, `cv.pdf`. Det är allt en
guide av JSON kan bära, och det är det läsbara — en guide som skriver `{{cv}}` i
ett resultat eller ett e-postunderlag ska ge *cv.pdf*.

Själva filen ligger inte i svaren alls. Den hämtas med `getFiles()`.

Modell B skulle behöva en variabel till för referensen, av samma skäl som ett
uppslagsfält har en för koden: en ogenomskinlig sträng behöver något läsbart
bredvid sig. Den finns inte i editorn, eftersom en inställning som ingenting
läser är värre än ingen inställning alls.

## Vad vi prövar, och vad vi inte gör

Vi prövar **innan** filen lämnas över, så en avvisad fil aldrig reser:

- **filtyp** mot fältets `accept` (`.pdf,.jpg`, eller MIME-typer)
- **storlek** mot fältets `maxSize` i MB

Meddelandena är våra och finns på de språk guiden erbjuds.

Vi gör **inte**, och kan inte: virusskanning, kvot- eller behörighetskontroll,
eller något om filens innehåll alls. Ett fält som *såg ut* att göra dem vore
sämre än ett som uppenbart inte gör det.

## Innan det finns någonstans att lägga filer

Låt `uploadFile` vara osatt. Fältet, valideringen och beskeden går att bygga och
prova utan att någon fil tar vägen någonstans — och redaktören ser vad en
invånare skulle se, med tillägget att uppladdningen inte är kopplad.

## Vad som återstår

**Modell B är beskriven här, inte byggd.** `uploadFile`, `file-released`, filtyp
och storlek, felmeddelandena och de två variablerna finns i det här dokumentet
och ingen annanstans. Raden stod tidigare som *"Modell B är byggd"* och sade
emot de två styckena nedan — en kvarglömd mening som kunde få en värd att
planera för en söm som inte finns.

**Modell A är allt som finns.** Fältet håller filen, `getFiles()` lämnar ut den,
och det finns ingen inställning som väljer modell — det finns bara en.

**Modell B togs bort ur koden.** `uploadFile`, `file-released` och
referensvariabeln fanns en kort tid, byggda innan A. De är borta, för en valbar
modell med en tjänst vi inte har någon användare av är en söm någon kopplar in
och sedan förlitar sig på. Det som återstår av B är det här dokumentet.

Frågan som var öppen — hur fältet skulle veta vilken modell värden valt — föll
bort med B. Blir B aktuell igen kommer den tillbaka, och svaret är antagligen att
visaren får veta modellen uttryckligen i stället för att gissa på om en funktion
är satt.

## Tillgänglighet

Fältet är en vanlig `<input type="file">`. Webbläsarens egen knapp, egen
filväljare och egna besked — inget vi kunnat skriva bättre, och allt vi annars
hade behövt skriva.

Felmeddelanden hamnar i fältets egen felruta med `role="alert"`, så en
skärmläsare får dem när de uppstår. Färgen är aldrig ensam bärare av
informationen (**K3**): avslaget är alltid en mening.

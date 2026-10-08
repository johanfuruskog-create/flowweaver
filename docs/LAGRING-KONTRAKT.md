# Lagringskontraktet

Editorn sparar ingenting själv. Guiden och dess versioner bor hos **er**, och
det här dokumentet beskriver vad ni ska svara på — inte hur ni gör det. Samma
form som `INLAMNING-KONTRAKT.md` och `UPPSLAG-KONTRAKT.md`: kontraktet är
API:et, ni bygger baksidan.

## Grundprincipen

**En lagring i taget.** Allt editorn sparar går genom *ett* ställe: utkastet
och versionerna. Antingen ligger guiden i webbläsaren (förvalet, ingen värd
behövs) eller hos er — aldrig hälften på varje ställe. Redaktören ska se **ett**
besked om sparning, aldrig "sparat här men inte där".

Det är Johans krav, 17/9: *"det är förvirrande för användaren om det sparas på
två sätt samtidigt."*

## De två sakerna, och skillnaden är hela modellen

| | Vad det är | Regeln |
| --- | --- | --- |
| **Arbetskopian** | Det redaktören håller på med. | **En per guide, som skrivs över.** Inget staplas. Autosparningen skriver hit och ingen annanstans. |
| **Versionen** | Något någon frös med avsikt. | **Oföränderlig.** Att gå tillbaka till förra veckans version betyder ingenting om den kan ha ändrats under tiden. |

`current` är en **pekare** på en av versionerna: den besökaren får. Att flytta
den skriver ingen graf.

Guiden pekas ut med sitt id ur `meta.id` — ett UUID editorn myntar en gång och
aldrig byter (se `INLAMNING-KONTRAKT.md`, `serviceId`). Samma id som ärendena
bär, så ett ärende går att spåra till guiden som skapade det.

## Vägarna per guide

Under en bas ni anger. Allt är JSON.

```
GET    /guides/<id>                 → { current, draft?, draftSavedAt?, draftSavedBy?, versions: Version[] }
PUT    /guides/<id>/draft           ← { graph, draftSavedAt? }         → { savedAt }
DELETE /guides/<id>/draft           → { draft: null }
POST   /guides/<id>/versions        ← { graph, note?, draftSavedAt? }  → { version: Version }
POST   /guides/<id>/snapshots       ← { graph, side }                 → { version: Version }
GET    /guides/<id>/versions/<vid>  → { graph }
POST   /guides/<id>/current         ← { versionId }      → { current }
```

`DELETE …/draft` är *kasta ändringarna*, och det säger att det inte **finns**
någon arbetskopia — inte att det ligger en som råkar vara lika med den
publicerade. Skillnaden är hela skälet: redaktören frågar *har jag
opublicerade ändringar?* genom `GET /guides/<id>`, och en kopia som ändå
ligger kvar svarar fel på den frågan. Att kasta en som inte finns är också ett
ja: den som trycker två gånger har fått sin vilja igenom båda gångerna.

**Tillägget bryter ingenting.** En värd som inte svarar på `DELETE` fungerar
som förut; sidan får sitt fel och säger det.

### Frysning vid krock — `POST …/snapshots`

Valfri, och en värd som inte svarar på den fungerar precis som förut: editorn
erbjuder då ingen sammanslagning och krocken löses som före berättelse 131.

**Vad den är till för.** Två redaktörer har ändrat guiden, och på de rader där
båda rört samma sak måste en text vinna. Innan den sammanslagna arbetskopian
skrivs lägger editorn undan **båda** kopiorna här — den andres och sin egen —
så att den text som förlorade valet finns kvar i historiken och går att
återställa. Krockar är sällsynta med låset; kostnaden är två rader i
historiken per krock.

**`side` avgör vems kopia det är**, och det är hela skälet fältet finns. Den
som trycker på knappen skriver båda raderna, så en `by` ur sessionen hade gett
den andres arbete fel namn — mätt 20/9, i en historik där någons eget arbete
stod som kollegans. Raden ska säga vems arbetet är, inte vem som råkade slå
ihop.

**Varför inte en flagga på `POST …/versions`.** Fem saker skiljer, och den
första är avgörande: `versions` är **publicerarens** väg, för att frysa en
version är att säga *det här är vad besökarna får*. En krockfrysning säger
motsatsen — *vi är inte överens än* — och måste gå för den som just skrev i
arbetskopian, alltså en redaktör. De fyra andra: den avvisar **inte** på
`draftSavedAt` (att frysa en kopia byggd på en stämpel som gått ut är hela
poängen), den flyttar **aldrig** `current`, den nollställer **inte**
`draftEditors`/`draftNote`, och den **numrerar inte**.

**Posten är en version**, med två skillnader:

| Fält | Vem sätter det | Regel |
| --- | --- | --- |
| `reason` | **Ni**, ur vägen som användes | `"conflict"`. En klient skickar det aldrig: en rad som säger sig vara fryst vid en krock ska ha blivit till av en krock. |
| `number` | — | **Sätts inte, någonsin.** Numren namnger publiceringar, och *"gå tillbaka till version 3"* hade betytt mindre för varje krock. En numrering som fyller i hålet i efterhand — till exempel när äldre poster migreras — måste hoppa över `reason: "conflict"`. |
| `by` | **Ni**, ur `side` i kroppen | **Ägaren av kopian**, inte den som tryckte på knappen. `side: "mine"` → er session; `side: "theirs"` → guidens `draftSavedBy`, alltså den som senast skrev i arbetskopian. Editorn skickar **aldrig** ett namn: ett fält en klient sätter är ett fält en klient kan sätta till någon annans namn — men ett val mellan två namn ni redan har är något annat. Utan det namnet får raden inget `by`, hellre än ett påhittat. |
| `me` på `by` | **Ni**, mot den som frågar | Sant när kopian är frågarens egen. Samma regel som `draftSavedBy` och `draftEditors`: ni avgör, klienten lyder, och ingen namnjämförelse görs någonstans. |
| `label` | — | **Sätts inte.** Vad raden heter byggs av editorn ur `reason` och `by`, för den ska kunna säga *din kopia* — och vem *du* är beror på vem som läser. En lagrad etikett hade sagt *din* om någon annans arbete första gången en kollega öppnade historiken. |

`graph` lagras ordagrant men **utan** `meta.versionId`: posten är ingen version
en besökare kan få, och ett ärende ska aldrig kunna peka på den som sin
`serviceVersion`.

Guiden själv rörs inte — inte `current`, inte `name`, inte `updatedBy`. Ingen
har publicerat något, och ingen har ens sparat.

### Den villkorade skrivningen — `draftSavedAt` i kroppen

`PUT …/draft` och `POST …/versions` bär `draftSavedAt`: **den stämpel klienten
läste** när den hämtade guiden, tillbakaskickad orörd. Tom sträng betyder *det
fanns ingen arbetskopia när jag läste*.

Stämmer den inte med den ni håller har någon annan hunnit skriva sedan dess,
och då svarar ni **`409`** med vem det var:

```json
{ "error": "conflict", "draftSavedAt": "…", "draftSavedBy": { "name": "Nisse Hult" } }
```

Klienten säger då vem som sparade och att sidan ska laddas om, och slutar
autospara tills den gjort det. Ingenting slås ihop: två som redigerar samma
guide samtidigt är ett fall för en senare berättelse, och det här ser bara till
att den andres arbete inte försvinner utan att någon får veta det.

**Utelämnat fält betyder skriv utan villkor.** En klient som inte skickar
`draftSavedAt` får den gamla regeln — sista skrivning vinner — och en värd som
inte jämför fältet är en värd utan skyddet. Båda är fullgoda, och båda betalar
för det på samma sätt.

### Låset — vem arbetar i guiden just nu

**Valfritt, och för en värd med inloggning.** Utan personer finns ingen att
låsa åt: den som har guidens hemlighet är inte en människa utan en guide, och
ett lås mellan två flikar med samma hemlighet hade varit ett lås mot sig
självt. En värd utan inloggning svarar `404` på vägarna nedan, och editorn
fungerar precis som förut. **Detsamma gäller en värd som redan har ett
lås** — Sitevision låser sidan, WordPress låser inlägget: använd det, och
svara `404` här (Johan 19/9: *"vettigt att använda deras
funktionalitet"*). Låset är ett erbjudande till en värd som saknar ett,
inte ett krav; sidan visar ingen låsrad, ingen *Ta över* och pollar inte
när vägarna saknas. Stämpeln på `PUT …/draft` (409) gäller ändå — den är
skyddsnätet oavsett vems låset är.

```
POST   /guides/<id>/lock    ← { window?, takeOver? }  → { lock } | 409 { error: "locked", lock }
DELETE /guides/<id>/lock?window=<w>                   → { lock: null }
GET    /guides/<id>                           → … lock?
GET    /guides                                → … lock? per rad
```

`lock` är `{ name, since, activeAt, until, me }`. Namnet och inte subjektet —
samma regel som `draftSavedBy` — och `me` avgör **ni**, för sidan lär sig
aldrig sitt eget subjekt.

Fem regler, och de är hela modellen:

1. **Tiderna är era, alla tre.** `since` är när arbetet började, `activeAt` när
   guiden senast rördes, `until` när löftet går ut. En klient skickar aldrig en
   tid, och en som ändå gör det ska ignoreras: två webbläsare har två klockor,
   och den som går fem minuter fel hade fått eller tappat ett lås av fel skäl.
2. **Ett lås förbi `until` finns inte.** Ni behandlar det som ledigt, och
   ingenting behöver städas — posten skrivs över nästa gång någon tar låset. Ett
   lås som måste låsas upp av en människa är ett lås som blir kvar när någon
   stänger locket och går på möte.
3. **Låset är inte skyddet.** `PUT …/draft` och `POST …/versions` kräver det
   **aldrig**: den villkorade skrivningen ovan är det som gör att ingens arbete
   försvinner, och ett lås som tappats är precis det fall där två ändå skriver.
   Låset är en vy: *någon annan arbetar här, börja inte samtidigt*.
4. **`window` skiljer två sittningar åt.** En opak sträng klienten myntar per
   fönster — det enda klienten skickar, och det är en identifierare och ingen
   tid. Samma person på två datorer är inte samma sittning: utan fältet hade
   båda fönstren trott att de höll låset och båda hade sparat. Rättigheten
   prövas alltid på personen, aldrig på fönstret.
5. **Övertagandet är ett eget steg.** `takeOver: true` tar någon annans lås, och
   vem som får är er behörighetsfråga — referensvärden kräver **publicerare**,
   för övertagande är det enda i editorn som kan kosta någon annan arbete.
   Avvisningen är `403` — identiteten håller, rollen räcker inte (A8), och
   ingenting avslöjas av det: att låset finns har `409` redan sagt en rad upp.
   Sitt **eget** lås tar man alltid över,
   från vilken dator som helst, utan att vara publicerare — det kostar ingen
   annan något.

Editorn förnyar låset **bara vid aktivitet** — en ändring, en sparning, ett
tangenttryck — aldrig av att en flik står öppen. Det är därför livslängden kan
vara kort: tio minuter utan att någon rör guiden betyder att ingen sitter där.

#### Läsläget följer med — `GET /guides/<id>?since=<stämpel>`

**Valfritt, i båda ändar.** Den som står i läsläge medan någon annan arbetar
vill se vad den andra skriver utan att ladda om sidan. Sidan frågar då med den
stämpel den har:

```
GET /guides/<id>?since=2026-09-19T07:06:34.879Z
  → 204, ingen kropp            (inget har ändrats)
  → 200 { … guiden som vanligt } (något har ändrats, eller since utelämnat)
```

Jämförelsen är **likhet och inte ålder**, precis som den villkorade
skrivningen: stämpeln är en identitet på en arbetskopia och inte en position
på en tidslinje. En stämpel ni aldrig haft besvaras med guiden — det säkra
svaret.

Tre saker den här vägen medvetet **inte** är:

1. **Ingen prenumeration.** Sidan frågar var tionde sekund, bara medan fliken
   syns och bara medan guiden är öppen. En flik i bakgrunden frågar ingenting.

   **Båda fönstren frågar, och av två skäl.** Den som läser vill se vad den
   andre skriver. Den som tror sig hålla låset vill veta att det inte längre
   är så: låset tas över i ett annat fönster, och ett svar med ert `lock` i är
   det enda som kan säga det till ett fönster där ingen rör tangentbordet.
   Mätt 19/9, innan det gjordes så: den som satt still satt kvar i en editor
   hen inte längre fick skriva i.

   Frågan **förnyar ingenting**. Det är en läsning, och bäst-före på låset
   gäller precis som förut — en förnyelse på timer hade hållit ett lås vid liv
   i ett fönster ingen sitter vid, och det är hela skälet att låset förnyas
   av aktivitet.
2. **Ingen knuff.** Server-sent events eller websockets vore mindre trafik den
   dag många tittar på samma guide, men det är en ny söm hos varje värd. Korta
   frågor kostar några byte och ett `204`; det räcker tills mätningen säger
   annat.
3. **Ingen ny sanning.** Svaret är guiden, samma fält som utan `since` —
   `lock` inräknat, och det är det fältet ett fönster läser för att se att
   någon annan tagit över. Vägen sparar en kropp, den lägger inte till ett
   format.

En värd som inte känner till `since` svarar med guiden varje gång. Det är
fullgott: sidan ritar om samma graf den redan har, och ingen ser någon
skillnad utom i trafiken.

### Avsikten — vilkas ändringar, och anteckningen

**Valfritt, och för en värd med inloggning**, av samma skäl som låset: båda
fälten bär namn, och utan personer finns inga namn att bära.

```
GET /guides/<id>   → … draftEditors?: [{ name, me, at }] · draftNote?: Note
GET /guides        → … draftNote? per rad
PUT /guides/<id>/note   ← { text }   → { draftNote: Note | null }
```

`Note` är `{ text, at, by: { name, me } }`. Namnet och aldrig subjektet, och
`me` avgör **ni** — samma regel som `draftSavedBy` och låset.

**`draftEditors` är en rad per person, inte per sparning.** Autosparen skriver
var tredje sekund; frågan granskningen ställer är *vilkas ändringar ligger i
det jag publicerar*, och det är en lista på namn. Tiden är personens senaste
sparning. Sätts vid varje `PUT …/draft` och **töms vid `POST …/versions`**:
då är arbetskopian publicerad, och nästa fråga gäller vad som hänt sedan dess.

**`draftNote` är en mening från en människa till nästa** — *Inte klar —
juristen ska läsa resultattexterna.* Den skrivs av den som arbetar i guiden,
och den syns för alla som öppnar den, i listan, i granskningen och där någon
tar över. Den **tas bort** av den som skrev den, av en publicerare, eller
automatiskt när en version publiceras.

Tre regler:

1. **En egen väg, inte ett fält på arbetskopian.** Den som skriver
   anteckningen ändrar inte guiden. Ett fält på `PUT …/draft` hade betytt att
   en mening kräver en hel graf — och att den som skriver den skriver över vad
   någon annan hunnit spara, eller möts av en `409` om något hen inte rört.
2. **Låset krävs inte.** Samma regel som överallt: låset är inte skyddet. Sidan
   erbjuder anteckningen till den som håller guiden, för det är hen som vet vad
   som inte är klart — men ett värdkrav hade gjort låset till en rättighet, och
   den dagen det löper ut mitt i en mening vore meningen omöjlig att skriva.
3. **En tom text är borttagandet.** Två vägar för *det gäller inte längre* hade
   varit en väg för mycket. Att skriva över eller ta bort någon **annans**
   anteckning kräver publicerare: det är att ta bort hens invändning, och det
   hör till samma rung som att publicera förbi den.

En värd som inte bygger något av det här fungerar precis som förut: sidan
visar ingen anteckning, granskningen säger som i dag vad som ändras utan att
säga vems det är.

`Version` är raden en versionslista visar, och inget mer:

```json
{ "id": "v-…", "number": 4, "note": "Före regeländringen",
  "savedAt": 1758115800000, "current": true }
```

`number` är löpnumret redaktören ser — *Version 4*. Det är **ert**: satt när
versionen fryses som `max + 1` inom guiden, och aldrig ändrat efteråt (se
reglerna nedan). Editorn räknar aldrig ut det själv, för då döps allt som är
kvar om den dag ni gallrar. Skickar ni inget nummer får raden heta det den
annars heter — anteckningen, eller tiden — och ingen siffra alls.

`savedAt` är millisekunder — en tidpunkt, inte en text. **Sätt inget
klockslag som namn.** Det var referensvärdens första försök och det blev fel
direkt: ett namn myntat hos er myntas i ERA tidszon, medan listan ritar
`savedAt` i läsarens, så en fryst version sa *13:05* som namn och *15:05* i
kolumnen bredvid. En version ingen döpt heter när den sparades, och det säger
listan själv, en gång.

`label` finns för ett riktigt namn — ett filnamn, en beteckning ur ert system
— och saknas annars. `note` är redaktörens egna ord och saknas ofta.

**Ingen av vägarna ovan skapar en guide.** Att skapa en är att bestämma vem
som äger den, och det är er inloggning, er katalog, er process. Referensvärden
utan inloggning gör det på kommandoraden (`guides.mjs new`), Sitevision skulle
göra det när sidan skapas.

## Två vägar till, för en värd med inloggning

Vägarna ovan handlar om **en** guide, och de räcker för en värd där något annat
redan bestämt vilken. En värd som vet *vem* som frågar kan svara på två frågor
till, och då hör de hit:

```
GET    /guides            → { guides: [{ id, name, current, updatedAt, updatedBy?, mine }] }
POST   /guides            ← { name? }   → { guide: { id, name, current, updatedAt } }
```

`GET /guides` är **de guider den som frågar får se**, och vilka det är avgör
ni. Kontraktet säger inte att det är hens egna: en guide i ett CMS är sajtens
innehåll och inte en persons, och referensvärden ger därför alla guider hos
värden till var och en som får logga in. En värd med flera organisationer i
samma installation grupperar själv. Utan inloggning finns ingen lista att ge,
så vägen kräver `Authorization` och svarar annars `401`.

`name` är guidens titel som den står i grafen (`meta.name`), skriven av er när
en arbetskopia eller en version kommer in. Den finns i listan för att en lista
man inte kan söka i är en lista man skrollar i; editorn räknar aldrig ut den
och skickar den aldrig separat. `updatedAt` är när guiden sist rördes, i er
klocka.

`updatedBy` är **vem** som rörde den sist — `{ "name": "Nisse Hult" }`, ur er
session och aldrig ur en kropp. Listan ritar *Ändrad 17 sep. 2026 22:50 av
Nisse Hult*; utan fältet står bara datumet, vilket är vad en guide från före
inloggningen får.

`mine` är sant när den som frågar skapade guiden eller gjorde den senaste
ändringen — det filtret *Bara mina* smalnar på. **Ni** avgör det, för ni är de
enda som vet vem som frågar; en lista som skickade subjekt hade bett sidan
jämföra opaka strängar och lagt identiteter i en skärmbild.

`POST /guides` skapar en guide åt den som är inloggad, med den som `owner` —
alltså *skapad av*, inte *får se*. Vägen finns **bara** hos en värd med
inloggning: en väg som delar ut ägarskap till vem som helst som frågar är en
väg som delar ut ägarskap till vem som helst som frågar.

**Båda är valfria.** En värd som inte svarar på dem är en fullgod värd — då är
listan och skapandet något ert system redan gör på annat håll, som Sitevision
gör när sidan skapas.

## Vad ni sparar — reglerna för versioneringen

Johan 18/9: *"värdsystemet ska veta vad man ska spara ner i sitt system."*
Det här är listan. Två poster, och reglerna för dem.

### Guiden — en post per guide

| Fält | Vem sätter det | Regel |
| --- | --- | --- |
| `lock` | Ni, på `POST …/lock` | `{ subject, window, name, since, activeAt, until }` — vem som arbetar i guiden just nu. Ett lås förbi `until` finns inte och städas aldrig. Utelämnat hos en värd utan inloggning. |
| `id` | Editorn, en gång (`meta.id`, ett UUID) | Nyckeln till allt. Byts aldrig, delas aldrig av två guider. Samma id som ärendena bär som `serviceId`. |
| `current` | Ni, på `POST …/current` | Pekare på en av versionerna: den besökaren får. Tom tills någon publicerat. Flyttas bara på uttrycklig begäran. Första versionen som fryses blir `current` av sig själv — en guide utan publicerad version är ingen guide för besökaren. |
| `draft` | Editorn, på `PUT …/draft` | **En** per guide. Skrivs över, staplas aldrig. Borta på `DELETE …/draft` och efter en publicering (då är den lika med det publicerade och ska inte finnas). |
| `draftSavedAt` | Ni, när `draft` skrivs | När arbetskopian skrevs, i **er** klocka och aldrig i klientens (referensvärden: ISO-8601, UTC). Klienten skickar tillbaka den orörd i nästa skrivning, och det är den jämförelsen som gör att ingen skriver över någon annan (regel 5). |
| `draftSavedBy` | Ni, ur er session när `draft` skrivs | `{ "subject": "…", "name": "Nisse Hult" }` — vem som skrev arbetskopian. Editorns rad säger *sparad 22:50 av Nisse Hult* när det var någon annan än den inloggade, och `409` säger det samma vid en krock. **Editorn skickar det aldrig**, av samma skäl som `by` på versionen. Utelämnat hos en värd utan inloggning. |
| `draftEditors` | Ni, ur er session när `draft` skrivs | `[{ "subject": "…", "name": "Anna Andersson", "at": "…" }]` — vilka som skrivit i arbetskopian sedan förra versionen, en rad per person med hens senaste tid. **Töms när en version fryses.** Granskningen säger *Sedan version 3 har Anna Andersson (08:29) och du ändrat guiden*. Utelämnat hos en värd utan inloggning. |
| `draftNote` | Ni, på `PUT …/note` | `{ "text": "…", "at": "…", "by": { "subject": "…", "name": "Anna Andersson" } }` — en mening till den som kommer efter. Texten är **en rad**: radbrytningar blir mellanslag. Borta när någon skickar en tom text, och när en version fryses. Utelämnat hos en värd utan inloggning. |
| `updatedBy` | Ni, ur er session vid **varje** skrivning | Samma form som `draftSavedBy`, men om den senaste skrivningen över huvud taget — arbetskopia eller version. Det listan ritar som *av Nisse Hult*. |
| `name` | Ni, ur `meta.name` när en arbetskopia eller version kommer in | Titeln listan visar och söker på. En tom titel lämnar den gamla stående — en rad utan namn går inte att hitta igen. |
| `owner` | Ni, när guiden skapas | **Skapad av**, och inget mer: en opak sträng ur er inloggning (referensvärden: `sub` ur id-tokenet). Den avgör inte vem som får se guiden — det gör ni, och referensvärden låter alla inloggade se allt. Kontraktet nämner fältet så att en värd som byter lagring vet vad som ska följa med; det tolkar det aldrig. |

### Versionen — en post per frysning

| Fält | Vem sätter det | Regel |
| --- | --- | --- |
| `id` | Ni, på `POST …/versions` | Ert eget, unikt inom guiden (referensvärden: `v-<uuid>`). Editorn hittar aldrig på ett. |
| `guideId` | Ni | Vilken guide den hör till. En version svarar `404` genom en annan guides adress. |
| `number` | Ni, som `max + 1` inom guiden | **Löpnumret redaktören ser** (*Version 4*). Sätts när versionen fryses och **ändras aldrig**, inte heller när äldre versioner gallras — då hoppar numren, och det är rätt: *"gå tillbaka till version 3"* ska betyda samma sak varje dag. Räkna aldrig ut det ur listans position. |
| `note` | Editorn, valfritt | Anteckningen från *Publicera*. Tom = ingen; listan visar då numret och tiden. |
| `savedAt` | Ni | Millisekunder, UTC, er klocka. Listan sorterar på den. |
| `by` | Ni, ur er session | `{ "subject": "…", "name": "Johan Furuskog" }` — vem som frös den. Historiken visar *av Johan Furuskog* under versionens namn. **Editorn skickar det aldrig** och ska inte kunna: den vet det inte bättre än ni, och ett fält en klient sätter är ett fält en klient kan sätta till någon annans namn. Utelämnat hos en värd utan inloggning — då ritas ingen rad alls, hellre än en som säger *av* och sedan ingenting. |
| `graph` | Editorn | Guiden ordagrant, som `Exportera guiden` skriver den — plus **`meta.versionId`**, som **ni** skriver in (= `id`) innan ni lagrar, så att ett ärende från den versionen kan säga vilken den var (`serviceVersion`). Inget annat i grafen rörs, någonsin. |

### Reglerna, kort

1. **En version ändras aldrig.** Ingen väg i kontraktet skriver om `graph`,
   `note` eller `number` på en befintlig version. Vill någon ändra, fryser
   editorn en ny.
2. **Publicera är två anrop** från editorn: `POST …/versions` och sedan
   `POST …/current` med det id ni gav tillbaka. Ni behöver inte göra dem
   atomära; faller det andra visar editorn det och redaktören trycker igen.
3. **Återställ är inget ni gör.** Editorn hämtar `GET …/versions/<vid>` och
   skriver den som `PUT …/draft`. Ni ser en vanlig arbetskopia.
4. **Gallring är er regel**, inte redaktörens knapp: behåll de senaste N
   eller allt yngre än en tid. Ta **aldrig** `current`, och döp aldrig om
   det som är kvar (regel om `number` ovan).
5. **Ingen skriver över någon tyst.** Klienten skickar den `draftSavedAt` den
   läste; stämmer den inte med er svarar ni `409` med `draftSavedBy`, och
   klienten säger vem och slutar autospara.

   **En publicering är ingen krock.** Editorn tar bort arbetskopian efter en
   publicering — det som publicerats är inte längre opublicerat — och då är
   `draftSavedAt` tom och varje stämpel skiljer sig från tomheten. Utan en
   regel för det avvisas varje kollega som byggde på samma kopia, med en ruta
   om en ändring som aldrig gjordes (mätt 20/9). Minns därför vilken stämpel
   den kopia hade som frystes, och släpp igenom en skrivning när **båda**
   gäller: det finns ingen arbetskopia, och stämpeln är den publicerades.
   Minnet är förbrukat i samma stund någon skriver en ny arbetskopia — annars
   hade en riktigt gammal stämpel sluppit igenom för evigt, också genom en
   arbetskopia som kastats.

   **Ni slår aldrig ihop två
   arbetskopior** — sammanslagningen är editorns (berättelse 131), och det ni
   ser av den är två `POST …/snapshots` och sedan ett vanligt villkorat
   `PUT …/draft` med er aktuella stämpel. En klient som inte skickar fältet
   får den gamla regeln, sista skrivning vinner.
6. **Låset är en vy och inte ett villkor.** Ingen skrivande väg kräver det, och
   en värd som inte svarar på låsvägarna är en fullgod värd — då säger sidan
   inte vem som arbetar, och `409` på stämpeln är skyddet precis som förut.
7. **Ni myntar aldrig ett guide-id** och uppfinner aldrig en guide på ett
   okänt id (`404`, se avvisningsreglerna). Hur en guide *skapas* hos er är
   ert: referensvärden gör det med `guides.mjs new`.

*Referensvärden lagrar allt ovan sedan 18/9, `number` inräknat. Versioner
frysta innan fältet fanns får sitt nummer första gången guiden läses, ur
`savedAt`-ordningen, och det skrivs tillbaka — en migrering vid läsning, en
gång per version.*

## Vad ni får tillbaka från editorn

Grafen, som den är. Samma JSON som `Exportera guiden` skriver och som
`importGraphJson` läser — inga extra nycklar. En värd som lagrar den som text
och ger tillbaka samma text har uppfyllt kontraktet.

Den ligger i `graph` i kroppen, inte som kroppen: villkoret (`draftSavedAt`)
och anteckningen (`note`) hör till **handlingen** och inte till guiden, och ett
fält som smugit in sig i `meta` hade följt med in i varje version för alltid.
Grafen inuti kuvertet rörs aldrig.

**Bilder är länkar.** En guide bär `imageUrl`, aldrig inbäddade bilder, så en
version är en JSON-rad och inte en blob. Det är därför 256 kB räcker som
gräns (se nedan) och varför ni inte behöver objektlagring för det här.

## Avvisningsreglerna

Svara med fel. Avvisa alltid när:

1. **Guiden finns inte** → `404`. Aldrig en tom guide uppfunnen på stället: ett
   id som skrivits fel ska inte tyst bli en andra guide ingen hittar tillbaka
   till.
2. **Den som frågar har ingen giltig legitimation** → `401`, och svaret säger
   **inte** vad som var fel. Den som lärt sig att id:t stämde och bara nyckeln
   var fel har lärt sig halva vägen in.
   **Den som är inloggad men har fel roll** → `403` (A8). Det är ett annat
   besked därför att det leder till en annan åtgärd: `401` betyder *logga in*,
   `403` betyder *det här kan du inte göra, oavsett hur många gånger du loggar
   in*. Se *`Authorization` bär också vad, inte bara vem*.
3. **Versionen finns inte** — eller hör till en annan guide → `404`. Aldrig den
   aktuella i stället: *"gå tillbaka till i tisdags"* besvarat med *i dag* är
   värre än ett fel.
4. **Grafen är orimligt stor** → `413`. Referensvärden går vid **256 kB**, tio
   gånger den största guide någon byggt (~23 kB). Gränsen finns för att
   guiderna delar disk med annat, och den som fyller den tar båda med sig.
5. **Kroppen går inte att läsa som en graf** → `400`.
6. **Arbetskopian har ändrats sedan klienten läste den** → `409`, med
   `draftSavedBy` i svaret. Det är den enda avvisningen som säger *vem*, och
   det är hela poängen: ett fel som inte namnger den andre lämnar redaktören
   med en sida som slutat spara och ingen att fråga.

## Identitet — er sak, och kontraktet låser inte fast någon

Kontraktet säger **ingenting** om vem som får läsa och skriva. Sitevision
binder till sin inloggning, en kommun till sin katalogtjänst, och båda
bestämmer själva vad avsnittet nedan betyder hos dem.

### `Authorization` är värdens

Det enda kontraktet säger om huvudet är vad det får vara:

- **Ett bearer-token ur er inloggning.** Ni avgör vad tokenet är — en session,
  en JWT från Entra ID, en OIDC-access-token — och vem det ger vilka guider.
  Editorn bär det den fått av värdsidan och ber om ett nytt när svaret är
  `401`. Den tolkar det aldrig, loggar det aldrig och lägger det aldrig i en
  adress.
- **Eller en cookie**, om er inloggning bor i en. Då skickar editorns adapter
  `credentials: "include"` i stället för ett huvud, och er `Access-Control-
  Allow-Origin` måste svara med **exakt** ursprunget och
  `Access-Control-Allow-Credentials: true`. `*` är inte bara slappt där — en
  webbläsare vägrar det bredvid credentials, och anropet går aldrig iväg.
- **En värd väljer ett sätt, aldrig två.** En klient som erbjuder två
  legitimationer till en värd som godtar en har bara gjort det svårare att se
  vilken som inte höll.

**En legitimation som inte håller är `401`, och svaret säger inte vad som var
fel.** Den som lärt sig att id:t stämde och bara legitimationen var fel har
lärt sig halva vägen in. `401` betyder *jag vet inte vem du är* — vare sig
legitimationen saknades, var utgången eller var påhittad, och alla tre svarar
likadant.

`403` är en annan sak och används till den: identiteten **höll**, men rollen
räcker inte (A8, Johans ja 22/9). Den skillnaden är inte kosmetik. En klient
som möter `401` ska erbjuda inloggning; en klient som möter `403` ska förklara,
för en ny inloggning ger samma roll tillbaka. Att svara `401` på ett rollavslag
var precis det som skickade redaktören genom en dörr som ledde tillbaka till
samma besked. Och `404` är det tredje beskedet: guiden finns inte, eller får
inte synas för den som frågar — se avvisningsreglerna nedan.

### `Authorization` bär också *vad*, inte bara *vem*

Kontraktet säger inte hur ni delar upp era redaktörer, och det ska det inte.
Men det säger **var svaret hör hemma**: hos er, i samma inloggning som redan
säger vem personen är. En andra behörighetsmodell bredvid den ni har är en
andra sak att förvalta och en andra sak att glömma att uppdatera när någon
slutar.

Tre regler, och de är hela avsnittet:

1. **Rollen prövas före allt annat i en skrivande väg** — före ägarskap, före
   uppslaget av guiden. Annars skiljer sig avvisningen åt beroende på vad som
   finns, och då har den som inte får skriva lärt sig vilka guider ni har genom
   att prova. Svaret blir alltså `403` oavsett om guiden existerar.
2. **Avvisningen är `403 forbidden`**, och den säger vad den betyder: *du är
   den du säger, men rollen räcker inte*. Den upplysningen är inte gratis — den
   säger att identiteten dög — men den är den enda som gör beskedet användbart:
   utan den föreslår ytan en inloggning som ger exakt samma svar tillbaka. Vad
   `403` **inte** säger är om guiden finns; det är regel 1 som håller den
   tystnaden. Att dölja existensen för en identitet som inte får se något alls
   är `404`, och det är ett annat beslut än det här.
3. **Vyn är inte skyddet.** Editorns lägen (`EditorMode`) gör att ingen får en
   palett hen inte kan använda eller en knapp som bara ger ett fel. De körs i
   en webbläsare och kan kringgås; det är er `403` som håller.

Referensvärden delar upp sina redaktörer i **fyra roller som en stege** —
läsare, redaktör, publicerare, förvaltare — där varje steg får allt under sig.
Det är en värds val och inte kontraktets, och det står här som en form som
fungerar snarare än som ett krav: Sitevision och WordPress har i praktiken
samma. Roller som inte är en stege (*får publicera men inte redigera*) är
utanför tills ett verkligt fall ber om dem.

`GET /auth/me` hos referensvärden svarar därför `{ name, email, role }`, så
sidan kan sätta editorns läge utan att gissa — och utan att behöva misslyckas
med en skrivning för att få veta vad den får.

### Referensvärden: två sätt, och `.env` väljer

**Utan `OIDC_*` i `.env`** är identiteten **en hemlighet per guide**: en lång
slumpsträng som myntas när guiden skapas (`guides.mjs new`), bärs som
`Authorization: Bearer <hemlighet>` och lagras **hashad** (SHA-256). Den som
har länken äger guiden, som ett delat dokument. Inga användare, inga roller,
ingen inloggning.

Det är **inte** rätt form för en myndighet, och det sägs här så att ingen
bygger vidare på det i tron att det är det. Hemligheten hamnar i historik, i
bokmärken och i skärmbilder, den går inte att byta utan att guiden kastas, och
den går inte att dela med en kollega.

**Med `OIDC_*` i `.env`** litar referensvärden på en OIDC-leverantör som
driftaren pekar ut, sätter en `HttpOnly`-cookie och läser `sub` ur id-tokenet
som `owner`. Då **avvisas hemligheten** hur riktig den än är: en värd som
godtar båda har två saker att få rätt, och den ena är den som reser. Formerna
och nycklarna står i `docs/DRIFT.md`; FlowWeaver blir ingen
identitetsleverantör i något av fallen.

**Rollen kommer ur samma `.env`**, och i två former därför att leverantörerna
skiljer sig åt: `ROLE_ADMIN`/`ROLE_PUBLISHER`/`ROLE_EDITOR` mappar **grupp-id**
för en leverantör som lägger `groups` i tokenet (Entra ID), och
`ROLES=<subjekt>:admin,…` namnger **personer** för en som inte gör det
(Google). Den som inte står i någondera är **läsare** — det säkraste förvalet,
och det som gör att en ny provperson inte kan ändra något av misstag. Följden
är att en värd med inloggning och utan rollrader är en värd där ingen kan
spara; tjänsten säger det vid start, och `docs/DRIFT.md` säger vilken rad man
skriver först.

Utan leverantör finns inga roller alls: hemligheten är hela legitimationen, och
den som har den har guiden.

**CORS:** en webbläsare skickar aldrig ett `Authorization`-huvud som
preflighten inte tillåtit. Svara med `authorization` i
`Access-Control-Allow-Headers` för det ursprung ni öppnar för, och för inget
annat — och räkna upp **varje metod kontraktet använder** i
`Access-Control-Allow-Methods`. Det är inte en formalitet: referensvärden
svarade `GET,POST,OPTIONS` en dag, och då avvisade webbläsaren `PUT …/draft`
innan den ens skickades, medan serverns logg såg tom ut och provet i Node var
grönt (Node bryr sig inte om CORS).

## Att koppla in det

Editorn talar med lagringen genom ett `GraphStore` med sex metoder — samma sex
frågor som vägarna ovan:

```ts
load(guideId)                    // arbetskopian om det finns en, annars den publicerade
saveDraft(guideId, graph)        // arbetskopian, som skrivs över
discardDraft(guideId)            // det finns ingen arbetskopia längre
saveVersion(guideId, graph, note?)  // frys en version
listVersions(guideId)            // raderna en versionslista visar
openVersion(guideId, versionId)  // grafen som den var; skriver ingenting
publish(guideId, versionId)      // flytta pekaren
```

Alla svarar med löften, för den ena implementationen talar med en server.
`LocalStorageGraphStore` i exempelsajten är den andra: samma sex metoder utan
socket, och den är förvalet för den som bara provar.

**Takten:** mot en server skrivs arbetskopian högst en gång per
`draftInterval` (förval 3 s efter sista ändringen) och alltid vid *Spara
version*, sidbyte och stängning. Aldrig en skrivning per tangenttryck.

## Referensvärden

`integrations/reference-receiver/` svarar på vägarna ovan i samma process som
inlämningsmottagaren och lagrar i samma register: `kind = guide` (id, pekaren,
arbetskopian, hemlighetens hash) och `kind = version` (id, guideId, grafen,
noteringen, tiden). Inga nya tabeller — en andra sorts sak är ett nytt `kind`.

```bash
node guides.mjs new --note "Bostadsbidrag"   # myntar id och hemlighet, säger dem en gång
node guides.mjs list
node guides.mjs show <id>
node guides.mjs owner <id> <subject>         # ger en befintlig guide en ägare
node guides.mjs remove <id>                  # guiden OCH dess versioner
```

Med en leverantör inkopplad svarar samma process också på `GET /guides`,
`POST /guides` och de fyra `/auth/`-vägarna, och då är *Ny guide* på sidan
`guides/` det `guides.mjs new` är utan en. Kommandot lever kvar för en värd
utan leverantör.

Bevisa med `npm run smoke:storage`: den startar sin egen server på en
engångsdatabas och prövar varje avvisningsregel. Vad den mäter och varför står
i toppkommentaren i `test/storage-smoke.mjs`.

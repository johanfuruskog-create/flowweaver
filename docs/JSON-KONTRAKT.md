# JSON-kontraktet

Editorn producerar — och läser — en graf som JSON. Samma format matar den
fristående visaren och e-tjänsterna. Det här dokumentet beskriver formatet.

> Definitionen finns i koden i [`src/viewer/types/graph.ts`](../src/viewer/types/graph.ts);
> nodtypernas fält i [`src/viewer/node-types/default-node-types.ts`](../src/viewer/node-types/default-node-types.ts).
> Bygger du en guide i verktyget? Se [KOM-IGANG.md](./KOM-IGANG.md).

## Toppnivå

```jsonc
{
  "version": 3,                 // innehållsversion (se Versionering)
  "startNodeId": "fraga-1",     // nodens id som guiden börjar i, eller null
  "nodes": [ /* FlowNodeData */ ],
  "connections": [ /* Connection */ ],
  "settings": { /* GuideSettings, valfritt */ }
}
```

## Nod (`FlowNodeData`)

```jsonc
{
  "id": "fraga-1",              // unik inom grafen
  "type": "question",          // nodtyp, se tabellen nedan
  "position": { "x": 160, "y": 140 },
  "data": { /* fält som beror på type, se nedan */ },

  // Valfri härkomst: nodmallen noden skapades ur.
  "template": "mall-1a2b",

  // Endast för fält som ligger inuti en Sida:
  "parentPageId": "sida-1",    // sidan noden tillhör
  "order": 0,                  // ordning inom sidan
  "layout": { "columnSpan": 6, "breakBefore": false }, // 12-kolumnersraster

  // Valfri villkorsstyrd synlighet:
  "visibility": {
    "match": "all",            // "all" = alla villkor, "any" = minst ett
    "conditions": [ /* RuleCondition */ ]
  }
}
```

`position` är canvas-koordinater. För fält inuti en Sida är positionen lokal
till sidan.

`template` är **härkomst, inte identitet**. Redaktören kan byta eller ta bort den
utan att någon egenskap ändras — bara vad noden heter. Mallens värden gäller när
noden *skapas*, inte när härkomsten pekas om.

Noden är redan en fullgod nod av sin `type` och fungerar oförändrat om mallen tas
bort — den heter då grundtypens
namn i stället för mallens, och kan användas för att återskapa mallen. Fältet är
editorns; en visare ska strunta i det.

Till och med version 5 var mallens nyckel nodens `type`. Kopplingen var därför
bärande: en borttagen mall gjorde varje nod som använde den okänd, i varje guide.
Migreringen v5→v6 gör om dem, med grundtypen läst ur `settings.nodeTemplates`.

## Koppling (`Connection`)

En koppling går alltid från en **utgång** till en **ingång**.

```jsonc
{
  "id": "c-1",
  "from": { "nodeId": "fraga-1", "portId": "option-1" },
  "to":   { "nodeId": "resultat-1", "portId": "input" },

  "color": "end"               // valfritt, se nedan
}
```

### Färg (`color`)

Valfri. Färgar strecket i editorn, för att hålla isär vägar i stora guider.
Utelämnad betyder standardfärgen.

Värdet är en **nyckel**, inte ett hex-värde: `"content"`, `"rule"`, `"calc"`,
`"service"`, `"end"` eller `"danger"`. Nycklarna motsvarar nodfamiljerna och
löses ut mot temats tokens, så en guide som färglagts i ljust läge förblir
läsbar i mörkt.

Fältet är **rent visuellt**. Traverseringen läser det aldrig, visaren ritar inga
kopplingar, och ett bygge som inte känner till fältet ignorerar det — en färglagd
guide kan alltså öppnas i en äldre editor utan att något går sönder.

Portcirklarna följer strecken, men bara när de är eniga: en ingång som tar emot
flera kopplingar med olika färg står kvar i standardfärgen i stället för att
välja en godtycklig vinnare.

### Portar

Portar deklareras av nodtypen, inte i grafen. En **ingång** (`input`) tar emot
flödet; en **utgång** (`output`) skickar det vidare. Varje port har en
`connectionPolicy`: `"none"`, `"single"` (max en koppling) eller `"multiple"`.
Ingångar accepterar `"multiple"` som standard, framåt-utgångar `"single"`.

## Guide-inställningar (`GuideSettings`)

Additivt och valfritt — äldre grafer utan `settings` fungerar oförändrat.

```jsonc
{
  "settings": {
    "sourceLocale": "sv",             // språket guiden är SKRIVEN på
    "locales": ["sv", "en"],          // språk guiden erbjuds på (BCP 47)
    "strings": {                      // överstyr fasta visartexter per nyckel
      "nav.next": { "sv": "Nästa", "en": "Next" }
    },
    "nodeTemplates": [ /* nodmallar, se nedan */ ]
  }
}
```

`nodeTemplates` är de **nodmallar** guiden använder, medskickade så den fungerar
även där biblioteket saknar dem. En mall är en **grundtyp plus sparade värden**:

```jsonc
{
  "type": "mall-1a2b",        // används som node.type
  "label": "Ja/Nej-fråga",
  "icon": "☑",                // valfri; utelämnad ärvs grundtypens
  "base": "question",         // en nodtyp ur tabellen nedan
  "values": {                 // bara det som skiljer mot en ny nod av grundtypen
    "options": [
      { "id": "ja", "label": { "sv": "Ja" }, "value": "ja" },
      { "id": "nej", "label": { "sv": "Nej" }, "value": "nej" }
    ]
  }
}
```

Fälten, beteendet och portarna står **inte** i mallen. De ägs av grundtypen och
läses därifrån varje gång mallen används, så en rättning i grundtypen når varje
sparad mall. Se [007](./STORIES/007-ett-falt-ett-stalle.md).

Nyckeln hette `customNodeTypes` till och med version 4, och mallen bar då en
fryst kopia av grundtypens fält och `behavior`. Migreringen v4→v5 läser
grundtypen ur det kopierade beteendet och fältens `defaultValue` som värden.
Gamla filer läses alltså som de är; ingen behöver skrivas om.

`sourceLocale` är det språk innehållet är **författat** på. Utelämnat betyder
`sv` — det språk allt innehåll som fanns innan fältet existerade faktiskt är
skrivet på, så en gammal fil läses precis som förut och ingen migrering behövs.

Skilj det från `locales`, som är vad guiden dessutom *finns* på. Källan är det
enda språket som alltid har innehåll, och därför det som översättningar mäts mot.

Vilken BCP 47-kod som helst duger. Namnet på ett språk hämtas från webbläsaren,
inte ur en lista i biblioteket — `so` blir *somaliska* och `ti` *tigrinja*.

## Översättbar text (`LocalizedText`)

Fält som medborgaren ser kan vara antingen en vanlig sträng eller en karta per
språk. Båda är giltiga:

```jsonc
"title": "Hur gammal är du?"
"title": { "sv": "Hur gammal är du?", "en": "How old are you?" }
```

Upplösningen faller tillbaka: exakt språk → grundspråk → källspråk → första.
Identiteter (`variableName`, alternativens `value`, port-id:n) är **aldrig**
`LocalizedText`.

## Nodtyper och deras `data`

Fält markerade *(översättbart)* får vara `LocalizedText`.

### Frågor

**`question`** — flervalsfråga. Varje alternativ blir en utgång med `id = option.id`.

| Fält | Betydelse |
| --- | --- |
| `title` *(översättbart)* | Frågans rubrik. |
| `variableName` | Variabel svaret sparas i. |
| `variableLabel` *(översättbart)* | Variabelns alias: ordet som visas i regler, villkor och resultattext. Tomt: rubriken. |
| `description` *(översättbart)* | Brödtext (stöder fetstil/kursiv). |
| `options` | Lista av `QuestionOption` (se nedan). |

**`number-question`** — tal. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `variableName`, `variableLabel` *(övers.)*, `description` *(övers.)* | Som ovan. |
| `min`, `max`, `step` | Valfria numeriska gränser. |
| `unit` *(övers.)* | Enhet, t.ex. "år". |
| `startValue` | Valfritt tal som **står i fältet** när besökaren kommer fram, och som hen kan ändra. Saknas nyckeln, eller är den `null`, är fältet tomt. Slår ett reglages startläge (`min`); gäller bara när svar saknas — ett tomt svar (`""`) är ett svar. |
| `requireInteraction` | `true`: det räcker inte att fältet har ett värde — besökaren måste ha **ändrat** det för att komma vidare. Gäller bara tillsammans med `required`, och bara när motorn saknar ett sparat svar: ett startvärde eller ett reglages startläge uppfyller alltså inte kravet. Saknas nyckeln gäller dagens beteende. |

**`date-question`** — datum, som `ÅÅÅÅ-MM-DD`. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `variableName`, `variableLabel` *(övers.)*, `description` *(övers.)* | Som ovan. |
| `required` | Obligatoriskt fält. |
| `min`, `max` | Tidigast och senast: `ÅÅÅÅ-MM-DD`, `idag`, eller `{{variabel}}` med ett datum. Tomt betyder ingen gräns. |
| `startValue` | Valfritt datum som **står i fältet** vid ankomst, och som besökaren kan ändra. Samma form som `min` och `max`: `ÅÅÅÅ-MM-DD`, `idag`, eller `{{variabel}}` med ett datum. Tomt betyder tomt fält. Läses av samma funktion som gränserna, så `idag` betyder dagen guiden öppnas och en variabel läses ur besökarens svar. |
| `requireInteraction` | `true`: det räcker inte att fältet har ett värde — besökaren måste ha **ändrat** det för att komma vidare. Gäller bara tillsammans med `required`, och bara när motorn saknar ett sparat svar: ett startvärde eller ett reglages startläge uppfyller alltså inte kravet. Saknas nyckeln gäller dagens beteende. |

**`text-question`** — fritext. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `variableName`, `variableLabel` *(övers.)*, `description` *(övers.)* | Som ovan. |
| `placeholder` *(övers.)* | Platshållartext. |
| `required` | Obligatoriskt fält. |
| `minLength`, `maxLength` | Längdgränser. |

**`rating-question`** — betyg på en skala. Utgång: `continue`.

Svaret är **stegets plats som text** (`"1"` … `"n"`), inte alternativets värde:
det är därför en regel kan jämföra det med `<` och en uträkning räkna på det.
Väljer besökaren en av skalans **vägar ut** — *Inte aktuellt* (frågan gäller
inte) eller *Vet ej* (svararen har ingen uppfattning) — blir svaret i stället
ett par, `{ "label": "Vet ej", "value": "" }`, så att en granskning kan skriva
orden medan det tomma värdet håller svaret utanför ett medelvärde. Aldrig en
nolla: formelspråket saknar villkor, så nollan hade räknats. Ett tomt svar
(`""`) betyder att ingen rörde skalan.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `variableName`, `variableLabel` *(övers.)*, `description` *(övers.)* | Som ovan. |
| `steps` | Antal steg, 2–11. Saknas = 4. Värden utanför spannet klipps. |
| `labels` | Lista med ett ord per steg *(övers. per post)*, i stegens ordning. Kortare än skalan går bra: ett steg utan ord visar sitt tal. |
| `notApplicable` | `true`: ett eget val under raden, för att frågan inte gäller den som svarar. Saknas = av. |
| `notApplicableLabel` *(övers.)* | Ordet på det valet. Tomt: visarens egen text i besökarens språk. |
| `dontKnow` | `true`: ett eget val under raden, för den som inte har någon uppfattning. Saknas = av. Ritas efter *Inte aktuellt* när båda är på. |
| `dontKnowLabel` *(övers.)* | Ordet på det valet. Tomt: visarens egen text i besökarens språk. |
| `required` | Obligatoriskt fält. |

### Sidor

**`page`** — sida med upp till två fält. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `description` *(övers.)* | Sidans rubrik och text. |
| `continueLabel` *(övers.)* | Fortsätt-knappens text (tomt = guidens standard). |
| `repeats` | `true`: sidan upprepas — fälten på den är fälten för *en* post, besökaren lägger till fler (story 084). Saknas nyckeln upprepas sidan inte. |
| `repeatWord` *(övers.)* | Ordet i ental för det som upprepas (*barn*). Visaren böjer det aldrig: *Barn 1*, *Lägg till barn*. |
| `repeatVariable` | Listans variabelnamn. Svaren blir en lista av poster under det namnet; antalet läses som `namn.count` i regler och texter, och summan av ett talfält på sidan som `namn.fält.sum` (story 091). |
| `repeatMin`, `repeatMax` | Minsta och största antal poster. Saknas = 1 respektive ingen gräns. |
| `addLabel` *(övers.)* | Lägg till-knappens text (tomt = *Lägg till* följt av ordet). |
| `firstLabel` *(övers.)*, `firstVariableName`, `firstPlaceholder` *(övers.)*, `firstRequired` | Fält 1. |
| `secondLabel` *(övers.)*, `secondVariableName`, `secondPlaceholder` *(övers.)*, `secondRequired` | Fält 2. |

**`page-heading`** — `title` *(övers.)*, `description` *(övers.)*. Ligger inuti en sida.

**`page-spacer`** — inga fält. Ett mellanrum i en sida.

### Logik

**`rule`** — väljer väg. En utgång per regel-utfall (`id = case.id`) plus `default` (Annars).

| Fält | Betydelse |
| --- | --- |
| `title` | Nodens namn. |
| `cases` | Lista av `RuleCase` (se nedan). |
| `fallbackLabel` | Namn på *Annars*-utgången. |

**`calculation`** — räknar. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` | Nodens namn. |
| `assignments` | Lista av `CalculationAssignment` (se nedan). |

**`service-call`** — anropar ett API. Utgång: `continue`.

| Fält | Betydelse |
| --- | --- |
| `title` | Nodens namn. |
| `endpoint` | URL/väg till tjänsten. |
| `method` | `"POST"` eller `"GET"`. |
| `requestVariables` | Variabler som skickas med. |
| `mockResponse` | Exempelsvar (JSON) för förhandsgranskning. |
| `responseMappings` | Lista av `ServiceResponseMapping` (se nedan). |

### Avslut

**`result`** — `title` *(övers.)*, `description` *(övers.)*. Inga utgångar.

**`email-result`** — producerar ett e-postunderlag. Inga utgångar.

| Fält | Betydelse |
| --- | --- |
| `title` *(övers.)*, `description` *(övers.)* | Rubrik och text. |
| `to` | Mottagare — adress eller variabel, t.ex. `{{email}}`. |
| `subject` *(övers.)* | Ämne. Variabler skrivs `{{variableName}}`. |
| `body` *(övers.)* | Brödtext med samma variabelsyntax. |

## Delade strukturer

```jsonc
// QuestionOption — ett svarsalternativ
{ "id": "option-1", "label": "Ja", "value": "yes" }   // label översättbar, value är identitet

// RuleCondition — ett villkor
{ "id": "co-1", "variableName": "age", "operator": "greater-than-or-equal", "value": "18" }
// operator: equals | not-equals | greater-than | greater-than-or-equal | less-than | less-than-or-equal
//           | one-of | not-one-of | all-of | not-all-of
// Listoperatorerna läser `value` som en kommalista och svaret som en lista:
//   one-of = något av svaren finns i listan, not-one-of = inget gör det,
//   all-of = varje svar finns i listan, not-all-of = minst ett gör det inte.
//   Tomt svar: falskt för all-of och not-all-of, sant för not-one-of.

// RuleCase — ett regel-utfall (en utgång)
{ "id": "case-1", "label": "Vuxen", "match": "all", "conditions": [ /* RuleCondition */ ] }

// CalculationAssignment — en rad i en uträkning
// `label` är frivillig: vad variabeln heter i löptext (story 078); saknas den gäller namnet.
// Översättbar som `variableLabel` (story 080) — en sträng eller `{ "sv": …, "en": … }`.
{ "id": "a-1", "variableName": "avgift", "label": "Avgift", "formula": "pris * 0.15" }

// ServiceResponseMapping — läs ett fält ur svaret till en variabel
// `label` är frivillig och översättbar, som på uträkningens rad (story 079, 080).
{ "id": "m-1", "field": "saldo", "variableName": "kontosaldo", "label": "Kontosaldo" }
```

## Versionering

Serialiserade grafer stämplas med en `version` (nuvarande: **3**).

- Vid **import** läses versionen och äldre grafer migreras framåt automatiskt.
  En graf **utan** `version` tolkas som legacy v1.
- En graf med en **högre** version än den som stöds avvisas med ett tydligt fel
  i stället för att läsas fel.

Migreringskedjan finns i
[`src/viewer/core/graph-migrations.ts`](../src/viewer/core/graph-migrations.ts). Höj
`CURRENT_GRAPH_VERSION` och lägg till ett migreringssteg när formatet ändras på
ett sätt som inte är bakåtkompatibelt.

### Att döpa om en visarnyckel efter lansering

Nycklarna i `settings.strings` är **sparad data**, inte bara kod. Byter vi namn
på en utan migrering slutar redaktörens override gälla, guiden faller tillbaka
på svenska, och **ingenting säger ifrån** — texten finns ju, den är bara inte
längre överskriven.

Före lansering är det ingen fråga: ingen data finns, så ett sök-och-ersätt
räcker. Bytet `preview.*` → `field.*`/`lookup.*`/`image.*`/`step.*` den
2026-08-04 gjordes så, medvetet, eftersom v0.4.x aldrig nått en installation.

Efter lansering behövs ett migreringssteg. Receptet, så det går fort:

```ts
/** vN→vN+1: renames viewer string keys a guide may have overridden. */
const RENAMED_STRING_KEYS: Record<string, string> = {
  "preview.writeAnswer": "field.writeAnswer",
};

function renameStringKeys(graph: Record<string, unknown>): Record<string, unknown> {
  if (!isRecordValue(graph.settings) || !isRecordValue(graph.settings.strings)) {
    return graph;
  }
  const strings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(graph.settings.strings)) {
    const renamed = RENAMED_STRING_KEYS[key] ?? key;
    // An override already stored under the new name wins: it is the more
    // recent decision, and overwriting it would undo an edit.
    if (!(renamed in strings)) {
      strings[renamed] = value;
    }
  }
  return { ...graph, settings: { ...graph.settings, strings } };
}
```

Tre saker att inte missa:

1. **Värdens paket migreras inte.** `registerLocale("ar", { "preview.writeAnswer": … })`
   ligger i värdsystemets kod, utanför vår räckvidd. Ett namnbyte kräver därför
   en rad i `CHANGELOG.md` **och** att `coverageOf()` visar tappet — annars
   upptäcks det inte.
2. **Testet skrivs före migreringen.** En graf med den gamla nyckeln, laddad,
   ska visa den överskrivna texten. Utan det testar migreringen bara sig själv.
3. **De tre `nav.*`-nycklarna är de äldsta** — de var det enda en redaktör kunde
   anpassa till och med v0.3.0. Döp aldrig om dem utan mycket god anledning.

# Kartkontraktet

Det här dokumentet är skrivet för att kunna **lämnas över**: till er egen
utvecklare eller till er kartleverantör, som kravspecifikation för att koppla
er karta till Flowweavers kartfråga. Flowweaver ritar ingen karta, hämtar inga
kartplattor och vet ingenting om projektioner — guiden ställer en fråga, er
karta svarar. (Berättelsen bakom: `docs/STORIES/046-input-med-karta.md`.)

## Grundprincipen

1. **Kartan är er.** Era kartlager, ert licensavtal, er
   tillgänglighetsgranskning av den. Flowweaver skickar aldrig med en egen.
2. **Vi bär data, ni äger systemen.** Fältet lagrar geometri och etikett;
   hur de pekades ut är er sak.
3. **En guide kan byta karttjänst** utan att någon rör guiden — byt
   leverantörsregistreringen på sidan, inget annat.

## Registreringen

Er sida registrerar en leverantör innan (eller efter) guiden laddats:

```js
import { registerMapProvider } from "@johanfuruskog-create/flowweaver-viewer";

registerMapProvider({
  kinds: ["point"],                       // vad er karta klarar
  pick(options) { /* se nedan */ },       // krav
  snapshot(geometry) { /* se nedan */ },  // frivillig
});
```

## `pick(options)` — kravet

Anropas när personen trycker på fältets kartknapp. `options.kind` är den sort
frågan ber om: `"point"`, `"points"` eller `"area"` — deklarera i `kinds` de
ni klarar, så visar fältet bara kartknappen för dem.

`options.current` är **svaret som redan finns**, när personen ändrar sitt
val. Er karta BÖR öppna med det inritat så att justera är utgångsläget —
att rita om från noll är straffet för att ha svarat, och det ska ingen få.

`options.near` är en **frivillig ledtråd**: redaktörens startvy som
`[longitud, latitud]`, satt i frågans panel; `options.zoom` är dess zoomnivå
när en valdes. Ni FÅR centrera er karta där — en leverantör som ignorerar
ledtråden bryter ingenting, men den som följer den ger redaktören makten
över var kartan öppnar och hur nära: en guide om ett kvarter kan öppna på
kvartersnivå.

**Krav på er implementation:**

1. Öppna er karta i ett gränssnitt ni äger helt — dialog, panel, egen vy.
2. Lös löftet med `{ geometry, label }` när personen bekräftat, eller `null`
   när hen avbröt. Lös alltid; ett löfte som aldrig löses fryser fältet.
3. `geometry` är **GeoJSON** i WGS84. Ordningen är standardens:
   `[longitud, latitud]`. Behöver ni SWEREF räknar ni om på er sida —
   Flowweaver lagrar det ni lämnar, ordagrant.
4. `label` är en rad en människa känner igen. **För en punkt: förifyll med
   gatuadressen** — er geokodare kan den redan. Lämnar ni tom etikett visar
   fältet koordinater, vilket är läsbart men fattigt.
5. `zoom` FÅR läggas till i svaret: kartans zoomnivå när valet bekräftades.
   Redaktörens startvy bär den vidare till invånarens karta.

**Avvisas av fältet** (behandlas som avbrutet, med besked till personen):

- `geometry` som inte är giltig GeoJSON av den beställda sorten
- koordinater som inte är ändliga tal
- en sort ni inte deklarerat i `kinds`

## `snapshot(geometry, options)` — frivilligt

Ger fältet en stillbild: er utgångsvy när `geometry` är `null` (visas som
inbjudan innan något valts), annars en bild med den valda geometrin inritad.
`options.near`/`options.zoom` är samma ledtråd som i `pick` — utgångsvyn
utan valt svar bör ligga där, om ni följer den.
Svara med en **data-URI** eller en URL er sidas CSP tillåter. Bilden är
presentation, aldrig data — den lagras inte, och begärs om vid behov.
Etiketten blir bildens alt-text.

Har er karttjänst en stillbilds-endpoint är metoden nästan gratis. Ritar ni
av en klientkarta via canvas: tänk på CORS — plattor utan
`Access-Control-Allow-Origin` smutsar canvasen och `toDataURL` vägrar.

## Svaret har två delar

Samma form som uppslagsfältets:

```json
{ "plats": { "label": "Storgatan 12, Sundsvall", "geo": "{\"type\":\"Point\",\"coordinates\":[17.3069,62.3908]}" } }
```

- `{{plats}}` skriver ut **etiketten** — den som syns i fältet, i vägen hit, i
  resultat och e-post.
- `{{plats.geo}}` skriver ut **GeoJSON-strängen**. Den skickar ni till ert API.
  Människor ser den aldrig.

**Före version 9** låg geometrin i en variabel bredvid (`platsGeo`), av samma
skäl som uppslagets kod: ett villkor kunde bara namnge en hel variabel.
Migreringen skriver om villkor och mallar åt er, `platsGeo` → `plats.geo`.

## Utan karta är fältet inte trasigt

Registreras ingen leverantör — eller saknar den frågans sort — visar fältet
bara sitt golv: en pekarfri inmatning där personen skriver adress eller
beskrivning i ord. Etikettvariabeln fylls, geovariabeln lämnas tom, och er
mottagning får avgöra om ord räcker. Kartknappen är en bekvämlighet ovanpå
ett golv som alltid fungerar.

## Tillgänglighetskrav på ert kartgränssnitt

Det här är er del av K-kraven, och den hör hemma i beställningen till er
leverantör:

- Öppna som riktig dialog med fokusfälla; Esc avbryter och löser `null`.
- Bekräfta och avbryt är riktiga knappar, nåbara med tangentbord.
- När dialogen stängs ska fokus återvända till kartknappen i guiden —
  fältet sköter sin del, men er dialog får inte kidnappa fokus på vägen ut.
- Kartgesten i sig (peka, rita) behöver inte vara tangentbordsnåbar — det är
  därför golvet finns — men vägen *in i* och *ut ur* er dialog måste vara det.

## Det finns en körbar sida av det här

`dev/map.html` är referensimplementationen: det riktiga kartfältet mot
Leaflet + OpenStreetMap, kopplat genom exakt det här kontraktet, med
stillbilder, adressförifyllning och verktygspanel. Läs dess källa
(`src/site/map-reference-provider.ts`) som facit. Testsviten kör en simulerad
leverantör och en avvisningsväg per regel ovan — er implementation kan provas
mot samma guide utan att någon rad i den ändras.

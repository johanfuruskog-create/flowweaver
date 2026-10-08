# Uppslagskontraktet

Sökfältet med förslag (`autocomplete-question`) hämtar sina förslag från en
endpoint som **du** tillhandahåller. Det här dokumentet beskriver vad Flowweaver
skickar och vad den kräver tillbaka, så att en BFF kan byggas utan att någon
läser vår källkod.

## Grundprincipen

Flowweaver vet ingenting om Lantmäteriet, folkbokföringen eller någon annan
källa. Guiden säger bara *"sök på det här"* och får tillbaka en lista med
`{ value, label }`.

Att översätta en källas svar till den listan är **BFF:ens uppgift**. Det är
avsiktligt, av tre skäl:

1. **Nycklar och avtal hör hemma på servern.** En guide som körs inbäddad på en
   webbsida får aldrig bära en API-nyckel. Samma regel som för `service-call`.
2. **Källor byter format.** När de gör det ändrar du adaptern, inte guiderna.
3. **En guide kan byta källa** utan att någon rör guiden — mockdata under
   utveckling, skarp tjänst i produktion.

## Begäran

```
GET {endpoint}?q={term}&limit={n}&locale={språk}
Accept: application/json
```

| Parameter | Beskrivning |
| --- | --- |
| `q` | Det användaren hunnit skriva, trimmat. Skickas först när det når fältets *minsta antal tecken* (standard 2). |
| `limit` | Högsta antal förslag som visas. I dag alltid `8`. |
| `locale` | Guidens visningsspråk, t.ex. `sv`. Utelämnas om guiden är enspråkig. |

`endpoint` får vara relativ (`/api/kommuner`) eller absolut. Anropet görs med
`fetch` utan credentials — sitter tjänsten bakom inloggning är det BFF:en som
löser det, inte fältet.

Fältet väntar **200 ms efter sista tangenttrycket** innan det söker, och ett
äldre svar som kommer efter ett nyare kastas. Räkna alltså med färre anrop än
tangenttryck, men inte med noll.

## Det finns en körbar sida av det här

`npm run bff` startar `tools/mock-bff.mjs`, som svarar enligt kontraktet nedan
över de kodlistor som redan följer med som JSON:

    http://localhost:4310/lookup/lander
    http://localhost:4310/lookup/kommuner
    http://localhost:4310/lookup/lan

Den är avsedd att **läsas** lika mycket som att köras — dokumentet säger hur ett
svar ska se ut, och den filen är samma svar i kod. Bygger du en riktig BFF har du
något att jämföra mot i stället för en tabell att tolka.

Under `/broken/*` svarar den fel med flit, en väg per avvisningsregel längre ned.
`npm run smoke:lookup` kör ett riktigt fält mot alla vägarna och kontrollerar att
det avvisar de trasiga — 9 kontroller, den enda plats där `source: "service"` går
en hel väg över HTTP.

## Svar

```json
{
  "version": 1,
  "items": [
    { "value": "1880", "label": "Örebro", "hint": "Örebro län" },
    { "value": "1881", "label": "Kumla", "hint": "Örebro län" }
  ]
}
```

| Fält | Krav | Betydelse |
| --- | --- | --- |
| `version` | **måste** vara `1` | Kontraktets version. Ett annat värde avvisas hellre än tolkas fel. |
| `items` | **måste** vara en lista | Tom lista betyder "inga träffar", inte fel. |
| `items[].value` | **måste** vara en sträng | Koden som sparas i guidens variabel — kommunkod, landskod, adressplats-id. |
| `items[].label` | **måste** vara en icke-tom sträng | Det användaren ser och väljer. |
| `items[].hint` | valfri sträng | Särskiljare när två träffar heter lika, t.ex. länet. Visas nedtonat bredvid etiketten. |
| `items[].exclusive` | valfri boolean | Ett förslag som **inte kan kombineras** med något annat val. Se nedan. |

### Ett förslag som utesluter de andra

Sätt `"exclusive": true` på ett förslag som inte kan hållas tillsammans med
något annat. Det klassiska fallet är *Statslös*: den som är statslös har per
definition inget medborgarskap, så *statslös och tysk* är en motsägelse och inte
ett ovanligt svar. Skatteverkets landskoder har fyra sådana — `XS` statslös,
`XO` okänt land, `ZZ` under utredning, `XU` upphört land.

```json
{
  "version": 1,
  "items": [
    { "value": "DE", "label": "Tyskland" },
    { "value": "XS", "label": "Statslös", "exclusive": true }
  ]
}
```

I ett flervärt fält gör fältet då två saker:

- **Alternativet står under en egen rad**, `— eller —`, aldrig blandat i
  mängden. Den som ser *eller* förstår antingen-eller innan den trycker.
- **Valet ersätter i stället för att spärra.** Väljs det exklusiva tas de andra
  bort; väljs ett vanligt tas det exklusiva bort. Statusraden säger vad OCH
  varför: *"Statslös tillagt. 1 vald. Kan inte kombineras med andra val, så
  Danmark togs bort."* Krysset och Backspace ångrar.

Fältet spärrar alltså aldrig en knapp. En knapp som vägrar utan att säga varför
är en återvändsgränd, och på en pekskärm ser den ut som en bugg.

**Fältet är valfritt och bakåtkompatibelt.** En BFF som aldrig skickar det
ändrar ingenting, och ett svar utan det avvisas inte — därför kunde kontraktet
få fältet utan att `version` ändrades. Ett enkelvärt fält bryr sig inte: där
ersätter varje val redan det förra.

### Vad som avvisas

Ett halvt tolkat svar är värre än inget: användaren skulle välja ett förslag som
saknar kod, variabeln bli tom, och felet upptäckas först längre fram i flödet.
Därför avvisas **hela svaret** om:

- `version` inte är `1`
- `items` saknas eller inte är en lista
- något förslag saknar `value` eller har en tom `label`

Fältet visar då "Uppslaget kunde inte nås" och listan förblir stängd. Detsamma
gäller HTTP-status utanför 2xx och nätverksfel.

## Svaret har två delar

Ett uppslagsfält sparar **ett** svar med två delar:

```json
{ "kommun": { "label": "Örebro", "value": "1880" } }
```

- `{{kommun.label}}` skriver ut **etiketten**, alltså `Örebro` — det är den en
  människa läser, i resultattexter och i brev.
  `{{kommun}}` — helheten utan del — skriver samma sak och fungerar i guider
  skrivna innan delarna fanns. Men det är `{{kommun.label}}` som variabelknappen
  sätter in och som listan namnger, så det är den stavningen att skriva ny text
  med. Två stavningar för en sak är en som glider.
- `{{kommun.value}}` skriver ut **koden**, alltså `1880`. Det är den ett senare
  steg eller en integration ska använda, och den ett villkor ska pröva:
  `kommun.value är någon av 1880, 0180`.

Väljer fältet flera blir svaret en lista av samma delar, och `kommun.value` blir
listan av koder.

**Före version 9** låg koden i en egen variabel (`codeVariableName`, t.ex.
`kommunkod`). Den fanns av ett enda skäl: ett villkor kunde bara namnge en hel
variabel, så delen fick en egen. Två variabler kan glida isär — de hölls i takt
av ordningen de skrevs i — och det märks först den dag en post försvinner på
ena sidan och en regel läser fel kommuns kod medan båda ser felfria ut.

Migreringen till version 9 skriver om villkor och mallar åt er:
`kommunkod` → `kommun.value`. Ni behöver inte röra era guider.

Skriver användaren vidare efter att ha valt ett förslag nollställs koden. Ett
kodvärde som låg kvar hade blivit en tyst lögn om vad som faktiskt valdes.

Fältet kan sättas att kräva ett val ur listan (standard) eller tillåta egna
värden. Kommun och land bör kräva val — det är det som gör koden användbar. Ett
adressfält kan behöva tillåta fritext, eftersom register saknar nybyggda
adresser.

## Att bygga en adapter

Källans form spelar ingen roll så länge den går att vika till `{ value, label }`.
Så här skulle en adapter mot Lantmäteriets belägenhetsadresser kunna se ut i
princip — namnen på källans fält får du från deras dokumentation:

```js
// BFF:en, aldrig i klienten.
app.get("/api/adresser", async (req, res) => {
  const träffar = await lantmäteriet.sökBelägenhetsadress({
    fritext: req.query.q,
    maxAntal: Number(req.query.limit ?? 8),
  });

  res.json({
    version: 1,
    items: träffar.map((träff) => ({
      // Koden: det stabila id:t, som en efterföljande tjänst kan slå upp på.
      value: träff.objektidentitet,
      // Etiketten: det en människa känner igen.
      label: `${träff.adressplatsnamn}, ${träff.postnummer} ${träff.postort}`,
      // Ledtråden: skiljer två likadana adresser i olika kommuner åt.
      hint: träff.kommunnamn,
    })),
  });
});
```

Tre saker är värda att göra rätt i adaptern:

1. **Sätt `value` till något stabilt.** Ett id som överlever att gatan byter namn
   är värt mer än en sammansatt sträng.
2. **Låt `label` vara läsbar.** Den är vad användaren väljer på, och vad som
   skrivs ut i resultatet.
3. **Cacha och begränsa.** Fältet debouncar, men en publik guide kan ge många
   anrop. Kvot och cache hör hemma i BFF:en, där du ser dem.

## Innan det finns en BFF

Varje fält kan bära sin egen lista och söka i den lokalt, utan nätverk. Välj
**Egen lista (mockdata)** som källa och fyll i alternativen: värdet är koden,
etiketten är det användaren ser.

Sökningen är skiftlägesokänslig och bortser från diakriter, så `orebro` hittar
`Örebro`, och den söker även på koden.

Allt annat är identiskt — samma tangentbord, samma uppläsning, samma validering.
Det gör att en guide kan byggas och provköras färdig innan tjänsten finns, och
att kontraktet kan provas utan att någon skriver serverkod.

## Tillgänglighet

Fältet följer ARIA 1.2:s kombinationsrutemönster. Kortfattat, för den som
granskar:

- `role="combobox"` på inmatningsfältet med `aria-expanded` och `aria-controls`
- listan har `role="listbox"`, förslagen `role="option"`
- fokus lämnar aldrig inmatningsfältet; det markerade förslaget pekas ut med
  `aria-activedescendant`
- antalet träffar läses upp i ett `aria-live`-område — utan det vet den som inte
  ser listan inte att något hände
- Escape stänger, Upp/Ner flyttar, Home/End går till ändarna, Enter väljer

Det är också skälet till att fältet inte är ett `<datalist>`: stödet i
skärmläsare är ojämnt och utseendet går inte att styra.

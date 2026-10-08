# Versioner i Node och MongoDB

Ett andra **exempel** på hur en värd lagrar en guides versioner — inte en
produkt att installera och förvalta. Läs det, ta det som passar, bygg ditt eget.

Det första exemplet ligger i [`../sitevision-webapp/`](../sitevision-webapp/)
och lagrar i Sitevisions egna utrymmen. Det här gör samma sak med en vanlig
server och en vanlig databas.

## Vad det bevisar

Att lagringen är den enda delen som byter. Versionslistan, avsikterna, de två
märkena och varje beslut om vad *publicera* betyder ligger någon annanstans, och
inget av det vet att den här mappen finns.

`src/routes.js` talar teckenexakt samma schema som Sitevision-modulen:

```
GET    /versions?space=…      listan, utan guiderna
GET    /versions/:id          en guide
POST   /versions              en ny version med guiden i
POST   /versions/:id          skriv guiden i den
POST   /versions/:id/copy     en ny version ur det som är lagrat
POST   /versions/:id/name     namnet, inte guiden
POST   /versions/:id/note     anteckningen
POST   /versions/:id/remove   ta bort, och det menas
```

`PUT /versions/:id` och `DELETE /versions/:id` gör detsamma, för en klient som
inte sitter fast i Sitevisions `requester` — den kan bara `doGet` och `doPost`,
och ett verb klienten inte kan skicka är ett verb rutten lika gärna kan sakna.

## Vad det visar som de andra inte kan

**Ett riktigt anrop.** Latens, och ett fel mitt i en sparning. `localStorage`
och en inställningsdialog svarar båda omedelbart, så hur listan känns medan den
väntar har aldrig gått att bedöma.

**Två redaktörer.** En sparning får bära `knownSavedAt` — tidsstämpeln på den
version redaktören läste innan hen skrev. Har dokumentet hunnit ändras svarar
servern **409** med det som står där nu, och klienten får välja: ta min, ta
deras, behåll båda. Kontrollen och skrivningen är *en* operation; att läsa
först och skriva sedan lämnar en lucka bred nog för den andra redaktören att
gå igenom.

**Ingen styckning.** Sitevision-versionen delar guiden i numrerade fält
eftersom ett värde där tar 5 000 tecken och en post 50 fält. Här är grafen ett
subdokument, helt. Det är den tydligaste bilden av vad som var plattformens
problem och vad som var vårt.

## Köra det

```bash
npm install
npm run mongo      # docker compose up -d
npm start          # http://localhost:4500
```

Klienthalvan ligger i [`client/version-store.js`](client/version-store.js) —
fyrtio rader, de åtta verben över `fetch`. Klistra in den i din egen sida,
peka `base` mot servern och ge `<guide-versions>` det `list()` returnerar.

Att svara på elementets avsikter är den delen som är din: vad publicering
betyder, om borttagning frågar först, var utkastet bor. Inget av det är
lagring, vilket är skälet att inget av det ligger i den filen.

## Vad det inte gör

**Ingen inloggning.** Uttalat, inte underförstått: vem som får skriva är
värdsystemets fråga och varje värd svarar olika — en session i ett CMS, ett
token i en gateway, en header från en proxy. Att välja en av dem här hade lärt
ut ett sätt som passar ingens installation. Ställ det här bakom det som redan
vet vilka dina redaktörer är.

**CORS är avstängt** tills `FLOWWEAVER_ORIGIN` sätts. En server som svarar
*skriv över guiden folk läser* ska inte komma med öppen dörr i ett exempel som
kommer att kopieras som det är.

**Ingen migrering.** Guiderna lagras som de kommer. Biblioteket lyfter en gammal
graf till dagens format när den läses in i editorn, inte här.

## Testerna

```bash
npm test
```

Kör två filer med Nodes egen testkörare, ingen ram att adoptera:

`test/routes.test.mjs` startar Express på en tillfällig port och pratar HTTP med
den. Statuskoder, JSON-kroppen, och framför allt att en krock kommer som **409
med den nuvarande versionen i svaret** i stället för som ett 500 med en mening.

`test/mongo.test.mjs` kör mot en **riktig** mongod som `mongodb-memory-server`
laddar ner en gång och cachar. Den finns för att en attrapp håller med om allt
jag trodde om drivrutinen — och en av de sakerna bär last: fram till mongodb 5
gav `findOneAndUpdate` ett resultatobjekt med dokumentet under `value`, från 6
ger den dokumentet självt. Läser lagret fel skulle **varje** sparning se ut som
en krock, och det felet hittas annars av en redaktör som får veta att hens egen
sparning var någon annans.

Den fångade också ett riktigt designfel första gången den kördes: `_id` är ett
`ObjectId`, listan lämnar ifrån sig en sträng, och strängen matchade ingenting
när den skickades in igen. Ett lager som delar ut nycklar dess egen dörr inte
tar. Konverteringen ligger därför i lagret, inte i rutten — glömmer en anropare
den får hen tystnad, inte ett fel.

Lagrets beslut pinnas dessutom i huvudrepot,
`src/node-mongo-version-store.test.ts`, mot en attrapp. Det testet behöver
ingen databas, vilket är skälet att det kan ligga i CI tillsammans med allt
annat.

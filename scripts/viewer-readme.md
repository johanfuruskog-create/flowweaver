# FlowWeaver – visaren

Inbäddningsbar web component som kör en färdig guide åt besökaren:
`<guide-preview>`. Inget ramverksberoende — ett vanligt custom element som
fungerar i vilken sida som helst. Det här är det enda en besökare laddar.

Editorn, som redaktören bygger guiden i, är ett eget paket:
`@johanfuruskog-create/flowweaver-editor`. Den bäddar redan in visaren, så en
sida importerar **antingen** visaren eller editorn.

## Installera

```bash
npm install @johanfuruskog-create/flowweaver-viewer
```

Paketet ligger på GitHub Packages, vilket kräver en `.npmrc` med ett token som
har `read:packages`. Vill du slippa det går bundeln att ladda direkt som statisk
fil — se nästa avsnitt.

## Utan byggsteg

Bundeln finns även som klassiskt bygge (`global.js`) för sidor som bara kan
klistra in en vanlig script-tagg — CMS:er, portaler, allt där modulsyntax inte
går. Den registrerar elementet som sidoeffekt, precis som ES-modulen:

```html
<link rel="stylesheet" href="https://flowweaver.se/lib/tokens.css">
<guide-preview></guide-preview>
<script src="https://flowweaver.se/lib/flowweaver-viewer.global.js"></script>
<script>
  document.querySelector("guide-preview").graph = minGraf;
</script>
```

Ordningen mellan taggarna spelar ingen roll — sätts grafen innan bundeln laddat
plockas värdet upp när elementet registreras.

## Använda visaren

```html
<link rel="stylesheet" href="node_modules/@johanfuruskog-create/flowweaver-viewer/tokens.css">
<guide-preview></guide-preview>

<script type="module">
  import "@johanfuruskog-create/flowweaver-viewer";

  document.querySelector("guide-preview").graph = {
    startNodeId: "q1",
    nodes: [
      { id: "q1", type: "question", position: { x: 0, y: 0 }, data: {
        title: "Har du fyllt 18 år?",
        variableName: "isAdult",
        options: [
          { id: "yes", label: "Ja", value: "yes" },
          { id: "no", label: "Nej", value: "no" },
        ] } },
      { id: "ok", type: "result", position: { x: 400, y: 0 }, data: {
        title: "Du kan gå vidare" } },
    ],
    connections: [
      { id: "c1", from: { nodeId: "q1", portId: "yes" }, to: { nodeId: "ok", portId: "input" } },
    ],
  };
</script>
```

TypeScript-typerna följer med: `GraphData` och de andra graftyperna exporteras
från paketets ingång.

## Vad värdapplikationen äger

Biblioteket är avsiktligt utan sidoeffekter utanför komponenten. Det som
exempelsidorna i projektet gör, men som paketet **inte** gör åt dig:

- **Lagring.** Visaren sparar inget. Inlämningar går till en mottagare du
  registrerar med `registerSubmissionReceiver`.
- **Tema.** `tokens.css` följer operativsystemets ljusa/mörka läge. Vill du ha
  en egen växlare sätter du `data-theme="dark"` på `<html>`.

## Storlek

33 kB gzip.

## Licens

MIT — se `LICENSE`.

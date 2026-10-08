# FlowWeaver – editorn

Inbäddningsbar web component som redaktören bygger guiden i: `<guide-editor>`.
Inget ramverksberoende — ett vanligt custom element som fungerar i vilken sida
som helst.

Editorn bäddar in visaren för sin förhandsvisning, så en sida importerar
**antingen** editorn eller visaren. Visaren — det enda en besökare laddar — är
ett eget paket: `@johanfuruskog-create/flowweaver-viewer`.

## Installera

```bash
npm install @johanfuruskog-create/flowweaver-editor
```

Paketet ligger på GitHub Packages, vilket kräver en `.npmrc` med ett token som
har `read:packages`. Vill du slippa det går bundeln att ladda direkt som statisk
fil: `https://flowweaver.se/lib/flowweaver-editor.global.js`
är det klassiska bygget för en vanlig `<script src>`, och det registrerar
elementet som sidoeffekt precis som ES-modulen.

## Använda editorn

```html
<link rel="stylesheet" href="node_modules/@johanfuruskog-create/flowweaver-viewer/tokens.css">
<guide-editor feature-level="advanced"></guide-editor>

<script type="module">
  import "@johanfuruskog-create/flowweaver-editor";

  const editor = document.querySelector("guide-editor");
  editor.graph = befintligGraf;
  editor.addEventListener("graph-changed", (event) => spara(event.detail));
</script>
```

`feature-level` styr hur mycket redaktören ser. `tokens.css` bor i visarpaketet,
som installeras som beroende. TypeScript-typerna följer med.

## Vad värdapplikationen äger

Biblioteket är avsiktligt utan sidoeffekter utanför komponenten. Det som
exempelsidorna i projektet gör, men som paketet **inte** gör åt dig:

- **Lagring.** Editorn autosparar inte. Lyssna på `graph-changed` och spara
  själv.
- **Tema.** Visarpaketets `tokens.css` följer operativsystemets ljusa/mörka
  läge. Vill du ha en egen växlare sätter du `data-theme="dark"` på `<html>`.

## Storlek

89 kB gzip, visaren inräknad.

## Licens

Mozilla Public License 2.0 — se `LICENSE`. Fri att använda, ändra och bygga
produkter på, också i drift. Ändrar du i editorns egna filer och sprider
resultatet delar du de ändrade filerna under samma licens; dina egna filer
bredvid får vara stängda. Versioner publicerade före oktober 2026 behåller
Business Source License 1.1.

Visarpaketet, som editorns typer lutar mot, är MIT.

# FlowWeaver

Bygg beslutsguider utan att skriva kod — och visa dem på vilken sida som helst.

*Build decision guides without code, and show them on any web page. The
editor and the viewer are web components; the guide is a JSON file. The
documentation is in Swedish.*

FlowWeaver är två web components. **Editorn** (`<guide-editor>`) låter en
redaktör rita en guide som ett flöde av frågor, regler och svar. **Visaren**
(`<guide-preview>`) kör guiden för besökaren. Guiden däremellan är en fil i
ett öppet format ([`docs/JSON-KONTRAKT.md`](docs/JSON-KONTRAKT.md)), och den
är er.

**FlowWeaver har ingen backend — med flit.** Ni äger lagring, inloggning och
register i er egen miljö. Sömmen är skrivna kontrakt som vem som helst kan
bygga mot ([`docs/VARDSYSTEM-KONTRAKT.md`](docs/VARDSYSTEM-KONTRAKT.md) är
kartan). FlowWeaver finns för att ni ska slippa bygga frontend.

## Prova

**[flowweaver.se](https://flowweaver.se/)** — guider att svara på och samma
guider öppna i editorn.

Lokalt, med demon i `demo/`:

```bash
npm ci
npm run build:lib
npm run serve:demo        # http://localhost:4190/demo/
```

Demon är skriven som en värd skriver sin sida: vanlig html som laddar de
byggda bundlarna med en script-tagg och sparar guiden i webbläsaren. *Mina
guider* (`demo/guides.html`) är samma sak mot en riktig lagringsvärd — starta
referensvärden med `npm run receiver` och lägg till
`?api=http://localhost:4320` i adressen.

## Bädda in

Redaktören exporterar guiden ur editorn som en fil, ni lägger filen bredvid
sidan, och sidan hämtar den:

```html
<link rel="stylesheet" href="https://flowweaver.se/lib/tokens.css">

<guide-preview></guide-preview>

<script src="https://flowweaver.se/lib/0.11/flowweaver-viewer.global.js"></script>

<script>
  fetch("min-guide.json")
    .then((svar) => svar.json())
    .then((guide) => { document.querySelector("guide-preview").graph = guide; });
</script>
```

Hela vägen, med versionslåsta adresser och editorn:
[flowweaver.se/install.html](https://flowweaver.se/install.html).
Paketen publiceras inte på npm ännu.

## Det här finns i repot

| | |
| --- | --- |
| `src/viewer/` | Visaren och det gemensamma — det en besökares sida laddar |
| `src/editor/` | Editorn |
| `src/host/` | *Mina guider*: en referensvärd över lagringskontraktet |
| `integrations/reference-receiver/` | Referensvärden för lagring och inloggning |
| `docs/` | Kontrakten, kraven och arkitekturen |
| `demo/` | Demon ovan |

Proven körs med `npm run test:run` (enhet) och `npx vitest run --project
browser` (i Chromium), och bundlarna med `npm run smoke:lib`.

## Licens

Visaren och allt utom editorn är **MIT**. Editorn är **Mozilla Public License
2.0**: fri att använda och bygga produkter på, också i drift; ändrar ni i
editorns egna filer och sprider dem delar ni de filerna under samma licens.
Se [`LICENSE`](LICENSE).

**FlowWeaver PRO** lägger till det som låter besökaren *skicka in* —
inlämning, e-postresultat, mottagare — och licensieras separat:
[flowweaver.se/pro](https://flowweaver.se/pro/).

## Bidra

Se [`CONTRIBUTING.md`](CONTRIBUTING.md). Varje commit signeras enligt
Developer Certificate of Origin (`git commit -s`).

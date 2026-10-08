# FlowWeaver

**English** · [Svenska](README.sv.md)

Build decision guides without writing code — and show them on any web page.

FlowWeaver is two web components. The **editor** (`<guide-editor>`) lets an
editor draw a guide as a flow of questions, rules and answers. The **viewer**
(`<guide-preview>`) runs the guide for the visitor. Between them the guide is
a file in an open format ([`docs/JSON-KONTRAKT.md`](docs/JSON-KONTRAKT.md)),
and it is yours.

**FlowWeaver has no backend — on purpose.** You keep storage, sign-in and
registers in your own environment. The seams are written contracts anyone can
build against ([`docs/VARDSYSTEM-KONTRAKT.md`](docs/VARDSYSTEM-KONTRAKT.md) is
the map). FlowWeaver exists so that you do not have to build a frontend.

The interface speaks Swedish and English. The documentation in `docs/` is in
Swedish; the code and its comments are in English.

## Try it

**[flowweaver.se](https://flowweaver.se/en/)** — guides to answer, and the
same guides open in the editor.

Locally, with the demo in `demo/`:

```bash
npm ci
npm run build:lib
npm run serve:demo        # http://localhost:4190/demo/
```

The demo is written the way a host writes its page: plain HTML that loads the
built bundles with a script tag and keeps the guide in the browser. *My
guides* (`demo/guides.html`) is the same against a real storage host — start
the reference host with `npm run receiver` and add
`?api=http://localhost:4320` to the address.

## Embed it

The editor exports the guide as a file, you put the file next to your page,
and the page fetches it — or your own system hands the guide to the viewer as
an object:

```html
<link rel="stylesheet" href="https://flowweaver.se/lib/tokens.css">

<guide-preview></guide-preview>

<script src="https://flowweaver.se/lib/0.11/flowweaver-viewer.global.js"></script>

<script>
  fetch("my-guide.json")
    .then((response) => response.json())
    .then((guide) => { document.querySelector("guide-preview").graph = guide; });
</script>
```

The whole way, with version-pinned addresses and the editor:
[flowweaver.se/en/install.html](https://flowweaver.se/en/install.html).
Every attribute, property, method and event:
[the API reference](https://flowweaver.se/en/api.html).
The packages are not on npm yet.

## What is in the repo

| | |
| --- | --- |
| `src/viewer/` | The viewer and what is shared — what a visitor's page loads |
| `src/editor/` | The editor |
| `src/host/` | *My guides*: a reference host over the storage contract |
| `integrations/reference-receiver/` | The reference host for storage and sign-in |
| `docs/` | The contracts, the requirements and the architecture |
| `demo/` | The demo above |

The tests run with `npm run test:run` (unit) and `npx vitest run --project
browser` (in Chromium), and the bundles with `npm run smoke:lib`.

## Licence

The viewer and everything but the editor are **MIT**. The editor is **Mozilla
Public License 2.0**: free to use and to build products on, in production
too; if you change the editor's own files and distribute them, you share
those files under the same licence. See [`LICENSE`](LICENSE).

**FlowWeaver PRO** adds what lets the visitor *send in* — submission, email
results, recipients — and is licensed separately:
[flowweaver.se/en/pro](https://flowweaver.se/en/pro/).

## How it is built

FlowWeaver is built by Johan Furuskog with an AI assistant, Claude, writing
much of the code alongside him — which is why Claude appears among the
contributors. Every change is reviewed, tested and signed off by Johan, who
answers for it.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Every commit is signed off under the
Developer Certificate of Origin (`git commit -s`).

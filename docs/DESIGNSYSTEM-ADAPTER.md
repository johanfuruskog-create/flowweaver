# Utbytbara designsystem i visaren

> **Status: anteckningar. Inget i det här repot är ändrat.** Skrivet och
> uppdaterat 2026-07-30 från Midas-sidan (`../midas`, paketet
> `@midas-ds/elements`). Dokumentet finns för att en annan session ska kunna ta
> vid utan att återuppfinna resonemanget.
>
> **Midas-sidan är klar.** Alla fälttyper visaren behöver finns byggda och
> verifierade — se *Vad Midas har* längre ned. Det som återstår är etapp 1 och 2
> här i repot: kontraktet och extraheringen av de åtta renderingsställena.

## Målet

Visaren ska kunna rendera sina fält som vanlig HTML (som idag), som Midas
web components, eller som något annat designsystem — valfritt vid uppstart.

## Principen: åt vilket håll pekar beroendet

Det avgörande beslutet. **FlowWeaver definierar ett kontrakt, designsystemen
implementerar det.** FlowWeaver får aldrig veta att Midas finns.

Fel väg vore att visaren importerar Midas. Då tappar FlowWeaver sin
beroendefrihet, och varje nytt designsystem kräver en ändring här.

Rätt väg ger tre egenskaper:

1. FlowWeaver förblir beroendefritt — kontraktet är bara typer och en setter.
2. Att lägga till ett designsystem är att publicera en adapter. Noll ändringar
   i det här repot.
3. Standardrenderaren är vanlig HTML, så visaren fungerar fristående som nu.

## Kontraktet

Visaren bygger HTML-strängar med `innerHTML`, så kontraktet bör också vara
strängbaserat. Det passar den befintliga arkitekturen och kräver minsta möjliga
omskrivning.

```ts
export interface ChoiceSpec {
  name: string
  label: string
  description?: string
  required?: boolean
  errorMessage?: string
  value?: string | string[]
  options: { value: string; label: string; disabled?: boolean }[]
}

export interface TextSpec {
  name: string
  label: string
  description?: string
  required?: boolean
  errorMessage?: string
  value?: string
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  inputMode?: string
  pattern?: string
}

export interface NumberSpec extends TextSpec {
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface FieldRenderer {
  radioGroup(spec: ChoiceSpec): string
  checkboxGroup(spec: ChoiceSpec): string
  select(spec: ChoiceSpec): string
  multiSelect(spec: ChoiceSpec): string
  text(spec: TextSpec): string
  textarea(spec: TextSpec): string
  number(spec: NumberSpec): string
  /**
   * Valfri krok som körs efter att markupen satts in i DOM:en.
   * Behövs av designsystem som måste sätta *egenskaper* i stället för
   * attribut — det går inte att uttrycka i en sträng.
   */
  hydrate?(root: ParentNode): void
}

export function setFieldRenderer(renderer: FieldRenderer): void
```

Specarna beskriver **vad fältet är, aldrig hur det ser ut**. Etiketter kommer in
färdiglokaliserade — anropa `this.localized(...)` före, inte i renderaren.

### Escaping är renderarens ansvar — exportera hjälpen

Ett strängbaserat kontrakt flyttar escaping-ansvaret till adaptern. Det är den
enda riktiga fallgropen i designen och bör hanteras uttryckligen: **exportera
`escapeHtml` som en del av kontraktsmodulen** så att adapterförfattare inte
skriver en egen halvbra variant. Se `docs/RUNTIME-SECURITY.md`.

Överväg också ett test som matar in `<script>`-innehåll i varje spec-fält och
kontrollerar att standardrenderaren escapar det. Det testet blir sedan mallen
för vad en adapter måste klara.

## De åtta ställen som ska extraheras

Alla i `src/viewer/components/guide-preview/guide-preview.ts` (1910 rader):

| Rad | Metod | Renderar | Blir |
| --- | --- | --- | --- |
| 624 | `renderDeclarativeChoice` | `type="radio"` | `radioGroup` |
| 653 | `renderDeclarativeChoice` | `<select>` när `presentation === "select"` | `select` |
| 751 | `renderDeclarativeMulti` | `type="checkbox"` | `checkboxGroup` |
| 805 | `renderDeclarativeMulti` | `<select multiple size>` när `presentation === "multiselect"` | `multiSelect` |
| 942 | `renderPageField` | `type="radio"`, `name="page-field-${id}"` | `radioGroup` |
| 1020 | `renderDeclarativeText` | `<input>` / `<textarea>` | `text` / `textarea` |
| 1230 | `renderDeclarativeNumber` | `type="number"` + min/max/step | `number` |
| 1558 | `renderNavigation` | knappar | *(senare, se nedan)* |

`renderDeclarativeChoice` och `renderDeclarativeMulti` har alltså **två
presentationer var** — det är samma data, olika kontroll. Båda grenarna måste
gå genom renderaren, annars byter bara hälften av visaren utseende.

`renderNavigation` är medvetet utelämnad ur första omgången — knappar är
enklare och kan läggas till när fälten är på plats.

## Etapper

### Etapp 1 — kontraktet och standardrenderaren (beteendeneutral)

Definiera typerna, `setFieldRenderer`, och en `plainFieldRenderer` som
producerar **exakt** dagens markup. Extrahera de sju fältställena till anrop
(alla utom `renderNavigation`).

Verifieras av att befintliga tester passerar oförändrade:
`guide-preview.browser.test.ts`, `-multi-choice`, `-input-type`,
`-custom-declarative`, `-presentation`, `-text-presentation`, `-i18n`, plus
`__screenshots__`. Går de igenom är refaktoreringen bevisat beteendeneutral.

Det här är den stora biten och den enda som rör befintlig kod.

### Etapp 2 — exponera valet

`setFieldRenderer` från paketets publika yta, och ett attribut eller en
egenskap på `<guide-preview>` för den som inte bundlar. Uppdatera
`docs/JSON-KONTRAKT.md` om något syns i schemat (troligen inte — det här är en
presentationsfråga, inte en datafråga).

### Etapp 3 — Midas-adaptern

Byggs i `../midas` som `@midas-ds/elements/flowweaver`, inte här. Adaptern blir
ungefär en rad per fälttyp eftersom Midas API är attributdrivet:

```ts
radioGroup: s => `
  <midas-radio-group name="${esc(s.name)}" label="${esc(s.label)}"
    ${s.required ? 'is-required' : ''}>
    ${s.options.map(o =>
      `<midas-radio value="${esc(o.value)}">${esc(o.label)}</midas-radio>`
    ).join('')}
  </midas-radio-group>`
```

Konsumenten skriver:

```js
import { setFieldRenderer } from '@johanfuruskog-create/flowweaver-viewer'
import { midasFieldRenderer } from '@midas-ds/elements/flowweaver'
import '@midas-ds/elements/variables.css'

setFieldRenderer(midasFieldRenderer)
```

**Storleken går att styra.** `@midas-ds/elements` har en ingång per komponent,
så adaptern kan ta in bara det den använder i stället för hela paketet:

```js
import '@midas-ds/elements/select'
import '@midas-ds/elements/textfield'
```

Hela biblioteket väger 16 kB gzip; en enskild komponent ligger på 2–5 kB
inklusive den delade basen. Visaren ligger på 33 kB idag, så det är värt att
importera selektivt.

## Vad Midas har — uppdaterat 2026-07-30

**Inga blockerande luckor kvar.** Varje fälttyp visaren renderar har nu en
motsvarighet:

| Visarens fälttyp | Midas |
| --- | --- |
| `radioGroup` | `midas-radio-group` + `midas-radio` |
| `checkboxGroup` | `midas-checkbox-group` + `midas-checkbox` |
| `select` | `midas-select` |
| `multiSelect` | `midas-select selection-mode="multiple"` |
| `text` | `midas-textfield` |
| `textarea` | `midas-textarea` |
| `number` | `midas-textfield type="number"` |
| knappar | `midas-button` |

Dessutom finns `midas-popover`, `midas-listbox`, `midas-listbox-item` och
`midas-tag`, som flervalet bygger på. Teckenräknaren finns som `show-counter`
på textfältet och textarean.

Tre tidigare noteringar var felaktiga och har rättats:

- ~~Nummerfält med enhet saknas~~ — **behövs inte.** Visaren lägger enheten i
  *etikettexten* via `chrome("field.enterNumberUnit", { unit })`, inte som en
  dekoration i fältet. `<midas-textfield type="number">` räcker, med `min`,
  `max` och `step` som vanliga attribut.
- ~~Teckenräknare saknas~~ — finns nu, men **semantiken skiljer sig**, se nedan.
- ~~`midas-select` saknas~~ — byggd, men **enkelval och flerval löstes olika**,
  se nedan. Det påverkar hur adaptern ska skrivas.

### Teckenräknaren räknar åt olika håll

| | Visaren idag | Midas |
| --- | --- | --- |
| Text | "N tecken kvar" / "N tecken över" | `12 / 100` |
| Tröskel | `near`-varning vid 10 % kvar | ingen |
| Utan max | antal tecken | antal tecken |
| Lokalisering | via `chrome()` | ingen text att översätta |

Adaptern kan inte återskapa visarens formulering med Midas räknare. Det är ett
produktbeslut, inte ett tekniskt hinder: antingen accepteras Midas format som en
del av att anta designsystemet, eller så behåller den fälttypen
`plainFieldRenderer`.

Värt att bygga in i kontraktet oavsett: **låt metoderna i `FieldRenderer` vara
valfria** och låt visaren falla tillbaka på standardrenderaren när en saknas.
Då kan en adapter täcka det den vill och lämna resten.

### `midas-select`: enkelval och flerval löstes olika

Det här är det viktigaste att känna till innan adaptern skrivs.

**Enkelval är en äkta `<select>`.** React-versionen av Midas har ingen native
select alls — där är triggern en `<Button>` och listan en popover med listbox.
Web component-versionen gick medvetet en annan väg och använder en riktig
`<select>`. Tangentbord, typeahead, formulärdeltagande, tillgänglighet och
plattformens egna mobilväljare följer med gratis. Den stängda kontrollen ser ut
som Midas överallt; den öppna listan gör det där `appearance: base-select`
finns (Chrome 135+, Safari 27; Firefox renderar sin egen lista).

**Det gör `select`-adaptern nästan trivial.** Visaren renderar redan en native
`<select>` med `<option>`-barn. `<midas-select>` tar samma `<option>`-barn:

```ts
select: s => `
  <midas-select name="${esc(s.name)}" label="${esc(s.label)}"
    ${s.required ? 'is-required' : ''}>
    <option value="">${esc(s.placeholder ?? '')}</option>
    ${s.options.map(o =>
      `<option value="${esc(o.value)}"${o.value === s.value ? ' selected' : ''}>
         ${esc(o.label)}
       </option>`
    ).join('')}
  </midas-select>`
```

**Flerval är handbyggt och byter interaktionsmodell.** `<select multiple>` är
en rullande lista, inte en popover, så där fanns ingen native väg.
`selection-mode="multiple"` ger en knapp som öppnar en popover med kryssrutor,
och valen listas som avvisbara taggar under fältet.

Visarens `multiselect` är idag en `<select multiple size="N">`. Byter man till
Midas byter man alltså inte bara utseende utan hur kontrollen används. Det är en
produktfråga, inte en teknisk — men den bör vara besvarad innan bytet.

Markupen är densamma som för enkelval, plus två attribut:

```html
<midas-select name="grunder" label="Grunder" selection-mode="multiple"
              placeholder="Välj grunder">
  <option value="arbete">Arbete</option>
</midas-select>
```

`placeholder` bör alltid sättas på ett flerval — triggern visar den permanent
när taggarna tagit över, och läser då som "lägg till fler".

Ett tomt `<option value="">` filtreras bort i flervalsläge; det är enkelvalets
platshållare och har ingen mening när flera kan väljas.

**Värdet.** Flervalet lägger varje valt värde under fältets `name`, precis som
flera `<input type="checkbox">` med samma namn — `FormData.getAll(name)` ger
listan. Som attribut skrivs `value` kommaseparerat, som egenskap är det en
`string[]`.

**En avvikelse mot React värd att känna till:** uppströms visar flervalets
trigger räknaren "N valda". Web component-versionen visar i stället taggar under
fältet — det som uppströms kallas `showTags` — eftersom räknaren inte säger
*vad* som är valt. `show-tags="false"` ger tillbaka React-beteendet.

## Att tänka på

**Nästlade shadow-rötter.** `guide-preview` är själv en web component. Injicerar
den `<midas-radio-group>` i sin egen shadow-rot blir det shadow i shadow. Det
fungerar, och CSS custom properties ärver genom båda lagren. Men FlowWeavers
egna `--fw-*`-stilar når inte in i Midas-komponenterna — vilket är önskvärt här:
de ska se ut som Midas.

**Popovern fungerar i nästlad shadow-DOM — men av en icke-självklar anledning.**
Flervalets popover placeras med CSS anchor positioning, och `anchor-name` är
trädskopad: namnet slås upp i den stilmall som använder det, inte i elementets
eget träd. En regel skriven inuti en shadow-rot ser därför aldrig ett ankare
utanför den. `midas-popover` löser det genom att sätta ankaregenskaperna som
**inline-stil** från JavaScript. Det spelar ingen roll för visaren — trigger och
popover ligger båda i selectens egen shadow-rot — men det är värt att veta om
någon bygger vidare på `midas-popover` och undrar varför positioneringen inte
går att flytta in i en CSS-fil. Testet `e2e/anchor.mjs` i Midas-repot vaktar det.

**Tokenprefixen krockar inte.** `--fw-*` mot `--midas-*`. Båda kan ligga på
samma sida.

**Dubbelregistrering är redan hanterad.** Midas `define()` hoppar över ett
`customElements.define` som redan gjorts. Det spelar roll om en Sitevision-sida
laddar både FlowWeavers bundle och Midas globala bygge — annars hade det andra
anropet kastat.

**Storleken.** `@midas-ds/elements` har numera en ingång per komponent, så
adaptern kan importera `@midas-ds/elements/radio-group` i stället för hela
paketet. Knappen väger ~2,8 kB gzip inklusive basklassen, allt tillsammans
~7,7 kB. Visaren ligger på 33 kB gzip idag.

## Öppen fråga: FlowWeavers egen profil

Om visaren renderas med Midas ärver den Migrationsverkets profil, medan
FlowWeavers *egna* komponenter (editorn, verktygsfältet, dialogerna) fortsatt är
indigo. Två vägar:

1. Låt dem vara olika — editorn är ett verktyg, visaren är en publicerad tjänst.
2. Definiera om `--fw-*` i termer av `--midas-*`, till exempel
   `--fw-primary: var(--midas-button-background-primary-base)`. Då följer
   FlowWeavers egna komponenter med automatiskt, utan att någon av dem skrivs om.

**Familjen är kontraktet** (berättelse 140, Johan 29/9). Accenten är nio
tokens per tema, var och en ett eget värde, och ingenting räknas fram ur
`--fw-primary`. Mappas bara `--fw-primary` till Midas blir resultatet en
**partiell överskrivning**: fyllda knappar, länkar och kanter i
Migrationsverkets färg, men brickor, tonade ytor, hovring och fokusringen kvar
i indigo. Alternativ 2 betyder alltså alla nio, för ljust och mörkt läge var
för sig. Listan, vad varje token bär och ett fullständigt exempel för båda
lägena står i README, avsnittet *Tokens och tema* — det är värdens
dokumentation och bara där.

Finns ingen Midas-token för någon av de nio är det enklaste valet en **färdig
skala**: `applyPalette(palettes.hav)` ur visarens eller editorns ingång sätter
alla nio i båda lägena, kontrastprövade, och dessutom **nodfärgerna**, de fem
familjerna på arbetsytan, så att de hör ihop med accenten.

Alternativ 2 är billigt att prova och lätt att backa — det är en fil,
`src/viewer/styles/tokens.scss`.

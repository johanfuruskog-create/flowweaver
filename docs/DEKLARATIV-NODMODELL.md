# Deklarativ nodmodell (framtida)

Så här skulle en redaktör kunna bygga egna nodtyper — inklusive en flervalsnod —
**utan kod**. Det här är en design att planera från, inte en byggd funktion.

> Bakgrund: en tidig manuell nodtyps-editor byggdes och togs bort eftersom den
> bara klarade presentationsnoder. Den här texten beskriver vad som krävs för
> att göra det på riktigt. Se även [ARCHITECTURE.md](./ARCHITECTURE.md) och
> [JSON-KONTRAKT.md](./JSON-KONTRAKT.md).

## Var problemet sitter idag

En nodtyp är en `NodeTypeDefinition` (`src/viewer/types/node-types.ts`). Den beskriver
**strukturen** deklarativt — etikett, fält (`properties`), portar (`inputs` /
`getOutputs`). Men **beteendet** är kodat, spritt på fyra ställen som alla
`switch`:ar på `node.type`:

| Ställe | Fil | Vad den gör per typ |
| --- | --- | --- |
| Canvas-rendering | `flow-node.ts` | Ritar noden (idag generiskt via `display`). |
| Förhandsvisning | `guide-preview.ts` | `renderNode` → en `renderX`-metod per typ. |
| Traversering | `guide-traversal-engine.ts` | `answer` / `answerValue` validerar och för vidare per typ. |
| Säker vymodell | `step-view-model.ts` | `toStepViewModel` bygger en `kind` per typ. |

För att en **data-driven** nodtyp ska fungera fullt ut måste dessa fyra sluta
switcha på `node.type` och i stället **tolka en deklarativ spec**. Canvas-lagret
är redan nästan generiskt (det renderar `properties` med `display`); de tre andra
är det som saknas.

## Den deklarativa specen

Utöka den serialiserbara nodtyps-specen (den som sparas i guiden) med tre delar:
**fält**, **svarsmodell** och **flöde/portar**. Allt ren data.

```jsonc
{
  "type": "custom-intressen",
  "label": "Intressen",
  "icon": "☑",
  "fields": [ /* se Fälttyper */ ],
  "answer": { /* se Svarsmodell */ },
  "flow": { /* se Portar och flöde */ }
}
```

### Fälttyper (kontroller)

Kontrollsystemet finns redan (`PropertyControlType` i `node-types.ts`).
Deklarativa typer väljer ur en **säker delmängd** (inga formeldrivna kontroller):

| Kontroll | Renderas som | Lagrar |
| --- | --- | --- |
| `text` | textfält | sträng |
| `textarea` | flerradsfält | sträng |
| `number` | sifferfält | tal |
| `checkbox` | av/på | boolean |
| `select` | rullgardin (fasta val) | ett värde |
| `options` | redigerbar lista av alternativ | lista `{id,label,value}` |

Varje fält bär även `label`, valfri `description`, `localized` (översättbart),
och — nyckeln — **var det visas**:

- `role: "presentation"` → visas i noden och för medborgaren (rubrik, brödtext).
- `role: "config"` → styr bara beteendet (t.ex. `options`, min/max), visas bara
  i redigeringspanelen.

### Svarsmodell

Beskriver *om* och *hur* noden skriver en variabel — det som idag är kodat i
motorn:

```jsonc
"answer": {
  "variableField": "variableName",   // vilket fält som håller variabelnamnet
  "cardinality": "single" | "multi" | "none",
  "from": "someOptionsFieldId",       // för choice: vilket options-fält
  "validation": {                     // tolkas generiskt
    "required": true,
    "min": 1, "max": 3,               // antal val (multi) eller tal (number)
    "minLength": 0, "maxLength": 200  // text
  }
}
```

- `single` = ett värde (siffra, text, ett val).
- `multi` = flera värden (kryssrutor) — lagras sammanfogat, som flervalsnoden
  redan gör.
- `none` = noden skriver ingen variabel (ren informationsnod).

### Portar och flöde

Portar har redan typer (`PortValueType`: `flow | string | number | boolean`) och
`ConnectionPolicy` (`none | single | multiple`). Det som behöver deklareras är
**hur flödet grenar**:

```jsonc
"flow": { "kind": "linear" }                         // en ingång + en "continue"
"flow": { "kind": "branch", "byField": "options" }   // en utgång per alternativ
```

| Flöde | Portar | Motsvarar idag |
| --- | --- | --- |
| `linear` | 1 ingång, 1 `continue`-utgång | siffra, text, flerval, sida |
| `branch` | 1 ingång, 1 utgång per alternativ (`id = option.id`) | enkelvalsfråga |

En generisk `getOutputs` läser `flow` och genererar portarna — precis som
enkelvalsnoden idag mappar sina alternativ till utgångar.

## Generisk rendering

Ett renderingssteg per yta, som tolkar specen i stället för att känna till typen:

- **Canvas** (`flow-node.ts`): ritar redan `properties` med `display`. Behöver
  bara respektera `role: "presentation"`. Nästan klart.
- **Förhandsvisning** (`guide-preview.ts`): en `renderDeclarative(node, spec)`
  som går igenom presentationsfälten och ritar rätt kontroll (text→`<input>`,
  `options` + `cardinality:multi` → kryssrutor, `single` → radioknappar), plus
  en Nästa-knapp. Ersätter behovet av en `renderX` per typ.
- **Säker runtime** (`step-view-model.ts`): en generisk `kind: "declarative"`
  med fälten och svarsmodellen, så BFF:en kan rendera formelfritt.

## Generisk traversering

Motorn får **en** väg för deklarativa noder i stället för en gren per typ:

1. Läs `answer.validation` och validera värdet/antalet generiskt (samma regler
   som idag: required, min/max, längder).
2. Skriv variabeln enligt `cardinality`.
3. Följ flödet: `linear` → `continue`-porten; `branch` → porten för det valda
   alternativet.

Flervalsnoden (`multi-choice`) är mallen: den validerar min/max och för vidare
via `continue`. Den logiken generaliseras till att läsas ur specen.

## Säkerhet, förmågor och versionering

- **Säkerhet:** bara den vitlistade delmängden av kontroller; inga formler eller
  godtycklig logik i redaktörsdefinierade typer. Känslig beräkning stannar i
  kodade nodtyper / BFF:en (se [RUNTIME-SECURITY.md](./RUNTIME-SECURITY.md)).
- **Förmågor:** deklarativa typer respekterar `requiredCapability` som övriga.
- **Versionering:** specen sparas i `settings` (additivt, bakåtkompatibelt). När
  fältformatet ändras: höj grafversionen och lägg en migrering
  (`graph-migrations.ts`), precis som för allt annat i kontraktet.

## Föreslagen ordning

1. **Presentationsnoder** — text-/textareafält, `linear`, `answer: none/single`.
   (Ungefär det som fanns, men med generisk förhandsvisning.)
2. **Val med regler** — lägg `options` + `cardinality: multi` + `min/max`. Nu kan
   en redaktör bygga en **flervalsnod** själv.
3. **Förgrening** — `flow: branch` för egna enkelvalsnoder.
4. **Runtime** — generisk `kind` i vymodellen så deklarativa noder körs i BFF:en.

Varje steg är litet och testbart; det som gör det möjligt är att flytta de fyra
`node.type`-switcharna till att tolka specen.

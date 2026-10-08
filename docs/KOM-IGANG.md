# Kom igång med FlowWeaver

En guide för dig som ska **bygga guider** i FlowWeaver — ingen kod behövs. Du
drar ihop frågor, regler och resultat på en arbetsyta, förhandsgranskar flödet
och exporterar en färdig guide som JSON.

> Är du utvecklare eller ska koppla in guiden i en tjänst? Se
> [JSON-KONTRAKT.md](./JSON-KONTRAKT.md) för dataformatet.

## Öppna editorn

Exempelsamlingen (`index.html`) länkar till flera editor-profiler:

| Profil | Passar för |
| --- | --- |
| **Standard** | Vanliga guider med frågor, regler och resultat. |
| **Basic** | Enklast möjliga — en avskalad yta att lära sig på. |
| **Advanced** | Variabler, uträkningar och all fältvalidering. |
| **Service** | Framtida e-tjänstefunktioner, t.ex. tjänsteanrop. |
| **Page Builder** | Sidor där flera fält besvaras samtidigt. |

Ditt arbete **autosparas lokalt i webbläsaren**, så du kan stänga fliken och
fortsätta senare. Vill du dela eller versionshantera guiden — exportera den som
JSON (se nedan).

## Grundbegrepp

- **Nod** — ett steg i guiden (en fråga, en regel, ett resultat …).
- **Port** — anslutningspunkten på en nod. En **ingång** tar emot flödet, en
  **utgång** skickar det vidare.
- **Koppling** — linjen mellan en utgång och en ingång. Den bestämmer vägen
  medborgaren tar.
- **Startnod** — noden guiden börjar i.
- **Variabel** — ett svar du sparar (t.ex. `age`) för att kunna räkna eller
  fatta beslut på det senare. Variabelnamnet är en identitet — översätt det
  aldrig, till skillnad från texten medborgaren ser.

## Nodtyperna

**Frågor** – ett svar i taget:

| Nod | Vad den gör |
| --- | --- |
| **Fråga** | Flervalsfråga. Varje alternativ blir en egen utgång att gå vidare från. |
| **Sifferfråga** | Tar ett tal, med valfritt min/max/steg och enhet. |
| **Textfråga** | Tar fritext, med valfri obligatorisk-flagga och längdgränser. |

**Sidor** – flera fält på samma sida (Page Builder):

| Nod | Vad den gör |
| --- | --- |
| **Sida** | En sida med upp till två fält som besvaras tillsammans. |
| **Text** | En rubrik, en text, eller båda — med `{{variabler}}` som fylls i medan besökaren svarar. |
| **Blank rad** | Ett mellanrum för att gruppera fält. |

**Logik** – räkna och styra vägen:

| Nod | Vad den gör |
| --- | --- |
| **Regel** | Väljer väg utifrån villkor på variabler (t.ex. `age ≥ 18`). Varje regel-utfall blir en utgång, plus en *Annars*-utgång. |
| **Uträkning** | Sätter variabler från formler (t.ex. `avgift = pris * 0,15`). |
| **Tjänsteanrop** | Hämtar data från ett verksamhets-API och lägger svaret i variabler. |

**Avslut** – guidens slut:

| Nod | Vad den gör |
| --- | --- |
| **Resultat** | Visar ett slutbesked för medborgaren. |
| **E-postresultat** | Producerar ett formatterat e-postunderlag (skickas inte härifrån). |

## Bygg din första guide

1. **Lägg till en fråga.** Klicka på frågans ikon i paletten till vänster. Noden
   dyker upp på arbetsytan och markeras.
2. **Fyll i den.** I egenskapspanelen till höger sätter du rubrik, och (i
   Advanced) vilket variabelnamn svaret sparas som.
3. **Peka ut startnoden.** Markera en nod och välj **Gör till startnod** i dess
   meny. **Guide → Visa startnod** hoppar tillbaka dit när du tappat bort den.
4. **Lägg till ett resultat** (eller en regel + flera resultat) på samma sätt.
5. **Koppla ihop.** Dra från en frågas utgång till nästa nods ingång. Släpp nära
   ingången så snäpper kopplingen fast.
6. **Förhandsgranska.** Fliken **Förhandsgranskning** kör guiden steg för steg så
   du ser varje väg innan du publicerar.
7. **Exportera** när du är nöjd (**Arkiv → Exportera JSON**).

## Nodmallar – återanvänd frågor och resultat

En **nodmall** är en egen, namngiven nodtyp som du kan placera flera gånger.
Den är till för att **återanvända** en fråga eller ett resultat — definiera den
en gång och slipp konfigurera samma sak om och om igen.

> Behöver du bara en enstaka nod? Använd en inbyggd nod och fyll i den. Mallar
> lönar sig när samma mönster återkommer, eller när flera redaktörer ska bygga
> enhetligt.

**Så skapar du en mall:** konfigurera en nod som du vill ha den (t.ex. en
flervalsfråga med alla alternativ ifyllda), öppna nodens meny och välj **Spara
som mall**. Mallen får nodens innehåll som utgångsläge — döp den och spara.

Dina mallar dyker upp i palettens **"Mallar"-grupp** och beter sig som vilken
nod som helst — de renderas, validerar (obligatoriskt/min/max) och grenar
precis som de inbyggda. Under **Guide → Nodmallar…** ser du guidens mallar och
kan ta bort dem.

Bara presentations- och inmatningsnoder kan bli mallar. **Regel, uträkning och
tjänsteanrop** är logik och stannar som inbyggda noder (känslig logik lämnar
aldrig servern).

Mallar sparas i den aktuella guiden (följer med export/import).

## Tangentbord och tillgänglighet

Editorn är byggd för tangentbord och skärmläsare.

| Åtgärd | Så gör du |
| --- | --- |
| Lägg till en nod | Tabba till palettens knapp, tryck **Enter**. |
| Flytta fokus mellan noder | **Tabb** / **Skift+Tabb**. |
| Markera en fokuserad nod | **Enter** eller **Mellanslag** (egenskapspanelen följer med). |
| Flytta en markerad nod | **Piltangenter** (håll **Skift** för större steg). |
| Ändra ordning på fält i en sida | Upp/ner-knapparna i egenskapspanelen. |
| Ångra / Gör om | **Ctrl+Z** / **Ctrl+Skift+Z** (eller **Ctrl+Y**). |

Guiderna är byggda mot kraven i DOS-lagen och EN 301 549 — tangentbord,
skärmläsare och synlig fokusindikering genomgående.

## Spara, exportera, importera

- **Autospar** sköts åt dig lokalt i webbläsaren medan du arbetar.
- **Exportera** (**Arkiv → Exportera JSON**) laddar ner guiden som en fil. Bra
  för säkerhetskopiering, granskning och versionshantering i t.ex. Git.
- **Importera** (**Arkiv → Importera JSON**) läser tillbaka en fil. Äldre filer
  uppdateras automatiskt till nuvarande format vid import.
- **Återställ exempelguide** (**Arkiv**) nollställer till utgångsläget.

## Flera språk

Guiden kan erbjudas på flera språk. Språkväljaren i verktygsfältet byter
redigeringsspråk, och en indikator visar hur stor andel som är översatt.
Översätt bara det medborgaren ser (rubriker, alternativtexter, beskrivningar) —
variabelnamn och alternativens värden är identiteter och lämnas orörda.

## Tips

- Ge **variabler tydliga namn** (`age`, inte `x`) — de dyker upp i regler och
  uträkningar.
- **Förhandsgranska ofta.** Route-analysen visar varje väg medborgaren kan ta.
- **Exportera vid milstolpar** så du har en historik även utanför webbläsaren.

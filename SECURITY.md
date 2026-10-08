# Säkerhet

Det här dokumentet beskriver FlowWeavers säkerhetsmodell, vilka standarder
vi följer, och statusen på den senaste säkerhetsgranskningen. Det är tänkt
att kunna läsas av en säkerhetsavdelning.

## Standarder vi följer

- **OWASP ASVS (Application Security Verification Standard)** – vår
  verifieringschecklista.
  - **Nivå 1 (L1)** är baslinjen för designverktyget och demosidorna (den
    statiska webbappen på GitHub Pages).
  - **Nivå 2 (L2)** är målnivån för en publicerad e-tjänst som hanterar
    personuppgifter (t.ex. bolån), och nås i BFF-/driftlagret.
- **OWASP Top 10** – riskramverket vi klassar fynd mot.
- **OWASP Cheat Sheets** – konkret vägledning för renderingskoden
  (*XSS Prevention*, *DOM-based XSS Prevention*).
- **Content-Security-Policy** – teknisk kontroll (injiceras i bygget).
- **GDPR / dataminimering** – stöds arkitektoniskt av server-side-körningen
  (se `docs/RUNTIME-SECURITY.md`).

## Tillitsgränser

- **Grafens JSON är opålitlig indata.** En guide kan importeras från fil
  (`graph-io.ts`). All import valideras strukturellt och id/typer begränsas
  till ofarliga tecken innan de används.
- **Slutanvändarens svar är opålitlig indata.** De löses in i mallar och
  renderas – alltid escapeade (se nedan).
- **Endpoints i tjänste-noder är opålitlig konfiguration**, inte fria
  URL:er. Live-anropet allowlistar.
- **Känslig logik körs server-side.** I en publicerad e-tjänst körs motorn
  i BFF:en; klienten får bara formelfria vymodeller. Formler, regelvillkor
  och mellanvariabler lämnar aldrig servern. Se `docs/RUNTIME-SECURITY.md`.

## Senaste granskning – fynd och status

| # | Fynd | Allvar | Top 10 | ASVS | Status |
|---|------|--------|--------|------|--------|
| 1 | Stored XSS via oescapeat nod-id i kontextmenyn | HIGH | A03 | V5.3 | **Åtgärdat** – escaping vid sinken + teckenbegränsning vid import |
| 2 | SSRF i tjänste-nodens `runLive` (oallowlistad endpoint) | MEDIUM | A10 | V12.6 | **Åtgärdat** – bara relativa eller allowlistade https-värdar |
| 3 | Ingen Content-Security-Policy | MEDIUM | A05 | V14.4 | **Åtgärdat** – CSP injiceras i bygget |
| 4 | `graph-io` begränsade inte id-/typtecken | LOW | A03 | V5.1 | **Åtgärdat** – `^[A-Za-z0-9_-]+$` vid import |

Alla fyra är åtgärdade och täckta av regressionstester. De två med egen
exploaterbar väg (1 och 2) är dessutom mutationsverifierade.

## Kontroller på plats (mappade mot ASVS)

- **V5 – Validering, sanering, kodning.** All HTML byggs via escaping.
  `FormattedTextService` escapear hela mallen först och applicerar
  markdown på redan escapead text; länkar har en scheme-allowlist
  (`https:`/`mailto:`), och variabelvärden escapeas vid insättning.
  `guide-preview`, `flow-node` och `properties-panel` escapear varje
  interpolerat värde.
- **V5.1 – Indatavalidering.** `graph-io` validerar struktur och begränsar
  id/typer vid importgränsen.
- **V12.6 – SSRF-skydd.** `ServiceCallService.runLive` allowlistar
  endpoints.
- **V14.4 – Säkerhetsrubriker.** CSP i bygget (`script-src 'self'`,
  `object-src 'none'`, `base-uri 'none'`).
- **V1 – Arkitektur / dataminimering.** Server-side-körning skickar bara
  vymodeller; känslig logik stannar i BFF:en.
- **Ingen kodexekvering.** Formeltolkaren (`formula-evaluator.ts`) är en
  egen rekursiv parser – inget `eval`/`new Function` finns i kodbasen.

## Verifierat säkert i granskningen

- `FormattedTextService` – korrekt escaping + länk-allowlist. Ingen XSS via
  nodtext eller svar.
- `guide-preview`, `flow-node`, `properties-panel` – alla interpolationer
  escapeade.
- `formula-evaluator` – ingen `eval`; variabeluppslag avvisar icke-tal, så
  `__proto__`/`constructor` ger fel i stället för exekvering.
- `getByPath` i tjänste-noden – läsande, ingen prototype pollution;
  `JSON.parse`/`structuredClone` förorenar inte prototypkedjan.
- `local-storage-graph-store` – lagrar bara guide-innehåll (inga
  hemligheter); läsning valideras om via importvägen.
- Inga farliga sinkar: inget `document.write`, `setTimeout(sträng)` eller
  liknande. Exporten laddar ner via `blob:`-URL.

## Kända begränsningar och nästa steg (Fas 5 / e-tjänst)

- **`frame-ancestors` / clickjacking-skydd** kräver en HTTP-rubrik och kan
  inte sättas via `<meta>` på GitHub Pages. Sätts i BFF:en/värden
  (`Content-Security-Policy: frame-ancestors` eller `X-Frame-Options`).
- **BFF:en måste tillföra L2-kontroller** som inte hör hemma i en statisk
  demo: autentisering och sessionshantering, en egen endpoint-allowlist
  för tjänste-noden, rate limiting, och `Content-Type`/svarsstorleks-
  kontroll på svaren.
- **Riktiga tjänsteanrop** ska gå via en egen proxy-endpoint; API-nycklar
  bor i BFF:en, aldrig i grafen eller klienten.

## Rapportera en sårbarhet

Öppna inte ett publikt issue för säkerhetsproblem. Kontakta ägaren av
repot direkt.

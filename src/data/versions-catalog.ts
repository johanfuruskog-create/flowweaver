/**
 * What FlowWeaver and FlowWeaver PRO contain — the one source for the
 * comparison on `/pro/` (Johan 6/10: "ställ upp vad de olika versionerna
 * stödjer", then "/pro där ligger allt om PRO"). Read out of the registries
 * and the entries after open-core step 4; `docs/VERSIONER.md` says why the
 * line runs where it does and points here.
 */
import type { SiteText } from "./example-catalog";

export interface VersionRow {
  area: SiteText;
  content: SiteText;
}

/** In both versions. */
export const SHARED_ROWS: VersionRow[] = [
  { area: { sv: "Frågor", en: "Questions" }, content: { sv: "Enval, flerval, tal, datum, sökfält med förslag, sökfält med flera val, plats på karta", en: "Single choice, multiple choice, number, date, lookup, multi-lookup, place on a map" } },
  { area: { sv: "Innehåll", en: "Content" }, content: { sv: "Bild, annoterad bild, kod, anteckning", en: "Image, annotated image, code, note" } },
  { area: { sv: "Logik", en: "Logic" }, content: { sv: "Regler med flera villkor, uträkningar med formler, ruttanalys", en: "Multi-condition rules, formula calculations, route analysis" } },
  { area: { sv: "Sidor", en: "Pages" }, content: { sv: "Sida med flera fält, rubrik, avstånd, upprepade sidor", en: "Multi-field pages, headings, spacing, repeated pages" } },
  { area: { sv: "Integration", en: "Integration" }, content: { sv: "Tjänsteanrop mot värdens backend, uppslag, kartleverantör, filkontrakt", en: "Service calls to the host's backend, lookups, map provider, file contract" } },
  { area: { sv: "Avslut", en: "Endings" }, content: { sv: "Resultat", en: "Result" } },
  { area: { sv: "Redaktören", en: "The editor" }, content: { sv: "Palett, egenskapspanel, förhandsvisning, hälsokontroll, historik, import och export, mallar, versioner och publicering, översättningsläge, moduler och nivåer", en: "Palette, properties panel, preview, health check, history, import and export, templates, versions and publishing, translation mode, modules and levels" } },
  { area: { sv: "Besökaren", en: "The visitor" }, content: { sv: "Visaren med förlopp, navigering, språkpaket, färgskalor, tema", en: "The viewer with progress, navigation, locale packs, colour scales, theme" } },
  { area: { sv: "Kontrakt", en: "Contracts" }, content: { sv: "Filformatet, lagring, uppslag, karta, händelser, fil, schematypen för inlämning", en: "The file format, storage, lookup, map, events, file, the submission schema type" } },
  { area: { sv: "Server", en: "Server" }, content: { sv: "Serversidesexperimentet med stegmodell", en: "The server-side experiment with a step model" } },
];

/** FlowWeaver PRO only. */
export const PRO_ROWS: VersionRow[] = [
  { area: { sv: "Noder", en: "Nodes" }, content: { sv: "Inlämning, E-postresultat", en: "Submission, Email result" } },
  /* Johan 8/10: the fields that only mean something when answers are sent. */
  { area: { sv: "Fält för inlämning", en: "Fields for submitting" }, content: { sv: "Fritext, betyg, samtycke, bifoga fil, granska före inlämning, mallarna e-post, telefon och personnummer", en: "Free text, rating, consent, attach a file, review before submitting, the e-mail, phone and personal ID templates" } },
  { area: { sv: "Mottagarkontraktet", en: "The receiver contract" }, content: { sv: "Värden registrerar en mottagare med katalog, kvitto och återförsöksfönster. Adresser finns aldrig i guiden, bara id och namn", en: "The host registers a receiver with a catalog, a receipt and a retry window. Addresses are never in the guide, only ids and names" } },
  { area: { sv: "Inlämningen", en: "The submission" }, content: { sv: "Strukturerade svar, raden i mottagarens lista, robotskydd, samma id vid återförsök, mejlkopia till besökaren", en: "Structured answers, the row in the receiver's list, robot protection, the same id on retry, an e-mail copy to the visitor" } },
  { area: { sv: "Schemat", en: "The schema" }, content: { sv: "Räknas fram ur guiden och stämplas vid export. Exportera schema i Arkiv-menyn", en: "Derived from the guide and stamped at export. Export schema in the File menu" } },
  { area: { sv: "E-postresultat", en: "Email result" }, content: { sv: "Mottagare ur katalogen eller besökarens egen adress, ämne och brödtext med svar, utdatadialog i editorn", en: "A recipient from the catalog or the visitor's own address, subject and body with answers, an output dialog in the editor" } },
  { area: { sv: "Hälsoregler", en: "Health rules" }, content: { sv: "Saknad eller borttagen mottagare, kopia utan ägare, trasig mejlkopia, inlämning utan granskning, föråldrat schema", en: "Missing or removed recipient, a copy without an owner, a broken e-mail copy, submission without review, a stale schema" } },
  { area: { sv: "Canvas och panel", en: "Canvas and panel" }, content: { sv: "Skickas till på kortet, mottagarväljaren, radeditorn, ärendetyp ur kodlista, mottagarinspektören", en: "Sent to on the card, the recipient picker, the row editor, case type from a code list, the recipient inspector" } },
  { area: { sv: "Kapaciteter", en: "Capabilities" }, content: { sv: "submission och emailResults, modulen submission", en: "submission and emailResults, the submission module" } },
  { area: { sv: "Server", en: "Server" }, content: { sv: "E-postresultatets stegkropp i serverexperimentet", en: "The email result's step body in the server experiment" } },
  { area: { sv: "Utanför biblioteket", en: "Beyond the library" }, content: { sv: "Referensmottagaren, Sitevision-modulen, identitetskontraktet som skiss", en: "The reference receiver, the Sitevision module, the identity contract as a sketch" } },
];

/** How a PRO guide behaves in the open version — the sentence under the tables. */
export const OPEN_MEETS_PRO: SiteText = {
  sv: "En guide byggd med PRO öppnar ändå i det öppna FlowWeaver: visaren ritar inlämningen som ett resultat och skickar inget, och fälten för inlämning visas som vanligt. Editorn bevarar noderna men erbjuder dem inte för nya. Filformatet är detsamma.",
  en: "A guide built with PRO still opens in the open FlowWeaver: the viewer draws the submission as a result and sends nothing, and the fields for submitting show as usual. The editor keeps the nodes but does not offer them for new ones. The file format is the same.",
};

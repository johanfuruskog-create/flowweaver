/**
 * The formats built in — Swedish, because the tool is.
 *
 * The same shape as `default-node-types.ts`: a file that registers what ships,
 * with no more standing than a pack a host adds. Norwegian and Danish are not
 * here for the reason Johan put plainly — not everyone needs them, and a format
 * nobody uses is a line in a select that makes every other line harder to find.
 *
 * ## Why the century is decided here and not by the reader
 *
 * `560328` is 1956 for anybody alive and 2056 for a child born this century. A
 * canonical form that leaves it open is two systems disagreeing about one
 * person, so the rule Skatteverket uses for a `-` separator is applied once, on
 * the way in.
 */
import {
  isEmail,
  isOrganisationsnummer,
  isPersonnummer,
  isPhone,
  isPostnummer,
} from "./format-checks";
import { registerFormat } from "./format-registry";

/** Digits only, keeping nothing a person typed for legibility. */
const digitsOf = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  return digits.length > 0 ? digits : value.trim();
};

registerFormat("email", {
  label: { sv: "E-post", en: "Email" },
  // Ingen inputMode: fältet renderas type="email", som redan ger @-bordet —
  // en hint till hade dubblerat (guide-preview-keyboard-shape vaktar det).
  autocomplete: "email",
  validate: (value) => (isEmail(value) ? null : "validation.format.email"),
});

registerFormat("phone", {
  /*
   * No pattern and no canonical form. A phone number has neither without a
   * country code, and imposing one would rewrite a number somebody can dial.
   */
  label: { sv: "Telefon", en: "Phone" },
  inputMode: "tel",
  autocomplete: "tel",
  validate: (value) => (isPhone(value) ? null : "validation.format.phone"),
});

registerFormat("personnummer", {
  // "Personal ID no.", the form abbreviation, not Skatteverket's full
  // "personal identity number": the label is a chip on a field card, and on a
  // third-width field the full phrase needed 196 px of the 118 there were
  // (Johan 3/9: "vad man brukar skriva"). The node template keeps the longer
  // "Personal ID number" — a palette entry has the room.
  label: { sv: "Personnummer", en: "Personal ID no." },
  pattern: "########-####",
  canonical: (value) => {
    const digits = value.replace(/\D/g, "");

    if (digits.length === 12) return digits;
    if (digits.length === 10) {
      const year = Number(digits.slice(0, 2));
      const now = new Date().getFullYear() % 100;

      return `${year > now ? "19" : "20"}${digits}`;
    }

    return value.trim();
  },
  validate: (value) => (isPersonnummer(value) ? null : "validation.format.personnummer"),
});

registerFormat("organisationsnummer", {
  label: { sv: "Organisationsnummer", en: "Organisation number" },
  pattern: "######-####",
  canonical: digitsOf,
  validate: (value) =>
    isOrganisationsnummer(value) ? null : "validation.format.organisationsnummer",
});

registerFormat("postnummer", {
  label: { sv: "Postnummer", en: "Postal code" },
  autocomplete: "postal-code",
  pattern: "### ##",
  canonical: digitsOf,
  validate: (value) => (isPostnummer(value) ? null : "validation.format.postnummer"),
});

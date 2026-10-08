/**
 * Format validation for text answers. Named validators (email, phone,
 * personnummer) plus a free regex pattern. Empty values pass here — "required"
 * is handled separately, so the format applies only to filled-in answers.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function isPhone(value: string): boolean {
  if (!/^[+\d\s\-()]+$/.test(value.trim())) {
    return false;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Luhn check over ten digits (Swedish personal identity number). */
function luhnValid(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    let digit = Number(digits[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Whether the six leading digits are a day that happened.
 *
 * `YYMMDD`, with the day allowed to carry **sixty** — that is a
 * samordningsnummer, which is what somebody has who does not have a personal
 * number: newly arrived, or working here without being registered. Refusing it
 * is not strictness; it is a form that turns away exactly the people it was most
 * likely written for.
 *
 * The century is unknown from six digits, so February the 29th is judged against
 * a leap year. Refusing a real birthday is the worse of the two mistakes: a
 * wrongly accepted date is caught later by a human reading the number, and a
 * wrongly refused one is a person who cannot submit the form at all.
 */
function isBirthDate(sixDigits: string): boolean {
  const month = Number(sixDigits.slice(2, 4));
  const rawDay = Number(sixDigits.slice(4, 6));
  const day = rawDay > 60 ? rawDay - 60 : rawDay;

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  // 2000 was a leap year, so the 29th of February is allowed through.
  const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= lengths[month - 1]!;
}

export function isPersonnummer(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  // 12 digits = with century; drop the first two for Luhn over the last ten.
  const ten = digits.length === 12 ? digits.slice(2) : digits;

  if (ten.length !== 10 || !luhnValid(ten)) {
    return false;
  }

  /*
   * Luhn is content with ten zeros, and they are the first thing anybody types
   * to find out whether a field is checking at all.
   */
  if (/^0{10}$/.test(ten)) {
    return false;
  }

  /*
   * And the date, which the arithmetic never looked at. February the 31st was
   * refused before this only when its check digit happened not to add up —
   * `9902310003` does add up, and went straight through.
   */
  return isBirthDate(ten.slice(0, 6));
}

/** Five digits, with or without the space people write between them. */
export function isPostnummer(value: string): boolean {
  return /^\d{3}\s?\d{2}$/.test(value.trim());
}

/**
 * Ten digits with a valid check digit — the same standard as a personal number.
 *
 * The convention that the third digit is at least two, which is what separates
 * an organisation number from a personal one, is deliberately **not** enforced.
 * It would be a stronger check, and a wrong exclusion here is a form somebody
 * cannot submit — a worse failure than accepting a personal number in a field
 * labelled for organisations.
 */
export function isOrganisationsnummer(value: string): boolean {
  return luhnValid(value.replace(/\D/g, ""));
}



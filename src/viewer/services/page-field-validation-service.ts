import { validateDate } from "../core/date-validator";
import { validateFormat } from "../core/format-validators";
import { interpolate, uiText } from "../core/ui-strings";

import type { LocalizedText } from "../core/localized-text";
import type { PageField } from "./page-fields-service";

/**
 * Validates a page field's value and returns a readable message in the
 * resident's language, or null when the value is valid.
 *
 * The messages were hardcoded Swedish until 2026-08-03. They bypassed the whole
 * `uiText` chain, so an Arabic-reading resident met "Ange minst 3 tecken."
 * however well the guide was translated. See criterion 5 in story 010.
 *
 * They then had keys of their own — `field.minLength` beside
 * `validation.minLength` — which made a translator write the same rule twice in
 * every language. The rules are the same rules, so the keys are now the same
 * keys. Only `field.chooseOption` is still its own: see `viewer-strings.ts`.
 */
export class PageFieldValidationService {
  static getMessage(
    field: PageField,
    value: string,
    locale?: string,
    strings?: Record<string, LocalizedText>
  ): string | null {
    const text = (key: string, params?: Record<string, string | number>): string => {
      const template = uiText(key, strings, locale);
      return params ? interpolate(template, params) : template;
    };

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      if (!field.required) return null;
      /*
       * The message names the action, not the state. "Fältet är obligatoriskt"
       * in front of a single checkbox is true and useless; a consent is ticked,
       * a choice is chosen, and everything else is answered.
       */
      /*
       * A rating is chosen, like a choice: *Välj ett alternativ*, not
       * *Fältet är obligatoriskt*. Its way out — when the editor offers one —
       * is itself a choice and leaves the words behind, so an empty rating
       * here means nothing on the row was pressed.
       */
      return field.type === "choice" || field.type === "rating"
        ? text("validation.chooseOption")
        : field.type === "consent"
          ? text("validation.consent.required")
          : field.type === "file"
            ? text("validation.file.required")
            : text("validation.required");
    }

    if (field.type === "number") {
      const parsed = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(parsed)) {
        return text("validation.number.invalid");
      }
      // The unit lives in the guide's data and is the editor's text, not ours,
      // so it is interpolated in rather than given a key of its own.
      const unit = field.unit ? ` ${field.unit}` : "";
      if (field.min !== undefined && parsed < field.min) {
        return text("validation.number.min", { n: `${field.min}${unit}` });
      }
      if (field.max !== undefined && parsed > field.max) {
        return text("validation.number.max", { n: `${field.max}${unit}` });
      }
      return null;
    }

    /*
     * How many were chosen, counted as entries and not as characters.
     *
     * The value is newline-separated, so "sv\nen" is two answers. Blank entries
     * are dropped before counting — a half-finished edit leaves a trailing
     * newline behind, and a blank is not a choice.
     */
    if (field.multiple) {
      const chosen = trimmed
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");

      if (field.minSelected !== undefined && chosen.length < field.minSelected) {
        return field.minSelected === 1
          ? text("validation.selectAtLeastOne")
          : text("validation.selectAtLeast", { n: field.minSelected });
      }

      if (field.maxSelected !== undefined && chosen.length > field.maxSelected) {
        return text("validation.selectAtMost", { n: field.maxSelected });
      }
    }

    if (field.type === "date") {
      const dateError = validateDate(trimmed, field.minDate, field.maxDate, {
        earliest: field.minDateLabel,
        latest: field.maxDateLabel,
      });

      if (dateError) {
        return text(dateError.key, dateError.values);
      }
    }

    if (field.type === "text") {
      if (field.minLength !== undefined && trimmed.length < field.minLength) {
        return text("validation.minLength", { n: field.minLength });
      }
      if (field.maxLength !== undefined && trimmed.length > field.maxLength) {
        return text("validation.maxLength", { n: field.maxLength });
      }

      /*
       * The format, last, because length is the cheaper answer: telling somebody
       * their postcode is the wrong length is more useful than telling them it
       * is the wrong shape.
       *
       * This was missing entirely. A `text-question` standing on its own had its
       * format enforced by the engine; the same field dragged onto a page did
       * not, and nothing said so — the setting stayed in the editor and an
       * invalid personal number went through. A page is what a form is, so this
       * was the case that mattered.
       */
      const formatError = validateFormat(field.format, field.pattern, trimmed);

      if (formatError) {
        return text(formatError);
      }
    }

    return null;
  }
}

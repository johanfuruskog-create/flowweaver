/**
 * The rule for a choice that stands alone, in one place.
 *
 * ## Why it is here and not in the control
 *
 * Two surfaces render a multiple answer and neither can borrow the other's
 * code: `chip-picker` is a custom element with its own shadow root and a list
 * of pairs, while the viewer's checkboxes are markup with `<input>` elements
 * carrying the state. What they share is not a control — it is the *rule*,
 * and a rule written twice is this codebase's oldest failure: two copies of
 * one answer, and one of them stops being updated.
 *
 * So the shape here is deliberately the rule and nothing else. It knows
 * nothing about chips, boxes, labels or the DOM; the caller says what is held
 * and how to tell an exclusive one, and gets back what has to go.
 *
 * ## What the rule is
 *
 * Exclusive means **alone**, not "alone among the ordinary". Choosing the
 * exclusive one displaces everything; choosing an ordinary one displaces the
 * exclusive; and two exclusive options turn each other out as well — the case
 * Skatteverket's list actually has, where `XS` stateless and `XO` unknown
 * country are both answers that admit no second one.
 *
 * Replacing and not blocking: every press does something. The variant where
 * the exclusive option simply refuses to be picked was weighed and thrown out
 * in `docs/STORIES/062-ett-val-som-utesluter-de-andra.md` — a control that
 * refuses without saying why is a dead end, and on a tablet a dead button
 * reads as a bug.
 */

/** What has to go for a choice to be held, and which side carried the rule. */
export interface Displaced<T> {
  /** The held choices that cannot stay. Empty when nothing conflicts. */
  gone: T[];
  /**
   * True when the exclusivity belonged to the ones leaving, false when it
   * belonged to the one just chosen.
   *
   * The announcement needs it: naming the wrong side teaches the rule
   * backwards — *"Danmark cannot be combined with other choices"* is false
   * about Danmark and would leave the visitor unable to predict the next
   * press.
   */
  theirs: boolean;
}

/**
 * @param held What is chosen right now, without the one being added.
 * @param pickedStandsAlone Whether the choice being added is the exclusive one.
 * @param standsAlone Whether a held choice is an exclusive one.
 */
export function displacedBy<T>(
  held: readonly T[],
  pickedStandsAlone: boolean,
  standsAlone: (one: T) => boolean,
): Displaced<T> {
  return {
    gone: held.filter((one) => pickedStandsAlone || standsAlone(one)),
    theirs: !pickedStandsAlone,
  };
}

/**
 * The link picker a host registers — story 100.
 *
 * The editor's link button writes `[text](https://)` and leaves the editor
 * to paste an address. In the host's own system the editor *chooses a page*
 * in a dialog; here they copy its address by hand — every link in the three
 * guides imported from a real agency was written that way. So, the same
 * pattern as the map and the submission receiver: the host registers a
 * picker, the library carries the contract and knows nothing of what the
 * dialog is. No picker registered: exactly as before.
 *
 * ## What is stored: the address for the world, the reference for the host
 *
 * A moved page is the commonest way a guide rots, so the picker may hand
 * back a `ref` — the host's own id for the page — and the link is written
 * `[text](address "ref")`, in markdown's title slot. The viewer renders the
 * address and never the reference; outside the host the reference is text
 * that travels along and nothing breaks for its absence. Inside the host,
 * `resolve` is asked for every reference when a guide is opened in the
 * editor (`guide-editor`): a changed address is rewritten, a page that is
 * gone becomes a health warning. The library still fetches nothing — the
 * host knows where its pages are, and the host answers.
 */

export interface LinkPickContext {
  /** The language of the text being edited. */
  locale: string;
  /** What the editor had selected when the button was pressed; "" for nothing. */
  selectedText: string;
}

export interface LinkPickResult {
  /** The address the viewer renders. Relative is fine — and preferred. */
  url: string;
  /** The page's own title, used as the link text when nothing was selected. */
  label?: string;
  /** The host's reference for the page, kept so the link survives a move. */
  ref?: string;
}

export interface LinkPicker {
  /** Opens the host's dialog. `null` means the editor cancelled; nothing is inserted. */
  pick(context: LinkPickContext): Promise<LinkPickResult | null>;
  /**
   * Today's address for a reference, or `null` when the page no longer
   * exists. Optional: a host without it gets the picker and not the upkeep.
   */
  resolve?(ref: string): Promise<{ url: string } | null>;
}

let picker: LinkPicker | null = null;

/** What `resolve` answered, by reference — so the health check can read it synchronously. */
let resolved = new Map<string, { url: string } | null>();

export function registerLinkPicker(value: LinkPicker): void {
  picker = value;
  resolved = new Map();
}

export function unregisterLinkPicker(): void {
  picker = null;
  resolved = new Map();
}

export function getLinkPicker(): LinkPicker | null {
  return picker;
}

/**
 * Asks the host about a reference and remembers the answer. A host that
 * throws is treated as not having answered — a network fault is not a
 * missing page, and a warning that says "gone" must mean gone.
 */
export async function resolveLinkReference(ref: string): Promise<{ url: string } | null | undefined> {
  if (!picker?.resolve) {
    return undefined;
  }

  try {
    const answer = await picker.resolve(ref);
    const cleaned = answer && typeof answer.url === "string" ? { url: answer.url } : null;

    resolved.set(ref, cleaned);
    return cleaned;
  } catch {
    return undefined;
  }
}

/** True when the host has said the page behind `ref` no longer exists. */
export function isLinkReferenceDead(ref: string): boolean {
  return resolved.has(ref) && resolved.get(ref) === null;
}

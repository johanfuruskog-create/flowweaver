/**
 * What a host may depend on, derived rather than remembered.
 *
 * ## Why
 *
 * The guide's *format* is guarded: raise CURRENT_GRAPH_VERSION without adding a
 * migration and a test fails. The package's **surface** has no such guard, and
 * we have already broken it silently — `data-theme` became `data-fw-theme` in
 * v0.2.1, which is a breaking change for every host that had set the attribute,
 * and it appeared nowhere. See story 013.
 *
 * A test cannot know what a host depends on. But it can know what we *offer*,
 * and freeze it: then a rename is a red build rather than a support case.
 *
 * ## What counts as the surface
 *
 * Only what a host can reach without reading our source:
 *
 * - the custom element tag names,
 * - the attributes those elements observe,
 * - their public properties and methods,
 * - the events they dispatch across the shadow boundary,
 * - what the package entries export.
 *
 * ## What deliberately does not
 *
 * Naming these is as important as naming the surface, because without the list
 * an integrator assumes everything reachable is a promise:
 *
 * - **CSS class names inside the shadow root.** They are reachable through
 *   `::part`-less traversal in devtools and change with any layout work.
 * - **The internal DOM structure.** Which element wraps which.
 * - **`data-*` attributes we use for our own wiring** — `data-property`,
 *   `data-locale-select` and the rest. The tests read them, and the tests are
 *   ours.
 * - **File names inside the bundle.** The manifest's subpaths are the contract;
 *   what they resolve to is not.
 * - **The design tokens' values.** Their *names* are the contract (story 012);
 *   a colour is expected to change.
 */

/** One element's offer to the host. */
export interface ElementSurface {
  tag: string;
  attributes: string[];
  /** Public getters, setters and methods on the prototype, sorted. */
  members: string[];
}

/** The whole package's offer. */
export interface PublicSurface {
  elements: ElementSurface[];
  /** Event names that cross the shadow boundary, sorted and deduplicated. */
  events: string[];
  /** Named exports from the distribution entries, per entry. */
  exports: Record<string, string[]>;
}

/**
 * Members we never promise: the platform's own, and anything underscored.
 *
 * `connectedCallback` and friends are the browser's contract with the element,
 * not ours with the host — a host that calls them by hand is doing something we
 * never offered.
 */
const LIFECYCLE = new Set([
  "constructor",
  "connectedCallback",
  "disconnectedCallback",
  "adoptedCallback",
  "attributeChangedCallback",
]);

/**
 * The public members of a custom element class, sorted for a stable diff.
 *
 * TypeScript's `private` is erased, so the prototype carries every internal
 * method too. Freezing those would make the snapshot fail on any refactor, and
 * a snapshot that cries wolf gets updated without reading — which is worse than
 * not having one. See story 016 on noise.
 *
 * So the modifiers are read back from the source: a member is ours to promise
 * only if it was not written `private`.
 */
export function membersOf(
  elementClass: CustomElementConstructor,
  source: string
): string[] {
  const privateNames = new Set<string>();
  for (const match of source.matchAll(
    /^\s*private\s+(?:readonly\s+)?(?:static\s+)?(?:get\s+|set\s+|async\s+)?([A-Za-z_$][\w$]*)/gm
  )) {
    privateNames.add(match[1]);
  }

  const seen = new Set<string>();
  let prototype: object | null = elementClass.prototype;

  // Walk our own classes but stop at HTMLElement: everything above is the
  // platform's surface, not ours.
  while (prototype && prototype !== HTMLElement.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (!LIFECYCLE.has(name) && !name.startsWith("_") && !privateNames.has(name)) {
        seen.add(name);
      }
    }
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  return [...seen].sort();
}

/** Reads a class's observed attributes, sorted. */
export function attributesOf(elementClass: CustomElementConstructor): string[] {
  const observed = (elementClass as unknown as { observedAttributes?: string[] })
    .observedAttributes;
  return [...(observed ?? [])].sort();
}

/**
 * Event names the host can listen for, read from the source.
 *
 * Derived from the text rather than from a list, for the same reason the node
 * contract is derived from the registry: a list beside the code drifts, and the
 * drift is invisible until a host reports it.
 *
 * The filter is `this.dispatchEvent` — an event the element raises **on
 * itself** — and not `composed: true`. Composed events escape the shadow root
 * as well, and by that measure the surface has forty-six events; but most of
 * those are our own components talking to each other, and a host that started
 * listening for `question-option-move` would be depending on our wiring rather
 * than on our offer. What the element dispatches on itself is what we meant to
 * say.
 */
export function eventsIn(
  elements: Record<string, string>,
  announcers: Record<string, string> = {}
): string[] {
  const names = new Set<string>();

  const collect = (source: string, pattern: RegExp): void => {
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  };

  for (const source of Object.values(elements)) {
    collect(
      source,
      /this\.dispatchEvent\(\s*new CustomEvent[<(][\s\S]{0,240}?["'`]([a-z][a-z0-9-]*)["'`]/g
    );
    for (const name of builtEventsIn(source)) {
      names.add(name);
    }
  }

  /*
   * The second group exists because there are two ways we announce something.
   *
   * The usual one is the element raising an event on itself. The other is a
   * helper handed the element as its target — `announceThemeChange(this, …)` —
   * and the first version of this file missed `theme-change` entirely because
   * of it. That would have been a surface guard with a hole in exactly the
   * place the guard exists for: `data-theme` → `data-fw-theme` was a theming
   * change too.
   *
   * Any dispatch counts in these files, because announcing is all they do.
   */
  for (const source of Object.values(announcers)) {
    collect(
      source,
      /\.dispatchEvent\(\s*new CustomEvent[<(][\s\S]{0,240}?["'`]([a-z][a-z0-9-]*)["'`]/g
    );
  }

  return [...names].sort();
}

/**
 * The events whose names are **built** rather than written.
 *
 * `<guide-versions>` raises six intents from one line —
 * `` new CustomEvent(`version-${action}-intent`) `` — and the literal pattern
 * above sees none of them. A surface guard blind to a whole element's contract
 * is the hole the guard exists to close, and the fix must not be a list beside
 * the code: a list is the second copy, and the second copy is never updated.
 *
 * So the pieces are read from the source too. The template gives the fixed ends
 * and the name of what varies; the parameter's own type gives the union; the
 * union gives the words. Rename an action and the six names change here as
 * well, which is what makes the freeze mean something.
 */
function builtEventsIn(source: string): string[] {
  const names: string[] = [];

  for (const [, prefix, identifier, suffix] of source.matchAll(
    /dispatchEvent\(\s*new CustomEvent[<(][\s\S]{0,240}?`([a-z][a-z0-9-]*)\$\{(\w+)\}([a-z0-9-]*)`/g
  )) {
    // What the interpolated name is declared as, wherever it is declared.
    const declared = new RegExp(`\\b${identifier}\\s*:\\s*(\\w+)`).exec(source);
    const union = declared
      ? new RegExp(`type\\s+${declared[1]}\\s*=([^;]+);`).exec(source)
      : null;

    for (const [, value] of union?.[1].matchAll(/["']([a-z][a-z0-9-]*)["']/g) ??
      []) {
      names.push(`${prefix}${value}${suffix}`);
    }
  }

  return names;
}

/** Named exports of an entry file, read from its `export { … } from …` lines. */
export function exportsIn(source: string): string[] {
  const names = new Set<string>();

  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) {
        names.add(name);
      }
    }
  }
  for (const match of source.matchAll(/export\s+type\s+\*\s+from\s+["']([^"']+)["']/g)) {
    names.add(`type * from ${match[1]}`);
  }

  return [...names].sort();
}

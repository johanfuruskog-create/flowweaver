import type { GraphChangedDetail } from "../editor/types/events";
import type {
  GraphSaveResult,
  GraphStore,
} from "./local-storage-graph-store";

export interface AutosaveControllerOptions {
  source: EventTarget;
  /**
   * Only the working copy, and the type says so.
   *
   * `Pick<…, "saveDraft">` and not the whole store: autosave must never freeze
   * a version (story 124, criterion 2). A guide whose list grows by one every
   * few seconds of typing has no versions, only noise — and the surest way to
   * keep a call from being written is for the object not to have the method.
   */
  store: Pick<GraphStore, "saveDraft"> & {
    /**
     * Told that the page is going away, before the last write (story 124).
     *
     * A store that talks to a server has to send that one differently — a
     * request does not outlive its page unless it says so. `localStorage` has
     * nothing to do and does not have the method.
     */
    beforeUnload?(): void;
  };
  /** Which guide. The empty string is the page's own single one. */
  guideId?: string;
  delay?: number;
  onSave?: (result: GraphSaveResult) => void;
}

export class AutosaveController {
  private readonly source: EventTarget;
  private readonly store: Pick<GraphStore, "saveDraft"> & { beforeUnload?(): void };
  private readonly guideId: string;
  private readonly delay: number;
  private readonly onSave?: (result: GraphSaveResult) => void;
  private timeoutId: number | null = null;
  private pendingGraph: GraphChangedDetail["graph"] | null = null;

  constructor(options: AutosaveControllerOptions) {
    this.source = options.source;
    this.store = options.store;
    this.guideId = options.guideId ?? "";
    this.delay = options.delay ?? 500;
    this.onSave = options.onSave;
  }

  connect(): void {
    this.source.addEventListener(
      "graph-changed",
      this.handleGraphChanged as EventListener
    );

    /*
     * The last write, on the way out (story 124, criterion 3).
     *
     * Everything between the last interval and the moment somebody closes the
     * tab is otherwise gone — up to `delay` of typing, which against a server
     * is three seconds. `pagehide` and not `beforeunload`: `beforeunload` does
     * not fire reliably on a phone, where the tab is closed by the system
     * rather than by a person, and `pagehide` covers both that and a plain
     * navigation away.
     */
    globalThis.addEventListener?.("pagehide", this.handlePageHide);
  }

  disconnect(): void {
    this.source.removeEventListener(
      "graph-changed",
      this.handleGraphChanged as EventListener
    );
    globalThis.removeEventListener?.("pagehide", this.handlePageHide);

    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.pendingGraph = null;
  }

  /**
   * Saves what is pending now instead of after the delay. Returns whether
   * there was anything to write — the host's answer to `save-request`
   * (Ctrl+S) is "saved" either way, but it need not say so twice.
   */
  flush(): boolean {
    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const graph = this.pendingGraph;
    this.pendingGraph = null;

    if (!graph) {
      return false;
    }

    /*
     * The write is started and not awaited, and `flush()` still answers at
     * once. It is called from `pagehide` as well as from a timer, and a page
     * that is going away does not get to await anything — a store that writes
     * synchronously (localStorage) has already written by the time this
     * returns, and one that talks to a server has to say how it survives an
     * unload in its own implementation.
     */
    void this.store.saveDraft(this.guideId, graph).then((result) => this.onSave?.(result));

    return true;
  }

  private readonly handlePageHide = (): void => {
    this.store.beforeUnload?.();
    this.flush();
  };

  private readonly handleGraphChanged = (
    event: CustomEvent<GraphChangedDetail>
  ): void => {
    this.pendingGraph = structuredClone(event.detail.graph);

    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
    }

    this.timeoutId = globalThis.setTimeout(() => this.flush(), this.delay);
  };
}

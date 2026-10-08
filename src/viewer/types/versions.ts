/**
 * A version of a guide, as the host describes it to `<guide-versions>`.
 *
 * Lives here rather than with the list because `init()` — which every host
 * calls, viewer-only ones included — accepts a list of these. The viewer bundle
 * must not reach the editor's components even for a type (`entries.test.ts`
 * follows imports without telling `type` apart), so the shape is the contract
 * and the component is one consumer of it.
 */
export interface GuideVersion {
  /** The host's own identifier. Opaque here. */
  id: string;
  /**
   * The running number the editor sees — *Version 4*.
   *
   * The **host's**, set once when the version was frozen and never changed, not
   * even when older versions are pruned: then the numbers skip, and that is
   * right — *"go back to version 3"* has to mean the same thing tomorrow
   * (`docs/LAGRING-KONTRAKT.md`). The list therefore never counts: a host that
   * sends no number gets a row named by its note and its time, because a number
   * this end invented would be a different number the day something is pruned.
   */
  number?: number;
  /** What the host calls it: a file name, a row id, a commit hash. */
  label?: string;
  /** What an editor wrote about this version. Wins the title when present. */
  note?: string;
  /** When it was last written, as milliseconds. */
  savedAt?: number;
  /**
   * Who froze it, when the host knows.
   *
   * The **host's** to write, out of its own session, and never the editor's to
   * send: the editor cannot know it better than the host, and a field a client
   * fills in is a field a client can fill in with somebody else's name
   * (`docs/LAGRING-KONTRAKT.md`, story 126).
   *
   * `subject` is opaque — whatever the host's directory calls a person — and is
   * here so two versions by two people who share a name can still be told
   * apart. `name` is what the list shows, because an id is nothing anybody
   * recognises themselves by. A host without a login sends neither, and the row
   * then has no *av …* line rather than an empty one.
   */
  by?: {
    subject?: string;
    name?: string;
    /**
     * Is this the person who is asking? The **host's** answer, never a name
     * comparison — two people called Anna Andersson at one council would make
     * that the wrong answer for one of them (story 127).
     *
     * The row needs it to say *your copy* about a conflict snapshot (story
     * 131), which is why it cannot be baked into a stored label: who *you* are
     * depends on who is reading.
     */
    me?: boolean;
  };
  /**
   * Why the version exists, when it is not a publication (story 131).
   *
   * `"conflict"` is a copy the host froze because two editors had both changed
   * the guide and one text had to win. It carries **no number**: numbers name
   * publications, and *"go back to version 3"* would mean less every time
   * somebody's save collided.
   *
   * The host's to set, out of the route that was used, and never the client's
   * to send: a row that says it was frozen at a collision has to have been.
   * Absent on an ordinary version, which needs no reason.
   */
  reason?: "conflict";
  /** The one visitors see. */
  current?: boolean;
  /**
   * The one the editor is working from.
   *
   * A different question from `current`, and the one an editor asks while they
   * are mid-sentence: *where did what I am typing come from?* Without it, open a
   * version, change something, and the list goes back to looking like a shelf of
   * equal boxes — with no way to tell which one Save is meant for.
   *
   * The host sets it, because only the host knows what it handed the editor.
   */
  open?: boolean;
  /**
   * The one holding work that is not stored yet.
   *
   * A draft belongs to a version, not to the screen. Saying so on the row is
   * what makes the remedy findable: the place that holds the state is the place
   * that offers the way out of it, so the row's own action becomes **Save** for
   * as long as there is something to save.
   *
   * It also makes the awkward question rare rather than handled. Switching away
   * with unsaved work is a conversation nobody wants to have twice; a button
   * sitting where the work is means most people never reach it.
   */
  draft?: boolean;
  /** The host could not find it any more. */
  missing?: boolean;
}

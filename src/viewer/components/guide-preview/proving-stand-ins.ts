/**
 * The stand-in answers a run of the guide may put in — story 065's follow-up.
 *
 * Two steps cannot be answered from the keyboard: an attachment, whose only
 * control is a file picker, and a place, whose only control without a host's
 * map is a line of prose. In a run on the canvas an editor is trying the
 * *flow*, and stopping to find a real photo on disk — or inventing a street
 * address — is a toll on the way to the branch they wanted to see. So under
 * `proving` the field swaps its control for a button, and one press puts a
 * made-up answer into the run's engine.
 *
 * **Made up, and it says so.** Nothing here is automatic (Johan 1/9: *"lägger
 * man inte till någon bild så får man valideringsfel"*): the step starts empty
 * exactly as the visitor meets it, the refusal is the visitor's refusal, and
 * the button is a deliberate press with a line under it saying the answer is
 * pretend.
 *
 * **They are pictures on disk, not markup in here.** Swapping
 * `src/assets/proving/provbild.svg` swaps what a run shows, with no code
 * touched — a photo of our own is meant to replace the drawn one (Johan 1/9),
 * and a `.jpg` would change the import's extension and its media type below,
 * nothing else. They are inlined (`?raw`) rather than fetched so a host that
 * loads the bundle as a script tag has them too, with nothing to serve.
 *
 * **Never a file.** A stand-in is a name and a picture to draw, never a `File`
 * in `heldFiles` — so `getFiles()` and `getFormData()` cannot carry one into a
 * submission. That is the run's "only in the run" räcke held by construction
 * rather than by remembering to clear something up.
 */
import picture from "../../../assets/proving/provbild.svg?raw";
import mapPicture from "../../../assets/proving/provkarta.svg?raw";
import documentSource from "../../../assets/proving/provfil.pdf?raw";

export interface ProvingStandIn {
  /** The name the field shows, and the answer the engine stores. */
  name: string;
  /**
   * Something an `<img>` can draw, for the step that lets a visitor mark their
   * own picture — empty when the stand-in is not a picture at all.
   */
  src: string;
  isImage: boolean;
  /**
   * What the picture shows, for whoever does not see it — story 108.
   *
   * Only the step's own example photo has one: the drawn picture and the drawn
   * map are the run's furniture, and the field they stand in draws them under
   * its own heading. An editor's example photo is a real photo of a real thing,
   * and the word for it is the editor's to write.
   */
  alt?: string;
}

/**
 * The example photo a file step carries in its own data (story 108).
 *
 * Not a `File` here either: in a run this is a picture to draw and a name to
 * show, exactly like the drawn one, so the räcke above holds unchanged. The
 * visitor's button is the other half of the story and lives in the viewer —
 * there the photo is fetched and becomes a real file, because there it is a
 * real answer.
 */
export interface ExampleImage {
  src: string;
  /** The file name the field shows: the last segment of the address. */
  name: string;
  alt: string;
}

/**
 * An SVG as something `src` accepts, without a round trip.
 *
 * `encodeURIComponent` and not base64: it survives the source being edited by
 * hand, and the measured size is the same order (the drawn map is 2 188
 * characters of source and 3 953 of data URI).
 */
const asDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const PROVING_PICTURE: ProvingStandIn = {
  name: "provbild.svg",
  src: asDataUri(picture),
  isImage: true,
};

export const PROVING_DOCUMENT: ProvingStandIn = {
  name: "provfil.pdf",
  // Held as text so that swapping the file needs no code: it is a small
  // all-ASCII PDF, and nothing draws it — a document is a name in the field.
  src: `data:application/pdf;base64,${btoa(documentSource)}`,
  isImage: false,
};

/** The drawn map a run shows where a host's map would be. */
export const PROVING_MAP_PICTURE = asDataUri(mapPicture);

/**
 * The place the run answers with: the middle of the drawn map.
 *
 * `[0, 0]` because the run has no map to read a centre out of — without a
 * registered provider there are no tiles, no projection and no viewport, and a
 * pair of coordinates picked to look plausible would be a real address
 * somewhere that nobody chose. The label is what a person reads (and what the
 * review step shows); this is the shape a system consumes, and it is honest
 * about being nowhere.
 */
export const PROVING_PLACE_GEOMETRY = JSON.stringify({
  type: "Point",
  coordinates: [0, 0],
});

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".svg",
];

/**
 * Which stand-in a file step gets: the picture, or the document.
 *
 * Decided from the field's own two settings and nothing else — measured on the
 * every-field example, where the photo step carries `accept=".jpg,.jpeg,.png,
 * .heic"` and `allowMarking`. Marking wins outright: there is nothing to draw
 * marks on but a picture. An empty `accept` allows everything (the picker's own
 * check reads it that way), and then a picture is the likelier attachment. A
 * field that names any image type at all gets the picture; one that names only
 * documents gets the document.
 *
 * A step with an example photo of its own wins over all of it (story 108): the
 * editor chose a picture for *this* question, and a run that showed the drawn
 * one instead would be answering a question nobody asked. It is a picture by
 * construction — the field only offers a photo — so marking has nothing to
 * decide here.
 */
export function provingStandInFor(
  accept: string,
  allowMarking: boolean,
  example?: ExampleImage | null,
): ProvingStandIn {
  if (example) {
    return { name: example.name, src: example.src, isImage: true, alt: example.alt };
  }

  if (allowMarking) {
    return PROVING_PICTURE;
  }

  const rules = accept
    .split(",")
    .map((one) => one.trim().toLowerCase())
    .filter((one) => one !== "");

  if (rules.length === 0) {
    return PROVING_PICTURE;
  }

  return rules.some((one) =>
    one.startsWith(".") ? IMAGE_EXTENSIONS.includes(one) : one.startsWith("image/"),
  )
    ? PROVING_PICTURE
    : PROVING_DOCUMENT;
}

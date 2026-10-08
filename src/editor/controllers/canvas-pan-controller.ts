interface ActiveCanvasPan {
  pointerId: number;

  lastClientX: number;
  lastClientY: number;
}

export interface CanvasPanControllerOptions {
  viewport: HTMLElement;

  /**
   * Returns false when panning should not start, for instance during a node
   * drag or a connection drag.
   */
  canStart?: () => boolean;

  /**
   * Körs när panoreringen börjar.
   */
  onStart?: () => void;

  /**
   * Körs när panoreringen avslutas.
   */
  onEnd?: () => void;
}

export class CanvasPanController {
  private readonly viewport: HTMLElement;
  private readonly canStart: () => boolean;
  private readonly onStart?: () => void;
  private readonly onEnd?: () => void;

  private isSpacePressed = false;
  private activePan: ActiveCanvasPan | null = null;

  constructor(
    options: CanvasPanControllerOptions
  ) {
    this.viewport = options.viewport;
    this.canStart =
      options.canStart ?? (() => true);

    this.onStart = options.onStart;
    this.onEnd = options.onEnd;
  }

  connect(): void {
    this.viewport.addEventListener(
      "pointerdown",
      this.handlePointerDown
    );

    window.addEventListener(
      "keydown",
      this.handleKeyDown
    );

    window.addEventListener(
      "keyup",
      this.handleKeyUp
    );

    window.addEventListener(
      "blur",
      this.handleWindowBlur
    );
  }

  disconnect(): void {
    this.finishPan();

    this.viewport.removeEventListener(
      "pointerdown",
      this.handlePointerDown
    );

    window.removeEventListener(
      "keydown",
      this.handleKeyDown
    );

    window.removeEventListener(
      "keyup",
      this.handleKeyUp
    );

    window.removeEventListener(
      "blur",
      this.handleWindowBlur
    );

    this.isSpacePressed = false;
    this.updateReadyState();
  }

  private readonly handleKeyDown = (
  event: KeyboardEvent
): void => {
  if (event.code !== "Space") {
    return;
  }

  if (event.composedPath().some((target) => this.isEditableTarget(target))) {
    return;
  }

  /*
   * Måste köras även för upprepade keydown-events,
   * annars scrollar webbläsaren sidan.
   */
  event.preventDefault();

  if (event.repeat) {
    return;
  }

  this.isSpacePressed = true;
  this.updateReadyState();
};

  private readonly handleKeyUp = (
    event: KeyboardEvent
  ): void => {
    if (event.code !== "Space") {
      return;
    }

    this.isSpacePressed = false;
    this.updateReadyState();

    if (this.activePan) {
      this.finishPan();
    }
  };

  private readonly handlePointerDown = (
    event: PointerEvent
  ): void => {
    if (
      !this.isSpacePressed ||
      !this.canStart()
    ) {
      return;
    }

    /*
     * Vi panorerar bara med primär musknapp.
     */
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.viewport.setPointerCapture(
      event.pointerId
    );

    this.activePan = {
      pointerId: event.pointerId,

      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };

    this.viewport.setAttribute(
      "data-panning",
      ""
    );

    document.documentElement.classList.add(
      "node-editor-is-panning"
    );

    window.addEventListener(
      "pointermove",
      this.handlePointerMove
    );

    window.addEventListener(
      "pointerup",
      this.handlePointerUp
    );

    window.addEventListener(
      "pointercancel",
      this.handlePointerCancel
    );

    this.onStart?.();
  };

  private readonly handlePointerMove = (
    event: PointerEvent
  ): void => {
    const pan = this.activePan;

    if (
      !pan ||
      event.pointerId !== pan.pointerId
    ) {
      return;
    }

    const deltaX =
      event.clientX - pan.lastClientX;

    const deltaY =
      event.clientY - pan.lastClientY;

    this.viewport.scrollLeft -= deltaX;

    this.viewport.scrollTop -= deltaY;

    pan.lastClientX = event.clientX;
    pan.lastClientY = event.clientY;
  };

  private readonly handlePointerUp = (
    event: PointerEvent
  ): void => {
    if (
      !this.activePan ||
      event.pointerId !==
        this.activePan.pointerId
    ) {
      return;
    }

    this.finishPan();
  };

  private readonly handlePointerCancel = (
    event: PointerEvent
  ): void => {
    if (
      !this.activePan ||
      event.pointerId !==
        this.activePan.pointerId
    ) {
      return;
    }

    this.finishPan();
  };

  private readonly handleWindowBlur = (): void => {
    this.isSpacePressed = false;
    this.updateReadyState();
    this.finishPan();
  };

  private finishPan(): void {
    const pan = this.activePan;

    if (
      pan &&
      this.viewport.hasPointerCapture(
        pan.pointerId
      )
    ) {
      this.viewport.releasePointerCapture(
        pan.pointerId
      );
    }

    this.activePan = null;

    this.viewport.removeAttribute(
      "data-panning"
    );

    document.documentElement.classList.remove(
      "node-editor-is-panning"
    );

    window.removeEventListener(
      "pointermove",
      this.handlePointerMove
    );

    window.removeEventListener(
      "pointerup",
      this.handlePointerUp
    );

    window.removeEventListener(
      "pointercancel",
      this.handlePointerCancel
    );

    this.onEnd?.();
  }

  private updateReadyState(): void {
    if (this.isSpacePressed) {
      this.viewport.setAttribute(
        "data-pan-ready",
        ""
      );

      return;
    }

    this.viewport.removeAttribute(
      "data-pan-ready"
    );
  }

  private isEditableTarget(
    target: EventTarget | null
  ): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (
        target instanceof HTMLElement &&
        target.isContentEditable
      )
    );
  }
}

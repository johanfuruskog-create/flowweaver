import { isOfferedNodeType } from "../node-palette/node-palette";
import { escapeHtml } from "../../../viewer/core/escape-html";
import styles from "./editor-toolbar.scss?inline";

import type { EditorCapabilities } from "../../config/editor-capabilities";
import { getEditorCapabilities } from "../../config/editor-capabilities";
import { CORE_MODULE, visibleModules } from "../../config/editor-modules";

import type {
  GraphImportRequestDetail,
  ToastRequestDetail,
} from "../../types/events";
import { resolveText, DEFAULT_UI_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";

export class EditorToolbar extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private capabilitiesValue = getEditorCapabilities("advanced");
  private uiLocale: string = DEFAULT_UI_LOCALE;

  /** Lokaliserad chrome-text i editorns UI-språk. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.uiLocale);
    return params ? interpolate(resolved, params) : resolved;
  }

  /** Editorns UI-språk (chrome). Styrs uppifrån av <guide-editor editor-locale>. */
  set editorLocale(value: string) {
    if (value === this.uiLocale) {
      return;
    }
    this.uiLocale = value;
    if (this.isConnected) {
      this.render();
    }
  }

  /** A method alias <guide-editor> calls to set the editor's UI language. */
  setEditorLocale(value: string): void {
    this.editorLocale = value;
  }
  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!event.composedPath().includes(this)) {
      this.closeMenus();
    }
  };

  set capabilities(value: EditorCapabilities) {
    this.capabilitiesValue = { ...value };
    this.updateCapabilityVisibility();
  }

  private canEditValue = true;

  /**
   * May the canvas be changed? Decides whether the Vy menu offers the two
   * commands that set every node's eye.
   *
   * A read-only or a translation canvas already draws every node the way a
   * visitor sees it and offers no way to switch (story 064 point 10), so a menu
   * row that switches them would name a state nobody can leave. Left out of the
   * markup rather than disabled — same reason as the node's own menu button.
   */
  set canEdit(value: boolean) {
    if (value === this.canEditValue) {
      return;
    }

    this.canEditValue = value;
    this.updateEditVisibility();
  }

  /**
   * Two reasons an item is gone, read together: it needs an editable canvas
   * (`data-requires-edit`), or it acts on the canvas (`data-canvas-only`)
   * and the list is up in its place. Zoom and "as the visitor sees it"
   * listed and did nothing while the list was showing (measured 3/9).
   */
  private updateEditVisibility(): void {
    this.root
      .querySelectorAll<HTMLElement>("[data-requires-edit], [data-canvas-only]")
      .forEach((element) => {
        element.hidden =
          (element.hasAttribute("data-requires-edit") && !this.canEditValue) ||
          (element.hasAttribute("data-canvas-only") && this.listViewActive);
      });
  }

  /**
   * May the user manage node templates? Without permission there is no way into
   * the dialog — a menu that opens something you may not do is worse than no
   * menu.
   */
  set canManageTemplates(value: boolean) {
    const item = this.root.querySelector<HTMLElement>(
      '[data-action="manage-node-types"]'
    );

    if (item) {
      item.hidden = !value;
    }
  }

  /**
   * Where Help → Getting started leads. The page is the host's — the example
   * site has one, an embedding host usually has not — so without an address
   * the item is gone rather than dead. Driven by <guide-editor>.
   */
  set getStartedHref(value: string | null) {
    this.getStartedHrefValue = value;
    const item = this.root.querySelector<HTMLElement>('[data-action="get-started"]');

    if (item) {
      item.hidden = !value;
    }
  }

  /** The active modules (to tick in the Modules menu). Driven by <guide-editor>. */
  set modules(ids: string[]) {
    this.moduleIdsValue = [...ids];
    this.updateModuleChecks();
  }

  private moduleIdsValue: string[] = [];
  private getStartedHrefValue: string | null = null;
  private listViewActive = false;
  private showVariablesActive = false;

  connectedCallback(): void {
    this.render();
    document.addEventListener("pointerdown", this.handleDocumentPointerDown);
  }

  /** Bygger toolbar-chromen i aktuellt UI-språk och binder om händelserna. */
  private render(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <div class="editor-toolbar">
        <span class="editor-toolbar__brand" aria-hidden="true">
          <!-- The same mark as src/site/site-wordmark.ts (the site's is a build-time
               string, the library cannot import it). The gap where blue passes
               under green is a clip on the blue stroke (Astra 30/9 2026), so
               the mark needs no background colour; the id is local to this
               shadow root. -->
          <svg class="editor-toolbar__brand-mark" viewBox="0 0 100 80">
            <defs>
              <clipPath id="editor-toolbar-logo-gap" clipPathUnits="userSpaceOnUse">
                <path clip-rule="evenodd" fill-rule="evenodd" d="M0,0 H100 V80 H0 Z M62.494424518,50.280935301 L72.094424518,39.080935301 L60.705575482,29.319064699 L51.105575482,40.519064699 Z"/>
              </clipPath>
            </defs>
            <circle cx="15" cy="22" r="6" fill="var(--fw-logo-blue)"/>
            <circle cx="15" cy="58" r="6" fill="var(--fw-logo-green)"/>
            <polyline clip-path="url(#editor-toolbar-logo-gap)" points="22,22 46,22 70,50 82,43" fill="none" stroke="var(--fw-logo-blue)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="22,58 46,58 70,30 82,37" fill="none" stroke="var(--fw-logo-green)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="88" cy="40" r="7.5" fill="var(--fw-logo-blue)"/>
            <circle cx="88" cy="40" r="3" fill="var(--fw-logo-green)"/>
          </svg>
        </span>
        <nav class="editor-toolbar__menus" aria-label="${this.text("editor.toolbar.menuAria")}">
          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="file" aria-expanded="false">
              ${this.text("editor.toolbar.file")}
            </button>
            <div role="menu" data-menu="file" hidden>
              <button type="button" role="menuitem" data-action="new-form">
                ${this.text("editor.toolbar.newForm")}
              </button>
              <button type="button" role="menuitem" data-action="import">
                ${this.text("editor.toolbar.importJson")}
              </button>
              <button type="button" role="menuitem" data-action="import-template">
                ${this.text("editor.toolbar.importTemplate")}
              </button>
              <button type="button" role="menuitem" data-action="export">
                ${this.text("editor.toolbar.exportJson")}
              </button>
              <button type="button" role="menuitem" data-action="export-schema">
                ${this.text("editor.toolbar.exportSchema")}
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="save">
                ${this.text("editor.shortcuts.save")} <kbd>Ctrl+S</kbd>
              </button>
              <button type="button" role="menuitem" data-action="reset">
                ${this.text("editor.toolbar.reset")}
              </button>
            </div>
          </div>

          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="edit" aria-expanded="false">
              ${this.text("editor.toolbar.edit")}
            </button>
            <div role="menu" data-menu="edit" hidden>
              <button type="button" role="menuitem" class="has-kbd" data-action="undo" disabled>
                ${this.text("editor.toolbar.undo")} <kbd>Ctrl+Z</kbd>
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="redo" disabled>
                ${this.text("editor.toolbar.redo")} <kbd>Ctrl+Y</kbd>
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="quick-open" data-i18n="editor.quickOpen.aria">
                ${this.text("editor.quickOpen.aria")} <kbd>Ctrl+K</kbd>
              </button>
            </div>
          </div>

          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="guide" aria-expanded="false">
              ${this.text("editor.toolbar.guide")}
            </button>
            <div role="menu" data-menu="guide" hidden>
              <button type="button" role="menuitem" data-action="show-start-node">
                ${this.text("editor.toolbar.showStartNode")}
              </button>
              ${
                /*
                 * A run of the guide is started here and nowhere else — never
                 * by clicking a node in the middle of the flow (story 065
                 * point 1). Behind `data-requires-edit` for the same reason as
                 * the Vy menu's rows: a read-only canvas already draws every
                 * step the way a visitor sees it.
                 */
                ""
              }
              <button type="button" role="menuitem" data-action="prove-guide" data-requires-edit>
                ${this.text("editor.toolbar.proveGuide")}
              </button>
              <button type="button" role="menuitem" data-action="routes-here">
                ${this.text("editor.toolbar.routesHere")}
              </button>
              <button type="button" role="menuitem" data-action="manage-node-types" hidden>
                ${this.text("editor.toolbar.nodeTemplates")}
              </button>
            </div>
          </div>

          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="modules" aria-expanded="false">
              ${this.text("editor.toolbar.modules")}
            </button>
            <div role="menu" data-menu="modules" hidden>
              <button type="button" role="menuitemcheckbox" aria-checked="true" disabled>
                ${escapeHtml(resolveText(CORE_MODULE.label, this.uiLocale))}
              </button>
              ${visibleModules().map((module) => `
                <button type="button" role="menuitemcheckbox" aria-checked="${this.moduleIdsValue.includes(module.id)}" data-module-toggle="${escapeHtml(module.id)}">
                  ${escapeHtml(resolveText(module.label, this.uiLocale))}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="view" aria-expanded="false">
              ${this.text("editor.toolbar.view")}
            </button>
            <div role="menu" data-menu="view" hidden>
              ${
                /*
                 * At the top, and only when the canvas may be changed. In a
                 * read-only or a translation canvas every node already shows
                 * the visitor's view and there is nothing to switch — see
                 * story 064 point 10.
                 */
                ""
              }
              <button
                type="button"
                role="menuitem"
                data-action="toggle-list-view"
                aria-pressed="${this.listViewActive}"
              >
                ${this.text(this.listViewActive ? "editor.toolbar.canvasView" : "editor.toolbar.listView")}
              </button>
              <button type="button" role="menuitem" data-action="visitor-view-all" data-requires-edit data-canvas-only>
                ${this.text("editor.toolbar.allVisitorView")}
              </button>
              <button type="button" role="menuitem" data-action="structure-view-all" data-requires-edit data-canvas-only>
                ${this.text("editor.toolbar.allStructureView")}
              </button>
              ${
                /*
                 * A tick, like the modules: on or off, and choosing it again
                 * switches it off (story 077). Unlike the modules the menu
                 * closes on it — it is a view, and the canvas is the answer.
                 */
                ""
              }
              <button
                type="button"
                role="menuitemcheckbox"
                data-action="toggle-variables"
                data-canvas-only
                aria-checked="${this.showVariablesActive}"
              >
                ${this.text("editor.toolbar.showVariables")}
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="zoom-in" data-canvas-only>
                ${this.text("editor.toolbar.zoomIn")} <kbd>+</kbd>
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="zoom-out" data-canvas-only>
                ${this.text("editor.toolbar.zoomOut")} <kbd>−</kbd>
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="zoom-reset" data-canvas-only>
                ${this.text("editor.toolbar.zoomReset")} <kbd>0</kbd>
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="fit-to-content" data-canvas-only>
                ${this.text("editor.toolbar.fitToContent")} <kbd>F</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                data-action="fullscreen"
                aria-pressed="false"
              >
                ${this.text("editor.toolbar.fullscreen")}
              </button>
            </div>
          </div>

          <div class="editor-toolbar__menu">
            <button type="button" data-menu-trigger="help" aria-expanded="false">
              ${this.text("editor.toolbar.help")}
            </button>
            <div role="menu" data-menu="help" hidden>
              <button type="button" role="menuitem" data-action="tour">
                ${this.text("editor.tour.start")}
              </button>
              <button type="button" role="menuitem" data-action="get-started" hidden>
                ${this.text("editor.toolbar.getStarted")}
              </button>
              <button type="button" role="menuitem" class="has-kbd" data-action="shortcuts">
                ${this.text("editor.toolbar.shortcuts")} <kbd>?</kbd>
              </button>
            </div>
          </div>
        </nav>


        <input
          class="editor-toolbar__file-input"
          type="file"
          accept="application/json,.json"
          data-import-file
          tabindex="-1"
          aria-label="${this.text("editor.toolbar.importFileAria")}"
        />

      </div>
    `;

    this.bindMenus();
    this.bindModuleMenu();
    this.updateCapabilityVisibility();
    this.updateEditVisibility();
    this.updateModuleChecks();
    this.getStartedHref = this.getStartedHrefValue;

    this.root
      .querySelector<HTMLButtonElement>('[data-action="export"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("graph-export-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    // The submission schema on its own (story 094), for the receiver's developer.
    this.root
      .querySelector<HTMLButtonElement>('[data-action="export-schema"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("schema-export-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    const fileInput =
      this.root.querySelector<HTMLInputElement>("[data-import-file]");

    /*
     * Ett grepp, en händelse. Verktygsraden vet vad någon bad om; editorn vet
     * var det får plats och vad guiden redan innehåller. Att flytta greppet till
     * paletten blir därför den här knappen och ingenting annat.
     */
    this.root
      .querySelector<HTMLButtonElement>('[data-action="new-form"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("new-form-request", { bubbles: true, composed: true }),
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="import"]')
      ?.addEventListener("click", () => fileInput?.click());

    /*
     * Two menu items for one file input.
     *
     * The handler reads whichever shape arrives, so a single item would work —
     * and would mean choosing a file and only then learning whether the guide
     * was about to be replaced or a palette entry added. Two very different
     * outcomes behind one word.
     *
     * So the *choice* is made before the file picker opens, and the intent is
     * carried on the input. Picking a template file under "Importera guide"
     * still works; it simply says what it did.
     */
    this.root
      .querySelector<HTMLButtonElement>('[data-action="import-template"]')
      ?.addEventListener("click", () => {
        if (fileInput) {
          fileInput.dataset.expecting = "template";
          fileInput.click();
        }
      });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      const expecting = fileInput.dataset.expecting === "template";

      delete fileInput.dataset.expecting;

      try {
        const json = await file.text();

        this.dispatchEvent(
          new CustomEvent<GraphImportRequestDetail>("graph-import-request", {
            detail: { fileName: file.name, json, expecting: expecting ? "template" : "guide" },
            bubbles: true,
            composed: true,
          })
        );
      } catch {
        this.dispatchEvent(
          new CustomEvent<ToastRequestDetail>("toast-request", {
            detail: {
              message: this.text("editor.toolbar.importReadError"),
              type: "error",
            },
            bubbles: true,
            composed: true,
          })
        );
      } finally {
        fileInput.value = "";
      }
    });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="reset"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("graph-reset-intent", {
            bubbles: true,
            composed: true,
          })
        );
      });


    const editRequests: Record<string, string> = {
      undo: "undo-request",
      redo: "redo-request",
      save: "save-intent",
    };
    Object.entries(editRequests).forEach(([action, eventName]) => {
      this.root
        .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
        ?.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent(eventName, { bubbles: true, composed: true })
          );
        });
    });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="show-start-node"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("show-start-node-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="routes-here"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("routes-here-request", { bubbles: true, composed: true }),
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="prove-guide"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("prove-guide-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="manage-node-types"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("node-type-editor-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="shortcuts"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("shortcuts-help-request", {
            bubbles: true,
            composed: true,
          })
        );
      });


    this.root
      .querySelector<HTMLButtonElement>('[data-action="tour"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("tour-request", { bubbles: true, composed: true })
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="get-started"]')
      ?.addEventListener("click", () => {
        if (this.getStartedHrefValue) {
          window.open(this.getStartedHrefValue, "_blank", "noopener");
        }
      });


    /*
     * A command, not a setting. The menu sets every node's eye and keeps
     * nothing of its own — the state lives one place, on the nodes.
     */
    const viewRequests: Record<string, string> = {
      "quick-open": "quick-open-request",
      "toggle-list-view": "list-view-request",
      "toggle-variables": "show-variables-request",
      "visitor-view-all": "visitor-view-all-request",
      "structure-view-all": "structure-view-all-request",
    };
    Object.entries(viewRequests).forEach(([action, eventName]) => {
      this.root
        .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
        ?.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent(eventName, { bubbles: true, composed: true }),
          );
        });
    });

    const zoomRequests: Record<string, string> = {
      "zoom-in": "zoom-in-request",
      "zoom-out": "zoom-out-request",
      "zoom-reset": "zoom-reset-request",
    };
    Object.entries(zoomRequests).forEach(([action, eventName]) => {
      this.root
        .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
        ?.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent(eventName, { bubbles: true, composed: true })
          );
        });
    });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="fit-to-content"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("fit-to-content-request", {
            bubbles: true,
            composed: true,
          })
        );
      });

    this.root
      .querySelector<HTMLButtonElement>('[data-action="fullscreen"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("fullscreen-toggle-request", {
            bubbles: true,
            composed: true,
          })
        );
      });
  }

  private updateCapabilityVisibility(): void {
    this.root
      .querySelectorAll<HTMLElement>(
        '[data-action="import"], [data-action="export"], [data-action="export-schema"], [data-import-file]'
      )
      .forEach((element) => {
        element.hidden = !this.capabilitiesValue.importExport;
      });
    // The schema is what a submission sends: no submission capability, no schema to export.
    const schemaExport = this.root.querySelector<HTMLElement>('[data-action="export-schema"]');
    if (schemaExport) {
      schemaExport.hidden = !this.capabilitiesValue.importExport || !this.capabilitiesValue.submission;
    }

    /*
     * Snabbstarten bygger en SIDA med fält, granska och inlämning. Har editorn
     * inte sidor skapar greppet noder den sedan flaggar som utanför nivån —
     * upptäckt när inlämningsfilmen spelades in på en sida vars moduler bockas
     * i efter exemplets graf, och den grafen har inga sidor.
     *
     * Ett grepp som producerar något editorn inte kan visa hör inte hemma i
     * menyn. Att i stället bygga stommen utan sida vore inte formulärets
     * recept längre (story 052).
     */
    const newForm = this.shadowRoot?.querySelector<HTMLElement>('[data-action="new-form"]');

    if (newForm) {
      // The form ends in a review and a submission, which are FlowWeaver
      // PRO's: without PRO the item would add nodes nothing can draw.
      newForm.hidden = !this.capabilitiesValue.pages || !isOfferedNodeType("submit-result");
    }

  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown);
  }

  /**
   * The menus follow the menu-button pattern (story 081, K4): ArrowDown or
   * Enter on the trigger opens and focuses the first item, ArrowUp the last;
   * inside, the arrows wrap, Home/End jump, Left/Right move to the neighbour
   * menu, Escape closes and returns focus to the trigger.
   *
   * The part that mattered most is the smallest: a choice — by key or by
   * mouse — hides the menu under the focused item, and the browser then drops
   * focus on body. Every shortcut listens on <guide-editor>, so that one
   * hidden menu took all of them with it (measured 3/9: Ctrl+K dead after
   * Vy → Visa som lista). closeMenus() now hands focus back to the trigger
   * whenever it was inside a menu; an action that takes focus itself (the
   * quick-open box, a dialog) runs after and wins.
   */
  private bindMenus(): void {
    const triggers = [...this.root.querySelectorAll<HTMLButtonElement>("[data-menu-trigger]")];
    const menuOf = (trigger: HTMLButtonElement): HTMLElement | null =>
      this.root.querySelector<HTMLElement>(`[data-menu="${trigger.dataset.menuTrigger ?? ""}"]`);
    const itemsOf = (menu: HTMLElement): HTMLButtonElement[] =>
      [...menu.querySelectorAll<HTMLButtonElement>("[role^=menuitem]")].filter(
        (item) => !item.hidden && !item.disabled,
      );
    const open = (trigger: HTMLButtonElement, focusLast = false): void => {
      const menu = menuOf(trigger);
      this.closeMenus();
      if (!menu) {
        return;
      }
      menu.hidden = false;
      this.keepInside(menu);
      trigger.setAttribute("aria-expanded", "true");
      const items = itemsOf(menu);
      (focusLast ? items.at(-1) : items[0])?.focus();
    };
    const neighbour = (trigger: HTMLButtonElement, step: number): HTMLButtonElement | undefined => {
      const visible = triggers.filter((one) => !one.hidden);
      const at = visible.indexOf(trigger);
      return visible[(at + step + visible.length) % visible.length];
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const menu = menuOf(trigger);
        const opening = menu?.hidden ?? false;

        this.closeMenus();

        if (menu && opening) {
          menu.hidden = false;
          this.keepInside(menu);
          trigger.setAttribute("aria-expanded", "true");
        }
      });

      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          open(trigger, event.key === "ArrowUp");
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          const next = neighbour(trigger, event.key === "ArrowRight" ? 1 : -1);
          const wasOpen = !(menuOf(trigger)?.hidden ?? true);
          if (next) {
            event.preventDefault();
            wasOpen ? open(next) : next.focus();
          }
        }
      });

      const menu = menuOf(trigger);
      menu?.addEventListener("keydown", (event) => {
        const items = itemsOf(menu);
        const at = items.indexOf(this.root.activeElement as HTMLButtonElement);
        const go = (index: number) => {
          event.preventDefault();
          items[(index + items.length) % items.length]?.focus();
        };

        switch (event.key) {
          case "ArrowDown": return go(at + 1);
          case "ArrowUp": return go(at - 1);
          case "Home": return go(0);
          case "End": return go(items.length - 1);
          case "ArrowRight":
          case "ArrowLeft": {
            const next = neighbour(trigger, event.key === "ArrowRight" ? 1 : -1);
            if (next) {
              event.preventDefault();
              open(next);
            }
            return;
          }
          case "Tab":
            // Tab leaves the menu the way the browser wants; the menu just
            // stops being open. Focus goes on to the next stop, not back.
            this.closeMenus(false);
            return;
          default:
            return;
        }
      });
    });

    this.root.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        this.closeMenus();
      }
    });

    this.root
      .querySelectorAll<HTMLButtonElement>('[role=menuitem], [data-action="toggle-variables"]')
      .forEach((item) => item.addEventListener("click", () => this.closeMenus()));
  }

  /**
   * A menu near the toolbar's right end opens to the left, inside the
   * toolbar (uppdrag 28/9 svarsalternativen, 1a).
   *
   * The properties panel lies over the toolbar on purpose (`z-index: 25` in
   * guide-editor.scss: a top menu must never spill over the panel), and the
   * menus opened from their trigger's left edge — so in 900 × 600 the view
   * menu ran under the panel's left edge and its long label and shortcuts
   * were cut (measured: a row's right end hit `properties-panel`). The
   * panel's decision stands; the menu keeps inside its own container
   * instead, the rule the text field's menus follow. Moved left by what
   * sticks out, never past the toolbar's left edge.
   */
  private keepInside(menu: HTMLElement): void {
    // While a menu is open the bar is a popover, over the canvas's own
    // toolbar (sticky, like the bar at rest) — see `:host([data-menu-open])`.
    this.toggleAttribute("data-menu-open", true);
    menu.style.left = "";

    const inside = this.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    const past = box.right - inside.right;

    if (past > 0) {
      menu.style.left = `${-Math.min(past, Math.max(0, box.left - inside.left))}px`;
    }
  }

  /** Closes every menu; focus inside one goes back to its trigger (see bindMenus). */
  private closeMenus(returnFocus = true): void {
    const inside = (this.root.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-menu]");

    this.root.querySelectorAll<HTMLElement>("[data-menu]").forEach((menu) => {
      menu.hidden = true;
    });
    this.removeAttribute("data-menu-open");
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-menu-trigger]")
      .forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));

    if (inside && returnFocus) {
      this.root
        .querySelector<HTMLButtonElement>(`[data-menu-trigger="${inside.dataset.menu ?? ""}"]`)
        ?.focus();
    }
  }

  /** Öppnar en namngiven meny (t.ex. under en rundtur). `null` stänger alla. */
  openMenu(name: string | null): void {
    this.closeMenus();
    if (!name) {
      return;
    }
    const menu = this.root.querySelector<HTMLElement>(`[data-menu="${name}"]`);
    const trigger = this.root.querySelector<HTMLButtonElement>(
      `[data-menu-trigger="${name}"]`
    );
    if (menu && trigger) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
  }

  /** Speglar aktiva moduler i Moduler-menyns kryssrutor. */
  private updateModuleChecks(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-module-toggle]")
      .forEach((button) => {
        const id = button.dataset.moduleToggle ?? "";
        button.setAttribute(
          "aria-checked",
          String(this.moduleIdsValue.includes(id))
        );
      });
  }

  /**
   * Clicking a module checkbox toggles the module and sends `modules-change`
   * with the whole new list. <guide-editor> applies it and mirrors it back via
   * the `modules` setter — the menu does not close (menuitemcheckbox), so
   * several can be toggled in a row.
   */
  private bindModuleMenu(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-module-toggle]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.moduleToggle ?? "";
          const next = this.moduleIdsValue.includes(id)
            ? this.moduleIdsValue.filter((item) => item !== id)
            : [...this.moduleIdsValue, id];
          // Behåll modulkatalogens ordning för ett stabilt attributvärde.
          const ordered = visibleModules().map((module) => module.id).filter(
            (moduleId) => next.includes(moduleId)
          );
          this.dispatchEvent(
            new CustomEvent<{ modules: string[] }>("modules-change", {
              detail: { modules: ordered },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
  }


  setFullscreen(active: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-action="fullscreen"]'
    );

    if (!button) {
      return;
    }

    button.textContent = active
      ? this.text("editor.toolbar.exitFullscreen")
      : this.text("editor.toolbar.fullscreen");
    button.setAttribute("aria-pressed", String(active));
  }

  /**
   * The same item opens and closes the list, and while the list was up it
   * still read "Visa som lista" — nothing said it was the way back (Johan
   * 3/9). So it swaps its label like fullscreen does: "Visa arbetsytan"
   * while the list is up. Not a tick — a ticked "Visa som lista" reads as
   * something you could choose again. The state lives in <guide-editor>,
   * which mirrors it here; kept on the instance so a re-render for a new
   * language keeps the label.
   */
  setListView(active: boolean): void {
    this.listViewActive = active;
    this.updateEditVisibility();
    const button = this.root.querySelector<HTMLButtonElement>(
      '[data-action="toggle-list-view"]'
    );

    if (!button) {
      return;
    }

    button.textContent = active
      ? this.text("editor.toolbar.canvasView")
      : this.text("editor.toolbar.listView");
    button.setAttribute("aria-pressed", String(active));
  }

  /** The tick on "Visa variabelnamn"; the state lives in <guide-editor>. */
  setShowVariables(active: boolean): void {
    this.showVariablesActive = active;
    this.root
      .querySelector<HTMLButtonElement>('[data-action="toggle-variables"]')
      ?.setAttribute("aria-checked", String(active));
  }

  setUndoRedo(canUndo: boolean, canRedo: boolean): void {
    this.root
      .querySelector<HTMLButtonElement>('[data-action="undo"]')
      ?.toggleAttribute("disabled", !canUndo);
    this.root
      .querySelector<HTMLButtonElement>('[data-action="redo"]')
      ?.toggleAttribute("disabled", !canRedo);
  }
}

if (!customElements.get("editor-toolbar")) {
  customElements.define("editor-toolbar", EditorToolbar);
}

declare global {
  interface HTMLElementTagNameMap {
    "editor-toolbar": EditorToolbar;
  }
}

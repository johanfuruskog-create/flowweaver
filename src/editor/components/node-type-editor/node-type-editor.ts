import { escapeHtml } from "../../../viewer/core/escape-html";
import { ADD_ICON, TRASH_ICON } from "../../../viewer/styles/action-icons";
import { displayTemplateLabel } from "../../services/template-library";
import styles from "./node-type-editor.scss?inline";

import { SOURCE_LOCALE } from "../../../viewer/core/localized-text";
import { interpolate, t } from "../../localization/editor-ui-strings";
import {
  NODE_TEMPLATE_BASES,
  newNodeTemplate,
} from "../../../viewer/node-types/node-templates";

import type { NodeTemplate } from "../../../viewer/types/graph";

interface NodeTypeEditorOptions {
  specs: NodeTemplate[];
  onCreate: (spec: NodeTemplate) => void;
  onDelete?: (type: string) => void;
  /**
   * How many nodes in the open guide come from the template. Used in the
   * confirmation before a removal. Omitted, the count is not mentioned.
   */
  usageCount?: (type: string) => number;
  /** The base type's name, so we can say what the nodes will be called. */
  baseLabel?: (type: string) => string;
  onUpdate?: (type: string, changes: { label: string; icon?: string }) => void;
  /**
   * When set: create the template from an existing node (name plus save).
   * Without it the dialog is a pure manager (list plus remove) — templates are
   * created via the node's "Spara som mall".
   */
  captured?: NodeTemplate;
  /**
   * The number of nodes the template is reconstructed from. Set only when
   * rescuing a vanished template, and drives the message about where the values
   * came from.
   */
  recreatedFrom?: number;
  suggestedName?: string;
  returnFocusTo?: HTMLElement | null;
  /** The editor's UI language (chrome). Driven from above by <guide-editor editor-locale>. */
  locale?: string;
  /**
   * The base types a template may be created from at the current feature level.
   * Omitted means all. Gated base types (multi-choice in "basic", say) must not
   * be selectable.
   */
  baseTemplates?: string[];
}

const ICON_SUGGESTIONS = ["★", "◆", "●", "▲", "☑", "⚑", "♥", "✦"];

/**
 * A standalone editor for the guide's own node types. The editor picks a
 * template (which sets the right behavior) and names the type; it then works via
 * the generic interpreter. Stays open so several can be added in a row.
 */
export class NodeTypeEditor extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private onCreate: ((spec: NodeTemplate) => void) | null = null;
  private onDelete: ((type: string) => void) | null = null;
  private usageCount: ((type: string) => number) | null = null;
  private baseLabel: ((type: string) => string) | null = null;
  /** The template awaiting confirmation before removal. */
  private pendingDelete: string | null = null;
  private onUpdate:
    | ((type: string, changes: { label: string; icon?: string }) => void)
    | null = null;
  private specs: NodeTemplate[] = [];
  private captured: NodeTemplate | null = null;
  private recreatedFrom: number | null = null;
  private editingType: string | null = null;
  /** True when we are creating a new template from a base type. */
  private creating = false;
  /** The base types a template may be created from (filtered per feature level). */
  private baseTemplates: string[] = [...NODE_TEMPLATE_BASES];
  private returnFocusTo: HTMLElement | null = null;
  private locale: string = SOURCE_LOCALE;

  /** A template's name: ours translated, theirs as they wrote it. */
  private label(template: { type: string; label: string }): string {
    return displayTemplateLabel(template, this.locale);
  }

  /** Localised chrome text in the editor's UI language. */
  private text(key: string, params?: Record<string, string | number>): string {
    const resolved = t(key, this.locale);
    return params ? interpolate(resolved, params) : resolved;
  }

  connectedCallback(): void {
    this.renderChrome();
    this.bindEvents();
  }

  /** Builds the static dialog structure in the current UI language. */
  private renderChrome(): void {
    this.root.innerHTML = `
      <style>${styles}</style>
      <dialog aria-labelledby="node-type-editor-title">
        <h2 id="node-type-editor-title">${this.text("editor.nodeTemplates.title")}</h2>
        <p class="node-type-editor__intro">
          ${this.text("editor.nodeTemplates.intro")}
        </p>

        <ul class="node-type-editor__list" data-list></ul>

        <form class="node-type-editor__form" data-form hidden>
          <h3 data-form-heading>${this.text("editor.nodeTemplates.saveHeading")}</h3>

          <p class="node-type-editor__capture-note" data-note></p>

          <label class="node-type-editor__name" data-base-wrap hidden>
            <span>${this.text("editor.nodeTemplates.baseLabel")}</span>
            <span class="node-type-editor__select"><select data-base-template>
              ${this.baseTemplates
                .map(
                  (id) =>
                    `<option value="${id}">${escapeHtml(this.text(`editor.nodeTemplates.base.${id}`))}</option>`
                )
                .join("")}
            </select></span>
          </label>

          <label class="node-type-editor__name">
            <span>${this.text("editor.nodeTemplates.nameLabel")}</span>
            <input data-name type="text" placeholder="${escapeHtml(
              this.text("editor.nodeTemplates.namePlaceholder")
            )}" />
          </label>

          <div class="node-type-editor__icon">
            <label class="node-type-editor__name">
              <span>${this.text("editor.nodeTemplates.iconLabel")}</span>
              <input data-icon type="text" maxlength="2" placeholder="${escapeHtml(
                this.text("editor.nodeTemplates.iconPlaceholder")
              )}" />
            </label>
            <div class="node-type-editor__icon-picks" data-icon-picks>
              ${ICON_SUGGESTIONS.map(
                (glyph) =>
                  `<button type="button" data-icon-pick="${glyph}" aria-label="${escapeHtml(
                    this.text("editor.nodeTemplates.iconPick", { glyph })
                  )}">${glyph}</button>`
              ).join("")}
            </div>
          </div>

          <p class="node-type-editor__error" data-error role="alert" hidden></p>

          <button type="button" data-action="create" class="node-type-editor__create">
            ${this.text("editor.nodeTemplates.create")}
          </button>
        </form>

        <div class="node-type-editor__actions">
          <button type="button" data-action="add-new" class="node-type-editor__add-new">${ADD_ICON}<span>${this.text("editor.nodeTemplates.addNew")}</span></button>
          <button type="button" data-action="close">${this.text("editor.close")}</button>
        </div>
      </dialog>
    `;
  }

  private bindEvents(): void {
    this.root
      .querySelector<HTMLButtonElement>('[data-action="create"]')
      ?.addEventListener("click", () => this.submit());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="close"]')
      ?.addEventListener("click", () => this.close());

    this.root
      .querySelector<HTMLButtonElement>('[data-action="add-new"]')
      ?.addEventListener("click", () => {
        this.creating = true;
        this.captured = null;
        this.editingType = null;
        this.resetForm();
        this.applyMode();
        this.root.querySelector<HTMLInputElement>("[data-name]")?.focus();
      });

    this.getDialog()?.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });

    this.root
      .querySelector<HTMLElement>("[data-list]")
      ?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;

        const removeType = target.closest<HTMLElement>("[data-delete-type]")
          ?.dataset.deleteType;
        if (removeType) {
          // Removing a template reaches every guide on the site. It must not
          // happen on one click.
          this.pendingDelete = removeType;
          this.renderList();
          this.root
            .querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')
            ?.focus();
          return;
        }

        if (target.closest('[data-action="cancel-delete"]')) {
          this.pendingDelete = null;
          this.renderList();
          return;
        }

        const confirmed = target.closest<HTMLElement>(
          '[data-action="confirm-delete"]'
        )?.dataset.type;
        if (confirmed) {
          this.onDelete?.(confirmed);
          this.specs = this.specs.filter((spec) => spec.type !== confirmed);
          this.pendingDelete = null;
          this.renderList();
          return;
        }

        const editType = target.closest<HTMLElement>("[data-edit-type]")?.dataset
          .editType;
        if (editType) {
          this.editingType = editType;
          this.captured = null;
          this.hideError();
          this.applyMode();
          this.root.querySelector<HTMLInputElement>("[data-name]")?.focus();
        }
      });

    this.root
      .querySelector<HTMLElement>("[data-icon-picks]")
      ?.addEventListener("click", (event) => {
        const pick = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-icon-pick]"
        );
        const input = this.root.querySelector<HTMLInputElement>("[data-icon]");
        if (pick && input) {
          input.value = pick.dataset.iconPick ?? "";
          input.focus();
        }
      });
  }

  open(options: NodeTypeEditorOptions): void {
    this.onCreate = options.onCreate;
    this.onDelete = options.onDelete ?? null;
    this.usageCount = options.usageCount ?? null;
    this.baseLabel = options.baseLabel ?? null;
    this.pendingDelete = null;
    this.onUpdate = options.onUpdate ?? null;
    this.specs = [...options.specs];
    this.captured = options.captured ?? null;
    this.recreatedFrom = options.recreatedFrom ?? null;
    this.editingType = null;
    this.creating = false;
    this.baseTemplates =
      options.baseTemplates && options.baseTemplates.length > 0
        ? options.baseTemplates
        : [...NODE_TEMPLATE_BASES];
    this.returnFocusTo = options.returnFocusTo ?? null;

    // Re-render the chrome in the chosen UI language and rebind to the new elements.
    if (options.locale && options.locale !== this.locale) {
      this.locale = options.locale;
    }
    this.renderChrome();
    this.bindEvents();

    this.renderList();
    this.resetForm();
    this.applyMode(options.suggestedName);
    this.getDialog()?.showModal();
    (this.captured
      ? this.root.querySelector<HTMLInputElement>("[data-name]")
      : this.root.querySelector<HTMLButtonElement>('[data-action="close"]')
    )?.focus();
  }

  /**
   * The form shows when we capture a node (create) or edit a template;
   * otherwise the dialog is a pure manager.
   */
  private applyMode(suggestedName?: string): void {
    const form = this.root.querySelector<HTMLElement>("[data-form]");
    const heading = this.root.querySelector<HTMLElement>("[data-form-heading]");
    const note = this.root.querySelector<HTMLElement>("[data-note]");
    const nameInput = this.root.querySelector<HTMLInputElement>("[data-name]");
    const iconInput = this.root.querySelector<HTMLInputElement>("[data-icon]");
    const submit = this.root.querySelector<HTMLButtonElement>(
      '[data-action="create"]'
    );
    const baseWrap = this.root.querySelector<HTMLElement>("[data-base-wrap]");
    const addNew = this.root.querySelector<HTMLButtonElement>(
      '[data-action="add-new"]'
    );
    const editing = this.editingType
      ? this.specs.find((spec) => spec.type === this.editingType)
      : null;

    // The base type picker shows only when creating from scratch; the "Lägg
    // till" button only in manage mode (not while a form is open).
    if (baseWrap) baseWrap.hidden = !this.creating;
    if (addNew) addNew.hidden = this.creating || Boolean(this.captured) || Boolean(editing);

    if (this.creating) {
      if (form) form.hidden = false;
      if (heading) heading.textContent = this.text("editor.nodeTemplates.createHeading");
      if (note) note.textContent = this.text("editor.nodeTemplates.createNote");
      if (submit) submit.textContent = this.text("editor.nodeTemplates.create");
    } else if (this.captured) {
      if (form) form.hidden = false;
      if (heading) heading.textContent = this.text("editor.nodeTemplates.saveHeading");
      if (note) {
        note.textContent =
          this.recreatedFrom === null
            ? this.text("editor.nodeTemplates.captureNote")
            : this.text(
                this.recreatedFrom > 1
                  ? "editor.nodeTemplates.recreateNote"
                  : "editor.nodeTemplates.recreateNoteSingle",
                { count: this.recreatedFrom }
              );
      }
      if (heading && this.recreatedFrom !== null) {
        heading.textContent = this.text("editor.nodeTemplates.recreateHeading");
      }
      if (submit) submit.textContent = this.text("editor.nodeTemplates.create");
      if (nameInput && suggestedName !== undefined) {
        nameInput.value = suggestedName;
      }
    } else if (editing) {
      if (form) form.hidden = false;
      if (heading) heading.textContent = this.text("editor.nodeTemplates.editHeading");
      if (note) {
        note.textContent = this.text("editor.nodeTemplates.editNote");
      }
      if (submit) submit.textContent = this.text("editor.nodeTemplates.saveChanges");
      if (nameInput) nameInput.value = editing.label;
      if (iconInput) iconInput.value = editing.icon ?? "";
    } else if (form) {
      form.hidden = true;
    }
  }

  private renderList(): void {
    const list = this.root.querySelector<HTMLElement>("[data-list]");
    if (!list) return;

    if (this.specs.length === 0) {
      list.innerHTML = `<li class="node-type-editor__empty">${escapeHtml(
        this.text("editor.nodeTemplates.empty")
      )}</li>`;
      return;
    }

    list.innerHTML = this.specs
      .map((spec) =>
        spec.type === this.pendingDelete
          ? this.renderDeleteConfirmation(spec)
          : `
          <li>
            <span class="node-type-editor__list-label">
              <span class="node-type-editor__list-icon" aria-hidden="true">${escapeHtml(
                spec.icon || this.label(spec).trim()[0]?.toUpperCase() || "•"
              )}</span>
              <strong>${escapeHtml(this.label(spec))}</strong>
            </span>
            <span class="node-type-editor__list-actions">
              <button type="button" class="node-type-editor__edit" data-edit-type="${escapeHtml(
                spec.type
              )}" aria-label="${escapeHtml(
                this.text("editor.nodeTemplates.editAria", { label: this.label(spec) })
              )}">${this.text("editor.nodeTemplates.edit")}</button>
              <button type="button" class="node-type-editor__remove" data-delete-type="${escapeHtml(
                spec.type
              )}" aria-label="${escapeHtml(
                this.text("editor.nodeTemplates.deleteAria", { label: this.label(spec) })
              )}">${TRASH_ICON}<span>${this.text("editor.nodeTemplates.delete")}</span></button>
            </span>
          </li>
        `
      )
      .join("");
  }

  /**
   * The confirmation before a removal.
   *
   * It says three things: that the template is shared, what happens to the nodes
   * (nothing — they simply carry the base type's name again), and that it can be
   * reconstructed. The count concerns the open guide; the others we cannot
   * count, and the text does not pretend otherwise.
   */
  private renderDeleteConfirmation(spec: NodeTemplate): string {
    const antal = this.usageCount?.(spec.type);
    const base = this.baseLabel?.(spec.type) ?? "";

    const usage =
      antal === undefined
        ? ""
        : antal === 0
          ? this.text("editor.nodeTemplates.confirmDeleteUnusedHere")
          : this.text(
              antal === 1
                ? "editor.nodeTemplates.confirmDeleteUsedHere"
                : "editor.nodeTemplates.confirmDeleteUsedHerePlural",
              { count: antal, base }
            );

    return `
      <li class="node-type-editor__confirm" data-confirm-delete="${escapeHtml(
        spec.type
      )}">
        <p class="node-type-editor__confirm-title" role="alert">
          <strong>${escapeHtml(
            this.text("editor.nodeTemplates.confirmDelete", { label: this.label(spec) })
          )}</strong>
        </p>
        <p class="node-type-editor__confirm-body">
          ${escapeHtml(this.text("editor.nodeTemplates.confirmDeleteShared"))}
          ${usage ? escapeHtml(usage) : ""}
        </p>
        <p class="node-type-editor__confirm-note">
          ${escapeHtml(this.text("editor.nodeTemplates.confirmDeleteRecover"))}
        </p>
        <span class="node-type-editor__confirm-actions">
          <button type="button" class="node-type-editor__delete"
                  data-action="confirm-delete" data-type="${escapeHtml(spec.type)}">
            ${this.text("editor.nodeTemplates.confirmDeleteYes")}
          </button>
          <button type="button" data-action="cancel-delete">
            ${this.text("editor.nodeTemplates.confirmDeleteNo")}
          </button>
        </span>
      </li>
    `;
  }

  private resetForm(): void {
    const name = this.root.querySelector<HTMLInputElement>("[data-name]");
    if (name) name.value = "";
    const icon = this.root.querySelector<HTMLInputElement>("[data-icon]");
    if (icon) icon.value = "";
    this.hideError();
  }

  private submit(): void {
    if (!this.captured && !this.editingType && !this.creating) {
      return;
    }

    const nameInput = this.root.querySelector<HTMLInputElement>("[data-name]");
    const name = nameInput?.value.trim() ?? "";

    if (!name) {
      this.showError(this.text("editor.nodeTemplates.nameRequired"));
      nameInput?.focus();
      return;
    }

    const icon =
      this.root.querySelector<HTMLInputElement>("[data-icon]")?.value.trim() ??
      "";

    if (this.editingType) {
      const type = this.editingType;
      this.onUpdate?.(type, { label: name, ...(icon ? { icon } : {}) });
      this.specs = this.specs.map((spec) =>
        spec.type === type
          ? { ...spec, label: name, icon: icon || undefined }
          : spec
      );
      this.editingType = null;
    } else if (this.captured) {
      const spec: NodeTemplate = {
        ...structuredClone(this.captured),
        label: name,
        ...(icon ? { icon } : {}),
      };
      this.onCreate?.(spec);
      this.specs = [...this.specs, spec];
      this.captured = null;
    } else if (this.creating) {
      const base = this.root.querySelector<HTMLSelectElement>(
        "[data-base-template]"
      )?.value;
      const spec = newNodeTemplate(base ?? "");
      if (!spec) {
        // The base type is not registered. Without it the template has no shape
        // to inherit, and keeping quiet would have looked like a broken
        // button.
        this.showError(this.text("editor.nodeTemplates.baseMissing"));
        return;
      }
      spec.label = name;
      if (icon) spec.icon = icon;
      this.onCreate?.(spec);
      this.specs = [...this.specs, spec];
      this.creating = false;
    }

    // Back to manage mode (the form hidden).
    this.renderList();
    this.resetForm();
    this.applyMode();
  }

  private close(): void {
    this.getDialog()?.close();
    this.returnFocusTo?.focus();
  }

  private getDialog(): HTMLDialogElement | null {
    return this.root.querySelector<HTMLDialogElement>("dialog");
  }

  private showError(message: string): void {
    const error = this.root.querySelector<HTMLElement>("[data-error]");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  private hideError(): void {
    const error = this.root.querySelector<HTMLElement>("[data-error]");
    if (error) error.hidden = true;
  }

}

if (!customElements.get("node-type-editor")) {
  customElements.define("node-type-editor", NodeTypeEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "node-type-editor": NodeTypeEditor;
  }
}

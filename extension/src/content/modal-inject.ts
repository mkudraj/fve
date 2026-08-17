/**
 * Helpers for embedding the scout overview inside the FACEIT accept modal
 * (MatchCheckInModal), right below the Accept button.
 */

export const SCOUT_HOST_ID = "fve-in-modal-scout";
const MODAL_WIDTH_STYLE_ID = "fve-modal-width";

/** Widen the FACEIT accept modal so the compact roster has room to breathe. */
function ensureModalWidthStyle(): void {
  if (document.getElementById(MODAL_WIDTH_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MODAL_WIDTH_STYLE_ID;
  style.textContent = `
    [data-dialog-type="MODAL"][class*="styles__StyledModal"],
    [class*="styles__StyledModal"] {
      width: 680px !important;
      max-width: 96vw !important;
    }
  `;
  document.head.appendChild(style);
}

/** Find the accept modal: a FACEIT dialog containing a visible "Accept" button. */
export function findAcceptModal(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-dialog-type="MODAL"], [class*="styles__StyledModal"], [role="dialog"]',
  );
  for (const modal of candidates) {
    if (!isVisible(modal)) continue;
    if (findAcceptButton(modal)) return modal;
  }
  return null;
}

/** Find the "Accept" button inside a modal. */
export function findAcceptButton(modal: HTMLElement): HTMLElement | null {
  const buttons = modal.querySelectorAll<HTMLElement>("button");
  for (const btn of buttons) {
    const text = (btn.textContent ?? "").trim();
    if (/^accept$/i.test(text) || /^accept match$/i.test(text)) {
      if (isVisible(btn)) return btn;
    }
  }
  return null;
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Ensure a shadow host for the scout overview exists inside the modal, placed
 * right after the Accept button's confirmation container. Returns the mount
 * element (inside the shadow root), or null if the modal/button is gone.
 */
export function ensureInModalHost(modal: HTMLElement): HTMLElement | null {
  const acceptBtn = findAcceptButton(modal);
  if (!acceptBtn) return null;

  // Widen the modal once so the roster fits comfortably.
  ensureModalWidthStyle();

  // Reuse an existing host if it's still attached.
  const existing = modal.querySelector<HTMLElement>(`#${SCOUT_HOST_ID}`);
  if (existing?.isConnected) {
    return existing.shadowRoot?.getElementById("fve-in-modal-mount") ?? null;
  }

  const host = document.createElement("div");
  host.id = SCOUT_HOST_ID;

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
  `;
  shadow.appendChild(style);

  const mount = document.createElement("div");
  mount.id = "fve-in-modal-mount";
  shadow.appendChild(mount);

  // Place below the Accept button's confirmation container (or the button itself).
  const anchor =
    acceptBtn.closest<HTMLElement>('[class*="Confirmation"], [class*="confirmation"]') ??
    acceptBtn.parentElement ??
    acceptBtn;
  anchor.after(host);

  return mount;
}

/** Remove the scout host from the modal (used when hiding). */
export function removeInModalHost(): void {
  document.querySelectorAll<HTMLElement>(`#${SCOUT_HOST_ID}`).forEach((el) => el.remove());
}

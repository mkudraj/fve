/**
 * Overlay positioning helpers.
 *
 * On the FACEIT "Match found" (accept) screen we anchor the scout panel
 * directly below the Accept button instead of floating it in a corner.
 */

export interface OverlayPosition {
  x: number;
  y: number;
}

const ACCEPT_BUTTON_RE = /(accept|akcept|zaakcept|przyjmij|aceita|accepter)/i;
const CHECKIN_CTA_RE = /(connect to server|connect server|connect|join server|dołącz|połącz)/i;

/** Rough height of the scout panel, used to avoid overflow when clamping.
 *  10-player roster + footer is ~476px. */
const PANEL_GUESS_HEIGHT = 480;
const PANEL_GUESS_WIDTH = 320;
const EDGE_MARGIN = 8;
const GAP = 12;

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && el.getBoundingClientRect().width === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function area(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return r.width * r.height;
}

function pickLargest(elements: HTMLElement[]): HTMLElement | null {
  if (elements.length === 0) return null;
  elements.sort((a, b) => area(b) - area(a));
  return elements[0];
}

/**
 * Find the best anchor element to dock the scout panel under.
 *
 * Priority:
 *  1. data-testid containing "accept" (case-insensitive).
 *  2. The most prominent visible button/link whose text looks like "Accept"
 *     (covers localized variants such as "Akceptuj").
 *  3. The matchroom check-in CTA ("Connect to server") as a fallback, so the
 *     panel also docks below the ready area once the match is accepted.
 *
 * Returns null when there is nothing to anchor to.
 */
export function findAnchorElement(): HTMLElement | null {
  // 1. testid-based (FACEIT exposes data-testid on many interactive elements).
  try {
    const byTestId = document.querySelector<HTMLElement>(
      '[data-testid*="accept" i], [data-testid*="Accept"]',
    );
    if (byTestId && isVisible(byTestId)) return byTestId;
  } catch {
    // ignore invalid selector edge cases
  }

  // 2+3. text-based, prefer the largest visible clickable.
  const acceptCandidates: HTMLElement[] = [];
  const ctaCandidates: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(
    'button, [role="button"], [data-base-ui-click-trigger]',
  ).forEach((el) => {
    const text = (el.textContent ?? "").trim();
    if (!text || !isVisible(el)) return;
    if (ACCEPT_BUTTON_RE.test(text)) {
      acceptCandidates.push(el);
    } else if (CHECKIN_CTA_RE.test(text)) {
      ctaCandidates.push(el);
    }
  });

  return pickLargest(acceptCandidates) ?? pickLargest(ctaCandidates);
}

/**
 * Compute the overlay position so the panel sits right below the given anchor.
 * Clamps inside the viewport, preferring "below" but flipping above when there
 * is not enough vertical space.
 */
export function computeOverlayPosition(
  anchor: HTMLElement,
  panelWidth: number = PANEL_GUESS_WIDTH,
  panelHeight: number = PANEL_GUESS_HEIGHT,
): OverlayPosition | null {
  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const clampX = (x: number): number =>
    Math.min(Math.max(EDGE_MARGIN, x), Math.max(EDGE_MARGIN, vw - panelWidth - EDGE_MARGIN));
  const clampY = (y: number): number =>
    Math.min(Math.max(EDGE_MARGIN, y), Math.max(EDGE_MARGIN, vh - panelHeight - EDGE_MARGIN));

  // Try below the button first.
  const belowY = rect.bottom + GAP;
  if (belowY + panelHeight <= vh - EDGE_MARGIN) {
    return { x: clampX(rect.left), y: belowY };
  }

  // Not enough room below - place above the button (must fit on screen).
  const aboveY = rect.top - GAP - panelHeight;
  if (aboveY >= EDGE_MARGIN && aboveY + panelHeight <= vh - EDGE_MARGIN) {
    return { x: clampX(rect.left), y: aboveY };
  }

  // Fall back to below, clamped so the panel stays on-screen.
  return { x: clampX(rect.left), y: clampY(belowY) };
}

/** Compute the initial overlay position, anchored below the accept/ready area if present. */
export function computeInitialPosition(): OverlayPosition | null {
  const anchor = findAnchorElement();
  if (!anchor) return null;
  return computeOverlayPosition(anchor);
}

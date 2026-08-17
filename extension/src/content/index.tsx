/**
 * Content script entry point.
 *
 * Creates a Shadow DOM container and renders the React overlay into it.
 * Listens for STATE_CHANGED messages from the background worker.
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Overlay } from "./Overlay.js";
import { ScoutOverview } from "./ScoutOverview.js";
import { ScoutBadge } from "./ScoutBadge.js";
import { computeInitialPosition, type OverlayPosition } from "./positioning.js";
import { loadFaceitStats, StatsCache } from "./stats-loader.js";
import {
  findAcceptModal,
  ensureInModalHost,
  removeInModalHost,
  SCOUT_HOST_ID,
} from "./modal-inject.js";
import type { MatchScoutState } from "@fve/core";
import type { StateChangedMessage } from "../shared/messages.js";

const CONTAINER_ID = "fve-scout-overlay-root";
const BADGE_ID = "fve-scout-badge-root";

function createShadowContainer(): HTMLElement {
  // Avoid duplicates.
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = CONTAINER_ID;
  const shadow = host.attachShadow({ mode: "open" });

  // Inject styles into the shadow root.
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
  `;
  shadow.appendChild(style);

  // Create the React mount point inside the shadow.
  const mount = document.createElement("div");
  mount.id = "fve-overlay";
  shadow.appendChild(mount);

  document.body.appendChild(host);
  return host;
}

// ---- Init ----

const container = createShadowContainer();
const shadowRoot = container.shadowRoot!;
const mountPoint = shadowRoot.getElementById("fve-overlay")!;
const root = createRoot(mountPoint);

// Corner badge that toggles the scout view.
const badgeHost = document.createElement("div");
badgeHost.id = BADGE_ID;
const badgeShadow = badgeHost.attachShadow({ mode: "open" });
const badgeStyle = document.createElement("style");
badgeStyle.textContent = `:host{all:initial}`;
badgeShadow.appendChild(badgeStyle);
const badgeMount = document.createElement("div");
badgeMount.id = "fve-badge";
badgeShadow.appendChild(badgeMount);
document.body.appendChild(badgeHost);
const badgeRoot = createRoot(badgeMount);

let currentState: MatchScoutState = { status: "idle" };
let overlayPosition: OverlayPosition = { x: 20, y: 100 };
let userDragged = false;
/** Whether the user has opened the scout view via the badge. */
let scoutOpen = false;
/** What view is currently rendered - used by the periodic safety net. */
type View = "idle" | "modal" | "badge" | "floating";
let lastView: View = "idle";

// FACEIT stats are loaded same-origin from the content script (see stats-loader).
const statsCache = new StatsCache();
let statsAbort: AbortController | null = null;
let statsMatchId: string | null = null;

/** React root currently mounted inside the accept modal (if any). */
let modalRender: { host: HTMLElement; root: Root } | null = null;

function renderBadge(): void {
  badgeRoot.render(
    React.createElement(ScoutBadge, {
      onClick: () => {
        scoutOpen = true;
        renderOverlay();
      },
    }),
  );
}

function hideBadge(): void {
  badgeRoot.render(null);
}

/** Render the scout overview into the accept modal (below the Accept button). */
function renderInModal(): void {
  const state = currentState;
  if (state.status !== "ready" && state.status !== "partial") {
    hideInModal();
    return;
  }
  const modal = findAcceptModal();
  if (!modal) {
    hideInModal();
    return;
  }
  const mount = ensureInModalHost(modal);
  if (!mount) {
    hideInModal();
    return;
  }
  const host = (mount.getRootNode() as ShadowRoot).host as HTMLElement;
  if (!modalRender || modalRender.host !== host) {
    if (modalRender) modalRender.root.unmount();
    modalRender = { host, root: createRoot(mount) };
  }
  modalRender.root.render(
    React.createElement(ScoutOverview, {
      state,
      onClose: () => {
        scoutOpen = false;
        renderOverlay();
      },
    }),
  );
}

/** Hide/remove the in-modal scout overview. */
function hideInModal(): void {
  if (modalRender) {
    modalRender.root.unmount();
    modalRender = null;
  }
  removeInModalHost();
}

/** Render the floating overlay (fallback when no accept modal is present). */
function renderFloating(): void {
  if (currentState.status === "idle") {
    overlayPosition = { x: 20, y: 100 };
    userDragged = false;
  } else if (!userDragged) {
    // Keep the panel docked below the FACEIT check-in button on every update.
    const next = computeInitialPosition();
    if (next) overlayPosition = next;
  }

  const matchKey =
    currentState.status === "idle"
      ? "idle"
      : (currentState as { matchId?: string }).matchId ?? currentState.status;

  root.render(
    React.createElement(Overlay, {
      key: matchKey,
      state: currentState,
      position: overlayPosition,
      onPositionChange: (p) => {
        userDragged = true;
        overlayPosition = p;
      },
      onDismiss: () => {
        // Collapse back to the badge instead of clearing the match.
        scoutOpen = false;
        renderOverlay();
      },
    }),
  );
}

function renderOverlay(): void {
  const shown = currentState.status !== "idle";

  if (!shown) {
    // No active match - nothing to show.
    scoutOpen = false;
    lastView = "idle";
    statsAbort?.abort();
    statsAbort = null;
    statsMatchId = null;
    hideBadge();
    hideFloating();
    hideInModal();
    return;
  }

  const modal = findAcceptModal();

  // Accept modal is on screen - always auto-open the in-modal scout view.
  if (modal && (currentState.status === "ready" || currentState.status === "partial")) {
    scoutOpen = true;
    lastView = "modal";
    hideBadge();
    hideFloating();
    renderInModal();
    return;
  }

  // No accept modal (matchroom / lobby) - show only the badge until clicked.
  renderBadge();

  if (!scoutOpen) {
    // User hasn't clicked the badge yet - only the badge is visible.
    lastView = "badge";
    hideFloating();
    hideInModal();
    return;
  }

  // Badge clicked - show the floating scout view.
  lastView = "floating";
  hideInModal();
  renderFloating();
}

function hideFloating(): void {
  root.render(null);
}

/**
 * Load FACEIT match stats (same-origin from the content script) for all
 * players in the current ready/partial state. Runs at most once per match;
 * cached results are re-applied automatically when the background re-broadcasts
 * (without restarting in-flight requests).
 */
async function startStatsLoading(): Promise<void> {
  const state = currentState;
  if (state.status !== "ready" && state.status !== "partial") return;

  // Already loading (or done) for this match - do not restart on re-broadcasts.
  if (statsMatchId === state.matchId && statsAbort) return;
  statsMatchId = state.matchId;

  statsAbort?.abort();
  statsAbort = new AbortController();
  const signal = statsAbort.signal;

  const players = [...state.faction1, ...state.faction2];

  // Only fetch players we don't have cached stats for yet.
  const missing = players.filter(
    (p) => p.playerId && !statsCache.has(p.playerId),
  );

  // Mark missing ones as loading, keep the rest as-is, then render once.
  for (const p of missing) p.matchStats = { status: "loading" };
  if (missing.length === 0) return;
  renderOverlay();

  await loadFaceitStats(missing, (updated) => {
    if (updated.playerId && updated.matchStats?.status === "available") {
      statsCache.set(updated.playerId, updated.matchStats.stats);
    }
    // Guard: ignore updates if we moved to a new match / idle meanwhile.
    if (signal.aborted) return;
    applyStatsCache();
    renderOverlay();
  }, signal);
}

/**
 * Apply any cached stats onto a freshly received state (by playerId).
 * Players still being fetched for this match are kept in "loading" state.
 */
function applyStatsCache(): void {
  if (currentState.status !== "ready" && currentState.status !== "partial") return;
  const inFlight =
    !!statsAbort &&
    statsMatchId !== null &&
    statsMatchId === currentState.matchId;
  statsCache.apply(currentState, inFlight);
}

// Listen for state changes from background.
chrome.runtime.onMessage.addListener((message: StateChangedMessage) => {
  if (message.type === "STATE_CHANGED") {
    currentState = message.state;
    applyStatsCache();
    renderOverlay();
    void startStatsLoading();
  }
});

// Request current state on load.
chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
  if (response?.state) {
    currentState = response.state;
    applyStatsCache();
    renderOverlay();
    void startStatsLoading();
  }
}).catch(() => {
  // Background may not be ready yet - that's fine.
});

// Re-render when FACEIT's React adds/removes relevant nodes:
// - the accept modal appears (match found) -> auto-open the in-modal scout
// - FACEIT removes our injected host while the modal is still up (countdown
//   re-renders) -> re-inject it
// React only reacts to our host being removed or a modal-like node being added,
// to avoid the cost of running on every DOM mutation on the (busy) FACEIT page.
let reinjectScheduled = false;
const MODAL_SELECTOR = '[data-dialog-type="MODAL"], [class*="styles__StyledModal"], [role="dialog"]';
function looksLikeModal(el: HTMLElement): boolean {
  return el.matches?.(MODAL_SELECTOR) || !!el.querySelector?.(MODAL_SELECTOR);
}
const observer = new MutationObserver((records) => {
  if (currentState.status !== "ready" && currentState.status !== "partial") return;
  if (reinjectScheduled) return;
  let changed = false;
  for (const r of records) {
    for (const n of r.removedNodes) {
      if (
        (n as HTMLElement)?.id === SCOUT_HOST_ID ||
        (n as HTMLElement)?.querySelector?.(`#${SCOUT_HOST_ID}`)
      ) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && looksLikeModal(n as HTMLElement)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) break;
  }
  if (!changed) return;
  reinjectScheduled = true;
  requestAnimationFrame(() => {
    reinjectScheduled = false;
    renderOverlay();
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Periodic safety net: FACEIT sometimes toggles modal visibility with CSS
// (display: none) instead of mounting/removing DOM nodes, which the observer
// above can't see. Re-render only when the intended view actually changed.
setInterval(() => {
  if (currentState.status !== "ready" && currentState.status !== "partial") return;
  const target: View = findAcceptModal()
    ? "modal"
    : scoutOpen
      ? "floating"
      : "badge";
  if (target !== lastView) renderOverlay();
}, 1000);

// Initial render.
renderOverlay();

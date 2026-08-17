/**
 * Overlay-only preview, meant to run on top of the embedded real FACEIT accept
 * screen (public/faceit-match.html). Renders the scout overview INSIDE the
 * accept modal, right below the Accept button - exactly like the live content
 * script. Renders the full mock state immediately (no promo animation).
 *
 * Also animates the accept countdown (the orange HeaderProgressBar) from 25s
 * down to 0s, looping - so the demo behaves like a real "Match ready" screen.
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ScoutOverview } from "../content/ScoutOverview.js";
import {
  findAcceptModal,
  ensureInModalHost,
  removeInModalHost,
  SCOUT_HOST_ID,
} from "../content/modal-inject.js";
import { buildMockState } from "../shared/mock.js";
import type { MatchScoutState } from "@fve/core";

type ReadyState = Extract<MatchScoutState, { status: "ready" }>;

const state: ReadyState = buildMockState() as ReadyState;
let root: Root | null = null;

const ACCEPT_SECONDS = 25;
const COUNTDOWN_STYLE_ID = "fve-countdown-style";
let countdownRaf = 0;

/** Make the orange accept-countdown bar visible and animate it 25s -> 0s, looping. */
function startAcceptCountdown(): void {
  const modal = findAcceptModal();
  if (!modal) return;

  const fill = modal.querySelector<HTMLElement>(
    '[class*="HeaderProgressBar__ProgressBarFill"]',
  );
  if (!fill) return;

  // The saved page lost the bar's CSS - add it back (thin orange bar on top).
  if (!document.getElementById(COUNTDOWN_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = COUNTDOWN_STYLE_ID;
    style.textContent = `
      [class*="HeaderProgressBar__ProgressBarWrapper"] {
        position: absolute; top: 0; left: 0; right: 0; height: 4px; z-index: 5;
      }
      [class*="HeaderProgressBar__ProgressBarContainer"] {
        height: 100%; width: 100%; background: rgba(255,255,255,0.12);
      }
      [class*="HeaderProgressBar__ProgressBarFill"] {
        position: absolute;
        top: 0;
        left: 0 !important;
        right: auto !important;
        inset-inline-start: 0 !important;
        inset-inline-end: auto !important;
        height: 100%; width: 100%; background: #ff5500;
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // The "Time left to accept" value (h5 right after the label row).
  const label = Array.from(modal.querySelectorAll("span")).find(
    (s) => s.textContent?.trim() === "Time left to accept",
  );
  const valueEl =
    label?.parentElement?.nextElementSibling?.tagName === "H5"
      ? (label.parentElement.nextElementSibling as HTMLElement)
      : modal.querySelector<HTMLElement>("h5");

  // Cancel a previous loop before (re)starting.
  cancelAnimationFrame(countdownRaf);

  const startedAt = performance.now();
  const tick = (now: number): void => {
    const elapsed = (now - startedAt) / 1000;
    let remaining = ACCEPT_SECONDS - elapsed;
    if (remaining <= 0) {
      // Loop: always restart the countdown from 25s.
      fill.style.setProperty("width", "100%", "important");
      if (valueEl) valueEl.textContent = String(ACCEPT_SECONDS);
      countdownRaf = requestAnimationFrame(() => startAcceptCountdown());
      return;
    }
    const pct = (remaining / ACCEPT_SECONDS) * 100;
    fill.style.setProperty("width", `${pct}%`, "important");
    if (valueEl) valueEl.textContent = String(Math.ceil(remaining));
    countdownRaf = requestAnimationFrame(tick);
  };
  countdownRaf = requestAnimationFrame(tick);
}

function mount(): void {
  const modal = findAcceptModal();
  if (!modal) return;
  const mountEl = ensureInModalHost(modal);
  if (!mountEl) return;
  if (root) return;
  root = createRoot(mountEl);
  root.render(React.createElement(ScoutOverview, { state }));
  startAcceptCountdown();
}

// The embedded page is a static snapshot - render as soon as it's painted.
requestAnimationFrame(mount);

// Re-inject if the (static) modal content ever shifts and drops our node.
const observer = new MutationObserver(() => {
  const modal = findAcceptModal();
  if (modal && !modal.querySelector(`#${SCOUT_HOST_ID}`)) {
    root?.unmount();
    root = null;
    mount();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(countdownRaf);
  removeInModalHost();
});

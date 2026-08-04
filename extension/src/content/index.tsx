/**
 * Content script entry point.
 *
 * Creates a Shadow DOM container and renders the React overlay into it.
 * Listens for STATE_CHANGED messages from the background worker.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { Overlay } from "./Overlay.js";
import type { MatchScoutState } from "@fve/core";
import type { StateChangedMessage } from "../shared/messages.js";

const CONTAINER_ID = "fve-scout-overlay-root";

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

let currentState: MatchScoutState = { status: "idle" };

function renderOverlay(): void {
  root.render(
    React.createElement(Overlay, {
      state: currentState,
      onDismiss: () => {
        currentState = { status: "idle" };
        renderOverlay();
      },
    }),
  );
}

// Listen for state changes from background.
chrome.runtime.onMessage.addListener((message: StateChangedMessage) => {
  if (message.type === "STATE_CHANGED") {
    currentState = message.state;
    renderOverlay();
  }
});

// Request current state on load.
chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
  if (response?.state) {
    currentState = response.state;
    renderOverlay();
  }
}).catch(() => {
  // Background may not be ready yet - that's fine.
});

// Initial render.
renderOverlay();

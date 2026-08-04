/**
 * WebSocket listener — captures WebSocket frames sent and received via CDP.
 * Sanitizes frame data before storing.
 */
import CDP from "chrome-remote-interface";
import { sanitizeUrl, sanitizeWebSocketFrame } from "../security/sanitize.js";
import { wallTimeFromMonotonic, normalizeIso, type TimeAnchor } from "./time.js";
import { detectMatchId } from "../analysis/match-id.js";
import type { NetworkEvent, MatchIdDetection } from "../types/index.js";

function isFaceitWs(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith("faceit.com");
  } catch {
    return false;
  }
}

export interface WebSocketListenerOptions {
  onMatchIdDetected?: (detection: MatchIdDetection) => void;
}

export function attachWebSocketListener(
  client: CDP.Client,
  onEvent: (event: NetworkEvent) => void,
  options: WebSocketListenerOptions = {},
): void {
  // Map requestId -> sanitized URL for FACEIT WebSockets.
  const wsUrls = new Map<string, string>();
  let anchor: TimeAnchor | null = null;

  function ts(monotonicSec: number): string {
    const now = new Date().toISOString();
    if (!anchor) {
      anchor = { wallIso: now, monotonicSec };
      return now;
    }
    return normalizeIso(wallTimeFromMonotonic(monotonicSec, anchor));
  }

  // Track WebSocket creation
  client.Network.webSocketCreated((params) => {
    if (!isFaceitWs(params.url)) return;
    wsUrls.set(params.requestId, sanitizeUrl(params.url));
    console.log(`[WS] Connected: ${sanitizeUrl(params.url)}`);
  });

  // Capture sent frames
  client.Network.webSocketFrameSent((params) => {
    const url = wsUrls.get(params.requestId);
    if (!url) return;
    const event: NetworkEvent = {
      timestamp: ts(params.timestamp),
      source: "websocket-sent",
      url,
      wsFrameData: sanitizeWebSocketFrame(params.response.payloadData),
    };
    onEvent(event);
    if (options.onMatchIdDetected) {
      const detection = detectMatchId(event);
      if (detection) options.onMatchIdDetected(detection);
    }
  });

  // Capture received frames
  client.Network.webSocketFrameReceived((params) => {
    const url = wsUrls.get(params.requestId);
    if (!url) return;
    const event: NetworkEvent = {
      timestamp: ts(params.timestamp),
      source: "websocket-received",
      url,
      wsFrameData: sanitizeWebSocketFrame(params.response.payloadData),
    };
    onEvent(event);
    if (options.onMatchIdDetected) {
      const detection = detectMatchId(event);
      if (detection) options.onMatchIdDetected(detection);
    }
  });

  // Log WebSocket closures
  client.Network.webSocketClosed((params) => {
    console.log(`[WS] Closed (${params.timestamp})`);
  });
}

/**
 * WebSocket listener — captures WebSocket frames sent and received via CDP.
 * Sanitizes frame data before storing.
 */
import CDP from "chrome-remote-interface";
import { sanitizeWebSocketFrame } from "../security/sanitize.js";
import type { NetworkEvent } from "../types/index.js";

export function attachWebSocketListener(
  client: CDP.Client,
  onEvent: (event: NetworkEvent) => void,
): void {
  // Track WebSocket creation
  client.Network.webSocketCreated((params) => {
    console.log(`[WS] Connected: ${params.url}`);
  });

  // Capture sent frames
  client.Network.webSocketFrameSent((params) => {
    const event: NetworkEvent = {
      timestamp: new Date(params.timestamp * 1000).toISOString(),
      source: "websocket-sent",
      url: `ws://[REDACTED]`,
      wsFrameData: sanitizeWebSocketFrame(params.response.payloadData),
    };
    onEvent(event);
  });

  // Capture received frames
  client.Network.webSocketFrameReceived((params) => {
    const event: NetworkEvent = {
      timestamp: new Date(params.timestamp * 1000).toISOString(),
      source: "websocket-received",
      url: `ws://[REDACTED]`,
      wsFrameData: sanitizeWebSocketFrame(params.response.payloadData),
    };
    onEvent(event);
  });

  // Log WebSocket closures
  client.Network.webSocketClosed((params) => {
    console.log(`[WS] Closed (${params.timestamp})`);
  });
}

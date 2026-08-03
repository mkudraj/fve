/**
 * Network event listener — captures Fetch/XHR requests and responses via CDP.
 * Sanitizes all sensitive data before storing.
 */
import CDP from "chrome-remote-interface";
import {
  sanitizeHeaders,
  sanitizeUrl,
  sanitizeResponseBody,
} from "../security/sanitize.js";
import type { NetworkEvent } from "../types/index.js";

export function attachNetworkListener(
  client: CDP.Client,
  onEvent: (event: NetworkEvent) => void,
): void {
  const pendingRequests = new Map<string, { url: string; method: string; requestHeaders: Record<string, string>; timestamp: string }>();

  // Track outgoing requests
  client.Network.requestWillBeSent((params) => {
    pendingRequests.set(params.requestId, {
      url: sanitizeUrl(params.request.url),
      method: params.request.method,
      requestHeaders: sanitizeHeaders(params.request.headers),
      timestamp: new Date(params.timestamp * 1000).toISOString(),
    });
  });

  // Track responses
  client.Network.responseReceived((params) => {
    const pending = pendingRequests.get(params.requestId);
    if (!pending) return;

    const event: NetworkEvent = {
      timestamp: new Date(params.timestamp * 1000).toISOString(),
      source: params.type === "XHR" ? "xhr" : "fetch",
      url: pending.url,
      method: pending.method,
      status: params.response.status,
      requestHeaders: pending.requestHeaders,
      responseHeaders: sanitizeHeaders(params.response.headers),
    };

    // Try to get body for JSON/API responses
    const contentType = (params.response.headers["content-type"] || "").toLowerCase();
    if (contentType.includes("json") || contentType.includes("text")) {
      // Mark for body retrieval after loadingFinished
      pendingRequests.set(params.requestId, {
        ...pending,
        url: event.url,
        method: event.method || "GET",
        requestHeaders: event.requestHeaders!,
        timestamp: event.timestamp,
      });
    }

    onEvent(event);
  });

  // Attempt to retrieve response body
  client.Network.loadingFinished(async (params) => {
    const pending = pendingRequests.get(params.requestId);
    if (!pending) {
      pendingRequests.delete(params.requestId);
      return;
    }

    try {
      const result = await client.Network.getResponseBody({
        requestId: params.requestId,
      });

      const body = result.base64Encoded
        ? Buffer.from(result.body, "base64").toString("utf-8")
        : result.body;

      const sanitized = sanitizeResponseBody(body);
      const event: NetworkEvent = {
        timestamp: pending.timestamp,
        source: "fetch",
        url: pending.url,
        method: pending.method,
        requestHeaders: pending.requestHeaders,
        responseBody: sanitized,
      };
      onEvent(event);
    } catch (err) {
      const event: NetworkEvent = {
        timestamp: pending.timestamp,
        source: "fetch",
        url: pending.url,
        error: `Failed to retrieve response body: ${(err as Error).message}`,
      };
      onEvent(event);
    }

    pendingRequests.delete(params.requestId);
  });

  // Track loading failures
  client.Network.loadingFailed((params) => {
    const pending = pendingRequests.get(params.requestId);
    pendingRequests.delete(params.requestId);

    const event: NetworkEvent = {
      timestamp: new Date(params.timestamp * 1000).toISOString(),
      source: "fetch",
      url: pending?.url || "[unknown]",
      error: params.errorText || "Unknown loading error",
    };
    onEvent(event);
  });
}

/**
 * Network event listener — captures Fetch/XHR requests and responses via CDP.
 * Sanitizes all sensitive data before storing.
 */
import CDP from "chrome-remote-interface";
import {
  sanitizeHeaders,
  sanitizeUrl,
  sanitizeResponseBody,
  sanitizePostData,
} from "../security/sanitize.js";
import { wallTimeFromMonotonic, normalizeIso, type TimeAnchor } from "./time.js";
import { detectMatchId } from "../analysis/match-id.js";
import type { NetworkEvent, MatchIdDetection } from "../types/index.js";

// Domains of interest — everything else is filtered out.
const INTEREST_DOMAINS = [
  "faceit.com",
  "api.faceit.com",
  "open.faceit.com",
];

// Resource types we care about (skip images, fonts, media, stylesheets...).
const INTEREST_TYPES = new Set([
  "XHR",
  "Fetch",
  "WebSocket",
  "Document",
  "Script",
]);

interface PendingRequest {
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  timestamp: string;
  requestPostData?: string;
  resourceType?: string;
  mimeType?: string;
}

export interface NetworkListenerOptions {
  /** Called whenever a full matchId is detected in a network event. */
  onMatchIdDetected?: (detection: MatchIdDetection) => void;
  /** Called with the sanitized body of the internal /api/match/v4/match/{matchId} endpoint. */
  onInternalMatchBody?: (body: string) => void;
}

export function attachNetworkListener(
  client: CDP.Client,
  onEvent: (event: NetworkEvent) => void,
  options: NetworkListenerOptions = {},
): void {
  const pendingRequests = new Map<string, PendingRequest>();

  // Anchor for monotonic->wall time conversion, seeded from a request that
  // carries a real wall time where available. CDP `monotonicTime` counts from
  // browser boot; wall clock is captured via Date.now() at the same instant.
  let anchor: TimeAnchor | null = null;

  function ts(monotonicSec: number): string {
    const now = new Date().toISOString();
    if (!anchor) {
      // Establish anchor on the first event (Date.now() is wall time; the CDP
      // timestamp for the same instant is the monotonic clock).
      anchor = { wallIso: now, monotonicSec };
      return now;
    }
    return normalizeIso(wallTimeFromMonotonic(monotonicSec, anchor));
  }

  function isRelevant(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return INTEREST_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  // Track outgoing requests
  client.Network.requestWillBeSent((params) => {
    if (!isRelevant(params.request.url)) return;

    const rType = params.type;
    if (rType && !INTEREST_TYPES.has(rType)) return;

    const timestamp = ts(params.timestamp);
    pendingRequests.set(params.requestId, {
      url: sanitizeUrl(params.request.url),
      method: params.request.method,
      requestHeaders: sanitizeHeaders(params.request.headers),
      requestPostData: params.request.postData
        ? sanitizePostData(params.request.postData)
        : undefined,
      timestamp,
      resourceType: rType,
      mimeType: params.request.headers["content-type"] || params.request.headers["Accept"] || undefined,
    });
  });

  // Track responses
  client.Network.responseReceived((params) => {
    const pending = pendingRequests.get(params.requestId);
    if (!pending) return;

    const event: NetworkEvent = {
      timestamp: ts(params.timestamp),
      source: params.type === "XHR" ? "xhr" : "fetch",
      url: pending.url,
      method: pending.method,
      status: params.response.status,
      resourceType: params.type,
      mimeType: params.response.mimeType,
      requestHeaders: pending.requestHeaders,
      requestPostData: pending.requestPostData,
      responseHeaders: sanitizeHeaders(params.response.headers),
    };

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
        resourceType: pending.resourceType,
        mimeType: pending.mimeType,
        requestHeaders: pending.requestHeaders,
        requestPostData: pending.requestPostData,
        responseBody: sanitized,
      };
      onEvent(event);

      // Emit matchId if detected anywhere in the event.
      if (options.onMatchIdDetected) {
        const detection = detectMatchId(event);
        if (detection) options.onMatchIdDetected(detection);
      }

      // Capture sanitized body of the internal match endpoint, if that's what
      // this request was (used for the internal-api/pre|post-accept fixtures).
      if (options.onInternalMatchBody && pending.url.includes("/api/match/v4/match/")) {
        options.onInternalMatchBody(sanitized);
      }
    } catch (err) {
      const event: NetworkEvent = {
        timestamp: pending.timestamp,
        source: "fetch",
        url: pending.url,
        method: pending.method,
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
      timestamp: ts(params.timestamp),
      source: "fetch",
      url: pending?.url || "[unknown]",
      error: params.errorText || "Unknown loading error",
    };
    onEvent(event);
  });
}

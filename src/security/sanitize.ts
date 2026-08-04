/**
 * Sanitize sensitive data from network captures.
 * Masks cookies, Authorization headers, tokens, session IDs, and server IPs.
 */

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-csrf-token",
  "x-xsrf-token",
  "x-auth-token",
]);

const SENSITIVE_PARAMS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "session_id",
  "sessionid",
  "session_token",
  "sessiontoken",
  "sid",
  "jwt",
  "bearer",
  "auth",
  "secret",
  "password",
  "passwd",
]);

const SENSITIVE_COOKIE_NAMES = new Set([
  "session",
  "sid",
  "jwt",
  "auth",
  "token",
  "refresh",
  "csrf",
  "xsrf",
]);

// Regex patterns for sensitive data in bodies
const TOKEN_PATTERNS = [
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, // JWT-like
  /\b[a-f0-9]{32,128}\b/g, // hex tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // actual JWT
];

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else {
      clean[key] = sanitizeValue(key, value);
    }
  }
  return clean;
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const [key, value] of parsed.searchParams.entries()) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function sanitizeResponseBody(body: string): string {
  if (!body) return body;
  return sanitizeText(body);
}

export function sanitizePostData(body: string): string {
  if (!body) return body;
  return sanitizeText(body);
}

export function sanitizeStorageData(
  data: Record<string, string>,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else {
      clean[key] = sanitizeStoredValue(key, value);
    }
  }
  return clean;
}

function sanitizeStoredValue(key: string, value: string): string {
  // Try JSON parse first
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(sanitizeJsonRecursive(parsed));
    }
    throw new Error("scalar");
  } catch {
    // Not JSON object; check whether the whole value is a secret by key context
    if (SENSITIVE_PARAMS.has(key.toLowerCase())) return "[REDACTED]";
    let clean = value;
    for (const pattern of TOKEN_PATTERNS) {
      clean = clean.replace(pattern, "[REDACTED-TOKEN]");
    }
    return clean;
  }
}

/**
 * Sanitize arbitrary text: parse as JSON if possible, otherwise mask tokens.
 */
function sanitizeText(body: string): string {
  // First try to parse as JSON and sanitize recursively
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      return JSON.stringify(sanitizeJsonRecursive(parsed));
    }
    throw new Error("not object");
  } catch {
    // Not JSON (or scalar), sanitize as plain text
    let clean = body;
    for (const pattern of TOKEN_PATTERNS) {
      clean = clean.replace(pattern, "[REDACTED-TOKEN]");
    }
    return clean;
  }
}

export function sanitizeCookies(cookieString: string): string {
  const parts = cookieString.split(";").map((part) => {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const name = trimmed.substring(0, eqIdx);
      if (SENSITIVE_COOKIE_NAMES.has(name.toLowerCase())) {
        return `${name}=[REDACTED]`;
      }
    }
    return trimmed;
  });
  return parts.join("; ");
}

export function sanitizeWebSocketFrame(data: string): string {
  // Try JSON, then fall back to text token masking
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(sanitizeJsonRecursive(parsed));
  } catch {
    let clean = data;
    for (const pattern of TOKEN_PATTERNS) {
      clean = clean.replace(pattern, "[REDACTED-TOKEN]");
    }
    return clean;
  }
}

function sanitizeJsonRecursive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    for (const pattern of TOKEN_PATTERNS) {
      if (pattern.test(obj)) return "[REDACTED-TOKEN]";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJsonRecursive);
  }
  if (typeof obj === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = sanitizeJsonRecursive(value);
      }
    }
    return clean;
  }
  return obj;
}

function sanitizeValue(key: string, value: string): string {
  if (!value) return value;
  const lowerKey = key.toLowerCase();
  if (SENSITIVE_PARAMS.has(lowerKey)) return "[REDACTED]";

  // Check if value looks like a cookie string
  if (lowerKey === "set-cookie" || lowerKey.includes("cookie")) {
    return sanitizeCookies(value);
  }

  // Check for token patterns in value
  for (const pattern of TOKEN_PATTERNS) {
    if (pattern.test(value)) return "[REDACTED-TOKEN]";
  }

  return value;
}

export function redactAllTokens(input: string): string {
  let result = input;
  for (const pattern of TOKEN_PATTERNS) {
    result = result.replace(pattern, "[REDACTED-TOKEN]");
  }
  return result;
}

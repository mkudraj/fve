// ---- Core event types ----

export interface NetworkEvent {
  timestamp: string;
  source: "fetch" | "xhr" | "websocket-sent" | "websocket-received";
  url: string;
  method?: string;
  status?: number;
  resourceType?: string;
  mimeType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestPostData?: string;
  responseBody?: string;
  wsFrameData?: string;
  error?: string;
}

export interface DomPlayerCard {
  nickname: string;
  profileHref: string | null;
  dataTestId: string | null;
  dataPlayerId: string | null;
  dataId: string | null;
  ariaLabel: string | null;
  imgAlt: string | null;
  imgSrc: string | null;
  parentChain: string[];
}

export interface DomSnapshot {
  capturedAt: string;
  markerKey: string | null;
  url: string;
  playerCards: DomPlayerCard[];
  usedSelectors: string[];
}

export interface TimeMarker {
  timestamp: string;
  key: string;
  label: string;
}

export interface MatchHit {
  timestamp: string;
  source: string;
  url: string;
  path: string;
  value: string;
  phase: "pre-reveal" | "post-reveal" | "unknown";
}

export interface MatchIdDetection {
  timestamp: string;
  matchId: string;
  source: string;
  url: string;
}

/** Result of a FACEIT Data API request. */
export interface DataApiRecord {
  matchId: string;
  phase: "pre_accept" | "post_accept_immediate" | "post_accept_delayed";
  requestTimestamp: string;
  responseTimestamp: string;
  httpStatus: number;
  ok: boolean;
  sanitizedBody: string | null;
  /** Parsed response kept in memory for diffing; stripped before persisting. */
  rawParsed?: unknown;
  error: string | null;
}

/** Captured body of the internal /api/match/v4/match/{matchId} endpoint. */
export interface InternalMatchRecord {
  matchId: string;
  phase: "pre_accept" | "post_accept";
  timestamp: string;
  sanitizedBody: string | null;
}

/** Final classification answer for the investigation. */
export type InvestigationAnswer =
  | "YES — roster available before Accept"
  | "NO — match exists but roster is redacted"
  | "NO — match is not public in Data API before Accept"
  | "INCONCLUSIVE — test or authorization failed";

export interface SessionReport {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  markers: TimeMarker[];
  events: NetworkEvent[];
  hits: MatchHit[];
  findings: Finding[];
  summary: ReportSummary;

  matchId: string | null;
  matchIdDetectedAt: string | null;
  matchIdSource: string | null;
  dataApi: DataApiRecord[];
  internal: InternalMatchRecord[];
  answer: InvestigationAnswer | null;
  verdict: string;
}

export interface Finding {
  question: string;
  answer: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface ReportSummary {
  matchIdFirstSeen: string | null;
  matchIdBeforeReveal: boolean;
  rosterFirstSeen: string | null;
  rosterBeforeReveal: boolean;
  mapFirstSeen: string | null;
  mapBeforeReveal: boolean;
  serverFirstSeen: string | null;
  serverBeforeReveal: boolean;
  dataSource: string | null;
  recommendation: string;
  table: ReportRow[];
}

export interface ReportRow {
  data: string;
  firstSeen: string;
  beforeReveal: string;
  source: string;
  confidence: string;
}

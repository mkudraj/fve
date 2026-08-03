// ---- Core event types ----

export interface NetworkEvent {
  timestamp: string;
  source: "fetch" | "xhr" | "websocket-sent" | "websocket-received";
  url: string;
  method?: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  wsFrameData?: string;
  error?: string;
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

export interface SessionReport {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  markers: TimeMarker[];
  events: NetworkEvent[];
  hits: MatchHit[];
  findings: Finding[];
  summary: ReportSummary;
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

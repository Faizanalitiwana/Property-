export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type PageAudit = {
  url: string;
  status: number | null;
  finalUrl: string;
  contentType: string;

  title: string;
  metaDescription: string;
  h1Count: number;

  canonical: string;
  robots: string;

  wordCount: number;
  internalLinks: number;
  externalLinks: number;

  depth: number;

  error?: string;
};

export type AuditIssue = {
  severity: Severity;

  code: string;
  title: string;
  detail: string;

  url?: string;
};

export type AuditSourceStatus =
  | "verified"
  | "calculated"
  | "not_connected";

export type AuditSource = {
  name: string;
  status: AuditSourceStatus;
};

export type AuditSummary = {
  score: number;

  critical: number;
  high: number;
  medium: number;
  low: number;

  brokenLinks: number;
  redirects: number;

  missingTitles: number;
  missingDescriptions: number;
  missingH1: number;
};

export type AuditResult = {
  domain: string;

  startedAt: string;
  completedAt: string;

  pagesScanned: number;

  pages: PageAudit[];

  issues: AuditIssue[];

  summary: AuditSummary;

  sources: AuditSource[];
};

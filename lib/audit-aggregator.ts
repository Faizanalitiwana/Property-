import type { AuditIssue, PageAudit } from "@/types/audit";
import type { TechnicalAuditResult } from "@/lib/technical-audit";

export type AuditPageResult = {
  page: PageAudit;
  technical: TechnicalAuditResult;
};

export type WebsiteAuditSummary = {
  pagesScanned: number;
  successfulPages: number;
  failedPages: number;

  healthScore: number;

  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;

  totalInternalLinks: number;
  totalExternalLinks: number;
  totalWords: number;

  pagesWithMissingTitle: number;
  pagesWithMissingDescription: number;
  pagesWithMissingH1: number;
  pagesWithMissingCanonical: number;

  pagesWithNoindex: number;
  pagesWithMissingAlt: number;
};

export type AggregatedAudit = {
  pages: AuditPageResult[];
  issues: AuditIssue[];
  summary: WebsiteAuditSummary;
};

function countIssues(
  issues: AuditIssue[],
  severity: AuditIssue["severity"]
): number {
  return issues.filter(
    (issue) => issue.severity === severity
  ).length;
}

function countByCode(
  issues: AuditIssue[],
  code: string
): number {
  return issues.filter(
    (issue) => issue.code === code
  ).length;
}

function calculateHealthScore(
  pages: AuditPageResult[]
): number {
  if (pages.length === 0) {
    return 100;
  }

  const totalScore = pages.reduce(
    (total, result) =>
      total + result.technical.score,
    0
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        totalScore / pages.length
      )
    )
  );
}

function createIssues(
  pages: AuditPageResult[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const result of pages) {
    issues.push(
      ...result.technical.issues
    );
  }

  return issues;
}

export function aggregateAuditResults(
  pages: AuditPageResult[]
): AggregatedAudit {
  const issues =
    createIssues(pages);

  const successfulPages =
    pages.filter(
      (result) =>
        result.page.status !== null &&
        result.page.status >= 200 &&
        result.page.status < 400
    ).length;

  const failedPages =
    pages.length -
    successfulPages;

  const totalInternalLinks =
    pages.reduce(
      (total, result) =>
        total +
        result.page.internalLinks,
      0
    );

  const totalExternalLinks =
    pages.reduce(
      (total, result) =>
        total +
        result.page.externalLinks,
      0
    );

  const totalWords =
    pages.reduce(
      (total, result) =>
        total +
        result.page.wordCount,
      0
    );

  const summary: WebsiteAuditSummary = {
    pagesScanned: pages.length,

    successfulPages,

    failedPages,

    healthScore:
      calculateHealthScore(pages),

    criticalIssues:
      countIssues(
        issues,
        "critical"
      ),

    highIssues:
      countIssues(
        issues,
        "high"
      ),

    mediumIssues:
      countIssues(
        issues,
        "medium"
      ),

    lowIssues:
      countIssues(
        issues,
        "low"
      ),

    totalInternalLinks,

    totalExternalLinks,

    totalWords,

    pagesWithMissingTitle:
      countByCode(
        issues,
        "MISSING_TITLE"
      ),

    pagesWithMissingDescription:
      countByCode(
        issues,
        "MISSING_META_DESCRIPTION"
      ),

    pagesWithMissingH1:
      countByCode(
        issues,
        "MISSING_H1"
      ),

    pagesWithMissingCanonical:
      countByCode(
        issues,
        "MISSING_CANONICAL"
      ),

    pagesWithNoindex:
      countByCode(
        issues,
        "NOINDEX_DETECTED"
      ),

    pagesWithMissingAlt:
      countByCode(
        issues,
        "MISSING_IMAGE_ALT"
      ),
  };

  return {
    pages,
    issues,
    summary,
  };
}

export function sortAuditIssues(
  issues: AuditIssue[]
): AuditIssue[] {
  const priority: Record<
    AuditIssue["severity"],
    number
  > = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  };

  return [...issues].sort(
    (a, b) =>
      priority[b.severity] -
      priority[a.severity]
  );
}

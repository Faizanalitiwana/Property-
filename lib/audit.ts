import type {
  AuditIssue,
  AuditResult,
  AuditSummary,
  PageAudit
} from "@/types/audit";

export function calculateSummary(
  pages: PageAudit[],
  issues: AuditIssue[]
): AuditSummary {
  const critical = issues.filter(
    (issue) => issue.severity === "critical"
  ).length;

  const high = issues.filter(
    (issue) => issue.severity === "high"
  ).length;

  const medium = issues.filter(
    (issue) => issue.severity === "medium"
  ).length;

  const low = issues.filter(
    (issue) => issue.severity === "low"
  ).length;

  const brokenLinks = pages.filter(
    (page) =>
      page.status !== null &&
      (page.status >= 400 || page.status === 0)
  ).length;

  const redirects = pages.filter(
    (page) =>
      page.status !== null &&
      page.status >= 300 &&
      page.status < 400
  ).length;

  const missingTitles = pages.filter(
    (page) => !page.title.trim()
  ).length;

  const missingDescriptions = pages.filter(
    (page) => !page.metaDescription.trim()
  ).length;

  const missingH1 = pages.filter(
    (page) => page.h1Count === 0
  ).length;

  const deductions =
    critical * 15 +
    high * 7 +
    medium * 3 +
    low;

  const score = Math.max(
    0,
    Math.min(100, 100 - deductions)
  );

  return {
    score,
    critical,
    high,
    medium,
    low,
    brokenLinks,
    redirects,
    missingTitles,
    missingDescriptions,
    missingH1
  };
}

export function buildAuditResult(
  domain: string,
  pages: PageAudit[],
  issues: AuditIssue[],
  startedAt: string
): AuditResult {
  const completedAt = new Date().toISOString();

  return {
    domain,
    startedAt,
    completedAt,
    pagesScanned: pages.length,
    pages,
    issues,
    summary: calculateSummary(pages, issues),
    sources: [
      {
        name: "Direct Website Crawl",
        status: "verified"
      },
      {
        name: "Technical SEO Analysis",
        status: "calculated"
      },
      {
        name: "Google Search Console",
        status: "not_connected"
      },
      {
        name: "Google Analytics",
        status: "not_connected"
      },
      {
        name: "Backlink Providers",
        status: "not_connected"
      }
    ]
  };
}

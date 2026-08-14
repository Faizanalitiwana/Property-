import type { AuditIssue } from "@/types/audit";
import type { ParsedPage } from "@/lib/crawl-parser";

export type TechnicalAuditInput = {
  page: ParsedPage;
  url: string;
  status: number | null;
  finalUrl: string;
};

export type TechnicalAuditResult = {
  issues: AuditIssue[];
  score: number;
};

function addIssue(
  issues: AuditIssue[],
  issue: AuditIssue
): void {
  issues.push(issue);
}

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function auditStatus(
  status: number | null,
  url: string,
  issues: AuditIssue[]
): void {
  if (status === null) {
    addIssue(issues, {
      severity: "critical",
      code: "FETCH_FAILED",
      title: "Page could not be fetched",
      detail:
        "The page could not be reached during the audit.",
      url,
    });

    return;
  }

  if (status >= 500) {
    addIssue(issues, {
      severity: "critical",
      code: "SERVER_ERROR",
      title: "Server error",
      detail:
        `The page returned HTTP status ${status}.`,
      url,
    });

    return;
  }

  if (status >= 400) {
    addIssue(issues, {
      severity: "high",
      code: "CLIENT_ERROR",
      title: "Client error",
      detail:
        `The page returned HTTP status ${status}.`,
      url,
    });

    return;
  }

  if (status >= 300 && status < 400) {
    addIssue(issues, {
      severity: "medium",
      code: "REDIRECT",
      title: "Page redirects",
      detail:
        `The requested URL returned HTTP status ${status}.`,
      url,
    });
  }
}

function auditTitle(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  const title = normalizeText(page.title);

  if (!title) {
    addIssue(issues, {
      severity: "high",
      code: "MISSING_TITLE",
      title: "Missing page title",
      detail:
        "This page does not contain an HTML title.",
      url,
    });

    return;
  }

  if (title.length < 30) {
    addIssue(issues, {
      severity: "low",
      code: "SHORT_TITLE",
      title: "Short page title",
      detail:
        "The page title is shorter than the recommended range.",
      url,
    });
  }

  if (title.length > 60) {
    addIssue(issues, {
      severity: "medium",
      code: "LONG_TITLE",
      title: "Long page title",
      detail:
        "The page title is longer than the commonly recommended search-result display range.",
      url,
    });
  }
}

function auditMetaDescription(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  const description =
    normalizeText(page.metaDescription);

  if (!description) {
    addIssue(issues, {
      severity: "high",
      code: "MISSING_META_DESCRIPTION",
      title: "Missing meta description",
      detail:
        "This page does not contain a meta description.",
      url,
    });

    return;
  }

  if (description.length < 70) {
    addIssue(issues, {
      severity: "low",
      code: "SHORT_META_DESCRIPTION",
      title: "Short meta description",
      detail:
        "The meta description is shorter than the commonly recommended range.",
      url,
    });
  }

  if (description.length > 160) {
    addIssue(issues, {
      severity: "medium",
      code: "LONG_META_DESCRIPTION",
      title: "Long meta description",
      detail:
        "The meta description is longer than the commonly recommended search-result display range.",
      url,
    });
  }
}

function auditHeadings(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  if (page.h1Count === 0) {
    addIssue(issues, {
      severity: "high",
      code: "MISSING_H1",
      title: "Missing H1 heading",
      detail:
        "This page does not contain an H1 heading.",
      url,
    });
  }

  if (page.h1Count > 1) {
    addIssue(issues, {
      severity: "medium",
      code: "MULTIPLE_H1",
      title: "Multiple H1 headings",
      detail:
        `This page contains ${page.h1Count} H1 headings.`,
      url,
    });
  }
}

function auditContent(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  if (page.wordCount < 100) {
    addIssue(issues, {
      severity: "medium",
      code: "THIN_CONTENT",
      title: "Very low visible word count",
      detail:
        `The page contains approximately ${page.wordCount} visible words.`,
      url,
    });
  }
}

function auditCanonical(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  const canonical =
    normalizeText(page.canonical);

  if (!canonical) {
    addIssue(issues, {
      severity: "medium",
      code: "MISSING_CANONICAL",
      title: "Missing canonical URL",
      detail:
        "This page does not expose a canonical link element.",
      url,
    });
  }
}

function auditRobots(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  const robots =
    normalizeText(page.robots).toLowerCase();

  if (!robots) {
    return;
  }

  if (
    robots.includes("noindex") &&
    !robots.includes("index")
  ) {
    addIssue(issues, {
      severity: "medium",
      code: "NOINDEX",
      title: "Page is marked noindex",
      detail:
        "The robots meta directive contains noindex.",
      url,
    });
  }
}

function auditImages(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  if (page.missingAltImages > 0) {
    addIssue(issues, {
      severity: "medium",
      code: "MISSING_IMAGE_ALT",
      title: "Images missing alt attributes",
      detail:
        `${page.missingAltImages} image(s) do not contain an alt attribute.`,
      url,
    });
  }
}

function auditOpenGraph(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  if (!page.openGraph.title) {
    addIssue(issues, {
      severity: "low",
      code: "MISSING_OG_TITLE",
      title: "Missing Open Graph title",
      detail:
        "The page does not contain an og:title value.",
      url,
    });
  }

  if (!page.openGraph.description) {
    addIssue(issues, {
      severity: "low",
      code: "MISSING_OG_DESCRIPTION",
      title: "Missing Open Graph description",
      detail:
        "The page does not contain an og:description value.",
      url,
    });
  }

  if (!page.openGraph.image) {
    addIssue(issues, {
      severity: "low",
      code: "MISSING_OG_IMAGE",
      title: "Missing Open Graph image",
      detail:
        "The page does not contain an og:image value.",
      url,
    });
  }
}

function auditStructuredData(
  page: ParsedPage,
  url: string,
  issues: AuditIssue[]
): void {
  if (page.structuredData.length === 0) {
    addIssue(issues, {
      severity: "low",
      code: "NO_STRUCTURED_DATA",
      title: "No structured data detected",
      detail:
        "No JSON-LD structured data block was detected on this page.",
      url,
    });
  }
}

function calculateScore(
  issues: AuditIssue[]
): number {
  let deduction = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case "critical":
        deduction += 20;
        break;

      case "high":
        deduction += 10;
        break;

      case "medium":
        deduction += 5;
        break;

      case "low":
        deduction += 2;
        break;

      case "info":
        break;

      default:
        break;
    }
  }

  return Math.max(
    0,
    Math.min(100, 100 - deduction)
  );
}

export function analyzeTechnicalPage(
  input: TechnicalAuditInput
): TechnicalAuditResult {
  const issues: AuditIssue[] = [];

  const page = input.page;
  const url = input.url;

  auditStatus(
    input.status,
    url,
    issues
  );

  auditTitle(
    page,
    url,
    issues
  );

  auditMetaDescription(
    page,
    url,
    issues
  );

  auditHeadings(
    page,
    url,
    issues
  );

  auditContent(
    page,
    url,
    issues
  );

  auditCanonical(
    page,
    url,
    issues
  );

  auditRobots(
    page,
    url,
    issues
  );

  auditImages(
    page,
    url,
    issues
  );

  auditOpenGraph(
    page,
    url,
    issues
  );

  auditStructuredData(
    page,
    url,
    issues
  );

  const score =
    calculateScore(issues);

  return {
    issues,
    score,
  };
}

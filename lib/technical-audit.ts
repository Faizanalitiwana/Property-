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

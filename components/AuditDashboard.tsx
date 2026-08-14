"use client";

import { useState } from "react";

type AuditResponse = {
  pages: Array<{
    page: {
      url: string;
      finalUrl: string;
      status: number | null;
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
  }>;
  issues: Array<{
    severity: string;
    code: string;
    title: string;
    detail: string;
    url?: string;
  }>;
  summary: {
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
  startedAt: string;
  completedAt: string;
};

type ApiResponse = {
  success: boolean;
  data?: AuditResponse;
  error?: string;
};

export default function AuditDashboard() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] =
    useState<AuditResponse | null>(null);
  const [error, setError] = useState("");

  function normalizeInputUrl(value: string): string {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://")
    ) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  async function runAudit() {
    const rawUrl = domain.trim();

    if (!rawUrl) {
      setError("Website URL is required.");
      return;
    }

    const url = normalizeInputUrl(rawUrl);

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/audit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            maxPages: 25,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Website audit could not be completed."
        );
      }

      if (!data.data) {
        throw new Error(
          "Audit completed but no audit data was returned."
        );
      }

      setResult(data.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Website audit could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">
          TOOLNEST · PRIVATE WEBSITE INTELLIGENCE
        </p>

        <h1>
          Website Intelligence Command Center
        </h1>

        <p className="subtitle">
          Technical website crawling, SEO health
          analysis and verified website intelligence
          in one private workspace.
        </p>

        <div className="audit-box">
          <label htmlFor="domain">
            Website domain
          </label>

          <div className="input-row">
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(event) =>
                setDomain(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !loading
                ) {
                  runAudit();
                }
              }}
              placeholder="https://example.com"
              autoComplete="url"
              disabled={loading}
            />

            <button
              type="button"
              onClick={runAudit}
              disabled={
                loading ||
                !domain.trim()
              }
            >
              {loading
                ? "Auditing..."
                : "Run Website Audit"}
            </button>
          </div>

          <p className="privacy-note">
            Current audit uses direct website crawl
            data. External traffic, rankings,
            backlinks and analytics will only be
            displayed after verified integrations are
            connected.
          </p>
        </div>
      </section>

      {loading && (
        <section className="status-box">
          <div className="loader" />

          <div>
            <strong>
              Analyzing website...
            </strong>

            <p>
              Crawling pages and checking technical
              website signals.
            </p>
          </div>
        </section>
      )}

      {error && (
        <section className="error-box">
          <strong>
            Audit failed
          </strong>

          <p>{error}</p>
        </section>
      )}

      {result && !loading && (
        <>
          <section className="stats-grid">
            <StatCard
              label="Health Score"
              value={`${result.summary.healthScore}/100`}
            />

            <StatCard
              label="Pages Scanned"
              value={String(
                result.summary.pagesScanned
              )}
            />

            <StatCard
              label="Successful Pages"
              value={String(
                result.summary.successfulPages
              )}
            />

            <StatCard
              label="Failed Pages"
              value={String(
                result.summary.failedPages
              )}
            />

            <StatCard
              label="Critical"
              value={String(
                result.summary.criticalIssues
              )}
            />

            <StatCard
              label="High"
              value={String(
                result.summary.highIssues
              )}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>
                  Audit Findings
                </h2>

                <p>
                  {result.pages[0]?.page.finalUrl ||
                    result.pages[0]?.page.url ||
                    "Website audit"}
                </p>
              </div>

              <span className="verified">
                Direct Crawl Verified
              </span>
            </div>

            {result.issues.length === 0 ? (
              <div className="success-box">
                No technical issues were detected
                within the current crawl scope.
              </div>
            ) : (
              <div className="issues-list">
                {result.issues
                  .slice(0, 100)
                  .map((issue, index) => (
                    <article
                      className="issue"
                      key={`${issue.code}-${issue.url}-${index}`}
                    >
                      <span
                        className={`severity ${issue.severity}`}
                      >
                        {issue.severity}
                      </span>

                      <div className="issue-content">
                        <strong>
                          {issue.title}
                        </strong>

                        <p>
                          {issue.detail}
                        </p>

                        {issue.url && (
                          <code>
                            {issue.url}
                          </code>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>
              Current Audit Scope
            </h2>

            <div className="scope-grid">
              <ScopeItem
                label="Missing Titles"
                value={
                  result.summary
                    .pagesWithMissingTitle
                }
              />

              <ScopeItem
                label="Missing Descriptions"
                value={
                  result.summary
                    .pagesWithMissingDescription
                }
              />

              <ScopeItem
                label="Missing H1"
                value={
                  result.summary
                    .pagesWithMissingH1
                }
              />

              <ScopeItem
                label="Missing Canonical"
                value={
                  result.summary
                    .pagesWithMissingCanonical
                }
              />

              <ScopeItem
                label="Noindex Pages"
                value={
                  result.summary
                    .pagesWithNoindex
                }
              />

              <ScopeItem
                label="Missing Image Alt"
                value={
                  result.summary
                    .pagesWithMissingAlt
                }
              />

              <ScopeItem
                label="Medium Issues"
                value={
                  result.summary.mediumIssues
                }
              />

              <ScopeItem
                label="Low Issues"
                value={
                  result.summary.lowIssues
                }
              />

              <ScopeItem
                label="Internal Links"
                value={
                  result.summary.totalInternalLinks
                }
              />

              <ScopeItem
                label="External Links"
                value={
                  result.summary.totalExternalLinks
                }
              />

              <ScopeItem
                label="Total Words"
                value={
                  result.summary.totalWords
                }
              />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

function ScopeItem({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="scope-item">
      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

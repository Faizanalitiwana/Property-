"use client";

import { useState } from "react";

type AuditIssue = {
  severity: string;
  code: string;
  title: string;
  detail: string;
  url?: string;
};

type AuditPage = {
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

type AuditResponse = {
  domain: string;
  pagesScanned: number;
  summary: {
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
    missingCanonical?: number;
    noindexPages?: number;
    missingImageAlt?: number;
    internalLinks?: number;
    externalLinks?: number;
    totalWords?: number;
  };
  issues: AuditIssue[];
  pages?: AuditPage[];
};

type ApiResponse = {
  success: boolean;
  data?: AuditResponse;
  error?: string;
};

export default function AuditDashboard() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState("");

  async function runAudit() {
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError("Website URL is required.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: cleanUrl,
          maxPages: Math.max(
            1,
            Math.min(
              Number.parseInt(maxPages, 10) || 100,
              100
            )
          ),
        }),
      });

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

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !loading) {
      runAudit();
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
          <label htmlFor="website-url">
            Website URL
          </label>

          <div className="input-row">
            <input
              id="website-url"
              type="url"
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/"
              autoComplete="url"
              spellCheck={false}
            />

            <button
              type="button"
              onClick={runAudit}
              disabled={
                loading || !url.trim()
              }
            >
              {loading
                ? "Auditing..."
                : "Run Website Audit"}
            </button>
          </div>

          <label
            htmlFor="max-pages"
            className="secondary-label"
          >
            Maximum pages to scan
          </label>

          <select
            id="max-pages"
            value={maxPages}
            onChange={(event) =>
              setMaxPages(event.target.value)
            }
            disabled={loading}
          >
            <option value="25">
              25 pages
            </option>

            <option value="50">
              50 pages
            </option>

            <option value="100">
              100 pages
            </option>
          </select>

          <p className="privacy-note">
            Current audit uses direct website crawl
            data. External traffic, rankings,
            backlinks and analytics will only be
            displayed after verified integrations
            are connected.
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
              website signals. This may take a
              little time for larger websites.
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
              value={`${result.summary.score}/100`}
            />

            <StatCard
              label="Pages Scanned"
              value={String(
                result.pagesScanned
              )}
            />

            <StatCard
              label="Successful Pages"
              value={String(
                getSuccessfulPages(result)
              )}
            />

            <StatCard
              label="Failed Pages"
              value={String(
                getFailedPages(result)
              )}
            />

            <StatCard
              label="Critical"
              value={String(
                result.summary.critical
              )}
            />

            <StatCard
              label="High"
              value={String(
                result.summary.high
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
                  {result.domain}
                </p>
              </div>

              <span className="verified">
                Direct Crawl Verified
              </span>
            </div>

            {result.issues.length === 0 ? (
              <div className="success-box">
                No technical issues were
                detected within the current
                crawl scope.
              </div>
            ) : (
              <div className="issues-list">
                {result.issues
                  .slice(0, 100)
                  .map(
                    (
                      issue,
                      index
                    ) => (
                      <article
                        className="issue"
                        key={`${issue.code}-${issue.url ?? "no-url"}-${index}`}
                      >
                        <span
                          className={`severity ${normalizeSeverity(
                            issue.severity
                          )}`}
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
                    )
                  )}
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
                    .missingTitles
                }
              />

              <ScopeItem
                label="Missing Descriptions"
                value={
                  result.summary
                    .missingDescriptions
                }
              />

              <ScopeItem
                label="Missing H1"
                value={
                  result.summary
                    .missingH1
                }
              />

              <ScopeItem
                label="Missing Canonical"
                value={
                  result.summary
                    .missingCanonical ?? 0
                }
              />

              <ScopeItem
                label="Noindex Pages"
                value={
                  result.summary
                    .noindexPages ?? 0
                }
              />

              <ScopeItem
                label="Missing Image Alt"
                value={
                  result.summary
                    .missingImageAlt ?? 0
                }
              />

              <ScopeItem
                label="Medium Issues"
                value={
                  result.summary
                    .medium
                }
              />

              <ScopeItem
                label="Low Issues"
                value={
                  result.summary
                    .low
                }
              />

              <ScopeItem
                label="Internal Links"
                value={
                  result.summary
                    .internalLinks ?? 0
                }
              />

              <ScopeItem
                label="External Links"
                value={
                  result.summary
                    .externalLinks ?? 0
                }
              />

              <ScopeItem
                label="Total Words"
                value={
                  result.summary
                    .totalWords ?? 0
                }
              />

              <ScopeItem
                label="Broken Links"
                value={
                  result.summary
                    .brokenLinks
                }
              />

              <ScopeItem
                label="Redirects"
                value={
                  result.summary
                    .redirects
                }
              />
            </div>
          </section>

          {result.pages &&
            result.pages.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Crawled Pages
                    </h2>

                    <p>
                      {result.pages.length} pages
                      returned by the crawler
                    </p>
                  </div>
                </div>

                <div className="pages-list">
                  {result.pages
                    .slice(0, 100)
                    .map(
                      (
                        page,
                        index
                      ) => (
                        <article
                          className="page-row"
                          key={`${page.url}-${index}`}
                        >
                          <div>
                            <strong>
                              {page.url}
                            </strong>

                            <p>
                              Status:{" "}
                              {page.status ??
                                "Failed"}
                              {" · "}
                              Words:{" "}
                              {page.wordCount}
                              {" · "}
                              Internal links:{" "}
                              {
                                page.internalLinks
                              }
                            </p>
                          </div>

                          <span
                            className={
                              page.status !==
                                null &&
                              page.status >=
                                200 &&
                              page.status <
                                400
                                ? "page-ok"
                                : "page-error"
                            }
                          >
                            {page.status !==
                              null &&
                            page.status >=
                              200 &&
                            page.status <
                              400
                              ? "OK"
                              : "ERROR"}
                          </span>
                        </article>
                      )
                    )}
                </div>
              </section>
            )}
        </>
      )}
    </main>
  );
}

function getSuccessfulPages(
  result: AuditResponse
): number {
  if (result.pages) {
    return result.pages.filter(
      (page) =>
        page.status !== null &&
        page.status >= 200 &&
        page.status < 400
    ).length;
  }

  return Math.max(
    0,
    result.pagesScanned -
      getFailedPages(result)
  );
}

function getFailedPages(
  result: AuditResponse
): number {
  if (result.pages) {
    return result.pages.filter(
      (page) =>
        page.status === null ||
        page.status >= 400
    ).length;
  }

  return result.summary.high;
}

function normalizeSeverity(
  severity: string
): string {
  const value =
    severity.toLowerCase();

  if (
    value === "critical"
  ) {
    return "critical";
  }

  if (
    value === "high"
  ) {
    return "high";
  }

  if (
    value === "medium"
  ) {
    return "medium";
  }

  return "low";
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

      <strong>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}

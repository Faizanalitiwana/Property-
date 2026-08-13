"use client";

import { useState } from "react";

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
  };
  issues: Array<{
    severity: string;
    code: string;
    title: string;
    detail: string;
    url?: string;
  }>;
};

export default function AuditDashboard() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState("");

  async function runAudit() {
    if (!domain.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain: domain.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Website audit could not be completed."
        );
      }

      setResult(data);
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

        <h1>Website Intelligence Command Center</h1>

        <p className="subtitle">
          Technical website crawling, SEO health analysis and verified
          website intelligence in one private workspace.
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
              onChange={(event) => setDomain(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runAudit();
                }
              }}
              placeholder="example.com"
              autoComplete="url"
            />

            <button
              type="button"
              onClick={runAudit}
              disabled={loading || !domain.trim()}
            >
              {loading ? "Auditing..." : "Run Website Audit"}
            </button>
          </div>

          <p className="privacy-note">
            Current audit uses direct website crawl data.
            External traffic, rankings, backlinks and analytics
            will only be displayed after verified integrations are
            connected.
          </p>
        </div>
      </section>

      {loading && (
        <section className="status-box">
          <div className="loader" />
          <div>
            <strong>Analyzing website...</strong>
            <p>
              Crawling pages and checking technical website signals.
            </p>
          </div>
        </section>
      )}

      {error && (
        <section className="error-box">
          <strong>Audit failed</strong>
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
              value={String(result.pagesScanned)}
            />

            <StatCard
              label="Critical"
              value={String(result.summary.critical)}
            />

            <StatCard
              label="High"
              value={String(result.summary.high)}
            />

            <StatCard
              label="Broken / Errors"
              value={String(result.summary.brokenLinks)}
            />

            <StatCard
              label="Redirects"
              value={String(result.summary.redirects)}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Audit Findings</h2>
                <p>{result.domain}</p>
              </div>

              <span className="verified">
                Direct Crawl Verified
              </span>
            </div>

            {result.issues.length === 0 ? (
              <div className="success-box">
                No technical issues were detected within the current
                crawl scope.
              </div>
            ) : (
              <div className="issues-list">
                {result.issues.slice(0, 100).map((issue, index) => (
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
                      <strong>{issue.title}</strong>

                      <p>{issue.detail}</p>

                      {issue.url && (
                        <code>{issue.url}</code>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Current Audit Scope</h2>

            <div className="scope-grid">
              <ScopeItem
                label="Missing Titles"
                value={result.summary.missingTitles}
              />

              <ScopeItem
                label="Missing Descriptions"
                value={result.summary.missingDescriptions}
              />

              <ScopeItem
                label="Missing H1"
                value={result.summary.missingH1}
              />

              <ScopeItem
                label="Medium Issues"
                value={result.summary.medium}
              />

              <ScopeItem
                label="Low Issues"
                value={result.summary.low}
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
  value
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
  value
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

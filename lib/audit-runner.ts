import { parseHtml } from "@/lib/crawl-parser";
import {
  analyzeTechnicalPage,
  type TechnicalAuditInput,
} from "@/lib/technical-audit";
import {
  aggregateAuditResults,
  type AuditPageResult,
  type AggregatedAudit,
} from "@/lib/audit-aggregator";

export type AuditFetchResult = {
  url: string;
  finalUrl: string;
  status: number | null;
  html: string;
};

export type AuditRunnerOptions = {
  maxPages?: number;
  signal?: AbortSignal;
};

export type AuditRunnerResult = AggregatedAudit & {
  startedAt: string;
  completedAt: string;
};

const DEFAULT_MAX_PAGES = 25;

function normalizeUrl(url: string): string {
  const parsed = new URL(url);

  parsed.hash = "";

  return parsed.toString();
}

function isSuccessfulStatus(
  status: number | null
): boolean {
  return (
    status !== null &&
    status >= 200 &&
    status < 400
  );
}

async function fetchPage(
  url: string,
  signal?: AbortSignal
): Promise<AuditFetchResult> {
  const response = await fetch(
    url,
    {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent":
          "ToolNest-Website-Intelligence/1.0",
        Accept:
          "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    }
  );

  const finalUrl =
    response.url || url;

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  const html =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
      ? await response.text()
      : "";

  return {
    url,
    finalUrl,
    status: response.status,
    html,
  };
}

function createAuditPage(
  fetched: AuditFetchResult
): AuditPageResult {
  const page = parseHtml(
    fetched.html,
    fetched.finalUrl || fetched.url
  );

  const technicalInput:
    TechnicalAuditInput = {
    page,
    url: fetched.url,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
  };

  const technical =
    analyzeTechnicalPage(
      technicalInput
    );

  const internalLinks =
    page.links.filter(
      (link) => link.isInternal
    ).length;

  const externalLinks =
    page.links.filter(
      (link) => !link.isInternal
    ).length;

  return {
    page: {
      url: fetched.url,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      title: page.title,
      wordCount: page.wordCount,
      internalLinks,
      externalLinks,
    },
    technical,
  };
}

function createFailedPage(
  fetched: AuditFetchResult
): AuditPageResult {
  const page = parseHtml(
    "",
    fetched.finalUrl || fetched.url
  );

  const technicalInput:
    TechnicalAuditInput = {
    page,
    url: fetched.url,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
  };

  const technical =
    analyzeTechnicalPage(
      technicalInput
    );

  return {
    page: {
      url: fetched.url,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      title: "",
      wordCount: 0,
      internalLinks: 0,
      externalLinks: 0,
    },
    technical,
  };
}

export async function runAudit(
  startUrl: string,
  options: AuditRunnerOptions = {}
): Promise<AuditRunnerResult> {
  const startedAt =
    new Date().toISOString();

  const maxPages = Math.max(
    1,
    Math.min(
      options.maxPages ??
        DEFAULT_MAX_PAGES,
      100
    )
  );

  const queue: string[] = [
    normalizeUrl(startUrl),
  ];

  const visited = new Set<string>();

  const results:
    AuditPageResult[] = [];

  while (
    queue.length > 0 &&
    visited.size < maxPages
  ) {
    if (options.signal?.aborted) {
      throw new Error(
        "Website audit was cancelled."
      );
    }

    const currentUrl =
      queue.shift();

    if (!currentUrl) {
      continue;
    }

    const normalized =
      normalizeUrl(currentUrl);

    if (visited.has(normalized)) {
      continue;
    }

    visited.add(normalized);

    let fetched:
      AuditFetchResult;

    try {
      fetched =
        await fetchPage(
          normalized,
          options.signal
        );
    } catch {
      fetched = {
        url: normalized,
        finalUrl: normalized,
        status: null,
        html: "",
      };
    }

    const result =
      fetched.html
        ? createAuditPage(fetched)
        : createFailedPage(fetched);

    results.push(result);

    if (
      !isSuccessfulStatus(
        fetched.status
      )
    ) {
      continue;
    }

    const page =
      parseHtml(
        fetched.html,
        fetched.finalUrl
      );

    for (const link of page.links) {
      if (!link.isInternal) {
        continue;
      }

      const linkUrl =
        normalizeUrl(link.url);

      if (
        !visited.has(linkUrl) &&
        !queue.includes(linkUrl) &&
        visited.size + queue.length <
          maxPages
      ) {
        queue.push(linkUrl);
      }
    }
  }

  const aggregated =
    aggregateAuditResults(
      results
    );

  const completedAt =
    new Date().toISOString();

  return {
    ...aggregated,
    startedAt,
    completedAt,
  };
}

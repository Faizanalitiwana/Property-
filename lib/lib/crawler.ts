import type {
  AuditIssue,
  PageAudit,
} from "@/types/audit";

import {
  isHttpUrl,
  normalizeUrl,
  sameOrigin,
} from "@/lib/url";

const DEFAULT_MAX_PAGES = 150;
const DEFAULT_TIMEOUT = 10000;
const SITEMAP_TIMEOUT = 12000;
const CRAWL_CONCURRENCY = 5;

type CrawlOptions = {
  maxPages?: number;
  timeoutMs?: number;
};

type CrawlResult = {
  pages: PageAudit[];
  issues: AuditIssue[];
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTag(
  html: string,
  tagName: string
): string {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );

  const match = html.match(pattern);

  return match?.[1]
    ? stripHtml(match[1])
    : "";
}

function extractMetaDescription(
  html: string
): string {
  const patterns = [
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return "";
}

function extractCanonical(
  html: string
): string {
  const patterns = [
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return "";
}

function extractRobots(
  html: string
): string {
  const patterns = [
    /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i,
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return "";
}

function extractH1Count(
  html: string
): number {
  return html.match(/<h1\b[^>]*>/gi)?.length ?? 0;
}

function isUsableInternalUrl(
  value: string
): boolean {
  if (!value) {
    return false;
  }

  const decoded = decodeURIComponent(
    value
  );

  /*
   * Ignore template / placeholder URLs.
   * These commonly come from framework-generated links
   * and are not real pages.
   */
  if (
    decoded.includes("{") ||
    decoded.includes("}") ||
    decoded.includes("[") ||
    decoded.includes("]")
  ) {
    return false;
  }

  if (
    decoded.includes("%7B") ||
    decoded.includes("%7D")
  ) {
    return false;
  }

  /*
   * Ignore Next.js/internal framework assets.
   */
  if (
    value.includes("/_next/") ||
    value.includes("/api/")
  ) {
    return false;
  }

  return true;
}

function extractLinks(
  html: string,
  baseUrl: URL
): string[] {
  const links = new Set<string>();

  const regex =
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const href = match[1]?.trim();

    if (!href) {
      continue;
    }

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      href.startsWith("data:")
    ) {
      continue;
    }

    try {
      const url = new URL(
        href,
        baseUrl
      );

      if (
        !isHttpUrl(
          url.toString()
        )
      ) {
        continue;
      }

      if (
        !isUsableInternalUrl(
          url.toString()
        )
      ) {
        continue;
      }

      url.hash = "";
      url.search = "";

      links.add(
        normalizeUrl(
          url.toString()
        )
      );
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...links];
}

function getDepth(
  root: URL,
  current: URL
): number {
  const rootPath =
    root.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

  const currentPath =
    current.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

  return Math.max(
    0,
    currentPath.length -
      rootPath.length
  );
}

async function fetchText(
  url: string,
  timeoutMs: number
): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  text: string;
  finalUrl: string;
}> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal:
          controller.signal,
        headers: {
          "User-Agent":
            "ToolNest-Website-Intelligence/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml,text/xml,*/*",
        },
        cache: "no-store",
      });

    const contentType =
      response.headers.get(
        "content-type"
      ) ?? "";

    const text =
      await response.text();

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      text,
      finalUrl:
        response.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPage(
  url: string,
  timeoutMs: number
): Promise<{
  page: PageAudit;
  links: string[];
}> {
  const result =
    await fetchText(
      url,
      timeoutMs
    );

  const {
    status,
    contentType,
    text: html,
    finalUrl,
  } = result;

  const isHtml =
    contentType
      .toLowerCase()
      .includes("text/html") ||
    contentType
      .toLowerCase()
      .includes(
        "application/xhtml+xml"
      );

  if (!isHtml) {
    return {
      page: {
        url,
        status,
        finalUrl,
        contentType,
        title: "",
        metaDescription: "",
        h1Count: 0,
        canonical: "",
        robots: "",
        wordCount: 0,
        internalLinks: 0,
        externalLinks: 0,
        depth: 0,
      },
      links: [],
    };
  }

  const requestedUrl =
    new URL(url);

  const finalUrlObject =
    new URL(finalUrl);

  const allLinks =
    extractLinks(
      html,
      finalUrlObject
    );

  const internalLinks =
    allLinks.filter(
      (link) => {
        try {
          return sameOrigin(
            requestedUrl,
            new URL(link)
          );
        } catch {
          return false;
        }
      }
    );

  const externalLinks =
    allLinks.length -
    internalLinks.length;

  const text =
    stripHtml(html);

  const page: PageAudit = {
    url,

    status,

    finalUrl,

    contentType,

    title:
      extractTag(
        html,
        "title"
      ),

    metaDescription:
      extractMetaDescription(
        html
      ),

    h1Count:
      extractH1Count(
        html
      ),

    canonical:
      extractCanonical(
        html
      ),

    robots:
      extractRobots(
        html
      ),

    wordCount:
      text
        ? text
            .split(/\s+/)
            .filter(Boolean)
            .length
        : 0,

    internalLinks:
      internalLinks.length,

    externalLinks,

    depth: 0,
  };

  return {
    page,
    links: internalLinks,
  };
}

function extractSitemapUrls(
  xml: string
): string[] {
  const urls = new Set<string>();

  const regex =
    /<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(xml)) !== null
  ) {
    const raw = match[1]
      ?.trim();

    if (!raw) {
      continue;
    }

    const decoded =
      decodeHtml(raw);

    urls.add(decoded);
  }

  return [...urls];
}

async function fetchSitemap(
  sitemapUrl: string
): Promise<string[]> {
  try {
    const result =
      await fetchText(
        sitemapUrl,
        SITEMAP_TIMEOUT
      );

    if (
      !result.ok ||
      !result.text
    ) {
      return [];
    }

    const locations =
      extractSitemapUrls(
        result.text
      );

    return locations;
  } catch {
    return [];
  }
}

async function discoverSitemaps(
  rootUrl: URL
): Promise<string[]> {
  const sitemapCandidates =
    new Set<string>();

  sitemapCandidates.add(
    new URL(
      "/sitemap.xml",
      rootUrl
    ).toString()
  );

  sitemapCandidates.add(
    new URL(
      "/sitemap_index.xml",
      rootUrl
    ).toString()
  );

  /*
   * Also inspect robots.txt for
   * Sitemap: declarations.
   */
  try {
    const robotsUrl =
      new URL(
        "/robots.txt",
        rootUrl
      ).toString();

    const result =
      await fetchText(
        robotsUrl,
        SITEMAP_TIMEOUT
      );

    if (result.ok) {
      const lines =
        result.text.split(
          /\r?\n/
        );

      for (const line of lines) {
        const match =
          line.match(
            /^\s*Sitemap:\s*(.+)\s*$/i
          );

        if (match?.[1]) {
          const sitemap =
            match[1].trim();

          try {
            const absolute =
              new URL(
                sitemap,
                rootUrl
              );

            sitemapCandidates.add(
              absolute.toString()
            );
          } catch {
            // Ignore malformed sitemap URL.
          }
        }
      }
    }
  } catch {
    // Robots is optional.
  }

  return [
    ...sitemapCandidates,
  ];
}

async function discoverFromSitemaps(
  rootUrl: URL,
  maxPages: number
): Promise<string[]> {
  const discovered =
    new Set<string>();

  const sitemapQueue =
    await discoverSitemaps(
      rootUrl
    );

  const visitedSitemaps =
    new Set<string>();

  while (
    sitemapQueue.length > 0 &&
    discovered.size < maxPages
  ) {
    const sitemapUrl =
      sitemapQueue.shift();

    if (!sitemapUrl) {
      continue;
    }

    if (
      visitedSitemaps.has(
        sitemapUrl
      )
    ) {
      continue;
    }

    visitedSitemaps.add(
      sitemapUrl
    );

    const locations =
      await fetchSitemap(
        sitemapUrl
      );

    for (const location of locations) {
      try {
        const url =
          new URL(
            location,
            rootUrl
          );

        if (
          !isHttpUrl(
            url.toString()
          )
        ) {
          continue;
        }

        if (
          !sameOrigin(
            rootUrl,
            url
          )
        ) {
          continue;
        }

        if (
          !isUsableInternalUrl(
            url.toString()
          )
        ) {
          continue;
        }

        url.hash = "";
        url.search = "";

        const normalized =
          normalizeUrl(
            url.toString()
          );

        /*
         * If this looks like another sitemap,
         * process it recursively.
         */
        if (
          normalized.endsWith(
            ".xml"
          ) ||
          normalized.includes(
            "sitemap"
          )
        ) {
          if (
            !visitedSitemaps.has(
              normalized
            )
          ) {
            sitemapQueue.push(
              normalized
            );
          }

          continue;
        }

        discovered.add(
          normalized
        );

        if (
          discovered.size >=
          maxPages
        ) {
          break;
        }
      } catch {
        // Ignore malformed sitemap locations.
      }
    }
  }

  return [
    ...discovered,
  ];
}

async function crawlInBatches(
  urls: string[],
  rootUrl: URL,
  timeoutMs: number,
  pages: PageAudit[],
  issues: AuditIssue[],
  visited: Set<string>,
  queue: string[],
  maxPages: number
): Promise<void> {
  while (
    queue.length > 0 &&
    pages.length < maxPages
  ) {
    const batch: string[] = [];

    while (
      queue.length > 0 &&
      batch.length <
        CRAWL_CONCURRENCY &&
      pages.length +
        batch.length <
        maxPages
    ) {
      const next =
        queue.shift();

      if (!next) {
        continue;
      }

      if (
        visited.has(next)
      ) {
        continue;
      }

      visited.add(next);

      batch.push(next);
    }

    if (
      batch.length === 0
    ) {
      break;
    }

    const results =
      await Promise.allSettled(
        batch.map(
          async (currentUrl) => {
            const parsedUrl =
              new URL(
                currentUrl
              );

            return {
              currentUrl,
              parsedUrl,
              result:
                await fetchPage(
                  currentUrl,
                  timeoutMs
                ),
            };
          }
        )
      );

    for (const settled of results) {
      if (
        pages.length >=
        maxPages
      ) {
        break;
      }

      if (
        settled.status ===
        "rejected"
      ) {
        const currentUrl =
          batch[
            results.indexOf(
              settled
            )
          ];

        if (!currentUrl) {
          continue;
        }

        let parsedUrl:
          | URL
          | null = null;

        try {
          parsedUrl =
            new URL(
              currentUrl
            );
        } catch {
          parsedUrl = null;
        }

        pages.push({
          url: currentUrl,
          status: null,
          finalUrl: currentUrl,
          contentType: "",
          title: "",
          metaDescription: "",
          h1Count: 0,
          canonical: "",
          robots: "",
          wordCount: 0,
          internalLinks: 0,
          externalLinks: 0,
          depth:
            parsedUrl
              ? getDepth(
                  rootUrl,
                  parsedUrl
                )
              : 0,
          error:
            settled.reason instanceof
            Error
              ? settled.reason.message
              : "Unknown crawler error",
        });

        issues.push({
          severity: "high",
          code:
            "PAGE_FETCH_FAILED",
          title:
            "Page could not be analyzed",
          detail:
            "The crawler could not retrieve this page.",
          url: currentUrl,
        });

        continue;
      }

      const {
        currentUrl,
        parsedUrl,
        result,
      } = settled.value;

      result.page.depth =
        getDepth(
          rootUrl,
          parsedUrl
        );

      pages.push(
        result.page
      );

      /*
       * HTTP error
       */
      if (
        result.page.status !==
          null &&
        result.page.status >= 400
      ) {
        issues.push({
          severity: "high",
          code:
            "HTTP_ERROR",
          title:
            "HTTP error detected",
          detail:
            `The page returned HTTP status ${result.page.status}.`,
          url: currentUrl,
        });
      }

      /*
       * Missing title
       */
      if (
        !result.page.title
      ) {
        issues.push({
          severity: "medium",
          code:
            "MISSING_TITLE",
          title:
            "Missing page title",
          detail:
            "This page does not contain a usable HTML title.",
          url: currentUrl,
        });
      }

      /*
       * Missing meta description
       */
      if (
        !result.page
          .metaDescription
      ) {
        issues.push({
          severity: "low",
          code:
            "MISSING_META_DESCRIPTION",
          title:
            "Missing meta description",
          detail:
            "This page does not contain a meta description.",
          url: currentUrl,
        });
      }

      /*
       * Missing H1
       */
      if (
        result.page.h1Count === 0
      ) {
        issues.push({
          severity: "medium",
          code:
            "MISSING_H1",
          title:
            "Missing H1 heading",
          detail:
            "This page does not contain an H1 heading.",
          url: currentUrl,
        });
      }

      /*
       * Discover internal links.
       */
      for (const link of result.links) {
        if (
          visited.has(link)
        ) {
          continue;
        }

        if (
          queue.includes(link)
        ) {
          continue;
        }

        if (
          queue.length >=
          maxPages * 3
        ) {
          break;
        }

        queue.push(link);
      }
    }
  }

  /*
   * Keep TypeScript aware that the
   * urls argument is intentionally
   * accepted for crawl compatibility.
   */
  void urls;
}

export async function crawlWebsite(
  startUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxPages =
    Math.max(
      1,
      Math.min(
        Math.floor(
          options.maxPages ??
            DEFAULT_MAX_PAGES
        ),
        200
      )
    );

  const timeoutMs =
    Math.max(
      3000,
      Math.min(
        Math.floor(
          options.timeoutMs ??
            DEFAULT_TIMEOUT
        ),
        30000
      )
    );

  const rootUrl =
    new URL(startUrl);

  rootUrl.hash = "";
  rootUrl.search = "";

  const normalizedRoot =
    normalizeUrl(
      rootUrl.toString()
    );

  const visited =
    new Set<string>();

  const pages: PageAudit[] =
    [];

  const issues: AuditIssue[] =
    [];

  /*
   * First priority:
   * sitemap.xml / sitemap index /
   * robots.txt sitemap declarations.
   *
   * This is the important fix for
   * websites like ToolNest where many
   * routes may not be discoverable
   * from the homepage HTML.
   */
  const sitemapPages =
    await discoverFromSitemaps(
      rootUrl,
      maxPages
    );

  const queue: string[] =
    [];

  /*
   * Always crawl homepage first.
   */
  queue.push(
    normalizedRoot
  );

  /*
   * Then add sitemap URLs.
   */
  for (const url of sitemapPages) {
    if (
      url ===
      normalizedRoot
    ) {
      continue;
    }

    if (
      !queue.includes(url)
    ) {
      queue.push(url);
    }

    if (
      queue.length >=
      maxPages
    ) {
      break;
    }
  }

  /*
   * Then normal HTML-discovered
   * internal links are added dynamically.
   */
  await crawlInBatches(
    [],
    rootUrl,
    timeoutMs,
    pages,
    issues,
    visited,
    queue,
    maxPages
  );

  /*
   * Remove duplicate pages.
   */
  const uniquePages =
    new Map<
      string,
      PageAudit
    >();

  for (const page of pages) {
    const key =
      normalizeUrl(
        page.url
      );

    if (
      !uniquePages.has(key)
    ) {
      uniquePages.set(
        key,
        page
      );
    }
  }

  return {
    pages: [
      ...uniquePages.values(),
    ].slice(
      0,
      maxPages
    ),
    issues,
  };
}

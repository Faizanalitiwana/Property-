import type {
  AuditIssue,
  PageAudit,
} from "@/types/audit";

import {
  isHttpUrl,
  normalizeUrl,
  sameOrigin,
} from "@/lib/url";

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_TIMEOUT = 10000;

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
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<svg[\s\S]*?<\/svg>/gi,
        " "
      )
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

  if (!match?.[1]) {
    return "";
  }

  return stripHtml(match[1]);
}

function extractMetaDescription(
  html: string
): string {
  const match = html.match(
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i
  );

  if (match?.[1]) {
    return decodeHtml(
      match[1].trim()
    );
  }

  const reversed = html.match(
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["'][^>]*>/i
  );

  return reversed?.[1]
    ? decodeHtml(
        reversed[1].trim()
      )
    : "";
}

function extractCanonical(
  html: string
): string {
  const match = html.match(
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
  );

  if (match?.[1]) {
    return decodeHtml(
      match[1].trim()
    );
  }

  const reversed = html.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
  );

  return reversed?.[1]
    ? decodeHtml(
        reversed[1].trim()
      )
    : "";
}

function extractRobots(
  html: string
): string {
  const match = html.match(
    /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i
  );

  if (match?.[1]) {
    return decodeHtml(
      match[1].trim()
    );
  }

  const reversed = html.match(
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["'][^>]*>/i
  );

  return reversed?.[1]
    ? decodeHtml(
        reversed[1].trim()
      )
    : "";
}

function extractH1Count(
  html: string
): number {
  const matches =
    html.match(
      /<h1\b[^>]*>/gi
    );

  return matches?.length ?? 0;
}

function extractLinks(
  html: string,
  baseUrl: URL
): string[] {
  const links =
    new Set<string>();

  const regex =
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const href =
      match[1]?.trim();

    if (!href) {
      continue;
    }

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const url =
        new URL(
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

      url.hash = "";
      url.search = "";

      links.add(
        normalizeUrl(
          url.toString()
        )
      );
    } catch {
      // Ignore malformed links.
    }
  }

  return [
    ...links,
  ];
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

async function fetchPage(
  url: string,
  timeoutMs: number
): Promise<{
  page: PageAudit;
  links: string[];
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
            "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });

    const contentType =
      response.headers.get(
        "content-type"
      ) ?? "";

    const finalUrl =
      response.url || url;

    if (
      !contentType
        .toLowerCase()
        .includes("text/html") &&
      !contentType
        .toLowerCase()
        .includes(
          "application/xhtml+xml"
        )
    ) {
      return {
        page: {
          url,
          status:
            response.status,
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

    const html =
      await response.text();

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

      status:
        response.status,

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

      wordCount: text
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
  } finally {
    clearTimeout(timeout);
  }
}

export async function crawlWebsite(
  startUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxPages =
    Math.max(
      1,
      Math.min(
        options.maxPages ??
          DEFAULT_MAX_PAGES,
        100
      )
    );

  const timeoutMs =
    Math.max(
      3000,
      Math.min(
        options.timeoutMs ??
          DEFAULT_TIMEOUT,
        30000
      )
    );

  const rootUrl =
    new URL(startUrl);

  const queue: string[] = [
    normalizeUrl(
      rootUrl.toString()
    ),
  ];

  const visited =
    new Set<string>();

  const pages: PageAudit[] =
    [];

  const issues: AuditIssue[] =
    [];

  while (
    queue.length > 0 &&
    pages.length < maxPages
  ) {
    const currentUrl =
      queue.shift();

    if (!currentUrl) {
      break;
    }

    if (
      visited.has(
        currentUrl
      )
    ) {
      continue;
    }

    visited.add(
      currentUrl
    );

    let parsedUrl: URL;

    try {
      parsedUrl =
        new URL(
          currentUrl
        );
    } catch {
      continue;
    }

    if (
      !sameOrigin(
        rootUrl,
        parsedUrl
      )
    ) {
      continue;
    }

    try {
      const result =
        await fetchPage(
          currentUrl,
          timeoutMs
        );

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
          code: "HTTP_ERROR",
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
          code: "MISSING_TITLE",
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
          code: "MISSING_H1",
          title:
            "Missing H1 heading",
          detail:
            "This page does not contain an H1 heading.",
          url: currentUrl,
        });
      }

      /*
       * Add internal links to queue
       */
      for (
        const link of result.links
      ) {
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
          maxPages * 2
        ) {
          break;
        }

        queue.push(link);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown crawler error";

      pages.push({
        url: currentUrl,

        status: null,

        finalUrl:
          currentUrl,

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
          getDepth(
            rootUrl,
            parsedUrl
          ),

        error: message,
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
    }
  }

  return {
    pages,
    issues,
  };
}

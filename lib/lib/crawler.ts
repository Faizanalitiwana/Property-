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
const MAX_SITEMAP_FILES = 50;

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
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
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

  if (!match || !match[1]) {
    return "";
  }

  return stripHtml(match[1]);
}

function extractMetaDescription(
  html: string
): string {
  const normal = html.match(
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i
  );

  if (normal && normal[1]) {
    return decodeHtml(
      normal[1].trim()
    );
  }

  const reversed = html.match(
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']description["'][^>]*>/i
  );

  if (reversed && reversed[1]) {
    return decodeHtml(
      reversed[1].trim()
    );
  }

  return "";
}

function extractCanonical(
  html: string
): string {
  const normal = html.match(
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
  );

  if (normal && normal[1]) {
    return decodeHtml(
      normal[1].trim()
    );
  }

  const reversed = html.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
  );

  if (reversed && reversed[1]) {
    return decodeHtml(
      reversed[1].trim()
    );
  }

  return "";
}

function extractRobots(
  html: string
): string {
  const normal = html.match(
    /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']*)["'][^>]*>/i
  );

  if (normal && normal[1]) {
    return decodeHtml(
      normal[1].trim()
    );
  }

  const reversed = html.match(
    /<meta\b[^>]*\bcontent=["']([^"']*)["'][^>]*\bname=["']robots["'][^>]*>/i
  );

  if (reversed && reversed[1]) {
    return decodeHtml(
      reversed[1].trim()
    );
  }

  return "";
}

function extractH1Count(
  html: string
): number {
  const matches =
    html.match(
      /<h1\b[^>]*>/gi
    );

  return matches
    ? matches.length
    : 0;
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
      match[1]
        ? match[1].trim()
        : "";

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
      // Ignore malformed URLs.
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
      .replace(
        /\/+$/,
        ""
      )
      .split("/")
      .filter(Boolean);

  const currentPath =
    current.pathname
      .replace(
        /\/+$/,
        ""
      )
      .split("/")
      .filter(Boolean);

  return Math.max(
    0,
    currentPath.length -
      rootPath.length
  );
}

function isLikelyHtmlUrl(
  url: string
): boolean {
  try {
    const parsed =
      new URL(url);

    const path =
      parsed.pathname.toLowerCase();

    const blockedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".ico",
      ".css",
      ".js",
      ".map",
      ".pdf",
      ".zip",
      ".rar",
      ".7z",
      ".mp3",
      ".mp4",
      ".webm",
      ".avi",
      ".mov",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".xml",
      ".json",
      ".txt",
      ".csv",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
    ];

    return !blockedExtensions.some(
      (extension) =>
        path.endsWith(extension)
    );
  } catch {
    return false;
  }
}

async function fetchText(
  url: string,
  timeoutMs: number
): Promise<{
  ok: boolean;
  status: number | null;
  contentType: string;
  text: string;
  finalUrl: string;
}> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          redirect: "follow",
          signal:
            controller.signal,
          headers: {
            "User-Agent":
              "ToolNest-Website-Intelligence/1.0",
            Accept:
              "text/html,application/xhtml+xml,application/xml,text/xml",
          },
          cache: "no-store",
        }
      );

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

async function discoverSitemapUrls(
  rootUrl: URL,
  timeoutMs: number,
  maxUrls: number
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

  const sitemapFiles =
    new Set<string>();

  const discoveredUrls =
    new Set<string>();

  const robotsUrl =
    new URL(
      "/robots.txt",
      rootUrl
    ).toString();

  try {
    const robots =
      await fetchText(
        robotsUrl,
        timeoutMs
      );

    if (
      robots.text &&
      robots.status !== null &&
      robots.status < 400
    ) {
      const lines =
        robots.text.split(
          /\r?\n/
        );

      for (
        const line of lines
      ) {
        const match =
          line.match(
            /^\s*Sitemap:\s*(\S+)\s*$/i
          );

        if (
          match &&
          match[1]
        ) {
          try {
            const sitemapUrl =
              new URL(
                match[1],
                rootUrl
              );

            if (
              sameOrigin(
                rootUrl,
                sitemapUrl
              )
            ) {
              sitemapCandidates.add(
                sitemapUrl.toString()
              );
            }
          } catch {
            // Ignore invalid sitemap URL.
          }
        }
      }
    }
  } catch {
    // robots.txt is optional.
  }

  async function readSitemap(
    sitemapUrl: string
  ): Promise<void> {
    if (
      sitemapFiles.size >=
      MAX_SITEMAP_FILES
    ) {
      return;
    }

    if (
      sitemapFiles.has(
        sitemapUrl
      )
    ) {
      return;
    }

    sitemapFiles.add(
      sitemapUrl
    );

    let response;

    try {
      response =
        await fetchText(
          sitemapUrl,
          timeoutMs
        );
    } catch {
      return;
    }

    if (
      response.status === null ||
      response.status >= 400
    ) {
      return;
    }

    const xml =
      response.text || "";

    if (!xml) {
      return;
    }

    const locations =
      extractXmlLocations(
        xml
      );

    if (
      /<sitemapindex\b/i.test(
        xml
      )
    ) {
      for (
        const location of locations
      ) {
        if (
          sitemapFiles.size >=
          MAX_SITEMAP_FILES
        ) {
          break;
        }

        try {
          const child =
            new URL(
              location,
              rootUrl
            );

          if (
            !sameOrigin(
              rootUrl,
              child
            )
          ) {
            continue;
          }

          await readSitemap(
            child.toString()
          );
        } catch {
          // Ignore malformed sitemap locations.
        }
      }

      return;
    }

    for (
      const location of locations
    ) {
      if (
        discoveredUrls.size >=
        maxUrls
      ) {
        break;
      }

      try {
        const pageUrl =
          new URL(
            location,
            rootUrl
          );

        if (
          !sameOrigin(
            rootUrl,
            pageUrl
          )
        ) {
          continue;
        }

        pageUrl.hash = "";
        pageUrl.search = "";

        const normalized =
          normalizeUrl(
            pageUrl.toString()
          );

        if (
          isLikelyHtmlUrl(
            normalized
          )
        ) {
          discoveredUrls.add(
            normalized
          );
        }
      } catch {
        // Ignore malformed URLs.
      }
    }
  }

  for (
    const candidate of sitemapCandidates
  ) {
    if (
      discoveredUrls.size >=
      maxUrls
    ) {
      break;
    }

    await readSitemap(
      candidate
    );
  }

  return [
    ...discoveredUrls,
  ];
}

function extractXmlLocations(
  xml: string
): string[] {
  const locations =
    new Set<string>();

  const regex =
    /<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(xml)) !== null
  ) {
    if (
      match[1]
    ) {
      const value =
        decodeHtml(
          match[1].trim()
        );

      if (value) {
        locations.add(
          value
        );
      }
    }
  }

  return [
    ...locations,
  ];
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

  const contentType =
    result.contentType
      .toLowerCase();

  const finalUrl =
    result.finalUrl ||
    url;

  if (
    !contentType.includes(
      "text/html"
    ) &&
    !contentType.includes(
      "application/xhtml+xml"
    )
  ) {
    return {
      page: {
        url,
        status:
          result.status,
        finalUrl,
        contentType:
          result.contentType,
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
    result.text || "";

  const requestedUrl =
    new URL(url);

  const finalUrlObject =
    new URL(
      finalUrl
    );

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
    stripHtml(
      html
    );

  const page: PageAudit = {
    url,

    status:
      result.status,

    finalUrl,

    contentType:
      result.contentType,

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
    links:
      internalLinks,
  };
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
        150
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
    new URL(
      startUrl
    );

  rootUrl.hash = "";
  rootUrl.search = "";

  const rootNormalized =
    normalizeUrl(
      rootUrl.toString()
    );

  const queue: string[] = [
    rootNormalized,
  ];

  /*
   * First discover URLs from sitemap.
   *
   * This is important for websites where
   * all pages are not directly linked from
   * the homepage.
   */
  const sitemapUrls =
    await discoverSitemapUrls(
      rootUrl,
      timeoutMs,
      Math.max(
        maxPages * 2,
        300
      )
    );

  /*
   * Put sitemap URLs first.
   */
  for (
    const sitemapUrl of sitemapUrls
  ) {
    if (
      sitemapUrl ===
      rootNormalized
    ) {
      continue;
    }

    if (
      queue.includes(
        sitemapUrl
      )
    ) {
      continue;
    }

    if (
      queue.length >=
      maxPages * 3
    ) {
      break;
    }

    queue.push(
      sitemapUrl
    );
  }

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

    if (
      !isLikelyHtmlUrl(
        currentUrl
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
       * HTTP errors
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
       * Add internal HTML links
       * to the crawl queue.
       */
      for (
        const link of result.links
      ) {
        if (
          visited.has(
            link
          )
        ) {
          continue;
        }

        if (
          queue.includes(
            link
          )
        ) {
          continue;
        }

        if (
          !isLikelyHtmlUrl(
            link
          )
        ) {
          continue;
        }

        if (
          queue.length >=
          maxPages * 3
        ) {
          break;
        }

        queue.push(
          link
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown crawler error";

      pages.push({
        url:
          currentUrl,

        status:
          null,

        finalUrl:
          currentUrl,

        contentType:
          "",

        title:
          "",

        metaDescription:
          "",

        h1Count:
          0,

        canonical:
          "",

        robots:
          "",

        wordCount:
          0,

        internalLinks:
          0,

        externalLinks:
          0,

        depth:
          getDepth(
            rootUrl,
            parsedUrl
          ),

        error:
          message,
      });

      issues.push({
        severity:
          "high",

        code:
          "PAGE_FETCH_FAILED",

        title:
          "Page could not be analyzed",

        detail:
          "The crawler could not retrieve this page.",

        url:
          currentUrl,
      });
    }
  }

  return {
    pages,
    issues,
  };
}

import { NextResponse } from "next/server";

import { crawlWebsite } from "@/lib/crawler";
import { isHttpUrl } from "@/lib/url";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const MAX_PAGES = 25;
const TIMEOUT_MS = 10000;

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();

  const blockedHosts = [
    "localhost",
    "localhost.localdomain",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
  ];

  if (blockedHosts.includes(host)) {
    return true;
  }

  if (host.endsWith(".local")) {
    return true;
  }

  if (host.endsWith(".internal")) {
    return true;
  }

  if (host.endsWith(".localhost")) {
    return true;
  }

  return false;
}

function validateWebsiteUrl(
  value: unknown
): URL {
  if (typeof value !== "string") {
    throw new Error(
      "Please provide a valid website URL."
    );
  }

  const input = value.trim();

  if (!input) {
    throw new Error(
      "Please enter a website URL."
    );
  }

  let url: URL;

  try {
    url = new URL(
      /^https?:\/\//i.test(input)
        ? input
        : `https://${input}`
    );
  } catch {
    throw new Error(
      "The website URL is not valid."
    );
  }

  if (!isHttpUrl(url.toString())) {
    throw new Error(
      "Only HTTP and HTTPS websites are supported."
    );
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error(
      "Private or local network addresses are not allowed."
    );
  }

  url.hash = "";

  return url;
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const url = validateWebsiteUrl(
      body?.url
    );

    const result = await crawlWebsite(
      url.toString(),
      {
        maxPages: MAX_PAGES,
        timeoutMs: TIMEOUT_MS,
      }
    );

    return NextResponse.json(
      {
        success: true,

        target: {
          url: url.toString(),
          hostname: url.hostname,
        },

        summary: {
          pagesScanned:
            result.pages.length,

          issuesFound:
            result.issues.length,

          highIssues:
            result.issues.filter(
              (issue) =>
                issue.severity === "high"
            ).length,

          mediumIssues:
            result.issues.filter(
              (issue) =>
                issue.severity === "medium"
            ).length,

          lowIssues:
            result.issues.filter(
              (issue) =>
                issue.severity === "low"
            ).length,
        },

        pages: result.pages,

        issues: result.issues,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Website audit failed.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 400,
      }
    );
  }
}

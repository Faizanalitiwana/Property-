import type {
  AuditIssue,
  PageAudit,
} from "@/types/audit";

import {
  isHttpUrl,
  normalizeUrl,
  sameOrigin,
} from "@/lib/url";

const DEFAULT_MAX_PAGES = 200;
const MAX_ALLOWED_PAGES = 200;
const DEFAULT_TIMEOUT = 10000;

type CrawlOptions = {
  maxPages?: number;
  timeoutMs?: number;
};

type CrawlResult = {
  pages: PageAudit[];
  issues: AuditIssue[];
};

type FetchPageResult = {
  page: PageAudit;
  links: string[];
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

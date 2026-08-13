import { isCrawlablePath } from "@/lib/crawler-utils";

export type ParsedLink = {
  url: string;
  anchorText: string;
  isInternal: boolean;
};

export type ParsedPage = {
  title: string;
  metaDescription: string;
  h1Count: number;
  h2Count: number;
  h3Count: number;

  canonical: string;
  robots: string;

  wordCount: number;

  links: ParsedLink[];

  images: string[];
  missingAltImages: number;

  openGraph: {
    title: string;
    description: string;
    image: string;
    url: string;
  };

  structuredData: string[];
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

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function getMetaContent(
  html: string,
  name: string
): string {
  const escaped = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const first = html.match(
    new RegExp(
      `<meta\\b[^>]*\\bname=["']${escaped}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`,
      "i"
    )
  );

  if (first?.[1]) {
    return decodeHtml(first[1].trim());
  }

  const reversed = html.match(
    new RegExp(
      `<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${escaped}["'][^>]*>`,
      "i"
    )
  );

  return reversed?.[1]
    ? decodeHtml(reversed[1].trim())
    : "";
}

function getPropertyContent(
  html: string,
  property: string
): string {
  const escaped = property.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const first = html.match(
    new RegExp(
      `<meta\\b[^>]*\\bproperty=["']${escaped}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`,
      "i"
    )
  );

  if (first?.[1]) {
    return decodeHtml(first[1].trim());
  }

  const reversed = html.match(
    new RegExp(
      `<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bproperty=["']${escaped}["'][^>]*>`,
      "i"
    )
  );

  return reversed?.[1]
    ? decodeHtml(reversed[1].trim())
    : "";
}

function getTitle(html: string): string {
  const match = html.match(
    /<title\b[^>]*>([\s\S]*?)<\/title>/i
  );

  return match?.[1]
    ? stripHtml(match[1])
    : "";
}

function getCanonical(html: string): string {
  const first = html.match(
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
  );

  if (first?.[1]) {
    return decodeHtml(first[1].trim());
  }

  const reversed = html.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
  );

  return reversed?.[1]
    ? decodeHtml(reversed[1].trim())
    : "";
}

function countTags(
  html: string,
  tag: string
): number {
  const matches = html.match(
    new RegExp(`<${tag}\\b`, "gi")
  );

  return matches?.length ?? 0;
}

function extractLinks(
  html: string,
  baseUrl: URL
): ParsedLink[] {
  const links: ParsedLink[] = [];

  const regex =
    /<a\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[2]?.trim();

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
      const url = new URL(href, baseUrl);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        continue;
      }

      url.hash = "";
      url.search = "";

      const normalized = url.toString();

      links.push({
        url: normalized,
        anchorText: stripHtml(
          match[4] ?? ""
        ).slice(0, 500),
        isInternal:
          url.origin === baseUrl.origin,
      });
    } catch {
      // Ignore malformed URLs.
    }
  }

  return links;
}

function extractImages(
  html: string,
  baseUrl: URL
): {
  images: string[];
  missingAltImages: number;
} {
  const images: string[] = [];
  let missingAltImages = 0;

  const regex =
    /<img\b([^>]*)>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const attributes = match[1] ?? "";

    const srcMatch = attributes.match(
      /\bsrc=["']([^"']+)["']/i
    );

    const altMatch = attributes.match(
      /\balt=["']([^"']*)["']/i
    );

    if (!altMatch) {
      missingAltImages++;
    }

    if (!srcMatch?.[1]) {
      continue;
    }

    try {
      const imageUrl = new URL(
        srcMatch[1],
        baseUrl
      );

      images.push(imageUrl.toString());
    } catch {
      // Ignore malformed image URLs.
    }
  }

  return {
    images: [...new Set(images)],
    missingAltImages,
  };
}

function extractStructuredData(
  html: string
): string[] {
  const results: string[] = [];

  const regex =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const content = match[1]?.trim();

    if (!content) {
      continue;
    }

    results.push(content);
  }

  return results;
}

export function parseHtml(
  html: string,
  pageUrl: string
): ParsedPage {
  const baseUrl = new URL(pageUrl);

  const visibleText = stripHtml(html);

  const links = extractLinks(
    html,
    baseUrl
  );

  const imageData = extractImages(
    html,
    baseUrl
  );

  const structuredData =
    extractStructuredData(html);

  return {
    title: getTitle(html),

    metaDescription:
      getMetaContent(
        html,
        "description"
      ),

    h1Count: countTags(html, "h1"),
    h2Count: countTags(html, "h2"),
    h3Count: countTags(html, "h3"),

    canonical:
      getCanonical(html),

    robots:
      getMetaContent(
        html,
        "robots"
      ),

    wordCount: visibleText
      ? visibleText
          .split(/\s+/)
          .filter(Boolean)
          .length
      : 0,

    links: links.filter(
      (link) =>
        link.isInternal &&
        isCrawlablePath(link.url) ||
        !link.isInternal
    ),

    images: imageData.images,

    missingAltImages:
      imageData.missingAltImages,

    openGraph: {
      title:
        getPropertyContent(
          html,
          "og:title"
        ),

      description:
        getPropertyContent(
          html,
          "og:description"
        ),

      image:
        getPropertyContent(
          html,
          "og:image"
        ),

      url:
        getPropertyContent(
          html,
          "og:url"
        ),
    },

    structuredData,
  };
}

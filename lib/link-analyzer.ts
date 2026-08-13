import { normalizeUrl, resolveUrl, isSameOrigin } from "@/lib/url-utils";

export type AnalyzedLink = {
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  isInternal: boolean;
  isExternal: boolean;
  rel: string[];
  isNofollow: boolean;
  isSponsored: boolean;
  isUgc: boolean;
};

export type LinkAnalysis = {
  sourceUrl: string;
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  nofollowLinks: number;
  emptyAnchorLinks: number;
  links: AnalyzedLink[];
};

function getRelValues(
  rel: string | null
): string[] {
  if (!rel) {
    return [];
  }

  return rel
    .split(/\s+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getAnchorText(
  element: Element
): string {
  return (element.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeLinks(
  html: string,
  sourceUrl: string
): LinkAnalysis {
  const links: AnalyzedLink[] = [];

  if (!html.trim()) {
    return {
      sourceUrl,
      totalLinks: 0,
      internalLinks: 0,
      externalLinks: 0,
      nofollowLinks: 0,
      emptyAnchorLinks: 0,
      links: [],
    };
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(
    html,
    "text/html"
  );

  const anchors =
    Array.from(
      document.querySelectorAll("a[href]")
    );

  for (const anchor of anchors) {
    const href =
      anchor.getAttribute("href");

    if (!href) {
      continue;
    }

    const targetUrl =
      resolveUrl(
        href,
        sourceUrl
      );

    if (!targetUrl) {
      continue;
    }

    const normalizedSource =
      normalizeUrl(sourceUrl);

    const normalizedTarget =
      normalizeUrl(targetUrl);

    const internal =
      isSameOrigin(
        normalizedSource,
        normalizedTarget
      );

    const rel =
      getRelValues(
        anchor.getAttribute("rel")
      );

    links.push({
      sourceUrl:
        normalizedSource,

      targetUrl:
        normalizedTarget,

      anchorText:
        getAnchorText(anchor),

      isInternal:
        internal,

      isExternal:
        !internal,

      rel,

      isNofollow:
        rel.includes("nofollow"),

      isSponsored:
        rel.includes("sponsored"),

      isUgc:
        rel.includes("ugc"),
    });
  }

  return {
    sourceUrl:
      normalizeUrl(sourceUrl),

    totalLinks:
      links.length,

    internalLinks:
      links.filter(
        (link) => link.isInternal
      ).length,

    externalLinks:
      links.filter(
        (link) => link.isExternal
      ).length,

    nofollowLinks:
      links.filter(
        (link) => link.isNofollow
      ).length,

    emptyAnchorLinks:
      links.filter(
        (link) =>
          link.anchorText.length === 0
      ).length,

    links,
  };
}

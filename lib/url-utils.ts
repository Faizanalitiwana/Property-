export function normalizeUrl(
  value: string
): string {
  try {
    const url = new URL(value.trim());

    url.hash = "";

    // Remove default ports.
    if (
      (url.protocol === "http:" &&
        url.port === "80") ||
      (url.protocol === "https:" &&
        url.port === "443")
    ) {
      url.port = "";
    }

    // Normalize trailing slash.
    if (
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {
      url.pathname =
        url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return value.trim();
  }
}

export function isHttpUrl(
  value: string
): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function isSameOrigin(
  sourceUrl: string,
  targetUrl: string
): boolean {
  try {
    return (
      new URL(sourceUrl).origin ===
      new URL(targetUrl).origin
    );
  } catch {
    return false;
  }
}

export function resolveUrl(
  href: string,
  baseUrl: string
): string | null {
  try {
    const resolved =
      new URL(href, baseUrl);

    if (
      resolved.protocol !== "http:" &&
      resolved.protocol !== "https:"
    ) {
      return null;
    }

    return normalizeUrl(
      resolved.toString()
    );
  } catch {
    return null;
  }
}

export function getHostname(
  value: string
): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function getPathname(
  value: string
): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

export function isAssetUrl(
  value: string
): boolean {
  const pathname =
    getPathname(value).toLowerCase();

  return /\.(jpg|jpeg|png|gif|webp|avif|svg|ico|pdf|zip|mp4|mp3|woff|woff2|ttf|css|js)$/i.test(
    pathname
  );
}

export function isSkippableUrl(
  value: string
): boolean {
  const lower =
    value.toLowerCase();

  return (
    lower.startsWith(
      "mailto:"
    ) ||
    lower.startsWith(
      "tel:"
    ) ||
    lower.startsWith(
      "javascript:"
    ) ||
    lower.startsWith(
      "data:"
    ) ||
    lower.startsWith(
      "blob:"
    )
  );
}

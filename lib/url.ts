export function normalizeDomain(input: string): URL {
  const value = input.trim().startsWith("http")
    ? input.trim()
    : `https://${input.trim()}`;

  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(
      "Only HTTP and HTTPS websites are supported."
    );
  }

  url.hash = "";
  url.search = "";

  if (!url.pathname) {
    url.pathname = "/";
  }

  return url;
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);

  url.hash = "";

  return url.toString();
}

export function sameOrigin(
  first: URL,
  second: URL
): boolean {
  return first.origin === second.origin;
}

export function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

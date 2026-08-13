export function createQueue(
  initialUrls: string[]
): string[] {
  return [...new Set(initialUrls)];
}

export function hasVisited(
  visited: Set<string>,
  url: string
): boolean {
  return visited.has(url);
}

export function markVisited(
  visited: Set<string>,
  url: string
): void {
  visited.add(url);
}

export function addToQueue(
  queue: string[],
  url: string,
  maxQueueSize = 200
): void {
  if (queue.includes(url)) {
    return;
  }

  if (queue.length >= maxQueueSize) {
    return;
  }

  queue.push(url);
}

export function isCrawlablePath(
  url: string
): boolean {
  const pathname = url
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

  const blockedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".mp4",
    ".mp3",
    ".wav",
    ".avi",
    ".mov",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
  ];

  return !blockedExtensions.some(
    (extension) =>
      pathname.endsWith(extension)
  );
}

export function safeUrl(
  input: string
): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function getPathDepth(
  url: string
): number {
  const parsed = safeUrl(url);

  if (!parsed) {
    return 0;
  }

  return parsed.pathname
    .split("/")
    .filter(Boolean).length;
}

export function isLikelyHtmlUrl(
  url: string
): boolean {
  const parsed = safeUrl(url);

  if (!parsed) {
    return false;
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    return false;
  }

  return isCrawlablePath(
    parsed.toString()
  );
}

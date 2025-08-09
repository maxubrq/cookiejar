export function toOriginPermissionPattern(input: string, variant?: "sub" | "dot"): string | null {
  try {
    // Accept "example.com", "http://example.com", "https://sub.example.com/path"
    const raw = input.trim();
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    // Chrome permission origin must include scheme and path wildcard
    if (!variant) return `${url.protocol}//${url.hostname}/*`;
    if (variant === "sub") return `${url.protocol}//*.${url.hostname}/*`;
    if (variant === "dot") return `${url.protocol}//.${url.hostname}/`;
    return null;
  } catch {
    return null;
  }
}

export async function requestDomainCookieAccess(originPattern: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [originPattern] }, (granted) => resolve(granted));
  });
}

/**
 * Return true if `domain` is covered by a Chrome origin permission pattern.
 * Examples of patterns: "https://example.com/*", "https://*.example.com/*"
 * Domain may be ".example.com", "example.com", or "sub.example.com".
 */
export function isDomainCoveredByOriginPattern(originPattern: string, domain: string): boolean {
  try {
    const p = new URL(originPattern);
    // Normalize the pattern host
    const patternHost = p.hostname.toLowerCase();
    const isWildcard = patternHost.startsWith("*.");
    const baseHost = isWildcard ? patternHost.slice(2) : patternHost;

    // Normalize the input domain (strip leading/trailing dots, punycode via URL)
    const normalizedDomain = new URL(`https://${domain.trim().replace(/^\.+|\.+$/g, "")}`).hostname.toLowerCase();

    if (isWildcard) {
      // Wildcard matches subdomains ONLY, not the apex
      // e.g., "*.example.com" matches "a.example.com" but not "example.com"
      return normalizedDomain.endsWith("." + baseHost);
    } else {
      // Exact host only
      return normalizedDomain === baseHost;
    }
  } catch {
    return false; // invalid pattern or domain
  }
}

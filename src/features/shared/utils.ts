export function toOriginPermissionPattern(input: string): string | null {
    try {
        // Accept "example.com", "http://example.com", "https://sub.example.com/path"
        const raw = input.trim();
        const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
        // Chrome permission origin must include scheme and path wildcard
        return `${url.protocol}//${url.hostname}/*`;
    } catch {
        return null;
    }
}

export async function requestDomainCookieAccess(originPattern: string): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.permissions.request({ origins: [originPattern] }, (granted) => resolve(granted));
    });
}
export class CookieRepo {
    private static _instance: CookieRepo;

    private constructor() { }

    public static getInstance(): CookieRepo {
        if (!CookieRepo._instance) {
            CookieRepo._instance = new CookieRepo();
        }
        return CookieRepo._instance;
    }

    /**
     * Dumps all cookies for the specified domains.
     * @param domains The domains to retrieve cookies for.
     * @returns A promise that resolves to an array of cookies.
     */
    public dumpCookies(domains: string[]): Promise<chrome.cookies.Cookie[]> {
        return new Promise((resolve) => {
            chrome.cookies.getAll({ domain: domains.join(',') }, (cookies) => {
                resolve(cookies);
            });
        });
    }

    /**
     * Sets a cookie.
     * @param cookie The cookie to set.
     * @returns A promise that resolves to the set cookie or null if an error occurred.
     */
    public setCookie(cookie: chrome.cookies.Cookie): Promise<chrome.cookies.Cookie | null> {
        return new Promise((resolve) => {
            chrome.cookies.set({
                ...cookie,
                url: `https://${cookie.domain}${cookie.path}`,
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error(`Error setting cookie: ${chrome.runtime.lastError.message}`);
                    resolve(null);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Applies a list of cookies.
     * @param cookies The cookies to apply.
     * @returns A promise that resolves to an array of the applied cookies.
     */
    public applyCookies(cookies: chrome.cookies.Cookie[]): Promise<chrome.cookies.Cookie[]> {
        return new Promise((resolve) => {
            const promises = cookies.map(cookie => this.setCookie(cookie));
            Promise.all(promises).then(results => resolve(results.filter(c => c !== null) as chrome.cookies.Cookie[]));
        });
    }

    /**
     * Listens for cookie changes.
     * @param callback The callback to invoke on cookie changes.
     * @param domains The domains to filter cookie changes by.
     */
    public listenOnCookieChange(callback: (changeInfo: chrome.cookies.CookieChangeInfo) => void, domains: string[]): void {
        const wrapper = (changeInfo: chrome.cookies.CookieChangeInfo) => {
            if (domains.length === 0 || domains.includes(changeInfo.cookie.domain)) {
                console.log('Cookie changed:', changeInfo);
                // Call the provided callback with the change info
                if (callback) {
                    callback(changeInfo);
                }
            }
        }

        chrome.cookies.onChanged.addListener(wrapper);
    }
}
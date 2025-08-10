export class CookieRepo {
    private static _instance: CookieRepo;

    private constructor() {}

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
    public async dumpCookies(urls: string[]): Promise<chrome.cookies.Cookie[]> {
        const allCookies: chrome.cookies.Cookie[] = [];
        for (const url of urls) {
            const cookies = await chrome.cookies.getAll({ url });
            allCookies.push(...cookies);
        }
        return allCookies;
    }

    /**
     * Sets a cookie.
     * @param cookie The cookie to set.
     * @returns A promise that resolves to the set cookie or null if an error occurred.
     */
    public async setCookie(
        cookie: chrome.cookies.Cookie,
    ): Promise<chrome.cookies.Cookie | null> {
        const domainUrl = cookie.domain.startsWith('.')
            ? cookie.domain.slice(1)
            : cookie.domain;
        const cookieCopy = {
            ...cookie,
            url: cookie.domain
                ? `${cookie.secure ? 'https' : 'http'}://${domainUrl}`
                : '',
        };
        delete (cookieCopy as any).hostOnly;
        delete (cookieCopy as any).session; // session cookies are not supported by chrome.cookies.set
        try {
            if (cookie.name.startsWith('__Host-')) {
                const hostCookie = {
                    ...cookieCopy,
                    path: '/',
                    secure: true,
                };

                delete (hostCookie as any).domain; // __Host- cookies must not have a domain
                const result = await chrome.cookies.set(hostCookie);
                return result;
            } else {
                const result = await chrome.cookies.set(cookieCopy);
                return result;
            }
        } catch (error) {
            console.error(
                'Error setting cookie:',
                error,
                JSON.stringify(cookieCopy),
            );
            throw error;
        }
    }

    /**
     * Applies a list of cookies.
     * @param cookies The cookies to apply.
     * @returns A promise that resolves to an array of the applied cookies.
     */
    public async applyCookies(
        cookies: chrome.cookies.Cookie[],
    ): Promise<chrome.cookies.Cookie[]> {
        const promises = cookies.map((cookie) => {
            return this.setCookie(cookie);
        });

        return Promise.allSettled(promises).then(
            (results) =>
                results
                    .filter((result) => result.status === 'fulfilled')
                    .map((result) => result.value) as chrome.cookies.Cookie[],
        );
    }

    /**
     * Listens for cookie changes.
     * @param callback The callback to invoke on cookie changes.
     * @param domains The domains to filter cookie changes by.
     */
    public listenOnCookieChange(
        callback: (changeInfo: chrome.cookies.CookieChangeInfo) => void,
        domains: string[],
    ): void {
        const wrapper = (changeInfo: chrome.cookies.CookieChangeInfo) => {
            if (
                domains.length === 0 ||
                domains.includes(changeInfo.cookie.domain)
            ) {
                console.log('Cookie changed:', changeInfo);
                // Call the provided callback with the change info
                if (callback) {
                    callback(changeInfo);
                }
            }
        };

        chrome.cookies.onChanged.addListener(wrapper);
    }

    public async getAllFromDomain(
        url: string,
    ): Promise<chrome.cookies.Cookie[]> {
        const allCookies: chrome.cookies.Cookie[] = await chrome.cookies.getAll(
            {
                url: url,
            },
        );
        return allCookies;
    }
}

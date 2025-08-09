/**
 * LocalStorageRepo class for managing local storage operations in a Chrome extension.
 * This class provides methods to get and set items in the local storage.
 * It uses Chrome's storage API to persist data across sessions.
 */
export class LocalStorageRepo {
    private static _instance: LocalStorageRepo;

    private constructor() {}

    /**
     * Gets the singleton instance of LocalStorageRepo.
     * If the instance does not exist, it creates a new one.
     * @returns The singleton instance of LocalStorageRepo.
     */
    public static getInstance(): LocalStorageRepo {
        if (!LocalStorageRepo._instance) {
            LocalStorageRepo._instance = new LocalStorageRepo();
        }
        return LocalStorageRepo._instance;
    }

    /**
     * Gets an item from local storage by key.
     * @param key The key of the item to retrieve.
     * @returns A promise that resolves to the item value or null if not found.
     *
     * @example
     * ```typescript
     * const value = await LocalStorageRepo.getInstance().getItem('myKey');
     * console.log(value); // Outputs the value associated with 'myKey' or null if not found.
     * ```
     */
    public getItem<T>(key: string): Promise<T | null> {
        return new Promise((resolve) => {
            chrome.storage.local.get(key, (result) => {
                const item = result[key];
                if (item) {
                    try {
                        resolve(JSON.parse(item) as T);
                    } catch (e) {
                        console.error(
                            `Error parsing item from localStorage for key "${key}":`,
                            e,
                        );
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Sets an item in local storage by key.
     * @param key The key of the item to set.
     * @param value The value to store, which will be stringified.
     *
     * @example
     * ```typescript
     * await LocalStorageRepo.getInstance().setItem('myKey', { foo: 'bar' });
     * console.log('Item set successfully');
     * ```
     */
    public setItem<T>(key: string, value: T): Promise<void> {
        return new Promise((resolve) => {
            const item = JSON.stringify(value);
            chrome.storage.local.set({ [key]: item }, () => {
                resolve();
            });
        });
    }
}

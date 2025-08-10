/**
 * Represents sensitive information used for authentication and encryption.
 * This type is used to store secrets securely, such as GitHub Personal Access Tokens and encryption passphrases.
 *
 * **NOTE**: This type should be handled with care and not logged or exposed in any way. **ONLY STORE IN BROWSER STORAGE**.
 */
export type CjSecrets = {
    /**
     * GitHub Personal Access Token used for accessing GitHub Gists or other GitHub APIs.
     * This token should have the necessary permissions to read and write Gists.
     *
     * @see: [(Github) Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
     */
    ghp?: string;
    /**
     * Passphrase used for encrypting and decrypting sensitive data.
     * This passphrase should be strong and kept secret to ensure the security of the encrypted data
     *
     * **NOTE**: If you lose this passphrase, you will not be able to decrypt your data.
     */
    passPhrase?: string; // Passphrase for encryption
};

/**
 * Represents the settings for the CookieJar extension.
 * This type is used to store user preferences and configurations for syncing cookies and other related settings.
 */
export type CjSettings = {
    /**
     * The ID of the Gist used to store the encrypted content and settings.
     * This Gist is used to store the encrypted cookie data and settings for the extension.
     * If this is not set, the extension will not be able to sync cookies.
     */
    gistId?: string;

    // --- Sync settings ---
    /**
     * Whether auto-sync is enabled.
     * If true, the extension will automatically sync cookies at regular intervals or when changes are detected.
     * If false, the user will need to manually trigger the sync process.
     */
    autoSyncEnabled?: boolean;
    /**
     * The interval in minutes for syncing cookies.
     * This setting is only used if auto-sync is enabled.
     * Default value is 15 minutes.
     */
    syncIntervalInMinutes?: number;
    /**
     * Whether to sync cookies on change.
     * If true, the extension will sync cookies whenever a change is detected.
     * If false, the extension will only sync cookies at the specified interval.
     *
     * **NOTE**: This setting **ONLY** applies if `autoSyncEnabled` is true.
     */
    syncOnChange?: boolean;

    // --- Domain settings ---
    /**
     * An array of URLs (domains) to sync cookies for.
     * This setting is used to specify which domains the extension should sync cookies for.
     * If empty, the extension will not sync any cookies.
     */
    syncUrls?: string[];

    /**
     * Timestamp of the last successful sync.
     * This is used to determine when the last sync occurred and can be used for debugging or logging purposes.
     */
    lastSyncTimestamp?: number; // Timestamp of the last successful sync
};

export const DEFAULT_CJ_SETTINGS: CjSettings = {
    gistId: undefined,
    autoSyncEnabled: true,
    syncIntervalInMinutes: 15,
    syncOnChange: true,
    syncUrls: [],
    lastSyncTimestamp: undefined,
};

export type CookieJarState = {
    /**
     * The current settings for the CookieJar extension.
     * This includes user preferences and configurations for syncing cookies.
     */
    settings: CjSettings | null;
    /**
     * The current secrets for the CookieJar extension.
     * This includes sensitive information such as GitHub Personal Access Tokens and encryption passphrases.
     */
    secrets: CjSecrets | null;
    /**
     * The current status of the CookieJar extension.
     * This can be 'idle', 'syncing', or 'error'.
     */
    port: chrome.runtime.Port | null;
};

export type CookieJarAction =
    | { type: 'SET_SETTINGS'; payload: CjSettings }
    | { type: 'SET_SECRETS'; payload: CjSecrets }
    | { type: 'SET_STATUS'; payload: 'idle' | 'syncing' | 'error' }
    | { type: 'SET_ERROR_MESSAGE'; payload: string | null }
    | { type: 'SET_GITHUB_PAT'; payload: { ghp: string } }
    | { type: 'SET_PASSPHRASE'; payload: { passPhrase: string } }
    | { type: 'TOGGLE_AUTO_SYNC'; payload?: boolean }
    | { type: 'TOGGLE_SYNC_ON_CHANGE'; payload?: boolean }
    | { type: 'ADD_SYNC_URL'; payload: string }
    | { type: 'REMOVE_SYNC_URL'; payload: string }
    | { type: 'SET_SYNC_URLS'; payload: string[] }
    | { type: 'SET_SYNC_INTERVAL_MINUTES'; payload?: number }
    | { type: 'SET_PORT'; payload: chrome.runtime.Port };

export type CookieJarContextType = {
    state: CookieJarState;
    dispatch: React.Dispatch<CookieJarAction>;
};

export enum PortCommands {
    PUSH = 'push',
    PULL = 'pull',

    // Storage scope commands
    ADD_SYNC_URL = 'add_sync_url',
    REMOVE_SYNC_URL = 'remove_sync_url',
    SET_SETTINGS = 'set_settings',
    SET_SECRETS = 'set_secrets',

    // Settings scope commands
    APPLY_SETTINGS = 'apply_settings',
    APPLY_COOKIES = 'apply_cookies'
}

export type PortMessage<T = any> = {
    command: PortCommands;
    payload?: T;
};

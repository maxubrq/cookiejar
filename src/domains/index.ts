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
    ghp: string;
    /**
     * Passphrase used for encrypting and decrypting sensitive data.
     * This passphrase should be strong and kept secret to ensure the security of the encrypted data
     *
     * **NOTE**: If you lose this passphrase, you will not be able to decrypt your data.
     */
    passPhrase: string; // Passphrase for encryption
};

/**
 * Represents the settings for the CookieJar extension.
 * This type is used to store user preferences and configurations for syncing cookies and other related settings.
 */
export type CjSettings = {
    // --- General settings ---
    /**
     * The ID of the Gist used to store settings related to the CookieJar extension.
     * This Gist is used to store user preferences and configurations.
     */
    settingsGistId?: string;
    /**
     * The ID of the Gist used to store the encrypted content.
     * This Gist is used to store the encrypted cookies and other sensitive data.
     */
    contentGistId?: string;

    // --- Sync settings ---
    /**
     * Whether auto-sync is enabled.
     * If true, the extension will automatically sync cookies at regular intervals or when changes are detected.
     * If false, the user will need to manually trigger the sync process.
     */
    autoSyncEnabled: boolean;
    /**
     * The interval in minutes for syncing cookies.
     * This setting is only used if auto-sync is enabled.
     * Default value is 15 minutes.
     */
    syncIntervalInMinutes: number;
    /**
     * Whether to sync cookies on change.
     * If true, the extension will sync cookies whenever a change is detected.
     * If false, the extension will only sync cookies at the specified interval.
     *
     * **NOTE**: This setting **ONLY** applies if `autoSyncEnabled` is true.
     */
    syncOnChange: boolean;

    // --- Domain settings ---
    /**
     * List of domains to sync cookies for.
     * This setting allows the user to specify which domains should have their cookies synced.
     * If empty, **NO COOKIES WILL BE SYNCED**.
     * @example ['example.com', 'another-domain.com']
     */
    syncDomains: string[];
};

export const DEFAULT_CJ_SETTINGS: CjSettings = {
    settingsGistId: undefined,
    contentGistId: undefined,
    autoSyncEnabled: true,
    syncIntervalInMinutes: 15,
    syncOnChange: true,
    syncDomains: [],
};

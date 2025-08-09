import { CjSecrets, CjSettings, PortCommands, PortMessage } from '@/domains';
import { FILE_NAMES, LOCAL_STORAGE_KEYS } from '@/lib';
import { LocalStorageRepo, requestDomainCookieAccess, toOriginPermissionPattern } from '../shared';
import { CookieRepo } from '../shared/cookie.repo';
import { CryptoService } from '../shared/crypto.service';
import { GistRepo } from '../shared/gist.repo';
import { AppEvent, AppStages } from '../push';

export class PullService {
    private static _instance: PullService;

    constructor(
        private port: chrome.runtime.Port,
        protected cookieRepo: CookieRepo = CookieRepo.getInstance(),
        protected storageRepo: LocalStorageRepo = LocalStorageRepo.getInstance(),
        protected gistRepo: GistRepo = GistRepo.getInstance(),
        protected cryptoService: CryptoService = CryptoService.getInstance(),
    ) {
        this.handlePull = this.handlePull.bind(this);

        // Bubble repo-level notices (queue/rate-limit) to UI.
        this.gistRepo.setNotifier((msg) => {
            // Map to a reasonable pull stage for visibility
            const stage =
                msg.level === 'error'
                    ? AppStages.ERROR
                    : AppStages.PULL_DOWNLOADING;
            void this.emitEvent(stage, msg.title, undefined, msg.detail);
        });
    }

    public static getInstance(port: chrome.runtime.Port): PullService {
        if (!PullService._instance) {
            PullService._instance = new PullService(port);
        }
        return PullService._instance;
    }

    public selfRegister() {
        this.port.onMessage.addListener((message: PortMessage) => {
            if (message.command !== PortCommands.PULL) return;
            this.handlePull(message.payload);
        });
    }

    private formatDuration(ms: number): string {
        if (ms <= 0) return 'now';
        const totalSec = Math.ceil(ms / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    }

    protected async emitEvent(
        stage: AppStages,
        message: string,
        progress?: number,
        error?: string,
    ) {
        if (!this.port) {
            console.error('Port is not connected');
            return;
        }
        this.port.postMessage({
            stage,
            message,
            progress,
            error,
        } as AppEvent);
    }

    /**
     * Flow:
     * 1) Load secrets (ghp, passPhrase) and current settings (for gistId).
     *    If gistId is missing, find latest own Gist containing SETTINGS_FILE + CONTENT_FILE.
     * 2) Fetch gist; read SETTINGS_FILE + CONTENT_FILE.
     * 3) Save pulled settings to local storage.
     * 4) Decrypt cookies and apply them.
     * 5) Re-apply settings via PortCommands.APPLY_SETTINGS to activate listeners/alarms.
     */
    public async handlePull(_: any) {
        try {
            console.info('Handling pull request...');
            await this.emitEvent(AppStages.INITIAL, 'Starting pull process', 0);

            // ---- Load settings & secrets ---- //
            const currentSettings = await this.storageRepo.getItem<CjSettings>(
                LOCAL_STORAGE_KEYS.SETTINGS,
            );
            const secrets = await this.storageRepo.getItem<CjSecrets>(
                LOCAL_STORAGE_KEYS.SECRETS,
            );

            if (!secrets?.ghp || !secrets?.passPhrase) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Missing secrets',
                    100,
                    'GitHub token (ghp) and passPhrase are required.',
                );
                return;
            }

            const ghp = atob(secrets.ghp);
            const passPhrase = atob(secrets.passPhrase);

            // ---- Resolve gistId (fresh install supported) ---- //
            await this.emitEvent(AppStages.PULL_DOWNLOADING, 'Resolving Gist source', 10);
            let gistId = currentSettings?.gistId || '';

            if (!gistId) {
                try {
                    const latest = await this.gistRepo.findLatestOwnGistByFilenames(
                        [FILE_NAMES.SETTINGS_FILE, FILE_NAMES.CONTENT_FILE],
                        ghp,
                    );
                    if (!latest) {
                        await this.emitEvent(
                            AppStages.ERROR,
                            'No compatible Gist found',
                            100,
                            `Could not find a Gist containing both "${FILE_NAMES.SETTINGS_FILE}" and "${FILE_NAMES.CONTENT_FILE}". Push once from another device or set gistId manually.`,
                        );
                        return;
                    }
                    gistId = latest.id;
                } catch (e: any) {
                    if (e?.name === 'RateLimitError') {
                        const waitMs = e.resetAtMs - Date.now();
                        const waitStr = this.formatDuration(waitMs);
                        await this.emitEvent(
                            AppStages.PULL_DOWNLOADING,
                            `GitHub rate limit — cannot list gists now. Try again in ${waitStr}.`,
                            100,
                        );
                        return;
                    }
                    throw e;
                }
            }

            // ---- Fetch from Gist ---- //
            await this.emitEvent(AppStages.PULL_DOWNLOADING, 'Fetching from GitHub Gist', 25);
            let gist: any;
            try {
                gist = await this.gistRepo.getGist(gistId, ghp);
            } catch (e: any) {
                if (e?.name === 'RateLimitError') {
                    const waitMs = e.resetAtMs - Date.now();
                    const waitStr = this.formatDuration(waitMs);
                    await this.emitEvent(
                        AppStages.PULL_DOWNLOADING,
                        `GitHub rate limit — cannot fetch now. Try again in ${waitStr}.`,
                        100,
                    );
                    return;
                }
                throw e;
            }

            const files = gist?.files || {};
            const settingsFile = files[FILE_NAMES.SETTINGS_FILE];
            const contentFile = files[FILE_NAMES.CONTENT_FILE];

            if (!settingsFile?.content || !contentFile?.content) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Incomplete gist content',
                    100,
                    `Expected files "${FILE_NAMES.SETTINGS_FILE}" and "${FILE_NAMES.CONTENT_FILE}" not found.`,
                );
                return;
            }

            await this.emitEvent(AppStages.PULL_DOWNLOADING_COMPLETED, 'Download completed', 40);

            // ---- Persist pulled settings ---- //
            await this.emitEvent(AppStages.SETTINGS_UPDATING, 'Syncing settings locally', 45);
            let pulledSettings: CjSettings;
            try {
                pulledSettings = JSON.parse(settingsFile.content) as CjSettings;
            } catch (e: any) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Invalid settings content',
                    100,
                    e?.message ?? 'Failed to parse settings JSON from Gist.',
                );
                return;
            }

            const mergedSettings: CjSettings = {
                ...(currentSettings ?? ({} as CjSettings)),
                ...pulledSettings,
                gistId, // bind to discovered gistId
                lastSyncTimestamp: Date.now(),
            };

            await this.storageRepo.setItem(LOCAL_STORAGE_KEYS.SETTINGS, mergedSettings);
            await this.emitEvent(AppStages.SETTINGS_UPDATING_COMPLETED, 'Settings persisted', 55);

            // ---- Decrypt cookies ---- //
            await this.emitEvent(AppStages.PULL_DECRYPTING, 'Decrypting cookies', 60);
            let cookies: chrome.cookies.Cookie[] = [];
            try {
                const decrypted: any = await this.cryptoService.decrypt(
                    contentFile.content,
                    passPhrase,
                );
                cookies = Array.isArray(decrypted) ? (decrypted as chrome.cookies.Cookie[]) : [];
            } catch (e: any) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Decryption failed',
                    100,
                    e?.message ?? 'Could not decrypt cookies. Passphrase may be incorrect.',
                );
                return;
            }
            await this.emitEvent(AppStages.PULL_DECRYPTING_COMPLETED, 'Decryption completed', 70);

            // ---- Apply cookies ---- //
            await this.emitEvent(AppStages.PULL_APPLYING, 'Applying cookies', 75);
            try {
                const allUrls = Array.from(new Set(cookies.map(cookie => cookie.domain)));
                for (const url of allUrls) {
                    const origin = await toOriginPermissionPattern(url);
                    if (!origin) {
                        await this.emitEvent(
                            AppStages.ERROR,
                            'Invalid domain',
                            100,
                            `Cannot apply cookies for invalid domain: ${url}`,
                        );
                        continue;
                    }
                    const granted = await requestDomainCookieAccess(origin);
                    if (!granted) {
                        await this.emitEvent(
                            AppStages.ERROR,
                            'Permission denied',
                            100,
                            `Cannot apply cookies for ${origin}. Please allow access in Chrome settings.`,
                        );
                        continue;
                    }

                    const cookiesOfOrigin = cookies.filter(cookie => cookie.domain === url);
                    await this.cookieRepo.applyCookies(cookiesOfOrigin);
                }
            } catch (e: any) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Failed to apply cookies',
                    100,
                    e?.message,
                );
                return;
            }
            await this.emitEvent(AppStages.PULL_APPLYING_COMPLETED, 'Cookies applied', 85);

            // ---- Re-apply settings to activate alarms/listeners ---- //
            await this.emitEvent(AppStages.APPLY_SYNC_ON_CHANGE, 'Activating settings', 90);
            try {
                this.port.postMessage({
                    command: PortCommands.APPLY_SETTINGS,
                    payload: mergedSettings,
                } as PortMessage);
            } catch (e: any) {
                // Non-fatal; settings were still persisted
                console.warn('Failed to trigger APPLY_SETTINGS:', e);
            }
            await this.emitEvent(AppStages.APPLY_SYNC_ON_CHANGE_COMPLETED, 'Settings activated', 95);

            // ---- Done ---- //
            await this.emitEvent(AppStages.PULL_COMPLETED, 'Pull completed', 100);
        } catch (error: any) {
            console.error('Error handling pull request:', error);
            await this.emitEvent(
                AppStages.ERROR,
                'An error occurred while processing the pull request',
                undefined,
                error?.message,
            );
        }
    }
}

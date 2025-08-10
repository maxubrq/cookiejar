import { CjSecrets, CjSettings, PortCommands, PortMessage } from '@/domains';
import { FILE_NAMES, LOCAL_STORAGE_KEYS } from '@/lib';
import { AppEvent, AppStages } from '../push';
import { LocalStorageRepo } from '../shared';
import { CookieRepo } from '../shared/cookie.repo';
import { CryptoService } from '../shared/crypto.service';
import { GistRepo } from '../shared/gist.repo';

export class PullService {
    private static _instance: PullService;

    constructor(
        private port: chrome.runtime.Port | null,
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
        this.port?.onMessage.addListener(async (message: PortMessage) => {
            if (message.command === PortCommands.PULL) {
                await this.handlePull(message.payload);
            } else if (message.command === PortCommands.APPLY_COOKIES) {
                await this.handleApplyCookies(
                    message.payload?.cookies || [] as chrome.cookies.Cookie[],
                    message.payload?.origins || [] as string[],
                );
            }
        });
    }

    protected sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async handleApplyCookies(cookies: chrome.cookies.Cookie[], origins: string[]) {
        if (!cookies.length) {
            return;
        }

        let appliedCookies: chrome.cookies.Cookie[] = [];
        let failedCookies: chrome.cookies.Cookie[] = [];
        await this.emitEvent(
            AppStages.PULL_APPLYING,
            `Applying ${cookies.length} cookies`,
        );
        for (const c of cookies) {
            try {
                await this.cookieRepo.setCookie(c);
                appliedCookies.push(c);
            } catch (e: any) {
                console.error('Failed to set cookie:', e);
                failedCookies.push(c);
            }
            await this.sleep(100); // Throttle to avoid overwhelming the browser
        }

        await this.emitEvent(
            AppStages.PULL_APPLYING_COMPLETED,
            `Applied ${appliedCookies.length} cookies successfully: ${appliedCookies.map((c) => c.name).join(', ')}`,
        );
        if (failedCookies.length) {
            await this.emitEvent(
                AppStages.ERROR,
                `Failed to apply ${failedCookies.length} cookies: ${failedCookies.map((c) => c.name).join(', ')}`,
            );
        }

        const currentSettings = await this.storageRepo.getItem<CjSettings>(
            LOCAL_STORAGE_KEYS.SETTINGS,
        );
        await this.storageRepo.setItem<CjSettings>(
            LOCAL_STORAGE_KEYS.SETTINGS,
            {
                ...currentSettings,
                lastSyncTimestamp: Date.now(),
                autoSyncEnabled: currentSettings?.autoSyncEnabled ?? true,
                syncIntervalInMinutes:
                    currentSettings?.syncIntervalInMinutes ?? 15,
                syncOnChange: currentSettings?.syncOnChange ?? false,
                syncUrls: Array.from(new Set([...currentSettings?.syncUrls ?? [], ...origins])),
                gistId: currentSettings?.gistId ?? '',
            },
        );
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
            await this.port?.postMessage((<AppEvent>{
                stage: AppStages.PULL_WAIT_FOR_PERMISSION,
                message: 'Waiting for permission to access cookies',
                cookies: [],
                urls: [],
            }) as AppEvent);
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
            await this.emitEvent(
                AppStages.PULL_DOWNLOADING,
                'Resolving Gist source',
                10,
            );
            let gistId = currentSettings?.gistId || '';

            try {
                const latest = await this.gistRepo.findLatestOwnGistByFilenames(
                    [FILE_NAMES.CONTENT_FILE],
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

            // ---- Fetch from Gist ---- //
            await this.emitEvent(
                AppStages.PULL_DOWNLOADING,
                'Fetching from GitHub Gist',
                25,
            );
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
            const contentFile = files[FILE_NAMES.CONTENT_FILE];

            if (!contentFile?.content) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Incomplete gist content',
                    100,
                    `Expected files "${FILE_NAMES.CONTENT_FILE}" not found.`,
                );
                return;
            }

            await this.emitEvent(
                AppStages.PULL_DOWNLOADING_COMPLETED,
                'Download completed',
                40,
            );

            // ---- Decrypt cookies ---- //
            await this.emitEvent(
                AppStages.PULL_DECRYPTING,
                'Decrypting cookies',
                60,
            );
            let cookies: chrome.cookies.Cookie[] = [];
            let origins: string[] = [];
            let lastSyncTimestamp: number;
            try {
                const { plain: decrypted, origins: decryptedOrigins, latestSyncTimestamp: decryptedLatestSyncTimestamp } =
                    await this.cryptoService.decrypt(
                        contentFile.content,
                        passPhrase,
                    );
                origins = decryptedOrigins;
                lastSyncTimestamp = decryptedLatestSyncTimestamp;
                cookies = Array.isArray(decrypted)
                    ? (decrypted as chrome.cookies.Cookie[])
                    : [];
            } catch (e: any) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Decryption failed',
                    100,
                    e?.message ??
                    'Could not decrypt cookies. Passphrase may be incorrect.',
                );
                return;
            }
            await this.emitEvent(
                AppStages.PULL_DECRYPTING_COMPLETED,
                'Decryption completed',
                70,
            );

            // ---- Apply cookies ---- //
            await this.emitEvent(
                AppStages.PULL_APPLYING,
                'Applying cookies',
                75,
            );
            try {
                console.info('Applying cookies for origins:', origins);
                this.port?.postMessage(<AppEvent>{
                    stage: AppStages.PULL_WAIT_FOR_PERMISSION,
                    message: 'Requesting permission to access cookie domains',
                    progress: 80,
                    urls: origins,
                    cookies: cookies,
                    latestSyncTimestamp: lastSyncTimestamp,
                });
                return;
            } catch (e: any) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Failed to apply cookies',
                    100,
                    e?.message,
                );
                return;
            } finally {
                await this.storageRepo.setItem<CjSettings>(
                    LOCAL_STORAGE_KEYS.SETTINGS,
                    {
                        autoSyncEnabled:
                            currentSettings?.autoSyncEnabled ?? true,
                        syncIntervalInMinutes:
                            currentSettings?.syncIntervalInMinutes ?? 15,
                        syncOnChange: currentSettings?.syncOnChange ?? false,
                        syncUrls: currentSettings?.syncUrls ?? [],
                        gistId,
                    },
                );
            }
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

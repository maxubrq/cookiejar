import { CjSecrets, CjSettings, PortCommands, PortMessage } from '@/domains';
import { FILE_NAMES, LOCAL_STORAGE_KEYS } from '@/lib';
import { LocalStorageRepo } from '../shared';
import { CookieRepo } from '../shared/cookie.repo';
import { CryptoService } from '../shared/crypto.service';
import { GistRepo } from '../shared/gist.repo';
import { AppEvent, AppStages } from './domain';

export class PushService {
    private static _instance: PushService;
    constructor(
        private port: chrome.runtime.Port,
        protected cookieRepo: CookieRepo = CookieRepo.getInstance(),
        protected storageRepo: LocalStorageRepo = LocalStorageRepo.getInstance(),
        protected gistRepo: GistRepo = GistRepo.getInstance(),
        protected cryptoService: CryptoService = CryptoService.getInstance(),
    ) {
        this.handlePush = this.handlePush.bind(this);
    }

    public static getInstance(port: chrome.runtime.Port): PushService {
        if (!PushService._instance) {
            PushService._instance = new PushService(port);
        }
        return PushService._instance;
    }

    public selfRegister() {
        this.port.onMessage.addListener((message: PortMessage) => {
            if (message.command !== PortCommands.PUSH) return;
            this.handlePush(message.payload);
        });
    }

    protected async emitEvent(
        stage: AppStages,
        message: string,
        process?: number,
        error?: string,
    ) {
        if (this.port) {
            this.port.postMessage({
                message,
                stage,
                process,
                error,
            } as AppEvent);
        } else {
            console.error('Port is not connected');
        }
    }

    private async handlePush(_: any) {
        try {
            await this.emitEvent(AppStages.INITIAL, 'Starting push process');
            const settings = await this.storageRepo.getItem<CjSettings>(
                LOCAL_STORAGE_KEYS.SETTINGS,
            );
            const secrets = await this.storageRepo.getItem<CjSecrets>(
                LOCAL_STORAGE_KEYS.SECRETS,
            );
            if (!settings || !secrets || !secrets.ghp || !secrets.passPhrase) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Settings or secrets not found',
                    100,
                    'Settings or secrets not found',
                );
                return;
            }

            const ghp = atob(secrets.ghp); // Decode the GitHub PAT
            const passPhrase = atob(secrets.passPhrase); // Decode the passphrase

            // ---- Dumping cookies ---- //
            await this.emitEvent(AppStages.PUSH_DUMPING, 'Dumping data', 0);

            const syncUrls = settings?.syncUrls || [];
            const cookies = await this.cookieRepo.dumpCookies(syncUrls);
            await this.emitEvent(
                AppStages.PUSH_DUMPING_COMPLETED,
                `Dumping completed with ${cookies.length} cookies`,
                20,
            );

            // ---- Encrypting cookies ---- //
            await this.emitEvent(
                AppStages.PUSH_ENCRYPTING,
                'Encrypting data',
                20,
            );
            const encryptedResult = await this.cryptoService.encrypt(
                cookies,
                passPhrase,
            );
            if (!encryptedResult) {
                await this.emitEvent(
                    AppStages.ERROR,
                    'Encryption failed',
                    100,
                    'Encryption failed',
                );
                return;
            }
            await this.emitEvent(
                AppStages.PUSH_ENCRYPTING_COMPLETED,
                'Encryption completed',
                40,
            );

            // ---- Sending cookies ---- //
            await this.emitEvent(AppStages.PUSH_SENDING, 'Sending data', 40);
            let gistId = settings.gistId;
            if (!gistId) {
                // Create a new Gist
                gistId = await this.gistRepo.createGist(ghp, {
                    description: 'CookieJar - Encrypted Cookies',
                    public: false,
                    files: {
                        [FILE_NAMES.CONTENT_FILE]: { content: encryptedResult },
                        [FILE_NAMES.SETTINGS_FILE]: {
                            content: JSON.stringify(settings),
                        },
                    },
                });
                await this.emitEvent(
                    AppStages.PUSH_SENDING_COMPLETED,
                    `New Gist created with ID: ${gistId}`,
                    80,
                );
            } else {
                // Update existing Gist
                const gistData = {
                    files: {
                        [FILE_NAMES.CONTENT_FILE]: { content: encryptedResult },
                        [FILE_NAMES.SETTINGS_FILE]: {
                            content: JSON.stringify(settings),
                        },
                    },
                };
                console.log('Updating Gist with ID:', gistId);
                console.log('Gist Data:', JSON.stringify(gistData, null, 2));
                await this.gistRepo.updateGist(gistId, gistData, ghp);
                await this.emitEvent(
                    AppStages.PUSH_SENDING_COMPLETED,
                    `Gist updated with ID: ${gistId}`,
                    80,
                );
            }

            const newSettings: CjSettings = {
                ...settings,
                gistId,
                lastSyncTimestamp: Date.now(),
            };

            await this.storageRepo.setItem(
                LOCAL_STORAGE_KEYS.SETTINGS,
                newSettings,
            );

            await this.emitEvent(
                AppStages.PUSH_COMPLETED,
                'Push process completed successfully',
                100,
            );
        } catch (error: any) {
            console.error('Error handling push message:', error);
            await this.emitEvent(
                AppStages.ERROR,
                'An error occurred while processing the push request',
                undefined,
                error.message,
            );
        }
    }

    public sendPushRequest(data: any) {
        if (this.port) {
            this.port.postMessage({ command: 'push', payload: data });
        } else {
            console.error('Port is not connected');
        }
    }
}

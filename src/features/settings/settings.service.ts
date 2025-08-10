import { CjSettings, PortCommands, PortMessage } from '@/domains';
import { LOCAL_STORAGE_KEYS } from '@/lib';
import { AppEvent, AppStages } from '../push';
import { LocalStorageRepo } from '../shared';
import { CookieRepo } from '../shared/cookie.repo';

export class SettingsService {
    private _settings: CjSettings | null = null;

    constructor(
        protected port: chrome.runtime.Port | null,
        protected storageRepo: LocalStorageRepo = LocalStorageRepo.getInstance(),
        protected cookiesRepo: CookieRepo = CookieRepo.getInstance(),
    ) {
        this.loadSettings = this.loadSettings.bind(this);
        this.updateSettings = this.updateSettings.bind(this);
        this.addSyncUrl = this.addSyncUrl.bind(this);

        this.port?.onDisconnect.addListener(() => {
            this.port = null;
        });
    }

    public get settings(): CjSettings | null {
        return this._settings;
    }

    public async loadSettings(): Promise<CjSettings | null> {
        const settings = await this.storageRepo.getItem<CjSettings>(
            LOCAL_STORAGE_KEYS.SETTINGS,
        );
        this._settings = settings;
        return settings;
    }

    public selfRegister(): void {
        this.port?.onMessage.addListener(async (message: PortMessage) => {
            if (message.command === PortCommands.SET_SETTINGS) {
                await this.updateSettings(
                    message.payload as Partial<CjSettings>,
                );
                this.emitEvent({
                    stage: AppStages.SETTINGS_UPDATING_COMPLETED,
                    message: 'Settings updated successfully',
                });
            }
            if (message.command === PortCommands.ADD_SYNC_URL) {
                await this.addSyncUrl((message.payload as { url: string }).url);
            }
            if (message.command === PortCommands.REMOVE_SYNC_URL) {
                await this.removeSyncUrl(
                    (message.payload as { url: string }).url,
                );
            }
        });
    }

    public async emitEvent(event: AppEvent) {
        if (this.port) {
            this.port.postMessage(event);
        } else {
            console.error('Port is not connected');
        }
    }

    public async updateSettings(
        newSettings: Partial<CjSettings>,
    ): Promise<CjSettings> {
        const newCjSettings: CjSettings = {
            autoSyncEnabled:
                newSettings.autoSyncEnabled ??
                this._settings?.autoSyncEnabled ??
                true,
            syncUrls: newSettings.syncUrls ?? this._settings?.syncUrls ?? [],
            syncIntervalInMinutes:
                newSettings.syncIntervalInMinutes ??
                this._settings?.syncIntervalInMinutes ??
                15,
            syncOnChange:
                newSettings.syncOnChange ??
                this._settings?.syncOnChange ??
                true,
            gistId: newSettings.gistId ?? this._settings?.gistId,
        };

        this._settings = newCjSettings;
        await this.storageRepo.setItem(
            LOCAL_STORAGE_KEYS.SETTINGS,
            newCjSettings,
        );
        this.port?.postMessage({
            command: PortCommands.APPLY_SETTINGS,
            payload: {
                ...newCjSettings,
            },
        } as PortMessage);
        return this._settings;
    }

    public async removeSyncUrl(url: string): Promise<CjSettings> {
        await this.loadSettings();

        const updatedUrls = this._settings?.syncUrls?.filter((u) => u !== url);
        const result = await this.updateSettings({ syncUrls: updatedUrls });
        const cookiesOfUrl = await this.cookiesRepo.getAllFromDomain(url);
        await this.emitEvent({
            stage: AppStages.SETTINGS_UPDATING_COMPLETED,
            message: `Removed sync URL: ${url} with ${cookiesOfUrl.length} cookies associated.`,
        });

        return result;
    }

    public async addSyncUrl(url: string): Promise<CjSettings> {
        await this.loadSettings();

        const updatedUrls = Array.from(
            new Set([...this._settings?.syncUrls ?? [], url]),
        );
        const result = await this.updateSettings({ syncUrls: updatedUrls });

        const cookiesOfUrl = await this.cookiesRepo.getAllFromDomain(url);
        await this.emitEvent({
            stage: AppStages.SETTINGS_UPDATING_COMPLETED,
            message: `Added new sync URL: ${url} with ${cookiesOfUrl.length} cookies associated.`,
        });
        return result;
    }
}

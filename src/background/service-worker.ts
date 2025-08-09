import { CjSettings, PortCommands, PortMessage } from '@/domains';
import { PullService } from '@/features/pull';
import { AppEvent, AppStages, PushService } from '@/features/push';
import { SettingsService } from '@/features/settings';
import { PORT_NAME } from '@/lib';

const AUTO_SYNC_INTERVAL_NAME = 'cookie_jar_auto_sync_interval';
const COOKIE_CHANGE_DEBOUNCE_ALARM = 'cookie_jar_cookie_change_debounce';
// 1 minute:
const COOKIE_DEBOUNCE_MS = 60_000;

// ------------------------------------------------------------------
// Pattern compile & match
type CompiledPattern = {
    protocol: 'http:' | 'https:' | null; // null => don’t care (not used here)
    host: string;                         // e.g., "github.com" or "www.github.com"
    allowSubdomains: boolean;             // true for "*.github.com"
};

let currentPatterns: CompiledPattern[] = [];

function trimLeadingDot(host: string) {
    return host.startsWith('.') ? host.slice(1) : host;
}

function compilePatterns(syncUrls: string[]): CompiledPattern[] {
    return syncUrls
        .map((pat) => pat.trim())
        .filter(Boolean)
        .map((pat) => {
            // Expect forms like: https://www.github.com/* or https://*.github.com/*
            // We only care about scheme + hostname (path is ignored).
            let allowSubdomains = false;
            let protocol: 'http:' | 'https:' | null = null;

            // Extract protocol
            const protoMatch = pat.match(/^(https?):\/\//i);
            protocol = protoMatch ? (protoMatch[1].toLowerCase() + ':' as 'http:' | 'https:') : 'https:'; // default https

            // Extract host part between "://" and next "/" (ignore path and trailing "/*")
            const afterProto = pat.replace(/^(https?):\/\//i, '');
            const hostPart = afterProto.split('/')[0]; // may contain "*."
            if (hostPart.startsWith('*.')) {
                allowSubdomains = true;
            }

            const host = hostPart.replace(/^\*\./, '').toLowerCase();
            return { protocol, host, allowSubdomains };
        })
        .filter((p) => !!p.host);
}

function hostMatches(cookieHost: string, pattern: CompiledPattern): boolean {
    if (pattern.allowSubdomains) {
        // Match example.com and any subdomain
        return (
            cookieHost === pattern.host ||
            cookieHost.endsWith('.' + pattern.host)
        );
    }
    // Exact host match only
    return cookieHost === pattern.host;
}

function cookieChangeMatchesList(changeInfo: chrome.cookies.CookieChangeInfo, patterns: CompiledPattern[]): boolean {
    const cookie = changeInfo.cookie;
    const scheme: 'http:' | 'https:' = cookie.secure ? 'https:' : 'http:';
    const cookieHost = trimLeadingDot(cookie.domain.toLowerCase());

    for (const p of patterns) {
        if (p.protocol && p.protocol !== scheme) continue;
        if (!hostMatches(cookieHost, p)) continue;
        return true;
    }
    return false;
}
// ------------------------------------------------------------------

// Keep references so we don't add duplicate listeners
let cookieChangeListener: ((changeInfo: chrome.cookies.CookieChangeInfo) => void) | null = null;
let alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;

// Current toggles (updated from APPLY_SETTINGS)
let syncOnChangeEnabled = false;
let autoSyncEnabled = false;

// We need access to pushService from alarm handler. Keep the latest instance.
let latestPushService: PushService | null = null;

function ensureAlarmListener() {
    if (alarmListener) return;

    alarmListener = async (alarm) => {
        if (!latestPushService) return;

        if (alarm.name === AUTO_SYNC_INTERVAL_NAME) {
            console.info('Auto sync triggered (interval).');
            await latestPushService.handlePush({});
            return;
        }

        if (alarm.name === COOKIE_CHANGE_DEBOUNCE_ALARM) {
            console.info('Debounced cookie change sync firing.');
            await latestPushService.handlePush({});
            return;
        }
    };

    chrome.alarms.onAlarm.addListener(alarmListener);
}

function attachCookieChangeDebounced() {
    if (cookieChangeListener) return;

    cookieChangeListener = async (changeInfo) => {
        if (!syncOnChangeEnabled || !autoSyncEnabled) return;

        // Only react to meaningful changes
        if (changeInfo.cause !== 'overwrite' && changeInfo.cause !== 'explicit') return;

        // Gate by syncUrls pattern list
        if (!cookieChangeMatchesList(changeInfo, currentPatterns)) return;

        // Reset one-shot debounce alarm to 1 minute from now
        await chrome.alarms.clear(COOKIE_CHANGE_DEBOUNCE_ALARM);
        await chrome.alarms.create(COOKIE_CHANGE_DEBOUNCE_ALARM, { when: Date.now() + COOKIE_DEBOUNCE_MS });

        const cookieHost = trimLeadingDot(changeInfo.cookie.domain);
        console.info(`Cookie change @ ${cookieHost} → debounce (1 min) scheduled.`);
    };

    chrome.cookies.onChanged.addListener(cookieChangeListener);
}

function detachCookieChange() {
    if (cookieChangeListener) {
        chrome.cookies.onChanged.removeListener(cookieChangeListener);
        cookieChangeListener = null;
    }
    chrome.alarms.clear(COOKIE_CHANGE_DEBOUNCE_ALARM);
}

function registerForSidePanel() {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.sidePanel
            .setPanelBehavior({ openPanelOnActionClick: true })
            .catch((error) => console.error('Error setting side panel behavior:', error));
    });
}

function startListeningForPort() {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== PORT_NAME) return;

        console.info(`Connected to port: ${port.name}`);
        const pushService = new PushService(port);
        const pullService = PullService.getInstance(port);
        const settingsService = SettingsService.getInstance(port);
        pushService.selfRegister();
        pullService.selfRegister();
        settingsService.selfRegister();

        latestPushService = pushService; // keep current instance for alarms
        ensureAlarmListener();
        attachCookieChangeDebounced();

        port.onMessage.addListener(async (message: PortMessage) => {
            if (message.command !== PortCommands.APPLY_SETTINGS) return;

            const {
                autoSyncEnabled: autoSync,
                syncIntervalInMinutes,
                syncOnChange,
                syncUrls,
            } = message.payload as CjSettings;

            console.info('Applying settings:', message.payload);

            // Update toggles for listeners
            autoSyncEnabled = !!autoSync;
            syncOnChangeEnabled = !!syncOnChange;

            // Update compiled patterns from syncUrls
            currentPatterns = compilePatterns(syncUrls ?? []);

            // Handle periodic auto-sync
            await chrome.alarms.clear(AUTO_SYNC_INTERVAL_NAME);
            if (autoSync && Number.isFinite(syncIntervalInMinutes) && (syncIntervalInMinutes ?? 0) > 0) {
                console.info(`Setting auto sync interval to ${syncIntervalInMinutes} minutes`);
                chrome.alarms.create(AUTO_SYNC_INTERVAL_NAME, {
                    periodInMinutes: syncIntervalInMinutes!,
                });

                port.postMessage(<AppEvent>{
                    stage: AppStages.APPLY_AUTO_SYNC_INTERVAL_COMPLETED,
                    message: `Auto sync interval set to ${syncIntervalInMinutes} minutes`,
                });
            }

            // Manage cookie-change debounce wiring based on toggles
            if (autoSync && syncOnChange) {
                attachCookieChangeDebounced();
            } else {
                detachCookieChange();
            }
        });
    });
    console.info(`Listening for port: ${PORT_NAME}`);
}

function main() {
    registerForSidePanel();
    startListeningForPort();
}

main();

export enum AppStages {
    // ---- General Stages ---- //
    INITIAL = 'initial',
    ERROR = 'push_error',

    // ---- Push Stages ---- //
    PUSH_DUMPING = 'push_dumping',
    PUSH_DUMPING_COMPLETED = 'push_dumping_completed',
    PUSH_ENCRYPTING = 'push_encrypting',
    PUSH_ENCRYPTING_COMPLETED = 'push_encrypting_completed',
    PUSH_SENDING = 'push_sending',
    PUSH_SENDING_COMPLETED = 'push_sending_completed',
    PUSH_COMPLETED = 'push_completed',

    // ---- Pull Stages ---- //
    PULL_DOWNLOADING = 'pull_downloading',
    PULL_DOWNLOADING_COMPLETED = 'pull_downloading_completed',
    PULL_DECRYPTING = 'pull_decrypting',
    PULL_DECRYPTING_COMPLETED = 'pull_decrypting_completed',
    PULL_APPLYING = 'pull_applying',
    PULL_WAIT_FOR_PERMISSION = 'pull_wait_for_permission',
    PULL_WAIT_FOR_PERMISSION_COMPLETED = 'pull_wait_for_permission_completed',
    PULL_APPLYING_COMPLETED = 'pull_applying_completed',
    PULL_COMPLETED = 'pull_completed',

    // ---- Settings Stages ---- //
    SETTINGS_LOADING = 'settings_loading',
    SETTINGS_LOADING_COMPLETED = 'settings_loading_completed',
    SETTINGS_UPDATING = 'settings_updating',
    SETTINGS_UPDATING_COMPLETED = 'settings_updating_completed',

    // ---- Apply Settings Stages ---- //
    APPLY_AUTO_SYNC_INTERVAL = 'apply_auto_sync_interval',
    APPLY_AUTO_SYNC_INTERVAL_COMPLETED = 'apply_auto_sync_interval_completed',
    APPLY_SYNC_ON_CHANGE = 'apply_sync_on_change',
    APPLY_SYNC_ON_CHANGE_COMPLETED = 'apply_sync_on_change_completed',
    APPLY_COOKIE_SUCCESS = 'apply_cookie_success',
    APPLY_COOKIE_FAILED = 'apply_cookie_failed',
}

export type AppEvent = {
    stage: AppStages;
    message: string;
    progress?: number; // Optional progress percentage (0-100)
    error?: string; // Optional error message if the stage is ERROR
    urls?: string[]; // Optional list of URLs involved in the event
    cookies?: chrome.cookies.Cookie[]; // Optional list of cookies involved in the event
};

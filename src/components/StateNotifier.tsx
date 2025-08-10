import { AppEvent, AppStages } from '@/features/push';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function StageNotifier() {
    const { state } = useCookieJarContext();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEventRef = useRef<AppEvent | null>(null);

    const toastInfo = (message: string) => {
        toast.info(message, {
            duration: 5000,
            position: 'top-right',
            style: {
                background: '#f0f0f0',
                color: '#333',
            },
            icon: 'ℹ️',
            action: {
                label: 'Dismiss',
                onClick: () => toast.dismiss(),
            },
        });
    };

    const toastSuccess = (message: string) => {
        toast.success(message, {
            duration: 5000,
            position: 'top-right',
            style: {
                background: '#f0f0f0',
                color: '#333',
            },
            icon: '✅',
            action: {
                label: 'Dismiss',
                onClick: () => toast.dismiss(),
            },
        });
    };

    const toastError = (message: string, error?: string) => {
        toast.error(`${message}${error ? `: ${error}` : ''}`, {
            duration: 5000,
            position: 'top-right',
            style: {
                background: '#f0f0f0',
                color: '#333',
            },
            icon: '❌',
            action: {
                label: 'Dismiss',
                onClick: () => toast.dismiss(),
            },
        });
    };

    const handleEventNotification = (event: AppEvent) => {
        const { stage, message, error } = event;
        switch (stage) {
            case AppStages.INITIAL:
            case AppStages.ERROR:
                toastError(message, error);
                break;
            case AppStages.PUSH_DUMPING:
            case AppStages.PUSH_ENCRYPTING:
            case AppStages.PUSH_SENDING:
            case AppStages.PULL_DOWNLOADING:
            case AppStages.PULL_DECRYPTING:
            case AppStages.PULL_APPLYING:
            case AppStages.SETTINGS_LOADING:
            case AppStages.SETTINGS_UPDATING:
            case AppStages.APPLY_AUTO_SYNC_INTERVAL:
            case AppStages.APPLY_SYNC_ON_CHANGE:
            case AppStages.SET_SECRETS:
                toastInfo(message);
                break;
            case AppStages.PUSH_DUMPING_COMPLETED:
            case AppStages.PUSH_ENCRYPTING_COMPLETED:
            case AppStages.PUSH_SENDING_COMPLETED:
            case AppStages.PUSH_COMPLETED:
            case AppStages.PULL_DOWNLOADING_COMPLETED:
            case AppStages.PULL_DECRYPTING_COMPLETED:
            case AppStages.PULL_APPLYING_COMPLETED:
            case AppStages.PULL_COMPLETED:
            case AppStages.SETTINGS_LOADING_COMPLETED:
            case AppStages.SETTINGS_UPDATING_COMPLETED:
            case AppStages.APPLY_AUTO_SYNC_INTERVAL_COMPLETED:
            case AppStages.APPLY_SYNC_ON_CHANGE_COMPLETED:
            case AppStages.APPLY_COOKIE_SUCCESS:
            case AppStages.SET_SECRETS_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.APPLY_COOKIE_FAILED:
                toastError(message, error);
                break;
            default:
                console.warn(`Unhandled stage: ${stage}`);
                break;
        }
    };

    useEffect(() => {
        const port = state.port;
        if (!port) return;

        const listener = (message: AppEvent) => {
            lastEventRef.current = message;
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                if (lastEventRef.current) {
                    handleEventNotification(lastEventRef.current);
                    lastEventRef.current = null;
                }
            }, 500);
        };

        port.onMessage.addListener(listener);
        return () => {
            port.onMessage.removeListener(listener);
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [state.port]);

    return null;
}

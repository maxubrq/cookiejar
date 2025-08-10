import { AppEvent, AppStages } from '@/features/push';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function StageNotifier() {
    const { state, dispatch } = useCookieJarContext();

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
                onClick: () => {
                    toast.dismiss();
                },
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
                onClick: () => {
                    toast.dismiss();
                },
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
                onClick: () => {
                    toast.dismiss();
                },
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
                toastInfo(message);
                break;
            case AppStages.PUSH_DUMPING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PUSH_ENCRYPTING:
                toastInfo(message);
                break;
            case AppStages.PUSH_ENCRYPTING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PUSH_SENDING:
                toastInfo(message);
                break;
            case AppStages.PUSH_SENDING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PUSH_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PULL_DOWNLOADING:
                toastInfo(message);
                break;
            case AppStages.PULL_DOWNLOADING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PULL_DECRYPTING:
                toastInfo(message);
                break;
            case AppStages.PULL_DECRYPTING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PULL_APPLYING:
                toastInfo(message);
                break;
            case AppStages.PULL_APPLYING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.PULL_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.SETTINGS_LOADING:
                toastInfo(message);
                break;
            case AppStages.SETTINGS_LOADING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.SETTINGS_UPDATING:
                toastInfo(message);
                break;
            case AppStages.SETTINGS_UPDATING_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.APPLY_AUTO_SYNC_INTERVAL:
                toastInfo(message);
                break;
            case AppStages.APPLY_AUTO_SYNC_INTERVAL_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.APPLY_SYNC_ON_CHANGE:
                toastInfo(message);
                break;
            case AppStages.APPLY_SYNC_ON_CHANGE_COMPLETED:
                toastSuccess(message);
                break;
            case AppStages.APPLY_COOKIE_SUCCESS:
                toastSuccess(message);
                break;
            case AppStages.APPLY_COOKIE_FAILED:
                toastError(message, error);
                break;
            case AppStages.SET_SECRETS:
                toastInfo(message);
                break;
            case AppStages.SET_SECRETS_COMPLETED:
                toastSuccess(message);
                break;
            default:
                console.warn(`Unhandled stage: ${stage}`);
                break;
        }
    };

    useEffect(() => {
        let port = state.port;
        if (!port) {
            return;
        }
        port.onMessage.addListener((message: AppEvent) => {
            handleEventNotification(message);
        });
    }, [state.port, dispatch]);
    return <div></div>;
}

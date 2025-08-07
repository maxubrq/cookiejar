import { useCookieJarContext } from '@/hooks/useAppContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { toast } from 'sonner';

export default function SettingsDialog({
    children,
}: {
    children?: React.ReactNode;
}) {
    const { state, dispatch } = useCookieJarContext();
    const { settings } = state;

    const settingToast = (
        message: string,
        type: 'success' | 'error' | 'info' = 'info',
    ) => {
        const styles = {
            success: {
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
            },
            error: {
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
            },
            info: {
                background: '#d1ecf1',
                color: '#0c5460',
                border: '1px solid #bee5eb',
            },
        };

        toast[type](message, {
            duration: 3000,
            position: 'top-right',
            style: styles[type],
            icon: type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️',
        });
    };

    const onChangeEnableAutoSync = (value: boolean) => {
        dispatch({
            type: 'TOGGLE_AUTO_SYNC',
            payload: value,
        });

        if (value && settings.syncOnChange) {
            settingToast(
                'Auto Sync & Sync on Change are both enabled. Your cookies will be synced automatically whenever a change is detected or at the specified interval.',
                'success',
            );
        } else if (value && !settings.syncOnChange) {
            settingToast(
                'Auto Sync is enabled. Your cookies will only be synced at the specified interval.',
                'info',
            );
        } else {
            settingToast(
                'Auto Sync is disabled. You will need to sync cookies manually.',
                'info',
            );
        }
    };

    const onSyncIntervalMinutesChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1) {
            toast.error(
                'Please enter a valid sync interval in minutes (1 or more).',
                {
                    duration: 3000,
                    position: 'top-right',
                    style: {
                        background: '#f8d7da',
                        color: '#721c24',
                        border: '1px solid #f5c6cb',
                    },
                    icon: '⚠️',
                },
            );
            return;
        }

        dispatch({
            type: 'SET_SYNC_INTERVAL_MINUTES',
            payload: value,
        });

        settingToast(`Sync interval set to ${value} minute(s).`, 'success');
    };

    const onSyncOnChange = (value: boolean) => {
        dispatch({
            type: 'TOGGLE_SYNC_ON_CHANGE',
            payload: value,
        });

        if (value && settings.autoSyncEnabled) {
            settingToast(
                'Sync on Change is enabled. Your cookies will be synced automatically whenever a change is detected.',
                'success',
            );
        } else if (
            !value &&
            settings.autoSyncEnabled &&
            settings.syncIntervalInMinutes > 0
        ) {
            settingToast(
                'Sync on Change is disabled. Your cookies will only be synced at the specified interval.',
                'info',
            );
        }
    };

    return (
        <Dialog>
            <DialogTrigger className="settings-dialog-trigger">
                {children || 'Settings'}
            </DialogTrigger>
            <DialogContent className="max-w-md p-6 bg-white shadow-lg rounded-lg">
                <DialogTitle className="text-lg font-semibold mb-4 text-[var(--brand-red)]">
                    Settings
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mb-4">
                    Configure your settings below to sync your cookies across
                    devices.
                </DialogDescription>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Label htmlFor="enableAutoSync" className="text-[#333]">
                            Enable Auto Sync
                        </Label>
                        <Checkbox
                            id="enableAutoSync"
                            checked={settings.autoSyncEnabled}
                            onCheckedChange={onChangeEnableAutoSync}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="syncOnChange" className="text-[#333]">
                            Sync on Change
                        </Label>
                        <Checkbox
                            id="syncOnChange"
                            checked={settings.syncOnChange}
                            onCheckedChange={onSyncOnChange}
                            disabled={!settings.autoSyncEnabled}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="syncInterval" className="text-[#333]">
                            Sync Interval (minutes)
                        </Label>
                        <Input
                            id="syncInterval"
                            type="number"
                            min={1}
                            defaultValue={settings.syncIntervalInMinutes}
                            onChange={onSyncIntervalMinutesChange}
                            className="text-[#333]"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="settingsGistId" className="text-[#333]">
                            Settings Gist ID
                        </Label>
                        <p className="text-sm text-gray-500">
                            {settings.settingsGistId || 'Not set'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="settingsGistId" className="text-[#333]">
                            Content Gist ID
                        </Label>
                        <p className="text-sm text-gray-500">
                            {settings.contentGistId || 'Not set'}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

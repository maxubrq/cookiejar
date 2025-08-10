import { useCookieJarContext } from '@/hooks/useAppContext';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { CjSettings, PortCommands } from '@/domains';
import { useEffect, useState } from 'react';
import { LocalStorageRepo } from '@/features/shared';
import { LOCAL_STORAGE_KEYS } from '@/lib';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';

export default function SettingsDialog({
    children,
}: {
    children?: React.ReactNode;
}) {
    const { state, dispatch } = useCookieJarContext();
    const { settings, port } = state;

    useEffect(() => {
        const loadSettings = async () => {
            const localStorage = await LocalStorageRepo.getInstance();
            const settings = await localStorage.getItem<CjSettings>(LOCAL_STORAGE_KEYS.SETTINGS);
            if (!settings) {
                alert('No setting')
                return;
            }
            dispatch({ type: 'SET_SETTINGS', payload: settings });
        }
        loadSettings();
    }, []);

    const onChangeEnableAutoSync = (value: boolean) => {
        if (!port) {
            toast.error('Port is not connected. Please refresh the page.');
            return;
        }

        port.postMessage({
            command: PortCommands.SET_SETTINGS,
            payload: {
                ...settings,
                autoSyncEnabled: value,
            }
        });

        dispatch({
            type: 'TOGGLE_AUTO_SYNC',
            payload: value,
        });
    };

    const onSyncIntervalMinutesChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        if (!port) {
            toast.error('Port is not connected. Please refresh the page.');
            return;
        }

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

        port.postMessage({
            command: PortCommands.SET_SETTINGS,
            payload: {
                ...settings,
                syncIntervalInMinutes: value,
            }
        });

        dispatch({
            type: 'SET_SYNC_INTERVAL_MINUTES',
            payload: value,
        });
    };

    const onSyncOnChange = (value: boolean) => {
        if (!port) {
            toast.error('Port is not connected. Please refresh the page.');
            return;
        }
        port.postMessage({
            command: PortCommands.SET_SETTINGS,
            payload: {
                ...settings,
                syncOnChange: value,
            }
        });
        dispatch({
            type: 'TOGGLE_SYNC_ON_CHANGE',
            payload: value,
        });
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

                <AnimatePresence>
                    {
                        settings && <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-[200px_1fr] items-center gap-3">
                                    <Label htmlFor="enableAutoSync" className="text-[#333]">
                                        Enable Auto Sync
                                    </Label>
                                    <Switch
                                        id="enableAutoSync"
                                        checked={settings.autoSyncEnabled}
                                        onCheckedChange={onChangeEnableAutoSync}
                                    />
                                </div>

                                <div className="grid grid-cols-[200px_1fr] items-center gap-3">
                                    <Label htmlFor="syncOnChange" className="text-[#333]">
                                        Sync on Change
                                    </Label>
                                    <Switch
                                        id="syncOnChange"
                                        checked={settings.syncOnChange}
                                        onCheckedChange={onSyncOnChange}
                                        disabled={!settings.autoSyncEnabled}
                                    />
                                </div>

                                <div className="grid grid-cols-[200px_1fr] items-center gap-3">
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

                                <div className="grid grid-cols-[200px_1fr] items-center gap-3">
                                    <Label htmlFor="settingsGistId" className="text-[#333]">
                                        Gist ID
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        {settings.gistId?.slice(0, 15) || 'Not set'}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    }
                </AnimatePresence>

            </DialogContent>
        </Dialog>
    );
}

import CredentialDialog from '@/components/CredentialDialog';
import { DomainDialog } from '@/components/DomainDialog';
import { GithubTokenCard } from '@/components/GithubTokenCard';
import Logo from '@/components/Logo';
import PassPhraseCard from '@/components/PassPhraseCard';
import PullButton from '@/components/PullButton';
import PushButton from '@/components/PushButton';
import SettingsDialog from '@/components/SettingsDialog';
import StageNotifier from '@/components/StateNotifier';
import { Button } from '@/components/ui/button';
import { CjSecrets, CjSettings, DEFAULT_CJ_SETTINGS, PortCommands, PortMessage } from '@/domains';
import { AppEvent, AppStages } from '@/features/push';
import { LocalStorageRepo, requestDomainCookieAccess } from '@/features/shared';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { LOCAL_STORAGE_KEYS, PORT_NAME } from '@/lib/constants';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function App() {
    const { state } = useCookieJarContext();
    const { secrets } = state;

    const { dispatch } = useCookieJarContext();
    const [waitForPermissionUrls, setWaitForPermissionUrls] = useState<string[]>([]);
    const [waitForPermissionCookies, setWaitForPermissionCookies] = useState<chrome.cookies.Cookie[]>([]);
    const [latestSyncTimestamp, setLatestSyncTimestamp] = useState<number | undefined>(state.settings?.lastSyncTimestamp);

    const fetchSecrets = async () => {
        const localeStorage = LocalStorageRepo.getInstance();
        const secrets = await localeStorage.getItem<CjSecrets>(LOCAL_STORAGE_KEYS.SECRETS);
        if (secrets) {
            dispatch({ type: 'SET_SECRETS', payload: secrets });
        }
    };

    const fetchSettings = async () => {
        const localeStorage = LocalStorageRepo.getInstance();
        const settings = await localeStorage.getItem<CjSettings>(LOCAL_STORAGE_KEYS.SETTINGS);
        if (settings) {
            dispatch({ type: 'SET_SETTINGS', payload: settings });
        } else {
            localeStorage.setItem<CjSettings>(LOCAL_STORAGE_KEYS.SETTINGS, {
                ...DEFAULT_CJ_SETTINGS,
            });
        }
    };

    useEffect(() => {
        const loadLatestSyncTimestamp = async () => {
            const localeStorage = LocalStorageRepo.getInstance();
            const settings = await localeStorage.getItem<CjSettings>(LOCAL_STORAGE_KEYS.SETTINGS);
            if (settings) {
                setLatestSyncTimestamp(settings.lastSyncTimestamp);
            }
        };
        loadLatestSyncTimestamp();
    }, []);

    useEffect(() => {
        const port = state.port;
        if (!port) return;
        port.postMessage({
            command: PortCommands.APPLY_SETTINGS,
            payload: {
                ...state.settings,
            },
        } as PortMessage);
    }, [
        state.port,
        state.settings,
    ]);

    useEffect(() => {
        const port = chrome.runtime.connect({ name: PORT_NAME });
        dispatch({ type: 'SET_PORT', payload: port });

        port.onDisconnect.addListener(() => {
            toast.warning('Port disconnected. Please refresh the page.');
        });

        port.onMessage.addListener(async (message: AppEvent) => {
            if (message.stage === AppStages.SETTINGS_UPDATING_COMPLETED) {
                fetchSettings();
            } else if (message.stage === AppStages.PULL_COMPLETED) {
                fetchSettings();
            } else if (message.stage === AppStages.PULL_WAIT_FOR_PERMISSION) {
                const origins = message.urls ?? [];
                setWaitForPermissionUrls(origins);
                setWaitForPermissionCookies(message.cookies ?? []);
                setLatestSyncTimestamp(message.latestSyncTimestamp);
            } else if (message.stage === AppStages.PUSH_COMPLETED) {
                setLatestSyncTimestamp(message.latestSyncTimestamp);
            }
        });
    }, [dispatch, setWaitForPermissionUrls]);

    const onRequestAccess = async () => {
        if (!state.port) {
            toast.error('Port is not connected. Please try again later.');
            return;
        }

        const granted = await requestDomainCookieAccess("<all_urls>");
        if (!granted) {
            toast.error(`Permission denied for <all_urls>`);
        }

        state.port.postMessage({
            command: PortCommands.APPLY_COOKIES,
            payload: {
                cookies: [...waitForPermissionCookies],
                origins: [...waitForPermissionUrls],
            },
        } as PortMessage);
    };

    useEffect(() => {
        fetchSecrets();
        fetchSettings();
    }, [dispatch]);

    return (
        <motion.div
            className="w-screen h-screen overflow-x-hidden flex flex-col items-center justify-center text-center bg-[#fafafa] text-[#333]"
            layout
        >
            <div className="flex flex-row justify-end w-full p-4 gap-2 absolute top-0 right-0">
                <SettingsDialog>
                    <button className='bg-[#333] text-[#fafafa] rounded-full px-4 py-2'>Settings</button>
                </SettingsDialog>
                <DomainDialog>
                    <button className='bg-[#333] text-[#fafafa] rounded-full px-4 py-2'>Domains</button>
                </DomainDialog>
                <CredentialDialog>
                    <button className='bg-[red] text-[#fafafa] rounded-full px-4 py-2'>Credentials</button>
                </CredentialDialog>
            </div>

            <motion.div
                className="mb-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
            >
                <Logo className="w-32 h-32" />
            </motion.div>

            {/* GRETTING */}

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="flex flex-col items-center justify-center p-4"
            >
                <h1 className="mb-4 text-4xl font-bold">
                    CookieJar <em>®</em>
                </h1>
                <p>Welcome to the cookiejar extension!</p>
                <p>
                    <strong>
                        CookieJar is used to sync your cookies across devices.
                    </strong>
                </p>
            </motion.div>

            {/* IF Github PAT is not set, show a message */}
            <AnimatePresence>
                {!secrets?.ghp && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="flex flex-col items-center justify-center p-4"
                        layout
                    >
                        <GithubTokenCard />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* IF Passphrase is not set, show a message */}
            <AnimatePresence>
                {!secrets?.passPhrase && secrets?.ghp && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="flex flex-col items-center justify-center p-4"
                        layout
                    >
                        <PassPhraseCard />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sync & Pull Manual buttons */}
            <AnimatePresence>
                {secrets?.ghp && secrets?.passPhrase && (
                    <motion.div
                        className='flex flex-col items-center justify-center p-4'
                    >
                        {/* LAST SYNC */}
                        {
                            latestSyncTimestamp && (
                                <p className="text-sm text-gray-500 mb-2">
                                    Last Sync: {new Date(latestSyncTimestamp).toLocaleString()}
                                </p>
                            )
                        }
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="flex flex-row items-center justify-center p-4 gap-4"
                        >
                            <PushButton />
                            <PullButton />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {waitForPermissionUrls.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="flex flex-col items-center justify-center p-4"
                        layout
                    >
                        <p className='text-sm text-red-500 mb-2'>
                            {`There are ${waitForPermissionUrls.length} domains containing ${waitForPermissionCookies.length} cookies waiting for permission.`}
                        </p>
                        <Button variant="default" onClick={onRequestAccess} className='bg-[#333] text-[#fafafa] mt-2'>
                            Click me to grant access & apply cookies
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
            <StageNotifier />
        </motion.div>
    );
}

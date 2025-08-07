import { DomainDialog } from '@/components/DomainDialog';
import { GithubTokenCard } from '@/components/GithubTokenCard';
import Logo from '@/components/Logo';
import PassPhraseCard from '@/components/PassPhraseCard';
import SettingsDialog from '@/components/SettingsDialog';
import { LocalStorageRepo } from '@/features/shared';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

export default function App() {
    const { state } = useCookieJarContext();
    const { settings, secrets } = state;

    const { dispatch } = useCookieJarContext();

    useEffect(() => {
        const fetchSecrets = async () => {
            const localeStorage = LocalStorageRepo.getInstance();
            const secrets = await localeStorage.getItem<{
                ghp?: string;
                passPhrase?: string;
            }>(LOCAL_STORAGE_KEYS.SECRETS);

            if (secrets?.ghp) {
                dispatch({
                    type: 'SET_GITHUB_PAT',
                    payload: {
                        ghp: secrets.ghp,
                    },
                });
            }

            if (secrets?.passPhrase) {
                dispatch({
                    type: 'SET_PASSPHRASE',
                    payload: {
                        passPhrase: secrets.passPhrase,
                    },
                });
            }
        };

        fetchSecrets();
    }, [dispatch]);

    return (
        <motion.div
            className="w-screen h-screen overflow-x-hidden flex flex-col items-center justify-center text-center bg-[#fafafa] text-[#333]"
            layout
        >
            <div className="flex flex-row justify-end w-full p-4 gap-2 absolute top-0 right-0">
                <SettingsDialog>Settings</SettingsDialog>
                <DomainDialog>Domains</DomainDialog>
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
                <h1 className="mb-4">
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
                {!secrets.ghp && (
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
                {!secrets.passPhrase && secrets.ghp && (
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
        </motion.div>
    );
}

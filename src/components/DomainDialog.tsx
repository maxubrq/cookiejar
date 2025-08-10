import { CjSettings, PortCommands, PortMessage } from '@/domains';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { LocalStorageRepo, requestDomainCookieAccess, toOriginPermissionPattern } from '@/features/shared';
import { LOCAL_STORAGE_KEYS } from '@/lib';
import { ScrollArea } from './ui/scroll-area';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';

// --------------------------------------------------------------------------

export function DomainDialog({ children }: { children?: React.ReactNode }) {
    const { state, dispatch } = useCookieJarContext();
    const { settings } = state;
    const [currentDomain, setCurrentDomain] = useState<string>('');
    const total = useMemo(() => settings?.syncUrls?.length ?? 0, [settings]);
    const domains = useMemo(() => settings?.syncUrls ?? [], [settings]);

    useEffect(() => {
        const loadUrls = async () => {
            const localStorage = LocalStorageRepo.getInstance();
            const settings = await localStorage.getItem<CjSettings>(LOCAL_STORAGE_KEYS.SETTINGS);
            if (!settings) {
                return;
            }
            dispatch({ type: 'SET_SETTINGS', payload: settings });
        };

        loadUrls();
    }, []);

    const handleAddDomain = async (raw: string) => {
        const helper = async (raw: string, variant?: "sub" | "dot") => {
            const origin = toOriginPermissionPattern(raw, variant);
            if (!origin) {
                toast.error('Enter a valid domain or URL (e.g., example.com or https://site.com).');
                return;
            }

            if (domains.includes(origin)) {
                toast.info('This domain is already in your list.');
                setCurrentDomain('');
                return;
            }

            if (!state.port) {
                toast.error('Port is not connected. Please try again later.');
                return;
            }

            const granted = await requestDomainCookieAccess(origin);
            if (!granted) {
                toast.error(`Permission denied for: ${origin}. Allow access in Chrome settings.`);
                return;
            }

            state.port.postMessage({
                command: PortCommands.ADD_SYNC_URL,
                payload: { url: origin },
            } as PortMessage);

            dispatch({ type: 'ADD_SYNC_URL', payload: origin });
        }

        helper(raw);
        helper(raw, "sub"); // Also try with subdomain wildcard
        helper(raw, "dot"); // Also try with dot wildcard
        setCurrentDomain('');
    };

    const handleRemoveDomain = (origin: string) => {
        if (!state.port) {
            toast.error('Port is not connected. Please try again later.');
            return;
        }

        state.port.postMessage({
            command: PortCommands.REMOVE_SYNC_URL,
            payload: { url: origin },
        } as PortMessage);

        dispatch({ type: 'REMOVE_SYNC_URL', payload: origin });
    };



    return (
        <div className="domain-dialog">
            <Dialog>
                <DialogTrigger className="domain-dialog-trigger">
                    {children || 'Manage Domains'}
                </DialogTrigger>

                <DialogContent className="max-w-lg p-6 bg-white shadow-lg rounded-lg">
                    <DialogTitle className="text-lg font-semibold mb-2 text-[var(--color-primary,#db302a)]">
                        Manage Sync Domains
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mb-4">
                        Add or remove domains whose cookies you want to sync.
                    </DialogDescription>

                    {/* ADD DOMAIN */}
                    <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
                        <Input
                            type="text"
                            placeholder="example.com or https://sub.example.com"
                            className="text-[#333] border border-gray-300 rounded-md"
                            value={currentDomain}
                            onChange={(e) => setCurrentDomain(e.target.value)}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && currentDomain.trim()) {
                                    await handleAddDomain(currentDomain);
                                }
                            }}
                        />
                        <Button
                            variant="default"
                            className='bg-[#333] text-[#fafafa]'
                            onClick={async () => {
                                if (currentDomain.trim()) {
                                    await handleAddDomain(currentDomain);
                                }
                            }}
                        >
                            Add
                        </Button>
                    </div>

                    <AnimatePresence>
                        {
                            domains.length > 0 && <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* DOMAIN LIST HEADER */}
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-[#333] font-medium">Allowed domains</p>
                                    <p className="text-xs text-gray-500">{total ? `Total: ${total}` : 'None'}</p>
                                </div>

                                {/* DOMAIN LIST */}
                                <ScrollArea className='h-[400px] overflow-y-auto'>
                                    <div className="w-full rounded-md border border-gray-200">
                                        {domains.length === 0 ? (
                                            <div className="p-3 text-sm text-gray-500">No domains added.</div>
                                        ) : (
                                            <ul className="divide-y divide-gray-200">
                                                {domains.map((origin) => (
                                                    <li
                                                        key={origin}
                                                        className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2"
                                                    >
                                                        <span className="truncate text-[#333]" title={origin}>
                                                            {origin}
                                                        </span>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleRemoveDomain(origin)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        }
                    </AnimatePresence>
                </DialogContent>
            </Dialog>
        </div>
    );
}

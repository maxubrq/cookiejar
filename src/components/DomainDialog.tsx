import { useCookieJarContext } from '@/hooks/useAppContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { CookieRepo } from '@/features/shared/cookie.repo';

async function requestDomainCookieAccess(domain: string): Promise<boolean> {
    const permission = { origins: [domain] };

    return new Promise((resolve) => {
        chrome.permissions.request(permission, (granted) => {
            resolve(granted);
        });
    });
}

export function DomainDialog({ children }: { children?: React.ReactNode }) {
    const { state, dispatch } = useCookieJarContext();
    const { settings } = state;
    const { syncUrls: urls } = settings;
    const [currentDomain, setCurrentDomain] = useState<string>('');

    const handleAddDomain = async (domain: string) => {
        if (!domain) return;
        if (urls.includes(domain)) {
            toast.error(`Domain ${domain} is already added.`);
            return;
        }

        const granted = await requestDomainCookieAccess(domain);
        if (!granted) {
            toast.error(
                `Permission denied for domain: ${domain}. Please allow access in Chrome settings.`,
            );
            return;
        }

        dispatch({ type: 'ADD_SYNC_URL', payload: domain });
        setCurrentDomain('');

        const cookiesRepo = CookieRepo.getInstance();
        const cookies = await cookiesRepo.getAllFromDomain(domain);
        toast.success(
            `Added domain: ${domain} with ${cookies.length} cookies.`,
        );
    };

    const handleRemoveDomain = (domain: string) => {
        dispatch({ type: 'REMOVE_SYNC_URL', payload: domain });
    };

    return (
        <div className="domain-dialog">
            <Dialog>
                <DialogTrigger className="domain-dialog-trigger">
                    {children || 'Manage Domains'}
                </DialogTrigger>
                <DialogContent className="domain-dialog-content bg-white shadow-lg rounded-lg">
                    <DialogTitle className="text-[var(--brand-red)]">
                        Manage Sync Domains
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 mb-4">
                        Add or remove domains to sync cookies for.
                    </DialogDescription>

                    {/* ADD DOMAIN */}
                    <div className="flex flex-row items-center gap-2 mb-4">
                        <Input
                            type="text"
                            placeholder="Enter domain"
                            className="flex-1 text-[#333] border border-gray-300 rounded-md p-2"
                            value={currentDomain}
                            onChange={(e) => setCurrentDomain(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddDomain(e.currentTarget.value);
                                }
                            }}
                        />

                        <Button
                            onClick={() => {
                                if (currentDomain) {
                                    handleAddDomain(currentDomain);
                                }
                            }}
                        >
                            Add Domain
                        </Button>
                    </div>

                    {/* DOMAIN LIST */}
                    <p className="text-[#333]">
                        {urls.length
                            ? `Total: ${urls.length}`
                            : 'No domains added'}
                    </p>
                    <div className="domain-list w-full">
                        {urls.map((url) => (
                            <div
                                key={url}
                                className="domain-item flex items-center justify-between"
                            >
                                <span className="text-[#333]">{url}</span>
                                <button
                                    onClick={() => handleRemoveDomain(url)}
                                    className="remove-domain-button"
                                >
                                    Remove
                                </button>
                                <hr className="my-2 border-gray-300" />
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { PortCommands } from '@/domains';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { useEffect, useMemo, useState } from 'react';

import { Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from './ui/tooltip';

type SettingsShape = {
    github?: { pat?: string | null } | null;
    passPhrase?: string | null;
};

export default function CredentialDialog({
    children,
}: {
    children?: React.ReactNode;
}) {
    const { state } = useCookieJarContext();
    const { settings, port } = state as { settings?: SettingsShape | null; port?: chrome.runtime.Port | null };

    const initialPat = settings?.github?.pat ?? '';
    const initialPass = settings?.passPhrase ?? '';

    const [open, setOpen] = useState(false);
    const [pat, setPat] = useState(initialPat);
    const [passPhrase, setPassPhrase] = useState(initialPass);
    const [showPat, setShowPat] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset inputs when dialog opens or settings change
    useEffect(() => {
        if (open) {
            setPat(settings?.github?.pat ?? '');
            setPassPhrase(settings?.passPhrase ?? '');
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, settings?.github?.pat, settings?.passPhrase]);

    const validation = useMemo(() => {
        const v: { pat?: string; pass?: string } = {};
        // PAT: require at least one token-like length; GitHub classic tokens start with ghp_ / gho_/ghu_/ghs_ / github_pat_...
        if (!pat || pat.trim().length < 20) v.pat = 'Enter a valid Personal Access Token.';
        if (passPhrase.trim().length < 8) v.pass = 'Passphrase must be at least 8 characters.';
        return v;
    }, [pat, passPhrase]);

    const dirty = useMemo(() => pat !== initialPat || passPhrase !== initialPass, [pat, passPhrase, initialPat, initialPass]);
    const canSave = dirty && !validation.pat && !validation.pass && !saving;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const newSettings: SettingsShape = {
                github: { pat: pat.trim() },
                passPhrase: passPhrase.trim(),
            };

            port?.postMessage?.({
                type: PortCommands.SET_SECRETS,
                payload: {
                    ghp: newSettings.github,
                    passPhrase: newSettings.passPhrase,
                }
            });

            setOpen(false);
        } catch (e: any) {
            setError(e?.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="settings-dialog-trigger">
                {children || 'Settings'}
            </DialogTrigger>

            <DialogContent className="max-w-md p-6 bg-white shadow-lg rounded-lg">
                <DialogTitle className="text-lg font-semibold mb-4 text-[var(--brand-red)]">
                    Credentials
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mb-4">
                    Configure your credentials to sync cookies securely across devices.
                </DialogDescription>

                {/* GitHub PAT */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="github-pat" className="text-sm font-medium">
                            GitHub Personal Access Token
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" aria-label="PAT info" className="inline-flex">
                                    <Info className="h-4 w-4 text-gray-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-sm">
                                Use a GitHub <b>fine-grained token</b> with access to Gists (read &amp; write) or a classic token with the <code>gist</code> scope.
                                We only store it locally and use it to read/write an encrypted Gist for sync.
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="relative">
                        <Input
                            id="github-pat"
                            type={showPat ? 'text' : 'password'}
                            value={pat}
                            onChange={(e) => setPat(e.target.value)}
                            placeholder="github_pat_************************"
                            autoComplete="off"
                            className={['pr-10', validation.pat ? 'border-red-500' : ''].join(' ')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPat((s) => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                            aria-label={showPat ? 'Hide token' : 'Show token'}
                        >
                            {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {validation.pat && (
                        <p className="text-xs text-red-600">{validation.pat}</p>
                    )}
                </div>

                {/* Passphrase */}
                <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="passphrase" className="text-sm font-medium">
                            Passphrase
                        </Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" aria-label="Passphrase info" className="inline-flex">
                                    <Info className="h-4 w-4 text-gray-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-sm">
                                Used to derive an encryption key (e.g., PBKDF2/Argon2) for AES-GCM.
                                Keep this safe—losing it means you can’t decrypt your synced data.
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="relative">
                        <Input
                            id="passphrase"
                            type={showPass ? 'text' : 'password'}
                            value={passPhrase}
                            onChange={(e) => setPassPhrase(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            className={['pr-10', validation.pass ? 'border-red-500' : ''].join(' ')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass((s) => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                            aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
                        >
                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {validation.pass && (
                        <p className="text-xs text-red-600">{validation.pass}</p>
                    )}
                </div>

                {/* Actions */}
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex items-center justify-end gap-2">
                    <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={!canSave}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

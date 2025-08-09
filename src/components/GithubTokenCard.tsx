import { LocalStorageRepo } from '@/features/shared';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';

export function GithubTokenCard() {
    const { dispatch, state } = useCookieJarContext();
    const [ghp, setGhp] = useState('');

    const onSaveGhp = () => {
        // Dispatch an action to set the GitHub PAT in the context
        dispatch({ type: 'SET_GITHUB_PAT', payload: { ghp: btoa(ghp) } });

        const storageRepo = LocalStorageRepo.getInstance();
        // Save the GitHub PAT to local storage
        storageRepo.setItem(LOCAL_STORAGE_KEYS.SECRETS, {
            ...state.secrets,
            ghp: btoa(ghp), // Encode the PAT
        });

        toast.success('GitHub Personal Access Token saved successfully!');
        setGhp(''); // Clear the input field after saving
    };

    return (
        <>
            <Card className="w-full max-w-md p-6 bg-[#fafafafa] text-[#333] shadow-lg rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                    GitHub Personal Access Token
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    Please enter your GitHub Personal Access Token (PAT) to sync
                    your cookies.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                    <strong>Note:</strong> GitHub PAT needs read and write
                    access to Gists.
                </p>
                <Input
                    className="w-full rounded-[9px]"
                    autoFocus
                    id="ghp"
                    name="ghp"
                    type="password"
                    placeholder="github_pat_************************"
                    value={ghp}
                    onChange={(e) => setGhp(e.target.value)}
                />
                <Button
                    onClick={onSaveGhp}
                    className='bg-[#000] text-white hover:bg-[#333] mt-4'
                >
                    Save Token
                </Button>
            </Card>
        </>
    );
}

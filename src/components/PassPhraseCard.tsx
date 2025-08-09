import { useCookieJarContext } from '@/hooks/useAppContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { LocalStorageRepo } from '@/features/shared';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { Button } from './ui/button';

export default function PassPhraseCard() {
    const { dispatch, state } = useCookieJarContext();
    const [passPhrase, setPassPhrase] = useState('');

    const onSavePassPhrase = async () => {
        // Dispatch an action to set the passphrase in the context
        const storageRepo = LocalStorageRepo.getInstance();
        dispatch({ type: 'SET_PASSPHRASE', payload: { passPhrase } });

        // Save the passphrase to local storage
        // This is where you would typically encrypt the passphrase before saving
        // For simplicity, we are saving it as plain text here
        // In a real application, you should encrypt sensitive data before storing it
        // You can use a library like CryptoJS or Web Crypto API for encryption
        // Example: const encryptedPassPhrase = encrypt(passPhrase);
        // await storageRepo.setItem(LOCAL_STORAGE_KEYS.SECRETS, {
        //     ...state.secrets,
        //     passPhrase: encryptedPassPhrase,
        // });
        // For now, we will just save it as is
        // This is not secure and should not be used in production code
        await storageRepo.setItem(LOCAL_STORAGE_KEYS.SECRETS, {
            ...state.secrets,
            passPhrase: btoa(passPhrase), // Encode the passphrase
        });

        toast.success('Passphrase saved successfully!');
        setPassPhrase(''); // Clear the input field after saving
    };

    return (
        <Card className="w-full max-w-md p-6 bg-[#fafafafa] text-[#333] shadow-lg rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Passphrase</h3>
            <p className="text-sm text-gray-500 mb-4">
                <strong className="mb-0.5">
                    Please enter your passphrase to encrypt your cookies.
                </strong>
                <br />
                This passphrase is used to encrypt your cookies and is required
                for syncing them across devices.
            </p>
            <Input
                className="w-full rounded-[9px]"
                autoFocus
                id="passphrase"
                name="passphrase"
                type="password"
                placeholder="Enter your passphrase"
                value={passPhrase}
                onChange={(e) => setPassPhrase(e.target.value)}
            />
            <Button
                onClick={onSavePassPhrase}
                className='bg-[#000] text-white hover:bg-[#333] mt-4'
            >
                Save Passphrase
            </Button>
        </Card>
    );
}

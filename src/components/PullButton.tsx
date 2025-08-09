import { useCookieJarContext } from '@/hooks/useAppContext';
import { Button } from './ui/button';

export default function PullButton() {
    const { state } = useCookieJarContext();
    const { settings } = state;

    const handlePull = () => {
        // Logic to pull cookies
        console.log('Pulling cookies...');
        // Dispatch an action or call a function to perform the pull
    };

    return (
        <Button
            onClick={handlePull}
            className="pull-button hover:text-[#333]"
            variant="outline"
        >
            Pull Cookies
        </Button>
    );
}

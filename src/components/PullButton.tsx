import { useCookieJarContext } from '@/hooks/useAppContext';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { PortCommands, PortMessage } from '@/domains';

export default function PullButton() {

    const { state } = useCookieJarContext();

    const handlePull = () => {
        if (!state.port) {
            toast.error('No connection to the service worker. Please refresh the page or restart the extension.');
            return;
        }

        state.port.postMessage({
            command: PortCommands.PULL,
            data: {},
        } as PortMessage);
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

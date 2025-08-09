import { PortCommands, PortMessage } from '@/domains';
import { useCookieJarContext } from '@/hooks/useAppContext';
import { toast } from 'sonner';
import { Button } from './ui/button';

export default function PushButton() {
    const { state } = useCookieJarContext();

    const handlePush = () => {
        let port = state.port;
        if (!port) {
            toast.error('Port is not connected. Please try again later.');
            return;
        }
        port.postMessage({
            command: PortCommands.PUSH,
            payload: {},
        } as PortMessage);

    };

    return (
        <Button onClick={handlePush} className="sync-button" variant="default">
            Push Cookies
        </Button>
    );
}

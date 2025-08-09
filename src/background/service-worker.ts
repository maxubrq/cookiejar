import { PortCommands, PortMessage } from '@/domains';
import { PushService } from '@/features/push';
import { SettingsService } from '@/features/settings';
import { PORT_NAME } from '@/lib';

function registerForSidePanel() {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.sidePanel
            .setPanelBehavior({
                openPanelOnActionClick: true,
            })
            .catch((error) => {
                console.error('Error setting side panel behavior:', error);
            });
    });
}

function startListeningForPort() {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== PORT_NAME) return;

        console.info(`Connected to port: ${port.name}`);
        const pushService = new PushService(port);
        const settingsService = SettingsService.getInstance(port);
        pushService.selfRegister();
        settingsService.selfRegister();

        port.onMessage.addListener((message: PortMessage) => {
            if(message.command === PortCommands.APPLY_SETTINGS){
                console.info('Applying settings:', message.payload);
            }
        });
    });
    console.info(`Listening for port: ${PORT_NAME}`);
}

function main() {
    registerForSidePanel();
    startListeningForPort();
}

main();

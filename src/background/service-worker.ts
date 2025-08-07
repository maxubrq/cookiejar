function registerForSidePanel() {
    chrome.sidePanel
        .setPanelBehavior({
            openPanelOnActionClick: true,
        })
        .catch((error) => {
            console.error('Error setting side panel behavior:', error);
        });
}

function main() {
    registerForSidePanel();
}

main();

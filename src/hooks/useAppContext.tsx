import {
    CookieJarAction,
    CookieJarContextType,
    CookieJarState
} from '@/domains';
import {
    createContext,
    ReactNode,
    useContext,
    useReducer
} from 'react';

const CookieJarContext = createContext<CookieJarContextType | null>(null);

export const CookieJarProvider = CookieJarContext.Provider;

export function useCookieJarContext(): CookieJarContextType {
    const context = useContext(CookieJarContext);
    if (!context) {
        throw new Error(
            'useCookieJarContext must be used within a CookieJarProvider',
        );
    }
    return context;
}

const initialState: CookieJarState = {
    settings: null,
    secrets: null,
    port: null,
};

function cookieJarReducer(
    state: CookieJarState,
    action: CookieJarAction,
): CookieJarState {
    switch (action.type) {
        case 'SET_SETTINGS':
            return {
                ...state,
                settings: {
                    ...action.payload,
                },
            };
        case 'SET_SECRETS':
            return {
                ...state,
                secrets: action.payload,
            };
        case 'SET_GITHUB_PAT':
            return {
                ...state,
                secrets: {
                    ...state.secrets,
                    ghp: action.payload.ghp,
                },
            };
        case 'SET_PASSPHRASE':
            return {
                ...state,
                secrets: {
                    ...state.secrets,
                    passPhrase: action.payload.passPhrase,
                },
            };
        case 'TOGGLE_AUTO_SYNC':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    autoSyncEnabled:
                        action.payload ?? !state.settings?.autoSyncEnabled,
                },
            };
        case 'TOGGLE_SYNC_ON_CHANGE':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    syncOnChange:
                        action.payload ?? !state.settings?.syncOnChange,
                },
            };
        case 'ADD_SYNC_URL':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    syncUrls: [...state.settings?.syncUrls ?? [], action.payload],
                },
            };
        case 'REMOVE_SYNC_URL':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    syncUrls: state.settings?.syncUrls?.filter(
                        (url) => url !== action.payload,
                    ) ?? [],
                },
            };
        case 'SET_SYNC_URLS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    syncUrls: action.payload,
                },
            };
        case 'SET_SYNC_INTERVAL_MINUTES':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    syncIntervalInMinutes:
                        action.payload ?? state.settings?.syncIntervalInMinutes ?? 15,
                },
            };
        case 'SET_PORT':
            return {
                ...state,
                port: action.payload,
            };
        default:
            return state;
    }
}

export function CookieJarContextProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [state, dispatch] = useReducer(cookieJarReducer, initialState);

    return (
        <CookieJarProvider value={{ state, dispatch }}>
            {children}
        </CookieJarProvider>
    );
}

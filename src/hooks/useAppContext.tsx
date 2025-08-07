import {
    CookieJarAction,
    CookieJarContextType,
    CookieJarState,
    DEFAULT_CJ_SETTINGS,
} from '@/domains';
import { createContext, ReactNode, useContext, useReducer } from 'react';

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
    settings: {
        ...DEFAULT_CJ_SETTINGS,
    },
    secrets: {
        ghp: '',
        passPhrase: '',
    },
    status: 'idle',
    errorMessage: null,
};

function cookieJarReducer(
    state: CookieJarState,
    action: CookieJarAction,
): CookieJarState {
    switch (action.type) {
        case 'SET_SETTINGS':
            return {
                ...state,
                settings: action.payload,
            };
        case 'SET_SECRETS':
            return {
                ...state,
                secrets: action.payload,
            };
        case 'SET_STATUS':
            return {
                ...state,
                status: action.payload,
            };
        case 'SET_ERROR_MESSAGE':
            return {
                ...state,
                errorMessage: action.payload,
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

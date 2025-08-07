import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CookieJarContextProvider } from '@/hooks/useAppContext.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <CookieJarContextProvider>
            <App />
        </CookieJarContextProvider>
    </StrictMode>,
);

import { CookieJarContextProvider } from '@/hooks/useAppContext.tsx';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <>
        <CookieJarContextProvider>
            <App />
        </CookieJarContextProvider>
        <Toaster />
    </>
);
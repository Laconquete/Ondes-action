import { createRoot } from 'react-dom/client';
import { AppRoot } from './AppRoot.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Toaster } from './components/ui/Toaster.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <AppRoot />
    {/* Toaster monté au niveau racine — visible quel que soit l'écran (login, app, modales) */}
    <Toaster />
  </ThemeProvider>
);

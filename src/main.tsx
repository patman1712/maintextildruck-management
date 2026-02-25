import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// PWA Registration only if supported
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        if (confirm('Neue Version verfügbar. Aktualisieren?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.log('App bereit für Offline-Nutzung');
      },
    });
  }).catch(() => {
    console.log('PWA not supported or disabled');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

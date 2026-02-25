import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

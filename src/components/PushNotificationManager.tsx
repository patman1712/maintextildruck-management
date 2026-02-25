import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { urlBase64ToUint8Array } from '@/utils/push';

export function PushNotificationManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for iOS Standalone Mode requirement
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (isIOS && !isStandalone) {
        setError("Hinweis: Auf dem iPhone müssen Sie diese Webseite erst zum Home-Bildschirm hinzufügen ('Teilen' -> 'Zum Home-Bildschirm'), um Push-Benachrichtigungen aktivieren zu können.");
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        setRegistration(reg);
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
          }
        });
      });
    }
  }, []);

  const subscribeUser = async () => {
    if (!registration) {
        setError("Service Worker nicht bereit. Bitte laden Sie die Seite neu.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Check Permission
      let permission = Notification.permission;
      if (permission === 'default') {
          permission = await Notification.requestPermission();
      }
      
      if (permission !== 'granted') {
          throw new Error('Benachrichtigungen wurden nicht erlaubt (Status: ' + permission + ').');
      }

      // 2. Get Public Key
      const response = await fetch('/api/push/public-key');
      if (!response.ok) throw new Error('Server-Verbindung fehlgeschlagen');
      
      const data = await response.json();
      if (!data.success || !data.publicKey) {
          throw new Error('Public Key could not be retrieved');
      }

      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);
      
      // 3. Subscribe
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      
      // 4. Send to Backend
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });

      if (!saveRes.ok) throw new Error('Speichern auf Server fehlgeschlagen');
      
      setSubscription(sub);
      setIsSubscribed(true);
      
    } catch (e: any) {
      console.error('Subscription failed', e);
      setError(`Fehler: ${e.message || 'Unbekannter Fehler'}`);
    } finally {
        setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
      if(!subscription) return;
      setLoading(true);
      try {
          await subscription.unsubscribe();
          setSubscription(null);
          setIsSubscribed(false);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null; // Not supported
  }

  return (
    <div className="flex flex-col items-start">
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      
      {loading ? (
          <button disabled className="flex items-center text-gray-400 bg-gray-50 px-3 py-2 rounded-lg cursor-not-allowed">
              <Loader2 className="mr-2 animate-spin" size={20} />
              <span>Verarbeite...</span>
          </button>
      ) : isSubscribed ? (
        <button onClick={unsubscribeUser} className="flex items-center text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 px-4 py-2 rounded-lg transition-colors border border-green-200">
            <Bell className="mr-2" size={20} />
            <span className="font-medium">Push-Benachrichtigungen aktiv</span>
        </button>
      ) : (
        <button onClick={subscribeUser} className="flex items-center text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors border border-gray-300 shadow-sm">
             <BellOff className="mr-2" size={20} />
             <span className="font-medium">Benachrichtigungen aktivieren</span>
        </button>
      )}
    </div>
  );
}

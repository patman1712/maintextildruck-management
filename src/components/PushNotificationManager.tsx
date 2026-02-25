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
    if (!registration) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/push/public-key');
      const data = await response.json();
      
      if (!data.success || !data.publicKey) {
          throw new Error('Public Key could not be retrieved');
      }

      const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      
      setSubscription(sub);
      setIsSubscribed(true);
      
      // Test Notification
      /*
      await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Willkommen!', body: 'Push-Benachrichtigungen sind nun aktiv.' })
      });
      */
      
    } catch (e: any) {
      console.error('Subscription failed', e);
      setError('Aktivierung fehlgeschlagen. Bitte prüfen Sie Ihre Browser-Einstellungen.');
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

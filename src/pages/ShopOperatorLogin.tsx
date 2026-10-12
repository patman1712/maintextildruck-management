import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { Lock, User, Store } from 'lucide-react';

export default function ShopOperatorLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const shopOperatorLogin = useAppStore((state) => state.shopOperatorLogin);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data.success && data.settings && data.settings.logo) setLogoUrl(data.settings.logo);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/shop-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success && data.user) {
        shopOperatorLogin(data.user, data.shops || []);
        if ((data.shops || []).length === 1) {
          navigate(`/shop-operator/${data.shops[0].id}`);
        } else if ((data.shops || []).length > 1) {
          navigate('/shop-operator');
        } else {
          setError('Ihnen wurden noch keine Shops zugewiesen. Bitte kontaktieren Sie den Administrator.');
        }
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-slate-800 to-slate-600">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
              <Store size={32} />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-800">Shop-Betreiber Login</h1>
          <p className="text-gray-500 text-sm mt-1">Verwaltung Ihres Online-Shops</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded focus:ring-slate-500 focus:border-slate-500"
                placeholder="Benutzername eingeben"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded focus:ring-slate-500 focus:border-slate-500"
                placeholder="Passwort eingeben"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-900 transition-colors font-medium"
          >
            Anmelden
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Sind Sie Mitarbeiter?{' '}
          <a href="/login" className="text-slate-600 underline hover:text-slate-800">Zur Mitarbeiter-Anmeldung</a>
        </p>
      </div>
    </div>
  );
}

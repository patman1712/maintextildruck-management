
import React, { useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useShopStore } from '../../shopStore';

const ShopLogin: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const login = useShopStore(state => state.login);
  const { primaryColor } = useOutletContext<{ primaryColor: string }>();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/shop-customers/${shopId}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        login(data.data);
        navigate(`/shop/${shopId}`);
      } else {
        setError(data.error || 'Login fehlgeschlagen.');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 flex justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="p-8 lg:p-12">
          <h1 className="text-3xl font-black mb-2 text-slate-900 flex items-center">
            <LogIn className="mr-3" size={28} />
            Anmelden
          </h1>
          <p className="text-slate-500 mb-8 font-medium">Willkommen zurück! Bitte loggen Sie sich ein.</p>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-slate-400">E-Mail Adresse</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                  placeholder="name@beispiel.de"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-bold uppercase tracking-widest text-slate-400">Passwort</label>
                <a href="#" className="text-xs font-bold underline text-slate-400 hover:text-slate-600">Vergessen?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 mt-4 flex items-center justify-center group"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Anmeldung...' : (
                <>
                  Jetzt einloggen
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                </>
              )}
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-slate-300 font-bold text-xs uppercase tracking-widest">Oder</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <Link
              to={`/shop/${shopId}/register`}
              className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-center block"
            >
              Neues Konto erstellen
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShopLogin;

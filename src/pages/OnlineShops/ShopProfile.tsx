
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { User, Mail, Lock, Building, MapPin, Phone, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useShopStore } from '../../shopStore';

const ShopProfile: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { currentCustomer, login } = useShopStore();
  const { primaryColor } = useOutletContext<{ primaryColor: string }>();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    company: '',
    street: '',
    zip: '',
    city: '',
    phone: ''
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string | null }>({ type: null, message: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentCustomer) {
      navigate(`/shop/${shopId}/login`);
      return;
    }

    setFormData({
      email: currentCustomer.email || '',
      password: '',
      confirmPassword: '',
      first_name: currentCustomer.first_name || '',
      last_name: currentCustomer.last_name || '',
      company: currentCustomer.company || '',
      street: currentCustomer.street || '',
      zip: currentCustomer.zip || '',
      city: currentCustomer.city || '',
      phone: currentCustomer.phone || ''
    });
  }, [currentCustomer, shopId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, message: null });

    if (formData.password !== formData.confirmPassword) {
      setStatus({ type: 'error', message: 'Passwörter stimmen nicht überein.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/profile/${currentCustomer?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        login(data.data);
        setStatus({ type: 'success', message: 'Profil erfolgreich aktualisiert.' });
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else {
        setStatus({ type: 'error', message: data.error || 'Aktualisierung fehlgeschlagen.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="p-8 lg:p-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Mein Profil</h1>
              <p className="text-slate-500 font-medium">Verwalten Sie Ihre persönlichen Daten und Anschrift.</p>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: primaryColor }}>
              {currentCustomer?.first_name?.charAt(0)}{currentCustomer?.last_name?.charAt(0)}
            </div>
          </div>

          {status.message && (
            <div className={`p-4 mb-8 rounded-xl flex items-center space-x-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Persönliche Daten</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="first_name"
                      placeholder="Vorname"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.first_name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="last_name"
                      placeholder="Nachname"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="company"
                      placeholder="Firma (Optional)"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Telefon"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Address Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Anschrift</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      name="street"
                      placeholder="Straße & Hausnummer"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.street}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <input
                        type="text"
                        name="zip"
                        placeholder="PLZ"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                        value={formData.zip}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        name="city"
                        placeholder="Stadt"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                        value={formData.city}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                  <div className="relative pt-4">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      name="email"
                      placeholder="E-Mail Adresse"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Sicherheit (Passwort ändern)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Neues Passwort (leer lassen für keine Änderung)"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Passwort bestätigen"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-4 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Speichern...' : (
                  <>
                    <Save size={20} className="mr-2" />
                    Profil speichern
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShopProfile;

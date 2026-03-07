
import React, { useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import { User, Mail, Lock, Building, MapPin, Phone, CheckCircle } from 'lucide-react';

const ShopRegister: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
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
    phone: '',
    data_privacy_accepted: false
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    if (!formData.data_privacy_accepted) {
      setError('Bitte akzeptieren Sie die Datenschutzerklärung.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate(`/shop/${shopId}/login`), 3000);
      } else {
        setError(data.error || 'Registrierung fehlgeschlagen.');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center border border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={40} />
          </div>
          <h2 className="text-3xl font-black mb-4">Registrierung erfolgreich!</h2>
          <p className="text-slate-600 mb-8">
            Vielen Dank für Ihre Anmeldung. Sie werden in Kürze zum Login weitergeleitet.
          </p>
          <Link 
            to={`/shop/${shopId}/login`}
            className="inline-block px-8 py-3 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            Zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="p-8 lg:p-12">
          <h1 className="text-3xl font-black mb-2 text-slate-900">Konto erstellen</h1>
          <p className="text-slate-500 mb-8 font-medium">Melden Sie sich an, um Ihre Bestellungen zu verwalten.</p>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Persönliche Daten</h3>
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

              {/* Address Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Anschrift</h3>
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

                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-6">Login-Daten</h3>
                <div className="relative">
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
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Passwort"
                    required
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
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-opacity-20 outline-none transition-all"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Privacy Checkbox */}
            <div className="flex items-start space-x-3 pt-4">
              <input
                type="checkbox"
                id="data_privacy_accepted"
                name="data_privacy_accepted"
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={formData.data_privacy_accepted}
                onChange={handleChange}
              />
              <label htmlFor="data_privacy_accepted" className="text-sm text-slate-600">
                Ich habe die <Link to={`/shop/${shopId}/page/datenschutz`} className="underline hover:text-slate-900" target="_blank">Datenschutzerklärung</Link> gelesen und akzeptiere diese. Ich willige ein, dass meine Daten zur Bearbeitung meines Kontos gespeichert werden.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all disabled:opacity-50 mt-4"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Verarbeite...' : 'Konto erstellen'}
            </button>

            <p className="text-center text-slate-500 mt-6 font-medium">
              Bereits ein Konto? <Link to={`/shop/${shopId}/login`} className="font-bold underline" style={{ color: primaryColor }}>Hier anmelden</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShopRegister;

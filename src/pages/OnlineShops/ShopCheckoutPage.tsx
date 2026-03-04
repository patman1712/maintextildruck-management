
import React, { useState } from 'react';
import { useOutletContext, useParams, Link, useNavigate } from 'react-router-dom';
import { CreditCard, Truck, MapPin, CheckCircle, ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Shop } from '../../store';
import { useShopStore } from '../../shopStore';

interface ShopContext {
  shop: Shop;
  primaryColor: string;
}

const ShopCheckoutPage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { shop, primaryColor } = useOutletContext<ShopContext>();
  const { cart, currentCustomer, clearCart } = useShopStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = 5.95;
  const total = cartTotal + shipping;

  const [orderComplete, setOrderComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState({
    firstName: currentCustomer?.first_name || '',
    lastName: currentCustomer?.last_name || '',
    company: currentCustomer?.company || '',
    street: currentCustomer?.street || '',
    zip: currentCustomer?.zip || '',
    city: currentCustomer?.city || '',
    email: currentCustomer?.email || '',
    phone: currentCustomer?.phone || ''
  });
  const [paymentMethod, setPaymentMethod] = useState('PayPal');

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer?.id,
          items: cart,
          address,
          paymentMethod,
          totalAmount: total,
          shippingCosts: shipping
        })
      });
      const data = await res.json();
      if (data.success) {
        setOrderComplete(true);
        clearCart();
      } else {
        setError(data.error || 'Fehler beim Aufgeben der Bestellung.');
      }
    } catch (err) {
      setError('Ein technischer Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !orderComplete) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <ShoppingCart size={48} className="mx-auto text-slate-200 mb-6" />
        <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Dein Warenkorb ist leer</h1>
        <Link to={`/shop/${shopId}`} className="text-blue-600 font-bold hover:underline">Zurück zum Shop</Link>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 text-center border border-green-50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle className="text-green-600" size={48} />
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Bestellung erfolgreich!</h1>
          <p className="text-slate-500 mb-10 leading-relaxed font-medium">
            Vielen Dank für deine Bestellung. Wir haben dir eine Bestätigungs-E-Mail gesendet. Deine Bestellung wird nun individuell für dich angefertigt.
          </p>
          <Link 
            to={`/shop/${shopId}`}
            className="inline-block px-10 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            Zurück zum Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-12 border-b border-slate-100 pb-8">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center">
          <ShieldCheck className="mr-4 text-green-500" size={36} />
          Sicher zur Kasse
        </h1>
        <div className="hidden md:flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-slate-900' : 'text-slate-300'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 ${step >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>1</span>
                <span className="text-xs font-black uppercase tracking-widest">Adresse</span>
            </div>
            <div className="w-8 h-[2px] bg-slate-100"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-slate-900' : 'text-slate-300'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 ${step >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>2</span>
                <span className="text-xs font-black uppercase tracking-widest">Zahlung</span>
            </div>
            <div className="w-8 h-[2px] bg-slate-100"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-slate-900' : 'text-slate-300'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 ${step >= 3 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>3</span>
                <span className="text-xs font-black uppercase tracking-widest">Abschluss</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center space-x-3 mb-2">
                <MapPin size={24} className="text-slate-400" />
                <h2 className="text-xl font-black uppercase italic tracking-tight">Lieferadresse</h2>
              </div>
              
              {!currentCustomer && (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 flex items-center justify-between">
                  <div className="text-sm text-slate-600 font-medium">Bereits ein Konto? Melde dich an für schnelleren Checkout.</div>
                  <Link to={`/shop/${shopId}/login`} className="text-blue-600 font-bold text-sm underline hover:text-blue-800">Jetzt einloggen</Link>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vorname*</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.firstName} onChange={e => setAddress({...address, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nachname*</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.lastName} onChange={e => setAddress({...address, lastName: e.target.value})} />
                </div>
                <div className="col-span-full space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firma (Optional)</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.company} onChange={e => setAddress({...address, company: e.target.value})} />
                </div>
                <div className="col-span-full space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Straße & Hausnummer*</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PLZ*</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stadt*</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 transition-all font-medium" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <button 
                  onClick={() => setStep(2)}
                  className="px-10 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all flex items-center group"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Weiter zur Zahlung</span>
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center space-x-3 mb-2">
                <CreditCard size={24} className="text-slate-400" />
                <h2 className="text-xl font-black uppercase italic tracking-tight">Zahlungsmethode</h2>
              </div>

              <div className="grid gap-4">
                <label className="flex items-center p-6 border-2 border-slate-100 rounded-2xl cursor-pointer hover:border-blue-100 hover:bg-blue-50/20 transition-all group">
                  <input type="radio" name="payment" className="w-5 h-5 text-blue-600" defaultChecked />
                  <div className="ml-4 flex-1">
                    <div className="font-black uppercase italic tracking-tighter text-slate-800">PayPal</div>
                    <div className="text-xs text-slate-500 font-medium">Bezahle sicher und schnell mit deinem PayPal Konto.</div>
                  </div>
                  <div className="w-12 h-8 bg-slate-100 rounded-md flex items-center justify-center font-black italic text-blue-800 text-[10px]">PP</div>
                </label>
                <label className="flex items-center p-6 border-2 border-slate-100 rounded-2xl cursor-pointer hover:border-slate-200 transition-all">
                  <input type="radio" name="payment" className="w-5 h-5 text-slate-600" />
                  <div className="ml-4 flex-1">
                    <div className="font-black uppercase italic tracking-tighter text-slate-800">Vorkasse</div>
                    <div className="text-xs text-slate-500 font-medium">Überweise direkt auf unser Bankkonto. Deine Bestellung wird nach Zahlungseingang produziert.</div>
                  </div>
                </label>
              </div>

              <div className="flex justify-between pt-8">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50 transition-all flex items-center group"
                >
                  <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                  <span>Zurück zur Adresse</span>
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="px-10 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all flex items-center group"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Bestellung prüfen</span>
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center space-x-3 mb-2">
                <ShoppingBag size={24} className="text-slate-400" />
                <h2 className="text-xl font-black uppercase italic tracking-tight">Bestellung abschließen</h2>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Deine Artikel</h3>
                    <Link to={`/shop/${shopId}/cart`} className="text-xs font-bold underline text-slate-500">Bearbeiten</Link>
                  </div>
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-700">{item.quantity}x {item.name}</span>
                        <span className="font-black text-slate-900">{(item.price * item.quantity).toFixed(2).replace('.', ',')} €</span>
                      </div>
                    ))}
                  </div>
              </div>

              <div className="p-4 border border-slate-100 rounded-xl text-[10px] text-slate-500 leading-relaxed italic">
                Durch Klicken auf "Kostenpflichtig bestellen" akzeptiere ich die AGB und die Datenschutzerklärung.
              </div>

              <div className="flex justify-between pt-8">
                <button 
                  onClick={() => setStep(2)}
                  className="px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50 transition-all flex items-center group"
                >
                  <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                  <span>Zurück zur Zahlung</span>
                </button>
                <button 
                  onClick={handlePlaceOrder}
                  className="px-10 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all flex items-center group"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CheckCircle size={18} className="mr-2" />
                  <span>Kostenpflichtig bestellen</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white rounded-3xl p-8 sticky top-32 shadow-2xl">
            <h2 className="text-xl font-black uppercase italic tracking-tighter mb-8 border-b border-slate-800 pb-4">Zusammenfassung</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                <span>Warenwert</span>
                <span>{cartTotal.toFixed(2).replace('.', ',')} €*</span>
              </div>
              <div className="flex justify-between text-slate-400 font-bold uppercase tracking-widest text-[10px] pb-4 border-b border-slate-800">
                <span>Versandkosten</span>
                <span>{shipping.toFixed(2).replace('.', ',')} €*</span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-black uppercase tracking-widest text-xs">Gesamtbetrag</span>
                <div className="text-right">
                  <div className="text-3xl font-black">{(total).toFixed(2).replace('.', ',')} €*</div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">*inkl. MwSt.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-3 text-slate-400">
                <Truck size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Lieferzeit: 10-14 Werktage</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-400">
                <ShieldCheck size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sicherer Checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCheckoutPage;

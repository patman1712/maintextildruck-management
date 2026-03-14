
import React from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft, ArrowRight, ShoppingCart, ShoppingBag } from 'lucide-react';
import { Shop } from '../../store';
import { useShopStore } from '../../shopStore';

interface ShopContext {
  shop: Shop;
  primaryColor: string;
}

const ShopCartPage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const { shop, primaryColor } = useOutletContext<ShopContext>();
  const { cart, removeFromCart, updateQuantity } = useShopStore();

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = 5.95;
  const total = cartTotal + shipping;

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
            <ShoppingCart size={48} />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Dein Warenkorb ist leer</h1>
          <p className="text-slate-500">Du hast noch keine Artikel in deinen Warenkorb gelegt.</p>
          <Link 
            to={`/shop/${shopId}`}
            className="inline-block px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all"
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
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-12 flex items-center">
        <ShoppingBag className="mr-4" size={36} />
        Warenkorb
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left hidden md:table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Artikel</th>
                  <th className="px-6 py-4 text-center">Anzahl</th>
                  <th className="px-6 py-4 text-right">Einzelpreis</th>
                  <th className="px-6 py-4 text-right">Summe</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cart.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 flex-shrink-0 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-contain" loading="lazy" decoding="async" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 leading-tight">{item.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {item.size && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Größe: {item.size}</span>}
                            {item.color && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Farbe: {item.color}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                          ><Minus size={14} /></button>
                          <span className="px-4 py-2 text-sm font-black border-x border-slate-200 min-w-[3rem] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                          ><Plus size={14} /></button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right font-medium text-slate-600">
                      {item.price.toFixed(2).replace('.', ',')} €*
                    </td>
                    <td className="px-6 py-6 text-right font-black text-slate-900">
                      {(item.price * item.quantity).toFixed(2).replace('.', ',')} €*
                    </td>
                    <td className="px-6 py-6 text-right">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cart List */}
            <div className="md:hidden divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.id} className="p-4 space-y-4">
                  <div className="flex space-x-4">
                    <div className="h-20 w-20 flex-shrink-0 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                      {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-contain" loading="lazy" decoding="async" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.size && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Größe: {item.size}</span>}
                      </div>
                      <p className="mt-2 font-black text-slate-900">{(item.price * item.quantity).toFixed(2).replace('.', ',')} €*</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 text-slate-500"><Minus size={14} /></button>
                      <span className="px-4 text-sm font-black">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 text-slate-500"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 font-bold text-xs uppercase tracking-widest flex items-center">
                      <Trash2 size={14} className="mr-1" /> Entfernen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Link to={`/shop/${shopId}`} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 group">
              <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
              Weiter einkaufen
            </Link>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Sichere Bezahlung</span>
              <div className="flex space-x-2">
                <span className="bg-slate-50 px-2 py-1 rounded">PayPal</span>
                <span className="bg-slate-50 px-2 py-1 rounded">Visa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-8 sticky top-32">
            <h2 className="text-xl font-black uppercase italic tracking-tighter mb-8 border-b border-slate-50 pb-4">Bestellübersicht</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Zwischensumme</span>
                <span>{cartTotal.toFixed(2).replace('.', ',')} €*</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium pb-4 border-b border-slate-50">
                <span>Versandkosten</span>
                <span>{shipping.toFixed(2).replace('.', ',')} €*</span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-black text-slate-900">Gesamtsumme</span>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">{total.toFixed(2).replace('.', ',')} €*</div>
                  <p className="text-[10px] text-slate-400">*inkl. 19% MwSt.</p>
                </div>
              </div>
            </div>

            <Link 
              to={`/shop/${shopId}/checkout`}
              className="w-full flex items-center justify-center py-5 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-[1.02] active:scale-98 transition-all group mb-4"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Zur Kasse</span>
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <div className="bg-slate-50 rounded-xl p-4 text-[10px] text-slate-500 leading-relaxed">
              <p className="font-bold mb-1 uppercase tracking-wider text-slate-700">Lieferzeit Hinweis:</p>
              Deine Bestellung wird individuell für dich angefertigt. Die Lieferzeit beträgt in der Regel 10-14 Werktage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCartPage;

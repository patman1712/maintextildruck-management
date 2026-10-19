
import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft, ArrowRight, ShoppingCart, ShoppingBag, Ticket, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Shop } from '../../store';
import { useShopStore } from '../../shopStore';
import { ShopTemplate } from './template/templateEngine';

interface ShopContext {
  shop: Shop;
  primaryColor: string;
  shopBaseUrl: string;
  shopKey: string;
  shippingConfig?: any;
  shippingCost?: number;
  template?: any;
  customTemplateActive?: boolean;
  templateContext?: Record<string, any>;
}

const ShopCartPage: React.FC = () => {
  const { shop, primaryColor, shopBaseUrl, template, customTemplateActive, templateContext, shippingConfig, shippingCost: contextShippingCost } = useOutletContext<ShopContext>();
  const { cart, removeFromCart, updateQuantity, voucher, setVoucher, currentCustomer } = useShopStore();
  const navigate = useNavigate();

  const [voucherInput, setVoucherInput] = useState('');
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const vouchersEnabled = !!(shop as any)?.vouchers_enabled;

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // Versandkosten kommen aus dem Shop-Layout (inkl. Gewichtsstaffel und "versandkostenfrei ab X €").
  const shipping = typeof contextShippingCost === 'number' ? contextShippingCost : 5.95;

  // Rabatt nur auf den Warenwert (cartTotal), niemals auf die Versandkosten.
  const voucherDiscount = voucher
    ? Math.round(
        Math.min(
          voucher.discountType === 'fixed'
            ? voucher.discountValue
            : (cartTotal * voucher.discountValue) / 100,
          cartTotal
        ) * 100
      ) / 100
    : 0;
  const total = Math.max(0, cartTotal - voucherDiscount) + shipping;

  // 🚚 "Versandkostenfrei ab X €" – bezogen auf den Warenwert nach Gutscheinabzug.
  const freeShippingThreshold = Number(shippingConfig?.free_shipping_threshold) > 0 ? Number(shippingConfig.free_shipping_threshold) : null;
  const netSubtotal = Math.max(0, cartTotal - voucherDiscount);
  const freeShippingRemaining = freeShippingThreshold !== null && netSubtotal < freeShippingThreshold ? freeShippingThreshold - netSubtotal : null;

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim();
    if (!code) return;
    setVoucherChecking(true);
    setVoucherError('');
    try {
      const res = await fetch(`/api/shops/${shop.id}/voucher/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotal: cartTotal,
          email: currentCustomer?.email || null,
          customerId: currentCustomer?.id || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.valid) {
        setVoucher({
          code: data.code,
          discountType: data.discount_type,
          discountValue: Number(data.discount_value) || 0,
        });
        setVoucherInput('');
      } else {
        setVoucher(null);
        setVoucherError(data?.error || 'Der Gutscheincode ist ungültig.');
      }
    } catch {
      setVoucher(null);
      setVoucherError('Der Gutscheincode konnte nicht geprüft werden.');
    } finally {
      setVoucherChecking(false);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucher(null);
    setVoucherError('');
    setVoucherInput('');
  };

  // 🎟️ Gutschein erneut prüfen – z. B. wenn er zwischenzeitlich deaktiviert oder abgelaufen ist.
  // Gibt true zurück, wenn der Code weiterhin gültig ist (oder kein Code aktiv ist).
  const revalidateVoucher = async (): Promise<boolean> => {
    if (!voucher) return true;
    try {
      const res = await fetch(`/api/shops/${shop.id}/voucher/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: voucher.code,
          subtotal: cartTotal,
          email: currentCustomer?.email || null,
          customerId: currentCustomer?.id || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.valid) {
        setVoucher({
          code: data.code,
          discountType: data.discount_type,
          discountValue: Number(data.discount_value) || 0,
        });
        return true;
      }
      setVoucher(null);
      setVoucherError(
        `${voucher.code}: ${data?.error || 'Der Gutscheincode ist nicht mehr gültig.'}`
      );
      return false;
    } catch {
      // Bei Netzwerkfehlern nicht blockieren – der Server prüft beim Bestellen erneut.
      return true;
    }
  };

  // Beim Öffnen des Warenkorbs einmalig prüfen, ob der hinterlegte Code noch gültig ist.
  useEffect(() => {
    if (voucher) revalidateVoucher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            to={`${shopBaseUrl}`}
            className="inline-block px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-105 transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            Zurück zum Shop
          </Link>
        </div>
      </div>
    );
  }

  const standardBody = (
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
            <Link to={`${shopBaseUrl}`} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 group">
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
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Gutschein ({voucher?.code})</span>
                  <span>−{voucherDiscount.toFixed(2).replace('.', ',')} €*</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 font-medium pb-4 border-b border-slate-50">
                <span>Versandkosten</span>
                <span>{shipping === 0 ? 'kostenlos' : `${shipping.toFixed(2).replace('.', ',')} €*`}</span>
              </div>
              {freeShippingRemaining !== null && (
                <p className="text-[11px] text-amber-600 font-bold -mt-2">
                  Noch {freeShippingRemaining.toFixed(2).replace('.', ',')} € bis zur versandkostenfreien Lieferung
                </p>
              )}
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-black text-slate-900">Gesamtsumme</span>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">{total.toFixed(2).replace('.', ',')} €*</div>
                  <p className="text-[10px] text-slate-400">*inkl. 19% MwSt.</p>
                </div>
              </div>
            </div>

            {/* 🎟️ Gutscheincode */}
            {vouchersEnabled && (
              <div className="mb-6">
                {voucher ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <div className="flex items-center text-emerald-700 text-sm font-bold">
                      <CheckCircle2 size={16} className="mr-2 flex-shrink-0" />
                      <span className="truncate">Gutschein {voucher.code} aktiv</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="text-emerald-600 hover:text-emerald-800 transition-colors flex-shrink-0"
                      aria-label="Gutschein entfernen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                          type="text"
                          value={voucherInput}
                          onChange={(e) => { setVoucherInput(e.target.value); setVoucherError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyVoucher(); } }}
                          placeholder="Gutscheincode"
                          className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-sm font-medium uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={voucherChecking || !voucherInput.trim()}
                        className="px-4 rounded-xl text-xs font-black uppercase tracking-widest text-white disabled:opacity-50 transition-opacity flex items-center"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {voucherChecking ? <Loader2 size={16} className="animate-spin" /> : 'Einlösen'}
                      </button>
                    </div>
                    {voucherError && (
                      <p className="mt-2 flex items-center text-xs font-bold text-red-500">
                        <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                        {voucherError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Link 
              to={`${shopBaseUrl}/checkout`}
              onClick={async (e) => {
                // 🎟️ Bei jedem Klick auf "Zur Kasse" prüfen, ob der Gutschein noch aktiv ist.
                if (!voucher) return;
                e.preventDefault();
                setVoucherChecking(true);
                const stillValid = await revalidateVoucher();
                setVoucherChecking(false);
                if (stillValid) navigate(`${shopBaseUrl}/checkout`);
              }}
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

  const pageContext = {
    ...(templateContext || {}),
    cart_total: cartTotal,
    cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    cart_items: cart.map((i: any) => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image || '',
      size: i.size || '',
      color: i.color || '',
    })),
  };

  if (customTemplateActive && template?.blocks?.['cart']) {
    return (
      <ShopTemplate
        template={template}
        page="cart"
        context={pageContext}
        widgets={{ content: standardBody }}
        fallback={standardBody}
      />
    );
  }

  return standardBody;
};

export default ShopCartPage;

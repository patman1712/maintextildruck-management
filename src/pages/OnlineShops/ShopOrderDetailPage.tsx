
import React, { useEffect, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, CreditCard, MapPin, Truck, CheckCircle, Clock } from 'lucide-react';
import { useShopStore } from '../../shopStore';

const ShopOrderDetailPage: React.FC = () => {
  const { shopId, orderId } = useParams<{ shopId: string, orderId: string }>();
  const { currentCustomer } = useShopStore();
  const { primaryColor } = useOutletContext<{ primaryColor: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!currentCustomer || !orderId) return;
      try {
        const res = await fetch(`/api/shop-customers/${shopId}/orders/${currentCustomer.id}/${orderId}`);
        const data = await res.json();
        if (data.success) {
          setOrder(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [shopId, orderId, currentCustomer]);

  if (loading) return <div className="container mx-auto p-20 text-center">Lade Bestelldetails...</div>;
  if (!order) return <div className="container mx-auto p-20 text-center text-red-500 font-bold">Bestellung nicht gefunden.</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to={`/shop/${shopId}/orders`} className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 mb-8 group transition-colors">
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Zurück zu meinen Bestellungen
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Bestellung #{order.order_number}</h1>
            <div className="flex flex-wrap items-center gap-4 text-slate-500 font-medium">
              <span className="flex items-center"><Calendar size={16} className="mr-1.5 opacity-50" /> {new Date(order.created_at).toLocaleDateString('de-DE')}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="flex items-center"><Package size={16} className="mr-1.5 opacity-50" /> {order.items?.length} Artikel</span>
            </div>
          </div>
          <div className="flex items-center bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl border border-blue-100">
            <Clock size={20} className="mr-2.5" />
            <span className="font-black uppercase tracking-widest text-sm">
              Status: {order.status === 'active' ? 'In Bearbeitung' : order.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h3 className="font-black uppercase italic tracking-tight text-slate-800">Bestellte Artikel</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="p-6 flex items-center justify-between group hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-300">
                        <Package size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{item.item_name}</h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {item.size && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">Größe: {item.size}</span>}
                          {item.color && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">Farbe: {item.color}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-400 mb-1">{item.quantity}x {item.price?.toFixed(2).replace('.', ',')} €</div>
                      <div className="font-black text-slate-900">{(item.quantity * item.price).toFixed(2).replace('.', ',')} €</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracking / Timeline Placeholder */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <h3 className="font-black uppercase italic tracking-tight text-slate-800 mb-8">Sendungsverfolgung</h3>
              <div className="relative space-y-8">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-100"></div>
                <div className="relative flex items-center">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center z-10 shadow-lg shadow-green-100">
                    <CheckCircle size={16} />
                  </div>
                  <div className="ml-6">
                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">Bestellung eingegangen</div>
                    <div className="text-xs text-slate-400 mt-0.5">{new Date(order.created_at).toLocaleString('de-DE')}</div>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center z-10 shadow-lg shadow-blue-100 animate-pulse">
                    <Clock size={16} />
                  </div>
                  <div className="ml-6">
                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">In Produktion</div>
                    <div className="text-xs text-slate-400 mt-0.5">Deine Artikel werden nun individuell für dich angefertigt.</div>
                  </div>
                </div>
                <div className="relative flex items-center opacity-30">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-white flex items-center justify-center z-10">
                    <Truck size={16} />
                  </div>
                  <div className="ml-6">
                    <div className="font-black text-slate-800 text-sm uppercase tracking-tight">Versand</div>
                    <div className="text-xs text-slate-400 mt-0.5">Sobald dein Paket unser Lager verlässt, erhältst du eine E-Mail.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Details */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <h3 className="font-black uppercase italic tracking-tight text-slate-800 mb-6 flex items-center">
                <MapPin size={18} className="mr-2 text-slate-400" /> Lieferadresse
              </h3>
              <div className="text-slate-600 text-sm leading-relaxed font-medium">
                <p className="font-bold text-slate-900 mb-1">{order.customer_name}</p>
                <p className="whitespace-pre-line">{order.customer_address}</p>
                <p className="mt-4 flex items-center"><Truck size={14} className="mr-2 opacity-50" /> DHL Paketversand</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <h3 className="font-black uppercase italic tracking-tight text-slate-800 mb-6 flex items-center">
                <CreditCard size={18} className="mr-2 text-slate-400" /> Bezahlung
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Methode:</span>
                  <span className="font-bold text-slate-800">{order.payment_method}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Bezahlt</span>
                </div>
                <div className="pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Zwischensumme:</span>
                    <span>{(order.total_amount - order.shipping_costs).toFixed(2).replace('.', ',')} €</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Versandkosten:</span>
                    <span>{order.shipping_costs?.toFixed(2).replace('.', ',')} €</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-slate-900 pt-2">
                    <span>Gesamt:</span>
                    <span>{order.total_amount?.toFixed(2).replace('.', ',')} €</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopOrderDetailPage;

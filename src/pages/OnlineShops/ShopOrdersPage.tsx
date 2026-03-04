
import React, { useEffect, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Package, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useShopStore } from '../../shopStore';

const ShopOrdersPage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const { currentCustomer } = useShopStore();
  const { primaryColor } = useOutletContext<{ primaryColor: string }>();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentCustomer) return;
      try {
        const res = await fetch(`/api/shop-customers/${shopId}/orders/${currentCustomer.id}`);
        const data = await res.json();
        if (data.success) {
          setOrders(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [shopId, currentCustomer]);

  if (loading) return <div className="container mx-auto p-20 text-center">Lade Bestellungen...</div>;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-8 flex items-center">
          <ShoppingBag className="mr-4" size={36} />
          Meine Bestellungen
        </h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-xl">
            <Package size={48} className="mx-auto text-slate-200 mb-6" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Noch keine Bestellungen</h2>
            <p className="text-slate-500 mb-8 text-sm">Du hast bisher noch keine Bestellungen in diesem Shop getätigt.</p>
            <Link 
              to={`/shop/${shopId}`}
              className="inline-block px-8 py-3 rounded-xl text-white font-bold transition-all hover:scale-105"
              style={{ backgroundColor: primaryColor }}
            >
              Jetzt shoppen
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link 
                key={order.id} 
                to={`/shop/${shopId}/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-100 transition-colors">
                      <Package size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                        Bestellung #{order.order_number}
                      </div>
                      <div className="font-bold text-slate-800 flex items-center">
                        <Calendar size={14} className="mr-1.5 opacity-50" />
                        {new Date(order.created_at).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <div className="text-right">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Status</div>
                      <div className="flex items-center font-bold text-sm">
                        {order.status === 'shipped' ? (
                          <CheckCircle size={14} className="mr-1.5 text-green-500" />
                        ) : order.status === 'cancelled' ? (
                          <X size={14} className="mr-1.5 text-red-500" />
                        ) : (
                          <Clock size={14} className="mr-1.5 text-blue-500" />
                        )}
                        {order.status === 'active' ? 'In Bearbeitung' : 
                         order.status === 'shipped' ? 'Versendet' : 
                         order.status === 'cancelled' ? 'Storniert' : order.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Gesamt</div>
                      <div className="font-black text-slate-900">
                        {order.total_amount?.toFixed(2).replace('.', ',')} €
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-slate-600 transition-colors group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopOrdersPage;

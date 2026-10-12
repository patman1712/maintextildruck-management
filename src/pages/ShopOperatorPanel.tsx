import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import ShopDashboard from './OnlineShops/Management/ShopDashboard';
import { Store, LogOut, ArrowLeft } from 'lucide-react';

export default function ShopOperatorPanel() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const shopOperatorShops = useAppStore((state) => state.shopOperatorShops);
  const shopOperatorSelectedShopId = useAppStore((state) => state.shopOperatorSelectedShopId);
  const shopOperatorSelectShop = useAppStore((state) => state.shopOperatorSelectShop);
  const logout = useAppStore((state) => state.logout);

  const isShopOperator = currentUser?.role === 'shop_operator';

  useEffect(() => {
    if (!currentUser) {
      navigate('/shop-login');
      return;
    }
    if (currentUser.role !== 'shop_operator') {
      navigate('/dashboard');
      return;
    }
  }, [currentUser, navigate]);

  if (!currentUser || !isShopOperator) {
    return null;
  }

  // Keine shopId in URL → Shop-Auswahl oder Weiterleitung
  if (!shopId) {
    if (shopOperatorShops.length === 0) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
            <Store size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Keine Shops zugewiesen</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ihnen wurden noch keine Online-Shops zur Verwaltung zugewiesen. Bitte kontaktieren Sie den Administrator.
            </p>
            <button
              onClick={() => { logout(); navigate('/shop-login'); }}
              className="text-sm text-slate-600 hover:text-slate-800 underline"
            >
              Zurück zur Anmeldung
            </button>
          </div>
        </div>
      );
    }

    if (shopOperatorShops.length === 1) {
      navigate(`/shop-operator/${shopOperatorShops[0].id}`, { replace: true });
      return null;
    }

    // Mehrere Shops → Auswahl
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Meine Shops</h1>
              <p className="text-sm text-gray-500 mt-1">Wählen Sie einen Shop zur Verwaltung aus</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/shop-login'); }}
              className="flex items-center text-sm text-gray-600 hover:text-red-600"
            >
              <LogOut size={16} className="mr-1" /> Abmelden
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shopOperatorShops.map((shop) => (
              <Link
                key={shop.id}
                to={`/shop-operator/${shop.id}`}
                onClick={() => shopOperatorSelectShop(shop.id)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-indigo-300 transition-all block"
              >
                <div className="flex items-center mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold mr-3"
                    style={{ backgroundColor: shop.primary_color || '#6366f1' }}
                  >
                    {shop.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{shop.name}</h3>
                    <p className="text-xs text-gray-400">{shop.domain_slug}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {shop.permissions?.products?.view && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Produkte</span>
                  )}
                  {shop.permissions?.categories?.view && (
                    <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded">Kategorien</span>
                  )}
                  {shop.permissions?.design?.view && (
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Design</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // shopId vorhanden → prüfe Zugriff
  const shop = shopOperatorShops.find((s) => s.id === shopId);
  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Zugriff verweigert</h2>
          <p className="text-sm text-gray-500 mb-6">Sie haben keine Berechtigung für diesen Shop.</p>
          <Link to="/shop-operator" className="text-sm text-indigo-600 hover:underline">
            ← Zurück zur Shop-Auswahl
          </Link>
        </div>
      </div>
    );
  }

  if (shopOperatorSelectedShopId !== shopId) {
    shopOperatorSelectShop(shopId);
  }

  // Shop-Betreiber Modus: ShopDashboard einbetten
  // Das ShopDashboard lädt den Shop selbstständig über die shopId aus der URL
  return <ShopDashboard />;
}

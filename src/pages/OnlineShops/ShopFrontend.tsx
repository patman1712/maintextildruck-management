
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, Search, Menu, User, X, ChevronRight, Star } from 'lucide-react';
import { Shop, Product } from '../../store';

const ShopFrontend: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await fetch(`/api/shops/${shopId}`);
        const data = await res.json();
        if (data.success) {
          setShop(data.data);
          // Fetch products for this shop (filtered by customer_id)
          // For now, we'll fetch all products and filter client-side, or use a specific endpoint
          // Ideally: /api/products?customer_id=...
          // But let's just use a placeholder or try to fetch products associated with this customer
          const prodRes = await fetch(`/api/products/customer/${data.data.customer_id}`);
          const prodData = await prodRes.json();
          if (prodData.success) {
            setProducts(prodData.data);
          }
        } else {
          setError('Shop nicht gefunden');
        }
      } catch (err) {
        setError('Fehler beim Laden des Shops');
      } finally {
        setLoading(false);
      }
    };

    if (shopId) {
      fetchShop();
    }
  }, [shopId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Lade Shop...</div>;
  if (error || !shop) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Shop nicht gefunden'}</div>;

  const primaryColor = shop.primary_color || '#000000';
  const secondaryColor = shop.secondary_color || '#ffffff';

  return (
    <div className="font-sans text-slate-800 bg-white min-h-screen flex flex-col">
      {/* Announcement Bar */}
      <div style={{ backgroundColor: primaryColor }} className="text-white text-xs font-bold py-2 text-center tracking-wider uppercase">
        Offizieller Fanshop
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>

          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-center lg:justify-start flex-1 lg:flex-none">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="h-12 w-auto object-contain" />
            ) : (
              <span className="text-2xl font-black uppercase tracking-tighter italic" style={{ color: primaryColor }}>
                {shop.name}
              </span>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center space-x-8 mx-8 font-bold text-sm uppercase tracking-wide text-slate-700">
            <a href="#" className="hover:text-red-600 transition-colors">Neuheiten</a>
            <a href="#" className="hover:text-red-600 transition-colors">Männer</a>
            <a href="#" className="hover:text-red-600 transition-colors">Frauen</a>
            <a href="#" className="hover:text-red-600 transition-colors">Kinder</a>
            <a href="#" className="hover:text-red-600 transition-colors text-red-600">Sale</a>
          </nav>

          {/* Icons */}
          <div className="flex items-center space-x-4 lg:space-x-6 text-slate-600">
            <button className="hover:text-slate-900 hidden sm:block">
              <Search size={22} />
            </button>
            <button className="hover:text-slate-900 hidden sm:block">
              <User size={22} />
            </button>
            <button className="hover:text-slate-900 relative" onClick={() => setCartOpen(true)}>
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">0</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative bg-slate-900 h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1518609878373-06d740f60d8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80)' }}></div>
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter mb-4">
            Neue Kollektion
          </h1>
          <p className="text-xl md:text-2xl font-medium mb-8 max-w-2xl mx-auto opacity-90">
            Entdecke die neuen Styles für die kommende Saison.
          </p>
          <button 
            style={{ backgroundColor: primaryColor, color: secondaryColor }}
            className="px-8 py-4 font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-opacity transform hover:scale-105 duration-200"
          >
            Jetzt Shoppen
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <main className="container mx-auto px-4 py-16 flex-grow">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-3xl font-black uppercase italic text-slate-800">Highlights</h2>
          <a href="#" className="text-sm font-bold uppercase text-slate-500 hover:text-slate-800 flex items-center">
            Alle anzeigen <ChevronRight size={16} />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.length > 0 ? products.map(product => (
                <div key={product.id} className="group cursor-pointer">
                    <div className="relative aspect-[3/4] bg-slate-100 mb-4 overflow-hidden">
                        {product.files && product.files.length > 0 && (product.files[0].thumbnail_url || product.files[0].file_url) ? (
                            <img 
                                src={product.files[0].thumbnail_url || product.files[0].file_url} 
                                alt={product.name}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <span className="text-4xl font-bold opacity-20">NO IMAGE</span>
                            </div>
                        )}
                        <div className="absolute top-4 left-4 bg-white px-2 py-1 text-xs font-bold uppercase tracking-wider">Neu</div>
                        <button className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 hover:bg-red-600 hover:text-white">
                            <ShoppingCart size={20} />
                        </button>
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-red-600 transition-colors">{product.name}</h3>
                    <p className="text-sm text-slate-500 mb-2">{product.product_number}</p>
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">€ 29,95</span>
                        <div className="flex text-yellow-400">
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                        </div>
                    </div>
                </div>
            )) : (
                <div className="col-span-full text-center py-20 text-slate-400">
                    <p>Keine Produkte gefunden.</p>
                </div>
            )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-6 text-sm text-slate-400">Shop</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><a href="#" className="hover:text-white">Neuheiten</a></li>
                <li><a href="#" className="hover:text-white">Männer</a></li>
                <li><a href="#" className="hover:text-white">Frauen</a></li>
                <li><a href="#" className="hover:text-white">Sale</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-6 text-sm text-slate-400">Service</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><a href="#" className="hover:text-white">Hilfe & Kontakt</a></li>
                <li><a href="#" className="hover:text-white">Versand & Lieferung</a></li>
                <li><a href="#" className="hover:text-white">Rücksendung</a></li>
                <li><a href="#" className="hover:text-white">Größentabellen</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-6 text-sm text-slate-400">Rechtliches</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><a href="#" className="hover:text-white">AGB</a></li>
                <li><a href="#" className="hover:text-white">Datenschutz</a></li>
                <li><a href="#" className="hover:text-white">Impressum</a></li>
                <li><a href="#" className="hover:text-white">Widerrufsrecht</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-6 text-sm text-slate-400">Newsletter</h4>
              <p className="text-sm text-slate-300 mb-4">Melde dich für den Newsletter an und erhalte 10% Rabatt.</p>
              <div className="flex">
                <input type="email" placeholder="Deine E-Mail" className="bg-slate-800 border-none text-white px-4 py-2 flex-grow text-sm focus:ring-1 focus:ring-slate-500" />
                <button style={{ backgroundColor: primaryColor }} className="px-4 py-2 font-bold uppercase text-xs">OK</button>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
            <p>&copy; 2024 {shop.name}. Alle Rechte vorbehalten.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
               {/* Payment Icons Placeholder */}
               <span>PayPal</span>
               <span>Visa</span>
               <span>Mastercard</span>
               <span>DHL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ShopFrontend;

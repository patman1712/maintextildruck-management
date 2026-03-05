
import React, { useEffect, useState } from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, Menu, User, ChevronDown, LogOut, X, Trash2, ArrowRight, ShoppingBag as BagIcon, ShoppingBag } from 'lucide-react';
import { Shop, ShopCategory } from '../../store';
import { useShopStore } from '../../shopStore';

const ShopLayout: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const location = useLocation();
  const { currentCustomer, logout, cart, removeFromCart, updateQuantity, isCartOpen: cartOpen, setCartOpen } = useShopStore();
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  
  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [shippingCost, setShippingCost] = useState(5.95);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await fetch(`/api/shops/${shopId}`);
        const data = await res.json();
        if (data.success) {
          setShop(data.data);
          
          // Fetch categories
          const catRes = await fetch(`/api/shops/${data.data.id}/categories`);
          const catData = await catRes.json();
          if (catData.success) {
            setCategories(catData.data);
          }

          // Fetch Shipping Config
          fetch(`/api/shops/${data.data.id}/shipping-config`)
            .then(res => res.json())
            .then(sData => {
                if (sData.success && sData.data) {
                    setShippingConfig(sData.data);
                }
            })
            .catch(console.error);

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

  useEffect(() => {
    if (shippingConfig && shippingConfig.shipping_tiers && Array.isArray(shippingConfig.shipping_tiers) && shippingConfig.shipping_tiers.length > 0) {
        let totalWeight = 0;
        cart.forEach(item => {
             if (item.weight) totalWeight += (item.weight * item.quantity);
        });
        if (shippingConfig.packaging_weight) totalWeight += parseFloat(shippingConfig.packaging_weight);

        const tiers = shippingConfig.shipping_tiers.sort((a: any, b: any) => a.min_weight - b.min_weight);
        const tier = tiers.find((t: any) => totalWeight >= t.min_weight && totalWeight < t.max_weight);
        
        if (tier) {
            setShippingCost(parseFloat(tier.price));
        } else {
            const maxTier = tiers[tiers.length - 1];
            if (maxTier && totalWeight >= maxTier.max_weight) {
                 setShippingCost(parseFloat(maxTier.price));
            } else if (tiers.length > 0 && totalWeight < tiers[0].min_weight) {
                 setShippingCost(parseFloat(tiers[0].price));
            }
        }
    }
  }, [cart, shippingConfig]);


  if (loading) return <div className="min-h-screen flex items-center justify-center">Lade Shop...</div>;
  if (error || !shop) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Shop nicht gefunden'}</div>;

  const primaryColor = shop.primary_color || '#000000';
  const secondaryColor = shop.secondary_color || '#ffffff';

  // Helper to build category tree
  const topLevelCategories = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

  // Use resolved shop slug or ID for links
  const shopBaseUrl = `/shop/${shopId}`; // shopId param from URL is usually the slug or ID used in route

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
          <Link to={shopBaseUrl} className="flex-shrink-0 flex items-center justify-center lg:justify-start flex-1 lg:flex-none">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="h-12 w-auto object-contain" />
            ) : (
              <span className="text-2xl font-black uppercase tracking-tighter italic" style={{ color: primaryColor }}>
                {shop.name}
              </span>
            )}
          </Link>

          {/* Desktop Nav - Mega Menu */}
          <nav className="hidden lg:flex items-center space-x-8 mx-8 h-full">
            {topLevelCategories.map(cat => {
                const subCats = getSubCategories(cat.id);
                const hasSub = subCats.length > 0;
                
                return (
                    <div 
                        key={cat.id} 
                        className="h-full flex items-center relative group"
                        onMouseEnter={() => setHoveredCategory(cat.id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                    >
                        <Link 
                            to={`${shopBaseUrl}/category/${cat.slug}`} 
                            className="font-bold text-sm uppercase tracking-wide text-slate-700 hover:text-red-600 transition-colors py-8 flex items-center"
                        >
                            {cat.name}
                            {hasSub && <ChevronDown size={14} className="ml-1 opacity-50" />}
                        </Link>

                        {/* Mega Menu Dropdown */}
                        {hasSub && (
                            <div className="absolute top-full left-0 w-[600px] bg-white shadow-xl border-t border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50 -ml-4 rounded-b-lg overflow-hidden">
                                <div className="grid grid-cols-3 gap-6 p-8">
                                    {subCats.map(sub => (
                                        <div key={sub.id} className="space-y-2">
                                            {sub.image_url ? (
                                                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-3">
                                                    <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" />
                                                </div>
                                            ) : null}
                                            <Link to={`${shopBaseUrl}/category/${sub.slug}`} className="font-bold text-slate-800 hover:text-red-600 block">
                                                {sub.name}
                                            </Link>
                                            {/* Level 3 Categories (if any) */}
                                            <ul className="space-y-1">
                                                {getSubCategories(sub.id).map(lvl3 => (
                                                    <li key={lvl3.id}>
                                                        <Link to={`${shopBaseUrl}/category/${lvl3.slug}`} className="text-sm text-slate-500 hover:text-slate-800">
                                                            {lvl3.name}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {!topLevelCategories.length && (
                 <>
                    <Link to={`${shopBaseUrl}/new`} className="font-bold text-sm uppercase tracking-wide text-slate-700 hover:text-red-600 transition-colors">Neuheiten</Link>
                    <Link to={`${shopBaseUrl}/sale`} className="font-bold text-sm uppercase tracking-wide text-slate-700 hover:text-red-600 transition-colors">Sale</Link>
                 </>
            )}
          </nav>

          {/* Icons */}
          <div className="flex items-center space-x-4 lg:space-x-6 text-slate-600">
            <button className="hover:text-slate-900 hidden sm:block">
              <Search size={22} />
            </button>
            {currentCustomer ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 hover:text-slate-900 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: primaryColor }}>
                    {currentCustomer.first_name?.charAt(0)}{currentCustomer.last_name?.charAt(0)}
                  </div>
                  <span className="hidden lg:block text-sm font-bold text-slate-700">{currentCustomer.first_name}</span>
                  <ChevronDown size={14} className="opacity-50" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white shadow-xl rounded-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                  <div className="px-3 py-2 border-b border-slate-50 mb-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mein Konto</p>
                  </div>
                  <Link to={`${shopBaseUrl}/profile`} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium">
                    <User size={16} />
                    <span>Profil bearbeiten</span>
                  </Link>
                  <Link to={`${shopBaseUrl}/orders`} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-medium">
                    <ShoppingBag size={16} />
                    <span>Meine Bestellungen</span>
                  </Link>
                  <button onClick={logout} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                    <LogOut size={16} />
                    <span>Abmelden</span>
                  </button>
                </div>
              </div>
            ) : (
              <Link to={`${shopBaseUrl}/login`} className="hover:text-slate-900 transition-colors">
                <User size={22} />
              </Link>
            )}
            <button className="hover:text-slate-900 relative" onClick={() => setCartOpen(true)}>
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Sidebar */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <ShoppingCart size={20} className="text-slate-400" />
                  <h2 className="text-lg font-black uppercase tracking-tight">Warenkorb ({cartCount})</h2>
                </div>
                <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                      <ShoppingCart size={40} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Dein Warenkorb ist leer</p>
                      <p className="text-sm text-slate-500">Stöbere in unserem Shop und finde tolle Produkte.</p>
                    </div>
                    <button 
                      onClick={() => setCartOpen(false)}
                      className="px-6 py-2 rounded-lg font-bold text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-md"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Jetzt shoppen
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex space-x-4 group">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-200">
                            <BagIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between">
                          <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight">{item.name}</h3>
                          <p className="font-black text-sm text-slate-900 whitespace-nowrap ml-2">
                            {(item.price * item.quantity).toFixed(2).replace('.', ',')} €*
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">
                          {item.quantity}× {item.price.toFixed(2).replace('.', ',')} €*
                        </p>
                        {item.size && <p className="text-[10px] text-slate-500 mt-0.5">Größe: {item.size}</p>}
                        {item.color && <p className="text-[10px] text-slate-500">Farbe: {item.color}</p>}
                        
                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="px-2 py-0.5 hover:bg-slate-50 text-slate-500"
                            >-</button>
                            <span className="px-2 py-0.5 text-xs font-bold border-x border-slate-200 min-w-[2rem] text-center">
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-0.5 hover:bg-slate-50 text-slate-500"
                            >+</button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>Zwischensumme</span>
                      <span>{cartTotal.toFixed(2).replace('.', ',')} €*</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>Versandkosten</span>
                      <span>{shippingCost.toFixed(2).replace('.', ',')} €*</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-slate-900 pt-2">
                      <span>Gesamtbetrag</span>
                      <span>{(cartTotal + shippingCost).toFixed(2).replace('.', ',')} €*</span>
                    </div>
                    <p className="text-[10px] text-slate-400 text-right">*inkl. MwSt.</p>
                  </div>

                  <div className="grid gap-3 pt-2">
                    <Link 
                      to={`${shopBaseUrl}/checkout`}
                      onClick={() => setCartOpen(false)}
                      className="w-full flex items-center justify-center px-6 py-4 rounded-xl font-black uppercase tracking-widest text-sm text-white shadow-lg hover:scale-[1.02] active:scale-98 transition-all group"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span>Zur Kasse</span>
                      <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link 
                      to={`${shopBaseUrl}/cart`}
                      onClick={() => setCartOpen(false)}
                      className="w-full flex items-center justify-center px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-sm text-slate-700 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Warenkorb bearbeiten
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      <Outlet context={{ shop, categories, primaryColor, secondaryColor }} />

      {/* Footer */}
      <footer className="bg-slate-900 text-white pt-16 pb-8 mt-auto">
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

export default ShopLayout;

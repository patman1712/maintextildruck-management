
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
  
  // Determine if we are on a custom domain or subdomain route
  // If shopId is undefined, we assume we are running on a subdomain/custom domain
  const isCustomDomain = !shopId;
  const identifier = shopId || window.location.hostname;
  
  // Base URL for links
  // If custom domain, base is empty string (root)
  // If standard route, base is /shop/:shopId
  const shopBaseUrl = isCustomDomain ? '' : `/shop/${shopId}`;

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  
  const [shippingConfig, setShippingConfig] = useState<any>(null);
  const [shippingCost, setShippingCost] = useState(5.95);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    if (searchQuery.length >= 2) {
        const timeoutId = setTimeout(async () => {
            setIsSearching(true);
            try {
                // Use shop.id if available, otherwise identifier (might be slug/domain)
                const targetId = shop?.id || identifier;
                const res = await fetch(`/api/shops/${targetId}/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                if (data.success) {
                    setSearchResults(data.data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    } else {
        setSearchResults([]);
    }
  }, [searchQuery, identifier, shop]);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await fetch(`/api/shops/${identifier}`);
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

          // SECURITY FIX: Check if current logged-in customer belongs to this shop
          // If not, logout immediately to prevent cross-shop session leakage
          if (currentCustomer && currentCustomer.shop_id !== data.data.id) {
              console.warn('Customer session mismatch - logging out', { 
                  expected: data.data.id, 
                  actual: currentCustomer.shop_id 
              });
              logout();
              // Also clear cart as products likely belong to the other shop
              useShopStore.getState().clearCart();
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

    if (identifier) {
      fetchShop();
    }
  }, [identifier]);

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

  // shopBaseUrl is already defined above

  return (
    <div className="font-sans text-slate-800 bg-white min-h-screen flex flex-col">
      <style>{`
        .shop-hover-text:hover { color: ${primaryColor} !important; }
        .shop-hover-bg:hover { background-color: ${primaryColor}10 !important; }
        .group:hover .group-hover-shop-text { color: ${primaryColor} !important; }
      `}</style>
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

          {/* Left Section: Logo + Nav */}
          <div className="flex items-center h-full flex-1 lg:flex-none justify-center lg:justify-start">
              {/* Logo */}
              <Link to={shopBaseUrl} className="flex-shrink-0 flex items-center justify-center lg:justify-start">
                {shop.logo_url ? (
                  <img 
                    src={shop.logo_url.toLowerCase().endsWith('.pdf') ? `${shop.logo_url}_thumb.png` : shop.logo_url} 
                    alt={shop.name} 
                    className="h-12 w-auto object-contain" 
                    onError={(e) => {
                        // Fallback to text if image fails
                        e.currentTarget.style.display = 'none';
                        const textSpan = e.currentTarget.parentElement?.querySelector('.logo-text-fallback');
                        if (textSpan) textSpan.classList.remove('hidden');
                    }}
                  />
                ) : (
                  <span className="text-2xl font-black uppercase tracking-tighter italic" style={{ color: primaryColor }}>
                    {shop.name}
                  </span>
                )}
                <span className="logo-text-fallback hidden text-2xl font-black uppercase tracking-tighter italic" style={{ color: primaryColor }}>
                    {shop.name}
                </span>
              </Link>

              {/* Desktop Nav - Mega Menu */}
              <nav className="hidden lg:flex items-center space-x-6 ml-8 h-full">
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
                                className="font-bold text-sm uppercase tracking-wide text-slate-700 shop-hover-text transition-colors py-8 flex items-center"
                            >
                                {cat.name}
                                {hasSub && <ChevronDown size={14} className="ml-1 opacity-50" />}
                            </Link>

                            {/* Mega Menu Dropdown */}
                            {(hasSub || cat.image_url) && (
                                <div className={`absolute top-full left-0 shadow-xl border-t border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50 -ml-4 rounded-b-lg overflow-hidden flex ${hasSub ? 'w-max max-w-[1000px]' : 'w-[300px]'}`} style={{ backgroundColor: primaryColor }}>
                                    
                                    {hasSub ? (
                                        <>
                                            {/* Optional Category Image (Left Side) */}
                                            {cat.image_url && (
                                                <div className="w-64 p-6 bg-white/5 border-r border-white/10 flex-shrink-0 hidden md:block">
                                                    <div className="aspect-[3/4] rounded-lg overflow-hidden relative mb-4 shadow-sm bg-white/5">
                                                        <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
                                                    </div>
                                                    <h3 className="font-black uppercase text-lg mb-2 leading-tight" style={{ color: secondaryColor }}>{cat.name}</h3>
                                                    {cat.description && (
                                                        <p className="text-sm opacity-80 line-clamp-4 mb-4" style={{ color: secondaryColor }}>
                                                            {cat.description}
                                                        </p>
                                                    )}
                                                    <Link 
                                                        to={`${shopBaseUrl}/category/${cat.slug}`}
                                                        className="inline-block text-xs font-bold uppercase tracking-wider underline decoration-2 underline-offset-4 hover:opacity-80"
                                                        style={{ color: secondaryColor }}
                                                    >
                                                        Alle Produkte
                                                    </Link>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-3 gap-8 p-8 w-[600px]">
                                                {subCats.map(sub => (
                                                    <div key={sub.id} className="space-y-2">
                                                        {sub.image_url ? (
                                                            <Link to={`${shopBaseUrl}/category/${sub.slug}`} className="block aspect-video bg-white/10 rounded-lg overflow-hidden mb-3 border border-white/20 hover:opacity-90 transition-opacity">
                                                                <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                                            </Link>
                                                        ) : null}
                                                        <Link to={`${shopBaseUrl}/category/${sub.slug}`} className="font-bold block hover:opacity-80 transition-opacity text-base" style={{ color: secondaryColor }}>
                                                            {sub.name}
                                                        </Link>
                                                        {/* Level 3 Categories (if any) */}
                                                        <ul className="space-y-1.5">
                                                            {getSubCategories(sub.id).map(lvl3 => (
                                                                <li key={lvl3.id}>
                                                                    <Link to={`${shopBaseUrl}/category/${lvl3.slug}`} className="text-sm hover:opacity-100 opacity-70 transition-opacity block py-0.5" style={{ color: secondaryColor }}>
                                                                        {lvl3.name}
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        // "Teaser" Mode (No subcategories)
                                        <div className="w-full relative group/card">
                                            <div className="aspect-[4/3] w-full relative overflow-hidden">
                                                {cat.image_url ? (
                                                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110" loading="lazy" decoding="async" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/10" />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                                <h3 className="font-black uppercase text-xl mb-2 text-white">{cat.name}</h3>
                                                {cat.description && <p className="text-sm text-white/80 line-clamp-2 mb-4">{cat.description}</p>}
                                                <span className="inline-flex items-center text-sm font-bold uppercase tracking-wider underline decoration-2 underline-offset-4 text-white">
                                                    Jetzt entdecken <ArrowRight size={16} className="ml-2" />
                                                </span>
                                            </div>
                                            <Link to={`${shopBaseUrl}/category/${cat.slug}`} className="absolute inset-0" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {!topLevelCategories.length && (
                     <>
                        <Link to={`${shopBaseUrl}/new`} className="font-bold text-sm uppercase tracking-wide text-slate-700 shop-hover-text transition-colors">Neuheiten</Link>
                        <Link to={`${shopBaseUrl}/sale`} className="font-bold text-sm uppercase tracking-wide text-slate-700 shop-hover-text transition-colors">Sale</Link>
                     </>
                )}
              </nav>
          </div>

          {/* Icons */}
          <div className="flex items-center space-x-4 lg:space-x-6 text-slate-600">
            <button className="hover:text-slate-900" onClick={() => setSearchOpen(true)}>
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
                  <Link to={`${shopBaseUrl}/profile`} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-700 shop-hover-bg transition-colors font-medium rounded-lg">
                    <User size={16} />
                    <span>Profil bearbeiten</span>
                  </Link>
                  <Link to={`${shopBaseUrl}/orders`} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-700 shop-hover-bg transition-colors font-medium rounded-lg">
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
                <span className="absolute -top-2 -right-2 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-end mb-8">
              <button onClick={() => setSearchOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="relative max-w-2xl mx-auto">
              <input 
                autoFocus
                type="text" 
                placeholder="Wonach suchst du? (Produktname, Artikelnummer...)" 
                className="w-full text-2xl font-bold border-b-2 border-slate-200 py-4 outline-none focus:border-slate-900 placeholder:text-slate-300 bg-transparent pr-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-0 top-5 text-slate-400" size={24} />
            </div>

            <div className="max-w-4xl mx-auto mt-12">
                {isSearching ? (
                    <div className="text-center text-slate-400 py-12 animate-pulse">Suche läuft...</div>
                ) : searchQuery.length >= 2 ? (
                    searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {searchResults.map((product: any) => (
                                <Link 
                                    to={`${shopBaseUrl}/product/${product.product_id}`} 
                                    key={product.product_id}
                                    onClick={() => setSearchOpen(false)}
                                    className="flex items-start space-x-4 group bg-white p-3 rounded-lg shadow-sm hover:shadow-md border border-slate-100 transition-all"
                                >
                                    <div className="w-16 h-20 bg-slate-50 flex-shrink-0 overflow-hidden rounded border border-slate-100">
                                        {product.files && product.files[0] ? (
                                            <img src={product.files[0].thumbnail_url || product.files[0].file_url} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <BagIcon size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover-shop-text transition-colors line-clamp-2">{product.name}</h4>
                                        <p className="text-xs text-slate-500 mb-1 font-mono">{product.product_number}</p>
                                        <span className="font-bold text-sm text-slate-900">{product.price?.toFixed(2).replace('.', ',')} €</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-12">Keine Ergebnisse für "{searchQuery}" gefunden.</div>
                    )
                ) : null}
            </div>
          </div>
        </div>
      )}

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
                          <img src={item.image} alt={item.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
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
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[80%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-black uppercase italic text-xl" style={{ color: primaryColor }}>{shop.name}</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="space-y-1 px-2">
                        {topLevelCategories.map(cat => {
                            const subCats = getSubCategories(cat.id);
                            const hasSub = subCats.length > 0;
                            const isExpanded = hoveredCategory === cat.id; // Reuse state or add new one for mobile accordion

                            return (
                                <div key={cat.id} className="space-y-1">
                                    <div className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-slate-50">
                                        <Link 
                                            to={`${shopBaseUrl}/category/${cat.slug}`}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="font-bold text-slate-800 flex-1"
                                        >
                                            {cat.name}
                                        </Link>
                                        {hasSub && (
                                            <button 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setHoveredCategory(hoveredCategory === cat.id ? null : cat.id);
                                                }}
                                                className="p-2 -mr-2 text-slate-400"
                                            >
                                                <ChevronDown size={16} className={`transition-transform ${hoveredCategory === cat.id ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Subcategories Accordion */}
                                    {hasSub && hoveredCategory === cat.id && (
                                        <div className="pl-4 pr-2 space-y-1 bg-slate-50 py-2 rounded-lg mx-2">
                                            {subCats.map(sub => (
                                                <Link 
                                                    key={sub.id}
                                                    to={`${shopBaseUrl}/category/${sub.slug}`}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="block px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100/50"
                                                >
                                                    {sub.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {!topLevelCategories.length && (
                             <div className="px-4 py-4 text-center text-slate-400 italic">
                                Keine Kategorien
                             </div>
                        )}
                    </nav>

                    <div className="mt-6 px-4 pt-6 border-t border-slate-100 space-y-2">
                        <Link to={`${shopBaseUrl}/new`} onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 rounded-lg">Neuheiten</Link>
                        <Link to={`${shopBaseUrl}/sale`} onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 font-bold text-red-600 hover:bg-red-50 rounded-lg">Sale</Link>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    {currentCustomer ? (
                        <div className="space-y-2">
                            <div className="flex items-center space-x-3 px-4 py-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: primaryColor }}>
                                    {currentCustomer.first_name?.charAt(0)}{currentCustomer.last_name?.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700">{currentCustomer.first_name}</span>
                            </div>
                            <Link to={`${shopBaseUrl}/profile`} onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Profil</Link>
                            <Link to={`${shopBaseUrl}/orders`} onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Bestellungen</Link>
                            <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 rounded-lg">Abmelden</button>
                        </div>
                    ) : (
                        <Link 
                            to={`${shopBaseUrl}/login`} 
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center justify-center w-full px-4 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <User size={18} className="mr-2" />
                            Anmelden / Registrieren
                        </Link>
                    )}
                </div>
            </div>
        </div>
      )}

      <Outlet context={{ shop, categories, primaryColor, secondaryColor }} />

      {/* Footer */}
      <footer style={{ backgroundColor: primaryColor }} className="text-white pt-16 pb-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            
            {/* Column 1: Company Info */}
            <div>
              {shop.footer_logo_url ? (
                  <img src={shop.footer_logo_url.replace('_thumb', '')} alt={shop.name} className="w-64 max-w-full h-auto mb-6 object-contain brightness-0 invert" />
              ) : (
                  <h4 className="font-black uppercase italic text-2xl mb-6">{shop.name}</h4>
              )}
              
              <div className="space-y-4 text-sm">
                  {shop.contact_phone && (
                      <div>
                          <p className="opacity-80 mb-1">Unterstützung und Beratung unter:</p>
                          <p className="font-bold text-lg border-b-2 border-white/20 inline-block pb-1 mb-2">{shop.contact_phone}</p>
                          {shop.opening_hours && <p className="opacity-80">{shop.opening_hours}</p>}
                      </div>
                  )}
                  
                  <div>
                      <p className="opacity-80">Oder über unser <Link to={`${shopBaseUrl}/page/kontakt`} className="underline hover:text-white/80">Kontaktformular</Link>.</p>
                  </div>

                  <div className="flex space-x-4 pt-4">
                      {shop.social_instagram && (
                          <a href={shop.social_instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                              <img src="https://cdn.simpleicons.org/instagram/white" className="w-6 h-6" alt="Instagram" />
                          </a>
                      )}
                      {shop.social_tiktok && (
                          <a href={shop.social_tiktok} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                              <img src="https://cdn.simpleicons.org/tiktok/white" className="w-6 h-6" alt="TikTok" />
                          </a>
                      )}
                      {shop.social_whatsapp && (
                          <a href={shop.social_whatsapp} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                              <img src="https://cdn.simpleicons.org/whatsapp/white" className="w-6 h-6" alt="WhatsApp" />
                          </a>
                      )}
                  </div>
              </div>
            </div>

            {/* Column 2: Information */}
            <div>
              <h4 className="font-bold underline decoration-2 underline-offset-4 mb-6 text-lg">Information</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to={`${shopBaseUrl}/page/impressum`} className="hover:underline">Impressum</Link></li>
                <li><Link to={`${shopBaseUrl}/page/datenschutz`} className="hover:underline">Datenschutz</Link></li>
                <li><Link to={`${shopBaseUrl}/page/ueber-uns`} className="hover:underline">Über uns</Link></li>
              </ul>
            </div>

            {/* Column 3: Shop Service */}
            <div>
              <h4 className="font-bold underline decoration-2 underline-offset-4 mb-6 text-lg">Shop Service</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to={`${shopBaseUrl}/page/kontakt`} className="hover:underline">Kontakt</Link></li>
                <li><Link to={`${shopBaseUrl}/page/widerrufsrecht`} className="hover:underline">Widerrufsrecht</Link></li>
                <li><Link to={`${shopBaseUrl}/page/versand`} className="hover:underline">Versand- und Zahlungsbedingungen</Link></li>
                <li><Link to={`${shopBaseUrl}/page/agb`} className="hover:underline">AGB</Link></li>
              </ul>
            </div>

          </div>
          
          <div className="border-t border-white/20 pt-8 text-center text-xs opacity-80">
            <p>Alle Preise inkl. gesetzl. Mehrwertsteuer zzgl. <Link to={`${shopBaseUrl}/page/versand`} className="underline">Versandkosten</Link> und ggf. Nachnahmegebühren, wenn nicht anders angegeben.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ShopLayout;

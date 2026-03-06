
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Star, ChevronLeft } from 'lucide-react';
import { Shop, ShopCategory, Product } from '../../store';

interface ShopContext {
  shop: Shop;
  categories: ShopCategory[];
  primaryColor: string;
  secondaryColor: string;
}

const ShopHome: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const { shop, primaryColor, secondaryColor } = useOutletContext<ShopContext>();
  const [products, setProducts] = useState<any[]>([]); // Using any for extended product interface
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/shops/${shopId}/products?limit=8`);
        const data = await res.json();
        if (data.success) {
          // Filter featured or just take first 8 (already limited by API)
          setProducts(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [shopId]);

  // Auto-advance slider
  useEffect(() => {
    if (!shop.hero_images || shop.hero_images.length <= 1) return;
    
    const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % (shop.hero_images?.length || 1));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [shop.hero_images]);

  const nextSlide = () => {
      if (!shop.hero_images) return;
      setCurrentSlide(prev => (prev + 1) % shop.hero_images!.length);
  };

  const prevSlide = () => {
      if (!shop.hero_images) return;
      setCurrentSlide(prev => (prev - 1 + shop.hero_images!.length) % shop.hero_images!.length);
  };

  const heroImages = shop.hero_images && shop.hero_images.length > 0 
    ? shop.hero_images 
    : ['https://images.unsplash.com/photo-1518609878373-06d740f60d8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80'];

  return (
    <>
      {/* Hero Section */}
      <div className="relative w-full overflow-hidden group">
        {heroImages.length > 0 ? (
             <div className="relative w-full">
                 <img 
                    src={heroImages[currentSlide].replace('_thumb', '').replace(/_thumb\.[a-z]+$/i, (match) => match.replace('_thumb', ''))} 
                    alt="Hero" 
                    className="w-full h-auto object-cover" 
                 />
                 
                 {heroImages.length > 1 && (
                    <>
                        <button 
                            onClick={prevSlide}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 p-2 rounded-full text-slate-800 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                        >
                            <ChevronLeft size={32} />
                        </button>
                        <button 
                            onClick={nextSlide}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 p-2 rounded-full text-slate-800 backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                        >
                            <ChevronRight size={32} />
                        </button>
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                            {heroImages.map((_, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setCurrentSlide(idx)}
                                    className={`w-2 h-2 rounded-full transition-all shadow-sm ${idx === currentSlide ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'}`}
                                />
                            ))}
                        </div>
                    </>
                 )}
             </div>
        ) : (
            <div className="bg-slate-100 h-[300px] flex items-center justify-center text-slate-300">
                Kein Bild vorhanden
            </div>
        )}
      </div>

      {/* Welcome Text Section */}
      {shop.welcome_text && (
          <div className="container mx-auto px-4 py-12 text-center border-b border-slate-100">
              <div className="max-w-4xl mx-auto prose prose-lg prose-slate">
                  <p className="text-xl text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                      {shop.welcome_text}
                  </p>
              </div>
          </div>
      )}

      {/* Product Grid */}
      <main className="container mx-auto px-4 py-16 flex-grow">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-3xl font-black uppercase italic text-slate-800">Highlights</h2>
          {/* <Link to="all" className="text-sm font-bold uppercase text-slate-500 hover:text-slate-800 flex items-center">
            Alle anzeigen <ChevronRight size={16} />
          </Link> */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.length > 0 ? products.map(product => (
                <Link to={`/shop/${shopId}/product/${product.product_id}`} key={product.assignment_id} className="group cursor-pointer block">
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
                        <button className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 hover:bg-red-600 hover:text-white" onClick={(e) => e.preventDefault()}>
                            <ShoppingCart size={20} />
                        </button>
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-red-600 transition-colors">{product.name}</h3>
                    <p className="text-sm text-slate-500 mb-2">{product.product_number}</p>
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">€ {product.price > 0 ? product.price.toFixed(2) : '29.95'}</span>
                        <div className="flex text-yellow-400">
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                            <Star size={14} fill="currentColor" />
                        </div>
                    </div>
                </Link>
            )) : (
                <div className="col-span-full text-center py-20 text-slate-400">
                    <p>{loading ? 'Lade Produkte...' : 'Keine Produkte gefunden.'}</p>
                </div>
            )}
        </div>
      </main>
    </>
  );
};

export default ShopHome;

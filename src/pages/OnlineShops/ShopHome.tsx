
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Star, ChevronLeft } from 'lucide-react';
import { Shop, ShopCategory, Product } from '../../store';
import { ProductTile } from './components/ProductTile';

interface ShopContext {
  shop: Shop;
  categories: ShopCategory[];
  primaryColor: string;
  secondaryColor: string;
}

const ShopHome: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const { shop } = useOutletContext<ShopContext>();
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
    if (!shop.hero_images || !Array.isArray(shop.hero_images) || shop.hero_images.length <= 1) return;
    
    const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % (shop.hero_images?.length || 1));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [shop.hero_images]);

  const nextSlide = () => {
      if (!shop.hero_images || !Array.isArray(shop.hero_images)) return;
      setCurrentSlide(prev => (prev + 1) % shop.hero_images!.length);
  };

  const prevSlide = () => {
      if (!shop.hero_images || !Array.isArray(shop.hero_images)) return;
      setCurrentSlide(prev => (prev - 1 + shop.hero_images!.length) % shop.hero_images!.length);
  };

  const heroImages = Array.isArray(shop.hero_images) && shop.hero_images.length > 0 
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
                <ProductTile key={product.assignment_id} product={product} shopId={shopId} />
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

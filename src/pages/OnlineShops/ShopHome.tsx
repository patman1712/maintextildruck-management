
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link, useParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Star } from 'lucide-react';
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

  return (
    <>
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

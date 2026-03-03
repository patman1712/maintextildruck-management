
import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { ChevronRight, Heart, ChevronLeft, ChevronDown, Eye } from 'lucide-react';
import { Shop, ShopCategory } from '../../store';

interface ShopContext {
  shop: Shop;
  categories: ShopCategory[];
  primaryColor: string;
  secondaryColor: string;
}

const ShopCategoryPage: React.FC = () => {
  const { shopId, categorySlug } = useParams<{ shopId: string; categorySlug: string }>();
  const { shop, categories, primaryColor } = useOutletContext<ShopContext>();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Find current category and its hierarchy
  const currentCategory = categories.find(c => c.slug === categorySlug);
  const parentCategory = currentCategory?.parent_id ? categories.find(c => c.id === currentCategory.parent_id) : null;
  
  // Sidebar logic: Get top level categories
  const topLevelCategories = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/shops/${shopId}/products`);
        const data = await res.json();
        if (data.success) {
          // Filter by category slug
          // Also include products in subcategories? Usually yes.
          // Let's find all category IDs that match (current + children)
          const categoryIds = new Set<string>();
          if (currentCategory) {
              categoryIds.add(currentCategory.id);
              // Add direct children
              categories.filter(c => c.parent_id === currentCategory.id).forEach(c => categoryIds.add(c.id));
          }

          const filtered = data.data.filter((p: any) => 
            // If viewing "all", show everything? No, usually specific category page.
            // Check if product's category_id matches or is a child
            p.category_slug === categorySlug || 
            (currentCategory && p.category_id && categoryIds.has(p.category_id))
          );
          setProducts(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (shopId && categorySlug) {
        fetchProducts();
    }
  }, [shopId, categorySlug, currentCategory, categories]);

  if (!currentCategory && !loading) return <div className="container mx-auto p-8">Kategorie nicht gefunden.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-xs uppercase tracking-wider text-slate-500 mb-8">
        <Link to={`/shop/${shopId}`} className="hover:text-slate-800">Startseite</Link>
        {parentCategory && (
            <>
                <span className="mx-2">/</span>
                <Link to={`/shop/${shopId}/category/${parentCategory.slug}`} className="hover:text-slate-800">{parentCategory.name}</Link>
            </>
        )}
        <span className="mx-2">/</span>
        <span className="text-slate-800 font-bold">{currentCategory?.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
          <h3 className="font-bold text-lg mb-4 uppercase">Alle Artikel</h3>
          <ul className="space-y-2 text-sm">
            {topLevelCategories.map(cat => {
                const isActive = cat.slug === categorySlug || cat.id === parentCategory?.id;
                const isCurrent = cat.slug === categorySlug;
                
                return (
                    <li key={cat.id}>
                        <Link 
                            to={`/shop/${shopId}/category/${cat.slug}`}
                            className={`block py-1 hover:text-red-600 ${isActive ? 'font-bold text-slate-900' : 'text-slate-600'}`}
                            style={isCurrent ? { color: primaryColor } : {}}
                        >
                            {cat.name}
                        </Link>
                        {/* Show children if active */}
                        {isActive && (
                            <ul className="pl-4 mt-1 space-y-1 border-l border-slate-200 ml-1">
                                {categories.filter(sub => sub.parent_id === cat.id).map(sub => (
                                    <li key={sub.id}>
                                        <Link 
                                            to={`/shop/${shopId}/category/${sub.slug}`}
                                            className={`block py-1 hover:text-red-600 ${sub.slug === categorySlug ? 'font-bold text-red-600' : 'text-slate-500'}`}
                                        >
                                            {sub.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
          </ul>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-slate-200">
                <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">{currentCategory?.name}</h1>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button className="px-4 py-2 border border-slate-300 rounded text-xs font-bold uppercase flex items-center hover:border-slate-800">
                        Sortierung <ChevronDown size={14} className="ml-2" />
                    </button>
                    <button className="px-4 py-2 border border-slate-300 rounded text-xs font-bold uppercase flex items-center hover:border-slate-800">
                        Grössen <ChevronDown size={14} className="ml-2" />
                    </button>
                    <button className="px-4 py-2 border border-slate-300 rounded text-xs font-bold uppercase flex items-center hover:border-slate-800">
                        Preis / € <ChevronDown size={14} className="ml-2" />
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 mb-6 uppercase tracking-wider font-bold">
                <span>{products.length} Artikel</span>
                <div className="flex space-x-2">
                    <span>Artikel pro Seite:</span>
                    <span className="text-slate-900 cursor-pointer">24</span>
                    <span>|</span>
                    <span className="cursor-pointer hover:text-slate-900">48</span>
                    <span>|</span>
                    <span className="cursor-pointer hover:text-slate-900">72</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-slate-400">Lade Produkte...</div>
                ) : products.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-slate-400">Keine Produkte in dieser Kategorie gefunden.</div>
                ) : (
                    products.map(product => (
                        <Link to={`/shop/${shopId}/product/${product.product_id}`} key={product.assignment_id} className="group relative block">
                            {/* Product Card */}
                            <div className="relative bg-white transition-all duration-300">
                                {/* Wishlist Icon */}
                                <button className="absolute top-2 left-2 z-20 p-2 text-slate-400 hover:text-red-600 transition-colors" onClick={(e) => e.preventDefault()}>
                                    <Heart size={20} />
                                </button>

                                {/* Image Container */}
                                <div className="relative aspect-[3/4] bg-slate-50 mb-4 overflow-hidden">
                                    {product.files && product.files.length > 0 ? (
                                        <img 
                                            src={product.files[0].thumbnail_url || product.files[0].file_url} 
                                            alt={product.name}
                                            className="w-full h-full object-cover object-center"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <span className="font-bold opacity-20">NO IMAGE</span>
                                        </div>
                                    )}

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                         {/* Quick View Button */}
                                         <button className="bg-white text-slate-900 border border-slate-200 px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-slate-900 hover:text-white">
                                            Quick View
                                         </button>
                                         
                                         {/* Carousel Arrows (Mock) */}
                                         <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full hover:bg-white text-slate-800 hidden group-hover:block">
                                            <ChevronLeft size={16} />
                                         </button>
                                         <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full hover:bg-white text-slate-800 hidden group-hover:block">
                                            <ChevronRight size={16} />
                                         </button>
                                    </div>
                                    
                                    {/* Pagination Dots (Mock) */}
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="text-center relative bg-white z-10">
                                    <h3 className="text-sm font-medium text-slate-600 mb-1">{product.name}</h3>
                                    <p className="text-lg font-bold text-slate-900 mb-2">€ {product.price > 0 ? product.price.toFixed(2) : '29.95'}</p>
                                    
                                    {/* Hover Options (Sizes) */}
                                    <div className="h-0 overflow-hidden group-hover:h-auto group-hover:overflow-visible transition-all duration-300">
                                        <div className="pt-2 flex justify-center space-x-2">
                                            {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                                                <button key={size} className="w-8 h-8 border border-slate-200 flex items-center justify-center text-xs font-bold hover:border-slate-800 hover:bg-slate-800 hover:text-white transition-colors">
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCategoryPage;

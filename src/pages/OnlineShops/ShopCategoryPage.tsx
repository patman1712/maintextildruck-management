
import React, { useEffect, useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { ChevronRight, Heart, ChevronLeft, ChevronDown, Eye } from 'lucide-react';
import { Shop, ShopCategory } from '../../store';
import { ProductTile } from './components/ProductTile';

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

          const filtered = data.data.filter((p: any) => {
            // Check if ANY of the product's category slugs match the current category slug
            if (p.category_slugs && p.category_slugs.includes(categorySlug)) return true;
            
            // Check if ANY of the product's category IDs match the current category or its children
            if (currentCategory && p.category_ids && p.category_ids.some((id: string) => categoryIds.has(id))) return true;

            // Fallback to legacy single category check
            return p.category_slug === categorySlug || 
                   (currentCategory && p.category_id && categoryIds.has(p.category_id));
          });
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
                        <ProductTile key={product.assignment_id} product={product} shopId={shopId} />
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCategoryPage;

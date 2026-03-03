
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, Shop, Product, ShopCategory, ShopProductAssignment } from '../../../store';
import { ArrowLeft, ShoppingBag, Layers, Layout, Save, Plus, Trash2, ExternalLink, Image as ImageIcon, Search, CheckCircle, X } from 'lucide-react';

const ShopDashboard: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { shops, updateShop, products } = useAppStore();
  const [shop, setShop] = useState<Shop | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'design' | 'categories' | 'products'>('general');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [shopProducts, setShopProducts] = useState<(ShopProductAssignment & { product_name?: string, product_number?: string, category_name?: string })[]>([]);
  
  // Forms
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', parent_id: '' });
  const [assignProductSearch, setAssignProductSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    if (shopId) {
      const foundShop = shops.find(s => s.id === shopId);
      if (foundShop) setShop(foundShop);
      fetchCategories();
      fetchShopProducts();
    }
  }, [shopId, shops]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/shop-management/${shopId}/categories`);
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchShopProducts = async () => {
    try {
      const res = await fetch(`/api/shop-management/${shopId}/products`);
      const data = await res.json();
      if (data.success) setShopProducts(data.data);
    } catch (e) { console.error(e); }
  };

  const handleSaveGeneral = async () => {
    if (!shop) return;
    await updateShop(shop.id, shop);
    alert('Gespeichert!');
  };

  const handleAddCategory = async () => {
    if (!newCategory.name || !shop) return;
    try {
      const res = await fetch(`/api/shop-management/${shop.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: newCategory.name,
            slug: newCategory.slug || newCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            parent_id: newCategory.parent_id || null
        })
      });
      const data = await res.json();
      if (data.success) {
          setCategories([...categories, data.data]);
          setNewCategory({ name: '', slug: '', parent_id: '' });
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Kategorie wirklich löschen?')) return;
    try {
      await fetch(`/api/shop-management/${shopId}/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleAssignProduct = async (product: Product) => {
    if (!shop) return;
    try {
      const res = await fetch(`/api/shop-management/${shop.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product_id: product.id,
            price: 0, // Default price?
            is_featured: false
        })
      });
      const data = await res.json();
      if (data.success) {
          fetchShopProducts();
          // Don't close modal to allow multiple adds
      } else {
          alert(data.error);
      }
    } catch (e) { console.error(e); }
  };

  const handleRemoveProduct = async (id: string) => {
    try {
      await fetch(`/api/shop-management/${shopId}/products/${id}`, { method: 'DELETE' });
      setShopProducts(shopProducts.filter(p => p.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleUpdateProduct = async (id: string, updates: any) => {
    try {
      await fetch(`/api/shop-management/${shopId}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      setShopProducts(shopProducts.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (e) { console.error(e); }
  };

  if (!shop) return <div className="p-8">Lade Shop...</div>;

  // Filter products available to add (belonging to customer, not yet assigned)
  const customerProducts = products.filter(p => p.customer_id === shop.customer_id);
  const availableProducts = customerProducts.filter(p => !shopProducts.some(sp => sp.product_id === p.id))
    .filter(p => p.name.toLowerCase().includes(assignProductSearch.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
            <button onClick={() => navigate('/dashboard/shops')} className="mr-4 text-slate-400 hover:text-slate-600">
                <ArrowLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{shop.name}</h1>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase mr-2">Active</span>
                    <a href={`/shop/${shop.domain_slug}`} target="_blank" className="flex items-center hover:text-blue-600">
                        /shop/{shop.domain_slug} <ExternalLink size={12} className="ml-1" />
                    </a>
                </div>
            </div>
        </div>
        <button onClick={handleSaveGeneral} className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-700">
            <Save size={18} className="mr-2" /> Speichern
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 flex">
            <button 
                onClick={() => setActiveTab('general')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'general' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <ShoppingBag size={16} className="mr-2" /> Allgemein
            </button>
            <button 
                onClick={() => setActiveTab('design')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'design' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Layout size={16} className="mr-2" /> Design
            </button>
            <button 
                onClick={() => setActiveTab('categories')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'categories' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Layers size={16} className="mr-2" /> Kategorien
            </button>
            <button 
                onClick={() => setActiveTab('products')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'products' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <ShoppingBag size={16} className="mr-2" /> Produkte
            </button>
        </div>

        <div className="p-8">
            {activeTab === 'general' && (
                <div className="max-w-2xl space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2"
                            value={shop.name}
                            onChange={(e) => setShop({ ...shop, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Domain Slug</label>
                        <div className="flex">
                            <span className="bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg p-2 text-slate-500 text-sm">/shop/</span>
                            <input 
                                type="text" 
                                className="flex-1 border border-slate-300 rounded-r-lg p-2"
                                value={shop.domain_slug}
                                onChange={(e) => setShop({ ...shop, domain_slug: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'design' && (
                <div className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe</label>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="color" 
                                    className="h-10 w-10 border border-slate-300 rounded cursor-pointer"
                                    value={shop.primary_color}
                                    onChange={(e) => setShop({ ...shop, primary_color: e.target.value })}
                                />
                                <input 
                                    type="text" 
                                    className="flex-1 border border-slate-300 rounded-lg p-2 font-mono text-sm"
                                    value={shop.primary_color}
                                    onChange={(e) => setShop({ ...shop, primary_color: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sekundärfarbe</label>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="color" 
                                    className="h-10 w-10 border border-slate-300 rounded cursor-pointer"
                                    value={shop.secondary_color}
                                    onChange={(e) => setShop({ ...shop, secondary_color: e.target.value })}
                                />
                                <input 
                                    type="text" 
                                    className="flex-1 border border-slate-300 rounded-lg p-2 font-mono text-sm"
                                    value={shop.secondary_color}
                                    onChange={(e) => setShop({ ...shop, secondary_color: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2 mb-2"
                            value={shop.logo_url || ''}
                            onChange={(e) => setShop({ ...shop, logo_url: e.target.value })}
                            placeholder="https://..."
                        />
                        {shop.logo_url && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-center">
                                <img src={shop.logo_url} alt="Logo Preview" className="h-16 object-contain" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div>
                    <div className="flex mb-6 space-x-4 items-end">
                        <div className="flex-1 space-y-2">
                             <input 
                                type="text" 
                                placeholder="Neue Kategorie Name"
                                className="w-full border border-slate-300 rounded-lg p-2"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                            />
                            <select
                                className="w-full border border-slate-300 rounded-lg p-2 text-sm text-slate-600"
                                value={newCategory.parent_id}
                                onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}
                            >
                                <option value="">Keine Überkategorie (Hauptkategorie)</option>
                                {categories.filter(c => !c.parent_id).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleAddCategory} className="bg-slate-800 text-white px-4 py-2 h-10 rounded-lg hover:bg-slate-700 mb-0.5">
                            Hinzufügen
                        </button>
                    </div>
                    
                    <div className="space-y-2">
                        {categories.length === 0 ? (
                            <p className="text-slate-500 italic">Keine Kategorien vorhanden.</p>
                        ) : (
                            // Render hierarchically
                            categories.filter(c => !c.parent_id).map(cat => (
                                <div key={cat.id} className="space-y-2">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="font-bold text-slate-800">{cat.name}</span>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-slate-400 font-mono bg-white px-2 py-1 rounded border border-slate-200">/{cat.slug}</span>
                                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-400 hover:text-red-600 p-1">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Subcategories */}
                                    <div className="pl-8 space-y-2 border-l-2 border-slate-100 ml-4">
                                        {categories.filter(sub => sub.parent_id === cat.id).map(sub => (
                                             <div key={sub.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <span className="font-medium text-slate-600">{sub.name}</span>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">/{sub.slug}</span>
                                                    <button onClick={() => handleDeleteCategory(sub.id)} className="text-slate-300 hover:text-red-600 p-1">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Shop Produkte ({shopProducts.length})</h3>
                        <button onClick={() => setShowProductModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700">
                            <Plus size={18} className="mr-2" /> Produkt hinzufügen
                        </button>
                    </div>

                    <div className="space-y-4">
                        {shopProducts.map(sp => (
                            <div key={sp.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 bg-slate-100 rounded flex items-center justify-center">
                                        <ImageIcon size={20} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{sp.product_name}</h4>
                                        <p className="text-xs text-slate-500">{sp.product_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <select 
                                        className="border border-slate-300 rounded p-1 text-sm"
                                        value={sp.category_id || ''}
                                        onChange={(e) => handleUpdateProduct(sp.id, { category_id: e.target.value || null })}
                                    >
                                        <option value="">Keine Kategorie</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    
                                    <div className="flex items-center border border-slate-300 rounded px-2 py-1 bg-white">
                                        <span className="text-slate-400 text-sm mr-1">€</span>
                                        <input 
                                            type="number" 
                                            className="w-16 text-sm outline-none"
                                            value={sp.price || ''}
                                            placeholder="0.00"
                                            onChange={(e) => handleUpdateProduct(sp.id, { price: parseFloat(e.target.value) })}
                                        />
                                    </div>

                                    <button onClick={() => handleRemoveProduct(sp.id)} className="text-slate-400 hover:text-red-600">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {shopProducts.length === 0 && <p className="text-center text-slate-500 py-8">Keine Produkte im Shop.</p>}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Product Assign Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">Produkt hinzufügen</h3>
                    <button onClick={() => setShowProductModal(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Produkt suchen..."
                            className="w-full pl-10 border border-slate-300 rounded-lg p-2"
                            value={assignProductSearch}
                            onChange={(e) => setAssignProductSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {availableProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all">
                            <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                                    {p.files && p.files[0] && (p.files[0].thumbnail_url || p.files[0].file_url) ? (
                                        <img src={p.files[0].thumbnail_url || p.files[0].file_url} className="h-full w-full object-contain" />
                                    ) : <ImageIcon size={16} className="text-slate-400" />}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.product_number}</p>
                                </div>
                            </div>
                            <button onClick={() => handleAssignProduct(p)} className="text-green-600 hover:bg-green-50 p-2 rounded-full">
                                <Plus size={20} />
                            </button>
                        </div>
                    ))}
                    {availableProducts.length === 0 && <p className="text-center text-slate-500 py-4">Keine passenden Produkte gefunden.</p>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ShopDashboard;

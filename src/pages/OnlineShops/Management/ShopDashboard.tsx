
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, Shop, Product, ShopCategory, ShopProductAssignment } from '../../../store';
import { ArrowLeft, ShoppingBag, Layers, Layout, Save, Plus, Trash2, ExternalLink, Image as ImageIcon, Search, CheckCircle, X, Edit2, Users, Mail, Phone, MapPin, Calendar, User, Building, Truck, Key } from 'lucide-react';
import ProductEditorModal from './ProductEditorModal';

const ShopDashboard: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { shops, updateShop, products } = useAppStore();
  const [shop, setShop] = useState<Shop | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'design' | 'categories' | 'products' | 'customers' | 'orders'>('general');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [shopProducts, setShopProducts] = useState<(ShopProductAssignment & { product_name?: string, product_number?: string, category_name?: string })[]>([]);
  const [shopCustomers, setShopCustomers] = useState<any[]>([]);
  const [shopOrders, setShopOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [personalizationOptions, setPersonalizationOptions] = useState<any[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  
  // Forms
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', parent_id: '' });
  const [assignProductSearch, setAssignProductSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  
  // Editor Modal
  const [editorAssignment, setEditorAssignment] = useState<any | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false); // Track create mode

  useEffect(() => {
    if (shopId) {
      const foundShop = shops.find(s => s.id === shopId);
      if (foundShop) setShop(foundShop);
      fetchCategories();
      fetchShopProducts();
      fetchShopCustomers();
      fetchShopOrders();
      fetchPersonalizationOptions();
    }
  }, [shopId, shops]);

  const fetchPersonalizationOptions = async () => {
    try {
      const res = await fetch('/api/personalization');
      const data = await res.json();
      if (data.success) setPersonalizationOptions(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchShopOrders = async () => {
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/orders`);
      const data = await res.json();
      if (data.success) setShopOrders(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchShopCustomers = async () => {
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/list`);
      const data = await res.json();
      if (data.success) setShopCustomers(data.data);
    } catch (e) { console.error(e); }
  };

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
            category_id: null, // Explicitly send null or selected category if UI supported it
            price: 0, 
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

  const handleCreateProduct = (newAssignment: any) => {
    // Add new assignment to list immediately
    setShopProducts(prev => [newAssignment, ...prev]);
    // Also we might want to switch to edit mode for this new product immediately?
    // For now, let's just close the create modal (which ProductEditorModal does)
    // and optionally open it in edit mode.
    // ProductEditorModal calls onClose internally.
    
    // Open in edit mode to allow image upload immediately
    setIsCreateMode(false);
    setEditorAssignment(newAssignment);
  };

  const handleUpdateProduct = async (id: string, updates: any) => {
    try {
      // Find current state to merge
      const currentProduct = shopProducts.find(p => p.id === id);
      if (!currentProduct) return;
      
      const payload = { ...currentProduct, ...updates };

      await fetch(`/api/shop-management/${shopId}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category_id: payload.category_id,
            price: payload.price,
            is_featured: payload.is_featured,
            personalization_enabled: payload.personalization_enabled,
            sort_order: payload.sort_order,
            // Also update product details if provided in updates
            manufacturer_info: updates.manufacturer_info,
            description: updates.description,
            size: updates.size,
            weight: updates.weight,
            color: updates.color,
            variants: updates.variants !== undefined ? updates.variants : payload.variants,
            personalization_options: updates.personalization_options !== undefined ? updates.personalization_options : payload.personalization_options
        })
      });
      setShopProducts(shopProducts.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (e) { console.error(e); }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setShopOrders(shopOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      } else {
        alert(data.error || 'Fehler beim Aktualisieren des Status.');
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateShippingLabel = async (order: any) => {
    if (!confirm('DHL Versandlabel jetzt erstellen?')) return;
    setIsCreatingLabel(true);
    try {
      const res = await fetch(`/api/shop-management/${shopId}/shipping/create-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      });
      const data = await res.json();
      if (data.success) {
        alert('DHL Label erfolgreich erstellt!');
        fetchShopOrders();
        if (selectedOrder?.id === order.id) {
          setSelectedOrder({ ...selectedOrder, tracking_number: data.trackingNumber, label_url: data.labelUrl });
        }
      } else {
        alert('Fehler beim Erstellen des DHL Labels: ' + data.error);
      }
    } catch (e) { 
      console.error(e);
      alert('Ein technischer Fehler ist aufgetreten.');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Kunden wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/${customerId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setShopCustomers(shopCustomers.filter(c => c.id !== customerId));
      } else {
        alert(data.error || 'Fehler beim Löschen des Kunden.');
      }
    } catch (e) { console.error(e); }
  };

  if (!shop) return <div className="p-8">Lade Shop...</div>;

  const formatPersonalization = (notes: string) => {
    if (!notes) return '';
    
    // Split multiple options separated by '|'
    return notes.split('|').map(part => {
        const [id, value] = part.split(':');
        if (!id || !value) return part;
        
        const option = personalizationOptions.find(o => o.id === id);
        if (option) {
            // Handle boolean values (true/false as strings)
            if (value === 'true') return option.name;
            if (value === 'false') return '';
            return `${option.name}: ${value}`;
        }
        return part;
    }).filter(p => !!p).join(', ');
  };

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
            <button 
                onClick={() => setActiveTab('customers')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'customers' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Users size={16} className="mr-2" /> Kunden
            </button>
            <button 
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'orders' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <ShoppingBag size={16} className="mr-2" /> Bestellungen
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
                                        <div className="flex items-center space-x-2">
                                            <p className="text-xs text-slate-500">{sp.product_number}</p>
                                            {sp.weight > 0 && (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                                                    {sp.weight.toFixed(3)} kg
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <select 
                                        className="border border-slate-300 rounded p-1 text-sm max-w-[150px]"
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

                                    <button onClick={() => setEditorAssignment(sp)} className="text-slate-400 hover:text-blue-600">
                                        <Edit2 size={18} />
                                    </button>
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

            {activeTab === 'customers' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Registrierte Kunden ({shopCustomers.length})</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest">
                                    <th className="py-4 px-4 font-bold">Kunde</th>
                                    <th className="py-4 px-4 font-bold">Unternehmen</th>
                                    <th className="py-4 px-4 font-bold">Kontakt</th>
                                    <th className="py-4 px-4 font-bold">Adresse</th>
                                    <th className="py-4 px-4 font-bold">Registriert am</th>
                                    <th className="py-4 px-4 font-bold">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {shopCustomers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{customer.first_name} {customer.last_name}</p>
                                                    <p className="text-xs text-slate-500">{customer.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            {customer.company ? (
                                                <div className="flex items-center text-slate-600">
                                                    <Building size={14} className="mr-2 opacity-50" />
                                                    <span className="text-sm">{customer.company}</span>
                                                </div>
                                            ) : <span className="text-slate-300 italic text-xs">-</span>}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center text-slate-600">
                                                    <Mail size={14} className="mr-2 opacity-50" />
                                                    <span className="text-sm">{customer.email}</span>
                                                </div>
                                                {customer.phone && (
                                                    <div className="flex items-center text-slate-600">
                                                        <Phone size={14} className="mr-2 opacity-50" />
                                                        <span className="text-sm">{customer.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            {customer.street ? (
                                                <div className="flex items-start text-slate-600">
                                                    <MapPin size={14} className="mr-2 mt-1 opacity-50" />
                                                    <div className="text-sm">
                                                        <p>{customer.street}</p>
                                                        <p>{customer.zip} {customer.city}</p>
                                                    </div>
                                                </div>
                                            ) : <span className="text-slate-300 italic text-xs">-</span>}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center text-slate-400 text-xs">
                                                <Calendar size={14} className="mr-2 opacity-50" />
                                                {new Date(customer.created_at).toLocaleDateString('de-DE')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <button 
                                                onClick={() => handleDeleteCustomer(customer.id)} 
                                                className="text-slate-300 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
                                                title="Kunde löschen"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {shopCustomers.length === 0 && (
                            <div className="py-20 text-center">
                                <Users size={40} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 italic">Noch keine Kunden registriert.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'orders' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Shop Bestellungen ({shopOrders.length})</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest">
                                    <th className="py-4 px-4 font-bold">Bestellung</th>
                                    <th className="py-4 px-4 font-bold">Kunde</th>
                                    <th className="py-4 px-4 font-bold">Status</th>
                                    <th className="py-4 px-4 font-bold">Betrag</th>
                                    <th className="py-4 px-4 font-bold">Datum</th>
                                    <th className="py-4 px-4 font-bold">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {shopOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4 font-bold text-slate-800">
                                            #{order.order_number}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="text-sm font-medium text-slate-700">{order.customer_name}</div>
                                            <div className="text-xs text-slate-400">{order.customer_email}</div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <select 
                                                value={order.status} 
                                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                                className={`px-2 py-1 rounded text-[10px] font-black uppercase outline-none cursor-pointer border-transparent hover:border-slate-200 transition-all ${
                                                    order.status === 'active' ? 'bg-blue-50 text-blue-600' : 
                                                    order.status === 'shipped' ? 'bg-green-50 text-green-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                <option value="active">In Bearbeitung</option>
                                                <option value="shipped">Versendet</option>
                                                <option value="cancelled">Storniert</option>
                                            </select>
                                        </td>
                                        <td className="py-4 px-4 font-bold text-slate-800">
                                            {order.total_amount?.toFixed(2).replace('.', ',')} €
                                        </td>
                                        <td className="py-4 px-4 text-xs text-slate-500">
                                            {new Date(order.created_at).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    onClick={async () => {
                                                        const res = await fetch(`/api/shop-customers/${shopId}/orders/${order.shop_customer_id || 'guest'}/${order.id}`);
                                                        const data = await res.json();
                                                        if (data.success) setSelectedOrder(data.data);
                                                    }}
                                                    className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg text-sm font-bold"
                                                >
                                                    Details
                                                </button>
                                                {order.status !== 'cancelled' && (
                                                    <div className="flex items-center space-x-1">
                                                        <button 
                                                            onClick={() => handleCreateShippingLabel(order)}
                                                            disabled={isCreatingLabel}
                                                            className={`p-2 rounded-lg transition-all ${
                                                                order.tracking_number 
                                                                ? 'text-green-600 hover:bg-green-50' 
                                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                            title={order.tracking_number ? `Label erstellt: ${order.tracking_number}` : 'DHL Label erstellen'}
                                                        >
                                                            <Truck size={18} className={isCreatingLabel ? 'animate-pulse' : ''} />
                                                        </button>
                                                        {order.label_url && (
                                                            <a 
                                                                href={order.label_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Versandlabel öffnen"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {shopOrders.length === 0 && (
                            <div className="py-20 text-center text-slate-400 italic">
                                Keine Bestellungen vorhanden.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-black uppercase italic tracking-tighter text-xl">Bestellung #{selectedOrder.order_number}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {new Date(selectedOrder.created_at).toLocaleString('de-DE')}
                        </p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                        <div className="space-y-6">
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Kundeninformationen</h4>
                            <div className="space-y-2">
                                <p className="font-bold text-slate-800">{selectedOrder.customer_name}</p>
                                <p className="text-sm text-slate-600 flex items-center"><Mail size={14} className="mr-2 opacity-50" /> {selectedOrder.customer_email}</p>
                                {selectedOrder.customer_phone && <p className="text-sm text-slate-600 flex items-center"><Phone size={14} className="mr-2 opacity-50" /> {selectedOrder.customer_phone}</p>}
                                <p className="text-sm text-slate-600 flex items-start mt-4">
                                    <MapPin size={14} className="mr-2 mt-1 opacity-50" />
                                    <span className="whitespace-pre-line">{selectedOrder.customer_address}</span>
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Zahlung & Status</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500 font-medium">Zahlungsmethode:</span>
                                    <span className="font-bold text-slate-800">{selectedOrder.payment_method}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500 font-medium">Status:</span>
                                    <select 
                                        value={selectedOrder.status} 
                                        onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase outline-none cursor-pointer ${
                                            selectedOrder.status === 'active' ? 'bg-blue-100 text-blue-700' : 
                                            selectedOrder.status === 'shipped' ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}
                                    >
                                        <option value="active">In Bearbeitung</option>
                                        <option value="shipped">Versendet</option>
                                        <option value="cancelled">Storniert</option>
                                    </select>
                                </div>
                                {selectedOrder.tracking_number && (
                                    <div className="pt-4 border-t border-slate-50 space-y-3">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Versandinformationen</h5>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Sendungsnummer:</span>
                                            <span className="text-xs font-mono font-bold text-slate-700">{selectedOrder.tracking_number}</span>
                                        </div>
                                        {selectedOrder.label_url && (
                                            <a 
                                                href={selectedOrder.label_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="w-full flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                            >
                                                <ExternalLink size={14} className="mr-2" />
                                                Versandlabel (PDF) öffnen
                                            </a>
                                        )}
                                    </div>
                                )}
                                <div className="pt-4 border-t border-slate-50 space-y-2">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Zwischensumme:</span>
                                        <span>{(selectedOrder.total_amount - selectedOrder.shipping_costs).toFixed(2).replace('.', ',')} €</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Versandkosten:</span>
                                        <span>{selectedOrder.shipping_costs?.toFixed(2).replace('.', ',')} €</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-black text-slate-900 pt-2">
                                        <span>Gesamtsumme:</span>
                                        <span>{selectedOrder.total_amount?.toFixed(2).replace('.', ',')} €</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-6">Bestellte Artikel</h4>
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200/50">
                                    <th className="px-6 py-4">Artikel</th>
                                    <th className="px-6 py-4 text-center">Anzahl</th>
                                    <th className="px-6 py-4 text-right">Einzelpreis</th>
                                    <th className="px-6 py-4 text-right">Summe</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50">
                                {selectedOrder.items?.map((item: any) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{item.item_name}</div>
                                            <div className="flex gap-2 mt-1">
                                                {item.size && <span className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase text-slate-500">Größe: {item.size}</span>}
                                                {item.color && <span className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase text-slate-500">Farbe: {item.color}</span>}
                                            </div>
                                            {item.notes && <div className="text-[10px] text-blue-600 font-medium mt-1 italic">Personalisierung: {formatPersonalization(item.notes)}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-700">{item.quantity}</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{item.price?.toFixed(2).replace('.', ',')} €</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900">{(item.quantity * item.price).toFixed(2).replace('.', ',')} €</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="p-6 bg-slate-50 border-t flex justify-end">
                    <button onClick={() => setSelectedOrder(null)} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-700 transition-all">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Product Assign Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">Produkt hinzufügen</h3>
                    <button onClick={() => setShowProductModal(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="p-4 border-b bg-gray-50">
                    {/* Create New Button */}
                    <button 
                        onClick={() => {
                            setShowProductModal(false);
                            setIsCreateMode(true);
                            setEditorAssignment({}); // Empty object triggers create mode logic
                        }}
                        className="w-full bg-white border-2 border-dashed border-blue-300 text-blue-600 p-3 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors mb-4 font-bold"
                    >
                        <Plus size={20} className="mr-2" />
                        Neues manuelles Produkt erstellen
                    </button>

                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Vorhandenes Produkt suchen..."
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

      {/* Editor Modal */}
      {(editorAssignment || isCreateMode) && (
        <ProductEditorModal 
            isOpen={!!editorAssignment || isCreateMode}
            assignment={isCreateMode ? undefined : editorAssignment}
            shopId={shopId!}
            customerId={shop.customer_id} // Pass customer ID for manual product creation
            onClose={() => {
                setEditorAssignment(null);
                setIsCreateMode(false);
            }}
            onSave={handleUpdateProduct}
            onCreate={handleCreateProduct}
        />
      )}
    </div>
  );
};

export default ShopDashboard;

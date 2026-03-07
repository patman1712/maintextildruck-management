
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAppStore, Shop, Product, ShopCategory, ShopProductAssignment } from '../../../store';
import { ArrowLeft, ShoppingBag, Layers, Layout, Save, Plus, Trash2, ExternalLink, Image as ImageIcon, Search, CheckCircle, X, Edit2, Users, Mail, Phone, MapPin, Calendar, User, Building, Truck, Key, RefreshCw, Zap, FileText } from 'lucide-react';
import ProductEditorModal from './ProductEditorModal';

const ShopDashboard: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { shops, updateShop, products } = useAppStore();
  const [shop, setShop] = useState<Shop | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'design' | 'categories' | 'products' | 'customers' | 'orders' | 'shipping' | 'legal'>('general');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [shopProducts, setShopProducts] = useState<(ShopProductAssignment & { product_name?: string, product_number?: string, category_name?: string })[]>([]);
  const [shopCustomers, setShopCustomers] = useState<any[]>([]);
  const [shopOrders, setShopOrders] = useState<any[]>([]);
  const [shippingConfig, setShippingConfig] = useState<any>({
    dhl_user: '',
    dhl_signature: '',
    dhl_ekp: '',
    dhl_api_key: '',
    dhl_sandbox: false,
    dhl_participation: '01',
    sender_name: '',
    sender_street: '',
    sender_house_number: '',
    sender_zip: '',
    sender_city: '',
    sender_country: 'DEU',
    packaging_weight: 0
  });
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [personalizationOptions, setPersonalizationOptions] = useState<any[]>([]);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  // Forms
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', parent_id: '', image_url: '' });
  const [assignProductSearch, setAssignProductSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [manualWeight, setManualWeight] = useState(0);
  const [pendingLabelOrder, setPendingLabelOrder] = useState<any | null>(null);
  
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
      fetchShippingConfig();
    }
  }, [shopId, shops]);

  const fetchShippingConfig = async () => {
    try {
      const res = await fetch(`/api/shop-management/${shopId}/shipping-config`);
      const data = await res.json();
      if (data.success && data.data) {
        setShippingConfig({
            ...shippingConfig,
            ...data.data
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveShippingConfig = async () => {
    if (!shop) return;
    try {
      const res = await fetch(`/api/shop-management/${shopId}/shipping-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shippingConfig)
      });
      const data = await res.json();
      if (data.success) {
        alert('Versandkonfiguration gespeichert!');
      } else {
        alert('Fehler beim Speichern: ' + data.error);
      }
    } catch (e) { console.error(e); }
  };

  const handleTestDHLConnection = async () => {
    setIsTestingConnection(true);
    try {
        const res = await fetch('/api/shop-management/shipping/test-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shippingConfig)
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
        } else {
            alert('Fehler: ' + data.error);
        }
    } catch (e: any) {
        alert('Verbindung fehlgeschlagen: ' + e.message);
    } finally {
        setIsTestingConnection(false);
    }
  };

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
            parent_id: newCategory.parent_id || null,
            image_url: newCategory.image_url || null
        })
      });
      const data = await res.json();
      if (data.success) {
          setCategories([...categories, data.data]);
          setNewCategory({ name: '', slug: '', parent_id: '', image_url: '' });
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
            is_active: payload.is_active, // Include is_active in payload
            supplier_id: payload.supplier_id, // Include supplier_id
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

  const handleUpdateOrderPaymentStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setShopOrders(shopOrders.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder({ ...selectedOrder, payment_status: newStatus });
        }
      } else {
        alert(data.error || 'Fehler beim Aktualisieren des Zahlstatus.');
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Bestellung wirklich löschen? Diese Aktion entfernt die Bestellung auch aus der Kundenansicht und kann nicht rückgängig gemacht werden.')) return;
    try {
      const res = await fetch(`/api/shop-customers/${shopId}/admin/orders/${orderId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setShopOrders(shopOrders.filter(o => o.id !== orderId));
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder(null);
        }
      } else {
        alert(data.error || 'Fehler beim Löschen der Bestellung.');
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateShippingLabel = async (order: any) => {
    // 1. Calculate default weight on client side if possible
    let defaultWeight = 0.5;

    // We need to fetch order details (items) if they are not present in the order object
    // The order object from the list might not have items
    try {
        const res = await fetch(`/api/shop-customers/${shopId}/orders/${order.shop_customer_id || 'guest'}/${order.id}`);
        const data = await res.json();
        
        if (data.success && data.data && data.data.items) {
             const items = data.data.items;
             let totalItemWeight = 0;
             
             // Calculate weight based on items
             for (const item of items) {
                 // Try to find matching shop product in current shopProducts state
                 const shopProduct = shopProducts.find(sp => {
                     // Check by SKU if available
                     if (item.item_number && sp.product_number === item.item_number) return true;
                     // Check by Name (fuzzy)
                     if (sp.product_name && item.item_name && sp.product_name.toLowerCase().trim() === item.item_name.toLowerCase().trim()) return true;
                     return false;
                 });
                 
                 if (shopProduct && shopProduct.weight > 0) {
                     totalItemWeight += (shopProduct.weight * item.quantity);
                 } else {
                     console.warn(`Product weight not found for item: ${item.item_name}`);
                 }
             }
             
             if (totalItemWeight > 0) {
                 // Add packaging weight
                 const pkgWeight = parseFloat(String(shippingConfig.packaging_weight || 0));
                 defaultWeight = totalItemWeight + pkgWeight;
                 console.log(`Calculated weight: Items (${totalItemWeight}) + Pkg (${pkgWeight}) = ${defaultWeight}`);
             }
        }
    } catch (e) {
        console.error("Could not calculate default weight", e);
    }

    // Use a simpler prompt for now, as custom styling requires a proper Modal component.
    // However, the user asked for custom CSS/design for the prompt.
    // Browser 'prompt' cannot be styled.
    // I need to replace 'prompt' with a custom state-driven Modal.
    setShowWeightModal(true);
    setPendingLabelOrder(order);
    setManualWeight(defaultWeight);
  };

  const handleConfirmWeight = async () => {
    if (!pendingLabelOrder) return;
    
    setShowWeightModal(false);
    setIsCreatingLabel(true);
    try {
      const res = await fetch(`/api/shop-management/${shopId}/shipping/create-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            orderId: pendingLabelOrder.id,
            manualWeight: manualWeight // Send manual weight
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('DHL Label erfolgreich erstellt!');
        fetchShopOrders();
        if (selectedOrder?.id === pendingLabelOrder.id) {
          setSelectedOrder({ ...selectedOrder, tracking_number: data.trackingNumber, label_url: data.labelUrl, status: 'shipped' });
        }
      } else {
        // Check for specific error about missing API key
        if (data.error && data.error.includes('API-Key')) {
             if (confirm(`${data.error}\n\nMöchten Sie jetzt die Shop-Einstellungen öffnen, um den API-Key zu hinterlegen?`)) {
                 setActiveTab('shipping'); // Switch to shipping tab
                 // Scroll to top
                 window.scrollTo(0, 0);
             }
        } else if (data.labelUrl) {
            if (confirm(`${data.error}\n\nMöchten Sie das Fehler-Protokoll (PDF) öffnen?`)) {
                window.open(data.labelUrl, '_blank');
            }
        } else {
            alert('Fehler beim Erstellen des DHL Labels: ' + data.error);
        }
      }
    } catch (e: any) { 
      console.error(e);
      alert('Ein technischer Fehler ist aufgetreten: ' + e.message);
    } finally {
      setIsCreatingLabel(false);
      setPendingLabelOrder(null);
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
            <button 
                onClick={() => setActiveTab('shipping')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'shipping' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Truck size={16} className="mr-2" /> Versand
            </button>
            <button 
                onClick={() => setActiveTab('legal')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'legal' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <FileText size={16} className="mr-2" /> Rechtliches
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

                    <div className="pt-6 border-t border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-4">Bestellnummern & Rechnungen</h4>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nummernkreis Format
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-sm"
                                    value={shop.order_number_circle || ''}
                                    onChange={(e) => setShop({ ...shop, order_number_circle: e.target.value })}
                                    placeholder="{YEAR}-{NR}"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Platzhalter: <code className="bg-slate-100 px-1 rounded">{'{YEAR}'}</code> (Jahr), <code className="bg-slate-100 px-1 rounded">{'{NR}'}</code> (Laufende Nummer)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nächste Nummer
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shop.next_order_number || 1}
                                    onChange={(e) => setShop({ ...shop, next_order_number: parseInt(e.target.value) || 1 })}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Wird nach jeder Bestellung automatisch erhöht.
                                </p>
                            </div>
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
                        <div className="flex items-center space-x-2 mb-2">
                            <input 
                                type="text" 
                                className="flex-1 border border-slate-300 rounded-lg p-2"
                                value={shop.logo_url || ''}
                                onChange={(e) => setShop({ ...shop, logo_url: e.target.value })}
                                placeholder="https://..."
                            />
                            {shop.logo_url && (
                                <button 
                                    onClick={() => setShop({ ...shop, logo_url: '' })}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                    title="Logo entfernen"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        
                        {shop.logo_url ? (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex justify-center relative group">
                                <img src={shop.logo_url} alt="Logo Preview" className="h-16 object-contain" />
                            </div>
                        ) : (
                             <div className="mt-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Oder Logo hochladen</label>
                                <div className="flex items-center space-x-2">
                                    <label className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center">
                                        <ImageIcon size={16} className="mr-2" />
                                        Datei auswählen...
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                
                                                const formData = new FormData();
                                                formData.append('preview', file); // Use 'preview' field for general images
                                                
                                                try {
                                                    const res = await fetch('/api/upload', {
                                                        method: 'POST',
                                                        body: formData
                                                    });
                                                    const data = await res.json();
                                                    if (data.success && data.files && data.files.preview && data.files.preview.length > 0) {
                                                        const uploadedFile = data.files.preview[0];
                                                        // Use thumbnail if available (e.g. for PDFs), otherwise path
                                                        const logoUrl = uploadedFile.thumbnail || uploadedFile.path;
                                                        setShop({ ...shop, logo_url: logoUrl });
                                                    } else {
                                                        alert('Fehler beim Hochladen.');
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('Fehler beim Hochladen.');
                                                }
                                            }}
                                        />
                                    </label>
                                    <span className="text-xs text-slate-500">PNG, JPG, SVG (max. 2MB)</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-6 border-t border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Willkommenstext (Startseite)</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-2 min-h-[100px]"
                            value={shop.welcome_text || ''}
                            onChange={(e) => setShop({ ...shop, welcome_text: e.target.value })}
                            placeholder="Ein kurzer Text, der unter dem Slider angezeigt wird..."
                        />
                    </div>

                    <div className="pt-6 border-t border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Hero Bilder (Slider)</label>
                        <p className="text-xs text-slate-500 mb-4">Laden Sie hier Bilder für den Slider auf der Startseite hoch. Drag & Drop zum Sortieren (bald verfügbar).</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {shop.hero_images && shop.hero_images.map((img, idx) => (
                                <div key={idx} className="relative group aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={img} alt={`Hero ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => {
                                            const newImages = [...(shop.hero_images || [])];
                                            newImages.splice(idx, 1);
                                            setShop({ ...shop, hero_images: newImages });
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            
                            <label className="border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-all aspect-video">
                                <Plus size={24} className="text-slate-400 mb-2" />
                                <span className="text-xs text-slate-500 font-medium">Bild hinzufügen</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    multiple
                                    onChange={async (e) => {
                                        if (!e.target.files || e.target.files.length === 0) return;
                                        
                                        const formData = new FormData();
                                        Array.from(e.target.files).forEach(file => {
                                            formData.append('preview', file);
                                        });
                                        
                                        try {
                                            const res = await fetch('/api/upload', {
                                                method: 'POST',
                                                body: formData
                                            });
                                            const data = await res.json();
                                            if (data.success && data.files && data.files.preview) {
                                                const newUrls = data.files.preview.map((f: any) => f.path); // Use full path, not thumbnail
                                                setShop({ 
                                                    ...shop, 
                                                    hero_images: [...(Array.isArray(shop.hero_images) ? shop.hero_images : []), ...newUrls] 
                                                });
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Fehler beim Hochladen.');
                                        }
                                    }}
                                />
                            </label>
                        </div>
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
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border border-slate-300 rounded-lg p-2 text-sm text-slate-600"
                                    value={newCategory.parent_id}
                                    onChange={(e) => setNewCategory({ ...newCategory, parent_id: e.target.value })}
                                >
                                    <option value="">Keine Überkategorie (Hauptkategorie)</option>
                                    {categories.filter(c => !c.parent_id).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <label className="flex-1 cursor-pointer border border-slate-300 rounded-lg p-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center truncate relative">
                                    {newCategory.image_url ? (
                                        <>
                                            <ImageIcon size={14} className="mr-2 text-green-500" />
                                            <span className="truncate max-w-[100px]">Bild ausgewählt</span>
                                            <button 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setNewCategory({ ...newCategory, image_url: '' });
                                                }}
                                                className="absolute right-1 top-1.5 p-0.5 bg-white rounded-full text-red-500 shadow-sm"
                                            >
                                                <X size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon size={14} className="mr-2" /> Bild (optional)
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const formData = new FormData();
                                            formData.append('preview', file);
                                            try {
                                                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                                const data = await res.json();
                                                if (data.success && data.files?.preview?.[0]) {
                                                    const url = data.files.preview[0].thumbnail || data.files.preview[0].path;
                                                    setNewCategory({ ...newCategory, image_url: url });
                                                }
                                            } catch (err) { console.error(err); }
                                        }}
                                    />
                                </label>
                            </div>
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
                                                <div className="flex items-center gap-2">
                                                    {sub.image_url ? (
                                                        <img src={sub.image_url} alt="" className="w-8 h-8 rounded object-cover border border-slate-100" />
                                                    ) : <div className="w-8 h-8 bg-slate-50 rounded border border-slate-100" />}
                                                    <span className="font-medium text-slate-600">{sub.name}</span>
                                                </div>
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
                                        <h4 className={`font-bold ${(sp.is_active === false || sp.is_active === 0) ? 'text-slate-400' : 'text-slate-800'}`}>
                                            {sp.product_name}
                                            {(sp.is_active === false || sp.is_active === 0) && (
                                                <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                                    Inaktiv
                                                </span>
                                            )}
                                        </h4>
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
                                    <th className="py-4 px-4 font-bold">Nr.</th>
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
                                            <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                {customer.customer_number || '-'}
                                            </span>
                                        </td>
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
                                    <th className="py-4 px-4 font-bold">Zahlstatus</th>
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
                                                    order.status === 'pending_payment' ? 'bg-yellow-50 text-yellow-600' :
                                                    order.status === 'shipped' ? 'bg-green-50 text-green-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                <option value="active">In Bearbeitung</option>
                                                <option value="pending_payment">Zahlung ausstehend</option>
                                                <option value="shipped">Versendet</option>
                                                <option value="cancelled">Storniert</option>
                                            </select>
                                        </td>
                                        <td className="py-4 px-4">
                                            <select 
                                                value={order.payment_status === 'pending' ? 'open' : (order.payment_status || 'open')} 
                                                onChange={(e) => handleUpdateOrderPaymentStatus(order.id, e.target.value)}
                                                className={`px-2 py-1 rounded text-[10px] font-black uppercase outline-none cursor-pointer border-transparent hover:border-slate-200 transition-all ${
                                                    order.payment_status === 'paid' ? 'bg-green-50 text-green-600' : 
                                                    'bg-yellow-50 text-yellow-600'
                                                }`}
                                            >
                                                <option value="open">Offen</option>
                                                <option value="paid">Komplett bezahlt</option>
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
                                                <button 
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    title="Bestellung löschen"
                                                >
                                                    <Trash2 size={18} />
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
                                                                className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-[10px] font-bold"
                                                                title="Versandlabel öffnen"
                                                            >
                                                                <Truck size={12} />
                                                                <span>LABEL</span>
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

            {activeTab === 'shipping' && (
                <div className="max-w-4xl space-y-8">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">DHL Versandkonfiguration</h3>
                            <p className="text-sm text-slate-500">Hier können Sie die DHL Zugangsdaten für diesen Shop hinterlegen.</p>
                        </div>
                        <div className="flex space-x-2">
                            <button 
                                onClick={handleTestDHLConnection}
                                disabled={isTestingConnection}
                                className={`text-sm px-4 py-2 rounded-lg flex items-center border transition-all ${
                                    isTestingConnection 
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                    : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                                }`}
                            >
                                {isTestingConnection ? (
                                    <>
                                        <RefreshCw size={16} className="mr-2 animate-spin" />
                                        Testet...
                                    </>
                                ) : (
                                    <>
                                        <Zap size={16} className="mr-2" /> Verbindung testen
                                    </>
                                )}
                            </button>
                            <button onClick={handleSaveShippingConfig} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center font-bold text-sm">
                                <Save size={16} className="mr-2" />
                                Speichern
                            </button>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                            <Key className="text-yellow-600 mr-3 mt-1" size={20} />
                            <div>
                                <h4 className="font-bold text-yellow-800 text-sm">Neue Authentifizierungsmethode</h4>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Für die Erstellung von Versandlabels wird jetzt der <strong>API-Key</strong> benötigt (DHL REST API v2). 
                                    Bitte generieren Sie diesen im DHL Geschäftskundenportal unter "Integration" oder "Entwickler".
                                    <br />
                                    Benutzername und Signatur werden weiterhin für Legacy-Funktionen benötigt.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700 uppercase tracking-widest text-xs border-b pb-2">DHL Zugangsdaten</h4>
                            
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col mb-4">
                                <div className="flex items-center mb-2">
                                    <input 
                                        type="checkbox" 
                                        id="dhl_sandbox"
                                        className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        checked={!!shippingConfig.dhl_sandbox}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_sandbox: e.target.checked })}
                                    />
                                    <label htmlFor="dhl_sandbox" className="ml-3 block text-sm font-bold text-slate-700">
                                        Sandbox-Modus aktivieren (Testumgebung)
                                    </label>
                                </div>
                                {shippingConfig.dhl_sandbox && (
                                    <button 
                                        onClick={() => setShippingConfig({
                                            ...shippingConfig,
                                            dhl_user: '2222222222_01',
                                            dhl_signature: 'pass',
                                            dhl_ekp: '2222222222'
                                        })}
                                        className="text-xs text-blue-600 hover:text-blue-800 underline self-start ml-7"
                                    >
                                        Standard DHL Test-Daten laden
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">DHL Benutzername (Geschäftskundenportal)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shippingConfig.dhl_user || ''}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_user: e.target.value })}
                                    placeholder="z.B. ihr_benutzername"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">DHL Signatur / Passwort</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shippingConfig.dhl_signature || ''}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_signature: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">DHL EKP (Abrechnungsnummer)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shippingConfig.dhl_ekp || ''}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_ekp: e.target.value })}
                                    placeholder="z.B. 6374664203"
                                    maxLength={10}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-blue-700 mb-1">DHL API-Key (REST API v2) *WICHTIG*</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-blue-200 bg-blue-50 rounded-lg p-2 font-mono text-sm"
                                    value={shippingConfig.dhl_api_key || ''}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_api_key: e.target.value })}
                                    placeholder="Ihr generierter API-Key"
                                />
                                <p className="text-xs text-slate-500 mt-1">Dieser Key ist zwingend erforderlich für die neue Schnittstelle.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teilnahme (01)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.dhl_participation || '01'}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, dhl_participation: e.target.value })}
                                        maxLength={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Verpackungsgewicht (kg)</label>
                                    <input 
                                        type="number" 
                                        step="0.001"
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.packaging_weight || 0}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, packaging_weight: parseFloat(e.target.value) })}
                                        placeholder="0.000"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700 uppercase tracking-widest text-xs border-b pb-2">Absenderadresse (Label)</h4>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Firma / Name</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shippingConfig.sender_name || ''}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, sender_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Straße</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.sender_street || ''}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, sender_street: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nr.</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.sender_house_number || ''}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, sender_house_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">PLZ</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.sender_zip || ''}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, sender_zip: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stadt</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2"
                                        value={shippingConfig.sender_city || ''}
                                        onChange={(e) => setShippingConfig({ ...shippingConfig, sender_city: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Land (ISO 3)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2"
                                    value={shippingConfig.sender_country || 'DEU'}
                                    onChange={(e) => setShippingConfig({ ...shippingConfig, sender_country: e.target.value })}
                                    maxLength={3}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'legal' && (
                <div className="max-w-4xl space-y-8">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 mb-2">Rechtstexte & Seiten</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Hier können Sie die Inhalte für die rechtlichen Seiten dieses Shops bearbeiten. 
                            Wenn Sie Felder leer lassen, werden die globalen Standardtexte verwendet.
                        </p>
                    </div>

                    <div className="space-y-8">
                        {([
                            { key: 'about_us_text', label: 'Über uns' },
                            { key: 'impressum_text', label: 'Impressum' },
                            { key: 'privacy_text', label: 'Datenschutz' },
                            { key: 'agb_text', label: 'AGB' },
                            { key: 'revocation_text', label: 'Widerrufsrecht' },
                            { key: 'shipping_info_text', label: 'Versand- und Zahlungsbedingungen' },
                            { key: 'contact_text', label: 'Kontakt (Text auf Seite)' },
                        ] as const).map(page => (
                            <div key={page.key} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block font-bold text-slate-700">{page.label}</label>
                                    <span className="text-xs text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">HTML Editor</span>
                                </div>
                                <div className="bg-white rounded overflow-hidden border border-slate-300">
                                    <ReactQuill 
                                        theme="snow"
                                        value={(shop as any)[page.key] || ''}
                                        onChange={(content) => setShop({ ...shop!, [page.key]: content })}
                                        placeholder={`Inhalt für ${page.label}...`}
                                        modules={{
                                            toolbar: [
                                                [{ 'header': [1, 2, 3, false] }],
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{'list': 'ordered'}, {'list': 'bullet'}],
                                                ['link', 'clean']
                                            ],
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Lassen Sie dieses Feld leer, um den globalen Standardtext zu verwenden.
                                </p>
                            </div>
                        ))}
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
                                    <span className="text-sm text-slate-500 font-medium">Zahlstatus:</span>
                                    <select 
                                        value={selectedOrder.payment_status === 'pending' ? 'open' : (selectedOrder.payment_status || 'open')} 
                                        onChange={(e) => handleUpdateOrderPaymentStatus(selectedOrder.id, e.target.value)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase outline-none cursor-pointer ${
                                            selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                                            'bg-yellow-100 text-yellow-700'
                                        }`}
                                    >
                                        <option value="open">Offen</option>
                                        <option value="paid">Komplett bezahlt</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500 font-medium">Status:</span>
                                    <select 
                                        value={selectedOrder.status} 
                                        onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase outline-none cursor-pointer ${
                                            selectedOrder.status === 'active' ? 'bg-blue-100 text-blue-700' : 
                                            selectedOrder.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' :
                                            selectedOrder.status === 'shipped' ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}
                                    >
                                        <option value="active">In Bearbeitung</option>
                                        <option value="pending_payment">Zahlung ausstehend</option>
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
                                            <div className="flex space-x-2">
                                                <a 
                                                    href={selectedOrder.label_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                                >
                                                    <Truck size={14} className="mr-2" />
                                                    Versandlabel (PDF)
                                                </a>
                                                <a 
                                                    href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${selectedOrder.tracking_number}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 flex items-center justify-center px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors border border-slate-200"
                                                >
                                                    <ExternalLink size={14} className="mr-2" />
                                                    Verfolgen
                                                </a>
                                            </div>
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

      {/* Weight Confirmation Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="bg-slate-800 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center">
                        <Truck size={20} className="mr-2" /> 
                        DHL Label erstellen
                    </h3>
                    <button onClick={() => setShowWeightModal(false)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-800 font-medium mb-1">Automatische Berechnung:</p>
                        <p className="text-xs text-blue-600">
                            Das System hat basierend auf den Artikeln und der Verpackung ein Gewicht von 
                            <span className="font-bold text-blue-900 mx-1 text-base">{manualWeight.toFixed(3)} kg</span>
                            ermittelt.
                        </p>
                    </div>

                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Tatsächliches Versandgewicht (kg)
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.001"
                            className="w-full border-2 border-slate-200 rounded-lg p-3 text-lg font-bold text-slate-800 focus:border-slate-800 focus:outline-none transition-colors"
                            value={manualWeight}
                            onChange={(e) => setManualWeight(parseFloat(e.target.value))}
                        />
                        <span className="absolute right-4 top-3.5 text-slate-400 font-bold">kg</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        Bitte korrigieren Sie den Wert, falls er von der Realität abweicht. Dieses Gewicht wird final an DHL übermittelt.
                    </p>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                    <button 
                        onClick={() => setShowWeightModal(false)}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm"
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={handleConfirmWeight}
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200 text-sm flex items-center"
                    >
                        <Truck size={16} className="mr-2" />
                        Label jetzt kaufen
                    </button>
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

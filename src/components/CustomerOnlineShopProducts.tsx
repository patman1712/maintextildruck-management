import React, { useState, useEffect } from 'react';
import { ShoppingBag, Edit2, Trash2, Plus, Search, ImageIcon, X, ExternalLink } from 'lucide-react';
import { ShopProductAssignment, Product, ShopCategory } from '@/store';
import ProductEditorModal from '../pages/OnlineShops/Management/ProductEditorModal';

interface CustomerOnlineShopProductsProps {
    shopId: string;
    products: Product[]; // Pass all available products for assignment
}

const CustomerOnlineShopProducts: React.FC<CustomerOnlineShopProductsProps> = ({ shopId, products }) => {
    const [shopProducts, setShopProducts] = useState<(ShopProductAssignment & { product_name?: string, product_number?: string, category_name?: string })[]>([]);
    const [categories, setCategories] = useState<ShopCategory[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Editor Modal State
    const [editorAssignment, setEditorAssignment] = useState<any | null>(null);
    
    // Add Product Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addProductSearch, setAddProductSearch] = useState('');

    useEffect(() => {
        if (shopId) {
            fetchShopProducts();
            fetchCategories();
        }
    }, [shopId]);

    const fetchShopProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/shop-management/${shopId}/products`);
            const data = await res.json();
            if (data.success) {
                setShopProducts(data.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch(`/api/shop-management/${shopId}/categories`);
            const data = await res.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (e) {
            console.error(e);
        }
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
                    manufacturer_info: updates.manufacturer_info,
                    description: updates.description,
                    size: updates.size,
                    color: updates.color,
                    variants: updates.variants !== undefined ? updates.variants : payload.variants,
                    personalization_options: updates.personalization_options !== undefined ? updates.personalization_options : payload.personalization_options
                })
            });
            
            setShopProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
            
            // If modal open, close it if save was from modal (usually modal handles close itself via onClose, but here just update state)
            // Actually ProductEditorModal calls onSave then we update state.
        } catch (e) {
            console.error(e);
            alert('Fehler beim Aktualisieren');
        }
    };

    const handleRemoveProduct = async (id: string) => {
        if (!confirm('Möchten Sie dieses Produkt wirklich aus dem Shop entfernen?')) return;
        try {
            await fetch(`/api/shop-management/${shopId}/products/${id}`, { method: 'DELETE' });
            setShopProducts(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error(e);
            alert('Fehler beim Entfernen');
        }
    };

    const handleAssignProduct = async (product: Product) => {
        try {
            const res = await fetch(`/api/shop-management/${shopId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: product.id,
                    category_id: null,
                    price: 0, 
                    is_featured: false
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchShopProducts();
                // Optional: Close modal or keep open
            } else {
                alert(data.error || 'Fehler beim Hinzufügen');
            }
        } catch (e) {
            console.error(e);
            alert('Netzwerkfehler');
        }
    };

    // Filter available products for adding
    const availableProducts = products
        .filter(p => !shopProducts.some(sp => sp.product_id === p.id))
        .filter(p => p.name.toLowerCase().includes(addProductSearch.toLowerCase()));

    return (
        <div className="p-8 animate-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-bold text-gray-800">Online Shop Produkte ({shopProducts.length})</h3>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Suchen..." 
                            className="pl-9 border border-gray-300 rounded-md py-1.5 text-sm w-64"
                            // Filter visible list logic could be added here
                        />
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setShowAddModal(true);
                        setAddProductSearch('');
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center"
                >
                    <Plus size={16} className="mr-2" />
                    Produkt hinzufügen
                </button>
            </div>

            <div className="space-y-4">
                {shopProducts.map(sp => (
                    <div key={sp.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden border border-gray-200">
                                {/* Try to find image from products list if available, or use placeholder */}
                                {(() => {
                                    const product = products.find(p => p.id === sp.product_id);
                                    const image = product?.files?.find(f => f.thumbnail_url || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i));
                                    
                                    if (image) {
                                        return <img src={image.thumbnail_url || image.file_url} className="w-full h-full object-contain bg-white" alt={sp.product_name} />;
                                    }
                                    return <ImageIcon size={20} className="text-gray-400" />;
                                })()}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">{sp.product_name}</h4>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs text-gray-500">{sp.product_number}</span>
                                    {sp.category_name && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {sp.category_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center border border-gray-300 rounded px-2 py-1 bg-white w-24">
                                <span className="text-gray-400 text-sm mr-1">€</span>
                                <input 
                                    type="number" 
                                    className="w-full text-sm outline-none"
                                    value={sp.price || ''}
                                    placeholder="0.00"
                                    onChange={(e) => handleUpdateProduct(sp.id, { price: parseFloat(e.target.value) })}
                                />
                            </div>

                            <select 
                                className="border border-gray-300 rounded p-1 text-sm max-w-[150px]"
                                value={sp.category_id || ''}
                                onChange={(e) => handleUpdateProduct(sp.id, { category_id: e.target.value || null })}
                            >
                                <option value="">Keine Kategorie</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            <div className="flex space-x-2">
                                <button 
                                    onClick={() => setEditorAssignment(sp)}
                                    className="text-gray-400 hover:text-blue-600 p-1"
                                    title="Bearbeiten"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button 
                                    onClick={() => handleRemoveProduct(sp.id)}
                                    className="text-gray-400 hover:text-red-600 p-1"
                                    title="Entfernen"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {shopProducts.length === 0 && (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                        <p>Keine Produkte im Online Shop.</p>
                        <button 
                            onClick={() => {
                                setShowAddModal(true);
                                setAddProductSearch('');
                            }}
                            className="mt-4 text-blue-600 hover:underline"
                        >
                            Jetzt Produkte hinzufügen
                        </button>
                    </div>
                )}
            </div>

            {/* Add Product Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">Produkt zum Shop hinzufügen</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Produkt suchen..."
                                    className="w-full pl-10 border border-gray-300 rounded-lg p-2"
                                    value={addProductSearch}
                                    onChange={(e) => setAddProductSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {availableProducts.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden border border-gray-200">
                                            {p.files && p.files[0] && (p.files[0].thumbnail_url || p.files[0].file_url) ? (
                                                <img src={p.files[0].thumbnail_url || p.files[0].file_url} className="h-full w-full object-contain" />
                                            ) : <ImageIcon size={16} className="text-gray-400" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-800">{p.name}</p>
                                            <p className="text-xs text-gray-500">{p.product_number}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleAssignProduct(p)}
                                        className="text-green-600 hover:bg-green-50 p-2 rounded-full"
                                        title="Hinzufügen"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            ))}
                            {availableProducts.length === 0 && (
                                <p className="text-center text-gray-500 py-4">Keine passenden Produkte gefunden.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {editorAssignment && (
                <ProductEditorModal 
                    isOpen={!!editorAssignment}
                    assignment={editorAssignment}
                    shopId={shopId}
                    onClose={() => setEditorAssignment(null)}
                    onSave={handleUpdateProduct}
                />
            )}
        </div>
    );
};

export default CustomerOnlineShopProducts;

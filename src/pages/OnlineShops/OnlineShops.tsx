
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ShoppingBag, Plus, Edit, Trash2, ExternalLink, Palette, Truck, CreditCard } from 'lucide-react';

const OnlineShops: React.FC = () => {
  const { shops, customers, addShop, updateShop, deleteShop } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    domain_slug: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    template: 'standard'
  });

  const handleAdd = () => {
    setEditingShop(null);
    setFormData({
      customer_id: '',
      name: '',
      domain_slug: '',
      primary_color: '#000000',
      secondary_color: '#ffffff',
      template: 'standard'
    });
    setShowModal(true);
  };

  const handleEdit = (shop: any) => {
    setEditingShop(shop);
    setFormData({
      customer_id: shop.customer_id,
      name: shop.name,
      domain_slug: shop.domain_slug,
      primary_color: shop.primary_color,
      secondary_color: shop.secondary_color,
      template: shop.template
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShop) {
      await updateShop(editingShop.id, formData);
    } else {
      await addShop(formData);
    }
    setShowModal(false);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <ShoppingBag className="mr-2 text-red-600" />
            Online-Shops Verwaltung
          </h1>
          <p className="text-slate-500">Erstellen und verwalten Sie individuelle Kunden-Shops</p>
        </div>
        <button 
          onClick={handleAdd}
          className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Neuer Shop
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map(shop => {
          const customer = customers.find(c => c.id === shop.customer_id);
          return (
            <div key={shop.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    {shop.logo_url ? <img src={shop.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <ShoppingBag size={24} />}
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(shop)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => deleteShop(shop.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800">{shop.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{customer?.name || 'Unbekannter Kunde'}</p>
                
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center text-xs text-slate-400">
                    <div className="h-3 w-3 rounded-full mr-1" style={{ backgroundColor: shop.primary_color }} />
                    Primär
                  </div>
                  <div className="flex items-center text-xs text-slate-400">
                    <div className="h-3 w-3 rounded-full mr-1 border border-slate-200" style={{ backgroundColor: shop.secondary_color }} />
                    Sekundär
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={`/shop/${shop.domain_slug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors"
                  >
                    <ExternalLink size={14} className="mr-2" />
                    Frontend
                  </a>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <Palette size={14} className="mr-2" />
                    Design
                  </button>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <Truck size={14} className="mr-2" />
                    DHL
                  </button>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <CreditCard size={14} className="mr-2" />
                    PayPal
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingShop ? 'Shop bearbeiten' : 'Neuer Online-Shop'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kunde</label>
                <select 
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                  value={formData.customer_id}
                  onChange={e => setFormData({...formData, customer_id: e.target.value})}
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Domain Slug (URL)</label>
                <div className="flex">
                  <span className="bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg p-2 text-slate-500 text-sm">/shop/</span>
                  <input 
                    type="text" 
                    required
                    className="flex-1 border border-slate-300 rounded-r-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                    value={formData.domain_slug}
                    onChange={e => setFormData({...formData, domain_slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe</label>
                  <input 
                    type="color" 
                    className="w-full h-10 border border-slate-300 rounded-lg p-1"
                    value={formData.primary_color}
                    onChange={e => setFormData({...formData, primary_color: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sekundärfarbe</label>
                  <input 
                    type="color" 
                    className="w-full h-10 border border-slate-300 rounded-lg p-1"
                    value={formData.secondary_color}
                    onChange={e => setFormData({...formData, secondary_color: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineShops;

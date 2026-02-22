import { useState } from 'react';
import { useAppStore, Supplier } from '@/store';
import { Plus, Edit, Trash2, Globe, Hash, FileText, ShoppingCart, Truck } from 'lucide-react';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('suppliers');
  
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <ShoppingCart className="mr-2 text-red-600" />
        Warenbestellung & Lager
      </h1>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'suppliers' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lieferanten / Shops
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'orders' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bestellungen
        </button>
      </div>

      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'orders' && <OrdersTab />}
    </div>
  );
}

function SuppliersTab() {
  const suppliers = useAppStore((state) => state.suppliers);
  const addSupplier = useAppStore((state) => state.addSupplier);
  const updateSupplier = useAppStore((state) => state.updateSupplier);
  const deleteSupplier = useAppStore((state) => state.deleteSupplier);

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName('');
    setWebsite('');
    setCustomerNumber('');
    setNotes('');
    setEditingSupplier(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setWebsite(supplier.website || '');
    setCustomerNumber(supplier.customerNumber || '');
    setNotes(supplier.notes || '');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Lieferant wirklich löschen?')) {
      await deleteSupplier(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, {
        name,
        website,
        customerNumber,
        notes
      });
    } else {
      await addSupplier({
        id: Math.random().toString(36).substr(2, 9),
        name,
        website,
        customerNumber,
        notes
      });
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Lieferanten verwalten</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700 transition-colors text-sm"
        >
          <Plus size={18} className="mr-2" />
          Neuer Lieferant
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-gray-800 text-lg">{supplier.name}</h3>
              <div className="flex space-x-1">
                <button onClick={() => handleEdit(supplier)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(supplier.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              {supplier.website && (
                <div className="flex items-center">
                  <Globe size={14} className="mr-2 text-gray-400" />
                  <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                    {supplier.website}
                  </a>
                </div>
              )}
              {supplier.customerNumber && (
                <div className="flex items-center">
                  <Hash size={14} className="mr-2 text-gray-400" />
                  <span>Kunden-Nr: {supplier.customerNumber}</span>
                </div>
              )}
              {supplier.notes && (
                <div className="flex items-start mt-2 bg-gray-50 p-2 rounded text-xs italic">
                  <FileText size={12} className="mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                  <p>{supplier.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {suppliers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Truck size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Noch keine Lieferanten angelegt.</p>
            <button 
                onClick={() => { resetForm(); setShowModal(true); }}
                className="mt-2 text-red-600 hover:text-red-800 underline"
            >
                Jetzt ersten Lieferanten hinzufügen
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingSupplier ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name des Shops / Lieferanten</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="z.B. TextilGroßhandel24"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Webseite (Shop-Link)</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unsere Kundennummer</label>
                  <input
                    type="text"
                    value={customerNumber}
                    onChange={(e) => setCustomerNumber(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notizen</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Zugangsdaten, Ansprechpartner, Mindestbestellwert..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
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
}

function OrdersTab() {
  return (
    <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
      <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
      <h3 className="text-lg font-medium text-gray-900">Bestellübersicht</h3>
      <p className="text-gray-500 mt-1">Hier können später Bestellungen bei den Lieferanten verwaltet werden.</p>
    </div>
  );
}
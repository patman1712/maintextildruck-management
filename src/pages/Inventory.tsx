import { useState, useMemo } from 'react';
import { useAppStore, Supplier, OrderItem } from '@/store';
import { Plus, Edit, Trash2, Globe, Hash, FileText, ShoppingCart, Truck, ExternalLink, CheckCircle, Clock, Mail, Send, RotateCcw } from 'lucide-react';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'orders' | 'completed' | 'suppliers'>('orders');
  
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <ShoppingCart className="mr-2 text-red-600" />
        Warenbestellung & Lager
      </h1>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'orders' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Aktuelle Warenbestellungen
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'completed' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Erledigte Warenbestellungen
        </button>
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
      </div>

      {activeTab === 'orders' && <OrdersTab showCompleted={false} />}
      {activeTab === 'completed' && <OrdersTab showCompleted={true} />}
      {activeTab === 'suppliers' && <SuppliersTab />}
    </div>
  );
}

function SuppliersTab() {
  // ... existing SuppliersTab code ...
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
  const [email, setEmail] = useState('');

  const resetForm = () => {
    setName('');
    setWebsite('');
    setCustomerNumber('');
    setNotes('');
    setEmail('');
    setEditingSupplier(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setWebsite(supplier.website || '');
    setCustomerNumber(supplier.customerNumber || '');
    setNotes(supplier.notes || '');
    setEmail(supplier.email || '');
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
        notes,
        email
      });
    } else {
      await addSupplier({
        id: Math.random().toString(36).substr(2, 9),
        name,
        website,
        customerNumber,
        notes,
        email
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
              {supplier.email && (
                <div className="flex items-center">
                  <Mail size={14} className="mr-2 text-gray-400" />
                  <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline truncate">
                    {supplier.email}
                  </a>
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
                  <label className="block text-sm font-medium text-gray-700">E-Mail (für Bestellungen)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="bestellung@lieferant.de"
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

function OrdersTab({ showCompleted }: { showCompleted: boolean }) {
  const orders = useAppStore((state) => state.orders);
  const suppliers = useAppStore((state) => state.suppliers);
  const updateOrderItem = useAppStore((state) => state.updateOrderItem);
  const currentUser = useAppStore((state) => state.currentUser);
  const addOrderItem = useAppStore((state) => state.addOrderItem);
  const ensureManualOrder = useAppStore((state) => state.ensureManualOrder);

  // Manual Add Item State
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    supplierId: '',
    itemName: '',
    itemNumber: '',
    color: '',
    size: '',
    quantity: 1,
    notes: ''
  });

  const handleManualAddItem = async () => {
    if (newItem.supplierId && newItem.itemName) {
        const manualOrderId = await ensureManualOrder();
        await addOrderItem(manualOrderId, newItem);
        
        setNewItem({
            supplierId: '',
            itemName: '',
            itemNumber: '',
            color: '',
            size: '',
            quantity: 1,
            notes: ''
        });
        setShowAddItemModal(false);
    }
  };

  // Group items by Supplier -> then list items with order info
  const itemsBySupplier = useMemo(() => {
    const grouped: Record<string, { supplier: Supplier | undefined, items: (OrderItem & { orderTitle: string, orderDeadline: string })[] }> = {};
    
    orders.forEach(order => {
        if (order.orderItems) {
            order.orderItems.forEach(item => {
                // Filter based on completion status
                const isCompleted = item.status === 'received';
                if (showCompleted !== isCompleted) return;

                if (!grouped[item.supplierId]) {
                    grouped[item.supplierId] = {
                        supplier: suppliers.find(s => s.id === item.supplierId),
                        items: []
                    };
                }
                grouped[item.supplierId].items.push({
                    ...item,
                    orderTitle: order.title,
                    orderDeadline: order.deadline
                });
            });
        }
    });
    
    return grouped;
  }, [orders, suppliers, showCompleted]);

  const supplierIds = Object.keys(itemsBySupplier);
  const [selectedOrders, setSelectedOrders] = useState<Record<string, string[]>>({}); // supplierId -> orderIds[]

  const deleteOrderItem = useAppStore((state) => state.deleteOrderItem);

  const updateStatus = async (orderId: string, itemId: string, status: 'pending' | 'ordered' | 'received') => {
    // Optimistically update local state if needed, but for now we rely on store update
    await updateOrderItem(orderId, itemId, { status });
  };

  const handleDelete = async (orderId: string, itemId: string) => {
    if (confirm('Posten wirklich löschen?')) {
      await deleteOrderItem(orderId, itemId);
    }
  };

  if (supplierIds.length === 0) {
    return (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">
            {showCompleted ? 'Keine erledigten Bestellungen' : 'Keine offenen Bestellungen'}
          </h3>
          <p className="text-gray-500 mt-1 mb-4">
            {showCompleted 
                ? 'Erledigte Bestellungen erscheinen hier.' 
                : 'Fügen Sie benötigte Ware in den Aufträgen hinzu.'}
          </p>
          
          {!showCompleted && (
            <button 
                onClick={() => setShowAddItemModal(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg inline-flex items-center hover:bg-red-700 transition-colors text-sm"
            >
                <Plus size={16} className="mr-2" />
                Ware manuell hinzufügen
            </button>
          )}

          {/* Modal for empty state */}
          {showAddItemModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-xl font-bold text-gray-800">Manuelle Bestellung hinzufügen</h2>
                        <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600">
                            <Plus size={24} className="rotate-45" />
                        </button>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Lieferant / Shop</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    value={newItem.supplierId}
                                    onChange={(e) => setNewItem({...newItem, supplierId: e.target.value})}
                                >
                                    <option value="">Bitte wählen...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Artikelname / Art.-Nr. / Farbe</label>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    placeholder="z.B. Premium Hoodie - Navy"
                                    value={newItem.itemName}
                                    onChange={(e) => setNewItem({...newItem, itemName: e.target.value})}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Größe / Anzahl</label>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    placeholder="z.B. 5x XL, 3x L"
                                    value={newItem.size}
                                    onChange={(e) => setNewItem({...newItem, size: e.target.value})}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen (Optional)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    placeholder="..."
                                    value={newItem.notes}
                                    onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-4">
                        <button
                            onClick={() => setShowAddItemModal(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Abbrechen
                        </button>
                        <button
                            onClick={handleManualAddItem}
                            disabled={!newItem.supplierId || !newItem.itemName}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <Plus size={16} className="mr-2" />
                            Hinzufügen
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>
    );
  }

  const toggleOrderSelectionForSupplier = (supplierId: string, orderId: string) => {
    setSelectedOrders(prev => {
        const current = prev[supplierId] || [];
        const isSelected = current.includes(orderId);
        const updated = isSelected 
            ? current.filter(id => id !== orderId)
            : [...current, orderId];
        return { ...prev, [supplierId]: updated };
    });
  };

  const handleSendEmail = (supplierId: string) => {
    const group = itemsBySupplier[supplierId];
    if (!group) return;

    const selectedIds = selectedOrders[supplierId] || [];
    // Only process PENDING items for these orders
    const itemsToSend = group.items.filter(i => selectedIds.includes(i.orderId) && i.status === 'pending');

    if (itemsToSend.length === 0) {
        alert("Bitte wählen Sie Aufträge mit offenen Positionen aus.");
        return;
    }

    const today = new Date().toLocaleDateString('de-DE');
    const subject = `Bestellung ${today}`;
    
    // Group items by Order for the email body
    const itemsByOrder: Record<string, typeof itemsToSend> = {};
    itemsToSend.forEach(item => {
        // Special display for Manual Order
        const displayTitle = item.orderId === 'inventory-manual' ? 'Lagerbestellung' : item.orderTitle;
        if (!itemsByOrder[displayTitle]) itemsByOrder[displayTitle] = [];
        itemsByOrder[displayTitle].push(item);
    });

    let body = ``;

    Object.keys(itemsByOrder).forEach(orderTitle => {
        body += `(${orderTitle})\n`;
        itemsByOrder[orderTitle].forEach(item => {
            const quantityPrefix = item.quantity > 1 ? `${item.quantity}x ` : '';
            const itemNumberStr = item.itemNumber ? ` (${item.itemNumber})` : '';
            body += `${quantityPrefix}${item.itemName}${itemNumberStr} | ${item.size} ${item.color ? `| ${item.color}` : ''}\n`;
        });
        body += `\n`;
    });

    const emailTo = group.supplier?.email || '';
    
    // Open email client
    window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Use a slight delay to ensure the mail client has triggered before showing the modal
    setTimeout(() => {
        // We use window.confirm here. In a real app, a custom modal is better, 
        // but confirm blocks execution which is what we want here to wait for user feedback.
        if (window.confirm("Haben Sie die E-Mail erfolgreich versendet?\n\nKlicken Sie auf 'OK', um die Artikel als 'Bestellt' zu markieren.\nKlicken Sie auf 'Abbrechen', wenn Sie die Mail doch nicht gesendet haben.")) {
            // Process updates sequentially to avoid race conditions
            (async () => {
                for (const item of itemsToSend) {
                    await updateStatus(item.orderId, item.id, 'ordered');
                }
                // Clear selection
                setSelectedOrders(prev => ({ ...prev, [supplierId]: [] }));
            })();
        }
    }, 500);
  };

  return (
    <div className="space-y-8">
        {supplierIds.map(supplierId => {
            const group = itemsBySupplier[supplierId];
            const supplier = group.supplier;
            
            // Group items by Order within this Supplier block
            const ordersInGroup: Record<string, { orderId: string, title: string, deadline: string, items: typeof group.items }> = {};
            group.items.forEach(item => {
                if (!ordersInGroup[item.orderId]) {
                    ordersInGroup[item.orderId] = {
                        orderId: item.orderId,
                        title: item.orderTitle,
                        deadline: item.orderDeadline,
                        items: []
                    };
                }
                ordersInGroup[item.orderId].items.push(item);
            });

            const orderIds = Object.keys(ordersInGroup);
            const selectedForThisSupplier = selectedOrders[supplierId] || [];
            const hasSelection = selectedForThisSupplier.length > 0;

            if (!supplier && group.items.length === 0) return null;

            return (
                <div key={supplierId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center">
                            <Truck className="mr-2 text-slate-500" />
                            <h3 className="text-lg font-bold text-slate-800">{supplier?.name || 'Unbekannter Lieferant'}</h3>
                            <span className="ml-3 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
                                {orderIds.length} Aufträge
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {supplier?.website && (
                                <a 
                                    href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center text-sm text-blue-600 hover:underline bg-white px-3 py-1 rounded border border-blue-200 hover:bg-blue-50"
                                >
                                    <ExternalLink size={14} className="mr-1" />
                                    Shop
                                </a>
                            )}
                            {supplier?.email && !showCompleted && (
                                <button
                                    onClick={() => handleSendEmail(supplierId)}
                                    disabled={!hasSelection}
                                    className={`flex items-center text-sm px-3 py-1 rounded border transition-colors ${
                                        hasSelection 
                                            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' 
                                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    }`}
                                >
                                    <Mail size={14} className="mr-1" />
                                    E-Mail erstellen ({selectedForThisSupplier.length})
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {orderIds.map(orderId => {
                            const orderGroup = ordersInGroup[orderId];
                            const isSelected = selectedForThisSupplier.includes(orderId);
                            const hasPending = orderGroup.items.some(i => i.status === 'pending');

                            return (
                                <div key={orderId} className={`p-4 hover:bg-gray-50 transition-colors border-b last:border-0 ${isSelected ? 'bg-red-50' : ''}`}>
                                    {/* Order Header with Checkbox */}
                                    <div className="flex items-center mb-3">
                                        {!showCompleted && (
                                            <input 
                                                type="checkbox"
                                                className="form-checkbox h-5 w-5 text-red-600 rounded focus:ring-red-500 border-gray-300 mr-3"
                                                checked={isSelected}
                                                onChange={() => toggleOrderSelectionForSupplier(supplierId, orderId)}
                                                disabled={!hasPending} // Only allow selection if there are pending items
                                            />
                                        )}
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm flex items-center">
                                                {orderGroup.orderId === 'inventory-manual' ? 'Lagerbestellung' : orderGroup.title}
                                                {!hasPending && <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">Erledigt</span>}
                                            </h4>
                                            {orderGroup.orderId !== 'inventory-manual' && (
                                                <div className="text-xs text-gray-500 flex items-center mt-0.5">
                                                    <Clock size={12} className="mr-1" />
                                                    Deadline: {new Date(orderGroup.deadline).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="pl-8 space-y-2">
                                        {orderGroup.items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-gray-100">
                                                <div className="flex-1">
                                                    <div className="flex items-center">
                                                        <span className="font-bold mr-2">{item.quantity > 1 ? `${item.quantity}x` : ''}</span>
                                                        <span className="font-medium mr-2">{item.itemName}</span>
                                                        <span className="text-gray-500 text-xs">({item.size})</span>
                                                    </div>
                                                    {item.color && <div className="text-xs text-gray-500 mt-0.5">Farbe: {item.color}</div>}
                                                    {item.notes && <div className="text-xs text-gray-400 italic mt-0.5">{item.notes}</div>}
                                                </div>
                                                
                                                <div className="flex items-center">
                                                    <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                                                        item.status === 'pending' ? 'bg-red-100 text-red-800' :
                                                        item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {item.status === 'pending' ? 'Offen' : item.status === 'ordered' ? 'Bestellt' : 'Erhalten'}
                                                    </span>

                                                    {/* Individual Actions */}
                                                    {!showCompleted && (
                                                        <div className="flex space-x-2 shrink-0">
                                                            {item.status === 'pending' && (
                                                                <button 
                                                                    onClick={() => updateStatus(item.orderId, item.id, 'ordered')}
                                                                    className="p-1 text-yellow-600 hover:bg-yellow-50 rounded border border-transparent hover:border-yellow-200"
                                                                    title="Manuell als 'Bestellt' markieren"
                                                                >
                                                                    <ShoppingCart size={16} />
                                                                </button>
                                                            )}
                                                            {item.status === 'ordered' && (
                                                                <div className="flex space-x-1">
                                                                    <button 
                                                                        onClick={() => updateStatus(item.orderId, item.id, 'received')}
                                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                        title="Ware erhalten"
                                                                    >
                                                                        <CheckCircle size={16} />
                                                                    </button>
                                                                    {currentUser?.role === 'admin' && (
                                                                        <button 
                                                                            onClick={() => updateStatus(item.orderId, item.id, 'pending')}
                                                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded hover:text-gray-600"
                                                                            title="Zurück auf 'Offen' (Nur Admin)"
                                                                        >
                                                                            <RotateCcw size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {showCompleted && currentUser?.role === 'admin' && (
                                                        <div className="flex space-x-1">
                                                            <button 
                                                                onClick={() => updateStatus(item.orderId, item.id, 'ordered')}
                                                                className="p-1 text-gray-400 hover:bg-gray-100 rounded hover:text-gray-600"
                                                                title="Zurück auf 'Bestellt' (Nur Admin)"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(item.orderId, item.id)}
                                                                className="p-1 text-gray-400 hover:bg-red-50 rounded hover:text-red-600"
                                                                title="Löschen (Nur Admin)"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
    </div>
  );
}
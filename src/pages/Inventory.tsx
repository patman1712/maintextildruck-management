import { useState, useMemo } from 'react';
import { useAppStore, Supplier, OrderItem } from '@/store';
import { Plus, Edit, Trash2, Globe, Hash, FileText, ShoppingCart, Truck, ExternalLink, CheckCircle, Clock, Mail, RotateCcw, Search, User, Package, ChevronDown, ChevronRight, Save, X } from 'lucide-react';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'orders' | 'completed' | 'suppliers'>('orders');
  
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <ShoppingCart className="mr-2 text-red-600" />
        Warenbestellung & Lager
      </h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg mb-6 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'orders' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Aktuelle
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'completed' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Erledigte
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'suppliers' 
              ? 'bg-white text-red-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lieferanten
        </button>
      </div>

      {activeTab === 'orders' && <OrdersTab showCompleted={false} />}
      {activeTab === 'completed' && <OrdersTab showCompleted={true} />}
      {activeTab === 'suppliers' && <SuppliersTab />}
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
  const customers = useAppStore((state) => state.customers);
  const updateOrderItem = useAppStore((state) => state.updateOrderItem);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const currentUser = useAppStore((state) => state.currentUser);
  const addOrderItem = useAppStore((state) => state.addOrderItem);
  const ensureManualOrder = useAppStore((state) => state.ensureManualOrder);

  // Manual Add Item State
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [customerProducts, setCustomerProducts] = useState<Record<string, any[]>>({});
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());

  // Grouped Manual Order State
  const [manualOrderSettings, setManualOrderSettings] = useState({
      manualOrderNumber: '',
      defaultSupplierId: ''
  });
  
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  
  const [currentItem, setCurrentItem] = useState({
      supplierId: '',
      itemName: '',
      itemNumber: '',
      color: '',
      size: '',
      quantity: 1,
      notes: '',
      files: [] as any[]
  });

  const toggleCustomer = async (customerId: string) => {
      const newExpanded = new Set(expandedCustomers);
      if (newExpanded.has(customerId)) {
          newExpanded.delete(customerId);
      } else {
          newExpanded.add(customerId);
          if (!customerProducts[customerId]) {
              setLoadingProducts(prev => new Set(prev).add(customerId));
              try {
                  const res = await fetch(`/api/products/${customerId}`);
                  const data = await res.json();
                  if (data.success) {
                      setCustomerProducts(prev => ({ ...prev, [customerId]: data.data }));
                  }
              } catch(e) { console.error(e); }
              setLoadingProducts(prev => { const n = new Set(prev); n.delete(customerId); return n; });
          }
      }
      setExpandedCustomers(newExpanded);
  };

  const handleSelectProduct = (product: any, customer: any) => {
        // Populate form instead of adding directly
        setCurrentItem(prev => ({
            ...prev,
            supplierId: product.supplier_id || manualOrderSettings.defaultSupplierId,
            // Merge Name and Number into the single visible field
            itemName: `${product.name} ${product.product_number || ''}`.trim(),
            itemNumber: '', // Clear hidden field so we rely on the editable itemName
            color: '',
            size: '',
            quantity: 1,
            notes: '',
            files: product.files || []
        }));
        
        // Auto-set order number to customer name if empty
        if (!manualOrderSettings.manualOrderNumber) {
             setManualOrderSettings(prev => ({ ...prev, manualOrderNumber: customer.name }));
        }
        
        setShowProductPicker(false);
    };

  const addCurrentItemToPending = () => {
      if (!currentItem.itemName) return;
      
      // Parse Quantity from Size string (e.g. "5x XL" -> qty: 5, size: "XL")
      let parsedQty = 1;
      let parsedSize = currentItem.size;
      
      const qtyMatch = currentItem.size.match(/^(\d+)\s*[xX\s]\s*(.*)$/);
      if (qtyMatch) {
          parsedQty = parseInt(qtyMatch[1]);
          parsedSize = qtyMatch[2] || 'Universal'; // If size is empty after extracting qty
      }

      setPendingItems(prev => [...prev, {
          ...currentItem,
          _tempId: Math.random().toString(),
          supplierId: currentItem.supplierId || manualOrderSettings.defaultSupplierId,
          manualOrderNumber: manualOrderSettings.manualOrderNumber,
          quantity: parsedQty,
          size: parsedSize
      }]);
      // Reset current item
      setCurrentItem(prev => ({
          ...prev,
          itemName: '',
          itemNumber: '',
          color: '',
          size: '',
          quantity: 1,
          notes: '',
          files: []
      }));
  };

  const removePendingItem = (tempId: string) => {
      setPendingItems(prev => prev.filter(i => i._tempId !== tempId));
  };

  const handleSaveAll = async () => {
    if (pendingItems.length === 0) return;
    
    const manualOrderId = await ensureManualOrder();
    
    for (const item of pendingItems) {
        const finalOrderNumber = manualOrderSettings.manualOrderNumber || item.manualOrderNumber;
        
        const itemPayload = {
            supplierId: item.supplierId || manualOrderSettings.defaultSupplierId,
            itemName: item.itemName,
            itemNumber: item.itemNumber,
            manualOrderNumber: finalOrderNumber,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            notes: item.notes,
            files: item.files
        };
        
        await addOrderItem(manualOrderId, itemPayload);

         if (itemPayload.files && itemPayload.files.length > 0) {
              const latestOrders = useAppStore.getState().orders;
              const order = latestOrders.find(o => o.id === manualOrderId);
              
              if (order) {
                 const existingFiles = order.files || [];
                     const printFiles = itemPayload.files.filter((f: any) => f.type === 'print' || f.type === 'vector');
                     
                     const newOrderFiles = printFiles.map((f: any) => ({
                         name: f.file_name || f.name || 'Unbenannt',
                         type: f.type,
                         url: f.file_url || f.url || f.path, 
                         thumbnail: f.thumbnail_url || f.thumbnail,
                         customName: f.file_name || f.customName,
                         reference: finalOrderNumber 
                     }));

                     if (newOrderFiles.length > 0) {
                         await updateOrder(manualOrderId, {
                             files: [...existingFiles, ...newOrderFiles]
                         });
                     }
                 }
            }
    }
    
    setPendingItems([]);
    setManualOrderSettings({ manualOrderNumber: '', defaultSupplierId: '' });
    setShowAddItemModal(false);
  };

  // Group items by Supplier -> then list items with order info
  const itemsBySupplier = useMemo(() => {
    const grouped: Record<string, { supplier: Supplier | undefined, items: (OrderItem & { orderTitle: string, orderNumber?: string, orderDeadline: string })[] }> = {};
    
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
                    orderNumber: order.orderNumber,
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
    const itemsToSend = group.items.filter(i => {
        const effectiveOrderId = (i.orderId === 'inventory-manual' && i.manualOrderNumber)
            ? `manual-${i.manualOrderNumber}`
            : i.orderId;
        return selectedIds.includes(effectiveOrderId) && i.status === 'pending';
    });

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
        let displayTitle = item.orderTitle;
        if (item.orderId === 'inventory-manual') {
            if (item.manualOrderNumber) {
                displayTitle = item.manualOrderNumber;
            } else {
                displayTitle = 'Lagerbestellung';
            }
        } else if (item.orderNumber) {
            displayTitle = item.orderNumber;
        }

        if (!itemsByOrder[displayTitle]) itemsByOrder[displayTitle] = [];
        itemsByOrder[displayTitle].push(item);
    });

    let body = ``;

    Object.keys(itemsByOrder).forEach(orderTitle => {
        body += `(${orderTitle})\n`;
        itemsByOrder[orderTitle].forEach(item => {
            const quantityPrefix = item.quantity > 1 ? `${item.quantity}x ` : '';
            // Use itemNumber if available, otherwise fallback to itemName
            const identifier = item.itemNumber ? item.itemNumber : item.itemName;
            body += `${quantityPrefix}${identifier} | ${item.size} ${item.color ? `| ${item.color}` : ''}\n`;
        });
        body += `\n`;
    });

    const emailTo = group.supplier?.email || '';
    
    // Open email client
    window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Use a slight delay to ensure the mail client has triggered before showing the modal
    setTimeout(() => {
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
    <>
    {supplierIds.length === 0 ? (
        <div className="max-w-4xl mx-auto">
            {!showCompleted && (
                <div className="flex justify-end mb-4">
                    <button 
                        onClick={() => setShowAddItemModal(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg inline-flex items-center hover:bg-red-700 transition-colors text-sm shadow-sm"
                    >
                        <Plus size={16} className="mr-2" />
                        Ware manuell hinzufügen
                    </button>
                </div>
            )}

            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900">
                    {showCompleted ? 'Keine erledigten Bestellungen' : 'Keine offenen Bestellungen'}
                </h3>
                <p className="text-gray-500 mt-1 mb-4">
                    {showCompleted 
                        ? 'Erledigte Bestellungen erscheinen hier.' 
                        : 'Fügen Sie benötigte Ware in den Aufträgen hinzu oder nutzen Sie den Button oben.'}
                </p>
            </div>
        </div>
    ) : (
    <div className="space-y-8">
        {!showCompleted && (
            <div className="flex justify-end">
                <button 
                    onClick={() => setShowAddItemModal(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg inline-flex items-center hover:bg-red-700 transition-colors text-sm shadow-sm"
                >
                    <Plus size={16} className="mr-2" />
                    Ware manuell hinzufügen
                </button>
            </div>
        )}

        {supplierIds.map(supplierId => {
            const group = itemsBySupplier[supplierId];
            const supplier = group.supplier;
            
            // Group items by Order within this Supplier block
            const ordersInGroup: Record<string, { orderId: string, title: string, orderNumber?: string, deadline: string, items: typeof group.items }> = {};
            group.items.forEach(item => {
                let groupKey = item.orderId;
                let groupTitle = item.orderTitle;

                if (item.orderId === 'inventory-manual' && item.manualOrderNumber) {
                    groupKey = `manual-${item.manualOrderNumber}`;
                    groupTitle = item.manualOrderNumber;
                }

                if (!ordersInGroup[groupKey]) {
                    ordersInGroup[groupKey] = {
                        orderId: groupKey,
                        title: groupTitle,
                        orderNumber: item.orderNumber,
                        deadline: item.orderDeadline,
                        items: []
                    };
                }
                ordersInGroup[groupKey].items.push(item);
            });

            const orderIds = Object.keys(ordersInGroup);
            const selectedForThisSupplier = selectedOrders[supplierId] || [];
            const hasSelection = selectedForThisSupplier.length > 0;

            if (!supplier && group.items.length === 0) return null;

            return (
                <div key={supplierId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div className="flex items-center">
                            <Truck className="mr-2 text-slate-500 shrink-0" />
                            <h3 className="text-lg font-bold text-slate-800 truncate">{supplier?.name || 'Unbekannter Lieferant'}</h3>
                            <span className="ml-3 bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full shrink-0">
                                {orderIds.length} Aufträge
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                            {supplier?.website && (
                                <a 
                                    href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center text-sm text-blue-600 hover:underline bg-white px-3 py-1 rounded border border-blue-200 hover:bg-blue-50"
                                >
                                    <ExternalLink size={14} className="mr-1" />
                                    <span className="hidden sm:inline">Shop</span>
                                    <span className="sm:hidden">Web</span>
                                </a>
                            )}
                            {!showCompleted && (
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
                                    <span>E-Mail ({selectedForThisSupplier.length})</span>
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
                                    <div className="flex items-start mb-3">
                                        {!showCompleted && (
                                            <input 
                                                type="checkbox"
                                                className="form-checkbox h-5 w-5 text-red-600 rounded focus:ring-red-500 border-gray-300 mr-3 mt-0.5"
                                                checked={isSelected}
                                                onChange={() => toggleOrderSelectionForSupplier(supplierId, orderId)}
                                                disabled={!hasPending} // Only allow selection if there are pending items
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 text-sm flex flex-wrap items-center gap-2">
                                                {orderGroup.orderNumber && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">{orderGroup.orderNumber}</span>}
                                                <span className="truncate">{orderGroup.orderId === 'inventory-manual' ? 'Lagerbestellung' : orderGroup.title}</span>
                                                {!hasPending && <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded shrink-0">Erledigt</span>}
                                            </h4>
                                            {orderGroup.orderId !== 'inventory-manual' && !orderGroup.orderId.startsWith('manual-') && (
                                                <div className="text-xs text-gray-500 flex items-center mt-0.5">
                                                    <Clock size={12} className="mr-1" />
                                                    Deadline: {new Date(orderGroup.deadline).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className={`space-y-2 ${!showCompleted ? 'pl-8' : ''}`}>
                                        {orderGroup.items.map(item => (
                                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white p-2 rounded border border-gray-100 gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 break-words">
                                                        {item.itemName}
                                                        {item.itemNumber && <span className="text-gray-500 ml-2 text-xs">#{item.itemNumber}</span>}
                                                    </div>
                                                    <div className="text-sm mt-0.5 flex flex-wrap gap-2 items-center">
                                                         <span className="font-bold bg-gray-100 px-1.5 rounded text-gray-800">
                                                            {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.size}
                                                         </span>
                                                         {item.color && <span className="text-gray-600">Farbe: {item.color}</span>}
                                                    </div>
                                                    {item.notes && <div className="text-xs text-gray-400 italic mt-0.5 break-words">{item.notes}</div>}
                                                </div>
                                                
                                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                                        item.status === 'pending' ? 'bg-red-100 text-red-800' :
                                                        item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {item.status === 'pending' ? 'Offen' : item.status === 'ordered' ? 'Bestellt' : 'Erhalten'}
                                                    </span>

                                                    {/* Individual Actions */}
                                                    <div className="flex space-x-2">
                                                        {!showCompleted && item.status === 'pending' && (
                                                            <button 
                                                                onClick={() => updateStatus(item.orderId, item.id, 'ordered')}
                                                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded border border-transparent hover:border-yellow-200"
                                                                title="Manuell als 'Bestellt' markieren"
                                                            >
                                                                <ShoppingCart size={18} />
                                                            </button>
                                                        )}
                                                        
                                                        {((!showCompleted && item.status === 'ordered') || (showCompleted && currentUser?.role === 'admin')) && (
                                                            <div className="flex space-x-1">
                                                                {!showCompleted && (
                                                                    <button 
                                                                        onClick={() => updateStatus(item.orderId, item.id, 'received')}
                                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                                        title="Ware erhalten"
                                                                    >
                                                                        <CheckCircle size={18} />
                                                                    </button>
                                                                )}
                                                                {currentUser?.role === 'admin' && (
                                                                    <button 
                                                                        onClick={() => updateStatus(item.orderId, item.id, item.status === 'ordered' ? 'pending' : 'ordered')}
                                                                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded hover:text-gray-600"
                                                                        title="Status zurücksetzen (Nur Admin)"
                                                                    >
                                                                        <RotateCcw size={18} />
                                                                    </button>
                                                                )}
                                                                {showCompleted && currentUser?.role === 'admin' && (
                                                                    <button 
                                                                        onClick={() => handleDelete(item.orderId, item.id)}
                                                                        className="p-1.5 text-gray-400 hover:bg-red-50 rounded hover:text-red-600"
                                                                        title="Löschen (Nur Admin)"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
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
    )}

        {/* Modal for manual adding - VERTICAL LAYOUT */}
        {showAddItemModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col p-6">
                    <div className="flex justify-between items-center mb-4 border-b pb-2 shrink-0">
                        <h2 className="text-xl font-bold text-gray-800">
                            Manuelle Bestellung hinzufügen
                        </h2>
                        <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600">
                            <Plus size={24} className="rotate-45" />
                        </button>
                    </div>
                    
                    <div className="flex flex-col flex-1 overflow-hidden gap-6 overflow-y-auto">
                        {/* 1. Header Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 shrink-0">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Standard Lieferant (für alle Positionen)</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    value={manualOrderSettings.defaultSupplierId}
                                    onChange={(e) => setManualOrderSettings({...manualOrderSettings, defaultSupplierId: e.target.value})}
                                >
                                    <option value="">Bitte wählen...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Auftragsnummer / Referenz (für alle Positionen)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                    placeholder="z.B. 2026-0012"
                                    value={manualOrderSettings.manualOrderNumber}
                                    onChange={(e) => setManualOrderSettings({...manualOrderSettings, manualOrderNumber: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* 2. New Position Form */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm shrink-0">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-gray-700">Neue Position</h3>
                                <button 
                                    onClick={() => setShowProductPicker(true)}
                                    className="text-xs text-red-600 hover:text-red-800 underline font-medium flex items-center"
                                >
                                    <Package size={14} className="mr-1" />
                                    Aus Kundenartikel wählen
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-5">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Artikelname / Art.-Nr. / Farbe</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                        value={currentItem.itemName}
                                        onChange={(e) => setCurrentItem({...currentItem, itemName: e.target.value})}
                                        placeholder="z.B. Hoodie 12345 Navy"
                                        autoFocus
                                    />
                                </div>
                                
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Größe / Anzahl</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                        value={currentItem.size}
                                        onChange={(e) => setCurrentItem({...currentItem, size: e.target.value})}
                                        placeholder="z.B. 5x XL"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Notiz</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                                        value={currentItem.notes}
                                        onChange={(e) => setCurrentItem({...currentItem, notes: e.target.value})}
                                        placeholder="Optional"
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-end">
                                    <button
                                        onClick={addCurrentItemToPending}
                                        disabled={!currentItem.itemName}
                                        className="w-full bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-900 disabled:opacity-50 text-sm flex items-center justify-center h-[38px]"
                                    >
                                        <Plus size={16} className="mr-2" />
                                        Hinzufügen
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Pending Items List */}
                        <div className="flex-1 overflow-hidden border rounded-lg flex flex-col min-h-[200px]">
                            <div className="bg-gray-50 p-2 border-b font-medium text-sm text-gray-700 flex justify-between items-center">
                                <span>Geplante Positionen ({pendingItems.length})</span>
                                {pendingItems.length > 0 && (
                                    <button onClick={() => setPendingItems([])} className="text-xs text-red-600 hover:underline">
                                        Alle löschen
                                    </button>
                                )}
                            </div>
                            
                            <div className="overflow-y-auto flex-1 bg-white">
                                {pendingItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                                        <ShoppingCart size={32} className="mb-2 opacity-50" />
                                        <p className="text-sm text-center">Noch keine Positionen.</p>
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel / Farbe</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Größe / Anzahl</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lieferant</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notiz</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktion</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {pendingItems.map((item, idx) => (
                                                <tr key={item._tempId || idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.itemName}
                                                        {item.itemNumber && <span className="ml-2 text-xs text-gray-400">#{item.itemNumber}</span>}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-bold">
                                                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.size}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                        {suppliers.find(s => s.id === item.supplierId)?.name || 'Standard'}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 italic">{item.notes}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                        <button 
                                                            onClick={() => removePendingItem(item._tempId)}
                                                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-end space-x-3 shrink-0 pt-4 border-t mt-auto">
                            <button
                                onClick={() => setShowAddItemModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleSaveAll}
                                disabled={pendingItems.length === 0}
                                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium shadow-sm"
                            >
                                <Save className="mr-2" size={18} />
                                {pendingItems.length} Positionen speichern
                            </button>
                        </div>
                    </div>
                </div>

                {/* PRODUCT PICKER MODAL (Overlay) */}
                {showProductPicker && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Kunden-Artikel auswählen</h3>
                                <button onClick={() => setShowProductPicker(false)} className="text-gray-500 hover:text-gray-700">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="flex flex-col flex-1 overflow-hidden p-4">
                                <div className="mb-4 shrink-0 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Kunde oder Artikel suchen..." 
                                        className="w-full pl-10 border border-gray-300 rounded p-2 focus:ring-red-500 focus:border-red-500"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                
                                <div className="flex-1 overflow-y-auto border rounded bg-gray-50 p-2 space-y-2">
                                    {customers
                                        .filter(c => c.name.toLowerCase().includes(productSearch.toLowerCase()))
                                        .map(customer => {
                                        const isExpanded = expandedCustomers.has(customer.id);
                                        const isLoading = loadingProducts.has(customer.id);
                                        const products = customerProducts[customer.id] || [];
                                        
                                        return (
                                            <div key={customer.id} className="bg-white border border-gray-200 rounded overflow-hidden">
                                                <button 
                                                    onClick={() => toggleCustomer(customer.id)}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                                                >
                                                    <div className="flex items-center">
                                                        {isExpanded ? <ChevronDown size={18} className="text-gray-400 mr-2" /> : <ChevronRight size={18} className="text-gray-400 mr-2" />}
                                                        <User size={16} className="text-blue-500 mr-2" />
                                                        <span className="font-medium text-slate-800">{customer.name}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">{isExpanded && isLoading ? 'Lade...' : ''}</span>
                                                </button>
                                                
                                                {isExpanded && (
                                                    <div className="border-t border-gray-100 bg-gray-50 p-2 space-y-1">
                                                        {!isLoading && products.length === 0 && <p className="text-xs text-gray-500 pl-8 py-2">Keine Artikel gefunden.</p>}
                                                        {products.map(product => (
                                                            <button 
                                                                key={product.id}
                                                                onClick={() => handleSelectProduct(product, customer)}
                                                                className="w-full flex items-center p-2 pl-8 hover:bg-red-50 text-left rounded transition-colors group"
                                                            >
                                                                <Package size={14} className="text-gray-400 mr-2 group-hover:text-red-500" />
                                                                <div>
                                                                    <div className="text-sm font-medium text-gray-700 group-hover:text-red-700">{product.name}</div>
                                                                    {product.product_number && <div className="text-xs text-gray-500">{product.product_number}</div>}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
    </>
  );
}

import { useAppStore, Order, Customer } from "@/store";
import { FileText, Search, User, Eye, Printer, PenTool, CheckCircle, RefreshCw, Share2, Edit, ArrowRight, Plus, X, Save } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function InvoiceList() {
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const customers = useAppStore((state) => state.customers);
  const addOrder = useAppStore((state) => state.addOrder);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const toggleOrderStep = useAppStore((state) => state.toggleOrderStep);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newInvoice, setNewInvoice] = useState({ title: '', customerId: '', customerName: '', address: '', description: '' });

  const resetForm = () => {
      setNewInvoice({ title: '', customerId: '', customerName: '', address: '', description: '' });
      setEditingId(null);
      setIsAdding(false);
  };

  const handleEditManualInvoice = (e: React.MouseEvent, order: Order) => {
      e.stopPropagation();
      setNewInvoice({
          title: order.title,
          customerId: order.customerId || '',
          customerName: order.customerName,
          address: order.customerAddress || '',
          description: order.description || ''
      });
      setEditingId(order.id);
      setIsAdding(true);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Aufträge...</div>;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Logic: Processing=True AND Produced=True AND Invoiced=False
    // Or if status is 'manual_invoice' and NOT invoiced (it implies produced/processing logic in our head)
    const isManual = order.status === 'manual_invoice';
    const isProduced = order.steps?.processing && order.steps?.produced;
    const isPendingInvoice = !order.steps?.invoiced;

    if (order.status === 'archived' || order.id === 'inventory-manual') return false;
    
    // If it's manual invoice, show it even if steps are not explicitly set (though we set them)
    // But we check isPendingInvoice for both.
    return matchesSearch && isPendingInvoice && (isManual || isProduced);
  });

  const handleMarkInvoiced = async (e: React.MouseEvent, orderId: string) => {
      e.stopPropagation();
      if(confirm("Möchten Sie diesen Auftrag wirklich als 'Verrechnet' markieren? Er verschwindet dann aus dieser Liste.")) {
          await toggleOrderStep(orderId, 'invoiced');
      }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customerId = e.target.value;
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
          setNewInvoice({
              ...newInvoice,
              customerId: customer.id,
              customerName: customer.name,
              address: customer.address || ''
          });
      } else {
          setNewInvoice({ ...newInvoice, customerId: '', customerName: '', address: '' });
      }
  };

  const handleCreateManualInvoice = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newInvoice.title || !newInvoice.customerName) return;

      if (editingId) {
          // Update existing
          await updateOrder(editingId, {
              title: newInvoice.title,
              customerId: newInvoice.customerId || undefined,
              customerName: newInvoice.customerName,
              customerAddress: newInvoice.address,
              description: newInvoice.description
          });
      } else {
          // Create new
          const order: Order = {
              id: Math.random().toString(36).substr(2, 9),
              title: newInvoice.title,
              status: 'manual_invoice',
              customerId: newInvoice.customerId || undefined,
              customerName: newInvoice.customerName,
              customerAddress: newInvoice.address,
              description: newInvoice.description,
              createdAt: new Date().toISOString(),
              deadline: new Date().toISOString().split('T')[0], // Today
              steps: { processing: true, produced: true, invoiced: false },
              employees: [],
              files: []
          };
          await addOrder(order);
      }

      fetchData();
      resetForm();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <FileText className="mr-2 text-red-600" />
            Rechnung schreiben
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Aufträge, die produziert sind, aber noch nicht abgerechnet wurden.
            </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <button 
            onClick={() => fetchData()}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Liste aktualisieren"
          >
            <RefreshCw size={20} />
          </button>

          <div className="relative">
            <input 
              type="text" 
              placeholder="Suchen..." 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-end">
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 flex items-center shadow-md font-medium"
          >
            <Plus size={20} className="mr-2" />
            Manuelle Rechnung erstellen
          </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">
                        {editingId ? 'Manuelle Rechnung bearbeiten' : 'Manuelle Rechnung erfassen'}
                    </h2>
                    <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleCreateManualInvoice}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Titel / Betreff *</label>
                            <input 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newInvoice.title}
                                onChange={e => setNewInvoice({...newInvoice, title: e.target.value})}
                                required
                                placeholder="z.B. Sonderleistung Textildruck"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde auswählen</label>
                            <select 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newInvoice.customerId}
                                onChange={handleCustomerSelect}
                            >
                                <option value="">-- Kunde wählen --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kundenname (Rechnungsanschrift) *</label>
                            <input 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                value={newInvoice.customerName}
                                onChange={e => setNewInvoice({...newInvoice, customerName: e.target.value})}
                                required
                                placeholder="Name des Kunden"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsadresse</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                                rows={3}
                                value={newInvoice.address}
                                onChange={e => setNewInvoice({...newInvoice, address: e.target.value})}
                                placeholder="Straße, PLZ, Ort"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inhalt / Preise / Notizen</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm"
                                rows={5}
                                value={newInvoice.description}
                                onChange={e => setNewInvoice({...newInvoice, description: e.target.value})}
                                placeholder="z.B. 10x T-Shirt Druck à 15€&#10;Gesamt: 150€"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            type="button" 
                            onClick={resetForm}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                        >
                            Abbrechen
                        </button>
                        <button 
                            type="submit"
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                        >
                            <Save size={18} className="mr-2" />
                            Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auftrag / Kunde</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/orders/${order.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                            {order.orderNumber && <span className="text-gray-400 mr-2 text-xs font-mono">{order.orderNumber}</span>}
                            {order.title}
                        </span>
                        <span className="text-sm text-gray-500 flex items-center mt-1">
                          <User size={14} className="mr-1" /> {order.customerName}
                        </span>
                        {order.status === 'manual_invoice' && (
                            <span className="text-xs text-red-500 mt-1 font-medium">Manuelle Rechnung</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={12} className="mr-1" />
                            Produziert & Bereit
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                        {order.status === 'manual_invoice' && (
                            <button
                                onClick={(e) => handleEditManualInvoice(e, order)}
                                className="bg-gray-100 text-gray-600 px-3 py-2 rounded hover:bg-gray-200 inline-flex items-center transition-colors shadow-sm"
                                title="Bearbeiten"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                        <button
                            onClick={(e) => handleMarkInvoiced(e, order.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-flex items-center transition-colors shadow-sm"
                        >
                            <FileText size={16} className="mr-2" />
                            Als verrechnet markieren
                        </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                        <CheckCircle size={48} className="text-green-200 mb-4" />
                        <p className="text-lg font-medium text-gray-900">Alles erledigt!</p>
                        <p className="text-sm text-gray-500">Keine offenen Rechnungen vorhanden.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
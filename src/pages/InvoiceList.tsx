import { useAppStore, Order } from "@/store";
import { FileText, Search, User, Eye, Printer, PenTool, CheckCircle, RefreshCw, Share2, Edit, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function InvoiceList() {
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const toggleOrderStep = useAppStore((state) => state.toggleOrderStep);
  const [searchTerm, setSearchTerm] = useState("");

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Aufträge...</div>;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Logic: Processing=True AND Produced=True AND Invoiced=False
    const readyForInvoice = order.steps?.processing && order.steps?.produced && !order.steps?.invoiced;
    
    if (order.status === 'archived' || order.id === 'inventory-manual') return false;
    
    return matchesSearch && readyForInvoice;
  });

  const handleMarkInvoiced = async (e: React.MouseEvent, orderId: string) => {
      e.stopPropagation();
      if(confirm("Möchten Sie diesen Auftrag wirklich als 'Verrechnet' markieren? Er verschwindet dann aus dieser Liste.")) {
          await toggleOrderStep(orderId, 'invoiced');
      }
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
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={12} className="mr-1" />
                            Produziert & Bereit
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
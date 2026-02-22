import { useAppStore, Order, OrderSteps } from "@/store";
import { Folder, Search, Filter, Calendar, User, Eye, Printer, MoreHorizontal, Settings, CheckCircle, FileText, Edit, PenTool, Archive } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OrderList({ filter }: { filter?: "active" | "completed" }) {
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const toggleOrderStep = useAppStore((state) => state.toggleOrderStep);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">(filter || "all");

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Aufträge...</div>;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If a prop filter is provided, force it. Otherwise use the dropdown.
    const effectiveStatusFilter = filter || statusFilter;
    const matchesStatus = effectiveStatusFilter === "all" || order.status === effectiveStatusFilter;
    
    // Hide archived orders from normal lists unless specifically requested (though we don't have a UI for archived yet)
    // Archived orders are "hidden" storage orders for direct uploads
    if (order.status === 'archived') return false;
    
    return matchesSearch && matchesStatus;
  });

  const StepButton = ({ active, onClick, icon: Icon, label, colorClass }: { active: boolean, onClick: () => void, icon: any, label: string, colorClass: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center space-x-1 px-2 py-1 rounded border transition-all ${
        active 
          ? `${colorClass} border-transparent text-white shadow-sm` 
          : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
      }`}
      title={label}
    >
      <Icon size={14} />
      <span className="text-xs font-medium hidden xl:inline">{label}</span>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          {filter === "completed" ? <Archive className="mr-2 text-red-600" /> : <Folder className="mr-2 text-red-600" />}
          {filter === "completed" ? "Fertige Aufträge" : "Aktuelle Aufträge"}
        </h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
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
          
          {!filter && (
            <select 
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-red-500 focus:border-red-500 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="completed">Abgeschlossen</option>
            </select>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auftrag / Kunde</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eingang</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fortschritt</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Aktionen</span>
                </th>
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
                        <span className="text-sm font-medium text-gray-900">{order.title}</span>
                        <span className="text-sm text-gray-500 flex items-center mt-1">
                          <User size={14} className="mr-1" /> {order.customerName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('de-DE')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-700">
                        <Calendar size={16} className="mr-2 text-gray-400" />
                        {new Date(order.deadline).toLocaleDateString('de-DE')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2 overflow-hidden">
                        {order.employees.map((emp, i) => (
                          <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600" title={emp}>
                            {emp.charAt(0)}
                          </div>
                        ))}
                        {order.employees.length === 0 && <span className="text-sm text-gray-400 italic">Keine</span>}
                      </div>
                      <div className="flex space-x-1 mt-1">
                        {order.files.some(f => f.type === 'preview') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600" title="Vorschauen">
                            <Eye size={10} className="mr-1" /> {order.files.filter(f => f.type === 'preview').length}
                          </span>
                        )}
                        {order.files.some(f => f.type === 'print') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600" title="Druckdaten">
                            <Printer size={10} className="mr-1" /> {order.files.filter(f => f.type === 'print').length}
                          </span>
                        )}
                        {order.files.some(f => f.type === 'vector') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600" title="Rohdaten">
                            <PenTool size={10} className="mr-1" /> {order.files.filter(f => f.type === 'vector').length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                         <StepButton 
                           active={order.steps?.processing} 
                           onClick={() => toggleOrderStep(order.id, 'processing')} 
                           icon={Settings} 
                           label="Bearb." 
                           colorClass="bg-blue-500 hover:bg-blue-600"
                         />
                         <StepButton 
                           active={order.steps?.produced} 
                           onClick={() => toggleOrderStep(order.id, 'produced')} 
                           icon={CheckCircle} 
                           label="Prod." 
                           colorClass="bg-purple-500 hover:bg-purple-600"
                         />
                         <StepButton 
                           active={order.steps?.invoiced} 
                           onClick={() => toggleOrderStep(order.id, 'invoiced')} 
                           icon={FileText} 
                           label="Rech." 
                           colorClass="bg-green-500 hover:bg-green-600"
                         />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'active' ? 'bg-green-100 text-green-800' : 
                        order.status === 'completed' ? 'bg-gray-100 text-gray-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status === 'active' ? 'In Bearbeitung' : order.status === 'completed' ? 'Abgeschlossen' : 'Storniert'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/orders/${order.id}/edit`);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-full"
                        title="Auftrag bearbeiten"
                      >
                        <Edit size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Keine Aufträge gefunden
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

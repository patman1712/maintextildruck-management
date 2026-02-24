import { useAppStore } from "@/store";
import { Link } from "react-router-dom";
import { ShoppingCart, Printer, Clock, User, Folder, ArrowRight, AlertTriangle, Calendar } from "lucide-react";

export default function DashboardHome() {
  const { orders, currentUser, suppliers } = useAppStore();
  
  // 1. Active Orders
  const activeOrders = orders.filter(o => o.status === 'active');
  
  // 2. My Orders
  // Check against ID, username, and name to handle legacy data or different storage formats
  const myOrders = activeOrders.filter(o => 
      o.employees.includes(currentUser?.id || '') || 
      o.employees.includes(currentUser?.username || '') ||
      o.employees.includes(currentUser?.name || '')
  );
  
  // 3. Material Needs (Pending Items)
  const pendingItems = orders.flatMap(o => (o.orderItems || []).filter(i => i.status === 'pending'));
  // Group by Supplier
  const supplierIds = [...new Set(pendingItems.map(i => i.supplierId))];
  const pendingSuppliers = supplierIds.map(id => {
      const supplier = suppliers.find(s => s.id === id);
      const count = pendingItems.filter(i => i.supplierId === id).length;
      return { name: supplier?.name || 'Unbekannt', count, id };
  });
  
  // 4. DTF Needs (Print Files not ordered)
  // Logic: Active order + Has Print Files + printStatus != 'ordered'
  const dtfOrders = activeOrders.filter(o => {
      const hasPrintFiles = o.files?.some(f => f.type === 'print');
      return hasPrintFiles && o.printStatus !== 'ordered';
  });
  
  // 5. Deadlines
  const upcomingDeadlines = [...activeOrders]
      .filter(o => o.id !== 'inventory-manual') // Exclude dummy order for inventory
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      {/* ALERTS SECTION (Material & DTF) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Material */}
        <div className={`bg-white rounded-lg shadow-sm border p-6 ${pendingSuppliers.length > 0 ? 'border-l-4 border-l-red-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center">
                    <ShoppingCart className={`mr-2 ${pendingSuppliers.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                    Materialbedarf
                </h3>
                {pendingSuppliers.length > 0 && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">{pendingItems.length} Artikel</span>}
            </div>
            
            {pendingSuppliers.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-2">Folgende Shops haben offene Positionen:</p>
                    <div className="flex flex-wrap gap-2">
                        {pendingSuppliers.map(s => (
                            <div key={s.id} className="bg-red-50 border border-red-100 text-red-800 px-3 py-1.5 rounded text-sm font-medium flex items-center">
                                {s.name} 
                                <span className="ml-2 bg-white text-red-600 px-1.5 rounded-full text-xs">{s.count}</span>
                            </div>
                        ))}
                    </div>
                    <Link to="/dashboard/inventory" className="text-sm text-red-600 font-medium hover:underline mt-3 inline-block">
                        Zur Warenbestellung &rarr;
                    </Link>
                </div>
            ) : (
                <p className="text-gray-500 text-sm">Keine offenen Materialbestellungen.</p>
            )}
        </div>

        {/* DTF */}
        <div className={`bg-white rounded-lg shadow-sm border p-6 ${dtfOrders.length > 0 ? 'border-l-4 border-l-purple-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center">
                    <Printer className={`mr-2 ${dtfOrders.length > 0 ? 'text-purple-500' : 'text-gray-400'}`} />
                    Druckdaten (DTF)
                </h3>
                {dtfOrders.length > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">{dtfOrders.length} Aufträge</span>}
            </div>
            
            {dtfOrders.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-2">Für folgende Aufträge müssen Druckdaten bestellt werden:</p>
                    <div className="flex flex-wrap gap-2">
                        {dtfOrders.slice(0, 5).map(o => (
                            <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="bg-purple-50 border border-purple-100 text-purple-800 px-3 py-1.5 rounded text-sm font-medium hover:bg-purple-100">
                                {o.orderNumber}
                            </Link>
                        ))}
                        {dtfOrders.length > 5 && <span className="text-gray-500 text-sm flex items-center">+{dtfOrders.length - 5} weitere</span>}
                    </div>
                    <Link to="/dashboard/dtf" className="text-sm text-purple-600 font-medium hover:underline mt-3 inline-block">
                        Zur DTF-Bestellung &rarr;
                    </Link>
                </div>
            ) : (
                <p className="text-gray-500 text-sm">Alle Druckdaten sind bestellt.</p>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Orders */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* MY ORDERS */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center">
                        <User className="mr-2 text-blue-600" />
                        Meine Aufträge
                    </h3>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">{myOrders.length}</span>
                </div>
                {myOrders.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {myOrders.map(o => (
                            <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="block p-4 hover:bg-blue-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-slate-800">{o.title}</div>
                                        <div className="text-sm text-gray-500">{o.orderNumber} • {o.customerName}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-medium ${getDeadlineColor(o.deadline)}`}>
                                            {new Date(o.deadline).toLocaleDateString('de-DE')}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">Sie sind aktuell keinen aktiven Aufträgen zugewiesen.</div>
                )}
            </div>

        </div>

        {/* RIGHT COLUMN: Deadlines */}
        <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden sticky top-6">
                <div className="px-6 py-4 border-b border-gray-100 bg-red-50">
                    <h3 className="font-bold text-lg text-red-800 flex items-center">
                        <Clock className="mr-2" />
                        Nächste Deadlines
                    </h3>
                </div>
                <div className="divide-y divide-gray-100">
                    {upcomingDeadlines.length > 0 ? (
                        upcomingDeadlines.map(o => {
                            const daysLeft = Math.ceil((new Date(o.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return (
                                <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="block p-4 hover:bg-red-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-slate-800 line-clamp-1">{o.title}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${daysLeft <= 2 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {daysLeft < 0 ? 'Überfällig' : (daysLeft === 0 ? 'Heute' : `${daysLeft} Tage`)}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Calendar size={14} className="mr-1" />
                                        {new Date(o.deadline).toLocaleDateString('de-DE')}
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="p-6 text-center text-gray-500">Keine anstehenden Deadlines.</div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function getDeadlineColor(deadline: string) {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 2) return 'text-orange-600 font-bold';
    return 'text-gray-600';
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { 
    ArrowLeft, Calendar, User, FileText, Image as ImageIcon, 
    CheckCircle, AlertCircle, Phone, Mail, MapPin, Printer, PenTool, 
    X, Info, Clock, Download
} from "lucide-react";

export default function InternalOrderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const orderItems = useAppStore((state) => state.orderItems);
  const loading = useAppStore((state) => state.loading);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const order = orders.find(o => o.id === id);
  const items = orderItems.filter(i => i.order_id === id);

  if (loading && !order) return <div className="p-8 text-center text-gray-500">Lade Auftrag...</div>;
  if (!order) return <div className="p-8 text-center text-red-600">Auftrag nicht gefunden.</div>;

  // Filter images for display (Preview AND Internal, but no raw print/vector files unless requested)
  // User said: "druckdaten müssen nicht zu sehen sein aber vorschau bilder und interne bilder"
  const displayFiles = (order.files || []).filter(f => 
      f.type === 'preview' || f.type === 'view' || f.type === 'internal' || 
      // Also show Shopware images if present
      (f.name && f.name.includes('Shopware'))
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-12">
      {/* Top Bar (Sticky) */}
      <div className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
                <button 
                    onClick={() => navigate(-1)}
                    className="mr-4 p-2 hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-lg font-bold flex items-center">
                        <span className="mr-2">Auftrag {order.orderNumber || order.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                            order.status === 'active' ? 'bg-green-500 text-white' : 
                            order.status === 'completed' ? 'bg-gray-500 text-gray-200' : 'bg-red-500 text-white'
                        }`}>
                            {order.status === 'active' ? 'Aktiv' : order.status === 'completed' ? 'Fertig' : 'Storniert'}
                        </span>
                    </h1>
                    <p className="text-slate-400 text-xs">{order.customerName}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center" title="Deadline">
                    <Calendar size={16} className="mr-1.5 text-red-400" />
                    <span className="font-mono font-bold text-red-100">
                        {new Date(order.deadline).toLocaleDateString('de-DE')}
                    </span>
                </div>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* Customer & Order Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <User size={18} className="mr-2 text-blue-600" />
                    Kunde & Auftrag
                </h3>
                <span className="text-xs text-gray-400">Erstellt: {new Date(order.createdAt).toLocaleDateString('de-DE')}</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Kunde / Firma</label>
                        <p className="font-medium text-lg text-gray-900">{order.customerName}</p>
                    </div>
                    {order.customerContactPerson && (
                        <div className="flex items-center text-gray-600 text-sm">
                            <User size={14} className="mr-2" /> {order.customerContactPerson}
                        </div>
                    )}
                    {(order.customerEmail || order.customerPhone) && (
                        <div className="flex flex-col gap-1 text-sm text-gray-600">
                            {order.customerEmail && (
                                <a href={`mailto:${order.customerEmail}`} className="flex items-center hover:text-blue-600">
                                    <Mail size={14} className="mr-2" /> {order.customerEmail}
                                </a>
                            )}
                            {order.customerPhone && (
                                <a href={`tel:${order.customerPhone}`} className="flex items-center hover:text-blue-600">
                                    <Phone size={14} className="mr-2" /> {order.customerPhone}
                                </a>
                            )}
                        </div>
                    )}
                    {order.customerAddress && (
                        <div className="flex items-start text-sm text-gray-600">
                            <MapPin size={14} className="mr-2 mt-0.5 shrink-0" />
                            <span className="whitespace-pre-line">{order.customerAddress}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Auftragsbeschreibung</label>
                        {order.description ? (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-gray-800 whitespace-pre-wrap mt-1">
                                {order.description}
                            </div>
                        ) : (
                            <p className="text-gray-400 italic text-sm mt-1">Keine Beschreibung.</p>
                        )}
                    </div>
                    
                    {/* Employees */}
                    {order.employees && order.employees.length > 0 && (
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bearbeiter</label>
                            <div className="flex gap-2">
                                {order.employees.map((emp, i) => (
                                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700 border border-gray-200">
                                        {emp}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Visuals / Internal Images */}
        {displayFiles.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-700 flex items-center">
                        <ImageIcon size={18} className="mr-2 text-purple-600" />
                        Ansichten & Interne Bilder
                    </h3>
                </div>
                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {displayFiles.map((file: any, idx: number) => (
                        <div 
                            key={idx} 
                            className="group border rounded-lg overflow-hidden cursor-pointer bg-gray-50 relative hover:shadow-md transition-all"
                            onClick={() => setLightboxImage(file.url)}
                        >
                            <div className="aspect-square flex items-center justify-center p-2 bg-white">
                                <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow text-white ${
                                    file.type === 'internal' ? 'bg-orange-500' : 'bg-blue-500'
                                }`}>
                                    {file.type === 'internal' ? 'INTERN' : 'VORSCHAU'}
                                </span>
                            </div>
                            <div className="p-2 text-xs text-center font-medium text-gray-600 truncate border-t border-gray-100">
                                {file.name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center">
                    <FileText size={18} className="mr-2 text-green-600" />
                    Bestellte Ware / Positionen
                </h3>
                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                    {items.reduce((sum, item) => sum + item.quantity, 0)} Teile
                </span>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Menge</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Artikel</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Farbe / Größe</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Notizen</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Keine Positionen eingetragen.</td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-lg text-gray-900 w-20">{item.quantity}x</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{item.item_name}</div>
                                        {item.item_number && <div className="text-xs text-gray-500 font-mono mt-0.5">{item.item_number}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="flex flex-col">
                                            <span>{item.color || '-'}</span>
                                            <span className="font-bold">{item.size || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 italic max-w-xs truncate" title={item.notes}>
                                        {item.notes || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            item.status === 'received' ? 'bg-green-100 text-green-800' :
                                            item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {item.status === 'received' ? 'Da' : item.status === 'ordered' ? 'Bestellt' : 'Offen'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-center text-xs text-gray-400 px-2">
            <span>Interne Laufzettel-Ansicht</span>
            <span>ID: {order.id}</span>
        </div>

      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxImage} className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
            <button 
                className="absolute -top-4 -right-4 bg-white text-black rounded-full p-2 hover:bg-gray-200 shadow-lg transform hover:scale-110 transition-all" 
                onClick={() => setLightboxImage(null)}
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
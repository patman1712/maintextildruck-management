import { Order } from "@/store";
import { Calendar, User, ShoppingCart, FileText, Printer, PenTool, Eye } from "lucide-react";
import { useAppStore } from "@/store";

interface OrderPrintViewProps {
  order: Order;
}

export default function OrderPrintView({ order }: OrderPrintViewProps) {
  const logoUrl = useAppStore((state) => state.logoUrl);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'preview': return <Eye size={16} />;
      case 'vector': return <PenTool size={16} />;
      case 'print': return <Printer size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getFileLabel = (type: string) => {
    switch (type) {
      case 'preview': return 'Vorschau';
      case 'vector': return 'Rohdaten';
      case 'print': return 'Druckdaten';
      case 'internal': return 'Intern';
      default: return 'Datei';
    }
  };

  return (
    <div className="hidden print:block font-sans text-slate-900 bg-white w-full h-full absolute top-0 left-0 z-50">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-6 print:mt-8 print:mx-8">
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 object-contain mb-4" />
          ) : (
            <div className="text-2xl font-bold text-red-700 mb-2">MAIN TEXTILDRUCK</div>
          )}
          <h1 className="text-3xl font-bold text-slate-800 uppercase tracking-wide">Produktionsauftrag</h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-slate-200 mb-2">#{order.orderNumber || order.id.slice(0, 8)}</div>
          <div className="text-sm text-slate-500">
            <p>Erstellt: {formatDate(order.createdAt)}</p>
            <p className="font-bold text-red-600 mt-1 text-lg">Deadline: {formatDate(order.deadline)}</p>
          </div>
        </div>
      </div>

      <div className="print:mx-8">
      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-12 mb-8">
        {/* Customer */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
            <User size={14} className="mr-1" /> Kunde
          </h3>
          <div className="bg-gray-50 p-4 rounded border border-gray-100">
            <p className="font-bold text-lg">{order.customerName}</p>
            {order.customerContactPerson && <p className="text-slate-600">{order.customerContactPerson}</p>}
            {order.customerAddress && (
              <p className="text-slate-600 whitespace-pre-line mt-2 text-sm">{order.customerAddress}</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
              {order.customerEmail && <p>E-Mail: {order.customerEmail}</p>}
              {order.customerPhone && <p>Tel: {order.customerPhone}</p>}
            </div>
          </div>
        </div>

        {/* Internal Info */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Interne Infos</h3>
          <div className="bg-gray-50 p-4 rounded border border-gray-100 h-full">
            <div className="mb-4">
              <span className="text-xs text-slate-500 block mb-1">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
                order.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'
              }`}>
                {order.status === 'active' ? 'In Produktion' : order.status}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Mitarbeiter:</span>
              <div className="flex flex-wrap gap-1">
                {order.employees.length > 0 ? (
                  order.employees.map((emp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-sm">
                      {emp}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic text-sm">-</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {order.description && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Beschreibung / Anmerkungen</h3>
          <div className="bg-white border-l-4 border-red-500 p-4 shadow-sm">
            <p className="whitespace-pre-wrap text-slate-700">{order.description}</p>
          </div>
        </div>
      )}

      {/* Order Items */}
      {order.orderItems && order.orderItems.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
            <ShoppingCart size={14} className="mr-1" /> Artikel & Textilien
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-left">
                <th className="p-3 font-semibold text-slate-700">Artikel</th>
                <th className="p-3 font-semibold text-slate-700">Menge</th>
                <th className="p-3 font-semibold text-slate-700">Größe</th>
                <th className="p-3 font-semibold text-slate-700">Farbe</th>
                <th className="p-3 font-semibold text-slate-700">Lieferant</th>
                <th className="p-3 font-semibold text-slate-700 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.orderItems.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-3">
                    <div className="font-medium">{item.itemName}</div>
                    {item.itemNumber && <div className="text-xs text-slate-500">{item.itemNumber}</div>}
                  </td>
                  <td className="p-3 font-bold">{item.quantity}</td>
                  <td className="p-3">{item.size}</td>
                  <td className="p-3">{item.color}</td>
                  <td className="p-3 text-slate-600">{item.supplierName}</td>
                  <td className="p-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.status === 'received' ? 'bg-green-100 text-green-800' : 
                      item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.status === 'received' ? 'Vorhanden' : 
                       item.status === 'ordered' ? 'Bestellt' : 'Offen'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Files List */}
      {order.files && order.files.length > 0 && (
        <div className="mb-8 page-break-inside-avoid">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
            <FileText size={14} className="mr-1" /> Zugehörige Dateien
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {order.files.map((file, idx) => {
              // Check if it's an image or has a thumbnail to display larger
              const isImage = file.thumbnail || (file.url && file.name.match(/\.(jpg|jpeg|png|webp)$/i));
              
              if (isImage) {
                  return (
                    <div key={idx} className="flex flex-col p-3 border border-slate-200 rounded bg-white page-break-inside-avoid">
                        <div className="flex items-center mb-2">
                            <div className={`p-1.5 rounded mr-2 ${
                                file.type === 'print' ? 'bg-red-50 text-red-600' :
                                file.type === 'vector' ? 'bg-blue-50 text-blue-600' :
                                file.type === 'internal' ? 'bg-amber-50 text-amber-600' :
                                'bg-gray-50 text-gray-600'
                            }`}>
                                {getFileIcon(file.type)}
                            </div>
                            <div className="overflow-hidden">
                                <div className="font-medium text-sm truncate">{file.name}</div>
                                <div className="text-xs text-slate-500 uppercase">{getFileLabel(file.type)}</div>
                            </div>
                        </div>
                        <div className="w-full h-48 bg-gray-50 border border-gray-100 rounded overflow-hidden flex items-center justify-center">
                            <img 
                                src={file.thumbnail || file.url} 
                                alt={file.name}
                                className="max-w-full max-h-full object-contain" 
                            />
                        </div>
                    </div>
                  );
              }

              return (
              <div key={idx} className="flex items-center p-2 border border-slate-200 rounded bg-white">
                <div className={`p-2 rounded mr-3 ${
                  file.type === 'print' ? 'bg-red-50 text-red-600' :
                  file.type === 'vector' ? 'bg-blue-50 text-blue-600' :
                  file.type === 'internal' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {getFileIcon(file.type)}
                </div>
                <div className="overflow-hidden">
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 uppercase">{getFileLabel(file.type)}</div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 flex justify-between">
        <span>Gedruckt am: {new Date().toLocaleString('de-DE')}</span>
        <span>Seite 1 von 1</span>
      </div>
      </div>
    </div>
  );
}

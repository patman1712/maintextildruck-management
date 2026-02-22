import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { ArrowLeft, Calendar, User, FileText, Download, Eye, Printer, PenTool } from "lucide-react";

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const [order, setOrder] = useState(orders.find(o => o.id === id));

  useEffect(() => {
    if (loading) return; // Wait for data
    const foundOrder = orders.find(o => o.id === id);
    if (foundOrder) {
      setOrder(foundOrder);
    } else {
      navigate("/dashboard/orders");
    }
  }, [id, orders, navigate, loading]);

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Auftragsdaten...</div>;
  if (!order) return null;

  const downloadFile = async (file: { name: string, url?: string }) => {
    if (!file.url) {
      alert(`Keine URL für ${file.name} vorhanden.`);
      return;
    }

    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.name; // Force download with original filename
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab
      window.open(file.url, '_blank');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={18} className="mr-1" /> Zurück zur Übersicht
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{order.title}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center text-gray-500 text-sm gap-4">
              <span className="flex items-center"><User size={16} className="mr-1" /> {order.customerName}</span>
              <span className="flex items-center"><Calendar size={16} className="mr-1" /> Deadline: {new Date(order.deadline).toLocaleDateString('de-DE')}</span>
              <span className="flex items-center">Eingang: {new Date(order.createdAt).toLocaleDateString('de-DE')}</span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            order.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {order.status === 'active' ? 'In Bearbeitung' : 'Abgeschlossen'}
          </span>
        </div>

        <div className="p-8 space-y-8">
          {/* Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Kundendaten</h3>
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
                <p><span className="font-medium">Name:</span> {order.customerName}</p>
                {order.customerEmail && <p><span className="font-medium">E-Mail:</span> <a href={`mailto:${order.customerEmail}`} className="text-red-600 hover:underline">{order.customerEmail}</a></p>}
                {order.customerPhone && <p><span className="font-medium">Telefon:</span> {order.customerPhone}</p>}
                {order.customerAddress && (
                  <p className="flex items-start">
                    <span className="font-medium mr-1 whitespace-nowrap">Adresse:</span>
                    <span className="whitespace-pre-line">{order.customerAddress}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Beschreibung</h3>
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 min-h-[120px]">
                {order.description ? order.description : <span className="text-gray-400 italic">Keine Beschreibung vorhanden.</span>}
              </div>
            </div>
          </div>

          {/* Employees */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Zuständige Mitarbeiter</h3>
            <div className="flex flex-wrap gap-2">
              {order.employees.length > 0 ? (
                order.employees.map((emp, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-100">
                    {emp}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 italic text-sm">Keine Mitarbeiter zugewiesen.</span>
              )}
            </div>
          </div>

          {/* Files Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Dateien</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Preview Files */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                  <Eye size={16} className="mr-2 text-gray-500" /> Vorschauen
                </h4>
                {order.files.filter(f => f.type === 'preview').length > 0 ? (
                  <ul className="space-y-2">
                    {order.files.filter(f => f.type === 'preview').map((file, idx) => (
                      <li key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-gray-200">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => downloadFile(file)} className="text-gray-400 hover:text-red-600" title="Herunterladen">
                          <Download size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">Keine Dateien.</p>
                )}
              </div>

              {/* Vector Files */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                  <PenTool size={16} className="mr-2 text-blue-600" /> Rohdaten
                </h4>
                {order.files.filter(f => f.type === 'vector').length > 0 ? (
                  <ul className="space-y-2">
                    {order.files.filter(f => f.type === 'vector').map((file, idx) => (
                      <li key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-blue-100">
                        <span className="truncate max-w-[150px] text-blue-900">{file.name}</span>
                        <button onClick={() => downloadFile(file)} className="text-blue-400 hover:text-blue-700" title="Herunterladen">
                          <Download size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-blue-400 italic">Keine Dateien.</p>
                )}
              </div>

              {/* Print Files */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <h4 className="font-medium text-red-800 mb-3 flex items-center">
                  <Printer size={16} className="mr-2 text-red-600" /> Fertige Druckdaten
                </h4>
                {order.files.filter(f => f.type === 'print').length > 0 ? (
                  <ul className="space-y-2">
                    {order.files.filter(f => f.type === 'print').map((file, idx) => (
                      <li key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-red-100">
                        <span className="truncate max-w-[150px] text-red-900">{file.name}</span>
                        <button onClick={() => downloadFile(file)} className="text-red-400 hover:text-red-700" title="Herunterladen">
                          <Download size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-red-400 italic">Keine Dateien.</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { ArrowLeft, Calendar, User, FileText, Download, Eye, Printer, PenTool, Trash2, ShoppingCart, ExternalLink } from "lucide-react";

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const deleteOrder = useAppStore((state) => state.deleteOrder);
  const suppliers = useAppStore((state) => state.suppliers);
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

  const handleDeleteFile = async (fileToDelete: { name: string, url?: string, type: string }) => {
    if (!order) return;
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.name}" wirklich löschen?`)) return;

    // Remove from local state and store
    const updatedFiles = order.files.filter(f => f.url !== fileToDelete.url);
    const updatedOrder = { ...order, files: updatedFiles };
    
    // Optimistic update
    setOrder(updatedOrder);
    
    // Update backend (DB)
    await updateOrder(order.id, { files: updatedFiles });

    // Delete physical file from server
    if (fileToDelete.url && fileToDelete.url.startsWith('/uploads/')) {
        try {
            await fetch('/api/upload/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: fileToDelete.url })
            });
        } catch (err) {
            console.error("Failed to delete file from server", err);
        }
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (confirm(`Möchten Sie den Auftrag "${order.title}" wirklich löschen? Er wird archiviert, damit die Druckdaten erhalten bleiben.`)) {
      await deleteOrder(order.id);
      navigate("/dashboard/orders");
    }
  };

  const getSupplierUrl = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier?.website) return null;
    return supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`;
  };

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

  const renderFilePreview = (file: { name: string, url?: string, thumbnail?: string }) => {
    if (!file.url) return <span className="truncate max-w-[150px]">{file.name}</span>;
    
    // Check if thumbnail exists
    if (file.thumbnail) {
        return (
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
              <img src={file.thumbnail} alt={file.name} className="h-full w-full object-cover" />
            </div>
            <span className="truncate max-w-[120px]">{file.name}</span>
          </div>
        );
    }
    
    // Check if image
    const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isImage) {
      return (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
            <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
          </div>
          <span className="truncate max-w-[120px]">{file.name}</span>
        </div>
      );
    }
    return <span className="truncate max-w-[150px]">{file.name}</span>;
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
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {order.status === 'active' ? 'In Bearbeitung' : 'Abgeschlossen'}
            </span>
            <button 
              onClick={handleDelete} 
              className="ml-4 flex items-center px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors text-sm font-medium shadow-sm"
              title="Auftrag löschen"
            >
              <Trash2 size={16} className="mr-2" />
              Löschen
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Kundendaten</h3>
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
                <p><span className="font-medium">Name:</span> {order.customerName}</p>
                {order.customerContactPerson && <p><span className="font-medium">Ansprechpartner:</span> {order.customerContactPerson}</p>}
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

          {/* Order Items / Goods */}
          {order.orderItems && order.orderItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2 flex items-center">
                <ShoppingCart className="mr-2 text-red-600" size={20} />
                Benötigte Ware
              </h3>
              
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Menge / Größe</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lieferant</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {order.orderItems.map((item) => {
                            const supplierUrl = getSupplierUrl(item.supplierId);
                            return (
                                <tr key={item.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                                        {item.itemNumber && <div className="text-xs text-gray-500">Art: {item.itemNumber}</div>}
                                        {item.color && <div className="text-xs text-gray-500">Farbe: {item.color}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div className="font-bold">{item.quantity > 1 ? `${item.quantity}x` : ''}</div>
                                        <div className="text-gray-500">{item.size}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center">
                                            <span>{item.supplierName || 'Unbekannt'}</span>
                                            {supplierUrl && (
                                                <a href={supplierUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:text-blue-800" title="Zum Shop">
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            item.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' : 
                                            item.status === 'received' ? 'bg-green-100 text-green-800' : 
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {item.status === 'ordered' ? 'Bestellt' : 
                                             item.status === 'received' ? 'Erhalten' : 'Offen'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
              </div>
            </div>
          )}

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
                    {renderFilePreview(file)}
                    <div className="flex space-x-1">
                      <button onClick={() => downloadFile(file)} className="text-gray-400 hover:text-red-600 p-1" title="Herunterladen">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleDeleteFile({...file, type: 'preview'})} className="text-gray-400 hover:text-red-600 p-1" title="Löschen">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                    {renderFilePreview(file)}
                    <div className="flex space-x-1">
                      <button onClick={() => downloadFile(file)} className="text-blue-400 hover:text-blue-700 p-1" title="Herunterladen">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleDeleteFile({...file, type: 'vector'})} className="text-blue-400 hover:text-blue-700 p-1" title="Löschen">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                    {renderFilePreview(file)}
                    <div className="flex space-x-1">
                      <button onClick={() => downloadFile(file)} className="text-red-400 hover:text-red-700 p-1" title="Herunterladen">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleDeleteFile({...file, type: 'print'})} className="text-red-400 hover:text-red-700 p-1" title="Löschen">
                        <Trash2 size={16} />
                      </button>
                    </div>
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

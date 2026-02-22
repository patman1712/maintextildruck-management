import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, Order } from "@/store";
import { ArrowLeft, User, FileText, Download, Printer, Phone, Mail, MapPin, Edit, Save, X, Trash2, Pencil, Upload } from "lucide-react";

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customers = useAppStore((state) => state.customers);
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const addOrder = useAppStore((state) => state.addOrder); // We need this to create a "dummy" order for direct uploads

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<{name: string, email: string, phone: string, address: string} | null>(null);
  
  // State for direct upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  
  const [customer, setCustomer] = useState(customers.find(c => c.id === id));
  const [customerOrders, setCustomerOrders] = useState(
    orders.filter(o => o.customerId === id || o.customerName === customer?.name)
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading) return;
    const foundCustomer = customers.find(c => c.id === id);
    if (foundCustomer) {
      setCustomer(foundCustomer);
      setEditedCustomer({
        name: foundCustomer.name,
        email: foundCustomer.email,
        phone: foundCustomer.phone,
        address: foundCustomer.address
      });
      // Filter orders by customer ID (preferred) or name (fallback)
      setCustomerOrders(orders.filter(o => o.customerId === id || o.customerName === foundCustomer.name));
    } else {
      navigate("/dashboard/customers");
    }
  }, [id, customers, orders, navigate, loading]);

  const handleSaveCustomer = async () => {
    if (!editedCustomer || !customer) return;
    
    await updateCustomer(customer.id, editedCustomer);
    setCustomer({ ...customer, ...editedCustomer });
    setIsEditing(false);
  };

  const [editingFile, setEditingFile] = useState<{url: string, name: string} | null>(null);

  const startRename = (file: {name: string, url?: string, customName?: string}) => {
    if (!file.url) return;
    setEditingFile({ url: file.url, name: file.customName || file.name });
  };

  const saveRename = async () => {
    if (!editingFile) return;
    await handleRenameFile({ name: "", url: editingFile.url }, editingFile.name);
    setEditingFile(null);
  };

  const handleRenameFile = async (fileToRename: { name: string, url?: string }, newName: string) => {
    const order = customerOrders.find(o => o.files.some(f => f.url === fileToRename.url));
    if (!order) return;

    const updatedFiles = order.files.map(f => 
      f.url === fileToRename.url ? { ...f, customName: newName } : f
    );

    const updatedOrder = { ...order, files: updatedFiles };
    setCustomerOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    await updateOrder(order.id, { files: updatedFiles });
  };

  const handleDeleteFile = async (fileToDelete: { name: string, url?: string, orderTitle?: string, customName?: string }) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich löschen? Sie wird auch aus dem Auftrag entfernt.`)) return;

    const order = customerOrders.find(o => o.files.some(f => f.url === fileToDelete.url));
    if (!order) return;

    const updatedFiles = order.files.filter(f => f.url !== fileToDelete.url);
    
    // Update local state first for immediate feedback
    const updatedOrder = { ...order, files: updatedFiles };
    setCustomerOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

    // Update in backend (this updates the DB record)
    await updateOrder(order.id, { files: updatedFiles });
    
    // Attempt to delete file from server
    if (fileToDelete.url) {
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
  
  const handleDirectUpload = async () => {
    if (!uploadFile || !customer) return;

    try {
        const formData = new FormData();
        formData.append('print', uploadFile);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success && data.files && data.files.print && data.files.print.length > 0) {
            const uploadedFile = data.files.print[0];
            const fileUrl = uploadedFile.path;
            
            // Create a "storage" order for this file
            const newOrder: Order = {
                id: Math.random().toString(36).substr(2, 9),
                title: "Direkter Dateiupload",
                customerId: customer.id,
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                customerAddress: customer.address,
                deadline: new Date().toISOString().split('T')[0],
                status: "archived", // Special status for direct uploads
                steps: { processing: true, produced: true, invoiced: true },
                createdAt: new Date().toISOString(),
                description: "Direkt im Kundenbereich hochgeladen",
                employees: [],
                files: [{
                    name: uploadedFile.originalName,
                    type: 'print' as const,
                    url: fileUrl,
                    customName: uploadFileName || uploadedFile.originalName
                }]
            };

            await addOrder(newOrder);
            
            // Refresh orders
            fetchData();
            
            setIsUploading(false);
            setUploadFile(null);
            setUploadFileName("");
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload fehlgeschlagen.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Kundendaten...</div>;
  if (!customer) return null;

  // Extract all print files (DTF) from customer's orders
  // Check if files exist and are arrays before filtering
  const allPrintFiles = customerOrders.flatMap(order => 
    (order.files || [])
      .filter(f => f.type === 'print')
      .map(f => ({ ...f, orderTitle: order.title, orderDate: order.createdAt }))
  );

  // Sort by date desc (newest first)
  allPrintFiles.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  // Deduplicate by URL (keep the newest one)
  const uniqueFilesMap = new Map();
  allPrintFiles.forEach(file => {
    if (file.url && !uniqueFilesMap.has(file.url)) {
        uniqueFilesMap.set(file.url, file);
    }
  });
  
  const printFiles = Array.from(uniqueFilesMap.values());

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
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(file.url, '_blank');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={18} className="mr-1" /> Zurück zur Übersicht
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200 flex items-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-2xl mr-6 border border-red-200">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <input 
                type="text" 
                value={editedCustomer?.name || ""} 
                onChange={(e) => setEditedCustomer(prev => ({...prev!, name: e.target.value}))}
                className="text-2xl font-bold text-slate-800 border border-gray-300 rounded px-2 py-1 w-full max-w-md focus:ring-red-500 focus:border-red-500"
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
            )}
            <p className="text-gray-500 text-sm mt-1">Kunde seit {new Date().getFullYear()}</p>
          </div>
          
          <div className="ml-4">
            {isEditing ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="Abbrechen"
                >
                  <X size={20} />
                </button>
                <button 
                  onClick={handleSaveCustomer}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors"
                  title="Speichern"
                >
                  <Save size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Bearbeiten"
              >
                <Edit size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Kontaktdaten</h3>
            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <Mail className="mr-3 text-gray-400" size={20} />
                {isEditing ? (
                  <input 
                    type="email" 
                    value={editedCustomer?.email || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, email: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="E-Mail Adresse"
                  />
                ) : (
                  customer.email ? (
                    <a href={`mailto:${customer.email}`} className="hover:text-red-600 transition-colors">{customer.email}</a>
                  ) : (
                    <span className="text-gray-400 italic">Keine E-Mail hinterlegt</span>
                  )
                )}
              </div>
              
              <div className="flex items-center text-gray-700">
                <Phone className="mr-3 text-gray-400" size={20} />
                {isEditing ? (
                  <input 
                    type="tel" 
                    value={editedCustomer?.phone || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, phone: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="Telefonnummer"
                  />
                ) : (
                  customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="hover:text-red-600 transition-colors">{customer.phone}</a>
                  ) : (
                    <span className="text-gray-400 italic">Keine Telefonnummer hinterlegt</span>
                  )
                )}
              </div>
              
              <div className="flex items-start text-gray-700">
                <MapPin className="mr-3 mt-1 text-gray-400" size={20} />
                {isEditing ? (
                  <textarea 
                    value={editedCustomer?.address || ""} 
                    onChange={(e) => setEditedCustomer(prev => ({...prev!, address: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                    placeholder="Adresse"
                    rows={3}
                  />
                ) : (
                  customer.address ? (
                    <span className="whitespace-pre-line">{customer.address}</span>
                  ) : (
                    <span className="text-gray-400 italic">Keine Adresse hinterlegt</span>
                  )
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Statistik</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
                <span className="block text-2xl font-bold text-blue-700">{customerOrders.length}</span>
                <span className="text-sm text-blue-600">Aufträge Gesamt</span>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
                <span className="block text-2xl font-bold text-green-700">
                  {customerOrders.filter(o => o.status === 'completed').length}
                </span>
                <span className="text-sm text-green-600">Abgeschlossen</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DTF Files Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-8 py-6 border-b border-gray-200 bg-red-50">
          <h2 className="text-xl font-bold text-red-800 flex items-center">
            <Printer className="mr-2" />
            Gespeicherte Druckdaten (DTF)
          </h2>
          <p className="text-sm text-red-600 mt-1">
            Alle fertigen Druckdaten aus vergangenen Aufträgen dieses Kunden (auch aus aktuellen Aufträgen)
          </p>
          
          <button 
            onClick={() => setIsUploading(true)}
            className="mt-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium flex items-center shadow-sm"
          >
            <Upload size={16} className="mr-2" />
            Datei direkt hochladen
          </button>
        </div>

        {isUploading && (
            <div className="bg-red-50 px-8 py-4 border-b border-red-100 animate-in fade-in slide-in-from-top-4">
                <div className="max-w-md bg-white p-4 rounded-lg shadow-sm border border-red-100">
                    <h4 className="font-bold text-gray-800 mb-3 text-sm">Neue Druckdatei hochladen</h4>
                    
                    <input 
                        type="file" 
                        accept=".png"
                        onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                        className="block w-full text-sm text-gray-500 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                    
                    {uploadFile && (
                        <input 
                            type="text" 
                            placeholder="Titel vergeben (optional)"
                            value={uploadFileName}
                            onChange={(e) => setUploadFileName(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 text-sm mb-3 focus:ring-red-500 focus:border-red-500"
                        />
                    )}
                    
                    <div className="flex justify-end space-x-2">
                        <button 
                            onClick={() => {
                                setIsUploading(false);
                                setUploadFile(null);
                                setUploadFileName("");
                            }}
                            className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
                        >
                            Abbrechen
                        </button>
                        <button 
                            onClick={handleDirectUpload}
                            disabled={!uploadFile}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                            Hochladen
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="p-8">
          {printFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {printFiles.map((file, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                      DTF / PNG
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => downloadFile(file)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Herunterladen"
                      >
                        <Download size={20} />
                      </button>
                      <button 
                        onClick={() => handleDeleteFile(file)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Löschen"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="h-32 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative group-hover:bg-gray-50 transition-colors">
                    {file.url ? (
                      <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                    ) : (
                      <Printer size={32} className="text-gray-300" />
                    )}
                    
                    {/* Rename Overlay */}
                    {editingFile && editingFile.url === file.url && (
                        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-2 z-10">
                            <input 
                                type="text" 
                                value={editingFile.name}
                                onChange={(e) => setEditingFile({...editingFile, name: e.target.value})}
                                className="w-full text-xs border border-gray-300 rounded p-1 mb-2"
                                autoFocus
                            />
                            <div className="flex space-x-2">
                                <button onClick={saveRename} className="bg-green-500 text-white p-1 rounded hover:bg-green-600"><Save size={14}/></button>
                                <button onClick={() => setEditingFile(null)} className="bg-gray-400 text-white p-1 rounded hover:bg-gray-500"><X size={14}/></button>
                            </div>
                        </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-medium text-gray-800 truncate flex-1 mr-2" title={file.customName || file.name}>
                        {file.customName || file.name}
                    </h4>
                    <button onClick={() => startRename(file)} className="text-gray-400 hover:text-blue-600 p-1" title="Umbenennen">
                        <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center">
                    <FileText size={12} className="mr-1" />
                    Aus: {file.orderTitle}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(file.orderDate).toLocaleDateString('de-DE')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <Printer size={48} className="mx-auto text-gray-300 mb-4" />
              <p>Keine Druckdaten (DTF) für diesen Kunden gefunden.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, Order } from "@/store";
import { ArrowLeft, User, FileText, Download, Printer, Phone, Mail, MapPin, Edit, Save, X, Trash2, Pencil, Upload, ShoppingBag, CheckCircle, AlertCircle, Link, Search } from "lucide-react";

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customers = useAppStore((state) => state.customers);
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const addOrder = useAppStore((state) => state.addOrder);

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<{name: string, email: string, phone: string, address: string} | null>(null);
  
  // State for direct upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'shopware'>('overview');
  
  const [customer, setCustomer] = useState(customers.find(c => c.id === id));
  const [customerOrders, setCustomerOrders] = useState(
    orders.filter(o => o.customerId === id || o.customerName === customer?.name)
  );

  // Shopware State
  const [shopwareConfig, setShopwareConfig] = useState({
      url: '',
      accessKey: '',
      secretKey: ''
  });
  const [shopwareStatus, setShopwareStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [shopwareMessage, setShopwareMessage] = useState('');
  const [shopwareProducts, setShopwareProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [mappings, setMappings] = useState<any[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<string | null>(null); // Product ID for mapping
  const [mappingSearch, setMappingSearch] = useState('');

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
      setShopwareConfig({
          url: foundCustomer.shopwareUrl || '',
          accessKey: foundCustomer.shopwareAccessKey || '',
          secretKey: foundCustomer.shopwareSecretKey || ''
      });
      setCustomerOrders(orders.filter(o => o.customerId === id || o.customerName === foundCustomer.name));
    } else {
      navigate("/dashboard/customers");
    }
  }, [id, customers, orders, navigate, loading]);

  useEffect(() => {
      if (activeTab === 'shopware' && customer && customer.shopwareUrl) {
          fetchMappings();
      }
  }, [activeTab, customer]);

  const handleSaveCustomer = async () => {
    if (!editedCustomer || !customer) return;
    
    await updateCustomer(customer.id, editedCustomer);
    setCustomer({ ...customer, ...editedCustomer });
    setIsEditing(false);
  };

  // --- Shopware Logic ---
  
  const handleSaveShopwareConfig = async () => {
      if (!customer) return;
      await updateCustomer(customer.id, {
          shopwareUrl: shopwareConfig.url,
          shopwareAccessKey: shopwareConfig.accessKey,
          shopwareSecretKey: shopwareConfig.secretKey
      });
      setShopwareStatus('idle');
      setShopwareMessage('Konfiguration gespeichert.');
  };

  const handleTestConnection = async () => {
      setShopwareStatus('testing');
      setShopwareMessage('');
      try {
          const res = await fetch('/api/shopware/test-connection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(shopwareConfig)
          });
          const data = await res.json();
          if (data.success) {
              setShopwareStatus('success');
              setShopwareMessage('Verbindung erfolgreich!');
          } else {
              setShopwareStatus('error');
              setShopwareMessage(data.error || 'Verbindung fehlgeschlagen');
          }
      } catch (err) {
          setShopwareStatus('error');
          setShopwareMessage('Netzwerkfehler');
      }
  };

  const fetchShopwareProducts = async () => {
      if (!customer) return;
      setIsLoadingProducts(true);
      try {
          const res = await fetch(`/api/shopware/products/${customer.id}`);
          const data = await res.json();
          if (data.success) {
              setShopwareProducts(data.data);
          } else {
              alert('Fehler beim Laden der Produkte: ' + data.error);
          }
      } catch (err) {
          console.error(err);
          alert('Netzwerkfehler beim Laden der Produkte');
      } finally {
          setIsLoadingProducts(false);
      }
  };

  const fetchMappings = async () => {
      if (!customer) return;
      try {
          const res = await fetch(`/api/shopware/mappings/${customer.id}`);
          const data = await res.json();
          if (data.success) {
              setMappings(data.data);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleCreateMapping = async (product: any, file: any) => {
      if (!customer) return;
      try {
          const res = await fetch('/api/shopware/mappings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  customerId: customer.id,
                  shopwareProductId: product.id,
                  shopwareProductNumber: product.productNumber,
                  shopwareProductName: product.name,
                  fileUrl: file.url,
                  fileName: file.customName || file.name
              })
          });
          const data = await res.json();
          if (data.success) {
              fetchMappings();
              setShowMappingModal(null);
          }
      } catch (err) {
          console.error(err);
          alert('Fehler beim Speichern der Verknüpfung');
      }
  };

  const handleDeleteMapping = async (mappingId: string) => {
      if (!confirm('Verknüpfung wirklich löschen?')) return;
      try {
          await fetch(`/api/shopware/mappings/${mappingId}`, {
              method: 'DELETE'
          });
          fetchMappings();
      } catch (err) {
          console.error(err);
      }
  };

  // --- File Logic ---

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

  const handleDeleteFile = async (fileToDelete: { name: string, url?: string, orderTitle?: string, customName?: string, thumbnail?: string }) => {
    if (!confirm(`Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich löschen? Sie wird auch aus dem Auftrag entfernt.`)) return;

    const order = customerOrders.find(o => o.files && Array.isArray(o.files) && o.files.some(f => f.url === fileToDelete.url));
    if (!order) return;

    const updatedFiles = order.files.filter(f => f.url !== fileToDelete.url);
    const updatedOrder = { ...order, files: updatedFiles };
    setCustomerOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

    await updateOrder(order.id, { files: updatedFiles });
    
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
    fetchData();
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
            const thumbnail = uploadedFile.thumbnail;
            
            const newOrder: Order = {
                id: Math.random().toString(36).substr(2, 9),
                title: "Direkter Dateiupload",
                customerId: customer.id,
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                customerAddress: customer.address,
                deadline: new Date().toISOString().split('T')[0],
                status: "archived",
                steps: { processing: true, produced: true, invoiced: true },
                createdAt: new Date().toISOString(),
                description: "Direkt im Kundenbereich hochgeladen",
                employees: [],
                files: [{
                    name: uploadedFile.originalName,
                    type: 'print' as const,
                    url: fileUrl,
                    thumbnail: thumbnail,
                    customName: uploadFileName || uploadedFile.originalName
                }]
            };

            await addOrder(newOrder);
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

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Kundendaten...</div>;
  if (!customer) return null;

  // Extract Print Files
  const allPrintFiles = customerOrders.flatMap(order => 
    (Array.isArray(order.files) ? order.files : [])
      .filter(f => f.type === 'print')
      .map(f => ({ ...f, orderTitle: order.title, orderDate: order.createdAt }))
  );
  allPrintFiles.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  const uniqueFilesMap = new Map();
  allPrintFiles.forEach(file => {
    if (file.url && !uniqueFilesMap.has(file.url)) {
        uniqueFilesMap.set(file.url, file);
    }
  });
  const printFiles = Array.from(uniqueFilesMap.values());

  const filteredPrintFilesForMapping = printFiles.filter(f => 
      (f.customName || f.name).toLowerCase().includes(mappingSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={18} className="mr-1" /> Zurück zur Übersicht
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 px-8">
            <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <User size={16} className="mr-2" />
                    Übersicht
                </div>
            </button>
            <button
                onClick={() => setActiveTab('files')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'files' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <Printer size={16} className="mr-2" />
                    Druckdaten ({printFiles.length})
                </div>
            </button>
            <button
                onClick={() => setActiveTab('shopware')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'shopware' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <ShoppingBag size={16} className="mr-2" />
                    Shopware Anbindung
                </div>
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
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
        )}

        {/* TAB: FILES */}
        {activeTab === 'files' && (
            <div className="animate-in fade-in">
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Gespeicherte Druckdaten</h3>
                        <p className="text-sm text-gray-500">Alle Dateien aus Aufträgen und Uploads</p>
                    </div>
                    <button 
                        onClick={() => setIsUploading(true)}
                        className="bg-white text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium flex items-center shadow-sm"
                    >
                        <Upload size={16} className="mr-2" />
                        Datei hochladen
                    </button>
                </div>

                {isUploading && (
                    <div className="bg-red-50 px-8 py-4 border-b border-red-100 animate-in fade-in slide-in-from-top-4">
                        <div className="max-w-md bg-white p-4 rounded-lg shadow-sm border border-red-100">
                            <h4 className="font-bold text-gray-800 mb-3 text-sm">Neue Druckdatei hochladen</h4>
                            <input 
                                type="file" 
                                accept=".png,image/png,.pdf,application/pdf"
                                onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                className="block w-full text-sm text-gray-500 mb-3"
                            />
                            {uploadFile && (
                                <input 
                                    type="text" 
                                    placeholder="Titel vergeben (optional)"
                                    value={uploadFileName}
                                    onChange={(e) => setUploadFileName(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 text-sm mb-3"
                                />
                            )}
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => { setIsUploading(false); setUploadFile(null); }} className="px-3 py-1.5 text-gray-600 text-sm">Abbrechen</button>
                                <button onClick={handleDirectUpload} disabled={!uploadFile} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded disabled:opacity-50">Hochladen</button>
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
                                {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DTF / PNG'}
                                </div>
                                <div className="flex space-x-1">
                                <button onClick={() => downloadFile(file)} className="text-gray-400 hover:text-red-600 p-1"><Download size={20} /></button>
                                <button onClick={() => handleDeleteFile(file)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={20} /></button>
                                </div>
                            </div>
                            
                            <div className="h-32 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden border border-gray-100 relative group-hover:bg-gray-50 transition-colors">
                                {file.thumbnail ? (
                                    <img src={file.thumbnail} alt={file.name} className="w-full h-full object-contain" />
                                ) : file.url ? (
                                <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                                ) : (
                                <Printer size={32} className="text-gray-300" />
                                )}
                                
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
                                <button onClick={() => startRename(file)} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                            </div>
                            <p className="text-xs text-gray-500 flex items-center">
                                <FileText size={12} className="mr-1" />
                                Aus: {file.orderTitle}
                            </p>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                        <Printer size={48} className="mx-auto text-gray-300 mb-4" />
                        <p>Keine Druckdaten vorhanden.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TAB: SHOPWARE */}
        {activeTab === 'shopware' && (
            <div className="p-8 animate-in fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Config Column */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-8">
                        <h3 className="font-bold text-lg mb-4 flex items-center">
                            <ShoppingBag className="mr-2" size={20} />
                            Konfiguration
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shop URL</label>
                                <input 
                                    type="text" 
                                    value={shopwareConfig.url} 
                                    onChange={(e) => setShopwareConfig({...shopwareConfig, url: e.target.value})}
                                    placeholder="https://mein-shop.de"
                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                <input 
                                    type="text" 
                                    value={shopwareConfig.accessKey} 
                                    onChange={(e) => setShopwareConfig({...shopwareConfig, accessKey: e.target.value})}
                                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                                <input 
                                    type="password" 
                                    value={shopwareConfig.secretKey} 
                                    onChange={(e) => setShopwareConfig({...shopwareConfig, secretKey: e.target.value})}
                                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                                />
                            </div>
                            <div className="flex space-x-2 pt-2">
                                <button 
                                    onClick={handleSaveShopwareConfig}
                                    className="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-700"
                                >
                                    Speichern
                                </button>
                                <button 
                                    onClick={handleTestConnection}
                                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
                                >
                                    Testen
                                </button>
                            </div>
                            {shopwareMessage && (
                                <div className={`p-3 rounded text-sm flex items-center ${shopwareStatus === 'success' ? 'bg-green-50 text-green-700' : shopwareStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                                    {shopwareStatus === 'success' && <CheckCircle size={16} className="mr-2" />}
                                    {shopwareStatus === 'error' && <AlertCircle size={16} className="mr-2" />}
                                    {shopwareMessage}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Products Column */}
                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Artikel & Zuweisung</h3>
                            <button 
                                onClick={fetchShopwareProducts}
                                disabled={isLoadingProducts || !shopwareConfig.url}
                                className="text-blue-600 text-sm hover:underline disabled:opacity-50"
                            >
                                {isLoadingProducts ? 'Lade...' : 'Produkte aus Shopware laden'}
                            </button>
                        </div>

                        {shopwareProducts.length > 0 ? (
                            <div className="space-y-2">
                                {shopwareProducts.map(product => {
                                    const mapping = mappings.find(m => m.shopware_product_id === product.id);
                                    
                                    return (
                                        <div key={product.id} className="border border-gray-200 rounded p-3 flex justify-between items-center hover:bg-gray-50">
                                            <div>
                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                <div className="text-xs text-gray-500 font-mono">{product.productNumber}</div>
                                            </div>
                                            
                                            {mapping ? (
                                                <div className="flex items-center bg-green-50 border border-green-100 rounded px-3 py-1.5">
                                                    <FileText size={14} className="text-green-600 mr-2" />
                                                    <span className="text-sm text-green-800 mr-2 truncate max-w-[150px]" title={mapping.file_name}>
                                                        {mapping.file_name}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleDeleteMapping(mapping.id)}
                                                        className="text-gray-400 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setShowMappingModal(product)}
                                                    className="flex items-center text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded"
                                                >
                                                    <Link size={14} className="mr-1" />
                                                    Datei zuweisen
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded border border-gray-100">
                                <ShoppingBag size={32} className="mx-auto text-gray-300 mb-2" />
                                <p>Keine Produkte geladen. Konfigurieren Sie den Shop und klicken Sie auf "Laden".</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Mapping Modal */}
      {showMappingModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold">Datei zuweisen für: {(showMappingModal as any).name}</h3>
                      <button onClick={() => setShowMappingModal(null)}><X size={20} className="text-gray-500" /></button>
                  </div>
                  
                  <div className="p-4 border-b">
                      <div className="relative">
                          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                          <input 
                              type="text" 
                              placeholder="Datei suchen..." 
                              value={mappingSearch}
                              onChange={(e) => setMappingSearch(e.target.value)}
                              className="w-full pl-9 border border-gray-300 rounded p-2 text-sm"
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {filteredPrintFilesForMapping.length > 0 ? (
                          filteredPrintFilesForMapping.map((file, idx) => (
                              <button 
                                  key={idx}
                                  onClick={() => handleCreateMapping(showMappingModal, file)}
                                  className="w-full flex items-center p-3 hover:bg-gray-50 border border-gray-100 rounded text-left group"
                              >
                                  <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center mr-3 border border-gray-200">
                                      {file.thumbnail ? (
                                          <img src={file.thumbnail} className="h-full w-full object-contain" />
                                      ) : (
                                          <Printer size={16} className="text-gray-400" />
                                      )}
                                  </div>
                                  <div>
                                      <div className="font-medium text-sm text-gray-900">{file.customName || file.name}</div>
                                      <div className="text-xs text-gray-500">{new Date(file.orderDate).toLocaleDateString()}</div>
                                  </div>
                                  <div className="ml-auto opacity-0 group-hover:opacity-100 text-blue-600 text-sm font-medium">
                                      Auswählen
                                  </div>
                              </button>
                          ))
                      ) : (
                          <div className="text-center py-8 text-gray-500">Keine passende Datei gefunden.</div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

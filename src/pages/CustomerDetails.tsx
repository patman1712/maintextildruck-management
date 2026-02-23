import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, Order } from "@/store";
import { ArrowLeft, User, FileText, Download, Printer, Phone, Mail, MapPin, Edit, Save, X, Trash2, Pencil, Upload, ShoppingBag, CheckCircle, AlertCircle, Link, Search, Package, Plus, Image as ImageIcon } from "lucide-react";

interface Product {
    id: string;
    name: string;
    product_number: string;
    source: 'shopware' | 'manual';
    files: {
        id: string;
        file_url: string;
        file_name: string;
        thumbnail_url?: string;
    }[];
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'products' | 'shopware'>('overview');
  
  const [customer, setCustomer] = useState(customers.find(c => c.id === id));
  const [customerOrders, setCustomerOrders] = useState(
    orders.filter(o => o.customerId === id || o.customerName === customer?.name)
  );

  // Shopware State
  const [shopwareConfig, setShopwareConfig] = useState<{
      url: string;
      version: '5' | '6';
      accessKey: string;
      secretKey: string;
  }>({
      url: '',
      version: '6',
      accessKey: '',
      secretKey: ''
  });
  const [shopwareStatus, setShopwareStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [shopwareMessage, setShopwareMessage] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowMappingModal] = useState(false); // Using this for both edit/create and file assign
  const [productSearch, setProductSearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [newManualProduct, setNewManualProduct] = useState({ name: '', productNumber: '' });
  const [assignFileMode, setAssignFileMode] = useState(false);

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
          version: foundCustomer.shopwareVersion || '6',
          accessKey: foundCustomer.shopwareAccessKey || '',
          secretKey: foundCustomer.shopwareSecretKey || ''
      });
      setCustomerOrders(orders.filter(o => o.customerId === id || o.customerName === foundCustomer.name));
    } else {
      navigate("/dashboard/customers");
    }
  }, [id, customers, orders, navigate, loading]);

  useEffect(() => {
      if (activeTab === 'products' && customer) {
          fetchProducts();
      }
  }, [activeTab, customer]);

  const handleSaveCustomer = async () => {
    if (!editedCustomer || !customer) return;
    
    await updateCustomer(customer.id, editedCustomer);
    setCustomer({ ...customer, ...editedCustomer });
    setIsEditing(false);
  };

  // --- Products Logic ---

  const fetchProducts = async () => {
      if (!customer) return;
      try {
          const res = await fetch(`/api/products/${customer.id}`);
          const data = await res.json();
          if (data.success) {
              setProducts(data.data);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleCreateManualProduct = async () => {
      if (!customer || !newManualProduct.name) return;
      try {
          const res = await fetch(`/api/products/${customer.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newManualProduct)
          });
          const data = await res.json();
          if (data.success) {
              fetchProducts();
              setShowMappingModal(false);
              setNewManualProduct({ name: '', productNumber: '' });
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleUpdateProduct = async () => {
      if (!editingProduct) return;
      try {
          await fetch(`/api/products/${editingProduct.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  name: editingProduct.name,
                  productNumber: editingProduct.product_number
              })
          });
          fetchProducts();
          setShowMappingModal(false);
          setEditingProduct(null);
      } catch (err) {
          console.error(err);
      }
  };

  const handleDeleteProduct = async (productId: string) => {
      if (!confirm('Produkt wirklich löschen?')) return;
      try {
          await fetch(`/api/products/${productId}`, {
              method: 'DELETE'
          });
          fetchProducts();
      } catch (err) {
          console.error(err);
      }
  };

  const handleAssignFile = async (file: any) => {
      if (!editingProduct) return;
      try {
          await fetch(`/api/products/${editingProduct.id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  fileUrl: file.url,
                  fileName: file.customName || file.name,
                  thumbnailUrl: file.thumbnail
              })
          });
          
          // Refresh product data locally
          const updatedFiles = [...editingProduct.files, {
              id: Math.random().toString(), // Temp ID until refresh
              file_url: file.url,
              file_name: file.customName || file.name,
              thumbnail_url: file.thumbnail
          }];
          setEditingProduct({ ...editingProduct, files: updatedFiles });
          fetchProducts();
      } catch (err) {
          console.error(err);
      }
  };

  const handleRemoveFile = async (fileId: string) => {
      if (!editingProduct) return;
      try {
          await fetch(`/api/products/${editingProduct.id}/files/${fileId}`, {
              method: 'DELETE'
          });
          
          const updatedFiles = editingProduct.files.filter(f => f.id !== fileId);
          setEditingProduct({ ...editingProduct, files: updatedFiles });
          fetchProducts();
      } catch (err) {
          console.error(err);
      }
  };

  // --- Shopware Logic ---
  
  const handleSaveShopwareConfig = async () => {
      if (!customer) return;
      await updateCustomer(customer.id, {
          shopwareUrl: shopwareConfig.url,
          shopwareVersion: shopwareConfig.version,
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
              alert(`${data.data.length} Produkte geladen und synchronisiert.`);
              fetchProducts(); // Refresh local list
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

  const filteredPrintFilesForAssign = printFiles.filter(f => 
      (f.customName || f.name).toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      (p.product_number && p.product_number.toLowerCase().includes(productSearch.toLowerCase()))
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
                onClick={() => setActiveTab('products')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'products' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <Package size={16} className="mr-2" />
                    Artikel ({products.length})
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
                {/* ... (Overview content remains same) ... */}
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
            // ... (Files tab content remains same) ...
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

        {/* TAB: PRODUCTS */}
        {activeTab === 'products' && (
            <div className="p-8 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-bold text-gray-800">Artikelverwaltung</h3>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Suchen..." 
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="pl-9 border border-gray-300 rounded-md py-1.5 text-sm w-64"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            setEditingProduct(null);
                            setNewManualProduct({ name: '', productNumber: '' });
                            setShowMappingModal(true);
                            setAssignFileMode(false);
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center"
                    >
                        <Plus size={16} className="mr-2" />
                        Manueller Artikel
                    </button>
                </div>

                <div className="space-y-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div className={`p-2 rounded-lg mr-4 ${product.source === 'shopware' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{product.name}</h4>
                                        <div className="flex items-center mt-1 space-x-2">
                                            {product.product_number && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                    {product.product_number}
                                                </span>
                                            )}
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${product.source === 'shopware' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                {product.source}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => {
                                            setEditingProduct(product);
                                            setShowMappingModal(true);
                                            setAssignFileMode(false);
                                        }}
                                        className="text-gray-400 hover:text-blue-600 p-1"
                                        title="Bearbeiten"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="text-gray-400 hover:text-red-600 p-1"
                                        title="Löschen"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Zugeordnete Druckdaten</span>
                                    <button 
                                        onClick={() => {
                                            setEditingProduct(product);
                                            setShowMappingModal(true);
                                            setAssignFileMode(true);
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center font-medium"
                                    >
                                        <Plus size={12} className="mr-1" />
                                        Datei hinzufügen
                                    </button>
                                </div>
                                {product.files && product.files.length > 0 ? (
                                    <div className="flex flex-wrap gap-3">
                                        {product.files.map(file => (
                                            <div key={file.id} className="relative group w-20">
                                                <div className="h-20 w-20 bg-gray-50 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
                                                    {file.thumbnail_url ? (
                                                        <img src={file.thumbnail_url} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <ImageIcon size={24} className="text-gray-300" />
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveFile(file.id)}
                                                    className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                                <div className="text-[10px] truncate mt-1 text-gray-600" title={file.file_name}>
                                                    {file.file_name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Keine Dateien zugeordnet</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            <Package size={48} className="mx-auto text-gray-300 mb-4" />
                            <p>Keine Artikel gefunden.</p>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shopware Version</label>
                                <select 
                                    value={shopwareConfig.version} 
                                    onChange={(e) => setShopwareConfig({...shopwareConfig, version: e.target.value as '5' | '6'})}
                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                >
                                    <option value="6">Shopware 6</option>
                                    <option value="5">Shopware 5</option>
                                </select>
                            </div>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">{shopwareConfig.version === '6' ? 'Client ID' : 'Benutzername (API User)'}</label>
                                <input 
                                    type="text" 
                                    value={shopwareConfig.accessKey} 
                                    onChange={(e) => setShopwareConfig({...shopwareConfig, accessKey: e.target.value})}
                                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{shopwareConfig.version === '6' ? 'Client Secret' : 'API Key'}</label>
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
                            <h3 className="font-bold text-lg">Shopware Synchronisation</h3>
                            <button 
                                onClick={fetchShopwareProducts}
                                disabled={isLoadingProducts || !shopwareConfig.url}
                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isLoadingProducts ? 'Lade...' : 'Produkte importieren'}
                            </button>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800 text-sm">
                            <p>Hier können Sie alle Produkte aus Ihrem Shopware-Shop importieren.</p>
                            <p className="mt-2">Nach dem Import finden Sie die Produkte im Reiter <strong>"Artikel"</strong>, wo Sie ihnen Druckdaten zuweisen können.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Modal for Product Edit / Create / File Assign */}
      {showProductModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold">
                          {assignFileMode 
                              ? `Druckdatei zuweisen: ${editingProduct?.name}`
                              : editingProduct 
                                  ? 'Artikel bearbeiten' 
                                  : 'Neuer manueller Artikel'
                          }
                      </h3>
                      <button onClick={() => setShowMappingModal(false)}><X size={20} className="text-gray-500" /></button>
                  </div>
                  
                  {assignFileMode ? (
                      // FILE ASSIGN MODE
                      <>
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Druckdaten suchen..." 
                                    value={fileSearch}
                                    onChange={(e) => setFileSearch(e.target.value)}
                                    className="w-full pl-9 border border-gray-300 rounded p-2 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredPrintFilesForAssign.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {filteredPrintFilesForAssign.map((file, idx) => {
                                        const displayThumb = file.thumbnail || file.url;
                                        const isAssigned = editingProduct?.files.some(f => f.file_url === file.url);
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                onClick={() => handleAssignFile(file)}
                                                className={`
                                                    cursor-pointer rounded-lg border p-2 relative group hover:shadow-md transition-all
                                                    ${isAssigned ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-red-300'}
                                                `}
                                            >
                                                <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden relative">
                                                    {displayThumb ? (
                                                        <img 
                                                            src={displayThumb} 
                                                            alt="" 
                                                            className="w-full h-full object-contain" 
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                                            }} 
                                                        />
                                                    ) : null}
                                                    
                                                    <div className={`fallback-icon ${displayThumb ? 'hidden' : ''} flex items-center justify-center w-full h-full absolute inset-0`}>
                                                        {file.name.toLowerCase().endsWith('.pdf') ? (
                                                            <FileText className="text-red-500 h-10 w-10" />
                                                        ) : (
                                                            <Printer className="text-gray-300 h-10 w-10" />
                                                        )}
                                                    </div>

                                                    {isAssigned && (
                                                        <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                                                            <div className="bg-green-500 text-white rounded-full p-1 shadow-sm">
                                                                <CheckCircle size={20} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <p className="text-xs font-medium truncate mb-0.5 text-gray-800" title={file.customName || file.name}>
                                                    {file.customName || file.name}
                                                </p>
                                                <p className="text-[10px] text-gray-500 truncate">
                                                    {new Date(file.orderDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <Printer size={48} className="mx-auto text-gray-300 mb-4" />
                                    <p>Keine passenden Druckdaten gefunden.</p>
                                </div>
                            )}
                        </div>
                      </>
                  ) : (
                      // EDIT / CREATE MODE
                      <div className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Artikelname</label>
                              <input 
                                  type="text" 
                                  value={editingProduct ? editingProduct.name : newManualProduct.name}
                                  onChange={(e) => editingProduct 
                                      ? setEditingProduct({...editingProduct, name: e.target.value}) 
                                      : setNewManualProduct({...newManualProduct, name: e.target.value})
                                  }
                                  className="w-full border border-gray-300 rounded p-2"
                                  placeholder="z.B. Premium T-Shirt"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Artikelnummer (SKU)</label>
                              <input 
                                  type="text" 
                                  value={editingProduct ? editingProduct.product_number : newManualProduct.productNumber}
                                  onChange={(e) => editingProduct 
                                      ? setEditingProduct({...editingProduct, product_number: e.target.value}) 
                                      : setNewManualProduct({...newManualProduct, productNumber: e.target.value})
                                  }
                                  className="w-full border border-gray-300 rounded p-2"
                                  placeholder="z.B. SW-1001"
                              />
                          </div>
                          
                          <div className="pt-4 flex justify-end">
                              <button 
                                  onClick={() => editingProduct ? handleUpdateProduct() : handleCreateManualProduct()}
                                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                              >
                                  {editingProduct ? 'Speichern' : 'Erstellen'}
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

    </div>
  );
}

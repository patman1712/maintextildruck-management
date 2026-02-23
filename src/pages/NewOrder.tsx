import { useState, useEffect } from "react";
import { Upload, Plus, X, User, Calendar, FileText, ShoppingCart, Trash2 } from "lucide-react";
import { useAppStore, Order } from "@/store";
import { useNavigate } from "react-router-dom";

export default function NewOrder() {
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders); // Needed for generating order number
  const addOrder = useAppStore((state) => state.addOrder);
  const customers = useAppStore((state) => state.customers);
  const addCustomer = useAppStore((state) => state.addCustomer);
  const users = useAppStore((state) => state.users);
  const fetchUsers = useAppStore((state) => state.fetchUsers);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addOrderItem = useAppStore((state) => state.addOrderItem);
  const suppliers = useAppStore((state) => state.suppliers);
  
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [files, setFiles] = useState<File[]>([]);
  const [printFiles, setPrintFiles] = useState<{file: File, customName?: string}[]>([]);
  const [vectorFiles, setVectorFiles] = useState<File[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  
  // Form States
  const [orderNumber, setOrderNumber] = useState(""); // State for automatic order number
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

  // Calculate next order number on mount or when orders change
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const prefix = `${currentYear}-`;
    
    // Find all orders for current year that follow the pattern YYYY-XXXX
    const currentYearOrders = orders.filter(o => 
        (o.orderNumber && o.orderNumber.startsWith(prefix)) || 
        (o.createdAt && o.createdAt.startsWith(String(currentYear)))
    );

    let maxNum = 0;
    
    currentYearOrders.forEach(o => {
        if (o.orderNumber && o.orderNumber.startsWith(prefix)) {
            const numPart = parseInt(o.orderNumber.split('-')[1]);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    });

    // If no order numbers found, maybe count orders? 
    // But better to stick to explicit numbers. If it's the first one, maxNum is 0.
    
    const nextNum = maxNum + 1;
    const nextOrderNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
    
    setOrderNumber(nextOrderNumber);
  }, [orders]);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [saveAsNewCustomer, setSaveAsNewCustomer] = useState(false);
  
  // Order Items logic (local state for new order creation)
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({
    supplierId: '',
    itemName: '',
    itemNumber: '',
    color: '',
    size: '',
    quantity: 1,
    notes: ''
  });

  const handleAddItem = () => {
    if (newItem.supplierId && newItem.itemName) {
        setOrderItems([...orderItems, { ...newItem, id: Math.random().toString(36).substr(2, 9), status: 'pending' }]);
        setNewItem({
            supplierId: '',
            itemName: '',
            itemNumber: '',
            color: '',
            size: '',
            quantity: 1,
            notes: ''
        });
    }
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerEmail(customer.email);
      setCustomerPhone(customer.phone);
      setCustomerAddress(customer.address);
      
      // We could also offer to load previous print files here
      // But maybe it's better to have a dedicated button for that
    } else {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerAddress("");
    }
  };

  const [showFileSelector, setShowFileSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableFiles, setAvailableFiles] = useState<{name: string, url: string, type: 'print' | 'vector', date: string, orderTitle: string}[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]); // URLs

  const loadCustomerFiles = () => {
    if (!selectedCustomerId) return;
    
    // Find all orders for this customer
    const orders = useAppStore.getState().orders;
    // Sort orders by date descending (newest first)
    const customerOrders = orders
        .filter(o => o.customerId === selectedCustomerId || o.customerName === customerName)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const allFiles: {name: string, url: string, type: 'print' | 'vector', date: string, orderTitle: string}[] = [];
    const seenUrls = new Set<string>();
    
    customerOrders.forEach(order => {
        if (order.files) {
            order.files.forEach(f => {
                if (f.type === 'print' && f.url) {
                    // Deduplicate by URL
                    if (!seenUrls.has(f.url)) {
                        seenUrls.add(f.url);
                        allFiles.push({
                            name: f.customName || f.name,
                            url: f.url,
                            type: 'print',
                            date: order.createdAt,
                            orderTitle: order.title
                        });
                    }
                }
            });
        }
    });
    
    setAvailableFiles(allFiles);
    setSearchTerm("");
    setShowFileSelector(true);
  };

  const addSelectedFiles = () => {
    const filesToAdd = availableFiles.filter(f => selectedExistingFiles.includes(f.url));
    
    // Convert to File objects is not possible directly, but we can use the URL
    // We need to update our state to handle files that are just URLs reference
    // Currently setPrintFiles expects File[]
    // We need to adapt the state structure to support existing files (like in EditOrder)
    
    // Actually, NewOrder uses File[] state which is for NEW uploads.
    // We should add a new state for "existing files to attach" or change the state structure.
    // Let's add a new state for this:
    // const [existingFilesToAttach, setExistingFilesToAttach] = useState<{name: string, url: string, type: 'print'}[]>([]);
    
    const newAttachments = filesToAdd.map(f => ({
        name: f.name,
        url: f.url,
        type: 'print' as const
    }));
    
    setExistingFilesToAttach([...existingFilesToAttach, ...newAttachments]);
    setShowFileSelector(false);
    setSelectedExistingFiles([]);
  };

  const [existingFilesToAttach, setExistingFilesToAttach] = useState<{name: string, url: string, type: 'print'}[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "preview" | "print" | "vector") => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (type === "preview") {
        setFiles([...files, ...newFiles]);
      } else if (type === "print") {
        setPrintFiles([...printFiles, ...newFiles.map(f => ({ file: f, customName: "" }))]);
      } else {
        setVectorFiles([...vectorFiles, ...newFiles]);
      }
    }
  };

  const removeFile = (index: number, type: "preview" | "print" | "vector") => {
    if (type === "preview") {
      setFiles(files.filter((_, i) => i !== index));
    } else if (type === "print") {
      setPrintFiles(printFiles.filter((_, i) => i !== index));
    } else {
      setVectorFiles(vectorFiles.filter((_, i) => i !== index));
    }
  };

  const removeExistingFile = (index: number) => {
    setExistingFilesToAttach(existingFilesToAttach.filter((_, i) => i !== index));
  };

  const toggleEmployee = (name: string) => {
    if (selectedEmployees.includes(name)) {
      setSelectedEmployees(selectedEmployees.filter(e => e !== name));
    } else {
      setSelectedEmployees([...selectedEmployees, name]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Upload files first
    const formData = new FormData();
    files.forEach(f => formData.append('preview', f));
    printFiles.forEach(f => formData.append('print', f.file));
    vectorFiles.forEach(f => formData.append('vector', f));

    let uploadedFiles: { name: string; type: 'preview' | 'print' | 'vector'; url?: string; customName?: string }[] = [];
    
    // Add existing attached files first
    uploadedFiles = [...uploadedFiles, ...existingFilesToAttach];

    try {
      // Only fetch if there are files
      if (files.length > 0 || printFiles.length > 0 || vectorFiles.length > 0) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.success && data.files) {
          if (data.files.preview) {
            uploadedFiles = [...uploadedFiles, ...data.files.preview.map((f: any) => ({ name: f.originalName, type: 'preview' as const, url: f.path }))];
          }
          if (data.files.print) {
            // Match uploaded files back to our state to get custom names
            // The order should be preserved
            uploadedFiles = [...uploadedFiles, ...data.files.print.map((f: any, i: number) => ({ 
                name: f.originalName, 
                type: 'print' as const, 
                url: f.path,
                thumbnail: f.thumbnail,
                customName: printFiles[i]?.customName || ""
            }))];
          }
          if (data.files.vector) {
            uploadedFiles = [...uploadedFiles, ...data.files.vector.map((f: any) => ({ name: f.originalName, type: 'vector' as const, url: f.path }))];
          }
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
      // Proceed without files or show error? For now proceed but maybe alert user
    }
    
    let newCustomerId = selectedCustomerId;

    if (customerMode === "new" && saveAsNewCustomer && customerName) {
        newCustomerId = Math.random().toString(36).substr(2, 9);
        await addCustomer({
            id: newCustomerId,
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            address: customerAddress
        });
    }

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      title: title || "Neuer Auftrag",
      orderNumber: orderNumber, // Include generated number
      customerId: newCustomerId || undefined,
      customerName: customerName || "Unbekannter Kunde",
      customerEmail,
      customerPhone,
      customerAddress,
      deadline: deadline,
      status: "active",
      steps: { processing: false, produced: false, invoiced: false },
      createdAt: new Date().toISOString().split('T')[0],
      description: description,
      employees: selectedEmployees,
      files: uploadedFiles
    };

    await addOrder(newOrder);

    // Add order items if any
    if (orderItems.length > 0) {
        for (const item of orderItems) {
            await addOrderItem(newOrder.id, {
                supplierId: item.supplierId,
                itemName: item.itemName,
                itemNumber: item.itemNumber,
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                notes: item.notes
            });
        }
    }

    navigate("/dashboard/orders");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <FileText className="mr-2 text-red-600" />
        Neuen Auftrag erfassen
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        
        {/* Section 1: Order Basics */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Auftragsdaten</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Auftrags-Nr.</label>
              <div className="flex items-center">
                  <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-md px-3 py-2 text-gray-500 text-sm font-mono">#</span>
                  <input 
                    type="text" 
                    className="w-full border-gray-300 rounded-r-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2 bg-gray-50 text-gray-600 font-mono" 
                    value={orderNumber}
                    readOnly
                    title="Automatisch generiert (Jahr-Laufnummer)"
                  />
              </div>
            </div>
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Auftragstitel</label>
              <input 
                type="text" 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2" 
                placeholder="z.B. T-Shirts Abijahrgang 2024"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2 pl-10"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Customer Selection */}
        <div>
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-semibold text-slate-700">Kunde</h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`px-4 py-1 text-sm font-medium rounded-md transition-all ${
                  customerMode === "existing" ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Bestandskunde
              </button>
              <button
                type="button"
                onClick={() => {
                    setCustomerMode("new");
                    setCustomerName("");
                    setCustomerEmail("");
                    setCustomerPhone("");
                    setCustomerAddress("");
                    setSaveAsNewCustomer(true);
                }}
                className={`px-4 py-1 text-sm font-medium rounded-md transition-all ${
                  customerMode === "new" ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Neuer Kunde
              </button>
            </div>
          </div>

          {customerMode === "existing" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunde suchen</label>
              <select 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2"
                onChange={handleCustomerSelect}
              >
                <option value="">Bitte wählen...</option>
                {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
          )}

          {customerMode === "new" && (
            <div className="mb-4">
                <label className="inline-flex items-center">
                    <input 
                        type="checkbox" 
                        className="form-checkbox h-4 w-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
                        checked={saveAsNewCustomer}
                        onChange={(e) => setSaveAsNewCustomer(e.target.checked)}
                    />
                    <span className="ml-2 text-sm text-gray-700">Als Bestandskunde speichern</span>
                </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname / Voller Name</label>
            <div className="relative">
                <input 
                type="text" 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2 pl-10" 
                placeholder="Name des Kunden" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                />
                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input 
                type="email" 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2" 
                placeholder="kontakt@beispiel.de" 
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input 
                type="tel" 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2" 
                placeholder="+49 123 456789" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
            />
            </div>
            <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsadresse</label>
            <textarea 
                rows={2} 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2" 
                placeholder="Straße, Hausnummer, PLZ, Ort"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
            ></textarea>
            </div>
          </div>
        </div>

        {/* Section 3: Employees */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Zuständigkeiten</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mitarbeiter zuweisen</label>
            <div className="flex flex-wrap gap-2">
              {users.length > 0 ? (
                users.map((user) => (
                  <label key={user.id} className={`inline-flex items-center border rounded-full px-3 py-1 cursor-pointer transition-colors ${selectedEmployees.includes(user.username) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                    <input 
                      type="checkbox" 
                      className="form-checkbox h-4 w-4 text-red-600 rounded focus:ring-red-500 border-gray-300" 
                      checked={selectedEmployees.includes(user.username)}
                      onChange={() => toggleEmployee(user.username)}
                    />
                    <span className="ml-2 text-sm text-gray-700">{user.username}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">Keine Mitarbeiter gefunden. Bitte in der Verwaltung anlegen.</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Files */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Previews */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Ansichten / Vorschauen</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Nur Ansicht</span>
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "preview")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*,.pdf"
              />
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Dateien hierher ziehen oder klicken</p>
            </div>
            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-100">
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx, "preview")} className="text-gray-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Vector/Raw Files */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Rohdaten / Zum Vektorisieren</span>
              <span className="text-xs font-normal text-blue-800 bg-blue-100 px-2 py-1 rounded">Bearbeitung</span>
            </h3>
            <div className="border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-lg p-6 text-center hover:bg-blue-50 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "vector")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="mx-auto h-8 w-8 text-blue-400 mb-2" />
              <p className="text-sm text-blue-600 font-medium">Bilder/Logos hochladen</p>
              <p className="text-xs text-blue-400 mt-1">JPG, PNG, etc. für Grafikbearbeitung</p>
            </div>
            {vectorFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                {vectorFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-blue-50 p-2 rounded border border-blue-100 text-blue-800">
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx, "vector")} className="text-blue-400 hover:text-blue-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Print Files */}
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Fertige Druckdaten DTF</span>
              <span className="text-xs font-normal text-white bg-red-600 px-2 py-1 rounded">PNG & PDF</span>
            </h3>
            <div className="border-2 border-dashed border-red-200 bg-red-50/30 rounded-lg p-6 text-center hover:bg-red-50 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "print")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".png,image/png,.pdf,application/pdf"
              />
              <Upload className="mx-auto h-8 w-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600 font-medium">DTF-Druckdaten hier hochladen</p>
              <p className="text-xs text-red-400 mt-1">PNG & PDF Dateien erlaubt (CMYK)</p>
            </div>
            
            {/* Button to load existing files */}
            {selectedCustomerId && (
                <div className="mt-2 text-right">
                    <button 
                        type="button"
                        onClick={loadCustomerFiles}
                        className="text-xs text-red-600 hover:text-red-800 underline font-medium flex items-center justify-end ml-auto"
                    >
                        <FileText size={14} className="mr-1" />
                        Bereits hochgeladene Druckdaten verwenden
                    </button>
                </div>
            )}

            {/* Existing Files List */}
            {existingFilesToAttach.length > 0 && (
              <ul className="mt-4 space-y-2">
                {existingFilesToAttach.map((file, idx) => (
                  <li key={`existing-${idx}`} className="flex justify-between items-center text-sm bg-red-50 p-2 rounded border border-red-100 text-red-800">
                    <div className="flex items-center">
                        <span className="bg-red-200 text-red-800 text-[10px] px-1 rounded mr-2">ARCHIV</span>
                        <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeExistingFile(idx)} className="text-red-400 hover:text-red-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {printFiles.length > 0 && (
              <ul className="mt-2 space-y-2">
                {printFiles.map((item, idx) => (
                  <li key={idx} className="flex flex-col text-sm bg-red-50 p-2 rounded border border-red-100 text-red-800">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                            <span className="bg-green-200 text-green-800 text-[10px] px-1 rounded mr-2">NEU</span>
                            <span className="truncate max-w-[200px] font-medium">{item.file.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(idx, "print")} className="text-red-400 hover:text-red-700">
                        <X size={16} />
                        </button>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Titel vergeben (optional)" 
                        className="w-full text-xs border border-red-200 rounded p-1 focus:ring-red-500 focus:border-red-500"
                        value={item.customName || ""}
                        onChange={(e) => {
                            const newFiles = [...printFiles];
                            newFiles[idx].customName = e.target.value;
                            setPrintFiles(newFiles);
                        }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      {/* File Selector Modal */}
      {showFileSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Druckdaten aus Archiv wählen</h3>
                    <button onClick={() => setShowFileSelector(false)} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder="Dateien suchen (Titel)..." 
                            className="w-full border p-2 rounded text-sm focus:ring-red-500 focus:border-red-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    {availableFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            {searchTerm ? "Keine passenden Dateien gefunden." : "Keine Druckdaten für diesen Kunden gefunden."}
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {availableFiles
                                .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((file, idx) => (
                                <div 
                                    key={idx} 
                                    className={`border rounded p-3 cursor-pointer transition-all relative ${
                                        selectedExistingFiles.includes(file.url) 
                                        ? 'border-red-500 bg-red-50 ring-1 ring-red-500' 
                                        : 'border-gray-200 hover:border-red-300'
                                    }`}
                                    onClick={() => {
                                        if (selectedExistingFiles.includes(file.url)) {
                                            setSelectedExistingFiles(selectedExistingFiles.filter(u => u !== file.url));
                                        } else {
                                            setSelectedExistingFiles([...selectedExistingFiles, file.url]);
                                        }
                                    }}
                                >
                                    <div className="h-24 bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                                        <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                                    </div>
                                    <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{new Date(file.date).toLocaleDateString()} - {file.orderTitle}</p>
                                    
                                    {selectedExistingFiles.includes(file.url) && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-0.5">
                                            <div className="w-3 h-3 flex items-center justify-center text-[10px]">✓</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                    <button 
                        onClick={() => setShowFileSelector(false)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={addSelectedFiles}
                        disabled={selectedExistingFiles.length === 0}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Ausgewählte hinzufügen ({selectedExistingFiles.length})
                    </button>
                </div>
            </div>
        </div>
      )}

        {/* Section 6: Order Items / Goods */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center">
            <ShoppingCart className="mr-2 text-red-600" size={20} />
            Benötigte Ware / Textilien
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Lieferant / Shop</label>
                    <select 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        value={newItem.supplierId}
                        onChange={(e) => setNewItem({...newItem, supplierId: e.target.value})}
                    >
                        <option value="">Bitte wählen...</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Artikelname / Art.-Nr. / Farbe</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="z.B. Premium Hoodie - Navy"
                        value={newItem.itemName}
                        onChange={(e) => setNewItem({...newItem, itemName: e.target.value})}
                    />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Größe / Anzahl</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="z.B. 5x XL, 3x L"
                        value={newItem.size}
                        onChange={(e) => setNewItem({...newItem, size: e.target.value})}
                    />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notizen (Optional)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="..."
                        value={newItem.notes}
                        onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                    />
                </div>
                <div className="flex items-end justify-end">
                    <button 
                        type="button"
                        onClick={handleAddItem}
                        disabled={!newItem.supplierId || !newItem.itemName}
                        className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        <Plus size={16} className="mr-1" />
                        Hinzufügen
                    </button>
                </div>
            </div>
          </div>

          {orderItems.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel / Farbe</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Größe / Anzahl</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lieferant</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notiz</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktion</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orderItems.map((item, index) => (
                            <tr key={index}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.itemName}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-bold">{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.size}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {suppliers.find(s => s.id === item.supplierId)?.name || 'Unbekannt'}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 italic">{item.notes}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        type="button" 
                                        onClick={() => removeOrderItem(index)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded border border-dashed">
                Keine Ware hinzugefügt.
            </p>
          )}
        </div>

        {/* Section 5: Description */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Beschreibung</h3>
          <textarea
            rows={4}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-3"
            placeholder="Detaillierte Beschreibung des Auftrags..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mr-4 px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform transition-all active:scale-95"
          >
            Auftrag anlegen
          </button>
        </div>

      </form>
    </div>
  );
}

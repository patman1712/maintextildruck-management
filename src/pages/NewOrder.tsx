import { useState, useEffect } from "react";
import { Upload, Plus, X, User, Calendar, FileText } from "lucide-react";
import { useAppStore, Order } from "@/store";
import { useNavigate } from "react-router-dom";

export default function NewOrder() {
  const navigate = useNavigate();
  const addOrder = useAppStore((state) => state.addOrder);
  const customers = useAppStore((state) => state.customers);
  const addCustomer = useAppStore((state) => state.addCustomer);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [files, setFiles] = useState<File[]>([]);
  const [printFiles, setPrintFiles] = useState<File[]>([]);
  const [vectorFiles, setVectorFiles] = useState<File[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  
  // Form States
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [saveAsNewCustomer, setSaveAsNewCustomer] = useState(false);

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
  const [availableFiles, setAvailableFiles] = useState<{name: string, url: string, type: 'print' | 'vector', date: string, orderTitle: string}[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]); // URLs

  const loadCustomerFiles = () => {
    if (!selectedCustomerId) return;
    
    // Find all orders for this customer
    const orders = useAppStore.getState().orders;
    const customerOrders = orders.filter(o => o.customerId === selectedCustomerId || o.customerName === customerName);
    
    const allFiles: {name: string, url: string, type: 'print' | 'vector', date: string, orderTitle: string}[] = [];
    
    customerOrders.forEach(order => {
        if (order.files) {
            order.files.forEach(f => {
                if (f.type === 'print' && f.url) {
                    allFiles.push({
                        name: f.customName || f.name,
                        url: f.url,
                        type: 'print',
                        date: order.createdAt,
                        orderTitle: order.title
                    });
                }
            });
        }
    });
    
    setAvailableFiles(allFiles);
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
        setPrintFiles([...printFiles, ...newFiles]);
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
    printFiles.forEach(f => formData.append('print', f));
    vectorFiles.forEach(f => formData.append('vector', f));

    let uploadedFiles: { name: string; type: 'preview' | 'print' | 'vector'; url?: string }[] = [];
    
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
            uploadedFiles = [...uploadedFiles, ...data.files.print.map((f: any) => ({ name: f.originalName, type: 'print' as const, url: f.path }))];
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (Bis wann fertig?)</label>
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
              {["Alex", "Sarah", "Michael", "Lisa"].map((name) => (
                <label key={name} className={`inline-flex items-center border rounded-full px-3 py-1 cursor-pointer transition-colors ${selectedEmployees.includes(name) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  <input 
                    type="checkbox" 
                    className="form-checkbox h-4 w-4 text-red-600 rounded focus:ring-red-500 border-gray-300" 
                    checked={selectedEmployees.includes(name)}
                    onChange={() => toggleEmployee(name)}
                  />
                  <span className="ml-2 text-sm text-gray-700">{name}</span>
                </label>
              ))}
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
              <span className="text-xs font-normal text-white bg-red-600 px-2 py-1 rounded">Nur PNG</span>
            </h3>
            <div className="border-2 border-dashed border-red-200 bg-red-50/30 rounded-lg p-6 text-center hover:bg-red-50 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "print")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".png,image/png"
              />
              <Upload className="mx-auto h-8 w-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600 font-medium">DTF-Druckdaten hier hochladen</p>
              <p className="text-xs text-red-400 mt-1">Nur .png Dateien erlaubt</p>
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
                {printFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-red-50 p-2 rounded border border-red-100 text-red-800">
                    <div className="flex items-center">
                        <span className="bg-green-200 text-green-800 text-[10px] px-1 rounded mr-2">NEU</span>
                        <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeFile(idx, "print")} className="text-red-400 hover:text-red-700">
                      <X size={16} />
                    </button>
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
                            placeholder="Dateien suchen..." 
                            className="w-full border p-2 rounded text-sm"
                            onChange={(e) => {
                                // Simple local filter could be implemented here
                            }}
                        />
                    </div>
                    
                    {availableFiles.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Keine Druckdaten für diesen Kunden gefunden.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {availableFiles.map((file, idx) => (
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

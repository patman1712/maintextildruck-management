import { useState, useEffect } from "react";
import { Upload, X, User, Calendar, FileText, ArrowLeft } from "lucide-react";
import { useAppStore, Order } from "@/store";
import { useNavigate, useParams } from "react-router-dom";

export default function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const customers = useAppStore((state) => state.customers);
  const users = useAppStore((state) => state.users);
  const fetchUsers = useAppStore((state) => state.fetchUsers);
  
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [files, setFiles] = useState<{ name: string; type: 'preview' | 'print' | 'vector'; url?: string; file?: File }[]>([]);
  
  // Form States
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [status, setStatus] = useState<Order['status']>('active');

  const [showFileSelector, setShowFileSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableFiles, setAvailableFiles] = useState<{name: string, url: string, type: 'print' | 'vector', date: string, orderTitle: string}[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]); // URLs

  const loadCustomerFiles = () => {
    // Find customer ID based on name if not available directly (EditOrder stores customerName)
    // Ideally we should have customerId in Order but for now we might need to look it up or filter by name
    const customer = customers.find(c => c.name === customerName);
    const customerId = customer?.id;
    
    // Find all orders for this customer
    const allOrders = useAppStore.getState().orders;
    const customerOrders = allOrders.filter(o => (customerId && o.customerId === customerId) || o.customerName === customerName);
    
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
    setSearchTerm("");
    setShowFileSelector(true);
  };

  const addSelectedFiles = () => {
    const filesToAdd = availableFiles.filter(f => selectedExistingFiles.includes(f.url));
    
    const newFiles = filesToAdd.map(f => ({
        name: f.name,
        type: 'print' as const,
        url: f.url
    }));
    
    setFiles([...files, ...newFiles]);
    setShowFileSelector(false);
    setSelectedExistingFiles([]);
  };

  useEffect(() => {
    if (loading) return;
    const order = orders.find(o => o.id === id);
    if (order) {
      setTitle(order.title);
      setDeadline(order.deadline);
      setCustomerName(order.customerName);
      setCustomerEmail(order.customerEmail || "");
      setCustomerPhone(order.customerPhone || "");
      setCustomerAddress(order.customerAddress || "");
      setDescription(order.description || "");
      setSelectedEmployees(order.employees);
      setFiles(order.files);
      setStatus(order.status);
    } else {
      // Order not found redirect
      navigate("/dashboard/orders");
    }
  }, [id, orders, navigate, loading]);

  if (loading) return <div className="p-8 text-center text-gray-500">Lade Auftragsdaten...</div>;

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerEmail(customer.email);
      setCustomerPhone(customer.phone);
      setCustomerAddress(customer.address);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "preview" | "print" | "vector") => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, type, file: f }));
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
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
    
    if (id) {
        let finalFiles = files.filter(f => !f.file); // Keep existing files (without new file object)
        const newFilesToUpload = files.filter(f => f.file);

        if (newFilesToUpload.length > 0) {
            const formData = new FormData();
            newFilesToUpload.forEach(f => {
                if (f.file) formData.append(f.type, f.file);
            });

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success && data.files) {
                    if (data.files.preview) {
                        finalFiles = [...finalFiles, ...data.files.preview.map((f: any) => ({ name: f.originalName, type: 'preview', url: f.path }))];
                    }
                    if (data.files.print) {
                        finalFiles = [...finalFiles, ...data.files.print.map((f: any) => ({ name: f.originalName, type: 'print', url: f.path }))];
                    }
                    if (data.files.vector) {
                        finalFiles = [...finalFiles, ...data.files.vector.map((f: any) => ({ name: f.originalName, type: 'vector', url: f.path }))];
                    }
                }
            } catch (err) {
                console.error("Upload failed", err);
            }
        }

        updateOrder(id, {
            title,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            deadline,
            description,
            employees: selectedEmployees,
            files: finalFiles,
            status
        });
        navigate("/dashboard/orders");
    }
  };

  const previewFiles = files.filter(f => f.type === 'preview');
  const printFiles = files.filter(f => f.type === 'print');
  const vectorFiles = files.filter(f => f.type === 'vector');

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={18} className="mr-1" /> Zurück
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center justify-between">
        <span className="flex items-center">
            <FileText className="mr-2 text-red-600" />
            Auftrag bearbeiten
        </span>
        <span className={`text-sm px-3 py-1 rounded-full ${status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
        </span>
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
                {/* Optional: Add "Load from Existing" button here if needed, currently editing is manual or pre-filled */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <select 
                        className="bg-transparent text-sm font-medium text-gray-600 focus:outline-none cursor-pointer"
                        onChange={handleCustomerSelect}
                        defaultValue=""
                    >
                        <option value="" disabled>Daten aus Bestandskunde laden...</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname / Voller Name</label>
                  <div className="relative">
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2 pl-10" 
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
                <p className="text-sm text-gray-500 italic">Keine Mitarbeiter gefunden.</p>
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
              <p className="text-sm text-gray-600">Dateien hinzufügen</p>
            </div>
            {previewFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                {previewFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-100">
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(files.indexOf(file))} className="text-gray-400 hover:text-red-500">
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
                    <button type="button" onClick={() => removeFile(files.indexOf(file))} className="text-blue-400 hover:text-blue-700">
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
              <p className="text-sm text-red-600 font-medium">DTF-Druckdaten hinzufügen</p>
            </div>

            {/* Button to load existing files */}
            {customerName && (
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

            {printFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                {printFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-red-50 p-2 rounded border border-red-100 text-red-800">
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button type="button" onClick={() => removeFile(files.indexOf(file))} className="text-red-400 hover:text-red-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Section 5: Description */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2">Beschreibung</h3>
          <textarea
            rows={4}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate("/dashboard/orders")}
            className="mr-4 px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform transition-all active:scale-95"
          >
            Änderungen speichern
          </button>
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

      </form>
    </div>
  );
}

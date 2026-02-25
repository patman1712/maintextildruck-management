import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Printer, Upload, Download, Trash2, FileText, Check, AlertCircle, Package, ChevronDown, ChevronRight, Search, User } from "lucide-react";

export default function DTFOrdering() {
  const orders = useAppStore((state) => state.orders);
  const customers = useAppStore((state) => state.customers);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);
  const addOrder = useAppStore((state) => state.addOrder);
  const updateOrder = useAppStore((state) => state.updateOrder);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Configuration State
  const [rollWidth, setRollWidth] = useState(57); // in cm
  const [rollLength, setRollLength] = useState(200); // 0 = infinite/auto
  const [padding, setPadding] = useState(5); // in mm (gap between items)

  // Selection State
  const [selectedFiles, setSelectedFiles] = useState<{
    id: string;
    url: string;
    name: string;
    thumbnail?: string;
    width?: number; // in mm (placeholder for now)
    height?: number; // in mm
    quantity: number;
    orderId: string;
    customerName: string;
  }[]>([]);

  // File Picker Modal State
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'files' | 'products' | 'upload'>('files');
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustomerFilter, setPickerCustomerFilter] = useState(""); // "" = All, "ARCHIVED" = Archive, "NAME" = Specific Customer
  
  // Product Tab State
  const [productSearch, setProductSearch] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [customerProducts, setCustomerProducts] = useState<Record<string, any[]>>({});
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());

  // Direct Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCustomerId, setUploadCustomerId] = useState<string>("");

  // Processing State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrls, setGeneratedPdfUrls] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Extract all available print files
  // Extract all available print files from ALL orders
  const allFilesRaw = orders.flatMap(order => 
    (order.files || [])
      .filter(f => f.type === 'print' || f.type === 'vector')
      .map(f => ({
        id: f.url || Math.random().toString(36),
        url: f.url,
        name: f.customName || f.name,
        thumbnail: f.thumbnail,
        orderId: order.id,
        customerName: order.customerName,
        date: order.createdAt,
        status: order.status,
        reference: f.reference
      }))
  ).filter(f => f.url);

  // Sort files by date (newest first)
  allFilesRaw.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Deduplicate files by URL
  const availableFiles: typeof allFilesRaw = [];
  const seenUrls = new Set<string>();

  for (const file of allFilesRaw) {
      if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          availableFiles.push(file);
      }
  }

  // Group active orders that have print files (for the "Open Orders" list)
  // 1. Regular Orders
  const regularOrders = orders
    .filter(o => o.id !== 'inventory-manual')
    .filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived')
    .filter(o => (o.files || []).some(f => f.type === 'print' || f.type === 'vector'))
    .filter(o => o.printStatus !== 'ordered');

  // 2. Manual Inventory Groups (Virtual Orders)
  const manualGroups: any[] = [];
  const manualOrder = orders.find(o => o.id === 'inventory-manual');
  
  if (manualOrder) {
      const filesByRef: Record<string, any[]> = {};
      (manualOrder.files || []).forEach(f => {
           // Filter out ordered files
           if ((f.type === 'print' || f.type === 'vector') && f.status !== 'ordered') {
               const ref = f.reference || 'Unbekannt';
               if (!filesByRef[ref]) filesByRef[ref] = [];
               filesByRef[ref].push(f);
           }
       });

      Object.entries(filesByRef).forEach(([ref, files]) => {
          manualGroups.push({
              id: `manual-group-${ref}`,
              title: ref === 'Unbekannt' ? 'Ohne Auftragsnummer' : ref,
              orderNumber: '', // Hide MANUELL badge to keep it clean
              customerName: 'Manuelle Lagerbestellung', 
              createdAt: manualOrder.createdAt,
              files: files,
              printStatus: 'pending', 
              isVirtual: true
          });
      });
  }

  const openOrdersWithFiles = [...regularOrders, ...manualGroups];

  const addOrderFiles = (orderId: string) => {
      // Check for virtual order (Manual Inventory Groups)
      if (orderId.startsWith('manual-group-')) {
          const ref = orderId.replace('manual-group-', '');
          const manualOrder = orders.find(o => o.id === 'inventory-manual');
          if (!manualOrder) return;
          
          const filesToAdd = (manualOrder.files || [])
             .filter(f => {
                 const fileRef = f.reference || 'Unbekannt';
                 return fileRef === ref && (f.type === 'print' || f.type === 'vector');
             })
             .map(f => ({
                id: f.url || Math.random().toString(36),
                url: f.url,
                name: f.customName || f.name,
                 thumbnail: f.thumbnail,
                 orderId: `manual-group-${ref}`, // Use Virtual ID for tracking status update
                 customerName: 'Lager / Manuell',
                 date: manualOrder.createdAt,
                quantity: 1,
                width: 0,
                height: 0,
                reference: f.reference
            }));
          
          filesToAdd.forEach(file => {
              addFile(file);
          });
          return;
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const filesToAdd = (order.files || [])
        .filter(f => f.type === 'print' || f.type === 'vector')
        .map(f => ({
            id: f.url || Math.random().toString(36),
            url: f.url,
            name: f.customName || f.name,
            thumbnail: f.thumbnail,
            orderId: order.id,
            customerName: order.customerName,
            date: order.createdAt,
            quantity: 1, // Default quantity
            width: 0,
            height: 0
        }));
        
      // Add all, avoid duplicates (or increment quantity?)
      // Requirement: "alle dateien sollen automatisch dann in ausgewählte dateien"
      
      filesToAdd.forEach(file => {
          addFile(file); // Re-use addFile logic which handles duplicates/increments
      });
  };

  // Filter for picker
  const filteredAvailableFiles = availableFiles.filter(f => {
    const matchesSearch = 
        f.name.toLowerCase().includes(pickerSearch.toLowerCase()) || 
        f.customerName.toLowerCase().includes(pickerSearch.toLowerCase());
    
    const matchesCustomer = 
        pickerCustomerFilter === "" ? true :
        pickerCustomerFilter === "ARCHIVED" ? f.status === 'archived' :
        f.customerName === pickerCustomerFilter;

    return matchesSearch && matchesCustomer;
  });

  // Get unique customers for dropdown
  const uniqueCustomers = Array.from(new Set(availableFiles
    .filter(f => f.status !== 'archived') // Don't show archived customers in dropdown unless we want to? Usually archived are "One-Time" or direct uploads.
    .map(f => f.customerName)
  )).sort();

  const toggleCustomer = async (customerId: string) => {
      const newExpanded = new Set(expandedCustomers);
      if (newExpanded.has(customerId)) {
          newExpanded.delete(customerId);
      } else {
          newExpanded.add(customerId);
          // Fetch if not present
          if (!customerProducts[customerId]) {
              setLoadingProducts(prev => new Set(prev).add(customerId));
              try {
                  const res = await fetch(`/api/products/${customerId}`);
                  const data = await res.json();
                  if (data.success) {
                      setCustomerProducts(prev => ({ ...prev, [customerId]: data.data }));
                  }
              } catch(e) { console.error(e); }
              setLoadingProducts(prev => { const n = new Set(prev); n.delete(customerId); return n; });
          }
      }
      setExpandedCustomers(newExpanded);
  };

  const addFile = (file: any) => {
    if (selectedFiles.some(f => f.url === file.url)) {
        // Increment quantity if already selected
        setSelectedFiles(prev => prev.map(f => f.url === file.url ? { ...f, quantity: f.quantity + 1 } : f));
    } else {
        // Add new
        setSelectedFiles(prev => [...prev, {
            ...file,
            quantity: 1,
            width: 0, // Will be detected by backend or needs input? Ideally backend detects it.
            height: 0
        }]);
    }
  };

  const removeFile = (url: string) => {
    setSelectedFiles(prev => prev.filter(f => f.url !== url));
  };

  const updateQuantity = (url: string, delta: number) => {
    setSelectedFiles(prev => prev.map(f => {
        if (f.url === url) {
            const newQty = Math.max(1, f.quantity + delta);
            return { ...f, quantity: newQty };
        }
        return f;
    }));
  };

  const handleDirectUpload = async () => {
    if (!uploadFile) return;
    
    // Support for upload without customer (One-Time-DTF)
    const isOneTime = !uploadCustomerId;
    let customer = null;
    
    if (uploadCustomerId) {
        customer = customers.find(c => c.id === uploadCustomerId);
    }

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
            
            // Create a "storage" order for this file
            const newOrder: any = {
                id: Math.random().toString(36).substr(2, 9),
                title: isOneTime ? "Einmaliger DTF Upload" : "Direkter Dateiupload (DTF)",
                customerId: customer?.id || 'one-time',
                customerName: customer?.name || 'Einmaliger Kunde (Kein Profil)',
                customerEmail: customer?.email || '',
                customerPhone: customer?.phone || '',
                customerAddress: customer?.address || '',
                deadline: new Date().toISOString().split('T')[0],
                status: isOneTime ? "archived" : "archived", // Both archived to hide from main list
                steps: { processing: true, produced: true, invoiced: true },
                createdAt: new Date().toISOString(),
                description: isOneTime ? "Temporärer Upload für einmaligen DTF Druck" : "Direkt im DTF-Bestellbereich hochgeladen",
                employees: [],
                files: [{
                    name: uploadedFile.originalName,
                    type: 'print',
                    url: fileUrl,
                    thumbnail: thumbnail,
                    customName: uploadedFile.originalName
                }]
            };

            await addOrder(newOrder);
            
            // Refresh data
            await fetchData();

            // Automatically select the uploaded file
            const fileToAdd = {
                id: fileUrl,
                url: fileUrl,
                name: uploadedFile.originalName,
                thumbnail: thumbnail,
                orderId: newOrder.id,
                customerName: newOrder.customerName,
                date: newOrder.createdAt,
                quantity: 1,
                width: 0,
                height: 0
            };
            
            addFile(fileToAdd);
            
            setPickerTab('files');
            setUploadFile(null);
            setUploadCustomerId("");
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload fehlgeschlagen.");
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedPdfUrls([]);
    setGenerationError(null);

    try {
        const payload = {
            rollWidthMm: rollWidth * 10, // cm to mm
            rollLengthMm: rollLength * 10, // cm to mm
            paddingMm: padding,
            files: selectedFiles.map(f => ({
                url: f.url,
                quantity: f.quantity
            }))
        };

        const res = await fetch('/api/dtf/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success && (data.url || data.urls)) {
            if (data.urls && data.urls.length > 0) {
                setGeneratedPdfUrls(data.urls);
            } else if (data.url) {
                setGeneratedPdfUrls([data.url]);
            }
            
            // Ask user if prints were ordered successfully
            setTimeout(async () => {
                if (window.confirm("Wurden die Druckdaten erfolgreich bestellt/gedruckt?\n\nWenn Sie mit 'OK' bestätigen, werden die beteiligten Aufträge als 'Gedruckt' markiert und aus der offenen Liste entfernt.")) {
                    const orderIds = new Set(selectedFiles.map(f => f.orderId));
                    let updatedCount = 0;
                    
                    const manualOrder = orders.find(o => o.id === 'inventory-manual');
                    let manualFilesChanged = false;
                    let manualFiles = manualOrder?.files ? [...manualOrder.files] : [];

                    for (const orderId of Array.from(orderIds)) {
                        if (orderId.startsWith('manual-group-')) {
                            // Update status for files in this manual group
                            const ref = orderId.replace('manual-group-', '');
                            manualFiles = manualFiles.map(f => {
                                const fRef = f.reference || 'Unbekannt';
                                if (fRef === ref && (f.type === 'print' || f.type === 'vector')) {
                                    manualFilesChanged = true;
                                    return { ...f, status: 'ordered' as const };
                                }
                                return f;
                            });
                        } else if (orderId && orderId !== 'one-time' && !orderId.startsWith('temp-')) {
                            await updateOrder(orderId, { printStatus: 'ordered' });
                            updatedCount++;
                        }
                    }

                    if (manualFilesChanged && manualOrder) {
                        await updateOrder(manualOrder.id, { files: manualFiles });
                        updatedCount++;
                    }
                    
                    if (updatedCount > 0) {
                        // Refresh data to update the list
                        fetchData();
                    }
                }
            }, 500);

        } else {
            setGenerationError(data.error || "Generierung fehlgeschlagen.");
        }
    } catch (err) {
        console.error(err);
        setGenerationError("Netzwerkfehler bei der Generierung.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Printer className="mr-3 text-red-600" />
          DTF-Bestellung vorbereiten
        </h1>
        <div className="flex gap-2">
            {generatedPdfUrls.map((url, idx) => (
                <a 
                    key={idx}
                    href={url} 
                    download={`DTF_Print_Job_Part${idx + 1}.pdf`}
                    className="bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 flex items-center animate-in fade-in zoom-in"
                >
                    <Download className="mr-2" size={18} />
                    {generatedPdfUrls.length > 1 ? `PDF ${idx + 1} herunterladen` : 'Fertiges PDF herunterladen'}
                </a>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Configuration & File List */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0 overflow-hidden">
            
            {/* Config Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 shrink-0">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                    <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                    Einstellungen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rollenbreite (cm)</label>
                        <input 
                            type="number" 
                            value={rollWidth} 
                            onChange={(e) => setRollWidth(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        />
                        <span className="text-[10px] text-gray-400">Breite der PDF (nach rechts)</span>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Länge (cm, 0 = Auto)</label>
                        <input 
                            type="number" 
                            value={rollLength} 
                            onChange={(e) => setRollLength(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        />
                        <span className="text-[10px] text-gray-400">Höhe der PDF (nach unten)</span>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Abstand (mm)</label>
                        <input 
                            type="number" 
                            value={padding} 
                            onChange={(e) => setPadding(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                        />
                    </div>
                </div>
            </div>

            {/* Open Orders Section */}
            {openOrdersWithFiles.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 shrink-0">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">!</span>
                        Offene Aufträge mit Druckdaten
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                        {openOrdersWithFiles.map(order => (
                            <div key={order.id} className="border border-blue-100 bg-blue-50 p-3 rounded-md flex justify-between items-center">
                                <div className="min-w-0 flex-1 mr-2">
                                    <p className="font-medium text-blue-900 truncate text-sm" title={order.title}>
                                        {order.orderNumber && <span className="text-blue-400 mr-1 font-mono text-xs">{order.orderNumber}</span>}
                                        {order.title}
                                    </p>
                                    <p className="text-xs text-blue-700 truncate">{order.customerName}</p>
                                    <p className="text-[10px] text-blue-500">{new Date(order.createdAt).toLocaleDateString('de-DE')}</p>
                                </div>
                                <button 
                                    onClick={() => addOrderFiles(order.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1.5 rounded shrink-0 flex items-center"
                                >
                                    <Check size={12} className="mr-1" />
                                    Übernehmen
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selected Files List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                    <h3 className="font-semibold text-gray-700 flex items-center">
                        <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                        Ausgewählte Dateien ({selectedFiles.reduce((acc, curr) => acc + curr.quantity, 0)})
                    </h3>
                    <button 
                        onClick={() => setShowFilePicker(true)}
                        className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 flex items-center"
                    >
                        <Upload size={16} className="mr-2" />
                        Dateien hinzufügen
                    </button>
                </div>
                
                <div className="overflow-y-auto p-2 space-y-2 flex-1">
                    {selectedFiles.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                            <Upload size={48} className="mb-4 opacity-20" />
                            <p>Noch keine Dateien ausgewählt.</p>
                        </div>
                    ) : (
                        selectedFiles.map((file, idx) => {
                            // Match logic from CustomerDetails: try thumbnail, else url (for images or browser-supported formats)
                            const displayThumb = file.thumbnail || file.url;
                            return (
                                <div key={`${file.url}-${idx}`} className="flex items-center bg-white border border-gray-200 p-2 rounded hover:border-red-200 transition-colors">
                                    <div className="h-12 w-12 bg-gray-100 rounded overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center relative">
                                        {displayThumb ? (
                                            <img src={displayThumb} alt="" className="h-full w-full object-contain" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                            }} />
                                        ) : null}
                                        
                                        <div className={`fallback-icon ${displayThumb ? 'hidden' : ''} flex items-center justify-center absolute inset-0`}>
                                            <FileText className="text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="ml-3 flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{file.customerName}</p>
                                </div>
                                <div className="flex items-center space-x-3 ml-2">
                                    <div className="flex items-center border border-gray-300 rounded">
                                        <button onClick={() => updateQuantity(file.url, -1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600">-</button>
                                        <span className="px-2 text-sm font-medium w-8 text-center">{file.quantity}</span>
                                        <button onClick={() => updateQuantity(file.url, 1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600">+</button>
                                    </div>
                                    <button onClick={() => removeFile(file.url)} className="text-gray-400 hover:text-red-600 p-1">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
                </div>
            </div>
        </div>

        {/* Right Column: Preview / Action */}
        <div className="flex flex-col gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                    <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">3</span>
                    Zusammenfassung & Generierung
                </h3>
                
                <div className="flex-1 bg-slate-50 rounded border border-slate-200 p-4 mb-4 text-sm text-slate-600">
                    <ul className="space-y-2">
                        <li className="flex justify-between">
                            <span>Anzahl Motive:</span>
                            <span className="font-medium">{selectedFiles.length}</span>
                        </li>
                        <li className="flex justify-between">
                            <span>Gesamtstückzahl:</span>
                            <span className="font-medium">{selectedFiles.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                        </li>
                        <li className="flex justify-between">
                            <span>Ausgabebreite:</span>
                            <span className="font-medium">{rollWidth} cm</span>
                        </li>
                        <li className="flex justify-between">
                            <span>Farbprofil:</span>
                            <span className="font-medium">FOGRA39 (CMYK)</span>
                        </li>
                    </ul>
                    
                    <div className="mt-6 p-3 bg-yellow-50 text-yellow-800 rounded text-xs border border-yellow-100 flex items-start">
                        <AlertCircle size={14} className="mr-2 mt-0.5 shrink-0" />
                        <p>Das System ordnet die Dateien automatisch platzsparend an (Nesting). Bei Bedarf werden mehrere Seiten erstellt.</p>
                    </div>
                </div>

                {generationError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm border border-red-100">
                        {generationError}
                    </div>
                )}

                <button 
                    onClick={handleGenerate}
                    disabled={selectedFiles.length === 0 || isGenerating}
                    className="w-full bg-gradient-to-r from-red-700 to-red-600 text-white py-3 rounded-lg font-medium shadow-md hover:from-red-800 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Generiere PDF...
                        </>
                    ) : (
                        <>
                            <Check className="mr-2" />
                            PDF Generieren
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Druckdatei auswählen</h3>
                    <div className="flex items-center space-x-4">
                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setPickerTab('files')} 
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${pickerTab === 'files' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Aufträge
                            </button>
                            <button 
                                onClick={() => setPickerTab('products')} 
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${pickerTab === 'products' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Kunden-Artikel
                            </button>
                            <button 
                                onClick={() => setPickerTab('upload')} 
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${pickerTab === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Upload
                            </button>
                        </div>
                        <button onClick={() => setShowFilePicker(false)} className="text-gray-500 hover:text-gray-700">
                            <Trash2 className="rotate-45" size={24} />
                        </button>
                    </div>
                </div>
                
                {pickerTab === 'upload' ? (
                    <div className="p-4 bg-red-50 border-b border-red-100 animate-in slide-in-from-top-2 flex-1">
                        <div className="max-w-xl mx-auto bg-white p-4 rounded shadow-sm border border-red-100">
                            <h4 className="font-semibold text-gray-800 mb-3">Datei hochladen & Kunde zuweisen</h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Kunde auswählen (Optional)</label>
                                    <select 
                                        value={uploadCustomerId}
                                        onChange={(e) => setUploadCustomerId(e.target.value)}
                                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
                                    >
                                        <option value="">-- Ohne Kunde (Einmalig) --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {!uploadCustomerId && (
                                        <p className="text-[10px] text-gray-500 mt-1 italic">
                                            Datei wird für diesen Auftrag genutzt und danach gelöscht.
                                        </p>
                                    )}
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Datei (PDF oder PNG)</label>
                                    <input 
                                        type="file" 
                                        accept=".pdf,application/pdf,.png,image/png"
                                        onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                                    />
                                </div>
                                
                                <div className="flex justify-end pt-2">
                                    <button 
                                        onClick={handleDirectUpload}
                                        disabled={!uploadFile}
                                        className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                    >
                                        <Upload size={16} className="mr-2" />
                                        Hochladen & Hinzufügen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : pickerTab === 'products' ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Kunde oder Artikel suchen..." 
                                    className="w-full pl-10 border border-gray-300 rounded p-2 focus:ring-red-500 focus:border-red-500"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {customers
                                .filter(c => c.name.toLowerCase().includes(productSearch.toLowerCase()))
                                .map(customer => {
                                    const isExpanded = expandedCustomers.has(customer.id);
                                    const isLoading = loadingProducts.has(customer.id);
                                    const products = customerProducts[customer.id] || [];
                                    const hasProducts = products.length > 0;

                                    return (
                                        <div key={customer.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                            <button 
                                                onClick={() => toggleCustomer(customer.id)}
                                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                                            >
                                                <div className="flex items-center">
                                                    {isExpanded ? <ChevronDown size={18} className="text-gray-400 mr-2" /> : <ChevronRight size={18} className="text-gray-400 mr-2" />}
                                                    <User size={16} className="text-blue-500 mr-2" />
                                                    <span className="font-medium text-slate-800">{customer.name}</span>
                                                </div>
                                                <span className="text-xs text-gray-400">
                                                    {isExpanded && isLoading ? 'Lade...' : ''}
                                                </span>
                                            </button>
                                            
                                            {isExpanded && (
                                                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
                                                    {!isLoading && products.length === 0 && (
                                                        <p className="text-sm text-gray-500 italic pl-8">Keine Artikel gefunden.</p>
                                                    )}
                                                    {products.map(product => {
                                                        const printFiles = (product.files || []).filter((f: any) => f.type === 'print');
                                                        if (printFiles.length === 0) return null; // Skip products without print files? Or show them?
                                                        // User said "zeige bei den kunden nur druckdaten an".
                                                        // If I hide the product, it's cleaner.
                                                        
                                                        return (
                                                        <div key={product.id} className="ml-6 border-l-2 border-gray-200 pl-4">
                                                            <div className="flex items-center mb-2">
                                                                <Package size={14} className="text-gray-400 mr-2" />
                                                                <span className="text-sm font-medium text-gray-700">{product.name}</span>
                                                                {product.product_number && <span className="ml-2 text-xs bg-gray-200 px-1.5 rounded text-gray-600">{product.product_number}</span>}
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                                                                {printFiles.map((file: any) => (
                                                                    <div 
                                                                        key={file.id}
                                                                        onClick={() => addFile({
                                                                            id: file.id,
                                                                            url: file.file_url,
                                                                            name: file.file_name || product.name,
                                                                            thumbnail: file.thumbnail_url,
                                                                            orderId: `prod-${product.id}`,
                                                                            customerName: customer.name,
                                                                            date: product.created_at,
                                                                            quantity: 1,
                                                                            width: 0,
                                                                            height: 0
                                                                        })}
                                                                        className="bg-white border border-gray-200 rounded p-2 cursor-pointer hover:border-red-400 hover:shadow-sm transition-all"
                                                                    >
                                                                        <div className="aspect-square bg-gray-100 rounded mb-1 flex items-center justify-center overflow-hidden">
                                                                            {file.thumbnail_url || file.file_url ? (
                                                                                <img src={file.thumbnail_url || file.file_url} className="w-full h-full object-contain" />
                                                                            ) : <FileText className="text-gray-300" />}
                                                                        </div>
                                                                        <p className="text-[10px] truncate text-gray-600">{file.file_name}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                ) : (
                    <>
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
                        <div className="flex-1">
                            <input 
                                type="text" 
                                placeholder="Suchen nach Dateiname oder Kunde..." 
                                className="w-full border border-gray-300 rounded p-2 focus:ring-red-500 focus:border-red-500"
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="w-64 shrink-0">
                            <select
                                className="w-full border border-gray-300 rounded p-2 focus:ring-red-500 focus:border-red-500"
                                value={pickerCustomerFilter}
                                onChange={(e) => setPickerCustomerFilter(e.target.value)}
                            >
                                <option value="">Alle Dateien</option>
                                <option value="ARCHIVED">📂 Archiv / Direkt-Uploads</option>
                                <option disabled>──────────</option>
                                {uniqueCustomers.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredAvailableFiles.map((file, idx) => {
                                const isSelected = selectedFiles.some(f => f.url === file.url);
                                const displayThumb = file.thumbnail || file.url;
                                
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => addFile(file)}
                                        className={`
                                            cursor-pointer rounded-lg border p-2 relative group hover:shadow-md transition-all
                                            ${isSelected ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 bg-white hover:border-red-300'}
                                        `}
                                    >
                                        <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden relative">
                                            {displayThumb ? (
                                                <img src={displayThumb} alt="" className="w-full h-full object-contain" onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                                }} />
                                            ) : null}
                                            
                                            <div className={`fallback-icon ${displayThumb ? 'hidden' : ''} flex items-center justify-center w-full h-full absolute inset-0`}>
                                                <FileText className="text-gray-300 h-12 w-12" />
                                            </div>

                                            {isSelected && (
                                                <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                                    <div className="bg-red-500 text-white rounded-full p-1 shadow-sm">
                                                        <Check size={16} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs font-medium truncate mb-0.5" title={file.name}>
                                            {file.reference && <span className="bg-blue-100 text-blue-800 text-[10px] px-1 rounded mr-1">{file.reference}</span>}
                                            {file.name}
                                        </p>
                                        <p className="text-[10px] text-gray-500 truncate">{file.customerName}</p>
                                        
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                                                {selectedFiles.find(f => f.url === file.url)?.quantity}x
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {filteredAvailableFiles.length === 0 && (
                            <p className="text-center text-gray-500 py-8">Keine Dateien gefunden.</p>
                        )}
                    </div>
                    </>
                )}

                <div className="p-4 border-t border-gray-200 flex justify-end">
                    <button 
                        onClick={() => setShowFilePicker(false)}
                        className="bg-slate-800 text-white px-6 py-2 rounded hover:bg-slate-900"
                    >
                        Fertig
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
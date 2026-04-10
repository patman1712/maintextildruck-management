import { useState, useEffect, useRef } from "react";
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
    status?: string; // Add optional status
    reference?: string; // Add optional reference
  }[]>([]);

  // File Picker Modal State
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'files' | 'products' | 'upload'>('files');
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustomerFilter, setPickerCustomerFilter] = useState(""); // "" = All, "ARCHIVED" = Archive, "NAME" = Specific Customer
  
  // Product Tab State
  const [productSearch, setProductSearch] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [customerProducts, setCustomerProducts] = useState<Record<string, any[]>>({});
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());

  // Direct Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCustomerId, setUploadCustomerId] = useState<string>("");
  const [uploadQuantity, setUploadQuantity] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Processing State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrls, setGeneratedPdfUrls] = useState<string[]>([]);
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null);
  const [generatedStats, setGeneratedStats] = useState<any | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedJobDetails, setGeneratedJobDetails] = useState<any | null>(null);
  const [generatedJobDetailsLoading, setGeneratedJobDetailsLoading] = useState(false);
  const [hoverPageThumb, setHoverPageThumb] = useState<string | null>(null);
  const [protocolScrolled, setProtocolScrolled] = useState(false);
  const protocolScrollRef = useRef<HTMLDivElement | null>(null);

  const checkerStyle = {
    backgroundImage:
      "linear-gradient(45deg, rgba(15,23,42,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(15,23,42,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(15,23,42,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(15,23,42,0.08) 75%)",
    backgroundSize: "18px 18px",
    backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
  } as const;

  const handleProtocolScroll = () => {
    const el = protocolScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setProtocolScrolled(true);
  };

  useEffect(() => {
    if (!showSuccessModal) return;
    setProtocolScrolled(false);
  }, [showSuccessModal]);

  useEffect(() => {
    if (!showSuccessModal) return;
    const el = protocolScrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 4) setProtocolScrolled(true);
  }, [showSuccessModal, generatedJobDetails, generatedJobDetailsLoading]);

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
        reference: f.reference,
        quantity: Number(f.quantity) || 1
      }))
  ).filter(f => f.url);

  // Sort files by date (newest first)
  allFilesRaw.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Deduplicate files by URL
  const availableFiles: typeof allFilesRaw = [];
  const seenKeys = new Set<string>();

  for (const file of allFilesRaw) {
      const key = `${file.orderId}::${file.url}`;
      if (!seenKeys.has(key)) {
          seenKeys.add(key);
          availableFiles.push(file);
      }
  }

  // Group active orders that have print files (for the "Open Orders" list)
  // 1. Regular Orders
  const regularOrders = orders
    .filter(o => o.id !== 'inventory-manual' && o.id !== 'dtf-manual-queue')
    .filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'archived')
    .filter(o => {
        // Check if there are ANY print/vector files that are NOT yet ordered
        const hasPendingFiles = (o.files || []).some(f => 
            (f.type === 'print' || f.type === 'vector') && f.status !== 'ordered'
        );
        return hasPendingFiles;
    });

  // 2. Manual Inventory Groups (Virtual Orders) AND DTF Queue
  const manualGroups: any[] = [];
  const manualOrder = orders.find(o => o.id === 'inventory-manual');
  const dtfQueueOrder = orders.find(o => o.id === 'dtf-manual-queue');
  
  // Combine files from both sources
  const combinedManualOrders = [manualOrder, dtfQueueOrder].filter(Boolean);

  combinedManualOrders.forEach(mOrder => {
      if (!mOrder) return;
      const filesByRef: Record<string, any[]> = {};
      
      (mOrder.files || []).forEach((f: any) => {
           // Filter out ordered files
           if ((f.type === 'print' || f.type === 'vector') && f.status !== 'ordered') {
               const ref = f.reference || (mOrder.id === 'dtf-manual-queue' ? 'Manueller Upload' : 'Unbekannt');
               if (!filesByRef[ref]) filesByRef[ref] = [];
               filesByRef[ref].push(f);
           }
       });

      Object.entries(filesByRef).forEach(([ref, files]) => {
          manualGroups.push({
              id: `${mOrder.id}-group-${ref}`, // Unique Group ID
              title: ref === 'Unbekannt' ? 'Ohne Auftragsnummer' : ref,
              orderNumber: '', 
              customerName: mOrder.id === 'dtf-manual-queue' ? 'Manuelle DTF Warteschlange' : 'Manuelle Lagerbestellung', 
              createdAt: mOrder.createdAt,
              files: files,
              printStatus: 'pending', 
              isVirtual: true,
              originalOrderId: mOrder.id // Track origin
          });
      });
  });

  const openOrdersWithFiles = [...regularOrders, ...manualGroups];

  const addOrderFiles = (orderId: string) => {
      // Check for virtual order (Manual Inventory Groups or Queue)
      if (orderId.includes('-group-')) {
          // Parse ID: {originalOrderId}-group-{ref}
          // e.g. inventory-manual-group-Ref123 OR dtf-manual-queue-group-Manueller Upload
          
          let originalOrderId = '';
          let ref = '';
          
          if (orderId.startsWith('inventory-manual-group-')) {
              originalOrderId = 'inventory-manual';
              ref = orderId.replace('inventory-manual-group-', '');
          } else if (orderId.startsWith('dtf-manual-queue-group-')) {
              originalOrderId = 'dtf-manual-queue';
              ref = orderId.replace('dtf-manual-queue-group-', '');
          } else {
               // Fallback / legacy
               return;
          }

          const sourceOrder = orders.find(o => o.id === originalOrderId);
          if (!sourceOrder) return;
          
          const filesToAdd = (sourceOrder.files || [])
             .filter((f: any) => {
                 const fileRef = f.reference || (originalOrderId === 'dtf-manual-queue' ? 'Manueller Upload' : 'Unbekannt');
                 return fileRef === ref && (f.type === 'print' || f.type === 'vector' || !f.type) && f.status !== 'ordered';
             })
             .map((f: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                url: f.url,
                name: f.customName || f.name,
                thumbnail: f.thumbnail,
                orderId: orderId, // Use Virtual Group ID for tracking status update
                customerName: originalOrderId === 'dtf-manual-queue' ? (f.reference || 'Manueller Upload') : 'Lager / Manuell',
                date: sourceOrder.createdAt,
                quantity: Number(f.quantity) || 1,
                width: 0,
                height: 0,
                reference: f.reference,
                status: 'pending' as const // Add status explicitly for typescript
            }));
          
          // Batch update for manual groups too
          setSelectedFiles(prev => {
              const uniqueNewFiles = filesToAdd.filter((nf: any) => !prev.some(pf => pf.url === nf.url && pf.orderId === nf.orderId && pf.name === nf.name));
              return [...prev, ...uniqueNewFiles];
          });
          return;
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const filesToAdd = (order.files || [])
        .filter(f => (f.type === 'print' || f.type === 'vector' || !f.type) && f.status !== 'ordered')
        .map(f => ({
            id: Math.random().toString(36).substr(2, 9),
            url: f.url,
            name: f.customName || f.name,
            thumbnail: f.thumbnail,
            orderId: order.id,
            customerName: order.customerName,
            date: order.createdAt,
            quantity: Number((f as any).quantity) || 1,
            width: 0,
            height: 0,
            status: 'pending' as const // Add status
        }));
        
      console.log('Adding files from order:', orderId, filesToAdd.length, filesToAdd);

      // Add all, avoid duplicates (or increment quantity?)
      // Requirement: "alle dateien sollen automatisch dann in ausgewählte dateien"
      
      // FIX: Add ALL files to selection state directly to avoid loop/state batching issues
      const newFiles = filesToAdd; // Already mapped above with unique IDs

      setSelectedFiles(prev => {
          // Filter out files that are already EXACTLY in the list (same URL + OrderID + Name) to avoid double-adding
          // Added 'name' to check to distinguish between different files that might share a URL (edge case) or if user wants to add same file with different name
          
          const uniqueNewFiles = newFiles.filter(nf => !prev.some(pf => pf.url === nf.url && pf.orderId === nf.orderId && pf.name === nf.name));
          
          // If all files already exist, increment quantity for existing
          if (uniqueNewFiles.length === 0) {
              return prev.map(pf => {
                  const matchingNew = newFiles.find(nf => nf.url === pf.url && nf.orderId === pf.orderId && nf.name === pf.name);
                  if (matchingNew) {
                      return { ...pf, quantity: pf.quantity + matchingNew.quantity };
                  }
                  return pf;
              });
          }
          
          return [...prev, ...uniqueNewFiles];
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

  const toggleOrderExpansion = (orderId: string) => {
      const newExpanded = new Set(expandedOrders);
      if (newExpanded.has(orderId)) {
          newExpanded.delete(orderId);
      } else {
          newExpanded.add(orderId);
      }
      setExpandedOrders(newExpanded);
  };

  const handleDeleteSingleManualFile = async (virtualOrderId: string, fileUrl: string) => {
      if (!confirm('Soll diese einzelne Datei wirklich gelöscht werden?')) return;

      // Check for virtual order (Manual Inventory Groups or Queue)
      if (virtualOrderId.includes('-group-')) {
          let originalOrderId = '';
          
          if (virtualOrderId.startsWith('inventory-manual-group-')) {
              originalOrderId = 'inventory-manual';
          } else if (virtualOrderId.startsWith('dtf-manual-queue-group-')) {
              originalOrderId = 'dtf-manual-queue';
          } else {
               return;
          }

          const sourceOrder = orders.find(o => o.id === originalOrderId);
          if (!sourceOrder) return;
          
          // Filter out the specific file
          const newFiles = (sourceOrder.files || []).filter((f: any) => f.url !== fileUrl);
          
          await updateOrder(originalOrderId, { files: newFiles });
          
          // Also remove from selection if selected
          setSelectedFiles(prev => prev.filter(f => !(f.url === fileUrl && (f.orderId === virtualOrderId || f.orderId === originalOrderId))));
          
          await fetchData();
      }
  };

  const addFile = (file: any) => {
    // Only increment if same file AND same order
    const existingIndex = selectedFiles.findIndex(f => f.url === file.url && f.orderId === file.orderId);
    
    if (existingIndex >= 0) {
        // Increment quantity? No, if we add from "Open Orders", we usually want to set the quantity to the order quantity.
        // But if user clicks "Add" multiple times from a list...
        // If the incoming file has a specific quantity (from order), we should probably add that.
        // Let's just add the incoming quantity to existing.
        setSelectedFiles(prev => prev.map((f, idx) => idx === existingIndex ? { ...f, quantity: (Number(f.quantity) || 1) + (Number(file.quantity) || 1) } : f));
    } else {
        // Add new with unique ID for selection tracking
        setSelectedFiles(prev => [...prev, {
            ...file,
            id: Math.random().toString(36).substr(2, 9), // Overwrite ID with unique selection ID
            quantity: Number(file.quantity) || 1,
            width: 0,
            height: 0,
            status: file.status || 'pending', // Use status if available
            reference: file.reference // Use reference if available
        }]);
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setSelectedFiles(prev => prev.map(f => {
        if (f.id === id) {
            const currentQty = Number(f.quantity) || 1;
            const newQty = Math.max(1, currentQty + delta);
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
            const uniqueId = Math.random().toString(36).substr(2, 9); // Add ID here for deletion
            
            // Instead of creating a NEW hidden order, append to a central "dtf-manual-queue" order
            // This ensures files are visible to ALL users until processed.
            
            const queueOrderId = 'dtf-manual-queue';
            let queueOrder = orders.find(o => o.id === queueOrderId);
            
            const newFileEntry = {
                id: uniqueId, // Add ID to file entry
                name: uploadedFile.originalName,
                type: 'print' as const,
                url: fileUrl,
                thumbnail: thumbnail,
                customName: uploadedFile.originalName,
                status: 'pending' as const,
                quantity: uploadQuantity,
                reference: customer ? customer.name : 'Manueller Upload', 
                uploadedAt: new Date().toISOString()
            };

            if (!queueOrder) {
                // Create the queue order if it doesn't exist
                const newOrder: any = {
                    id: queueOrderId,
                    title: "Manuelle DTF Warteschlange",
                    customerId: 'dtf-queue',
                    customerName: 'Warteschlange',
                    customerEmail: '',
                    deadline: new Date().toISOString().split('T')[0],
                    status: "active", 
                    steps: { processing: true, produced: false, invoiced: false },
                    createdAt: new Date().toISOString(),
                    description: "Sammelauftrag für manuelle DTF Uploads",
                    employees: [],
                    files: [newFileEntry],
                    printStatus: 'pending'
                };
                await addOrder(newOrder);
            } else {
                // Append file to existing queue
                const currentFiles = queueOrder.files || [];
                await updateOrder(queueOrderId, {
                    files: [...currentFiles, newFileEntry]
                });
            }
            
            // Refresh data
            await fetchData();

            // Automatically select the uploaded file
            const fileToAdd = {
                id: uniqueId, // Use consistent ID
                url: fileUrl,
                name: uploadedFile.originalName,
                thumbnail: thumbnail,
                orderId: queueOrderId,
                customerName: customer ? customer.name : 'Manueller Upload',
                date: new Date().toISOString(),
                quantity: uploadQuantity,
                width: 0,
                height: 0,
                reference: customer ? customer.name : 'Manueller Upload',
                status: 'pending' as const
            };
            
            addFile(fileToAdd);
            
            setPickerTab('files');
            setUploadFile(null);
            setUploadCustomerId("");
            setUploadQuantity(1);
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload fehlgeschlagen.");
    }
  };

  const handleDeleteManualUpload = async (orderId: string, fileUrl: string) => {
      if (!confirm('Soll dieser manuelle Upload wirklich gelöscht werden?')) return;
      
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      // Filter out the file
      const newFiles = (order.files || []).filter(f => f.url !== fileUrl);
      
      await updateOrder(orderId, { files: newFiles });
      
      // Also remove from selection if selected
      setSelectedFiles(prev => prev.filter(f => !(f.url === fileUrl && f.orderId === orderId)));
      
      await fetchData();
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedPdfUrls([]);
    setGeneratedJobId(null);
    setGeneratedStats(null);
    setGenerationError(null);
    setGeneratedJobDetails(null);
    setHoverPageThumb(null);

    try {
        const payload = {
            rollWidthMm: rollWidth * 10, // cm to mm
            rollLengthMm: rollLength * 10, // cm to mm
            paddingMm: padding,
            files: selectedFiles.map(f => ({
                url: f.url,
                quantity: f.quantity,
                orderId: f.orderId,
                name: f.name,
                reference: f.reference
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
            if (data.jobId) {
                setGeneratedJobId(data.jobId);
                setGeneratedJobDetailsLoading(true);
                try {
                    const detailsRes = await fetch(`/api/dtf/jobs/${data.jobId}`);
                    const detailsData = await detailsRes.json();
                    if (detailsData.success) setGeneratedJobDetails(detailsData.data);
                } catch {} finally {
                    setGeneratedJobDetailsLoading(false);
                }
            }
            if (data.stats) setGeneratedStats(data.stats);
            
            setShowSuccessModal(true);

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

    const handleConfirmSuccess = async () => {
        try {
            const orderIds = new Set(selectedFiles.map(f => f.orderId));
            let updatedCount = 0;
        
            // Handle Manual Queues
            const manualOrder = orders.find(o => o.id === 'inventory-manual');
            const dtfQueueOrder = orders.find(o => o.id === 'dtf-manual-queue');
        
            let manualFilesChanged = false;
            let dtfQueueChanged = false;
        
            let manualFiles = manualOrder?.files ? [...manualOrder.files] : [];
            let dtfQueueFiles = dtfQueueOrder?.files ? [...dtfQueueOrder.files] : [];

            for (const orderId of Array.from(orderIds)) {
                if (orderId.includes('-group-')) {
                    // Handle Virtual Groups
                    let originalOrderId = '';
                    let ref = '';

                    if (orderId.startsWith('inventory-manual-group-')) {
                        originalOrderId = 'inventory-manual';
                        ref = orderId.replace('inventory-manual-group-', '');
                    
                        // Update status for files in this manual group
                    const urlsToMark = new Set(selectedFiles.filter(f => f.orderId === orderId).map(f => f.url));
                        manualFiles = manualFiles.map((f: any) => {
                            const fRef = f.reference || 'Unbekannt';
                        if (fRef === ref && urlsToMark.has(f.url) && (f.type === 'print' || f.type === 'vector')) {
                                manualFilesChanged = true;
                                return { ...f, status: 'ordered' as const };
                            }
                            return f;
                        });
                    
                    } else if (orderId.startsWith('dtf-manual-queue-group-')) {
                        originalOrderId = 'dtf-manual-queue';
                        ref = orderId.replace('dtf-manual-queue-group-', '');
                    
                        // For DTF Queue: DELETE the files entirely after printing, as requested by user
                        // "erst danach soll die datei da wieder rausgehen" -> Delete
                    const urlsToRemove = new Set(selectedFiles.filter(f => f.orderId === orderId).map(f => f.url));
                        const initialLength = dtfQueueFiles.length;
                        dtfQueueFiles = dtfQueueFiles.filter((f: any) => {
                            const fRef = f.reference || 'Manueller Upload';
                        const isMatch = fRef === ref && urlsToRemove.has(f.url) && (f.type === 'print' || f.type === 'vector');
                            return !isMatch; 
                        });
                    
                        if (dtfQueueFiles.length !== initialLength) {
                            dtfQueueChanged = true;
                        }
                    }

                }
                else if (orderId === 'dtf-manual-queue') {
                    const filesToMark = selectedFiles.filter(f => f.orderId === orderId);
                    const urlsToRemove = new Set(filesToMark.map(f => f.url));
                    const initialLength = dtfQueueFiles.length;
                    dtfQueueFiles = dtfQueueFiles.filter((f: any) => {
                        if (!urlsToRemove.has(f.url)) return true;
                        return !(f.type === 'print' || f.type === 'vector');
                    });
                    if (dtfQueueFiles.length !== initialLength) {
                        dtfQueueChanged = true;
                    }
                } else if (orderId && orderId !== 'one-time' && !orderId.startsWith('temp-')) {
                    const order = orders.find(o => o.id === orderId);
                    if (order && order.files) {
                        const urlsToMark = new Set(selectedFiles.filter(f => f.orderId === orderId).map(f => f.url));
                        const newFiles = order.files.map(f => {
                            if ((f.type === 'print' || f.type === 'vector') && urlsToMark.has(f.url)) {
                                return { ...f, status: 'ordered' as const };
                            }
                            return f;
                        });
                        const hasPending = newFiles.some(f => (f.type === 'print' || f.type === 'vector') && f.status !== 'ordered');
                        
                        await updateOrder(orderId, { 
                            files: newFiles,
                            printStatus: hasPending ? 'pending' : 'ordered'
                        });
                        updatedCount++;
                    }
                }
            }

            if (manualFilesChanged && manualOrder) {
                await updateOrder(manualOrder.id, { files: manualFiles, printStatus: 'ordered' });
                updatedCount++;
            }

            if (dtfQueueChanged && dtfQueueOrder) {
                await updateOrder(dtfQueueOrder.id, { files: dtfQueueFiles, printStatus: 'ordered' });
                updatedCount++;
            }
        
            if (updatedCount > 0) {
                await fetchData();
            }

            setSelectedFiles([]);
            setGeneratedPdfUrls([]);
            setGeneratedJobId(null);
            setGeneratedStats(null);
            setShowSuccessModal(false);
        } catch (e: any) {
            console.error(e);
            setGenerationError(`Abschluss fehlgeschlagen: ${e?.message || 'Unbekannter Fehler'}`);
        }
    };

    const handleCancelSuccess = () => {
        setShowSuccessModal(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setUploadFile(e.dataTransfer.files[0]);
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
            {/* Download links are now in the success modal */}
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
                        {openOrdersWithFiles.map(order => {
                            const isSelected = selectedFiles.some(f => f.orderId === order.id);
                            const isExpanded = expandedOrders.has(order.id);
                            const isManualGroup = order.id.includes('-group-');

                            return (
                            <div key={order.id} className={`border rounded-md transition-colors overflow-hidden ${isSelected ? 'border-yellow-200 bg-yellow-50' : 'border-blue-100 bg-blue-50'}`}>
                                <div className="p-3 flex justify-between items-center">
                                    <div className="min-w-0 flex-1 mr-2 flex items-center">
                                        {isManualGroup && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleOrderExpansion(order.id); }}
                                                className="mr-2 text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-black/5 transition-colors"
                                            >
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        )}
                                        
                                        <div className="min-w-0">
                                            <p className={`font-medium truncate text-sm ${isSelected ? 'text-yellow-900' : 'text-blue-900'}`} title={order.title}>
                                                {order.orderNumber && <span className={`${isSelected ? 'text-yellow-600' : 'text-blue-400'} mr-1 font-mono text-xs`}>{order.orderNumber}</span>}
                                                {order.title}
                                            </p>
                                            <p className={`text-xs truncate ${isSelected ? 'text-yellow-700' : 'text-blue-700'}`}>{order.customerName}</p>
                                            <p className={`text-[10px] ${isSelected ? 'text-yellow-600' : 'text-blue-500'}`}>{new Date(order.createdAt).toLocaleDateString('de-DE')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(order.id === 'dtf-manual-queue' || order.id === 'inventory-manual' || order.originalOrderId === 'dtf-manual-queue') && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const originalId = order.originalOrderId || order.id;
                                                    // If it's a group, we need to delete ALL files in this group
                                                    if (order.isVirtual) {
                                                        if(confirm('Soll diese ganze Gruppe wirklich gelöscht werden?')) {
                                                            const sourceOrder = orders.find(o => o.id === originalId);
                                                            if (sourceOrder) {
                                                                const newFiles = (sourceOrder.files || []).filter((f: any) => {
                                                                    const fRef = f.reference || (originalId === 'dtf-manual-queue' ? 'Manueller Upload' : 'Unbekannt');
                                                                    // Keep files that DO NOT match the group reference
                                                                    return fRef !== (order.title === 'Ohne Auftragsnummer' ? 'Unbekannt' : order.title);
                                                                });
                                                                updateOrder(originalId, { files: newFiles }).then(fetchData);
                                                            }
                                                        }
                                                    }
                                                }}
                                                className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors"
                                                title="Ganze Gruppe löschen"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => !isSelected && addOrderFiles(order.id)}
                                            disabled={isSelected}
                                            className={`${isSelected ? 'bg-yellow-500 cursor-default opacity-80' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs px-2 py-1.5 rounded shrink-0 flex items-center transition-all`}
                                        >
                                            {isSelected ? (
                                                <>
                                                    <Check size={12} className="mr-1" />
                                                    In Auswahl
                                                </>
                                            ) : (
                                                <>
                                                    <Check size={12} className="mr-1" />
                                                    Übernehmen
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                
                                {isExpanded && isManualGroup && order.files && (
                                    <div className="border-t border-gray-200/50 bg-white/40 p-2 space-y-1 animate-in slide-in-from-top-1">
                                        {order.files.map((file: any, fIdx: number) => (
                                            <div key={file.id || fIdx} className="flex items-center justify-between p-1.5 rounded hover:bg-white/60 border border-transparent hover:border-gray-100 transition-all text-xs group">
                                                <div className="flex items-center min-w-0 gap-2">
                                                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                                                        {file.thumbnail || file.url ? (
                                                            <img src={file.thumbnail || file.url} className="w-full h-full object-contain" />
                                                        ) : <FileText size={14} className="text-gray-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-700 break-all whitespace-normal">{file.name}</p>
                                                        <p className="text-[10px] text-gray-500 flex items-center">
                                                            <span className="bg-gray-100 px-1 rounded mr-1">{file.quantity || 1}x</span>
                                                            {new Date(file.uploadedAt || order.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSingleManualFile(order.id, file.url);
                                                    }}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Einzelne Datei löschen"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )})}
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
                        selectedFiles.map((file) => {
                            // Match logic from CustomerDetails: try thumbnail, else url (for images or browser-supported formats)
                            const displayThumb = file.thumbnail || file.url;
                            return (
                                <div key={file.id} className="flex items-center bg-white border border-gray-200 p-2 rounded hover:border-red-200 transition-colors">
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
                                        <button onClick={() => updateQuantity(file.id, -1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600">-</button>
                                        <span className="px-2 text-sm font-medium w-8 text-center">{file.quantity}</span>
                                        <button onClick={() => updateQuantity(file.id, 1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600">+</button>
                                    </div>
                                    <button onClick={() => removeFile(file.id)} className="text-gray-400 hover:text-red-600 p-1">
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
                    <div 
                        className="p-4 bg-red-50 border-b border-red-100 animate-in slide-in-from-top-2 flex-1"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className={`max-w-xl mx-auto bg-white p-4 rounded shadow-sm border transition-all ${isDragging ? 'border-red-400 ring-2 ring-red-200' : 'border-red-100'}`}>
                            <h4 className="font-semibold text-gray-800 mb-3">Datei hochladen & Kunde zuweisen</h4>
                            
                            {isDragging && (
                                <div className="mb-4 p-4 bg-red-50 border-2 border-dashed border-red-300 rounded text-center text-red-600 font-medium">
                                    Datei hier ablegen
                                </div>
                            )}

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
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Drag & Drop möglich
                                    </p>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Anzahl</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={uploadQuantity}
                                        onChange={(e) => setUploadQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-red-500 focus:border-red-500"
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
                                                                            quantity: file.quantity || 1,
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {filteredAvailableFiles.map((file, idx) => {
                                const isSelected = selectedFiles.some(f => f.url === file.url && f.orderId === file.orderId);
                                const displayThumb = file.thumbnail || file.url;
                                
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => addFile(file)}
                                        className={`
                                            cursor-pointer rounded-lg border p-3 relative group hover:shadow-md transition-all flex flex-col
                                            ${isSelected ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 bg-white hover:border-red-300'}
                                        `}
                                    >
                                        <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden relative shrink-0">
                                            {displayThumb ? (
                                                <img src={displayThumb} alt="" className="w-full h-full object-contain" onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                                }} loading="lazy" decoding="async" />
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
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 break-words line-clamp-2 mb-1" title={file.name}>
                                                {file.reference && <span className="bg-blue-100 text-blue-800 text-[10px] px-1 rounded mr-1 inline-block mb-0.5">{file.reference}</span>}
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">{file.customerName}</p>
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                                                {selectedFiles.find(f => f.url === file.url && f.orderId === file.orderId)?.quantity}x
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
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl m-4 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">DTF Protokoll</div>
                <div className="text-lg font-black text-slate-900 truncate">PDF erfolgreich generiert</div>
              </div>
              <button onClick={handleCancelSuccess} className="text-slate-400 hover:text-slate-600 px-2 py-1">
                ✕
              </button>
            </div>

            <div ref={protocolScrollRef} onScroll={handleProtocolScroll} className="p-4 overflow-y-auto">
              {(generatedJobId || generatedStats) && (
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
                  {generatedJobId && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">DTF Job:</span>
                      <span className="font-mono">{generatedJobId}</span>
                    </div>
                  )}
                  {generatedStats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bögen:</span>
                        <span className="font-medium">{generatedStats.pages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Motive:</span>
                        <span className="font-medium">{generatedStats.uniqueFiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gesamtstücke:</span>
                        <span className="font-medium">{generatedStats.totalPieces}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Downloads</div>
                  <div className="flex flex-col gap-2">
                    {generatedPdfUrls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        download={`DTF_Print_Job_Part${idx + 1}.pdf`}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center font-bold transition-colors"
                      >
                        <Download className="mr-2" size={18} />
                        {generatedPdfUrls.length > 1 ? `PDF ${idx + 1} herunterladen` : 'PDF herunterladen'}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Hinweis</div>
                  <div className="text-sm text-slate-700">
                    Schau dir die Bögen hier direkt an. Wenn alles passt, kannst du unten bestätigen, dass die Aufträge aus der DTF-Liste entfernt werden.
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Bögen</div>
                {generatedJobDetailsLoading ? (
                  <div className="p-6 text-center text-slate-500">Lade Protokoll…</div>
                ) : Array.isArray(generatedJobDetails?.pages) && generatedJobDetails.pages.length > 0 ? (
                  <div className="space-y-4">
                    {generatedJobDetails.pages.map((p: any) => {
                      const placements = Array.isArray(p.placements) ? p.placements : [];
                      const counts: Record<string, number> = {};
                      for (const pl of placements) {
                        const key = String(pl.name || pl.url || 'Datei');
                        counts[key] = (counts[key] || 0) + 1;
                      }
                      const pageThumb = p.pdf_url ? `${p.pdf_url}_thumb.png` : '';
                      const pageThumbLg = p.pdf_url ? `${p.pdf_url}_thumb_lg.png` : '';
                      const utilPct = Math.round(((p.utilization || 0) * 100));
                      const utilClass = utilPct < 70 ? 'text-red-600' : utilPct < 90 ? 'text-yellow-600' : 'text-slate-500';

                      return (
                        <div key={p.index} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="font-bold text-slate-800">Bogen {Number(p.index) + 1}</div>
                            <div className="text-xs text-slate-500">
                              {Math.round((p.width_mm || 0))}×{Math.round((p.height_mm || 0))} mm · <span className={`${utilClass} font-bold`}>{utilPct}%</span>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div style={checkerStyle} className="w-32 h-32 border border-slate-200 rounded bg-white overflow-hidden shrink-0 flex items-center justify-center">
                              {pageThumb ? (
                                <img
                                  src={pageThumb}
                                  alt=""
                                  className="w-full h-full object-contain"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    onMouseEnter={() => setHoverPageThumb(pageThumbLg || pageThumb)}
                                  onMouseLeave={() => setHoverPageThumb(null)}
                                />
                              ) : (
                                <div className="text-xs text-slate-400">Kein Thumb</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-700 space-y-1">
                                {Object.entries(counts).map(([k, v]) => (
                                  <div key={k} className="flex justify-between gap-3">
                                    <span className="truncate" title={k}>{k}</span>
                                    <span className="font-mono shrink-0">{v}x</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500">Keine Detaildaten vorhanden.</div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="text-sm font-bold text-slate-800 mb-2 text-center">Aufträge für DTF entfernen?</div>
              {!protocolScrolled ? (
                <div className="text-center text-sm text-slate-500">
                  Bitte bis ganz nach unten scrollen, um die Bestätigung freizuschalten.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleCancelSuccess}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-bold transition-colors"
                  >
                    Nein, da ist was falsch (drin lassen)
                  </button>
                  <button
                    onClick={handleConfirmSuccess}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-bold transition-colors"
                  >
                    Perfekt – entfernen
                  </button>
                </div>
              )}
            </div>
          </div>

          {hoverPageThumb && (
            <div className="fixed inset-0 z-[60] pointer-events-none">
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div style={checkerStyle} className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-w-[min(1100px,calc(100vw-48px))]">
                  <img src={hoverPageThumb} alt="" className="w-full h-auto block" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

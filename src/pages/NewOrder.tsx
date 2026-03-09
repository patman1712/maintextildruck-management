import { useState, useEffect } from "react";
import { Upload, Plus, X, User, Calendar, FileText, ShoppingCart, Trash2, Package, Shield, Layers } from "lucide-react";
import { useAppStore, Order } from "@/store";
import { useNavigate } from "react-router-dom";

interface CustomerProduct {
    id: string;
    name: string;
    product_number: string;
    source?: 'manual' | 'shopware';
    supplier_id?: string;
    files: {
        id: string;
        file_url: string;
        file_name: string;
        thumbnail_url?: string;
        type?: string;
        quantity?: number;
    }[];
}

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
  const [existingPreviewFiles, setExistingPreviewFiles] = useState<{name: string, url: string, type: 'preview'}[]>([]);
  const [showPreviewSelector, setShowPreviewSelector] = useState(false);
  const [availablePreviews, setAvailablePreviews] = useState<{name: string, url: string, date: string, source: string}[]>([]);
  const [selectedExistingPreviews, setSelectedExistingPreviews] = useState<string[]>([]); // URLs

  const loadCustomerPreviews = async () => {
      if (!selectedCustomerId) return;
      
      const allPreviews: {name: string, url: string, date: string, source: string}[] = [];
      const seenUrls = new Set<string>();

      // 1. Get previews from existing Orders
      const orders = useAppStore.getState().orders;
      const customerOrders = orders
          .filter(o => o.customerId === selectedCustomerId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      customerOrders.forEach(order => {
          if (order.files) {
              order.files.forEach(f => {
                  if (f.type === 'preview' && f.url) {
                      if (!seenUrls.has(f.url)) {
                          seenUrls.add(f.url);
                          allPreviews.push({
                              name: f.customName || f.name,
                              url: f.url,
                              date: order.createdAt,
                              source: `Auftrag: ${order.title}`
                          });
                      }
                  }
              });
          }
      });

      // 2. Get previews from Products (Freisteller results)
      try {
          const res = await fetch(`/api/products/${selectedCustomerId}`);
          const data = await res.json();
          if (data.success && data.data) {
              data.data.forEach((product: any) => {
                  if (product.files) {
                      product.files.forEach((f: any) => {
                          if (f.type === 'preview' && (f.file_url || f.url)) {
                              const url = f.file_url || f.url;
                              if (!seenUrls.has(url)) {
                                  seenUrls.add(url);
                                  allPreviews.push({
                                      name: f.customName || f.file_name || f.name || product.name,
                                      url: url,
                                      date: product.created_at || new Date().toISOString(),
                                      source: `Produkt: ${product.name}`
                                  });
                              }
                          }
                      });
                  }
              });
          }
      } catch (err) {
          console.error(err);
      }

      setAvailablePreviews(allPreviews);
      setSearchTerm("");
      setShowPreviewSelector(true);
  };

  const addSelectedPreviews = () => {
      const filesToAdd = availablePreviews.filter(f => selectedExistingPreviews.includes(f.url));
      
      const newAttachments = filesToAdd.map(f => ({
          name: f.name,
          url: f.url,
          type: 'preview' as const
      }));
      
      // Filter duplicates
      const currentUrls = existingPreviewFiles.map(f => f.url);
      const uniqueNew = newAttachments.filter(f => !currentUrls.includes(f.url));

      setExistingPreviewFiles([...existingPreviewFiles, ...uniqueNew]);
      setShowPreviewSelector(false);
      setSelectedExistingPreviews([]);
  };
  const [printFiles, setPrintFiles] = useState<{file: File, customName?: string, quantity: number}[]>([]);
  const [vectorFiles, setVectorFiles] = useState<File[]>([]);
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [photoshopFiles, setPhotoshopFiles] = useState<File[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isDragging, setIsDragging] = useState<string | null>(null);
  
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
  const [customerContactPerson, setCustomerContactPerson] = useState("");
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
    notes: '',
    price: ''
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
            notes: '',
            price: ''
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
      setCustomerContactPerson(customer.contact_person || "");
      setCustomerEmail(customer.email);
      setCustomerPhone(customer.phone);
      setCustomerAddress(customer.address);
      
      // We could also offer to load previous print files here
      // But maybe it's better to have a dedicated button for that
    } else {
      setCustomerName("");
      setCustomerContactPerson("");
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

  const [existingFilesToAttach, setExistingFilesToAttach] = useState<{name: string, url: string, type: 'print' | 'photoshop', quantity?: number}[]>([]);

  const [showPhotoshopSelector, setShowPhotoshopSelector] = useState(false);
  const [availablePhotoshopFiles, setAvailablePhotoshopFiles] = useState<{name: string, url: string, type: 'photoshop', date: string, orderTitle: string}[]>([]);
  const [selectedExistingPhotoshopFiles, setSelectedExistingPhotoshopFiles] = useState<string[]>([]); // URLs

  const loadCustomerPhotoshopFiles = () => {
    if (!selectedCustomerId) return;
    
    // Find all orders for this customer
    const orders = useAppStore.getState().orders;
    const customerOrders = orders
        .filter(o => o.customerId === selectedCustomerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const allFiles: {name: string, url: string, type: 'photoshop', date: string, orderTitle: string}[] = [];
    const seenUrls = new Set<string>();
    
    customerOrders.forEach(order => {
        if (order.files) {
            order.files.forEach(f => {
                if (f.type === 'photoshop' && f.url) {
                    if (!seenUrls.has(f.url)) {
                        seenUrls.add(f.url);
                        allFiles.push({
                            name: f.customName || f.name,
                            url: f.url,
                            type: 'photoshop',
                            date: order.createdAt,
                            orderTitle: order.title
                        });
                    }
                }
            });
        }
    });
    
    setAvailablePhotoshopFiles(allFiles);
    setSearchTerm("");
    setShowPhotoshopSelector(true);
  };

  const addSelectedPhotoshopFiles = () => {
    const filesToAdd = availablePhotoshopFiles.filter(f => selectedExistingPhotoshopFiles.includes(f.url));
    
    const newAttachments = filesToAdd.map(f => ({
        name: f.name,
        url: f.url,
        type: 'photoshop' as const
    }));
    
    setExistingFilesToAttach([...existingFilesToAttach, ...newAttachments]);
    setShowPhotoshopSelector(false);
    setSelectedExistingPhotoshopFiles([]);
  };

  const parseQuantity = (input: string): number => {
      // Try to find patterns like "5x", "5 x", "5X"
      const matches = input.match(/(\d+)\s*[xX]/g);
      if (matches) {
          let total = 0;
          matches.forEach(m => {
              const num = parseInt(m.match(/\d+/)?.[0] || "0");
              total += num;
          });
          return total > 0 ? total : 1;
      }
      
      // If no "x" pattern, try to parse the whole string as a number
      const simpleNum = parseInt(input);
      if (!isNaN(simpleNum) && String(simpleNum) === input.trim()) {
          return simpleNum;
      }
      
      return 1;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "preview" | "print" | "vector" | "internal" | "photoshop") => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (type === "preview") {
        setFiles([...files, ...newFiles]);
      } else if (type === "print") {
        setPrintFiles([...printFiles, ...newFiles.map(f => ({ file: f, customName: "", quantity: 1 }))]);
      } else if (type === "vector") {
        setVectorFiles([...vectorFiles, ...newFiles]);
      } else if (type === "internal") {
        setInternalFiles([...internalFiles, ...newFiles]);
      } else if (type === "photoshop") {
        setPhotoshopFiles([...photoshopFiles, ...newFiles]);
      }
    }
  };

  const removeFile = (index: number, type: "preview" | "print" | "vector" | "internal" | "photoshop") => {
    if (type === "preview") {
      setFiles(files.filter((_, i) => i !== index));
    } else if (type === "print") {
      setPrintFiles(printFiles.filter((_, i) => i !== index));
    } else if (type === "vector") {
      setVectorFiles(vectorFiles.filter((_, i) => i !== index));
    } else if (type === "internal") {
      setInternalFiles(internalFiles.filter((_, i) => i !== index));
    } else if (type === "photoshop") {
      setPhotoshopFiles(photoshopFiles.filter((_, i) => i !== index));
    }
  };

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(null);
  };

  const handleDrop = (e: React.DragEvent, type: "preview" | "print" | "vector" | "internal" | "photoshop") => {
    e.preventDefault();
    setIsDragging(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      if (type === "preview") {
        setFiles([...files, ...newFiles]);
      } else if (type === "print") {
        setPrintFiles([...printFiles, ...newFiles.map(f => ({ file: f, customName: "", quantity: 1 }))]);
      } else if (type === "vector") {
        setVectorFiles([...vectorFiles, ...newFiles]);
      } else if (type === "internal") {
        setInternalFiles([...internalFiles, ...newFiles]);
      } else if (type === "photoshop") {
        setPhotoshopFiles([...photoshopFiles, ...newFiles]);
      }
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
    internalFiles.forEach(f => formData.append('internal', f));
    photoshopFiles.forEach(f => formData.append('photoshop', f));

    let uploadedFiles: { name: string; type: 'preview' | 'print' | 'vector' | 'internal' | 'photoshop'; url?: string; customName?: string }[] = [];
    
    // Add existing attached files first
    uploadedFiles = [...uploadedFiles, ...existingFilesToAttach, ...existingPreviewFiles];

    try {
      // Only fetch if there are files
      if (files.length > 0 || printFiles.length > 0 || vectorFiles.length > 0 || internalFiles.length > 0 || photoshopFiles.length > 0) {
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
                customName: printFiles[i]?.customName || "",
                quantity: printFiles[i]?.quantity || 1
            }))];
          }
          if (data.files.vector) {
            uploadedFiles = [...uploadedFiles, ...data.files.vector.map((f: any) => ({ name: f.originalName, type: 'vector' as const, url: f.path }))];
          }
          if (data.files.internal) {
            uploadedFiles = [...uploadedFiles, ...data.files.internal.map((f: any) => ({ name: f.originalName, type: 'internal' as const, url: f.path }))];
          }
          if (data.files.photoshop) {
            uploadedFiles = [...uploadedFiles, ...data.files.photoshop.map((f: any) => ({ name: f.originalName, type: 'photoshop' as const, url: f.path, thumbnail: f.thumbnail }))];
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
            contact_person: customerContactPerson,
            email: customerEmail,
            phone: customerPhone,
            address: customerAddress,
            created_at: new Date().toISOString()
        });
    }

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      title: title || "Neuer Auftrag",
      orderNumber: orderNumber, // Include generated number
      customerId: newCustomerId || undefined,
      customerName: customerName || "Unbekannter Kunde",
      customerContactPerson,
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
                notes: item.notes,
                price: item.price
            });
        }
    }

    navigate("/dashboard/orders");
  };

  // --- Customer Product Logic ---
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [productSizeInput, setProductSizeInput] = useState("");
  const [fileQuantities, setFileQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (selectedProduct && selectedProduct.files) {
        const baseQty = parseQuantity(productSizeInput);
        const newQuantities: Record<string, number> = {};
        selectedProduct.files.forEach(f => {
            if (f.type === 'view' || f.file_name === 'Shopware Bild') {
                newQuantities[f.id] = 1;
            } else {
                newQuantities[f.id] = baseQty * (f.quantity || 1);
            }
        });
        setFileQuantities(newQuantities);
    }
  }, [productSizeInput, selectedProduct]);

  // Update manual item quantity based on size input
  useEffect(() => {
    const qty = parseQuantity(newItem.size);
    if (qty !== newItem.quantity && newItem.size) {
        setNewItem(prev => ({ ...prev, quantity: qty }));
    }
  }, [newItem.size]);
  
  const loadCustomerProducts = async () => {
      if (!selectedCustomerId) return;
      try {
          const res = await fetch(`/api/products/${selectedCustomerId}`);
          const data = await res.json();
          if (data.success) {
              setCustomerProducts(data.data);
              setShowProductSelector(true);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleAddProduct = () => {
      if (!selectedProduct) return;
      
      const quantityToAdd = parseQuantity(productSizeInput);

      // Add Item
      const newItemEntry = {
          supplierId: selectedProduct.supplier_id || "",
          itemName: selectedProduct.name,
          itemNumber: selectedProduct.product_number,
          color: "",
          size: productSizeInput,
          quantity: 1, // Quantity is implied in size input usually like "5x L", but we can set 1 as base
          notes: "Aus Kundenartikel",
          price: (selectedProduct as any).price || ''
      };
      
      setOrderItems([...orderItems, { ...newItemEntry, id: Math.random().toString(36).substr(2, 9), status: 'pending' }]);

      // Add Files
      if (selectedProduct.files && selectedProduct.files.length > 0) {
          const newPrintFiles: {name: string, url: string, type: 'print', quantity: number}[] = [];
          const newPreviewFiles: {name: string, url: string, type: 'preview'}[] = [];

          selectedProduct.files.forEach(f => {
              // Map 'view' to 'preview' for order context
              // Also check for 'Shopware Bild' as fallback if type is missing
              if (f.type === 'view' || f.file_name === 'Shopware Bild') {
                  newPreviewFiles.push({
                      name: f.file_name,
                      url: f.file_url,
                      type: 'preview' as const
                  });
              } else {
                  // Default to print if type is 'print' or undefined
                  newPrintFiles.push({
                      name: f.file_name,
                      url: f.file_url,
                      type: 'print' as const,
                      quantity: fileQuantities[f.id] || (quantityToAdd * (f.quantity || 1))
                  });
              }
          });
          
          // Update Print Files (Merge quantities)
          let updatedExistingFiles = [...existingFilesToAttach];
          
          newPrintFiles.forEach(newFile => {
              const existingIndex = updatedExistingFiles.findIndex(ef => ef.url === newFile.url);
              if (existingIndex >= 0) {
                  // Update quantity
                  const currentQty = updatedExistingFiles[existingIndex].quantity || 1;
                  updatedExistingFiles[existingIndex] = {
                      ...updatedExistingFiles[existingIndex],
                      quantity: currentQty + newFile.quantity
                  };
              } else {
                  // Add new
                  updatedExistingFiles.push(newFile);
              }
          });
          
          setExistingFilesToAttach(updatedExistingFiles);

          // Filter out duplicates for Preview Files
          const currentPreviewUrls = existingPreviewFiles.map(f => f.url);
          const uniquePreviewAttachments = newPreviewFiles.filter(f => !currentPreviewUrls.includes(f.url));

          if (uniquePreviewAttachments.length > 0) {
              setExistingPreviewFiles([...existingPreviewFiles, ...uniquePreviewAttachments]);
          }
      }

      setShowProductSelector(false);
      setSelectedProduct(null);
      setProductSizeInput("");
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
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vereinsname / Firmenname</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner / Team</label>
            <input 
                type="text" 
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 border p-2" 
                placeholder="z.B. Max Mustermann" 
                value={customerContactPerson}
                onChange={(e) => setCustomerContactPerson(e.target.value)}
            />
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
              {users.filter(u => u.role !== 'admin').length > 0 ? (
                users.filter(u => u.role !== 'admin').map((user) => (
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
          <div 
            onDragOver={(e) => handleDragOver(e, "preview")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "preview")}
            className="relative"
          >
            {isDragging === "preview" && (
                <div className="absolute inset-0 bg-gray-100/90 z-10 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400">
                    <p className="text-gray-700 font-bold">Vorschaubilder hier ablegen</p>
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Ansichten / Vorschauen</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Nur Ansicht</span>
            </h3>
            <div className={`border-2 border-dashed ${isDragging === "preview" ? 'border-gray-400 bg-gray-100' : 'border-gray-300'} rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative`}>
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
            
            {/* Button to load existing previews */}
            {selectedCustomerId && (
                <div className="mt-2 text-right">
                    <button 
                        type="button"
                        onClick={loadCustomerPreviews}
                        className="text-xs text-gray-600 hover:text-gray-800 underline font-medium flex items-center justify-end ml-auto"
                    >
                        <FileText size={14} className="mr-1" />
                        Kunden-Vorschaubilder laden
                    </button>
                </div>
            )}
            
            {/* Existing Preview Files */}
            {existingPreviewFiles.length > 0 && (
              <div className="mt-4 mb-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Aus Artikel übernommen</h4>
                  <div className="grid grid-cols-3 gap-2">
                      {existingPreviewFiles.map((file, idx) => (
                          <div key={`existing-preview-${idx}`} className="relative group">
                              <div 
                                  className="h-24 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-300"
                                  onClick={() => setLightboxImage(file.url)}
                              >
                                  <img src={file.url} className="w-full h-full object-contain" alt={file.name} />
                              </div>
                              <button 
                                  type="button"
                                  onClick={() => {
                                      setExistingPreviewFiles(existingPreviewFiles.filter((_, i) => i !== idx));
                                  }}
                                  className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
            )}

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
          <div 
            onDragOver={(e) => handleDragOver(e, "vector")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "vector")}
            className="relative"
          >
            {isDragging === "vector" && (
                <div className="absolute inset-0 bg-blue-100/90 z-10 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-400">
                    <p className="text-blue-700 font-bold">Rohdaten hier ablegen</p>
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Rohdaten / Zum Vektorisieren</span>
              <span className="text-xs font-normal text-blue-800 bg-blue-100 px-2 py-1 rounded">Bearbeitung</span>
            </h3>
            <div className={`border-2 border-dashed ${isDragging === "vector" ? 'border-blue-400 bg-blue-100' : 'border-blue-200 bg-blue-50/30'} rounded-lg p-6 text-center hover:bg-blue-50 transition-colors relative`}>
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

          {/* Internal Files */}
          <div 
            onDragOver={(e) => handleDragOver(e, "internal")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "internal")}
            className="relative"
          >
            {isDragging === "internal" && (
                <div className="absolute inset-0 bg-amber-100/90 z-10 rounded-lg flex items-center justify-center border-2 border-dashed border-amber-400">
                    <p className="text-amber-700 font-bold">Interne Bilder hier ablegen</p>
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Interne Bilder</span>
              <span className="text-xs font-normal text-amber-800 bg-amber-100 px-2 py-1 rounded">Nur Intern</span>
            </h3>
            <div className={`border-2 border-dashed ${isDragging === "internal" ? 'border-amber-400 bg-amber-100' : 'border-amber-200 bg-amber-50/30'} rounded-lg p-6 text-center hover:bg-amber-50 transition-colors relative`}>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "internal")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*"
              />
              <Shield className="mx-auto h-8 w-8 text-amber-400 mb-2" />
              <p className="text-sm text-amber-600 font-medium">Interne Bilder hochladen</p>
              <p className="text-xs text-amber-400 mt-1">Werden bei Auftragsende gelöscht</p>
            </div>
            {internalFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                {internalFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-amber-50 p-2 rounded border border-amber-100 text-amber-800">
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx, "internal")} className="text-amber-400 hover:text-amber-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Photoshop Files */}
          <div 
            onDragOver={(e) => handleDragOver(e, "photoshop")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "photoshop")}
            className="relative"
          >
            {isDragging === "photoshop" && (
                <div className="absolute inset-0 bg-blue-100/90 z-10 rounded-lg flex items-center justify-center border-2 border-dashed border-blue-400">
                    <p className="text-blue-700 font-bold">Photoshop Dateien hier ablegen</p>
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Photoshop Dateien</span>
              <span className="text-xs font-normal text-blue-900 bg-blue-100 px-2 py-1 rounded">Intern (.psd, .pdf)</span>
            </h3>
            <div className={`border-2 border-dashed ${isDragging === "photoshop" ? 'border-blue-400 bg-blue-100' : 'border-blue-200 bg-blue-50/30'} rounded-lg p-6 text-center hover:bg-blue-50 transition-colors relative`}>
              <input
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, "photoshop")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".psd,.pdf"
              />
              <Layers className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm text-blue-700 font-medium">PSD/PDF hochladen</p>
              <p className="text-xs text-blue-500 mt-1">Nur für interne Bearbeitung</p>
            </div>
            {/* Button to load existing Photoshop files */}
            {selectedCustomerId && (
                <div className="mt-2 text-right">
                    <button 
                        type="button"
                        onClick={loadCustomerPhotoshopFiles}
                        className="text-xs text-blue-600 hover:text-blue-800 underline font-medium flex items-center justify-end ml-auto"
                    >
                        <Layers size={14} className="mr-1" />
                        Bereits hochgeladene Photoshop-Dateien verwenden
                    </button>
                </div>
            )}

            {/* Existing Photoshop Files List */}
            {existingFilesToAttach.filter(f => f.type === 'photoshop').length > 0 && (
              <ul className="mt-4 space-y-2">
                {existingFilesToAttach.filter(f => f.type === 'photoshop').map((file, idx) => (
                  <li key={`existing-ps-${idx}`} className="flex justify-between items-center text-sm bg-blue-50 p-2 rounded border border-blue-100 text-blue-800">
                    <div className="flex items-center">
                        <span className="bg-blue-200 text-blue-800 text-[10px] px-1 rounded mr-2">ARCHIV</span>
                        <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeExistingFile(existingFilesToAttach.indexOf(file))} className="text-blue-400 hover:text-blue-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {photoshopFiles.length > 0 && (
              <ul className="mt-4 space-y-2">
                {photoshopFiles.map((file, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm bg-blue-50 p-2 rounded border border-blue-100 text-blue-800">
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx, "photoshop")} className="text-blue-400 hover:text-blue-700">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Print Files */}
          <div 
            className="md:col-span-2 relative"
            onDragOver={(e) => handleDragOver(e, "print")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "print")}
          >
            {isDragging === "print" && (
                <div className="absolute inset-0 bg-red-100/90 z-10 rounded-lg flex items-center justify-center border-2 border-dashed border-red-400">
                    <p className="text-red-700 font-bold">Druckdaten hier ablegen</p>
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex justify-between items-center">
              <span>Fertige Druckdaten DTF</span>
              <span className="text-xs font-normal text-white bg-red-600 px-2 py-1 rounded">PNG & PDF</span>
            </h3>
            <div className={`border-2 border-dashed ${isDragging === "print" ? 'border-red-400 bg-red-100' : 'border-red-200 bg-red-50/30'} rounded-lg p-6 text-center hover:bg-red-50 transition-colors relative`}>
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
                        {(file.quantity || 1) > 1 && (
                            <span className="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded-full font-bold">
                                {file.quantity}x
                            </span>
                        )}
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
                    <div className="flex gap-2">
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
                        <div className="flex items-center bg-white rounded border border-red-200 overflow-hidden shrink-0 w-16">
                            <input 
                                type="number" 
                                min="1"
                                className="w-full text-center text-xs p-1 border-none focus:ring-0 appearance-none"
                                value={item.quantity || 1}
                                onChange={(e) => {
                                    const newFiles = [...printFiles];
                                    newFiles[idx].quantity = parseInt(e.target.value) || 1;
                                    setPrintFiles(newFiles);
                                }}
                            />
                            <span className="bg-gray-50 text-gray-500 px-1 border-l border-red-100 text-[10px] h-full flex items-center justify-center">x</span>
                        </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      {/* Preview Selector Modal */}
      {showPreviewSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Vorschaubild aus Kundenarchiv wählen</h3>
                    <button onClick={() => setShowPreviewSelector(false)} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder="Suchen..." 
                            className="w-full border p-2 rounded text-sm focus:ring-red-500 focus:border-red-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    {availablePreviews.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            {searchTerm ? "Keine passenden Dateien gefunden." : "Keine Vorschaubilder gefunden."}
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {availablePreviews
                                .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((file, idx) => (
                                <div 
                                    key={idx} 
                                    className={`border rounded p-3 cursor-pointer transition-all relative ${
                                        selectedExistingPreviews.includes(file.url) 
                                        ? 'border-red-500 bg-red-50 ring-1 ring-red-500' 
                                        : 'border-gray-200 hover:border-red-300'
                                    }`}
                                    onClick={() => {
                                        if (selectedExistingPreviews.includes(file.url)) {
                                            setSelectedExistingPreviews(selectedExistingPreviews.filter(u => u !== file.url));
                                        } else {
                                            setSelectedExistingPreviews([...selectedExistingPreviews, file.url]);
                                        }
                                    }}
                                >
                                    <div className="h-24 bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                                        <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                                    </div>
                                    <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{new Date(file.date).toLocaleDateString()} - {file.source}</p>
                                    
                                    {selectedExistingPreviews.includes(file.url) && (
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
                        onClick={() => setShowPreviewSelector(false)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={addSelectedPreviews}
                        disabled={selectedExistingPreviews.length === 0}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Ausgewählte hinzufügen ({selectedExistingPreviews.length})
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Photoshop File Selector Modal */}
      {showPhotoshopSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Photoshop-Dateien aus Archiv wählen</h3>
                    <button onClick={() => setShowPhotoshopSelector(false)} className="text-gray-500 hover:text-gray-700">
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
                    
                    {availablePhotoshopFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            {searchTerm ? "Keine passenden Dateien gefunden." : "Keine Photoshop-Dateien für diesen Kunden gefunden."}
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {availablePhotoshopFiles
                                .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((file, idx) => (
                                <div 
                                    key={idx} 
                                    className={`border rounded p-3 cursor-pointer transition-all relative ${
                                        selectedExistingPhotoshopFiles.includes(file.url) 
                                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                                        : 'border-gray-200 hover:border-blue-300'
                                    }`}
                                    onClick={() => {
                                        if (selectedExistingPhotoshopFiles.includes(file.url)) {
                                            setSelectedExistingPhotoshopFiles(selectedExistingPhotoshopFiles.filter(u => u !== file.url));
                                        } else {
                                            setSelectedExistingPhotoshopFiles([...selectedExistingPhotoshopFiles, file.url]);
                                        }
                                    }}
                                >
                                    <div className="h-24 bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden">
                                         <Layers className="h-10 w-10 text-blue-400" />
                                    </div>
                                    <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{new Date(file.date).toLocaleDateString()} - {file.orderTitle}</p>
                                    
                                    {selectedExistingPhotoshopFiles.includes(file.url) && (
                                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-0.5">
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
                        onClick={() => setShowPhotoshopSelector(false)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={addSelectedPhotoshopFiles}
                        disabled={selectedExistingPhotoshopFiles.length === 0}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Ausgewählte hinzufügen ({selectedExistingPhotoshopFiles.length})
                    </button>
                </div>
            </div>
        </div>
      )}
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
      {/* Product Selector Modal */}
          <h3 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center justify-between">
            <div className="flex items-center">
                <ShoppingCart className="mr-2 text-red-600" size={20} />
                Benötigte Ware / Textilien
            </div>
            {selectedCustomerId && (
                <button 
                    type="button"
                    onClick={loadCustomerProducts}
                    className="text-xs text-red-600 hover:text-red-800 underline font-medium flex items-center"
                >
                    <Package size={14} className="mr-1" />
                    Aus Kundenartikel wählen
                </button>
            )}
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                <div className="md:col-span-2">
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
                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Artikelname / Art.-Nr. / Farbe</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="z.B. Premium Hoodie - Navy"
                        value={newItem.itemName}
                        onChange={(e) => setNewItem({...newItem, itemName: e.target.value})}
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Größe / Beschreibung</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="z.B. 5x XL, 3x L"
                        value={newItem.size}
                        onChange={(e) => setNewItem({...newItem, size: e.target.value})}
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Anzahl</label>
                    <input 
                        type="number" 
                        min="1"
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 font-bold text-center"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                    />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Preis (€)</label>
                    <input 
                        type="number" 
                        step="0.01"
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 text-right"
                        placeholder="0.00"
                        value={newItem.price}
                        onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                    />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notizen (Optional)</label>
                    <input 
                        type="text" 
                        className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2"
                        placeholder="..."
                        value={newItem.notes}
                        onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                    />
                </div>
                <div className="md:col-span-12 flex items-end justify-end">
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
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preis</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notiz</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktion</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orderItems.map((item, index) => (
                            <tr key={index}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.itemName}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-bold">
                                    {item.quantity > 1 && !/(\d+)\s*[xX]/.test(item.size) ? `${item.quantity}x ` : ''}{item.size}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {suppliers.find(s => s.id === item.supplierId)?.name || 'Unbekannt'}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                                    {item.price ? `${Number(item.price).toFixed(2)} €` : '-'}
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

      {/* Product Selector Modal */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Artikel aus Kundenstamm wählen</h3>
                    <button onClick={() => setShowProductSelector(false)} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>
                
                {!selectedProduct ? (
                    // Step 1: Select Product
                    <div className="p-4 overflow-y-auto flex-1">
                        <div className="mb-4">
                            <input 
                                type="text" 
                                placeholder="Artikel suchen..." 
                                className="w-full border p-2 rounded text-sm focus:ring-red-500 focus:border-red-500"
                                value={productSearchTerm}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        {customerProducts.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) && p.source !== 'shopware').length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                                {productSearchTerm ? "Keine passenden Artikel gefunden." : "Keine Artikel für diesen Kunden hinterlegt."}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {customerProducts
                                    .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) && p.source !== 'shopware')
                                    .map((product) => (
                                    <div 
                                        key={product.id} 
                                        className="border rounded p-3 cursor-pointer hover:bg-gray-50 hover:border-red-300 transition-all flex justify-between items-center group"
                                        onClick={() => setSelectedProduct(product)}
                                    >
                                        <div>
                                            <p className="font-medium text-gray-800">{product.name}</p>
                                            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                                                {product.product_number && <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{product.product_number}</span>}
                                                {product.supplier_id && suppliers.find(s => s.id === product.supplier_id) && (
                                                    <span className="text-purple-600 flex items-center">
                                                        <Package size={10} className="mr-1" />
                                                        {suppliers.find(s => s.id === product.supplier_id)?.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={20} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // Step 2: Enter Details
                    <div className="p-6">
                        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                            <h4 className="font-bold text-gray-800">{selectedProduct.name}</h4>
                            <p className="text-sm text-gray-500">{selectedProduct.product_number}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Größe / Anzahl</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded focus:ring-red-500 focus:border-red-500"
                                placeholder="z.B. 5x L, 3x XL"
                                value={productSizeInput}
                                onChange={(e) => setProductSizeInput(e.target.value)}
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-1">Bitte geben Sie die benötigten Größen und Mengen an.</p>
                        </div>

                        {selectedProduct.files && selectedProduct.files.length > 0 && (
                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Automatisch zugeordnete Druckdaten:</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedProduct.files.map(f => (
                                        <div key={f.id} className="text-xs bg-red-50 text-red-800 border border-red-100 px-2 py-1 rounded flex items-center">
                                            <FileText size={12} className="mr-1" />
                                            <span className="truncate max-w-[150px] mr-2">{f.file_name}</span>
                                            <div className="flex items-center bg-white rounded border border-red-200 overflow-hidden">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    className="w-12 text-center text-xs p-0.5 border-none focus:ring-0 appearance-none"
                                                    value={fileQuantities[f.id] || 0}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setFileQuantities(prev => ({...prev, [f.id]: val}));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="bg-gray-50 text-gray-500 px-1.5 border-l border-red-100">x</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1 italic">
                                    Hinweis: Die Anzahl basiert auf Ihrer Eingabe "{productSizeInput}" und der Einstellung im Artikel. Sie können die Anzahl hier manuell anpassen.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 mt-6">
                            <button 
                                onClick={() => setSelectedProduct(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                            >
                                Zurück
                            </button>
                            <button 
                                onClick={handleAddProduct}
                                disabled={!productSizeInput}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                Zum Auftrag hinzufügen
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
      {/* Lightbox Modal */}
      {lightboxImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
              <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <img src={lightboxImage} className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
                  <button 
                      className="absolute -top-4 -right-4 bg-white text-black rounded-full p-2 hover:bg-gray-200 shadow-lg"
                      onClick={() => setLightboxImage(null)}
                  >
                      <X size={24} />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}

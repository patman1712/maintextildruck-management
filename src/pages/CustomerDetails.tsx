import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore, Order } from "@/store";
import { ArrowLeft, User, FileText, Download, Printer, Phone, Mail, MapPin, Edit, Save, X, Trash2, Pencil, Upload, ShoppingBag, CheckCircle, AlertCircle, Link, Search, Package, Plus, Image as ImageIcon, Copy } from "lucide-react";
import ConfirmationModal from "@/components/ConfirmationModal";

interface Product {
    id: string;
    name: string;
    product_number: string;
    source: 'shopware' | 'manual';
    supplier_id?: string;
    size?: string;
    color?: string;
    created_at?: string;
    files: {
        id: string;
        file_url: string;
        file_name: string;
        thumbnail_url?: string;
        type?: string;
        quantity?: number;
    }[];
}

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customers = useAppStore((state) => state.customers);
  const suppliers = useAppStore((state) => state.suppliers);
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const currentUser = useAppStore((state) => state.currentUser);
  const fetchData = useAppStore((state) => state.fetchData);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const addOrder = useAppStore((state) => state.addOrder);

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<{name: string, contact_person?: string, email: string, phone: string, address: string} | null>(null);
  
  // State for direct upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'previews' | 'products' | 'online_products' | 'shopware'>('overview');
  
  const [customer, setCustomer] = useState(customers.find(c => c.id === id));
  const [customerOrders, setCustomerOrders] = useState(
    orders.filter(o => o.customerId === id || o.customerName === customer?.name)
  );
  
  // Archived Files State
  const [archivedFiles, setArchivedFiles] = useState<any[]>([]);

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
  const [newManualProduct, setNewManualProduct] = useState({ name: '', productNumber: '', supplierId: '' });
  const [assignFileMode, setAssignFileMode] = useState(false);
  const [assignFileType, setAssignFileType] = useState<'print' | 'view'>('print');
  
  // Bulk Assign State
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkSelectedFiles, setBulkSelectedFiles] = useState<{url: string, name: string, thumbnail?: string}[]>([]);
  const [bulkProductSearch, setBulkProductSearch] = useState('');
  const [bulkAssignType, setBulkAssignType] = useState<'print' | 'view'>('print');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState<string[]>([]);
  const [bulkSupplierId, setBulkSupplierId] = useState('');
  const [fileTab, setFileTab] = useState<'upload' | 'gallery'>('gallery');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      type?: 'danger' | 'warning' | 'info' | 'success';
      confirmText?: string;
      cancelText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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
        contact_person: foundCustomer.contact_person,
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
      if (customer) {
          fetchProducts();
          fetchCustomerFiles();
      }
  }, [customer]);

  const handleSaveCustomer = async () => {
    if (!editedCustomer || !customer) return;
    
    await updateCustomer(customer.id, editedCustomer);
    setCustomer({ ...customer, ...editedCustomer });
    setIsEditing(false);
  };

  const fetchCustomerFiles = async () => {
      if (!customer) return;
      try {
          const res = await fetch(`/api/customers/${customer.id}/files`);
          const data = await res.json();
          if (data.success) {
              setArchivedFiles(data.data);
          }
      } catch (err) {
          console.error(err);
      }
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
      if (!customer) return;
      if (!newManualProduct.name.trim()) {
          alert('Bitte geben Sie einen Artikelnamen ein.');
          return;
      }
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
              setNewManualProduct({ name: '', productNumber: '', supplierId: '' });
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
                  productNumber: editingProduct.product_number,
                  supplierId: editingProduct.supplier_id
              })
          });
          fetchProducts();
          setShowMappingModal(false);
          setEditingProduct(null);
      } catch (err) {
          console.error(err);
      }
  };

  const handleDeleteProduct = (productId: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Produkt löschen',
          message: 'Möchten Sie dieses Produkt wirklich löschen?',
          type: 'danger',
          confirmText: 'Löschen',
          onConfirm: async () => {
              try {
                  const res = await fetch(`/api/products/${productId}`, {
                      method: 'DELETE'
                  });
                  const data = await res.json();
                  
                  if (data.success) {
                      // Remove from local state immediately to give instant feedback
                      setProducts(prev => prev.filter(p => p.id !== productId));
                      // Then fetch to be sure
                      fetchProducts();
                  } else {
                      alert('Fehler beim Löschen: ' + (data.error || 'Unbekannter Fehler'));
                  }
              } catch (err) {
                  console.error(err);
                  alert('Netzwerkfehler beim Löschen.');
              }
          }
      });
  };

  const handleDuplicateProduct = async (product: Product) => {
      if (!customer) return;
      
      if (!confirm(`Möchten Sie den Artikel "${product.name}" wirklich duplizieren?`)) return;

      try {
          const response = await fetch(`/api/products/${product.id}/duplicate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `${product.name} (Kopie)`
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            fetchData();
            setActiveTab('products');
          } else {
            alert('Fehler beim Duplizieren: ' + data.error);
          }
      } catch (err) {
          console.error(err);
          alert('Netzwerkfehler beim Duplizieren.');
      }
  };

  const handleDeleteAllProducts = () => {
      if (!customer) return;

      const executeDelete = async () => {
          try {
              const res = await fetch(`/api/products/customer/${customer.id}/all`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) {
                  fetchProducts();
                  // Optional: Show success toast/modal
              } else {
                  alert('Fehler: ' + data.error);
              }
          } catch (err) {
              console.error(err);
              alert('Netzwerkfehler.');
          }
      };

      const confirmStep2 = () => {
          // Small delay to allow modal transition if reusing same component
          setTimeout(() => {
            setConfirmModal({
                isOpen: true,
                title: 'Endgültige Bestätigung',
                message: "Dies löscht alle Artikeldaten und zugehörige Bilder physisch vom Server.\nDiese Aktion kann NICHT rückgängig gemacht werden.",
                type: 'danger',
                confirmText: 'Ja, unwiderruflich löschen',
                onConfirm: executeDelete
            });
          }, 200);
      };

      setConfirmModal({
          isOpen: true,
          title: 'Alle Artikel löschen',
          message: `WARNUNG: Sind Sie sicher, dass Sie ALLE ${products.length} Artikel von "${customer.name}" löschen möchten?`,
          type: 'danger',
          confirmText: 'Fortfahren',
          onConfirm: confirmStep2
      });
  };

  const handleDeleteAllShopwareProducts = () => {
      if (!customer) return;
      
      const shopwareCount = products.filter(p => p.source === 'shopware').length;
      if (shopwareCount === 0) return;

      setConfirmModal({
          isOpen: true,
          title: 'Alle Online-Artikel löschen',
          message: `Möchten Sie wirklich alle ${shopwareCount} importierten Shopware-Artikel löschen? Manuell erstellte Artikel bleiben erhalten.`,
          type: 'danger',
          confirmText: 'Alle löschen',
          onConfirm: async () => {
              try {
                  const res = await fetch(`/api/products/customer/${customer.id}/shopware`, { method: 'DELETE' });
                  const data = await res.json();
                  if (data.success) {
                      fetchProducts();
                  } else {
                      alert('Fehler: ' + data.error);
                  }
              } catch (err) {
                  console.error(err);
                  alert('Netzwerkfehler.');
              }
          }
      });
  };

  const handleAssignFile = async (file: any, type: 'print' | 'view' = assignFileType) => {
      if (!editingProduct) return;
      try {
          await fetch(`/api/products/${editingProduct.id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  fileUrl: file.url,
                  fileName: file.customName || file.name,
                  thumbnailUrl: file.thumbnail,
                  type: type
              })
          });
          
          // Refresh product data locally
          const updatedFiles = [...editingProduct.files, {
              id: Math.random().toString(), // Temp ID until refresh
              file_url: file.url,
              file_name: file.customName || file.name,
              thumbnail_url: file.thumbnail,
              type: type
          }];
          setEditingProduct({ ...editingProduct, files: updatedFiles });
          fetchProducts();
      } catch (err) {
          console.error(err);
      }
  };

  const handleDirectUploadAndAssign = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !customer) return;
    const file = e.target.files[0];
    const fileName = file.name;

    try {
        const formData = new FormData();
        formData.append('print', file);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success && data.files && data.files.print && data.files.print.length > 0) {
            const uploadedFile = data.files.print[0];
            const fileUrl = uploadedFile.path;
            const thumbnail = uploadedFile.thumbnail;
            
            // Create Archive Order
            const newOrder: Order = {
                id: Math.random().toString(36).substr(2, 9),
                title: `Direkt-Upload: ${fileName}`,
                customerId: customer.id,
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                customerAddress: customer.address,
                deadline: new Date().toISOString().split('T')[0],
                status: "archived",
                steps: { processing: true, produced: true, invoiced: true },
                createdAt: new Date().toISOString(),
                description: "Automatisch erstellt durch Produktzuweisung",
                employees: [],
                files: [{
                    name: uploadedFile.originalName,
                    type: assignFileType === 'view' ? 'preview' : 'print',
                    url: fileUrl,
                    thumbnail: thumbnail,
                    customName: fileName
                }]
            };

            await addOrder(newOrder);

            if (showBulkAssignModal) {
                // Bulk Mode
                setBulkSelectedFiles(prev => [...prev, {
                    url: fileUrl,
                    name: fileName,
                    thumbnail: thumbnail
                }]);
            } else if (editingProduct) {
                // Single Mode
                await handleAssignFile({
                    url: fileUrl,
                    name: fileName,
                    customName: fileName,
                    thumbnail: thumbnail
                }, assignFileType);
                
                fetchData();
            }
        }
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload fehlgeschlagen.");
    }
  };

  const handleBulkAssign = async () => {
      if (bulkSelectedFiles.length === 0 || !customer) return;
      
      if (bulkSelectedProductIds.length === 0) {
          alert('Bitte wählen Sie mindestens einen Artikel aus.');
          return;
      }

      console.log('Starting bulk assign:', {
          files: bulkSelectedFiles.length,
          products: bulkSelectedProductIds.length,
          supplierId: bulkSupplierId
      });

      const supplierName = bulkSupplierId ? suppliers.find(s => s.id === bulkSupplierId)?.name : null;
      const confirmMessage = `Möchten Sie ${bulkSelectedFiles.length} Datei(en) wirklich an ${bulkSelectedProductIds.length} ausgewählte Artikel zuweisen?` +
          (supplierName ? `\n\nZusätzlich wird der Lieferant für diese Artikel auf "${supplierName}" gesetzt.` : '');

      if (!confirm(confirmMessage)) {
          return;
      }

      setIsBulkAssigning(true);
      try {
          const res = await fetch('/api/products/bulk-files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  productIds: bulkSelectedProductIds,
                  files: bulkSelectedFiles.map(f => ({
                      fileUrl: f.url,
                      fileName: f.name,
                      thumbnailUrl: f.thumbnail,
                      type: bulkAssignType
                  })),
                  supplierId: bulkSupplierId
              })
          });
          
          const data = await res.json();
          if (data.success) {
              alert(data.message);
              fetchProducts();
              setShowBulkAssignModal(false);
              setBulkSelectedFiles([]);
              setBulkProductSearch('');
              setBulkSelectedProductIds([]);
              setBulkSupplierId(''); // Reset supplier selection
          } else {
              alert('Fehler: ' + data.error);
          }
      } catch (err) {
          console.error(err);
          alert('Netzwerkfehler');
      } finally {
          setIsBulkAssigning(false);
      }
  };

  const toggleFileSelection = (file: {url: string, name: string, thumbnail?: string}) => {
    setBulkSelectedFiles(prev => {
        const exists = prev.some(f => f.url === file.url);
        if (exists) {
            return prev.filter(f => f.url !== file.url);
        } else {
            return [...prev, file];
        }
    });
  };

  const toggleProductSelection = (productId: string) => {
    setBulkSelectedProductIds(prev => {
        if (prev.includes(productId)) {
            return prev.filter(id => id !== productId);
        } else {
            return [...prev, productId];
        }
    });
  };

  const toggleSelectAllVisible = () => {
    const allShopwareProducts = products.filter(p => p.source === 'shopware');
    const visibleProducts = allShopwareProducts.filter(p => 
        (p.name.toLowerCase().includes(bulkProductSearch.toLowerCase()) || 
        (p.product_number && p.product_number.toLowerCase().includes(bulkProductSearch.toLowerCase())))
    );
    
    const visibleIds = visibleProducts.map(p => p.id);
    if (visibleIds.length === 0) return;

    const allVisibleSelected = visibleIds.every(id => bulkSelectedProductIds.includes(id));
    
    if (allVisibleSelected) {
        // Deselect all visible
        setBulkSelectedProductIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
        // Select all visible (merge)
        setBulkSelectedProductIds(prev => {
            const newSet = new Set([...prev, ...visibleIds]);
            return Array.from(newSet);
        });
    }
  };

  const handleUpdateFileQuantity = async (fileId: string, quantity: number, productContext: Product) => {
    try {
        await fetch(`/api/products/${productContext.id}/files/${fileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity })
        });

        // Update local state
        const updatedProducts = products.map(p => {
            if (p.id === productContext.id) {
                const updatedFiles = p.files.map(f => f.id === fileId ? { ...f, quantity } : f);
                return { ...p, files: updatedFiles };
            }
            return p;
        });
        setProducts(updatedProducts);
        
        // Also update editingProduct if open
        if (editingProduct && editingProduct.id === productContext.id) {
            setEditingProduct({
                ...editingProduct,
                files: editingProduct.files.map(f => f.id === fileId ? { ...f, quantity } : f)
            });
        }
        
    } catch (err) {
        console.error(err);
        // alert('Fehler beim Aktualisieren der Menge.');
    }
  };

  const handleRemoveFile = async (fileId: string, productContext?: Product) => {
      // Use provided product context or fall back to editingProduct
      const product = productContext || editingProduct;
      
      console.log('handleRemoveFile called', { fileId, productId: product?.id, contextProvided: !!productContext });

      // Find the file first to check its URL
      const fileToRemove = product?.files.find(f => f.id === fileId);
      
      if (!product) {
          console.error('No product context found for file removal');
          return;
      }

      const confirmDelete = async () => {
          console.log('Confirm delete executing for', fileId);
          try {
              const res = await fetch(`/api/products/${product.id}/files/${fileId}`, {
                  method: 'DELETE'
              });
              
              if (!res.ok) {
                  const err = await res.text();
                  console.error('Delete failed:', err);
                  alert('Fehler beim Löschen: ' + err);
                  return;
              }
              
              console.log('Delete successful, updating state...');

              // If we are in editing mode, update local state
              if (editingProduct && editingProduct.id === product.id) {
                  const updatedFiles = editingProduct.files.filter(f => f.id !== fileId);
                  setEditingProduct({ ...editingProduct, files: updatedFiles });
              }
              
              fetchProducts();
          } catch (err) {
              console.error('Delete error:', err);
              alert('Fehler: ' + err);
          }
      };

      if (fileToRemove) {
          setConfirmModal({
              isOpen: true,
              title: 'Datei entfernen',
              message: `Möchten Sie die Datei "${fileToRemove.file_name}" von diesem Artikel entfernen?`,
              confirmText: 'Entfernen',
              type: 'danger',
              onConfirm: confirmDelete
          });
      } else {
          // Fallback if file not found locally but ID provided
          console.warn('File not found in local product state, forcing delete anyway');
          confirmDelete();
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

  const handleDeleteFile = (fileToDelete: { name: string, url?: string, orderTitle?: string, customName?: string, thumbnail?: string, id?: string }) => {
    setConfirmModal({
        isOpen: true,
        title: 'Datei löschen',
        message: `Möchten Sie die Datei "${fileToDelete.customName || fileToDelete.name}" wirklich löschen? Sie wird vollständig vom Server und aus der Datenbank entfernt.`,
        type: 'danger',
        confirmText: 'Löschen',
        onConfirm: async () => {
            // Check if it's an order file
            const order = customerOrders.find(o => o.files && Array.isArray(o.files) && o.files.some(f => f.url === fileToDelete.url));
            
            if (order) {
                const updatedFiles = order.files.filter(f => f.url !== fileToDelete.url);
                const updatedOrder = { ...order, files: updatedFiles };
                setCustomerOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

                await updateOrder(order.id, { files: updatedFiles });
            } 
            // Check if it's a product file (e.g. Freisteller)
            else {
                // Find product containing this file
                // We need to match by url or file_url
                const product = products.find(p => p.files && p.files.some(f => (f.file_url === fileToDelete.url || f.file_url === (fileToDelete as any).file_url)));
                
                if (product) {
                    const fileInProduct = product.files.find(f => (f.file_url === fileToDelete.url || f.file_url === (fileToDelete as any).file_url));
                    if (fileInProduct) {
                         try {
                            await fetch(`/api/products/${product.id}/files/${fileInProduct.id}`, {
                                method: 'DELETE'
                            });
                            fetchProducts();
                        } catch (err) {
                            console.error("Failed to delete product file association", err);
                        }
                    }
                }
            }
            
            // Delete from Archive DB (files table)
            if (fileToDelete.id) {
                 try {
                    await fetch(`/api/customers/${customer.id}/files/${fileToDelete.id}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.error("Failed to delete from archive DB", err);
                }
            }

            // Physical delete from server
            const urlToDelete = fileToDelete.url || (fileToDelete as any).file_url;
            if (urlToDelete) {
                try {
                    await fetch('/api/upload/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: urlToDelete })
                    });
                } catch (err) {
                    console.error("Failed to delete file from server", err);
                }
            }
            fetchData();
            fetchCustomerFiles();
        }
    });
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

  // Extract Print Files & Preview Files
  // Use archivedFiles from database as primary source, augmented with Order details if available
  const allOrderFiles = archivedFiles.map(file => {
      const order = customerOrders.find(o => o.id === file.order_id);
      return {
          ...file,
          name: file.name,
          customName: file.name,
          url: file.path,
          thumbnail: file.thumbnail,
          type: file.type,
          orderTitle: order ? `Auftrag: ${order.title}` : (file.order_id ? 'Archiv / Gelöschter Auftrag' : 'Direkt-Upload'),
          orderDate: file.created_at || (order ? order.createdAt : new Date().toISOString()),
          contextType: 'order'
      };
  });

  const allProductFiles = products.flatMap(p => 
      (p.files || []).map(f => ({
          ...f,
          name: f.file_name,
          url: f.file_url,
          thumbnail: f.thumbnail_url,
          orderTitle: `Artikel: ${p.name}`,
          orderDate: p.created_at || new Date().toISOString(),
          contextType: 'product'
      }))
  );
  
  const combinedFiles = [...allOrderFiles, ...allProductFiles];
  
  const allPrintFiles = combinedFiles.filter(f => f.type === 'print' || !f.type); // Default to print if undefined
  const allPreviewFiles = combinedFiles.filter(f => f.type === 'preview' || f.type === 'view');

  const uniqueFilesMap = new Map();
  allPrintFiles.forEach(file => {
    if (file.url) {
        if (!uniqueFilesMap.has(file.url)) {
            uniqueFilesMap.set(file.url, { ...file, contexts: [file.orderTitle] });
        } else {
            const existing = uniqueFilesMap.get(file.url);
            if (!existing.contexts.includes(file.orderTitle)) {
                existing.contexts.push(file.orderTitle);
            }
            // Update date to latest usage
            if (new Date(file.orderDate) > new Date(existing.orderDate)) {
                existing.orderDate = file.orderDate;
            }
        }
    }
  });
  const printFiles = Array.from(uniqueFilesMap.values()).sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  const freistellerProducts = products.filter(p => p.product_number === 'FREISTELLER');
  const freistellerFiles = freistellerProducts.flatMap(p => p.files.map(f => ({
      ...f,
      name: p.name, // Use product name as file name context
      customName: p.name,
      orderDate: new Date().toISOString() // Or use creation date if available in Product
  })));
  
  const allPreviewFilesCombined = [...allPreviewFiles, ...freistellerFiles];

  const uniquePreviewsMap = new Map();
  allPreviewFilesCombined.forEach(file => {
      // Handle both OrderFile (url) and ProductFile (file_url) structures
      const key = (file as any).file_url || (file as any).url;
      if (key && !uniquePreviewsMap.has(key)) {
          uniquePreviewsMap.set(key, file);
      }
  });
  const previewFiles = Array.from(uniquePreviewsMap.values()).sort((a, b) => {
      const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      return dateB - dateA;
  });

  const filteredPrintFilesForAssign = printFiles.filter(f => 
      (f.customName || f.name).toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      (p.product_number && p.product_number.toLowerCase().includes(productSearch.toLowerCase()))) &&
      p.product_number !== 'FREISTELLER' && // Filter out Freisteller dummy products from the main list
      p.source !== 'shopware' // Only show manual products in the main list
  );

  const shopwareProducts = products.filter(p => 
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      (p.product_number && p.product_number.toLowerCase().includes(productSearch.toLowerCase()))) &&
      p.source === 'shopware'
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
                onClick={() => setActiveTab('previews')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'previews' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <ImageIcon size={16} className="mr-2" />
                    Vorschaubilder ({previewFiles.length})
                </div>
            </button>
            <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'products' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <Package size={16} className="mr-2" />
                    Artikel ({filteredProducts.length})
                </div>
            </button>
            <button
                onClick={() => setActiveTab('online_products')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'online_products' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <ShoppingBag size={16} className="mr-2" />
                    Online Artikel ({shopwareProducts.length})
                </div>
            </button>
            <button
                onClick={() => setActiveTab('shopware')}
                className={`py-4 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'shopware' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <div className="flex items-center">
                    <Link size={16} className="mr-2" />
                    Shopware Config
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
                    <User className="mr-3 text-gray-400" size={20} />
                    {isEditing ? (
                        <input 
                        type="text" 
                        value={editedCustomer?.contact_person || ""} 
                        onChange={(e) => setEditedCustomer(prev => ({...prev!, contact_person: e.target.value}))}
                        className="border border-gray-300 rounded px-2 py-1 w-full focus:ring-red-500 focus:border-red-500"
                        placeholder="Ansprechpartner / Team"
                        />
                    ) : (
                        customer.contact_person ? (
                        <span>{customer.contact_person}</span>
                        ) : (
                        <span className="text-gray-400 italic">Kein Ansprechpartner hinterlegt</span>
                        )
                    )}
                    </div>

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
                            <p className="text-xs text-gray-500 flex items-center" title={file.contexts && file.contexts.join(', ')}>
                                <FileText size={12} className="mr-1" />
                                {file.contexts && file.contexts.length > 1 
                                    ? `Verwendet in ${file.contexts.length} Orten` 
                                    : `Aus: ${file.contexts ? file.contexts[0] : file.orderTitle}`}
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

        {/* TAB: PREVIEWS */}
        {activeTab === 'previews' && (
            <div className="animate-in fade-in">
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800">Gespeicherte Vorschaubilder</h3>
                    <p className="text-sm text-gray-500">Freisteller und Mockups</p>
                </div>
                
                <div className="p-8">
                    {previewFiles.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {previewFiles.map((file, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-md transition-all group">
                                    <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center overflow-hidden border border-gray-100 relative">
                                        <img 
                                            src={file.thumbnail_url || file.thumbnail || file.file_url || file.url} 
                                            alt={file.name} 
                                            className="w-full h-full object-contain"
                                            onClick={() => window.open(file.file_url || file.url, '_blank')}
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                            <button onClick={() => downloadFile(file)} className="text-white hover:text-red-400 p-1"><Download size={16} /></button>
                                            <button onClick={() => handleDeleteFile(file)} className="text-white hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-gray-700 break-words line-clamp-2" title={file.customName || file.name}>
                                        {file.customName || file.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {file.orderDate ? new Date(file.orderDate).toLocaleDateString() : 'Datum unbekannt'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <ImageIcon size={48} className="mx-auto text-gray-300 mb-4" />
                            <p>Keine Vorschaubilder vorhanden.</p>
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
                    <div className="flex space-x-2">
                        {currentUser?.role === 'admin' && products.length > 0 && (
                            <button 
                                onClick={handleDeleteAllProducts}
                                className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50 flex items-center"
                                title="Nur für Admins: Alle Artikel löschen"
                            >
                                <Trash2 size={16} className="mr-2" />
                                Alle löschen
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                setEditingProduct(null);
                                setNewManualProduct({ name: '', productNumber: '', supplierId: '' });
                                setShowMappingModal(true);
                                setAssignFileMode(false);
                            }}
                            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center"
                        >
                            <Plus size={16} className="mr-2" />
                            Manueller Artikel
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div className={`rounded-lg mr-4 overflow-hidden w-16 h-16 flex-shrink-0 flex items-center justify-center border border-gray-100 ${product.source === 'shopware' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {(() => {
                                            const image = product.files?.find(f => f.thumbnail_url || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i));
                                            if (image) {
                                                return <img src={image.thumbnail_url || image.file_url} alt={product.name} className="w-full h-full object-contain bg-white" />;
                                            }
                                            return <Package size={24} />;
                                        })()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-900">{product.name}</h4>
                                            {product.supplier_id && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                                                    {suppliers.find(s => s.id === product.supplier_id)?.name || 'Lieferant'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-1 space-x-2 flex-wrap gap-y-1">
                                            {product.product_number && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                    {product.product_number}
                                                </span>
                                            )}
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${product.source === 'shopware' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                {product.source}
                                            </span>
                                            {product.supplier_id && suppliers.find(s => s.id === product.supplier_id) && (
                                                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded flex items-center">
                                                    <Package size={10} className="mr-1" />
                                                    {suppliers.find(s => s.id === product.supplier_id)?.name}
                                                </span>
                                            )}
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
                                        onClick={() => handleDuplicateProduct(product)}
                                        className="text-gray-400 hover:text-green-600 p-1"
                                        title="Duplizieren"
                                    >
                                        <Copy size={18} />
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
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Dateien & Ansichten</span>
                                    <div className="flex space-x-2">
                                        <button 
                                            onClick={() => {
                                                setEditingProduct(product);
                                                setShowMappingModal(true);
                                                setAssignFileMode(true);
                                                setAssignFileType('view');
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center font-medium"
                                        >
                                            <ImageIcon size={12} className="mr-1" />
                                            Ansicht +
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setEditingProduct(product);
                                                setShowMappingModal(true);
                                                setAssignFileMode(true);
                                                setAssignFileType('print');
                                            }}
                                            className="text-xs text-red-600 hover:text-red-800 flex items-center font-medium"
                                        >
                                            <Plus size={12} className="mr-1" />
                                            Druckdaten +
                                        </button>
                                    </div>
                                </div>

                                {/* Shopware Images (Views) */}
                                {product.files && product.files.filter(f => f.type === 'view').length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ansichten / Vorschau</div>
                                        <div className="flex flex-wrap gap-3">
                                            {product.files.filter(f => f.type === 'view').map(file => (
                                                <div key={file.id} className="relative group w-20">
                                                    <div className="h-20 w-20 bg-gray-50 rounded border border-gray-200 overflow-hidden flex items-center justify-center relative">
                                                        <img 
                                                            src={file.thumbnail_url || file.file_url} 
                                                            className="w-full h-full object-contain" 
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveFile(file.id, product);
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Print Files */}
                                {product.files && product.files.filter(f => f.type !== 'view').length > 0 && (
                                    <div className="mb-3">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Druckdaten</div>
                                        <div className="flex flex-wrap gap-3">
                                            {product.files.filter(f => f.type !== 'view').map(file => (
                                                <div key={file.id} className="relative group w-20">
                                                    <div className="h-20 w-20 bg-gray-50 rounded border border-gray-200 overflow-hidden flex items-center justify-center relative">
                                                        {(file.thumbnail_url || file.file_url) ? (
                                                            <img 
                                                                src={file.thumbnail_url || file.file_url} 
                                                                className="w-full h-full object-contain" 
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        
                                                        <div className={`fallback-icon ${(file.thumbnail_url || file.file_url) ? 'hidden' : ''} flex items-center justify-center w-full h-full absolute inset-0`}>
                                                            {file.file_name.toLowerCase().endsWith('.pdf') ? (
                                                                <FileText size={24} className="text-red-500" />
                                                            ) : (
                                                                <ImageIcon size={24} className="text-gray-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveFile(file.id, product);
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                    <div className="text-[10px] truncate mt-1 text-gray-600 flex justify-between items-center" title={file.file_name}>
                                                        <span className="truncate max-w-[100px]">{file.file_name}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {(!product.files || product.files.length === 0) && (
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

        {/* TAB: ONLINE PRODUCTS */}
        {activeTab === 'online_products' && (
            <div className="p-8 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-bold text-gray-800">Online Artikel (Shopware)</h3>
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
                    <div className="flex space-x-2">
                        {shopwareProducts.length > 0 && (
                             <button 
                                 onClick={handleDeleteAllShopwareProducts}
                                 className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50 flex items-center"
                                 title="Alle importierten Shopware-Artikel löschen"
                             >
                                 <Trash2 size={16} className="mr-2" />
                                 Alle löschen
                             </button>
                        )}
                        <button 
                             onClick={() => {
                                 setShowBulkAssignModal(true);
                                 setBulkProductSearch('');
                                setBulkSelectedFiles([]);
                                setBulkSelectedProductIds([]);
                             }}
                             className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 flex items-center"
                         >
                             <Plus size={16} className="mr-2" />
                             Massen-Zuweisung
                         </button>
                         <button 
                            onClick={fetchShopwareProducts}
                            disabled={isLoadingProducts || !shopwareConfig.url}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
                        >
                            <Download size={16} className="mr-2" />
                            {isLoadingProducts ? 'Lade...' : 'Artikel importieren'}
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {shopwareProducts.map(product => (
                        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div className="rounded-lg mr-4 overflow-hidden w-16 h-16 flex-shrink-0 flex items-center justify-center border border-gray-100 bg-blue-50 text-blue-600">
                                        {(() => {
                                            const image = product.files?.find(f => f.thumbnail_url || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i));
                                            if (image) {
                                                return <img src={image.thumbnail_url || image.file_url} alt={product.name} className="w-full h-full object-contain bg-white" />;
                                            }
                                            return <ShoppingBag size={24} />;
                                        })()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-900">{product.name}</h4>
                                            {product.supplier_id && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                                                    {suppliers.find(s => s.id === product.supplier_id)?.name || 'Lieferant'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center mt-1 space-x-2 flex-wrap gap-y-1">
                                            {product.product_number && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                    {product.product_number}
                                                </span>
                                            )}
                                            {product.size && (
                                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                                                    Größe: {product.size}
                                                </span>
                                            )}
                                            {product.color && (
                                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                                                    Farbe: {product.color}
                                                </span>
                                            )}
                                            {/* Fallback if size/color not parsed but likely in name */}
                                            {!product.size && !product.color && product.name.includes(' - ') && (
                                                <span className="text-xs text-gray-500 italic">
                                                    Variante aus Titel
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => handleDuplicateProduct(product)}
                                        className="text-gray-400 hover:text-blue-600 p-1"
                                        title="Als manuellen Artikel duplizieren"
                                    >
                                        <Copy size={18} />
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

                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Views */}
                                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                                            <ImageIcon size={12} className="mr-1.5" />
                                            Ansicht
                                        </span>
                                        <button 
                                            onClick={() => {
                                                setEditingProduct(product);
                                                setShowMappingModal(true);
                                                setAssignFileMode(true);
                                                setAssignFileType('view');
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center font-medium bg-white px-2 py-1 rounded border border-blue-100 hover:bg-blue-50"
                                        >
                                            <Plus size={10} className="mr-1" />
                                            Hinzufügen
                                        </button>
                                    </div>

                                    {product.files && product.files.filter(f => f.type === 'view').length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {product.files.filter(f => f.type === 'view').map(file => (
                                                <div key={file.id} className="relative group w-14 h-14">
                                                    <div className="h-14 w-14 bg-white rounded border border-gray-200 overflow-hidden flex items-center justify-center relative shadow-sm">
                                                        <img 
                                                            src={file.thumbnail_url || file.file_url} 
                                                            className="w-full h-full object-contain" 
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveFile(file.id, product);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-300 text-xs italic">
                                            Keine Ansichtsbilder
                                        </div>
                                    )}
                                </div>

                                {/* Print Files */}
                                <div className="bg-red-50/30 p-3 rounded-lg border border-red-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold text-red-800 uppercase flex items-center">
                                            <Printer size={12} className="mr-1.5" />
                                            Druckdaten
                                        </span>
                                        <button 
                                            onClick={() => {
                                                setEditingProduct(product);
                                                setShowMappingModal(true);
                                                setAssignFileMode(true);
                                                setAssignFileType('print');
                                            }}
                                            className="text-xs text-red-600 hover:text-red-800 flex items-center font-medium bg-white px-2 py-1 rounded border border-red-100 hover:bg-red-50"
                                        >
                                            <Plus size={10} className="mr-1" />
                                            Hinzufügen
                                        </button>
                                    </div>

                                    {product.files && product.files.filter(f => f.type !== 'view').length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {product.files.filter(f => f.type !== 'view').map(file => (
                                                <div key={file.id} className="relative group w-14 h-14">
                                                    <div className="h-14 w-14 bg-white rounded border border-gray-200 overflow-hidden flex items-center justify-center relative shadow-sm">
                                                        {(file.thumbnail_url || file.file_url) ? (
                                                            <img 
                                                                src={file.thumbnail_url || file.file_url} 
                                                                className="w-full h-full object-contain" 
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                                                }}
                                                            />
                                                        ) : null}
                                                        
                                                        <div className={`fallback-icon ${(file.thumbnail_url || file.file_url) ? 'hidden' : ''} flex items-center justify-center w-full h-full absolute inset-0`}>
                                                            <FileText size={20} className="text-red-500" />
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveFile(file.id, product);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border border-gray-200 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-300 text-xs italic">
                                            Keine Druckdaten
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {shopwareProducts.length === 0 && (
                        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                            <p>Keine Online-Artikel importiert.</p>
                            <button 
                                onClick={fetchShopwareProducts}
                                className="mt-4 text-blue-600 hover:underline"
                            >
                                Jetzt importieren
                            </button>
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
                              ? (assignFileType === 'view' ? `Ansicht hinzufügen: ${editingProduct?.name}` : `Druckdaten hinzufügen: ${editingProduct?.name}`)
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
                        <div className="flex border-b">
                            <button 
                                onClick={() => setFileTab('gallery')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${fileTab === 'gallery' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <div className="flex items-center justify-center">
                                    <ImageIcon size={16} className="mr-2" />
                                    Aus Galerie wählen
                                </div>
                            </button>
                            <button 
                                onClick={() => setFileTab('upload')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${fileTab === 'upload' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <div className="flex items-center justify-center">
                                    <Upload size={16} className="mr-2" />
                                    Neu hochladen
                                </div>
                            </button>
                        </div>

                        {fileTab === 'upload' ? (
                            <div className="p-8 flex flex-col items-center justify-center space-y-4">
                                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="p-3 bg-blue-50 rounded-full text-blue-500 group-hover:scale-110 transition-transform mb-3">
                                            <Upload size={32} />
                                        </div>
                                        <p className="mb-2 text-sm text-gray-700 font-semibold">Klicken oder Datei hierher ziehen</p>
                                        <p className="text-xs text-gray-500">PNG, JPG oder PDF</p>
                                    </div>
                                    <input type="file" className="hidden" onChange={handleDirectUploadAndAssign} accept="image/*,.pdf" />
                                </label>
                                <p className="text-xs text-gray-400 text-center">
                                    Hochgeladene Dateien werden automatisch einem Archiv-Auftrag zugeordnet<br/>
                                    und stehen anschließend in der Galerie zur Verfügung.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b bg-white">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Druckdaten suchen..." 
                                            value={fileSearch}
                                            onChange={(e) => setFileSearch(e.target.value)}
                                            className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                                    {filteredPrintFilesForAssign.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {filteredPrintFilesForAssign.map((file, idx) => {
                                                const displayThumb = file.thumbnail || file.url;
                                                const isAssigned = editingProduct?.files.some(f => f.file_url === file.url);
                                                
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onClick={() => !isAssigned && handleAssignFile(file)}
                                                        className={`
                                                            rounded-xl border p-3 relative group hover:shadow-lg transition-all flex flex-col bg-white
                                                            ${isAssigned ? 'border-green-500 bg-green-50/50 ring-2 ring-green-500/20 cursor-default' : 'border-gray-200 hover:border-blue-400 cursor-pointer'}
                                                        `}
                                                    >
                                                        <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative shrink-0 border border-gray-100">
                                                            {displayThumb ? (
                                                                <img 
                                                                    src={displayThumb} 
                                                                    alt="" 
                                                                    className="w-full h-full object-contain p-1" 
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
                                                                    <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg transform scale-110">
                                                                        <CheckCircle size={24} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold break-words line-clamp-2 mb-1 text-gray-800" title={file.customName || file.name}>
                                                                {file.customName || file.name}
                                                            </p>
                                                            <div className="flex items-center text-[10px] text-gray-400" title={file.contexts && file.contexts.join(', ')}>
                                                                <FileText size={10} className="mr-1" />
                                                                <span className="truncate">{file.contexts && file.contexts.length > 1 ? `${file.contexts.length} Verwendungen` : (file.contexts ? file.contexts[0] : file.orderTitle)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 text-gray-400">
                                            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                                <Printer size={32} />
                                            </div>
                                            <p className="font-medium">Keine passenden Druckdaten gefunden.</p>
                                            <p className="text-sm">Versuchen Sie einen anderen Suchbegriff oder laden Sie eine neue Datei hoch.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
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

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant / Shop</label>
                              <select
                                  value={editingProduct ? (editingProduct.supplier_id || '') : newManualProduct.supplierId}
                                  onChange={(e) => editingProduct
                                      ? setEditingProduct({...editingProduct, supplier_id: e.target.value})
                                      : setNewManualProduct({...newManualProduct, supplierId: e.target.value})
                                  }
                                  className="w-full border border-gray-300 rounded p-2"
                              >
                                  <option value="">Kein Lieferant ausgewählt</option>
                                  {suppliers.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                              </select>
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-lg text-gray-800">Massen-Zuweisung von Druckdaten</h3>
                      <button onClick={() => setShowBulkAssignModal(false)}><X size={20} className="text-gray-500" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      {/* Left: File Selection */}
                      <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
                          <div className="p-4 border-b border-gray-200 bg-white">
                              <h4 className="font-semibold text-sm text-gray-700 mb-3">1. Datei auswählen</h4>
                              
                              {/* Type Selection */}
                              <div className="flex space-x-2 mb-4">
                                  <button 
                                      onClick={() => setBulkAssignType('print')}
                                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${bulkAssignType === 'print' ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm' : 'bg-gray-100 border border-transparent text-gray-600 hover:bg-gray-200'}`}
                                  >
                                      Druckdaten
                                  </button>
                                  <button 
                                      onClick={() => setBulkAssignType('view')}
                                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${bulkAssignType === 'view' ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' : 'bg-gray-100 border border-transparent text-gray-600 hover:bg-gray-200'}`}
                                  >
                                      Ansicht
                                  </button>
                              </div>

                              {/* Tabs */}
                              <div className="flex border-b border-gray-100">
                                  <button 
                                      onClick={() => setFileTab('gallery')}
                                      className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${fileTab === 'gallery' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                  >
                                      Galerie
                                  </button>
                                  <button 
                                      onClick={() => setFileTab('upload')}
                                      className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${fileTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                  >
                                      Upload
                                  </button>
                              </div>
                              
                              {fileTab === 'gallery' && (
                                <div className="mt-3 relative">
                                    <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Datei suchen..." 
                                        value={fileSearch}
                                        onChange={(e) => setFileSearch(e.target.value)}
                                        className="w-full pl-8 border border-gray-300 rounded-md p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                              )}
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
                              {fileTab === 'upload' ? (
                                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                      <label className="flex flex-col items-center justify-center w-full aspect-square max-w-[200px] border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group mb-4">
                                          <div className="p-3 bg-white rounded-full text-blue-500 group-hover:scale-110 transition-transform mb-2 shadow-sm">
                                              <Upload size={24} />
                                          </div>
                                          <span className="text-xs font-medium text-gray-600">Datei hochladen</span>
                                          <input type="file" className="hidden" onChange={handleDirectUploadAndAssign} accept="image/*,.pdf" />
                                      </label>
                                      <p className="text-[10px] text-gray-400">
                                          Wird automatisch archiviert & ausgewählt
                                      </p>
                                  </div>
                              ) : (
                                  <>
                                    {filteredPrintFilesForAssign.length > 0 ? (
                                        filteredPrintFilesForAssign.map((file, idx) => (
                                          <div 
                                              key={idx}
                                              onClick={() => toggleFileSelection({ url: file.url, name: file.customName || file.name, thumbnail: file.thumbnail })}
                                              className={`p-2 rounded-lg border cursor-pointer flex items-center space-x-3 transition-all ${bulkSelectedFiles.some(f => f.url === file.url) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
                                          >
                                              <div className="h-10 w-10 bg-gray-100 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
                                                  {file.thumbnail ? (
                                                      <img src={file.thumbnail} className="w-full h-full object-contain" />
                                                  ) : (
                                                      <FileText size={16} className="text-gray-400" />
                                                  )}
                                              </div>
                                              <div className="min-w-0">
                                                  <p className="text-xs font-medium truncate text-gray-800" title={file.customName || file.name}>{file.customName || file.name}</p>
                                                  <p className="text-[10px] text-gray-500 truncate" title={file.contexts && file.contexts.join(', ')}>
                                                      {file.contexts && file.contexts.length > 1 ? `${file.contexts.length} Verwendungen` : (file.contexts ? file.contexts[0] : file.orderTitle)}
                                                  </p>
                                              </div>
                                          </div>
                                      ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-400">
                                            <p className="text-xs">Keine Dateien gefunden.</p>
                                        </div>
                                    )}
                                  </>
                              )}
                          </div>
                      </div>

                      {/* Right: Product Selection */}
                      <div className="w-full md:w-2/3 flex flex-col">
                          <div className="p-4 border-b border-gray-200 bg-white">
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">2. Artikel suchen & zuweisen</h4>
                              
                              <div className="mb-3">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Lieferant zuweisen (Optional)</label>
                                  <select
                                      value={bulkSupplierId}
                                      onChange={(e) => setBulkSupplierId(e.target.value)}
                                      className="w-full border border-gray-300 rounded p-2 text-sm"
                                  >
                                      <option value="">Keine Änderung</option>
                                      {suppliers.map(s => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                  </select>
                              </div>

                              <div className="relative mb-3">
                                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                  <input 
                                      type="text" 
                                      placeholder="Artikel suchen (z.B. Premium T-Shirt Rot)..." 
                                      value={bulkProductSearch}
                                      onChange={(e) => setBulkProductSearch(e.target.value)}
                                      className="w-full pl-9 border border-gray-300 rounded p-2 text-sm"
                                      autoFocus
                                  />
                              </div>
                              {bulkProductSearch && (
                                <div className="flex justify-between items-center">
                                    <button 
                                        onClick={toggleSelectAllVisible}
                                        className="text-xs text-blue-600 font-medium hover:underline"
                                    >
                                        Alle angezeigten auswählen / abwählen
                                    </button>
                                    <span className="text-xs text-gray-500">
                                        {bulkSelectedProductIds.length} Artikel ausgewählt
                                    </span>
                                </div>
                              )}
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                              {bulkProductSearch ? (
                                  <div className="space-y-2">
                                      {(() => {
                                          const allShopwareProducts = products.filter(p => p.source === 'shopware');
                                          const visibleProducts = allShopwareProducts.filter(p => (p.name.toLowerCase().includes(bulkProductSearch.toLowerCase()) || (p.product_number && p.product_number.toLowerCase().includes(bulkProductSearch.toLowerCase()))));
                                          
                                          if (visibleProducts.length === 0) {
                                              return <p className="text-center text-gray-400 py-4">Keine Artikel gefunden.</p>;
                                          }

                                          return visibleProducts.map(product => {
                                              const isSelected = bulkSelectedProductIds.includes(product.id);
                                              const isAlreadyAssigned = bulkSelectedFiles.length > 0 && product.files && bulkSelectedFiles.every(sf => product.files.some(f => f.file_url === sf.url));

                                              return (
                                              <div 
                                                  key={product.id} 
                                                  onClick={() => toggleProductSelection(product.id)}
                                                  className={`p-3 rounded border flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-blue-200'}`}
                                              >
                                                  <div className="flex items-center space-x-3 overflow-hidden">
                                                      <div onClick={(e) => e.stopPropagation()}>
                                                          <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            onChange={() => toggleProductSelection(product.id)}
                                                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                          />
                                                      </div>
                                                      <div className="h-10 w-10 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center text-gray-400">
                                                          <Package size={16} />
                                                      </div>
                                                      <div className="min-w-0">
                                                          <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                                          <div className="flex gap-2 flex-wrap">
                                                              {product.product_number && <span className="text-xs text-gray-500">{product.product_number}</span>}
                                                              {product.size && <span className="text-xs bg-slate-100 px-1 rounded border border-slate-200">Gr: {product.size}</span>}
                                                              {product.color && <span className="text-xs bg-slate-100 px-1 rounded border border-slate-200">{product.color}</span>}
                                                          </div>
                                                      </div>
                                                  </div>
                                                  {isAlreadyAssigned && (
                                                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center flex-shrink-0 ml-2">
                                                          <CheckCircle size={12} className="mr-1" />
                                                          Zugewiesen
                                                      </span>
                                                  )}
                                              </div>
                                          )});
                                      })()}
                                  </div>
                              ) : (
                                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                      <Search size={48} className="mb-4 opacity-20" />
                                      <p>Bitte suchen Sie nach Artikeln, um die Zuweisung zu starten.</p>
                                  </div>
                              )}
                          </div>

                          <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
                              <div className="text-sm text-gray-600">
                                  {bulkSelectedFiles.length > 0 ? (
                                      <span className="flex items-center text-green-600">
                                          <FileText size={16} className="mr-2" />
                                          <strong>{bulkSelectedFiles.length}</strong> Datei(en) ausgewählt
                                      </span>
                                  ) : (
                                      <span className="text-red-500">Bitte erst eine Datei auswählen</span>
                                  )}
                              </div>
                              <button 
                                  onClick={handleBulkAssign}
                                  disabled={bulkSelectedFiles.length === 0 || bulkSelectedProductIds.length === 0 || isBulkAssigning}
                                  className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              >
                                  {isBulkAssigning ? 'Zuweisung läuft...' : `An ${bulkSelectedProductIds.length} ausgewählte Artikel zuweisen`}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

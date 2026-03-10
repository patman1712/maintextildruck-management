
import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Plus, Trash2, ArrowRight, FileText, Download } from 'lucide-react';
import { ShopProductAssignment, Product } from '../../../store';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Assignment is optional for "Create Mode"
  assignment?: ShopProductAssignment & { product_name?: string, product_number?: string, manufacturer_info?: string, description?: string, size?: string, color?: string, weight?: number };
  product?: Product; // The base product details
  shopId: string;
  customerId?: string; // Required for creating new manual products
  onSave: (id: string, updates: any) => Promise<void>;
  onCreate?: (newAssignment: any) => void; // Callback when a new product is created
}

const ProductEditorModal: React.FC<ProductEditorModalProps> = ({ isOpen, onClose, assignment, product, shopId, customerId, onSave, onCreate }) => {
  if (!isOpen) return null;

  const isCreateMode = !assignment;

  // Tabs for Left Column
  const [activeTab, setActiveTab] = useState<'view' | 'print'>('view');

  // Form Data for Shop Settings
  const [formData, setFormData] = useState({
    price: assignment?.price || 0,
    personalization_enabled: assignment?.personalization_enabled || false,
    description: assignment?.description || '',
    manufacturer_info: assignment?.manufacturer_info || '',
    size: assignment?.size || '', 
    weight: assignment?.weight || 0,
    variants: assignment?.variants ? (typeof assignment.variants === 'string' ? JSON.parse(assignment.variants) : assignment.variants) : {},
    is_active: (assignment as any)?.is_active === 0 || assignment?.is_active === false ? false : true, // Default to true if undefined or 1
    is_featured: assignment?.is_featured || false,
    supplier_id: assignment?.supplier_id || ''
  });
  
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/suppliers')
        .then(res => res.json())
        .then(data => {
            if (data.success) setSuppliers(data.data);
        })
        .catch(console.error);
  }, []);

  // Edit Data for Existing Product (Edit Mode)
  const [editData, setEditData] = useState({
    name: assignment?.product_name || '',
    productNumber: assignment?.product_number || ''
  });

  // Form Data for New Manual Product (Create Mode only)
  const [createData, setCreateData] = useState({
    name: '',
    productNumber: '',
    weight: 0
  });

  const [shopVariables, setShopVariables] = useState<any[]>([]);
  const [activeVariants, setActiveVariants] = useState<string[]>([]); // Array of variable IDs currently active

  useEffect(() => {
      if (shopId) {
          fetch(`/api/variables/shop/${shopId}`)
              .then(res => res.json())
              .then(data => {
                  if (data.success) {
                      setShopVariables(data.data);
                      
                      // Check variants from formData (which is initialized from assignment)
                      const currentVariants = formData.variants || {};
                      const existingVariantIds = Object.keys(currentVariants);
                      setActiveVariants(existingVariantIds);
                  }
              })
              .catch(err => console.error(err));
      }
  }, [shopId]); 

  const toggleVariant = (variable: any) => {
      const isActive = activeVariants.includes(variable.id);
      let newActive = [...activeVariants];
      let newVariantsData = { ...formData.variants };

      if (isActive) {
          newActive = newActive.filter(id => id !== variable.id);
          delete newVariantsData[variable.id];
      } else {
          newActive.push(variable.id);
          // Initialize variant data
          newVariantsData[variable.id] = {
              name: variable.name,
              values: variable.values, // Default to all values
              price: formData.price // Default to base price
          };
      }
      
      setActiveVariants(newActive);
      setFormData({ ...formData, variants: newVariantsData });
  };

  // Handle Price Input with comma/dot support
  const [priceInput, setPriceInput] = useState((assignment?.price || 0).toFixed(2));

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPriceInput(val);
    
    // Convert comma to dot for parsing
    const normalized = val.replace(',', '.');
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
        setFormData(prev => ({ ...prev, price: num }));
    }
  };

  const [personalizationOptions, setPersonalizationOptions] = useState<any[]>([]);
  const [selectedPersonalizationIds, setSelectedPersonalizationIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/personalization')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setPersonalizationOptions(data.data);
                
                // Initialize selected options from assignment
                let initialSelected: string[] = [];
                if (assignment && (assignment as any).personalization_options) {
                    try {
                        const raw = (assignment as any).personalization_options;
                        initialSelected = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch (e) {
                        initialSelected = [];
                    }
                }
                setSelectedPersonalizationIds(initialSelected);
            }
        })
        .catch(err => console.error(err));
  }, [assignment]);

  const togglePersonalizationOption = (id: string) => {
      setSelectedPersonalizationIds(prev => {
          const newSelection = prev.includes(id) 
              ? prev.filter(pid => pid !== id)
              : [...prev, id];
          return newSelection;
      });
  };

  const handleSave = async () => {
    setSaving(true);
    
    if (isCreateMode) {
        if (!createData.name) {
            alert('Bitte geben Sie einen Produktnamen ein.');
            setSaving(false);
            return;
        }
        if (!createData.weight || createData.weight <= 0) {
            alert('Bitte geben Sie ein gültiges Gewicht (> 0 kg) ein. Dies ist für den Versand erforderlich.');
            setSaving(false);
            return;
        }
        if (!customerId) {
            alert('Kunden-ID fehlt. Bitte neu laden.');
            setSaving(false);
            return;
        }

        try {
            // 1. Create Manual Product
            const prodRes = await fetch(`/api/products/${customerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: createData.name,
                    productNumber: createData.productNumber,
                    description: formData.description,
                    manufacturer_info: formData.manufacturer_info,
                    size: formData.size,
                    weight: createData.weight || formData.weight
                })
            });
            const prodData = await prodRes.json();
            
            if (prodData.success) {
                // 2. Assign to Shop
                const assignRes = await fetch(`/api/shop-management/${shopId}/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id: prodData.id,
                        category_id: null,
                        price: formData.price,
                        is_featured: formData.is_featured
                    })
                });
                const assignData = await assignRes.json();
                
                if (assignData.success) {
                    // 3. Update Assignment with full details (personalization, variants, etc.)
                    await fetch(`/api/shop-management/${shopId}/products/${assignData.data.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...formData,
                            personalization_options: selectedPersonalizationIds
                        })
                    });

                    // Notify parent
                    if (onCreate) onCreate({ ...assignData.data, product_name: createData.name, product_number: createData.productNumber });
                    onClose();
                }
            }
        } catch (e) {
            console.error(e);
            alert('Fehler beim Erstellen.');
        }

    } else {
        // Update existing assignment
        if (assignment) {
            if (!formData.weight || formData.weight <= 0) {
                alert('Bitte geben Sie ein gültiges Gewicht (> 0 kg) ein. Dies ist für den Versand erforderlich.');
                setSaving(false);
                return;
            }

            // Also update basic product info if changed
            if (editData.name !== assignment.product_name || editData.productNumber !== assignment.product_number) {
                // We need to update the base product too. The API endpoint handles this if we pass the fields?
                // Currently `PUT /api/shop-management/:shopId/products/:id` updates assignment and some product details (desc, manuf, size).
                // Let's check if it updates name/number. It seems `customer_products` table has name/number.
                // We might need to ensure the API endpoint supports updating name/number or call product update separately.
                
                // Let's call product update separately to be safe/clean if assignment endpoint doesn't support it fully or for separation of concerns.
                // Actually, the assignment endpoint might be the best place if we want atomic-like behavior, but let's check API.
                // Looking at `api/routes/shop_management.ts`, the PUT updates `customer_products` for manuf, desc, size. It does NOT update name/number.
                // So we should call the product update endpoint.
                
                try {
                    await fetch(`/api/products/${assignment.product_id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: editData.name,
                            productNumber: editData.productNumber
                        })
                    });
                } catch (e) {
                    console.error("Failed to update base product info", e);
                }
            }

            await onSave(assignment.id, {
                ...formData,
                product_name: editData.name, // Optimistic update for UI
                product_number: editData.productNumber, // Optimistic update for UI
                personalization_options: selectedPersonalizationIds
            });
            onClose();
        }
    }
    
    setSaving(false);
  };

  // Files (Images & Print Files)
  const [currentFiles, setCurrentFiles] = useState<any[]>([]);
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  
  useEffect(() => {
      if (assignment?.id) {
          fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images`)
              .then(res => res.json())
              .then(data => {
                  if (data.success) {
                      // Ensure attributes are parsed correctly
                      const parsedAssigned = data.data.assigned.map((img: any) => ({
                          ...img,
                          variant_ids: typeof img.variant_ids === 'string' ? JSON.parse(img.variant_ids) : (img.variant_ids || []),
                          personalization_option_ids: typeof img.personalization_option_ids === 'string' ? JSON.parse(img.personalization_option_ids) : (img.personalization_option_ids || []),
                          size_restrictions: typeof img.size_restrictions === 'string' ? JSON.parse(img.size_restrictions) : (img.size_restrictions || []),
                          attribute_restrictions: typeof img.attribute_restrictions === 'string' ? JSON.parse(img.attribute_restrictions) : (img.attribute_restrictions || {})
                      }));
                      setCurrentFiles(parsedAssigned);
                      setAvailableFiles(data.data.available);
                  }
              })
              .catch(err => console.error(err));
      }
  }, [shopId, assignment?.id]);

      const handleAddFile = async (fileId: string) => {
      if (!assignment) return;
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_id: fileId })
          });
          const data = await res.json();
          
          if (data.success) {
              // The backend returns the new assignment record in data.data
              // If not, we fall back to finding the original file info and giving it a temp ID
              const originalFile = availableFiles.find(img => img.id === fileId);
              
              if (data.data) {
                   setCurrentFiles(prev => [...prev, data.data]);
              } else if (originalFile) {
                   // Fallback: This might be risky if ID is not unique, but better than nothing
                   // Ideally backend always returns the new record with a unique ID
                   setCurrentFiles(prev => [...prev, { ...originalFile, id: `temp-${Date.now()}` }]);
              }
          } else {
              console.error("Failed to add file:", data.error);
              alert("Fehler beim Hinzufügen: " + (data.error || "Unbekannter Fehler"));
          }
      } catch (e) { 
          console.error(e);
          alert("Ein Verbindungsfehler ist aufgetreten.");
      }
  };

  const handleRemoveFile = async (assignmentId: string) => {
      if (!assignment) return;
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${assignmentId}`, {
              method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
              // Only remove the specific assignment (link) from the list, not all instances of the file
              setCurrentFiles(prev => prev.filter(img => img.id !== assignmentId));
          }
      } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      if (!assignment) return; // Cannot upload in create mode yet
      
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      // Determine type based on active tab
      formData.append('type', activeTab === 'view' ? 'view' : 'print');
      
      try {
          const productId = assignment.product_id; 
          const res = await fetch(`/api/products/${productId}/upload`, {
              method: 'POST',
              body: formData
          });
          const data = await res.json();
          
          if (data.success) {
              await handleAddFile(data.data.id);
              setAvailableFiles([data.data, ...availableFiles]);
          }
      } catch (e) { console.error(e); }
  };

  const handleAssignImageToOptions = async (fileId: string, optionIds: string[]) => {
      if (!assignment) return;
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ personalization_option_ids: optionIds })
          });
          const data = await res.json();
          if (data.success) {
              setCurrentFiles(prev => prev.map(img => 
                  img.id === fileId ? { ...img, personalization_option_ids: optionIds } : img
              ));
          }
      } catch (e) { console.error(e); }
  };

  const toggleImageOption = (fileId: string, optionId: string, currentOptionIds: string[]) => {
      const safeOptionIds = Array.isArray(currentOptionIds) ? currentOptionIds : [];
      const newOptionIds = safeOptionIds.includes(optionId)
          ? safeOptionIds.filter(id => id !== optionId)
          : [...safeOptionIds, optionId];
      handleAssignImageToOptions(fileId, newOptionIds);
  };

  const handleAssignImageToVariants = async (fileId: string, variantIds: string[]) => {
      if (!assignment) return;
      try {
          // Optimistic update
          setCurrentFiles(prev => prev.map(img => 
              img.id === fileId ? { ...img, variant_ids: variantIds } : img
          ));

          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variant_ids: variantIds })
          });
          const data = await res.json();
          if (!data.success) {
              // Revert on failure (optional, but good practice)
              console.error("Failed to update variants");
          }
      } catch (e) { console.error(e); }
  };

  const toggleImageVariant = (fileId: string, variantId: string, currentVariantIds: string[]) => {
      // Ensure currentVariantIds is an array
      const safeVariantIds = Array.isArray(currentVariantIds) ? currentVariantIds : [];
      
      const newVariantIds = safeVariantIds.includes(variantId)
          ? safeVariantIds.filter(id => id !== variantId)
          : [...safeVariantIds, variantId];
      handleAssignImageToVariants(fileId, newVariantIds);
  };

  const handleAssignImageToSizes = async (fileId: string, sizes: string[]) => {
      if (!assignment) return;
      try {
          // Optimistic update
          setCurrentFiles(prev => prev.map(img => 
              img.id === fileId ? { ...img, size_restrictions: sizes } : img
          ));

          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ size_restrictions: sizes })
          });
          const data = await res.json();
          if (!data.success) {
             console.error("Failed to update sizes");
          }
      } catch (e) { console.error(e); }
  };

  const toggleImageSize = (fileId: string, size: string, currentSizes: string[]) => {
      // Ensure currentSizes is an array
      const safeSizes = Array.isArray(currentSizes) ? currentSizes : [];
      
      const newSizes = safeSizes.includes(size)
          ? safeSizes.filter(s => s !== size)
          : [...safeSizes, size];
      handleAssignImageToSizes(fileId, newSizes);
  };

  const handleAssignImageToAttributes = async (fileId: string, attributes: Record<string, string[]>) => {
      if (!assignment) return;
      try {
          // Optimistic update
          setCurrentFiles(prev => prev.map(img => 
              img.id === fileId ? { ...img, attribute_restrictions: attributes } : img
          ));

          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attribute_restrictions: attributes })
          });
          const data = await res.json();
          if (!data.success) {
             console.error("Failed to update attributes");
          }
      } catch (e) { console.error(e); }
  };

  const toggleImageAttribute = (fileId: string, varId: string, value: string, currentAttributes: Record<string, string[]>) => {
      // Safety check: ensure currentAttributes is an object
      const safeAttributes = (typeof currentAttributes === 'object' && currentAttributes !== null) ? currentAttributes : {};
      
      const currentValues = safeAttributes[varId] || [];
      const newValues = currentValues.includes(value)
          ? currentValues.filter(v => v !== value)
          : [...currentValues, value];
      
      const newAttributes = { ...safeAttributes, [varId]: newValues };
      if (newValues.length === 0) delete newAttributes[varId];
      
      handleAssignImageToAttributes(fileId, newAttributes);
  };

  // Helper to get grouped available sizes (ONLY type='size' or standard)
  const groupedSizes = React.useMemo(() => {
      const groups: { name: string, id: string, sizes: string[] }[] = [];
      
      if (activeVariants.length > 0) {
          activeVariants.forEach(varId => {
              const variable = shopVariables.find(v => v.id === varId);
              // Only include if type is size or undefined (legacy)
              // But wait, if user didn't set type? Default is 'size'?
              // Let's assume explicit types 'color', 'back_print' are NOT sizes.
              if (variable && variable.type !== 'size' && variable.type) return;

              const variant = formData.variants[varId];
              const values = variant?.values || variable?.values || '';
              
              const sizes = values ? values.split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s !== '') : [];
              
              groups.push({
                  name: variable?.name || 'Unbekannt',
                  id: varId,
                  sizes: sizes
              });
          });
      } 
      
      // If no variant-based sizes found, check standard size field
      if (groups.length === 0 && formData.size) {
          const sizes = formData.size.split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s !== '');
          
          if (sizes.length > 0) {
              groups.push({
                  name: 'Standard-Größen',
                  id: 'standard',
                  sizes: sizes
              });
          }
      }
      return groups;
  }, [activeVariants, formData.variants, formData.size, shopVariables]);

  // Helper to get grouped attributes (color, back_print, etc.)
  const groupedAttributes = React.useMemo(() => {
      const groups: { name: string, id: string, values: string[] }[] = [];
      
      if (activeVariants.length > 0) {
          activeVariants.forEach(varId => {
              const variable = shopVariables.find(v => v.id === varId);
              // Include if type is NOT size
              if (!variable || variable.type === 'size' || !variable.type) return;

              const variant = formData.variants[varId];
              const vals = variant?.values || variable?.values || '';
              
              const values = vals ? vals.split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s !== '') : [];
              
              groups.push({
                  name: variable?.name || 'Unbekannt',
                  id: varId,
                  values: values
              });
          });
      }
      return groups;
  }, [activeVariants, formData.variants, shopVariables]);

  // Filter logic for tabs
  const filteredCurrentFiles = currentFiles.filter(f => {
      if (activeTab === 'view') {
          // View tab: Show view, preview, or images (by extension/thumbnail) unless explicitly print/vector
          return f.type === 'view' || f.type === 'preview' || (!f.type && f.thumbnail_url); 
      } else {
          // Print tab: Show print, vector, photoshop, internal, OR anything that is NOT view/preview
          // This includes files with thumbnails that are not explicitly marked as view/preview
          return ['print', 'vector', 'photoshop', 'internal'].includes(f.type) || (f.type !== 'view' && f.type !== 'preview');
      }
  });

  const filteredAvailableFiles = React.useMemo(() => {
    // 1. Filter by type
    const rawFiltered = availableFiles.filter(f => {
        if (activeTab === 'view') {
            return f.type === 'view' || f.type === 'preview' || (!f.type && f.thumbnail_url);
        } else {
            return ['print', 'vector', 'photoshop', 'internal'].includes(f.type) || (f.type !== 'view' && f.type !== 'preview');
        }
    });

    // 2. Deduplicate by URL but allow re-adding same file to assignments
    // We only want to deduplicate the "Available Files" list so it doesn't show duplicates of ITSELF.
    // But we should NOT filter out files just because they are already in 'currentFiles', 
    // because the user might want to assign the same print file twice (e.g. for different variants).
    const uniqueMap = new Map();
    
    rawFiltered.forEach(f => {
        // REMOVED: check against currentFiles to allow multi-assign
        // if (currentFiles.some(c => c.id === f.id)) return;
        // if (f.file_url && currentFiles.some(c => c.file_url === f.file_url)) return;

        const key = f.file_url;
        if (!key) return; 

        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, { 
                ...f, 
                origin_names: f.product_origin_name ? [f.product_origin_name] : [] 
            });
        } else {
            const existing = uniqueMap.get(key);
            if (f.product_origin_name && !existing.origin_names.includes(f.product_origin_name)) {
                existing.origin_names.push(f.product_origin_name);
            }
        }
    });

    return Array.from(uniqueMap.values());
  }, [availableFiles, activeTab]); // Removed currentFiles from dependency to avoid re-filtering when adding

  const mainImage = currentFiles.find(f => f.type === 'view' || f.type === 'preview' || f.thumbnail_url)?.file_url;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
                {isCreateMode ? 'Neues Produkt anlegen' : 'Produkt bearbeiten'}
            </h2>
            <p className="text-sm text-slate-500">
                {isCreateMode 
                    ? 'Erstellen Sie ein neues manuelles Produkt für diesen Shop.' 
                    : `${assignment?.product_name} (${assignment?.product_number})`
                }
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column: Images & Files */}
            <div className="flex flex-col gap-4">
               {isCreateMode ? (
                   <div className="w-full bg-slate-50 aspect-[3/4] rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                       <ImageIcon size={48} className="mb-4 opacity-50" />
                       <h3 className="font-bold text-lg text-slate-600 mb-2">Bilder & Dateien</h3>
                       <p className="text-sm">Bitte legen Sie das Produkt erst an. Danach können Sie Bilder und Druckdaten hinzufügen.</p>
                       <div className="mt-6 flex items-center text-blue-600 font-medium">
                           <Save size={16} className="mr-2" />
                           <span>Erst speichern</span>
                           <ArrowRight size={16} className="ml-2" />
                       </div>
                   </div>
               ) : (
                   <>
                       {/* Tabs */}
                       <div className="flex space-x-1 border-b border-slate-200 mb-2">
                           <button 
                               onClick={() => setActiveTab('view')}
                               className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'view' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                           >
                               Ansichtsbilder
                           </button>
                           <button 
                               onClick={() => setActiveTab('print')}
                               className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'print' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                           >
                               Druckdaten
                           </button>
                       </div>

                       {/* Main Image (Only visible in View tab) */}
                       {activeTab === 'view' && (
                           <div className="w-full bg-slate-50 aspect-[3/4] rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 relative group overflow-hidden mb-2">
                                {mainImage ? (
                                    <img src={mainImage} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <ImageIcon size={48} className="mb-2 opacity-50" />
                                        <span className="font-bold">Kein Bild</span>
                                    </div>
                                )}
                                
                                {/* Drag & Drop Overlay */}
                                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer">
                                    <Plus size={32} className="mb-2" />
                                    <span className="font-bold">Bild hinzufügen</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                           </div>
                       )}

                       {/* Files List */}
                       <div className="space-y-2">
                           <p className="text-xs font-bold uppercase text-slate-500">
                               Aktive {activeTab === 'view' ? 'Bilder' : 'Dateien'} (Shop)
                           </p>
                           
                           {activeTab === 'view' ? (
                               // Grid View for Images
                               <div className="grid grid-cols-4 gap-2">
                                  {filteredCurrentFiles.map((img: any, idx: number) => (
                                      <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded hover:z-[100] hover:shadow-lg transition-shadow">
                                          <div className="w-full h-full rounded overflow-hidden">
                                              <img src={img.thumbnail_url || img.file_url} className="w-full h-full object-cover" />
                                          </div>
                                          
                                          {/* Personalization & Variant Badges */}
                                          <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-0.5 pointer-events-none">
                                              {img.personalization_option_ids && img.personalization_option_ids.length > 0 && (
                                                  <div className="bg-blue-600/90 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                                                      {img.personalization_option_ids.map((oid: string) => personalizationOptions.find(o => o.id === oid)?.name).join(', ')}
                                                  </div>
                                              )}
                                              {img.variant_ids && img.variant_ids.length > 0 && (
                                                  <div className="bg-green-600/90 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                                                      {img.variant_ids.map((vid: string) => shopVariables.find(v => v.id === vid)?.name).join(', ')}
                                                  </div>
                                              )}
                                          </div>

                                          <button 
                                              onClick={() => handleRemoveFile(img.id)}
                                              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-30 cursor-pointer"
                                              title="Entfernen"
                                          >
                                              <Trash2 size={12} />
                                          </button>
                                          
                                          {/* Assign Option Overlay */}
                                          <div className="absolute top-0 left-0 right-0 bg-black/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-2 text-[10px] text-white z-20 rounded shadow-2xl min-h-full h-fit">
                                              {/* Options Section */}
                                              <div className="font-bold mb-1 underline">Optionen:</div>
                                              <div className="space-y-1 w-full mb-2">
                                                  {personalizationOptions.filter(o => selectedPersonalizationIds.includes(o.id)).map(opt => {
                                                      const isSelected = img.personalization_option_ids?.includes(opt.id);
                                                      return (
                                                          <label key={opt.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                                                              <input 
                                                                  type="checkbox" 
                                                                  checked={isSelected}
                                                                  onChange={() => toggleImageOption(img.id, opt.id, img.personalization_option_ids || [])}
                                                                  className="h-3 w-3 rounded text-blue-500 focus:ring-0"
                                                              />
                                                              <span className="truncate">{opt.name}</span>
                                                          </label>
                                                      );
                                                  })}
                                              </div>

                                          {/* Variants Section */}
                                          <div className="font-bold mb-1 underline">Varianten:</div>
                                          <div className="space-y-1 w-full relative">
                                              {activeVariants.map(varId => {
                                                  const variable = shopVariables.find(v => v.id === varId);
                                                  if (!variable) return null;
                                                  
                                                  const isAssigned = (img.variant_ids || []).includes(varId);
                                                  
                                                  // Detailed attribute logic for preview images
                                                  const attributeGroup = groupedAttributes.find(g => g.id === varId);
                                                  const hasValues = attributeGroup && attributeGroup.values.length > 0;
                                                  
                                                  const currentAttributeRestrictions = img.attribute_restrictions?.[varId] || [];
                                                  const isRestricted = currentAttributeRestrictions.length > 0;

                                                  return (
                                                      <div key={varId} className="relative group/var w-full">
                                                          <label className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                                                              <input 
                                                                  type="checkbox" 
                                                                  checked={isAssigned}
                                                                  onChange={() => toggleImageVariant(img.id, varId, img.variant_ids || [])}
                                                                  className="h-3 w-3 rounded text-green-500 focus:ring-0"
                                                              />
                                                              <span className="truncate flex-1">{variable.name}</span>
                                                              {isRestricted && <span className="ml-1 opacity-75 text-[9px]">({currentAttributeRestrictions.length})</span>}
                                                          </label>
                                                          
                                                          {/* Hover Dropdown for Values */}
                                                          {isAssigned && hasValues && (
                                                              <div className="absolute left-full top-0 ml-0 bg-slate-800 border border-slate-600 shadow-xl rounded p-2 z-[70] hidden group-hover/var:block w-40 max-h-48 overflow-y-auto">
                                                                  <div className="text-[9px] font-bold text-slate-400 mb-2 uppercase">Zeigen bei:</div>
                                                                  <div className="space-y-1">
                                                                       <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-600">
                                                                            <span className="text-[9px] text-slate-400 italic">Alle</span>
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.preventDefault(); e.stopPropagation();
                                                                                    const allSelected = attributeGroup!.values.every(v => currentAttributeRestrictions.includes(v));
                                                                                    const newValues = allSelected ? [] : attributeGroup!.values;
                                                                                    const newAttributes = { ...(img.attribute_restrictions || {}), [varId]: newValues };
                                                                                    if (newValues.length === 0) delete newAttributes[varId];
                                                                                    handleAssignImageToAttributes(img.id, newAttributes);
                                                                                }}
                                                                                className="text-[9px] text-blue-300 hover:text-white hover:underline"
                                                                            >
                                                                                {attributeGroup!.values.every(v => currentAttributeRestrictions.includes(v)) ? 'Keine' : 'Alle'}
                                                                            </button>
                                                                        </div>
                                                                        {attributeGroup!.values.map(val => {
                                                                            const isSelected = currentAttributeRestrictions.includes(val);
                                                                            return (
                                                                                <label key={val} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-700 p-1 rounded">
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        checked={isSelected}
                                                                                        onChange={() => toggleImageAttribute(img.id, varId, val, img.attribute_restrictions || {})}
                                                                                        className="h-3 w-3 rounded text-blue-500 focus:ring-0 bg-slate-700 border-slate-500"
                                                                                    />
                                                                                    <span className="text-[10px] text-slate-200 font-mono">{val}</span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                          </div>
                                      </div>
                                  ))}
                                  <label className="aspect-square bg-slate-100 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer transition-colors">
                                      <Plus size={20} />
                                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                  </label>
                               </div>
                           ) : (
                               // List View for Print Files
    <div className="space-y-2">
        {filteredCurrentFiles.map((file: any) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded hover:shadow-sm">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-500 flex-shrink-0 overflow-hidden border border-slate-200">
                        {file.thumbnail_url ? (
                            <img src={file.thumbnail_url} className="h-full w-full object-cover" />
                        ) : (
                            <FileText size={20} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{file.file_name}</p>
                        <p className="text-xs text-slate-500 uppercase mb-1">{file.type}</p>
                        
                        {/* Variant Assignment for Print Files */}
                        {activeVariants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {activeVariants.map(varId => {
                                    const variable = shopVariables.find(v => v.id === varId);
                                    if (!variable) return null;
                                    
                                    const isAssigned = (file.variant_ids || []).includes(varId);
                                    
                                    // Determine if this is a "values" variable (not size) that needs detailed assignment
                                    // If we have values in groupedAttributes for this varId, it means it's not a size.
                                    const attributeGroup = groupedAttributes.find(g => g.id === varId);
                                    const hasValues = attributeGroup && attributeGroup.values.length > 0;
                                    
                                    const currentAttributeRestrictions = file.attribute_restrictions?.[varId] || [];
                                    const selectedCount = currentAttributeRestrictions.length;
                                    const isRestricted = selectedCount > 0;
                                    
                                    return (
                                        <div key={varId} className="relative group inline-block">
                                            <button 
                                                onClick={() => {
                                                    // Standard toggle behavior for "is assigned to this variant group"
                                                    toggleImageVariant(file.id, varId, file.variant_ids || [])
                                                }}
                                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex items-center ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <span>{variable.name}</span>
                                                {isRestricted && <span className="ml-1 opacity-75">({selectedCount})</span>}
                                            </button>
                                            
                                            {/* Attribute Value Dropdown (only if assigned and has values) */}
                                            {isAssigned && hasValues && (
                                                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded p-2 z-[70] hidden group-hover:block w-48 max-h-64 overflow-y-auto">
                                                    <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Gültig für:</div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                                                            <span className="text-[10px] text-slate-500 italic">Alle Optionen</span>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.preventDefault(); e.stopPropagation();
                                                                    // Toggle ALL
                                                                    const allSelected = attributeGroup!.values.every(v => currentAttributeRestrictions.includes(v));
                                                                    const newValues = allSelected ? [] : attributeGroup!.values;
                                                                    const newAttributes = { ...(file.attribute_restrictions || {}), [varId]: newValues };
                                                                    if (newValues.length === 0) delete newAttributes[varId];
                                                                    handleAssignImageToAttributes(file.id, newAttributes);
                                                                }}
                                                                className="text-[9px] text-blue-600 hover:underline"
                                                            >
                                                                {attributeGroup!.values.every(v => currentAttributeRestrictions.includes(v)) ? 'Keine' : 'Alle'}
                                                            </button>
                                                        </div>
                                                        {attributeGroup!.values.map(val => {
                                                            const isSelected = currentAttributeRestrictions.includes(val);
                                                            return (
                                                                <label key={val} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isSelected}
                                                                        onChange={() => toggleImageAttribute(file.id, varId, val, file.attribute_restrictions || {})}
                                                                        className="h-3 w-3 rounded text-blue-600 focus:ring-0"
                                                                    />
                                                                    <span className="text-xs text-slate-700 font-mono">{val}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                                                   {/* Size Assignment Badge */}
                                                   {groupedSizes.length > 0 && (
                                                       <div className="relative group inline-block">
                                                           <button className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex items-center ${(file.size_restrictions && file.size_restrictions.length > 0) ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                                               <span className="mr-1">Größen:</span>
                                                               {(file.size_restrictions && file.size_restrictions.length > 0) ? `${file.size_restrictions.length} gewählt` : 'Alle'}
                                                           </button>
                                                           
                                                           {/* Size Dropdown */}
    <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded p-2 z-[70] hidden group-hover:block w-56 max-h-64 overflow-y-auto">
                                                               <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Gültig für Größen:</div>
                                                               <div className="space-y-3">
                                                                   {groupedSizes.map(group => {
                                                                       const currentRestrictions = file.size_restrictions || [];
                                                                       const allGroupSizesSelected = group.sizes.every(s => currentRestrictions.includes(s));
                                                                       
                                                                       return (
                                                                           <div key={group.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                                                               <div className="flex items-center justify-between mb-1">
                                                                                   <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]" title={group.name}>{group.name}</span>
                                                                                   <button 
                                                                                       onClick={(e) => {
                                                                                           e.preventDefault();
                                                                                           e.stopPropagation();
                                                                                           const newSizes = allGroupSizesSelected
                                                                                               ? currentRestrictions.filter((s: string) => !group.sizes.includes(s))
                                                                                               : [...new Set([...currentRestrictions, ...group.sizes])];
                                                                                           handleAssignImageToSizes(file.id, newSizes);
                                                                                       }}
                                                                                       className="text-[9px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-0 p-0"
                                                                                   >
                                                                                       {allGroupSizesSelected ? 'Keine' : 'Alle'}
                                                                                   </button>
                                                                               </div>
                                                                               <div className="space-y-1 pl-1">
                                                                                   {group.sizes.length === 0 ? (
                                                                                       <div className="text-[10px] text-red-500 italic pl-1">Keine Größen definiert.</div>
                                                                                   ) : (
                                                                                       group.sizes.map(size => {
                                                                                           const isSelected = currentRestrictions.includes(size);
                                                                                           return (
                                                                                               <label key={`${group.id}-${size}`} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded">
                                                                                                   <input 
                                                                                                       type="checkbox" 
                                                                                                       checked={isSelected}
                                                                                                       onChange={() => toggleImageSize(file.id, size, currentRestrictions)}
                                                                                                       className="h-3 w-3 rounded text-purple-600 focus:ring-0"
                                                                                                   />
                                                                                                   <span className="text-xs text-slate-700 font-mono">{size}</span>
                                                                                               </label>
                                                                                           );
                                                                                       })
                                                                                   )}
                                                                               </div>
                                                                           </div>
                                                                       );
                                                                   })}
                                                               </div>
                                                           </div>
                                                       </div>
                                                   )}
                                               </div>
                                           </div>
                                           <div className="flex items-center space-x-2 ml-2">
                                               <a href={file.file_url} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-blue-600">
                                                   <Download size={16} />
                                               </a>
                                               <button onClick={() => handleRemoveFile(file.id)} className="p-1 text-slate-400 hover:text-red-600">
                                                   <Trash2 size={16} />
                                               </button>
                                           </div>
                                       </div>
                                   ))}
                                   
                                   <label className="flex items-center justify-center p-3 border border-dashed border-slate-300 rounded text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer transition-colors">
                                       <Plus size={16} className="mr-2" />
                                       <span>Druckdaten hochladen</span>
                                       <input type="file" className="hidden" onChange={handleFileUpload} />
                                   </label>
                               </div>
                           )}
                           
                           {activeTab === 'view' && <p className="text-[10px] text-slate-400 italic">Hovern Sie über ein Bild, um es einer Option zuzuweisen.</p>}
                       </div>

                       {/* Available Files (from Customer Product) */}
                       {filteredAvailableFiles.length > 0 && (
                           <div className="space-y-2 pt-4 border-t border-slate-100 mt-4">
                               <p className="text-xs font-bold uppercase text-slate-500">Verfügbare {activeTab === 'view' ? 'Bilder' : 'Dateien'} (Kunde)</p>
                               
                               {activeTab === 'view' ? (
                                   <div className="grid grid-cols-4 gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                      {filteredAvailableFiles.map((img: any, idx: number) => (
                                          <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded overflow-hidden cursor-pointer" onClick={() => handleAddFile(img.id)} title={img.file_name}>
                                              <img src={img.thumbnail_url || img.file_url} className="w-full h-full object-cover" />
                                              <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                  <Plus size={20} className="text-white drop-shadow-md" />
                                              </div>
                                          </div>
                                      ))}
                                   </div>
                               ) : (
                                   <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                                       {filteredAvailableFiles.map((file: any) => (
                                           <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-blue-50 hover:border-blue-200" onClick={() => handleAddFile(file.id)}>
                                               <div className="flex items-center space-x-3 overflow-hidden">
                                                   <div className="h-8 w-8 bg-white rounded flex items-center justify-center text-slate-400 border border-slate-200 flex-shrink-0 overflow-hidden">
                                                       {file.thumbnail_url ? (
                                                           <img src={file.thumbnail_url} className="h-full w-full object-cover" />
                                                       ) : (
                                                           <FileText size={14} />
                                                       )}
                                                   </div>
                                                   <div className="truncate">
                                                       <p className="font-medium text-xs text-slate-700 truncate">{file.file_name}</p>
                                                   </div>
                                               </div>
                                               <Plus size={16} className="text-blue-600" />
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       )}
                   </>
               )}
            </div>

            {/* Right Column: Edit Fields */}
            <div className="space-y-6">
                {/* Title & Product Number */}
                {isCreateMode ? (
                    <div className="space-y-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Produktname *</label>
                            <input 
                                type="text" 
                                className="w-full text-lg font-bold border border-slate-300 rounded p-2 focus:ring-2 focus:ring-yellow-400 outline-none"
                                value={createData.name}
                                onChange={(e) => setCreateData({...createData, name: e.target.value})}
                                placeholder="Neues Produkt..."
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Artikelnummer</label>
                            <input 
                                type="text" 
                                className="w-full text-sm border border-slate-300 rounded p-2 font-mono"
                                value={createData.productNumber}
                                onChange={(e) => setCreateData({...createData, productNumber: e.target.value})}
                                placeholder="ART-12345"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Produktname</label>
                            <input 
                                type="text" 
                                className="w-full text-xl font-black uppercase italic tracking-tighter text-slate-800 border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={editData.name}
                                onChange={(e) => setEditData({...editData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Artikelnummer</label>
                            <input 
                                type="text" 
                                className="w-full text-sm font-mono border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={editData.productNumber}
                                onChange={(e) => setEditData({...editData, productNumber: e.target.value})}
                            />
                        </div>
                    </div>
                )}

                {/* Status & Supplier */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Status im Shop</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                                />
                                <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${formData.is_active ? 'peer-checked:bg-green-600' : ''}`}></div>
                                <span className={`ml-3 text-sm font-medium ${formData.is_active ? 'text-green-600' : 'text-slate-500'}`}>
                                    {formData.is_active ? 'Aktiv (Sichtbar)' : 'Deaktiviert (Versteckt)'}
                                </span>
                            </label>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Highlight / Neu</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={formData.is_featured}
                                    onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                                />
                                <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${formData.is_featured ? 'peer-checked:bg-orange-500' : ''}`}></div>
                                <span className={`ml-3 text-sm font-medium ${formData.is_featured ? 'text-orange-600' : 'text-slate-500'}`}>
                                    {formData.is_featured ? 'Markiert als NEU' : 'Standard'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Lieferant</label>
                        <select 
                            className="w-full border border-slate-300 rounded p-2 text-sm"
                            value={formData.supplier_id}
                            onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                        >
                            <option value="">Kein Lieferant gewählt</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Price & Weight */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Verkaufspreis (Brutto)</label>
                        <div className="flex items-center">
                            <span className="text-2xl font-bold mr-2">€</span>
                            <input 
                                type="text" 
                                className="text-2xl font-bold bg-white border border-slate-300 rounded px-3 py-1 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                                value={priceInput}
                                onChange={handlePriceChange}
                            />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Gewicht (kg) <span className="text-red-600">*</span></label>
                        <div className="flex items-center">
                            <input 
                                type="number" 
                                step="0.001"
                                min="0"
                                className="text-2xl font-bold bg-white border border-slate-300 rounded px-3 py-1 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                                value={isCreateMode ? createData.weight : formData.weight}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isCreateMode) {
                                        setCreateData({ ...createData, weight: val });
                                    } else {
                                        setFormData({ ...formData, weight: val });
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Sizes */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Verfügbare Größen & Varianten</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {/* Dynamic Presets from Variables - Filter to allow size, color, back_print etc. */}
                        {shopVariables.filter((v: any) => v.type === 'size' || v.type === 'color' || v.type === 'back_print' || !v.type).map((v: any) => {
                            const isActive = activeVariants.includes(v.id);
                            return (
                                <button 
                                    key={v.id} 
                                    onClick={() => toggleVariant(v)} 
                                    className={`text-xs px-2 py-1 rounded flex items-center border transition-all ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}
                                >
                                    <span className="mr-1">{isActive ? '✓' : '+'}</span> {v.name}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* If no variants selected, show standard input */}
                    {activeVariants.length === 0 ? (
                        <>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                                placeholder="S, M, L, XL, XXL (Kommagetrennt)"
                                value={formData.size}
                                onChange={(e) => setFormData({...formData, size: e.target.value})}
                            />
                            <p className="text-xs text-slate-400 mt-1">Diese Werte werden im Dropdown angezeigt.</p>
                        </>
                    ) : (
                        <div className="space-y-3 mt-3 bg-slate-50 p-3 rounded border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Konfiguration der Varianten</p>
                            {activeVariants.map(varId => {
                                const variable = shopVariables.find(v => v.id === varId);
                                const variantData = formData.variants[varId] || {};
                                if (!variable) return null;

                                return (
                                    <div key={varId} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-sm text-slate-800">{variable.name}</span>
                                            <div className="flex items-center">
                                                <span className="text-xs mr-2 text-slate-500">Preis:</span>
                                                <div className="flex items-center">
                                                    <span className="text-sm font-bold mr-1">€</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        className="w-20 border border-slate-300 rounded px-2 py-1 text-sm font-bold text-right"
                                                        value={variantData.price || formData.price}
                                                        onChange={(e) => {
                                                            const newVariants = { ...formData.variants };
                                                            newVariants[varId] = { ...newVariants[varId], price: parseFloat(e.target.value) };
                                                            setFormData({ ...formData, variants: newVariants });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-200 rounded p-2 text-xs text-slate-600"
                                            value={variantData.values || variable.values}
                                            onChange={(e) => {
                                                const newVariants = { ...formData.variants };
                                                newVariants[varId] = { ...newVariants[varId], values: e.target.value };
                                                setFormData({ ...formData, variants: newVariants });
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Personalization Toggle */}
                <div className="border border-blue-100 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-lg">✨</span>
                            <span className="font-bold text-blue-900">Personalisierung</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.personalization_enabled}
                                onChange={(e) => setFormData({...formData, personalization_enabled: e.target.checked})}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    {formData.personalization_enabled ? (
                        <div className="space-y-3 mt-4">
                            <p className="text-xs text-blue-800 mb-2">Wählen Sie die verfügbaren Optionen:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {personalizationOptions.map(option => (
                                    <label key={option.id} className={`flex items-center p-3 rounded border cursor-pointer transition-colors ${selectedPersonalizationIds.includes(option.id) ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedPersonalizationIds.includes(option.id)}
                                            onChange={() => togglePersonalizationOption(option.id)}
                                            className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-bold text-sm text-slate-800">{option.name}</div>
                                            <div className="text-xs text-slate-500 flex justify-between">
                                                <span>{option.type === 'text' ? 'Text' : option.type === 'number' ? 'Nummer' : 'Logo'}</span>
                                                <span className="font-bold text-blue-700">+ € {option.price_adjustment?.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {personalizationOptions.length === 0 && (
                                <p className="text-xs text-red-500 italic">Keine Optionen definiert. Bitte unter "Einstellungen & Variablen" anlegen.</p>
                            )}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-500 italic">
                            Personalisierung ist deaktiviert.
                        </div>
                    )}
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Beschreibung (HTML erlaubt)</label>
                    <textarea 
                        className="w-full border border-slate-300 rounded p-3 text-sm h-32 focus:ring-2 focus:ring-slate-500 outline-none resize-y font-mono"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Produktbeschreibung hier eingeben... (HTML-Tags erlaubt)"
                    />
                </div>

                {/* Manufacturer Info */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Herstellerangaben (HTML erlaubt)</label>
                    <textarea 
                        className="w-full border border-slate-300 rounded p-3 text-sm h-24 focus:ring-2 focus:ring-slate-500 outline-none resize-y font-mono"
                        value={formData.manufacturer_info}
                        onChange={(e) => setFormData({...formData, manufacturer_info: e.target.value})}
                        placeholder="Material, Pflegehinweise, etc... (HTML-Tags erlaubt)"
                    />
                </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-4 rounded-b-xl">
            <button onClick={onClose} className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded transition-colors">
                Abbrechen
            </button>
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-8 py-2 bg-slate-900 text-white font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center shadow-lg transform hover:-translate-y-0.5"
            >
                {saving ? 'Speichere...' : (
                    <>
                        <Save size={18} className="mr-2" /> {isCreateMode ? 'Produkt anlegen' : 'Speichern'}
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProductEditorModal;

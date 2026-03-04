
import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Plus, Trash2, ArrowRight, FileText, Download } from 'lucide-react';
import { ShopProductAssignment, Product } from '../../../store';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Assignment is optional for "Create Mode"
  assignment?: ShopProductAssignment & { product_name?: string, product_number?: string, manufacturer_info?: string, description?: string, size?: string, color?: string };
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
    variants: assignment?.variants ? (typeof assignment.variants === 'string' ? JSON.parse(assignment.variants) : assignment.variants) : {}
  });

  // Edit Data for Existing Product (Edit Mode)
  const [editData, setEditData] = useState({
    name: assignment?.product_name || '',
    productNumber: assignment?.product_number || ''
  });

  // Form Data for New Manual Product (Create Mode only)
  const [createData, setCreateData] = useState({
    name: '',
    productNumber: ''
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
                    size: formData.size
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
                        is_featured: false
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
                      setCurrentFiles(data.data.assigned);
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
              const assigned = availableFiles.find(img => img.id === fileId);
              if (assigned) {
                  setCurrentFiles([...currentFiles, assigned]);
              }
          }
      } catch (e) { console.error(e); }
  };

  const handleRemoveFile = async (fileId: string) => {
      if (!assignment) return;
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
              setCurrentFiles(currentFiles.filter(img => img.id !== fileId));
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
              setCurrentFiles(currentFiles.map(img => 
                  img.id === fileId ? { ...img, personalization_option_ids: optionIds } : img
              ));
          }
      } catch (e) { console.error(e); }
  };

  const toggleImageOption = (fileId: string, optionId: string, currentOptionIds: string[]) => {
      const newOptionIds = currentOptionIds.includes(optionId)
          ? currentOptionIds.filter(id => id !== optionId)
          : [...currentOptionIds, optionId];
      handleAssignImageToOptions(fileId, newOptionIds);
  };

  // Filter logic for tabs
  const filteredCurrentFiles = currentFiles.filter(f => {
      if (activeTab === 'view') {
          // View tab: Show view, preview, or images (by extension/thumbnail) unless explicitly print/vector
          return f.type === 'view' || f.type === 'preview' || (!f.type && f.thumbnail_url); 
      } else {
          // Print tab: Show print, vector, photoshop, internal
          return ['print', 'vector', 'photoshop', 'internal'].includes(f.type) || (!f.type && !f.thumbnail_url);
      }
  });

  const filteredAvailableFiles = availableFiles.filter(f => {
       // Only show available files that match current tab type
       if (activeTab === 'view') {
           return (f.type === 'view' || f.type === 'preview' || (!f.type && f.thumbnail_url)) && !currentFiles.some(c => c.id === f.id);
       } else {
           return (['print', 'vector', 'photoshop', 'internal'].includes(f.type) || (!f.type && !f.thumbnail_url)) && !currentFiles.some(c => c.id === f.id);
       }
  });

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
                                      <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded overflow-hidden">
                                          <img src={img.thumbnail_url || img.file_url} className="w-full h-full object-cover" />
                                          
                                          {/* Personalization Badge */}
                                          {img.personalization_option_ids && img.personalization_option_ids.length > 0 && (
                                              <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                                                  {img.personalization_option_ids.map((oid: string) => personalizationOptions.find(o => o.id === oid)?.name).join(', ')}
                                              </div>
                                          )}

                                          <button 
                                              onClick={() => handleRemoveFile(img.id)}
                                              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
                                              title="Entfernen"
                                          >
                                              <Trash2 size={12} />
                                          </button>
                                          
                                          {/* Assign Option Overlay */}
                                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-xs text-white overflow-y-auto">
                                              <div className="font-bold mb-1 underline">Zuordnung:</div>
                                              <div className="space-y-1 w-full">
                                                  {personalizationOptions.filter(o => selectedPersonalizationIds.includes(o.id)).map(opt => {
                                                      const isSelected = img.personalization_option_ids?.includes(opt.id);
                                                      return (
                                                          <label key={opt.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                                                              <input 
                                                                  type="checkbox" 
                                                                  checked={isSelected}
                                                                  onChange={() => toggleImageOption(img.id, opt.id, img.personalization_option_ids || [])}
                                                                  className="rounded text-blue-500 focus:ring-0"
                                                              />
                                                              <span className="truncate">{opt.name}</span>
                                                          </label>
                                                      );
                                                  })}
                                                  {personalizationOptions.filter(o => selectedPersonalizationIds.includes(o.id)).length === 0 && (
                                                      <div className="text-[10px] italic text-slate-400">Keine Optionen aktiviert</div>
                                                  )}
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
                                           <div className="flex items-center space-x-3 overflow-hidden">
                                               <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-500 flex-shrink-0 overflow-hidden border border-slate-200">
                                                   {file.thumbnail_url ? (
                                                       <img src={file.thumbnail_url} className="h-full w-full object-cover" />
                                                   ) : (
                                                       <FileText size={20} />
                                                   )}
                                               </div>
                                               <div className="truncate">
                                                   <p className="font-bold text-sm text-slate-800 truncate">{file.file_name}</p>
                                                   <p className="text-xs text-slate-500 uppercase">{file.type}</p>
                                               </div>
                                           </div>
                                           <div className="flex items-center space-x-2">
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
                                          <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded overflow-hidden cursor-pointer" onClick={() => handleAddFile(img.id)} title={img.product_origin_name ? `Aus: ${img.product_origin_name}` : ''}>
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
                                                       {file.product_origin_name && (
                                                           <p className="text-[10px] text-slate-400 truncate">aus: {file.product_origin_name}</p>
                                                       )}
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

                {/* Price */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Verkaufspreis (Brutto)</label>
                    <div className="flex items-center">
                        <span className="text-2xl font-bold mr-2">€</span>
                        <input 
                            type="text" 
                            className="text-2xl font-bold bg-white border border-slate-300 rounded px-3 py-1 w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={priceInput}
                            onChange={handlePriceChange}
                        />
                    </div>
                </div>

                {/* Sizes */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Verfügbare Größen & Varianten</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {/* Dynamic Presets from Variables */}
                        {shopVariables.filter((v: any) => v.type === 'size').map((v: any) => {
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
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Beschreibung</label>
                    <textarea 
                        className="w-full border border-slate-300 rounded p-3 text-sm h-32 focus:ring-2 focus:ring-slate-500 outline-none resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Produktbeschreibung hier eingeben..."
                    />
                </div>

                {/* Manufacturer Info */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Herstellerangaben</label>
                    <textarea 
                        className="w-full border border-slate-300 rounded p-3 text-sm h-24 focus:ring-2 focus:ring-slate-500 outline-none resize-none"
                        value={formData.manufacturer_info}
                        onChange={(e) => setFormData({...formData, manufacturer_info: e.target.value})}
                        placeholder="Material, Pflegehinweise, etc..."
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

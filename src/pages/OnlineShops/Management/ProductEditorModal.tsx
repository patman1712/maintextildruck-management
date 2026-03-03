
import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { ShopProductAssignment, Product } from '../../../store';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: ShopProductAssignment & { product_name?: string, product_number?: string, manufacturer_info?: string, description?: string, size?: string, color?: string };
  product?: Product; // The base product details
  shopId: string;
  onSave: (id: string, updates: any) => Promise<void>;
}

const ProductEditorModal: React.FC<ProductEditorModalProps> = ({ isOpen, onClose, assignment, product, shopId, onSave }) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    price: assignment.price || 0,
    personalization_enabled: assignment.personalization_enabled || false,
    description: assignment.description || '',
    manufacturer_info: assignment.manufacturer_info || '',
    size: assignment.size || '', 
    variants: assignment.variants ? (typeof assignment.variants === 'string' ? JSON.parse(assignment.variants) : assignment.variants) : {}
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
  }, [shopId]); // Remove formData from dependency array to avoid infinite loop or re-init

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

  const updateVariantPrice = (varId: string, price: number) => {
      setFormData(prev => ({
          ...prev,
          variants: {
              ...prev.variants,
              [varId]: { ...prev.variants[varId], price }
          }
      }));
  };

  // Handle Price Input with comma/dot support
  const [priceInput, setPriceInput] = useState((assignment.price || 0).toFixed(2));

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
                // We need to make sure the backend sends this field.
                // Assuming assignment has personalization_options as array or JSON string
                let initialSelected: string[] = [];
                if ((assignment as any).personalization_options) {
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
  }, []);

  const togglePersonalizationOption = (id: string) => {
      setSelectedPersonalizationIds(prev => {
          const newSelection = prev.includes(id) 
              ? prev.filter(pid => pid !== id)
              : [...prev, id];
          
          // Update formData immediately so it's ready for save
          // But wait, formData doesn't have this field yet.
          // We'll handle it in handleSave
          return newSelection;
      });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(assignment.id, {
        ...formData,
        personalization_options: selectedPersonalizationIds // Add this to the update payload
    });
    setSaving(false);
    onClose();
  };

  // Preset Sizes
  const sizePresets = {
    kids: "98/104, 110/116, 122/128, 134/146, 152/164",
    adults: "XS, S, M, L, XL, XXL, 3XL",
    unisex: "XXS, XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL"
  };

  const applySizePreset = (preset: string) => {
    setFormData(prev => ({ ...prev, size: preset }));
  };

  // Images
  const [currentImages, setCurrentImages] = useState<any[]>([]);
  const [availableImages, setAvailableImages] = useState<any[]>([]);
  
  useEffect(() => {
      fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images`)
          .then(res => res.json())
          .then(data => {
              if (data.success) {
                  setCurrentImages(data.data.assigned);
                  setAvailableImages(data.data.available);
              }
          })
          .catch(err => console.error(err));
  }, [shopId, assignment.id]);

  const handleAddImage = async (fileId: string) => {
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_id: fileId })
          });
          const data = await res.json();
          if (data.success) {
              // Refresh images
              const assigned = availableImages.find(img => img.id === fileId);
              if (assigned) {
                  setCurrentImages([...currentImages, assigned]);
              }
          }
      } catch (e) { console.error(e); }
  };

  const handleRemoveImage = async (fileId: string) => {
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
              setCurrentImages(currentImages.filter(img => img.id !== fileId));
          }
      } catch (e) { console.error(e); }
  };

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      // We need to know the product_id to associate the file with
      // The assignment object might not have it directly if it's a join result, 
      // but usually assignment.product_id is present.
      // Wait, we don't have a direct upload endpoint for shop management yet that handles customer_product_files
      // We should use the existing customer product file upload endpoint or create a new one.
      // Let's assume we can upload to `/api/products/:id/files`
      
      try {
          // We need the base product ID
          const productId = assignment.product_id; 
          const res = await fetch(`/api/products/${productId}/upload`, {
              method: 'POST',
              body: formData
          });
          const data = await res.json();
          
          if (data.success) {
              // After upload, automatically assign it to the shop product
              await handleAddImage(data.data.id);
              
              // Refresh available images list too
              setAvailableImages([data.data, ...availableImages]);
          }
      } catch (e) { console.error(e); }
  };

  const handleAssignImageToOption = async (fileId: string, optionId: string | null) => {
      try {
          const res = await fetch(`/api/shop-management/${shopId}/products/${assignment.id}/images/${fileId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ personalization_option_id: optionId })
          });
          const data = await res.json();
          if (data.success) {
              setCurrentImages(currentImages.map(img => 
                  img.id === fileId ? { ...img, personalization_option_id: optionId } : img
              ));
          }
      } catch (e) { console.error(e); }
  };

  const mainImage = currentImages.length > 0 ? (currentImages[0].file_url || currentImages[0].thumbnail_url) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Produkt bearbeiten</h2>
            <p className="text-sm text-slate-500">{assignment.product_name} ({assignment.product_number})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content - Two Column Layout mimicking Frontend */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column: Images */}
            <div className="flex flex-col gap-4">
               {/* Main Image */}
               <div className="w-full bg-slate-50 aspect-[3/4] rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 relative group overflow-hidden">
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

               {/* Thumbnails List */}
               <div className="space-y-2">
                   <p className="text-xs font-bold uppercase text-slate-500">Aktive Bilder (Shop)</p>
                   <div className="grid grid-cols-4 gap-2">
                      {currentImages.map((img: any, idx: number) => (
                          <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded overflow-hidden">
                              <img src={img.thumbnail_url || img.file_url} className="w-full h-full object-cover" />
                              
                              {/* Personalization Badge */}
                              {img.personalization_option_id && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center" title={personalizationOptions.find(o => o.id === img.personalization_option_id)?.name}>
                                      {personalizationOptions.find(o => o.id === img.personalization_option_id)?.name || 'Option'}
                                  </div>
                              )}

                              {/* Remove Button */}
                              <button 
                                  onClick={() => handleRemoveImage(img.id)}
                                  className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
                                  title="Aus Shop entfernen"
                              >
                                  <Trash2 size={12} />
                              </button>
                              
                              {/* Assign Option Overlay */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                  <select 
                                      className="w-full text-[10px] bg-white text-slate-800 rounded p-1 outline-none border border-slate-300"
                                      value={img.personalization_option_id || ''}
                                      onChange={(e) => handleAssignImageToOption(img.id, e.target.value || null)}
                                      onClick={(e) => e.stopPropagation()}
                                  >
                                      <option value="">(Standard)</option>
                                      {personalizationOptions.filter(o => selectedPersonalizationIds.includes(o.id)).map(opt => (
                                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                      ))}
                      <label className="aspect-square bg-slate-100 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer transition-colors">
                          <Plus size={20} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </label>
                   </div>
                   <p className="text-[10px] text-slate-400 italic">Hovern Sie über ein Bild, um es einer Option zuzuweisen.</p>
               </div>

               {/* Available Images (from Customer Product) */}
               {availableImages.filter(img => !currentImages.some(c => c.id === img.id)).length > 0 && (
                   <div className="space-y-2 pt-4 border-t border-slate-100">
                       <p className="text-xs font-bold uppercase text-slate-500">Verfügbare Bilder (Kunde)</p>
                       <div className="grid grid-cols-4 gap-2 opacity-60 hover:opacity-100 transition-opacity">
                          {availableImages.filter(img => !currentImages.some(c => c.id === img.id)).map((img: any, idx: number) => (
                              <div key={img.id || idx} className="relative group aspect-square bg-slate-50 border border-slate-200 rounded overflow-hidden cursor-pointer" onClick={() => handleAddImage(img.id)}>
                                  <img src={img.thumbnail_url || img.file_url} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                      <Plus size={20} className="text-white drop-shadow-md" />
                                  </div>
                              </div>
                          ))}
                       </div>
                   </div>
               )}
            </div>

            {/* Right Column: Edit Fields */}
            <div className="space-y-6">
                {/* Title (Read Only for now, usually synced with base product) */}
                <div>
                    <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-800 mb-2">{assignment.product_name}</h1>
                    <p className="text-xs text-slate-400">Produktname wird aus dem Stammartikel übernommen.</p>
                </div>

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
                        <Save size={18} className="mr-2" /> Speichern
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProductEditorModal;

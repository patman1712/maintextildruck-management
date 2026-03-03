
import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { ShopProductAssignment, Product } from '../../../store';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: ShopProductAssignment & { product_name?: string, product_number?: string, manufacturer_info?: string, description?: string, size?: string, color?: string };
  product?: Product; // The base product details
  onSave: (id: string, updates: any) => Promise<void>;
}

const ProductEditorModal: React.FC<ProductEditorModalProps> = ({ isOpen, onClose, assignment, product, onSave }) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    price: assignment.price || 0,
    personalization_enabled: assignment.personalization_enabled || false,
    description: assignment.description || '',
    manufacturer_info: assignment.manufacturer_info || '',
    size: assignment.size || '', // Just a string for now, could be JSON or comma separated
    // color: assignment.color || ''
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(assignment.id, formData);
    setSaving(false);
    onClose();
  };

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
            {/* Left Column: Images (Placeholder for now, read-only mostly) */}
            <div className="flex flex-col-reverse lg:flex-row gap-4">
               {/* Thumbnails Placeholder */}
               <div className="flex lg:flex-col gap-4">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="w-20 h-20 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-slate-300">
                          <ImageIcon size={20} />
                      </div>
                  ))}
               </div>
               {/* Main Image Placeholder */}
               <div className="flex-1 bg-slate-50 aspect-[3/4] rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 relative group">
                    <span className="font-bold">Hauptbild</span>
                    <button className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-slate-600">
                        Ändern (Coming Soon)
                    </button>
               </div>
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
                            type="number" 
                            step="0.01"
                            className="text-2xl font-bold bg-white border border-slate-300 rounded px-3 py-1 w-32 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                        />
                    </div>
                </div>

                {/* Sizes */}
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Verfügbare Größen</label>
                    <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-slate-500 outline-none"
                        placeholder="S, M, L, XL, XXL (Kommagetrennt)"
                        value={formData.size}
                        onChange={(e) => setFormData({...formData, size: e.target.value})}
                    />
                    <p className="text-xs text-slate-400 mt-1">Diese Werte werden im Dropdown angezeigt.</p>
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
                        <div className="text-sm text-blue-800">
                            Die Personalisierungs-Optionen (Name, Nummer, Logos) werden im Frontend angezeigt.
                            <br/><span className="text-xs opacity-70">(Konfiguration der Preise folgt in einem späteren Update)</span>
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

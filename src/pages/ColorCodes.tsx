
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Palette } from 'lucide-react';

interface ColorCode {
  id: string;
  title: string;
  hex_code: string;
  created_at: string;
}

const ColorCodes: React.FC = () => {
  const [colors, setColors] = useState<ColorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorCode | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [hexCode, setHexCode] = useState('#000000');

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      const res = await fetch('/api/colors');
      const data = await res.json();
      if (data.success) {
        setColors(data.data);
      }
    } catch (error) {
      console.error('Error fetching colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (color?: ColorCode) => {
    if (color) {
      setEditingColor(color);
      setTitle(color.title);
      setHexCode(color.hex_code);
    } else {
      setEditingColor(null);
      setTitle('');
      setHexCode('#000000');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!title || !hexCode) return;

    try {
      const url = editingColor ? `/api/colors/${editingColor.id}` : '/api/colors';
      const method = editingColor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, hex_code: hexCode })
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchColors();
      }
    } catch (error) {
      console.error('Error saving color:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Farbcode wirklich löschen?')) return;

    try {
      const res = await fetch(`/api/colors/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setColors(colors.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting color:', error);
    }
  };

  if (loading) return <div className="p-8 text-center">Lade Farbcodes...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Palette className="mr-3 text-blue-600" />
            Farbcodes
          </h1>
          <p className="text-slate-500 mt-1">Verwalten Sie hier Ihre internen Farbcodes und Referenzen.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm"
        >
          <Plus size={18} className="mr-2" />
          Farbcode hinzufügen
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {colors.map(color => (
          <div key={color.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
            {/* Color Preview */}
            <div 
              className="h-32 w-full relative"
              style={{ backgroundColor: color.hex_code }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                <div className="bg-white/90 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-sm">
                  {color.hex_code}
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{color.title}</h3>
                <div className="flex space-x-1">
                  <button 
                    onClick={() => handleOpenModal(color)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(color.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center text-slate-500 text-xs font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                <div className="w-3 h-3 rounded-full mr-2 border border-slate-300" style={{ backgroundColor: color.hex_code }}></div>
                {color.hex_code}
              </div>
            </div>
          </div>
        ))}
        
        {colors.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Palette size={48} className="mx-auto mb-4 opacity-50" />
            <p>Noch keine Farbcodes angelegt.</p>
            <button onClick={() => handleOpenModal()} className="text-blue-600 hover:underline mt-2">Jetzt hinzufügen</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800">
                {editingColor ? 'Farbcode bearbeiten' : 'Neuer Farbcode'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titel / Beschreibung</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="z.B. Firmenblau Hauptfarbe"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Farbwert (HEX)</label>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <input 
                      type="color" 
                      className="h-12 w-12 p-1 border border-slate-300 rounded cursor-pointer"
                      value={hexCode}
                      onChange={(e) => setHexCode(e.target.value)}
                    />
                  </div>
                  <input 
                    type="text" 
                    className="flex-1 border border-slate-300 rounded-lg p-2.5 font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="#000000"
                    value={hexCode}
                    onChange={(e) => setHexCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-sm text-slate-500">Vorschau:</div>
                <div 
                  className="h-10 w-24 rounded shadow-sm border border-slate-200"
                  style={{ backgroundColor: hexCode }}
                ></div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button 
                onClick={handleSave}
                disabled={!title || !hexCode}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Save size={18} className="mr-2" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorCodes;

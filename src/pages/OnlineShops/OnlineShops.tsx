
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { ShoppingBag, Plus, Edit, Trash2, ExternalLink, Palette, Truck, CreditCard, Sliders, Save, X, MapPin, RefreshCw, Zap } from 'lucide-react';

const OnlineShops: React.FC = () => {
  const { shops, customers, addShop, updateShop, deleteShop } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  
  // --- VARIABLES STATE ---
  const [variables, setVariables] = useState<any[]>([]);
  const [editingVariable, setEditingVariable] = useState<any | null>(null);
  const [showVariables, setShowVariables] = useState(false); // Toggle Variables Section

  // --- PERSONALIZATION STATE ---
  const [personalizations, setPersonalizations] = useState<any[]>([]);
  const [editingPersonalization, setEditingPersonalization] = useState<any | null>(null);

  // --- GLOBAL SHIPPING STATE ---
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [globalShippingConfig, setGlobalShippingConfig] = useState({
    dhl_user: '',
    dhl_signature: '',
    dhl_ekp: '',
    dhl_sandbox: false,
    dhl_participation: '01',
    sender_name: '',
    sender_street: '',
    sender_house_number: '',
    sender_zip: '',
    sender_city: '',
    sender_country: 'DEU',
    packaging_weight: 0
  });

  const fetchVariables = async () => {
      try {
          const res = await fetch('/api/variables');
          const data = await res.json();
          if (data.success) setVariables(data.data);
      } catch (e) { console.error(e); }
  };

  const fetchPersonalizations = async () => {
      try {
          const res = await fetch('/api/personalization');
          const data = await res.json();
          if (data.success) setPersonalizations(data.data);
      } catch (e) { console.error(e); }
  };

  const fetchGlobalShippingConfig = async () => {
    try {
        const res = await fetch('/api/shop-management/shipping/global-config');
        const data = await res.json();
        if (data.success && data.data) setGlobalShippingConfig(data.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
      fetchVariables();
      fetchPersonalizations();
      fetchGlobalShippingConfig();
  }, []);

  const handleSaveGlobalShippingConfig = async () => {
    try {
      const res = await fetch('/api/shop-management/shipping/global-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalShippingConfig)
      });
      const data = await res.json();
      if (data.success) {
        if (data.data) setGlobalShippingConfig(data.data);
        alert('Globale DHL Versand-Einstellungen gespeichert!');
      } else {
        alert('Fehler beim Speichern: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Netzwerkfehler beim Speichern: ' + e.message);
    }
  };

  const handleTestDHLConnection = async () => {
    setIsTestingConnection(true);
    try {
        const res = await fetch('/api/shop-management/shipping/test-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalShippingConfig)
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
        } else {
            alert('Fehler: ' + data.error);
        }
    } catch (e: any) {
        alert('Verbindung fehlgeschlagen: ' + e.message);
    } finally {
        setIsTestingConnection(false);
    }
  };

  const handleSaveVariable = async () => {
      if (!editingVariable || !editingVariable.name || !editingVariable.values) return;

      try {
          const url = editingVariable.id ? `/api/variables/${editingVariable.id}` : '/api/variables';
          const method = editingVariable.id ? 'PUT' : 'POST';
          
          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(editingVariable)
          });
          const data = await res.json();
          
          if (data.success) {
              fetchVariables();
              setEditingVariable(null);
          } else {
              alert('Fehler: ' + data.error);
          }
      } catch (e: any) {
          alert('Fehler: ' + e.message);
      }
  };

  const handleSavePersonalization = async () => {
      if (!editingPersonalization || !editingPersonalization.name || !editingPersonalization.type) return;

      try {
          const url = editingPersonalization.id ? `/api/personalization/${editingPersonalization.id}` : '/api/personalization';
          const method = editingPersonalization.id ? 'PUT' : 'POST';
          
          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(editingPersonalization)
          });
          const data = await res.json();
          
          if (data.success) {
              fetchPersonalizations();
              setEditingPersonalization(null);
          } else {
              alert('Fehler: ' + data.error);
          }
      } catch (e: any) {
          alert('Fehler: ' + e.message);
      }
  };

  const handleDeleteVariable = async (id: string) => {
      if (!confirm('Variable wirklich löschen?')) return;
      try {
          await fetch(`/api/variables/${id}`, { method: 'DELETE' });
          fetchVariables();
      } catch (e) { console.error(e); }
  };

  const handleDeletePersonalization = async (id: string) => {
      if (!confirm('Option wirklich löschen?')) return;
      try {
          await fetch(`/api/personalization/${id}`, { method: 'DELETE' });
          fetchPersonalizations();
      } catch (e) { console.error(e); }
  };
  // -----------------------

  const [formData, setFormData] = useState({
    customer_id: '',
    name: '',
    domain_slug: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    template: 'standard'
  });

  const handleAdd = () => {
    setEditingShop(null);
    setFormData({
      customer_id: '',
      name: '',
      domain_slug: '',
      primary_color: '#000000',
      secondary_color: '#ffffff',
      template: 'standard'
    });
    setShowModal(true);
  };

  const handleEdit = (shop: any) => {
    setEditingShop(shop);
    setFormData({
      customer_id: shop.customer_id,
      name: shop.name,
      domain_slug: shop.domain_slug,
      primary_color: shop.primary_color,
      secondary_color: shop.secondary_color,
      template: shop.template
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShop) {
      await updateShop(editingShop.id, formData);
    } else {
      await addShop(formData);
    }
    setShowModal(false);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <ShoppingBag className="mr-2 text-red-600" />
            Online-Shops Verwaltung
          </h1>
          <p className="text-slate-500">Erstellen und verwalten Sie individuelle Kunden-Shops</p>
        </div>
        <div className="flex space-x-2">
            <button 
              onClick={() => setShowVariables(!showVariables)}
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${showVariables ? 'bg-slate-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Sliders size={20} className="mr-2" />
              Einstellungen & Variablen
            </button>
            <button 
              onClick={handleAdd}
              className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Neuer Shop
            </button>
        </div>
      </div>

      {showVariables && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center justify-between">
                <div className="flex items-center">
                    <Sliders size={20} className="mr-2" />
                    Globale Shop-Attribute (Größen, Farben)
                </div>
                <button 
                    onClick={() => setEditingVariable({ name: '', type: 'size', values: '', shop_ids: [] })}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center"
                >
                    <Plus size={16} className="mr-1" /> Neu
                </button>
            </h2>
            <p className="text-sm text-gray-600 mb-6">
                Definieren Sie hier Standardwerte für Größen und Farben, die in den Shops verwendet werden können. 
                Diese können anschließend spezifischen Shops zugewiesen werden.
            </p>

            {editingVariable && (
                <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">{editingVariable.id ? 'Variable bearbeiten' : 'Neue Variable'}</h3>
                        <button onClick={() => setEditingVariable(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Name (Intern)</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded" 
                                placeholder="z.B. Kindergrößen"
                                value={editingVariable.name} 
                                onChange={e => setEditingVariable({...editingVariable, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Typ</label>
                            <select 
                                className="w-full border p-2 rounded"
                                value={editingVariable.type}
                                onChange={e => setEditingVariable({...editingVariable, type: e.target.value})}
                            >
                                <option value="size">Größe (Size)</option>
                                <option value="color">Farbe (Color)</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Werte (Kommagetrennt)</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded" 
                                placeholder={editingVariable.type === 'size' ? "S, M, L, XL" : "Rot, Blau, Grün"}
                                value={editingVariable.values} 
                                onChange={e => setEditingVariable({...editingVariable, values: e.target.value})}
                            />
                            <p className="text-xs text-gray-400 mt-1">Geben Sie die verfügbaren Optionen getrennt durch Kommas ein.</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Verfügbar in Shops</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-white">
                                {shops.map(shop => (
                                    <label key={shop.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={(editingVariable.shop_ids || []).includes(shop.id)}
                                            onChange={e => {
                                                const current = editingVariable.shop_ids || [];
                                                const updated = e.target.checked 
                                                    ? [...current, shop.id]
                                                    : current.filter((id: string) => id !== shop.id);
                                                setEditingVariable({...editingVariable, shop_ids: updated});
                                            }}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm truncate" title={shop.name}>{shop.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button 
                            onClick={() => setEditingVariable(null)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded"
                        >
                            Abbrechen
                        </button>
                        <button 
                            onClick={handleSaveVariable}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center"
                        >
                            <Save size={16} className="mr-2" /> Speichern
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {variables.map(v => (
                    <div key={v.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:bg-white hover:shadow-sm transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-800">{v.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase font-bold">{v.type === 'size' ? 'Größe' : 'Farbe'}</span>
                            </div>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingVariable({...v, shop_ids: v.assigned_shop_ids || []})} className="p-1 text-slate-400 hover:text-blue-600"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteVariable(v.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-3" title={v.values}>{v.values}</p>
                        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-slate-200 pt-2">
                            <span>Zugewiesen:</span>
                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-600">
                                {v.assigned_shop_ids ? v.assigned_shop_ids.length : 0} Shops
                            </span>
                        </div>
                    </div>
                ))}
                {variables.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        Keine Variablen vorhanden.
                    </div>
                )}
            </div>

            <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center justify-between">
                <div className="flex items-center">
                    <span className="mr-2 text-xl">✨</span>
                    Personalisierungs-Optionen
                </div>
                <button 
                    onClick={() => setEditingPersonalization({ name: '', type: 'text', price_adjustment: 0 })}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center"
                >
                    <Plus size={16} className="mr-1" /> Neu
                </button>
            </h2>
            <p className="text-sm text-gray-600 mb-6">
                Definieren Sie hier Optionen für die Personalisierung (z.B. "Trikotnummer", "Initialen", "Vereinslogo"), die Sie später einzelnen Produkten hinzufügen können.
            </p>

            {editingPersonalization && (
                <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">{editingPersonalization.id ? 'Option bearbeiten' : 'Neue Option'}</h3>
                        <button onClick={() => setEditingPersonalization(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Name (z.B. "Trikotnummer")</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded" 
                                placeholder="z.B. Initialen"
                                value={editingPersonalization.name} 
                                onChange={e => setEditingPersonalization({...editingPersonalization, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Typ</label>
                            <select 
                                className="w-full border p-2 rounded"
                                value={editingPersonalization.type}
                                onChange={e => setEditingPersonalization({...editingPersonalization, type: e.target.value})}
                            >
                                <option value="text">Text (Name, Initialen)</option>
                                <option value="number">Nummer (0-99)</option>
                                <option value="logo">Logo (Vereinslogo, Sponsor)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Aufpreis (€)</label>
                            <div className="flex items-center">
                                <span className="mr-2 text-slate-500">€</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full border p-2 rounded" 
                                    placeholder="0.00"
                                    value={editingPersonalization.price_adjustment} 
                                    onChange={e => setEditingPersonalization({...editingPersonalization, price_adjustment: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button 
                            onClick={() => setEditingPersonalization(null)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded"
                        >
                            Abbrechen
                        </button>
                        <button 
                            onClick={handleSavePersonalization}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center"
                        >
                            <Save size={16} className="mr-2" /> Speichern
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {personalizations.map(p => (
                    <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:bg-white hover:shadow-sm transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-800">{p.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                    p.type === 'text' ? 'bg-yellow-100 text-yellow-700' :
                                    p.type === 'number' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>{p.type}</span>
                            </div>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingPersonalization(p)} className="p-1 text-slate-400 hover:text-blue-600"><Edit size={16} /></button>
                                <button onClick={() => handleDeletePersonalization(p.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-3">
                            <span className="text-slate-500">Aufpreis:</span>
                            <span className="font-bold text-slate-800">+ € {p.price_adjustment?.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
                {personalizations.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        Keine Personalisierungs-Optionen vorhanden.
                    </div>
                )}
            </div>

            <h2 className="text-lg font-semibold text-slate-700 mt-12 mb-4 border-b pb-2 flex items-center justify-between">
                <div className="flex items-center">
                    <Truck size={20} className="mr-2" />
                    Globaler DHL Versand (Alle Shops)
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={handleTestDHLConnection}
                        disabled={isTestingConnection}
                        className={`text-sm px-4 py-1 rounded flex items-center border transition-all ${
                            isTestingConnection 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                            : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                        }`}
                    >
                        {isTestingConnection ? (
                            <>
                                <RefreshCw size={16} className="mr-2 animate-spin" />
                                Testet...
                            </>
                        ) : (
                            <>
                                <Zap size={16} className="mr-2" /> Verbindung testen
                            </>
                        )}
                    </button>
                    <button 
                        onClick={handleSaveGlobalShippingConfig}
                        className="text-sm bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 flex items-center"
                    >
                        <Save size={16} className="mr-2" /> Speichern
                    </button>
                </div>
            </h2>
            <p className="text-sm text-gray-600 mb-6">
                Hinterlegen Sie hier Ihre DHL Zugangsdaten, die standardmäßig für alle Shops verwendet werden sollen. 
                Sie können diese bei Bedarf in den einzelnen Shops überschreiben.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Global API Credentials */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Truck size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800">DHL API Zugangsdaten</h4>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col mb-4">
                        <div className="flex items-center mb-2">
                            <input 
                                type="checkbox" 
                                id="global_dhl_sandbox"
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                checked={!!globalShippingConfig.dhl_sandbox}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, dhl_sandbox: e.target.checked })}
                            />
                            <label htmlFor="global_dhl_sandbox" className="ml-3 block text-sm font-bold text-slate-700">
                                Sandbox-Modus aktivieren (Testumgebung)
                            </label>
                        </div>
                        {globalShippingConfig.dhl_sandbox && (
                            <button 
                                onClick={() => setGlobalShippingConfig({
                                    ...globalShippingConfig,
                                    dhl_user: '2222222222_01',
                                    dhl_signature: 'pass',
                                    dhl_ekp: '2222222222'
                                })}
                                className="text-xs text-blue-600 hover:text-blue-800 underline self-start ml-7"
                            >
                                Standard DHL Test-Daten laden
                            </button>
                        )}
                    </div>

                    <div>
                         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">DHL API Benutzer</label>
                         <input 
                             type="text" 
                             className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                             value={globalShippingConfig.dhl_user}
                             onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, dhl_user: e.target.value })}
                             placeholder="z.B. user-name"
                         />
                     </div>
                     <div>
                         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">DHL API Passwort (Signature)</label>
                         <input 
                             type="password" 
                             className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                             value={globalShippingConfig.dhl_signature}
                             onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, dhl_signature: e.target.value })}
                             placeholder="••••••••"
                         />
                     </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Abrechnungsnummer (EKP)</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.dhl_ekp}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, dhl_ekp: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Teilnahme</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.dhl_participation}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, dhl_participation: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Verpackungsgewicht (kg)</label>
                         <input 
                             type="number" 
                             step="0.001"
                             className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                             value={globalShippingConfig.packaging_weight || 0}
                             onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, packaging_weight: parseFloat(e.target.value) })}
                             placeholder="z.B. 0.2"
                         />
                         <p className="text-[10px] text-slate-400 mt-1">Dieses Gewicht wird pauschal zu jeder Sendung addiert.</p>
                     </div>
                </div>

                {/* Global Sender Info */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <MapPin size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800">Standard Absenderadresse</h4>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Firma / Name</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            value={globalShippingConfig.sender_name}
                            onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, sender_name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Straße</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.sender_street}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, sender_street: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nr.</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.sender_house_number}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, sender_house_number: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">PLZ</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.sender_zip}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, sender_zip: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Stadt</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={globalShippingConfig.sender_city}
                                onChange={(e) => setGlobalShippingConfig({ ...globalShippingConfig, sender_city: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map(shop => {
          const customer = customers.find(c => c.id === shop.customer_id);
          return (
            <div key={shop.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    {shop.logo_url ? <img src={shop.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <ShoppingBag size={24} />}
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(shop)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => deleteShop(shop.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800">{shop.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{customer?.name || 'Unbekannter Kunde'}</p>
                
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex items-center text-xs text-slate-400">
                    <div className="h-3 w-3 rounded-full mr-1" style={{ backgroundColor: shop.primary_color }} />
                    Primär
                  </div>
                  <div className="flex items-center text-xs text-slate-400">
                    <div className="h-3 w-3 rounded-full mr-1 border border-slate-200" style={{ backgroundColor: shop.secondary_color }} />
                    Sekundär
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={`/shop/${shop.domain_slug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors"
                  >
                    <ExternalLink size={14} className="mr-2" />
                    Frontend
                  </a>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <Palette size={14} className="mr-2" />
                    Design
                  </button>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <Truck size={14} className="mr-2" />
                    DHL
                  </button>
                  <button className="flex items-center justify-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <CreditCard size={14} className="mr-2" />
                    PayPal
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingShop ? 'Shop bearbeiten' : 'Neuer Online-Shop'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kunde</label>
                <select 
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                  value={formData.customer_id}
                  onChange={e => setFormData({...formData, customer_id: e.target.value})}
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Domain Slug (URL)</label>
                <div className="flex">
                  <span className="bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg p-2 text-slate-500 text-sm">/shop/</span>
                  <input 
                    type="text" 
                    required
                    className="flex-1 border border-slate-300 rounded-r-lg p-2 focus:ring-2 focus:ring-red-500 outline-none"
                    value={formData.domain_slug}
                    onChange={e => setFormData({...formData, domain_slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primärfarbe</label>
                  <input 
                    type="color" 
                    className="w-full h-10 border border-slate-300 rounded-lg p-1"
                    value={formData.primary_color}
                    onChange={e => setFormData({...formData, primary_color: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sekundärfarbe</label>
                  <input 
                    type="color" 
                    className="w-full h-10 border border-slate-300 rounded-lg p-1"
                    value={formData.secondary_color}
                    onChange={e => setFormData({...formData, secondary_color: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineShops;

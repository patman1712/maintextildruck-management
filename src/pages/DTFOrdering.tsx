import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Printer, Upload, Download, Trash2, FileText, Check, AlertCircle } from "lucide-react";

export default function DTFOrdering() {
  const orders = useAppStore((state) => state.orders);
  const loading = useAppStore((state) => state.loading);
  const fetchData = useAppStore((state) => state.fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Configuration State
  const [rollWidth, setRollWidth] = useState(55); // in cm
  const [rollLength, setRollLength] = useState(0); // 0 = infinite/auto
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
  const [pickerSearch, setPickerSearch] = useState("");

  // Processing State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Extract all available print files
  const availableFiles = orders.flatMap(order => 
    (order.files || [])
      .filter(f => f.type === 'print' || f.type === 'vector') // Allow vector files too if needed, or just print
      .map(f => ({
        id: f.url || Math.random().toString(36), // Use URL as ID or fallback
        url: f.url,
        name: f.customName || f.name,
        thumbnail: f.thumbnail, // Ensure this property exists on file object
        orderId: order.id,
        customerName: order.customerName,
        date: order.createdAt
      }))
  ).filter(f => f.url); // Only files with URL

  // Filter for picker
  const filteredAvailableFiles = availableFiles.filter(f => 
    f.name.toLowerCase().includes(pickerSearch.toLowerCase()) || 
    f.customerName.toLowerCase().includes(pickerSearch.toLowerCase())
  );

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedPdfUrl(null);
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

        if (data.success && data.url) {
            setGeneratedPdfUrl(data.url);
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
        {generatedPdfUrl && (
            <a 
                href={generatedPdfUrl} 
                download="DTF_Print_Job.pdf"
                className="bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 flex items-center animate-in fade-in zoom-in"
            >
                <Download className="mr-2" size={18} />
                Fertiges PDF herunterladen
            </a>
        )}
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
                        selectedFiles.map((file, idx) => (
                            <div key={`${file.url}-${idx}`} className="flex items-center bg-white border border-gray-200 p-2 rounded hover:border-red-200 transition-colors">
                                <div className="h-12 w-12 bg-gray-100 rounded overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                                    {file.thumbnail ? (
                                        <img src={file.thumbnail} alt="" className="h-full w-full object-contain" />
                                    ) : (
                                        <FileText className="text-gray-400" />
                                    )}
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
                        ))
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
                    <button onClick={() => setShowFilePicker(false)} className="text-gray-500 hover:text-gray-700">
                        <Trash2 className="rotate-45" size={24} /> {/* Using Trash as close X icon hack or import X */}
                    </button>
                </div>
                
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <input 
                        type="text" 
                        placeholder="Suchen nach Dateiname oder Kunde..." 
                        className="w-full border border-gray-300 rounded p-2 focus:ring-red-500 focus:border-red-500"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredAvailableFiles.map((file, idx) => {
                            const isSelected = selectedFiles.some(f => f.url === file.url);
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
                                        {file.thumbnail ? (
                                            <img src={file.thumbnail} alt="" className="w-full h-full object-contain" />
                                        ) : (
                                            <FileText className="text-gray-300 h-12 w-12" />
                                        )}
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                                <div className="bg-red-500 text-white rounded-full p-1 shadow-sm">
                                                    <Check size={16} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium truncate mb-0.5" title={file.name}>{file.name}</p>
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